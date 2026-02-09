import React, { useState } from 'react';

// ──────────────────────────────────────────────────────────────────
// ExpenseV2Tab — Cactus-style Income & Expense P&L
// Flow: GPR → Vacancy → EGI → Expense line items → Total OpEx (red)
//       → NOI (navy) → CAPEX Reserve → Debt Service (red)
//       → Net Income from Operations (navy)
// ──────────────────────────────────────────────────────────────────
export default function ExpenseV2Tab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = scenarioData?.expenses || {};
  const optimized = scenarioData?.value_add?.optimized_expenses || {};
  const pnl = scenarioData?.pnl || {};
  const unitMix = scenarioData?.unit_mix || [];
  const units = Number(scenarioData?.property?.units) || 1;
  const price = Number(scenarioData?.pricing_financing?.price) || Number(scenarioData?.pricing_financing?.purchase_price) || 0;

  // ── CAPEX state (% of EGI, user-editable) ──
  const [capexUWpct, setCapexUWpct] = useState(Number(expenses.capex_pct) || 2);
  const [capexVApct, setCapexVApct] = useState(Number(optimized.capex_pct) || 2);

  // ── Style constants ──
  const B = '#e5e7eb';                   // border
  const NAVY = '#1e2a4a';                // navy bg for NOI / Net Income rows
  const NAVY_TEXT = '#ffffff';            // white text on navy
  const EXPENSE_TOTAL_BG = '#fef2f2';    // light red bg for expense total
  const EXPENSE_TOTAL_C = '#991b1b';     // dark red text
  const DS_BG = '#fef2f2';               // debt service light red
  const DS_C = '#991b1b';                // debt service text
  const GRAY = '#6b7280';
  const INPUT_S = {
    width: 120, padding: '5px 8px', border: `1px solid ${B}`,
    borderRadius: 6, fontSize: 12, textAlign: 'right', background: '#fff',
    fontFamily: 'inherit', outline: 'none',
  };
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

  // ── Expense line items ──
  const labelMap = {
    taxes: 'Property Taxes', insurance: 'Insurance', utilities: 'Utilities',
    repairs_maintenance: 'Maintenance Related', management: 'Property Management Fees',
    payroll: 'Salaries Payroll Related', admin: 'Administrative',
    administration_fees: 'Administration Fees', marketing: 'Media Advertising',
    other: 'Other', bad_debt_recovery: 'Bad Debt Recovery',
    electric_reimbursable: 'Electric Reimbursable', gas_submeter: 'Gas Submeter',
    pest_control_fees: 'Pest Control Contract', trash_service_fee: 'Trash Service Fee',
    water_sewer_revenue: 'Water Sewer Revenue', application_fees: 'Application Fees',
    cleaning_charges_fees: 'Cleaning Charges Fees', turnover_costs: 'Turnover Costs',
    grounds: 'Grounds', professional_fees: 'Professional Fees',
    evictions_court_fees: 'Evictions Court Fees', office_supplies: 'Office Supplies Expenses',
  };
  const labelFromKey = (k) => labelMap[k] || (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const skipKeys = new Set(['utility_breakdown', 'management_pct', 'vacancy_pct', 'loss_to_lease_pct', 'capex_pct', 'management_rate', 'vacancy_rate', 'capex_rate', 'total']);
  const rows = [];
  Object.entries(expenses).forEach(([key, val]) => {
    if (skipKeys.has(key) || typeof val === 'object') return;
    rows.push({ key, label: labelFromKey(key), uw: Number(val) || 0, va: Number(optimized[key]) || Number(val) || 0, uwPath: `expenses.${key}`, vaPath: `value_add.optimized_expenses.${key}` });
  });
  // Ensure extra categories show
  const ensure = ['bad_debt_recovery','electric_reimbursable','gas_submeter','pest_control_fees','trash_service_fee','water_sewer_revenue','administration_fees','application_fees','cleaning_charges_fees','turnover_costs','grounds','professional_fees','evictions_court_fees','office_supplies'];
  ensure.forEach(k => {
    if (!rows.find(r => r.key === k)) {
      const v = Number(expenses[k]) || 0;
      rows.push({ key: k, label: labelFromKey(k), uw: v, va: Number(optimized[k]) || v, uwPath: `expenses.${k}`, vaPath: `value_add.optimized_expenses.${k}` });
    }
  });

  const totalExpUW = rows.reduce((s, r) => s + (r.uw || 0), 0);
  const totalExpVA = rows.reduce((s, r) => s + (r.va || r.uw || 0), 0);
  const expRatioUW = egiUW > 0 ? (totalExpUW / egiUW * 100) : 0;
  const expRatioVA = egiVA > 0 ? (totalExpVA / egiVA * 100) : 0;

  // NOI
  const noiUW = egiUW - totalExpUW;
  const noiVA = egiVA - totalExpVA;

  // CAPEX Reserve (% of EGI)
  const capexUW = egiUW * capexUWpct / 100;
  const capexVA = egiVA * capexVApct / 100;

  // Debt Service
  const ltv = Number(scenarioData?.financing?.ltv) || Number(fullCalcs?.financing?.ltv) || 75;
  const rate = Number(scenarioData?.financing?.interest_rate) || Number(fullCalcs?.financing?.interestRate) || 6.0;
  const amort = Number(scenarioData?.financing?.amortization_years) || Number(fullCalcs?.financing?.amortizationYears) || 30;
  const loanAmt = price * ltv / 100;
  const downPmt = price - loanAmt;
  const mr = rate / 100 / 12;
  const nPmts = amort * 12;
  const monthlyPmt = mr > 0 && loanAmt > 0 ? loanAmt * (mr * Math.pow(1 + mr, nPmts)) / (Math.pow(1 + mr, nPmts) - 1) : 0;
  const annualDS = monthlyPmt * 12;

  // Net Income from Operations (NOI - CAPEX - Debt Service)
  const netIncomeUW = noiUW - capexUW - annualDS;
  const netIncomeVA = noiVA - capexVA - annualDS;

  // Cap Rate & DSCR
  const capRateUW = price > 0 ? noiUW / price : 0;
  const capRateVA = price > 0 ? noiVA / price : 0;
  const dscrUW = annualDS > 0 ? noiUW / annualDS : 0;
  const dscrVA = annualDS > 0 ? noiVA / annualDS : 0;
  const cocUW = downPmt > 0 ? (netIncomeUW / downPmt * 100) : 0;
  const cocVA = downPmt > 0 ? (netIncomeVA / downPmt * 100) : 0;

  // ── Table cell helper ──
  const td = (content, opts = {}) => {
    const { bold, right, color, bg, border: bdr, colSpan, width, py } = opts;
    return (
      <td colSpan={colSpan} style={{
        padding: py ? `${py}px 10px` : '8px 10px',
        borderBottom: `1px solid ${bdr || B}`,
        fontWeight: bold ? 800 : 600,
        fontSize: 12, color: color || '#111827',
        textAlign: right ? 'right' : 'left',
        background: bg || 'transparent',
        whiteSpace: 'nowrap', width,
      }}>{content}</td>
    );
  };

  // ── Highlighted row helpers (Cactus-style) ──
  const navyRow = (label, uwVal, vaVal) => (
    <tr>
      {td(label, { bold: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td(fmt(uwVal), { bold: true, right: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td('', { bg: NAVY, py: 10 })}
      {td(fmt(vaVal), { bold: true, right: true, color: NAVY_TEXT, bg: NAVY, py: 10 })}
      {td('', { bg: NAVY, py: 10 })}
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
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', width: 80 }}></th>
                <th style={{ padding: '10px', textAlign: 'right', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Value Add</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: `2px solid ${B}`, fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>

              {/* ═══════ INCOME SECTION ═══════ */}
              <tr>
                {td('REVENUE', { bold: true, color: GRAY, bg: '#f8fafc', py: 6 })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
              </tr>

              {/* Per-unit rent breakdown if unit mix available */}
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
                {td('Gross Potential Rental Income', { bold: true, color: '#166534' })}
                {td(fmt(gprUW), { bold: true, right: true, color: '#166534' })}
                {td('', {})}
                {td(fmt(gprVA), { bold: true, right: true, color: '#166534' })}
                {td('', {})}
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

              {/* Effective Gross Income */}
              <tr style={{ background: '#f8fafc' }}>
                {td('Effective Gross Income', { bold: true })}
                {td(fmt(egiUW), { bold: true, right: true })}
                {td('', {})}
                {td(fmt(egiVA), { bold: true, right: true })}
                {td('', {})}
              </tr>

              {/* ═══════ EXPENSES SECTION ═══════ */}
              <tr>
                {td('OPERATING EXPENSES', { bold: true, color: GRAY, bg: '#f8fafc', py: 6 })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
                {td('', { bg: '#f8fafc' })}
              </tr>

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
                  <td style={{ padding: '6px 10px', borderBottom: `1px solid ${B}`, textAlign: 'center', fontSize: 11, color: GRAY, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    $
                  </td>
                </tr>
              ))}

              {/* ─── Total Operating Expenses — RED ─── */}
              <tr>
                {td('Total Operating Expenses', { bold: true, color: EXPENSE_TOTAL_C, bg: EXPENSE_TOTAL_BG, border: '#fca5a5' })}
                <td style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid #fca5a5`, fontWeight: 800, fontSize: 13, color: EXPENSE_TOTAL_C, background: EXPENSE_TOTAL_BG }}>
                  {fmtNeg(totalExpUW)}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', marginLeft: 6 }}>({pctFmt(expRatioUW)})</span>
                </td>
                <td style={{ padding: '10px', background: EXPENSE_TOTAL_BG, borderBottom: `1px solid #fca5a5`, textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>ⓘ</span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid #fca5a5`, fontWeight: 800, fontSize: 13, color: EXPENSE_TOTAL_C, background: EXPENSE_TOTAL_BG }}>
                  {fmtNeg(totalExpVA)}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', marginLeft: 6 }}>({pctFmt(expRatioVA)})</span>
                </td>
                <td style={{ padding: '10px', background: EXPENSE_TOTAL_BG, borderBottom: `1px solid #fca5a5`, textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>ⓘ</span>
                </td>
              </tr>

              {/* ─── NOI — NAVY ─── */}
              {navyRow('Net Operating Income', noiUW, noiVA)}

              {/* ─── CAPEX Reserve — editable % of EGI ─── */}
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

              {/* ─── Debt Service — RED ─── */}
              {annualDS > 0 && (
                <tr>
                  {td('Annual Debt Service', { bold: true, color: DS_C, bg: DS_BG, border: '#fca5a5' })}
                  {td(fmtNeg(annualDS), { bold: true, right: true, color: DS_C, bg: DS_BG, border: '#fca5a5' })}
                  {td('', { bg: DS_BG, border: '#fca5a5' })}
                  {td(fmtNeg(annualDS), { bold: true, right: true, color: DS_C, bg: DS_BG, border: '#fca5a5' })}
                  {td('', { bg: DS_BG, border: '#fca5a5' })}
                </tr>
              )}

              {/* ─── Net Income from Operations — NAVY ─── */}
              {navyRow('Net Income from Operations', netIncomeUW, netIncomeVA)}

            </tbody>
          </table>
        </div>

        {/* ── Key Metrics Row (no boxes, just a clean bottom strip) ── */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: B, borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Cap Rate', uw: pctFmt(capRateUW * 100), va: pctFmt(capRateVA * 100) },
            { label: 'DSCR', uw: dscrUW > 0 ? `${dscrUW.toFixed(2)}x` : '—', va: dscrVA > 0 ? `${dscrVA.toFixed(2)}x` : '—' },
            { label: 'Cash-on-Cash', uw: pctFmt(cocUW), va: pctFmt(cocVA) },
            { label: 'Expense Ratio', uw: pctFmt(expRatioUW), va: pctFmt(expRatioVA) },
            { label: 'Avg Rent/Unit', uw: fmt(avgRentPerUnit), va: unitMix.length > 0 ? fmt(unitMix.reduce((s, u) => s + (u.units || 1) * (u.rent_market || u.rent_current || 0), 0) / units) : fmt(avgRentPerUnit) },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{m.label}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>UW</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{m.uw}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>VA</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{m.va}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
