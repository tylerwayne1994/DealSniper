# DealSniper V2 - Comprehensive Calculation Engine Features

## Overview
The V2 underwriter now includes a complete, institutional-grade real estate financial analysis engine matching the Deal Manager's Google Sheet functionality.

---

## Core Calculation Engine (`realEstateCalculations.js`)

### Main Function: `calculateFullAnalysis(scenarioData, options)`
Returns a comprehensive analysis object with all metrics, projections, and advanced features.

---

## Feature Set

### 1. **Core Financial Metrics**
✅ **Year 1 Underwriting**
- Potential Gross Income (PGI)
- Vacancy & Collection Loss
- Effective Gross Income (EGI)
- Operating Expenses
- Net Operating Income (NOI)
- Cap Rate
- DSCR (Debt Service Coverage Ratio)
- Debt Yield
- Cash-on-Cash Return
- Expense Ratio

✅ **IRR Calculations**
- Levered IRR (with debt)
- Unlevered IRR (without debt)
- Uses Newton-Raphson method for accuracy
- IRR calculated for each potential exit year (Years 1-10)

✅ **Equity Multiples**
- Levered Equity Multiple
- Unlevered Equity Multiple
- Total Cash Returned
- Total Profit

---

### 2. **Multi-Year Projections (10 Years)**
For each projection year:
- Potential Gross Income with growth
- Vacancy Loss
- Other Income
- Effective Gross Income
- Operating Expenses with inflation
- NOI
- Tenant Improvements (TI)
- Leasing Commissions (LC)
- Misc CapEx
- Total CapEx
- Cash Flow from Operations
- Debt Service
- Loan Balance (tracks paydown)
- Cash Flow After Financing
- Exit Scenario Analysis (if sold in that year)
- DSCR, Debt Yield, Cash-on-Cash
- Per SF Metrics (Rent PSF, Expenses PSF, NOI PSF)
- Operating Ratios

---

### 3. **Advanced Acquisition Analysis**
✅ **Pricing Metrics**
- Purchase Price
- Price Per SF
- Price Per Unit
- Closing Costs
- Acquisition Fees
- Upfront CapEx
- Total Acquisition Costs

✅ **Valuation Comparison**
- **DCF Value**: Present value of all cash flows + discounted terminal value
- **Terminal Value**: Terminal NOI / Exit Cap Rate
- **Calculated Purchase Price**: Year 1 NOI / Market Cap Rate
- **Replacement Cost**: Net Rentable SF × Replacement Cost PSF
- Helps identify if deal is trading at discount or premium

---

### 4. **Financing Analysis**
✅ **Loan Structure**
- Loan Amount
- LTV (Loan-to-Value)
- Interest Rate
- Loan Term
- Amortization Period
- Interest-Only Period
- Loan Fees
- Financing Fees
- Net Loan Funding
- Monthly Payment
- Annual Debt Service
- Total Equity Required

✅ **Sources & Uses**
Complete breakdown of:
- **Sources**: Loan amount + Equity
- **Uses**: Purchase price, closing costs, fees, CapEx

---

### 5. **Exit Scenario Analysis**
✅ **Multiple Exit Strategies**
- IRR for each potential exit year (1-10)
- Equity Multiple by exit year
- Total Cash Returned
- Total Profit
- Gross Sales Price
- Selling Costs (2%)
- Net Sales Proceeds
- Loan Payoff
- Reversion Cash Flow

✅ **Terminal Value Calculation**
- Uses discount rate method
- Terminal NOI / Exit Cap Rate
- Discounted back to present value

---

### 6. **CapEx Breakdown**
✅ **Separate Tracking**
- **Tenant Improvements**: Applied Year 1 and final year of hold
- **Leasing Commissions**: % of revenue in turnover years
- **Misc CapEx**: Recurring maintenance CapEx
- **CapEx as % of NOI**: Operating metric

---

### 7. **Operating Metrics**
✅ **Performance Ratios**
- Rent Per SF
- Expenses Per SF
- NOI Per SF
- Expense Ratio (OpEx / EGI)
- Expense Recovery % (for triple net leases)
- CapEx as % of NOI
- Tax Mill Rate

---

