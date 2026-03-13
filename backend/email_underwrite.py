"""Email → Auto-underwrite pipeline helpers.

This module creates rows in the email_underwrite_jobs table from incoming
email metadata so a background worker can parse docs and trigger underwriting.

A background thread polls the Gmail inbox every 2 minutes and automatically:
1. Syncs new emails from INBOX + Spam
2. Creates placeholder deal rows
3. Downloads attachments and parses OMs with Claude Vision
4. Updates deals with full parsed/underwritten data
"""

import base64
import io
import json
import logging
import os
import re
import threading
import time
import uuid
import email as email_mod
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from email_deals import get_supabase, get_imap_connection  # IMAP-based helpers

log = logging.getLogger("email_underwrite")

# Public-facing inbound address (what users see / forward to)
INBOUND_EMAIL = "deals@dealsniper.org"

# Gmail address used only for IMAP transport (Cloudflare routes deals@dealsniper.org here)
INBOUND_GMAIL = os.getenv("INBOUND_GMAIL_ADDRESS", "dealsniperinbound@gmail.com").strip().lower()

# Set of ALL addresses that count as "us" — used for forwarded-email detection
INBOUND_ADDRESSES = {INBOUND_EMAIL, INBOUND_GMAIL}

# SendGrid Inbound Parse webhook domain
INBOUND_DOMAIN = os.getenv("INBOUND_EMAIL_DOMAIN", "dealsniper.org")

router = APIRouter(prefix="/api/email-underwrite", tags=["Email Underwrite"])


def _imap_select(mail, folder: str):
    """Select an IMAP folder, properly quoting names with spaces/brackets.

    Gmail folders like [Gmail]/All Mail MUST be quoted for IMAP.
    Returns (status, response) from mail.select().
    """
    # Always quote the folder name to handle spaces and special chars
    quoted = f'"{folder}"'
    return mail.select(quoted)


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


# ═══════════════════════════════════════════════════════════════════════════
# INBOUND WEBHOOK — receives raw email from Cloudflare Email Workers
# No IMAP. No polling. Instant. Attachments included in the POST.
# ═══════════════════════════════════════════════════════════════════════════

# Shared secret to verify webhook calls (set in Cloudflare Worker + Render env)
WEBHOOK_SECRET = os.getenv("EMAIL_WEBHOOK_SECRET", "")


def _parse_attachment_from_bytes(file_bytes: bytes, filename: str, job_id: str, deal_id: str, user_id: str, from_addr: str, subject: str) -> dict:
    """Parse an attachment (PDF/image) with Claude Vision and update the deal.

    This is the shared parsing core used by both the webhook and IMAP pipelines.
    No IMAP involved — takes raw file bytes directly.
    """
    sb = get_supabase()
    now = datetime.utcnow().isoformat

    from anthropic import Anthropic
    from v2_underwriter.routes import filter_pdf_pages_smart, _post_process_parsed_data

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"

    if not ANTHROPIC_API_KEY:
        sb.table("email_underwrite_jobs").update(
            {"status": "error", "error_message": "No Anthropic API key", "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", job_id).execute()
        return {"error": "Anthropic API key not configured", "deal_id": deal_id}

    anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

    ext = (os.path.splitext(filename)[1] if filename else ".pdf").lower()
    mime_map = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
    mime = mime_map.get(ext, "application/pdf")

    if mime == "application/pdf":
        try:
            images = filter_pdf_pages_smart(file_bytes, min_score=15, max_pages=15)
        except Exception:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(file_bytes, dpi=100, first_page=1, last_page=10)

        if not images:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": "Could not extract PDF images", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"error": "Could not extract PDF images", "deal_id": deal_id}

        content_items = []
        for img in images:
            img_buf = io.BytesIO()
            if img.mode == "RGBA":
                img = img.convert("RGB")
            img.save(img_buf, format="JPEG", quality=75, optimize=True)
            file_b64 = base64.b64encode(img_buf.getvalue()).decode("utf-8")
            content_items.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": file_b64},
            })
    else:
        file_b64 = base64.b64encode(file_bytes).decode("utf-8")
        content_items = [{"type": "image", "source": {"type": "base64", "media_type": mime, "data": file_b64}}]

    schema_block = '''Return JSON matching this schema:
{
  "property": {"property_name": "", "address": "", "city": "", "state": "", "zip": "", "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0, "property_type": "", "property_class": "", "parking_spaces": 0},
  "pricing_financing": {"price": 0, "price_per_unit": 0, "price_per_sf": 0, "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0, "term_years": 0, "amortization_years": 0},
  "pnl": {"gross_potential_rent": 0, "other_income": 0, "vacancy_rate": 0, "vacancy_amount": 0, "effective_gross_income": 0, "operating_expenses": 0, "operating_expenses_t12": 0, "operating_expenses_proforma": 0, "noi": 0, "noi_t12": 0, "noi_proforma": 0, "noi_stabilized": 0, "cap_rate": 0, "cap_rate_t12": 0, "cap_rate_proforma": 0, "expense_ratio": 0},
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "mix_pct": 0, "unit_sf": 0, "rent_current": 0, "rent_psf": 0, "rent_market": 0}],
  "broker_info": {"broker_name": "", "broker_company": "", "broker_phone": "", "broker_email": ""}
}
Return ONLY valid JSON, no markdown or explanation.'''

    content_items.append({
        "type": "text",
        "text": f"Extract ONLY numerical data from this real estate offering memorandum. Focus on property details, pricing/financing terms, income statements, expense breakdowns, underwriting assumptions, and unit mix.\n\n{schema_block}",
    })

    print(f"[WebhookParse] Sending {len(content_items)-1} images to Claude for job {job_id}...")
    response = anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": content_items}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:].strip()

    parsed_data = json.loads(text)

    try:
        parsed_data = _post_process_parsed_data(parsed_data)
    except Exception as e:
        log.warning("[WebhookParse] Post-process failed (non-fatal): %s", e)

    prop = parsed_data.get("property", {})
    pricing = parsed_data.get("pricing_financing", {})
    broker = parsed_data.get("broker_info", {})

    address = (
        prop.get("address")
        or ", ".join(filter(None, [prop.get("city"), prop.get("state")]))
        or subject or "Email OM"
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
        "updated_at": datetime.utcnow().isoformat(),
    }

    sb.table("deals").update(update_payload).eq("deal_id", deal_id).execute()

    sb.table("email_underwrite_jobs").update(
        {"deal_id": deal_id, "status": "done", "updated_at": datetime.utcnow().isoformat()}
    ).eq("id", job_id).execute()

    print(f"[WebhookParse] Job {job_id} DONE — deal {deal_id}: {address}")
    return {"success": True, "deal_id": deal_id, "address": address}


