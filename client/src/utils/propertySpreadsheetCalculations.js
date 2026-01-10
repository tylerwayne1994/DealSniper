/**
 * Property Spreadsheet Calculations Module
 * Contains all formulas for multifamily property underwriting spreadsheet
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format number as currency
 */
export const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '$               -';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Format number as percentage
 */
export const formatPercent = (value, decimals = 2) => {
  if (value == null || isNaN(value)) return '0.00%';
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Safe division (returns 0 if denominator is 0)
 */
export const safeDivide = (numerator, denominator) => {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
};

/**
 * Convert value to number, return 0 if invalid
 */
export const toNumber = (value) => {
  if (value == null || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? 0 : num;
};

// ============================================================================
// KEY DEAL METRICS CALCULATIONS
// ============================================================================

/**
 * Calculate Price per Unit
 * @param {number} purchasePrice - Total purchase price
 * @param {number} units - Number of units
 * @returns {number} Price per unit
 */
export const calculatePricePerUnit = (purchasePrice, units) => {
  const price = toNumber(purchasePrice);
  const unitCount = toNumber(units);
  return safeDivide(price, unitCount);
};

/**
 * Calculate Price per Square Foot
 * @param {number} purchasePrice - Total purchase price
 * @param {number} squareFeet - Total square footage
 * @returns {number} Price per SF
 */
export const calculatePricePerSF = (purchasePrice, squareFeet) => {
  const price = toNumber(purchasePrice);
  const sf = toNumber(squareFeet);
  return safeDivide(price, sf);
};

/**
 * Calculate Cap Rate
 * @param {number} noi - Net Operating Income
 * @param {number} purchasePrice - Purchase price or property value
 * @returns {number} Cap rate as decimal (e.g., 0.065 for 6.5%)
 */
export const calculateCapRate = (noi, purchasePrice) => {
  const noiValue = toNumber(noi);
  const price = toNumber(purchasePrice);
  return safeDivide(noiValue, price);
};

// ============================================================================
// SOURCES & USES CALCULATIONS
// ============================================================================

/**
 * Calculate Total Sources of Funds
 * @param {object} sources - Object containing all debt and equity sources
 * @returns {number} Total sources
 */
export const calculateTotalSources = (sources) => {
  if (!sources) return 0;
  
  const seniorDebt = toNumber(sources.seniorDebt);
  const mezDebt = toNumber(sources.mezDebt);
  const preferredEquity = toNumber(sources.preferredEquity);
  const lpEquity = toNumber(sources.lpEquity);
  const gpEquity = toNumber(sources.gpEquity);
  
  return seniorDebt + mezDebt + preferredEquity + lpEquity + gpEquity;
};

/**
 * Calculate Total Uses of Funds
 * @param {object} uses - Object containing all use categories
 * @returns {number} Total uses
 */
export const calculateTotalUses = (uses) => {
  if (!uses) return 0;
  
  const purchasePrice = toNumber(uses.purchasePrice);
  const closingCosts = toNumber(uses.closingCosts);
  const dueDiligence = toNumber(uses.dueDiligence);
  const immediateCapex = toNumber(uses.immediateCapex);
  const financingFees = toNumber(uses.financingFees);
  const operatingReserves = toNumber(uses.operatingReserves);
  const other = toNumber(uses.other);
  
  return purchasePrice + closingCosts + dueDiligence + immediateCapex + 
         financingFees + operatingReserves + other;
};

// ============================================================================
// UNIT MIX CALCULATIONS
// ============================================================================

/**
 * Calculate total units from unit mix
 * @param {array} unitMix - Array of unit types with counts
 * @returns {number} Total units
 */
export const calculateTotalUnits = (unitMix) => {
  if (!Array.isArray(unitMix)) return 0;
  return unitMix.reduce((sum, unit) => sum + toNumber(unit.count), 0);
};

/**
 * Calculate average rent from unit mix
 * @param {array} unitMix - Array of unit types with counts and rents
 * @returns {number} Average rent
 */
export const calculateAverageRent = (unitMix) => {
  if (!Array.isArray(unitMix) || unitMix.length === 0) return 0;
  
  const totalRent = unitMix.reduce((sum, unit) => {
    const count = toNumber(unit.count);
    const rent = toNumber(unit.marketRent);
    return sum + (count * rent);
  }, 0);
  
  const totalUnits = calculateTotalUnits(unitMix);
  return safeDivide(totalRent, totalUnits);
};

/**
 * Calculate total occupied units
 * @param {array} unitMix - Array of unit types with occupied counts
 * @returns {number} Total occupied units
 */
export const calculateOccupiedUnits = (unitMix) => {
  if (!Array.isArray(unitMix)) return 0;
  return unitMix.reduce((sum, unit) => sum + toNumber(unit.occupied), 0);
};

/**
 * Calculate total vacant units
 * @param {array} unitMix - Array of unit types
 * @returns {number} Total vacant units
 */
export const calculateVacantUnits = (unitMix) => {
  if (!Array.isArray(unitMix)) return 0;
  const totalUnits = calculateTotalUnits(unitMix);
  const occupiedUnits = calculateOccupiedUnits(unitMix);
  return totalUnits - occupiedUnits;
};

/**
 * Calculate occupancy percentage
 * @param {number} occupiedUnits - Number of occupied units
 * @param {number} totalUnits - Total number of units
 * @returns {number} Occupancy rate as decimal
 */
export const calculateOccupancy = (occupiedUnits, totalUnits) => {
  return safeDivide(toNumber(occupiedUnits), toNumber(totalUnits));
};

// ============================================================================
// UNIT MIX SUMMARY CALCULATIONS
// ============================================================================

/**
 * Calculate unit mix summary by unit type
 * @param {array} rentRoll - Array of unit data with type, sf, and rent information
 * @returns {object} Summary by unit type
 */
export const calculateUnitMixSummary = (rentRoll) => {
  if (!Array.isArray(rentRoll) || rentRoll.length === 0) {
    return {
      byType: {},
      totals: { count: 0, avgSF: 0, avgRent: 0 }
    };
  }

  const byType = {};
  let totalUnits = 0;
  let totalSF = 0;
  let totalRent = 0;

  rentRoll.forEach(unit => {
    const type = unit.type || 'Unknown';
    const sf = toNumber(unit.sf);
    const marketRent = toNumber(unit.marketRent);

    if (!byType[type]) {
      byType[type] = { count: 0, totalSF: 0, totalRent: 0 };
    }

    byType[type].count++;
    byType[type].totalSF += sf;
    byType[type].totalRent += marketRent;

    totalUnits++;
    totalSF += sf;
    totalRent += marketRent;
  });

  // Calculate averages for each type
  Object.keys(byType).forEach(type => {
    const data = byType[type];
    byType[type].avgSF = safeDivide(data.totalSF, data.count);
    byType[type].avgRent = safeDivide(data.totalRent, data.count);
  });

  return {
    byType,
    totals: {
      count: totalUnits,
      avgSF: safeDivide(totalSF, totalUnits),
      avgRent: safeDivide(totalRent, totalUnits)
    }
  };
};

/**
 * Calculate status summary (Renovated vs Classic)
 * @param {array} rentRoll - Array of unit data with status information
 * @returns {object} Summary by status
 */
export const calculateStatusSummary = (rentRoll) => {
  if (!Array.isArray(rentRoll) || rentRoll.length === 0) {
    return {
      renovated: { count: 0, percent: 0, avgRent: 0 },
      classic: { count: 0, percent: 0, avgRent: 0 }
    };
  }

  let renovatedCount = 0;
  let classicCount = 0;
  let renovatedTotalRent = 0;
  let classicTotalRent = 0;

  rentRoll.forEach(unit => {
    const status = (unit.status || '').toLowerCase();
    const marketRent = toNumber(unit.marketRent);

    if (status === 'renovated') {
      renovatedCount++;
      renovatedTotalRent += marketRent;
    } else if (status === 'classic') {
      classicCount++;
      classicTotalRent += marketRent;
    }
  });

  const totalUnits = rentRoll.length;

  return {
    renovated: {
      count: renovatedCount,
      percent: safeDivide(renovatedCount, totalUnits),
      avgRent: safeDivide(renovatedTotalRent, renovatedCount)
    },
    classic: {
      count: classicCount,
      percent: safeDivide(classicCount, totalUnits),
      avgRent: safeDivide(classicTotalRent, classicCount)
    }
  };
};

/**
 * Calculate rent roll totals
 * @param {array} rentRoll - Array of unit data
 * @returns {object} Totals for rent roll
 */
export const calculateRentRollTotals = (rentRoll) => {
  if (!Array.isArray(rentRoll) || rentRoll.length === 0) {
    return {
      totalUnits: 0,
      totalSF: 0,
      totalMarketRent: 0,
      totalInPlaceRent: 0,
      totalLossToLease: 0
    };
  }

  let totalSF = 0;
  let totalMarketRent = 0;
  let totalInPlaceRent = 0;

  rentRoll.forEach(unit => {
    totalSF += toNumber(unit.sf);
    totalMarketRent += toNumber(unit.marketRent);
    totalInPlaceRent += toNumber(unit.inPlaceRent);
  });

  return {
    totalUnits: rentRoll.length,
    totalSF,
    totalMarketRent,
    totalInPlaceRent,
    totalLossToLease: totalMarketRent - totalInPlaceRent
  };
};

// ============================================================================
// REVENUE PROJECTIONS CALCULATIONS
// ============================================================================

/**
 * Calculate gross potential rent for a given year
 * @param {number} baseRent - Base annual rent (Year 0 or in-place)
 * @param {number} growthRate - Annual growth rate (decimal)
 * @param {number} year - Year number (0-based)
 * @returns {number} Projected rent for that year
 */
export const calculateProjectedRent = (baseRent, growthRate, year) => {
  return toNumber(baseRent) * Math.pow(1 + toNumber(growthRate), year);
};

/**
 * Calculate 10-year revenue projections
 * @param {object} data - All property data
 * @returns {object} Revenue projections by year
 */
export const calculateRevenueProjections = (data) => {
  const units = toNumber(data.units);
  const rentRollTotals = calculateRentRollTotals(data.rentRoll || []);
  const baseAnnualRent = rentRollTotals.totalMarketRent * 12; // Monthly to annual
  
  const growthRate = toNumber(data.growth?.annualRentGrowth) || 0;
  const vacancyRate = toNumber(data.growth?.vacancyRate) || 0;
  const badDebtRate = toNumber(data.growth?.badDebtRate) || 0;
  const concessions = toNumber(data.growth?.concessions) || 0;
  const lossToLease = rentRollTotals.totalLossToLease * 12; // Annual loss to lease
  
  const projections = [];
  
  for (let year = 0; year < 10; year++) {
    const grossPotentialRent = calculateProjectedRent(baseAnnualRent, growthRate, year);
    const vacancy = grossPotentialRent * vacancyRate;
    const lossToLeaseYear = year === 0 ? lossToLease : 0; // Loss to lease only in Year 1
    const concessionsYear = concessions;
    const badDebt = (grossPotentialRent - vacancy) * badDebtRate;
    const netRentalIncome = grossPotentialRent - vacancy - lossToLeaseYear - concessionsYear - badDebt;
    
    projections.push({
      year: year + 1,
      grossPotentialRent,
      vacancy,
      lossToLease: lossToLeaseYear,
      concessions: concessionsYear,
      badDebt,
      netRentalIncome,
      // Per unit per month calculations
      grossPotentialRentPerUnitPerMonth: safeDivide(grossPotentialRent, units) / 12,
      vacancyPerUnitPerMonth: safeDivide(vacancy, units) / 12,
      lossToLeasePerUnitPerMonth: safeDivide(lossToLeaseYear, units) / 12,
      concessionsPerUnitPerMonth: safeDivide(concessionsYear, units) / 12,
      badDebtPerUnitPerMonth: safeDivide(badDebt, units) / 12,
      netRentalIncomePerUnitPerMonth: safeDivide(netRentalIncome, units) / 12,
    });
  }
  
  return projections;
};

/**
 * Calculate total other income for all years
 * @param {object} otherIncome - Object with income types as properties
 * @returns {number} Total annual other income
 */
export const calculateTotalOtherIncome = (otherIncome) => {
  if (!otherIncome) return 0;
  return Object.values(otherIncome).reduce((sum, value) => sum + toNumber(value), 0);
};

// ============================================================================
// OPERATING EXPENSES CALCULATIONS
// ============================================================================

/**
 * Calculate management fee based on effective gross income
 * @param {number} effectiveGrossIncome - EGI for the year
 * @param {number} managementFeePercent - Management fee percentage (decimal)
 * @returns {number} Management fee amount
 */
export const calculateManagementFee = (effectiveGrossIncome, managementFeePercent) => {
  return toNumber(effectiveGrossIncome) * toNumber(managementFeePercent);
};

/**
 * Calculate replacement reserves based on per unit per year amount
 * @param {number} units - Number of units
 * @param {number} perUnitPerYear - Reserve amount per unit per year
 * @returns {number} Total replacement reserves
 */
export const calculateReplacementReserves = (units, perUnitPerYear) => {
  return toNumber(units) * toNumber(perUnitPerYear);
};

/**
 * Calculate 10-year expense projections
 * @param {object} data - All property data
 * @param {array} revenueProjections - Revenue projections for calculating management fee
 * @returns {object} Expense projections by year
 */
export const calculateExpenseProjections = (data, revenueProjections) => {
  const units = toNumber(data.units);
  const growthRate = toNumber(data.growth?.annualExpenseGrowth) || 0;
  const managementFeePercent = toNumber(data.growth?.managementFeePercent) || 0;
  const capexReservePerUnitPerYear = toNumber(data.sale?.capexReservePerUnitPerYear) || 0;
  
  // Base expenses (Annual)
  const baseExpenses = data.expenses || {};
  const expenseKeys = Object.keys(baseExpenses);
  
  const projections = [];
  
  for (let year = 0; year < 10; year++) {
    const yearProjection = { year: year + 1 };
    let totalExpenses = 0;
    
    // Calculate each expense with growth
    expenseKeys.forEach(key => {
      const baseAmount = toNumber(baseExpenses[key]);
      const projectedAmount = baseAmount * Math.pow(1 + growthRate, year);
      yearProjection[key] = projectedAmount;
      totalExpenses += projectedAmount;
    });
    
    // Calculate management fee based on EGI (Effective Gross Income)
    // EGI = Net Rental Income + Other Income
    const netRentalIncome = revenueProjections[year]?.netRentalIncome || 0;
    const otherIncome = calculateTotalOtherIncome(data.otherIncome);
    const effectiveGrossIncome = netRentalIncome + otherIncome;
    const managementFee = calculateManagementFee(effectiveGrossIncome, managementFeePercent);
    
    yearProjection.managementFee = managementFee;
    totalExpenses += managementFee;
    
    // Calculate replacement reserves
    const replacementReserves = calculateReplacementReserves(units, capexReservePerUnitPerYear);
    yearProjection.replacementReserves = replacementReserves;
    totalExpenses += replacementReserves;
    
    yearProjection.totalExpenses = totalExpenses;
    yearProjection.totalExpensesPerUnitPerMonth = safeDivide(totalExpenses, units) / 12;
    
    projections.push(yearProjection);
  }
  
  return projections;
};

/**
 * Calculate all Key Deal Metrics
 * @param {object} data - All property data
 * @returns {object} Calculated metrics
 */
export const calculateKeyDealMetrics = (data) => {
  const purchasePrice = toNumber(data.purchasePrice);
  const units = toNumber(data.units);
  const squareFeet = toNumber(data.squareFeet);
  const stabilizedNOI = toNumber(data.stabilizedNOI); // This comes from NOI calculations
  const proFormaNOI = toNumber(data.proFormaNOI); // Year 2 NOI
  
  return {
    pricePerUnit: calculatePricePerUnit(purchasePrice, units),
    pricePerSF: calculatePricePerSF(purchasePrice, squareFeet),
    purchaseCapRate: calculateCapRate(stabilizedNOI, purchasePrice),
    proFormaCapRate: calculateCapRate(proFormaNOI, purchasePrice),
  };
};

// ============================================================================
// SOURCES & USES CALCULATIONS
// ============================================================================

/**
 * Calculate all Sources & Uses metrics
 * @param {object} data - Property data with sources and uses
 * @returns {object} Calculated sources, uses, and totals
 */
export const calculateSourcesAndUses = (data) => {
  // SOURCES
  const seniorDebt = toNumber(data.sources?.seniorDebt);
  const mezDebt = toNumber(data.sources?.mezDebt);
  const preferredEquity = toNumber(data.sources?.preferredEquity);
  const lpEquity = toNumber(data.sources?.lpEquity);
  const gpEquity = toNumber(data.sources?.gpEquity);
  
  const totalSources = seniorDebt + mezDebt + preferredEquity + lpEquity + gpEquity;
  
  // USES
  const purchasePrice = toNumber(data.uses?.purchasePrice);
  const closingCosts = toNumber(data.uses?.closingCosts);
  const dueDiligence = toNumber(data.uses?.dueDiligence);
  const immediateCapex = toNumber(data.uses?.immediateCapex);
  const financingFees = toNumber(data.uses?.financingFees);
  const operatingReserves = toNumber(data.uses?.operatingReserves);
  const other = toNumber(data.uses?.other);
  
  const totalUses = purchasePrice + closingCosts + dueDiligence + immediateCapex + 
                    financingFees + operatingReserves + other;
  
  // Calculate percentages
  const sourcesPercentages = {
    seniorDebt: safeDivide(seniorDebt, totalSources),
    mezDebt: safeDivide(mezDebt, totalSources),
    preferredEquity: safeDivide(preferredEquity, totalSources),
    lpEquity: safeDivide(lpEquity, totalSources),
    gpEquity: safeDivide(gpEquity, totalSources),
  };
  
  const usesPercentages = {
    purchasePrice: safeDivide(purchasePrice, totalUses),
    closingCosts: safeDivide(closingCosts, totalUses),
    dueDiligence: safeDivide(dueDiligence, totalUses),
    immediateCapex: safeDivide(immediateCapex, totalUses),
    financingFees: safeDivide(financingFees, totalUses),
    operatingReserves: safeDivide(operatingReserves, totalUses),
    other: safeDivide(other, totalUses),
  };
  
  return {
    totalSources,
    totalUses,
    sourcesPercentages,
    usesPercentages,
    isBalanced: Math.abs(totalSources - totalUses) < 0.01, // Within 1 cent
  };
};

/**
 * Calculate equity required (total uses minus total debt)
 * @param {number} totalUses - Total uses of funds
 * @param {number} totalDebt - Total debt (senior + mez)
 * @returns {number} Equity required
 */
export const calculateEquityRequired = (totalUses, totalDebt) => {
  return toNumber(totalUses) - toNumber(totalDebt);
};

/**
 * Calculate LP/GP equity split
 * @param {number} totalEquity - Total equity required
 * @param {number} lpPercent - LP percentage (decimal, e.g., 0.90 for 90%)
 * @returns {object} LP and GP equity amounts
 */
export const calculateEquitySplit = (totalEquity, lpPercent = 0.90) => {
  const equity = toNumber(totalEquity);
  const lpPct = toNumber(lpPercent);
  
  return {
    lpEquity: equity * lpPct,
    gpEquity: equity * (1 - lpPct),
  };
};

// ============================================================================
// IRR CALCULATION (Internal Rate of Return)
// ============================================================================

/**
 * Calculate Net Present Value for given rate and cash flows
 * @param {number} rate - Discount rate (as decimal)
 * @param {array} cashFlows - Array of cash flows by period
 * @returns {number} Net present value
 */
const npv = (rate, cashFlows) => {
  return cashFlows.reduce((sum, cf, index) => {
    return sum + cf / Math.pow(1 + rate, index);
  }, 0);
};

/**
 * Calculate Internal Rate of Return using Newton-Raphson method
 * @param {array} cashFlows - Array of cash flows (negative initial, then returns)
 * @returns {number} IRR as percentage
 */
export const calculateIRR = (cashFlows) => {
  if (!cashFlows || cashFlows.length < 2) return 0;

  const hasPositive = cashFlows.some(v => v > 0);
  const hasNegative = cashFlows.some(v => v < 0);
  if (!hasPositive || !hasNegative) return 0;

  const maxIterations = 100;
  const tolerance = 1e-6;

  let lower = -0.99; // cannot be -1 or below
  let upper = 1.5;   // 150% per period upper bound

  const npvAt = (rate) => npv(rate, cashFlows);

  let npvLower = npvAt(lower);
  let npvUpper = npvAt(upper);

  // Expand bounds if NPV does not change sign
  let expandCount = 0;
  while (npvLower * npvUpper > 0 && expandCount < 10) {
    lower = Math.max(-0.99, lower - 0.5);
    upper = upper + 0.5;
    npvLower = npvAt(lower);
    npvUpper = npvAt(upper);
    expandCount++;
  }

  if (npvLower * npvUpper > 0) {
    // Could not bracket a root
    return 0;
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lower + upper) / 2;
    const npvMid = npvAt(mid);

    if (Math.abs(npvMid) < tolerance) {
      return mid * 100; // percentage
    }

    if (npvLower * npvMid < 0) {
      upper = mid;
      npvUpper = npvMid;
    } else {
      lower = mid;
      npvLower = npvMid;
    }
  }

  const result = (lower + upper) / 2;
  return result * 100;
};

// ============================================================================
// RETURN SUMMARY CALCULATIONS
// ============================================================================

/**
 * Calculate equity multiple (total returns / initial investment)
 * @param {number} totalReturns - Total cash returned to investor
 * @param {number} initialEquity - Initial equity investment
 * @returns {number} Equity multiple
 */
export const calculateEquityMultiple = (totalReturns, initialEquity) => {
  return safeDivide(toNumber(totalReturns), toNumber(initialEquity));
};

/**
 * Calculate average cash-on-cash return
 * @param {array} annualDistributions - Array of annual cash distributions
 * @param {number} initialEquity - Initial equity investment
 * @param {number} years - Number of years
 * @returns {number} Average CoC as percentage
 */
export const calculateAverageCashOnCash = (annualDistributions, initialEquity, years) => {
  if (!annualDistributions || annualDistributions.length === 0 || years === 0) return 0;
  const totalDistributions = annualDistributions.slice(0, years).reduce((sum, dist) => sum + toNumber(dist), 0);
  const avgAnnualDistribution = totalDistributions / years;
  return safeDivide(avgAnnualDistribution, toNumber(initialEquity)) * 100;
};

/**
 * Calculate all Return Summary metrics
 * @param {object} data - All property data including cash flows
 * @returns {object} Return metrics for 5-year and 10-year hold periods
 */
export const calculateReturnSummary = (data) => {
  // This is a simplified version - full implementation requires cash flow projections
  // These calculations will be complete once cash flow section is implemented
  const totalEquity = toNumber(data.sources?.lpEquity) + toNumber(data.sources?.gpEquity);
  const lpEquity = toNumber(data.sources?.lpEquity);
  const gpEquity = toNumber(data.sources?.gpEquity);
  
  // Placeholder structure - will calculate actual values once cash flow data is available
  return {
    fiveYear: {
      projectIRR: 0,
      lpIRR: 0,
      gpIRR: 0,
      equityMultiple: 0,
      lpEquityMultiple: 0,
      gpEquityMultiple: 0,
      avgCoCReturn: 0
    },
    tenYear: {
      projectIRR: 0,
      lpIRR: 0,
      gpIRR: 0,
      equityMultiple: 0,
      lpEquityMultiple: 0,
      gpEquityMultiple: 0,
      avgCoCReturn: 0
    }
  };
};

// ============================================================================
// NET OPERATING INCOME (NOI)
// ============================================================================

/**
 * Calculate NOI projections for 10 years
 * @param {Array} revenueProjections - Revenue projections array
 * @param {Array} expenseProjections - Expense projections array
 * @param {number} units - Number of units
 * @returns {Array} Array of 10 NOI projection objects
 */
export function calculateNOIProjections(revenueProjections, expenseProjections, units) {
  const years = 10;
  const projections = [];
  
  for (let year = 0; year < years; year++) {
    const revenue = revenueProjections[year];
    const expense = expenseProjections[year];
    
    // Calculate EGI (Effective Gross Income)
    const effectiveGrossIncome = revenue.netRentalIncome + revenue.totalOtherIncome;
    
    // Calculate NOI
    const noi = effectiveGrossIncome - expense.totalExpenses;
    
    // Calculate expense ratio (Operating Expenses / EGI)
    const expenseRatio = safeDivide(expense.totalExpenses, effectiveGrossIncome);
    
    // Calculate NOI per unit
    const noiPerUnit = safeDivide(noi, units);
    
    // Calculate NOI per unit per month
    const noiPerUnitPerMonth = safeDivide(noi, units * 12);
    
    projections.push({
      effectiveGrossIncome,
      totalExpenses: expense.totalExpenses,
      noi,
      expenseRatio,
      noiPerUnit,
      noiPerUnitPerMonth
    });
  }
  
  return projections;
}

// ============================================================================
// CREATIVE FINANCING CALCULATIONS
// ============================================================================

/**
 * Calculate monthly mortgage payment (P&I)
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate (e.g., 0.05 for 5%)
 * @param {number} months - Loan term in months
 * @returns {number} Monthly P&I payment
 */
export function calculateMortgagePayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months; // No interest
  
  const monthlyRate = annualRate / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                  (Math.pow(1 + monthlyRate, months) - 1);
  
  return payment;
}

