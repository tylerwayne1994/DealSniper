"""Email → Auto-underwrite pipeline helpers.

This module creates rows in the email_underwrite_jobs table from incoming
email metadata so a background worker can parse docs and trigger underwriting.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from email_deals import get_supabase  # reuse existing Supabase helper

log = logging.getLogger("email_underwrite")

router = APIRouter(prefix="/api/email-underwrite", tags=["Email Underwrite"])


class AttachmentIn(BaseModel):
    filename: str
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None  # e.g. path in Supabase storage / S3


class IntakeTestPayload(BaseModel):
    from_address: str
    subject: Optional[str] = None
    to_address: Optional[str] = None
    thread_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    attachments: List[AttachmentIn] = []


def _find_user_id_by_email(from_address: str) -> str:
    """Look up profiles.id by email (normalized lowercase).

    Raises 404 if no matching profile is found.
    """
    if not from_address:
        raise HTTPException(status_code=400, detail="from_address is required")

    email_norm = from_address.strip().lower()
    sb = get_supabase()

    result = sb.table("profiles").select("id, email").eq("email", email_norm).single().execute()
    data = getattr(result, "data", None)
    if not data:
        log.warning("[EmailUnderwrite] No profile found for from_address=%s", email_norm)
        raise HTTPException(status_code=404, detail="No DealSniper user matches this from_address")

    return data["id"]


def create_underwrite_job(payload: IntakeTestPayload) -> str:
    """Insert a new email_underwrite_jobs row and return its id.

    This is reusable from Gmail/IMAP ingestion code later.
    """
    user_id = _find_user_id_by_email(payload.from_address)
    sb = get_supabase()

    job_record = {
        "user_id": user_id,
        "raw_email_id": None,
        "from_address": payload.from_address.strip().lower(),
        "to_address": payload.to_address,
        "subject": payload.subject,
        "thread_id": payload.thread_id,
        "provider_message_id": payload.provider_message_id,
        "attachments": [a.dict() for a in payload.attachments],
        "status": "pending",
    }

    result = sb.table("email_underwrite_jobs").insert(job_record).select("id").single().execute()
    data = getattr(result, "data", None)
    if not data or "id" not in data:
        log.error("[EmailUnderwrite] Failed to insert job for user_id=%s from=%s", user_id, payload.from_address)
        raise HTTPException(status_code=500, detail="Failed to create email underwrite job")

    job_id = data["id"]
    log.info("[EmailUnderwrite] Created job %s for user %s", job_id, user_id)
    return job_id


@router.post("/intake-test")
async def intake_test(payload: IntakeTestPayload):
    """Test endpoint: pretend we received an email and create a job.

    This lets us verify the mapping from from_address → user and the
    email_underwrite_jobs table wiring before adding real Gmail ingestion.
    """
    job_id = create_underwrite_job(payload)
    return {"job_id": job_id}
