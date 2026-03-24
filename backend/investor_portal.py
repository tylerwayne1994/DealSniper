"""
Investor Portal / LP Dashboard — Backend API
Manages investors, deal allocations, distributions, K-1 uploads, and quarterly updates.
"""
import os
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import JSONResponse

log = logging.getLogger("investor_portal")
router = APIRouter(prefix="/api/investors", tags=["InvestorPortal"])


def _get_sb():
    from token_manager import get_supabase
    return get_supabase()


def _get_user_id(request: Request) -> str:
    uid = request.headers.get("X-User-ID")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


# ──────────────────────────────────────────────
# INVESTORS CRUD
# ──────────────────────────────────────────────

@router.get("")
async def list_investors(request: Request):
    """List all investors for the current sponsor."""
    uid = _get_user_id(request)
    sb = _get_sb()
    res = sb.table("investors").select("*").eq("sponsor_id", uid).order("created_at", desc=True).execute()
    return {"investors": res.data or []}


@router.post("")
async def create_investor(request: Request):
    """Create/invite a new investor."""
    uid = _get_user_id(request)
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    sb = _get_sb()
    invite_token = uuid.uuid4().hex

    row = {
        "sponsor_id": uid,
        "email": email,
        "first_name": body.get("first_name", ""),
        "last_name": body.get("last_name", ""),
        "phone": body.get("phone", ""),
        "company": body.get("company", ""),
        "investor_type": body.get("investor_type", "lp"),
        "status": "invited",
        "invite_token": invite_token,
    }
    res = sb.table("investors").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create investor")
    return {"investor": res.data[0], "invite_token": invite_token}