/**
 * Calculate interest-only payment
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate
 * @returns {number} Monthly interest-only payment
 */
export function calculateInterestOnlyPayment(principal, annualRate) {
  return principal * (annualRate / 12);
}

/**
 * Calculate financing metrics for all debt structures
 * @param {Object} data - Property data including financing
 * @param {Array} noiProjections - NOI projections
 * @returns {Object} Financing calculations
 */
export function calculateFinancingMetrics(data, noiProjections) {
  const financing = data.financing || {};
  
  // Subject-To Existing Mortgage
  const subjectToMonthlyPI = calculateMortgagePayment(
    financing.subjectTo?.balance || 0,
    financing.subjectTo?.interestRate || 0,
    financing.subjectTo?.remainingTermMonths || 0
  );
  const subjectToAnnualDS = subjectToMonthlyPI * 12;
  
  // Seller Financing (1st Position)
  const sfIOMonths = financing.sellerFinancing?.interestOnlyMonths || 0;
  const sfIOPayment = calculateInterestOnlyPayment(
    financing.sellerFinancing?.loanAmount || 0,
    financing.sellerFinancing?.interestRate || 0
  );
  const sfMonthlyPI = calculateMortgagePayment(
    financing.sellerFinancing?.loanAmount || 0,
    financing.sellerFinancing?.interestRate || 0,
    financing.sellerFinancing?.amortizationMonths || 0
  );
  const sfAnnualDS = sfMonthlyPI * 12; // Simplified - assumes fully amortizing year
  
  // Seller Carryback (2nd Position)
  const scIsIO = financing.sellerCarryback?.interestOnly || false;
  const scMonthlyPayment = scIsIO 
    ? calculateInterestOnlyPayment(
        financing.sellerCarryback?.loanAmount || 0,
        financing.sellerCarryback?.interestRate || 0
      )
    : calculateMortgagePayment(
        financing.sellerCarryback?.loanAmount || 0,
        financing.sellerCarryback?.interestRate || 0,
        financing.sellerCarryback?.termMonths || 0
      );
  const scAnnualDS = scMonthlyPayment * 12;
  
  // DSCR Loan
  const dscrMonthlyPI = calculateMortgagePayment(
    financing.dscrLoan?.loanAmount || 0,
    financing.dscrLoan?.interestRate || 0,
    financing.dscrLoan?.termMonths || 0
  );
  const dscrAnnualDS = dscrMonthlyPI * 12;
  
  // Blended Metrics
  const totalDebt = (financing.subjectTo?.balance || 0) +
                    (financing.sellerFinancing?.loanAmount || 0) +
                    (financing.sellerCarryback?.loanAmount || 0) +
                    (financing.dscrLoan?.loanAmount || 0);
  
  const totalAnnualDS = subjectToAnnualDS + sfAnnualDS + scAnnualDS + dscrAnnualDS;
  
  // Calculate blended interest rate (weighted average)
  const totalInterest = 
    (financing.subjectTo?.balance || 0) * (financing.subjectTo?.interestRate || 0) +
    (financing.sellerFinancing?.loanAmount || 0) * (financing.sellerFinancing?.interestRate || 0) +
    (financing.sellerCarryback?.loanAmount || 0) * (financing.sellerCarryback?.interestRate || 0) +
    (financing.dscrLoan?.loanAmount || 0) * (financing.dscrLoan?.interestRate || 0);
  
  const blendedRate = safeDivide(totalInterest, totalDebt);
  
  // Debt Yield = NOI / Total Debt
  const year1NOI = noiProjections[0]?.noi || 0;
  const debtYield = safeDivide(year1NOI, totalDebt);
  
  // LTV (% of Purchase)
  const ltv = safeDivide(totalDebt, data.purchasePrice);
  
  return {
    subjectTo: {
      monthlyPI: subjectToMonthlyPI,
      annualDS: subjectToAnnualDS,
    },
    sellerFinancing: {
      monthlyPI: sfMonthlyPI,
      monthlyIO: sfIOPayment,
      annualDS: sfAnnualDS,
    },
    sellerCarryback: {
      monthlyPayment: scMonthlyPayment,
      annualDS: scAnnualDS,
    },
    dscrLoan: {
      monthlyPI: dscrMonthlyPI,
      annualDS: dscrAnnualDS,
    },
    blended: {
      totalDebt,
      totalAnnualDS,
      blendedRate,
      debtYield,
      ltv,
    },
  };
}

