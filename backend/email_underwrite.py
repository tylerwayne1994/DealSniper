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
import uuid
import email as email_mod
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from email_deals import get_supabase, get_imap_connection  # IMAP-based helpers

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


# ============================================================================
# Email Aliases Management
# ============================================================================

class AliasPayload(BaseModel):
    email: str


@router.get("/aliases")
async def get_aliases(request: Request):
    """Get the list of email aliases for the current user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    sb = get_supabase()
    result = sb.table("profiles").select("email, email_aliases").eq("id", user_id).single().execute()
    data = getattr(result, "data", None)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "primary_email": data.get("email", ""),
        "aliases": data.get("email_aliases") or [],
    }


@router.post("/aliases")
async def add_alias(payload: AliasPayload, request: Request):
    """Add an email alias for the current user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    alias = payload.email.strip().lower()
    if not alias or "@" not in alias:
        raise HTTPException(status_code=400, detail="Invalid email address")

    sb = get_supabase()

    # Get current aliases
    result = sb.table("profiles").select("email_aliases").eq("id", user_id).single().execute()
    data = getattr(result, "data", None)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")

    current = data.get("email_aliases") or []
    if alias in current:
        return {"aliases": current, "message": "Alias already exists"}

    updated = current + [alias]
    sb.table("profiles").update({"email_aliases": updated}).eq("id", user_id).execute()

    log.info("[EmailUnderwrite] Added alias %s for user %s", alias, user_id)
    return {"aliases": updated, "message": f"Added {alias}"}


