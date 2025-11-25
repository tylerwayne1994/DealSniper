from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# Base schema with common fields
class DealBase(BaseModel):
    property_name: str
    location: Optional[str] = None
    units_or_pads: Optional[int] = None
    
    # Financial inputs
    purchase_price: Optional[float] = None
    down_payment_pct: Optional[float] = 0.25
    interest_rate: Optional[float] = 0.065
    ltv: Optional[float] = 0.75
    amortization_years: Optional[int] = 30
    io_period_months: Optional[int] = 0
    rehab_per_unit: Optional[float] = 0.0
    rent_bump_pct: Optional[float] = 0.0
    vacancy_pct: Optional[float] = 0.05
    
    # Pipeline/CRM fields
    status: Optional[str] = "New"
    priority: Optional[str] = None
    best_structure_name: Optional[str] = None
    max_price_you_can_pay: Optional[float] = None
    offer_price: Optional[float] = None
    last_touch_date: Optional[datetime] = None
    next_action: Optional[str] = None
    next_action_due: Optional[datetime] = None
    notes: Optional[str] = None
    
    # Contact info
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_email: Optional[str] = None

# Schema for creating a new deal
class DealCreate(DealBase):
    pass

# Schema for updating a deal
class DealUpdate(BaseModel):
    property_name: Optional[str] = None
    location: Optional[str] = None
    units_or_pads: Optional[int] = None
    purchase_price: Optional[float] = None
    down_payment_pct: Optional[float] = None
    interest_rate: Optional[float] = None
    ltv: Optional[float] = None
    amortization_years: Optional[int] = None
    io_period_months: Optional[int] = None
    rehab_per_unit: Optional[float] = None
    rent_bump_pct: Optional[float] = None
    vacancy_pct: Optional[float] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    best_structure_name: Optional[str] = None
    max_price_you_can_pay: Optional[float] = None
    offer_price: Optional[float] = None
    last_touch_date: Optional[datetime] = None
    next_action: Optional[str] = None
    next_action_due: Optional[datetime] = None
    notes: Optional[str] = None
    agent_name: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_email: Optional[str] = None
    is_approved: Optional[int] = None

# Schema for returning a deal (includes calculated fields)
class Deal(DealBase):
    id: int
    
    # Calculated metrics
    noi: Optional[float] = None
    cap_rate: Optional[float] = None
    dscr: Optional[float] = None
    day1_cf_per_month: Optional[float] = None
    stabilized_cf_per_month: Optional[float] = None
    refi_value: Optional[float] = None
    cash_out_at_refi: Optional[float] = None
    post_refi_cf_per_month: Optional[float] = None
    
    # Metadata
    is_approved: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    underwriting_data: Optional[dict] = None
    
    model_config = ConfigDict(from_attributes=True)
