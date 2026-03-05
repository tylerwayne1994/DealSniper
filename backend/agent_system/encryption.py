# ============================================================================
# Agent System — Credential Encryption
# Encrypts / decrypts platform credentials using Fernet (AES-128-CBC).
# The key is loaded from the AGENT_ENCRYPTION_KEY environment variable.
# ============================================================================

import os
import base64
import hashlib
import logging
from typing import Dict, Any

from cryptography.fernet import Fernet
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

log = logging.getLogger("agent_system.encryption")


def _get_fernet() -> Fernet:
    """
    Build a Fernet instance from the AGENT_ENCRYPTION_KEY env var.
    The env var can be any string — we derive a proper 32-byte key via SHA-256
    then base64-encode it so Fernet accepts it.
    """
    raw_key = os.getenv("AGENT_ENCRYPTION_KEY", "")
    if not raw_key:
        raise RuntimeError("AGENT_ENCRYPTION_KEY environment variable is not set")
    # Derive a URL-safe base64-encoded 32-byte key from the raw secret
    digest = hashlib.sha256(raw_key.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_credentials(credentials: Dict[str, Any]) -> str:
    """
    Encrypt a dict of credentials into a single Fernet token string.
    Input example: {"username": "x", "password": "y"}
    Returns a base64 token string safe for database storage.
    """
    import json
    f = _get_fernet()
    plaintext = json.dumps(credentials).encode("utf-8")
    return f.encrypt(plaintext).decode("utf-8")


def decrypt_credentials(token: str) -> Dict[str, Any]:
    """
    Decrypt a Fernet token string back to the original credentials dict.
    """
    import json
    f = _get_fernet()
    plaintext = f.decrypt(token.encode("utf-8"))
    return json.loads(plaintext.decode("utf-8"))


def encrypt_platform_list(platforms: list) -> list:
    """
    Encrypt credentials for each platform entry.
    Input: [{"platform_id": "crexi", "username": "x", "password": "y"}, ...]
    Returns the same list but with username/password replaced by an encrypted token.
    """
    log.info("[DEBUG] Encrypting %d platform credentials", len(platforms))
    encrypted = []
    for p in platforms:
        pid = p["platform_id"]
        has_user = bool(p.get("username"))
        has_pass = bool(p.get("password"))
        log.info("[DEBUG] Encrypting %s — has_username=%s has_password=%s", pid, has_user, has_pass)
        creds = {"username": p.get("username", ""), "password": p.get("password", "")}
        encrypted.append({
            "platform_id": pid,
            "encrypted_credentials": encrypt_credentials(creds),
        })
    log.info("[DEBUG] All %d platforms encrypted successfully", len(encrypted))
    return encrypted


def decrypt_platform_list(platforms: list) -> list:
    """
    Decrypt credentials for each platform entry.
    Returns list with username/password in plaintext (for agent use only).
    """
    log.info("[DEBUG] Decrypting %d platform credentials", len(platforms))
    decrypted = []
    for p in platforms:
        pid = p.get("platform_id", "unknown")
        token = p.get("encrypted_credentials", "")
        if token:
            log.info("[DEBUG] Decrypting %s — token length=%d", pid, len(token))
            creds = decrypt_credentials(token)
            log.info("[DEBUG] Decrypted %s — has_username=%s has_password=%s",
                     pid, bool(creds.get('username')), bool(creds.get('password')))
        else:
            log.warning("[DEBUG] No encrypted token for %s — credentials will be empty", pid)
            creds = {"username": "", "password": ""}
        decrypted.append({
            "platform_id": pid,
            "username": creds.get("username", ""),
            "password": creds.get("password", ""),
        })
    return decrypted
