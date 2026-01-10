// Financial calculation utilities for UnderwritingTablePage

// Shared debt field definitions so UI and calculations stay in sync
export const DEBT_FIELDS_MENU = {
  traditional: [
    'Down payment (%)',
    'Loan amount',
    'Interest rate',
    'Term (years)',
    'Amortization (years)',
    'Monthly payment',
  ],
  'seller-finance': [
    'Down payment (%)',
    'Seller loan amount',
    'Interest rate',
    'Term (years)',
    'Amortization (years)',
    'Second loan amount',
    'Second loan interest rate',
    'Second loan term (years)',
    'Second loan amortization (years)',
    'Total balloon amount ($)',
    'Balloon term (years)',
  ],
  hybrid: [
    'Down payment (%)',
    'Current loan amount',
    'Interest rate',
    'Monthly payment amount',
    'Years remaining',
    'Second loan amount',
    'Second loan interest rate',
    'Second loan term (years)',
    'Second loan amortization (years)',
  ],
  'subject-to': [
    'SubTo Loan Balance',
    'Interest rate',
    'Period in years remaining',
    'Monthly pymt (PI)',
    'Total debt service monthly',
    'Total debt service annual',
  ],
  'seller-carry': [
    'Seller loan amount',
    'Interest rate',
    'Term (years)',
    'Amortization (years)',
    'Second loan amount',
    'Second loan down payment (%)',
    'Second loan interest rate',
    'Second loan term (years)',
    'Second loan amortization (years)',
  ],
  'equity-partner': [
    'Loan amount',
    'Interest rate',
    'Amortization term (years)',
    'Downpayment (partner portion) in $',
    'Preferred return (%)',
    'Buyout period (years)',
  ],
};

const toNumber = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : defaultValue;
};

const getCellNumber = (cellValues, rowId, key, defaultValue = 0) => {
  const raw = cellValues[`${rowId}-${key}`];
  return toNumber(raw, defaultValue);
};

const getPercentFromMap = (map, rowId) => {
  if (!map) return 0;
  const raw = map[rowId];
  const n = toNumber(raw, 0);
  return n / 100;
};

const calcLoanPayment = ({
  amount = 0,
  annualRatePct = 0,
  termYears = 0,
  amortYears = 0,
  interestOnly = false,
  overrideMonthlyPayment = 0,
}) => {
  const principal = toNumber(amount, 0);
  if (principal <= 0) {
    return { monthlyPayment: 0, annualPayment: 0 };
  }

  const knownPayment = toNumber(overrideMonthlyPayment, 0);
  if (knownPayment > 0) {
    return { monthlyPayment: knownPayment, annualPayment: knownPayment * 12 };
  }

  const rateMonthly = toNumber(annualRatePct, 0) / 100 / 12;
  const nMonths = (amortYears || termYears) * 12;

  if (interestOnly && rateMonthly > 0) {
    const monthlyPayment = principal * rateMonthly;
    return { monthlyPayment, annualPayment: monthlyPayment * 12 };
  }

  if (rateMonthly <= 0 || nMonths <= 0) {
    // Simple straight-line paydown if no interest or term specified
    const monthlyPayment = nMonths > 0 ? principal / nMonths : 0;
    return { monthlyPayment, annualPayment: monthlyPayment * 12 };
  }

  const r = rateMonthly;
  const factor = Math.pow(1 + r, nMonths);
  const monthlyPayment = principal * ((r * factor) / (factor - 1));
  return { monthlyPayment, annualPayment: monthlyPayment * 12 };
};

