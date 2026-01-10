// Comprehensive Real Estate Financial Calculations Engine
// Matches Deal Manager spreadsheet functionality

/**
 * Calculate IRR (Internal Rate of Return) using Newton-Raphson method
 * @param {Array<number>} cashFlows - Array of cash flows (negative for investments, positive for returns)
 * @param {number} guess - Initial guess for IRR (default 0.1 = 10%)
 * @returns {number} IRR as decimal (e.g., 0.15 = 15%)
 */
export function calculateIRR(cashFlows, guess = 0.1) {
  const maxIterations = 100;
  const tolerance = 1e-6;
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    
    for (let j = 0; j < cashFlows.length; j++) {
      npv += cashFlows[j] / Math.pow(1 + rate, j);
      dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
    }
    
    const newRate = rate - npv / dnpv;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    
    rate = newRate;
  }
  
  return rate;
}

/**
 * Calculate NPV (Net Present Value)
 * @param {Array<number>} cashFlows - Array of cash flows
 * @param {number} discountRate - Discount rate as decimal
 * @returns {number} NPV
 */
export function calculateNPV(cashFlows, discountRate) {
  return cashFlows.reduce((npv, cashFlow, index) => {
    return npv + cashFlow / Math.pow(1 + discountRate, index);
  }, 0);
}

/**
 * Calculate monthly mortgage payment
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate as decimal
 * @param {number} years - Amortization period in years
 * @returns {number} Monthly payment
 */
export function calculateMortgagePayment(principal, annualRate, years) {
  if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
  
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  const payment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return payment;
}

/**
 * Calculate loan balance at a specific point in time
 * @param {number} principal - Original loan amount
 * @param {number} annualRate - Annual interest rate as decimal
 * @param {number} amortYears - Amortization period in years
 * @param {number} yearsPaid - Years already paid
 * @returns {number} Remaining balance
 */
export function calculateLoanBalance(principal, annualRate, amortYears, yearsPaid) {
  if (yearsPaid >= amortYears) return 0;
  
  const monthlyRate = annualRate / 12;
  const totalPayments = amortYears * 12;
  const paymentsMade = yearsPaid * 12;
  const remainingPayments = totalPayments - paymentsMade;
  
  const monthlyPayment = calculateMortgagePayment(principal, annualRate, amortYears);
  
  const balance = monthlyPayment * 
    ((Math.pow(1 + monthlyRate, remainingPayments) - 1) / 
    (monthlyRate * Math.pow(1 + monthlyRate, remainingPayments)));
  
  return balance;
}

// === CORE HELPER FUNCTIONS (aligned with master underwriting formulas) ===

// 1. Effective Gross Income (EGI) = Gross Scheduled Rent + Other Income – Vacancy Loss
// Prefer computing EGI directly from its components when they exist, and only
// fall back to a pre-computed effective_gross_income line when inputs are
// missing. This prevents a bad backend EGI/NOI pair from overriding corrected
// income/expense edits in the wizard.
function computeEGI({ potentialGrossIncome = 0, otherIncome = 0, vacancyLoss = 0, effectiveGrossIncome }) {
  const hasExplicitComponents = (potentialGrossIncome > 0) || (otherIncome > 0) || (vacancyLoss > 0);
  if (hasExplicitComponents) {
    return (potentialGrossIncome + otherIncome) - vacancyLoss;
  }
  if (effectiveGrossIncome != null && effectiveGrossIncome !== 0) {
    return effectiveGrossIncome;
  }
  return 0;
}

// 3. Net Operating Income (NOI) = EGI – Operating Expenses
function computeNOI({ egi = 0, operatingExpenses = 0, noiOverride = null }) {
  // Prefer computed NOI when we have both EGI and expenses
  if (egi > 0 && operatingExpenses > 0) {
    return egi - operatingExpenses;
  }
  // Fall back to an override only when inputs are missing
  if (noiOverride != null && noiOverride !== 0) {
    return noiOverride;
  }
  return 0;
}

// 8. Bank Loan Amount (LTV) and 9. Down Payment
function computeBasicFinancing({ purchasePrice = 0, loanAmount = 0, downPayment = 0 }) {
  let resolvedLoanAmount = loanAmount;
  let resolvedDownPayment = downPayment;

  if (resolvedLoanAmount === 0 && resolvedDownPayment > 0 && purchasePrice > 0) {
    resolvedLoanAmount = purchasePrice - resolvedDownPayment;
  }

  if (resolvedDownPayment === 0 && resolvedLoanAmount > 0 && purchasePrice > 0) {
    resolvedDownPayment = purchasePrice - resolvedLoanAmount;
  }

  const ltv = purchasePrice > 0 && resolvedLoanAmount > 0 ? (resolvedLoanAmount / purchasePrice) * 100 : 0;

  return { loanAmount: resolvedLoanAmount, downPayment: resolvedDownPayment, ltv };
}

// 16. Day-One Cashflow = NOI – Total Debt Service
function computeCashFlow({ noi = 0, totalDebtService = 0 }) {
  return noi - totalDebtService;
}

// 19. DSCR = NOI ÷ Bank Debt Service
function computeDSCR({ noi = 0, bankDebtService = 0 }) {
  if (noi <= 0 || bankDebtService <= 0) return 0;
  return noi / bankDebtService;
}

// 20. Break-Even Occupancy = (Operating Expenses + Debt Service) ÷ Gross Potential Rent
function computeBreakEvenOccupancy({ operatingExpenses = 0, debtService = 0, grossPotentialRent = 0 }) {
  if (grossPotentialRent <= 0) return 0;
  return (operatingExpenses + debtService) / grossPotentialRent;
}

/**
 * Main comprehensive calculation engine
 * @param {Object} scenarioData - Full deal data
 * @param {Object} options - Additional calculation options
 * @returns {Object} Complete financial analysis
 */
