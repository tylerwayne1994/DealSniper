# V2 Underwriter - Storage Layer
# Simple JSON file-based storage for deals
import json
import os
from typing import Optional
from pathlib import Path
from .models import DealV2

# Storage directory
STORAGE_DIR = Path(__file__).parent.parent / "data" / "deals_v2"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _get_deal_path(deal_id: str) -> Path:
    """Get file path for a deal"""
    return STORAGE_DIR / f"{deal_id}.json"


def create_deal(parsed_json: dict, original_filename: str) -> DealV2:
    """Create and save a new deal"""
    deal = DealV2.create_new(parsed_json, original_filename)
    save_deal(deal)
    return deal


def get_deal(deal_id: str) -> Optional[DealV2]:
    """Load a deal by ID"""
    path = _get_deal_path(deal_id)
    if not path.exists():
        return None
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return DealV2(**data)
    except Exception as e:
        print(f"Error loading deal {deal_id}: {e}")
        return None


def save_deal(deal: DealV2) -> None:
    """Save a deal to disk"""
    from datetime import datetime
    deal.updated_at = datetime.utcnow().isoformat()
    
    path = _get_deal_path(deal.id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(deal.model_dump(), f, indent=2, ensure_ascii=False)


def list_deals() -> list[DealV2]:
    """List all deals (for future use)"""
    deals = []
    for path in STORAGE_DIR.glob("*.json"):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            deals.append(DealV2(**data))
        except Exception as e:
            print(f"Error loading {path}: {e}")
    return sorted(deals, key=lambda d: d.created_at, reverse=True)
