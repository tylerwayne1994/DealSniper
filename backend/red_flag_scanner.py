"""
Red Flag Scanner — Quick-screen a Crexi / LoopNet / broker listing URL
before the user uploads an OM.  Returns a letter grade + red flags.
"""

import os, json, re, logging, asyncio
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("red_flag_scanner")

router = APIRouter(prefix="/api/red-flag", tags=["Red Flag Scanner"])

# ── Anthropic client (injected from App.py at startup) ──
ANTHROPIC_CLIENT = None
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

# ── Fallback: use Sonnet for accuracy (Haiku gets cap rate math wrong) ──
FAST_MODEL = "claude-sonnet-4-5-20250929"

# ── Request / Response schemas ──

class ScanRequest(BaseModel):
    url: str
    notes: Optional[str] = None          # optional user context ("Broker says 95% occ")

class RedFlag(BaseModel):
    flag: str           # e.g. "Cap Rate Below Market"
    severity: str       # "critical" | "warning" | "info"
    detail: str

class ScanResult(BaseModel):
    grade: str                         # A+ → F
    grade_color: str                   # hex
    headline: str                      # 1-liner verdict
    listing_data: dict                 # extracted metrics
    red_flags: list[RedFlag]
    market_context: dict               # market comparables used
    recommendation: str                # full paragraph
    raw_url: str


# ── Grade → color mapping ──
GRADE_COLORS = {
    "A+": "#00c875", "A": "#00c875", "A-": "#00c875",
    "B+": "#579bfc", "B": "#579bfc", "B-": "#579bfc",
    "C+": "#fdab3d", "C": "#fdab3d", "C-": "#fdab3d",
    "D+": "#e2445c", "D": "#e2445c", "D-": "#e2445c",
    "F": "#7f1d1d",
}


# ── Fetch page content ──
# Strategy: Jina Reader API (free, renders JS, bypasses Cloudflare)
#   → Google Webcache fallback → direct httpx last resort

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _extract_page_content(html: str) -> str:
    """Extract structured data + text from raw HTML."""
    json_ld_blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE
    )
    meta_tags = re.findall(
        r'<meta[^>]*(?:property|name)=["\']([^"\']*)["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',
        html, re.IGNORECASE
    )
    text_only = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    text_only = re.sub(r'<style[^>]*>.*?</style>', ' ', text_only, flags=re.DOTALL | re.IGNORECASE)
    text_only = re.sub(r'<[^>]+>', ' ', text_only)
    text_only = re.sub(r'\s+', ' ', text_only).strip()
    MAX = 30000
    if len(text_only) > MAX:
        text_only = text_only[:MAX] + " ... [TRUNCATED]"
    parts = []
    if json_ld_blocks:
        parts.append("=== JSON-LD STRUCTURED DATA ===")
        for b in json_ld_blocks[:5]:
            parts.append(b.strip())
    if meta_tags:
        parts.append("\n=== META TAGS ===")
        for n, c in meta_tags[:30]:
            parts.append(f"{n}: {c}")
    parts.append("\n=== PAGE TEXT CONTENT ===")
    parts.append(text_only)
    return "\n".join(parts)


def _extract_hero_image(content: str) -> Optional[str]:
    """Try to extract the first/hero property photo URL from page content or Jina markdown."""
    # 1) OG image from meta tags
    og_match = re.search(r'og:image:\s*(https?://[^\s"\'<>]+)', content, re.IGNORECASE)
    if not og_match:
        og_match = re.search(r'og:image["\s:]+\s*(https?://[^\s"\'<>]+)', content, re.IGNORECASE)
    if og_match:
        url = og_match.group(1).strip()
        if _is_valid_image_url(url):
            return url

    # 2) Jina markdown image syntax: ![alt](url)
    md_images = re.findall(r'!\[[^\]]*\]\((https?://[^)]+)\)', content)
    for url in md_images[:10]:
        if _is_valid_image_url(url):
            return url

    # 3) Direct image URLs in content
    img_urls = re.findall(r'(https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"\'<>]*)?)', content, re.IGNORECASE)
    for url in img_urls[:10]:
        if _is_valid_image_url(url):
            return url

    return None


