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
import math
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
    LLM FALLBACK (cheap): Generate Cactus-style market data using small models.
    - Minimal prompt, numeric values only, compact JSON.
    - Prefers Mistral small; falls back to Claude Haiku.
    """
    logger.info(f"[MARKET ANALYSIS LLM] Using CHEAP LLM fallback for {city}, {state} {zip_code}")

    prompt = (
        f"City: {city}, State: {state}, ZIP: {zip_code}. "
        f"Return ONLY compact JSON for multifamily market page with numbers only: "
        "{"
        "\"county_name\":\"...\","
        "\"population\":123456,\"median_income\":65000,\"unemployment_rate\":4.8,"
        "\"median_rent\":1200,\"fmr_2br\":1200,"
        "\"housing_starts\":500,\"net_migration\":1.2,"
        "\"affordability\":\"Good\",\"businesses\":2500,\"walk_score\":55,"
        "\"landlord_friendly_score\":70,"
        "\"renter_share\":0.55,\"owner_share\":0.45,\"renter_count\":5000,\"owner_count\":4100,"
        "\"cap_rate_percent\":6.2,"
        "\"comparisons\":{\"income_city\":60000,\"income_state\":65000,\"income_usa\":75000,"
        "\"pop_growth_city\":1.1,\"pop_growth_state\":0.8,\"pop_growth_usa\":0.5}"
        "}"
    )

    try:
        llm_response = None
        if MISTRAL_CLIENT:
            logger.info("[MARKET ANALYSIS LLM] Using Mistral small")
            response = MISTRAL_CLIENT.chat.complete(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": prompt}],
            )
            llm_response = response.choices[0].message.content
        elif ANTHROPIC_CLIENT:
            logger.info("[MARKET ANALYSIS LLM] Using Claude Haiku")
            response = ANTHROPIC_CLIENT.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            llm_response = response.content[0].text
        else:
            logger.error("[MARKET ANALYSIS LLM] No LLM client available")
            raise Exception("No LLM client configured")

        # Parse JSON from response
        llm_response = (llm_response or '').strip()
        if '```json' in llm_response:
            llm_response = llm_response.split('```json')[1].split('```')[0].strip()
        elif '```' in llm_response:
            llm_response = llm_response.split('```')[1].split('```')[0].strip()

        data = json.loads(llm_response)
        logger.info(f"[MARKET ANALYSIS LLM] Generated data (cheap): {data}")
        return data

    except Exception as e:
        logger.error(f"[MARKET ANALYSIS LLM] Error: {e}")
        # Return default minimal data
        return {
            "county_name": f"{city} County",
            "population": 100000,
            "median_income": 60000,
            "unemployment_rate": 5.0,
            "median_rent": 1100,
            "fmr_2br": 1100,
            "housing_starts": 300,
            "net_migration": 0.5,
            "affordability": "Fair",
            "businesses": 1500,
            "walk_score": 45,
            "landlord_friendly_score": 60,
            "renter_share": 0.5,
            "owner_share": 0.5,
            "renter_count": 4000,
            "owner_count": 4000,
            "cap_rate_percent": 6.0,
            "comparisons": {
                "income_city": 58000, "income_state": 65000, "income_usa": 75000,
                "pop_growth_city": 1.0, "pop_growth_state": 0.8, "pop_growth_usa": 0.5
            }
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
        # Prefer public CSV if available, fallback to backend/data
        public_path = os.path.join(PUBLIC_DATA_DIR, 'cbsamonthly_202505 - MSA Units.csv')
        csv_path = public_path if os.path.exists(public_path) else os.path.join(DATA_DIR, 'cbsamonthly_202505 - MSA Units.csv')
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


def classify_area_by_rir(rir: float) -> str:
    """Qualitative area classification based on Rent-to-Income Ratio."""
    if rir <= 15:
        return "Most Affordable"
    if rir <= 18:
        return "Very Affordable"
    if rir <= 22:
        return "Average"
    if rir <= 28:
        return "Less Affordable"
    return "Least Affordable"


def _haversine_miles(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Distance in miles between two lon/lat points."""
    R = 3958.8  # Earth radius in miles
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def build_zip_rir_points(center_lng: float, center_lat: float, county_median_income: int, radius_miles: float = 60.0) -> Dict:
    """Create a GeoJSON FeatureCollection of ZIP points colored by RIR within radius.

    RIR computed using each ZIP's FMR (2BR) and the provided county median income.
    """
    points: List[Dict] = []
    try:
        centroids_path = os.path.join(DATA_DIR, 'zcta_centroids.csv')
        fmr_path = os.path.join(DATA_DIR, 'fmr_by_zip_clean.csv')
        # Build quick lookup for FMR by ZIP
        fmr_map: Dict[str, float] = {}
        try:
            with open(fmr_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    z = (row.get('zip') or '').strip()
                    if not z:
                        continue
                    try:
                        fmr_map[z] = float(row.get('fmr_2br') or 0) or 0.0
                    except Exception:
                        fmr_map[z] = 0.0
        except Exception as e:
            logger.warning(f"[RIR] Failed to load FMR file: {e}")

        with open(centroids_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                z = (row.get('geoid') or '').strip()
                if not z:
                    continue
                try:
                    zx = float(row.get('x') or 0)
                    zy = float(row.get('y') or 0)
                except Exception:
                    continue
                dist = _haversine_miles(center_lng, center_lat, zx, zy)
                if dist > radius_miles:
                    continue
                rent = fmr_map.get(z, 0.0)
                rir = calculate_rent_to_income_ratio(int(rent), int(county_median_income)) if county_median_income else 0.0
                points.append({
                    'type': 'Feature',
                    'geometry': { 'type': 'Point', 'coordinates': [zx, zy] },
                    'properties': { 'zip': z, 'rir': rir, 'rent': rent, 'distance_miles': dist }
                })
    except Exception as e:
        logger.warning(f"[RIR] Failed building ZIP RIR points: {e}")
    return { 'type': 'FeatureCollection', 'features': points }


def get_fmr_for_zip(zip_code: str) -> Optional[float]:
    """Get FMR (2BR) for a ZIP from local datasets (backend/data or client/public)."""
    # Try backend/data FMR first
    try:
        fmr_path = os.path.join(DATA_DIR, 'fmr_by_zip_clean.csv')
        if os.path.exists(fmr_path):
            with open(fmr_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get('zip') or '').strip() == zip_code:
                        try:
                            return float(row.get('fmr_2br') or 0) or 0.0
                        except Exception:
                            return 0.0
    except Exception:
        pass
    # Fallback: attempt public FY26 FMRs if present
    try:
        public_fmr = os.path.join(PUBLIC_DATA_DIR, 'FY26_FMRs - FY26_FMRs.csv')
        if os.path.exists(public_fmr):
            with open(public_fmr, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get('ZIP') or '').strip() == zip_code or (row.get('zip') or '').strip() == zip_code:
                        # Support multiple possible column names
                        for key in ('FMR_2BR', 'fmr_2br', 'fmr2br', '2br'):
                            if key in row:
                                try:
                                    return float(row.get(key) or 0) or 0.0
                                except Exception:
                                    return 0.0
    except Exception:
        pass
    return None


def load_landlord_data(zip_code: str, county_name: str) -> Dict:
    """Load landlord-related metrics from client/public/landlord.csv (best-effort)."""
    result: Dict = {}
    try:
        path = os.path.join(PUBLIC_DATA_DIR, 'landlord.csv')
        if not os.path.exists(path):
            return result
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Try matching by ZIP first, else by county
                if (row.get('zip') or '').strip() == zip_code or (row.get('county') or '').strip().lower() == (county_name or '').strip().lower():
                    # Collect numeric fields if present
                    for key in row.keys():
                        val = row.get(key)
                        if val is None:
                            continue
                        v = None
                        try:
                            v = float(val.replace(',', ''))
                        except Exception:
                            v = val
                        result[key] = v
                    break
    except Exception as e:
        logger.warning(f"[LANDLORD] Failed to load landlord.csv: {e}")
    return result


def load_zip_renter_owner_stats(zip_code: str) -> Dict:
    """Load renter/owner shares and counts from client/public/zip_renter_owner_stats_with_counts.csv."""
    result: Dict = {}
    try:
        path = os.path.join(PUBLIC_DATA_DIR, 'zip_renter_owner_stats_with_counts.csv')
        if not os.path.exists(path):
            return result
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if (row.get('zip') or '').strip() == zip_code or (row.get('ZIP') or '').strip() == zip_code:
                    # Map common fields
                    def get_float(keys: List[str]) -> Optional[float]:
                        for k in keys:
                            if k in row:
                                try:
                                    return float(row.get(k) or 0)
                                except Exception:
                                    return None
                        return None
                    result = {
                        'renter_share': get_float(['renter_share', 'rentershare', 'renter_pct']),
                        'owner_share': get_float(['owner_share', 'ownershare', 'owner_pct']),
                        'renter_count': get_float(['renter_count', 'rentercount']),
                        'owner_count': get_float(['owner_count', 'ownercount'])
                    }
                    break
    except Exception as e:
        logger.warning(f"[RENTER/OWNER] Failed to load zip renter/owner stats: {e}")
    return result


def estimate_market_cap_rate(city: str, state: str, msa_name: Optional[str]) -> Tuple[Optional[float], str]:
    """Estimate market cap rate: try CSVs in build/public; fallback to cheap LLM if missing.

    Returns (cap_rate_percent, source_label).
    """
    # Try Cushman market file in client/build if available
    try:
        build_path = os.path.join(os.path.dirname(__file__), '..', 'client', 'build', 'cushman_q32025_full_markets.csv')
        if os.path.exists(build_path):
            with open(build_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                city_l = (city or '').strip().lower()
                state_l = (state or '').strip().lower()
                msa_l = (msa_name or '').strip().lower() if msa_name else ''
                for row in reader:
                    name = (row.get('Market') or row.get('City') or '').strip().lower()
                    if not name:
                        continue
                    if name == city_l or name == msa_l or state_l in name:
                        for key in ('Cap Rate', 'cap_rate', 'CapRate'):
                            if key in row:
                                try:
                                    return (float(row.get(key)), 'cushman_q32025_full_markets.csv')
                                except Exception:
                                    pass
                        break
    except Exception:
        pass
    # Try landlord.csv if any cap-like field
    try:
        path = os.path.join(PUBLIC_DATA_DIR, 'landlord.csv')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get('city') or '').strip().lower() == (city or '').strip().lower():
                        for key in ('cap_rate', 'market_cap_rate', 'caprate'):
                            if key in row:
                                try:
                                    return (float(row.get(key)), 'landlord.csv')
                                except Exception:
                                    pass
                        break
    except Exception:
        pass

    # LLM fallback: keep prompt extremely short to minimize cost
    try:
        question = f"Typical multifamily cap rate in {city}, {state} (%) only."
        # Prefer Mistral client for lower cost if available
        if MISTRAL_CLIENT:
            response = MISTRAL_CLIENT.chat.complete(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": question}]
            )
            txt = (response.choices[0].message.content or '').strip()
        elif ANTHROPIC_CLIENT:
            response = ANTHROPIC_CLIENT.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=64,
                messages=[{"role": "user", "content": question}]
            )
            txt = (response.content[0].text or '').strip()
        else:
            txt = "6.0"
        # Extract first number
        import re
        m = re.search(r"\d+(?:\.\d+)?", txt)
        if m:
            return (float(m.group(0)), 'LLM_estimate')
    except Exception as e:
        logger.warning(f"[CAP RATE] LLM fallback failed: {e}")
    return (None, 'unknown')


class PropertyData(BaseModel):
    address: str
    city: str
    state: str
    zip: str


class MarketAnalysisRequest(BaseModel):
    property: PropertyData
    drive_time_minutes: int = 15  # Default to 15 minutes


async def market_analysis_endpoint(request_data: MarketAnalysisRequest):
    """
    FastAPI endpoint for market analysis with drive-time isochrones
    POST /api/market-analysis
    Request body: { "property": { "address": "...", "city": "...", "state": "...", "zip": "..." } }
    """
    try:
        logger.info(f"[MARKET ANALYSIS] Received request: {request_data.dict()}")
        property_data = request_data.property
        drive_time_minutes = request_data.drive_time_minutes
        
        address = property_data.address
        city = property_data.city
        state = property_data.state
        zip_code = property_data.zip
        
        logger.info(f"[MARKET ANALYSIS] Processing: {address}, {city}, {state} {zip_code} (Drive time: {drive_time_minutes} min)")
        
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
        
        # Step 2: Generate drive-time isochrone with configurable minutes
        isochrone_geojson = generate_isochrone(lng, lat, minutes=drive_time_minutes)
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
            # Compute rent-to-income ratio and area classification from LLM values
            llm_median_rent = int(llm_data.get('median_rent', 1100) or 0)
            llm_median_income = int(llm_data.get('median_income', 60000) or 0)
            llm_rir = calculate_rent_to_income_ratio(llm_median_rent, llm_median_income)
            llm_area_classification = classify_area_by_rir(llm_rir)
            # Build ZIP-level RIR points around the property for choropleth-like rendering
            llm_zip_rir_points = build_zip_rir_points(lng, lat, llm_median_income)
            # FMR, landlord, renter/owner, cap rate
            fmr_2br = llm_data.get('fmr_2br') if llm_data.get('fmr_2br') is not None else get_fmr_for_zip(zip_code)
            landlord_data = load_landlord_data(zip_code, llm_data.get('county_name', f'{city} County'))
            if llm_data.get('landlord_friendly_score') is not None:
                landlord_data['landlord_friendly_score'] = llm_data.get('landlord_friendly_score')
            renter_owner = load_zip_renter_owner_stats(zip_code)
            for k in ('renter_share','owner_share','renter_count','owner_count'):
                if llm_data.get(k) is not None and not renter_owner.get(k):
                    renter_owner[k] = llm_data.get(k)
            cap_rate = llm_data.get('cap_rate_percent') if llm_data.get('cap_rate_percent') is not None else None
            cap_source = 'LLM_direct' if cap_rate is not None else None
            if cap_rate is None:
                cap_rate, cap_source = estimate_market_cap_rate(city, state, None)
            # Absorption proxy using YTD 5+ units vs net migration as households
            msa_data_llm = {'ytd_total_units': llm_data.get('housing_starts', 300), 'ytd_5plus_units': llm_data.get('housing_starts', 300), 'current_month_units': None}
            net_mig = float(llm_data.get('net_migration', 0.0) or 0.0)
            households_from_mig = net_mig / 2.5 if net_mig else 0.0
            ytd5 = float(msa_data_llm.get('ytd_5plus_units') or 0.0)
            absorption_units = min(households_from_mig, ytd5) if ytd5 else 0.0
            absorption_rate = (absorption_units / ytd5) if ytd5 > 0 else None
            response = {
                'property_location': {'lng': lng, 'lat': lat, 'address': address, 'city': city, 'state': state, 'zip': zip_code},
                'isochrone': {
                    'type': 'FeatureCollection',
                    'features': [{
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [[[lng-0.1, lat-0.1], [lng+0.1, lat-0.1], [lng+0.1, lat+0.1], [lng-0.1, lat+0.1], [lng-0.1, lat-0.1]]]
                        },
                        'properties': {'contour': drive_time_minutes}
                    }]
                },
                'drive_time_minutes': drive_time_minutes,
                'aggregations': {
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'median_rent': llm_data.get('median_rent', 1100),
                    'affordability': llm_data.get('affordability', 'Fair'),
                    'businesses': llm_data.get('businesses'),
                    'walk_score': llm_data.get('walk_score'),
                    'comparisons': llm_data.get('comparisons')
                },
                'county_data': {
                    'name': llm_data.get('county_name', f'{city} County'),
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'median_rent': llm_data.get('median_rent', 1100),
                    'median_home_value': llm_data.get('median_home_value'),
                    'owner_occupied_rate': llm_data.get('owner_occupied_rate'),
                    'unemployment_rate': llm_data.get('unemployment_rate', 5.0),
                    'rent_to_income_ratio': round(llm_rir, 2)
                },
                'zip_data': {
                    'net_migration': llm_data.get('net_migration', 0.5),
                    'net_migration_per_capita': float(llm_data.get('net_migration', 0.5) or 0) / max(float(llm_data.get('population', 100000) or 100000), 1),
                    'in_migration': llm_data.get('in_migration'),
                    'out_migration': llm_data.get('out_migration')
                },
                'msa_data': {'ytd_5plus_units': llm_data.get('housing_starts', 300)},
                'city': {'name': city, 'state': state, 'lat': lat, 'lng': lng},
                'county': {
                    'name': llm_data.get('county_name', f'{city} County'),
                    'fips': None,
                    'population': llm_data.get('population', 100000),
                    'median_income': llm_data.get('median_income', 60000),
                    'median_rent': llm_data.get('median_rent', 1100),
                    'median_home_value': llm_data.get('median_home_value'),
                    'owner_occupied_rate': llm_data.get('owner_occupied_rate'),
                    'unemployment_rate': llm_data.get('unemployment_rate', 5.0),
                    'rent_to_income_ratio': round(llm_rir, 2)
                },
                'state': {
                    'name': state,
                    'median_income': llm_data.get('comparisons', {}).get('income_state'),
                    'rent_to_income_ratio': None
                },
                'rent_to_income_ratio': round(llm_rir, 2),
                'area_classification': llm_area_classification,
                'zip_rir_points': llm_zip_rir_points,
                'fmr': {'zip': zip_code, 'fmr_2br': fmr_2br},
                'landlord': landlord_data,
                'zip_renter_owner': renter_owner,
                'market_cap_rate': {'value_percent': cap_rate, 'source': cap_source},
                'msa_units': {**msa_data_llm, 'absorption_units': absorption_units, 'absorption_rate': absorption_rate}
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
        area_classification = classify_area_by_rir(rent_to_income_ratio)
        zip_rir_points = build_zip_rir_points(lng, lat, median_income)
        # FMR, landlord, renter/owner, cap rate
        fmr_2br = get_fmr_for_zip(zip_code)
        landlord_data = load_landlord_data(zip_code, county_name)
        renter_owner = load_zip_renter_owner_stats(zip_code)
        cap_rate, cap_source = estimate_market_cap_rate(city, state, msa_data.get('msa_name') if msa_data else None)
        # Absorption proxy using YTD 5+ units vs net migration households
        net_mig = float(migration_data.get('net_migration', 0.0) or 0.0)
        households_from_mig = net_mig / 2.5 if net_mig else 0.0
        ytd5 = float((msa_data or {}).get('ytd_5plus_units') or 0.0)
        absorption_units = min(households_from_mig, ytd5) if ytd5 else 0.0
        absorption_rate = (absorption_units / ytd5) if ytd5 > 0 else None
        
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
            'drive_time_minutes': drive_time_minutes,
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
            'rent_to_income_ratio': round(rent_to_income_ratio, 2),
            'area_classification': area_classification,
            'zip_rir_points': zip_rir_points,
            'fmr': {'zip': zip_code, 'fmr_2br': fmr_2br},
            'landlord': landlord_data,
            'zip_renter_owner': renter_owner,
            'market_cap_rate': {'value_percent': cap_rate, 'source': cap_source},
            'msa_units': {**(msa_data or {}), 'absorption_units': absorption_units, 'absorption_rate': absorption_rate},
            'aggregations': {
                'population': census_data.get('population', 0),
                'median_income': median_income,
                'median_rent': median_rent,
                'affordability': 'Good' if rent_to_income_ratio < 0.30 else 'Fair' if rent_to_income_ratio < 0.40 else 'Poor',
                'businesses': census_data.get('businesses') or census_data.get('total_businesses'),
                'walk_score': census_data.get('walk_score'),
                'comparisons': {
                    'income_city': census_data.get('city_median_income'),
                    'income_state': census_data.get('state_median_income'),
                    'income_usa': census_data.get('us_median_income', 75149),
                    'pop_growth_city': census_data.get('city_pop_growth'),
                    'pop_growth_state': census_data.get('state_pop_growth'),
                    'pop_growth_usa': census_data.get('us_pop_growth', 0.5)
                }
            },
            'city': {
                'name': city,
                'lat': lat,
                'lng': lng
            },
            'county': {
                'name': county_name,
                'fips': county_fips,
                'population': census_data.get('population', 0),
                'median_income': median_income,
                'median_rent': median_rent,
                'median_home_value': census_data.get('median_home_value'),
                'owner_occupied_rate': census_data.get('owner_occupied_rate'),
                'unemployment_rate': census_data.get('unemployment_rate', 0),
                'rent_to_income_ratio': round(rent_to_income_ratio, 2)
            },
            'state': {
                'name': state,
                'median_income': census_data.get('state_median_income'),
                'rent_to_income_ratio': census_data.get('state_rir')
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

