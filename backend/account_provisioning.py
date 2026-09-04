"""
Server-side Supabase account provisioning for paying Stripe customers.

Why this exists
---------------
The original email/password signup flow created the Supabase auth user in the
BROWSER, on /payment-success, *after* Stripe Checkout had already created a
trialing subscription. Anything that interrupted that page (closed tab, API
down, a different browser than the one that started signup, a Supabase
signUp error, ...) left Stripe with a live subscription and Supabase with no
user at all. The trial then converted into a real charge for someone who
could never log in.

Every path that learns "this email has paid" now funnels through
`ensure_paid_account()` so the invariant holds from the server side:

    Stripe has a live subscription for <email>
        =>  a Supabase auth user + profiles row exists for <email>,
            stamped with the Stripe customer/subscription ids.

Callers:
  - App.py  /api/create-checkout-session  (account-first: user is created
    BEFORE the Stripe session, so the webhook's user_id branch handles it)
  - App.py  /api/complete-signup          (sets the password after checkout
    for sessions created without a user_id, replacing the client-side signUp)
  - stripe_webhook_handler.py             (safety net on checkout completion,
    trial_will_end and invoice.payment_succeeded)
  - scripts/reconcile_stripe_accounts.py  (backfill for already-affected
    customers)
"""

import logging
import os
import secrets
from datetime import datetime
from typing import Optional

from supabase import Client

log = logging.getLogger("account_provisioning")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
PROFILE_FIELDS = ("first_name", "last_name", "phone", "company", "title", "city", "state")


class AccountExistsError(Exception):
    """The email already belongs to an account that has been signed into.

    Raised when a caller wants to *set a password* for an email whose account
    has already been used — that would be an account takeover vector (pay for
    a checkout with someone else's email, then set their password), so the
    caller must tell the person to sign in / reset their password instead.
    """


def _norm_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


def _auth_error_says_exists(err: Exception) -> bool:
    msg = str(err).lower()
    return "already" in msg and ("registered" in msg or "exists" in msg)


# ----------------------------------------------------------------------------
# Lookup
# ----------------------------------------------------------------------------

def find_user_id_by_email(supabase: Client, email: str) -> Optional[str]:
    """Return the auth user id for `email`, or None.

    Checks the profiles table first (every auth user gets a row via the
    on_auth_user_created trigger), then falls back to paging the auth admin
    user list in case the profile row is missing or has a stale email.
    """
    email = _norm_email(email)
    if not email:
        return None

    try:
        rows = (
            supabase.table("profiles").select("id").ilike("email", email).limit(1).execute().data
        ) or []
        if rows:
            return rows[0]["id"]
    except Exception as e:
        log.warning("[PROVISION] profiles lookup failed for %s: %s", email, e)

    try:
        page = 1
        while True:
            users = supabase.auth.admin.list_users(page=page, per_page=1000) or []
            for u in users:
                if _norm_email(getattr(u, "email", None)) == email:
                    return u.id
            if len(users) < 1000:
                return None
            page += 1
    except Exception as e:
        log.warning("[PROVISION] auth user list lookup failed for %s: %s", email, e)
    return None


def get_auth_user(supabase: Client, user_id: str):
    try:
        res = supabase.auth.admin.get_user_by_id(user_id)
        return getattr(res, "user", None)
    except Exception as e:
        log.warning("[PROVISION] get_user_by_id(%s) failed: %s", user_id, e)
        return None


def user_has_signed_in(user) -> bool:
    return bool(getattr(user, "last_sign_in_at", None))


# ----------------------------------------------------------------------------
# Creation
# ----------------------------------------------------------------------------

def ensure_auth_user(
    supabase: Client,
    email: str,
    password: Optional[str] = None,
    user_metadata: Optional[dict] = None,
    provisioned_by: str = "server",
) -> tuple[str, bool]:
    """Find-or-create the auth user for `email`. Returns (user_id, created).

    The user is created with email already confirmed (they've proven the
    address to Stripe and a confirmation email would only be another step
    that can silently fail). When no password is given a random one is set;
    the person then sets their own via the set-password email.
    """
    email = _norm_email(email)
    if not email:
        raise ValueError("email is required")

    existing = find_user_id_by_email(supabase, email)
    if existing:
        return existing, False

    meta = {k: v for k, v in (user_metadata or {}).items() if v not in (None, "")}
    meta["provisioned_by"] = provisioned_by
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password or secrets.token_urlsafe(32),
            "email_confirm": True,
            "user_metadata": meta,
        })
        user = getattr(res, "user", None)
        if not user:
            raise RuntimeError("create_user returned no user")
        log.info("[PROVISION] Created auth user %s for %s (by %s)", user.id, email, provisioned_by)
        return user.id, True
    except Exception as e:
        if _auth_error_says_exists(e):
            # Lost a race with another creator (webhook vs. checkout page).
            existing = find_user_id_by_email(supabase, email)
            if existing:
                return existing, False
        raise


