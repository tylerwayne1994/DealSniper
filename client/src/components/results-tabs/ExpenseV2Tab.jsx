import React, { useState } from 'react';
import { calculateAmortizationSchedule } from '../../utils/realEstateCalculations';

// ──────────────────────────────────────────────────────────────────
// ExpenseV2Tab — Clean P&L with colored TEXT values (no boxes)
// Flow: GPR (green) → Vacancy → LTL → EGI (green) → Expense line
//       items (utilities broken down) → Total OpEx (red text)
//       → NOI (navy row) → CAPEX → Debt Service (red, clickable)
//       → Net Income (navy row) → metrics strip (plain text)
// ──────────────────────────────────────────────────────────────────
export default function ExpenseV2Tab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = scenarioData?.expenses || {};
  const optimized = scenarioData?.value_add?.optimized_expenses || {};
  const pnl = scenarioData?.pnl || {};
  const unitMix = scenarioData?.unit_mix || [];
  const units = Number(scenarioData?.property?.units) || 1;
  const price = Number(scenarioData?.pricing_financing?.price) || Number(scenarioData?.pricing_financing?.purchase_price) || 0;
  const financing = scenarioData?.financing || {};

  // ── Editable state ──
  const [capexUWpct, setCapexUWpct] = useState(Number(expenses.capex_pct) || 2);
  const [capexVApct, setCapexVApct] = useState(Number(optimized.capex_pct) || 2);
  const [showDebtModal, setShowDebtModal] = useState(false);

  // ── Tax reassessment estimate ──
  const [taxRatePct, setTaxRatePct] = useState(() => {
    if (scenarioData?.value_add?.tax_rate_pct) return Number(scenarioData.value_add.tax_rate_pct);
    // Estimate from current taxes: taxRate = currentTaxes / price * 100
    const currentTax = Number(expenses.taxes) || 0;
    if (currentTax > 0 && price > 0) return parseFloat((currentTax / price * 100).toFixed(3));
    return 1.25; // Default
  });
  const reassessedTax = price > 0 ? Math.round(price * taxRatePct / 100) : 0;

  // ── Financing state — multi-loan Cactus-style system ──
  // Each loan is an object: { id, type, enabled, loanAmtMode, ltvOrPct, rate, term, amort, io, fees, ... }
  const [loans, setLoans] = useState(() => {
    const saved = financing.loans || [];
    if (saved.length > 0) return saved;
    // Default: single Senior Loan
    return [{
      id: 'senior', type: 'Senior Loan', enabled: true,
      loanAmtMode: 'ltv', // 'ltv' | 'dollar' | 'ltc'
      ltv: Number(financing.ltv) || 70, loanDollar: 0,
      rate: Number(financing.interest_rate) || 5.96, term: Number(financing.loan_term_years) || 10,
      amort: Number(financing.amortization_years) || 30, io: Number(financing.io_years) || 0,
      fees: Number(financing.loan_fees_percent) || 1.5,
    }];
  });
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Available loan types to add
  const addableLoanTypes = [
    { type: 'Mezzanine Loan', icon: '🏦', desc: 'Secondary debt such as mezzanine' },
    { type: 'Seller Financing', icon: '🤝', desc: 'Seller-carried note with deferred start' },
    { type: 'Second Debt', icon: '📄', desc: 'Additional junior debt position' },
    { type: 'Equity Partner', icon: '👥', desc: 'JV equity with preferred return' },
  ];

  // Calculate monthly payment for a single loan
  const calcLoanPayment = (loan) => {
    const loanAmt = loan.loanAmtMode === 'ltv'
      ? price * (Number(loan.ltv) || 0) / 100
      : loan.loanAmtMode === 'ltc'
      ? price * (Number(loan.ltv) || 0) / 100
      : Number(loan.loanDollar) || 0;
    const r = (Number(loan.rate) || 0) / 100 / 12;
    const n = (Number(loan.amort) || 30) * 12;
    if (loanAmt <= 0 || r <= 0) return { loanAmt, monthlyPmt: 0, fees: loanAmt * (Number(loan.fees) || 0) / 100 };
    const pmt = loanAmt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return { loanAmt, monthlyPmt: pmt, fees: loanAmt * (Number(loan.fees) || 0) / 100 };
  };

  // Equity partner calc (different — pref return on equity, not debt service)
  const calcEquityPartner = (loan) => {
    const partnerEquity = Number(loan.loanDollar) || 0;
    const prefReturn = (Number(loan.rate) || 8) / 100;
    const annualPref = partnerEquity * prefReturn;
    return { loanAmt: 0, monthlyPmt: annualPref / 12, fees: 0, partnerEquity };
  };

  // Aggregate all loans
  const loanCalcs = loans.filter(l => l.enabled !== false).map(l => {
    if (l.type === 'Equity Partner') return { ...l, calc: calcEquityPartner(l) };
    return { ...l, calc: calcLoanPayment(l) };
  });
  const totalLoanAmt = loanCalcs.reduce((s, l) => s + (l.calc.loanAmt || 0), 0);
  const totalMonthlyPmt = loanCalcs.reduce((s, l) => s + (l.calc.monthlyPmt || 0), 0);
  const totalFees = loanCalcs.reduce((s, l) => s + (l.calc.fees || 0), 0);
  const totalEquityPartner = loanCalcs.filter(l => l.type === 'Equity Partner').reduce((s, l) => s + (l.calc.partnerEquity || 0), 0);
  const totalAcquisitionCost = price + totalFees;
  const downPmt = Math.max(0, price - totalLoanAmt - totalEquityPartner);
  const annualDS = totalMonthlyPmt * 12;
  const ltcRatio = totalAcquisitionCost > 0 ? (totalLoanAmt / totalAcquisitionCost * 100) : 0;
  const downPmtPct = price > 0 ? (downPmt / price * 100) : 0;

  // ── Editable VA rents per unit type ──
  const [vaRents, setVaRents] = useState(() => {
    const saved = scenarioData?.value_add?.unit_rents || {};
    const init = {};
    unitMix.forEach((u, i) => {
      const key = u.type || u.bed_bath || `Unit ${i + 1}`;
      init[key] = saved[key] ?? u.rent_market ?? u.rent_current ?? 0;
    });
    return init;
  });

  // ── Utility owner/tenant paid toggles ──
  const [utilPaidBy, setUtilPaidBy] = useState(() => {
    const saved = scenarioData?.value_add?.utility_paid_by || {};
    return { water_sewer: 'owner', electric: 'owner', electrical: 'owner', gas: 'owner', trash: 'owner', utilities_other: 'owner', ...saved };
  });

  // ── Style constants ──
  const B = '#e5e7eb';
  const NAVY = '#1e2a4a';
  const NAVY_TEXT = '#fff';
  const GREEN = '#166534';
  const RED = '#991b1b';
  const GRAY = '#6b7280';
  const INPUT_S = { width: 120, padding: '5px 8px', border: `1px solid ${B}`, borderRadius: 6, fontSize: 12, textAlign: 'right', background: '#fff', fontFamily: 'inherit', outline: 'none' };
  const INPUT_VA = { ...INPUT_S, background: '#f9fafb' };
  const PCT_INPUT = { ...INPUT_S, width: 60 };
  const PCT_INPUT_VA = { ...PCT_INPUT, background: '#f9fafb' };

  const fmt = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const v = Number(n);
    if (Number.isNaN(v)) return '—';
    return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  const fmtNeg = (n) => {
    const v = Number(n);
    if (!v && v !== 0) return '—';
    return `-$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  const pctFmt = (n) => {
    if (n === null || n === undefined) return '—';
    return `${Number(n).toFixed(2)}%`;
  };

  const handleChange = (path, value) => { if (onFieldChange) onFieldChange(path, value); };
  const copyVal = (targetPath, val) => { if (onFieldChange) onFieldChange(targetPath, Number(val) || 0); };

  // ── Income ──
  const gprUW = Number(pnl.gross_potential_rent) || Number(fullCalcs?.year1?.potentialGrossIncome) || 0;
  // VA GPR is driven by editable per-unit VA rents
  const gprVA = unitMix.length > 0
    ? unitMix.reduce((s, u, i) => {
        const key = u.type || u.bed_bath || `Unit ${i + 1}`;
        return s + (u.units || 1) * (Number(vaRents[key]) || 0) * 12;
      }, 0)
    : Number(fullCalcs?.year1?.potentialGrossIncome) || gprUW;
  const avgRentPerUnit = units > 0 && gprUW > 0 ? gprUW / 12 / units : 0;

  // Vacancy & LTL
  // Both expenses.vacancy_pct and pnl.vacancy_rate_current are whole-number
  // percentages (e.g. 5 = 5%). Only convert if still a decimal (< 1).
  const vacUWpctRaw = expenses.vacancy_pct ?? pnl.vacancy_rate_current ?? 5;
  const vacVApctRaw = optimized.vacancy_pct ?? pnl.vacancy_rate_stabilized ?? 5;
  const vacUWpct = Number(vacUWpctRaw) > 0 && Number(vacUWpctRaw) < 1 ? Number(vacUWpctRaw) * 100 : Number(vacUWpctRaw);
  const vacVApct = Number(vacVApctRaw) > 0 && Number(vacVApctRaw) < 1 ? Number(vacVApctRaw) * 100 : Number(vacVApctRaw);
  const ltlUWpct = Number(expenses.loss_to_lease_pct || 0);
  const ltlVApct = Number(optimized.loss_to_lease_pct || 0);
  const vacUW = gprUW * vacUWpct / 100;
  const vacVA = gprVA * vacVApct / 100;
  const ltlUW = gprUW * ltlUWpct / 100;
  const ltlVA = gprVA * ltlVApct / 100;
  const egiUW = gprUW - vacUW - ltlUW;
  const egiVA = gprVA - vacVA - ltlVA;

  // ── Utility breakdown ──
  const utilitySubKeys = [
    { key: 'water_sewer', label: 'Water / Sewer', defaultPct: 30 },
    { key: 'electric', label: 'Electric', defaultPct: 35 },
    { key: 'electrical', label: 'Electric', defaultPct: 35 },
    { key: 'gas', label: 'Gas', defaultPct: 20 },
    { key: 'trash', label: 'Trash Removal', defaultPct: 15 },
  ];
  // Build utility sub-rows from expenses data
  const utilBreakdown = expenses.utility_breakdown || {};
  const utilityRows = [];

  // Check if we have a lump sum but NO individual breakdown values
  const totalUtilLumpSum = Number(expenses.utilities) || 0;
  const hasAnyBreakdown = utilitySubKeys.some(({ key }) => {
    return (Number(utilBreakdown[key]) || 0) > 0 || (Number(expenses[key]) || 0) > 0;
  });
  const useLumpSumSplit = totalUtilLumpSum > 0 && !hasAnyBreakdown;

  // Check both utility_breakdown object and top-level expense keys
  utilitySubKeys.forEach(({ key, label, defaultPct }) => {
    const fromBreakdown = Number(utilBreakdown[key]) || 0;
    const fromExpenses = Number(expenses[key]) || 0;
    let val = fromBreakdown || fromExpenses;
    // If lump sum with no breakdown, auto-split using industry %
    if (useLumpSumSplit && key !== 'electrical') {
      val = Math.round(totalUtilLumpSum * defaultPct / 100);
    }
    // Use ?? so that explicit 0 in optimized stays as 0 (not fallback to UW)
    const optRaw = optimized[key] ?? optimized.utility_breakdown?.[key];
    const optVal = optRaw != null ? Number(optRaw) : val;
    // Avoid duplicating electrical/electric
    if (key === 'electrical' && utilityRows.find(r => r.label === 'Electric')) return;
    if (key === 'electric' && utilityRows.find(r => r.label === 'Electric')) return;
    utilityRows.push({ key, label, uw: val, va: optVal, uwPath: `expenses.${key}`, vaPath: `value_add.optimized_expenses.${key}` });
  });
  // Remove electrical duplicates — keep whichever has a value
  const electricIdx = utilityRows.findIndex(r => r.key === 'electric');
  const electricalIdx = utilityRows.findIndex(r => r.key === 'electrical');
  if (electricIdx >= 0 && electricalIdx >= 0) {
    if (utilityRows[electricalIdx].uw > 0) utilityRows.splice(electricIdx, 1);
    else utilityRows.splice(electricalIdx, 1);
  }
  const totalUtilBreakdownUW = utilityRows.reduce((s, r) => s + r.uw, 0);
  const totalUtilBreakdownVA = utilityRows.reduce((s, r) => s + r.va, 0);
  const totalUtilFromExpenses = totalUtilLumpSum;
  const totalUtilFromOptimized = Number(optimized.utilities) || totalUtilFromExpenses;
  // If breakdown doesn't account for the total, add an "Other Utilities" catch-all
  // (skip if we auto-split from lump sum — already accounts for 100%)
  const utilDiffUW = totalUtilLumpSum - totalUtilBreakdownUW;
  const utilDiffVA = totalUtilFromOptimized - totalUtilBreakdownVA;
  if (!useLumpSumSplit && (utilDiffUW > 50 || totalUtilLumpSum > 0)) {
    const otherUW = Math.max(0, utilDiffUW);
    const otherVA = Math.max(0, utilDiffVA);
    if (otherUW > 0 || otherVA > 0) {
      utilityRows.push({ key: 'utilities_other', label: 'Other Utilities', uw: otherUW, va: otherVA, uwPath: 'expenses.utilities_other', vaPath: 'value_add.optimized_expenses.utilities_other' });
    }
  }

  // ── Expense line items (excluding utilities — we show those broken down) ──
  const labelMap = {
    taxes: 'Property Taxes', insurance: 'Insurance',
    repairs_maintenance: 'Maintenance Related', management: 'Property Management Fees',
    payroll: 'Salaries Payroll Related', admin: 'Administrative',
    administration_fees: 'Administration Fees', marketing: 'Media Advertising',
    other: 'Other', bad_debt_recovery: 'Bad Debt Recovery',
    pest_control_fees: 'Pest Control Contract', turnover_costs: 'Turnover Costs',
    grounds: 'Grounds', professional_fees: 'Professional Fees',
    evictions_court_fees: 'Evictions Court Fees', office_supplies: 'Office Supplies Expenses',
  };
  const labelFromKey = (k) => labelMap[k] || (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const skipKeys = new Set([
    'utility_breakdown', 'utilities', 'water_sewer', 'electric', 'electrical', 'gas', 'trash',
    'management_pct', 'vacancy_pct', 'loss_to_lease_pct', 'capex_pct',
    'management_rate', 'vacancy_rate', 'capex_rate', 'total',
    'electric_reimbursable', 'gas_submeter', 'trash_service_fee', 'water_sewer_revenue',
    'utilities_other',
  ]);
  const rows = [];
  Object.entries(expenses).forEach(([key, val]) => {
    if (skipKeys.has(key) || typeof val === 'object') return;
    const uwVal = Number(val) || 0;
    // Use ?? so optimized value of 0 stays as 0, only fall back to UW if key is truly missing
    const vaVal = optimized[key] != null ? Number(optimized[key]) : uwVal;
    rows.push({ key, label: labelFromKey(key), uw: uwVal, va: vaVal, uwPath: `expenses.${key}`, vaPath: `value_add.optimized_expenses.${key}` });
  });

  // ── FORMULAS: Total expenses = SUM of all displayed line items ──
  // Every value is taken directly from the row .uw / .va (what's shown on screen)
  const nonUtilTotalUW = rows.reduce((s, r) => s + r.uw, 0);
  const nonUtilTotalVA = rows.reduce((s, r) => s + r.va, 0);
  const utilTotalUW = utilityRows.reduce((s, r) => s + r.uw, 0);
  const utilTotalVA = utilityRows.reduce((s, r) => {
    // If tenant pays this utility in VA scenario, owner expense = $0
    return s + ((utilPaidBy[r.key] || 'owner') === 'tenant' ? 0 : r.va);
  }, 0);
  const totalExpUW = nonUtilTotalUW + utilTotalUW;
  const totalExpVA = nonUtilTotalVA + utilTotalVA;
  // Expense ratio = Total Expenses / EGI (use absolute EGI if negative)
  const absEgiUW = Math.abs(egiUW);
  const absEgiVA = Math.abs(egiVA);
  const expRatioUW = absEgiUW > 0 ? (totalExpUW / absEgiUW * 100) : 0;
  const expRatioVA = absEgiVA > 0 ? (totalExpVA / absEgiVA * 100) : 0;

  // FORMULA: NOI = EGI - Total Operating Expenses
  const noiUW = egiUW - totalExpUW;
  const noiVA = egiVA - totalExpVA;

  // CAPEX Reserve (% of EGI)
  const capexUW = egiUW * capexUWpct / 100;
  const capexVA = egiVA * capexVApct / 100;

  // Cash Flow (uses multi-loan annualDS computed above)
  const netIncomeUW = noiUW - capexUW - annualDS;
  const netIncomeVA = noiVA - capexVA - annualDS;

  // Metrics
  const capRateUW = price > 0 ? noiUW / price : 0;
  const capRateVA = price > 0 ? noiVA / price : 0;
  const dscrUW = annualDS > 0 ? noiUW / annualDS : 0;
  const dscrVA = annualDS > 0 ? noiVA / annualDS : 0;
  const cocUW = downPmt > 0 ? (netIncomeUW / downPmt * 100) : 0;
  const cocVA = downPmt > 0 ? (netIncomeVA / downPmt * 100) : 0;

  // ══════════════════════════════════════════════════════════════
  // ── MULTI-YEAR PROJECTIONS — replaces standalone Proforma tab ──
  // ══════════════════════════════════════════════════════════════
  const [yearsToShow, setYearsToShow] = useState(5);
  const rentGrowthRate = scenarioData?.growth?.annual_rent_growth || 0.03;
  const expenseGrowthRate = scenarioData?.growth?.annual_expense_growth || 0.03;

  // Build proforma years from the P&L computed above
  const generateProforma = () => {
    const years = [];
    for (let yr = 1; yr <= yearsToShow; yr++) {
      const rg = Math.pow(1 + rentGrowthRate, yr - 1);
      const eg = Math.pow(1 + expenseGrowthRate, yr - 1);
      const gpi = gprUW * rg;
      const vac = gpi * (vacUWpct / 100);
      const ltl = gpi * (ltlUWpct / 100);
      const egi = gpi - vac - ltl;
      const opex = totalExpUW * eg;
      const noi = egi - opex;
      const capex = egi * capexUWpct / 100;
      const cf = noi - capex - annualDS;
      const capR = price > 0 ? noi / price : 0;
      const dscr = annualDS > 0 ? noi / annualDS : 0;
      years.push({ year: yr, gpi, vac, ltl, egi, opex, noi, capex, debtService: annualDS, cf, capR, dscr, noiPerUnit: noi / units, expPerUnit: opex / units });
    }
    return years;
  };
  const proformaYears = generateProforma();
  const totalCF = proformaYears.reduce((s, y) => s + y.cf, 0);

  // Principal paydown via amortization schedule (use senior loan)
  const seniorLoan = loans.find(l => l.type === 'Senior Loan') || loans[0];
  const amortLoanAmt = seniorLoan ? (seniorLoan.loanAmtMode === 'ltv' ? price * (Number(seniorLoan.ltv) || 0) / 100 : Number(seniorLoan.loanDollar) || 0) : 0;
  const amortRate = seniorLoan ? Number(seniorLoan.rate) || 0 : 0;
  const amortYearsVal = seniorLoan ? Number(seniorLoan.amort) || 30 : 30;
  const amortSchedule = (amortLoanAmt > 0 && amortRate > 0 && amortYearsVal > 0)
    ? calculateAmortizationSchedule(amortLoanAmt, amortRate, amortYearsVal, yearsToShow)
    : [];
  const principalSeries = amortSchedule.length > 0
    ? amortSchedule.map(r => r.cumulativePrincipal)
    : new Array(yearsToShow).fill(0);

  const proFmt = (val) => {
    if (val == null || isNaN(val)) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  // ── Update a loan field ──
  const updateLoanField = (loanId, field, val) => {
    setLoans(prev => prev.map(l => l.id === loanId ? { ...l, [field]: val } : l));
  };

  // ── Add a new loan ──
  const addLoan = (type) => {
    const defaults = {
      'Mezzanine Loan': { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 5.21, term: 10, amort: 25, io: 0, fees: 0 },
      'Seller Financing': { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 8.5, term: 15, amort: 15, io: 0, fees: 0, startMonth: 24, paymentFree: 0 },
      'Second Debt': { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 7.0, term: 10, amort: 25, io: 0, fees: 0 },
      'Equity Partner': { loanAmtMode: 'dollar', ltv: 0, loanDollar: 0, rate: 8, term: 0, amort: 0, io: 0, fees: 0 },
    };
    const newLoan = { id: `${type.replace(/\s/g, '_').toLowerCase()}_${Date.now()}`, type, enabled: true, ...defaults[type] };
    setLoans(prev => [...prev, newLoan]);
    setShowAddMenu(false);
  };

  // ── Remove a loan ──
  const removeLoan = (loanId) => {
    setLoans(prev => prev.filter(l => l.id !== loanId));
  };

  // ── Save financing changes back ──
  const saveFinancing = () => {
    handleChange('financing.loans', loans);
    handleChange('financing.total_loan_amount', totalLoanAmt);
    handleChange('financing.annual_debt_service', annualDS);
    handleChange('financing.down_payment', downPmt);
    handleChange('financing.total_acquisition_cost', totalAcquisitionCost);
    handleChange('financing.ltc_ratio', ltcRatio);
    // Also write legacy fields from senior loan
    const senior = loans.find(l => l.type === 'Senior Loan');
    if (senior) {
      handleChange('financing.ltv', senior.ltv || 0);
      handleChange('financing.interest_rate', senior.rate || 0);
      handleChange('financing.loan_term_years', senior.term || 0);
      handleChange('financing.amortization_years', senior.amort || 0);
      handleChange('financing.io_years', senior.io || 0);
      handleChange('financing.loan_fees_percent', senior.fees || 0);
    }
    setShowDebtModal(false);
  };

  // ── Table cell helper ──
  const td = (content, opts = {}) => {
    const { bold, right, color, bg, border: bdr, colSpan, py, indent } = opts;
    return (
      <td colSpan={colSpan} style={{
        padding: py ? `${py}px 10px` : '8px 10px',
        paddingLeft: indent ? 28 : 10,
        borderBottom: `1px solid ${bdr || B}`,
        fontWeight: bold ? 800 : 600,
        fontSize: 12, color: color || '#111827',
        textAlign: right ? 'right' : 'left',
        background: bg || 'transparent',
        whiteSpace: 'nowrap',
      }}>{content}</td>
    );
  };

  // Navy row helper
  const navyRow = (label, uwVal, vaVal) => (
    <tr>
      {td(label, { bold: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td(fmt(uwVal), { bold: true, right: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td('', { bg: NAVY, py: 10 })}
      {td(fmt(vaVal), { bold: true, right: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td('', { bg: NAVY, py: 10 })}
    </tr>
  );

  // Expense sub-row (indented, smaller text, with owner/tenant toggle)
  const subRow = (row, i, bgAlt) => {
    const paidBy = utilPaidBy[row.key] || 'owner';
    const isTenantPaid = paidBy === 'tenant';
    return (
      <tr key={row.key} style={{ background: bgAlt ? '#fafafa' : '#fff' }}>
        <td style={{ padding: '5px 10px', paddingLeft: 28, borderBottom: `1px solid ${B}`, color: GRAY, fontSize: 12, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{row.label}</span>
            {/* Owner / Tenant toggle */}
            <button onClick={() => {
              const next = paidBy === 'owner' ? 'tenant' : 'owner';
              setUtilPaidBy(prev => ({ ...prev, [row.key]: next }));
              handleChange(`value_add.utility_paid_by.${row.key}`, next);
            }} style={{
              cursor: 'pointer', padding: '1px 6px', border: `1px solid ${isTenantPaid ? '#86efac' : '#fca5a5'}`,
              borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.3px',
              color: isTenantPaid ? '#15803d' : '#b91c1c',
              background: isTenantPaid ? '#f0fdf4' : '#fef2f2',
            }}>
              {isTenantPaid ? 'TENANT' : 'OWNER'}
            </button>
          </div>
        </td>
        <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: bgAlt ? '#fafafa' : '#fff' }}>
          <input type="number" value={row.uw} onChange={e => handleChange(row.uwPath, parseFloat(e.target.value) || 0)} style={{ ...INPUT_S, width: 100 }} />
        </td>
        <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', background: bgAlt ? '#fafafa' : '#fff' }}>
          <button title="Copy →" onClick={() => copyVal(row.vaPath, row.uw)}
            style={{ cursor: 'pointer', padding: '2px 7px', border: `1px solid ${B}`, borderRadius: 4, fontSize: 10, color: GRAY, background: '#f8fafc' }}>→</button>
        </td>
        <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: bgAlt ? '#fafafa' : '#fff' }}>
          {isTenantPaid ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>$0 — Tenant Paid</span>
          ) : (
            <input type="number" value={row.va} onChange={e => handleChange(row.vaPath, parseFloat(e.target.value) || 0)} style={{ ...INPUT_VA, width: 100 }} />
          )}
        </td>
        <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', fontSize: 10, color: GRAY, background: bgAlt ? '#fafafa' : '#fff' }}>$</td>
      </tr>
    );
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#f3f4f6' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Main Table ── */}
        <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Income & Expenses</th>
                <th style={{ padding: '10px', textAlign: 'right', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Seller Actuals</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, width: 60 }}></th>
                <th style={{ padding: '10px', textAlign: 'right', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Value Add</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>

              {/* ═══════ REVENUE ═══════ */}
              <tr>
                {td('REVENUE', { bold: true, color: GRAY, bg: '#f8fafc', py: 6 })}
                {td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}
              </tr>

              {/* Per-unit rent breakdown — VA rents are editable */}
              {unitMix.length > 0 && unitMix.map((u, i) => {
                const unitKey = u.type || u.bed_bath || `Unit ${i + 1}`;
                const currentRent = Number(u.rent_current) || 0;
                const vaRent = Number(vaRents[unitKey]) || 0;
                const rentDelta = vaRent - currentRent;
                const rentDeltaPct = currentRent > 0 ? (rentDelta / currentRent * 100) : 0;
                return (
                  <tr key={`unit-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {td(`  ${unitKey}  —  ${u.units || 1} units × $${currentRent.toLocaleString()}/mo`, { color: GRAY })}
                    {td(fmt((u.units || 1) * currentRent * 12), { right: true })}
                    {td('', {})}
                    <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 11, color: GRAY }}>$</span>
                        <input type="number" value={vaRent}
                          onChange={e => {
                            const newRent = parseFloat(e.target.value) || 0;
                            setVaRents(prev => ({ ...prev, [unitKey]: newRent }));
                            handleChange(`value_add.unit_rents.${unitKey}`, newRent);
                          }}
                          style={{ ...INPUT_VA, width: 90 }} />
                        <span style={{ fontSize: 10, color: GRAY }}>/mo</span>
                        {rentDelta !== 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: rentDelta > 0 ? '#16a34a' : '#dc2626', marginLeft: 2 }}>
                            {rentDelta > 0 ? '+' : ''}{rentDeltaPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    {td('', {})}
                  </tr>
                );
              })}

              {/* Gross Potential Rental Income — green text */}
              <tr style={{ background: '#f8fafc' }}>
                {td('Gross Potential Rental Income', { bold: true, color: GREEN })}
                {td(fmt(gprUW), { bold: true, right: true, color: GREEN })}
                {td('', {})}{td(fmt(gprVA), { bold: true, right: true, color: GREEN })}{td('', {})}
              </tr>

              {/* Vacancy — editable % */}
              <tr>
                {td('General Vacancy', {})}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" value={vacUWpct} onChange={e => handleChange('expenses.vacancy_pct', parseFloat(e.target.value) || 0)} style={PCT_INPUT} />
                    <span style={{ fontSize: 11, color: GRAY }}>%</span>
                    <span style={{ fontSize: 12, color: '#111827' }}>{fmtNeg(vacUW)}</span>
                  </div>
                </td>
                {td('', {})}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" value={vacVApct} onChange={e => handleChange('value_add.optimized_expenses.vacancy_pct', parseFloat(e.target.value) || 0)} style={PCT_INPUT_VA} />
                    <span style={{ fontSize: 11, color: GRAY }}>%</span>
                    <span style={{ fontSize: 12, color: '#111827' }}>{fmtNeg(vacVA)}</span>
                  </div>
                </td>
                {td('', {})}
              </tr>

              {/* Loss to Lease — editable % */}
              <tr style={{ background: '#fafafa' }}>
                {td('Loss to Lease', {})}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" value={ltlUWpct} onChange={e => handleChange('expenses.loss_to_lease_pct', parseFloat(e.target.value) || 0)} style={PCT_INPUT} />
                    <span style={{ fontSize: 11, color: GRAY }}>%</span>
                    <span style={{ fontSize: 12, color: '#111827' }}>{fmtNeg(ltlUW)}</span>
                  </div>
                </td>
                {td('', { bg: '#fafafa' })}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" value={ltlVApct} onChange={e => handleChange('value_add.optimized_expenses.loss_to_lease_pct', parseFloat(e.target.value) || 0)} style={PCT_INPUT_VA} />
                    <span style={{ fontSize: 11, color: GRAY }}>%</span>
                    <span style={{ fontSize: 12, color: '#111827' }}>{fmtNeg(ltlVA)}</span>
                  </div>
                </td>
                {td('', { bg: '#fafafa' })}
              </tr>

              {/* ── Effective Gross Income — GREEN text ── */}
              <tr style={{ background: '#f8fafc' }}>
                {td('Effective Gross Income', { bold: true, color: GREEN })}
                {td(fmt(egiUW), { bold: true, right: true, color: GREEN })}
                {td('', {})}{td(fmt(egiVA), { bold: true, right: true, color: GREEN })}{td('', {})}
              </tr>

              {/* ═══════ OPERATING EXPENSES ═══════ */}
              <tr>
                {td('OPERATING EXPENSES', { bold: true, color: GRAY, bg: '#f8fafc', py: 6 })}
                {td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}{td('', { bg: '#f8fafc' })}
              </tr>

              {/* Non-utility expense rows */}
              {rows.map((row, i) => (
                <React.Fragment key={row.key}>
                  <tr style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {td(row.label, {})}
                    <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <input type="number" value={row.uw} onChange={e => handleChange(row.uwPath, parseFloat(e.target.value) || 0)} style={INPUT_S} />
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <button title="Copy →" onClick={() => copyVal(row.vaPath, row.uw)}
                        style={{ cursor: 'pointer', padding: '2px 8px', border: `1px solid ${B}`, borderRadius: 4, fontSize: 11, color: GRAY, background: '#f8fafc' }}>→</button>
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <input type="number" value={row.va} onChange={e => handleChange(row.vaPath, parseFloat(e.target.value) || 0)} style={INPUT_VA} />
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', fontSize: 11, color: GRAY, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>$</td>
                  </tr>
                  {/* Tax reassessment hint row after Property Taxes */}
                  {row.key === 'taxes' && price > 0 && (
                    <tr style={{ background: '#fffbeb' }}>
                      <td colSpan={5} style={{ padding: '4px 10px 4px 28px', borderBottom: `1px solid ${B}`, fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: '#92400e', fontWeight: 600 }}>⚠ Est. Reassessed Tax:</span>
                          <span style={{ fontWeight: 700, color: '#92400e' }}>{fmt(reassessedTax)}</span>
                          <span style={{ color: '#b45309' }}>@ </span>
                          <input type="number" step="0.01" value={taxRatePct}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              setTaxRatePct(v);
                              handleChange('value_add.tax_rate_pct', v);
                            }}
                            style={{ width: 60, padding: '2px 6px', border: '1px solid #fbbf24', borderRadius: 4, fontSize: 11, textAlign: 'center', background: '#fffbeb', fontWeight: 700, color: '#92400e' }} />
                          <span style={{ color: '#b45309', fontSize: 10 }}>% of purchase price ({fmt(price)})</span>
                          <button onClick={() => {
                            handleChange('value_add.optimized_expenses.taxes', reassessedTax);
                          }} style={{ cursor: 'pointer', padding: '2px 8px', border: '1px solid #fbbf24', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', marginLeft: 4 }}>
                            Use as VA →
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {/* ── Utilities Section Header ── */}
              <tr>
                <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, background: '#eef2ff', fontWeight: 700, fontSize: 12, color: '#4338ca' }}>
                  UTILITIES BREAKDOWN
                  {useLumpSumSplit && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#6366f1', marginLeft: 8, background: '#ddd6fe', padding: '1px 6px', borderRadius: 4 }}>
                      Auto-split from lump sum
                    </span>
                  )}
                </td>
                <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: '#eef2ff', fontSize: 11, fontWeight: 700, color: '#4338ca' }}>
                  {fmt(utilTotalUW)}
                </td>
                {td('', { bg: '#eef2ff' })}
                <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: '#eef2ff', fontSize: 11, fontWeight: 700, color: '#4338ca' }}>
                  {fmt(utilTotalVA)}
                </td>
                {td('', { bg: '#eef2ff' })}
              </tr>

              {/* Utility sub-rows (indented) */}
              {utilityRows.map((row, i) => subRow(row, i, i % 2 !== 0))}

              {/* ─── Total Operating Expenses — RED text ─── */}
              <tr>
                {td('Total Operating Expenses', { bold: true, color: RED, py: 10 })}
                <td style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 800, fontSize: 13, color: RED }}>
                  {fmtNeg(totalExpUW)}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', marginLeft: 6 }}>({pctFmt(expRatioUW)})</span>
                </td>
                <td style={{ padding: '10px', borderBottom: `1px solid ${B}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: GRAY }}>ⓘ</span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 800, fontSize: 13, color: RED }}>
                  {fmtNeg(totalExpVA)}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', marginLeft: 6 }}>({pctFmt(expRatioVA)})</span>
                </td>
                <td style={{ padding: '10px', borderBottom: `1px solid ${B}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: GRAY }}>ⓘ</span>
                </td>
              </tr>

              {/* ─── NOI — NAVY ROW ─── */}
              {navyRow('Net Operating Income', noiUW, noiVA)}

              {/* ─── CAPEX Reserve ─── */}
              <tr style={{ background: '#fff' }}>
                {td('CAPEX Reserve', {})}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" step="0.5" value={capexUWpct}
                      onChange={e => { setCapexUWpct(parseFloat(e.target.value) || 0); handleChange('expenses.capex_pct', parseFloat(e.target.value) || 0); }}
                      style={PCT_INPUT} />
                    <span style={{ fontSize: 11, color: GRAY }}>% of EGI</span>
                  </div>
                </td>
                {td('', {})}
                <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <input type="number" step="0.5" value={capexVApct}
                      onChange={e => { setCapexVApct(parseFloat(e.target.value) || 0); handleChange('value_add.optimized_expenses.capex_pct', parseFloat(e.target.value) || 0); }}
                      style={PCT_INPUT_VA} />
                    <span style={{ fontSize: 11, color: GRAY }}>% of EGI</span>
                  </div>
                </td>
                {td('', {})}
              </tr>

              {/* ─── Debt Service — RED text, clickable to edit ─── */}
              <tr style={{ cursor: 'pointer' }} onClick={() => setShowDebtModal(true)} title="Click to adjust debt terms">
                <td style={{ padding: '10px', borderBottom: `1px solid ${B}`, fontWeight: 800, fontSize: 12, color: RED }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Annual Debt Service</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: GRAY, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
                      {loans.length} loan{loans.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>✎ edit</span>
                  </div>
                </td>
                {td(fmtNeg(annualDS), { bold: true, right: true, color: RED })}
                {td('', {})}
                {td(fmtNeg(annualDS), { bold: true, right: true, color: RED })}
                {td('', {})}
              </tr>

              {/* ─── Cash Flow — NAVY ROW ─── */}
              {navyRow('Cash Flow Before Tax', netIncomeUW, netIncomeVA)}

            </tbody>
          </table>
        </div>

        {/* ── Key Metrics — clean text row, NO boxes ── */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: `2px solid ${B}` }}>
          {[
            { label: 'CAP RATE', uw: pctFmt(capRateUW * 100), va: pctFmt(capRateVA * 100) },
            { label: 'DSCR', uw: dscrUW > 0 ? `${dscrUW.toFixed(2)}x` : '—', va: dscrVA > 0 ? `${dscrVA.toFixed(2)}x` : '—' },
            { label: 'CASH-ON-CASH', uw: pctFmt(cocUW), va: pctFmt(cocVA) },
            { label: 'EXPENSE RATIO', uw: pctFmt(expRatioUW), va: pctFmt(expRatioVA) },
            { label: 'AVG RENT/UNIT', uw: fmt(avgRentPerUnit), va: unitMix.length > 0 ? fmt(unitMix.reduce((s, u, i) => { const k = u.type || u.bed_bath || `Unit ${i+1}`; return s + (u.units || 1) * (Number(vaRents[k]) || 0); }, 0) / units) : fmt(avgRentPerUnit) },
          ].map((m, i) => (
            <div key={m.label} style={{ textAlign: 'center', flex: 1, borderRight: i < 4 ? `1px solid ${B}` : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{m.label}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 1 }}>UW</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{m.uw}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 1 }}>VA</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{m.va}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── MULTI-YEAR PROJECTIONS ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 24, background: '#fff', border: `1px solid ${B}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header bar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827' }}>Projected Proforma</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: GRAY }}>Rent growth {(rentGrowthRate * 100).toFixed(1)}% · Expense growth {(expenseGrowthRate * 100).toFixed(1)}% · Vacancy {vacUWpct.toFixed(0)}%</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: GRAY, textTransform: 'uppercase' }}>Total Cash Flow</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: totalCF >= 0 ? '#10b981' : '#ef4444' }}>{proFmt(totalCF)}</div>
            </div>
            <select value={yearsToShow} onChange={e => setYearsToShow(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff' }}>
              <option value={5}>5 Years</option>
              <option value={10}>10 Years</option>
            </select>
          </div>
        </div>

        {/* Proforma table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1, borderBottom: `2px solid ${B}` }}>Line Item</th>
                {proformaYears.map(y => (
                  <th key={y.year} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 110, borderBottom: `2px solid ${B}` }}>Year {y.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              {[{ label: 'Gross Potential Income', key: 'gpi' },
                { label: 'Vacancy', key: 'vac', neg: true },
                { label: 'Loss to Lease', key: 'ltl', neg: true },
                { label: 'Effective Gross Income', key: 'egi', bold: true, bg: '#f0fdf4' },
              ].map(r => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${B}`, background: r.bg || 'transparent' }}>
                  <td style={{ padding: '8px 14px', fontWeight: r.bold ? 700 : 500, color: r.neg ? '#ef4444' : '#111827', position: 'sticky', left: 0, background: r.bg || '#fff', zIndex: 1 }}>{r.label}</td>
                  {proformaYears.map(y => {
                    const v = r.neg ? -y[r.key] : y[r.key];
                    return <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: r.bold ? 700 : 500, color: v < 0 ? '#ef4444' : '#111827' }}>{proFmt(v)}</td>;
                  })}
                </tr>
              ))}
              {/* Operating Expenses */}
              <tr style={{ borderBottom: `1px solid ${B}`, background: '#fef2f2' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700, color: '#991b1b', position: 'sticky', left: 0, background: '#fef2f2', zIndex: 1 }}>Total Operating Expenses</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>{proFmt(-y.opex)}</td>)}
              </tr>
              {/* NOI */}
              <tr style={{ borderBottom: `1px solid ${B}`, background: '#dbeafe' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700, color: '#111827', position: 'sticky', left: 0, background: '#dbeafe', zIndex: 1 }}>Net Operating Income</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{proFmt(y.noi)}</td>)}
              </tr>
              {/* Below the Line */}
              <tr style={{ background: '#f8fafc' }}><td colSpan={yearsToShow + 1} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${B}` }}>Below the Line</td></tr>
              {[{ label: 'CAPEX Reserve', key: 'capex', neg: true },
                { label: 'Debt Service', key: 'debtService', neg: true },
              ].map(r => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '8px 14px', fontWeight: 500, color: '#ef4444', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{r.label}</td>
                  {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{proFmt(-y[r.key])}</td>)}
                </tr>
              ))}
              {/* Cash Flow */}
              <tr style={{ borderBottom: `1px solid ${B}`, background: '#dbeafe' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700, color: '#111827', position: 'sticky', left: 0, background: '#dbeafe', zIndex: 1 }}>Cash Flow Before Tax</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: y.cf >= 0 ? '#111827' : '#ef4444' }}>{proFmt(y.cf)}</td>)}
              </tr>
              {/* Key Metrics */}
              <tr style={{ background: '#f8fafc' }}><td colSpan={yearsToShow + 1} style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${B}` }}>Key Metrics</td></tr>
              <tr style={{ borderBottom: `1px solid ${B}` }}>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Cap Rate</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 500 }}>{(y.capR * 100).toFixed(2)}%</td>)}
              </tr>
              <tr style={{ borderBottom: `1px solid ${B}` }}>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>DSCR</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 500 }}>{y.dscr.toFixed(2)}x</td>)}
              </tr>
              <tr style={{ borderBottom: `1px solid ${B}` }}>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>NOI / Unit</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 500 }}>{proFmt(y.noiPerUnit)}</td>)}
              </tr>
              <tr>
                <td style={{ padding: '8px 14px', fontWeight: 500, color: '#111827', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Expenses / Unit</td>
                {proformaYears.map(y => <td key={y.year} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 500 }}>{proFmt(y.expPerUnit)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cash Flow vs Principal Paydown Chart ── */}
      <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${B}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#111827' }}>Trajectory: Cash Flow vs Debt Paydown</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 20, height: 2, background: '#10b981' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Cash Flow</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 20, height: 2, background: '#0ea5e9' }} /><span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Cumulative Principal Paid</span></div>
        </div>
        {(() => {
          const W = 960, H = 220, P = 32;
          const cfS = proformaYears.map(y => y.cf);
          const ppS = principalSeries;
          const all = [...cfS, ...ppS];
          const yMin = Math.min(...all), yMax = Math.max(...all);
          const yR = yMax - yMin || 1;
          const xStep = (W - P * 2) / (yearsToShow - 1 || 1);
          const xF = i => P + i * xStep;
          const yF = v => P + (H - P * 2) - ((v - yMin) / yR) * (H - P * 2);
          const cfPts = cfS.map((v, i) => `${xF(i)},${yF(v)}`).join(' ');
          const ppPts = ppS.map((v, i) => `${xF(i)},${yF(v)}`).join(' ');
          return (
            <div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <line x1={P} y1={yF(0)} x2={W - P} y2={yF(0)} stroke="#e5e7eb" strokeWidth="1" />
                <polyline points={cfPts} fill="none" stroke="#10b981" strokeWidth="2" />
                <polyline points={ppPts} fill="none" stroke="#0ea5e9" strokeWidth="2" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 12px' }}>
                {proformaYears.map(y => <div key={y.year} style={{ fontSize: 11, color: GRAY, fontWeight: 600 }}>Yr {y.year}</div>)}
              </div>
            </div>
          );
        })()}
        {/* Summary cards */}
        <div style={{ marginTop: 10, padding: 12, background: '#f9fafb', borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Year 1 Cash Flow', val: proformaYears[0]?.cf || 0, color: (proformaYears[0]?.cf || 0) >= 0 ? '#10b981' : '#ef4444' },
            { label: `Year ${yearsToShow} Cash Flow`, val: proformaYears[yearsToShow - 1]?.cf || 0, color: '#10b981' },
            { label: 'Year 1 Principal Paid', val: principalSeries[0] || 0, color: '#0ea5e9' },
            { label: `Year ${yearsToShow} Principal Paid`, val: principalSeries[yearsToShow - 1] || 0, color: '#0ea5e9' },
          ].map(c => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: GRAY, fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.color, marginTop: 3 }}>{proFmt(c.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── DEBT SERVICE MODAL — CACTUS-STYLE MULTI-LOAN ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showDebtModal && (() => {
        // ── Reusable loan field input ──
        const LoanField = ({ label, value, onChange, suffix, hint, step, prefix }) => (
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 11, color: GRAY, fontWeight: 600 }}>{label}</label>
            <div style={{ position: 'relative' }}>
              {prefix && <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{prefix}</span>}
              <input type="number" step={step || 1} value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: `9px ${suffix ? '36px' : '12px'} 9px ${prefix ? '24px' : '12px'}`, border: `1px solid ${B}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              {suffix && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{suffix}</span>}
            </div>
            {hint && <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'block' }}>{hint}</span>}
          </div>
        );

        // ── Loan card component ──
        const LoanCard = ({ loan, isFirst }) => {
          const calc = loan.type === 'Equity Partner' ? calcEquityPartner(loan) : calcLoanPayment(loan);
          const loanAmt = calc.loanAmt;
          const isEquity = loan.type === 'Equity Partner';
          const isSeller = loan.type === 'Seller Financing';
          const loanIcon = { 'Senior Loan': '🏦', 'Mezzanine Loan': '🏛️', 'Seller Financing': '🤝', 'Second Debt': '📄', 'Equity Partner': '👥' }[loan.type] || '💰';

          return (
            <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 0, background: '#fff', flex: 1, minWidth: 340 }}>
              {/* Card header */}
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ borderLeft: '3px solid #4f46e5', paddingLeft: 8, fontWeight: 800, fontSize: 14, color: '#111827' }}>
                    {loanIcon} {loan.type}
                  </span>
                </div>
                {!isFirst && (
                  <button onClick={() => removeLoan(loan.id)}
                    style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Remove
                  </button>
                )}
                {isFirst && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowAddMenu(!showAddMenu)}
                      style={{ cursor: 'pointer', padding: '6px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#374151', background: '#fff' }}>
                      + Add Financing
                    </button>
                    {showAddMenu && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: `1px solid ${B}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10, width: 240, overflow: 'hidden' }}>
                        {addableLoanTypes.map(lt => (
                          <button key={lt.type} onClick={() => addLoan(lt.type)}
                            style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: '#fff', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${B}`, fontSize: 12 }}
                            onMouseEnter={e => e.target.style.background = '#f8fafc'}
                            onMouseLeave={e => e.target.style.background = '#fff'}>
                            <div style={{ fontWeight: 700, color: '#111827' }}>{lt.icon} {lt.type}</div>
                            <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>{lt.desc}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card body — fields */}
              <div style={{ padding: '16px 18px' }}>
                {isEquity ? (
                  /* ── Equity Partner fields ── */
                  <>
                    <p style={{ fontSize: 11, color: GRAY, margin: '0 0 12px' }}>Add complementary equity for your deal, such as a JV partner, to see its impact on cash flow projections.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <LoanField label="Partner Equity Amount" value={loan.loanDollar || 0} prefix="$"
                        onChange={v => updateLoanField(loan.id, 'loanDollar', v)} />
                      <LoanField label="Preferred Return (annual %)" value={loan.rate || 8} suffix="%"
                        onChange={v => updateLoanField(loan.id, 'rate', v)} step={0.25} />
                    </div>
                  </>
                ) : (
                  /* ── Standard debt fields ── */
                  <>
                    {!isFirst && (
                      <p style={{ fontSize: 11, color: GRAY, margin: '0 0 12px' }}>
                        {isSeller ? 'Enter seller financing details to see its impact on cash flow projections.' : `Add complementary financing for your secondary debt, such as ${loan.type.toLowerCase()}, to see its impact on cash flow projections.`}
                      </p>
                    )}
                    {/* Loan Amount row */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 11, color: GRAY, fontWeight: 600 }}>Loan Amount</label>
                        <div style={{ display: 'flex', border: `1px solid ${B}`, borderRadius: 6, overflow: 'hidden' }}>
                          {[{ mode: 'ltv', label: isFirst ? 'Purchase Price %' : 'LTC %' }, { mode: 'dollar', label: 'Amount in $' }].map(m => (
                            <button key={m.mode} onClick={() => updateLoanField(loan.id, 'loanAmtMode', m.mode)}
                              style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                                background: loan.loanAmtMode === m.mode ? '#4f46e5' : '#fff',
                                color: loan.loanAmtMode === m.mode ? '#fff' : '#6b7280' }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {loan.loanAmtMode === 'ltv' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input type="number" step={1} value={loan.ltv || 0}
                                onChange={e => updateLoanField(loan.id, 'ltv', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', padding: '9px 36px 9px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>%</span>
                            </div>
                            {isFirst && <span style={{ fontSize: 11, color: GRAY }}>of Purchase Price ✓</span>}
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '3px 8px', borderRadius: 4 }}>
                              <span style={{ fontSize: 10, color: GRAY, fontWeight: 400 }}>ƒ</span> {fmt(loanAmt)}
                            </span>
                          </div>
                        ) : (
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>$</span>
                            <input type="number" value={loan.loanDollar || 0}
                              onChange={e => updateLoanField(loan.id, 'loanDollar', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '9px 12px 9px 24px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interest Rate + Amortization + IO */}
                    <div style={{ display: 'grid', gridTemplateColumns: isSeller ? '1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <LoanField label="Interest Rate" value={loan.rate || 0} suffix="% per year"
                        onChange={v => updateLoanField(loan.id, 'rate', v)} step={0.01} />
                      <LoanField label="Amortization" value={loan.amort || 30} suffix="years"
                        onChange={v => updateLoanField(loan.id, 'amort', v)} />
                      <LoanField label="Interest Only" value={loan.io || 0} suffix="months"
                        onChange={v => updateLoanField(loan.id, 'io', v)} />
                    </div>

                    {/* Seller Financing extra fields */}
                    {isSeller && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <LoanField label="Seller Financing Start" value={loan.startMonth || 0} suffix="months"
                          onChange={v => updateLoanField(loan.id, 'startMonth', v)} hint="Months until payments begin" />
                        <LoanField label="Payment-Free Period" value={loan.paymentFree || 0} suffix="months"
                          onChange={v => updateLoanField(loan.id, 'paymentFree', v)} />
                      </div>
                    )}

                    {/* Loan Fees + Monthly Payment */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <LoanField label="Loan Fees" value={loan.fees || 0} suffix="%"
                        onChange={v => updateLoanField(loan.id, 'fees', v)} step={0.1} />
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 11, color: GRAY, fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>📋 Monthly Payment</span>
                        </label>
                        <div style={{ padding: '9px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 16, fontWeight: 800, color: '#111827', background: '#f8fafc' }}>
                          {calc.monthlyPmt > 0 ? `$${calc.monthlyPmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        };

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowDebtModal(false); setShowAddMenu(false); } }}>
            <div style={{ background: '#f3f4f6', borderRadius: 16, width: 1200, maxHeight: '94vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
              onClick={() => showAddMenu && setShowAddMenu(false)}>

              {/* ── Modal Header ── */}
              <div style={{ padding: '20px 28px', background: '#fff', borderBottom: `1px solid ${B}`, borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Debt Calculator</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: GRAY }}>Configure your financing structure — add multiple loans to build your capital stack</p>
                </div>
                <button onClick={() => setShowDebtModal(false)}
                  style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: '#f3f4f6', cursor: 'pointer', fontSize: 16, color: GRAY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* ── Loan Cards ── */}
              <div style={{ padding: '20px 28px' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {loans.map((loan, idx) => (
                    <LoanCard key={loan.id} loan={loan} isFirst={idx === 0} />
                  ))}
                </div>
              </div>

              {/* ── Financing Summary ── */}
              <div style={{ padding: '0 28px 20px' }}>
                <div style={{ borderLeft: '3px solid #4f46e5', paddingLeft: 12, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>Financing Summary</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: GRAY }}>Overview of your project's financing structure including total loan amount, down payment, and loan-to-cost ratio.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {/* Total Acquisition Cost */}
                  <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Total Acquisition Cost</span>
                      <span style={{ fontSize: 14 }}>📁</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{fmt(totalAcquisitionCost)}</div>
                    <div style={{ fontSize: 10, color: GRAY, marginTop: 4 }}>
                      Acquisition Cost: {fmt(price)}<br/>
                      Loan Fees: {fmt(totalFees)}
                    </div>
                  </div>
                  {/* Total Loan Amount */}
                  <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Total Loan Amount</span>
                      <span style={{ fontSize: 14 }}>💰</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{fmt(totalLoanAmt)}</div>
                    <div style={{ fontSize: 10, color: GRAY, marginTop: 4 }}>
                      {loans.filter(l => l.type !== 'Equity Partner').length} debt position{loans.filter(l => l.type !== 'Equity Partner').length !== 1 ? 's' : ''}
                      {totalEquityPartner > 0 && <> + {fmt(totalEquityPartner)} equity</>}
                    </div>
                  </div>
                  {/* Down Payment Amount */}
                  <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Down Payment Amount</span>
                      <span style={{ fontSize: 14 }}>📊</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{fmt(downPmt)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: downPmtPct < 30 ? '#16a34a' : '#f59e0b' }}>↑ {downPmtPct.toFixed(2)}%</span>
                    </div>
                  </div>
                  {/* Loan-to-Cost */}
                  <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Loan-to-Cost (LTC)</span>
                      <span style={{ fontSize: 14 }}>📈</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{ltcRatio.toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* ── Debt Service Breakdown ── */}
              <div style={{ padding: '0 28px 20px' }}>
                <div style={{ background: '#fff', border: `1px solid ${B}`, borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', borderBottom: `2px solid ${B}` }}>Loan</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', borderBottom: `2px solid ${B}` }}>Loan Amount</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', borderBottom: `2px solid ${B}` }}>Rate</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', borderBottom: `2px solid ${B}` }}>Monthly Pmt</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', borderBottom: `2px solid ${B}` }}>Annual DS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanCalcs.map(l => (
                        <tr key={l.id} style={{ borderBottom: `1px solid ${B}` }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{l.type}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                            {l.type === 'Equity Partner' ? `${fmt(l.calc.partnerEquity)} equity` : fmt(l.calc.loanAmt)}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{pctFmt(l.rate)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(l.calc.monthlyPmt)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{fmt(l.calc.monthlyPmt * 12)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: NAVY }}>
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: '#fff' }}>Total Debt Service</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{fmt(totalLoanAmt)}</td>
                        <td style={{ padding: '10px 14px' }}></td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{fmt(totalMonthlyPmt)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>{fmt(annualDS)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Modal Footer ── */}
              <div style={{ padding: '16px 28px', background: '#fff', borderTop: `1px solid ${B}`, borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: GRAY }}>
                  Annual Debt Service: <strong style={{ color: RED }}>{fmtNeg(annualDS)}</strong>
                  &nbsp;•&nbsp; DSCR: <strong>{annualDS > 0 ? `${(noiUW / annualDS).toFixed(2)}x` : '—'}</strong>
                  &nbsp;•&nbsp; Cash-on-Cash: <strong>{downPmt > 0 ? `${((noiUW - capexUW - annualDS) / downPmt * 100).toFixed(2)}%` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowDebtModal(false)}
                    style={{ padding: '10px 20px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveFinancing}
                    style={{ padding: '10px 24px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: '#4f46e5', cursor: 'pointer' }}>Apply Financing</button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
