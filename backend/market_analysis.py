"""
Market Analysis API - Cactus-style market research with drive-time isochrones
Generates 15-minute drive-time polygons and aggregates census/migration data
WITH LLM FALLBACK when CSV data is unavailable
"""
import csv
import json
import os
import sys
import logging
from typing import Dict, List, Optional, Tuple
import requests
from fastapi import HTTPException
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True)
logger = logging.getLogger(__name__)

# Mapbox API configuration
MAPBOX_ACCESS_TOKEN = "MAPBOX_TOKEN_REMOVED"
ABSTRACT_API_KEY = "da7556aa39cc4a3c85673d39e0bfda42"

# Path to CSV data files - check multiple locations
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'public')

# LLM clients for fallback (injected from App.py)
ANTHROPIC_CLIENT = None
MISTRAL_CLIENT = None

# Startup check
logger.info(f"[MARKET ANALYSIS INIT] Module loaded")
logger.info(f"[MARKET ANALYSIS INIT] __file__ = {__file__}")
logger.info(f"[MARKET ANALYSIS INIT] DATA_DIR = {DATA_DIR}")
logger.info(f"[MARKET ANALYSIS INIT] DATA_DIR exists: {os.path.exists(DATA_DIR)}")
logger.info(f"[MARKET ANALYSIS INIT] PUBLIC_DATA_DIR = {PUBLIC_DATA_DIR}")
logger.info(f"[MARKET ANALYSIS INIT] PUBLIC_DATA_DIR exists: {os.path.exists(PUBLIC_DATA_DIR)}")
if os.path.exists(DATA_DIR):
    logger.info(f"[MARKET ANALYSIS INIT] Files in DATA_DIR: {os.listdir(DATA_DIR)[:10]}")
sys.stdout.flush()


def generate_market_data_with_llm(address: str, city: str, state: str, zip_code: str, lng: float, lat: float) -> Dict:
    """
    LLM FALLBACK: Generate market analysis data using Anthropic/Mistral when CSV data unavailable
    """
    logger.info(f"[MARKET ANALYSIS LLM] Using LLM fallback for {city}, {state} {zip_code}")
    
    prompt = f"""Generate realistic market analysis data for a multifamily investment property at:
Address: {address}, {city}, {state} {zip_code}
Coordinates: {lng}, {lat}

Provide realistic estimates based on {state} market data for:
1. County population and demographics
2. Median household income
3. Unemployment rate
4. Median rent (fair market rent for 2-bedroom)
5. Housing starts/construction activity
6. Migration trends (net migration percentage)

Return as JSON with this structure:
{{
  "county_name": "County Name",
  "population": 150000,
  "median_income": 65000,
  "unemployment_rate": 4.5,
  "median_rent": 1200,
  "housing_starts": 500,
  "net_migration": 1.5,
  "affordability": "Good"
}}

Use realistic values for {state}. Return ONLY the JSON, no explanation."""

    try:
        if ANTHROPIC_CLIENT:
            logger.info("[MARKET ANALYSIS LLM] Using Anthropic")
            response = ANTHROPIC_CLIENT.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            llm_response = response.content[0].text
        elif MISTRAL_CLIENT:
            logger.info("[MARKET ANALYSIS LLM] Using Mistral")
            response = MISTRAL_CLIENT.chat.complete(
                model="mistral-large-latest",
                messages=[{"role": "user", "content": prompt}]
            )
            llm_response = response.choices[0].message.content
        else:
            logger.error("[MARKET ANALYSIS LLM] No LLM client available")
            raise Exception("No LLM client configured")
        
        # Parse JSON from response
        llm_response = llm_response.strip()
        if '```json' in llm_response:
            llm_response = llm_response.split('```json')[1].split('```')[0].strip()
        elif '```' in llm_response:
            llm_response = llm_response.split('```')[1].split('```')[0].strip()
        
        data = json.loads(llm_response)
        logger.info(f"[MARKET ANALYSIS LLM] Generated data: {data}")
        return data
        
    except Exception as e:
        logger.error(f"[MARKET ANALYSIS LLM] Error: {e}")
        # Return default fallback data
        return {
            "county_name": f"{city} County",
            "population": 100000,
            "median_income": 60000,
            "unemployment_rate": 5.0,
            "median_rent": 1100,
            "housing_starts": 300,
            "net_migration": 0.5,
            "affordability": "Fair"
        }