// ============================================================================
// CASH FLOW PROJECTIONS
// ============================================================================

/**
 * Calculate cash flow projections for 10 years
 * @param {Array} noiProjections - NOI projections
 * @param {Object} financingMetrics - Financing calculations
 * @param {Object} data - Property data
 * @returns {Array} Array of 10 cash flow projection objects
 */
export function calculateCashFlowProjections(noiProjections, financingMetrics, data) {
  const years = 10;
  const projections = [];
  
  // Get total equity for CoC calculation
  const totalEquity = (data.sources?.lpEquity || 0) + (data.sources?.gpEquity || 0);
  
  for (let year = 0; year < years; year++) {
    const noi = noiProjections[year]?.noi || 0;
    
    // Debt service (same every year for now - simplified)
    const subjectToDS = financingMetrics.subjectTo.annualDS;
    const sellerFinancingDS = financingMetrics.sellerFinancing.annualDS;
    const sellerCarrybackDS = financingMetrics.sellerCarryback.annualDS;
    const dscrLoanDS = financingMetrics.dscrLoan.annualDS;
    
    const totalDebtService = subjectToDS + sellerFinancingDS + sellerCarrybackDS + dscrLoanDS;
    
    // CapEx/Reserves - for now using replacement reserves from expense projections
    // (already included in NOI calculation, so set to 0 to avoid double counting)
    const capexReserves = 0;
    
    // Before-Tax Cash Flow
    const beforeTaxCashFlow = noi - totalDebtService - capexReserves;
    
    // DSCR = NOI / Total Debt Service
    const dscr = safeDivide(noi, totalDebtService);
    
    // Cash-on-Cash Return = Before-Tax Cash Flow / Total Equity
    const cashOnCash = safeDivide(beforeTaxCashFlow, totalEquity);
    
    projections.push({
      noi,
      subjectToDS,
      sellerFinancingDS,
      sellerCarrybackDS,
      dscrLoanDS,
      totalDebtService,
      capexReserves,
      beforeTaxCashFlow,
      dscr,
      cashOnCash,
    });
  }
  
  return projections;
}

