"""Email → Auto-underwrite pipeline helpers.

This module creates rows in the email_underwrite_jobs table from incoming
email metadata so a background worker can parse docs and trigger underwriting.
It also contains a worker endpoint that:

* Pulls pending jobs created from synced Gmail messages
* Downloads the first OM-style attachment (PDF/Excel)
* Runs the parser_v4 RealEstateParser to extract full underwriting JSON
* Creates a DealV2 in the v2_underwriter storage
* Inserts a matching row into the Supabase `deals` table
* Links the job to the new deal_id and marks it as done
"""

import base64
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from googleapiclient.discovery import build

from email_deals import get_supabase, get_gmail_credentials  # reuse existing helpers
from parser_v4 import RealEstateParser
from v2_underwriter import storage

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


def _build_gmail_service(user_id: str):
    """Build an authenticated Gmail API client for a given user_id."""
    creds = get_gmail_credentials(user_id)
    if not creds:
        raise HTTPException(status_code=401, detail="Gmail not connected for this user")
    return build("gmail", "v1", credentials=creds)


def _download_first_document_attachment(service, message_id: str) -> tuple[Optional[bytes], Optional[str]]:
    """Download the first PDF/Excel/CSV attachment from a Gmail message.

    Returns (bytes, filename) or (None, None) if none found.
    """
    msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    payload = msg.get("payload", {})

    allowed_exts = (".pdf", ".xlsx", ".xls", ".csv")

    def iter_parts(part):
        yield part
        for p in part.get("parts", []) or []:
            yield from iter_parts(p)

    for part in iter_parts(payload):
        filename = part.get("filename") or ""
        if not filename:
            continue
        ext = Path(filename).suffix.lower()
        if ext not in allowed_exts:
            continue

        body = part.get("body", {})
        data = body.get("data")
        attachment_id = body.get("attachmentId")

        if data:
            try:
                content = base64.urlsafe_b64decode(data.encode("utf-8"))
                return content, filename
            except Exception:
                continue

        if attachment_id:
            attach = (
                service.users()
                .messages()
                .attachments()
                .get(userId="me", messageId=message_id, id=attachment_id)
                .execute()
            )
            data = attach.get("data")
            if data:
                content = base64.urlsafe_b64decode(data.encode("utf-8"))
                return content, filename

    return None, None


@router.post("/process-pending")
async def process_pending_jobs(request: Request, limit: int = 5):
    """Process pending email_underwrite_jobs into basic pipeline deals.

    This creates a minimal row in the Supabase `deals` table for each
    pending job (if it doesn't already have a deal_id), then marks the
    job as `done` and links the new deal_id. Full attachment parsing and
    detailed underwriting can be layered on top of this later.
    """

    sb = get_supabase()

    # Fetch a batch of jobs that don't yet have deals
    result = (
        sb.table("email_underwrite_jobs")
        .select("id, user_id, deal_id, from_address, subject, raw_email_id, provider_message_id")
        .eq("status", "pending")
        .is_("deal_id", None)
        .limit(limit)
        .execute()
    )
    jobs = getattr(result, "data", None) or []

    if not jobs:
        return {"processed": 0}

    processed = 0
    parser = RealEstateParser()
    gmail_services: dict[str, object] = {}

    for job in jobs:
        job_id = job["id"]
        user_id = job["user_id"]
        subject = job.get("subject") or "Email OM"
        from_addr = job.get("from_address") or "unknown"
        msg_id = job.get("provider_message_id")

        try:
            if not msg_id:
                raise RuntimeError("Missing provider_message_id on job")

            # Build/reuse Gmail client for this user
            if user_id not in gmail_services:
                gmail_services[user_id] = _build_gmail_service(user_id)
            service = gmail_services[user_id]

            # Download first OM-style attachment
            content, filename = _download_first_document_attachment(service, msg_id)
            if not content or not filename:
                raise RuntimeError("No PDF/Excel/CSV attachment found on email")

            # Persist attachment to temp file for parser_v4
            suffix = Path(filename).suffix or ".pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = Path(tmp.name)

            try:
                # OCR + parse to underwriting JSON
                ocr_result = parser.extract_text_with_ocr(str(tmp_path))
                if not ocr_result.get("success") or not ocr_result.get("text"):
                    raise RuntimeError(f"OCR failed: {ocr_result.get('error')}")

                parse_result = parser.parse_with_claude(ocr_result["text"], mode="underwriting")
                if not parse_result.get("success"):
                    raise RuntimeError(f"Parse failed: {parse_result.get('error')}")

                parsed_json = parse_result.get("data") or {}

                # Create DealV2 in file-based storage
                deal = storage.create_deal(parsed_json, filename)

                # Optionally run full underwriting analysis to attach verdict/summary
                try:
                    from v2_underwriter.routes import underwrite_deal as _underwrite_endpoint
                    # Fabricate a minimal Request-like object is messy; instead, we
                    # call the llm client indirectly by importing the helper.
                    # For now, skip auto-running narrative to avoid double-charging tokens
                    # and let the UI trigger it when the user opens the deal.
                except Exception:
                    pass

                # Build Supabase deals row
                now = datetime.utcnow().isoformat()
                deal_record = {
                    "deal_id": deal.id,
                    "user_id": user_id,
                    "address": getattr(deal, "summary_address", None) or subject,
                    "units": getattr(deal, "summary_units", None),
                    "purchase_price": getattr(deal, "summary_price", None),
                    "deal_structure": "Email OM",
                    "parsed_data": parsed_json,
                    "scenario_data": None,
                    "market_cap_rate": getattr(deal, "summary_cap_rate", None),
                    "rentcast_data": None,
                    "costseg_data": None,
                    "images": [],
                    "broker_name": None,
                    "broker_phone": None,
                    "broker_email": None,
                    "notes": None,
                    "latitude": None,
                    "longitude": None,
                    "pipeline_status": "pipeline",
                    "created_at": now,
                    "updated_at": now,
                }

                # Insert into deals table; service role key bypasses RLS
                sb.table("deals").insert(deal_record).execute()

                # Link job to deal and mark as done
                sb.table("email_underwrite_jobs").update(
                    {"deal_id": deal.id, "status": "done", "updated_at": now}
                ).eq("id", job_id).execute()

                processed += 1
            finally:
                try:
                    if tmp_path and tmp_path.exists():
                        os.remove(tmp_path)
                except Exception:
                    pass

        except Exception as e:
            log.exception("[EmailUnderwrite] Failed to process job %s: %s", job_id, e)
            # Mark job as errored so we don't reprocess endlessly
            sb.table("email_underwrite_jobs").update(
                {
                    "status": "error",
                    "error_message": str(e),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", job_id).execute()

    return {"processed": processed}