export function calculateFullAnalysis(scenarioData, options = {}) {
  const enableDebug = options.debug === true;
  const debug = enableDebug ? { inputs: {}, intermediates: {}, mappings: {} } : null;

  const {
    property = {},
    pricing_financing = {},
    pnl = {},
    expenses = {},
    financing = {},
    unit_mix = [],
    underwriting = {},
    income_details = {}
  } = scenarioData;

  // === ACQUISITION ASSUMPTIONS ===
  const purchasePrice = pricing_financing.purchase_price || pricing_financing.price || 0;
  const closingCostsPct = (pricing_financing.closing_costs_percent || 2.0) / 100;
  const acquisitionFeePct = (pricing_financing.acquisition_fee_percent || 1.0) / 100;
  const upfrontCapEx = pricing_financing.upfront_capex || 0;

  if (debug) {
    debug.inputs.purchasePrice = purchasePrice;
    debug.inputs.closingCostsPct = closingCostsPct;
    debug.inputs.acquisitionFeePct = acquisitionFeePct;
    debug.inputs.upfrontCapEx = upfrontCapEx;
  }
  
  // Discount rate for DCF valuation
  const discountRate = (underwriting?.discount_rate || 7.5) / 100;
  const replacementCostPSF = property?.replacement_cost_psf || 0;
  
  const closingCosts = purchasePrice * closingCostsPct;
  const acquisitionFee = purchasePrice * acquisitionFeePct;
  const totalAcquisitionCosts = purchasePrice + closingCosts + acquisitionFee + upfrontCapEx;
  
  // === FINANCING ASSUMPTIONS ===
  // Use ONLY backend parsed data - NO CALCULATIONS
  const loanAmount = pricing_financing.loan_amount || 0;
  const annualDebtService = pricing_financing.annual_debt_service || 0;
  const downPayment = pricing_financing.down_payment || 0;
  const monthlyPayment = pricing_financing.monthly_payment || 0;
  const rawInterestRate = pricing_financing.interest_rate || 0;
  const interestRate = rawInterestRate > 1 ? rawInterestRate / 100 : rawInterestRate;
  const loanTermYears = pricing_financing.term_years || 10;
  const amortYears = pricing_financing.amortization_years || 30;
  
  // For display only (percentage 0-100)
  const ltvDecimal = loanAmount > 0 && purchasePrice > 0 ? (loanAmount / purchasePrice) : 0;
  const ioYears = 0;
  const loanFeesPct = 0;
  const financingFeesPct = 0;
  const loanFees = 0;
  const financingFees = 0;
  const netLoanFunding = loanAmount;
  const totalEquityRequired = downPayment > 0 ? downPayment : (purchasePrice - loanAmount);

  if (debug) {
    debug.inputs.loanAmount = loanAmount;
    debug.inputs.annualDebtService = annualDebtService;
    debug.inputs.downPayment = downPayment;
    debug.inputs.rawInterestRate = rawInterestRate;
    debug.inputs.interestRate = interestRate;
    debug.inputs.loanTermYears = loanTermYears;
    debug.inputs.amortYears = amortYears;
    debug.inputs.totalEquityRequired = totalEquityRequired;
  }
  
  // === REVENUE CALCULATIONS ===
  // Prefer backend parsed data, but fall back to explicit formulas when needed
  const potentialGrossIncome = pnl.potential_gross_income || pnl.gross_potential_rent || 0;
  const otherIncome = pnl.other_income || 0;
  const vacancyLoss = pnl.vacancy_amount || 0;
  const vacancyRate = pnl.vacancy_rate || 0;

  const effectiveGrossIncomeBackend = pnl.effective_gross_income || 0;
  const totalOperatingExpenses =
    pnl.operating_expenses_t12 != null
      ? pnl.operating_expenses_t12
      : (pnl.operating_expenses != null ? pnl.operating_expenses : 0);
  
  const effectiveGrossIncome = computeEGI({
    potentialGrossIncome,
    otherIncome,
    vacancyLoss,
    effectiveGrossIncome: effectiveGrossIncomeBackend
  });

  const noiBackend =
    pnl.noi_t12 != null
      ? pnl.noi_t12
      : (pnl.noi != null ? pnl.noi : 0);
  const noi = computeNOI({
    egi: effectiveGrossIncome,
    operatingExpenses: totalOperatingExpenses,
    noiOverride: noiBackend
  });

  if (debug) {
    debug.inputs.potentialGrossIncome = potentialGrossIncome;
    debug.inputs.otherIncome = otherIncome;
    debug.inputs.vacancyLoss = vacancyLoss;
    debug.inputs.vacancyRate = vacancyRate;
    debug.inputs.effectiveGrossIncomeBackend = effectiveGrossIncomeBackend;
    debug.inputs.totalOperatingExpenses = totalOperatingExpenses;
    debug.inputs.noiBackend = noiBackend;

    debug.intermediates.effectiveGrossIncome = effectiveGrossIncome;
    debug.intermediates.noi = noi;
  }
  
  const expenseItems = {
    taxes: expenses.taxes || 0,
    insurance: expenses.insurance || 0,
    utilities: expenses.utilities || 0,
    repairs_maintenance: expenses.repairs_maintenance || 0,
    management: expenses.management || 0,
    payroll: expenses.payroll || 0,
    admin: expenses.admin || 0,
    marketing: expenses.marketing || 0
  };
  // === YEAR 1 METRICS ===
  // Calculate from backend data only
  const capRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 0;
  const cashFlowAfterDebt = noi - annualDebtService;
  const dscr = annualDebtService > 0 && noi > 0 ? noi / annualDebtService : 0;
  const debtYield = loanAmount > 0 && noi > 0 ? (noi / loanAmount) * 100 : 0;
  const cashOnCash = totalEquityRequired > 0 ? (cashFlowAfterDebt / totalEquityRequired) * 100 : 0;
  const expenseRatio = effectiveGrossIncome > 0 && totalOperatingExpenses > 0 ? (totalOperatingExpenses / effectiveGrossIncome) * 100 : 0;

  if (debug) {
    debug.intermediates.capRate = capRate;
    debug.intermediates.cashFlowAfterDebt = cashFlowAfterDebt;
    debug.intermediates.dscr = dscr;
    debug.intermediates.debtYield = debtYield;
    debug.intermediates.cashOnCash = cashOnCash;
    debug.intermediates.expenseRatio = expenseRatio;
  }
  
  // === GROWTH RATES ===
  const incomeGrowthRate = (underwriting?.income_growth_rate || 0.0) / 100;
  const expenseGrowthRate = (underwriting?.expense_growth_rate || 3.0) / 100;
  const taxGrowthRate = (underwriting?.tax_growth_rate || 3.0) / 100;
  const capExGrowthRate = (underwriting?.capex_growth_rate || 0.0) / 100;
  
  // === CAPITAL EXPENDITURES ===
  const tenantImprovementsPSF = income_details?.tenant_improvements_psf || 3.0;
  const leasingCommissionsPct = (income_details?.leasing_commissions_pct || 0.0) / 100;
  
  // === MULTI-YEAR PROJECTIONS ===
  // Use a single canonical holding period so all tabs match
  const holdingPeriod = underwriting?.holding_period || financing?.holding_period || 5;
  // Robust exit cap handling: avoid zero/insane values
  let rawExitCap =
    underwriting?.exit_cap_rate ??
    financing?.exit_cap_rate ??
    7.25; // default visible base-case exit cap used across UI

  if (!rawExitCap || rawExitCap <= 0 || rawExitCap > 20) {
    rawExitCap = 7.25;
  }

  const exitCapRate = rawExitCap / 100;
  const marketCapRateY1 = (underwriting?.market_cap_rate_y1 || rawExitCap) / 100;

  if (debug) {
    debug.inputs.holdingPeriod = holdingPeriod;
    debug.inputs.rawExitCap = rawExitCap;
    debug.inputs.exitCapRate = exitCapRate;
    debug.inputs.marketCapRateY1 = marketCapRateY1;
  }
  
  const projections = [];
  const exitScenarios = []; // IRR for exit in each year

  // Base year for projections should line up with the Year 1
  // effective gross income and normalized expenses already
  // calculated above so that Year 1 in projections matches
  // the core Year 1 metrics the rest of the app uses.
  let currentEGI = effectiveGrossIncome;
  let currentExpenses = totalOperatingExpenses;
  let currentTaxes = expenseItems.taxes;
  let currentLoanBalance = loanAmount;
  
  for (let year = 1; year <= 10; year++) {
    // Apply growth rates
    if (year > 1) {
      currentEGI *= (1 + incomeGrowthRate);
      currentExpenses *= (1 + expenseGrowthRate);
      currentTaxes *= (1 + taxGrowthRate);
    }

    // Treat EGI as the base "revenue" line; vacancy has already
    // been accounted for in the Year 1 effectiveGrossIncome and
    // we grow that net of vacancy going forward. This keeps the
    // NOI path consistent with the value-add tab and core Year 1.
    const yearEGI = currentEGI;
    const yearNOI = yearEGI - currentExpenses;
    
    // Capital expenditures (Tenant Improvements + Leasing Commissions + Recurring)
    const netRentableSF = property.net_rentable_sf || 1;
    let tenantImprovements = 0;
    let leasingCommissions = 0;
    let miscCapEx = 0;
    
    // TI in year 1 and year equal to holding period
    if (year === 1 || year === holdingPeriod) {
      tenantImprovements = netRentableSF * tenantImprovementsPSF;
    }
    
    // Leasing commissions based on rent roll turnover (simplified: assume some units turn)
    if (year > 1) {
      leasingCommissions = yearEGI * leasingCommissionsPct;
    }
    
    // Misc recurring CapEx (set to 0 by default; handled explicitly elsewhere if needed)
    miscCapEx = 0;
    
    const totalCapEx = tenantImprovements + leasingCommissions + miscCapEx;
    
    // Cash flow from operations
    const yearCashFlowFromOps = yearNOI - totalCapEx;
    
    // Debt service and cash flow after financing
    const yearCashFlowAfterFinancing = yearCashFlowFromOps - annualDebtService;
    
    // Update loan balance
    if (year > ioYears && year <= loanTermYears) {
      currentLoanBalance = calculateLoanBalance(loanAmount, interestRate, amortYears, year);
    }
    
    // Exit calculations (if sold in this year)
    // Use only positive NOI for pricing to avoid absurd negative values
    const exitNOI = Math.max(yearNOI, 0);
    const safeExitCap = exitCapRate > 0 ? exitCapRate : 0.06;
    const grossSalesPrice = exitNOI > 0 ? exitNOI / safeExitCap : 0;
    const sellingCosts = grossSalesPrice * 0.02; // 2% selling costs
    const netSalesProceeds = grossSalesPrice - sellingCosts;
    const loanPayoff = year <= loanTermYears ? currentLoanBalance : 0;
    const reversionCashFlow = netSalesProceeds - loanPayoff;
    
    // Metrics
    const yearDSCR = annualDebtService > 0 ? yearNOI / annualDebtService : 0;
    const yearDebtYield = loanPayoff > 0 ? (yearNOI / loanPayoff) * 100 : 0;
    const yearCashOnCash = totalEquityRequired > 0 ? (yearCashFlowAfterFinancing / totalEquityRequired) * 100 : 0;
    
    // Per SF metrics
    const rentPerSF = yearEGI / netRentableSF;
    const expensesPerSF = currentExpenses / netRentableSF;
    const noiPerSF = yearNOI / netRentableSF;
    
    // Operating metrics
    const expenseRecoveryPct = 0; // Not applicable for this deal type
    const capExAsPercentOfNOI = yearNOI > 0 ? (totalCapEx / yearNOI) * 100 : 0;
    const taxMillRate = 0; // Would need assessed value
    
    projections.push({
      year,
      // Income
      potentialGrossIncome: Math.round(yearEGI + vacancyLoss - otherIncome),
      vacancyLoss: Math.round(vacancyLoss),
      otherIncome: Math.round(otherIncome),
      effectiveGrossIncome: Math.round(yearEGI),
      
      // Expenses
      operatingExpenses: Math.round(currentExpenses),
      taxes: Math.round(currentTaxes),
      
      // NOI & CapEx
      noi: Math.round(yearNOI),
      tenantImprovements: Math.round(tenantImprovements),
      leasingCommissions: Math.round(leasingCommissions),
      miscCapEx: Math.round(miscCapEx),
      totalCapEx: Math.round(totalCapEx),
      cashFlowFromOps: Math.round(yearCashFlowFromOps),
      
      // Debt
      debtService: Math.round(annualDebtService),
      loanBalance: Math.round(currentLoanBalance),
      
      // Cash Flow
      cashFlowAfterFinancing: Math.round(yearCashFlowAfterFinancing),
      
      // Exit scenario
      exitCapRate: exitCapRate * 100,
      grossSalesPrice: Math.round(grossSalesPrice),
      sellingCosts: Math.round(sellingCosts),
      netSalesProceeds: Math.round(netSalesProceeds),
      loanPayoff: Math.round(loanPayoff),
      reversionCashFlow: Math.round(reversionCashFlow),
      
      // Metrics
      dscr: yearDSCR,
      debtYield: yearDebtYield,
      cashOnCash: yearCashOnCash,
      capRate: yearNOI > 0 && grossSalesPrice > 0 ? (yearNOI / grossSalesPrice) * 100 : 0,
      
      // Per SF
      rentPerSF: rentPerSF,
      expensesPerSF: expensesPerSF,
      noiPerSF: noiPerSF,
      
      // Ratios
      expenseRatio: yearEGI > 0 ? (currentExpenses / yearEGI) * 100 : 0,
      expenseRecoveryPct: expenseRecoveryPct,
      capExAsPercentOfNOI: capExAsPercentOfNOI,
      taxMillRate: taxMillRate
    });
  }
  
  // === IRR FOR EACH EXIT SCENARIO ===
  for (let exitYear = 1; exitYear <= 10; exitYear++) {
    const exitCashFlows = [
      -totalEquityRequired,
      ...projections.slice(0, exitYear).map(p => p.cashFlowAfterFinancing)
    ];
    exitCashFlows[exitYear] += projections[exitYear - 1].reversionCashFlow;
    
    const exitIRR = calculateIRR(exitCashFlows) * 100;
    
    exitScenarios.push({
      exitYear: exitYear,
      irr: exitIRR,
      equityMultiple: exitCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0) / totalEquityRequired,
      totalCashReturned: Math.round(exitCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0)),
      totalProfit: Math.round(exitCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0) - totalEquityRequired)
    });
  }
  
  // === UNLEVERED IRR (without debt) ===
  const unleveredCashFlows = [
    -totalAcquisitionCosts,
    ...projections.slice(0, holdingPeriod).map(p => p.cashFlowFromOps)
  ];
  // Add reversion at exit
  unleveredCashFlows[holdingPeriod] += projections[holdingPeriod - 1].netSalesProceeds;
  
  const unleveredIRR = calculateIRR(unleveredCashFlows) * 100;
  const unleveredEquityMultiple = unleveredCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0) / totalAcquisitionCosts;
  
  // === LEVERED IRR (with debt) ===
  const leveredCashFlows = [
    -totalEquityRequired,
    ...projections.slice(0, holdingPeriod).map(p => p.cashFlowAfterFinancing)
  ];
  // Add reversion at exit
  leveredCashFlows[holdingPeriod] += projections[holdingPeriod - 1].reversionCashFlow;
  
  const leveredIRR = calculateIRR(leveredCashFlows) * 100;
  const leveredEquityMultiple = leveredCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0) / totalEquityRequired;
  
  // === AVERAGE RETURNS ===
  const avgCashOnCash = projections.slice(0, holdingPeriod).reduce((sum, p) => sum + p.cashOnCash, 0) / holdingPeriod;
  const avgFreeAndClearReturn = projections.slice(0, holdingPeriod).reduce((sum, p) => {
    return sum + (p.cashFlowFromOps / totalAcquisitionCosts) * 100;
  }, 0) / holdingPeriod;
  
  // === MINIMUM METRICS ===
  const minDSCR = Math.min(...projections.slice(0, holdingPeriod).map(p => p.dscr));
  const minDebtYield = Math.min(...projections.slice(0, holdingPeriod).map(p => p.debtYield));
  
  // === DCF / TERMINAL VALUE CALCULATION ===
  const terminalNOI = Math.max(projections[holdingPeriod - 1].noi, 0);
  const safeTerminalCap = exitCapRate > 0 ? exitCapRate : 0.06;
  const terminalValue = terminalNOI > 0 ? terminalNOI / safeTerminalCap : 0;

  if (debug) {
    debug.intermediates.terminalNOI = terminalNOI;
    debug.intermediates.safeTerminalCap = safeTerminalCap;
    debug.intermediates.terminalValue = terminalValue;
  }
  
  // Calculate NPV of all cash flows
  const dcfCashFlows = projections.slice(0, holdingPeriod).map((p, idx) => {
    return p.cashFlowFromOps / Math.pow(1 + discountRate, idx + 1);
  });
  
  // Add discounted terminal value
  const discountedTerminalValue = terminalValue / Math.pow(1 + discountRate, holdingPeriod);
  const dcfValue = dcfCashFlows.reduce((sum, cf) => sum + cf, 0) + discountedTerminalValue;
  
  // Calculated purchase price based on Year 1 NOI and market cap rate
  const calculatedPurchasePrice = noi / marketCapRateY1;

   if (debug) {
    debug.intermediates.discountRate = discountRate;
    debug.intermediates.dcfValue = dcfValue;
    debug.intermediates.calculatedPurchasePrice = calculatedPurchasePrice;
  }
  
  // === SOURCES & USES ===
  const sourcesAndUses = {
    sources: {
      loanAmount: Math.round(loanAmount),
      equity: Math.round(totalEquityRequired),
      total: Math.round(loanAmount + totalEquityRequired)
    },
    uses: {
      purchasePrice: Math.round(purchasePrice),
      closingCosts: Math.round(closingCosts),
      acquisitionFee: Math.round(acquisitionFee),
      upfrontCapEx: Math.round(upfrontCapEx),
      loanFees: Math.round(loanFees),
      financingFees: Math.round(financingFees),
      total: Math.round(totalAcquisitionCosts)
    }
  };

  // === EXIT TIMELINES (DEBT & EQUITY) ===

  // Debt timeline: derive from existing projections and financing inputs only.
  // We treat loanBalance as end-of-year balance and back into principal/interest
  // using the already-computed annualDebtService.
  const debtTimeline = [];
  if (loanAmount > 0 && projections.length > 0) {
    let beginningBalance = loanAmount;
    let cumulativePrincipalPaid = 0;

    for (let i = 0; i < projections.length; i++) {
      const p = projections[i];

      // Only model through the loan term
      if (p.year > loanTermYears) break;

      const endingBalance = p.loanBalance;
      const principalPaid = Math.max(0, beginningBalance - endingBalance);
      const interestPaid = Math.max(0, annualDebtService - principalPaid);
      cumulativePrincipalPaid += principalPaid;

      const isExitYear = p.year === holdingPeriod;
      const isMaturityYear = p.year === loanTermYears;

      debtTimeline.push({
        year: p.year,
        beginningBalance: Math.round(beginningBalance),
        endingBalance: Math.round(endingBalance),
        annualDebtService: Math.round(annualDebtService),
        principalPaid: Math.round(principalPaid),
        interestPaid: Math.round(interestPaid),
        cumulativePrincipalPaid: Math.round(cumulativePrincipalPaid),
        loanPayoff: Math.round(p.loanPayoff || 0),
        isExitYear,
        isMaturityYear
      });

      beginningBalance = endingBalance;
    }
  }

  // Equity exit timeline: track how levered cash flows return and grow equity
  // over the modeled holding period. This is a pure reformat of existing
  // projections/leveredCashFlows, not new economics.
  const equityExitTimeline = {
    initialEquity: Math.round(totalEquityRequired),
    exitYear: holdingPeriod,
    paybackYear: null,
    finalEquityMultiple: leveredEquityMultiple,
    finalIRR: leveredIRR,
    rows: []
  };

  if (projections.length > 0 && holdingPeriod > 0 && holdingPeriod <= projections.length) {
    let cumulativeDistributions = 0;

    for (let yearIdx = 0; yearIdx < holdingPeriod; yearIdx++) {
      const p = projections[yearIdx];

      // Base annual distribution: cash flow after financing
      let annualDistribution = p.cashFlowAfterFinancing;

      // In the exit year, include the reversion cash flow as well
      let exitDistribution = 0;
      if (p.year === holdingPeriod) {
        exitDistribution = p.reversionCashFlow || 0;
      }

      const totalDistribution = annualDistribution + exitDistribution;
      cumulativeDistributions += totalDistribution;

      const equityReturned = Math.min(totalEquityRequired, cumulativeDistributions);
      const equityRemaining = Math.max(0, totalEquityRequired - cumulativeDistributions);
      const equityReturnPct = totalEquityRequired > 0
        ? Math.min(100, (equityReturned / totalEquityRequired) * 100)
        : 0;

      if (!equityExitTimeline.paybackYear && equityReturned >= totalEquityRequired && totalEquityRequired > 0) {
        equityExitTimeline.paybackYear = p.year;
      }

      equityExitTimeline.rows.push({
        year: p.year,
        annualDistribution: Math.round(annualDistribution),
        exitDistribution: Math.round(exitDistribution),
        totalDistribution: Math.round(totalDistribution),
        cumulativeDistributions: Math.round(cumulativeDistributions),
        equityReturned: Math.round(equityReturned),
        equityRemaining: Math.round(equityRemaining),
        equityReturnPct
      });
    }
  }
  
  // === ADVANCED FEATURES ===
  
  // Loan Amortization Schedule
  const amortizationSchedule = loanAmount > 0 && ioYears < loanTermYears
    ? calculateAmortizationSchedule(loanAmount, interestRate, amortYears, 10)
    : [];
  
  // Rent Roll Analysis (if unit mix data exists)
  const rentRollAnalysis = unit_mix && unit_mix.length > 0
    ? analyzeRentRoll(unit_mix, {
        marketRentGrowth: incomeGrowthRate,
        renewalProbability: 0.75,
        downtime: 3,
        tiPerSF: tenantImprovementsPSF,
        lcPercent: leasingCommissionsPct
      })
    : null;
  
  // Management Fees
  const managementFees = calculateManagementFees(scenarioData, projections);
  
  // Tax Analysis (with depreciation)
  const taxAnalysis = calculateTaxAnalysis(scenarioData, projections, {
    landValuePct: 0.20,
    depreciationPeriod: 27.5, // Residential
    taxRate: 0.37
  });
  
  // Month-by-Month Year 1
  const monthlyYear1 = calculateMonthlyYear1(projections[0], {
    stabilizationMonth: 12,
    initialOccupancy: 1 - vacancyRate,
    targetOccupancy: 0.95
  });
  
  // Multi-Tier Partnership Waterfall (example structure)
  const multiTierWaterfall = calculateMultiTierWaterfall(leveredCashFlows, {
    lpContribution: totalEquityRequired * 0.90,
    gpContribution: totalEquityRequired * 0.10,
    tiers: [
      { type: 'returnOfCapital', lpPct: 1.0, gpPct: 0.0 },
      { type: 'preferredReturn', rate: 0.08, lpPct: 1.0, gpPct: 0.0 },
      { type: 'catchUp', lpPct: 0.0, gpPct: 1.0, limit: 'untilGP20%' },
      { type: 'promote', lpPct: 0.80, gpPct: 0.20 }
    ]
  });

  if (debug) {
    debug.mappings.summary = {
      currentNOI: 'year1.noi',
      goingInCapRate: 'year1.capRate',
      dscr: 'year1.dscr',
      cashOnCash: 'year1.cashOnCash',
      expenseRatio: 'year1.expenseRatio'
    };
    debug.mappings.dealStructure = {
      totalEquityRequired: 'financing.totalEquityRequired',
      loanAmount: 'financing.loanAmount',
      ltv: 'financing.ltv',
      annualDebtService: 'financing.annualDebtService'
    };
    debug.mappings.exit = {
      exitNOI: `projections[${holdingPeriod - 1}].noi`,
      grossSalesPrice: `projections[${holdingPeriod - 1}].grossSalesPrice`,
      netSalesProceeds: `projections[${holdingPeriod - 1}].netSalesProceeds`,
      reversionCashFlow: `projections[${holdingPeriod - 1}].reversionCashFlow`
    };
    debug.mappings.valueAdd = {
      terminalValue: 'returns.terminalValue',
      unleveredIRR: 'returns.unleveredIRR',
      leveredIRR: 'returns.leveredIRR'
    };
  }
  
  // === RETURN OBJECT ===
  return {
    // Normalized current/stabilized views used by AI + UI
    current: {
      price: Math.round(purchasePrice),
      noi: Math.round(noi),
      capRate: capRate,
      dscr: dscr,
      cashflow: Math.round(cashFlowAfterDebt),
      expenseRatio: expenseRatio,
      debtService: Math.round(annualDebtService),
      occupancy: vacancyRate > 0 ? 1 - vacancyRate : null
    },

    stabilized: {
      noi: projections[holdingPeriod - 1] ? Math.round(projections[holdingPeriod - 1].noi) : 0,
      dscr: projections[holdingPeriod - 1] ? projections[holdingPeriod - 1].dscr : 0,
      cashflow: projections[holdingPeriod - 1] ? Math.round(projections[holdingPeriod - 1].cashFlowAfterFinancing) : 0,
      value: Math.round(terminalValue),
      equityMultiple: leveredEquityMultiple,
      irr: leveredIRR
    },

    total_project_cost: Math.round(totalAcquisitionCosts),
    valueCreation: Math.round(terminalValue - totalAcquisitionCosts),

    // Year 1 Metrics
    year1: {
      potentialGrossIncome: Math.round(potentialGrossIncome),
      vacancyLoss: Math.round(vacancyLoss),
      effectiveGrossIncome: Math.round(effectiveGrossIncome),
      totalOperatingExpenses: Math.round(totalOperatingExpenses),
      noi: Math.round(noi),
      capRate: capRate,
      debtService: Math.round(annualDebtService),
      cashFlow: Math.round(cashFlowAfterDebt),
      dscr: dscr,
      debtYield: debtYield,
      cashOnCash: cashOnCash,
      expenseRatio: expenseRatio
    },
    
    // Acquisition
    acquisition: {
      purchasePrice: Math.round(purchasePrice),
      closingCosts: Math.round(closingCosts),
      acquisitionFee: Math.round(acquisitionFee),
      upfrontCapEx: Math.round(upfrontCapEx),
      totalAcquisitionCosts: Math.round(totalAcquisitionCosts),
      pricePerSF: property.net_rentable_sf > 0 ? Math.round(purchasePrice / property.net_rentable_sf) : 0,
      pricePerUnit: (property.total_units || property.units) > 0
        ? Math.round(purchasePrice / (property.total_units || property.units))
        : 0,
      dcfValue: Math.round(dcfValue),
      calculatedPurchasePrice: Math.round(calculatedPurchasePrice),
      replacementCost: property.net_rentable_sf > 0 ? Math.round(property.net_rentable_sf * replacementCostPSF) : 0,
      replacementCostPSF: replacementCostPSF
    },
    
    // Financing
    financing: {
      loanAmount: Math.round(loanAmount),
      ltv: ltvDecimal * 100,
      interestRate: interestRate * 100,
      loanTermYears,
      amortYears,
      ioYears,
      loanFees: Math.round(loanFees),
      financingFees: Math.round(financingFees),
      netLoanFunding: Math.round(netLoanFunding),
      monthlyPayment: Math.round(monthlyPayment),
      annualDebtService: Math.round(annualDebtService),
      totalEquityRequired: Math.round(totalEquityRequired)
    },
    
    // Returns
    returns: {
      unleveredIRR: unleveredIRR,
      unleveredEquityMultiple: unleveredEquityMultiple,
      leveredIRR: leveredIRR,
      leveredEquityMultiple: leveredEquityMultiple,
      avgCashOnCash: avgCashOnCash,
      avgFreeAndClearReturn: avgFreeAndClearReturn,
      minDSCR: minDSCR,
      minDebtYield: minDebtYield,
      holdingPeriod: holdingPeriod,
      exitScenarios: exitScenarios, // IRR for exiting in each year
      discountRate: discountRate * 100,
      marketCapRateY1: marketCapRateY1 * 100,
      terminalValue: Math.round(terminalValue),
      terminalCapRate: exitCapRate * 100
    },
    
    // Exit (at holding period)
    exit: projections[holdingPeriod - 1]
      ? {
          ...projections[holdingPeriod - 1],
          debtTimeline,
          equityExitTimeline
        }
      : null,
    
    // Projections
    projections: projections,
    
    // Sources & Uses
    sourcesAndUses: sourcesAndUses,
    
    // Cash flow arrays for charts/analysis
    cashFlowArrays: {
      unleveredCashFlows: unleveredCashFlows,
      leveredCashFlows: leveredCashFlows
    },
    
    // === ADVANCED FEATURES ===
    amortizationSchedule: amortizationSchedule,
    rentRollAnalysis: rentRollAnalysis,
    managementFees: managementFees,
    taxAnalysis: taxAnalysis,
    monthlyYear1: monthlyYear1,
    multiTierWaterfall: multiTierWaterfall,
    debug: debug
  };
}

