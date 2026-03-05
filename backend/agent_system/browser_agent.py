# ============================================================================
# Agent System — Browser-Use Agent Logic
# Uses the browser-use library with GPT-4o to automate platform searches.
# Each platform has a dedicated search strategy.
# ============================================================================

import os
import re
import logging
import asyncio
import tempfile
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

log = logging.getLogger("agent_system.browser_agent")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ============================================================================
# Deal result structure returned by each platform search
# ============================================================================

class DealResult:
    """Lightweight container for a single deal found by the agent."""
    def __init__(self, **kwargs):
        self.platform: str = kwargs.get("platform", "")
        self.address: str = kwargs.get("address", "")
        self.price: Optional[float] = kwargs.get("price")
        self.cap_rate: Optional[float] = kwargs.get("cap_rate")
        self.property_type: str = kwargs.get("property_type", "")
        self.units: Optional[int] = kwargs.get("units")
        self.sqft: Optional[int] = kwargs.get("sqft")
        self.occupancy: Optional[float] = kwargs.get("occupancy")
        self.listing_url: str = kwargs.get("listing_url", "")
        self.om_pdf_bytes: Optional[bytes] = kwargs.get("om_pdf_bytes")
        self.om_filename: Optional[str] = kwargs.get("om_filename")
        self.raw_data: Dict[str, Any] = kwargs.get("raw_data", {})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "platform": self.platform,
            "address": self.address,
            "price": self.price,
            "cap_rate": self.cap_rate,
            "property_type": self.property_type,
            "units": self.units,
            "sqft": self.sqft,
            "occupancy": self.occupancy,
            "listing_url": self.listing_url,
            "om_filename": self.om_filename,
            "raw_data": self.raw_data,
        }


# ============================================================================
# Buy box filter helper
# ============================================================================

def passes_buy_box(deal: DealResult, buy_box: Dict[str, Any]) -> bool:
    """Check if a deal matches the user's buy box criteria."""
    if buy_box.get("min_price") and deal.price and deal.price < buy_box["min_price"]:
        return False
    if buy_box.get("max_price") and deal.price and deal.price > buy_box["max_price"]:
        return False
    if buy_box.get("min_cap_rate") and deal.cap_rate and deal.cap_rate < buy_box["min_cap_rate"]:
        return False
    if buy_box.get("max_cap_rate") and deal.cap_rate and deal.cap_rate > buy_box["max_cap_rate"]:
        return False
    if buy_box.get("min_units") and deal.units and deal.units < buy_box["min_units"]:
        return False
    if buy_box.get("max_units") and deal.units and deal.units > buy_box["max_units"]:
        return False
    if buy_box.get("min_sqft") and deal.sqft and deal.sqft < buy_box["min_sqft"]:
        return False
    if buy_box.get("max_sqft") and deal.sqft and deal.sqft > buy_box["max_sqft"]:
        return False
    if buy_box.get("min_occupancy") and deal.occupancy and deal.occupancy < buy_box["min_occupancy"]:
        return False
    if buy_box.get("max_occupancy") and deal.occupancy and deal.occupancy > buy_box["max_occupancy"]:
        return False
    if buy_box.get("min_year_built") and deal.raw_data.get("year_built"):
        if deal.raw_data["year_built"] < buy_box["min_year_built"]:
            return False
    if buy_box.get("max_year_built") and deal.raw_data.get("year_built"):
        if deal.raw_data["year_built"] > buy_box["max_year_built"]:
            return False
    # Property type filter
    if buy_box.get("property_types"):
        if deal.property_type and deal.property_type not in buy_box["property_types"]:
            return False
    return True


# ============================================================================
# Build search prompt for the browser-use agent
# ============================================================================