// ============================================================================
// SALE / REVERSION ANALYSIS
// ============================================================================

/**
 * Calculate sale/reversion analysis for multiple exit years
 * @param {Array} noiProjections - NOI projections
 * @param {Object} data - Property data
 * @param {Object} financingMetrics - Financing calculations
 * @returns {Object} Sale analysis for years 5-10
 */
export function calculateSaleAnalysis(noiProjections, data, financingMetrics) {
  const sales = {};
  
  // Calculate for years 5-10
  for (let year = 5; year <= 10; year++) {
    const yearIndex = year - 1;
    
    // Exit cap rate - use Year 5 rate for year 5, Year 10 rate for years 6-10
    const exitCapRate = year === 5 
      ? (data.growth?.exitCapRate5Yr || 0.06)
      : (data.growth?.exitCapRate10Yr || 0.06);
    
    // Forward NOI (next year's NOI)
    const forwardNOI = noiProjections[year]?.noi || 0; // Year 6 NOI for Year 5 sale, etc.
    
    // Gross Sale Price = Forward NOI / Exit Cap Rate
    const grossSalePrice = safeDivide(forwardNOI, exitCapRate);
    
    // Selling Costs
    const sellingCosts = grossSalePrice * (data.sale?.sellingCostsPercent || 0.02);
    
    // Loan Payoffs (simplified - assumes all debt still outstanding)
    const loanPayoffs = financingMetrics.blended.totalDebt;
    
    // Net Sale Proceeds
    const netSaleProceeds = grossSalePrice - sellingCosts - loanPayoffs;
    
    sales[`year${year}`] = {
      exitCapRate,
      forwardNOI,
      grossSalePrice,
      sellingCosts,
      loanPayoffs,
      netSaleProceeds,
    };
  }
  
  return sales;
}