const buildLoansFromCells = ({ debtType, cellValues, interestOnlyFlags }) => {
  const fields = DEBT_FIELDS_MENU[debtType] || [];

  const getByLabel = (label, key = 'm') => {
    const index = fields.indexOf(label);
    if (index === -1) return 0;
    const rowId = index + 2; // matches UnderwritingTablePage's mapping
    return getCellNumber(cellValues, rowId, key, 0);
  };

  const isInterestOnly = (label) => {
    const index = fields.indexOf(label);
    if (index === -1) return false;
    const flagKey = `${debtType}-${index}`;
    return !!interestOnlyFlags?.[flagKey];
  };

  const loans = [];

  if (debtType === 'traditional') {
    const amount = getByLabel('Loan amount');
    const rate = getByLabel('Interest rate');
    const term = getByLabel('Term (years)');
    const amort = getByLabel('Amortization (years)');
    const io = isInterestOnly('Interest rate');
    if (amount > 0) {
      loans.push({ amount, annualRatePct: rate, termYears: term, amortYears: amort, interestOnly: io });
    }
  } else if (debtType === 'seller-finance') {
    const sellerAmount = getByLabel('Seller loan amount');
    const sellerRate = getByLabel('Interest rate');
    const sellerTerm = getByLabel('Term (years)');
    const sellerAmort = getByLabel('Amortization (years)');
    const sellerIo = isInterestOnly('Interest rate');
    if (sellerAmount > 0) {
      loans.push({
        amount: sellerAmount,
        annualRatePct: sellerRate,
        termYears: sellerTerm,
        amortYears: sellerAmort,
        interestOnly: sellerIo,
      });
    }

    const secondAmount = getByLabel('Second loan amount');
    const secondRate = getByLabel('Second loan interest rate');
    const secondTerm = getByLabel('Second loan term (years)');
    const secondAmort = getByLabel('Second loan amortization (years)');
    const secondIo = isInterestOnly('Second loan interest rate');
    if (secondAmount > 0) {
      loans.push({
        amount: secondAmount,
        annualRatePct: secondRate,
        termYears: secondTerm,
        amortYears: secondAmort,
        interestOnly: secondIo,
      });
    }
  } else if (debtType === 'hybrid') {
    const currentAmount = getByLabel('Current loan amount');
    const currentRate = getByLabel('Interest rate');
    const yearsRemaining = getByLabel('Years remaining');
    const amortYears = yearsRemaining; // assume same unless specified elsewhere
    const io = isInterestOnly('Interest rate');
    const overridePayment = getByLabel('Monthly payment amount');
    if (currentAmount > 0) {
      loans.push({
        amount: currentAmount,
        annualRatePct: currentRate,
        termYears: yearsRemaining,
        amortYears,
        interestOnly: io,
        overrideMonthlyPayment: overridePayment,
      });
    }

    const secondAmount = getByLabel('Second loan amount');
    const secondRate = getByLabel('Second loan interest rate');
    const secondTerm = getByLabel('Second loan term (years)');
    const secondAmort = getByLabel('Second loan amortization (years)');
    const secondIo = isInterestOnly('Second loan interest rate');
    if (secondAmount > 0) {
      loans.push({
        amount: secondAmount,
        annualRatePct: secondRate,
        termYears: secondTerm,
        amortYears: secondAmort,
        interestOnly: secondIo,
      });
    }
  } else if (debtType === 'subject-to') {
    const balance = getByLabel('SubTo Loan Balance');
    const rate = getByLabel('Interest rate');
    const yearsRemaining = getByLabel('Period in years remaining');
    const overridePayment = getByLabel('Monthly pymt (PI)');
    const io = isInterestOnly('Interest rate');
    if (balance > 0) {
      loans.push({
        amount: balance,
        annualRatePct: rate,
        termYears: yearsRemaining,
        amortYears: yearsRemaining,
        interestOnly: io,
        overrideMonthlyPayment: overridePayment,
      });
    }
  } else if (debtType === 'seller-carry') {
    const amount = getByLabel('Seller loan amount');
    const rate = getByLabel('Interest rate');
    const term = getByLabel('Term (years)');
    const amort = getByLabel('Amortization (years)');
    const io = isInterestOnly('Interest rate');
    if (amount > 0) {
      loans.push({ amount, annualRatePct: rate, termYears: term, amortYears: amort, interestOnly: io });
    }

    const secondAmount = getByLabel('Second loan amount');
    const secondRate = getByLabel('Second loan interest rate');
    const secondTerm = getByLabel('Second loan term (years)');
    const secondAmort = getByLabel('Second loan amortization (years)');
    const secondIo = isInterestOnly('Second loan interest rate');
    if (secondAmount > 0) {
      loans.push({
        amount: secondAmount,
        annualRatePct: secondRate,
        termYears: secondTerm,
        amortYears: secondAmort,
        interestOnly: secondIo,
      });
    }
  } else if (debtType === 'equity-partner') {
    const amount = getByLabel('Loan amount');
    const rate = getByLabel('Interest rate');
    const amort = getByLabel('Amortization term (years)');
    const io = isInterestOnly('Interest rate');
    if (amount > 0) {
      loans.push({ amount, annualRatePct: rate, termYears: amort, amortYears: amort, interestOnly: io });
    }
  }

  return loans;
};