/**
 * Calculate partnership waterfall (GP/LP splits with preferred return)
 * @param {number} totalProfit - Total profit to split
 * @param {number} lpContribution - LP capital contribution
 * @param {number} gpContribution - GP capital contribution
 * @param {number} preferredReturn - Preferred return as decimal (e.g., 0.08 = 8%)
 * @param {number} catchUp - GP catch-up percentage as decimal
 * @param {number} promote - GP promote after preferred return as decimal
 * @returns {Object} Distribution breakdown
 */
export function calculateWaterfall(totalProfit, lpContribution, gpContribution, preferredReturn = 0.08, catchUp = 1.0, promote = 0.20) {
  const totalContribution = lpContribution + gpContribution;
  const lpPct = lpContribution / totalContribution;
  const gpPct = gpContribution / totalContribution;
  
  let remainingProfit = totalProfit;
  const distributions = {
    lp: { returnOfCapital: 0, preferredReturn: 0, catchUp: 0, promote: 0, total: 0 },
    gp: { returnOfCapital: 0, preferredReturn: 0, catchUp: 0, promote: 0, total: 0 }
  };
  
  // 1. Return of capital (pro-rata)
  const returnOfCapital = Math.min(remainingProfit, totalContribution);
  distributions.lp.returnOfCapital = returnOfCapital * lpPct;
  distributions.gp.returnOfCapital = returnOfCapital * gpPct;
  remainingProfit -= returnOfCapital;
  
  if (remainingProfit <= 0) {
    distributions.lp.total = distributions.lp.returnOfCapital;
    distributions.gp.total = distributions.gp.returnOfCapital;
    return distributions;
  }
  
  // 2. Preferred return to LP
  const preferredReturnAmount = lpContribution * preferredReturn;
  const preferredReturnPaid = Math.min(remainingProfit, preferredReturnAmount);
  distributions.lp.preferredReturn = preferredReturnPaid;
  remainingProfit -= preferredReturnPaid;
  
  if (remainingProfit <= 0) {
    distributions.lp.total = distributions.lp.returnOfCapital + distributions.lp.preferredReturn;
    distributions.gp.total = distributions.gp.returnOfCapital;
    return distributions;
  }
  
  // 3. GP catch-up
  const gpCatchUpAmount = preferredReturnPaid * (catchUp / (1 - catchUp));
  const gpCatchUpPaid = Math.min(remainingProfit, gpCatchUpAmount);
  distributions.gp.catchUp = gpCatchUpPaid;
  remainingProfit -= gpCatchUpPaid;
  
  if (remainingProfit <= 0) {
    distributions.lp.total = distributions.lp.returnOfCapital + distributions.lp.preferredReturn;
    distributions.gp.total = distributions.gp.returnOfCapital + distributions.gp.catchUp;
    return distributions;
  }
  
  // 4. Remaining promote split
  distributions.lp.promote = remainingProfit * (1 - promote);
  distributions.gp.promote = remainingProfit * promote;
  
  // Calculate totals
  distributions.lp.total = Object.values(distributions.lp).reduce((sum, val) => sum + val, 0) - distributions.lp.total;
  distributions.gp.total = Object.values(distributions.gp).reduce((sum, val) => sum + val, 0) - distributions.gp.total;
  
  return distributions;
}