@router.delete("/aliases")
async def remove_alias(payload: AliasPayload, request: Request):
    """Remove an email alias for the current user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    alias = payload.email.strip().lower()
    sb = get_supabase()

    result = sb.table("profiles").select("email_aliases").eq("id", user_id).single().execute()
    data = getattr(result, "data", None)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")

    current = data.get("email_aliases") or []
    updated = [a for a in current if a != alias]
    sb.table("profiles").update({"email_aliases": updated}).eq("id", user_id).execute()

    log.info("[EmailUnderwrite] Removed alias %s for user %s", alias, user_id)
    return {"aliases": updated, "message": f"Removed {alias}"}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, request: Request):
    """Delete a single email underwrite job.

    Also cleans up the linked raw_email row if present.
    Requires X-User-ID header to ensure the user owns this job.
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    sb = get_supabase()

    # Verify the job belongs to this user
    result = sb.table("email_underwrite_jobs").select("id, user_id, raw_email_id").eq("id", job_id).single().execute()
    job = getattr(result, "data", None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your job")

    # Delete the job
    sb.table("email_underwrite_jobs").delete().eq("id", job_id).execute()

    # Clean up linked raw_email if present
    raw_email_id = job.get("raw_email_id")
    if raw_email_id:
        try:
            sb.table("raw_emails").delete().eq("id", raw_email_id).execute()
        except Exception:
            pass  # non-critical

    log.info("[EmailUnderwrite] Deleted job %s for user %s", job_id, user_id)
    return {"success": True, "deleted": job_id}


@router.delete("/jobs")
async def delete_all_jobs(request: Request):
    """Delete ALL email underwrite jobs for the current user.

    Requires X-User-ID header.
    """
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")

    sb = get_supabase()

    # Get all jobs for this user (to clean up raw_emails too)
    result = sb.table("email_underwrite_jobs").select("id, raw_email_id").eq("user_id", user_id).execute()
    jobs = getattr(result, "data", None) or []

    # Delete jobs
    sb.table("email_underwrite_jobs").delete().eq("user_id", user_id).execute()

    # Clean up raw_emails
    raw_ids = [j["raw_email_id"] for j in jobs if j.get("raw_email_id")]
    for rid in raw_ids:
        try:
            sb.table("raw_emails").delete().eq("id", rid).execute()
        except Exception:
            pass

    log.info("[EmailUnderwrite] Deleted %d jobs for user %s", len(jobs), user_id)
    return {"success": True, "deleted_count": len(jobs)}


@router.post("/intake-test")
async def intake_test(payload: IntakeTestPayload):
    """Test endpoint: pretend we received an email and create a job.

    This lets us verify the mapping from from_address → user and the
    email_underwrite_jobs table wiring before adding real Gmail ingestion.
    """
    job_id = create_underwrite_job(payload)
    return {"job_id": job_id}


def _download_attachment_via_imap(uid_str: str) -> tuple[Optional[bytes], Optional[str]]:
    """Download the first PDF/Excel/CSV attachment from the inbound inbox via IMAP.

    Uses the system-level IMAP connection (env vars, no OAuth).
    uid_str may be a plain UID like "5" or a folder:uid key like "[Gmail]/Spam:1".
    Returns (file_bytes, filename) or (None, None).
    """
    mail = get_imap_connection()
    if not mail:
        log.error("[EmailUnderwrite] IMAP connection failed — check env vars")
        return None, None

    try:
        # Parse folder and UID from the dedup key
        if ":" in uid_str:
            folder, uid_only = uid_str.rsplit(":", 1)
        else:
            folder = "INBOX"
            uid_only = uid_str

        log.info("[EmailUnderwrite] Fetching attachment: folder=%s uid=%s", folder, uid_only)
        print(f"[DEBUG] _download_attachment_via_imap: folder={folder!r} uid={uid_only!r}")

        mail.select(folder)
        st, msg_data = mail.uid("fetch", uid_only.encode(), "(RFC822)")

        if st != "OK" or not msg_data or not msg_data[0]:
            log.warning("[EmailUnderwrite] IMAP fetch failed for UID %s", uid_str)
            return None, None

        raw_bytes = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
        msg = email_mod.message_from_bytes(raw_bytes)

        # ── DEBUG: dump all parts in the email ──
        print(f"[DEBUG] Email Subject: {msg.get('Subject', '(none)')}")
        print(f"[DEBUG] Email From: {msg.get('From', '(none)')}")
        print(f"[DEBUG] Content-Type: {msg.get_content_type()}")
        print(f"[DEBUG] Is multipart: {msg.is_multipart()}")
        part_index = 0
        for part in msg.walk():
            ct = part.get_content_type()
            fn = part.get_filename()
            disp = part.get("Content-Disposition", "")
            size = len(part.get_payload(decode=True) or b"") if part.get_content_maintype() != "multipart" else 0
            print(f"[DEBUG]   Part {part_index}: type={ct}  filename={fn!r}  disposition={disp!r}  size={size}")
            part_index += 1
        # ── END DEBUG ──

        allowed_exts = (".pdf", ".xlsx", ".xls", ".csv")

        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue

            filename = part.get_filename()
            # Also check Content-Disposition for attachment without explicit filename
            content_disp = str(part.get("Content-Disposition", ""))
            content_type = part.get_content_type()

            if not filename:
                # Try to derive filename from content type for unnamed attachments
                if "attachment" in content_disp or content_type == "application/pdf":
                    if content_type == "application/pdf":
                        filename = "attachment.pdf"
                    elif content_type in ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",):
                        filename = "attachment.xlsx"
                    elif content_type in ("application/vnd.ms-excel",):
                        filename = "attachment.xls"
                    elif content_type == "text/csv":
                        filename = "attachment.csv"
                    else:
                        print(f"[DEBUG] Skipping unnamed part with type={content_type}")
                        continue
                else:
                    continue

            # Decode RFC-2047 filename if needed
            from email.header import decode_header
            decoded_parts = decode_header(filename)
            decoded_name = ""
            for data, charset in decoded_parts:
                if isinstance(data, bytes):
                    decoded_name += data.decode(charset or "utf-8", errors="replace")
                else:
                    decoded_name += data
            filename = decoded_name

            ext = Path(filename).suffix.lower()
            if ext not in allowed_exts:
                continue

            payload = part.get_payload(decode=True)
            if payload:
                return payload, filename

        return None, None
    finally:
        try:
            mail.logout()
        except Exception:
            pass


@router.post("/process-pending")
async def process_pending_jobs(request: Request, limit: int = 5):
    """Process pending email_underwrite_jobs into basic pipeline deals.

    Creates a row in Supabase `deals` for each pending job using email
    metadata. Downloads the attachment and stores it, but does NOT run
    heavy OCR/parsing synchronously (that would timeout on Render).
    The user can trigger full underwriting later from the deal page.
    """

    sb = get_supabase()

    try:
        # Fetch pending jobs
        pending_result = (
            sb.table("email_underwrite_jobs")
            .select("id, user_id, deal_id, from_address, subject, raw_email_id, provider_message_id")
            .eq("status", "pending")
            .is_("deal_id", None)
            .limit(limit)
            .execute()
        )
        pending_jobs = getattr(pending_result, "data", None) or []

        # Fetch errored jobs for retry
        error_result = (
            sb.table("email_underwrite_jobs")
            .select("id, user_id, deal_id, from_address, subject, raw_email_id, provider_message_id")
            .eq("status", "error")
            .is_("deal_id", None)
            .limit(limit)
            .execute()
        )
        error_jobs = getattr(error_result, "data", None) or []

        jobs = pending_jobs + error_jobs
        print(f"[DEBUG] process-pending: found {len(pending_jobs)} pending + {len(error_jobs)} errored = {len(jobs)} total jobs")
    except Exception as query_err:
        print(f"[DEBUG] process-pending query error: {query_err}")
        log.exception("[EmailUnderwrite] Failed to query jobs: %s", query_err)
        raise HTTPException(status_code=500, detail=f"Failed to query jobs: {str(query_err)}")

    if not jobs:
        return {"processed": 0, "total_jobs": 0, "debug": "No pending or errored jobs found"}

    processed = 0
    errors = []

    for job in jobs:
        job_id = job["id"]
        user_id = job["user_id"]
        subject = job.get("subject") or "Email OM"
        from_addr = job.get("from_address") or "unknown"
        msg_id = job.get("provider_message_id")

        try:
            print(f"[DEBUG] Processing job {job_id}: msg_id={msg_id} subject={subject!r}")

            # Generate a unique deal_id
            deal_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()

            # Build a lightweight Supabase deals row from email metadata only
            # No IMAP download — that would timeout on Render.
            # The attachment can be fetched/parsed later from the deal page.
            deal_record = {
                "deal_id": deal_id,
                "user_id": user_id,
                "address": subject or "Email OM (pending parse)",
                "units": None,
                "purchase_price": None,
                "deal_structure": "Email OM",
                "parsed_data": {
                    "source": "email_underwrite",
                    "email_from": from_addr,
                    "email_subject": subject,
                    "provider_message_id": msg_id,
                    "status": "awaiting_parse",
                },
                "scenario_data": None,
                "market_cap_rate": None,
                "rentcast_data": None,
                "costseg_data": None,
                "images": [],
                "broker_name": None,
                "broker_phone": None,
                "broker_email": None,
                "notes": f"Auto-created from email. From: {from_addr}.",
                "latitude": None,
                "longitude": None,
                "pipeline_status": "pipeline",
                "created_at": now,
                "updated_at": now,
            }

            # Insert into deals table
            sb.table("deals").insert(deal_record).execute()
            print(f"[DEBUG] Created deal {deal_id} for job {job_id}")

            # Link job to deal and mark as done
            sb.table("email_underwrite_jobs").update(
                {"deal_id": deal_id, "status": "done", "updated_at": now}
            ).eq("id", job_id).execute()

            processed += 1

        except Exception as e:
            log.exception("[EmailUnderwrite] Failed to process job %s: %s", job_id, e)
            error_msg = str(e)
            errors.append({"job_id": job_id, "error": error_msg})
            print(f"[DEBUG] Job {job_id} failed: {error_msg}")
            # Mark job as errored
            sb.table("email_underwrite_jobs").update(
                {
                    "status": "error",
                    "error_message": error_msg,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", job_id).execute()

    return {
        "processed": processed,
        "total_jobs": len(jobs),
        "errors": errors,
        "debug": f"Attempted {len(jobs)} jobs, processed {processed}",
    }


@router.post("/parse-om/{job_id}")
async def parse_email_om(job_id: str):
    """Download the email attachment and parse the OM for a single job.

    This creates full parsed_data / scenario_data in the Supabase deals row,
    allowing the frontend ResultsPageV2 to render the deal with real data.
    """
    import tempfile

    sb = get_supabase()

    # 1. Get the job
    job_result = (
        sb.table("email_underwrite_jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
    )
    job = getattr(job_result, "data", None)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    deal_id = job.get("deal_id")
    if not deal_id:
        raise HTTPException(status_code=400, detail="Job has no deal_id — run process-pending first")

    msg_id = job.get("provider_message_id")
    if not msg_id:
        raise HTTPException(status_code=400, detail="Job has no provider_message_id — cannot download email")

    print(f"[DEBUG] parse-om: job={job_id} deal={deal_id} msg_id={msg_id}")

    # 2. Download attachment via IMAP
    file_bytes, filename = _download_attachment_via_imap(msg_id)
    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="No PDF/Excel/CSV attachment found in the email. Make sure the forwarded email has an OM attachment.",
        )

    print(f"[DEBUG] parse-om: downloaded {filename} ({len(file_bytes)} bytes)")

    # 3. Save to temp file and parse with parser_v4
    ext = os.path.splitext(filename)[1] if filename else ".pdf"
    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp.write(file_bytes)
    tmp.close()
    temp_path = tmp.name

    try:
        from parser_v4 import RealEstateParser

        parser = RealEstateParser()
        result = parser.parse_document(temp_path)
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Parsing failed: {result.get('error', 'unknown error')}",
        )

    parsed_data = result["data"]
    print(f"[DEBUG] parse-om: parsed successfully, keys={list(parsed_data.keys())}")

    # 4. Run post-processing to bridge expense/NOI fields (same as v2 parse)
    try:
        from v2_underwriter.routes import _post_process_parsed_data

        parsed_data = _post_process_parsed_data(parsed_data)
    except Exception as e:
        log.warning("[EmailUnderwrite] Post-process failed (non-fatal): %s", e)

    # 5. Update the Supabase deal with parsed data
    now = datetime.utcnow().isoformat()
    prop = parsed_data.get("property", {})
    pricing = parsed_data.get("pricing_financing", {})
    broker = parsed_data.get("broker_info", {})

    address = (
        prop.get("address")
        or ", ".join(filter(None, [prop.get("city"), prop.get("state")])) 
        or "Email OM"
    )

    update_payload = {
        "parsed_data": parsed_data,
        "scenario_data": parsed_data,
        "address": address,
        "units": prop.get("units"),
        "purchase_price": pricing.get("price"),
        "broker_name": broker.get("broker_name"),
        "broker_phone": broker.get("broker_phone"),
        "broker_email": broker.get("broker_email"),
        "updated_at": now,
    }

    sb.table("deals").update(update_payload).eq("deal_id", deal_id).execute()
    print(f"[DEBUG] parse-om: updated deal {deal_id} with parsed data")

    return {
        "success": True,
        "deal_id": deal_id,
        "address": address,
        "units": prop.get("units"),
        "price": pricing.get("price"),
    }