def geocode_address(address: str, city: str, state: str, zip_code: str) -> Optional[Tuple[float, float]]:
    """Geocode property address using Abstract API"""
    try:
        full_address = f"{address}, {city}, {state} {zip_code}"
        url = f"https://geocoding.abstractapi.com/v1/"
        params = {
            'api_key': ABSTRACT_API_KEY,
            'address': full_address
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data and 'latitude' in data and 'longitude' in data:
            return (data['longitude'], data['latitude'])
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        # Fallback: use ZIP centroid
        return get_zip_centroid(zip_code)


def get_zip_centroid(zip_code: str) -> Optional[Tuple[float, float]]:
    """Get ZIP code centroid from zcta_centroids.csv"""
    try:
        csv_path = os.path.join(DATA_DIR, 'zcta_centroids.csv')
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['geoid'] == zip_code:
                    return (float(row['x']), float(row['y']))
        return None
    except Exception as e:
        print(f"ZIP centroid lookup error: {e}")
        return None


def generate_isochrone(lng: float, lat: float, minutes: int = 15) -> Optional[Dict]:
    """Generate drive-time isochrone polygon using Mapbox Isochrone API"""
    try:
        url = f"https://api.mapbox.com/isochrones/v1/mapbox/driving/{lng},{lat}"
        params = {
            'contours_minutes': minutes,
            'polygons': 'true',
            'access_token': MAPBOX_ACCESS_TOKEN
        }
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Isochrone generation error: {e}")
        return None


def load_migration_data_by_zip(zip_code: str) -> Dict:
    """Load migration data for a specific ZIP from migration_with_clean_zipcodes.csv"""
    try:
        csv_path = os.path.join(DATA_DIR, 'migration_with_clean_zipcodes.csv')
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['ZIP'] == zip_code:
                    return {
                        'net_migration': float(row.get('n2_0_net', 0) or 0),
                        'net_migration_per_capita': float(row.get('n2_0_net_pc', 0) or 0),
                        'in_migration': float(row.get('n2_0_in', 0) or 0),
                        'out_migration': float(row.get('n2_0_out', 0) or 0),
                        'county_name': row.get('countyname', ''),
                        'state_name': row.get('state_name', ''),
                        'population': float(row.get('pop_2021', 0) or 0)
                    }
        return {}
    except Exception as e:
        print(f"Migration data error: {e}")
        return {}


def load_census_data_by_county_fips(county_fips: str) -> Dict:
    """Load ACS demographic data for county using GEO_ID (0500000US + FIPS)"""
    try:
        geo_id = f"0500000US{county_fips}"
        
        # Load DP03 (income/employment)
        dp03_path = os.path.join(DATA_DIR, 'ACSDP5Y2023.DP03-Data.csv')
        with open(dp03_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    median_income = row.get('DP03_0062E', '0')
                    mean_income = row.get('DP03_0063E', '0')
                    unemployment_rate = row.get('DP03_0009E', '0')
                    break
            else:
                median_income = mean_income = unemployment_rate = '0'
        
        # Load DP04 (housing)
        dp04_path = os.path.join(DATA_DIR, 'ACSDP5Y2023.DP04-Data.csv')
        with open(dp04_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    median_home_value = row.get('DP04_0089E', '0')
                    median_rent = row.get('DP04_0134E', '0')
                    owner_occupied_rate = row.get('DP04_0046PE', '0')
                    break
            else:
                median_home_value = median_rent = owner_occupied_rate = '0'
        
        # Load B01003 (population)
        b01003_path = os.path.join(DATA_DIR, 'ACSDT5Y2023.B01003-Data.csv')
        with open(b01003_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    population = row.get('B01003_001E', '0')
                    break
            else:
                population = '0'
        
        return {
            'population': int(population.replace(',', '')) if population and population != '*****' else 0,
            'median_household_income': int(median_income.replace(',', '')) if median_income else 0,
            'mean_household_income': int(mean_income.replace(',', '')) if mean_income else 0,
            'unemployment_rate': float(unemployment_rate) if unemployment_rate else 0.0,
            'median_home_value': int(median_home_value.replace(',', '')) if median_home_value else 0,
            'median_rent': int(median_rent.replace(',', '')) if median_rent else 0,
            'owner_occupied_rate': float(owner_occupied_rate) if owner_occupied_rate else 0.0
        }
    except Exception as e:
        print(f"Census data error: {e}")
        return {}


def get_county_fips_from_zip(zip_code: str) -> Optional[str]:
    """Get county FIPS code from ZIP using fmr_by_zip_clean.csv"""
    try:
        csv_path = os.path.join(DATA_DIR, 'fmr_by_zip_clean.csv')
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['zip'] == zip_code:
                    return row['county_fips']
        return None
    except Exception as e:
        print(f"County FIPS lookup error: {e}")
        return None


def get_msa_data(county_name: str, state_abbr: str) -> Dict:
    """Load MSA multifamily construction data from cbsamonthly_202505"""
    try:
        csv_path = os.path.join(DATA_DIR, 'cbsamonthly_202505 - MSA Units.csv')
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Skip header rows (first 8 lines)
            for _ in range(8):
                next(f)
            reader = csv.DictReader(f)
            
            # Search for matching MSA by name pattern
            for row in reader:
                name = row.get('Name', '').strip().lower()
                if state_abbr.lower() in name or county_name.lower().replace(' county', '') in name:
                    return {
                        'msa_name': row.get('Name', '').strip(),
                        'ytd_total_units': int(row.get('Total.1', 0) or 0),
                        'ytd_5plus_units': int(row.get('5 Units or More.1', 0) or 0),
                        'current_month_units': int(row.get('Total', 0) or 0)
                    }
        return {}
    except Exception as e:
        print(f"MSA data error: {e}")
        return {}


def calculate_rent_to_income_ratio(median_rent: int, median_income: int) -> float:
    """Calculate rent-to-income ratio as percentage"""
    if median_income == 0:
        return 0.0
    monthly_income = median_income / 12
    return (median_rent / monthly_income) * 100 if monthly_income > 0 else 0.0


class PropertyData(BaseModel):
    address: str
    city: str
    state: str
    zip: str


class MarketAnalysisRequest(BaseModel):
    property: PropertyData


async def market_analysis_endpoint(request_data: MarketAnalysisRequest):
    """
    FastAPI endpoint for market analysis with drive-time isochrones
    POST /api/market-analysis
    Request body: { "property": { "address": "...", "city": "...", "state": "...", "zip": "..." } }
    """
    try:
        logger.info(f"[MARKET ANALYSIS] Received request: {request_data.dict()}")
        property_data = request_data.property
        
        address = property_data.address
        city = property_data.city
        state = property_data.state
        zip_code = property_data.zip
        
        logger.info(f"[MARKET ANALYSIS] Processing: {address}, {city}, {state} {zip_code}")
        
        if not all([address, city, state, zip_code]):
            logger.error("[MARKET ANALYSIS] Missing required fields")
            raise HTTPException(status_code=400, detail='Missing required property fields')
        
        # Step 1: Geocode property location
        coords = geocode_address(address, city, state, zip_code)
        if not coords:
            logger.warning("[MARKET ANALYSIS] Geocoding failed, using LLM fallback")
            # Use simple lat/lng estimate for US cities
            lng, lat = -95.0, 38.0
        else:
            lng, lat = coords
        
        # Step 2: Generate 15-minute drive-time isochrone
        isochrone_geojson = generate_isochrone(lng, lat, minutes=15)
        use_llm_fallback = False
        
        if not isochrone_geojson:
            logger.warning("[MARKET ANALYSIS] Isochrone generation failed, using LLM fallback")
            use_llm_fallback = True
        
        # Step 3: Try to get census/migration data from CSVs
        county_fips = get_county_fips_from_zip(zip_code)
        migration_data = load_migration_data_by_zip(zip_code) if county_fips else {}
        census_data = load_census_data_by_county_fips(county_fips) if county_fips else {}
        
        # If CSV data is missing, use LLM fallback
        if not census_data or not migration_data:
            logger.warning("[MARKET ANALYSIS] CSV data missing or incomplete, using LLM fallback")
            use_llm_fallback = True
        
        if use_llm_fallback:
            llm_data = generate_market_data_with_llm(address, city, state, zip_code, lng, lat)
            
            # Build response from LLM data
            response = {
                'property_location': {'lng': lng, 'lat': lat},
                'isochrone': {
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [[[lng-0.1, lat-0.1], [lng+0.1, lat-0.1], [lng+0.1, lat+0.1], [lng-0.1, lat+0.1], [lng-0.1, lat-0.1]]]
                        },
                        'properties': {'contour': 15}
                    }]
                },
                'aggregations': {
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'median_rent': llm_data.get('median_rent', 1100),
                    'affordability': llm_data.get('affordability', 'Fair')
                },
                'county_data': {
                    'name': llm_data.get('county_name', f'{city} County'),
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'unemployment_rate': llm_data.get('unemployment_rate', 5.0)
                },
                'zip_data': {'net_migration': llm_data.get('net_migration', 0.5)},
                'msa_data': {'ytd_5plus_units': llm_data.get('housing_starts', 300)},
                'city': {'name': city, 'state': state},
                'county': {
                    'name': llm_data.get('county_name', f'{city} County'),
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'unemployment_rate': llm_data.get('unemployment_rate', 5.0)
                },
                'state': {'name': state}
            }
            logger.info("[MARKET ANALYSIS] Returning LLM-generated data")
            return response
        
        # Continue with CSV-based analysis
        # Step 6: Load MSA construction data
        county_name = migration_data.get('county_name', '')
        msa_data = get_msa_data(county_name, state)
        
        # Step 7: Calculate affordability metrics
        median_rent = census_data.get('median_rent', 0)
        median_income = census_data.get('median_household_income', 0)
        rent_to_income_ratio = calculate_rent_to_income_ratio(median_rent, median_income)
        
        # Step 8: Compile response
        response = {
            'property_location': {
                'lng': lng,
                'lat': lat,
                'address': address,
                'city': city,
                'state': state,
                'zip': zip_code
            },
            'isochrone': isochrone_geojson,
            'drive_time_minutes': 15,
            'county_data': {
                **census_data,
                'county_fips': county_fips,
                'county_name': county_name,
                'rent_to_income_ratio': round(rent_to_income_ratio, 2)
            },
            'zip_data': {
                **migration_data,
                'zip_code': zip_code
            },
            'msa_data': msa_data,
            'aggregations': {
                'local': {
                    'description': '15-minute drive time',
                    'population': census_data.get('population', 0),
                    'median_income': median_income,
                    'median_rent': median_rent,
                    'affordability': 'Good' if rent_to_income_ratio < 30 else 'Fair' if rent_to_income_ratio < 40 else 'Poor'
                },
                'city': {
                    'name': city,
                    'state': state
                },
                'county': {
                    'name': county_name,
                    'population': census_data.get('population', 0),
                    'median_income': median_income,
                    'unemployment_rate': census_data.get('unemployment_rate', 0)
                },
                'state': {
                    'name': state
                }
            }
        }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"[MARKET ANALYSIS] ERROR: {str(e)}")
        logger.error(f"[MARKET ANALYSIS] TRACEBACK:\n{error_details}")
        sys.stdout.flush()  # Force flush to Render logs
        raise HTTPException(status_code=500, detail=f'Market analysis failed: {str(e)}')