const buildAcquisitionFromCells = ({ cellValues, percentSelections }) => {
  const purchasePrice = getCellNumber(cellValues, 4, 'm', 0);
  const downPayment = getCellNumber(cellValues, 5, 'm', 0);

  const commissionPct = getPercentFromMap(percentSelections, 6);
  const closingPct = getPercentFromMap(percentSelections, 7);
  const assignmentPct = getPercentFromMap(percentSelections, 8);

  const commissions = purchasePrice * commissionPct;
  const closingFees = purchasePrice * closingPct;
  const assignmentFee = purchasePrice * assignmentPct;

  const improvements = getCellNumber(cellValues, 9, 'm', 0);

  const cashToSeller = purchasePrice - downPayment;
  const totalAcquisition =
    downPayment + commissions + closingFees + assignmentFee + improvements;

  return {
    purchasePrice,
    downPayment,
    commissions,
    closingFees,
    assignmentFee,
    improvements,
    cashToSeller,
    totalAcquisition,
  };
};

export const computeUnderwritingFromCells = ({
  cellValues,
  percentSelections,
  proformaPercentSelections,
  debtType,
  interestOnlyFlags,
}) => {
  const result = {};

  const setRow = (rowId, currentValue, proformaValue) => {
    result[`${rowId}-current`] = Number.isFinite(currentValue) ? currentValue : 0;
    result[`${rowId}-proforma`] = Number.isFinite(proformaValue) ? proformaValue : 0;
  };

  // Income (monthly / annual)
  const grossRentMonthly = getCellNumber(cellValues, 24, 'm');
  const otherIncomeMonthly = getCellNumber(cellValues, 25, 'm');
  let totalIncomeMonthly = getCellNumber(cellValues, 26, 'm');
  if (!totalIncomeMonthly) {
    totalIncomeMonthly = grossRentMonthly + otherIncomeMonthly;
  }
  let totalIncomeAnnual = getCellNumber(cellValues, 27, 'm');
  if (!totalIncomeAnnual) {
    totalIncomeAnnual = totalIncomeMonthly * 12;
  }

  const incomeMonthlyCurrent = totalIncomeMonthly;
  const incomeAnnualCurrent = totalIncomeAnnual;
  const incomeMonthlyProforma = totalIncomeMonthly; // placeholder until separate proforma income is added
  const incomeAnnualProforma = incomeMonthlyProforma * 12;

  // Operating expenses (rows 13-20 are direct monthly amounts, 21-23 are % of income)
  const fixedExpenseRows = [13, 14, 15, 16, 17, 18, 19, 20];
  const fixedExpensesMonthlyCurrent = fixedExpenseRows.reduce(
    (sum, rowId) => sum + getCellNumber(cellValues, rowId, 'm-current', 0),
    0
  );
  const fixedExpensesMonthlyProforma = fixedExpenseRows.reduce(
    (sum, rowId) => sum + getCellNumber(cellValues, rowId, 'm-proforma', 0),
    0
  );

  const capexPctCurrent = getPercentFromMap(percentSelections, 21);
  const mgmtPctCurrent = getPercentFromMap(percentSelections, 22);
  const vacancyPctCurrent = getPercentFromMap(percentSelections, 23);
  const capexPctProforma = getPercentFromMap(proformaPercentSelections, 21);
  const mgmtPctProforma = getPercentFromMap(proformaPercentSelections, 22);
  const vacancyPctProforma = getPercentFromMap(proformaPercentSelections, 23);

  const pctBaseCurrent = incomeMonthlyCurrent;
  const pctBaseProforma = incomeMonthlyProforma;

  const percentExpensesMonthlyCurrent =
    pctBaseCurrent * (capexPctCurrent + mgmtPctCurrent + vacancyPctCurrent);
  const percentExpensesMonthlyProforma =
    pctBaseProforma * (capexPctProforma + mgmtPctProforma + vacancyPctProforma);

  const totalExpensesMonthlyCurrent =
    fixedExpensesMonthlyCurrent + percentExpensesMonthlyCurrent;
  const totalExpensesMonthlyProforma =
    fixedExpensesMonthlyProforma + percentExpensesMonthlyProforma;

  const totalExpensesAnnualCurrent = totalExpensesMonthlyCurrent * 12;
  const totalExpensesAnnualProforma = totalExpensesMonthlyProforma * 12;

  // NOI
  const noiMonthlyCurrent = incomeMonthlyCurrent - totalExpensesMonthlyCurrent;
  const noiAnnualCurrent = incomeAnnualCurrent - totalExpensesAnnualCurrent;
  const noiMonthlyProforma = incomeMonthlyProforma - totalExpensesMonthlyProforma;
  const noiAnnualProforma = incomeAnnualProforma - totalExpensesAnnualProforma;

  // Debt service
  const loans = buildLoansFromCells({ debtType, cellValues, interestOnlyFlags });
  let totalDebtMonthly = 0;
  loans.forEach((loan) => {
    const { monthlyPayment } = calcLoanPayment(loan);
    totalDebtMonthly += monthlyPayment;
  });
  const totalDebtAnnual = totalDebtMonthly * 12;

  const debtMonthlyCurrent = totalDebtMonthly;
  const debtAnnualCurrent = totalDebtAnnual;
  const debtMonthlyProforma = totalDebtMonthly; // placeholder
  const debtAnnualProforma = totalDebtAnnual;

  const netIncomeAnnualCurrent = noiAnnualCurrent - debtAnnualCurrent;
  const netIncomeAnnualProforma = noiAnnualProforma - debtAnnualProforma;

  // Purchase & value assumptions
  const acquisition = buildAcquisitionFromCells({ cellValues, percentSelections });
  const purchasePrice = acquisition.purchasePrice;

  // Value-add inputs (VALUE ADD ANALYSIS)
  const raisedRentPerUnit = getCellNumber(cellValues, 47, 'm');
  const valueAddCapRatePct = getCellNumber(cellValues, 48, 'm');
  const valueAddCapRate = valueAddCapRatePct / 100;
  const valueAddUnitCount = getCellNumber(cellValues, 49, 'm');
  const rehabPerUnit = getCellNumber(cellValues, 50, 'm');

  const addNoiPerUnitAnnual = raisedRentPerUnit * 12;
  const addNoiTotalAnnual = addNoiPerUnitAnnual * valueAddUnitCount;
  const valueAddPerUnit = valueAddCapRate ? addNoiPerUnitAnnual / valueAddCapRate : 0;
  const totalValueAdd = valueAddPerUnit * valueAddUnitCount;
  const totalRehab = rehabPerUnit * valueAddUnitCount;
  const equityCreated = totalValueAdd - totalRehab;
  const roiRehab = totalRehab ? equityCreated / totalRehab : 0;
  const dollarsPerDollar = roiRehab;
  const newPricePerUnit = valueAddUnitCount
    ? (purchasePrice + totalValueAdd) / valueAddUnitCount
    : 0;

  // Market cap rate assumption from VALUE ADD cap rate for now
  const marketCapRate = valueAddCapRate;

  const purchaseCapRateCurrent = purchasePrice
    ? noiAnnualCurrent / purchasePrice
    : 0;
  const purchaseCapRateProforma = purchasePrice
    ? noiAnnualProforma / purchasePrice
    : 0;
  const marketCapRateCurrent = marketCapRate;
  const marketCapRateProforma = marketCapRate;

  const asIsValueCurrent = marketCapRate ? noiAnnualCurrent / marketCapRate : 0;
  const asIsValueProforma = marketCapRate ? noiAnnualCurrent / marketCapRate : 0;
  const arvValueCurrent = marketCapRate ? noiAnnualProforma / marketCapRate : 0;
  const arvValueProforma = arvValueCurrent;

  // Cash invested and CoC ROI
  const downPayment = acquisition.downPayment;
  const commissions = acquisition.commissions;
  const closingFees = acquisition.closingFees;
  const assignmentFee = acquisition.assignmentFee;
  const improvements = acquisition.improvements;

  const cashInvested = acquisition.totalAcquisition;

  const cocCurrent = cashInvested ? netIncomeAnnualCurrent / cashInvested : 0;
  const cocProforma = cashInvested ? netIncomeAnnualProforma / cashInvested : 0;

  // Map to VALUE ANALYSIS / CASHFLOW / INVESTMENT rows
  setRow(32, purchaseCapRateCurrent, purchaseCapRateProforma);
  setRow(33, marketCapRateCurrent, marketCapRateProforma);
  setRow(34, asIsValueCurrent, asIsValueProforma);
  setRow(35, arvValueCurrent, arvValueProforma);
  setRow(37, noiMonthlyCurrent, noiMonthlyProforma);
  setRow(38, noiAnnualCurrent, noiAnnualProforma);
  setRow(39, debtMonthlyCurrent, debtMonthlyProforma);
  setRow(40, debtAnnualCurrent, debtAnnualProforma);
  setRow(41, netIncomeAnnualCurrent, netIncomeAnnualProforma);
  setRow(43, cocCurrent, cocProforma);

  // VALUE ADD ANALYSIS rows (47-57)
  // Inputs: 47-50 are direct entry fields (raised rent, cap rate, unit count, rehab per unit)
  // Outputs below are mirrored into both current and proforma for now
  setRow(51, valueAddPerUnit, valueAddPerUnit);
  setRow(52, totalValueAdd, totalValueAdd);
  setRow(53, totalRehab, totalRehab);
  setRow(54, equityCreated, equityCreated);
  setRow(55, roiRehab, roiRehab);
  setRow(56, dollarsPerDollar, dollarsPerDollar);
  setRow(57, newPricePerUnit, newPricePerUnit);

  return result;
};
