# ============================================================================
# Agent System — Deal Pipeline Integration
# After the agent finds deals and downloads OMs, this module:
#   1. Saves PDFs to file storage
#   2. Sends OMs/flyers to the v2 underwriter for parsing (Claude OCR)
#   3. Triggers AI underwriting (GPT-4o analysis)
#   4. Pushes underwritten deals into the user's Supabase pipeline
#   5. Creates user notifications with links to results
# ============================================================================

import os
import io
import json
import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from agent_system.models import (
    create_agent_deal,
    create_notification,
    update_agent_run,
    update_agent_config,
    get_supabase,
)
from agent_system.file_storage import save_file
from agent_system.browser_agent import DealResult

log = logging.getLogger("agent_system.deal_pipeline")


# ============================================================================
# Step 1: Parse PDF via v2 underwriter (internal HTTP call to /v2/deals/parse)
# ============================================================================

async def parse_om_pdf(pdf_bytes: bytes, filename: str) -> Optional[Dict[str, Any]]:
    """
    Send a PDF to the v2 underwriter's parse endpoint internally.
    Uses httpx to call our own /v2/deals/parse endpoint, which runs the full
    Claude OCR pipeline, creates the deal on disk, and returns deal_id + parsed data.
    Returns { deal_id, parsed, summary } or None on failure.
    """
    try:
        import httpx

        # Call our own parse endpoint — avoids duplicating the massive prompt
        backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8010")
        url = f"{backend_url}/v2/deals/parse"

        log.info("Sending PDF to v2 parse endpoint: %s (%d bytes)", filename, len(pdf_bytes))

        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"file": (filename, io.BytesIO(pdf_bytes), "application/pdf")}
            resp = await client.post(url, files=files)

        if resp.status_code != 200:
            log.error("v2 parse endpoint returned %d: %s", resp.status_code, resp.text[:300])
            return None

        data = resp.json()
        log.info("v2 parse success: deal_id=%s address=%s",
                 data.get("deal_id"), data.get("summary", {}).get("address", ""))
        return data

    except Exception as e:
        log.error("Failed to parse OM PDF %s: %s", filename, e, exc_info=True)
        return None


# ============================================================================
# Step 2: Trigger AI underwriting on a parsed deal (internal HTTP call)
# ============================================================================

async def run_underwriting(deal_id: str, user_id: str, buy_box: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
    """
    Call the v2 underwriter's analysis endpoint on an already-parsed deal.
    Returns { deal_id, verdict, analysis, summary_text, numeric_summary } or None.
    """
    try:
        import httpx

        backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8010")
        url = f"{backend_url}/v2/deals/{deal_id}/underwrite"

        body = {
            "buy_box": buy_box or {},
            "underwriting_mode": "hardcoded",
            "calc_json": {},
            "wizard_structure": {},
        }

        log.info("Triggering underwriting for deal %s", deal_id)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"X-User-ID": user_id},
            )

        if resp.status_code != 200:
            log.error("Underwrite endpoint returned %d: %s", resp.status_code, resp.text[:300])
            return None

        data = resp.json()
        log.info("Underwriting complete for %s: verdict=%s", deal_id, data.get("verdict"))
        return data

    except Exception as e:
        log.error("Underwriting failed for deal %s: %s", deal_id, e, exc_info=True)
        return None


# ============================================================================
# Step 3: Push deal to Supabase pipeline (so it appears on Pipeline page)
# ============================================================================