// ============================================================================
// EQUITY INVESTMENT
// ============================================================================

/**
 * Calculate equity investment breakdown
 * @param {Object} data - Property data
 * @param {Object} financingMetrics - Financing calculations
 * @returns {Object} Equity investment calculations
 */
export function calculateEquityInvestment(data, financingMetrics) {
  // Total Acquisition Cost (from Uses)
  const totalAcquisitionCost = 
    toNumber(data.uses?.purchasePrice) +
    toNumber(data.uses?.closingCosts) +
    toNumber(data.uses?.dueDiligence) +
    toNumber(data.uses?.immediateCapex) +
    toNumber(data.uses?.financingFees) +
    toNumber(data.uses?.operatingReserves) +
    toNumber(data.uses?.other);
  
  // Total Debt
  const totalDebt = financingMetrics.blended.totalDebt;
  
  // Required Equity
  const requiredEquity = totalAcquisitionCost - totalDebt;
  
  // LP/GP Split (90/10 default, could be made configurable)
  const lpEquityPercent = 0.90;
  const gpEquityPercent = 0.10;
  
  const lpEquity = requiredEquity * lpEquityPercent;
  const gpEquity = requiredEquity * gpEquityPercent;
  
  return {
    totalAcquisitionCost,
    totalDebt,
    requiredEquity,
    lpEquity,
    gpEquity,
    lpEquityPercent,
    gpEquityPercent,
  };
}

