# Cost Segregation Analysis Module
# Implements MACRS depreciation schedules, bonus depreciation, and exit tax analysis

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import numpy_financial as npf
import math

# =============================================================================
# MACRS DEPRECIATION TABLES (Half-Year Convention)
# =============================================================================

# 5-Year MACRS (200% DB switching to SL)
MACRS_5_YEAR = [0.2000, 0.3200, 0.1920, 0.1152, 0.1152, 0.0576]

# 7-Year MACRS (200% DB switching to SL)
MACRS_7_YEAR = [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446]

# 15-Year MACRS (150% DB switching to SL)
MACRS_15_YEAR = [
    0.0500, 0.0950, 0.0855, 0.0770, 0.0693, 0.0623, 0.0590, 0.0590,
    0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0295
]

# Residential rental property: 27.5-year straight-line (mid-month convention)
# For simplicity, we use 1/27.5 = 3.636% per year
RESIDENTIAL_YEARS = 27.5
RESIDENTIAL_ANNUAL_RATE = 1 / 27.5  # ~3.636%

# Commercial property: 39-year straight-line (mid-month convention)
COMMERCIAL_YEARS = 39.0
COMMERCIAL_ANNUAL_RATE = 1 / 39.0  # ~2.564%


# =============================================================================
# DATA MODELS
# =============================================================================

class CostSegInputs(BaseModel):
    """Input parameters for cost segregation analysis"""
    # Core deal info
    purchase_price: float
    land_percent: float = 20.0  # % of purchase price
    closing_costs: float = 0.0
    
    # Allocation percentages (% of building value, must sum to 100)
    five_year_percent: float = 15.0
    seven_year_percent: float = 0.0
    fifteen_year_percent: float = 10.0
    # Remaining goes to long-life (27.5 or 39 year)
    
    # Property type
    is_residential: bool = True  # True = 27.5yr, False = 39yr
    
    # Tax settings
    bonus_depreciation_percent: float = 60.0  # Current 2024 is 60%
    federal_tax_rate: float = 37.0
    state_tax_rate: float = 5.0
    ltcg_rate: float = 20.0  # Long-term capital gains rate
    unrecaptured_1250_rate: float = 25.0  # Max rate for unrecaptured section 1250 gain
    
    # Hold period and exit
    hold_period_years: int = 5
    exit_sale_price: float = 0.0  # If 0, will estimate based on NOI and cap rate
    exit_cap_rate: float = 6.0  # For estimating sale price if not provided
    selling_costs_percent: float = 3.0  # % of sale price
    
    # Pre-tax cash flows by year (can be derived from deal projections)
    pre_tax_cash_flows: List[float] = []
    
    # Initial equity investment (down payment + closing + any upfront capex)
    initial_equity: float = 0.0
    
    # Exit NOI for estimating sale price
    exit_noi: float = 0.0


class DepreciationSchedule(BaseModel):
    """Year-by-year depreciation breakdown"""
    year: int
    bonus_depreciation: float = 0.0
    five_year_depreciation: float = 0.0
    seven_year_depreciation: float = 0.0
    fifteen_year_depreciation: float = 0.0
    long_life_depreciation: float = 0.0
    total_depreciation: float = 0.0
    cumulative_depreciation: float = 0.0


class TaxYearResult(BaseModel):
    """Annual tax impact results"""
    year: int
    pre_tax_cash_flow: float
    bonus_depreciation: float
    five_year_depreciation: float
    fifteen_year_depreciation: float
    long_life_depreciation: float
    total_depreciation: float
    taxable_income: float
    tax_liability: float  # Positive = tax owed, negative = tax benefit
    after_tax_cash_flow: float
    cumulative_depreciation: float
    adjusted_basis: float


class ExitTaxBreakdown(BaseModel):
    """Exit tax analysis breakdown"""
    sale_price: float
    selling_costs: float
    net_sale_proceeds: float
    
    # Basis calculations
    original_basis: float  # Purchase price + closing costs
    accumulated_depreciation: float
    adjusted_basis: float
    
    # Gain breakdown
    total_gain: float
    
    # Recapture amounts
    recapture_5_7_year: float  # Ordinary income recapture for personal property
    recapture_15_year: float  # Ordinary income recapture for land improvements
    unrecaptured_1250_gain: float  # Long-life depreciation (25% max rate)
    long_term_capital_gain: float  # Pure LTCG
    
    # Tax calculations
    tax_on_personal_recapture: float
    tax_on_land_improvements_recapture: float
    tax_on_unrecaptured_1250: float
    tax_on_ltcg: float
    total_exit_tax: float
    
    after_tax_proceeds: float