def _is_valid_image_url(url: str) -> bool:
    """Filter out icons, logos, tracking pixels, etc."""
    lower = url.lower()
    skip = ['logo', 'icon', 'favicon', 'pixel', 'tracking', 'avatar', 'badge',
            'sprite', 'arrow', '1x1', 'spacer', 'blank', 'placeholder']
    if any(s in lower for s in skip):
        return False
    if len(url) < 20 or len(url) > 1000:
        return False
    return True


async def _fetch_via_jina(url: str) -> str:
    """Use Jina Reader API — free, renders JS, bypasses Cloudflare. Returns markdown text."""
    jina_url = f"https://r.jina.ai/{url}"
    log.info(f"[RED FLAG] Fetching via Jina Reader: {jina_url}")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            resp = await client.get(jina_url, headers={
                "Accept": "text/plain",
                "X-Return-Format": "text",
            })
            if resp.status_code == 200 and len(resp.text) > 200:
                log.info(f"[RED FLAG] Jina Reader success: {len(resp.text)} chars")
                return resp.text
            log.warning(f"[RED FLAG] Jina returned HTTP {resp.status_code}, len={len(resp.text)}")
    except Exception as e:
        log.warning(f"[RED FLAG] Jina Reader failed: {e}")
    return None


async def _fetch_via_google_cache(url: str) -> str:
    """Try Google's webcache version of the page."""
    from urllib.parse import quote
    cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{quote(url, safe='')}"
    log.info(f"[RED FLAG] Trying Google cache")
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(15.0),
            headers=_HEADERS,
        ) as client:
            resp = await client.get(cache_url)
            if resp.status_code == 200 and len(resp.text) > 500:
                log.info(f"[RED FLAG] Google cache hit: {len(resp.text)} chars")
                return _extract_page_content(resp.text)
    except Exception as e:
        log.warning(f"[RED FLAG] Google cache failed: {e}")
    return None


async def _fetch_via_httpx(url: str) -> str:
    """Direct httpx fetch — works for non-Cloudflare sites."""
    log.info(f"[RED FLAG] Direct httpx fetch: {url}")
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(20.0),
            headers={
                **_HEADERS,
                "Accept-Encoding": "gzip, deflate, br",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
            },
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and len(resp.text) > 500:
                return _extract_page_content(resp.text)
            log.warning(f"[RED FLAG] httpx got HTTP {resp.status_code}")
    except Exception as e:
        log.warning(f"[RED FLAG] httpx failed: {e}")
    return None


async def _fetch_listing_page(url: str) -> str:
    """Fetch listing page content using multiple strategies."""

    # 1) Jina Reader API — best option, renders JS, bypasses Cloudflare, free
    result = await _fetch_via_jina(url)
    if result and len(result) > 200:
        return result

    # 2) Google webcache
    result = await _fetch_via_google_cache(url)
    if result and len(result) > 200:
        return result

    # 3) Direct fetch — works for simple sites
    result = await _fetch_via_httpx(url)
    if result and len(result) > 200:
        return result

    raise ValueError("All fetch strategies failed — site has strong bot protection")


# ── Analysis prompt ──