def _build_search_task(platform_id: str, credentials: Dict[str, str],
                       buy_box: Dict[str, Any]) -> str:
    """
    Build a natural language task description for the browser-use agent.
    The agent will execute this as a step-by-step browser automation task.
    """
    # Build location string
    locations = []
    if buy_box.get("states"):
        locations.append(f"States: {', '.join(buy_box['states'])}")
    if buy_box.get("cities"):
        cities = buy_box["cities"] if isinstance(buy_box["cities"], list) else [buy_box["cities"]]
        locations.append(f"Cities: {', '.join(cities)}")
    if buy_box.get("zip_codes"):
        zips = buy_box["zip_codes"] if isinstance(buy_box["zip_codes"], list) else [buy_box["zip_codes"]]
        locations.append(f"Zip codes: {', '.join(zips)}")
    location_str = "; ".join(locations) if locations else "Nationwide"

    # Build filters
    filters = []
    if buy_box.get("property_types"):
        filters.append(f"Property types: {', '.join(buy_box['property_types'])}")
    if buy_box.get("min_price"):
        filters.append(f"Min price: ${buy_box['min_price']:,.0f}")
    if buy_box.get("max_price"):
        filters.append(f"Max price: ${buy_box['max_price']:,.0f}")
    if buy_box.get("min_cap_rate"):
        filters.append(f"Min cap rate: {buy_box['min_cap_rate']}%")
    if buy_box.get("max_cap_rate"):
        filters.append(f"Max cap rate: {buy_box['max_cap_rate']}%")
    if buy_box.get("min_units"):
        filters.append(f"Min units: {buy_box['min_units']}")
    if buy_box.get("max_units"):
        filters.append(f"Max units: {buy_box['max_units']}")
    if buy_box.get("min_occupancy"):
        filters.append(f"Min occupancy: {buy_box['min_occupancy']}%")
    filter_str = "\n".join(f"  - {f}" for f in filters) if filters else "  - No specific filters"

    # Platform-specific instructions
    if platform_id == "crexi":
        return f"""
You are an automated real estate deal finder. Perform the following steps:

1. Go to https://www.crexi.com/login
2. Log in with email: {credentials['username']} and password: {credentials['password']}
3. After login, navigate to the search/listings page
4. Apply these search filters:
   Location: {location_str}
{filter_str}
5. Browse through the search results (up to 20 listings)
6. For EACH listing that appears:
   a. Click into the listing detail page
   b. Extract: address, asking price, cap rate, property type, number of units, square footage, occupancy rate
   c. Check if there is an Offering Memorandum (OM) PDF available for download
   d. If an OM PDF is available, download it
   e. Copy the listing URL
   f. Go back to search results and continue to the next listing
7. Return all found deals as a JSON array with these fields for each:
   address, price, cap_rate, property_type, units, sqft, occupancy, listing_url, has_om
"""
    elif platform_id == "zillow":
        return f"""
You are an automated real estate deal finder. Perform the following steps:

1. Go to https://www.zillow.com
2. In the search bar, search for commercial/multifamily properties in: {location_str}
3. Apply available filters:
{filter_str}
4. Browse through the search results (up to 20 listings)
5. For EACH listing:
   a. Click into the listing detail page
   b. Extract: address, listing price, property type, number of units/bedrooms, square footage
   c. Copy the listing URL
   d. Go back to results and continue
6. Return all found deals as a JSON array with fields:
   address, price, property_type, units, sqft, listing_url
"""
    elif platform_id == "propstream":
        return f"""
You are an automated real estate deal finder. Perform the following steps:

1. Go to https://app.propstream.com or https://www.propstream.com and log in
2. Log in with email: {credentials['username']} and password: {credentials['password']}
3. Navigate to the property search
4. Search in location: {location_str}
5. Apply filters:
{filter_str}
6. Browse through the search results (up to 20 listings)
7. For EACH listing:
   a. Click into the property detail page
   b. Extract: address, estimated value, property type, units, square footage, owner info if available
   c. Copy any available documents or listing URLs
   d. Go back and continue
8. Return all found deals as a JSON array with fields:
   address, price, property_type, units, sqft, listing_url
"""
    else:
        return f"Search for real estate deals on platform '{platform_id}' with location {location_str} and filters:\n{filter_str}"


# ============================================================================
# Parse structured deals from agent output
# ============================================================================

