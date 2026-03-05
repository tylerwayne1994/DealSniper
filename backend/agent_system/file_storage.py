# ============================================================================
# Agent System — File Storage Abstraction
# Configurable backend: "supabase" (default) or "local".
# Set FILE_STORAGE_BACKEND env var to switch.
# ============================================================================

import os
import io
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

log = logging.getLogger("agent_system.file_storage")

# Storage backend: "supabase" | "local"
STORAGE_BACKEND = os.getenv("FILE_STORAGE_BACKEND", "supabase")
LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", str(Path(__file__).resolve().parents[1] / "data" / "agent_files"))
SUPABASE_AGENT_BUCKET = os.getenv("AGENT_STORAGE_BUCKET", "agent-files")


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Supabase credentials not configured")
    return create_client(url, key)


def _ensure_supabase_bucket(sb):
    """Create the agent-files bucket if it doesn't exist yet."""
    try:
        sb.storage.get_bucket(SUPABASE_AGENT_BUCKET)
    except Exception:
        try:
            sb.storage.create_bucket(SUPABASE_AGENT_BUCKET, options={"public": False})
            log.info("Created storage bucket: %s", SUPABASE_AGENT_BUCKET)
        except Exception as e:
            # Bucket might already exist — not fatal
            log.warning("Bucket creation note: %s", e)


def save_file(user_id: str, filename: str, file_bytes: bytes,
              content_type: str = "application/pdf") -> str:
    """
    Save a file to storage under the user's directory.
    Returns the storage path (or public URL for Supabase).
    """
    # Path scoped to user: <user_id>/<filename>
    storage_path = f"{user_id}/{filename}"

    if STORAGE_BACKEND == "local":
        return _save_local(storage_path, file_bytes)
    else:
        return _save_supabase(storage_path, file_bytes, content_type)


def get_file_url(storage_path: str) -> Optional[str]:
    """Get a URL/path for a previously stored file."""
    if STORAGE_BACKEND == "local":
        full = Path(LOCAL_STORAGE_DIR) / storage_path
        return str(full) if full.exists() else None
    else:
        sb = _get_supabase()
        try:
            # Create a signed URL valid for 1 hour
            result = sb.storage.from_(SUPABASE_AGENT_BUCKET).create_signed_url(
                storage_path, 3600
            )
            return result.get("signedURL") or result.get("signedUrl")
        except Exception as e:
            log.error("Error getting signed URL: %s", e)
            return None


# ---- Supabase backend ----

def _save_supabase(storage_path: str, file_bytes: bytes, content_type: str) -> str:
    sb = _get_supabase()
    _ensure_supabase_bucket(sb)
    try:
        sb.storage.from_(SUPABASE_AGENT_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        log.info("Uploaded %s to Supabase bucket %s", storage_path, SUPABASE_AGENT_BUCKET)
    except Exception as e:
        log.error("Supabase upload error: %s", e)
        raise
    return storage_path


# ---- Local backend ----

def _save_local(storage_path: str, file_bytes: bytes) -> str:
    full = Path(LOCAL_STORAGE_DIR) / storage_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(file_bytes)
    log.info("Saved file locally: %s", full)
    return str(full)
