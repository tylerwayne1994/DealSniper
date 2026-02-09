import React from 'react';

export default function ExpenseV2Tab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = scenarioData?.expenses || {};
  const optimized = scenarioData?.value_add?.optimized_expenses || {};
  const pnl = scenarioData?.pnl || {};

  const COLORS = {
    rowA: '#ffffff',
    rowB: '#f9fafb',
    inputBorder: '#e5e7eb',
    headerChip: '#eef2ff',
    text: '#111827',
    gray: '#6b7280',
    border: '#e5e7eb',
    tableHeader: '#f8fafc'
  };

  const fmt = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (Number.isNaN(n)) return 'N/A';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const pct = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (Number.isNaN(n)) return 'N/A';
    return `${n.toFixed(2)}%`;
  };

  const handleChange = (path, value) => {
    if (onFieldChange) onFieldChange(path, value);
  };

  const copyValue = (sourcePath, targetPath, val) => {
    if (!onFieldChange) return;
    onFieldChange(targetPath, Number(val) || 0);
  };

  const gprUW = pnl.gross_potential_rent || fullCalcs?.year1?.potentialGrossIncome || 0;
  const gprVA = fullCalcs?.year1?.potentialGrossIncome || pnl.gross_potential_rent || 0;

  // Vacancy and LTL (percent based)
  const vacUWpctSrc = expenses.vacancy_pct ?? pnl.vacancy_rate_current ?? 0;
  const vacVApctSrc = optimized.vacancy_pct ?? pnl.vacancy_rate_stabilized ?? 0;
  const vacUWpct = Number(vacUWpctSrc) * (expenses.vacancy_pct ? 1 : 100);
  const vacVApct = Number(vacVApctSrc) * (optimized.vacancy_pct ? 1 : 100);
  const ltlUWpct = Number(expenses.loss_to_lease_pct || 0);
  const ltlVApct = Number(optimized.loss_to_lease_pct || 0);

  const vacUWamt = gprUW * (vacUWpct / 100);
  const vacVAamt = gprVA * (vacVApct / 100);
  const ltlUWamt = gprUW * (ltlUWpct / 100);
  const ltlVAamt = gprVA * (ltlVApct / 100);

  const egiUW = gprUW - vacUWamt - ltlUWamt;
  const egiVA = gprVA - vacVAamt - ltlVAamt;

  const labelFromKey = (key) => {
    const map = {
      taxes: 'Property Taxes',
      insurance: 'Insurance',
      utilities: 'Utilities',
      repairs_maintenance: 'Repairs & Maintenance',
      management: 'Property Management',
      payroll: 'On-site Payroll',
      admin: 'Administrative',
      administration_fees: 'Administration Fees',
      marketing: 'Marketing',
      other: 'Other',
      bad_debt_recovery: 'Bad Debt Recovery',
      electric_reimbursable: 'Electric Reimbursable',
      gas_submeter: 'Gas Submeter',
      pest_control_fees: 'Pest Control Fees',
      trash_service_fee: 'Trash Service Fee',
      water_sewer_revenue: 'Water Sewer Revenue',
      application_fees: 'Application Fees',
      cleaning_charges_fees: 'Cleaning Charges Fees'
    };
    return map[key] || (key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const rows = (() => {
    const keysToSkip = new Set(['utility_breakdown','management_pct','vacancy_pct','loss_to_lease_pct','capex_pct','management_rate','vacancy_rate','capex_rate']);
    const list = [];
    Object.entries(expenses).forEach(([key, val]) => {
      if (keysToSkip.has(key) || typeof val === 'object') return;
      list.push({ key, label: labelFromKey(key), uw: Number(val) || 0, va: Number(optimized[key]) || Number(val) || 0, uwPath: `expenses.${key}`, vaPath: `value_add.optimized_expenses.${key}` });
    });
    const ensure = ['bad_debt_recovery','electric_reimbursable','gas_submeter','pest_control_fees','trash_service_fee','water_sewer_revenue','administration_fees','application_fees','cleaning_charges_fees'];
    ensure.forEach((k) => {
      if (!list.find(r => r.key === k)) list.push({ key: k, label: labelFromKey(k), uw: Number(expenses[k]) || 0, va: Number(optimized[k]) || Number(expenses[k]) || 0, uwPath: `expenses.${k}`, vaPath: `value_add.optimized_expenses.${k}` });
    });
    return list;
  })();

  const totalUW = rows.reduce((sum, r) => sum + (r.uw || 0), 0);
  const totalVA = rows.reduce((sum, r) => sum + (r.va || r.uw || 0), 0);

  // ─── Bottom Line derivations ───
  const units = scenarioData?.property?.units || 1;
  const price = Number(scenarioData?.pricing_financing?.price) || Number(scenarioData?.pricing_financing?.purchase_price) || 0;

  // NOI: UW = EGI - Total Expenses, VA = EGI(VA) - Total Expenses(VA)
  const noiUW = egiUW - totalUW;
  const noiVA = egiVA - totalVA;

  // Cap Rate
  const capRateUW = price > 0 ? (noiUW / price) : 0;
  const capRateVA = price > 0 ? (noiVA / price) : 0;

  // Debt Service
  const ltv = Number(scenarioData?.financing?.ltv) || Number(fullCalcs?.financing?.ltv) || 75;
  const interestRate = Number(scenarioData?.financing?.interest_rate) || Number(fullCalcs?.financing?.interestRate) || 6.0;
  const amortYears = Number(scenarioData?.financing?.amortization_years) || Number(fullCalcs?.financing?.amortizationYears) || 30;
  const loanAmount = price * ltv / 100;
  const downPayment = price - loanAmount;
  const monthlyRate = interestRate / 100 / 12;
  const totalPmts = amortYears * 12;
  const monthlyPayment = monthlyRate > 0 && loanAmount > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPmts)) / (Math.pow(1 + monthlyRate, totalPmts) - 1)
    : 0;
  const annualDS = monthlyPayment * 12;
  const dscrUW = annualDS > 0 && noiUW > 0 ? noiUW / annualDS : 0;
  const dscrVA = annualDS > 0 && noiVA > 0 ? noiVA / annualDS : 0;
  const cashFlowUW = noiUW - annualDS;
  const cashFlowVA = noiVA - annualDS;
  const cocUW = downPayment > 0 ? (cashFlowUW / downPayment) * 100 : 0;
  const cocVA = downPayment > 0 ? (cashFlowVA / downPayment) * 100 : 0;
  const expRatioUW = egiUW > 0 ? (totalUW / egiUW) * 100 : 0;
  const expRatioVA = egiVA > 0 ? (totalVA / egiVA) * 100 : 0;

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Header chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#374151', background: COLORS.headerChip, border: `1px solid ${COLORS.border}`, padding: '6px 10px', borderRadius: 6 }}>Seller Actuals</span>
          <span style={{ fontSize: 12, color: '#374151', background: COLORS.headerChip, border: `1px solid ${COLORS.border}`, padding: '6px 10px', borderRadius: 6 }}>Value Add Plans</span>
          <span style={{ fontSize: 12, color: '#374151', background: COLORS.headerChip, border: `1px solid ${COLORS.border}`, padding: '6px 10px', borderRadius: 6 }}>% Detailed Growth</span>
        </div>

        {/* Income & Expenses table */}
        <div style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Income & Expenses</div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.gray }}>Underwriting Start vs Value Add 1</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: COLORS.tableHeader }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Income & Expenses</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Annual (UW)</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Monthly (UW)</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Annual (VA)</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Monthly (VA)</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* GPR */}
                <tr style={{ background: COLORS.rowA }}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Gross Potential Rental Income</td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(gprUW)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 600, color: COLORS.gray }}>{fmt(gprUW / 12)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(gprVA)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 600, color: COLORS.gray }}>{fmt(gprVA / 12)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}><span style={{ fontSize: 12, color: COLORS.gray }}>auto</span></td>
                </tr>

                {/* Vacancy */}
                <tr style={{ background: COLORS.rowB }}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>General Vacancy</td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={vacUWpct}
                        onChange={(e)=> handleChange('expenses.vacancy_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#fff', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(vacUWpct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(vacUWamt)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(vacUWamt / 12)}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={vacVApct}
                        onChange={(e)=> handleChange('value_add.optimized_expenses.vacancy_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#f9fafb', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(vacVApct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(vacVAamt)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(vacVAamt / 12)}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                    <button title="Copy UW → VA" onClick={() => copyValue('expenses.vacancy_pct','value_add.optimized_expenses.vacancy_pct',vacUWpct)}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: COLORS.text, background: COLORS.headerChip }}>copy</button>
                  </td>
                </tr>

                {/* Loss to Lease */}
                <tr style={{ background: COLORS.rowA }}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Loss to Lease</td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={ltlUWpct}
                        onChange={(e)=> handleChange('expenses.loss_to_lease_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#fff', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(ltlUWpct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(ltlUWamt)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(ltlUWamt / 12)}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={ltlVApct}
                        onChange={(e)=> handleChange('value_add.optimized_expenses.loss_to_lease_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#f9fafb', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(ltlVApct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(ltlVAamt)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(ltlVAamt / 12)}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                    <button title="Copy UW → VA" onClick={() => copyValue('expenses.loss_to_lease_pct','value_add.optimized_expenses.loss_to_lease_pct',ltlUWpct)}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: COLORS.text, background: COLORS.headerChip }}>copy</button>
                  </td>
                </tr>

                {/* EGRI */}
                <tr style={{ background: COLORS.rowB }}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Effective Gross Rental Income</td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(egiUW)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 600, color: COLORS.gray }}>{fmt(egiUW / 12)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(egiVA)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 600, color: COLORS.gray }}>{fmt(egiVA / 12)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}><span style={{ fontSize: 12, color: COLORS.gray }}>auto</span></td>
                </tr>

                {/* Expense rows */}
                {rows.map((row, i) => (
                  <tr key={row.key} style={{ background: i % 2 === 0 ? COLORS.rowA : COLORS.rowB }}>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <input type="number" value={row.uw}
                        onChange={(e)=> handleChange(row.uwPath, parseFloat(e.target.value)||0)}
                        style={{ width: 140, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#ffffff', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(row.uw / 12)}</span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <input type="number" value={row.va}
                        onChange={(e)=> handleChange(row.vaPath, parseFloat(e.target.value)||0)}
                        style={{ width: 140, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, borderRadius: 6, fontSize: 12, textAlign: 'right', background: '#f9fafb' }} />
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{fmt(row.va / 12)}</span>
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <span title="Currency" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: COLORS.text, background: '#ffffff' }}>$</span>
                        <button title="Copy UW → VA" onClick={() => copyValue(row.uwPath, row.vaPath, row.uw)}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: COLORS.text, background: COLORS.headerChip }}>copy</button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ background: COLORS.tableHeader }}>
                  <td style={{ padding: '10px', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800 }}>Total Operating Expenses</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800 }}>{fmt(totalUW)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 700, color: COLORS.gray }}>{fmt(totalUW / 12)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800 }}>{fmt(totalVA)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 700, color: COLORS.gray }}>{fmt(totalVA / 12)}</td>
                  <td style={{ padding: '10px', borderTop: `2px solid ${COLORS.border}` }}></td>
                </tr>

                {/* NOI Row */}
                <tr style={{ background: '#f0fdf4' }}>
                  <td style={{ padding: '10px', borderTop: `2px solid #10b981`, fontWeight: 800, color: '#059669' }}>Net Operating Income</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid #10b981`, fontWeight: 800, color: '#059669' }}>{fmt(noiUW)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid #10b981`, fontWeight: 700, color: '#6b7280' }}>{fmt(noiUW / 12)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid #10b981`, fontWeight: 800, color: '#059669' }}>{fmt(noiVA)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid #10b981`, fontWeight: 700, color: '#6b7280' }}>{fmt(noiVA / 12)}</td>
                  <td style={{ padding: '10px', borderTop: `2px solid #10b981` }}></td>
                </tr>

                {/* Debt Service Row */}
                {annualDS > 0 && (
                  <tr style={{ background: '#eff6ff' }}>
                    <td style={{ padding: '10px', borderTop: `1px solid ${COLORS.border}`, fontWeight: 700, color: '#1e40af' }}>Annual Debt Service</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}`, fontWeight: 700, color: '#dc2626' }}>({fmt(annualDS)})</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}`, fontWeight: 600, color: '#6b7280' }}>({fmt(monthlyPayment)})</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}`, fontWeight: 700, color: '#dc2626' }}>({fmt(annualDS)})</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}`, fontWeight: 600, color: '#6b7280' }}>({fmt(monthlyPayment)})</td>
                    <td style={{ padding: '10px', borderTop: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{ltv}% LTV</span>
                    </td>
                  </tr>
                )}

                {/* Cash Flow Row */}
                {annualDS > 0 && (
                  <tr style={{ background: cashFlowUW > 0 ? '#f0fdf4' : '#fef2f2' }}>
                    <td style={{ padding: '10px', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800, color: cashFlowUW > 0 ? '#059669' : '#dc2626' }}>Cash Flow (Pre-Tax)</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800, color: cashFlowUW > 0 ? '#059669' : '#dc2626' }}>{fmt(cashFlowUW)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 700, color: '#6b7280' }}>{fmt(cashFlowUW / 12)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800, color: cashFlowVA > 0 ? '#059669' : '#dc2626' }}>{fmt(cashFlowVA)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 700, color: '#6b7280' }}>{fmt(cashFlowVA / 12)}</td>
                    <td style={{ padding: '10px', borderTop: `2px solid ${COLORS.border}` }}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ BOTTOM LINE SUMMARY CARDS ═══════ */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {/* NOI Card */}
          <div style={{ padding: 18, background: '#fff', border: noiUW > 0 ? '2px solid #10b981' : '1px solid #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Net Operating Income</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>UW</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: noiUW > 0 ? '#059669' : '#d1d5db' }}>{fmt(noiUW)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>VA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: noiVA > 0 ? '#059669' : '#d1d5db' }}>{fmt(noiVA)}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{fmt(noiUW / 12)}/mo • {units > 1 ? `${fmt(Math.round(noiUW / units))}/unit` : ''}</div>
          </div>

          {/* Cap Rate Card */}
          <div style={{ padding: 18, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Cap Rate</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>UW</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{capRateUW > 0 ? pct(capRateUW * 100) : 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>VA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: capRateVA > capRateUW ? '#059669' : '#111827' }}>{capRateVA > 0 ? pct(capRateVA * 100) : 'N/A'}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>NOI ÷ Price{price > 0 ? ` (${fmt(price)})` : ''}</div>
          </div>

          {/* DSCR Card */}
          <div style={{ padding: 18, background: dscrUW >= 1.25 ? '#f0fdf4' : dscrUW > 0 ? '#fffbeb' : '#fff', border: dscrUW >= 1.25 ? '2px solid #10b981' : dscrUW > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>DSCR</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>UW</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: dscrUW >= 1.25 ? '#059669' : dscrUW > 0 ? '#d97706' : '#d1d5db' }}>{dscrUW > 0 ? `${dscrUW.toFixed(2)}x` : 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>VA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: dscrVA >= 1.25 ? '#059669' : dscrVA > 0 ? '#d97706' : '#d1d5db' }}>{dscrVA > 0 ? `${dscrVA.toFixed(2)}x` : 'N/A'}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{dscrUW >= 1.25 ? '✅ Passes 1.25x' : dscrUW > 0 ? '⚠️ Below 1.25x' : 'Needs financing'}</div>
          </div>

          {/* Cash Flow Card */}
          <div style={{ padding: 18, background: cashFlowUW > 0 ? '#f0fdf4' : cashFlowUW < 0 ? '#fef2f2' : '#fff', border: cashFlowUW > 0 ? '2px solid #10b981' : cashFlowUW < 0 ? '2px solid #ef4444' : '1px solid #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Annual Cash Flow</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>UW</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: cashFlowUW > 0 ? '#059669' : cashFlowUW < 0 ? '#dc2626' : '#d1d5db' }}>{annualDS > 0 ? fmt(cashFlowUW) : 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>VA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: cashFlowVA > 0 ? '#059669' : cashFlowVA < 0 ? '#dc2626' : '#d1d5db' }}>{annualDS > 0 ? fmt(cashFlowVA) : 'N/A'}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              {cocUW !== 0 ? `CoC: ${cocUW.toFixed(2)}%` : ''}{cocVA !== 0 && cocVA !== cocUW ? ` → ${cocVA.toFixed(2)}%` : ''}
            </div>
          </div>
        </div>

        {/* Expense Ratio Bar */}
        {expRatioUW > 0 && (
          <div style={{ marginTop: 14, padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <span>Expense Ratio</span>
              <span>UW: {expRatioUW.toFixed(1)}% {expRatioVA !== expRatioUW ? `→ VA: ${expRatioVA.toFixed(1)}%` : ''}</span>
            </div>
            <div style={{ position: 'relative', height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', height: '100%', width: `${Math.min(expRatioUW, 100)}%`, background: expRatioUW > 60 ? '#ef4444' : expRatioUW > 50 ? '#f59e0b' : '#10b981', borderRadius: 5, transition: 'width 0.3s', opacity: 0.5 }} />
              <div style={{ position: 'absolute', height: '100%', width: `${Math.min(expRatioVA, 100)}%`, background: expRatioVA > 60 ? '#ef4444' : expRatioVA > 50 ? '#f59e0b' : '#10b981', borderRadius: 5, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
              <span>Efficient (&lt;45%)</span>
              <span>Avg (45-55%)</span>
              <span>High (&gt;55%)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