@router.put("/{investor_id}")
async def update_investor(request: Request, investor_id: str):
    """Update investor info."""
    uid = _get_user_id(request)
    body = await request.json()
    sb = _get_sb()
    allowed = {"first_name", "last_name", "phone", "company", "investor_type", "status"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.utcnow().isoformat()
    res = sb.table("investors").update(updates).eq("id", investor_id).eq("sponsor_id", uid).execute()
    return {"investor": (res.data or [None])[0]}


@router.delete("/{investor_id}")
async def delete_investor(request: Request, investor_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    sb.table("investors").delete().eq("id", investor_id).eq("sponsor_id", uid).execute()
    return {"deleted": True}


# ──────────────────────────────────────────────
# DEAL-INVESTOR ALLOCATIONS
# ──────────────────────────────────────────────

@router.get("/deals/{deal_id}/allocations")
async def list_deal_allocations(request: Request, deal_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    res = (
        sb.table("deal_investors")
        .select("*, investors(id, email, first_name, last_name, company)")
        .eq("deal_id", deal_id)
        .eq("sponsor_id", uid)
        .execute()
    )
    return {"allocations": res.data or []}


@router.post("/deals/{deal_id}/allocations")
async def create_allocation(request: Request, deal_id: str):
    uid = _get_user_id(request)
    body = await request.json()
    investor_id = body.get("investor_id")
    if not investor_id:
        raise HTTPException(status_code=400, detail="investor_id required")

    sb = _get_sb()
    row = {
        "deal_id": deal_id,
        "investor_id": investor_id,
        "sponsor_id": uid,
        "commitment_amount": body.get("commitment_amount", 0),
        "contributed_amount": body.get("contributed_amount", 0),
        "ownership_pct": body.get("ownership_pct", 0),
        "preferred_return_pct": body.get("preferred_return_pct", 8),
    }
    res = sb.table("deal_investors").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create allocation")
    return {"allocation": res.data[0]}


@router.put("/deals/{deal_id}/allocations/{allocation_id}")
async def update_allocation(request: Request, deal_id: str, allocation_id: str):
    uid = _get_user_id(request)
    body = await request.json()
    sb = _get_sb()
    allowed = {"commitment_amount", "contributed_amount", "ownership_pct", "preferred_return_pct"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.utcnow().isoformat()
    res = (
        sb.table("deal_investors")
        .update(updates)
        .eq("id", allocation_id)
        .eq("deal_id", deal_id)
        .eq("sponsor_id", uid)
        .execute()
    )
    return {"allocation": (res.data or [None])[0]}


@router.delete("/deals/{deal_id}/allocations/{allocation_id}")
async def delete_allocation(request: Request, deal_id: str, allocation_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    sb.table("deal_investors").delete().eq("id", allocation_id).eq("sponsor_id", uid).execute()
    return {"deleted": True}


# ──────────────────────────────────────────────
# DISTRIBUTIONS
# ──────────────────────────────────────────────

@router.get("/deals/{deal_id}/distributions")
async def list_distributions(request: Request, deal_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    # Get all allocations for this deal first
    allocs = sb.table("deal_investors").select("id").eq("deal_id", deal_id).eq("sponsor_id", uid).execute()
    alloc_ids = [a["id"] for a in (allocs.data or [])]
    if not alloc_ids:
        return {"distributions": []}

    res = (
        sb.table("distributions")
        .select("*, deal_investors(investor_id, investors(email, first_name, last_name))")
        .in_("deal_investor_id", alloc_ids)
        .order("distribution_date", desc=True)
        .execute()
    )
    return {"distributions": res.data or []}


@router.post("/deals/{deal_id}/distributions")
async def create_distribution(request: Request, deal_id: str):
    uid = _get_user_id(request)
    body = await request.json()
    sb = _get_sb()

    allocation_id = body.get("deal_investor_id")
    if not allocation_id:
        raise HTTPException(status_code=400, detail="deal_investor_id required")

    # Verify ownership
    check = sb.table("deal_investors").select("id").eq("id", allocation_id).eq("sponsor_id", uid).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not your allocation")

    row = {
        "deal_investor_id": allocation_id,
        "distribution_date": body.get("distribution_date", datetime.utcnow().strftime("%Y-%m-%d")),
        "amount": body.get("amount", 0),
        "distribution_type": body.get("distribution_type", "cash_flow"),
        "memo": body.get("memo", ""),
        "quarter": body.get("quarter", ""),
    }
    res = sb.table("distributions").insert(row).execute()
    return {"distribution": (res.data or [None])[0]}


@router.delete("/distributions/{dist_id}")
async def delete_distribution(request: Request, dist_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    # Verify via join
    dist = sb.table("distributions").select("*, deal_investors(sponsor_id)").eq("id", dist_id).execute()
    if not dist.data or dist.data[0].get("deal_investors", {}).get("sponsor_id") != uid:
        raise HTTPException(status_code=403, detail="Unauthorized")
    sb.table("distributions").delete().eq("id", dist_id).execute()
    return {"deleted": True}


# ──────────────────────────────────────────────
# K-1 / DOCUMENT UPLOADS
# ──────────────────────────────────────────────

@router.post("/deals/{deal_id}/documents")
async def upload_investor_document(
    request: Request,
    deal_id: str,
    file: UploadFile = File(...),
    deal_investor_id: str = Form(...),
    document_type: str = Form("k1"),
    tax_year: int = Form(None),
    quarter: str = Form(None),
):
    uid = _get_user_id(request)
    sb = _get_sb()

    # Verify ownership
    check = sb.table("deal_investors").select("id").eq("id", deal_investor_id).eq("sponsor_id", uid).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not your allocation")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    bucket = "investor-documents"
    # Ensure bucket exists
    try:
        existing = sb.storage.list_buckets()
        names = [b.name if hasattr(b, "name") else b.get("name", "") for b in existing]
        if bucket not in names:
            sb.storage.create_bucket(bucket, options={"public": False})
    except Exception:
        pass

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "pdf"
    safe_name = f"{uuid.uuid4().hex[:12]}.{ext}"
    storage_path = f"{deal_id}/{deal_investor_id}/{safe_name}"

    ct = file.content_type or "application/pdf"
    sb.storage.from_(bucket).upload(storage_path, file_bytes, {"content-type": ct})

    file_url = f"{os.getenv('SUPABASE_URL', '')}/storage/v1/object/public/{bucket}/{storage_path}"

    row = {
        "deal_investor_id": deal_investor_id,
        "document_type": document_type,
        "file_name": file.filename,
        "file_url": file_url,
        "storage_path": storage_path,
        "tax_year": tax_year,
        "quarter": quarter,
        "uploaded_by": uid,
    }
    res = sb.table("investor_documents").insert(row).execute()
    return {"document": (res.data or [None])[0]}


@router.get("/deals/{deal_id}/documents")
async def list_documents(request: Request, deal_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    allocs = sb.table("deal_investors").select("id").eq("deal_id", deal_id).eq("sponsor_id", uid).execute()
    alloc_ids = [a["id"] for a in (allocs.data or [])]
    if not alloc_ids:
        return {"documents": []}

    res = (
        sb.table("investor_documents")
        .select("*, deal_investors(investor_id, investors(email, first_name, last_name))")
        .in_("deal_investor_id", alloc_ids)
        .order("created_at", desc=True)
        .execute()
    )
    return {"documents": res.data or []}


@router.delete("/documents/{doc_id}")
async def delete_document(request: Request, doc_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    doc = sb.table("investor_documents").select("*, deal_investors(sponsor_id)").eq("id", doc_id).execute()
    if not doc.data or doc.data[0].get("deal_investors", {}).get("sponsor_id") != uid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Remove from storage
    try:
        path = doc.data[0].get("storage_path")
        if path:
            sb.storage.from_("investor-documents").remove([path])
    except Exception as e:
        log.warning(f"[InvestorDocs] Failed to remove storage file: {e}")

    sb.table("investor_documents").delete().eq("id", doc_id).execute()
    return {"deleted": True}


# ──────────────────────────────────────────────
# QUARTERLY UPDATES
# ──────────────────────────────────────────────

@router.get("/deals/{deal_id}/updates")
async def list_updates(request: Request, deal_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    res = (
        sb.table("investor_updates")
        .select("*")
        .eq("deal_id", deal_id)
        .eq("sponsor_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return {"updates": res.data or []}


@router.post("/deals/{deal_id}/updates")
async def create_update(request: Request, deal_id: str):
    uid = _get_user_id(request)
    body = await request.json()
    sb = _get_sb()

    row = {
        "deal_id": deal_id,
        "sponsor_id": uid,
        "title": body.get("title", "Quarterly Update"),
        "body": body.get("body", ""),
        "quarter": body.get("quarter", ""),
        "metrics": body.get("metrics", {}),
    }
    res = sb.table("investor_updates").insert(row).execute()
    return {"update": (res.data or [None])[0]}


@router.delete("/updates/{update_id}")
async def delete_update(request: Request, update_id: str):
    uid = _get_user_id(request)
    sb = _get_sb()
    sb.table("investor_updates").delete().eq("id", update_id).eq("sponsor_id", uid).execute()
    return {"deleted": True}


# ──────────────────────────────────────────────
# DASHBOARD SUMMARY (aggregate view)
# ──────────────────────────────────────────────

@router.get("/dashboard")
async def investor_dashboard(request: Request):
    """Get aggregate investor portal data across all deals for this sponsor."""
    uid = _get_user_id(request)
    sb = _get_sb()

    investors = sb.table("investors").select("*").eq("sponsor_id", uid).execute()
    allocs = sb.table("deal_investors").select("*").eq("sponsor_id", uid).execute()

    alloc_ids = [a["id"] for a in (allocs.data or [])]
    distributions = []
    if alloc_ids:
        dist_res = sb.table("distributions").select("*").in_("deal_investor_id", alloc_ids).execute()
        distributions = dist_res.data or []

    total_committed = sum(float(a.get("commitment_amount", 0)) for a in (allocs.data or []))
    total_contributed = sum(float(a.get("contributed_amount", 0)) for a in (allocs.data or []))
    total_distributed = sum(float(d.get("amount", 0)) for d in distributions)

    deal_ids = list(set(a["deal_id"] for a in (allocs.data or [])))

    return {
        "total_investors": len(investors.data or []),
        "total_deals_with_investors": len(deal_ids),
        "total_committed": total_committed,
        "total_contributed": total_contributed,
        "total_distributed": total_distributed,
        "investors": investors.data or [],
        "allocations": allocs.data or [],
        "distributions": distributions,
    }