def _process_webhook_email(raw_mime: bytes):
    """Process a raw MIME email from the inbound webhook.

    Extracts sender, subject, attachments and runs the full underwrite pipeline.
    Runs in a background thread — does not block the webhook response.
    """
    try:
        msg = email_mod.message_from_bytes(raw_mime)

        # Extract sender
        from_raw = _safe_decode_header(msg.get("From", ""))
        email_match = re.search(r"<([^>]+)>", from_raw)
        sender_email = (email_match.group(1) if email_match else from_raw).strip().lower()

        subject = _safe_decode_header(msg.get("Subject", ""))
        message_id = msg.get("Message-ID", "")
        to_raw = _safe_decode_header(msg.get("To", ""))

        print(f"[Webhook] Processing email from={sender_email} subject={subject[:80]}")

        sb = get_supabase()

        # Dedup by Message-ID
        if message_id:
            existing = sb.table("raw_emails").select("id").eq("provider_message_id", f"webhook:{message_id}").execute()
            if existing.data:
                print(f"[Webhook] Duplicate email (Message-ID={message_id}), skipping")
                return

        # Match sender to user profile
        matched_user_id = _match_sender_to_user(sb, sender_email)
        if not matched_user_id:
            # Last resort: assign to most recent active user
            try:
                recent = sb.table("email_underwrite_jobs").select("user_id").order("created_at", desc=True).limit(1).execute()
                if recent.data:
                    matched_user_id = recent.data[0]["user_id"]
                    print(f"[Webhook] No profile match for {sender_email}, assigned to last active user {matched_user_id}")
            except Exception:
                pass
        if not matched_user_id:
            # Final fallback: get any user from profiles
            try:
                any_user = sb.table("profiles").select("id").limit(1).execute()
                if any_user.data:
                    matched_user_id = any_user.data[0]["id"]
                    print(f"[Webhook] Fallback: assigned to first profile user {matched_user_id}")
            except Exception:
                pass
        if not matched_user_id:
            print(f"[Webhook] SKIPPING — no user found for {sender_email}")
            return

        # Extract PDF/image attachments
        attachments = []
        for part in msg.walk():
            content_disp = part.get("Content-Disposition", "")
            if "attachment" in content_disp or part.get_content_type() == "application/pdf":
                filename = part.get_filename() or "attachment.pdf"
                payload = part.get_payload(decode=True)
                if payload and len(payload) > 1000:  # skip tiny files
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in (".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls"):
                        attachments.append((filename, payload))
                        print(f"[Webhook] Found attachment: {filename} ({len(payload)} bytes)")

        if not attachments:
            print(f"[Webhook] No valid attachments found in email from {sender_email}")

        # Create raw_email record
        now = datetime.utcnow().isoformat()
        received_at = None
        try:
            received_at = parsedate_to_datetime(msg.get("Date", "")).isoformat()
        except Exception:
            received_at = now

        raw_email_data = {
            "user_id": matched_user_id,
            "provider_message_id": f"webhook:{message_id}" if message_id else f"webhook:{uuid.uuid4()}",
            "thread_id": message_id,
            "from_address": from_raw,
            "subject": subject,
            "snippet": "",
            "received_at": received_at,
            "raw_payload": {},
            "processed": False,
        }
        raw_insert = sb.table("raw_emails").insert(raw_email_data).execute()
        raw_email_id = (raw_insert.data or [{}])[0].get("id")

        # Process each attachment as a separate job
        for filename, file_bytes in attachments:
            try:
                # Create job
                job_record = {
                    "user_id": matched_user_id,
                    "raw_email_id": raw_email_id,
                    "from_address": from_raw,
                    "to_address": to_raw,
                    "subject": subject,
                    "thread_id": message_id,
                    "provider_message_id": f"webhook:{message_id}",
                    "attachments": [{"filename": filename, "size": len(file_bytes)}],
                    "status": "processing",
                }
                job_insert = sb.table("email_underwrite_jobs").insert(job_record).execute()
                job_id = (job_insert.data or [{}])[0].get("id")
                if not job_id:
                    print(f"[Webhook] Failed to create job for {filename}")
                    continue

                # Create deal stub
                deal_id = str(uuid.uuid4())
                deal_record = {
                    "deal_id": deal_id,
                    "user_id": matched_user_id,
                    "address": subject or f"Email OM - {filename}",
                    "units": None,
                    "purchase_price": None,
                    "deal_structure": "Email OM",
                    "parsed_data": {"source": "email_webhook", "status": "parsing", "email_from": from_raw, "email_subject": subject},
                    "scenario_data": None,
                    "market_cap_rate": None,
                    "rentcast_data": None,
                    "costseg_data": None,
                    "images": [],
                    "broker_name": None,
                    "broker_phone": None,
                    "broker_email": None,
                    "notes": f"Auto-created from email webhook. From: {from_raw}.",
                    "latitude": None,
                    "longitude": None,
                    "pipeline_status": "pipeline",
                    "created_at": now,
                    "updated_at": now,
                }
                sb.table("deals").insert(deal_record).execute()
                sb.table("email_underwrite_jobs").update(
                    {"deal_id": deal_id, "status": "processing", "updated_at": now}
                ).eq("id", job_id).execute()

                print(f"[Webhook] Created deal {deal_id}, job {job_id} — parsing {filename}...")

                # Parse with Claude Vision — directly from bytes, no IMAP download needed
                result = _parse_attachment_from_bytes(
                    file_bytes=file_bytes,
                    filename=filename,
                    job_id=job_id,
                    deal_id=deal_id,
                    user_id=matched_user_id,
                    from_addr=from_raw,
                    subject=subject,
                )
                print(f"[Webhook] Job {job_id} result: {result}")

            except Exception as e:
                print(f"[Webhook] Error processing attachment {filename}: {e}")
                import traceback
                traceback.print_exc()
                try:
                    sb.table("email_underwrite_jobs").update(
                        {"status": "error", "error_message": str(e)[:500], "updated_at": datetime.utcnow().isoformat()}
                    ).eq("id", job_id).execute()
                except Exception:
                    pass

        # If no attachments, create a job noting that
        if not attachments:
            job_record = {
                "user_id": matched_user_id,
                "raw_email_id": raw_email_id,
                "from_address": from_raw,
                "subject": subject,
                "provider_message_id": f"webhook:{message_id}",
                "attachments": [],
                "status": "done",
                "error_message": "No PDF/image attachment found",
            }
            sb.table("email_underwrite_jobs").insert(job_record).execute()

        print(f"[Webhook] Finished processing email from {sender_email}: {len(attachments)} attachments")

    except Exception as e:
        print(f"[Webhook] FATAL error processing webhook email: {e}")
        import traceback
        traceback.print_exc()


@router.post("/inbound-webhook")
async def inbound_email_webhook(request: Request):
    """Receive inbound emails from Cloudflare Email Workers.

    The Worker POSTs the raw MIME email as the request body.
    Processing happens in a background thread — returns 200 immediately.
    """
    # Verify webhook secret
    auth_header = request.headers.get("X-Webhook-Secret", "")
    if WEBHOOK_SECRET and auth_header != WEBHOOK_SECRET:
        print(f"[Webhook] Unauthorized request (bad secret)")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    # Read raw MIME body
    raw_body = await request.body()
    if not raw_body:
        raise HTTPException(status_code=400, detail="Empty request body")

    content_type = request.headers.get("content-type", "")
    print(f"[Webhook] Received {len(raw_body)} bytes, content-type={content_type}")

    # If it's multipart form data (SendGrid-style), extract the 'email' field
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
            raw_email = form.get("email")
            if raw_email:
                if isinstance(raw_email, str):
                    raw_body = raw_email.encode("utf-8")
                else:
                    raw_body = await raw_email.read() if hasattr(raw_email, "read") else raw_email
        except Exception as e:
            print(f"[Webhook] Form parse error: {e}")

    # Process in background thread — return 200 immediately
    def _bg():
        _process_webhook_email(raw_body)

    t = threading.Thread(target=_bg, daemon=True, name=f"webhook-{uuid.uuid4().hex[:8]}")
    t.start()

    return {"status": "accepted", "message": "Email received, processing in background."}


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


def _extract_attachment_from_msg(msg) -> tuple[Optional[bytes], Optional[str]]:
    """Extract the first PDF/Excel/CSV attachment from an email.message object.

    Returns (file_bytes, filename) or (None, None).
    """
    allowed_exts = (".pdf", ".xlsx", ".xls", ".csv")

    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue

        filename = part.get_filename()
        content_disp = str(part.get("Content-Disposition", ""))
        content_type = part.get_content_type()

        if not filename:
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


def _download_attachment_via_imap(uid_str: str) -> tuple[Optional[bytes], Optional[str]]:
    """Download the first PDF/Excel/CSV attachment from the inbound inbox via IMAP.

    Uses the system-level IMAP connection (env vars, no OAuth).
    uid_str may be a plain UID like "5" or a folder:uid key like "[Gmail]/Spam:1".
    Falls back to [Gmail]/All Mail if the original folder/UID fails.
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

        # Try the original folder first
        msg = None
        folders_to_try = [folder]
        if folder != "[Gmail]/All Mail":
            folders_to_try.append("[Gmail]/All Mail")
        if folder != "INBOX":
            folders_to_try.append("INBOX")

        for try_folder in folders_to_try:
            try:
                st_sel, _ = _imap_select(mail, try_folder)
                if st_sel != "OK":
                    print(f"[DEBUG] Could not select folder {try_folder}")
                    continue

                if try_folder == folder:
                    # Use the exact UID
                    st, msg_data = mail.uid("fetch", uid_only.encode(), "(RFC822)")
                    if st == "OK" and msg_data and msg_data[0] and isinstance(msg_data[0], tuple):
                        raw_bytes = msg_data[0][1]
                        msg = email_mod.message_from_bytes(raw_bytes)
                        print(f"[DEBUG] Found email in original folder {try_folder} UID {uid_only}")
                        break
                else:
                    # Search by SINCE in the fallback folder — scan recent emails
                    print(f"[DEBUG] Original folder failed, searching {try_folder}...")
                    since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%d-%b-%Y")
                    st_search, search_data = mail.uid("search", None, f"(SINCE {since_date})")
                    if st_search == "OK" and search_data[0]:
                        # Check each UID in reverse (newest first)
                        for fb_uid in reversed(search_data[0].split()):
                            st_fb, fb_data = mail.uid("fetch", fb_uid, "(RFC822)")
                            if st_fb != "OK" or not fb_data or not fb_data[0] or not isinstance(fb_data[0], tuple):
                                continue
                            fb_raw = fb_data[0][1]
                            fb_msg = email_mod.message_from_bytes(fb_raw)
                            # Check if this email has a matching attachment
                            fb_bytes, fb_name = _extract_attachment_from_msg(fb_msg)
                            if fb_bytes:
                                print(f"[DEBUG] Found email with attachment in {try_folder} UID {fb_uid.decode()}: {fb_name}")
                                return fb_bytes, fb_name
            except Exception as e:
                print(f"[DEBUG] Error trying folder {try_folder}: {e}")
                continue

        if not msg:
            log.warning("[EmailUnderwrite] IMAP fetch failed for UID %s in all folders", uid_str)
            return None, None

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

        result = _extract_attachment_from_msg(msg)
        return result
    finally:
        try:
            mail.logout()
        except Exception:
            pass


@router.post("/process-pending")
async def process_pending_jobs(request: Request, limit: int = 5):
    """Process pending email_underwrite_jobs through the full auto-pipeline.

    For each pending job: creates a deal, downloads the attachment,
    parses with Claude Vision, and updates the deal with real data.
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
        try:
            print(f"[DEBUG] process-pending: routing job {job_id} to full pipeline (_process_and_parse_job)")
            result = _process_and_parse_job(job_id)
            if result.get("success"):
                processed += 1
            elif result.get("error"):
                errors.append({"job_id": job_id, "error": result["error"]})
            print(f"[DEBUG] process-pending: job {job_id} result: {result}")
        except Exception as e:
            log.exception("[EmailUnderwrite] Failed to process job %s: %s", job_id, e)
            errors.append({"job_id": job_id, "error": str(e)})
            print(f"[DEBUG] process-pending: job {job_id} failed: {e}")

    return {
        "processed": processed,
        "total_jobs": len(jobs),
        "errors": errors,
        "debug": f"Attempted {len(jobs)} jobs via full pipeline, processed {processed}",
    }