class CostSegResult(BaseModel):
    """Complete cost segregation analysis results"""
    # Allocation breakdown
    land_value: float
    building_value: float
    five_year_basis: float
    seven_year_basis: float
    fifteen_year_basis: float
    long_life_basis: float
    depreciable_basis: float  # Total building value + closing costs allocated to building
    
    # Year 1 highlights
    year_1_bonus_depreciation: float
    year_1_macrs_depreciation: float
    year_1_total_depreciation: float
    year_1_tax_shield: float
    
    # Key metrics
    after_tax_irr: float
    after_tax_equity_multiple: float
    total_depreciation_over_hold: float
    
    # Detailed schedules
    depreciation_schedule: List[DepreciationSchedule]
    annual_tax_impact: List[TaxYearResult]
    exit_taxes: ExitTaxBreakdown
    
    # Comparison (optional - vs no cost seg)
    standard_depr_irr: Optional[float] = None
    irr_improvement: Optional[float] = None


# =============================================================================
# CALCULATION FUNCTIONS
# =============================================================================

def calculate_macrs_depreciation(
    basis: float,
    year: int,  # 1-indexed
    schedule: List[float]
) -> float:
    """Calculate MACRS depreciation for a given year"""
    if year < 1 or year > len(schedule):
        return 0.0
    return basis * schedule[year - 1]


def calculate_straight_line_depreciation(
    basis: float,
    year: int,  # 1-indexed
    useful_life: float,
    hold_period: int
) -> float:
    """Calculate straight-line depreciation for real property"""
    if year < 1 or year > hold_period:
        return 0.0
    
    annual_rate = 1 / useful_life
    
    # First year: half-year or mid-month convention (simplified to half)
    if year == 1:
        return basis * annual_rate * 0.5
    # Last year of hold might be partial
    elif year == hold_period:
        return basis * annual_rate * 0.5
    else:
        return basis * annual_rate


