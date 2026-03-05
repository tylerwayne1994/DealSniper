# ============================================================================
# Agent System — Supabase-backed Models
# Uses Supabase (PostgreSQL) directly via supabase-py — matches project pattern.
# No SQLAlchemy ORM; Supabase is the project's DB layer everywhere else.
# ============================================================================

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

log = logging.getLogger("agent_system.models")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def get_supabase() -> Client:
    """Return authenticated Supabase client (service role)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ============================================================================
# Agent Config CRUD
# ============================================================================

def create_agent_config(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a new agent config row. Returns the created record."""
    log.info("[DEBUG] create_agent_config: user_id=%s", user_id)
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "user_id": user_id,
        "platform_credentials": json.dumps(data.get("platform_credentials", [])),
        "buy_box": json.dumps(data.get("buy_box", {})),
        "runs_per_week": data.get("runs_per_week", 1),
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    log.info("[DEBUG] Inserting into agent_configs...")
    result = sb.table("agent_configs").insert(row).execute()
    inserted = result.data[0] if result.data else row
    log.info("[DEBUG] agent_configs insert success: id=%s", inserted.get('id', '?'))
    return inserted


def get_agent_config(agent_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single agent config owned by user_id."""
    sb = get_supabase()
    result = (
        sb.table("agent_configs")
        .select("*")
        .eq("id", agent_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    # Parse JSON fields
    row["platform_credentials"] = _safe_json(row.get("platform_credentials"))
    row["buy_box"] = _safe_json(row.get("buy_box"))
    return row


def get_agent_config_by_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the agent config for a user (one agent per user for now)."""
    sb = get_supabase()
    result = (
        sb.table("agent_configs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    row["platform_credentials"] = _safe_json(row.get("platform_credentials"))
    row["buy_box"] = _safe_json(row.get("buy_box"))
    return row


def update_agent_config(agent_id: str, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update an existing agent config. Only the owning user can update."""
    sb = get_supabase()
    update_row: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if "platform_credentials" in data:
        update_row["platform_credentials"] = json.dumps(data["platform_credentials"])
    if "buy_box" in data:
        update_row["buy_box"] = json.dumps(data["buy_box"])
    if "runs_per_week" in data:
        update_row["runs_per_week"] = data["runs_per_week"]
    if "status" in data:
        update_row["status"] = data["status"]
    if "last_run_at" in data:
        update_row["last_run_at"] = data["last_run_at"]

    result = (
        sb.table("agent_configs")
        .update(update_row)
        .eq("id", agent_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    row["platform_credentials"] = _safe_json(row.get("platform_credentials"))
    row["buy_box"] = _safe_json(row.get("buy_box"))
    return row


def delete_agent_config(agent_id: str, user_id: str) -> bool:
    """Delete an agent config. Returns True if a row was removed."""
    sb = get_supabase()
    result = (
        sb.table("agent_configs")
        .delete()
        .eq("id", agent_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


# ============================================================================
# Agent Runs CRUD
# ============================================================================

def create_agent_run(agent_id: str, user_id: str) -> Dict[str, Any]:
    """Create a new run record (status=running)."""
    log.info("[DEBUG] create_agent_run: agent_id=%s user_id=%s", agent_id, user_id)
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "agent_config_id": agent_id,
        "user_id": user_id,
        "status": "running",
        "started_at": now,
        "deals_found": 0,
        "log": json.dumps([]),
    }
    log.info("[DEBUG] Inserting into agent_runs...")
    result = sb.table("agent_runs").insert(row).execute()
    inserted = result.data[0] if result.data else row
    log.info("[DEBUG] agent_runs insert success: run_id=%s status=%s", inserted.get('id', '?'), inserted.get('status'))
    return inserted


def update_agent_run(run_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update a run record (status, deals_found, finished_at, log, error)."""
    log.info("[DEBUG] update_agent_run: run_id=%s data_keys=%s", run_id, list(data.keys()))
    if 'status' in data:
        log.info("[DEBUG] Run %s → status=%s", run_id, data['status'])
    if 'error' in data:
        log.error("[DEBUG] Run %s error: %s", run_id, str(data['error'])[:200])
    sb = get_supabase()
    update_row: Dict[str, Any] = {}
    if "status" in data:
        update_row["status"] = data["status"]
    if "deals_found" in data:
        update_row["deals_found"] = data["deals_found"]
    if "finished_at" in data:
        update_row["finished_at"] = data["finished_at"]
    if "log" in data:
        update_row["log"] = json.dumps(data["log"]) if isinstance(data["log"], (list, dict)) else data["log"]
    if "error" in data:
        update_row["error"] = data["error"]

    result = sb.table("agent_runs").update(update_row).eq("id", run_id).execute()
    return result.data[0] if result.data else None


def get_agent_runs(agent_id: str, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch recent runs for an agent, newest first."""
    sb = get_supabase()
    result = (
        sb.table("agent_runs")
        .select("*")
        .eq("agent_config_id", agent_id)
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = result.data or []
    for r in rows:
        r["log"] = _safe_json(r.get("log"))
    return rows


# ============================================================================
# Agent Deals CRUD
# ============================================================================

def create_agent_deal(run_id: str, user_id: str, deal_data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert a deal found by an agent run."""
    log.info("[DEBUG] create_agent_deal: run_id=%s address=%s platform=%s",
             run_id, deal_data.get('address', '?'), deal_data.get('platform', '?'))
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "agent_run_id": run_id,
        "user_id": user_id,
        "platform": deal_data.get("platform", ""),
        "address": deal_data.get("address", ""),
        "price": deal_data.get("price"),
        "cap_rate": deal_data.get("cap_rate"),
        "property_type": deal_data.get("property_type", ""),
        "units": deal_data.get("units"),
        "sqft": deal_data.get("sqft"),
        "occupancy": deal_data.get("occupancy"),
        "listing_url": deal_data.get("listing_url", ""),
        "om_file_path": deal_data.get("om_file_path"),
        "raw_data": json.dumps(deal_data.get("raw_data", {})),
        "pipeline_deal_id": deal_data.get("pipeline_deal_id"),
        "created_at": now,
    }
    result = sb.table("agent_deals").insert(row).execute()
    inserted = result.data[0] if result.data else row
    log.info("[DEBUG] agent_deals insert success: deal_id=%s", inserted.get('id', '?'))
    return inserted


def get_agent_deals(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch agent deals for a user, newest first."""
    sb = get_supabase()
    result = (
        sb.table("agent_deals")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ============================================================================
# Agent Notifications
# ============================================================================

def create_notification(user_id: str, message: str, run_id: Optional[str] = None,
                        deal_id: Optional[str] = None) -> Dict[str, Any]:
    """Create a user notification."""
    log.info("[DEBUG] create_notification: user=%s msg=%s", user_id, message[:100])
    sb = get_supabase()
    row = {
        "user_id": user_id,
        "message": message,
        "agent_run_id": run_id,
        "agent_deal_id": deal_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = sb.table("agent_notifications").insert(row).execute()
    inserted = result.data[0] if result.data else row
    log.info("[DEBUG] Notification created: id=%s", inserted.get('id', '?'))
    return inserted


def get_notifications(user_id: str, unread_only: bool = False, limit: int = 30) -> List[Dict[str, Any]]:
    """Fetch notifications for a user."""
    sb = get_supabase()
    q = sb.table("agent_notifications").select("*").eq("user_id", user_id)
    if unread_only:
        q = q.eq("read", False)
    result = q.order("created_at", desc=True).limit(limit).execute()
    return result.data or []


def mark_notification_read(notification_id: str, user_id: str) -> bool:
    sb = get_supabase()
    result = (
        sb.table("agent_notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


# ============================================================================
# Helpers
# ============================================================================

def _safe_json(val):
    """Parse a JSON string if needed, else return as-is."""
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val
