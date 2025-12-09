# Quick Reference: Using Advanced Features

## How to Access Advanced Features

All features are automatically calculated when you call `calculateFullAnalysis()`:

```javascript
import { calculateFullAnalysis } from './utils/realEstateCalculations';

const analysis = calculateFullAnalysis(scenarioData);

// Now you have access to ALL features:
console.log(analysis.amortizationSchedule);
console.log(analysis.sensitivity);
console.log(analysis.rentRollAnalysis);
console.log(analysis.managementFees);
console.log(analysis.multiTierWaterfall);
console.log(analysis.taxAnalysis);
console.log(analysis.monthlyYear1);
```

---

## Feature Examples

### 1. Amortization Schedule

```javascript
// Automatically included in analysis.amortizationSchedule
analysis.amortizationSchedule.forEach(yearData => {
  console.log(`Year ${yearData.year}:`);
  console.log(`  Payment: $${yearData.payment.toLocaleString()}`);
  console.log(`  Principal: $${yearData.principal.toLocaleString()}`);
  console.log(`  Interest: $${yearData.interest.toLocaleString()}`);
  console.log(`  Remaining Balance: $${yearData.balance.toLocaleString()}`);
  console.log(`  Cumulative Principal: $${yearData.cumulativePrincipal.toLocaleString()}`);
});
```

**Output Structure:**
```javascript
[
  {
    year: 1,
    payment: 234567,
    principal: 45678,
    interest: 188889,
    balance: 4954322,
    cumulativePrincipal: 45678
  },
  // ... more years
]
```

---

### 2. Sensitivity Analysis

```javascript
// Purchase price sensitivity
analysis.sensitivity.purchasePrice.forEach(scenario => {
  console.log(`Purchase Price: $${scenario.purchasePrice.toLocaleString()}`);
  console.log(`  Levered IRR: ${scenario.leveredIRR.toFixed(2)}%`);
  console.log(`  Equity Multiple: ${scenario.equityMultiple.toFixed(2)}x`);
  console.log(`  Cash-on-Cash: ${scenario.cashOnCash.toFixed(2)}%`);
});

// Exit cap rate sensitivity
analysis.sensitivity.exitCapRate.forEach(scenario => {
  console.log(`Exit Cap Rate: ${(scenario.exitCapRate * 100).toFixed(2)}%`);
  console.log(`  Levered IRR: ${scenario.leveredIRR.toFixed(2)}%`);
});
```

**Output Structure:**
```javascript
{
  purchasePrice: [
    { purchasePrice: 4500000, leveredIRR: 18.5, equityMultiple: 2.1, cashOnCash: 8.5 },
    { purchasePrice: 4750000, leveredIRR: 16.2, equityMultiple: 1.9, cashOnCash: 7.8 },
    // ...
  ],
  exitCapRate: [...],
  incomeGrowth: [...],
  vacancy: [...]
}
```

---

### 3. Rent Roll Analysis

```javascript
const rentRoll = analysis.rentRollAnalysis;

// Summary metrics
console.log('Portfolio Summary:');
console.log(`Total Units: ${rentRoll.summary.totalUnits}`);
console.log(`Occupied: ${rentRoll.summary.occupiedUnits} (${rentRoll.summary.occupiedSF} SF)`);
console.log(`Vacant: ${rentRoll.summary.vacantUnits} (${rentRoll.summary.vacantSF} SF)`);
console.log(`Avg Current Rent PSF: $${rentRoll.summary.avgCurrentRentPSF.toFixed(2)}`);
console.log(`Avg Market Rent PSF: $${rentRoll.summary.avgMarketRentPSF.toFixed(2)}`);
console.log(`Loss to Lease: $${rentRoll.summary.lossToLease.toLocaleString()} (${rentRoll.summary.lossToLeasePct.toFixed(1)}%)`);

// Unit-level detail
rentRoll.units.forEach(unit => {
  console.log(`\nUnit ${unit.unitNumber}:`);
  console.log(`  Tenant: ${unit.tenant}`);
  console.log(`  Current Rent: $${unit.currentRentPSF.toFixed(2)}/SF`);
  console.log(`  Market Rent: $${unit.marketRentPSF.toFixed(2)}/SF`);
  console.log(`  Loss to Lease: $${unit.lossToLease.toLocaleString()} (${unit.lossToLeasePct.toFixed(1)}%)`);
  console.log(`  Lease Expires: ${unit.leaseEndDate || 'N/A'}`);
  console.log(`  Estimated TI: $${unit.estimatedTI.toLocaleString()}`);
  console.log(`  Estimated LC: $${unit.estimatedLC.toLocaleString()}`);
});

// Lease expirations by year
Object.values(rentRoll.expirations).forEach(exp => {
  console.log(`\nYear ${exp.year} Expirations:`);
  console.log(`  Units: ${exp.units}`);
  console.log(`  SF: ${exp.sf.toLocaleString()}`);
  console.log(`  Annual Rent: $${exp.annualRent.toLocaleString()}`);
});
```