def _parse_agent_output(raw_output: str, platform_id: str) -> List[DealResult]:
    """
    Parse the browser agent's text output into structured DealResult objects.
    The agent returns JSON-like text — we extract and parse it.
    """
    import json
    deals = []

    # Try to find a JSON array in the output
    json_match = re.search(r'\[[\s\S]*?\]', raw_output)
    if json_match:
        try:
            raw_deals = json.loads(json_match.group())
            for d in raw_deals:
                deals.append(DealResult(
                    platform=platform_id,
                    address=d.get("address", ""),
                    price=_parse_number(d.get("price")),
                    cap_rate=_parse_number(d.get("cap_rate")),
                    property_type=d.get("property_type", ""),
                    units=_parse_int(d.get("units")),
                    sqft=_parse_int(d.get("sqft")),
                    occupancy=_parse_number(d.get("occupancy")),
                    listing_url=d.get("listing_url", ""),
                    raw_data=d,
                ))
        except json.JSONDecodeError:
            log.warning("Failed to parse JSON from agent output")

    if not deals:
        log.info("No structured deals parsed from agent output (len=%d)", len(raw_output))

    return deals


def _parse_number(val) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        cleaned = re.sub(r'[^\d.]', '', str(val))
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _parse_int(val) -> Optional[int]:
    n = _parse_number(val)
    return int(n) if n is not None else None


# ============================================================================
# Main agent runner — executes browser-use for one platform
# ============================================================================

async def run_platform_search(
    platform_id: str,
    credentials: Dict[str, str],
    buy_box: Dict[str, Any],
    download_dir: Optional[str] = None,
) -> List[DealResult]:
    """
    Run the browser-use agent for a single platform.
    Returns a list of DealResult objects.
    """
    try:
        from browser_use import Agent
        from langchain_openai import ChatOpenAI
    except ImportError as e:
        log.error("browser-use or langchain-openai not installed: %s", e)
        raise RuntimeError(
            "browser-use library not installed. Run: pip install browser-use langchain-openai"
        ) from e

    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    # Build the task prompt
    task = _build_search_task(platform_id, credentials, buy_box)

    # Create download directory for OMs
    if not download_dir:
        download_dir = tempfile.mkdtemp(prefix="agent_om_")

    log.info("Starting browser-use agent for platform=%s", platform_id)

    # Initialize the LLM
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key=OPENAI_API_KEY,
        temperature=0.0,
    )

    # Create and run the browser-use agent
    agent = Agent(
        task=task,
        llm=llm,
    )

    result = await agent.run()

    # Extract the final output text
    output_text = ""
    if hasattr(result, "final_result"):
        output_text = str(result.final_result())
    elif hasattr(result, "history"):
        # Get the last message from history
        for item in reversed(result.history):
            if hasattr(item, "result") and item.result:
                output_text = str(item.result)
                break
    if not output_text:
        output_text = str(result)

    log.info("Agent completed for platform=%s, output length=%d", platform_id, len(output_text))

    # Parse results
    deals = _parse_agent_output(output_text, platform_id)

    # Check download directory for any PDFs the agent downloaded
    if os.path.isdir(download_dir):
        pdf_files = list(Path(download_dir).glob("*.pdf"))
        if pdf_files and deals:
            # Attach first PDF to first deal (basic heuristic)
            for i, pdf_path in enumerate(pdf_files):
                if i < len(deals):
                    deals[i].om_pdf_bytes = pdf_path.read_bytes()
                    deals[i].om_filename = pdf_path.name

    return deals


# ============================================================================
# Run all platforms for an agent config
# ============================================================================

async def run_agent_search(
    platform_credentials: List[Dict[str, str]],
    buy_box: Dict[str, Any],
) -> List[DealResult]:
    """
    Run browser-use agent across all configured platforms sequentially.
    Returns combined list of deals found.
    """
    all_deals: List[DealResult] = []
    run_log: List[str] = []

    for cred in platform_credentials:
        platform_id = cred.get("platform_id", "unknown")
        log.info("Searching platform: %s", platform_id)
        run_log.append(f"Starting search on {platform_id}")

        try:
            deals = await run_platform_search(
                platform_id=platform_id,
                credentials=cred,
                buy_box=buy_box,
            )
            # Filter by buy box
            filtered = [d for d in deals if passes_buy_box(d, buy_box)]
            all_deals.extend(filtered)
            run_log.append(f"{platform_id}: found {len(deals)} raw, {len(filtered)} matched buy box")
            log.info("Platform %s: %d deals found, %d matched", platform_id, len(deals), len(filtered))
        except Exception as e:
            log.error("Error searching %s: %s", platform_id, e)
            run_log.append(f"{platform_id}: ERROR — {str(e)}")

    return all_deals