/**
 * Calculate loan amortization schedule
 * @param {number} principal - Loan amount
 * @param {number} annualRate - Annual interest rate as decimal
 * @param {number} amortYears - Amortization period in years
 * @param {number} years - Number of years to calculate (default 10)
 * @returns {Array} Amortization schedule by year
 */
export function calculateAmortizationSchedule(principal, annualRate, amortYears, years = 10) {
  const schedule = [];
  const monthlyRate = annualRate / 12;
  const monthlyPayment = calculateMortgagePayment(principal, annualRate, amortYears);
  
  let balance = principal;
  
  for (let year = 1; year <= years; year++) {
    let annualPrincipal = 0;
    let annualInterest = 0;
    
    for (let month = 1; month <= 12; month++) {
      if (balance <= 0) break;
      
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      
      annualInterest += interestPayment;
      annualPrincipal += principalPayment;
      balance -= principalPayment;
      
      if (balance < 0) balance = 0;
    }
    
    schedule.push({
      year,
      payment: Math.round(monthlyPayment * 12),
      principal: Math.round(annualPrincipal),
      interest: Math.round(annualInterest),
      balance: Math.round(balance),
      cumulativePrincipal: Math.round(principal - balance)
    });
  }
  
  return schedule;
}

/**
 * Calculate sensitivity analysis - how returns change with different assumptions
 * @param {Object} baseScenario - Base scenario data
 * @param {Object} ranges - Ranges to test { purchasePrice: [min, max, step], exitCap: [...], ... }
 * @returns {Object} Sensitivity tables
 */
