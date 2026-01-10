"""
Stripe Webhook Handler
Updates user subscription tier and tokens when Stripe payment succeeds
"""

import os
import stripe
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, HTTPException
from supabase import create_client, Client
import logging

log = logging.getLogger("stripe_webhook")

# ============================================================================
# Configuration
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

stripe.api_key = STRIPE_SECRET_KEY

# Subscription tier token limits
TIER_TOKEN_LIMITS = {
    "base": 25,   # $39.99/month - 25 tokens
    "pro": 55,    # $49.99/month - 55 tokens
}

# Map Stripe price IDs to subscription tiers
# These should match the PRICE_ID_BASE and PRICE_ID_PRO in App.py
# Update in your .env file or here directly with your Stripe Dashboard price IDs
STRIPE_PRICE_TO_TIER = {
    os.getenv("PRICE_ID_BASE", "price_1SfA11RRD0SJQZk3dTP5HIHa"): "base",     # Base plan ($39.99/25 tokens)
    os.getenv("PRICE_ID_PRO", "price_1SfA2SRRD0SJQZk3q6Zujrw0"): "pro",       # Pro plan ($49.99/55 tokens)
}

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
# Helper Functions
# ============================================================================

def update_subscription_tier(stripe_customer_id: str, subscription_tier: str, stripe_subscription_id: str):
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
        "stripe_subscription_id": stripe_subscription_id
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
        "stripe_subscription_id": None
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
    except stripe.error.SignatureVerificationError as e:
        log.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    log.info(f"Received Stripe event: {event['type']}")
    
    # Handle different event types
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        mode = session.get("mode")  # "subscription" or "payment"
        
        # Handle ONE-TIME TOKEN PURCHASE (mode = "payment")
        if mode == "payment":
            profile_id = session.get("client_reference_id")
            metadata = session.get("metadata", {})
            tokens_to_add = int(metadata.get("tokens", 0))
            package_id = metadata.get("package_id")
            
            if profile_id and tokens_to_add > 0:
                supabase = get_supabase()
                
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
            tier = STRIPE_PRICE_TO_TIER.get(price_id, "base")
            
            # Update or create profile with stripe customer ID
            supabase = get_supabase()
            
            # First, try to find profile by email (from checkout session)
            customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
            
            if customer_email:
                # Update existing profile or create if needed
                result = supabase.table("profiles").update({
                    "stripe_customer_id": customer_id
                }).eq("email", customer_email).execute()
                
                if not result.data:
                    # Create new profile
                    supabase.table("profiles").insert({
                        "email": customer_email,
                        "stripe_customer_id": customer_id
                    }).execute()
            
            # Update subscription tier
            update_subscription_tier(customer_id, tier, subscription_id)
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        subscription_id = subscription.get("id")
        price_id = subscription["items"]["data"][0]["price"]["id"]
        tier = STRIPE_PRICE_TO_TIER.get(price_id, "base")
        
        if customer_id:
            update_subscription_tier(customer_id, tier, subscription_id)
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        
        if customer_id:
            cancel_subscription(customer_id)
    
    elif event["type"] == "invoice.payment_succeeded":
        # Recurring payment successful - reset tokens for the month
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        subscription_id = invoice.get("subscription")
        
        if customer_id and subscription_id:
            # Get current subscription tier
            supabase = get_supabase()
            result = supabase.table("profiles").select("subscription_tier, monthly_token_limit").eq("stripe_customer_id", customer_id).single().execute()
            
            if result.data:
                # Reset tokens to monthly limit
                tokens_reset_at = datetime.now() + timedelta(days=30)
                supabase.table("profiles").update({
                    "token_balance": result.data["monthly_token_limit"],
                    "tokens_reset_at": tokens_reset_at.isoformat()
                }).eq("stripe_customer_id", customer_id).execute()
                
                log.info(f"Reset tokens for customer {customer_id} after payment")
    
    return {"status": "success"}