SYSTEM_PROMPT = """You are DealSniper Red Flag Scanner — an expert CRE (commercial real estate) 
multifamily acquisition analyst. The user pastes a listing URL and you analyze it for red flags 
BEFORE they waste time uploading an OM.

Your job: extract every metric visible on the listing page, compare against market norms, 
and give a brutal, honest letter grade (A+ to F) with specific red flags.

CRITICAL — CAP RATE & PRICING MATH (DO NOT GET THIS BACKWARDS):
- Cap Rate = NOI / Price. HIGHER cap rate = LOWER price relative to income = CHEAPER = BETTER for buyer.
- If broker cap (e.g. 7%) is ABOVE market cap (e.g. 5-6%), the property is priced BELOW market — that is a GOOD sign, not a red flag.
- If broker cap is BELOW market cap, the property is OVERPRICED — that IS a red flag.
- Price Per Unit: if listing shows $39K/unit and market is $90K-$120K/unit, the listing is BELOW market (cheap), NOT above.
- ALWAYS double-check: is the number ABOVE or BELOW the comparison? State the direction correctly.
- A low price per unit relative to market could be a positive (underpriced deal) OR a yellow flag (why so cheap — deferred maintenance? Bad area?). Analyze which.

ALWAYS return valid JSON with this exact structure:
{
  "grade": "C-",
  "headline": "Overpriced by ~30% — broker cap rate masks soft rents and rising expenses",
  "listing_data": {
    "address": "...",
    "city": "...",
    "state": "...",
    "county": "...",
    "units": 0,
    "asking_price": 0,
    "price_per_unit": 0,
    "broker_cap_rate": 0,
    "broker_noi": 0,
    "year_built": 0,
    "occupancy": 0,
    "property_type": "Multifamily",
    "gross_income": 0,
    "operating_expenses": 0,
    "square_footage": 0,
    "lot_size": "",
    "image_url": "https://... (first/hero property photo URL from the listing, or null if not found)",
    "other_notes": ""
  },
  "red_flags": [
    {
      "flag": "Cap Rate Below Market",
      "severity": "critical",
      "detail": "Broker shows 4.2% cap but market avg for this submarket is 5.5-6%. Price should be ~$X to hit market cap."
    }
  ],
  "market_context": {
    "estimated_market_cap_rate": "5.0-6.0%",
    "estimated_price_per_unit_market": "$90K-$120K",
    "estimated_expense_ratio": "40-50%",
    "market_rent_range": "$800-$1,100/unit",
    "market_vacancy": "5-7%",
    "market_trends": "..."
  },
  "recommendation": "Full paragraph with verdict and whether to upload or pass."
}

GRADING RUBRIC:
- A+ / A / A-: Strong deal, metrics align with or beat market. Few/no red flags. Worth deep-diving.
- B+ / B / B-: Decent deal with minor concerns. Worth uploading for full underwrite.
- C+ / C / C-: Mediocre. Multiple yellow flags. Proceed with caution.
- D+ / D / D-: Bad deal. Major red flags. Overpriced, distressed metrics, or misleading broker data.
- F: Walk away. Numbers don't work at any reasonable assumption.

RED FLAG CATEGORIES (flag every one that applies):
- Cap Rate vs Market: Flag ONLY if broker cap is BELOW market (meaning overpriced). If broker cap is above market, that's potentially a positive — note it but don't flag as red.
- Price Per Unit vs Market: Flag if ABOVE comps (overpriced). If below comps, investigate WHY (could be good deal OR hidden problems).
- Expense Ratio (below 35% = likely pro forma / understated, above 55% = management issues)
- NOI Integrity (does income - expenses actually equal stated NOI?)
- Vacancy (unrealistic occupancy assumptions)
- Age / Deferred Maintenance risk (pre-1970 = CapEx risk, unknown age = flag)
- Debt Service Coverage (will it cash flow at current rates?)
- Market Fundamentals (population decline, rent growth stagnation)
- "Pro Forma" / "Projected" income (not actual T12)
- Seller Motivation (why selling at this price?)
- Low Price Per Unit (if significantly below market, flag as INFO — could indicate deferred maintenance, bad location, or opportunity)

SEVERITY:
- "critical": Deal-killer. Numbers fundamentally don't work.
- "warning": Significant concern but could be addressed in underwriting.
- "info": Worth noting but not disqualifying.

ACCURACY CHECK — Before returning, verify:
1. Every numerical comparison states the correct direction (above/below)
2. Cap rate math: higher cap = cheaper for buyer
3. Price per unit: compare correctly — $39K vs $90K means $39K is BELOW, not above
4. Grade matches the overall analysis — don't give D+ to a deal that's actually priced below market

Use your deep knowledge of CRE markets across the US. Be SPECIFIC about market comparables.
Even if the page has limited data, use what's available + your market knowledge to grade it.
If you can't extract a field, use null or 0 and note it in red flags as "Limited Data Available".

IMPORTANT: Return ONLY the JSON object, no markdown, no code fences, no extra text."""


