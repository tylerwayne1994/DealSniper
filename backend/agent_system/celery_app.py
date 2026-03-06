# ============================================================================
# Agent System — Celery App Configuration
# Celery + Redis for background agent jobs and scheduled runs.
# ============================================================================

import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

REDIS_URL = os.getenv("REDIS_URL", "")

# Only create the Celery app if celery is installed AND Redis is configured
try:
    if not REDIS_URL:
        raise ImportError("REDIS_URL not set — skipping Celery, will use sync fallback")

    from celery import Celery
    from celery.schedules import crontab

    celery_app = Celery(
        "agent_system",
        broker=REDIS_URL,
        backend=REDIS_URL,
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        # Celery Beat schedule — check for agents that need to run every hour
        beat_schedule={
            "check-agent-schedules": {
                "task": "agent_system.celery_tasks.check_scheduled_runs",
                "schedule": crontab(minute=0),  # Every hour on the hour
            },
        },
    )

    # Autodiscover tasks in agent_system.celery_tasks
    celery_app.autodiscover_tasks(["agent_system"])

except ImportError:
    # Celery not installed — provide a stub so the rest of the code can import
    celery_app = None
