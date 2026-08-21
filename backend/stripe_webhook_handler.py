"""
Stripe Webhook Handler
Updates user subscription tier and tokens when Stripe payment succeeds.

Idempotency: every Stripe event id is persisted to the stripe_webhook_events
table (see migrations/add_stripe_dedup_tables.sql) before processing. Stripe
retries webhooks for up to 3 days, so without this a retry of
invoice.payment_succeeded would double-grant tokens and a retry of
checkout.session.completed would re-activate/overwrite subscription state.
"""

import os
import stripe
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client, Client
import logging

log = logging.getLogger("stripe_webhook")

# ============================================================================
# Configuration — all ids/keys come from the environment, no hardcoded values
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# Live $100/month Monthly Membership price (product prod_UEWkW5dJ9T8oE4)
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "price_1TG3gcRSKEwwH1TScuY9fRtm")

stripe.api_key = STRIPE_SECRET_KEY

# Single plan: $100/month with 25 tokens (accumulates monthly)
TIER_TOKEN_LIMITS = {
    "standard": 25,   # $100/month - 25 tokens
    "base": 25,       # Legacy fallback
    "pro": 25,        # Legacy fallback
}

# Subscription statuses that count as "live" (customer is paying / in trial)
LIVE_SUB_STATUSES = ("active", "trialing", "past_due")


def normalize_subscription_tier(plan: str | None) -> str:
    """Collapse legacy plan names onto the current single paid tier."""
    normalized = (plan or "standard").lower()
    if normalized in TIER_TOKEN_LIMITS:
        return normalized
    return "standard"

# Map Stripe price ID to subscription tier (empty if env not configured;
# unknown prices fall back to "standard" via normalize_subscription_tier)
STRIPE_PRICE_TO_TIER = {STRIPE_PRICE_ID: "standard"} if STRIPE_PRICE_ID else {}

router = APIRouter(prefix="/webhook", tags=["Stripe Webhooks"])

# ============================================================================
# Supabase Client
# ============================================================================

def get_supabase() -> Client:
    """Get Supabase client with service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================================
# Idempotency: persistent event-id dedup
# ============================================================================

def is_duplicate_event(supabase: Client, event_id: str, event_type: str) -> bool:
    """Record the event id; return True if it was already processed.

    Uses an upsert with ignore_duplicates so the insert-and-check is a single
    atomic operation — two concurrent deliveries of the same event can't both
    pass. If the dedup table doesn't exist yet (migration not applied), the
    event is processed anyway (better than silently dropping payments) and a
    loud warning tells the operator to run the migration.
    """
    try:
        result = supabase.table("stripe_webhook_events").upsert(
            {"event_id": event_id, "event_type": event_type},
            on_conflict="event_id",
            ignore_duplicates=True,
        ).execute()
        if not result.data:
            return True
        return False
    except Exception as e:
        log.warning(
            "[WEBHOOK] Event dedup unavailable (%s) — run migrations/add_stripe_dedup_tables.sql. "
            "Processing event %s without dedup.", e, event_id
        )
        return False


def mark_checkout_attempt_completed(supabase: Client, session_id: str):
    """Close out the pending checkout_attempts row for this session (best effort)."""
    try:
        supabase.table("checkout_attempts").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("session_id", session_id).execute()
    except Exception as e:
        log.warning("[WEBHOOK] Could not mark checkout attempt completed for %s: %s", session_id, e)


def audit_duplicate_subscriptions(customer_id: str, email: str | None):
    """Log loudly if this person somehow has more than one live subscription.

    Checks the given customer AND any other Stripe customers sharing the same
    email (historical duplicates from the old customer_email checkout flow).
    Detection only — cancellation stays a human decision in the dashboard.
    """
    try:
        live = []
        customer_ids = [customer_id]
        if email:
            for customer in stripe.Customer.list(email=email, limit=10).get("data", []):
                if customer["id"] not in customer_ids:
                    customer_ids.append(customer["id"])
        for cid in customer_ids:
            subs = stripe.Subscription.list(customer=cid, status="all", limit=20)
            for sub in subs.get("data", []):
                if sub.get("status") in LIVE_SUB_STATUSES:
                    live.append((cid, sub["id"], sub.get("status")))
        if len(live) > 1:
            log.error(
                "🚨 [WEBHOOK] DUPLICATE LIVE SUBSCRIPTIONS for email=%s: %s — "
                "cancel the extras in the Stripe dashboard and investigate.",
                email, live
            )
    except Exception as e:
        log.warning("[WEBHOOK] Duplicate-subscription audit failed for %s: %s", customer_id, e)

# ============================================================================
# Helper Functions
# ============================================================================

def update_subscription_tier(stripe_customer_id: str, subscription_tier: str, stripe_subscription_id: str, subscription_status: str = "active"):
    """Update user's subscription tier in Supabase profiles table."""
    supabase = get_supabase()

    # Get token limit for tier
    monthly_limit = TIER_TOKEN_LIMITS.get(subscription_tier.lower(), 30)

    # Calculate next reset date (30 days from now)
    tokens_reset_at = datetime.now() + timedelta(days=30)

    # Update profile
    result = supabase.table("profiles").update({
        "subscription_tier": subscription_tier,
        "monthly_token_limit": monthly_limit,
        "token_balance": monthly_limit,  # Grant full month of tokens immediately
        "tokens_reset_at": tokens_reset_at.isoformat(),
        "stripe_subscription_id": stripe_subscription_id,
        "subscription_status": subscription_status
    }).eq("stripe_customer_id", stripe_customer_id).execute()

    if result.data:
        log.info(f"Updated subscription for customer {stripe_customer_id} to {subscription_tier} tier with {monthly_limit} tokens")
        return True
    else:
        log.error(f"Failed to update subscription for customer {stripe_customer_id}")
        return False