### 8. **Partnership Waterfall (Basic)**
✅ **GP/LP Distribution**
- Return of Capital
- Preferred Return (8% default)
- GP Catch-Up
- Promote Split (80/20 default)
- Calculated for both partners

---

## NEW ADVANCED FEATURES

### 9. **Loan Amortization Schedule** ⭐ NEW
Function: `calculateAmortizationSchedule(principal, annualRate, amortYears, years)`

**Returns year-by-year:**
- Total Payment
- Principal Portion
- Interest Portion
- Remaining Balance
- Cumulative Principal Paid

**Use Case**: See exactly how much principal is being paid down vs interest each year.

---

### 10. **Sensitivity Analysis** ⭐ NEW
Function: `calculateSensitivity(baseScenario, ranges)`

**Tests multiple variables:**
- **Purchase Price Sensitivity**: How returns change with different purchase prices
- **Exit Cap Rate Sensitivity**: Impact of different exit cap rates on IRR
- **Income Growth Sensitivity**: Returns across different growth assumptions
- **Vacancy Sensitivity**: Impact of vacancy on NOI and returns

**Returns**: Tables showing IRR, Equity Multiple, and Cash-on-Cash across each variable range.

**Use Case**: Understand downside protection and upside potential.

---

### 11. **Rent Roll Analysis** ⭐ NEW
Function: `analyzeRentRoll(unitMix, marketAssumptions)`

**Per Unit Analysis:**
- Current Rent PSF vs Market Rent PSF
- Annual Rent (Current vs Market)
- Loss to Lease ($$ and %)
- Lease End Date
- Vacancy Status
- Renewal Probability
- Estimated Downtime (months)
- Estimated TI Cost
- Estimated LC Cost

**Portfolio Summary:**
- Total Units / SF
- Occupied vs Vacant breakdown
- Total Current Rent
- Total Market Rent
- Average Current Rent PSF
- Average Market Rent PSF
- Portfolio Loss to Lease

**Lease Expiration Schedule:**
- Units expiring by year
- SF expiring by year
- Annual rent at risk

**Use Case**: Identify lease-up opportunities, re-tenanting costs, and revenue upside.

---

### 12. **Management Fee Tracking** ⭐ NEW
Function: `calculateManagementFees(dealData, projections)`

**Fee Types:**
1. **Acquisition Fee**: % of Purchase Price (typically 1%)
2. **Asset Management Fee**: Annual % of EGI (typically 1-2%)
3. **Disposition Fee**: % of Sales Price (typically 1%)

**Returns:**
- Acquisition fee amount
- Year-by-year asset management fees
- Disposition fee at exit
- Basis for each fee
- Rate/percentage

**Use Case**: Track GP compensation, model net returns to LP after all fees.

---

### 13. **Multi-Tier Partnership Waterfall** ⭐ NEW
Function: `calculateMultiTierWaterfall(cashFlows, structure)`

**Waterfall Tiers:**
1. **Return of Capital**: LP/GP get back contributions
2. **Preferred Return**: LP receives preferred return (e.g., 8% IRR hurdle)
3. **GP Catch-Up**: GP catches up until achieving promote %
4. **Promote Tier 1**: Split (e.g., 80/20) up to next hurdle
5. **Promote Tier 2**: Different split above higher IRR hurdle

**Returns:**
- Distribution by tier
- LP total and breakdown by tier
- GP total and breakdown by tier
- Promote calculations based on IRR hurdles

**Use Case**: Model complex promote structures with multiple IRR hurdles (common in institutional funds).

---

### 14. **Tax Analysis & Depreciation** ⭐ NEW
Function: `calculateTaxAnalysis(dealData, projections, taxAssumptions)`

**Depreciation:**
- Building Value (excludes land %)
- Land Value
- Depreciation Period (27.5 years residential, 39 years commercial)
- Annual Depreciation Amount
- Cumulative Depreciation

**Year-by-Year Tax Impact:**
- Pre-Tax Cash Flow
- Depreciation Deduction
- Taxable Income
- Tax Liability (at specified rate)
- After-Tax Cash Flow
- Cumulative Depreciation

**Exit Tax Analysis:**
- Sales Price
- Adjusted Basis (Purchase Price - Depreciation)
- Capital Gain
- Capital Gains Tax (20% long-term rate)
- Depreciation Recapture Tax (25% rate)
- Total Tax on Sale
- After-Tax Proceeds

