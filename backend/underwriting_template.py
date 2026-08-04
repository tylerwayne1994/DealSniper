"""
Underwriting Templates — Backend API

Lets a sponsor upload their own .xlsx underwriting model and use it (instead
of the built-in stock template) as the base workbook for the Underwriting
Model tab on the Results page. One template per user — uploading a new file
replaces the previous one. Sponsor-authed via X-User-ID (same pattern as
investor_access.py / deal_room_layout.py).
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, UploadFile, File

log = logging.getLogger("underwriting_template")
router = APIRouter(prefix="/api/underwriting-template", tags=["UnderwritingTemplate"])

BUCKET = "underwriting-templates"
ALLOWED_EXTENSIONS = (".xlsx", ".xls", ".xlsm")


def _get_sb():
    from token_manager import get_supabase
    return get_supabase()


def _get_user_id(request: Request) -> str:
    uid = request.headers.get("X-User-ID")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def _ensure_bucket(sb):
    try:
        existing_buckets = sb.storage.list_buckets()
        bucket_names = [b.name if hasattr(b, 'name') else b.get('name', '') for b in existing_buckets]
        if BUCKET not in bucket_names:
            sb.storage.create_bucket(BUCKET, options={"public": True})
    except Exception as e:
        log.warning("[UnderwritingTemplate] Bucket check warning: %s", e)


@router.get("")
async def get_my_template(request: Request):
    """Returns the caller's saved template, or null if they haven't uploaded one."""
    uid = _get_user_id(request)
    sb = _get_sb()
    res = sb.table("underwriting_templates").select("*").eq("user_id", uid).execute()
    row = (res.data or [None])[0]
    return {"template": row}


@router.post("")
async def upload_my_template(request: Request, file: UploadFile = File(...)):
    """Upload (or replace) the caller's default underwriting template."""
    uid = _get_user_id(request)
    if not file.filename or not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Please upload a .xlsx, .xls, or .xlsm file")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds the 20MB limit")

    sb = _get_sb()
    _ensure_bucket(sb)

    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in file.filename)
    storage_path = f"{uid}/{safe_name}"

    try:
        # Remove any previous file at this exact path first (upsert avoids a
        # stale-file conflict if the sponsor re-uploads the same filename).
        sb.storage.from_(BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"upsert": "true"},
        )
        public_url = sb.storage.from_(BUCKET).get_public_url(storage_path)

        row = {
            "user_id": uid,
            "file_name": file.filename,
            "storage_path": storage_path,
            "public_url": public_url,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = sb.table("underwriting_templates").select("id, storage_path").eq("user_id", uid).execute()
        if existing.data:
            old_path = existing.data[0].get("storage_path")
            if old_path and old_path != storage_path:
                try:
                    sb.storage.from_(BUCKET).remove([old_path])
                except Exception:
                    pass
            res = sb.table("underwriting_templates").update(row).eq("user_id", uid).execute()
        else:
            res = sb.table("underwriting_templates").insert(row).execute()
    except Exception as e:
        log.exception("[UnderwritingTemplate] Upload failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save template")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save template")
    return {"template": res.data[0]}


@router.delete("")
async def delete_my_template(request: Request):
    """Remove the caller's saved template — reverts to the stock template."""
    uid = _get_user_id(request)
    sb = _get_sb()
    existing = sb.table("underwriting_templates").select("id, storage_path").eq("user_id", uid).execute()
    if not existing.data:
        return {"deleted": False}
    row = existing.data[0]
    try:
        if row.get("storage_path"):
            sb.storage.from_(BUCKET).remove([row["storage_path"]])
    except Exception as e:
        log.warning("[UnderwritingTemplate] Storage remove warning: %s", e)
    sb.table("underwriting_templates").delete().eq("user_id", uid).execute()
    return {"deleted": True}
