import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calculator,
  DollarSign,
  Plus,
  TrendingUp,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

const BORDER = '#dbe2ea';
const TEXT = '#0f172a';
const MUTED = '#64748b';
const PRIMARY = '#2563eb';
const PRIMARY_SOFT = '#eff6ff';
const SURFACE = '#ffffff';
const PAGE = '#f8fafc';
const POSITIVE = '#059669';
const NEGATIVE = '#dc2626';
const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  fontSize: 13,
  background: '#fff',
  color: TEXT,
  boxSizing: 'border-box',
};

const CARD_STYLE = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
};

const LOAN_LIBRARY = [
  { type: 'Senior Loan', defaults: { loanAmtMode: 'ltv', ltv: 75, loanDollar: 0, rate: 6, amort: 30, term: 10, io: 0, fees: 1.5 } },
  { type: 'Second Debt', defaults: { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 8.5, amort: 25, term: 10, io: 0, fees: 0 } },
  { type: 'Mezzanine Loan', defaults: { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 10, amort: 25, term: 5, io: 1, fees: 1.5 } },
  { type: 'Seller Financing', defaults: { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 7.5, amort: 20, term: 10, io: 0, fees: 0 } },
  { type: 'Equity Partner', defaults: { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 8, amort: 0, term: 5, io: 0, fees: 0, doubleInvestment: false } },
];