export function calculateSensitivity(baseScenario, ranges = {}) {
  const results = {
    purchasePrice: [],
    exitCapRate: [],
    incomeGrowth: [],
    vacancy: []
  };
  
  // Purchase Price Sensitivity
  if (ranges.purchasePrice) {
    const [min, max, step] = ranges.purchasePrice;
    for (let price = min; price <= max; price += step) {
      const scenario = { ...baseScenario, pricing_financing: { ...baseScenario.pricing_financing, purchase_price: price } };
      const analysis = calculateFullAnalysis(scenario);
      results.purchasePrice.push({
        purchasePrice: price,
        leveredIRR: analysis.returns.leveredIRR,
        equityMultiple: analysis.returns.leveredEquityMultiple,
        cashOnCash: analysis.year1.cashOnCash
      });
    }
  }
  
  // Exit Cap Rate Sensitivity
  if (ranges.exitCapRate) {
    const [min, max, step] = ranges.exitCapRate;
    for (let cap = min; cap <= max; cap += step) {
      const scenario = { ...baseScenario, underwriting: { ...baseScenario.underwriting, exit_cap_rate: cap } };
      const analysis = calculateFullAnalysis(scenario);
      results.exitCapRate.push({
        exitCapRate: cap,
        leveredIRR: analysis.returns.leveredIRR,
        equityMultiple: analysis.returns.leveredEquityMultiple
      });
    }
  }
  
  // Income Growth Sensitivity
  if (ranges.incomeGrowth) {
    const [min, max, step] = ranges.incomeGrowth;
    for (let growth = min; growth <= max; growth += step) {
      const scenario = { ...baseScenario, underwriting: { ...baseScenario.underwriting, income_growth_rate: growth } };
      const analysis = calculateFullAnalysis(scenario);
      results.incomeGrowth.push({
        incomeGrowth: growth,
        leveredIRR: analysis.returns.leveredIRR,
        equityMultiple: analysis.returns.leveredEquityMultiple
      });
    }
  }
  
  // Vacancy Sensitivity
  if (ranges.vacancy) {
    const [min, max, step] = ranges.vacancy;
    for (let vac = min; vac <= max; vac += step) {
      const scenario = { ...baseScenario, pnl: { ...baseScenario.pnl, vacancy_rate: vac } };
      const analysis = calculateFullAnalysis(scenario);
      results.vacancy.push({
        vacancy: vac,
        leveredIRR: analysis.returns.leveredIRR,
        noi: analysis.year1.noi
      });
    }
  }
  
  return results;
}

