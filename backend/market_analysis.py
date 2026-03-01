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

# Mapbox API configuration – set MAPBOX_ACCESS_TOKEN env var on Render
MAPBOX_ACCESS_TOKEN = os.environ.get('MAPBOX_ACCESS_TOKEN', '')
ABSTRACT_API_KEY = "da7556aa39cc4a3c85673d39e0bfda42"

# Path to CSV data files - check multiple locations
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'public')

# US Census Bureau API key
CENSUS_API_KEY = os.environ.get('CENSUS_API_KEY', 'a58ee4f1fa1db660eb306d9eb39390aa1ae6c6c8')

# FRED macro data
from fred_api import fetch_fred_macro_data

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


def fetch_census_data_from_api(county_fips: str) -> Dict:
    """
    Fetch ACS 5-Year census data from the US Census Bureau API.
    county_fips: 5-digit FIPS code (e.g. '06037' for Los Angeles County, CA)
    Returns dict matching the same keys as load_census_data_by_county_fips().
    """
    if not county_fips or len(county_fips) < 5:
        logger.warning(f"[CENSUS API] Invalid county FIPS: {county_fips}")
        return {}

    state_code = county_fips[:2]
    county_code = county_fips[2:]

    def safe_int(val, default=0):
        if val is None or str(val).strip() in ('', 'null', 'None', '-', '(X)', '*****', 'N', '**', '(D)', '(S)'):
            return default
        try:
            return int(float(str(val).replace(',', '').replace('+', '').replace('$', '')))
        except (ValueError, AttributeError):
            return default

    def safe_float(val, default=0.0):
        if val is None or str(val).strip() in ('', 'null', 'None', '-', '(X)', '*****', 'N', '**', '(D)', '(S)'):
            return default
        try:
            return float(str(val).replace(',', '').replace('%', '').replace('+', ''))
        except (ValueError, AttributeError):
            return default

    try:
        # --- Fetch DP03 (Economic) variables ---
        dp03_vars = [
            'DP03_0062E', 'DP03_0063E', 'DP03_0005PE', 'DP03_0002PE',
            'DP03_0119PE', 'DP03_0003PE', 'DP03_0004E', 'NAME'
        ]
        dp03_url = (
            f"https://api.census.gov/data/2023/acs/acs5/profile"
            f"?get={','.join(dp03_vars)}"
            f"&for=county:{county_code}&in=state:{state_code}"
            f"&key={CENSUS_API_KEY}"
        )
        logger.info(f"[CENSUS API] Fetching DP03: state={state_code} county={county_code}")
        dp03_resp = requests.get(dp03_url, timeout=15)
        dp03_resp.raise_for_status()
        dp03_json = dp03_resp.json()
        # Census API returns [[headers], [values]]
        dp03_headers = dp03_json[0]
        dp03_values = dp03_json[1] if len(dp03_json) > 1 else []
        dp03 = dict(zip(dp03_headers, dp03_values)) if dp03_values else {}
        county_name = dp03.get('NAME', '')
        logger.info(f"[CENSUS API] DP03 fetched for: {county_name}")

        # --- Fetch DP04 (Housing) variables ---
        dp04_vars = [
            'DP04_0089E', 'DP04_0134E', 'DP04_0046PE', 'DP04_0001E',
            'DP04_0002E', 'DP04_0003E', 'DP04_0003PE', 'DP04_0046E',
            'DP04_0047E', 'DP04_0047PE', 'DP04_0101E', 'DP04_0101PE',
            'DP04_0142PE', 'DP04_0007E', 'DP04_0008E', 'DP04_0009E',
            'DP04_0010E', 'DP04_0011E', 'DP04_0012E', 'DP04_0013E',
            'DP04_0014E', 'DP04_0017E', 'NAME'
        ]
        dp04_url = (
            f"https://api.census.gov/data/2023/acs/acs5/profile"
            f"?get={','.join(dp04_vars)}"
            f"&for=county:{county_code}&in=state:{state_code}"
            f"&key={CENSUS_API_KEY}"
        )
        logger.info(f"[CENSUS API] Fetching DP04...")
        dp04_resp = requests.get(dp04_url, timeout=15)
        dp04_resp.raise_for_status()
        dp04_json = dp04_resp.json()
        dp04_headers = dp04_json[0]
        dp04_values = dp04_json[1] if len(dp04_json) > 1 else []
        dp04 = dict(zip(dp04_headers, dp04_values)) if dp04_values else {}

        # --- Fetch B01003 (Population) ---
        b01003_url = (
            f"https://api.census.gov/data/2023/acs/acs5"
            f"?get=B01003_001E,NAME"
            f"&for=county:{county_code}&in=state:{state_code}"
            f"&key={CENSUS_API_KEY}"
        )
        logger.info(f"[CENSUS API] Fetching B01003 (population)...")
        pop_resp = requests.get(b01003_url, timeout=15)
        pop_resp.raise_for_status()
        pop_json = pop_resp.json()
        pop_headers = pop_json[0]
        pop_values = pop_json[1] if len(pop_json) > 1 else []
        pop_data = dict(zip(pop_headers, pop_values)) if pop_values else {}

        # --- Fetch state-level income for comparisons ---
        state_income = None
        try:
            state_url = (
                f"https://api.census.gov/data/2023/acs/acs5/profile"
                f"?get=DP03_0062E,NAME"
                f"&for=state:{state_code}"
                f"&key={CENSUS_API_KEY}"
            )
            state_resp = requests.get(state_url, timeout=10)
            state_resp.raise_for_status()
            state_json = state_resp.json()
            if len(state_json) > 1:
                state_dict = dict(zip(state_json[0], state_json[1]))
                state_income = safe_int(state_dict.get('DP03_0062E'))
        except Exception as e:
            logger.warning(f"[CENSUS API] State income fetch failed: {e}")

        # --- Build result dict (same keys as CSV version) ---
        pop = safe_int(pop_data.get('B01003_001E'))
        median_income_val = safe_int(dp03.get('DP03_0062E'))
        mean_income_val = safe_int(dp03.get('DP03_0063E'))
        unemployment = safe_float(dp03.get('DP03_0005PE'))
        labor_force = safe_float(dp03.get('DP03_0002PE'))
        poverty = safe_float(dp03.get('DP03_0119PE'))
        emp_pop = safe_float(dp03.get('DP03_0003PE'))
        total_civ_employed = safe_int(dp03.get('DP03_0004E'))

        median_home_val = safe_int(dp04.get('DP04_0089E'))
        med_rent = safe_int(dp04.get('DP04_0134E'))
        owner_occ_rate = safe_float(dp04.get('DP04_0046PE'))
        total_hu = safe_int(dp04.get('DP04_0001E'))
        occ_units = safe_int(dp04.get('DP04_0002E'))
        vac_units = safe_int(dp04.get('DP04_0003E'))
        vac_rate = safe_float(dp04.get('DP04_0003PE'))
        owner_occ = safe_int(dp04.get('DP04_0046E'))
        renter_occ = safe_int(dp04.get('DP04_0047E'))
        renter_occ_pct = safe_float(dp04.get('DP04_0047PE'))
        median_owner_costs_val = safe_int(dp04.get('DP04_0101E'))
        median_owner_costs_pct_val = safe_float(dp04.get('DP04_0101PE'))
        median_rent_pct_income = safe_float(dp04.get('DP04_0142PE'))

        sf_detached = safe_int(dp04.get('DP04_0007E'))
        sf_attached = safe_int(dp04.get('DP04_0008E'))
        u2 = safe_int(dp04.get('DP04_0009E'))
        u3_4 = safe_int(dp04.get('DP04_0010E'))
        u5_9 = safe_int(dp04.get('DP04_0011E'))
        u10_19 = safe_int(dp04.get('DP04_0012E'))
        u20_plus = safe_int(dp04.get('DP04_0013E'))
        mobile = safe_int(dp04.get('DP04_0014E'))
        median_yr_built = safe_int(dp04.get('DP04_0017E'))

        homeownership_rate = (owner_occ / occ_units * 100) if occ_units > 0 else 0.0
        renter_pct = (renter_occ / occ_units * 100) if occ_units > 0 else 0.0
        mf_stock = u5_9 + u10_19 + u20_plus
        mf_share = (mf_stock / total_hu * 100) if total_hu > 0 else 0.0
        single_family_total = sf_detached + sf_attached
        rent_to_price_ratio = (med_rent * 12 / median_home_val * 100) if median_home_val > 0 else 0.0

        result = {
            'population': pop,
            'median_household_income': median_income_val,
            'mean_household_income': mean_income_val,
            'unemployment_rate': unemployment,
            'labor_force_participation': labor_force,
            'poverty_rate': poverty,
            'employment_pop_ratio': emp_pop,
            'total_civilian_employed': total_civ_employed,
            'median_home_value': median_home_val,
            'median_rent': med_rent,
            'owner_occupied_rate': owner_occ_rate,
            'total_housing_units': total_hu,
            'occupied_units': occ_units,
            'vacant_units': vac_units,
            'vacancy_rate': vac_rate,
            'owner_occupied_units': owner_occ,
            'renter_occupied_units': renter_occ,
            'renter_occupied_pct': renter_occ_pct,
            'homeownership_rate': round(homeownership_rate, 1),
            'renter_percentage': round(renter_pct, 1),
            'median_owner_costs': median_owner_costs_val,
            'median_owner_costs_pct': median_owner_costs_pct_val,
            'median_rent_pct_income': median_rent_pct_income,
            'single_family_total': single_family_total,
            'multifamily_stock': mf_stock,
            'multifamily_share': round(mf_share, 1),
            'mobile_homes': mobile,
            'median_year_built': median_yr_built,
            'rent_to_price_ratio': round(rent_to_price_ratio, 2),
            'county_name': county_name,
            'state_median_income': state_income,
            'data_source': 'census_api'
        }

        logger.info(f"[CENSUS API] SUCCESS: pop={pop}, income=${median_income_val}, rent=${med_rent}, "
                     f"home_value=${median_home_val}, unemployment={unemployment}%")
        return result

    except requests.exceptions.HTTPError as e:
        logger.error(f"[CENSUS API] HTTP error: {e} - Response: {e.response.text if e.response else 'N/A'}")
        return {}
    except Exception as e:
        logger.error(f"[CENSUS API] Error fetching census data: {e}")
        return {}


