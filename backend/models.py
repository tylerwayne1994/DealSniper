from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base

class Deal(Base):
    __tablename__ = "deals"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic property info
    property_name = Column(String, nullable=False)
    location = Column(String)
    units_or_pads = Column(Integer)
    
    # Financial inputs
    purchase_price = Column(Float)
    down_payment_pct = Column(Float)  # e.g., 0.25 for 25%
    interest_rate = Column(Float)  # e.g., 0.065 for 6.5%
    ltv = Column(Float)  # Loan-to-value ratio
    amortization_years = Column(Integer)
    io_period_months = Column(Integer)  # Interest-only period
    rehab_per_unit = Column(Float)
    rent_bump_pct = Column(Float)
    vacancy_pct = Column(Float)
    
    # Calculated metrics (from underwriting engine)
    noi = Column(Float)  # Net Operating Income
    cap_rate = Column(Float)
    dscr = Column(Float)  # Debt Service Coverage Ratio
    day1_cf_per_month = Column(Float)
    stabilized_cf_per_month = Column(Float)
    refi_value = Column(Float)
    cash_out_at_refi = Column(Float)
    post_refi_cf_per_month = Column(Float)
    
    # Pipeline/CRM fields
    status = Column(String, default="New")  # New, Contacted, LOI_Sent, Under_Contract, Dead
    priority = Column(String)  # A, B, C
    best_structure_name = Column(String)
    max_price_you_can_pay = Column(Float)
    offer_price = Column(Float)
    last_touch_date = Column(DateTime(timezone=True))
    next_action = Column(String)
    next_action_due = Column(DateTime(timezone=True))
    notes = Column(Text)
    
    # Contact info
    agent_name = Column(String)
    agent_phone = Column(String)
    agent_email = Column(String)
    
    # Metadata
    is_approved = Column(Integer, default=0)  # 0 = not approved, 1 = approved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Store full underwriting results as JSON for flexibility
    underwriting_data = Column(JSON)