@router.post("/parse-om/{job_id}")
async def parse_email_om(job_id: str):
    """Download the email attachment and parse using the V2 Claude Vision pipeline.

    This is the same system used by /v2/deals/parse — Claude Sonnet vision
    on PDF pages with post-processing. Then updates the Supabase deal row
    so ResultsPageV2 can render it.
    """
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

    # 3. Parse using V2 Claude Vision pipeline (same as /v2/deals/parse)
    import io
    from anthropic import Anthropic
    from v2_underwriter.routes import filter_pdf_pages_smart, _post_process_parsed_data

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

    ext = (os.path.splitext(filename)[1] if filename else ".pdf").lower()
    mime_map = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
    mime = mime_map.get(ext, "application/pdf")

    if mime == "application/pdf":
        try:
            images = filter_pdf_pages_smart(file_bytes, min_score=15, max_pages=15)
        except Exception as filter_err:
            print(f"[DEBUG] parse-om: Smart filter failed, falling back: {filter_err}")
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(file_bytes, dpi=100, first_page=1, last_page=10)

        if not images:
            raise HTTPException(status_code=400, detail="Could not extract images from PDF")

        content_items = []
        for img in images:
            img_buf = io.BytesIO()
            if img.mode == "RGBA":
                img = img.convert("RGB")
            img.save(img_buf, format="JPEG", quality=75, optimize=True)
            file_b64 = base64.b64encode(img_buf.getvalue()).decode("utf-8")
            content_items.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": file_b64},
            })
    else:
        file_b64 = base64.b64encode(file_bytes).decode("utf-8")
        content_items = [{
            "type": "image",
            "source": {"type": "base64", "media_type": mime, "data": file_b64},
        }]

    # Use the same extraction prompt as /v2/deals/parse
    schema_block = '''Return JSON matching this schema:
{
  "property": {"property_name": "", "address": "", "city": "", "state": "", "zip": "", "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0, "property_type": "", "property_class": "", "parking_spaces": 0},
  "pricing_financing": {"price": 0, "price_per_unit": 0, "price_per_sf": 0, "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0, "term_years": 0, "amortization_years": 0},
  "pnl": {"gross_potential_rent": 0, "other_income": 0, "vacancy_rate": 0, "vacancy_amount": 0, "effective_gross_income": 0, "operating_expenses": 0, "operating_expenses_t12": 0, "operating_expenses_proforma": 0, "noi": 0, "noi_t12": 0, "noi_proforma": 0, "noi_stabilized": 0, "cap_rate": 0, "cap_rate_t12": 0, "cap_rate_proforma": 0, "expense_ratio": 0},
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "mix_pct": 0, "unit_sf": 0, "rent_current": 0, "rent_psf": 0, "rent_market": 0}],
  "broker_info": {"broker_name": "", "broker_company": "", "broker_phone": "", "broker_email": ""}
}
Return ONLY valid JSON, no markdown or explanation.'''

    content_items.append({
        "type": "text",
        "text": f"Extract ONLY numerical data from this real estate offering memorandum. Focus on property details, pricing/financing terms, income statements, expense breakdowns, underwriting assumptions, and unit mix.\n\n{schema_block}",
    })

    print(f"[DEBUG] parse-om: calling Claude Vision with {len(content_items) - 1} images")

    response = anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": content_items}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:].strip()

    import json as json_mod
    parsed_data = json_mod.loads(text)
    print(f"[DEBUG] parse-om: Claude parsed successfully, keys={list(parsed_data.keys())}")

    # 4. Post-process to bridge expense/NOI fields
    try:
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


# ═══════════════════════════════════════════════════════════════════════════
# AUTO-PIPELINE: Background worker that syncs + processes + parses emails
# ═══════════════════════════════════════════════════════════════════════════

_AUTO_PIPELINE_INTERVAL = int(os.getenv("EMAIL_POLL_INTERVAL", "120"))  # seconds


def _safe_decode_header(raw: str) -> str:
    """Decode RFC-2047 encoded header value."""
    from email.header import decode_header
    parts = decode_header(raw)
    decoded = []
    for data, charset in parts:
        if isinstance(data, bytes):
            decoded.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(data)
    return " ".join(decoded)


def _match_sender_to_user(sb, sender_email: str) -> Optional[str]:
    """Try to match a sender email to a user profile ID.

    Checks: profiles.email (ilike) → email_aliases (contains) → broad scan.
    Returns user_id or None.
    """
    if not sender_email:
        return None

    sender_email = sender_email.strip().lower()

    # Primary: profiles.email
    try:
        res = sb.table("profiles").select("id, email").ilike("email", sender_email).execute()
        if res.data:
            uid = res.data[0]["id"]
            print(f"[AutoPipeline-Match]   ✅ {sender_email} matched via profiles.email → {uid}")
            return uid
    except Exception as e:
        print(f"[AutoPipeline-Match]   profiles.email lookup error: {e}")

    # Secondary: email_aliases
    try:
        alias_res = sb.table("profiles").select("id").contains("email_aliases", [sender_email]).execute()
        if alias_res.data:
            uid = alias_res.data[0]["id"]
            print(f"[AutoPipeline-Match]   ✅ {sender_email} matched via email_aliases → {uid}")
            return uid
    except Exception as e:
        print(f"[AutoPipeline-Match]   email_aliases lookup error: {e}")

    # Fallback: broad scan
    try:
        broad = sb.table("profiles").select("id, email, email_aliases").execute()
        for row in (broad.data or []):
            row_email = (row.get("email") or "").strip().lower()
            row_aliases = [a.strip().lower() for a in (row.get("email_aliases") or []) if a]
            if row_email == sender_email or sender_email in row_aliases:
                uid = row["id"]
                print(f"[AutoPipeline-Match]   ✅ {sender_email} matched via broad_scan → {uid}")
                return uid
    except Exception as e:
        print(f"[AutoPipeline-Match]   broad scan error: {e}")

    print(f"[AutoPipeline-Match]   ❌ No match for {sender_email}")
    return None


