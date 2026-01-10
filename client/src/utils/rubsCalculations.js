// RUBS Calculator - All calculations for RUBS tab

// ==================== FINANCING ====================
export const calculateLoanAmount = (purchasePrice, ltv) => {
  return purchasePrice * (ltv / 100);
};

export const calculateAnnualDebtService = (loanAmount, interestRate, amortizationYears) => {
  if (!loanAmount || !interestRate || !amortizationYears) return 0;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = amortizationYears * 12;
  const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                         (Math.pow(1 + monthlyRate, numPayments) - 1);
  return monthlyPayment * 12;
};

// ==================== ACQUISITION ====================
export const calculateClosingCostsDollar = (purchasePrice, closingCostsPct) => {
  return purchasePrice * (closingCostsPct / 100);
};

export const calculateTotalAcquisitionCost = (purchasePrice, closingCostsDollar) => {
  return purchasePrice + closingCostsDollar;
};

// ==================== EQUITY ====================
export const calculateEquityForPurchase = (purchasePrice, loanAmount) => {
  return purchasePrice - loanAmount;
};

export const calculateEquityForClosing = (closingCostsDollar) => {
  return closingCostsDollar;
};

export const calculateTotalEquityRequired = (equityForPurchase, equityForClosing, renovationBudget) => {
  return equityForPurchase + equityForClosing + renovationBudget;
};

// ==================== KEY METRICS ====================
export const calculatePricePerUnit = (purchasePrice, totalUnits) => {
  return totalUnits > 0 ? purchasePrice / totalUnits : 0;
};

export const calculatePricePerSF = (purchasePrice, totalRentableSF) => {
  return totalRentableSF > 0 ? purchasePrice / totalRentableSF : 0;
};

export const calculateAvgSFPerUnit = (totalRentableSF, totalUnits) => {
  return totalUnits > 0 ? totalRentableSF / totalUnits : 0;
};

export const calculateGoingInCapRate = (year1NOI, purchasePrice) => {
  return purchasePrice > 0 ? (year1NOI / purchasePrice) * 100 : 0;
};

export const calculateDebtYield = (year1NOI, loanAmount) => {
  return loanAmount > 0 ? (year1NOI / loanAmount) * 100 : 0;
};

export const calculateDSCR = (year1NOI, annualDebtService) => {
  return annualDebtService > 0 ? year1NOI / annualDebtService : 0;
};

// ==================== UNIT MIX & RENT ROLL ====================
export const calculateTotalSFForUnitType = (numUnits, sfPerUnit) => {
  return numUnits * sfPerUnit;
};

export const calculateRentGap = (marketRent, currentRent) => {
  return marketRent - currentRent;
};

export const calculateMonthlyLossToLease = (rentGap, numUnits) => {
  return rentGap * numUnits;
};

export const calculateAnnualLossToLease = (monthlyLTL) => {
  return monthlyLTL * 12;
};

export const calculatePercentOfTotal = (numUnits, totalUnits) => {
  return totalUnits > 0 ? (numUnits / totalUnits) * 100 : 0;
};

export const calculateWeightedAverage = (values, weights) => {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = values.reduce((sum, val, idx) => sum + (val * weights[idx]), 0);
  return weightedSum / totalWeight;
};

// ==================== YEAR 1 REVENUE SUMMARY ====================
export const calculateGrossPotentialRent = (unitMix) => {
  return unitMix.reduce((sum, unit) => {
    return sum + (unit.numUnits * unit.marketRent * 12);
  }, 0);
};

export const calculateVacancyLoss = (gpr, physicalOccupancy) => {
  return -gpr * (1 - physicalOccupancy / 100);
};

export const calculateLossToLeaseTotal = (unitMix, physicalOccupancy) => {
  const annualLTL = unitMix.reduce((sum, unit) => {
    return sum + unit.annualLTL;
  }, 0);
  return -annualLTL * (physicalOccupancy / 100);
};