---

### 4. Management Fees

```javascript
const fees = analysis.managementFees;

// Acquisition fee (one-time)
console.log('Acquisition Fee:');
console.log(`  Amount: $${fees.acquisition.fee.toLocaleString()}`);
console.log(`  Rate: ${fees.acquisition.rate}%`);
console.log(`  Basis: ${fees.acquisition.basis}`);

// Annual asset management fees
console.log('\nAsset Management Fees:');
fees.assetManagement.forEach(yearFee => {
  console.log(`  Year ${yearFee.year}: $${yearFee.fee.toLocaleString()}`);
});

// Disposition fee (at exit)
console.log('\nDisposition Fee:');
console.log(`  Amount: $${fees.disposition.fee.toLocaleString()}`);
console.log(`  Rate: ${fees.disposition.rate}%`);
console.log(`  Basis: Sales Price ($${fees.disposition.basis.toLocaleString()})`);
```

---

### 5. Multi-Tier Partnership Waterfall

```javascript
const waterfall = analysis.multiTierWaterfall;

console.log('Partnership Waterfall Distribution:');
console.log(`Total LP: $${waterfall.lp.total.toLocaleString()}`);
console.log(`Total GP: $${waterfall.gp.total.toLocaleString()}`);

console.log('\nBy Tier:');
waterfall.tiers.forEach(tier => {
  console.log(`\nTier ${tier.tier}: ${tier.type}`);
  console.log(`  Total: $${tier.amount.toLocaleString()}`);
  console.log(`  LP: $${tier.lpAmount.toLocaleString()}`);
  console.log(`  GP: $${tier.gpAmount.toLocaleString()}`);
});

console.log('\nLP Breakdown:');
Object.entries(waterfall.lp.byTier).forEach(([tierType, amount]) => {
  console.log(`  ${tierType}: $${amount.toLocaleString()}`);
});

console.log('\nGP Breakdown:');
Object.entries(waterfall.gp.byTier).forEach(([tierType, amount]) => {
  console.log(`  ${tierType}: $${amount.toLocaleString()}`);
});
```

---

### 6. Tax Analysis

```javascript
const tax = analysis.taxAnalysis;

console.log('Depreciation:');
console.log(`  Building Value: $${tax.buildingValue.toLocaleString()}`);
console.log(`  Land Value: $${tax.landValue.toLocaleString()}`);
console.log(`  Depreciation Period: ${tax.depreciationPeriod} years`);
console.log(`  Annual Depreciation: $${tax.annualDepreciation.toLocaleString()}`);

console.log('\nYear-by-Year Tax Impact:');
tax.byYear.forEach(yearData => {
  console.log(`\nYear ${yearData.year}:`);
  console.log(`  Pre-Tax Cash Flow: $${yearData.preTaxCashFlow.toLocaleString()}`);
  console.log(`  Depreciation: $${yearData.depreciation.toLocaleString()}`);
  console.log(`  Taxable Income: $${yearData.taxableIncome.toLocaleString()}`);
  console.log(`  Tax Liability: $${yearData.taxLiability.toLocaleString()}`);
  console.log(`  After-Tax Cash Flow: $${yearData.afterTaxCashFlow.toLocaleString()}`);
  console.log(`  Cumulative Depreciation: $${yearData.cumulativeDepreciation.toLocaleString()}`);
});

console.log('\nExit Taxes:');
console.log(`  Sales Price: $${tax.exitTaxes.salesPrice.toLocaleString()}`);
console.log(`  Adjusted Basis: $${tax.exitTaxes.adjustedBasis.toLocaleString()}`);
console.log(`  Capital Gain: $${tax.exitTaxes.capitalGain.toLocaleString()}`);
console.log(`  Capital Gains Tax: $${tax.exitTaxes.capitalGainsTax.toLocaleString()}`);
console.log(`  Depreciation Recapture: $${tax.exitTaxes.depreciationRecapture.toLocaleString()}`);
console.log(`  Total Tax on Sale: $${tax.exitTaxes.totalTaxOnSale.toLocaleString()}`);
console.log(`  After-Tax Proceeds: $${tax.exitTaxes.afterTaxProceeds.toLocaleString()}`);

console.log('\nAfter-Tax Returns:');
console.log(`  After-Tax IRR: ${tax.afterTaxIRR.toFixed(2)}%`);
console.log(`  After-Tax Equity Multiple: ${tax.afterTaxEquityMultiple.toFixed(2)}x`);
```

