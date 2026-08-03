"""
Deal Room Layouts — Backend API

Lets a sponsor (GP) arrange the widget-based sections of their deal's
investor-facing Deal Room from their authenticated dashboard: section
order, which widgets appear in each section, and a global theme (accent
color + font). This describes HOW the real deal data is displayed —
the underlying numbers still come from `deals` / `deal_investors` /
`distributions` / `deal_documents` / `scenario_data.rentcast_cache` etc.,
never a copy stored here.

Widget placement is validated server-side against a per-section whitelist
(WIDGET_WHITELIST below) so a client can't smuggle in a widget type/section
combination that doesn't make sense for that section's data shape — the
frontend drag-drop editor should also enforce this for UX, but the real
gate is here.

Sponsor-authed via X-User-ID (same pattern as investor_access.py). The
public investor-facing read (GET /api/investor-access/redeem/{code} in
investor_access.py) additionally returns this layout so InvestorDealRoom
can render sections/widgets in the sponsor's chosen arrangement — still
fully read-only, no write path is ever exposed to a code holder.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

log = logging.getLogger("deal_room_layout")
router = APIRouter(prefix="/api/deal-room-layout", tags=["DealRoomLayout"])

# Section id -> allowed widget types. Enforced server-side on every write.
# Sections not listed here (summary/thesis/operations/projections/risks)
# stay as fixed AI-narrative text blocks for now, not widget-editable.
WIDGET_WHITELIST = {
    "financials": {"table", "summaryCard", "barChart", "lineChart"},
    "calculator": {"slider", "summaryCard"},       # Investor Stress-Test
    "comps": {"table", "map", "barChart", "summaryCard"},
    "marketData": {"lineChart", "barChart", "summaryCard"},
    "participation": {"table", "pieChart"},        # Ownership Breakdown
    "documents": {"table"},
}

SECTION_LABELS = {
    "financials": "Financial Overview",
    "calculator": "Investor Stress-Test",
    "comps": "Comps",
    "marketData": "Market Data",
    "participation": "Ownership Breakdown",
    "documents": "Documents",
}


def _get_sb():
    from token_manager import get_supabase
    return get_supabase()


def _get_user_id(request: Request) -> str:
    uid = request.headers.get("X-User-ID")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def _default_layout() -> list:
    """Mirrors InvestorDealRoom.jsx's original hardcoded section order, with
    the widget-editable sections seeded with the widgets that already exist
    today (e.g. Financial Overview's tables, the Investor Calculator's
    slider) so upgrading a deal to the new layout system doesn't change
    what an investor already sees. Comps and Market Data start with no
    widgets — nothing was ever shown to investors for those, so an empty
    section (hidden until the sponsor adds a widget) is correct, not a bug.
    """
    return [
        {"id": "financials", "title": SECTION_LABELS["financials"], "widgets": [
            {"id": "financials-tables", "type": "table", "dataBinding": "financialOverview", "config": {}},
        ]},
        {"id": "comps", "title": SECTION_LABELS["comps"], "widgets": []},
        {"id": "marketData", "title": SECTION_LABELS["marketData"], "widgets": []},
        {"id": "participation", "title": SECTION_LABELS["participation"], "widgets": [
            {"id": "participation-table", "type": "table", "dataBinding": "investorOptions", "config": {}},
        ]},
        {"id": "calculator", "title": SECTION_LABELS["calculator"], "widgets": [
            {"id": "calculator-slider", "type": "slider", "dataBinding": "exitScenarios", "config": {}},
        ]},
        {"id": "documents", "title": SECTION_LABELS["documents"], "widgets": [
            {"id": "documents-table", "type": "table", "dataBinding": "documents", "config": {}},
        ]},
    ]


def _validate_sections(sections) -> None:
    if not isinstance(sections, list):
        raise HTTPException(status_code=400, detail="sections must be a list")
    seen_section_ids = set()
    for section in sections:
        if not isinstance(section, dict) or not section.get("id"):
            raise HTTPException(status_code=400, detail="Each section requires an id")
        sec_id = section["id"]
        if sec_id in seen_section_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate section id: {sec_id}")
        seen_section_ids.add(sec_id)

        widgets = section.get("widgets", [])
        if not isinstance(widgets, list):
            raise HTTPException(status_code=400, detail=f"Section '{sec_id}' widgets must be a list")

        allowed = WIDGET_WHITELIST.get(sec_id)
        if allowed is None:
            # Fixed/non-widget section (summary, thesis, operations, projections, risks) —
            # not part of the widget system, so it shouldn't carry widgets at all.
            if widgets:
                raise HTTPException(status_code=400, detail=f"Section '{sec_id}' does not support widgets")
            continue

        for widget in widgets:
            if not isinstance(widget, dict) or not widget.get("id") or not widget.get("type"):
                raise HTTPException(status_code=400, detail=f"Malformed widget in section '{sec_id}'")
            if widget["type"] not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Widget type '{widget['type']}' is not allowed in section '{sec_id}' "
                           f"(allowed: {sorted(allowed)})",
                )


def _confirm_deal_ownership(sb, deal_id: str, uid: str) -> None:
    deal_check = sb.table("deals").select("deal_id").eq("deal_id", deal_id).eq("user_id", uid).execute()
    if not deal_check.data:
        raise HTTPException(status_code=404, detail="Deal not found")


@router.get("/{deal_id}")
async def get_deal_room_layout(request: Request, deal_id: str):
    """Sponsor-authed. Returns the saved layout, or a generated default
    (not yet persisted) if the sponsor hasn't customized this deal's room."""
    uid = _get_user_id(request)
    sb = _get_sb()
    _confirm_deal_ownership(sb, deal_id, uid)

    res = sb.table("deal_room_layouts").select("*").eq("deal_id", deal_id).execute()
    row = (res.data or [None])[0]
    if row:
        return {"layout": row, "is_default": False}

    return {
        "layout": {
            "deal_id": deal_id,
            "sponsor_id": uid,
            "sections": _default_layout(),
            "theme": {},
        },
        "is_default": True,
    }


@router.put("/{deal_id}")
async def save_deal_room_layout(request: Request, deal_id: str):
    """Sponsor-authed. Upserts the layout for this deal. `sections` is
    validated against WIDGET_WHITELIST before it's ever written."""
    uid = _get_user_id(request)
    body = await request.json()
    sections = body.get("sections", [])
    theme = body.get("theme", {})

    if not isinstance(theme, dict):
        raise HTTPException(status_code=400, detail="theme must be an object")
    _validate_sections(sections)

    sb = _get_sb()
    _confirm_deal_ownership(sb, deal_id, uid)

    row = {
        "deal_id": deal_id,
        "sponsor_id": uid,
        "sections": sections,
        "theme": theme,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        existing = sb.table("deal_room_layouts").select("id").eq("deal_id", deal_id).execute()
        if existing.data:
            res = sb.table("deal_room_layouts").update(row).eq("deal_id", deal_id).execute()
        else:
            res = sb.table("deal_room_layouts").insert(row).execute()
    except Exception as e:
        log.exception("[DealRoomLayout] Failed to save layout for deal %s: %s", deal_id, e)
        raise HTTPException(status_code=500, detail="Failed to save deal room layout")

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save deal room layout")
    return {"layout": res.data[0]}