def calculate_cost_seg_analysis(inputs: CostSegInputs) -> CostSegResult:
    """
    Main function to compute full cost segregation analysis.
    
    Returns complete breakdown of:
    - Allocation by asset class
    - Year-by-year depreciation with MACRS schedules
    - Tax impact including bonus depreciation
    - Exit tax analysis with recapture
    - After-tax IRR and equity multiple
    """
    
    # Combined marginal tax rate
    marginal_rate = (inputs.federal_tax_rate + inputs.state_tax_rate) / 100.0
    ltcg_rate = inputs.ltcg_rate / 100.0
    unrecaptured_1250_rate = min(inputs.unrecaptured_1250_rate / 100.0, marginal_rate)
    bonus_pct = inputs.bonus_depreciation_percent / 100.0
    
    # ==========================================================================
    # STEP 1: Calculate basis allocations
    # ==========================================================================
    
    land_value = inputs.purchase_price * (inputs.land_percent / 100.0)
    building_value = inputs.purchase_price - land_value
    
    # Add closing costs to depreciable basis (allocated to building)
    depreciable_basis = building_value + inputs.closing_costs
    
    # Calculate component allocations
    five_year_pct = inputs.five_year_percent / 100.0
    seven_year_pct = inputs.seven_year_percent / 100.0
    fifteen_year_pct = inputs.fifteen_year_percent / 100.0
    long_life_pct = 1.0 - five_year_pct - seven_year_pct - fifteen_year_pct
    
    five_year_basis = depreciable_basis * five_year_pct
    seven_year_basis = depreciable_basis * seven_year_pct
    fifteen_year_basis = depreciable_basis * fifteen_year_pct
    long_life_basis = depreciable_basis * long_life_pct
    
    # Determine long-life schedule
    long_life_years = RESIDENTIAL_YEARS if inputs.is_residential else COMMERCIAL_YEARS
    
    # ==========================================================================
    # STEP 2: Apply Bonus Depreciation (Year 1 only)
    # ==========================================================================
    
    # Bonus applies to 5, 7, and 15-year property
    bonus_eligible_basis = five_year_basis + seven_year_basis + fifteen_year_basis
    year_1_bonus = bonus_eligible_basis * bonus_pct
    
    # Remaining basis after bonus for MACRS
    remaining_5yr_basis = five_year_basis * (1 - bonus_pct)
    remaining_7yr_basis = seven_year_basis * (1 - bonus_pct)
    remaining_15yr_basis = fifteen_year_basis * (1 - bonus_pct)
    
    # ==========================================================================
    # STEP 3: Build year-by-year depreciation schedule
    # ==========================================================================
    
    hold_period = inputs.hold_period_years
    depreciation_schedule = []
    cumulative_depr = 0.0
    
    # Track accumulated depreciation by category
    accumulated_5yr = 0.0
    accumulated_7yr = 0.0
    accumulated_15yr = 0.0
    accumulated_long_life = 0.0
    
    for year in range(1, hold_period + 1):
        # MACRS depreciation on remaining basis
        depr_5yr = calculate_macrs_depreciation(remaining_5yr_basis, year, MACRS_5_YEAR)
        depr_7yr = calculate_macrs_depreciation(remaining_7yr_basis, year, MACRS_7_YEAR)
        depr_15yr = calculate_macrs_depreciation(remaining_15yr_basis, year, MACRS_15_YEAR)
        
        # Long-life straight-line
        depr_long_life = calculate_straight_line_depreciation(
            long_life_basis, year, long_life_years, hold_period
        )
        
        # Bonus only in year 1
        bonus_this_year = year_1_bonus if year == 1 else 0.0
        
        total_depr = bonus_this_year + depr_5yr + depr_7yr + depr_15yr + depr_long_life
        cumulative_depr += total_depr
        
        # Track by category
        if year == 1:
            accumulated_5yr += five_year_basis * bonus_pct + depr_5yr
            accumulated_7yr += seven_year_basis * bonus_pct + depr_7yr
            accumulated_15yr += fifteen_year_basis * bonus_pct + depr_15yr
        else:
            accumulated_5yr += depr_5yr
            accumulated_7yr += depr_7yr
            accumulated_15yr += depr_15yr
        accumulated_long_life += depr_long_life
        
        depreciation_schedule.append(DepreciationSchedule(
            year=year,
            bonus_depreciation=bonus_this_year,
            five_year_depreciation=depr_5yr,
            seven_year_depreciation=depr_7yr,
            fifteen_year_depreciation=depr_15yr,
            long_life_depreciation=depr_long_life,
            total_depreciation=total_depr,
            cumulative_depreciation=cumulative_depr
        ))
    
    # ==========================================================================
    # STEP 4: Calculate annual tax impact
    # ==========================================================================
    
    annual_tax_impact = []
    original_basis = inputs.purchase_price + inputs.closing_costs
    
    for i, depr in enumerate(depreciation_schedule):
        year = depr.year
        
        # Get pre-tax cash flow
        if i < len(inputs.pre_tax_cash_flows):
            pre_tax_cf = inputs.pre_tax_cash_flows[i]
        else:
            pre_tax_cf = inputs.pre_tax_cash_flows[-1] if inputs.pre_tax_cash_flows else 0.0
        
        # Taxable income = Pre-tax CF - Depreciation
        taxable_income = pre_tax_cf - depr.total_depreciation
        
        # Tax liability (negative taxable income creates tax benefit)
        if taxable_income > 0:
            tax_liability = taxable_income * marginal_rate
        else:
            # Tax benefit (can offset other passive income)
            tax_liability = taxable_income * marginal_rate  # Negative = benefit
        
        # After-tax cash flow
        after_tax_cf = pre_tax_cf - tax_liability
        
        # Adjusted basis at end of year
        adjusted_basis = original_basis - depr.cumulative_depreciation
        
        annual_tax_impact.append(TaxYearResult(
            year=year,
            pre_tax_cash_flow=pre_tax_cf,
            bonus_depreciation=depr.bonus_depreciation,
            five_year_depreciation=depr.five_year_depreciation,
            fifteen_year_depreciation=depr.fifteen_year_depreciation,
            long_life_depreciation=depr.long_life_depreciation,
            total_depreciation=depr.total_depreciation,
            taxable_income=taxable_income,
            tax_liability=tax_liability,
            after_tax_cash_flow=after_tax_cf,
            cumulative_depreciation=depr.cumulative_depreciation,
            adjusted_basis=adjusted_basis
        ))
    
    # ==========================================================================
    # STEP 5: Exit Tax Analysis
    # ==========================================================================
    
    # Calculate sale price
    if inputs.exit_sale_price > 0:
        sale_price = inputs.exit_sale_price
    elif inputs.exit_noi > 0 and inputs.exit_cap_rate > 0:
        sale_price = inputs.exit_noi / (inputs.exit_cap_rate / 100.0)
    else:
        sale_price = inputs.purchase_price * 1.2  # Default 20% appreciation
    
    selling_costs = sale_price * (inputs.selling_costs_percent / 100.0)
    net_sale_proceeds = sale_price - selling_costs
    
    # Final accumulated depreciation
    total_accumulated_depr = cumulative_depr
    accumulated_depr_5_7 = accumulated_5yr + accumulated_7yr
    accumulated_depr_15 = accumulated_15yr
    accumulated_depr_long_life = accumulated_long_life
    
    # Adjusted basis at sale
    adjusted_basis = original_basis - total_accumulated_depr
    
    # Total gain
    total_gain = net_sale_proceeds - adjusted_basis
    
    # Depreciation recapture breakdown
    # 5-year and 7-year property: ordinary income recapture (§1245)
    recapture_5_7 = min(accumulated_depr_5_7, total_gain)
    remaining_gain = max(0, total_gain - recapture_5_7)
    
    # 15-year property: ordinary income recapture (§1245)
    recapture_15 = min(accumulated_depr_15, remaining_gain)
    remaining_gain = max(0, remaining_gain - recapture_15)
    
    # Long-life (real property): unrecaptured §1250 gain (max 25%)
    unrecaptured_1250 = min(accumulated_depr_long_life, remaining_gain)
    remaining_gain = max(0, remaining_gain - unrecaptured_1250)
    
    # Remaining is long-term capital gain
    ltcg = remaining_gain
    
    # Calculate taxes
    tax_on_5_7_recapture = recapture_5_7 * marginal_rate
    tax_on_15_recapture = recapture_15 * marginal_rate
    tax_on_1250 = unrecaptured_1250 * unrecaptured_1250_rate
    tax_on_ltcg = ltcg * ltcg_rate
    
    total_exit_tax = tax_on_5_7_recapture + tax_on_15_recapture + tax_on_1250 + tax_on_ltcg
    after_tax_proceeds = net_sale_proceeds - total_exit_tax
    
    exit_taxes = ExitTaxBreakdown(
        sale_price=sale_price,
        selling_costs=selling_costs,
        net_sale_proceeds=net_sale_proceeds,
        original_basis=original_basis,
        accumulated_depreciation=total_accumulated_depr,
        adjusted_basis=adjusted_basis,
        total_gain=total_gain,
        recapture_5_7_year=recapture_5_7,
        recapture_15_year=recapture_15,
        unrecaptured_1250_gain=unrecaptured_1250,
        long_term_capital_gain=ltcg,
        tax_on_personal_recapture=tax_on_5_7_recapture,
        tax_on_land_improvements_recapture=tax_on_15_recapture,
        tax_on_unrecaptured_1250=tax_on_1250,
        tax_on_ltcg=tax_on_ltcg,
        total_exit_tax=total_exit_tax,
        after_tax_proceeds=after_tax_proceeds
    )
    
    # ==========================================================================
    # STEP 6: Calculate After-Tax IRR and Equity Multiple
    # ==========================================================================
    
    # Build cash flow array for IRR
    initial_equity = inputs.initial_equity if inputs.initial_equity > 0 else \
        inputs.purchase_price * 0.25 + inputs.closing_costs  # Default 25% down
    
    cash_flows = [-initial_equity]  # Year 0: Initial investment (negative)
    
    for i, tax_year in enumerate(annual_tax_impact):
        cf = tax_year.after_tax_cash_flow
        
        # Add after-tax sale proceeds in final year
        if i == len(annual_tax_impact) - 1:
            cf += after_tax_proceeds
        
        cash_flows.append(cf)
    
    # Calculate IRR
    try:
        after_tax_irr = npf.irr(cash_flows) * 100  # Convert to percentage
        if math.isnan(after_tax_irr):
            after_tax_irr = 0.0
    except:
        after_tax_irr = 0.0
    
    # Calculate equity multiple
    total_distributions = sum(t.after_tax_cash_flow for t in annual_tax_impact) + after_tax_proceeds
    equity_multiple = total_distributions / initial_equity if initial_equity > 0 else 0.0
    
    # Year 1 summary
    year_1_macrs = depreciation_schedule[0].five_year_depreciation + \
                   depreciation_schedule[0].seven_year_depreciation + \
                   depreciation_schedule[0].fifteen_year_depreciation + \
                   depreciation_schedule[0].long_life_depreciation
    year_1_total = depreciation_schedule[0].total_depreciation
    year_1_tax_shield = year_1_total * marginal_rate
    
    return CostSegResult(
        land_value=land_value,
        building_value=building_value,
        five_year_basis=five_year_basis,
        seven_year_basis=seven_year_basis,
        fifteen_year_basis=fifteen_year_basis,
        long_life_basis=long_life_basis,
        depreciable_basis=depreciable_basis,
        year_1_bonus_depreciation=year_1_bonus,
        year_1_macrs_depreciation=year_1_macrs,
        year_1_total_depreciation=year_1_total,
        year_1_tax_shield=year_1_tax_shield,
        after_tax_irr=after_tax_irr,
        after_tax_equity_multiple=equity_multiple,
        total_depreciation_over_hold=cumulative_depr,
        depreciation_schedule=depreciation_schedule,
        annual_tax_impact=annual_tax_impact,
        exit_taxes=exit_taxes
    )


