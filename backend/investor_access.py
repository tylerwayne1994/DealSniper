"""
Investor Access Links — Backend API

Lets a sponsor (GP) generate a short access code for a specific deal's
investor-facing Deal Room / pitch deck, and hand that code (or a link
containing it) to an investor. The investor never creates an account or
logs in — they enter the code on the public /investor gateway page and are
routed straight to that one deal's pitch deck, and nothing else in the app.

All reads/writes go through the Supabase service role key (via
token_manager.get_supabase()), which bypasses RLS. The redeem endpoint is
intentionally public (no auth header required) — access is gated entirely
by the access code itself (random, revocable, optionally time-limited).
"""
import logging
import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("investor_access")
router = APIRouter(prefix="/api/investor-access", tags=["InvestorAccess"])

# Unambiguous alphabet (no 0/O, 1/I/L) so codes are easy to read/type over the phone.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _get_sb():
    from token_manager import get_supabase
    return get_supabase()


def _get_user_id(request: Request) -> str:
    uid = request.headers.get("X-User-ID")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def _generate_code(length: int = 8) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


# ──────────────────────────────────────────────
# SPONSOR-SIDE: create / list / revoke links
# ──────────────────────────────────────────────

@router.post("")
async def create_investor_access_link(request: Request):
    """Create a new access code for a deal. Sponsor-authenticated (X-User-ID)."""
    uid = _get_user_id(request)
    body = await request.json()
    deal_id = body.get("deal_id")
    if not deal_id:
        raise HTTPException(status_code=400, detail="deal_id is required")

    sb = _get_sb()

    # Confirm the deal belongs to this sponsor before letting them share it.
    deal_check = sb.table("deals").select("deal_id").eq("deal_id", deal_id).eq("user_id", uid).execute()
    if not deal_check.data:
        raise HTTPException(status_code=404, detail="Deal not found")

    expires_days = body.get("expires_days")
    expires_at = None
    if expires_days:
        try:
            expires_at = (datetime.utcnow() + timedelta(days=float(expires_days))).isoformat()
        except (TypeError, ValueError):
            expires_at = None

    # Retry a couple times on the (very unlikely) chance of a code collision.
    for _ in range(5):
        code = _generate_code()
        row = {
            "deal_id": deal_id,
            "sponsor_id": uid,
            "access_code": code,
            "investor_name": body.get("investor_name") or None,
            "investor_email": body.get("investor_email") or None,
            "expires_at": expires_at,
        }
        try:
            res = sb.table("investor_access_links").insert(row).execute()
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                continue
            log.exception("[InvestorAccess] Failed to create link: %s", e)
            raise HTTPException(status_code=500, detail="Failed to create access link")
        if res.data:
            return {"link": res.data[0]}

    raise HTTPException(status_code=500, detail="Failed to generate a unique access code, try again")


@router.get("/deals/{deal_id}")
async def list_investor_access_links(request: Request, deal_id: str):
    """List all access links created for a deal (sponsor-authenticated)."""
    uid = _get_user_id(request)
    sb = _get_sb()
    res = (
        sb.table("investor_access_links")
        .select("*")
        .eq("deal_id", deal_id)
        .eq("sponsor_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return {"links": res.data or []}


@router.delete("/{link_id}")
async def revoke_investor_access_link(request: Request, link_id: str):
    """Revoke (not delete) an access link so the code stops working."""
    uid = _get_user_id(request)
    sb = _get_sb()
    res = (
        sb.table("investor_access_links")
        .update({"revoked": True})
        .eq("id", link_id)
        .eq("sponsor_id", uid)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"revoked": True}


# ──────────────────────────────────────────────
# PUBLIC: redeem a code (no auth) — investor gateway
# ──────────────────────────────────────────────

@router.get("/redeem/{code}")
async def redeem_investor_access_code(code: str):
    """Public endpoint: validate an access code and return the deal snapshot
    (raw deals row + allocations + distributions) needed to render the
    read-only investor pitch deck. No X-User-ID / auth required — the code
    itself is the credential."""
    code = (code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Access code is required")

    sb = _get_sb()
    link_res = sb.table("investor_access_links").select("*").eq("access_code", code).execute()
    link = (link_res.data or [None])[0]
    if not link:
        raise HTTPException(status_code=404, detail="Invalid access code")
    if link.get("revoked"):
        raise HTTPException(status_code=410, detail="This access link has been revoked")
    expires_at = link.get("expires_at")
    if expires_at:
        try:
            if datetime.fromisoformat(expires_at.replace("Z", "+00:00")).replace(tzinfo=None) < datetime.utcnow():
                raise HTTPException(status_code=410, detail="This access link has expired")
        except HTTPException:
            raise
        except Exception:
            pass  # If the timestamp is malformed, don't hard-fail the redeem.

    deal_id = link["deal_id"]
    deal_res = sb.table("deals").select("*").eq("deal_id", deal_id).execute()
    deal_row = (deal_res.data or [None])[0]
    if not deal_row:
        raise HTTPException(status_code=404, detail="This deal is no longer available")

    # Allocations + distributions for this deal, scoped by deal_id only (no
    # sponsor_id filter — the investor isn't the sponsor, the code is what
    # authorizes this read).
    allocations_res = (
        sb.table("deal_investors")
        .select("*, investors(id, email, first_name, last_name, company)")
        .eq("deal_id", deal_id)
        .execute()
    )
    allocations = allocations_res.data or []
    alloc_ids = [a["id"] for a in allocations]

    distributions = []
    if alloc_ids:
        dist_res = (
            sb.table("distributions")
            .select("*, deal_investors(investor_id, investors(email, first_name, last_name))")
            .in_("deal_investor_id", alloc_ids)
            .order("distribution_date", desc=True)
            .execute()
        )
        distributions = dist_res.data or []

    # Document vault: only documents the sponsor explicitly marked visible to
    # investors. Prefer the deal_documents table; fall back to documents
    # embedded on the deal record (parsed_data.deal_room_documents) for decks
    # that were built before the table existed / for unauthenticated uploads.
    documents = []
    try:
        docs_res = (
            sb.table("deal_documents")
            .select("*")
            .eq("deal_id", deal_id)
            .eq("visible_to_investors", True)
            .order("uploaded_at", desc=True)
            .execute()
        )
        documents = docs_res.data or []
    except Exception as e:
        log.warning("[InvestorAccess] deal_documents lookup failed for %s: %s", deal_id, e)

    if not documents:
        embedded = (deal_row.get("parsed_data") or {}).get("deal_room_documents") or []
        documents = [d for d in embedded if d.get("visible_to_investors")]

    # Log the view (best-effort — never block the redeem on this).
    try:
        sb.table("investor_access_links").update({
            "view_count": (link.get("view_count") or 0) + 1,
            "last_viewed_at": datetime.utcnow().isoformat(),
        }).eq("id", link["id"]).execute()
    except Exception as e:
        log.warning("[InvestorAccess] Failed to record view for code %s: %s", code, e)

    return JSONResponse({
        "deal": deal_row,
        "allocations": allocations,
        "distributions": distributions,
        "documents": documents,
        "investorName": link.get("investor_name"),
    })
