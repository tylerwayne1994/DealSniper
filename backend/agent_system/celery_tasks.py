# ============================================================================
# Agent System — Celery Tasks
# Background tasks for running the browser agent and checking schedules.
# ============================================================================

import asyncio
import logging
import traceback
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Try to import the Celery app.  If celery isn't installed we expose plain
# functions so the synchronous fallback in the router still works.
# ---------------------------------------------------------------------------
try:
    from agent_system.celery_app import celery_app

    if celery_app is None:
        raise ImportError("celery_app is None")
    _HAS_CELERY = True
except ImportError:
    _HAS_CELERY = False
    celery_app = None

from agent_system.models import (
    get_agent_config,
    get_agent_config_by_user,
    update_agent_run,
    create_agent_run,
    create_notification,
)
from agent_system.encryption import decrypt_platform_list
from agent_system.deal_pipeline import execute_agent_run


# ---------------------------------------------------------------------------
# Helper — decorate only when Celery is available
# ---------------------------------------------------------------------------

def _task_decorator(fn):
    if _HAS_CELERY and celery_app is not None:
        return celery_app.task(bind=True, name=f"agent_system.celery_tasks.{fn.__name__}")(fn)
    return fn


# ---------------------------------------------------------------------------
# Task: run_agent_task
#   Triggered by the "Run Now" button or by beat schedule.
# ---------------------------------------------------------------------------

def _run_agent_task_impl(self_or_none, run_id: str, agent_id: str, user_id: str):
    """Execute a single agent run (called as Celery task OR synchronously)."""
    logger.info("[DEBUG] ===== AGENT TASK STARTING =====")
    logger.info("[DEBUG] run_id=%s agent_id=%s user_id=%s", run_id, agent_id, user_id)
    try:
        logger.info("[DEBUG] Loading agent config...")
        config = get_agent_config(agent_id, user_id)
        if not config:
            logger.error("[DEBUG] Agent config %s not found for user %s", agent_id, user_id)
            update_agent_run(run_id, {
                "status": "failed",
                "error": "Agent configuration not found",
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"status": "failed", "error": "config_not_found"}

        # Decrypt credentials
        platforms = config.get("platform_credentials", [])
        logger.info("[DEBUG] Found %d platform credentials, decrypting...", len(platforms))
        decrypted = decrypt_platform_list(platforms)
        logger.info("[DEBUG] Decrypted %d platforms: %s",
                     len(decrypted), [d.get('platform_id') for d in decrypted])

        buy_box = config.get("buy_box", {})
        logger.info("[DEBUG] Buy box: %s", {k: v for k, v in buy_box.items() if v} if isinstance(buy_box, dict) else buy_box)

        logger.info("[DEBUG] Starting execute_agent_run via asyncio.run()...")
        result = asyncio.run(execute_agent_run(
            run_id=run_id,
            agent_id=agent_id,
            user_id=user_id,
            platform_credentials=decrypted,
            buy_box=buy_box,
        ))
        logger.info("[DEBUG] ===== AGENT TASK COMPLETED =====")
        logger.info("[DEBUG] Result: %s", result)
        return result

    except Exception as exc:
        logger.error("[ERROR] ===== AGENT TASK FAILED =====")
        logger.error("[ERROR] Agent run %s failed: %s\n%s", run_id, exc, traceback.format_exc())
        update_agent_run(run_id, {
            "status": "failed",
            "error": str(exc)[:500],
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(exc)[:200]}


if _HAS_CELERY:
    @celery_app.task(bind=True, name="agent_system.celery_tasks.run_agent_task")
    def run_agent_task(self, run_id: str, agent_id: str, user_id: str):
        return _run_agent_task_impl(self, run_id, agent_id, user_id)
else:
    def run_agent_task(run_id: str, agent_id: str, user_id: str):
        return _run_agent_task_impl(None, run_id, agent_id, user_id)


# ---------------------------------------------------------------------------
# Task: check_scheduled_runs
#   Runs every hour via Celery Beat.  Checks which agents need to run
#   based on their schedule configuration.
# ---------------------------------------------------------------------------

def _check_scheduled_runs_impl(self_or_none):
    """Check all active agents and fire runs that are due."""
    from agent_system.models import get_supabase
    try:
        supabase = get_supabase()
        # Get all active agent configs
        resp = supabase.table("agent_configs").select("*").eq("status", "active").execute()
        configs = resp.data or []

        now = datetime.now(timezone.utc)
        current_hour = now.hour
        current_weekday = now.weekday()  # 0 = Monday

        triggered = 0
        for cfg in configs:
            schedule = cfg.get("schedule", {}) or {}
            runs_per_week = schedule.get("runs_per_week", 0)
            if runs_per_week <= 0:
                continue

            # Simple scheduling: spread runs_per_week across the week.
            # Run on evenly-spaced days, at 8 AM UTC.
            if current_hour != 8:
                continue

            days_between = max(1, 7 // runs_per_week)
            if current_weekday % days_between != 0:
                continue

            # Check if we already ran today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            existing = (
                supabase.table("agent_runs")
                .select("id")
                .eq("agent_id", cfg["id"])
                .gte("created_at", today_start)
                .execute()
            )
            if existing.data:
                continue

            # Create a run record and dispatch
            run = create_agent_run({
                "agent_id": cfg["id"],
                "user_id": cfg["user_id"],
                "status": "queued",
                "triggered_by": "schedule",
            })
            if not run:
                continue

            if _HAS_CELERY:
                run_agent_task.delay(run["id"], cfg["id"], cfg["user_id"])
            else:
                # Synchronous fallback (should not happen in beat)
                _run_agent_task_impl(None, run["id"], cfg["id"], cfg["user_id"])

            triggered += 1

        logger.info(f"Scheduled run check complete: {triggered} agents triggered")
        return {"triggered": triggered}

    except Exception as exc:
        logger.error(f"Scheduled run check failed: {exc}\n{traceback.format_exc()}")
        return {"error": str(exc)[:200]}


if _HAS_CELERY:
    @celery_app.task(bind=True, name="agent_system.celery_tasks.check_scheduled_runs")
    def check_scheduled_runs(self):
        return _check_scheduled_runs_impl(self)
else:
    def check_scheduled_runs():
        return _check_scheduled_runs_impl(None)


# ---------------------------------------------------------------------------
# Synchronous wrapper for when Celery is unavailable (e.g., Render free tier)
# ---------------------------------------------------------------------------

def dispatch_agent_run(run_id: str, agent_id: str, user_id: str) -> dict:
    """Dispatch an agent run — async via Celery if available, else sync."""
    logger.info("[DEBUG] dispatch_agent_run: run_id=%s agent_id=%s has_celery=%s", run_id, agent_id, _HAS_CELERY)
    if _HAS_CELERY:
        logger.info("[DEBUG] Dispatching via Celery (async)")
        task_result = run_agent_task.delay(run_id, agent_id, user_id)
        logger.info("[DEBUG] Celery task dispatched: task_id=%s", task_result.id)
        return {"dispatch": "async", "celery_task_id": task_result.id}
    else:
        logger.info("[DEBUG] Celery unavailable — running agent SYNCHRONOUSLY (this will block the request!)")
        result = _run_agent_task_impl(None, run_id, agent_id, user_id)
        logger.info("[DEBUG] Sync run completed: %s", result)
        return {"dispatch": "sync", "result": result}