const currency = (value) => {
  if (value == null || Number.isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const percent = (value, digits = 2) => {
  if (value == null || Number.isNaN(value)) return '0%';
  return `${Number(value).toFixed(digits)}%`;
};

const calcMonthlyPayment = (principal, annualRatePct, amortMonths) => {
  if (principal <= 0 || amortMonths <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / amortMonths;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1);
};

const buildDefaultSeniorLoan = (financing) => ({
  id: 'senior',
  type: 'Senior Loan',
  enabled: true,
  loanAmtMode: 'ltv',
  ltv: Number(financing?.ltv) || 75,
  loanDollar: 0,
  rate: Number(financing?.interest_rate) || 6,
  amort: Number(financing?.amortization_years) || 30,
  term: Number(financing?.loan_term_years) || 10,
  io: Number(financing?.io_years) || 0,
  fees: Number(financing?.loan_fees_percent) || 1.5,
});

const cloneLoans = (loans) => (loans || []).map((loan) => ({ ...loan }));

const getLoanAmount = (loan, purchasePrice) => {
  if (loan.type === 'Equity Partner') return Number(loan.loanDollar) || 0;
  if (loan.loanAmtMode === 'ltv' || loan.loanAmtMode === 'ltc') {
    return purchasePrice * (Number(loan.ltv) || 0) / 100;
  }
  return Number(loan.loanDollar) || 0;
};

const getLoanMetrics = (loan, purchasePrice) => {
  const amount = getLoanAmount(loan, purchasePrice);

  if (loan.type === 'Equity Partner') {
    const annualPref = amount * (Number(loan.rate) || 0) / 100;
    const monthlyPref = annualPref / 12;
    return {
      amount,
      monthlyPayment: monthlyPref,
      annualPayment: annualPref,
      fees: 0,
      ioYears: 0,
      isFullTermIO: false,
    };
  }

  const rate = Number(loan.rate) || 0;
  const termYears = Number(loan.term) || 0;
  const amortMonths = (Number(loan.amort) || 0) * 12;
  const ioYears = Math.max(0, Number(loan.io) || 0);
  const isFullTermIO = termYears > 0 && ioYears >= termYears;
  let monthlyPayment = 0;

  if (amount > 0) {
    if (ioYears > 0) {
      monthlyPayment = amount * rate / 100 / 12;
    } else if (amortMonths > 0) {
      monthlyPayment = calcMonthlyPayment(amount, rate, amortMonths);
    }
  }

  return {
    amount,
    monthlyPayment,
    annualPayment: monthlyPayment * 12,
    fees: amount * (Number(loan.fees) || 0) / 100,
    ioYears,
    isFullTermIO,
  };
};

const buildStructureFromLoans = (loans, purchasePrice, noi) => {
  if (!loans?.length || purchasePrice <= 0) return null;

  const enabledLoans = loans.filter((loan) => loan.enabled !== false);
  const debtLoans = enabledLoans.filter((loan) => loan.type !== 'Equity Partner');
  const equityLoans = enabledLoans.filter((loan) => loan.type === 'Equity Partner');

  const loanDetails = debtLoans.map((loan) => {
    const metrics = getLoanMetrics(loan, purchasePrice);
    return {
      ...loan,
      loanAmt: metrics.amount,
      monthlyPmt: metrics.monthlyPayment,
      annualDS: metrics.annualPayment,
      fees: metrics.fees,
      ioYears: metrics.ioYears,
      isFullTermIO: metrics.isFullTermIO,
    };
  });

  const equityDetails = equityLoans.map((loan) => {
    const metrics = getLoanMetrics(loan, purchasePrice);
    return {
      ...loan,
      partnerEquity: metrics.amount,
      monthlyPref: metrics.monthlyPayment,
      annualPref: metrics.annualPayment,
    };
  });

  const totalLoanAmt = loanDetails.reduce((sum, loan) => sum + loan.loanAmt, 0);
  const totalMonthlyDebt = loanDetails.reduce((sum, loan) => sum + loan.monthlyPmt, 0);
  const totalFees = loanDetails.reduce((sum, loan) => sum + loan.fees, 0);
  const totalEquity = equityDetails.reduce((sum, loan) => sum + loan.partnerEquity, 0);
  const totalAnnualPref = equityDetails.reduce((sum, loan) => sum + loan.annualPref, 0);
  const annualDebtService = totalMonthlyDebt * 12;
  const totalMonthlyPmt = totalMonthlyDebt + (totalAnnualPref / 12);
  const totalAnnualPmt = totalMonthlyPmt * 12;
  const downPayment = Math.max(0, purchasePrice - totalLoanAmt - totalEquity);
  const cashOutOfPocket = downPayment + totalFees;
  const cashflow = (noi || 0) - totalAnnualPmt;
  const dscr = annualDebtService > 0 ? (noi || 0) / annualDebtService : 0;
  const cashOnCash = cashOutOfPocket > 0 ? (cashflow / cashOutOfPocket) * 100 : 0;
  const ltv = purchasePrice > 0 ? (totalLoanAmt / purchasePrice) * 100 : 0;
  const acquisitionCost = purchasePrice + totalFees;
  const ltc = acquisitionCost > 0 ? (totalLoanAmt / acquisitionCost) * 100 : 0;
  const blendedRate = totalLoanAmt > 0
    ? loanDetails.reduce((sum, loan) => sum + ((loan.loanAmt / totalLoanAmt) * (Number(loan.rate) || 0)), 0)
    : 0;

  return {
    loanDetails,
    equityDetails,
    totalLoanAmt,
    totalMonthlyDebt,
    totalFees,
    totalEquity,
    totalAnnualPref,
    annualDebtService,
    totalMonthlyPmt,
    totalAnnualPmt,
    downPayment,
    cashOutOfPocket,
    cashflow,
    dscr,
    cashOnCash,
    ltv,
    ltc,
    blendedRate,
    totalAcquisitionCost: acquisitionCost,
  };
};

const Field = ({ label, value, onChange, suffix, prefix, step = 'any', min = 0 }) => (
  <div>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {prefix && <span style={{ position: 'absolute', left: 12, top: 11, color: MUTED, fontSize: 13 }}>{prefix}</span>}
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          ...INPUT_STYLE,
          paddingLeft: prefix ? 24 : 12,
          paddingRight: suffix ? 28 : 12,
        }}
      />
      {suffix && <span style={{ position: 'absolute', right: 12, top: 11, color: MUTED, fontSize: 13 }}>{suffix}</span>}
    </div>
  </div>
);

const SummaryMetric = ({ label, value, subvalue, valueColor = TEXT }) => (
  <div style={{ ...CARD_STYLE, padding: 18, boxShadow: 'none' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: valueColor, lineHeight: 1 }}>{value}</div>
    {subvalue ? <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{subvalue}</div> : null}
  </div>
);

