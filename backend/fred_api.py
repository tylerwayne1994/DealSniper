"""
FRED (Federal Reserve Economic Data) API integration.

Fetches real-time macroeconomic indicators:
- 30-year mortgage rate
- 10-year Treasury yield
- Federal funds rate
- CPI Rent index (shelter inflation)
- National unemployment rate
- GDP growth rate
- 30-yr mortgage rate 1 year ago (for trend)

All data is cached for 24 hours to avoid unnecessary API calls.
"""

import logging
import os
import time
from typing import Dict, Optional

import requests

logger = logging.getLogger("fred_api")

FRED_API_KEY = os.environ.get("FRED_API_KEY", "3c4009c078f0d493a204f079ca093980")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Treasury bond series by term
TREASURY_SERIES = {
    2: "DGS2",    # 2-Year Treasury Constant Maturity Rate
    3: "DGS3",    # 3-Year Treasury Constant Maturity Rate
    5: "DGS5",    # 5-Year Treasury Constant Maturity Rate
    7: "DGS7",    # 7-Year Treasury Constant Maturity Rate
    10: "DGS10",  # 10-Year Treasury Constant Maturity Rate
}

# Series IDs for the data we want
FRED_SERIES = {
    "mortgage_30yr": "MORTGAGE30US",          # 30-Year Fixed Rate Mortgage Average
    "treasury_10yr": "DGS10",                 # 10-Year Treasury Constant Maturity Rate
    "fed_funds_rate": "FEDFUNDS",             # Federal Funds Effective Rate
    "cpi_rent": "CUSR0000SEHA",              # CPI: Rent of Primary Residence (index)
    "cpi_rent_yoy": "CUSR0000SEHA",          # Same series, will compute YoY change
    "unemployment_rate": "UNRATE",            # Civilian Unemployment Rate
    "gdp_growth": "A191RL1Q225SBEA",         # Real GDP Growth Rate (quarterly, annualized)
    "housing_starts": "HOUST",               # Housing Starts: Total (thousands)
    "consumer_sentiment": "UMCSENT",          # U of Michigan Consumer Sentiment
}

# Cache: {series_id: {"value": ..., "date": ..., "fetched_at": timestamp}}
_cache: Dict[str, dict] = {}
CACHE_TTL = 86400  # 24 hours