**After-Tax Returns:**
- After-Tax IRR
- After-Tax Equity Multiple

**Use Case**: Model true investor returns after all tax impacts, show tax shelter benefits.

---

### 15. **Month-by-Month Year 1 Analysis** ⭐ NEW
Function: `calculateMonthlyYear1(year1Data, assumptions)`

**Monthly Breakdown:**
- Income (with stabilization ramp)
- Expenses
- NOI
- Debt Service
- Cash Flow
- Occupancy %

**Stabilization Modeling:**
- Initial Occupancy (e.g., 85%)
- Target Occupancy (e.g., 95%)
- Stabilization Month (when target is reached)
- Linear ramp-up

**Use Case**: Model lease-up or value-add properties where Year 1 isn't stabilized.

---

## Integration with Main Analysis

All advanced features are **automatically calculated** when calling `calculateFullAnalysis()`:

```javascript
const analysis = calculateFullAnalysis(scenarioData);

// Core metrics
analysis.year1
analysis.returns
analysis.projections
analysis.financing

// Advanced features
analysis.amortizationSchedule      // Loan paydown schedule
analysis.sensitivity               // Sensitivity tables
analysis.rentRollAnalysis          // Unit-level analysis
analysis.managementFees            // Fee breakdown
analysis.multiTierWaterfall        // Complex partnership splits
analysis.taxAnalysis               // Depreciation & after-tax returns
analysis.monthlyYear1              // Month-by-month Year 1
```

---

## Calculation Methods

### IRR Calculation
- **Method**: Newton-Raphson iterative convergence
- **Tolerance**: 1e-6
- **Max Iterations**: 100
- **Initial Guess**: 10%

### NPV Calculation
- Standard discounted cash flow method
- Uses specified discount rate

### Mortgage Calculations
- Standard amortization formulas
- Handles Interest-Only periods
- Tracks principal paydown

---

## Data Requirements

### Minimum Required Fields:
- `pricing_financing.purchase_price`
- `pricing_financing.ltv`
- `financing.interest_rate`
- `financing.loan_term_years`
- `pnl.current_revenue`
- `pnl.operating_expenses`
- `underwriting.holding_period`

### Optional Fields (enhance analysis):
- `unit_mix[]` - Enables rent roll analysis
- `property.net_rentable_sf` - Enables per-SF metrics
- `underwriting.exit_cap_rate` - Exit modeling
- `underwriting.income_growth_rate` - Projections
- `underwriting.expense_growth_rate` - Expense inflation

---

## Export Functions

All functions are exported and can be used independently:

```javascript
import {
  calculateFullAnalysis,          // Main comprehensive analysis
  calculateIRR,                    // Standalone IRR
  calculateNPV,                    // Standalone NPV
  calculateMortgagePayment,        // Mortgage payment
  calculateLoanBalance,            // Loan balance at year X
  calculateWaterfall,              // Basic waterfall
  calculateAmortizationSchedule,   // Loan amortization
  calculateSensitivity,            // Sensitivity analysis
  analyzeRentRoll,                 // Rent roll analysis
  calculateManagementFees,         // Fee tracking
  calculateMultiTierWaterfall,     // Advanced waterfall
  calculateTaxAnalysis,            // Tax & depreciation
  calculateMonthlyYear1            // Monthly breakdown
} from './utils/realEstateCalculations';
```

---

## Summary

The calculation engine now includes **EVERY** major feature from institutional-grade real estate underwriting models:

✅ Core underwriting (NOI, cap rate, DSCR)
✅ IRR & equity multiples
✅ Multi-year projections
✅ DCF & terminal value analysis
✅ Loan amortization schedules
✅ Sensitivity analysis (stress testing)
✅ Rent roll analysis (unit-level)
✅ Management fee tracking
✅ Multi-tier partnership waterfalls with IRR hurdles
✅ Tax analysis with depreciation
✅ Month-by-month Year 1 breakdown
✅ CapEx tracking (TI, LC, recurring)
✅ Exit scenario modeling
✅ Operating metrics & ratios
✅ Sources & uses

**This matches or exceeds the functionality of the Deal Manager's Google Sheet model.**