/**
 * Enhanced rent roll analysis with market rents and renewal projections
 * @param {Array} unitMix - Array of units with lease data
 * @param {Object} marketAssumptions - Market rent assumptions
 * @returns {Object} Detailed rent roll analysis
 */
export function analyzeRentRoll(unitMix, marketAssumptions = {}) {
  const {
    marketRentGrowth = 0.03,
    renewalProbability = 0.75,
    downtime = 3, // months
    tiPerSF = 3,
    lcPercent = 0.06
  } = marketAssumptions;
  
  // Transform unit mix data if needed (handle both old and new formats)
  const normalizedUnits = unitMix.map(unit => {
    // If it's already in the expected format, return as-is
    if (unit.square_feet !== undefined) return unit;
    
    // Transform from parsed format to expected format
    return {
      unit_number: unit.type || 'N/A',
      tenant_name: null, // Vacant by default for unit_mix data
      square_feet: unit.unit_sf || 0,
      monthly_rent: unit.rent_current || 0,
      market_rent_psf: unit.rent_market ? (unit.rent_market * 12) / (unit.unit_sf || 1) : ((unit.rent_current || 0) * 12) / (unit.unit_sf || 1),
      status: 'Vacant',
      lease_end_date: null,
      units_of_type: unit.units || 1
    };
  });
  
  // Expand units by count (if unit_mix has multiple units of same type)
  const expandedUnits = [];
  normalizedUnits.forEach(unit => {
    const count = unit.units_of_type || 1;
    for (let i = 0; i < count; i++) {
      expandedUnits.push({
        ...unit,
        unit_number: `${unit.unit_number} #${i + 1}`
      });
    }
  });
  
  const analysis = {
    units: [],
    summary: {
      totalUnits: expandedUnits.length,
      totalSF: 0,
      occupiedUnits: 0,
      occupiedSF: 0,
      vacantUnits: 0,
      vacantSF: 0,
      totalCurrentRent: 0,
      totalMarketRent: 0,
      avgCurrentRentPSF: 0,
      avgMarketRentPSF: 0,
      lossToLease: 0,
      lossToLeasePct: 0
    },
    expirations: {}
  };
  
  expandedUnits.forEach(unit => {
    const sf = unit.square_feet || 0;
    const monthlyRent = unit.monthly_rent || 0;
    const annualRent = monthlyRent * 12;
    const currentRentPSF = sf > 0 ? annualRent / sf : 0;
    
    // Estimate market rent (could be provided or calculated)
    const marketRentPSF = unit.market_rent_psf || currentRentPSF * 1.1; // Default 10% above current
    const marketAnnualRent = marketRentPSF * sf;
    
    const isVacant = unit.status === 'Vacant' || !unit.tenant_name;
    const leaseEndDate = unit.lease_end_date;
    const leaseEndYear = leaseEndDate ? new Date(leaseEndDate).getFullYear() : null;
    
    // Unit analysis
    analysis.units.push({
      unitNumber: unit.unit_number,
      tenant: unit.tenant_name || 'Vacant',
      sf: sf,
      currentRentPSF: currentRentPSF,
      marketRentPSF: marketRentPSF,
      currentAnnualRent: annualRent,
      marketAnnualRent: marketAnnualRent,
      lossToLease: marketAnnualRent - annualRent,
      lossToLeasePct: annualRent > 0 ? ((marketAnnualRent - annualRent) / annualRent) * 100 : 0,
      leaseEndDate: leaseEndDate,
      isVacant: isVacant,
      renewalProbability: !isVacant ? renewalProbability : 0,
      estimatedDowntime: isVacant ? downtime : (renewalProbability < 1 ? downtime * (1 - renewalProbability) : 0),
      estimatedTI: sf * tiPerSF,
      estimatedLC: marketAnnualRent * lcPercent
    });
    
    // Summary stats
    analysis.summary.totalSF += sf;
    if (!isVacant) {
      analysis.summary.occupiedUnits++;
      analysis.summary.occupiedSF += sf;
      analysis.summary.totalCurrentRent += annualRent;
    } else {
      analysis.summary.vacantUnits++;
      analysis.summary.vacantSF += sf;
    }
    analysis.summary.totalMarketRent += marketAnnualRent;
    
    // Track expirations by year
    if (leaseEndYear && !isVacant) {
      if (!analysis.expirations[leaseEndYear]) {
        analysis.expirations[leaseEndYear] = {
          year: leaseEndYear,
          units: 0,
          sf: 0,
          annualRent: 0
        };
      }
      analysis.expirations[leaseEndYear].units++;
      analysis.expirations[leaseEndYear].sf += sf;
      analysis.expirations[leaseEndYear].annualRent += annualRent;
    }
  });
  
  // Calculate averages
  if (analysis.summary.occupiedSF > 0) {
    analysis.summary.avgCurrentRentPSF = analysis.summary.totalCurrentRent / analysis.summary.occupiedSF;
  }
  if (analysis.summary.totalSF > 0) {
    analysis.summary.avgMarketRentPSF = analysis.summary.totalMarketRent / analysis.summary.totalSF;
  }
  analysis.summary.lossToLease = analysis.summary.totalMarketRent - analysis.summary.totalCurrentRent;
  if (analysis.summary.totalMarketRent > 0) {
    analysis.summary.lossToLeasePct = (analysis.summary.lossToLease / analysis.summary.totalMarketRent) * 100;
  }
  
  return analysis;
}

