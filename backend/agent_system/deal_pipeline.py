# ============================================================================
# Agent System — Deal Pipeline Integration
# After the agent finds deals and downloads OMs, this module:
#   1. Saves PDFs to file storage
#   2. Creates deal records in the database
#   3. Triggers the underwriting pipeline (hook interface)
#   4. Creates user notifications
# ============================================================================

import os
import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from agent_system.models import (
    create_agent_deal,
    create_notification,
    update_agent_run,
    update_agent_config,
)
from agent_system.file_storage import save_file
from agent_system.browser_agent import DealResult

log = logging.getLogger("agent_system.deal_pipeline")


# ============================================================================
# Underwriting hook — clean interface for wiring into existing pipeline
# ============================================================================

def trigger_underwriting(deal_id: str, user_id: str, om_file_path: Optional[str] = None,
                         deal_data: Optional[Dict[str, Any]] = None):
    """
    Hook to trigger the existing underwriting pipeline.
    Currently logs the trigger — wire your underwriting function here.

    Expected signature of your underwrite function:
        async def underwrite_deal(deal_id: str, user_id: str, file_path: str) -> dict
    """
    log.info(
        "UNDERWRITE HOOK: deal_id=%s user_id=%s om_path=%s",
        deal_id, user_id, om_file_path,
    )
    # TODO: Wire to your existing underwriting pipeline, e.g.:
    # from v2_underwriter.routes import auto_underwrite
    # auto_underwrite(deal_id=deal_id, user_id=user_id, file_path=om_file_path)
    return {"status": "queued", "deal_id": deal_id}


# ============================================================================
# Process deals from an agent run
# ============================================================================

def process_agent_deals(
    run_id: str,
    user_id: str,
    agent_id: str,
    deals: List[DealResult],
) -> List[Dict[str, Any]]:
    """
    Process all deals found by an agent run:
      - Save OM PDFs to file storage
      - Insert deal records
      - Trigger underwriting
      - Create notifications
    Returns list of created deal records.
    """
    created_deals = []

    for deal in deals:
        try:
            om_file_path = None

            # 1. Save OM PDF to file storage if available
            if deal.om_pdf_bytes and deal.om_filename:
                safe_name = f"om_{uuid.uuid4().hex[:8]}_{deal.om_filename}"
                om_file_path = save_file(
                    user_id=user_id,
                    filename=safe_name,
                    file_bytes=deal.om_pdf_bytes,
                    content_type="application/pdf",
                )
                log.info("Saved OM PDF: %s", om_file_path)

            # 2. Create deal record in agent_deals table
            deal_data = deal.to_dict()
            deal_data["om_file_path"] = om_file_path
            deal_record = create_agent_deal(
                run_id=run_id,
                user_id=user_id,
                deal_data=deal_data,
            )
            created_deals.append(deal_record)

            # 3. Trigger underwriting pipeline if we have an OM
            if om_file_path:
                trigger_underwriting(
                    deal_id=deal_record.get("id", ""),
                    user_id=user_id,
                    om_file_path=om_file_path,
                    deal_data=deal_data,
                )

            # 4. Create notification
            price_str = f"${deal.price:,.0f}" if deal.price else "price N/A"
            create_notification(
                user_id=user_id,
                message=f"New deal found on {deal.platform}: {deal.address} ({price_str})",
                run_id=run_id,
                deal_id=deal_record.get("id"),
            )

        except Exception as e:
            log.error("Error processing deal %s: %s", deal.address, e)

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
    Full agent run: search all platforms, process deals, update records.
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

        # Process found deals (save files, create records, trigger pipeline)
        created = process_agent_deals(
            run_id=run_id,
            user_id=user_id,
            agent_id=agent_id,
            deals=deals,
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
        create_notification(
            user_id=user_id,
            message=f"Agent run completed: {len(created)} deals found across {len(platform_credentials)} platforms",
            run_id=run_id,
        )

        return {
            "status": "completed",
            "deals_found": len(created),
            "run_id": run_id,
        }

    except Exception as e:
        log.error("Agent run failed: %s", e)
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
