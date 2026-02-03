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
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Underwriting Start</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Value Add 1</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* GPR */}
                <tr style={{ background: COLORS.rowA }}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600 }}>Gross Potential Rental Income</td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(gprUW)}</span></td>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(gprVA)}</span></td>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={vacVApct}
                        onChange={(e)=> handleChange('value_add.optimized_expenses.vacancy_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#f9fafb', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(vacVApct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(vacVAamt)}</span>
                    </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <input type="number" value={ltlVApct}
                        onChange={(e)=> handleChange('value_add.optimized_expenses.loss_to_lease_pct', parseFloat(e.target.value)||0)}
                        style={{ width: 80, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, background: '#f9fafb', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                      <span style={{ fontSize: 12, color: COLORS.gray }}>{pct(ltlVApct)}</span>
                      <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>{fmt(ltlVAamt)}</span>
                    </div>
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
                  <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}><span style={{ fontWeight: 700 }}>{fmt(egiVA)}</span></td>
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
                      <input type="number" value={row.va}
                        onChange={(e)=> handleChange(row.vaPath, parseFloat(e.target.value)||0)}
                        style={{ width: 140, padding: '6px 8px', border: `1px solid ${COLORS.inputBorder}`, borderRadius: 6, fontSize: 12, textAlign: 'right', background: '#f9fafb' }} />
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
                  <td style={{ padding: '10px', textAlign: 'right', borderTop: `2px solid ${COLORS.border}`, fontWeight: 800 }}>{fmt(totalVA)}</td>
                  <td style={{ padding: '10px', borderTop: `2px solid ${COLORS.border}` }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