def verify_password(email: str, password: str) -> bool:
    """True if `password` is the current password for `email`.

    Uses a throwaway client so the resulting user session never leaks onto
    the service-role client used for admin calls.
    """
    from supabase import create_client
    url = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return False
    try:
        tmp = create_client(url, key)
        res = tmp.auth.sign_in_with_password({"email": _norm_email(email), "password": password})
        ok = bool(getattr(res, "user", None))
        try:
            tmp.auth.sign_out()
        except Exception:
            pass
        return ok
    except Exception:
        return False


def set_user_password(supabase: Client, user_id: str, password: str, user_metadata: Optional[dict] = None):
    attrs = {"password": password, "email_confirm": True}
    if user_metadata:
        attrs["user_metadata"] = user_metadata
    supabase.auth.admin.update_user_by_id(user_id, attrs)


def send_set_password_email(supabase: Client, email: str) -> bool:
    """Email the person a link to choose their password (Supabase recovery
    flow, landing on /set-password). Best effort — never raises."""
    try:
        supabase.auth.reset_password_for_email(
            _norm_email(email),
            {"redirect_to": f"{FRONTEND_URL.rstrip('/')}/set-password"},
        )
        log.info("[PROVISION] Sent set-password email to %s", email)
        return True
    except Exception as e:
        log.error("[PROVISION] Could not send set-password email to %s: %s", email, e)
        return False


# ----------------------------------------------------------------------------
# The invariant
# ----------------------------------------------------------------------------

def stamp_profile(
    supabase: Client,
    user_id: str,
    *,
    email: Optional[str] = None,
    customer_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    sub_status: Optional[str] = None,
    trial_ends_at: Optional[str] = None,
    plan: str = "standard",
    monthly_tokens: Optional[int] = None,
    profile_fields: Optional[dict] = None,
):
    """Upsert the profiles row with Stripe ids (and, on first creation, the
    signup form fields). Never lowers an existing token balance."""
    row = {"id": user_id}
    if email:
        row["email"] = _norm_email(email)
    if customer_id:
        row["stripe_customer_id"] = customer_id
    if subscription_id:
        row["stripe_subscription_id"] = subscription_id
    if sub_status:
        row["subscription_status"] = sub_status
    if trial_ends_at:
        row["trial_ends_at"] = trial_ends_at
    if plan:
        row["subscription_tier"] = plan
    if monthly_tokens is not None:
        row["monthly_token_limit"] = monthly_tokens
    for k in PROFILE_FIELDS:
        v = (profile_fields or {}).get(k)
        if v:
            row[k] = v

    supabase.table("profiles").upsert(row, on_conflict="id").execute()

    if monthly_tokens is not None:
        # Only grant the month's tokens if the balance is below it (idempotent
        # across webhook retries / reconcile runs).
        try:
            cur = supabase.table("profiles").select("token_balance").eq("id", user_id).single().execute().data or {}
            if (cur.get("token_balance") or 0) < monthly_tokens:
                supabase.table("profiles").update({"token_balance": monthly_tokens}).eq("id", user_id).execute()
        except Exception as e:
            log.warning("[PROVISION] token grant check failed for %s: %s", user_id, e)


def ensure_paid_account(
    supabase: Client,
    *,
    email: str,
    customer_id: Optional[str],
    subscription_id: Optional[str],
    sub_status: Optional[str],
    trial_end_ts: Optional[int] = None,
    metadata: Optional[dict] = None,
    plan: str = "standard",
    monthly_tokens: Optional[int] = None,
    provisioned_by: str = "server",
    notify_if_created: bool = True,
) -> tuple[str, bool]:
    """Guarantee a Supabase account exists for a paying Stripe customer.

    Returns (user_id, created). When the account had to be created here the
    person gets a set-password email so they can actually log in.
    """
    email = _norm_email(email)
    metadata = metadata or {}
    user_meta = {k: metadata.get(k) for k in PROFILE_FIELDS}

    user_id, created = ensure_auth_user(
        supabase, email, user_metadata=user_meta, provisioned_by=provisioned_by
    )

    trial_ends_at = datetime.fromtimestamp(trial_end_ts).isoformat() if trial_end_ts else None
    stamp_profile(
        supabase, user_id,
        email=email,
        customer_id=customer_id,
        subscription_id=subscription_id,
        sub_status=sub_status,
        trial_ends_at=trial_ends_at,
        plan=plan,
        monthly_tokens=monthly_tokens,
        profile_fields=user_meta,
    )

    if created:
        log.warning(
            "[PROVISION] Paying customer %s (stripe customer %s) had NO Supabase account — "
            "created %s via %s", email, customer_id, user_id, provisioned_by
        )
        if notify_if_created:
            send_set_password_email(supabase, email)

    return user_id, created