# ── Endpoint ──

@router.post("/scan", response_model=ScanResult)
async def red_flag_scan(req: ScanRequest):
    """
    Quick-screen a listing URL: fetch page, extract data, run AI red flag analysis.
    Returns grade + red flags in < 30 seconds.
    Also supports notes-only mode: if URL fetch fails but notes are provided, analyze notes.
    """
    has_url = req.url and req.url.startswith("http")
    has_notes = req.notes and len(req.notes.strip()) > 50

    if not has_url and not has_notes:
        raise HTTPException(status_code=400, detail="Please provide a valid URL starting with http:// or https://")

    if ANTHROPIC_CLIENT is None:
        raise HTTPException(status_code=503, detail="AI service not configured")

    # 1️⃣ Fetch listing page
    page_content = None
    fetch_error = None
    hero_image = None

    if has_url:
        try:
            page_content = await _fetch_listing_page(req.url)
            # Try to extract hero image from fetched content
            if page_content:
                hero_image = _extract_hero_image(page_content)
                if hero_image:
                    log.info(f"[RED FLAG] Found hero image: {hero_image[:80]}...")
        except Exception as e:
            log.warning(f"[RED FLAG] Fetch failed: {e}")
            fetch_error = str(e)

    # If URL fetch failed but user provided notes, use notes as content
    if not page_content and has_notes:
        log.info("[RED FLAG] URL fetch failed, using user-provided notes for analysis")
        page_content = f"USER-PROVIDED LISTING DETAILS:\n{req.notes}"
        fetch_error = None  # Clear error since we have notes to work with

    if not page_content:
        detail = fetch_error or "Could not fetch listing page"
        raise HTTPException(status_code=422, detail=f"{detail}. Try pasting the listing text in the notes field.")

    # 2️⃣ Build analysis prompt
    user_message = f"""Analyze this CRE listing page for red flags.

LISTING URL: {req.url}

--- PAGE CONTENT START ---
{page_content}
--- PAGE CONTENT END ---"""

    if req.notes:
        user_message += f"\n\nUSER NOTES: {req.notes}"

    # 3️⃣ Call Claude for analysis
    try:
        response = ANTHROPIC_CLIENT.messages.create(
            model=FAST_MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw_text = response.content[0].text.strip()
    except Exception as e:
        log.error(f"[RED FLAG] LLM error: {e}")
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    # 4️⃣ Parse JSON response
    try:
        # Strip markdown fences if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw_text)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        match = re.search(r'\{[\s\S]*\}', raw_text)
        if match:
            try:
                data = json.loads(match.group())
            except:
                log.error(f"[RED FLAG] JSON parse failed. Raw: {raw_text[:500]}")
                raise HTTPException(status_code=500, detail="Failed to parse AI analysis. Please try again.")
        else:
            log.error(f"[RED FLAG] No JSON in response. Raw: {raw_text[:500]}")
            raise HTTPException(status_code=500, detail="AI returned invalid analysis. Please try again.")

    # 5️⃣ Build structured result
    grade = data.get("grade", "C")
    listing_data = data.get("listing_data", {})
    red_flags_raw = data.get("red_flags", [])
    market_context = data.get("market_context", {})

    # Inject hero image: prefer AI-extracted, fallback to our regex extraction
    if not listing_data.get("image_url") and hero_image:
        listing_data["image_url"] = hero_image

    red_flags = []
    for rf in red_flags_raw:
        red_flags.append(RedFlag(
            flag=rf.get("flag", "Unknown"),
            severity=rf.get("severity", "info"),
            detail=rf.get("detail", ""),
        ))

    return ScanResult(
        grade=grade,
        grade_color=GRADE_COLORS.get(grade, "#676879"),
        headline=data.get("headline", "Analysis complete"),
        listing_data=listing_data,
        red_flags=red_flags,
        market_context=market_context,
        recommendation=data.get("recommendation", ""),
        raw_url=req.url,
    )
