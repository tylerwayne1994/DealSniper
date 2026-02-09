import React, { useState } from 'react';

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

  // ── Financing state (editable from modal) ──
  const [debtProduct, setDebtProduct] = useState(financing.debt_product || 'Agency');
  const [ltvPct, setLtvPct] = useState(Number(financing.ltv) || 75);
  const [intRate, setIntRate] = useState(Number(financing.interest_rate) || 6.0);
  const [loanTermYrs, setLoanTermYrs] = useState(Number(financing.loan_term_years) || 10);
  const [amortYrs, setAmortYrs] = useState(Number(financing.amortization_years) || 30);
  const [ioYrs, setIoYrs] = useState(Number(financing.io_years) || 0);
  const [loanFeesPct, setLoanFeesPct] = useState(Number(financing.loan_fees_percent) || 1.5);

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
  const gprVA = Number(fullCalcs?.year1?.potentialGrossIncome) || gprUW;
  const avgRentPerUnit = units > 0 && gprUW > 0 ? gprUW / 12 / units : 0;

  // Vacancy & LTL
  const vacUWpctRaw = expenses.vacancy_pct ?? pnl.vacancy_rate_current ?? 0;
  const vacVApctRaw = optimized.vacancy_pct ?? pnl.vacancy_rate_stabilized ?? 0;
  const vacUWpct = Number(vacUWpctRaw) * (expenses.vacancy_pct ? 1 : 100);
  const vacVApct = Number(vacVApctRaw) * (optimized.vacancy_pct ? 1 : 100);
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
    { key: 'water_sewer', label: 'Water / Sewer' },
    { key: 'electric', label: 'Electric' },
    { key: 'electrical', label: 'Electric' },
    { key: 'gas', label: 'Gas' },
    { key: 'trash', label: 'Trash Removal' },
  ];
  // Build utility sub-rows from expenses data
  const utilBreakdown = expenses.utility_breakdown || {};
  const utilityRows = [];
  // Check both utility_breakdown object and top-level expense keys
  utilitySubKeys.forEach(({ key, label }) => {
    const fromBreakdown = Number(utilBreakdown[key]) || 0;
    const fromExpenses = Number(expenses[key]) || 0;
    const val = fromBreakdown || fromExpenses;
    const optVal = Number(optimized[key]) || Number(optimized.utility_breakdown?.[key]) || val;
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
  const totalUtilFromExpenses = Number(expenses.utilities) || 0;
  const totalUtilFromOptimized = Number(optimized.utilities) || totalUtilFromExpenses;
  // If breakdown doesn't account for the total, add an "Other Utilities" catch-all
  const utilDiffUW = totalUtilFromExpenses - totalUtilBreakdownUW;
  const utilDiffVA = totalUtilFromOptimized - totalUtilBreakdownVA;
  if (utilDiffUW > 50) {
    utilityRows.push({ key: 'utilities_other', label: 'Other Utilities', uw: utilDiffUW, va: utilDiffVA > 0 ? utilDiffVA : utilDiffUW, uwPath: 'expenses.utilities_other', vaPath: 'value_add.optimized_expenses.utilities_other' });
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
    rows.push({ key, label: labelFromKey(key), uw: Number(val) || 0, va: Number(optimized[key]) || Number(val) || 0, uwPath: `expenses.${key}`, vaPath: `value_add.optimized_expenses.${key}` });
  });

  // Total expenses = non-utility rows + utility breakdown rows
  const nonUtilTotalUW = rows.reduce((s, r) => s + (r.uw || 0), 0);
  const nonUtilTotalVA = rows.reduce((s, r) => s + (r.va || r.uw || 0), 0);
  const utilTotalUW = utilityRows.reduce((s, r) => s + (r.uw || 0), 0);
  const utilTotalVA = utilityRows.reduce((s, r) => s + (r.va || r.uw || 0), 0);
  const totalExpUW = nonUtilTotalUW + utilTotalUW;
  const totalExpVA = nonUtilTotalVA + utilTotalVA;
  const expRatioUW = egiUW > 0 ? (totalExpUW / egiUW * 100) : 0;
  const expRatioVA = egiVA > 0 ? (totalExpVA / egiVA * 100) : 0;

  // NOI
  const noiUW = egiUW - totalExpUW;
  const noiVA = egiVA - totalExpVA;

  // CAPEX Reserve (% of EGI)
  const capexUW = egiUW * capexUWpct / 100;
  const capexVA = egiVA * capexVApct / 100;

  // Debt Service (from editable modal state)
  const loanAmt = price * ltvPct / 100;
  const downPmt = price - loanAmt;
  const mr = intRate / 100 / 12;
  const nPmts = amortYrs * 12;
  const monthlyPmt = mr > 0 && loanAmt > 0 ? loanAmt * (mr * Math.pow(1 + mr, nPmts)) / (Math.pow(1 + mr, nPmts) - 1) : 0;
  const annualDS = monthlyPmt * 12;

  // Net Income from Operations
  const netIncomeUW = noiUW - capexUW - annualDS;
  const netIncomeVA = noiVA - capexVA - annualDS;

  // Metrics
  const capRateUW = price > 0 ? noiUW / price : 0;
  const capRateVA = price > 0 ? noiVA / price : 0;
  const dscrUW = annualDS > 0 ? noiUW / annualDS : 0;
  const dscrVA = annualDS > 0 ? noiVA / annualDS : 0;
  const cocUW = downPmt > 0 ? (netIncomeUW / downPmt * 100) : 0;
  const cocVA = downPmt > 0 ? (netIncomeVA / downPmt * 100) : 0;

  // ── Save financing changes back ──
  const saveFinancing = () => {
    handleChange('financing.debt_product', debtProduct);
    handleChange('financing.ltv', ltvPct);
    handleChange('financing.interest_rate', intRate);
    handleChange('financing.loan_term_years', loanTermYrs);
    handleChange('financing.amortization_years', amortYrs);
    handleChange('financing.io_years', ioYrs);
    handleChange('financing.loan_fees_percent', loanFeesPct);
    setShowDebtModal(false);
  };

  // ── Debt product presets ──
  const debtProducts = [
    { name: 'Agency (Fannie/Freddie)', ltv: 75, rate: 5.8, term: 10, amort: 30, io: 0, fees: 1.0 },
    { name: 'CMBS', ltv: 70, rate: 6.5, term: 10, amort: 30, io: 0, fees: 1.5 },
    { name: 'Bridge Loan', ltv: 80, rate: 8.0, term: 3, amort: 30, io: 1, fees: 2.0 },
    { name: 'HUD / FHA', ltv: 85, rate: 5.2, term: 35, amort: 35, io: 0, fees: 1.0 },
    { name: 'Bank Loan', ltv: 65, rate: 6.0, term: 5, amort: 25, io: 0, fees: 0.5 },
    { name: 'Life Insurance Co.', ltv: 65, rate: 5.5, term: 10, amort: 30, io: 0, fees: 0.5 },
    { name: 'DSCR Loan', ltv: 75, rate: 7.0, term: 5, amort: 30, io: 0, fees: 1.5 },
    { name: 'Mezzanine', ltv: 85, rate: 10.0, term: 5, amort: 0, io: 5, fees: 2.5 },
    { name: 'Seller Financing', ltv: 80, rate: 5.0, term: 10, amort: 30, io: 0, fees: 0 },
    { name: 'Custom', ltv: ltvPct, rate: intRate, term: loanTermYrs, amort: amortYrs, io: ioYrs, fees: loanFeesPct },
  ];

  const applyPreset = (preset) => {
    setDebtProduct(preset.name);
    setLtvPct(preset.ltv);
    setIntRate(preset.rate);
    setLoanTermYrs(preset.term);
    setAmortYrs(preset.amort);
    setIoYrs(preset.io);
    setLoanFeesPct(preset.fees);
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

  // Expense sub-row (indented, smaller text)
  const subRow = (row, i, bgAlt) => (
    <tr key={row.key} style={{ background: bgAlt ? '#fafafa' : '#fff' }}>
      {td(row.label, { indent: true, color: GRAY })}
      <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: bgAlt ? '#fafafa' : '#fff' }}>
        <input type="number" value={row.uw} onChange={e => handleChange(row.uwPath, parseFloat(e.target.value) || 0)} style={{ ...INPUT_S, width: 100 }} />
      </td>
      <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', background: bgAlt ? '#fafafa' : '#fff' }}>
        <button title="Copy →" onClick={() => copyVal(row.vaPath, row.uw)}
          style={{ cursor: 'pointer', padding: '2px 7px', border: `1px solid ${B}`, borderRadius: 4, fontSize: 10, color: GRAY, background: '#f8fafc' }}>→</button>
      </td>
      <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'right', background: bgAlt ? '#fafafa' : '#fff' }}>
        <input type="number" value={row.va} onChange={e => handleChange(row.vaPath, parseFloat(e.target.value) || 0)} style={{ ...INPUT_VA, width: 100 }} />
      </td>
      <td style={{ padding: '5px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', fontSize: 10, color: GRAY, background: bgAlt ? '#fafafa' : '#fff' }}>$</td>
    </tr>
  );

  return (
    <div style={{ padding: 24, backgroundColor: '#f3f4f6' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, color: GRAY }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fff', border: `1px solid ${B}`, display: 'inline-block' }} />
            Seller Actuals
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f9fafb', border: `1px solid ${B}`, display: 'inline-block' }} />
            Value Add
          </span>
        </div>

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

              {/* Per-unit rent breakdown */}
              {unitMix.length > 0 && unitMix.map((u, i) => (
                <tr key={`unit-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {td(`  ${u.type || u.bed_bath || `Unit ${i + 1}`}  —  ${u.units || 1} units × $${(u.rent_current || 0).toLocaleString()}/mo`, { color: GRAY })}
                  {td(fmt((u.units || 1) * (u.rent_current || 0) * 12), { right: true })}
                  {td('', {})}
                  {td(fmt((u.units || 1) * (u.rent_market || u.rent_current || 0) * 12), { right: true })}
                  {td('', {})}
                </tr>
              ))}

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
                <tr key={row.key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
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
              ))}

              {/* ── Utilities Section Header ── */}
              <tr>
                {td('UTILITIES BREAKDOWN', { bold: true, color: '#4338ca', bg: '#eef2ff', py: 5 })}
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
                      {debtProduct}
                    </span>
                    <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>✎ edit</span>
                  </div>
                </td>
                {td(fmtNeg(annualDS), { bold: true, right: true, color: RED })}
                {td('', {})}
                {td(fmtNeg(annualDS), { bold: true, right: true, color: RED })}
                {td('', {})}
              </tr>

              {/* ─── Net Income from Operations — NAVY ROW ─── */}
              {navyRow('Net Income from Operations', netIncomeUW, netIncomeVA)}

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
            { label: 'AVG RENT/UNIT', uw: fmt(avgRentPerUnit), va: unitMix.length > 0 ? fmt(unitMix.reduce((s, u) => s + (u.units || 1) * (u.rent_market || u.rent_current || 0), 0) / units) : fmt(avgRentPerUnit) },
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
      {/* ─── DEBT SERVICE MODAL ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showDebtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowDebtModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 680, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>

            {/* Modal Header */}
            <div style={{ padding: '20px 28px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Adjust Debt Terms</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: GRAY }}>Select a debt product or customize your financing</p>
              </div>
              <button onClick={() => setShowDebtModal(false)}
                style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: '#f3f4f6', cursor: 'pointer', fontSize: 16, color: GRAY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Debt Product Selector */}
            <div style={{ padding: '16px 28px', borderBottom: `1px solid ${B}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Debt Product</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {debtProducts.map(p => (
                  <button key={p.name}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: debtProduct === p.name ? '2px solid #4f46e5' : `1px solid ${B}`,
                      background: debtProduct === p.name ? '#eef2ff' : '#fff',
                      color: debtProduct === p.name ? '#4338ca' : '#374151',
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Financing Inputs — 3-column grid */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* LTV */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Loan-to-Value (LTV)</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" value={ltvPct} onChange={e => setLtvPct(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Typical: 65–85%</span>
                </div>
                {/* Interest Rate */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Interest Rate</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" step="0.1" value={intRate} onChange={e => setIntRate(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Current market: 5.0–8.0%</span>
                </div>
                {/* Loan Term */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Loan Term</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" value={loanTermYrs} onChange={e => setLoanTermYrs(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Typical: 5–35 years</span>
                </div>
                {/* Amortization */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Amortization</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" value={amortYrs} onChange={e => setAmortYrs(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Typical: 25–35 years</span>
                </div>
                {/* IO Period */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Interest-Only Period</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" value={ioYrs} onChange={e => setIoYrs(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Optional: 0–5 years</span>
                </div>
                {/* Loan Fees */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Loan Fees / Points</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" step="0.1" value={loanFeesPct} onChange={e => setLoanFeesPct(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'block' }}>Origination fees</span>
                </div>
              </div>

              {/* Live preview */}
              <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 10, border: `1px solid ${B}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Loan Amount</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 2 }}>{fmt(loanAmt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Monthly Payment</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 2 }}>{fmt(monthlyPmt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Annual Debt Service</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: RED, marginTop: 2 }}>{fmtNeg(annualDS)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Down Payment</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 2 }}>{fmt(downPmt)}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${B}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowDebtModal(false)}
                style={{ padding: '10px 20px', border: `1px solid ${B}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveFinancing}
                style={{ padding: '10px 24px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: '#4f46e5', cursor: 'pointer' }}>Apply Changes</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
