"""
Token Management Module
Handles AI operation token tracking and billing for DealSniper
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from supabase import create_client, Client
import logging

log = logging.getLogger("token_manager")

# ============================================================================
# Configuration
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Token costs for different operations
TOKEN_COSTS = {
    "loi_generation": 1,
    "pitch_deck_generation": 1,
    "market_research_results": 1,
    "market_research_dashboard": 1,
    "deal_structure_analysis": 1,
    "deal_summary": 0,  # Hold off - tracking only
    "wizard_ai_analysis": 0,  # Hold off - tracking only
    "rapid_fire_ai": 1,  # 1 token per 150 properties
}

# Subscription tiers and monthly limits
SUBSCRIPTION_TIERS = {
    "base": 25,   # $39.99/month - 25 tokens
    "pro": 55,    # $49.99/month - 55 tokens
}

router = APIRouter(prefix="/api/tokens", tags=["Token Management"])

# ============================================================================
# Models
# ============================================================================

class TokenCheckResponse(BaseModel):
    has_tokens: bool
    token_balance: int
    tokens_required: int
    subscription_tier: str
    monthly_limit: int
    tokens_reset_at: str

class TokenUsageRequest(BaseModel):
    operation_type: str
    deal_id: Optional[str] = None
    deal_name: Optional[str] = None
    location: Optional[str] = None

class TokenUsageResponse(BaseModel):
    success: bool
    tokens_used: int
    new_balance: int
    message: str

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

def get_current_profile_id(request: Request) -> str:
    """
    Get current user's profile ID from request.
    Requires explicit `X-Profile-ID` header or `profile_id` cookie.
    This avoids cross-account data bleed.
    """
    profile_id = request.headers.get("X-Profile-ID") or request.cookies.get("profile_id")
    if not profile_id:
        raise HTTPException(status_code=401, detail="Missing profile ID. Pass 'X-Profile-ID' header.")
    return profile_id

def get_profile(profile_id: str) -> Dict[str, Any]:
    """Get profile data including token balance."""
    supabase = get_supabase()
    result = supabase.table("profiles").select("*").eq("id", profile_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return result.data

def reset_tokens_if_needed(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Check if tokens need to be reset and reset them if needed."""
    tokens_reset_at = datetime.fromisoformat(profile["tokens_reset_at"].replace("Z", "+00:00"))
    
    if datetime.now(tokens_reset_at.tzinfo) >= tokens_reset_at:
        # Reset tokens
        supabase = get_supabase()
        new_reset_date = datetime.now(tokens_reset_at.tzinfo) + timedelta(days=30)
        
        result = supabase.table("profiles").update({
            "token_balance": profile["monthly_token_limit"],
            "tokens_reset_at": new_reset_date.isoformat()
        }).eq("id", profile["id"]).execute()
        
        if result.data:
            profile = result.data[0]
            log.info(f"Reset tokens for profile {profile['id']} to {profile['monthly_token_limit']}")
    
    return profile

# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/balance", response_model=TokenCheckResponse)
async def get_token_balance(request: Request):
    """Get current token balance for the user."""
    try:
        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)
        
        return TokenCheckResponse(
            has_tokens=profile["token_balance"] > 0,
            token_balance=profile["token_balance"],
            tokens_required=1,
            subscription_tier=profile.get("subscription_tier", "free"),
            monthly_limit=profile.get("monthly_token_limit", 30),
            tokens_reset_at=profile["tokens_reset_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error getting token balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/check", response_model=TokenCheckResponse)
async def check_tokens(request: Request, usage: TokenUsageRequest):
    """Check if user has enough tokens for an operation."""
    try:
        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)
        
        tokens_required = TOKEN_COSTS.get(usage.operation_type, 1)
        has_tokens = profile["token_balance"] >= tokens_required
        
        return TokenCheckResponse(
            has_tokens=has_tokens,
            token_balance=profile["token_balance"],
            tokens_required=tokens_required,
            subscription_tier=profile.get("subscription_tier", "free"),
            monthly_limit=profile.get("monthly_token_limit", 30),
            tokens_reset_at=profile["tokens_reset_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error checking tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/use", response_model=TokenUsageResponse)
async def use_tokens(request: Request, usage: TokenUsageRequest):
    """Deduct tokens for an AI operation."""
    try:
        profile_id = get_current_profile_id(request)
        profile = get_profile(profile_id)
        profile = reset_tokens_if_needed(profile)
        
        tokens_required = TOKEN_COSTS.get(usage.operation_type, 1)
        
        # Check if enough tokens
        if profile["token_balance"] < tokens_required:
            return TokenUsageResponse(
                success=False,
                tokens_used=0,
                new_balance=profile["token_balance"],
                message=f"Insufficient tokens. You need {tokens_required} tokens but have {profile['token_balance']}."
            )
        
        # Deduct tokens
        supabase = get_supabase()
        new_balance = profile["token_balance"] - tokens_required
        
        result = supabase.table("profiles").update({
            "token_balance": new_balance
        }).eq("id", profile_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update token balance")
        
        # Log usage
        supabase.table("token_usage").insert({
            "profile_id": profile_id,
            "operation_type": usage.operation_type,
            "tokens_used": tokens_required,
            "deal_id": usage.deal_id,
            "deal_name": usage.deal_name,
            "location": usage.location
        }).execute()
        
        log.info(f"Used {tokens_required} tokens for {usage.operation_type}. New balance: {new_balance}")
        
        return TokenUsageResponse(
            success=True,
            tokens_used=tokens_required,
            new_balance=new_balance,
            message=f"Successfully used {tokens_required} token(s). Remaining: {new_balance}"
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error using tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage-history")
async def get_usage_history(request: Request, limit: int = 50):
    """Get token usage history for the user."""
    try:
        profile_id = get_current_profile_id(request)
        supabase = get_supabase()
        
        result = supabase.table("token_usage").select("*").eq(
            "profile_id", profile_id
        ).order("created_at", desc=True).limit(limit).execute()
        
        return {
            "success": True,
            "usage_history": result.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error getting usage history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/add-tokens")
async def add_tokens_admin(request: Request, profile_id: str, tokens: int):
    """Admin endpoint to add tokens to a user's balance."""
    try:
        # TODO: Add admin authentication check
        supabase = get_supabase()
        
        profile = get_profile(profile_id)
        new_balance = profile["token_balance"] + tokens
        
        result = supabase.table("profiles").update({
            "token_balance": new_balance
        }).eq("id", profile_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update token balance")
        
        log.info(f"Admin added {tokens} tokens to profile {profile_id}. New balance: {new_balance}")
        
        return {
            "success": True,
            "profile_id": profile_id,
            "tokens_added": tokens,
            "new_balance": new_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error adding tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))