export const calculateBadDebt = (gpr, physicalOccupancy, badDebtPct) => {
  return -gpr * (physicalOccupancy / 100) * (badDebtPct / 100);
};

export const calculateConcessions = (concessionsPerUnit, totalUnits) => {
  return -concessionsPerUnit * totalUnits;
};

export const calculateOtherIncome = (otherIncomePerUnitMonth, totalUnits) => {
  return otherIncomePerUnitMonth * totalUnits * 12;
};

export const calculateEffectiveGrossIncome = (gpr, vacancyLoss, lossToLease, badDebt, concessions, otherIncome) => {
  return gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
};

// ==================== OPERATING EXPENSES ====================
export const calculatePerUnit = (expenseAmount, totalUnits) => {
  return totalUnits > 0 ? expenseAmount / totalUnits : 0;
};

export const calculatePercentOfEGI = (expenseAmount, egi) => {
  return egi > 0 ? (expenseAmount / egi) * 100 : 0;
};

export const calculateManagementFee = (egi, managementFeePct = 4) => {
  return egi * (managementFeePct / 100);
};

export const calculateTotalOperatingExpenses = (expenses) => {
  return Object.values(expenses).reduce((sum, exp) => sum + (exp || 0), 0);
};

// ==================== RUBS CALCULATOR ====================
export const calculateTotalBeds = (beds, numUnits) => {
  return beds * numUnits;
};

export const calculateTotalOccupants = (avgOcc, numUnits) => {
  return avgOcc * numUnits;
};

export const calculateMonthlyRecovery = (monthlyCost, recoveryPct) => {
  return monthlyCost * (recoveryPct / 100);
};

export const calculateAnnualRecovery = (monthlyRecovery) => {
  return monthlyRecovery * 12;
};

export const calculateNetCost = (monthlyCost, annualRecovery) => {
  return (monthlyCost * 12) - annualRecovery;
};

export const calculateRUBSBillbackByOccupant = (utilityRecovery, unitOccupants, totalOccupants, numUnits) => {
  if (totalOccupants === 0 || numUnits === 0) return 0;
  return (utilityRecovery * (unitOccupants / totalOccupants)) / numUnits;
};

export const calculateRUBSBillbackBySqFt = (utilityRecovery, unitSF, totalSF, numUnits) => {
  if (totalSF === 0 || numUnits === 0) return 0;
  return (utilityRecovery * (unitSF / totalSF)) / numUnits;
};

export const calculateRUBSBillbackEqual = (utilityRecovery, totalUnits) => {
  return totalUnits > 0 ? utilityRecovery / totalUnits : 0;
};

export const calculateAnnualRUBSIncome = (totalMonthlyRecovery) => {
  return totalMonthlyRecovery * 12;
};

// ==================== RENOVATION SCHEDULE ====================
export const calculateInteriorCost = (perUnitCost, totalUnits) => {
  return perUnitCost * totalUnits;
};

export const calculateSubtotalInterior = (costs) => {
  return costs.reduce((sum, cost) => sum + cost, 0);
};

export const calculateSubtotalExterior = (costs) => {
  return costs.reduce((sum, cost) => sum + cost, 0);
};

export const calculateContingency = (subtotalInterior, subtotalExterior, contingencyPct = 10) => {
  return (subtotalInterior + subtotalExterior) * (contingencyPct / 100);
};

export const calculateTotalRenovationBudget = (subtotalInterior, subtotalExterior, contingency) => {
  return subtotalInterior + subtotalExterior + contingency;
};

export const calculateUnitsPerMonth = (unitsToRenovate, renovationPeriodMonths) => {
  return renovationPeriodMonths > 0 ? Math.round(unitsToRenovate / renovationPeriodMonths) : 0;
};

export const calculateUnitsRenovatedYear = (unitsPerMonth, remainingUnits) => {
  const yearlyCapacity = unitsPerMonth * 12;
  return Math.min(yearlyCapacity, remainingUnits);
};

