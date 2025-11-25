from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import schemas
import models
from database import get_db

router = APIRouter(prefix="/api/deals", tags=["deals"])

# Create a new deal
@router.post("/", response_model=schemas.Deal)
def create_deal(deal: schemas.DealCreate, db: Session = Depends(get_db)):
    db_deal = models.Deal(**deal.model_dump())
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal

# Get all deals
@router.get("/", response_model=List[schemas.Deal])
def get_deals(
    approved_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Deal)
    if approved_only:
        query = query.filter(models.Deal.is_approved == 1)
    deals = query.offset(skip).limit(limit).all()
    return deals

# Get a single deal by ID
@router.get("/{deal_id}", response_model=schemas.Deal)
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

# Update a deal
@router.put("/{deal_id}", response_model=schemas.Deal)
def update_deal(
    deal_id: int,
    deal_update: schemas.DealUpdate,
    db: Session = Depends(get_db)
):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Update only provided fields
    for field, value in deal_update.model_dump(exclude_unset=True).items():
        setattr(db_deal, field, value)
    
    db.commit()
    db.refresh(db_deal)
    return db_deal

# Delete a deal
@router.delete("/{deal_id}")
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db.delete(db_deal)
    db.commit()
    return {"message": "Deal deleted successfully"}

# Approve a deal
@router.post("/{deal_id}/approve", response_model=schemas.Deal)
def approve_deal(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db_deal.is_approved = 1
    db.commit()
    db.refresh(db_deal)
    return db_deal

# Stub endpoint for pitch deck generation
@router.get("/{deal_id}/pitch-deck")
def generate_pitch_deck(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Stub: return mock slide structure
    return {
        "deal_id": deal_id,
        "slides": [
            {
                "slide_number": 1,
                "title": "Investment Opportunity",
                "content": [
                    f"Property: {db_deal.property_name}",
                    f"Location: {db_deal.location}",
                    f"Units: {db_deal.units_or_pads}"
                ]
            },
            {
                "slide_number": 2,
                "title": "Financial Overview",
                "content": [
                    f"Purchase Price: ${db_deal.purchase_price:,.0f}" if db_deal.purchase_price else "Purchase Price: TBD",
                    f"NOI: ${db_deal.noi:,.0f}" if db_deal.noi else "NOI: TBD",
                    f"Cap Rate: {db_deal.cap_rate:.2%}" if db_deal.cap_rate else "Cap Rate: TBD"
                ]
            },
            {
                "slide_number": 3,
                "title": "Returns Analysis",
                "content": [
                    f"Day 1 CF/Month: ${db_deal.day1_cf_per_month:,.0f}" if db_deal.day1_cf_per_month else "Day 1 CF: TBD",
                    f"Stabilized CF/Month: ${db_deal.stabilized_cf_per_month:,.0f}" if db_deal.stabilized_cf_per_month else "Stabilized CF: TBD",
                    f"Refi Value: ${db_deal.refi_value:,.0f}" if db_deal.refi_value else "Refi Value: TBD"
                ]
            }
        ]
    }

# Stub endpoint for step-by-step plan
@router.get("/{deal_id}/execution-plan")
def generate_execution_plan(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Stub: return mock plan
    return {
        "deal_id": deal_id,
        "plan": [
            {"step": 1, "action": "Contact broker and request full financials"},
            {"step": 2, "action": "Schedule property tour"},
            {"step": 3, "action": "Submit LOI with contingencies"},
            {"step": 4, "action": "Order Phase 1 environmental and property inspection"},
            {"step": 5, "action": "Finalize financing with lender"}
        ]
    }

# Stub endpoint for broker call script
@router.get("/{deal_id}/broker-script")
def generate_broker_script(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Stub: return mock script
    return {
        "deal_id": deal_id,
        "script": f"""
Hi {db_deal.agent_name or '[Agent Name]'},

This is [Your Name]. I'm reaching out about the {db_deal.property_name} listing in {db_deal.location}.

I'm a multifamily investor focused on value-add opportunities. I've reviewed the offering memorandum and I'm very interested in this property.

Key questions:
1. What's the current occupancy and rent roll look like?
2. Are there any deferred maintenance items I should be aware of?
3. What's the seller's timeline and motivation?
4. Have you received any other offers?

I'm prepared to move quickly with proof of funds and can close in [X] days.

Looking forward to discussing this opportunity.
"""
    }
