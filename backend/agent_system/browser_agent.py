# ============================================================================
# Agent System — Browser-Use Agent Logic
# Uses the browser-use library with GPT-4o to automate platform searches.
# Each platform has a dedicated search strategy.
# ============================================================================

import os
import re
import glob
import logging
import asyncio
import shutil
import tempfile
import subprocess
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

log = logging.getLogger("agent_system.browser_agent")

# ── Set PLAYWRIGHT_BROWSERS_PATH at module load time ────────────────────────
# browser-use 0.12.1 uses Playwright's internal detection which reads this var.
# Must be set BEFORE any Playwright or browser-use imports pick it up.
_BROWSERS_DIR = os.path.join(os.path.dirname(__file__), "..", ".browsers")
_BROWSERS_DIR_ABS = os.path.abspath(_BROWSERS_DIR)
if "PLAYWRIGHT_BROWSERS_PATH" not in os.environ:
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = _BROWSERS_DIR_ABS
    log.info("[CHROMIUM] Module init: set PLAYWRIGHT_BROWSERS_PATH=%s", _BROWSERS_DIR_ABS)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "") or os.getenv("CLAUDE_API_KEY", "")

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
        # "om" = full offering memorandum, "flyer" = marketing flyer, "none" = no document
        self.doc_type: str = kwargs.get("doc_type", "none")
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
            "doc_type": self.doc_type,
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
        # Build a direct search URL so the agent skips the login page
        # (which triggers Cloudflare). Crexi search is public.
        search_url = "https://www.crexi.com/properties"
        return f"""
You are an automated real estate deal finder on Crexi.com. Follow these steps EXACTLY:

IMPORTANT: You are running in a headless browser in a container with limited
resources. Be efficient — do NOT take unnecessary actions. If a page shows
"Just a moment..." or a loading spinner, wait 5-10 seconds, then try refreshing
or navigating to the URL again.

=== STEP 1: GO DIRECTLY TO SEARCH (skip login for now) ===
1. Navigate to {search_url}
2. Wait for the page to fully load (you should see property listings or a search interface).
3. If the page shows "Just a moment..." or a Cloudflare challenge:
   - Wait 10 seconds
   - If still stuck, try navigating to https://www.crexi.com first, wait 5s,
     then navigate to {search_url}
   - If still no luck after 2 attempts, report the issue and stop.

=== STEP 2: SEARCH WITH FILTERS ===
4. In the search bar or location filter, enter: {location_str}
5. Apply these filters using Crexi's filter panel:
{filter_str}
6. Wait for results to load. You should see property cards/listings.

=== STEP 3: BROWSE AND EXTRACT DEAL DATA ===
7. Go through the search results. Process up to 15 listings.
8. For EACH listing:
   a. Click into the listing detail page.
   b. Extract ALL of these fields:
      - address (full street address, city, state, zip)
      - price (asking price — may say "Negotiable" or "Unpriced" or "Contact for Price")
      - cap_rate (if shown)
      - property_type (Multifamily, Self-Storage, Mobile Home Park, etc.)
      - units (number of units)
      - sqft (total square footage)
      - occupancy (occupancy rate percentage, if shown)
      - listing_url (the full URL of this listing page)

=== STEP 4: ATTEMPT LOGIN FOR DOCUMENT DOWNLOADS ===
9.  After extracting data from a few listings, try logging in to enable downloads:
    a. Navigate to https://www.crexi.com/login
    b. If you see the login form, enter:
       - Email: {credentials['username']}
       - Password: {credentials['password']}
       - Click "Log In"
    c. If login succeeds, go back to searching and download documents.
    d. If login page is stuck on "Just a moment..." or Cloudflare:
       - Skip login entirely. Continue extracting listing DATA without downloading OMs.
       - Set doc_type = "none" for all listings.
       - The listing data itself is still valuable.

=== STEP 5: DOWNLOAD DOCUMENTS (only if logged in) ===
    e. Look for a "Documents" tab/section or "Download" button on listings.
    f. DOWNLOAD PRIORITY:
       - If there is an "Offering Memorandum" (OM): Download it. Set doc_type = "om"
       - If there is NO OM but there IS a flyer/brochure: Download it. Set doc_type = "flyer"
       - If there are NO documents: Set doc_type = "none"
       - STILL extract data from "Unpriced" listings — they often have the best OMs.
    g. Go back to search results and continue.

=== STEP 6: RETURN RESULTS ===
10. After processing listings, return the results as a JSON array.
    Each item must have these exact fields:
    {{
      "address": "123 Main St, City, ST 12345",
      "price": 1500000,
      "cap_rate": 6.5,
      "property_type": "Multifamily",
      "units": 12,
      "sqft": 8500,
      "occupancy": 92.0,
      "listing_url": "https://www.crexi.com/properties/...",
      "doc_type": "om",
      "downloaded_filename": "Property_OM.pdf"
    }}

    IMPORTANT NOTES ON PRICE:
    - If the listing shows a price, use that number (e.g., 1500000)
    - If it says "Negotiable", "Unpriced", or "Contact for Price", set price to null
    - Do NOT skip unpriced listings — they often have the best OMs with real financial data

    Return ONLY the JSON array, no other text.
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
                    listing_url=d.get("listing_url", ""),                    doc_type=d.get("doc_type", "none"),                    raw_data=d,
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
# Find the Playwright-installed Chromium binary
# ============================================================================

# Persistent browser dir INSIDE the project so it survives Render build→runtime.
# Set via PLAYWRIGHT_BROWSERS_PATH env var in render.yaml.
# Reuse _BROWSERS_DIR computed at module top.
_PROJECT_BROWSERS_DIR = _BROWSERS_DIR
_CHROMIUM_PATH_FILE = os.path.join(os.path.dirname(__file__), "..", ".chromium_path")


def _find_chromium_binary() -> Optional[str]:
    """Locate the Playwright-installed Chromium binary."""
    home = os.path.expanduser("~")
    log.info("[CHROMIUM] Search — HOME=%s  cwd=%s  PLAYWRIGHT_BROWSERS_PATH=%s",
             home, os.getcwd(), os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "<unset>"))

    # ── 0. Build-time saved path ────────────────────────────────────────
    if os.path.isfile(_CHROMIUM_PATH_FILE):
        saved = open(_CHROMIUM_PATH_FILE).read().strip()
        if saved and os.path.isfile(saved):
            log.info("[CHROMIUM] ✅ Found via .chromium_path file: %s", saved)
            return saved
        log.info("[CHROMIUM] .chromium_path exists but invalid: '%s'", saved)

    # ── 1. CHROME_PATH env var ──────────────────────────────────────────
    for var in ("CHROME_PATH", "CHROMIUM_PATH"):
        p = os.environ.get(var, "")
        if p and os.path.isfile(p):
            log.info("[CHROMIUM] ✅ Found via $%s: %s", var, p)
            return p

    # ── 2. Walk candidate directories for 'chrome' binary ──────────────
    candidate_roots = []
    pw_env = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "")
    if pw_env:
        candidate_roots.append(pw_env)
    candidate_roots.extend([
        os.path.abspath(_PROJECT_BROWSERS_DIR),
        os.path.join(home, ".cache", "ms-playwright"),
        "/opt/render/project/src/backend/.browsers",
        "/opt/render/.cache/ms-playwright",
        "/home/render/.cache/ms-playwright",
        "/root/.cache/ms-playwright",
    ])
    # Dedupe while preserving order
    seen = set()
    unique_roots = []
    for r in candidate_roots:
        if r not in seen:
            seen.add(r)
            unique_roots.append(r)

    for root_dir in unique_roots:
        if not os.path.isdir(root_dir):
            log.info("[CHROMIUM]   skip %s (not a dir)", root_dir)
            continue
        log.info("[CHROMIUM]   walking %s  contents=%s",
                 root_dir, os.listdir(root_dir)[:15])
        try:
            for dirpath, dirnames, filenames in os.walk(root_dir):
                if "chrome" in filenames:
                    p = os.path.join(dirpath, "chrome")
                    if os.access(p, os.X_OK):
                        log.info("[CHROMIUM] ✅ Found via walk: %s", p)
                        return p
                if "headless_shell" in filenames:
                    p = os.path.join(dirpath, "headless_shell")
                    if os.access(p, os.X_OK):
                        log.info("[CHROMIUM] ✅ Found headless_shell: %s", p)
                        return p
        except Exception as e:
            log.warning("[CHROMIUM]   walk error %s: %s", root_dir, e)

    # ── 3. shutil.which ─────────────────────────────────────────────────
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        p = shutil.which(name)
        if p:
            log.info("[CHROMIUM] ✅ Found via which(%s): %s", name, p)
            return p

    log.warning("[CHROMIUM] ❌ Could not find Chromium binary anywhere!")
    return None


def _ensure_chromium() -> Optional[str]:
    """
    Find chromium binary.  If not found, install it at runtime into the
    project .browsers directory, then search again.
    """
    path = _find_chromium_binary()
    if path:
        return path

    # Runtime install fallback — use the project-local .browsers dir
    browsers_dir = os.path.abspath(_PROJECT_BROWSERS_DIR)
    os.makedirs(browsers_dir, exist_ok=True)
    log.warning("[CHROMIUM] Binary not found — installing at runtime to %s", browsers_dir)

    env = os.environ.copy()
    env["PLAYWRIGHT_BROWSERS_PATH"] = browsers_dir

    try:
        result = subprocess.run(
            ["python", "-m", "playwright", "install", "chromium"],
            capture_output=True, text=True, timeout=120, env=env,
        )
        log.info("[CHROMIUM] Runtime install stdout: %s", result.stdout[-500:] if result.stdout else "")
        log.info("[CHROMIUM] Runtime install stderr: %s", result.stderr[-500:] if result.stderr else "")
        if result.returncode != 0:
            log.error("[CHROMIUM] Runtime install failed (rc=%d)", result.returncode)
    except Exception as e:
        log.error("[CHROMIUM] Runtime install exception: %s", e)

    # Search again after install
    path = _find_chromium_binary()
    if path:
        log.info("[CHROMIUM] ✅ Found after runtime install: %s", path)
    else:
        log.error("[CHROMIUM] ❌ Still not found after runtime install!")
    return path


def _set_chromium_env(binary_path: Optional[str]):
    """Set env vars so browser-use's watchdog finds the binary.
    
    CRITICAL: browser-use 0.12.1 uses Playwright's internal browser detection
    which reads PLAYWRIGHT_BROWSERS_PATH. Without it, the watchdog cannot
    find the binary even if CHROME_PATH and PATH are set.
    """
    # Always set PLAYWRIGHT_BROWSERS_PATH to the project .browsers dir
    # so Playwright's internal registry can find installed browsers.
    browsers_abs = os.path.abspath(_PROJECT_BROWSERS_DIR)
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = browsers_abs
    log.info("[CHROMIUM] Set PLAYWRIGHT_BROWSERS_PATH=%s", browsers_abs)

    if not binary_path:
        return
    os.environ["CHROME_PATH"] = binary_path
    # Also put chrome's directory on PATH so shutil.which("chrome") works
    chrome_dir = os.path.dirname(binary_path)
    current_path = os.environ.get("PATH", "")
    if chrome_dir not in current_path:
        os.environ["PATH"] = chrome_dir + os.pathsep + current_path
    log.info("[CHROMIUM] Set CHROME_PATH=%s  Added %s to PATH", binary_path, chrome_dir)


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
        # browser-use 0.12.x has its own ChatAnthropic with custom ainvoke()
        # that handles output_format via tool calling and returns
        # ChatInvokeCompletion. Using langchain's ChatAnthropic does NOT work
        # because it doesn't understand output_format and returns AIMessage.
        from browser_use.llm.anthropic.chat import ChatAnthropic as BrowserUseChatAnthropic
        # browser-use 0.12.x uses BrowserSession instead of BrowserConfig
        try:
            from browser_use import BrowserSession
        except ImportError:
            BrowserSession = None
    except ImportError as e:
        log.error("browser-use or langchain-anthropic not installed: %s", e)
        raise RuntimeError(
            "browser-use library not installed. Run: pip install browser-use langchain-anthropic"
        ) from e

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

    # Build the task prompt
    task = _build_search_task(platform_id, credentials, buy_box)

    # Create download directory for OMs
    if not download_dir:
        download_dir = tempfile.mkdtemp(prefix="agent_om_")

    log.info("[DEBUG] Starting browser-use agent for platform=%s download_dir=%s", platform_id, download_dir)

    # Use browser-use's own ChatAnthropic — it handles output_format via
    # Anthropic tool calls and returns ChatInvokeCompletion with .completion attr.
    llm = BrowserUseChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=ANTHROPIC_API_KEY,
        temperature=0.0,
    )
    log.info("[DEBUG] BrowserUseChatAnthropic initialized (provider=%s, model=%s)",
             llm.provider, llm.model)

    # Configure browser with explicit Chromium path to avoid uvx dependency
    chromium_path = _ensure_chromium()
    log.info("[DEBUG] Chromium binary path: %s", chromium_path)
    # Set env vars so browser-use's internal watchdog also finds the binary
    _set_chromium_env(chromium_path)

    if not chromium_path:
        raise RuntimeError(
            "Chromium binary not found and runtime install failed. "
            "Check PLAYWRIGHT_BROWSERS_PATH and build logs."
        )

    if BrowserSession is not None:
        try:
            # Pass executable_path so the watchdog skips its slow binary search.
            # Disable default extensions (uBlock, cookie handler, ClearURLs,
            # Force Background Tab) — they add ~6s of download/extract time
            # and make Chrome initialization too heavy for Render's 15s CDP timeout.
            # browser-use's CHROME_DEFAULT_ARGS already includes:
            #   --disable-dev-shm-usage, --disable-background-networking,
            #   --disable-component-update, --no-first-run, --disable-sync,
            #   --disable-blink-features=AutomationControlled, etc.
            # We only add flags NOT in the defaults.
            browser_session = BrowserSession(
                headless=True,
                executable_path=chromium_path,
                chromium_sandbox=False,
                enable_default_extensions=False,
                disable_security=True,
                # Smaller viewport = lighter rendering & faster DOM extraction
                viewport={"width": 1280, "height": 720},
                # Crexi SPA fires endless background XHRs; don't wait forever
                wait_for_network_idle_page_load_time=5,
                minimum_wait_page_load_time=2,
                args=[
                    # Rendering: disable GPU since container has no GPU
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--disable-accelerated-2d-canvas",
                    # Memory: limit renderer processes & V8 heap for Render's
                    # constrained container (512MB-1GB total RAM)
                    "--renderer-process-limit=1",
                    "--js-flags=--max-old-space-size=256",
                    # Disable features that add overhead
                    "--disable-extensions",
                ],
            )
            log.info(
                "[DEBUG] BrowserSession created: headless=True, executable_path=%s, "
                "PLAYWRIGHT_BROWSERS_PATH=%s",
                chromium_path,
                os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "<unset>"),
            )
            agent = Agent(
                task=task,
                llm=llm,
                browser_session=browser_session,
                # Disable vision (screenshots) — Render's limited RAM/CPU
                # can't handle captureScreenshot reliably, causing cascading
                # DOMWatchdog → ScreenshotWatchdog timeouts. DOM-only mode
                # provides element IDs and text, which is sufficient for Crexi.
                use_vision=False,
                max_failures=10,
            )
        except Exception as bs_err:
            log.warning("[DEBUG] BrowserSession failed (%s), falling back to default Agent config", bs_err)
            agent = Agent(
                task=task,
                llm=llm,
                use_vision=False,
                max_failures=10,
            )
    else:
        log.warning("[DEBUG] BrowserSession not available, using default Agent config")
        agent = Agent(
            task=task,
            llm=llm,
            use_vision=False,
            max_failures=10,
        )

    log.info("[DEBUG] Agent created, calling agent.run()...")
    result = await agent.run()
    log.info("[DEBUG] Agent.run() returned, type=%s", type(result).__name__)

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

    # Match downloaded PDFs to deals by filename from agent output
    if os.path.isdir(download_dir):
        pdf_files = {p.name.lower(): p for p in Path(download_dir).glob("*.pdf")}
        if pdf_files and deals:
            for deal in deals:
                # Try to match by the filename the agent reported
                reported_name = (deal.raw_data.get("downloaded_filename") or "").lower()
                matched_path = None
                if reported_name and reported_name in pdf_files:
                    matched_path = pdf_files[reported_name]
                elif reported_name:
                    # Fuzzy match — check if reported name is a substring
                    for fname, fpath in pdf_files.items():
                        if reported_name in fname or fname in reported_name:
                            matched_path = fpath
                            break
                if matched_path:
                    deal.om_pdf_bytes = matched_path.read_bytes()
                    deal.om_filename = matched_path.name
                    log.info("Matched PDF %s to deal %s", matched_path.name, deal.address)

            # For any remaining unmatched deals, assign PDFs by order
            unmatched_deals = [d for d in deals if not d.om_pdf_bytes and d.doc_type != "none"]
            used_paths = {d.om_filename for d in deals if d.om_filename}
            unused_pdfs = [p for n, p in pdf_files.items() if p.name not in used_paths]
            for deal, pdf_path in zip(unmatched_deals, unused_pdfs):
                deal.om_pdf_bytes = pdf_path.read_bytes()
                deal.om_filename = pdf_path.name
                log.info("Fallback-matched PDF %s to deal %s", pdf_path.name, deal.address)

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
    successful_platform_searches = 0
    platform_errors: List[str] = []

    if not platform_credentials:
        raise RuntimeError("No enabled platforms configured. Enable at least one source in Agent Builder.")

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
            successful_platform_searches += 1
            # Filter by buy box
            filtered = [d for d in deals if passes_buy_box(d, buy_box)]
            all_deals.extend(filtered)
            run_log.append(f"{platform_id}: found {len(deals)} raw, {len(filtered)} matched buy box")
            log.info("Platform %s: %d deals found, %d matched", platform_id, len(deals), len(filtered))
        except Exception as e:
            log.error("Error searching %s: %s", platform_id, e)
            run_log.append(f"{platform_id}: ERROR — {str(e)}")
            platform_errors.append(f"{platform_id}: {str(e)}")

    if successful_platform_searches == 0:
        error_detail = "; ".join(platform_errors[:3]) if platform_errors else "No platform searches were executed."
        raise RuntimeError(f"All platform searches failed. {error_detail}")

    return all_deals
