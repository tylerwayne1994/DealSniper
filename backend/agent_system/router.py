# ============================================================================
# Agent System — FastAPI Router
# All /api/agents/* endpoints.  Matches project patterns from email_deals.py
# and token_manager.py (X-User-ID header, APIRouter, etc.)
# ============================================================================

import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse

from agent_system.schemas import (
    AgentCreateRequest,
    AgentUpdateRequest,
    AgentConfigResponse,
    AgentRunResponse,
    AgentDealResponse,
    NotificationResponse,
)
from agent_system.models import (
    create_agent_config,
    get_agent_config,
    get_agent_config_by_user,
    update_agent_config,
    delete_agent_config,
    create_agent_run,
    get_agent_runs,
    get_agent_deals,
    get_notifications,
    mark_notification_read,
)
from agent_system.encryption import encrypt_platform_list, decrypt_platform_list

import os
log = logging.getLogger("agent_system.router")

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Auth helper (matches email_deals.py pattern)
# ---------------------------------------------------------------------------

def _get_user_id(request: Request) -> str:
    """Extract user ID from X-User-ID header or user_id cookie."""
    uid = request.headers.get("X-User-ID") or request.cookies.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user ID. Provide 'X-User-ID' header.")
    return uid


# ---------------------------------------------------------------------------
# Agent Config endpoints
# ---------------------------------------------------------------------------