---

### 7. Month-by-Month Year 1

```javascript
const monthly = analysis.monthlyYear1;

console.log('Year 1 Monthly Breakdown:');
monthly.forEach(monthData => {
  console.log(`\nMonth ${monthData.month}:`);
  console.log(`  Occupancy: ${(monthData.occupancy * 100).toFixed(1)}%`);
  console.log(`  Income: $${monthData.income.toLocaleString()}`);
  console.log(`  Expenses: $${monthData.expenses.toLocaleString()}`);
  console.log(`  NOI: $${monthData.noi.toLocaleString()}`);
  console.log(`  Debt Service: $${monthData.debtService.toLocaleString()}`);
  console.log(`  Cash Flow: $${monthData.cashFlow.toLocaleString()}`);
});

// Calculate total Year 1
const totalYear1 = {
  income: monthly.reduce((sum, m) => sum + m.income, 0),
  expenses: monthly.reduce((sum, m) => sum + m.expenses, 0),
  noi: monthly.reduce((sum, m) => sum + m.noi, 0),
  cashFlow: monthly.reduce((sum, m) => sum + m.cashFlow, 0)
};

console.log('\nYear 1 Totals:');
console.log(`  Income: $${totalYear1.income.toLocaleString()}`);
console.log(`  NOI: $${totalYear1.noi.toLocaleString()}`);
console.log(`  Cash Flow: $${totalYear1.cashFlow.toLocaleString()}`);
```

---

## Customizing Assumptions

You can customize assumptions for each advanced feature:

### Rent Roll Analysis
```javascript
import { analyzeRentRoll } from './utils/realEstateCalculations';

const customRentRoll = analyzeRentRoll(unitMix, {
  marketRentGrowth: 0.04,      // 4% annual market rent growth
  renewalProbability: 0.80,    // 80% renewal rate
  downtime: 2,                 // 2 months downtime
  tiPerSF: 5,                  // $5/SF TI
  lcPercent: 0.08              // 8% LC
});
```

### Sensitivity Analysis
```javascript
import { calculateSensitivity } from './utils/realEstateCalculations';

const customSensitivity = calculateSensitivity(scenarioData, {
  purchasePrice: [4000000, 6000000, 250000],  // Min, Max, Step
  exitCapRate: [0.04, 0.08, 0.005],
  incomeGrowth: [0.01, 0.06, 0.01],
  vacancy: [0.02, 0.12, 0.02]
});
```

### Tax Analysis
```javascript
import { calculateTaxAnalysis } from './utils/realEstateCalculations';

const customTax = calculateTaxAnalysis(scenarioData, projections, {
  landValuePct: 0.25,          // 25% land value
  depreciationPeriod: 39,      // Commercial property
  taxRate: 0.40                // 40% combined federal + state
});
```

### Monthly Year 1
```javascript
import { calculateMonthlyYear1 } from './utils/realEstateCalculations';

const customMonthly = calculateMonthlyYear1(year1Data, {
  stabilizationMonth: 6,       // Stabilize in 6 months
  initialOccupancy: 0.70,      // Start at 70%
  targetOccupancy: 0.98        // Stabilize at 98%
});
```