/**
 * Calculate management fees (acquisition, asset management, disposition)
 * @param {Object} dealData - Deal information
 * @param {Array} projections - Year-by-year projections
 * @returns {Object} Fee breakdown
 */
export function calculateManagementFees(dealData, projections) {
  const {
    pricing_financing = {},
    underwriting = {}
  } = dealData;
  
  const purchasePrice = pricing_financing.purchase_price || pricing_financing.price || 0;
  const holdingPeriod = underwriting.holding_period || 5;
  
  // Fee assumptions
  const acquisitionFeePct = (underwriting?.acquisition_fee_pct || 1.0) / 100;
  const assetManagementFeePct = (underwriting?.asset_management_fee_pct || 1.0) / 100;
  const dispositionFeePct = (underwriting?.disposition_fee_pct || 1.0) / 100;
  
  const fees = {
    acquisition: {
      fee: Math.round(purchasePrice * acquisitionFeePct),
      basis: 'Purchase Price',
      rate: acquisitionFeePct * 100
    },
    assetManagement: [],
    disposition: {
      fee: 0,
      basis: 'Sales Price',
      rate: dispositionFeePct * 100
    }
  };
  
  // Annual asset management fees
  projections.forEach((proj, idx) => {
    if (idx < holdingPeriod) {
      const fee = Math.round(proj.effectiveGrossIncome * assetManagementFeePct);
      fees.assetManagement.push({
        year: proj.year,
        fee: fee,
        basis: proj.effectiveGrossIncome
      });
    }
  });
  
  // Disposition fee (at exit)
  if (projections[holdingPeriod - 1]) {
    const salesPrice = projections[holdingPeriod - 1].grossSalesPrice;
    fees.disposition.fee = Math.round(salesPrice * dispositionFeePct);
    fees.disposition.basis = salesPrice;
  }
  
  return fees;
}

/**
 * Calculate detailed partnership waterfall with multiple tiers and IRR hurdles
 * @param {Array} cashFlows - Year-by-year cash flows
 * @param {Object} structure - Partnership structure with tiers
 * @returns {Object} Detailed waterfall by tier
 */
