"""
Market Analysis API - Cactus-style market research with drive-time isochrones
Generates 15-minute drive-time polygons and aggregates census/migration data
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

# Path to CSV data files (in backend/data directory)
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')


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
            raise HTTPException(status_code=400, detail='Unable to geocode property address')
        
        lng, lat = coords
        
        # Step 2: Generate 15-minute drive-time isochrone
        isochrone_geojson = generate_isochrone(lng, lat, minutes=15)
        if not isochrone_geojson:
            raise HTTPException(status_code=500, detail='Unable to generate drive-time isochrone')
        
        # Step 3: Get county FIPS for census data lookup
        county_fips = get_county_fips_from_zip(zip_code)
        if not county_fips:
            raise HTTPException(status_code=400, detail='Unable to determine county from ZIP')
        
        # Step 4: Load ZIP-level migration data
        migration_data = load_migration_data_by_zip(zip_code)
        
        # Step 5: Load county-level census data
        census_data = load_census_data_by_county_fips(county_fips)
        
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