def _sync_inbox_core() -> dict:
    """Core IMAP sync logic — scans inbox + spam, matches senders, creates jobs.

    Returns a summary dict. Does NOT raise HTTPException (safe for background use).
    """
    print("[AutoPipeline-Sync] Starting _sync_inbox_core()...")
    mail = get_imap_connection()
    if not mail:
        print("[AutoPipeline-Sync] ❌ IMAP connection returned None — Gmail IMAP transport not configured!")
        print(f"[AutoPipeline-Sync]   IMAP transport configured: {bool(os.getenv('INBOUND_GMAIL_ADDRESS'))}")
        print(f"[AutoPipeline-Sync]   INBOUND_GMAIL_APP_PASSWORD set: {bool(os.getenv('INBOUND_GMAIL_APP_PASSWORD'))}")
        return {"error": "IMAP not configured — check INBOUND_GMAIL_ADDRESS and INBOUND_GMAIL_APP_PASSWORD env vars", "synced": 0}

    print("[AutoPipeline-Sync] ✅ IMAP connected successfully")

    try:
        folders_to_check = ["INBOX", "[Gmail]/All Mail", "[Gmail]/Spam"]
        since_date = (datetime.utcnow() - timedelta(days=14)).strftime("%d-%b-%Y")
        print(f"[AutoPipeline-Sync] Scanning folders={folders_to_check} since {since_date}")

        all_uid_folder_pairs = []
        for folder in folders_to_check:
            try:
                st, _ = _imap_select(mail, folder)
                if st != "OK":
                    print(f"[AutoPipeline-Sync]   Folder {folder}: select failed (status={st})")
                    continue
                status, data = mail.uid("search", None, f"(SINCE {since_date})")
                if status == "OK" and data[0]:
                    uids = data[0].split()
                    print(f"[AutoPipeline-Sync]   Folder {folder}: {len(uids)} emails found")
                    for uid_bytes in uids:
                        all_uid_folder_pairs.append((uid_bytes, folder))
                else:
                    print(f"[AutoPipeline-Sync]   Folder {folder}: 0 emails")
            except Exception as e:
                print(f"[AutoPipeline-Sync]   Folder {folder}: ERROR: {e}")

        print(f"[AutoPipeline-Sync] Total emails to check: {len(all_uid_folder_pairs)}")

        sb = get_supabase()
        synced = 0
        already_known = 0
        skipped_no_user = 0
        new_job_ids = []

        for uid_bytes, folder in all_uid_folder_pairs:
            uid_str = uid_bytes.decode()
            dedup_key = f"{folder}:{uid_str}"

            existing = sb.table("raw_emails").select("id").eq("provider_message_id", dedup_key).execute()
            if existing.data:
                already_known += 1
                continue

            _imap_select(mail, folder)
            st, msg_data = mail.uid("fetch", uid_bytes, "(RFC822.HEADER)")
            if st != "OK" or not msg_data or not msg_data[0]:
                print(f"[AutoPipeline-Sync]   UID {uid_str}: fetch header failed (status={st})")
                continue

            header_bytes = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
            msg = email_mod.message_from_bytes(header_bytes)

            from_raw = _safe_decode_header(msg.get("From", ""))
            subject = _safe_decode_header(msg.get("Subject", ""))
            date_str = msg.get("Date", "")
            message_id_header = msg.get("Message-ID", "")

            received_at = None
            try:
                received_at = parsedate_to_datetime(date_str).isoformat()
            except Exception:
                pass

            # Extract sender email
            email_match = re.search(r"<([^>]+)>", from_raw)
            sender_email = (email_match.group(1) if email_match else from_raw).strip().lower()

            print(f"[AutoPipeline-Sync]   NEW email UID={uid_str} from={sender_email} subject={subject[:60]}")

            # ── Handle forwarded emails (From = inbound address) ──
            # When someone forwards to the inbound, Gmail may rewrite From
            # to the inbound address. We need to find the ORIGINAL sender.
            original_sender = None
            forwarded_subject = None
            if sender_email in INBOUND_ADDRESSES:
                print(f"[AutoPipeline-Sync]     Sender is inbound address ({sender_email}) — checking for forwarded sender...")
                try:
                    # Download full message to inspect body/headers
                    _imap_select(mail, folder)
                    st_full, full_data = mail.uid("fetch", uid_bytes, "(RFC822)")
                    if st_full == "OK" and full_data and full_data[0]:
                        full_bytes = full_data[0][1] if isinstance(full_data[0], tuple) else full_data[0]
                        full_msg = email_mod.message_from_bytes(full_bytes)

                        # Check headers: X-Forwarded-For, Reply-To, Return-Path
                        for hdr in ["X-Forwarded-For", "Reply-To", "Return-Path", "X-Original-Sender"]:
                            hdr_val = full_msg.get(hdr, "")
                            if hdr_val:
                                hm = re.search(r"[\w.+-]+@[\w.-]+", hdr_val)
                                if hm:
                                    candidate = hm.group(0).strip().lower()
                                    if candidate not in INBOUND_ADDRESSES:
                                        original_sender = candidate
                                        print(f"[AutoPipeline-Sync]     Found original sender via {hdr}: {original_sender}")
                                        break

                        # Check email body for forwarded message pattern
                        if not original_sender:
                            body_text = ""
                            for part in full_msg.walk():
                                ct = part.get_content_type()
                                if ct in ("text/plain", "text/html"):
                                    try:
                                        payload = part.get_payload(decode=True)
                                        if payload:
                                            body_text += payload.decode("utf-8", errors="replace")
                                    except Exception:
                                        pass

                            # Pattern: "From: Name <email>" or "From: email" in forwarded block
                            fwd_from = re.search(r"(?:From|De|Von):\s*(?:.*?<)?([\w.+-]+@[\w.-]+)", body_text)
                            if fwd_from:
                                candidate = fwd_from.group(1).strip().lower()
                                if candidate not in INBOUND_ADDRESSES:
                                    original_sender = candidate
                                    print(f"[AutoPipeline-Sync]     Found original sender in body: {original_sender}")

                            # Extract forwarded subject from body
                            if not subject:
                                fwd_subj = re.search(r"Subject:\s*(.+?)(?:\r?\n|$)", body_text)
                                if fwd_subj:
                                    forwarded_subject = fwd_subj.group(1).strip()[:200]
                                    print(f"[AutoPipeline-Sync]     Extracted forwarded subject: {forwarded_subject}")
                except Exception as fwd_err:
                    print(f"[AutoPipeline-Sync]     Error extracting forwarded sender: {fwd_err}")

            # ── If subject is STILL empty (e.g. Cloudflare Email Routing strips it),
            #    download full body and try to extract subject from forwarded block ──
            if not subject and not forwarded_subject and sender_email not in INBOUND_ADDRESSES:
                print(f"[AutoPipeline-Sync]     Subject is empty — downloading body to extract forwarded subject...")
                try:
                    _imap_select(mail, folder)
                    st_full2, full_data2 = mail.uid("fetch", uid_bytes, "(RFC822)")
                    if st_full2 == "OK" and full_data2 and full_data2[0]:
                        full_bytes2 = full_data2[0][1] if isinstance(full_data2[0], tuple) else full_data2[0]
                        full_msg2 = email_mod.message_from_bytes(full_bytes2)
                        body_text2 = ""
                        for part in full_msg2.walk():
                            ct = part.get_content_type()
                            if ct in ("text/plain", "text/html"):
                                try:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        body_text2 += payload.decode("utf-8", errors="replace")
                                except Exception:
                                    pass
                        # Try "Subject: ..." line in forwarded block
                        fwd_subj2 = re.search(r"Subject:\s*(.+?)(?:\r?\n|$)", body_text2)
                        if fwd_subj2:
                            subject = fwd_subj2.group(1).strip()[:200]
                            print(f"[AutoPipeline-Sync]     Extracted subject from body: {subject}")
                        # Fallback: use first attachment filename as subject hint
                        if not subject:
                            for part in full_msg2.walk():
                                fn = part.get_filename()
                                if fn:
                                    subject = f"OM: {fn}"
                                    print(f"[AutoPipeline-Sync]     Using attachment filename as subject: {subject}")
                                    break
                except Exception as subj_err:
                    print(f"[AutoPipeline-Sync]     Error extracting subject from body: {subj_err}")

            # Use original sender if found, otherwise keep header sender
            lookup_email = original_sender or sender_email
            if forwarded_subject and not subject:
                subject = forwarded_subject
            print(f"[AutoPipeline-Sync]     Lookup email for matching: {lookup_email}")

            # Match sender to user profile
            matched_user_id = None
            try:
                matched_user_id = _match_sender_to_user(sb, lookup_email)

                # If original sender didn't match but we have a forwarded email,
                # try the header sender too
                if not matched_user_id and original_sender and original_sender != sender_email:
                    matched_user_id = _match_sender_to_user(sb, sender_email)

                # LAST RESORT: If sender is the inbound address and we still
                # can't match, assign to the most recently active user
                if not matched_user_id and sender_email in INBOUND_ADDRESSES:
                    print(f"[AutoPipeline-Sync]     Trying last-resort: assign to most recent active user...")
                    try:
                        recent_job = sb.table("email_underwrite_jobs").select("user_id").order("created_at", desc=True).limit(1).execute()
                        if recent_job.data:
                            matched_user_id = recent_job.data[0]["user_id"]
                            print(f"[AutoPipeline-Sync]     ✅ Assigned to most recent user: {matched_user_id}")
                    except Exception:
                        pass

                if not matched_user_id:
                    broad = sb.table("profiles").select("id, email, email_aliases").execute()
                    all_emails = [(r.get("email",""), r.get("email_aliases",[])) for r in (broad.data or [])]
                    print(f"[AutoPipeline-Sync]     ❌ NO MATCH for lookup_email={lookup_email} sender={sender_email}")
                    print(f"[AutoPipeline-Sync]     Available profiles: {all_emails}")
            except Exception as e:
                log.warning("[AutoPipeline] Profile lookup failed for %s: %s", lookup_email, e)
                print(f"[AutoPipeline-Sync]     ❌ Profile lookup EXCEPTION: {e}")

            if not matched_user_id:
                skipped_no_user += 1
                print(f"[AutoPipeline-Sync]     SKIPPING — no user match for {sender_email}")
                continue

            # Create raw_email + job
            print(f"[AutoPipeline-Sync]     Creating raw_email + job for user={matched_user_id}")
            email_data = {
                "user_id": matched_user_id,
                "provider_message_id": dedup_key,
                "thread_id": message_id_header,
                "from_address": from_raw,
                "subject": subject,
                "snippet": "",
                "received_at": received_at,
                "raw_payload": {},
                "processed": False,
            }
            insert_result = sb.table("raw_emails").insert(email_data).execute()
            raw_email_id = (insert_result.data or [{}])[0].get("id")
            print(f"[AutoPipeline-Sync]     raw_email created: id={raw_email_id}")

            try:
                job_record = {
                    "user_id": matched_user_id,
                    "raw_email_id": raw_email_id,
                    "from_address": from_raw,
                    "to_address": None,
                    "subject": subject,
                    "thread_id": message_id_header,
                    "provider_message_id": dedup_key,
                    "attachments": [],
                    "status": "pending",
                }
                job_insert = sb.table("email_underwrite_jobs").insert(job_record).execute()
                job_id = (job_insert.data or [{}])[0].get("id")
                if job_id:
                    new_job_ids.append(job_id)
                    print(f"[AutoPipeline-Sync]     ✅ Job created: id={job_id}")
                else:
                    print(f"[AutoPipeline-Sync]     ⚠️ Job insert returned no id")
            except Exception as e:
                log.warning("[AutoPipeline] Failed to create job: %s", e)
                print(f"[AutoPipeline-Sync]     ❌ Failed to create job: {e}")

            synced += 1

        mail.logout()
        result = {
            "synced": synced,
            "already_known": already_known,
            "skipped_no_user": skipped_no_user,
            "new_job_ids": new_job_ids,
        }
        print(f"[AutoPipeline-Sync] ✅ Sync complete: synced={synced} already_known={already_known} skipped_no_user={skipped_no_user} new_jobs={len(new_job_ids)}")
        return result
    except Exception as e:
        try:
            mail.logout()
        except Exception:
            pass
        log.exception("[AutoPipeline] Sync error: %s", e)
        return {"error": str(e), "synced": 0, "new_job_ids": []}