// ============================================================================
// IRR CASH FLOWS
// ============================================================================

/**
 * Calculate IRR cash flows for both 5-year and 10-year exit scenarios
 * @param {Object} equityInvestment - Equity investment calculations
 * @param {Array} cashFlowProjections - Cash flow projections
 * @param {Object} saleAnalysis - Sale analysis for different years
 * @returns {Object} IRR cash flows for both scenarios
 */
export function calculateIRRCashFlows(equityInvestment, cashFlowProjections, saleAnalysis) {
  const years = 11; // Year 0 through Year 10
  
  // 5-Year Exit Scenario (actually Year 5 = index 4)
  const fiveYearCashFlows = [];
  for (let year = 0; year < years; year++) {
    if (year === 0) {
      // Year 0: Initial investment (negative)
      fiveYearCashFlows.push(-equityInvestment.requiredEquity);
    } else if (year <= 5) {
      // Years 1-5: Operating cash flow
      const operatingCashFlow = cashFlowProjections[year - 1]?.beforeTaxCashFlow || 0;
      if (year === 5) {
        // Year 5: Operating cash flow + sale proceeds
        const saleProceeds = saleAnalysis.year5?.netSaleProceeds || 0;
        fiveYearCashFlows.push(operatingCashFlow + saleProceeds);
      } else {
        fiveYearCashFlows.push(operatingCashFlow);
      }
    } else {
      // Years 6-10: No cash flows after exit
      fiveYearCashFlows.push(0);
    }
  }
  
  // 10-Year Exit Scenario
  const tenYearCashFlows = [];
  for (let year = 0; year < years; year++) {
    if (year === 0) {
      // Year 0: Initial investment (negative)
      tenYearCashFlows.push(-equityInvestment.requiredEquity);
    } else if (year <= 10) {
      // Years 1-10: Operating cash flow
      const operatingCashFlow = cashFlowProjections[year - 1]?.beforeTaxCashFlow || 0;
      if (year === 10) {
        // Year 10: Operating cash flow + sale proceeds
        const saleProceeds = saleAnalysis.year10?.netSaleProceeds || 0;
        tenYearCashFlows.push(operatingCashFlow + saleProceeds);
      } else {
        tenYearCashFlows.push(operatingCashFlow);
      }
    }
  }
  
  // Calculate IRRs
  const fiveYearIRR = calculateIRR(fiveYearCashFlows.slice(0, 6)); // Year 0-5
  const tenYearIRR = calculateIRR(tenYearCashFlows); // Year 0-10
  
  // Calculate equity multiples
  const fiveYearTotalReturns = fiveYearCashFlows.slice(1, 6).reduce((sum, cf) => sum + cf, 0);
  const tenYearTotalReturns = tenYearCashFlows.slice(1, 11).reduce((sum, cf) => sum + cf, 0);
  
  const fiveYearEquityMultiple = safeDivide(fiveYearTotalReturns, equityInvestment.requiredEquity);
  const tenYearEquityMultiple = safeDivide(tenYearTotalReturns, equityInvestment.requiredEquity);
  
  return {
    fiveYear: {
      cashFlows: fiveYearCashFlows,
      irr: fiveYearIRR,
      equityMultiple: fiveYearEquityMultiple,
      totalReturns: fiveYearTotalReturns,
    },
    tenYear: {
      cashFlows: tenYearCashFlows,
      irr: tenYearIRR,
      equityMultiple: tenYearEquityMultiple,
      totalReturns: tenYearTotalReturns,
    },
    initialInvestment: equityInvestment.requiredEquity,
  };
}