def calculate_standard_depreciation_comparison(
    inputs: CostSegInputs
) -> Dict[str, float]:
    """
    Calculate after-tax IRR without cost segregation (standard straight-line only).
    Used to show the benefit of cost seg.
    """
    # Create modified inputs with no cost seg allocation
    standard_inputs = inputs.copy()
    standard_inputs.five_year_percent = 0.0
    standard_inputs.seven_year_percent = 0.0
    standard_inputs.fifteen_year_percent = 0.0
    standard_inputs.bonus_depreciation_percent = 0.0
    
    result = calculate_cost_seg_analysis(standard_inputs)
    
    return {
        "standard_irr": result.after_tax_irr,
        "standard_multiple": result.after_tax_equity_multiple
    }


def extract_cost_seg_inputs_from_deal(
    deal_json: Dict[str, Any],
    overrides: Dict[str, Any] = None
) -> CostSegInputs:
    """
    Extract cost segregation inputs from parsed deal JSON.
    Applies sensible defaults and allows user overrides.
    """
    property_data = deal_json.get("property", {})
    pricing = deal_json.get("pricing_financing", {})
    pnl = deal_json.get("pnl", {})
    expenses = deal_json.get("expenses", {})
    
    # Purchase price
    purchase_price = pricing.get("price", 0) or pricing.get("purchase_price", 0)
    if not purchase_price:
        purchase_price = 1000000  # Default
    
    # Land value / building split
    # Try to get from deal, otherwise default to 80% building / 20% land
    land_value = property_data.get("land_value", 0)
    if land_value > 0:
        land_percent = (land_value / purchase_price) * 100
    else:
        land_percent = 20.0  # Default
    
    # Closing costs (estimate if not provided)
    closing_costs = pricing.get("closing_costs", 0)
    if not closing_costs:
        closing_costs = purchase_price * 0.02  # Default 2%
    
    # Property type
    property_type = property_data.get("type", "").lower()
    is_residential = "multifamily" in property_type or "apartment" in property_type or \
                     "residential" in property_type or not property_type
    
    # Hold period
    hold_period = pricing.get("hold_period", 5) or 5
    
    # Exit assumptions
    exit_cap_rate = pricing.get("exit_cap_rate", 6.0) or 6.0
    exit_noi = pnl.get("exit_noi", 0) or pnl.get("noi", 0)
    
    # Try to get projections for pre-tax cash flows
    projections = deal_json.get("projections", [])
    pre_tax_cash_flows = []
    
    if projections:
        for proj in projections:
            cf = proj.get("cashFlow", 0) or proj.get("cash_flow", 0) or \
                 proj.get("leveredCashFlow", 0)
            pre_tax_cash_flows.append(cf)
    
    # If no projections, estimate from NOI
    if not pre_tax_cash_flows:
        noi = pnl.get("noi", 0)
        debt_service = pricing.get("annual_debt_service", 0)
        annual_cf = noi - debt_service
        pre_tax_cash_flows = [annual_cf * (1.03 ** i) for i in range(hold_period)]
    
    # Initial equity
    down_payment_pct = pricing.get("down_payment_pct", 25) or 25
    down_payment = purchase_price * (down_payment_pct / 100)
    initial_equity = down_payment + closing_costs
    
    # Build inputs
    inputs = CostSegInputs(
        purchase_price=purchase_price,
        land_percent=land_percent,
        closing_costs=closing_costs,
        is_residential=is_residential,
        hold_period_years=hold_period,
        exit_cap_rate=exit_cap_rate,
        exit_noi=exit_noi,
        pre_tax_cash_flows=pre_tax_cash_flows,
        initial_equity=initial_equity
    )
    
    # Apply any user overrides
    if overrides:
        for key, value in overrides.items():
            if hasattr(inputs, key) and value is not None:
                setattr(inputs, key, value)
    
    return inputs