export function calculateMultiTierWaterfall(cashFlows, structure) {
  const {
    lpContribution = 100000,
    gpContribution = 0,
    tiers = [
      { type: 'returnOfCapital', lpPct: 1.0, gpPct: 0.0 },
      { type: 'preferredReturn', rate: 0.08, lpPct: 1.0, gpPct: 0.0 },
      { type: 'catchUp', lpPct: 0.0, gpPct: 1.0, limit: 'untilGP20%' },
      { type: 'promote', lpPct: 0.80, gpPct: 0.20 }
    ]
  } = structure;
  
  const totalContribution = lpContribution + gpContribution;
  const totalProfit = cashFlows.reduce((sum, cf) => sum + cf, 0);
  
  let remainingProfit = totalProfit;
  const waterfall = {
    tiers: [],
    lp: { total: 0, byTier: {} },
    gp: { total: 0, byTier: {} }
  };
  
  tiers.forEach((tier, idx) => {
    const tierResult = {
      tier: idx + 1,
      type: tier.type,
      amount: 0,
      lpAmount: 0,
      gpAmount: 0
    };
    
    if (remainingProfit <= 0) {
      waterfall.tiers.push(tierResult);
      return;
    }
    
    switch (tier.type) {
      case 'returnOfCapital':
        const roc = Math.min(remainingProfit, totalContribution);
        tierResult.amount = roc;
        tierResult.lpAmount = roc * (lpContribution / totalContribution);
        tierResult.gpAmount = roc * (gpContribution / totalContribution);
        remainingProfit -= roc;
        break;
        
      case 'preferredReturn':
        const prefAmount = lpContribution * tier.rate;
        const prefPaid = Math.min(remainingProfit, prefAmount);
        tierResult.amount = prefPaid;
        tierResult.lpAmount = prefPaid * tier.lpPct;
        tierResult.gpAmount = prefPaid * tier.gpPct;
        remainingProfit -= prefPaid;
        break;
        
      case 'catchUp':
        // GP catches up until they have their promote percentage
        const gpTarget = waterfall.lp.total * (tier.gpPct / tier.lpPct);
        const gpShortfall = gpTarget - waterfall.gp.total;
        const catchUp = Math.min(remainingProfit, Math.max(0, gpShortfall));
        tierResult.amount = catchUp;
        tierResult.lpAmount = 0;
        tierResult.gpAmount = catchUp;
        remainingProfit -= catchUp;
        break;
        
      case 'promote':
        tierResult.amount = remainingProfit;
        tierResult.lpAmount = remainingProfit * tier.lpPct;
        tierResult.gpAmount = remainingProfit * tier.gpPct;
        remainingProfit = 0;
        break;
        
      default:
        break;
    }
    
    waterfall.lp.total += tierResult.lpAmount;
    waterfall.gp.total += tierResult.gpAmount;
    waterfall.lp.byTier[tier.type] = tierResult.lpAmount;
    waterfall.gp.byTier[tier.type] = tierResult.gpAmount;
    waterfall.tiers.push(tierResult);
  });
  
  return waterfall;
}

/**
 * Calculate depreciation schedule and tax analysis
 * @param {Object} dealData - Deal information
 * @param {Array} projections - Year-by-year projections
 * @param {Object} taxAssumptions - Tax assumptions
 * @returns {Object} Tax analysis with depreciation
 */
export function calculateTaxAnalysis(dealData, projections, taxAssumptions = {}) {
  const {
    pricing_financing = {},
    underwriting = {}
  } = dealData;
  
  const purchasePrice = pricing_financing.purchase_price || pricing_financing.price || 0;
  const landValuePct = taxAssumptions.landValuePct || 0.20;
  const buildingValue = purchasePrice * (1 - landValuePct);
  const depreciationPeriod = taxAssumptions.depreciationPeriod || 27.5; // Residential = 27.5, Commercial = 39
  const annualDepreciation = buildingValue / depreciationPeriod;
  const taxRate = taxAssumptions.taxRate || 0.37; // Federal + State combined
  const holdingPeriod = underwriting.holding_period || 5;
  
  const analysis = {
    buildingValue: Math.round(buildingValue),
    landValue: Math.round(purchasePrice * landValuePct),
    depreciationPeriod: depreciationPeriod,
    annualDepreciation: Math.round(annualDepreciation),
    byYear: []
  };
  
  let cumulativeDepreciation = 0;
  
  projections.forEach((proj, idx) => {
    if (idx >= holdingPeriod) return;
    
    const depreciation = Math.round(annualDepreciation);
    cumulativeDepreciation += depreciation;
    
    const taxableIncome = proj.cashFlow - depreciation;
    const taxLiability = taxableIncome > 0 ? Math.round(taxableIncome * taxRate) : 0;
    const afterTaxCashFlow = proj.cashFlow - taxLiability;
    
    analysis.byYear.push({
      year: proj.year,
      preTaxCashFlow: proj.cashFlow,
      depreciation: depreciation,
      taxableIncome: Math.round(taxableIncome),
      taxLiability: taxLiability,
      afterTaxCashFlow: afterTaxCashFlow,
      cumulativeDepreciation: Math.round(cumulativeDepreciation)
    });
  });
  
  // Calculate after-tax returns
  const afterTaxCashFlows = [
    -(pricing_financing.equity_required || 0), // Initial equity
    ...analysis.byYear.map(y => y.afterTaxCashFlow)
  ];
  
  // Add after-tax reversion
  if (projections[holdingPeriod - 1]) {
    const salesPrice = projections[holdingPeriod - 1].grossSalesPrice;
    const loanBalance = projections[holdingPeriod - 1].loanBalance;
    const adjustedBasis = purchasePrice - cumulativeDepreciation;
    const capitalGain = salesPrice - adjustedBasis;
    const capitalGainsTax = Math.round(capitalGain * 0.20); // Long-term capital gains rate
    const depreciationRecapture = Math.round(cumulativeDepreciation * 0.25);
    const totalTaxOnSale = capitalGainsTax + depreciationRecapture;
    const afterTaxReversion = salesPrice - loanBalance - totalTaxOnSale;
    
    afterTaxCashFlows[holdingPeriod] = (afterTaxCashFlows[holdingPeriod] || 0) + afterTaxReversion;
    
    analysis.exitTaxes = {
      salesPrice: Math.round(salesPrice),
      adjustedBasis: Math.round(adjustedBasis),
      capitalGain: Math.round(capitalGain),
      capitalGainsTax: capitalGainsTax,
      depreciationRecapture: depreciationRecapture,
      totalTaxOnSale: totalTaxOnSale,
      afterTaxProceeds: Math.round(afterTaxReversion)
    };
  }
  
  analysis.afterTaxIRR = calculateIRR(afterTaxCashFlows);
  analysis.afterTaxEquityMultiple = afterTaxCashFlows[holdingPeriod] / Math.abs(afterTaxCashFlows[0]);
  
  return analysis;
}

/**
 * Generate month-by-month cash flow for Year 1
 * @param {Object} year1Data - Year 1 annual data
 * @param {Object} assumptions - Monthly assumptions
 * @returns {Array} Monthly cash flows
 */
export function calculateMonthlyYear1(year1Data, assumptions = {}) {
  const months = [];
  const {
    stabilizationMonth = 12, // Month when property stabilizes
    initialOccupancy = 0.85,
    targetOccupancy = 0.95
  } = assumptions;
  
  const monthlyIncome = year1Data.effectiveGrossIncome / 12;
  const monthlyExpenses = year1Data.operatingExpenses / 12;
  const monthlyDebtService = year1Data.debtService / 12;
  
  for (let month = 1; month <= 12; month++) {
    // Ramp up occupancy linearly
    const occupancyFactor = month <= stabilizationMonth
      ? initialOccupancy + ((targetOccupancy - initialOccupancy) * (month / stabilizationMonth))
      : targetOccupancy;
    
    const income = monthlyIncome * occupancyFactor;
    const expenses = monthlyExpenses; // Expenses stay constant
    const noi = income - expenses;
    const debtService = monthlyDebtService;
    const cashFlow = noi - debtService;
    
    months.push({
      month,
      income: Math.round(income),
      expenses: Math.round(expenses),
      noi: Math.round(noi),
      debtService: Math.round(debtService),
      cashFlow: Math.round(cashFlow),
      occupancy: Math.round(occupancyFactor * 100) / 100
    });
  }
  
  return months;
}

const calculationFunctions = {
  calculateFullAnalysis,
  calculateIRR,
  calculateNPV,
  calculateMortgagePayment,
  calculateLoanBalance,
  calculateWaterfall,
  calculateAmortizationSchedule,
  calculateSensitivity,
  analyzeRentRoll,
  calculateManagementFees,
  calculateMultiTierWaterfall,
  calculateTaxAnalysis,
  calculateMonthlyYear1
};

export default calculationFunctions;