export const calculateCumulativeUnitsTurned = (priorCumulative, currentYearRenovated) => {
  return priorCumulative + currentYearRenovated;
};

export const calculatePercentComplete = (cumulativeTurned, totalUnitsToRenovate) => {
  return totalUnitsToRenovate > 0 ? (cumulativeTurned / totalUnitsToRenovate) * 100 : 0;
};

export const calculateAvgUnitsWithPremium = (priorCumulative, currentYearRenovated) => {
  return priorCumulative + (currentYearRenovated / 2);
};

export const calculatePremiumIncome = (avgUnitsWithPremium, rentPremium) => {
  return avgUnitsWithPremium * rentPremium * 12;
};

export const calculateCapExDeployed = (unitsRenovated, totalUnitsToRenovate, totalRenovationBudget) => {
  if (totalUnitsToRenovate === 0) return 0;
  return (unitsRenovated / totalUnitsToRenovate) * totalRenovationBudget;
};

// ==================== PRO FORMA OPERATING STATEMENT ====================
export const calculateGPRGrowth = (priorYearGPR, annualRentGrowth) => {
  return priorYearGPR * (1 + annualRentGrowth / 100);
};

export const calculateLossToLeaseReduction = (priorYearLTL, percentComplete) => {
  return priorYearLTL * (1 - percentComplete / 100);
};

export const calculateVacancyLossProForma = (gpr, ltl, premium, occupancyRate) => {
  return -(gpr + ltl + premium) * (1 - occupancyRate / 100);
};

export const calculateBadDebtProForma = (priorBadDebt, reductionFactor = 0.9) => {
  return priorBadDebt * reductionFactor;
};

export const calculateOtherIncomeGrowth = (priorYearOther, annualRentGrowth) => {
  return priorYearOther * (1 + annualRentGrowth / 100);
};

export const calculateRUBSIncomeGrowth = (priorYearRUBS, rubsRecoveryGrowth) => {
  return priorYearRUBS * (1 + rubsRecoveryGrowth / 100);
};

export const calculateEGIProForma = (gpr, ltl, premium, vacancy, badDebt, concessions, otherIncome, rubsIncome) => {
  return gpr + ltl + premium + vacancy + badDebt + concessions + otherIncome + rubsIncome;
};

export const calculateOpExGrowth = (priorYearOpEx, annualExpenseGrowth) => {
  return priorYearOpEx * (1 + annualExpenseGrowth / 100);
};

export const calculateNOI = (egi, totalOpEx) => {
  return egi - totalOpEx;
};

export const calculateNOIGrowth = (currentNOI, priorNOI) => {
  return priorNOI > 0 ? ((currentNOI - priorNOI) / priorNOI) * 100 : 0;
};

export const calculateCashFlowBeforeTax = (noi, debtService, capEx) => {
  return noi - debtService - capEx;
};

// ==================== EXIT ANALYSIS & RETURNS ====================
export const calculateGrossSalePrice = (stabilizedNOI, exitCapRate) => {
  return exitCapRate > 0 ? stabilizedNOI / (exitCapRate / 100) : 0;
};

export const calculateSalesCosts = (grossSalePrice, salesCostsPct) => {
  return -grossSalePrice * (salesCostsPct / 100);
};

export const calculateNetSalePrice = (grossSalePrice, salesCosts) => {
  return grossSalePrice + salesCosts;
};

export const calculateLoanBalanceAtExit = (loanAmount, interestRate, holdPeriodYears, annualDebtService) => {
  if (!interestRate || !holdPeriodYears) return loanAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = holdPeriodYears * 12;
  const monthlyPayment = annualDebtService / 12;
  
  // Future value of loan after payments
  const fv = loanAmount * Math.pow(1 + monthlyRate, numPayments) - 
             monthlyPayment * ((Math.pow(1 + monthlyRate, numPayments) - 1) / monthlyRate);
  
  return fv;
};