// ============================================================================
// WATERFALL DISTRIBUTION
// ============================================================================

/**
 * Calculate waterfall distributions for LP and GP with preferred return
 * @param {Object} irrCashFlows - IRR cash flows
 * @param {Object} equityInvestment - Equity investment calculations
 * @param {Object} data - Data object with waterfall structure
 * @returns {Object} Waterfall distributions for both scenarios
 */
export function calculateWaterfallDistribution(irrCashFlows, equityInvestment, data) {
  const preferredReturn = toNumber(data.waterfall?.preferredReturn) || 0.08;
  const lpSplitAfterPref = toNumber(data.waterfall?.lpSplitAfterPref) || 0.70;
  const gpPromoteAfterPref = toNumber(data.waterfall?.gpPromoteAfterPref) || 0.30;
  
  const lpEquity = equityInvestment.lpEquity;
  const gpEquity = equityInvestment.gpEquity;
  
  // Calculate 5-Year Exit Waterfall
  const fiveYearWaterfall = calculateWaterfallForScenario(
    irrCashFlows.fiveYear.cashFlows,
    lpEquity,
    gpEquity,
    preferredReturn,
    lpSplitAfterPref,
    gpPromoteAfterPref,
    5
  );
  
  // Calculate 10-Year Exit Waterfall
  const tenYearWaterfall = calculateWaterfallForScenario(
    irrCashFlows.tenYear.cashFlows,
    lpEquity,
    gpEquity,
    preferredReturn,
    lpSplitAfterPref,
    gpPromoteAfterPref,
    10
  );
  
  return {
    fiveYear: fiveYearWaterfall,
    tenYear: tenYearWaterfall,
  };
}

/**
 * Helper function to calculate waterfall for a specific scenario
 * @param {Array} cashFlows - Cash flow array
 * @param {number} lpEquity - LP equity investment
 * @param {number} gpEquity - GP equity investment
 * @param {number} preferredReturn - Preferred return rate
 * @param {number} lpSplitAfterPref - LP split after pref
 * @param {number} gpPromoteAfterPref - GP promote after pref
 * @param {number} exitYear - Exit year (5 or 10)
 * @returns {Object} Waterfall distribution by year
 */
