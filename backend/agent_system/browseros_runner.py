# ============================================================================
# Agent System — BrowserOS Runner Adapter
# Optional integration layer for BrowserOS server. Falls back to native runner
# if BrowserOS is unavailable or misconfigured.
# ============================================================================

import os
import logging
from typing import List, Dict, Any

from agent_system.browser_agent import DealResult, run_agent_search

log = logging.getLogger("agent_system.browseros_runner")


async def run_browseros_search(
    platform_credentials: List[Dict[str, str]],
    buy_box: Dict[str, Any],
    builder: Dict[str, Any],
) -> List[DealResult]:
    """
    Run a BrowserOS-backed search when configured.

    Env vars:
    - BROWSEROS_SERVER_URL: base URL for BrowserOS API
    - BROWSEROS_SEARCH_PATH: endpoint path (default: /api/search)
    """
    browseros_url = os.getenv("BROWSEROS_SERVER_URL", "").strip()
    search_path = os.getenv("BROWSEROS_SEARCH_PATH", "/api/search").strip()

    if not browseros_url:
        log.warning("[BROWSEROS] BROWSEROS_SERVER_URL is not set. Falling back to native runner.")
        return await run_agent_search(platform_credentials, buy_box)

    try:
        import httpx

        payload = {
            "platform_credentials": platform_credentials,
            "buy_box": buy_box,
            "builder": builder,
        }

        url = f"{browseros_url.rstrip('/')}/{search_path.lstrip('/')}"
        log.info("[BROWSEROS] Dispatching search to %s", url)

        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            log.error("[BROWSEROS] Search failed (%s): %s", resp.status_code, resp.text[:500])
            return await run_agent_search(platform_credentials, buy_box)

        data = resp.json()
        rows = data.get("deals") if isinstance(data, dict) else data
        if not isinstance(rows, list):
            log.warning("[BROWSEROS] Unexpected payload shape, using native runner fallback.")
            return await run_agent_search(platform_credentials, buy_box)

        deals: List[DealResult] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            deals.append(
                DealResult(
                    platform=row.get("platform", "browseros"),
                    address=row.get("address", ""),
                    price=row.get("price"),
                    cap_rate=row.get("cap_rate"),
                    property_type=row.get("property_type", ""),
                    units=row.get("units"),
                    sqft=row.get("sqft"),
                    occupancy=row.get("occupancy"),
                    listing_url=row.get("listing_url", ""),
                    doc_type=row.get("doc_type", "none"),
                    raw_data=row.get("raw_data", row),
                )
            )

        log.info("[BROWSEROS] Received %d deals", len(deals))
        return deals

    except Exception as e:
        log.error("[BROWSEROS] Integration failed: %s", e, exc_info=True)
        return await run_agent_search(platform_credentials, buy_box)