export const calculateNetProceeds = (netSalePrice, loanBalance) => {
  return netSalePrice - loanBalance;
};

export const calculateCashOnCashReturn = (cashFlow, totalEquity) => {
  return totalEquity > 0 ? (cashFlow / totalEquity) * 100 : 0;
};

export const calculateIRR = (initialEquity, cashFlows, netProceeds) => {
  // Simple IRR calculation using Newton's method
  const values = [-initialEquity, ...cashFlows];
  values[values.length - 1] += netProceeds;
  
  let rate = 0.1; // Starting guess
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let j = 0; j < values.length; j++) {
      npv += values[j] / Math.pow(1 + rate, j);
      dnpv -= j * values[j] / Math.pow(1 + rate, j + 1);
    }
    
    const newRate = rate - npv / dnpv;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate * 100;
    }
    
    rate = newRate;
  }
  
  return rate * 100;
};

export const calculateEquityMultiple = (cashFlows, netProceeds, totalEquity) => {
  const totalCashFlows = cashFlows.reduce((sum, cf) => sum + cf, 0);
  const totalReturn = totalCashFlows + netProceeds;
  return totalEquity > 0 ? totalReturn / totalEquity : 0;
};

export const calculateAvgCashOnCash = (cashOnCashReturns) => {
  if (cashOnCashReturns.length === 0) return 0;
  const sum = cashOnCashReturns.reduce((acc, val) => acc + val, 0);
  return sum / cashOnCashReturns.length;
};

// ==================== SENSITIVITY ANALYSIS ====================
export const calculateSensitivityIRR = (baseNOI, rentGrowthVariation, exitCapVariation, baseParams) => {
  // Adjust NOI based on rent growth variation
  const adjustedNOI = baseNOI * Math.pow(1 + rentGrowthVariation / 100, 5);
  
  // Calculate gross sale price with varied exit cap
  const grossSalePrice = calculateGrossSalePrice(adjustedNOI, exitCapVariation);
  const salesCosts = calculateSalesCosts(grossSalePrice, baseParams.salesCostsPct);
  const netSalePrice = calculateNetSalePrice(grossSalePrice, salesCosts);
  const loanBalance = calculateLoanBalanceAtExit(
    baseParams.loanAmount,
    baseParams.interestRate,
    baseParams.holdPeriod,
    baseParams.annualDebtService
  );
  const netProceeds = calculateNetProceeds(netSalePrice, loanBalance);
  
  // Calculate IRR with adjusted parameters
  const irr = calculateIRR(baseParams.totalEquity, baseParams.cashFlows, netProceeds);
  
  return irr;
};

export const calculateSensitivityEM = (baseNOI, rentGrowthVariation, exitCapVariation, baseParams) => {
  // Adjust cash flows based on rent growth variation
  const adjustedCashFlows = baseParams.cashFlows.map((cf, idx) => {
    return cf * Math.pow(1 + rentGrowthVariation / 100, idx + 1);
  });
  
  // Adjust final NOI and calculate exit value
  const adjustedNOI = baseNOI * Math.pow(1 + rentGrowthVariation / 100, 5);
  const grossSalePrice = calculateGrossSalePrice(adjustedNOI, exitCapVariation);
  const salesCosts = calculateSalesCosts(grossSalePrice, baseParams.salesCostsPct);
  const netSalePrice = calculateNetSalePrice(grossSalePrice, salesCosts);
  const loanBalance = calculateLoanBalanceAtExit(
    baseParams.loanAmount,
    baseParams.interestRate,
    baseParams.holdPeriod,
    baseParams.annualDebtService
  );
  const netProceeds = calculateNetProceeds(netSalePrice, loanBalance);
  
  const em = calculateEquityMultiple(adjustedCashFlows, netProceeds, baseParams.totalEquity);
  
  return em;
};