def _process_and_parse_job(job_id: str) -> dict:
    """Full pipeline for one job: create deal stub → download attachment → parse OM.

    Returns a summary dict. Does NOT raise HTTPException.
    """
    sb = get_supabase()

    try:
        job_result = sb.table("email_underwrite_jobs").select("*").eq("id", job_id).single().execute()
        job = getattr(job_result, "data", None)
        if not job:
            return {"error": f"Job {job_id} not found"}

        user_id = job["user_id"]
        subject = job.get("subject") or "Email OM"
        from_addr = job.get("from_address") or "unknown"
        msg_id = job.get("provider_message_id")

        # Create deal stub
        deal_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        deal_record = {
            "deal_id": deal_id,
            "user_id": user_id,
            "address": subject or "Email OM (parsing...)",
            "units": None,
            "purchase_price": None,
            "deal_structure": "Email OM",
            "parsed_data": {"source": "email_underwrite", "status": "parsing", "email_from": from_addr, "email_subject": subject},
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
        sb.table("deals").insert(deal_record).execute()
        sb.table("email_underwrite_jobs").update(
            {"deal_id": deal_id, "status": "processing", "updated_at": now}
        ).eq("id", job_id).execute()

        log.info("[AutoPipeline] Created deal %s for job %s, downloading attachment...", deal_id, job_id)

        # Download attachment
        if not msg_id:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": "No provider_message_id", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"error": "No provider_message_id", "deal_id": deal_id}

        file_bytes, filename = _download_attachment_via_imap(msg_id)
        if not file_bytes:
            # No attachment — mark deal as needing manual upload
            sb.table("deals").update({
                "parsed_data": {"source": "email_underwrite", "status": "no_attachment", "email_from": from_addr, "email_subject": subject},
                "notes": f"No PDF/Excel attachment found. From: {from_addr}.",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("deal_id", deal_id).execute()
            sb.table("email_underwrite_jobs").update(
                {"status": "done", "error_message": "No attachment found", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"warning": "No attachment found", "deal_id": deal_id}

        log.info("[AutoPipeline] Downloaded %s (%d bytes), parsing with Claude Vision...", filename, len(file_bytes))

        # Parse with Claude Vision (same pipeline as /v2/deals/parse)
        from anthropic import Anthropic
        from v2_underwriter.routes import filter_pdf_pages_smart, _post_process_parsed_data

        ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
        ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"

        if not ANTHROPIC_API_KEY:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": "No Anthropic API key", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"error": "Anthropic API key not configured", "deal_id": deal_id}

        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

        ext = (os.path.splitext(filename)[1] if filename else ".pdf").lower()
        mime_map = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
        mime = mime_map.get(ext, "application/pdf")

        if mime == "application/pdf":
            try:
                images = filter_pdf_pages_smart(file_bytes, min_score=15, max_pages=15)
            except Exception:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, dpi=100, first_page=1, last_page=10)

            if not images:
                sb.table("email_underwrite_jobs").update(
                    {"status": "error", "error_message": "Could not extract PDF images", "updated_at": datetime.utcnow().isoformat()}
                ).eq("id", job_id).execute()
                return {"error": "Could not extract PDF images", "deal_id": deal_id}

            content_items = []
            for img in images:
                img_buf = io.BytesIO()
                if img.mode == "RGBA":
                    img = img.convert("RGB")
                img.save(img_buf, format="JPEG", quality=75, optimize=True)
                file_b64 = base64.b64encode(img_buf.getvalue()).decode("utf-8")
                content_items.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/jpeg", "data": file_b64},
                })
        else:
            file_b64 = base64.b64encode(file_bytes).decode("utf-8")
            content_items = [{"type": "image", "source": {"type": "base64", "media_type": mime, "data": file_b64}}]

        schema_block = '''Return JSON matching this schema:
{
  "property": {"property_name": "", "address": "", "city": "", "state": "", "zip": "", "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0, "property_type": "", "property_class": "", "parking_spaces": 0},
  "pricing_financing": {"price": 0, "price_per_unit": 0, "price_per_sf": 0, "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0, "term_years": 0, "amortization_years": 0},
  "pnl": {"gross_potential_rent": 0, "other_income": 0, "vacancy_rate": 0, "vacancy_amount": 0, "effective_gross_income": 0, "operating_expenses": 0, "operating_expenses_t12": 0, "operating_expenses_proforma": 0, "noi": 0, "noi_t12": 0, "noi_proforma": 0, "noi_stabilized": 0, "cap_rate": 0, "cap_rate_t12": 0, "cap_rate_proforma": 0, "expense_ratio": 0},
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "mix_pct": 0, "unit_sf": 0, "rent_current": 0, "rent_psf": 0, "rent_market": 0}],
  "broker_info": {"broker_name": "", "broker_company": "", "broker_phone": "", "broker_email": ""}
}
Return ONLY valid JSON, no markdown or explanation.'''

        content_items.append({
            "type": "text",
            "text": f"Extract ONLY numerical data from this real estate offering memorandum. Focus on property details, pricing/financing terms, income statements, expense breakdowns, underwriting assumptions, and unit mix.\n\n{schema_block}",
        })

        response = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": content_items}],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:].strip()

        parsed_data = json.loads(text)

        # Post-process to bridge expense/NOI fields
        try:
            parsed_data = _post_process_parsed_data(parsed_data)
        except Exception as e:
            log.warning("[AutoPipeline] Post-process failed (non-fatal): %s", e)

        # Update deal with full parsed data
        prop = parsed_data.get("property", {})
        pricing = parsed_data.get("pricing_financing", {})
        broker = parsed_data.get("broker_info", {})

        address = (
            prop.get("address")
            or ", ".join(filter(None, [prop.get("city"), prop.get("state")]))
            or subject or "Email OM"
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
            "updated_at": datetime.utcnow().isoformat(),
        }

        sb.table("deals").update(update_payload).eq("deal_id", deal_id).execute()

        # Mark job as done
        sb.table("email_underwrite_jobs").update(
            {"deal_id": deal_id, "status": "done", "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", job_id).execute()

        log.info("[AutoPipeline] ✅ Job %s completed — deal %s: %s", job_id, deal_id, address)
        return {"success": True, "deal_id": deal_id, "address": address}

    except Exception as e:
        log.exception("[AutoPipeline] Job %s failed: %s", job_id, e)
        try:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": str(e)[:500], "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
        except Exception:
            pass
        return {"error": str(e), "job_id": job_id}


def _reprocess_existing_job(job_id: str) -> dict:
    """Re-process a 'done' job whose deal has only metadata (no real parsed data).

    Unlike _process_and_parse_job, this uses the EXISTING deal_id and just
    re-downloads the attachment and runs Claude Vision parsing.
    """
    sb = get_supabase()

    try:
        job_result = sb.table("email_underwrite_jobs").select("*").eq("id", job_id).single().execute()
        job = getattr(job_result, "data", None)
        if not job:
            return {"error": f"Job {job_id} not found"}

        deal_id = job.get("deal_id")
        if not deal_id:
            return {"error": f"Job {job_id} has no deal_id"}

        msg_id = job.get("provider_message_id")
        from_addr = job.get("from_address") or "unknown"
        subject = job.get("subject") or "Email OM"

        # Mark job as processing
        now = datetime.utcnow().isoformat()
        sb.table("email_underwrite_jobs").update(
            {"status": "processing", "updated_at": now}
        ).eq("id", job_id).execute()

        if not msg_id:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": "No provider_message_id", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"error": "No provider_message_id", "deal_id": deal_id}

        print(f"[AutoPipeline-Reprocess] Downloading attachment for job {job_id}, msg_id={msg_id}")

        file_bytes = None
        filename = None

        # Webhook jobs: msg_id = "webhook:<actual-message-id>" — search IMAP by Message-ID header
        if msg_id.startswith("webhook:"):
            actual_message_id = msg_id[len("webhook:"):]
            print(f"[AutoPipeline-Reprocess] Webhook job — searching IMAP by Message-ID: {actual_message_id}")
            try:
                _mail = get_imap_connection()
                if _mail:
                    for _folder in ["INBOX", "[Gmail]/All Mail"]:
                        try:
                            st_sel, _ = _imap_select(_mail, _folder)
                            if st_sel != "OK":
                                continue
                            # Search by Message-ID header
                            st_s, s_data = _mail.uid("search", None, f'(HEADER Message-ID "{actual_message_id}")')
                            if st_s == "OK" and s_data[0]:
                                uids = s_data[0].split()
                                if uids:
                                    st_f, f_data = _mail.uid("fetch", uids[-1], "(RFC822)")
                                    if st_f == "OK" and f_data and f_data[0] and isinstance(f_data[0], tuple):
                                        _msg = email_mod.message_from_bytes(f_data[0][1])
                                        file_bytes, filename = _extract_attachment_from_msg(_msg)
                                        if file_bytes:
                                            print(f"[AutoPipeline-Reprocess] Found webhook email in {_folder}: {filename} ({len(file_bytes)} bytes)")
                                            break
                        except Exception as e:
                            print(f"[AutoPipeline-Reprocess] Error searching {_folder}: {e}")
                    try:
                        _mail.logout()
                    except Exception:
                        pass
            except Exception as e:
                print(f"[AutoPipeline-Reprocess] IMAP search failed: {e}")
        else:
            file_bytes, filename = _download_attachment_via_imap(msg_id)
        if not file_bytes:
            sb.table("deals").update({
                "parsed_data": {"source": "email_underwrite", "status": "no_attachment", "email_from": from_addr, "email_subject": subject},
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("deal_id", deal_id).execute()
            sb.table("email_underwrite_jobs").update(
                {"status": "done", "error_message": "No attachment found", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"warning": "No attachment found", "deal_id": deal_id}

        print(f"[AutoPipeline-Reprocess] Downloaded {filename} ({len(file_bytes)} bytes), parsing with Claude Vision...")

        # Parse with Claude Vision (same as _process_and_parse_job)
        from anthropic import Anthropic
        from v2_underwriter.routes import filter_pdf_pages_smart, _post_process_parsed_data

        ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
        ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"

        if not ANTHROPIC_API_KEY:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": "No Anthropic API key", "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
            return {"error": "Anthropic API key not configured", "deal_id": deal_id}

        anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

        ext = (os.path.splitext(filename)[1] if filename else ".pdf").lower()
        mime_map = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
        mime = mime_map.get(ext, "application/pdf")

        if mime == "application/pdf":
            try:
                images = filter_pdf_pages_smart(file_bytes, min_score=15, max_pages=15)
            except Exception:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, dpi=100, first_page=1, last_page=10)

            if not images:
                sb.table("email_underwrite_jobs").update(
                    {"status": "error", "error_message": "Could not extract PDF images", "updated_at": datetime.utcnow().isoformat()}
                ).eq("id", job_id).execute()
                return {"error": "Could not extract PDF images", "deal_id": deal_id}

            content_items = []
            for img in images:
                img_buf = io.BytesIO()
                if img.mode == "RGBA":
                    img = img.convert("RGB")
                img.save(img_buf, format="JPEG", quality=75, optimize=True)
                file_b64 = base64.b64encode(img_buf.getvalue()).decode("utf-8")
                content_items.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/jpeg", "data": file_b64},
                })
        else:
            file_b64 = base64.b64encode(file_bytes).decode("utf-8")
            content_items = [{"type": "image", "source": {"type": "base64", "media_type": mime, "data": file_b64}}]

        schema_block = '''Return JSON matching this schema:
{
  "property": {"property_name": "", "address": "", "city": "", "state": "", "zip": "", "units": 0, "year_built": 0, "rba_sqft": 0, "land_area_acres": 0, "property_type": "", "property_class": "", "parking_spaces": 0},
  "pricing_financing": {"price": 0, "price_per_unit": 0, "price_per_sf": 0, "loan_amount": 0, "down_payment": 0, "interest_rate": 0, "ltv": 0, "term_years": 0, "amortization_years": 0},
  "pnl": {"gross_potential_rent": 0, "other_income": 0, "vacancy_rate": 0, "vacancy_amount": 0, "effective_gross_income": 0, "operating_expenses": 0, "operating_expenses_t12": 0, "operating_expenses_proforma": 0, "noi": 0, "noi_t12": 0, "noi_proforma": 0, "noi_stabilized": 0, "cap_rate": 0, "cap_rate_t12": 0, "cap_rate_proforma": 0, "expense_ratio": 0},
  "expenses": {"taxes": 0, "insurance": 0, "utilities": 0, "repairs_maintenance": 0, "management": 0, "payroll": 0, "admin": 0, "marketing": 0, "other": 0, "total": 0},
  "underwriting": {"holding_period": 0, "exit_cap_rate": 0},
  "unit_mix": [{"type": "", "units": 0, "mix_pct": 0, "unit_sf": 0, "rent_current": 0, "rent_psf": 0, "rent_market": 0}],
  "broker_info": {"broker_name": "", "broker_company": "", "broker_phone": "", "broker_email": ""}
}
Return ONLY valid JSON, no markdown or explanation.'''

        content_items.append({
            "type": "text",
            "text": f"Extract ONLY numerical data from this real estate offering memorandum. Focus on property details, pricing/financing terms, income statements, expense breakdowns, underwriting assumptions, and unit mix.\n\n{schema_block}",
        })

        response = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": content_items}],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:].strip()

        parsed_data = json.loads(text)

        try:
            parsed_data = _post_process_parsed_data(parsed_data)
        except Exception as e:
            print(f"[AutoPipeline-Reprocess] Post-process failed (non-fatal): {e}")

        # Update deal with full parsed data
        prop = parsed_data.get("property", {})
        pricing = parsed_data.get("pricing_financing", {})
        broker = parsed_data.get("broker_info", {})

        address = (
            prop.get("address")
            or ", ".join(filter(None, [prop.get("city"), prop.get("state")]))
            or subject or "Email OM"
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
            "updated_at": datetime.utcnow().isoformat(),
        }

        sb.table("deals").update(update_payload).eq("deal_id", deal_id).execute()

        sb.table("email_underwrite_jobs").update(
            {"status": "done", "error_message": None, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", job_id).execute()

        print(f"[AutoPipeline-Reprocess] ✅ Job {job_id} completed — deal {deal_id}: {address}")
        return {"success": True, "deal_id": deal_id, "address": address}

    except Exception as e:
        print(f"[AutoPipeline-Reprocess] Job {job_id} failed: {e}")
        log.exception("[AutoPipeline-Reprocess] Job %s failed: %s", job_id, e)
        try:
            sb.table("email_underwrite_jobs").update(
                {"status": "error", "error_message": str(e)[:500], "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", job_id).execute()
        except Exception:
            pass
        return {"error": str(e), "job_id": job_id}


def _run_auto_pipeline():
    """Single run of the full pipeline: sync → auto-reset stuck → process → parse."""
    print("=" * 80)
    print(f"[AutoPipeline] ═══ Running auto-pipeline cycle at {datetime.utcnow().isoformat()} ═══")
    print("=" * 80)
    log.info("[AutoPipeline] Running auto-pipeline cycle...")

    # Step 0: Auto-reset stuck "processing" jobs older than 10 minutes (max 3 retries)
    try:
        sb0 = get_supabase()
        stuck = sb0.table("email_underwrite_jobs").select("id, updated_at, error_message").eq("status", "processing").execute()
        cutoff = datetime.utcnow() - timedelta(minutes=10)
        now_str = datetime.utcnow().isoformat()
        reset_count = 0
        for row in (stuck.data or []):
            try:
                updated = datetime.fromisoformat(row.get("updated_at", "2000-01-01").replace("Z", "+00:00").replace("+00:00", ""))
                if updated > cutoff:
                    continue
            except Exception:
                pass
            err_msg = row.get("error_message") or ""
            retry_count = err_msg.count("Auto-reset")
            if retry_count >= 3:
                sb0.table("email_underwrite_jobs").update({
                    "status": "error",
                    "error_message": f"Failed after {retry_count} retries. Last: {err_msg[:200]}",
                    "updated_at": now_str,
                }).eq("id", row["id"]).execute()
                print(f"[AutoPipeline] Job {row['id']} exceeded max retries — marked as error")
                continue
            sb0.table("email_underwrite_jobs").update({
                "status": "pending",
                "error_message": f"Auto-reset from processing at {now_str}" + (f" | {err_msg}" if err_msg else ""),
                "updated_at": now_str,
            }).eq("id", row["id"]).execute()
            reset_count += 1
        if reset_count:
            print(f"[AutoPipeline] Step 0: Auto-reset {reset_count} stuck processing jobs (>10 min)")
    except Exception as e:
        print(f"[AutoPipeline] Step 0 error: {e}")

    # Step 1: Sync inbox
    sync_result = _sync_inbox_core()
    new_jobs = sync_result.get("new_job_ids", [])
    print(f"[AutoPipeline] Sync done: synced={sync_result.get('synced', 0)} already_known={sync_result.get('already_known', 0)} skipped_no_user={sync_result.get('skipped_no_user', 0)} new_jobs={len(new_jobs)}")
    if sync_result.get("error"):
        print(f"[AutoPipeline] Sync ERROR: {sync_result['error']}")

    # Step 2: Pick up ALL pending jobs — both new (no deal_id) and reset ones (have deal_id)
    # Skip jobs that have been auto-reset 3+ times (they keep failing)
    try:
        sb = get_supabase()
        all_pending = sb.table("email_underwrite_jobs").select("id, deal_id, error_message").eq("status", "pending").limit(20).execute()
        pending_no_deal = []
        pending_with_deal = []
        for row in (all_pending.data or []):
            jid = row["id"]
            if jid in new_jobs:
                continue  # Already queued from sync
            # Skip jobs that have exceeded retry limit
            err_msg = row.get("error_message") or ""
            if err_msg.count("Auto-reset") >= 3:
                print(f"[AutoPipeline] Skipping job {jid} — exceeded retry limit ({err_msg[:80]})")
                # Mark as permanent error
                try:
                    sb.table("email_underwrite_jobs").update({
                        "status": "error",
                        "error_message": f"Failed after 3+ retries. {err_msg[:300]}",
                        "updated_at": datetime.utcnow().isoformat(),
                    }).eq("id", jid).execute()
                except Exception:
                    pass
                continue
            if row.get("deal_id"):
                pending_with_deal.append(jid)
            else:
                pending_no_deal.append(jid)
                new_jobs.append(jid)
        print(f"[AutoPipeline] Leftover pending jobs: {len(pending_no_deal)} new (no deal), {len(pending_with_deal)} with existing deals")
    except Exception as e:
        pending_with_deal = []
        print(f"[AutoPipeline] Failed to query pending jobs: {e}")

    # Step 2b: Pick up "done" jobs whose deals were never actually parsed
    # (created by the old process-pending endpoint with metadata-only stubs)
    reprocess_jobs = list(pending_with_deal)  # Include pending jobs that already have deals
    try:
        done_jobs = (
            sb.table("email_underwrite_jobs")
            .select("id, deal_id")
            .eq("status", "done")
            .not_.is_("deal_id", None)
            .limit(20)
            .execute()
        )
        for row in (done_jobs.data or []):
            deal_id = row["deal_id"]
            # Check if the deal has real parsed data
            try:
                deal_res = sb.table("deals").select("deal_id, parsed_data, units, purchase_price").eq("deal_id", deal_id).single().execute()
                deal = getattr(deal_res, "data", None)
            except Exception:
                deal = None
            if deal:
                pd = deal.get("parsed_data") or {}
                has_property = isinstance(pd.get("property"), dict) and pd["property"].get("address")
                has_units = deal.get("units") is not None
                if not has_property and not has_units:
                    # Deal was created with metadata only — needs full parsing
                    if row["id"] not in reprocess_jobs:
                        print(f"[AutoPipeline] Found unparsed done job {row['id']} (deal={deal_id}) — will reprocess")
                        reprocess_jobs.append(row["id"])
    except Exception as e:
        print(f"[AutoPipeline] Failed to check done-but-unparsed jobs: {e}")

    if not new_jobs and not reprocess_jobs:
        print("[AutoPipeline] No new jobs to process.")
        return

    print(f"[AutoPipeline] Processing {len(new_jobs)} new jobs + {len(reprocess_jobs)} reprocess jobs")

    # Step 3: Process each NEW job (create deal + download + parse)
    for job_id in new_jobs:
        try:
            print(f"[AutoPipeline] Processing NEW job {job_id}...")
            result = _process_and_parse_job(job_id)
            print(f"[AutoPipeline] Job {job_id} result: {result}")
        except Exception as e:
            print(f"[AutoPipeline] Unexpected error processing job {job_id}: {e}")
            log.exception("[AutoPipeline] Unexpected error processing job %s: %s", job_id, e)

    # Step 4: Reprocess jobs that have existing deals but need attachment parsing
    for job_id in reprocess_jobs:
        try:
            print(f"[AutoPipeline] Re-processing job with existing deal {job_id}...")
            result = _reprocess_existing_job(job_id)
            print(f"[AutoPipeline] Re-process job {job_id} result: {result}")
        except Exception as e:
            print(f"[AutoPipeline] Unexpected error re-processing job {job_id}: {e}")
            log.exception("[AutoPipeline] Unexpected error re-processing job %s: %s", job_id, e)


_last_run_time = None
_last_run_result = None


def _auto_pipeline_loop():
    """Background thread loop — runs the pipeline every N seconds."""
    global _last_run_time, _last_run_result
    log.info("[AutoPipeline] Background worker started (interval=%ds)", _AUTO_PIPELINE_INTERVAL)
    print("=" * 80)
    print(f"[AutoPipeline] ═══ Background worker STARTED (interval={_AUTO_PIPELINE_INTERVAL}s) ═══")
    print(f"[AutoPipeline] Inbound email: {INBOUND_EMAIL}")
    print(f"[AutoPipeline] IMAP transport configured: {bool(os.getenv('INBOUND_GMAIL_ADDRESS'))}")
    print(f"[AutoPipeline] INBOUND_GMAIL_APP_PASSWORD set: {bool(os.getenv('INBOUND_GMAIL_APP_PASSWORD'))}")
    print("=" * 80)

    # Wait 30 seconds on startup before first run (let the app fully initialize)
    print("[AutoPipeline] Waiting 30s for app to initialize...")
    time.sleep(30)
    print("[AutoPipeline] Initial wait complete, starting first cycle...")

    while True:
        try:
            print(f"[AutoPipeline] Starting pipeline cycle at {datetime.utcnow().isoformat()}")
            _run_auto_pipeline()
            _last_run_time = datetime.utcnow().isoformat()
            _last_run_result = "ok"
            print(f"[AutoPipeline] Cycle complete at {_last_run_time}")
        except Exception as e:
            _last_run_time = datetime.utcnow().isoformat()
            _last_run_result = str(e)
            log.exception("[AutoPipeline] Unhandled error in pipeline loop: %s", e)
            print(f"[AutoPipeline] ERROR: {e}")

        time.sleep(_AUTO_PIPELINE_INTERVAL)


_pipeline_thread = None


def start_auto_pipeline():
    """Start the background auto-pipeline thread (called from App.py startup)."""
    global _pipeline_thread
    if _pipeline_thread is not None and _pipeline_thread.is_alive():
        log.info("[AutoPipeline] Thread already running, skipping start.")
        return

    _pipeline_thread = threading.Thread(target=_auto_pipeline_loop, daemon=True, name="email-auto-pipeline")
    _pipeline_thread.start()
    log.info("[AutoPipeline] Background thread launched.")
    print("[AutoPipeline] Background thread launched.")


@router.get("/pipeline-status")
async def pipeline_status():
    """Check if the background auto-pipeline worker is running."""
    alive = _pipeline_thread is not None and _pipeline_thread.is_alive()
    return {
        "running": alive,
        "interval_seconds": _AUTO_PIPELINE_INTERVAL,
        "last_run_time": _last_run_time,
        "last_run_result": _last_run_result,
    }


# ── Async result storage for non-blocking endpoints ──
_debug_result: Optional[dict] = None
_debug_running: bool = False
_sync_result: Optional[dict] = None
_sync_running: bool = False


def _run_debug_pipeline_bg():
    """Run full diagnostic in background thread, store result."""
    global _debug_result, _debug_running
    _debug_running = True
    try:
        debug_log = []

        def dbg(msg):
            debug_log.append(msg)
            print(f"[DEBUG-PIPELINE] {msg}")

        addr = os.getenv("INBOUND_GMAIL_ADDRESS")
        pwd = os.getenv("INBOUND_GMAIL_APP_PASSWORD")
        dbg(f"Inbound email: {INBOUND_EMAIL}")
        dbg(f"IMAP transport (Gmail) configured: {bool(addr)}")
        dbg(f"IMAP password set: {bool(pwd)} (length: {len(pwd) if pwd else 0})")

        if not addr or not pwd:
            dbg("IMAP credentials missing — pipeline CANNOT work!")
            _debug_result = {"status": "error", "reason": "IMAP credentials not configured", "log": debug_log}
            return

        try:
            import imaplib
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(addr, pwd)
            dbg("IMAP login successful")
        except Exception as e:
            dbg(f"IMAP login FAILED: {e}")
            _debug_result = {"status": "error", "reason": f"IMAP login failed: {e}", "log": debug_log}
            return

        folders_to_check = ["INBOX", "[Gmail]/All Mail", "[Gmail]/Spam"]
        since_date = (datetime.utcnow() - timedelta(days=14)).strftime("%d-%b-%Y")
        all_emails = []

        for folder in folders_to_check:
            try:
                quoted_folder = f'"{folder}"'
                st, _ = mail.select(quoted_folder)
                if st != "OK":
                    dbg(f"  Folder {folder}: could not select (status={st})")
                    continue
                status, data = mail.uid("search", None, f"(SINCE {since_date})")
                if status == "OK" and data[0]:
                    uids = data[0].split()
                    dbg(f"  Folder {folder}: {len(uids)} emails since {since_date}")
                    for uid_bytes in uids:
                        uid_str = uid_bytes.decode()
                        dedup_key = f"{folder}:{uid_str}"
                        try:
                            mail.select(quoted_folder)
                            st2, msg_data = mail.uid("fetch", uid_bytes, "(RFC822.HEADER)")
                            if st2 == "OK" and msg_data and msg_data[0]:
                                header_bytes = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
                                msg = email_mod.message_from_bytes(header_bytes)
                                from_raw = _safe_decode_header(msg.get("From", ""))
                                subject = _safe_decode_header(msg.get("Subject", ""))
                                date_str = msg.get("Date", "")
                                email_match = re.search(r"<([^>]+)>", from_raw)
                                sender_email = (email_match.group(1) if email_match else from_raw).strip().lower()
                                all_emails.append({
                                    "folder": folder, "uid": uid_str, "dedup_key": dedup_key,
                                    "from": from_raw, "sender_email": sender_email,
                                    "subject": subject, "date": date_str,
                                })
                                dbg(f"    UID {uid_str}: from={sender_email} subject={subject[:60]}")
                        except Exception as e:
                            dbg(f"    UID {uid_str}: fetch error: {e}")
                else:
                    dbg(f"  Folder {folder}: 0 emails since {since_date}")
            except Exception as e:
                dbg(f"  Folder {folder}: error: {e}")

        try:
            mail.logout()
        except Exception:
            pass

        dbg(f"Total emails found in last 14 days: {len(all_emails)}")

        sb = get_supabase()
        new_emails, known_emails = [], []
        for em in all_emails:
            try:
                existing = sb.table("raw_emails").select("id").eq("provider_message_id", em["dedup_key"]).execute()
                if existing.data:
                    known_emails.append(em)
                else:
                    new_emails.append(em)
            except Exception as e:
                dbg(f"  Dedup check error for {em['dedup_key']}: {e}")

        dbg(f"Already known (deduplicated): {len(known_emails)}")
        dbg(f"NEW emails to process: {len(new_emails)}")

        matched_emails, unmatched_emails = [], []
        for em in new_emails:
            sender = em["sender_email"]
            matched_user_id = None
            match_method = None
            try:
                res = sb.table("profiles").select("id, email").ilike("email", sender).execute()
                if res.data:
                    matched_user_id = res.data[0]["id"]
                    match_method = "profiles.email"
                else:
                    try:
                        alias_res = sb.table("profiles").select("id").contains("email_aliases", [sender]).execute()
                        if alias_res.data:
                            matched_user_id = alias_res.data[0]["id"]
                            match_method = "email_aliases"
                    except Exception:
                        pass
                if not matched_user_id:
                    broad = sb.table("profiles").select("id, email, email_aliases").execute()
                    for row in (broad.data or []):
                        row_email = (row.get("email") or "").strip().lower()
                        row_aliases = [a.strip().lower() for a in (row.get("email_aliases") or []) if a]
                        if row_email == sender or sender in row_aliases:
                            matched_user_id = row["id"]
                            match_method = "broad_scan"
                            break
                    if not matched_user_id:
                        dbg(f"  No profile match for sender: {sender}")
                        unmatched_emails.append(em)
            except Exception as e:
                dbg(f"  Profile lookup error for {sender}: {e}")
                unmatched_emails.append(em)
                continue
            if matched_user_id:
                dbg(f"  Sender {sender} -> user {matched_user_id} (via {match_method})")
                em["matched_user_id"] = matched_user_id
                em["match_method"] = match_method
                matched_emails.append(em)

        try:
            all_jobs = sb.table("email_underwrite_jobs").select("id, status, from_address, subject, created_at, deal_id, error_message").order("created_at", desc=True).limit(20).execute()
            recent_jobs = all_jobs.data or []
            dbg(f"Recent jobs in DB: {len(recent_jobs)}")
            for j in recent_jobs:
                dbg(f"  Job {j['id'][:8]}...: status={j['status']} from={j.get('from_address','')} subject={j.get('subject','')[:40]} error={j.get('error_message','')}")
        except Exception as e:
            recent_jobs = []
            dbg(f"Failed to query jobs: {e}")

        _debug_result = {
            "status": "ok",
            "imap_connected": True,
            "total_emails_14d": len(all_emails),
            "already_known": len(known_emails),
            "new_unprocessed": len(new_emails),
            "matched_to_user": len(matched_emails),
            "unmatched_no_user": len(unmatched_emails),
            "matched_details": matched_emails,
            "unmatched_details": unmatched_emails,
            "recent_jobs": recent_jobs,
            "log": debug_log,
        }
    except Exception as e:
        _debug_result = {"status": "error", "reason": str(e), "log": []}
    finally:
        _debug_running = False


@router.get("/debug-pipeline")
async def debug_pipeline():
    """Kick off diagnostics in background, return immediately.
    Poll GET /debug-pipeline/result to get the results.
    """
    global _debug_result, _debug_running
    if _debug_running:
        return {"status": "running", "message": "Diagnostics already in progress. Poll /debug-pipeline/result"}
    _debug_result = None
    t = threading.Thread(target=_run_debug_pipeline_bg, daemon=True, name="debug-pipeline-bg")
    t.start()
    return {"status": "started", "message": "Diagnostics started. Poll /debug-pipeline/result in a few seconds."}


@router.get("/debug-pipeline/result")
async def debug_pipeline_result():
    """Poll for debug-pipeline results."""
    if _debug_running:
        return {"status": "running", "message": "Still running..."}
    if _debug_result is None:
        return {"status": "not_started", "message": "No diagnostics have been run yet. Call GET /debug-pipeline first."}
    return _debug_result


def _run_force_sync_bg():
    """Run full sync + process cycle in background thread.

    Steps:
    1. Sync inbox (IMAP scan, create raw_emails + jobs for NEW emails)
    2. Reset stuck "processing" jobs → pending
    3. Find orphaned raw_emails (no job) and create jobs for them
    4. Process all pending jobs
    """
    global _sync_result, _sync_running
    _sync_running = True
    try:
        sb = get_supabase()

        # ── Step 1: IMAP sync ──
        print("[FORCE-SYNC-BG] Step 1: Starting inbox sync...")
        sync_result = _sync_inbox_core()
        new_jobs = list(sync_result.get("new_job_ids", []))
        print(f"[FORCE-SYNC-BG] Sync complete: synced={sync_result.get('synced',0)}, already_known={sync_result.get('already_known',0)}")

        # ── Step 2: Auto-reset stuck "processing" jobs (older than 10 min, max 3 retries) ──
        reset_count = 0
        skipped_max_retries = 0
        try:
            stuck = sb.table("email_underwrite_jobs").select("id, updated_at, error_message").eq("status", "processing").execute()
            now_str = datetime.utcnow().isoformat()
            cutoff = datetime.utcnow() - timedelta(minutes=10)
            for row in (stuck.data or []):
                # Only reset if stuck for >10 minutes
                try:
                    updated = datetime.fromisoformat(row.get("updated_at", "2000-01-01").replace("Z", "+00:00").replace("+00:00", ""))
                    if updated > cutoff:
                        continue  # Still recent — let it finish
                except Exception:
                    pass  # Bad date — reset it
                # Check retry count (count 'Auto-reset' occurrences in error_message)
                err_msg = row.get("error_message") or ""
                retry_count = err_msg.count("Auto-reset")
                if retry_count >= 3:
                    # Max retries reached — mark as permanent error
                    sb.table("email_underwrite_jobs").update({
                        "status": "error",
                        "error_message": f"Failed after {retry_count} retries. Last: {err_msg[:200]}",
                        "updated_at": now_str,
                    }).eq("id", row["id"]).execute()
                    skipped_max_retries += 1
                    continue
                sb.table("email_underwrite_jobs").update({
                    "status": "pending",
                    "error_message": f"Auto-reset from processing at {now_str}" + (f" | {err_msg}" if err_msg else ""),
                    "updated_at": now_str,
                }).eq("id", row["id"]).execute()
                reset_count += 1
            if reset_count or skipped_max_retries:
                print(f"[FORCE-SYNC-BG] Step 2: Reset {reset_count} stuck jobs, {skipped_max_retries} exceeded max retries")
        except Exception as e:
            print(f"[FORCE-SYNC-BG] Step 2 error resetting stuck jobs: {e}")

        # ── Step 3: Find orphaned raw_emails without jobs ──
        orphan_count = 0
        try:
            # Get all raw_emails
            all_raw = sb.table("raw_emails").select("id, user_id, from_address, subject, provider_message_id, thread_id").order("created_at", desc=True).limit(50).execute()
            # Get all job raw_email_ids
            all_jobs_raw = sb.table("email_underwrite_jobs").select("raw_email_id").execute()
            job_raw_ids = set(r["raw_email_id"] for r in (all_jobs_raw.data or []) if r.get("raw_email_id"))

            for raw in (all_raw.data or []):
                raw_id = raw["id"]
                if raw_id in job_raw_ids:
                    continue  # already has a job
                # This raw_email has no job — create one
                user_id = raw.get("user_id")
                if not user_id:
                    # Try to match from the most recent user
                    recent = sb.table("email_underwrite_jobs").select("user_id").order("created_at", desc=True).limit(1).execute()
                    user_id = (recent.data[0]["user_id"] if recent.data else None)
                if not user_id:
                    print(f"[FORCE-SYNC-BG] Step 3: Orphan raw_email {raw_id} has no user_id — skipping")
                    continue
                try:
                    job_record = {
                        "user_id": user_id,
                        "raw_email_id": raw_id,
                        "from_address": raw.get("from_address", ""),
                        "to_address": None,
                        "subject": raw.get("subject", ""),
                        "thread_id": raw.get("thread_id", ""),
                        "provider_message_id": raw.get("provider_message_id", ""),
                        "attachments": [],
                        "status": "pending",
                    }
                    ins = sb.table("email_underwrite_jobs").insert(job_record).execute()
                    jid = (ins.data or [{}])[0].get("id")
                    if jid:
                        new_jobs.append(jid)
                        orphan_count += 1
                        print(f"[FORCE-SYNC-BG] Step 3: Created job {jid} for orphan raw_email {raw_id}")
                except Exception as e:
                    print(f"[FORCE-SYNC-BG] Step 3: Failed to create job for orphan {raw_id}: {e}")
            if orphan_count:
                print(f"[FORCE-SYNC-BG] Step 3: Created {orphan_count} jobs for orphaned raw_emails")
            else:
                print(f"[FORCE-SYNC-BG] Step 3: No orphaned raw_emails found")
        except Exception as e:
            print(f"[FORCE-SYNC-BG] Step 3 error finding orphans: {e}")

        # ── Step 4: Gather ALL pending jobs and process ──
        reprocess_jobs = []
        try:
            all_pending = sb.table("email_underwrite_jobs").select("id, deal_id").eq("status", "pending").limit(30).execute()
            for row in (all_pending.data or []):
                jid = row["id"]
                if jid in new_jobs:
                    continue
                if row.get("deal_id"):
                    reprocess_jobs.append(jid)
                else:
                    new_jobs.append(jid)
        except Exception as e:
            print(f"[FORCE-SYNC-BG] Step 4: Failed to query pending jobs: {e}")

        total = len(new_jobs) + len(reprocess_jobs)
        print(f"[FORCE-SYNC-BG] Step 4: {len(new_jobs)} new + {len(reprocess_jobs)} reprocess = {total} total jobs to process")

        processed = 0
        errors = 0
        for job_id in new_jobs:
            try:
                print(f"[FORCE-SYNC-BG] Processing NEW job {job_id}...")
                result = _process_and_parse_job(job_id)
                print(f"[FORCE-SYNC-BG] Job {job_id} result: {result}")
                processed += 1
            except Exception as e:
                print(f"[FORCE-SYNC-BG] Job {job_id} FAILED: {e}")
                errors += 1
        for job_id in reprocess_jobs:
            try:
                print(f"[FORCE-SYNC-BG] Re-processing job {job_id}...")
                result = _reprocess_existing_job(job_id)
                print(f"[FORCE-SYNC-BG] Reprocess {job_id} result: {result}")
                processed += 1
            except Exception as e:
                print(f"[FORCE-SYNC-BG] Reprocess {job_id} FAILED: {e}")
                errors += 1

        _sync_result = {
            "status": "done",
            "sync": sync_result,
            "reset_stuck": reset_count,
            "orphans_created": orphan_count,
            "jobs_total": total,
            "jobs_processed": processed,
            "jobs_errors": errors,
            "new_job_ids": new_jobs,
            "reprocess_job_ids": reprocess_jobs,
            "finished_at": datetime.utcnow().isoformat(),
        }
        print(f"[FORCE-SYNC-BG] Complete: reset={reset_count}, orphans={orphan_count}, processed={processed}, errors={errors}")
    except Exception as e:
        print(f"[FORCE-SYNC-BG] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        _sync_result = {"status": "error", "error": str(e), "finished_at": datetime.utcnow().isoformat()}
    finally:
        _sync_running = False


@router.post("/force-sync")
async def force_sync_pipeline():
    """Kick off sync + process in background. Returns immediately.
    Poll GET /force-sync/result to check progress.
    """
    global _sync_result, _sync_running
    if _sync_running:
        return {"status": "running", "message": "Sync already in progress. Poll /force-sync/result"}
    _sync_result = None
    print("[FORCE-SYNC] Launching background sync+process thread...")
    t = threading.Thread(target=_run_force_sync_bg, daemon=True, name="force-sync-bg")
    t.start()
    return {"status": "started", "message": "Sync started in background. Poll /force-sync/result for progress."}


@router.get("/force-sync/result")
async def force_sync_result():
    """Poll for force-sync results."""
    if _sync_running:
        return {"status": "running", "message": "Still syncing and processing..."}
    if _sync_result is None:
        return {"status": "not_started", "message": "No sync has been run. Call POST /force-sync first."}
    return _sync_result


@router.post("/reset-stuck-jobs")
async def reset_stuck_jobs():
    """Reset jobs stuck in 'processing' status back to 'pending'.

    Only resets jobs that have been processing for >10 minutes.
    Caps retries at 3 — after that, marks as permanent 'error'.
    """
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    cutoff = datetime.utcnow() - timedelta(minutes=10)

    # Find stuck processing jobs (older than 10 minutes)
    stuck = sb.table("email_underwrite_jobs").select("id, status, error_message, updated_at").eq("status", "processing").execute()
    reset_count = 0
    skipped_recent = 0
    failed_max_retries = 0
    for row in (stuck.data or []):
        # Time check: only reset if stuck >10 minutes
        try:
            updated = datetime.fromisoformat(row.get("updated_at", "2000-01-01").replace("Z", "+00:00").replace("+00:00", ""))
            if updated > cutoff:
                skipped_recent += 1
                continue
        except Exception:
            pass
        # Retry limit: count previous 'Auto-reset' resets
        err_msg = row.get("error_message") or ""
        retry_count = err_msg.count("Auto-reset")
        if retry_count >= 3:
            sb.table("email_underwrite_jobs").update({
                "status": "error",
                "error_message": f"Failed after {retry_count} retries. Last: {err_msg[:200]}",
                "updated_at": now,
            }).eq("id", row["id"]).execute()
            failed_max_retries += 1
            continue
        sb.table("email_underwrite_jobs").update({
            "status": "pending",
            "error_message": f"Auto-reset from processing at {now}" + (f" | {err_msg}" if err_msg else ""),
            "updated_at": now,
        }).eq("id", row["id"]).execute()
        reset_count += 1

    return {
        "reset_count": reset_count,
        "skipped_recent": skipped_recent,
        "failed_max_retries": failed_max_retries,
        "message": f"Reset {reset_count} stuck jobs, {skipped_recent} still recent, {failed_max_retries} exceeded max retries",
    }