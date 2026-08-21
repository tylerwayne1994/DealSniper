"""
Token Purchase Handler
Handles one-time token purchases (not subscriptions).

Duplicate protection: every checkout-session create call carries a stable
idempotency key (profile + package + the client's per-page checkout intent
id), so double-clicks and network retries replay the original session instead
of creating a second one. Crediting happens in stripe_webhook_handler.py's
checkout.session.completed branch, which is deduplicated by Stripe event id.
"""

import os
import time
import stripe
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client, Client
from pydantic import BaseModel
import logging

log = logging.getLogger("token_purchase")

# ============================================================================
# Configuration — all ids/keys come from the environment, no hardcoded values
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

stripe.api_key = STRIPE_SECRET_KEY

# Token packages: $30 for 65 tokens, bought from inside an existing account.
# The fallback is the confirmed LIVE price id for that package; env var wins
# if set. The amount lives on the Stripe price object itself.
TOKEN_PACKAGES = {
    "65_tokens": {
        "tokens": 65,
        "stripe_price": os.getenv("STRIPE_TOKEN_PRICE_65", "price_1TG3jvRSKEwwH1TS0OCQdJvW"),
    },
}

router = APIRouter(prefix="/api", tags=["Token Purchase"])

# ============================================================================
# Pydantic Models
# ============================================================================

class CreditTokensRequest(BaseModel):
    profile_id: str
    tokens: int

# ============================================================================
# Supabase Client
# ============================================================================

def get_supabase() -> Client:
    """Get Supabase client with service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================================
# Token Purchase Endpoints
# ============================================================================

@router.post("/create-token-checkout")
async def create_token_checkout(request: Request):
    """
    Create a Stripe checkout session for one-time token purchase.

    Expected payload:
    {
        "package": "65_tokens",
        "email": "user@example.com",
        "profile_id": "uuid-from-supabase",
        "checkout_intent_id": "uuid generated once per page load (optional)"
    }
    """
    data = await request.json()
    package_id = data.get("package")
    email = data.get("email")
    profile_id = data.get("profile_id")
    # Generated once per page mount by the frontend: double-clicks and retries
    # reuse the same intent (→ same idempotency key → same session), while a
    # fresh page visit gets a new intent and can legitimately buy again.
    checkout_intent_id = data.get("checkout_intent_id")

    if not package_id or not email or not profile_id:
        raise HTTPException(status_code=400, detail="Missing required fields: package, email, or profile_id")

    if package_id not in TOKEN_PACKAGES:
        raise HTTPException(status_code=400, detail=f"Invalid package. Must be one of: {list(TOKEN_PACKAGES.keys())}")

    package_info = TOKEN_PACKAGES[package_id]
    if not package_info.get("stripe_price"):
        log.error("[TOKEN CHECKOUT] Stripe price id for package %s is not configured (STRIPE_TOKEN_PRICE_65)", package_id)
        raise HTTPException(status_code=500, detail="Token package price is not configured")

    # Stable idempotency key: who + what + intent. Fallback (older clients
    # that don't send an intent) uses a 10-minute time bucket, which still
    # blocks rapid duplicate submissions deterministically.
    if checkout_intent_id:
        idempotency_key = f"token-checkout:{profile_id}:{package_id}:{checkout_intent_id}"
    else:
        idempotency_key = f"token-checkout:{profile_id}:{package_id}:tb{int(time.time() // 600)}"

    log.info("[TOKEN CHECKOUT] Requested: profile=%s package=%s intent=%s", profile_id, package_id, checkout_intent_id or "-")

    try:
        # Create Stripe checkout session (amount/product come from the Stripe
        # price object — nothing hardcoded here)
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": package_info["stripe_price"],
                "quantity": 1,
            }],
            mode="payment",  # One-time payment, not subscription
            customer_email=email,
            client_reference_id=profile_id,  # Store profile_id to identify user after payment
            metadata={
                "package_id": package_id,
                "tokens": package_info["tokens"],
                "profile_id": profile_id
            },
            success_url=os.getenv("FRONTEND_URL", "http://localhost:3000") + "/dashboard?payment_success=true&tokens=" + str(package_info["tokens"]),
            cancel_url=os.getenv("FRONTEND_URL", "http://localhost:3000") + "/dashboard?payment_canceled=true",
            idempotency_key=idempotency_key,
        )

        log.info(
            "[TOKEN CHECKOUT] Created session %s for %s (package %s, idempotency_key=%s)",
            checkout_session.id, email, package_id, idempotency_key
        )
        return {"url": checkout_session.url, "session_id": checkout_session.id}

    except Exception as e:
        log.error(f"[TOKEN CHECKOUT] Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.post("/credit-tokens")
async def credit_tokens(data: CreditTokensRequest):
    """
    Credit tokens to a user's account.
    This is called after successful payment.

    For local testing, can also be called manually with:
    POST /api/credit-tokens
    Body: {"profile_id": "uuid", "tokens": 14}
    """
    profile_id = data.profile_id
    tokens = data.tokens

    log.info(f"Attempting to credit {tokens} tokens to profile {profile_id}")

    if not profile_id or not tokens:
        raise HTTPException(status_code=400, detail="Missing profile_id or tokens")

    supabase = get_supabase()

    try:
        # Get current token balance
        result = supabase.table("profiles").select("token_balance").eq("id", profile_id).single().execute()

        if not result.data:
            log.error(f"Profile not found: {profile_id}")
            raise HTTPException(status_code=404, detail="Profile not found")

        current_balance = result.data.get("token_balance", 0)
        new_balance = current_balance + tokens

        log.info(f"Current balance: {current_balance}, New balance will be: {new_balance}")

        # Update token balance
        update_result = supabase.table("profiles").update({
            "token_balance": new_balance
        }).eq("id", profile_id).execute()

        if update_result.data:
            log.info(f"✅ Successfully credited {tokens} tokens to profile {profile_id}. New balance: {new_balance}")
            return {
                "success": True,
                "previous_balance": current_balance,
                "tokens_added": tokens,
                "new_balance": new_balance
            }
        else:
            log.error(f"Failed to update token balance for profile {profile_id}")
            raise HTTPException(status_code=500, detail="Failed to update token balance")

    except Exception as e:
        log.error(f"Error crediting tokens: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