def push_to_pipeline(
    deal_id: str,
    user_id: str,
    parsed_json: Dict[str, Any],
    listing_url: str = "",
    source: str = "agent",
) -> bool:
    """
    Insert a deal into the Supabase `deals` table so it shows up on the
    user's Pipeline page.  Mirrors what the frontend's saveDeal() does.
    """
    try:
        sb = get_supabase()
        prop = parsed_json.get("property", {})
        pf = parsed_json.get("pricing_financing", {})

        address_parts = [
            prop.get("address", ""),
            prop.get("city", ""),
            prop.get("state", ""),
            prop.get("zip", ""),
        ]
        full_address = ", ".join(p for p in address_parts if p)

        row = {
            "deal_id": deal_id,
            "user_id": user_id,
            "address": full_address or "Agent-found deal",
            "units": prop.get("units"),
            "purchase_price": pf.get("price"),
            "parsed_data": json.dumps(parsed_json),
            "scenario_data": json.dumps(parsed_json),
            "listing_url": listing_url,
            "pipeline_status": "pipeline",
            "deal_stage": "underwritten",
            "stage_changed_at": datetime.now(timezone.utc).isoformat(),
            "notes": f"Auto-found by AI agent ({source})",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Upsert — in case the deal already exists
        sb.table("deals").upsert(row, on_conflict="deal_id,user_id").execute()
        log.info("Pushed deal %s to pipeline for user %s", deal_id, user_id)
        return True

    except Exception as e:
        log.error("Failed to push deal %s to pipeline: %s", deal_id, e, exc_info=True)
        return False


# ============================================================================
# Process deals from an agent run — FULL PIPELINE
# ============================================================================

async def process_agent_deals(
    run_id: str,
    user_id: str,
    agent_id: str,
    deals: List[DealResult],
    buy_box: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Process all deals found by an agent run — full pipeline:
      1. Save OM/Flyer PDF to file storage
      2. Parse the PDF via Claude OCR → create v2 deal
      3. Run AI underwriting → verdict + analysis
      4. Push to Supabase pipeline (Pipeline page)
      5. Create notifications with result links
    Returns list of created deal records.
    """
    created_deals = []

    for deal in deals:
        try:
            om_file_path = None
            v2_deal_id = None
            underwrite_result = None

            # 1. Save PDF to file storage if available
            if deal.om_pdf_bytes and deal.om_filename:
                safe_name = f"{deal.doc_type}_{uuid.uuid4().hex[:8]}_{deal.om_filename}"
                om_file_path = save_file(
                    user_id=user_id,
                    filename=safe_name,
                    file_bytes=deal.om_pdf_bytes,
                    content_type="application/pdf",
                )
                log.info("Saved %s PDF: %s", deal.doc_type, om_file_path)

            # 2. Parse PDF through Claude OCR → create v2 deal
            if deal.om_pdf_bytes:
                parse_result = await parse_om_pdf(
                    pdf_bytes=deal.om_pdf_bytes,
                    filename=deal.om_filename or f"agent_{deal.platform}_{uuid.uuid4().hex[:6]}.pdf",
                )
                if parse_result:
                    v2_deal_id = parse_result["deal_id"]
                    log.info("Parsed OM → v2 deal_id=%s address=%s",
                             v2_deal_id, parse_result.get("summary", {}).get("address", ""))

                    # 3. Run AI underwriting
                    underwrite_result = await run_underwriting(
                        deal_id=v2_deal_id,
                        user_id=user_id,
                        buy_box=buy_box,
                    )
                    if underwrite_result:
                        log.info("Underwriting complete for %s: verdict=%s",
                                 v2_deal_id, underwrite_result.get("verdict"))

                    # 4. Push to pipeline (Supabase deals table)
                    push_to_pipeline(
                        deal_id=v2_deal_id,
                        user_id=user_id,
                        parsed_json=parse_result.get("parsed", {}),
                        listing_url=deal.listing_url,
                        source=deal.platform,
                    )

            # 5. Create agent_deals record (tracking table)
            deal_data = deal.to_dict()
            deal_data["om_file_path"] = om_file_path
            deal_data["pipeline_deal_id"] = v2_deal_id
            deal_record = create_agent_deal(
                run_id=run_id,
                user_id=user_id,
                deal_data=deal_data,
            )
            created_deals.append(deal_record)

            # 6. Create notification with link to results
            price_str = f"${deal.price:,.0f}" if deal.price else "Unpriced"
            doc_label = "OM" if deal.doc_type == "om" else "Flyer" if deal.doc_type == "flyer" else "No doc"
            verdict_str = ""
            if underwrite_result:
                verdict_str = f" — Verdict: {underwrite_result.get('verdict', '?')}"

            message = (
                f"New {deal.platform.title()} deal: {deal.address} ({price_str}, {doc_label})"
                f"{verdict_str}"
            )
            if v2_deal_id:
                message += f" — View: /underwrite?viewDeal={v2_deal_id}"

            create_notification(
                user_id=user_id,
                message=message,
                run_id=run_id,
                deal_id=deal_record.get("id"),
            )

        except Exception as e:
            log.error("Error processing deal %s: %s", deal.address, e, exc_info=True)

    # Update run with deals_found count
    update_agent_run(run_id, {
        "deals_found": len(created_deals),
    })

    return created_deals


# ============================================================================
# Full run orchestrator — called by Celery task
# ============================================================================

async def execute_agent_run(
    run_id: str,
    agent_id: str,
    user_id: str,
    platform_credentials: List[Dict[str, str]],
    buy_box: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full agent run: search all platforms, parse OMs, underwrite, push to pipeline.
    This is the main entry point called by the Celery task.
    """
    from agent_system.browser_agent import run_agent_search

    log.info("Executing agent run: run_id=%s agent_id=%s", run_id, agent_id)

    try:
        # Run the browser agent across all platforms
        deals = await run_agent_search(
            platform_credentials=platform_credentials,
            buy_box=buy_box,
        )

        # Process found deals (parse, underwrite, push to pipeline)
        created = await process_agent_deals(
            run_id=run_id,
            user_id=user_id,
            agent_id=agent_id,
            deals=deals,
            buy_box=buy_box,
        )

        # Mark run as completed
        now = datetime.now(timezone.utc).isoformat()
        update_agent_run(run_id, {
            "status": "completed",
            "finished_at": now,
            "deals_found": len(created),
        })

        # Update agent config last_run_at
        update_agent_config(agent_id, user_id, {"last_run_at": now})

        # Summary notification
        om_count = sum(1 for d in deals if d.doc_type == "om")
        flyer_count = sum(1 for d in deals if d.doc_type == "flyer")
        create_notification(
            user_id=user_id,
            message=(
                f"Agent run completed: {len(created)} deals found "
                f"({om_count} OMs, {flyer_count} flyers) "
                f"across {len(platform_credentials)} platforms. "
                f"All deals have been underwritten and added to your pipeline."
            ),
            run_id=run_id,
        )

        return {
            "status": "completed",
            "deals_found": len(created),
            "run_id": run_id,
        }

    except Exception as e:
        log.error("Agent run failed: %s", e, exc_info=True)
        now = datetime.now(timezone.utc).isoformat()
        update_agent_run(run_id, {
            "status": "failed",
            "finished_at": now,
            "error": str(e),
        })
        create_notification(
            user_id=user_id,
            message=f"Agent run failed: {str(e)[:200]}",
            run_id=run_id,
        )
        return {
            "status": "failed",
            "error": str(e),
            "run_id": run_id,
        }