def get_county_fips_from_coordinates(lat: float, lng: float) -> Optional[str]:
    """
    Get county FIPS code from lat/lng using the FCC Census Block API.
    Fallback when fmr_by_zip_clean.csv is unavailable.
    """
    try:
        url = f"https://geo.fcc.gov/api/census/block/find?latitude={lat}&longitude={lng}&format=json"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        county_fips = data.get('County', {}).get('FIPS')
        if county_fips:
            logger.info(f"[FCC API] Got county FIPS {county_fips} for ({lat}, {lng})")
            return county_fips
        return None
    except Exception as e:
        logger.warning(f"[FCC API] Failed to get county FIPS from coordinates: {e}")
        return None


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
    """Load ACS demographic data for county - tries Census API first, then CSV fallback."""
    # --- Try Census API first (works on Render without CSV files) ---
    api_data = fetch_census_data_from_api(county_fips)
    if api_data:
        logger.info(f"[CENSUS] Using Census API data for FIPS {county_fips}")
        return api_data

    logger.info(f"[CENSUS] Census API failed, trying CSV fallback for FIPS {county_fips}")
    try:
        geo_id = f"0500000US{county_fips}"
        
        def safe_int(val, default=0):
            """Parse census value to int, handling (X), *****, -, N, etc."""
            if not val or str(val).strip() in ('', '(X)', '*****', '-', 'N', '**', 'null', 'None', '(D)', '(S)'):
                return default
            try:
                return int(str(val).replace(',', '').replace('+', '').replace('$', ''))
            except (ValueError, AttributeError):
                return default
        
        def safe_float(val, default=0.0):
            """Parse census value to float, handling special markers."""
            if not val or str(val).strip() in ('', '(X)', '*****', '-', 'N', '**', 'null', 'None', '(D)', '(S)'):
                return default
            try:
                return float(str(val).replace(',', '').replace('%', '').replace('+', ''))
            except (ValueError, AttributeError):
                return default

        # Load DP03 (income/employment/poverty)
        dp03_row = None
        dp03_path = os.path.join(DATA_DIR, 'ACSDP5Y2023.DP03-Data.csv')
        with open(dp03_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            next(reader)  # Skip description header row
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    dp03_row = row
                    break
        
        # Load DP04 (housing/rent/value)
        dp04_row = None
        dp04_path = os.path.join(DATA_DIR, 'ACSDP5Y2023.DP04-Data.csv')
        with open(dp04_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            next(reader)  # Skip description header row
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    dp04_row = row
                    break
        
        # Load B01003 (population)
        population_val = '0'
        b01003_path = os.path.join(DATA_DIR, 'ACSDT5Y2023.B01003-Data.csv')
        with open(b01003_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            next(reader)  # Skip description header row
            for row in reader:
                if row.get('GEO_ID') == geo_id:
                    population_val = row.get('B01003_001E', '0')
                    break
        
        # Extract ALL available fields from DP03 (Economic)
        median_income = dp03_row.get('DP03_0062E', '0') if dp03_row else '0'
        mean_income = dp03_row.get('DP03_0063E', '0') if dp03_row else '0'
        unemployment_rate = dp03_row.get('DP03_0005PE', '0') if dp03_row else '0'
        labor_force_participation = dp03_row.get('DP03_0002PE', '0') if dp03_row else '0'
        poverty_rate = dp03_row.get('DP03_0119PE', '0') if dp03_row else '0'
        employment_pop_ratio = dp03_row.get('DP03_0003PE', '0') if dp03_row else '0'
        median_earnings = dp03_row.get('DP03_0062E', '0') if dp03_row else '0'
        # Industry breakdown
        total_civilian_employed = dp03_row.get('DP03_0004E', '0') if dp03_row else '0'
        
        # Extract ALL available fields from DP04 (Housing)
        median_home_value = dp04_row.get('DP04_0089E', '0') if dp04_row else '0'
        median_rent = dp04_row.get('DP04_0134E', '0') if dp04_row else '0'
        owner_occupied_rate = dp04_row.get('DP04_0046PE', '0') if dp04_row else '0'
        total_housing_units = dp04_row.get('DP04_0001E', '0') if dp04_row else '0'
        occupied_units = dp04_row.get('DP04_0002E', '0') if dp04_row else '0'
        vacant_units = dp04_row.get('DP04_0003E', '0') if dp04_row else '0'
        vacancy_rate = dp04_row.get('DP04_0003PE', '0') if dp04_row else '0'
        owner_occupied_units = dp04_row.get('DP04_0046E', '0') if dp04_row else '0'
        renter_occupied_units = dp04_row.get('DP04_0047E', '0') if dp04_row else '0'
        renter_occupied_pct = dp04_row.get('DP04_0047PE', '0') if dp04_row else '0'
        median_owner_costs = dp04_row.get('DP04_0101E', '0') if dp04_row else '0'
        median_owner_costs_pct = dp04_row.get('DP04_0101PE', '0') if dp04_row else '0'
        median_rent_pct_income = dp04_row.get('DP04_0142PE', '0') if dp04_row else '0'
        # Structure types
        single_family_detached = dp04_row.get('DP04_0007E', '0') if dp04_row else '0'
        single_family_attached = dp04_row.get('DP04_0008E', '0') if dp04_row else '0'
        units_2 = dp04_row.get('DP04_0009E', '0') if dp04_row else '0'
        units_3_4 = dp04_row.get('DP04_0010E', '0') if dp04_row else '0'
        units_5_9 = dp04_row.get('DP04_0011E', '0') if dp04_row else '0'
        units_10_19 = dp04_row.get('DP04_0012E', '0') if dp04_row else '0'
        units_20_plus = dp04_row.get('DP04_0013E', '0') if dp04_row else '0'
        mobile_homes = dp04_row.get('DP04_0014E', '0') if dp04_row else '0'
        median_year_built = dp04_row.get('DP04_0017E', '0') if dp04_row else '0'
        
        # Compute derived values
        pop = safe_int(population_val)
        total_hu = safe_int(total_housing_units)
        occ_units = safe_int(occupied_units)
        owner_occ = safe_int(owner_occupied_units)
        renter_occ = safe_int(renter_occupied_units)
        homeownership_rate = (owner_occ / occ_units * 100) if occ_units > 0 else 0.0
        renter_pct = (renter_occ / occ_units * 100) if occ_units > 0 else 0.0
        
        # Multifamily stock (5+ units)
        mf_stock = safe_int(units_5_9) + safe_int(units_10_19) + safe_int(units_20_plus)
        mf_share = (mf_stock / total_hu * 100) if total_hu > 0 else 0.0
        single_family_total = safe_int(single_family_detached) + safe_int(single_family_attached)
        
        # Rent-to-price ratio
        med_rent = safe_int(median_rent)
        med_value = safe_int(median_home_value)
        rent_to_price_ratio = (med_rent * 12 / med_value * 100) if med_value > 0 else 0.0
        
        return {
            'population': pop,
            'median_household_income': safe_int(median_income),
            'mean_household_income': safe_int(mean_income),
            'unemployment_rate': safe_float(unemployment_rate),
            'labor_force_participation': safe_float(labor_force_participation),
            'poverty_rate': safe_float(poverty_rate),
            'employment_pop_ratio': safe_float(employment_pop_ratio),
            'total_civilian_employed': safe_int(total_civilian_employed),
            'median_home_value': safe_int(median_home_value),
            'median_rent': med_rent,
            'owner_occupied_rate': safe_float(owner_occupied_rate),
            'total_housing_units': total_hu,
            'occupied_units': occ_units,
            'vacant_units': safe_int(vacant_units),
            'vacancy_rate': safe_float(vacancy_rate),
            'owner_occupied_units': owner_occ,
            'renter_occupied_units': renter_occ,
            'renter_occupied_pct': safe_float(renter_occupied_pct),
            'homeownership_rate': round(homeownership_rate, 1),
            'renter_percentage': round(renter_pct, 1),
            'median_owner_costs': safe_int(median_owner_costs),
            'median_owner_costs_pct': safe_float(median_owner_costs_pct),
            'median_rent_pct_income': safe_float(median_rent_pct_income),
            'single_family_total': single_family_total,
            'multifamily_stock': mf_stock,
            'multifamily_share': round(mf_share, 1),
            'mobile_homes': safe_int(mobile_homes),
            'median_year_built': safe_int(median_year_built),
            'rent_to_price_ratio': round(rent_to_price_ratio, 2)
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
        
        if not isochrone_geojson:
            logger.warning("[MARKET ANALYSIS] Isochrone generation failed, will use fallback isochrone")
        
        # Step 3: Get county FIPS and census data (API-first with fallbacks)
        county_fips = get_county_fips_from_zip(zip_code)
        # Fallback: if CSV-based FIPS lookup fails, use FCC API with geocoded coordinates
        if not county_fips and coords:
            logger.info(f"[MARKET ANALYSIS] CSV FIPS lookup failed, trying FCC API for ({lat}, {lng})")
            county_fips = get_county_fips_from_coordinates(lat, lng)
        logger.info(f"[MARKET ANALYSIS] County FIPS for ZIP {zip_code}: {county_fips}")
        
        migration_data = load_migration_data_by_zip(zip_code) if county_fips else {}
        # load_census_data_by_county_fips now tries Census API first, then CSV fallback
        census_data = load_census_data_by_county_fips(county_fips) if county_fips else {}
        logger.info(f"[MARKET ANALYSIS] Census data source: {census_data.get('data_source', 'csv')}, keys: {len(census_data)}")
        logger.info(f"[MARKET ANALYSIS] Migration data keys: {list(migration_data.keys()) if migration_data else 'EMPTY'}")
        
        # Decide whether to use LLM fallback — only if census data is missing
        use_llm_fallback = not census_data
        if use_llm_fallback:
            logger.warning("[MARKET ANALYSIS] Census data missing, using LLM fallback")
        else:
            logger.info(f"[MARKET ANALYSIS] Using REAL census data: pop={census_data.get('population')}, income={census_data.get('median_household_income')}")
        
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
                    'rent_to_income_ratio': round(llm_rir / 100, 4)
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
                    'rent_to_income_ratio': round(llm_rir / 100, 4)
                },
                'state': {
                    'name': state,
                    'median_income': llm_data.get('comparisons', {}).get('income_state'),
                    'rent_to_income_ratio': None
                },
                'rent_to_income_ratio': round(llm_rir / 100, 4),
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
        
        # Continue with real census data analysis
        # Step 6: Load MSA construction data
        county_name = migration_data.get('county_name', '') or census_data.get('county_name', f'{city} County')
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
        
        # Step 7b: Get supplementary data from LLM for fields not in census CSVs
        llm_supplement = {}
        try:
            llm_supplement = generate_market_data_with_llm(address, city, state, zip_code, lng, lat)
            logger.info(f"[MARKET ANALYSIS] LLM supplement: businesses={llm_supplement.get('businesses')}, walk_score={llm_supplement.get('walk_score')}")
        except Exception as e:
            logger.warning(f"[MARKET ANALYSIS] LLM supplement failed: {e}")
        
        # Merge renter/owner data from CSV or LLM
        if not renter_owner or (not renter_owner.get('renter_share') and not renter_owner.get('renter_count')):
            for k in ('renter_share', 'owner_share', 'renter_count', 'owner_count'):
                if llm_supplement.get(k) is not None:
                    renter_owner[k] = llm_supplement[k]
        
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
            'isochrone': isochrone_geojson or {
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
            'county_data': {
                **census_data,
                'county_fips': county_fips,
                'county_name': county_name,
                'rent_to_income_ratio': round(rent_to_income_ratio / 100, 4)
            },
            'zip_data': {
                **migration_data,
                'zip_code': zip_code
            },
            'msa_data': msa_data,
            'rent_to_income_ratio': round(rent_to_income_ratio / 100, 4),
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
                'affordability': 'Good' if rent_to_income_ratio < 25 else 'Fair' if rent_to_income_ratio < 35 else 'Poor',
                'businesses': llm_supplement.get('businesses'),
                'walk_score': llm_supplement.get('walk_score'),
                'vacancy_rate': census_data.get('vacancy_rate', 0),
                'total_housing_units': census_data.get('total_housing_units', 0),
                'homeownership_rate': census_data.get('homeownership_rate', 0),
                'renter_percentage': census_data.get('renter_percentage', 0),
                'labor_force_participation': census_data.get('labor_force_participation', 0),
                'poverty_rate': census_data.get('poverty_rate', 0),
                'multifamily_share': census_data.get('multifamily_share', 0),
                'multifamily_stock': census_data.get('multifamily_stock', 0),
                'single_family_total': census_data.get('single_family_total', 0),
                'rent_to_price_ratio': census_data.get('rent_to_price_ratio', 0),
                'median_home_value': census_data.get('median_home_value', 0),
                'median_owner_costs': census_data.get('median_owner_costs', 0),
                'total_civilian_employed': census_data.get('total_civilian_employed', 0),
                'median_year_built': census_data.get('median_year_built', 0),
                'comparisons': {
                    'income_city': median_income,
                    'income_state': census_data.get('state_median_income') or llm_supplement.get('comparisons', {}).get('income_state'),
                    'income_usa': 75149,
                    'pop_growth_city': llm_supplement.get('comparisons', {}).get('pop_growth_city'),
                    'pop_growth_state': llm_supplement.get('comparisons', {}).get('pop_growth_state'),
                    'pop_growth_usa': 0.5
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
                'vacancy_rate': census_data.get('vacancy_rate', 0),
                'homeownership_rate': census_data.get('homeownership_rate', 0),
                'renter_percentage': census_data.get('renter_percentage', 0),
                'labor_force_participation': census_data.get('labor_force_participation', 0),
                'poverty_rate': census_data.get('poverty_rate', 0),
                'total_housing_units': census_data.get('total_housing_units', 0),
                'multifamily_share': census_data.get('multifamily_share', 0),
                'rent_to_price_ratio': census_data.get('rent_to_price_ratio', 0),
                'median_owner_costs': census_data.get('median_owner_costs', 0),
                'rent_to_income_ratio': round(rent_to_income_ratio / 100, 4)
            },
            'state': {
                'name': state,
                'median_income': census_data.get('state_median_income'),
                'rent_to_income_ratio': census_data.get('state_rir')
            }
        }
        
        # Fetch FRED macro environment data (cached, non-blocking)
        try:
            fred_data = fetch_fred_macro_data()
            response.update(fred_data)
            logger.info("[MARKET ANALYSIS] FRED macro data attached (%d indicators)",
                       len(fred_data.get('macro_environment', {})) - 1)  # -1 for as_of key
        except Exception as fred_err:
            logger.warning("[MARKET ANALYSIS] FRED fetch failed (non-fatal): %s", fred_err)
            response['macro_environment'] = {}

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