function calculateWaterfallForScenario(
  cashFlows,
  lpEquity,
  gpEquity,
  preferredReturn,
  lpSplitAfterPref,
  gpPromoteAfterPref,
  exitYear
) {
  const years = [];
  let cumulativeLPPrefAccrual = 0;
  let unpaidLPPref = 0;
  
  // Process each year
  for (let year = 0; year <= 10; year++) {
    const distributableCash = year === 0 ? 0 : (cashFlows[year] || 0);
    
    if (year === 0 || year > exitYear) {
      // No distributions at Year 0 or after exit
      years.push({
        year,
        distributableCash: 0,
        lpPrefAccrual: 0,
        lpDistribution: 0,
        gpDistribution: 0,
        lpCashFlow: year === 0 ? -lpEquity : 0,
        gpCashFlow: year === 0 ? -gpEquity : 0,
      });
      continue;
    }
    
    // Calculate LP preferred return accrual
    const lpPrefAccrual = lpEquity * preferredReturn;
    cumulativeLPPrefAccrual += lpPrefAccrual;
    unpaidLPPref += lpPrefAccrual;
    
    let lpDistribution = 0;
    let gpDistribution = 0;
    let remainingCash = distributableCash;
    
    if (distributableCash > 0) {
      // Step 1: Pay unpaid LP preferred return first
      const prefPayment = Math.min(remainingCash, unpaidLPPref);
      lpDistribution += prefPayment;
      remainingCash -= prefPayment;
      unpaidLPPref -= prefPayment;
      
      // Step 2: Return LP capital (not implemented in annual cash flow, happens at sale)
      // This would be included in the sale proceeds distribution
      
      // Step 3: Split remaining cash flow according to promote structure
      if (remainingCash > 0) {
        lpDistribution += remainingCash * lpSplitAfterPref;
        gpDistribution += remainingCash * gpPromoteAfterPref;
      }
    }
    
    years.push({
      year,
      distributableCash,
      lpPrefAccrual,
      lpDistribution,
      gpDistribution,
      lpCashFlow: year === 0 ? -lpEquity : lpDistribution,
      gpCashFlow: year === 0 ? -gpEquity : gpDistribution,
    });
  }
  
  return {
    years,
    lpIRR: calculateIRR(years.map(y => y.lpCashFlow)),
    gpIRR: calculateIRR(years.map(y => y.gpCashFlow)),
    lpTotalCashFlow: years.slice(1).reduce((sum, y) => sum + y.lpCashFlow, 0),
    gpTotalCashFlow: years.slice(1).reduce((sum, y) => sum + y.gpCashFlow, 0),
    lpEquityMultiple: safeDivide(years.slice(1).reduce((sum, y) => sum + y.lpCashFlow, 0), lpEquity),
    gpEquityMultiple: safeDivide(years.slice(1).reduce((sum, y) => sum + y.gpCashFlow, 0), gpEquity),
  };
}
// ============================================================================
// SENSITIVITY ANALYSIS
// ============================================================================

/**
 * Calculate sensitivity analysis for IRR across different exit cap rates and rent growth rates
 * @param {Object} data - Data object
 * @param {Array} cashFlowProjections - Cash flow projections
 * @param {Object} equityInvestment - Equity investment
 * @param {Object} noiProjections - NOI projections
 * @param {Object} financingMetrics - Financing metrics
 * @returns {Object} Sensitivity matrix and summary metrics
 */
export function calculateSensitivityAnalysis(
  data,
  cashFlowProjections,
  equityInvestment,
  noiProjections,
  financingMetrics
) {
  const exitCapRates = [0.05, 0.055, 0.06, 0.065];
  const rentGrowthRates = [0.01, 0.02, 0.03, 0.04, 0.05];
  
  // Create sensitivity matrix
  const matrix = [];
  
  for (const rentGrowth of rentGrowthRates) {
    const row = [];
    for (const exitCap of exitCapRates) {
      // Calculate IRR with these parameters
      const irr = calculateIRRWithParameters(
        data,
        cashFlowProjections,
        equityInvestment,
        noiProjections,
        financingMetrics,
        rentGrowth,
        exitCap,
        5 // 5-year exit
      );
      row.push(irr);
    }
    matrix.push(row);
  }
  
  return {
    matrix,
    exitCapRates,
    rentGrowthRates,
  };
}

/**
 * Helper function to calculate IRR with specific parameters
 * @param {Object} data - Data object
 * @param {Array} cashFlowProjections - Base cash flow projections
 * @param {Object} equityInvestment - Equity investment
 * @param {Object} noiProjections - NOI projections
 * @param {Object} financingMetrics - Financing metrics
 * @param {number} rentGrowth - Rent growth rate
 * @param {number} exitCap - Exit cap rate
 * @param {number} exitYear - Exit year
 * @returns {number} IRR
 */
function calculateIRRWithParameters(
  data,
  cashFlowProjections,
  equityInvestment,
  noiProjections,
  financingMetrics,
  rentGrowth,
  exitCap,
  exitYear
) {
  // Recalculate NOI with different rent growth
  const adjustedNOI = noiProjections[exitYear - 1]?.noi || 0;
  const growthAdjustment = Math.pow(1 + rentGrowth, exitYear) / Math.pow(1 + toNumber(data.growth?.annualRentGrowth), exitYear);
  const adjustedForwardNOI = adjustedNOI * growthAdjustment;
  
  // Calculate sale proceeds with different exit cap
  const grossSalePrice = safeDivide(adjustedForwardNOI, exitCap);
  const sellingCosts = grossSalePrice * toNumber(data.sale?.sellingCostsPercent);
  
  // Calculate loan payoffs (simplified - assumes no paydown)
  const totalDebt = financingMetrics.blended.totalDebt;
  const netSaleProceeds = grossSalePrice - sellingCosts - totalDebt;
  
  // Build cash flow array
  const cashFlows = [];
  cashFlows.push(-equityInvestment.requiredEquity); // Year 0
  
  for (let year = 1; year <= exitYear; year++) {
    const operatingCashFlow = cashFlowProjections[year - 1]?.beforeTaxCashFlow || 0;
    const adjustedOperatingCF = operatingCashFlow * Math.pow(1 + rentGrowth, year) / Math.pow(1 + toNumber(data.growth?.annualRentGrowth), year);
    
    if (year === exitYear) {
      cashFlows.push(adjustedOperatingCF + netSaleProceeds);
    } else {
      cashFlows.push(adjustedOperatingCF);
    }
  }
  
  return calculateIRR(cashFlows);
}