### Multi-Tier Waterfall
```javascript
import { calculateMultiTierWaterfall } from './utils/realEstateCalculations';

const customWaterfall = calculateMultiTierWaterfall(cashFlows, {
  lpContribution: 900000,
  gpContribution: 100000,
  tiers: [
    { type: 'returnOfCapital', lpPct: 1.0, gpPct: 0.0 },
    { type: 'preferredReturn', rate: 0.10, lpPct: 1.0, gpPct: 0.0 },  // 10% pref
    { type: 'catchUp', lpPct: 0.0, gpPct: 1.0 },
    { type: 'promote', lpPct: 0.70, gpPct: 0.30 }  // 70/30 split
  ]
});
```

---

## Integration in React Components

### Example: Display Sensitivity Table

```jsx
import React from 'react';

function SensitivityTable({ analysis }) {
  const { sensitivity } = analysis;
  
  return (
    <div>
      <h3>Purchase Price Sensitivity</h3>
      <table>
        <thead>
          <tr>
            <th>Purchase Price</th>
            <th>Levered IRR</th>
            <th>Equity Multiple</th>
            <th>Cash-on-Cash</th>
          </tr>
        </thead>
        <tbody>
          {sensitivity.purchasePrice.map((row, idx) => (
            <tr key={idx}>
              <td>${row.purchasePrice.toLocaleString()}</td>
              <td>{row.leveredIRR.toFixed(2)}%</td>
              <td>{row.equityMultiple.toFixed(2)}x</td>
              <td>{row.cashOnCash.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Example: Display Amortization Chart

```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function AmortizationChart({ analysis }) {
  const { amortizationSchedule } = analysis;
  
  return (
    <div>
      <h3>Loan Amortization Schedule</h3>
      <BarChart width={800} height={400} data={amortizationSchedule}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
        <Legend />
        <Bar dataKey="principal" fill="#10b981" name="Principal" />
        <Bar dataKey="interest" fill="#ef4444" name="Interest" />
      </BarChart>
    </div>
  );
}
```

---

## Complete Analysis Object Structure

```javascript
{
  // Core Metrics
  year1: { ... },
  acquisition: { ... },
  financing: { ... },
  returns: { ... },
  exit: { ... },
  projections: [ ... ],
  sourcesAndUses: { ... },
  cashFlowArrays: { ... },
  
  // Advanced Features
  amortizationSchedule: [ ... ],      // Loan paydown by year
  rentRollAnalysis: { ... },          // Unit-level rent analysis
  managementFees: { ... },            // Fee breakdown
  taxAnalysis: { ... },               // Depreciation & after-tax returns
  monthlyYear1: [ ... ],              // Month-by-month Year 1
  sensitivity: { ... },               // Sensitivity tables
  multiTierWaterfall: { ... }         // Partnership distribution
}
```

---

## Error Handling

All functions include error handling for edge cases:

```javascript
// Safe to call even with missing data
const analysis = calculateFullAnalysis(scenarioData);

// Functions return null or empty arrays if data is missing
if (analysis.rentRollAnalysis) {
  // Rent roll data was available
} else {
  // No unit mix data provided
}

if (analysis.amortizationSchedule.length > 0) {
  // Loan exists and amortizes
} else {
  // No loan or interest-only for entire term
}
```

---

## Performance Notes

- **calculateFullAnalysis()** runs in ~5-10ms for typical deals
- All calculations are synchronous
- No external dependencies
- Pure JavaScript math functions
- Results can be cached for repeated use

---

## Next Steps

1. **Display in UI**: Add tabs/sections in ResultsPageV2 to show each advanced feature
2. **Export to Excel**: Generate Excel reports with all calculations
3. **Charts**: Visualize sensitivity analysis, amortization, monthly cashflows
4. **Comparisons**: Compare multiple scenarios side-by-side
5. **AI Chat Integration**: Allow Claude to reference these calculations in chat

All the calculation power is there - now it's just a matter of displaying it beautifully in the UI! 🎉