@router.post("/config")
async def create_agent(request: Request, body: AgentCreateRequest):
    """Create or reset the user's agent configuration."""
    user_id = _get_user_id(request)
    log.info("[DEBUG] POST /config — user_id=%s platforms=%d runs_per_week=%s",
             user_id, len(body.platforms), body.runs_per_week)
    try:
        # Encrypt platform credentials before storing
        platform_ids = [p.platform_id for p in body.platforms]
        log.info("[DEBUG] Encrypting credentials for platforms: %s", platform_ids)
        encrypted_platforms = encrypt_platform_list([
            {"platform_id": p.platform_id, "username": p.username, "password": p.password}
            for p in body.platforms
        ])
        log.info("[DEBUG] Encryption successful, %d platforms encrypted", len(encrypted_platforms))

        buy_box = body.buy_box.dict() if body.buy_box else {}
        log.info("[DEBUG] Buy box: %s", {k: v for k, v in buy_box.items() if v})

        config = create_agent_config(user_id, {
            "platform_credentials": encrypted_platforms,
            "buy_box": buy_box,
            "runs_per_week": body.runs_per_week,
        })
        log.info("[DEBUG] Agent config created: id=%s status=%s", config.get('id'), config.get('status'))

        return _config_response(config)

    except Exception as e:
        log.error("[ERROR] Failed to create agent config: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e)[:200])


@router.get("/config")
async def get_agent(request: Request):
    """Get the current user's agent configuration (credentials redacted)."""
    user_id = _get_user_id(request)
    log.info("[DEBUG] GET /config — user_id=%s", user_id)
    config = get_agent_config_by_user(user_id)
    if not config:
        log.info("[DEBUG] No agent config found for user %s", user_id)
        return JSONResponse(status_code=200, content={"config": None})
    log.info("[DEBUG] Found agent config: id=%s status=%s last_run=%s",
             config.get('id'), config.get('status'), config.get('last_run_at'))
    return {"config": _config_response(config)}


@router.put("/config/{agent_id}")
async def update_agent(request: Request, agent_id: str, body: AgentUpdateRequest):
    """Update the user's agent configuration."""
    user_id = _get_user_id(request)
    log.info("[DEBUG] PUT /config/%s — user_id=%s", agent_id, user_id)

    update_data = {}
    if body.platforms is not None:
        log.info("[DEBUG] Updating platforms: %s", [p.platform_id for p in body.platforms])
        update_data["platform_credentials"] = encrypt_platform_list([
            {"platform_id": p.platform_id, "username": p.username, "password": p.password}
            for p in body.platforms
        ])
    if body.buy_box is not None:
        update_data["buy_box"] = body.buy_box.dict()
    if body.runs_per_week is not None:
        update_data["runs_per_week"] = body.runs_per_week
    if body.status is not None:
        update_data["status"] = body.status

    log.info("[DEBUG] Update data keys: %s", list(update_data.keys()))
    config = update_agent_config(agent_id, user_id, update_data)
    if not config:
        log.warning("[DEBUG] Agent config %s not found for user %s", agent_id, user_id)
        raise HTTPException(status_code=404, detail="Agent config not found")
    log.info("[DEBUG] Agent config updated successfully: id=%s", config.get('id'))

    return _config_response(config)


@router.delete("/config/{agent_id}")
async def delete_agent(request: Request, agent_id: str):
    """Delete the user's agent configuration."""
    user_id = _get_user_id(request)
    log.info("[DEBUG] DELETE /config/%s — user_id=%s", agent_id, user_id)
    ok = delete_agent_config(agent_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Agent config not found")
    log.info("[DEBUG] Agent config %s deleted", agent_id)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Run endpoints
# ---------------------------------------------------------------------------

@router.post("/config/{agent_id}/run")
async def trigger_run(request: Request, agent_id: str):
    """Trigger an immediate agent run (Run Now button)."""
    user_id = _get_user_id(request)
    log.info("[DEBUG] ===== RUN NOW TRIGGERED =====")
    log.info("[DEBUG] POST /config/%s/run — user_id=%s", agent_id, user_id)

    config = get_agent_config(agent_id, user_id)
    if not config:
        log.error("[DEBUG] Agent config %s not found for user %s", agent_id, user_id)
        raise HTTPException(status_code=404, detail="Agent config not found")

    platforms = config.get('platform_credentials', [])
    buy_box = config.get('buy_box', {})
    log.info("[DEBUG] Config loaded: %d platforms, buy_box keys=%s, status=%s",
             len(platforms), list(buy_box.keys()) if isinstance(buy_box, dict) else '?', config.get('status'))

    # Create run record
    run = create_agent_run(agent_id, user_id)
    log.info("[DEBUG] Agent run record created: run_id=%s", run.get('id'))

    # Dispatch — async via Celery if available, else synchronous
    from agent_system.celery_tasks import dispatch_agent_run
    log.info("[DEBUG] Dispatching agent run...")
    dispatch_result = dispatch_agent_run(
        run_id=run["id"],
        agent_id=agent_id,
        user_id=user_id,
    )
    log.info("[DEBUG] Dispatch result: %s", dispatch_result)

    return {
        "run_id": run["id"],
        "status": run["status"],
        "dispatch": dispatch_result.get("dispatch", "unknown"),
    }


@router.post("/config/{agent_id}/pause")
async def pause_agent(request: Request, agent_id: str):
    """Pause an active agent."""
    user_id = _get_user_id(request)
    config = update_agent_config(agent_id, user_id, {"status": "paused"})
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    return {"status": "paused"}


@router.post("/config/{agent_id}/resume")
async def resume_agent(request: Request, agent_id: str):
    """Resume a paused agent."""
    user_id = _get_user_id(request)
    config = update_agent_config(agent_id, user_id, {"status": "active"})
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    return {"status": "active"}


@router.get("/runs")
async def list_runs(request: Request, agent_id: Optional[str] = Query(None)):
    """List recent agent runs for the user."""
    user_id = _get_user_id(request)
    if not agent_id:
        # Grab from user's config
        config = get_agent_config_by_user(user_id)
        if not config:
            return {"runs": []}
        agent_id = config["id"]

    runs = get_agent_runs(agent_id, user_id)
    return {"runs": [_run_response(r) for r in runs]}


@router.get("/deals")
async def list_deals(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List deals found by the agent."""
    user_id = _get_user_id(request)
    deals = get_agent_deals(user_id, limit=limit)
    return {"deals": [_deal_response(d) for d in deals]}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@router.get("/notifications")
async def list_notifications(request: Request, unread_only: bool = Query(False)):
    """List agent notifications for the user."""
    user_id = _get_user_id(request)
    notes = get_notifications(user_id, unread_only=unread_only)
    return {"notifications": [_notification_response(n) for n in notes]}


@router.post("/notifications/{notification_id}/read")
async def read_notification(request: Request, notification_id: str):
    """Mark a notification as read."""
    user_id = _get_user_id(request)
    ok = mark_notification_read(notification_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": True}


# ---------------------------------------------------------------------------
# Health check for the agent subsystem
# ---------------------------------------------------------------------------

@router.get("/health")
async def agent_health():
    """Quick health check for the agent subsystem."""
    log.info("[DEBUG] GET /health — checking agent subsystem")

    # Check Celery
    try:
        from agent_system.celery_app import celery_app
        celery_ok = celery_app is not None
    except Exception as e:
        celery_ok = False
        log.info("[DEBUG] Celery not available: %s", e)

    # Check database
    try:
        from agent_system.models import get_supabase
        sb = get_supabase()
        db_ok = sb is not None
    except Exception as e:
        db_ok = False
        log.error("[DEBUG] Database connection failed: %s", e)

    # Check encryption key
    encryption_ok = bool(os.getenv("AGENT_ENCRYPTION_KEY"))

    # Check browser-use
    try:
        import browser_use
        browser_ok = True
    except ImportError:
        browser_ok = False

    # Check playwright
    try:
        import playwright
        playwright_ok = True
    except ImportError:
        playwright_ok = False

    result = {
        "agent_system": "ok",
        "celery": celery_ok,
        "database": db_ok,
        "encryption_key_set": encryption_ok,
        "browser_use_installed": browser_ok,
        "playwright_installed": playwright_ok,
        "openai_key_set": bool(os.getenv("OPENAI_API_KEY")),
    }
    log.info("[DEBUG] Health check result: %s", result)
    return result


# ---------------------------------------------------------------------------
# Response builders (strip secrets, shape for frontend)
# ---------------------------------------------------------------------------

def _config_response(config: dict) -> dict:
    """Build a safe response from a raw agent_configs row."""
    platforms = config.get("platform_credentials", [])
    # Strip credentials — only return platform IDs + connection status
    safe_platforms = []
    for p in platforms:
        if isinstance(p, dict):
            safe_platforms.append({
                "platform_id": p.get("platform_id", ""),
                "connected": bool(p.get("encrypted_credentials") or p.get("username")),
            })
        elif isinstance(p, str):
            safe_platforms.append({"platform_id": p, "connected": False})

    buy_box = config.get("buy_box", {})
    if isinstance(buy_box, str):
        import json
        try:
            buy_box = json.loads(buy_box)
        except Exception:
            buy_box = {}

    return {
        "id": config.get("id", ""),
        "user_id": config.get("user_id", ""),
        "platforms": safe_platforms,
        "buy_box": buy_box,
        "runs_per_week": config.get("runs_per_week", 1),
        "status": config.get("status", "active"),
        "last_run_at": config.get("last_run_at"),
        "created_at": config.get("created_at"),
        "updated_at": config.get("updated_at"),
    }


def _run_response(run: dict) -> dict:
    return {
        "id": run.get("id", ""),
        "agent_config_id": run.get("agent_config_id", ""),
        "status": run.get("status", ""),
        "started_at": run.get("started_at"),
        "finished_at": run.get("finished_at"),
        "deals_found": run.get("deals_found", 0),
        "error": run.get("error"),
        "log": run.get("log"),
    }


def _deal_response(deal: dict) -> dict:
    return {
        "id": deal.get("id", ""),
        "agent_run_id": deal.get("agent_run_id"),
        "platform": deal.get("platform", ""),
        "address": deal.get("address", ""),
        "price": deal.get("price"),
        "cap_rate": deal.get("cap_rate"),
        "property_type": deal.get("property_type", ""),
        "units": deal.get("units"),
        "sqft": deal.get("sqft"),
        "occupancy": deal.get("occupancy"),
        "listing_url": deal.get("listing_url", ""),
        "om_file_path": deal.get("om_file_path"),
        "pipeline_deal_id": deal.get("pipeline_deal_id"),
        "created_at": deal.get("created_at"),
    }


def _notification_response(note: dict) -> dict:
    return {
        "id": note.get("id", ""),
        "message": note.get("message", ""),
        "read": note.get("read", False),
        "agent_run_id": note.get("agent_run_id"),
        "agent_deal_id": note.get("agent_deal_id"),
        "created_at": note.get("created_at"),
    }