const LoanRow = ({ loan, purchasePrice }) => {
  const metrics = getLoanMetrics(loan, purchasePrice);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.8fr 0.8fr 1fr 1fr', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{loan.type}</div>
        <div style={{ fontSize: 11, color: MUTED }}>
          {loan.type === 'Equity Partner' ? 'Equity position' : metrics.ioYears > 0 ? (metrics.isFullTermIO ? 'Full-term IO' : `IO ${metrics.ioYears} yrs`) : 'Amortizing'}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, textAlign: 'right' }}>{currency(metrics.amount)}</div>
      <div style={{ fontSize: 13, color: MUTED, textAlign: 'right' }}>{percent(loan.rate || 0)}</div>
      <div style={{ fontSize: 13, color: MUTED, textAlign: 'right' }}>{loan.term || 0} yr</div>
      <div style={{ fontSize: 13, color: MUTED, textAlign: 'right' }}>{currency(metrics.monthlyPayment)}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, textAlign: 'right' }}>{currency(metrics.annualPayment)}</div>
    </div>
  );
};

export default function DealStructureTab({ scenarioData, fullCalcs, onFieldChange, onSelectedStructureMetricsChange }) {
  const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
  const noi = fullCalcs?.year1?.noi || scenarioData?.pnl?.noi_t12 || scenarioData?.pnl?.noi || 0;
  const financing = useMemo(() => scenarioData?.financing || {}, [scenarioData?.financing]);

  const currentLoans = useMemo(() => {
    if (Array.isArray(financing.loans) && financing.loans.length > 0) {
      return cloneLoans(financing.loans);
    }
    return [buildDefaultSeniorLoan(financing)];
  }, [financing]);

  const [builderLoans, setBuilderLoans] = useState(() => cloneLoans(currentLoans));
  const [dirty, setDirty] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [treasuryRates, setTreasuryRates] = useState([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryAsOf, setTreasuryAsOf] = useState(null);
  const [treasuryError, setTreasuryError] = useState('');
  const [spread, setSpread] = useState(Number(financing?.spread) || 1.5);
  const [calculatorState, setCalculatorState] = useState({
    open: false,
    loanId: null,
    amount: 0,
    rate: 0,
    amort: 30,
    term: 10,
    io: 0,
    fees: 0,
  });

  useEffect(() => {
    if (!dirty) {
      setBuilderLoans(cloneLoans(currentLoans));
    }
  }, [currentLoans, dirty]);

  useEffect(() => {
    if (!dirty) {
      setSpread(Number(financing?.spread) || 1.5);
    }
  }, [dirty, financing?.spread]);

  useEffect(() => {
    let cancelled = false;

    const loadTreasuryRates = async () => {
      setTreasuryLoading(true);
      setTreasuryError('');

      try {
        const response = await fetch(`${API_BASE}/api/treasury-rates`);
        if (!response.ok) {
          throw new Error(`Treasury rates request failed: ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setTreasuryRates(Array.isArray(data?.rates) ? data.rates : []);
          setTreasuryAsOf(data?.as_of || null);
        }
      } catch (error) {
        if (!cancelled) {
          setTreasuryError('Treasury rates unavailable right now.');
          setTreasuryRates([]);
        }
      } finally {
        if (!cancelled) {
          setTreasuryLoading(false);
        }
      }
    };

    loadTreasuryRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentStructure = useMemo(() => buildStructureFromLoans(currentLoans, purchasePrice, noi), [currentLoans, purchasePrice, noi]);
  const builderStructure = useMemo(() => buildStructureFromLoans(builderLoans, purchasePrice, noi), [builderLoans, purchasePrice, noi]);

  useEffect(() => {
    if (!builderStructure || !onSelectedStructureMetricsChange) return;
    onSelectedStructureMetricsChange({
      name: 'Scenario Builder',
      key: 'deal-structure-builder',
      annualCashFlow: builderStructure.cashflow,
      cashOnCash: builderStructure.cashOnCash,
      dscr: builderStructure.dscr,
      capRate: purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 0,
    });
  }, [builderStructure, onSelectedStructureMetricsChange, purchasePrice, noi]);

  const persistLoans = useCallback((loansToSave) => {
    if (!onFieldChange) return;

    const structure = buildStructureFromLoans(loansToSave, purchasePrice, noi);
    onFieldChange('financing.loans', loansToSave);
    onFieldChange('financing.spread', spread);
    if (!structure) return;

    onFieldChange('financing.total_loan_amount', structure.totalLoanAmt);
    onFieldChange('financing.annual_debt_service', structure.annualDebtService);
    onFieldChange('financing.down_payment', structure.downPayment);
    onFieldChange('financing.total_acquisition_cost', structure.totalAcquisitionCost);
    onFieldChange('financing.ltc_ratio', structure.ltc);

    const seniorLoan = loansToSave.find((loan) => loan.type === 'Senior Loan');
    if (seniorLoan) {
      onFieldChange('financing.ltv', seniorLoan.ltv || 0);
      onFieldChange('financing.interest_rate', seniorLoan.rate || 0);
      onFieldChange('financing.loan_term_years', seniorLoan.term || 0);
      onFieldChange('financing.amortization_years', seniorLoan.amort || 0);
      onFieldChange('financing.io_years', seniorLoan.io || 0);
      onFieldChange('financing.loan_fees_percent', seniorLoan.fees || 0);
    }
  }, [noi, onFieldChange, purchasePrice, spread]);

  const updateBuilderLoan = useCallback((loanId, updates) => {
    setBuilderLoans((previous) => previous.map((loan) => (loan.id === loanId ? { ...loan, ...updates } : loan)));
    setDirty(true);
  }, []);

  const removeBuilderLoan = useCallback((loanId) => {
    setBuilderLoans((previous) => previous.filter((loan) => loan.id !== loanId));
    setDirty(true);
  }, []);

  const addLoan = useCallback((type) => {
    const template = LOAN_LIBRARY.find((item) => item.type === type);
    if (!template) return;
    setBuilderLoans((previous) => ([
      ...previous,
      {
        id: `${type.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
        type,
        enabled: true,
        ...template.defaults,
      },
    ]));
    setDirty(true);
    setShowAddMenu(false);
  }, []);

  const openCalculator = useCallback((loan) => {
    const metrics = getLoanMetrics(loan, purchasePrice);
    setCalculatorState({
      open: true,
      loanId: loan.id,
      amount: Math.round(metrics.amount || 0),
      rate: Number(loan.rate) || 0,
      amort: Number(loan.amort) || 30,
      term: Number(loan.term) || 10,
      io: Number(loan.io) || 0,
      fees: Number(loan.fees) || 0,
    });
  }, [purchasePrice]);

  const calculatorMonthlyIO = calculatorState.amount > 0
    ? calculatorState.amount * calculatorState.rate / 100 / 12
    : 0;
  const calculatorMonthlyAmort = calcMonthlyPayment(
    calculatorState.amount,
    calculatorState.rate,
    (calculatorState.amort || 0) * 12,
  );
  const calculatorMonthlyShown = calculatorState.io > 0 ? calculatorMonthlyIO : calculatorMonthlyAmort;

  const applyCalculator = useCallback(() => {
    if (!calculatorState.loanId) return;
    updateBuilderLoan(calculatorState.loanId, {
      loanAmtMode: 'dollar',
      loanDollar: calculatorState.amount,
      rate: calculatorState.rate,
      amort: calculatorState.amort,
      term: calculatorState.term,
      io: calculatorState.io,
      fees: calculatorState.fees,
    });
    setCalculatorState((previous) => ({ ...previous, open: false }));
  }, [calculatorState, updateBuilderLoan]);

  const applyScenario = useCallback(() => {
    persistLoans(builderLoans);
    setDirty(false);
  }, [builderLoans, persistLoans]);

  const resetScenario = useCallback(() => {
    setBuilderLoans(cloneLoans(currentLoans));
    setDirty(false);
  }, [currentLoans]);

  const builderLoanTypes = builderLoans.map((loan) => loan.type);
  const availableLoanTypes = LOAN_LIBRARY.filter((item) => item.type !== 'Senior Loan' && !builderLoanTypes.includes(item.type));
  const seniorBuilderLoan = builderLoans.find((loan) => loan.type === 'Senior Loan') || null;
  const selectedTreasuryTerm = seniorBuilderLoan && treasuryRates.length > 0
    ? treasuryRates.find((entry) => (
      Math.abs(((Number(entry.rate) || 0) + spread) - (Number(seniorBuilderLoan.rate) || 0)) < 0.011
      && Number(entry.term) === Number(seniorBuilderLoan.term)
    ))?.term
    : null;
  const comparisonDelta = builderStructure && currentStructure
    ? {
        monthly: builderStructure.totalMonthlyPmt - currentStructure.totalMonthlyPmt,
        annual: builderStructure.totalAnnualPmt - currentStructure.totalAnnualPmt,
        cashflow: builderStructure.cashflow - currentStructure.cashflow,
        dscr: builderStructure.dscr - currentStructure.dscr,
      }
    : null;

  return (
    <div style={{ background: PAGE, padding: 0, minHeight: '100%' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT }}>Deal Structure</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: MUTED }}>Review the current structure, build an alternative, and calculate debt service before you apply it.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.9fr) minmax(420px, 1.1fr)', gap: 20, alignItems: 'start' }}>
          <section style={{ ...CARD_STYLE, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Wallet size={18} color={PRIMARY} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Current Debt Structure</div>
                <div style={{ fontSize: 12, color: MUTED }}>This is the structure the deal is currently using.</div>
              </div>
            </div>

            {currentStructure ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                  <SummaryMetric label="Monthly Debt Service" value={currency(currentStructure.totalMonthlyPmt)} subvalue={currency(currentStructure.totalAnnualPmt) + ' annual'} />
                  <SummaryMetric label="Cash Flow After Debt" value={currency(currentStructure.cashflow)} valueColor={currentStructure.cashflow >= 0 ? POSITIVE : NEGATIVE} subvalue={`DSCR ${currentStructure.dscr.toFixed(2)}x`} />
                </div>

                <div style={{ ...CARD_STYLE, boxShadow: 'none', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.8fr 0.8fr 1fr 1fr', gap: 12, padding: '12px 14px', background: '#f1f5f9', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <div>Position</div>
                    <div style={{ textAlign: 'right' }}>Amount</div>
                    <div style={{ textAlign: 'right' }}>Rate</div>
                    <div style={{ textAlign: 'right' }}>Term</div>
                    <div style={{ textAlign: 'right' }}>Monthly</div>
                    <div style={{ textAlign: 'right' }}>Annual</div>
                  </div>
                  {currentLoans.map((loan) => <LoanRow key={loan.id} loan={loan} purchasePrice={purchasePrice} />)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                  <SummaryMetric label="Total Loan Amount" value={currency(currentStructure.totalLoanAmt)} subvalue={`LTV ${percent(currentStructure.ltv)}`} />
                  <SummaryMetric label="Down Payment" value={currency(currentStructure.downPayment)} subvalue={currentStructure.totalFees > 0 ? `${currency(currentStructure.totalFees)} fees` : 'No loan fees'} />
                  <SummaryMetric label="Loan To Cost" value={percent(currentStructure.ltc)} subvalue={`Blended rate ${percent(currentStructure.blendedRate)}`} />
                </div>
              </>
            ) : (
              <div style={{ padding: '18px 0', color: MUTED }}>Add a price and financing inputs to view the current structure.</div>
            )}
          </section>

          <section style={{ ...CARD_STYLE, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Alternative Structure Builder</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Model a different stack here. Nothing changes in the underwrite until you apply it.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowAddMenu((previous) => !previous)} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={15} /> Add Position
                  </button>
                  {showAddMenu ? (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)', overflow: 'hidden', zIndex: 20 }}>
                      {availableLoanTypes.map((item) => (
                        <button key={item.type} onClick={() => addLoan(item.type)} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', background: '#fff', cursor: 'pointer', color: TEXT, fontSize: 13, fontWeight: 600 }}>
                          {item.type}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button onClick={() => openCalculator(builderLoans[0] || buildDefaultSeniorLoan(financing))} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={15} /> Loan Calculator
                </button>
                <button onClick={resetScenario} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontWeight: 700, cursor: 'pointer' }}>
                  Reset
                </button>
                <button onClick={applyScenario} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                  Apply Structure
                </button>
              </div>
            </div>

            <div style={{ ...CARD_STYLE, boxShadow: 'none', padding: 18, marginBottom: 18, background: '#f8fbff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <TrendingUp size={16} color={PRIMARY} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>Senior Loan Rate Options</div>
                  <div style={{ fontSize: 12, color: MUTED }}>Live Treasury terms plus spread. Apply one click to the senior loan.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, alignItems: 'end', marginBottom: 14 }}>
                <Field label="Spread" suffix="%" value={spread} onChange={(value) => setSpread(value)} step={0.1} />
                <div style={{ fontSize: 12, color: MUTED }}>
                  Current senior loan rate: <span style={{ color: TEXT, fontWeight: 700 }}>{percent(seniorBuilderLoan?.rate || 0)}</span>
                  {treasuryAsOf ? `  |  Treasury as of ${treasuryAsOf}` : ''}
                </div>
              </div>

              {treasuryLoading ? (
                <div style={{ fontSize: 12, color: MUTED }}>Loading Treasury rates...</div>
              ) : treasuryRates.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {treasuryRates.map((entry) => {
                    const appliedRate = (Number(entry.rate) || 0) + spread;
                    const isSelected = Number(selectedTreasuryTerm) === Number(entry.term);
                    return (
                      <button
                        key={entry.term}
                        type="button"
                        onClick={() => seniorBuilderLoan && updateBuilderLoan(seniorBuilderLoan.id, { rate: Number(appliedRate.toFixed(2)), term: Number(entry.term) })}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: `1px solid ${isSelected ? PRIMARY : BORDER}`,
                          background: isSelected ? PRIMARY_SOFT : '#fff',
                          cursor: seniorBuilderLoan ? 'pointer' : 'default',
                        }}
                        disabled={!seniorBuilderLoan}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{entry.term} Year</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 4 }}>{percent(appliedRate)}</div>
                        <div style={{ fontSize: 12, color: MUTED }}>{percent(entry.rate)} Treasury + {percent(spread)}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: treasuryError ? NEGATIVE : MUTED }}>{treasuryError || 'Treasury rates unavailable right now.'}</div>
              )}
            </div>

            {comparisonDelta && builderStructure && currentStructure ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <SummaryMetric label="Monthly Debt" value={currency(builderStructure.totalMonthlyPmt)} subvalue={`${comparisonDelta.monthly >= 0 ? '+' : '-'}${currency(Math.abs(comparisonDelta.monthly))} vs current`} valueColor={comparisonDelta.monthly <= 0 ? POSITIVE : TEXT} />
                <SummaryMetric label="Annual Debt" value={currency(builderStructure.totalAnnualPmt)} subvalue={`${comparisonDelta.annual >= 0 ? '+' : '-'}${currency(Math.abs(comparisonDelta.annual))} vs current`} valueColor={comparisonDelta.annual <= 0 ? POSITIVE : TEXT} />
                <SummaryMetric label="DSCR" value={`${builderStructure.dscr.toFixed(2)}x`} subvalue={`${comparisonDelta.dscr >= 0 ? '+' : ''}${comparisonDelta.dscr.toFixed(2)} vs current`} valueColor={builderStructure.dscr >= 1.25 ? POSITIVE : builderStructure.dscr >= 1 ? TEXT : NEGATIVE} />
                <SummaryMetric label="Cash Flow" value={currency(builderStructure.cashflow)} subvalue={`${comparisonDelta.cashflow >= 0 ? '+' : '-'}${currency(Math.abs(comparisonDelta.cashflow))} vs current`} valueColor={builderStructure.cashflow >= 0 ? POSITIVE : NEGATIVE} />
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 14 }}>
              {builderLoans.map((loan) => {
                const metrics = getLoanMetrics(loan, purchasePrice);
                const isEquity = loan.type === 'Equity Partner';
                return (
                  <div key={loan.id} style={{ ...CARD_STYLE, boxShadow: 'none', padding: 18, borderColor: dirty ? '#bfdbfe' : BORDER }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{loan.type}</div>
                        <div style={{ fontSize: 12, color: MUTED }}>{isEquity ? 'Equity layer' : metrics.ioYears > 0 ? (metrics.isFullTermIO ? 'Full-term IO payment' : `IO for ${metrics.ioYears} years`) : 'Amortizing payment'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isEquity ? (
                          <button onClick={() => openCalculator(loan)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calculator size={14} /> Calculator
                          </button>
                        ) : null}
                        {loan.type !== 'Senior Loan' ? (
                          <button onClick={() => removeBuilderLoan(loan.id)} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {!isEquity ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loan Amount</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                              <select value={loan.loanAmtMode || 'ltv'} onChange={(event) => updateBuilderLoan(loan.id, { loanAmtMode: event.target.value })} style={{ ...INPUT_STYLE }}>
                                <option value="ltv">% Price</option>
                                <option value="dollar">Amount</option>
                                <option value="ltc">% LTC</option>
                              </select>
                              {loan.loanAmtMode === 'dollar' ? (
                                <Field label=" " prefix="$" value={loan.loanDollar || 0} onChange={(value) => updateBuilderLoan(loan.id, { loanDollar: value })} step={1000} />
                              ) : (
                                <Field label=" " suffix="%" value={loan.ltv || 0} onChange={(value) => updateBuilderLoan(loan.id, { ltv: value })} step={1} max={100} />
                              )}
                            </div>
                          </div>
                          <Field label="Interest Rate" suffix="%" value={loan.rate || 0} onChange={(value) => updateBuilderLoan(loan.id, { rate: value })} step={0.05} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
                          <Field label="Amortization" value={loan.amort || 0} onChange={(value) => updateBuilderLoan(loan.id, { amort: value })} step={1} />
                          <Field label="Loan Term" value={loan.term || 0} onChange={(value) => updateBuilderLoan(loan.id, metrics.isFullTermIO ? { term: value, io: value } : { term: value })} step={1} />
                          <Field label="Interest Only" value={loan.io || 0} onChange={(value) => updateBuilderLoan(loan.id, { io: value })} step={1} />
                          <Field label="Loan Fees" suffix="%" value={loan.fees || 0} onChange={(value) => updateBuilderLoan(loan.id, { fees: value })} step={0.1} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#f1f5f9', border: `1px solid ${BORDER}` }}>
                          <button
                            type="button"
                            onClick={() => updateBuilderLoan(loan.id, metrics.isFullTermIO ? { io: 0 } : { io: Number(loan.term) || 0 })}
                            style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${metrics.isFullTermIO ? PRIMARY : BORDER}`, background: metrics.isFullTermIO ? PRIMARY_SOFT : '#fff', color: metrics.isFullTermIO ? PRIMARY : TEXT, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          >
                            {metrics.isFullTermIO ? 'Full-Term IO Enabled' : 'Make Full-Term IO'}
                          </button>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Payment</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: PRIMARY }}>{currency(metrics.monthlyPayment)}</div>
                            <div style={{ fontSize: 12, color: MUTED }}>{currency(metrics.annualPayment)} annual{metrics.fees > 0 ? `  |  ${currency(metrics.fees)} fees` : ''}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
                          <Field label="Equity Amount" prefix="$" value={loan.loanDollar || 0} onChange={(value) => updateBuilderLoan(loan.id, { loanDollar: value })} step={1000} />
                          <Field label="Pref Return" suffix="%" value={loan.rate || 0} onChange={(value) => updateBuilderLoan(loan.id, { rate: value })} step={0.1} />
                          <Field label="Term" value={loan.term || 0} onChange={(value) => updateBuilderLoan(loan.id, { term: value })} step={1} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#f1f5f9', border: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 12, color: MUTED }}>Preferred return adds to annual debt load when you compare structures.</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Pref</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: PRIMARY }}>{currency(metrics.monthlyPayment)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {builderStructure ? (
          <div style={{ ...CARD_STYLE, padding: 22, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <BarChart3 size={18} color={PRIMARY} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Scenario Summary</div>
                <div style={{ fontSize: 12, color: MUTED }}>This is what the alternative structure would do if you apply it.</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
              <SummaryMetric label="Loan Amount" value={currency(builderStructure.totalLoanAmt)} subvalue={`LTV ${percent(builderStructure.ltv)}`} />
              <SummaryMetric label="Cash Required" value={currency(builderStructure.cashOutOfPocket)} subvalue={`${currency(builderStructure.downPayment)} down payment`} />
              <SummaryMetric label="Monthly Debt" value={currency(builderStructure.totalMonthlyPmt)} subvalue={currency(builderStructure.totalAnnualPmt) + ' annual'} />
              <SummaryMetric label="Cash Flow" value={currency(builderStructure.cashflow)} valueColor={builderStructure.cashflow >= 0 ? POSITIVE : NEGATIVE} subvalue={`CoC ${percent(builderStructure.cashOnCash)}`} />
              <SummaryMetric label="DSCR" value={`${builderStructure.dscr.toFixed(2)}x`} valueColor={builderStructure.dscr >= 1.25 ? POSITIVE : builderStructure.dscr >= 1 ? TEXT : NEGATIVE} subvalue={`Blended rate ${percent(builderStructure.blendedRate)}`} />
            </div>
          </div>
        ) : null}

        {calculatorState.open ? (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCalculatorState((previous) => ({ ...previous, open: false }));
              }
            }}
          >
            <div style={{ ...CARD_STYLE, width: '100%', maxWidth: 720, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Loan Calculator</div>
                  <div style={{ fontSize: 12, color: MUTED }}>Run the payment math first, then load the result into the selected position.</div>
                </div>
                <button onClick={() => setCalculatorState((previous) => ({ ...previous, open: false }))} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                <Field label="Loan Amount" prefix="$" value={calculatorState.amount} onChange={(value) => setCalculatorState((previous) => ({ ...previous, amount: value }))} step={1000} />
                <Field label="Rate" suffix="%" value={calculatorState.rate} onChange={(value) => setCalculatorState((previous) => ({ ...previous, rate: value }))} step={0.05} />
                <Field label="Fees" suffix="%" value={calculatorState.fees} onChange={(value) => setCalculatorState((previous) => ({ ...previous, fees: value }))} step={0.1} />
                <Field label="Amortization" value={calculatorState.amort} onChange={(value) => setCalculatorState((previous) => ({ ...previous, amort: value }))} step={1} />
                <Field label="Loan Term" value={calculatorState.term} onChange={(value) => setCalculatorState((previous) => ({ ...previous, term: value }))} step={1} />
                <Field label="Interest Only" value={calculatorState.io} onChange={(value) => setCalculatorState((previous) => ({ ...previous, io: value }))} step={1} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
                <SummaryMetric label="IO Payment" value={currency(calculatorMonthlyIO)} subvalue="Monthly while IO is active" />
                <SummaryMetric label="Amortizing Payment" value={currency(calculatorMonthlyAmort)} subvalue="Monthly after IO ends" />
                <SummaryMetric label="Shown In Builder" value={currency(calculatorMonthlyShown)} subvalue={calculatorState.io > 0 ? 'Current builder logic uses IO payment' : 'Current builder logic uses amortizing payment'} />
                <SummaryMetric label="Loan Fees" value={currency((calculatorState.amount || 0) * (calculatorState.fees || 0) / 100)} subvalue={percent(calculatorState.fees || 0)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button onClick={() => setCalculatorState((previous) => ({ ...previous, open: false }))} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontWeight: 700, cursor: 'pointer' }}>
                  Close
                </button>
                <button onClick={applyCalculator} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                  Load Into Selected Loan
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