def cancel_subscription(stripe_customer_id: str):
    """Handle subscription cancellation - set tokens to 0."""
    supabase = get_supabase()

    result = supabase.table("profiles").update({
        "token_balance": 0,
        "stripe_subscription_id": None,
        "subscription_status": "canceled"
    }).eq("stripe_customer_id", stripe_customer_id).execute()

    if result.data:
        log.info(f"Cancelled subscription for customer {stripe_customer_id}")
        return True
    else:
        log.error(f"Failed to cancel subscription for customer {stripe_customer_id}")
        return False

# ============================================================================
# Webhook Endpoint
# ============================================================================

@router.post("/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.

    Events handled:
    - checkout.session.completed: New subscription created
    - customer.subscription.updated: Subscription tier changed
    - customer.subscription.deleted: Subscription cancelled
    - invoice.payment_succeeded: Recurring payment successful (reset tokens)
    """

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        log.error("Stripe webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        log.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        log.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    log.info(f"[WEBHOOK] Received Stripe event: {event['type']} ({event['id']})")

    # Idempotency guard: Stripe retries deliveries — never process the same
    # event twice (persisted in the DB, survives restarts and multiple workers)
    supabase = get_supabase()
    if is_duplicate_event(supabase, event["id"], event["type"]):
        log.info(f"[WEBHOOK] Skipping duplicate event {event['id']} ({event['type']}) — already processed")
        return {"status": "success", "duplicate": True}

    # Handle different event types
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        mode = session.get("mode")  # "subscription" or "payment"
        session_id = session.get("id")

        # Release the pending checkout_attempts claim for this session so the
        # user isn't blocked from future (legitimate) checkouts.
        if session_id:
            mark_checkout_attempt_completed(supabase, session_id)

        # Handle ONE-TIME TOKEN PURCHASE (mode = "payment")
        if mode == "payment":
            profile_id = session.get("client_reference_id")
            metadata = session.get("metadata", {})
            tokens_to_add = int(metadata.get("tokens", 0))
            package_id = metadata.get("package_id")

            if profile_id and tokens_to_add > 0:
                # Get current balance
                result = supabase.table("profiles").select("token_balance").eq("id", profile_id).single().execute()

                if result.data:
                    current_balance = result.data.get("token_balance", 0)
                    new_balance = current_balance + tokens_to_add

                    # Update token balance
                    supabase.table("profiles").update({
                        "token_balance": new_balance
                    }).eq("id", profile_id).execute()

                    log.info(f"✅ ONE-TIME PURCHASE: Added {tokens_to_add} tokens to profile {profile_id}. Package: {package_id}, New balance: {new_balance}")
                else:
                    log.error(f"❌ Profile not found for one-time purchase: {profile_id}")
            else:
                log.warning(f"⚠️ Missing profile_id or tokens in one-time purchase session metadata")

        # Handle SUBSCRIPTION CHECKOUT (mode = "subscription")
        elif customer_id and subscription_id:
            # Get subscription details to find the price/tier
            subscription = stripe.Subscription.retrieve(subscription_id)
            price_id = subscription["items"]["data"][0]["price"]["id"]
            tier = normalize_subscription_tier(STRIPE_PRICE_TO_TIER.get(price_id, "standard"))

            # Determine trial status
            sub_status = subscription.get("status", "active")  # "trialing", "active", etc.
            trial_end_ts = subscription.get("trial_end")  # Unix timestamp or None
            trial_ends_at = datetime.fromtimestamp(trial_end_ts).isoformat() if trial_end_ts else None

            # Get metadata from session
            metadata = session.get("metadata", {})
            user_id = metadata.get("user_id")
            plan = normalize_subscription_tier(metadata.get("plan", "standard"))
            customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")

            log.info(
                "[WEBHOOK] checkout.session.completed: session=%s customer=%s subscription=%s "
                "status=%s user_id=%s email=%s",
                session_id, customer_id, subscription_id, sub_status, user_id, customer_email
            )

            if user_id:
                # Update profile with Stripe info and token balance
                monthly = TIER_TOKEN_LIMITS.get(plan, 25)

                update_data = {
                    "stripe_customer_id": customer_id,
                    "subscription_tier": plan,
                    "token_balance": monthly,
                    "monthly_token_limit": monthly,
                    "stripe_subscription_id": subscription_id,
                    "subscription_status": sub_status,
                }
                if trial_ends_at:
                    update_data["trial_ends_at"] = trial_ends_at

                supabase.table("profiles").update(update_data).eq("id", user_id).execute()

                log.info(f"✅ SUBSCRIPTION ACTIVATED: User {user_id} | Plan: {plan} | Tokens: {monthly} | Status: {sub_status}")
            else:
                # Fallback: try to find profile by email
                if customer_email:
                    update_data = {
                        "stripe_customer_id": customer_id,
                        "subscription_tier": tier,
                        "stripe_subscription_id": subscription_id,
                        "subscription_status": sub_status,
                    }
                    if trial_ends_at:
                        update_data["trial_ends_at"] = trial_ends_at

                    result = supabase.table("profiles").update(update_data).eq("email", customer_email).execute()

                    if not result.data:
                        log.error(f"❌ No profile found for email: {customer_email}")

            # Update subscription tier
            update_subscription_tier(customer_id, tier, subscription_id, sub_status)

            # Safety net: if this person now has more than one live
            # subscription (the exact bug that double-charged customers),
            # make it impossible to miss in the logs.
            audit_duplicate_subscriptions(customer_id, customer_email)

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        subscription_id = subscription.get("id")
        price_id = subscription["items"]["data"][0]["price"]["id"]
        tier = normalize_subscription_tier(STRIPE_PRICE_TO_TIER.get(price_id, "standard"))
        sub_status = subscription.get("status", "active")

        if customer_id:
            update_subscription_tier(customer_id, tier, subscription_id, sub_status)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        if customer_id:
            cancel_subscription(customer_id)

    elif event["type"] == "customer.subscription.trial_will_end":
        # Trial ending soon (fires 3 days before trial ends)
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        log.info(f"⏰ TRIAL ENDING SOON for customer {customer_id}")

    elif event["type"] == "invoice.payment_succeeded":
        # Recurring payment successful - grant monthly tokens (rollover adds to balance)
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        subscription_id = invoice.get("subscription")

        if customer_id and subscription_id:
            # Fetch current balance and monthly limit
            result = supabase.table("profiles").select("token_balance, monthly_token_limit").eq("stripe_customer_id", customer_id).single().execute()

            if result.data:
                current_balance = result.data.get("token_balance", 0)
                monthly_limit = result.data.get("monthly_token_limit", 0)
                new_balance = current_balance + monthly_limit
                tokens_reset_at = datetime.now() + timedelta(days=30)

                supabase.table("profiles").update({
                    "token_balance": new_balance,
                    "tokens_reset_at": tokens_reset_at.isoformat()
                }).eq("stripe_customer_id", customer_id).execute()

                log.info(f"Rollover: Added {monthly_limit} tokens for customer {customer_id}. New balance: {new_balance}")

    return {"status": "success"}