def _fetch_series(series_id: str, limit: int = 2, sort_order: str = "desc") -> Optional[dict]:
    """Fetch the latest observation(s) for a FRED series."""
    cache_key = f"{series_id}_{limit}"
    now = time.time()

    # Check cache
    if cache_key in _cache and (now - _cache[cache_key]["fetched_at"]) < CACHE_TTL:
        return _cache[cache_key]

    try:
        params = {
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": sort_order,
            "limit": limit,
        }
        resp = requests.get(FRED_BASE_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        observations = data.get("observations", [])
        if not observations:
            return None

        result = {
            "observations": observations,
            "fetched_at": now,
        }
        _cache[cache_key] = result
        return result

    except Exception as e:
        logger.warning("[FRED] Failed to fetch %s: %s", series_id, e)
        return None


def _latest_value(series_id: str) -> Optional[float]:
    """Get the most recent non-'.' value for a series."""
    result = _fetch_series(series_id, limit=5)
    if not result:
        return None
    for obs in result["observations"]:
        val = obs.get("value", ".")
        if val != ".":
            try:
                return float(val)
            except (ValueError, TypeError):
                continue
    return None


def _latest_value_and_date(series_id: str) -> tuple:
    """Get the most recent value and its date."""
    result = _fetch_series(series_id, limit=5)
    if not result:
        return None, None
    for obs in result["observations"]:
        val = obs.get("value", ".")
        if val != ".":
            try:
                return float(val), obs.get("date")
            except (ValueError, TypeError):
                continue
    return None, None


def _compute_yoy_change(series_id: str) -> Optional[float]:
    """Fetch enough data to compute year-over-year percent change."""
    try:
        params = {
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": 15,  # ~15 months of monthly data
        }
        resp = requests.get(FRED_BASE_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        observations = data.get("observations", [])

        # Find current and ~12 months ago
        values = []
        for obs in observations:
            val = obs.get("value", ".")
            if val != ".":
                try:
                    values.append((obs["date"], float(val)))
                except (ValueError, TypeError):
                    continue

        if len(values) < 2:
            return None

        current = values[0][1]
        # Find one closest to 12 months back
        old = values[-1][1] if len(values) >= 12 else values[min(len(values) - 1, 11)][1]

        if old == 0:
            return None
        return round(((current - old) / old) * 100, 2)

    except Exception as e:
        logger.warning("[FRED] YoY computation failed for %s: %s", series_id, e)
        return None


def fetch_fred_macro_data() -> Dict:
    """
    Fetch all macro indicators from FRED. Returns a dict ready to merge
    into the market analysis response.

    Returns:
    {
        "macro_environment": {
            "mortgage_30yr": {"value": 6.65, "date": "2026-02-27", "label": "30-Yr Mortgage Rate"},
            "treasury_10yr": {"value": 4.25, "date": "...", "label": "10-Yr Treasury Yield"},
            "fed_funds_rate": {"value": 5.33, "date": "...", "label": "Federal Funds Rate"},
            "unemployment_rate": {"value": 4.1, "date": "...", "label": "Unemployment Rate"},
            "gdp_growth": {"value": 2.8, "date": "...", "label": "GDP Growth (Annualized)"},
            "cpi_rent_yoy": {"value": 4.6, "label": "Rent Inflation (YoY)"},
            "housing_starts": {"value": 1420, "date": "...", "label": "Housing Starts (000s)"},
            "consumer_sentiment": {"value": 67.4, "date": "...", "label": "Consumer Sentiment"},
            "as_of": "2026-02-27"
        }
    }
    """
    logger.info("[FRED] Fetching macro environment data...")

    indicators = {}

    # 30-Year Mortgage Rate
    val, date = _latest_value_and_date("MORTGAGE30US")
    if val is not None:
        indicators["mortgage_30yr"] = {"value": val, "date": date, "unit": "%", "label": "30-Yr Mortgage Rate"}

    # 10-Year Treasury
    val, date = _latest_value_and_date("DGS10")
    if val is not None:
        indicators["treasury_10yr"] = {"value": val, "date": date, "unit": "%", "label": "10-Yr Treasury Yield"}

    # Federal Funds Rate
    val, date = _latest_value_and_date("FEDFUNDS")
    if val is not None:
        indicators["fed_funds_rate"] = {"value": val, "date": date, "unit": "%", "label": "Federal Funds Rate"}

    # Unemployment Rate
    val, date = _latest_value_and_date("UNRATE")
    if val is not None:
        indicators["unemployment_rate"] = {"value": val, "date": date, "unit": "%", "label": "Unemployment Rate"}

    # GDP Growth (quarterly)
    val, date = _latest_value_and_date("A191RL1Q225SBEA")
    if val is not None:
        indicators["gdp_growth"] = {"value": val, "date": date, "unit": "%", "label": "GDP Growth (Annualized)"}

    # CPI Rent YoY change
    yoy = _compute_yoy_change("CUSR0000SEHA")
    if yoy is not None:
        indicators["cpi_rent_yoy"] = {"value": yoy, "date": None, "unit": "%", "label": "Rent Inflation (YoY)"}

    # Housing Starts
    val, date = _latest_value_and_date("HOUST")
    if val is not None:
        indicators["housing_starts"] = {"value": val, "date": date, "unit": "K", "label": "Housing Starts (000s)"}

    # Consumer Sentiment
    val, date = _latest_value_and_date("UMCSENT")
    if val is not None:
        indicators["consumer_sentiment"] = {"value": val, "date": date, "unit": "", "label": "Consumer Sentiment"}

    # Determine the most recent date across all indicators
    dates = [v["date"] for v in indicators.values() if v.get("date")]
    as_of = max(dates) if dates else None

    logger.info("[FRED] Fetched %d indicators (as_of=%s)", len(indicators), as_of)

    return {
        "macro_environment": {
            **indicators,
            "as_of": as_of,
        }
    }


def fetch_treasury_rates() -> Dict:
    """
    Fetch current Treasury bond yields for common CRE loan terms (2, 3, 5, 7, 10 year).
    Returns rates keyed by term with value and date.
    """
    logger.info("[FRED] Fetching treasury bond rates...")
    rates = []
    as_of = None

    for term, series_id in TREASURY_SERIES.items():
        val, date = _latest_value_and_date(series_id)
        if val is not None:
            rates.append({
                "term": term,
                "rate": round(val, 2),
                "date": date,
            })
            if date and (as_of is None or date > as_of):
                as_of = date

    logger.info("[FRED] Fetched %d treasury rates (as_of=%s)", len(rates), as_of)
    return {
        "rates": rates,
        "as_of": as_of,
    }
