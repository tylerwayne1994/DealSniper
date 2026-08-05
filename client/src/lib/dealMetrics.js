// Shared Deal Room metrics helpers.
//
// This logic used to live only inside DealRoomPage.jsx. It's extracted here
// so the public investor pitch-deck view (InvestorPitchDeckView.jsx) can
// compute the exact same metrics/images/score from a deal object without
// duplicating ~150 lines of derivation logic. Both DealRoomPage.jsx and the
// public investor view import from this single source of truth.
import { calculateFullAnalysis } from '../utils/realEstateCalculations';

export const pickNum = (...vals) => {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
};

/**
 * Normalize a deal's image list (from deal.images + deal.parsedData.images)
 * into a consistent [{ id, url, storage_path, page_number }] shape.
 * De-duplicates by storage_path (falling back to url) — deal.images and
 * deal.parsedData.images have historically ended up containing overlapping
 * copies of the same photos (e.g. a deal re-parsed on top of an earlier
 * upload), which made the photo strip show 2-3x as many thumbnails as
 * there are actual distinct photos.
 */
export function normalizeDealImages(deal) {
  const fromDeal = Array.isArray(deal?.images) ? deal.images : [];
  const fromParsed = Array.isArray(deal?.parsedData?.images) ? deal.parsedData.images : [];
  const all = [...fromDeal, ...fromParsed];

  const seen = new Set();
  return all
    .map((img, idx) => {
      if (typeof img === 'string') {
        return { id: `img-${idx}`, url: img, storage_path: '', page_number: null };
      }
      if (img && typeof img === 'object') {
        const url = img.url || img.public_url || img.image_url || img.src || '';
        if (!url) return null;
        return {
          id: img.id || `img-${idx}`,
          url,
          storage_path: img.storage_path || '',
          page_number: img.page_number || null,
        };
      }
      return null;
    })
    .filter(Boolean)
    .filter((img) => {
      const key = img.storage_path || img.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Compute the full set of derived financial metrics for a deal (price, NOI,
 * cap rate, DSCR, cash-on-cash, IRR, projections, etc.) from its raw
 * scenarioData/parsedData, using calculateFullAnalysis() as the underlying
 * engine. Pure function of `deal` — safe to call from any page.
 */
export function computeDealMetrics(deal) {
  if (!deal) return {};
  const sc = deal.scenarioData || deal.parsedData || {};
  const calc = sc.calculations || {};
  const assumptions = sc.assumptions || {};
  const pd = deal.parsedData || {};
  const prop = pd.property || {};
  const pricing = pd.pricing_financing || {};
  const income = pd.income_expenses || pd.income || {};
  const expenses = pd.expenses || pd.income_expenses || {};

  let full = null;
  try {
    full = calculateFullAnalysis(sc);
  } catch (e) {
    full = null;
    console.warn('dealMetrics: calculateFullAnalysis failed, using fallback metrics', e);
  }

  const y1 = full?.year1 || {};
  const acq = full?.acquisition || {};
  const fin = full?.financing || {};
  const current = full?.current || {};
  const stabilized = full?.stabilized || {};
  const hasMultiLoanStack = Array.isArray(sc?.financing?.loans) && sc.financing.loans.length > 0;

  const price = pickNum(deal.purchasePrice, pricing.purchase_price, pricing.price, acq.purchasePrice, current.price, 0) || 0;
  const units = pickNum(deal.units, prop.total_units, prop.units, prop.unit_count, 1) || 1;

  // Rent & income
  let annualGrossRent = pickNum(y1.potentialGrossIncome, income.annual_gross_rent, income.gross_potential_rent, calc.grossAnnualRent, calc.gross_annual_rent, 0) || 0;
  let monthlyRent = pickNum(income.monthly_rent, calc.grossRent, calc.gross_monthly_rent, income.gross_rents, annualGrossRent > 0 ? annualGrossRent / 12 : 0) || 0;
  const otherIncomeAnnual = pickNum(y1.otherIncome, income.other_income, 0) || 0;
  const grossOperatingIncome = annualGrossRent + otherIncomeAnnual;

  // Normalize annual/monthly rent to prevent mixed-unit values from parsed sources.
  if (annualGrossRent > 0 && monthlyRent > annualGrossRent) {
    monthlyRent = annualGrossRent / 12;
  }
  if (annualGrossRent <= 0 && monthlyRent > 0) {
    annualGrossRent = monthlyRent * 12;
  }

  // Expenses
  const vacancyRateRaw = pickNum(assumptions.vacancyRate, sc.pnl?.vacancy_rate, 0.05);
  const vacancyRate = vacancyRateRaw > 1 ? vacancyRateRaw / 100 : vacancyRateRaw;
  const expenseRatioRaw = pickNum(assumptions.expenseRatio, sc.pnl?.expense_ratio_t12, sc.pnl?.expense_ratio, 0.45);
  const expenseRatio = expenseRatioRaw > 1 ? expenseRatioRaw / 100 : expenseRatioRaw;
  const annualVacancyLoss = pickNum(y1.vacancyLoss, annualGrossRent * vacancyRate) || 0;
  const effectiveGrossIncome = pickNum(y1.effectiveGrossIncome, grossOperatingIncome - annualVacancyLoss) || 0;
  const annualExpenses = pickNum(y1.totalOperatingExpenses, sc.pnl?.operating_expenses_t12, sc.pnl?.operating_expenses, effectiveGrossIncome * expenseRatio) || 0;
  const annualNOI = pickNum(y1.noi, current.noi, sc.pnl?.noi_t12, sc.pnl?.noi, calc.noi, effectiveGrossIncome - annualExpenses) || 0;

  // Financing
  const downPctRaw = pickNum(assumptions.downPaymentPercent, assumptions.downPayment, sc.financing?.down_payment_pct, 20);
  const downPct = downPctRaw > 1 ? downPctRaw / 100 : downPctRaw;
  const downPayment = hasMultiLoanStack
    ? (pickNum(sc.financing?.down_payment, fin.downPayment, price * downPct) || 0)
    : (pickNum(fin.downPayment, price * downPct) || 0);
  const loanAmount = hasMultiLoanStack
    ? (pickNum(sc.financing?.total_loan_amount, fin.loanAmount, sc.financing?.loan_amount, price - downPayment) || 0)
    : (pickNum(fin.loanAmount, sc.financing?.loan_amount, price - downPayment) || 0);
  const seniorLoan = hasMultiLoanStack ? (sc.financing?.loans || []).find(l => l.type === 'Senior Loan' && l.enabled !== false) : null;
  const interestRate = pickNum(seniorLoan?.rate, fin.interestRate, assumptions.interestRate, sc.financing?.interest_rate, 7.0);
  const iRate = interestRate > 1 ? interestRate / 100 : interestRate;
  const monthlyRate = iRate / 12;
  const termMonths = (pickNum(assumptions.loanTerm, sc.financing?.loan_term, 30) || 30) * 12;
  const monthlyPIComputed = loanAmount > 0 && monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : 0;
  const annualDebtService = hasMultiLoanStack
    ? (pickNum(calc.annualDebtService, calc.annual_debt_service, fin.annualDebtService, y1.debtService, monthlyPIComputed * 12) || 0)
    : (pickNum(y1.debtService, fin.annualDebtService, calc.annualDebtService, monthlyPIComputed * 12) || 0);
  const monthlyPI = hasMultiLoanStack
    ? (annualDebtService / 12)
    : (pickNum(calc.monthlyMortgagePayment, calc.monthly_mortgage_payment, fin.monthlyPayment, annualDebtService / 12, monthlyPIComputed) || 0);

  // Monthly operating assumptions used by the One Sheet breakdown.
  const annualTaxes = pickNum(
    expenses.property_taxes_annual,
    expenses.taxes_annual,
    expenses.property_taxes,
    expenses.taxes,
    sc.expenses?.taxes,
    sc.pnl?.property_taxes,
    price * 0.015
  ) || 0;
  const annualInsurance = pickNum(
    expenses.insurance_annual,
    expenses.insurance,
    sc.expenses?.insurance,
    sc.pnl?.insurance,
    price * 0.005
  ) || 0;
  const monthlyTaxes = pickNum(expenses.property_taxes_monthly, expenses.taxes_monthly, annualTaxes / 12) || 0;
  const monthlyInsurance = pickNum(expenses.insurance_monthly, annualInsurance / 12) || 0;

  const mgmtRateRaw = pickNum(assumptions.managementFeeRate, assumptions.managementFeePercent, sc.pnl?.management_fee_rate, 0.08);
  const maintenanceRateRaw = pickNum(assumptions.maintenanceRate, assumptions.maintenancePercent, sc.pnl?.maintenance_rate, 0.05);
  const vacancyReserveRateRaw = pickNum(assumptions.vacancyReserveRate, assumptions.vacancyReservePercent, vacancyRate, 0.05);
  const mgmtRate = mgmtRateRaw > 1 ? mgmtRateRaw / 100 : mgmtRateRaw;
  const maintenanceRate = maintenanceRateRaw > 1 ? maintenanceRateRaw / 100 : maintenanceRateRaw;
  const vacancyReserveRate = vacancyReserveRateRaw > 1 ? vacancyReserveRateRaw / 100 : vacancyReserveRateRaw;

  const monthlyMaintenance = monthlyRent * maintenanceRate;
  const monthlyMgmt = monthlyRent * mgmtRate;
  const monthlyVacancyReserve = monthlyRent * vacancyReserveRate;
  const monthlyCFBreakdown = monthlyRent - monthlyPI - monthlyTaxes - monthlyInsurance - monthlyMaintenance - monthlyMgmt - monthlyVacancyReserve;

  // Key ratios
  const capRate = pickNum(y1.capRate, calc.capRate, calc.cap_rate, current.capRate, price > 0 && annualNOI > 0 ? (annualNOI / price) * 100 : null);
  const dscr = pickNum(y1.dscr, calc.dscr, current.dscr, annualDebtService > 0 ? annualNOI / annualDebtService : null);
  const annualCFFallback = (annualNOI - annualDebtService);
  const monthlyCFCandidate = pickNum(deal.dayOneCashFlow, calc.monthlyCashFlow, calc.monthly_cash_flow, current.cashflow, y1.cashFlow, null);
  let monthlyCF = monthlyCFBreakdown;
  if (monthlyCFCandidate != null) {
    // If the candidate is annual-sized, normalize to monthly.
    const normalizedCandidate = Math.abs(monthlyCFCandidate) > Math.abs(annualCFFallback) * 0.6 ? (monthlyCFCandidate / 12) : monthlyCFCandidate;
    const deltaToBreakdown = Math.abs(normalizedCandidate - monthlyCFBreakdown);
    monthlyCF = deltaToBreakdown <= Math.max(5000, Math.abs(monthlyCFBreakdown) * 0.75)
      ? normalizedCandidate
      : monthlyCFBreakdown;
  } else if (Number.isFinite(annualCFFallback)) {
    monthlyCF = annualCFFallback / 12;
  }
  const closingCosts = pickNum(acq.closingCosts, price * 0.02, price * 0.03) || 0;
  const renovations = pickNum(assumptions.renovationCost, calc.renovationCost, calc.upfrontCapEx, sc.capex?.upfront, 0) || 0;
  const totalInvestment = hasMultiLoanStack
    ? (pickNum(fin.totalEquityRequired, downPayment + closingCosts + renovations) || 0)
    : (pickNum(fin.totalEquityRequired, calc.totalInvestment, downPayment + closingCosts + renovations) || 0);
  const roi = totalInvestment > 0 ? ((monthlyCF * 12) / totalInvestment) * 100 : null;
  const cashOnCash = hasMultiLoanStack
    ? (totalInvestment > 0 ? ((annualNOI - annualDebtService) / totalInvestment) * 100 : 0)
    : pickNum(y1.cashOnCash, calc.cashOnCash, calc.cash_on_cash, roi);
  const ltv = hasMultiLoanStack
    ? (price > 0 ? (loanAmount / price) * 100 : 0)
    : pickNum(fin.ltv, calc.ltv, price > 0 ? (loanAmount / price) * 100 : null);

  const irr = pickNum(full?.returns?.leveredIRR, calc.irr, sc?.returns?.irr, 0) || 0;
  const equityMultiple = pickNum(full?.returns?.leveredEquityMultiple, calc.equityMultiple, sc?.returns?.equity_multiple, 0) || 0;
  const grm = annualGrossRent > 0 ? (price / annualGrossRent) : 0;
  const nim = annualExpenses > 0 ? (annualNOI / annualExpenses) : 0;
  const expenseRatioPct = pickNum(y1.expenseRatio, grossOperatingIncome > 0 ? (annualExpenses / grossOperatingIncome) * 100 : 0, 0) || 0;

  const baseCapRate = capRate > 0 ? capRate : 5.0;
  const baseIdx = 3;
  const capRates = Array.from({ length: 7 }, (_, i) => Number((baseCapRate + (i - baseIdx) * 0.25).toFixed(2)));
  const optimizedNOI = pickNum(stabilized.noi, annualNOI * 1.15) || 0;
  const valuationStarting = capRates.map(cr => (cr > 0 ? annualNOI / (cr / 100) : 0));
  const valuationOptimized = capRates.map(cr => (cr > 0 ? optimizedNOI / (cr / 100) : 0));

  return {
    price, units, monthlyRent, annualGrossRent, annualNOI,
    monthlyPI, annualDebtService, capRate, dscr, monthlyCF,
    cashOnCash, roi, ltv, downPayment, closingCosts, renovations,
    totalInvestment, loanAmount, annualVacancyLoss, annualExpenses,
    grossOperatingIncome, effectiveGrossIncome, otherIncomeAnnual,
    irr, equityMultiple, grm, nim, expenseRatioPct,
    capRates, valuationStarting, valuationOptimized,
    pricePerUnit: pickNum(acq.pricePerUnit, units ? price / units : 0) || 0,
    interestRate, downPct: downPct * 100,
    monthlyTaxes, monthlyInsurance, monthlyMaintenance, monthlyMgmt, monthlyVacancyReserve,
    // Property details
    beds: prop.bedrooms || prop.beds || sc.property?.beds || '',
    baths: prop.bathrooms || prop.baths || sc.property?.baths || '',
    sqft: prop.square_feet || prop.sqft || sc.property?.net_rentable_sf || '',
    yearBuilt: prop.year_built || prop.built || sc.property?.year_built || '',
    lotSize: prop.lot_size || '',
    stabilizedValue: pickNum(stabilized.value, calc.refiValue, calc.refi_value, deal.refiValue, 0) || 0,
    // Full calculateFullAnalysis() output — used by the Deal Room tab for
    // projections/exit/returns without re-computing it a second time.
    _full: full,
  };
}

/**
 * Score a single metric onto a 0-10 scale using a realistic floor/ceiling
 * band instead of a bucket that most decent deals blow straight through.
 * Below `lo` = 0, at/above `hi` = 10, linear in between.
 */
export function bandScore(value, lo, hi) {
  if (value == null || Number.isNaN(value)) return null;
  const pct = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(10, pct * 10));
}

/** Simple 0-10 financial score derived from the metrics above. Uses wider,
 * more realistic bands so scores actually differentiate between deals
 * instead of every solid deal pinning every metric at 10.0. */
export function computeDealScore(metrics) {
  const { capRate, dscr, cashOnCash, monthlyCF, units } = metrics;
  let score = 0;
  let count = 0;

  // Cap rate: 3% (weak, expensive market) -> 0, 10%+ (strong) -> 10.
  const capScore = bandScore(capRate, 3, 10);
  if (capScore != null) { score += capScore; count++; }

  // DSCR: 1.0x (breakeven, risky) -> 0, 2.0x (very safe) -> 10.
  const dscrScore = bandScore(dscr, 1.0, 2.0);
  if (dscrScore != null) { score += dscrScore; count++; }


  // Cash-on-cash: 0% -> 0, 20%+ -> 10 (was capping at 12%, too easy to max).
  const cocScore = bandScore(cashOnCash, 0, 20);
  if (cocScore != null) { score += cocScore; count++; }

  if (monthlyCF != null && units) {
    const cfPerUnit = monthlyCF / units;
    score += cfPerUnit >= 300 ? 10 : cfPerUnit >= 150 ? 7 : cfPerUnit >= 0 ? 4 : 1;
    count++;
  }

  const raw = count > 0 ? score / count : 5;
  const clamped = Math.max(0, Math.min(10, raw));
  const grade =
    clamped >= 9 ? 'A+' : clamped >= 8.5 ? 'A' : clamped >= 7.5 ? 'B+' :
    clamped >= 7 ? 'B' : clamped >= 6.5 ? 'C+' : clamped >= 5.5 ? 'C' :
    clamped >= 4 ? 'D' : 'F';
  const color =
    clamped >= 7.5 ? '#00c875' : clamped >= 6 ? '#fdab3d' : '#e2445c';

  return { score: clamped.toFixed(1), grade, color };
}
