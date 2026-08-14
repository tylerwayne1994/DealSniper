"""
Gmail OAuth connect + send-on-behalf-of-user integration.

Lets a user connect their own Gmail account (separate from Supabase login)
so the app can send drafted emails (LOI/due-diligence findings/etc.) FROM
their real Gmail address instead of just showing text to copy-paste.

Uses a real user-consent OAuth2 flow (Authorization Code grant) with the
`gmail.send` scope — NOT the service-account flow used by
google_sheets_updater.py (a service account can't send as an individual
Gmail user without Workspace domain-wide delegation, which regular Gmail
accounts don't have).

Reuses the existing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI
env vars (already configured in render.yaml for an older, unfinished Sheets
OAuth flow) and the `email_integrations` table (backend/migrations/
create_email_deals_tables.sql — must already be run in Supabase; this module
only ever touches the `provider='gmail'` rows in it).
"""

import base64
import logging
import os
from email.mime.text import MIMEText
from typing import Optional

# Google often echoes back extra/reordered scopes (or, since this client_id
# has been used for other flows, previously-granted ones like calendar/drive)
# in the token response. oauthlib treats any mismatch from the requested
# scopes as a hard error by default -- relax that so it doesn't block connect.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

import token_manager

logger = logging.getLogger("gmail_integration")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

# Least-privilege: only what's needed to send mail + identify the connected address.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
]


def _client_config():
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def build_auth_url(user_id: str) -> str:
    """Start the OAuth consent flow for connecting a user's Gmail. `state` carries the user_id through the redirect."""
    # PKCE disabled: this library auto-generates a code_verifier per Flow
    # instance, but build_auth_url() and exchange_code_for_tokens() run in
    # two separate HTTP requests (separate Flow instances) with nothing
    # persisting the verifier between them -- Google then rejects the token
    # exchange with "invalid_grant: Missing code verifier". PKCE exists to
    # protect public clients that can't hold a secret; this is a confidential
    # server-side client (has GOOGLE_CLIENT_SECRET), so the standard
    # Authorization Code flow without PKCE is correct and simpler here.
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=GOOGLE_REDIRECT_URI, autogenerate_code_verifier=False)
    auth_url, _ = flow.authorization_url(
        access_type="offline",       # required to get a refresh_token
        prompt="consent",            # forces refresh_token on repeat connects too
        state=user_id,
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange the OAuth authorization code for access/refresh tokens."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=GOOGLE_REDIRECT_URI, autogenerate_code_verifier=False)
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry.isoformat() if creds.expiry else None,
    }


def store_tokens(user_id: str, access_token: str, refresh_token: Optional[str], expires_at: Optional[str]):
    supabase = token_manager.get_supabase()
    row = {
        "user_id": user_id,
        "provider": "gmail",
        "access_token": access_token,
        "status": "active",
    }
    if refresh_token:
        row["refresh_token"] = refresh_token
    if expires_at:
        row["expires_at"] = expires_at
    supabase.table("email_integrations").upsert(row, on_conflict="user_id,provider").execute()


def _load_credentials(user_id: str) -> Optional[Credentials]:
    supabase = token_manager.get_supabase()
    resp = (
        supabase.table("email_integrations")
        .select("access_token, refresh_token, expires_at, status")
        .eq("user_id", user_id)
        .eq("provider", "gmail")
        .maybe_single()
        .execute()
    )
    row = resp.data
    if not row or row.get("status") != "active" or not row.get("access_token"):
        return None

    creds = Credentials(
        token=row["access_token"],
        refresh_token=row.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleAuthRequest())
            store_tokens(user_id, creds.token, creds.refresh_token, creds.expiry.isoformat() if creds.expiry else None)
        except Exception as e:
            logger.warning("[gmail] Token refresh failed for user %s: %s", user_id, e)
            supabase.table("email_integrations").update({"status": "error"}).eq("user_id", user_id).eq("provider", "gmail").execute()
            return None

    return creds


def get_status(user_id: str) -> dict:
    creds = _load_credentials(user_id)
    if not creds:
        return {"connected": False, "email": None}
    try:
        service = build("gmail", "v1", credentials=creds)
        profile = service.users().getProfile(userId="me").execute()
        return {"connected": True, "email": profile.get("emailAddress")}
    except Exception as e:
        logger.warning("[gmail] Status check failed for user %s: %s", user_id, e)
        return {"connected": False, "email": None}


def disconnect(user_id: str):
    supabase = token_manager.get_supabase()
    supabase.table("email_integrations").update({"status": "revoked"}).eq("user_id", user_id).eq("provider", "gmail").execute()


def send_email(user_id: str, to_email: str, subject: str, body_text: str) -> dict:
    """Send an email FROM the connected user's own Gmail address. Raises RuntimeError with a clear message on failure."""
    creds = _load_credentials(user_id)
    if not creds:
        raise RuntimeError("Gmail is not connected for this account.")
    if not to_email:
        raise RuntimeError("No recipient email address provided.")

    service = build("gmail", "v1", credentials=creds)
    message = MIMEText(body_text)
    message["to"] = to_email
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {"id": sent.get("id")}
