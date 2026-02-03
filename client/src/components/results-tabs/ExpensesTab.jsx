import React from 'react';

export default function ExpensesTab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = (scenarioData && scenarioData.expenses) || {};
  const optimized = (scenarioData && scenarioData.value_add && scenarioData.value_add.optimized_expenses) || {};

  const COLORS = {
    blue: '#2563eb',
    blueDark: '#1d4ed8',
    text: '#111827',
    gray: '#6b7280',
    border: '#e5e7eb'
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
    if (onFieldChange) {
      onFieldChange(path, value);
    }
  };

  const copyValue = (sourcePath, targetPath, val) => {
    if (!onFieldChange) return;
    onFieldChange(targetPath, Number(val) || 0);
  };

  // Percent-based inputs are handled directly via amount edits in this UI.

  const totalUtilities = expenses.utilities || 0;
  const utilityBreakdown = expenses.utility_breakdown || {};

  const hasBreakdown = Object.keys(utilityBreakdown).length > 0;
  const defaultUtilities = hasBreakdown
    ? utilityBreakdown
    : {
        water: totalUtilities / 8,
        electricity: totalUtilities / 8,
        gas: totalUtilities / 8,
        trash: totalUtilities / 8,
        sewer: totalUtilities / 8,
        internet: totalUtilities / 8,
        landscaping: totalUtilities / 8,
        pest_control: totalUtilities / 8,
      };

  const year1 = fullCalcs?.year1 || {};

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
      water: 'Water',
      electricity: 'Electricity',
      gas: 'Gas',
      sewer: 'Sewer',
      trash: 'Trash/Waste',
      internet: 'Internet/Cable',
      landscaping: 'Landscaping',
      pest_control: 'Pest Control'
    };
    return map[key] || (key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header - match "Income & Expenses" look */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, backgroundColor: '#6366f1', borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.text }}>Income & Expenses</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#374151', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 6 }}>Seller Actuals</span>
              <span style={{ fontSize: 12, color: '#374151', background: '#eef2ff', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 6 }}>% Detailed Growth</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#374151', background: 'white', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 8 }}>Underwriting Start</span>
            <span style={{ fontSize: 12, color: '#374151', background: 'white', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: 8 }}>Value Add 1</span>
          </div>
        </div>

        {/* Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total OpEx', value: (() => {
              const annualGPR = (((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0));
              const managementAmount = ((expenses.management_pct || 0) / 100) * annualGPR || (expenses.management || 0);
              const total = (expenses.taxes||0)+(expenses.insurance||0)+(expenses.utilities||0)+(expenses.repairs_maintenance||0)+(managementAmount||0)+(expenses.admin||0)+(expenses.marketing||0)+(expenses.other||0);
              return `$${Number(total).toLocaleString()}`;
            })() },
            { label: 'Expense Ratio', value: `${(fullCalcs?.year1?.expenseRatio ?? 0).toFixed(2)}%` },
            { label: 'Utilities Total', value: `$${Number(expenses.utilities || 0).toLocaleString()}` }
          ].map((m, idx) => (
            <div key={idx} style={{ backgroundColor: 'white', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: 800, color: COLORS.text }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Compact metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Expense Ratio', value: pct(fullCalcs?.year1?.expenseRatio || 0) },
            { label: 'Total OpEx', value: fmt(fullCalcs?.year1?.totalOperatingExpenses || 0) },
            { label: 'Utilities', value: fmt(expenses.utilities || 0) },
            { label: 'NOI', value: fmt(fullCalcs?.year1?.noi || 0) }
          ].map((m, i) => (
            <div key={i} style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Income & Expenses (top section) */}
        <div style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, marginBottom: 24 }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Income & Expenses</div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.gray }}>Underwriting vs Value Add</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Line</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Underwriting Start</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Value Add 1</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const gprUW = (scenarioData?.pnl?.gross_potential_rent) || (fullCalcs?.year1?.potentialGrossIncome) || 0;
                  const gprVA = (fullCalcs?.year1?.potentialGrossIncome) || (scenarioData?.pnl?.gross_potential_rent) || 0;
                  const vacUWpct = Number(expenses.vacancy_pct || scenarioData?.pnl?.vacancy_rate_current || 0) * (expenses.vacancy_pct ? 1 : 100);
                  const vacVApct = Number(optimized.vacancy_pct || scenarioData?.pnl?.vacancy_rate_stabilized || 0) * (optimized.vacancy_pct ? 1 : 100);
                  const ltlUWpct = Number(expenses.loss_to_lease_pct || 0);
                  const ltlVApct = Number(optimized.loss_to_lease_pct || 0);
                  const vacUWamt = gprUW * (vacUWpct/100);
                  const vacVAamt = gprVA * (vacVApct/100);
                  const ltlUWamt = gprUW * (ltlUWpct/100);
                  const ltlVAamt = gprVA * (ltlVApct/100);
                  const egiUW = gprUW - vacUWamt - ltlUWamt;
                  const egiVA = gprVA - vacVAamt - ltlVAamt;
                  return [
                    { key: 'gpr', label: 'Gross Potential Rental Income', uw: gprUW, va: gprVA, type: 'display', rowBg: '#ecfdf5' },
                    { key: 'vacancy', label: 'General Vacancy', uw: vacUWpct, va: vacVApct, type: 'percent', uwAmt: vacUWamt, vaAmt: vacVAamt, rowBg: '#fee2e2' },
                    { key: 'ltl', label: 'Loss to Lease', uw: ltlUWpct, va: ltlVApct, type: 'percent', uwAmt: ltlUWamt, vaAmt: ltlVAamt, rowBg: '#fee2e2' },
                    { key: 'egi', label: 'Effective Gross Rental Income', uw: egiUW, va: egiVA, type: 'display', rowBg: '#ecfdf5' },
                  ];
                })().map((row) => (
                  <tr key={row.key} style={{ background: row.rowBg }}>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600, color: '#374151' }}>{row.label}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      {row.type === 'display' ? (
                        <span style={{ fontWeight: 700 }}>${Number(row.uw||0).toLocaleString()}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <input type="number" value={row.uw}
                            onChange={(e)=> handleChange(row.key==='vacancy' ? 'expenses.vacancy_pct' : 'expenses.loss_to_lease_pct', parseFloat(e.target.value)||0)}
                            style={{ width: 80, padding: '6px 8px', border: '1px solid #fecaca', background: '#fff', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{pct(row.uw)} </span>
                          <span style={{ fontSize: 12, background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px' }}>${Number(row.uwAmt||0).toLocaleString()}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      {row.type === 'display' ? (
                        <span style={{ fontWeight: 700 }}>${Number(row.va||0).toLocaleString()}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <input type="number" value={row.va}
                            onChange={(e)=> handleChange(row.key==='vacancy' ? 'value_add.optimized_expenses.vacancy_pct' : 'value_add.optimized_expenses.loss_to_lease_pct', parseFloat(e.target.value)||0)}
                            style={{ width: 80, padding: '6px 8px', border: '1px solid #fecaca', background: '#f9fafb', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{pct(row.va)} </span>
                          <span style={{ fontSize: 12, background: '#f1f5f9', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 6px' }}>${Number(row.vaAmt||0).toLocaleString()}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                      {row.type === 'percent' ? (
                        <button
                          title="Copy UW → VA"
                          onClick={() => copyValue(row.key==='vacancy' ? 'expenses.vacancy_pct' : 'expenses.loss_to_lease_pct', row.key==='vacancy' ? 'value_add.optimized_expenses.vacancy_pct' : 'value_add.optimized_expenses.loss_to_lease_pct', row.uw)}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: '#111827', background: '#eef2ff' }}
                        >copy</button>
                      ) : (
                        <span style={{ fontSize: 12, color: COLORS.gray }}>auto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses matrix: Underwriting vs Value Add */}
        <div style={{ background: 'white', border: `1px solid ${COLORS.border}`, borderRadius: 12, marginBottom: 24 }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Operating Expenses</div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.gray }}>Annual amounts; edit both columns</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Item</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Underwriting Start</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Value Add 1</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const keysToSkip = new Set(['utility_breakdown','management_pct','vacancy_pct','loss_to_lease_pct','capex_pct','management_rate','vacancy_rate','capex_rate']);
                  const rows = [];
                  const hasUtilSplit = Object.keys(utilityBreakdown).length > 0;
                  Object.entries(expenses).forEach(([key, val]) => {
                    if (keysToSkip.has(key) || typeof val === 'object') return;
                    if (key === 'utilities' && hasUtilSplit) {
                      Object.entries(utilityBreakdown).forEach(([uKey, uVal]) => {
                        rows.push({ key: `utility:${uKey}`, label: labelFromKey(uKey), base: Number(uVal)||0, opt: Number((optimized.utility_breakdown||{})[uKey])||Number(uVal)||0, path: `expenses.utility_breakdown.${uKey}`, optPath: `value_add.optimized_expenses.utility_breakdown.${uKey}` });
                      });
                    } else {
                      rows.push({ key, label: labelFromKey(key), base: Number(val)||0, opt: Number(optimized[key])||Number(val)||0, path: `expenses.${key}`, optPath: `value_add.optimized_expenses.${key}` });
                    }
                  });
                  // Ensure common items appear even if missing
                  ['taxes','insurance','repairs_maintenance','management','admin','administration_fees','marketing','other','bad_debt_recovery','electric_reimbursable','gas_submeter','pest_control_fees','trash_service_fee','water_sewer_revenue'].forEach((k)=>{
                    if(!rows.find(r=>r.key===k)) rows.push({ key:k, label: labelFromKey(k), base:Number(expenses[k])||0, opt:Number(optimized[k])||Number(expenses[k])||0, path:`expenses.${k}`, optPath:`value_add.optimized_expenses.${k}` });
                  });
                  return rows;
                })().map((row,i)=> {
                  const rowBg = '#f0fdf4'; // soft green like screenshot
                  const borderColor = '#dcfce7';
                  return (
                  <tr key={row.key} style={{ background: rowBg }}>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600, color: '#374151' }}>{row.label}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <input type="number" value={row.base}
                        onChange={(e)=> handleChange(row.path, parseFloat(e.target.value)||0)}
                        style={{ width: 140, padding: '6px 8px', border: `1px solid ${borderColor}`, background: '#ffffff', borderRadius: 6, fontSize: 12, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>
                      <input type="number" value={row.opt}
                        onChange={(e)=> handleChange(row.optPath, parseFloat(e.target.value)||0)}
                        style={{ width: 140, padding: '6px 8px', border: `1px solid ${borderColor}`, borderRadius: 6, fontSize: 12, textAlign: 'right', background: '#f9fafb' }} />
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <span title="Currency" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: '#111827', background: '#ffffff' }}>$</span>
                        <button
                          title="Copy UW → VA"
                          onClick={() => copyValue(row.path, row.optPath, row.base)}
                          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 22, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, color: '#111827', background: '#eef2ff' }}
                        >copy</button>
                      </div>
                    </td>
                  </tr>
                )})}
                {/* Totals */}
                {(() => {
                  const sum = (obj)=> Object.values(obj).reduce((a,b)=> a + (typeof b==='number'? b:0),0);
                  const baseTotal = sum(expenses) - (typeof expenses.utility_breakdown==='object'?0:0);
                  const optTotal = sum(optimized) - (typeof optimized.utility_breakdown==='object'?0:0);
                  return (
                    <tr style={{ background: '#d1fae5', fontWeight: 700 }}>
                      <td style={{ padding: '10px', borderTop: `1px solid ${COLORS.border}` }}>Total Operating Expenses</td>
                      <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}` }}>${Number(baseTotal||0).toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right', borderTop: `1px solid ${COLORS.border}` }}>${Number(optTotal||baseTotal||0).toLocaleString()}</td>
                      <td style={{ padding: '10px', borderTop: `1px solid ${COLORS.border}` }}></td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
        

        {/* Utility Breakdown Section */}
        {totalUtilities > 0 && (
          <div
            style={{
              marginBottom: '24px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <div
              style={{
                padding: '16px 20px 8px 20px',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{
                backgroundColor: COLORS.blue,
                color: 'white',
                padding: '10px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                display: 'inline-block'
              }}>Utility Breakdown</div>
              <p
                style={{
                  fontSize: '11px',
                  margin: '4px 0 0 0',
                  color: '#6b7280',
                }}
              >
                {hasBreakdown
                  ? 'Edit individual utility amounts below'
                  : 'Utilities are split evenly. Edit amounts to customize breakdown.'}
              </p>
            </div>
            <div style={{ padding: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: COLORS.blue, color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>Utility</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Annual Amount</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['water', 'Water'],
                    ['electricity', 'Electricity'],
                    ['gas', 'Gas'],
                    ['trash', 'Trash/Waste'],
                    ['sewer', 'Sewer'],
                    ['internet', 'Internet/Cable'],
                    ['landscaping', 'Landscaping/Irrigation'],
                    ['pest_control', 'Pest Control'],
                  ].map(([key, label]) => {
                    const val = defaultUtilities[key] || 0;
                    const monthly = val / 12;
                    return (
                      <tr key={key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>{label}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              // Update breakdown value
                              handleChange(`expenses.utility_breakdown.${key}`, newValue);
                              // Update utilities total to sum of breakdown
                              const newTotal =
                                (key === 'water' ? newValue : (defaultUtilities.water || 0)) +
                                (key === 'electricity' ? newValue : (defaultUtilities.electricity || 0)) +
                                (key === 'gas' ? newValue : (defaultUtilities.gas || 0)) +
                                (key === 'trash' ? newValue : (defaultUtilities.trash || 0)) +
                                (key === 'sewer' ? newValue : (defaultUtilities.sewer || 0)) +
                                (key === 'internet' ? newValue : (defaultUtilities.internet || 0)) +
                                (key === 'landscaping' ? newValue : (defaultUtilities.landscaping || 0)) +
                                (key === 'pest_control' ? newValue : (defaultUtilities.pest_control || 0));
                              handleChange('expenses.utilities', newTotal);
                            }}
                            style={{
                              width: '160px',
                              padding: '8px 10px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: 'white',
                              color: '#111827',
                              textAlign: 'right'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151', fontWeight: '600' }}>${Number(monthly).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr style={{ backgroundColor: '#eef2ff', borderTop: `2px solid ${COLORS.border}` }}>
                    <td style={{ padding: '12px', fontWeight: '700', color: '#111827' }}>Utility Breakdown Total</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#111827' }}>
                      ${(
                        (defaultUtilities.water || 0) +
                        (defaultUtilities.electricity || 0) +
                        (defaultUtilities.gas || 0) +
                        (defaultUtilities.trash || 0) +
                        (defaultUtilities.sewer || 0) +
                        (defaultUtilities.internet || 0) +
                        (defaultUtilities.landscaping || 0) +
                        (defaultUtilities.pest_control || 0)
                      ).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151' }}>
                      ${(
                        ((defaultUtilities.water || 0) +
                          (defaultUtilities.electricity || 0) +
                          (defaultUtilities.gas || 0) +
                          (defaultUtilities.trash || 0) +
                          (defaultUtilities.sewer || 0) +
                          (defaultUtilities.internet || 0) +
                          (defaultUtilities.landscaping || 0) +
                          (defaultUtilities.pest_control || 0)) / 12
                      ).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Total Expenses */}
        <div
          style={{
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#111827',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Total Annual Operating Expenses
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '2px',
                }}
              >
                Includes taxes, insurance, utilities, repairs, management, admin,
                marketing, and other.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#111827',
                }}
              >
                $
                {(() => {
                  const annualGPR = (((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0));
                  const managementAmount = ((expenses.management_pct || 0) / 100) * annualGPR || (expenses.management || 0);
                  return (
                    (expenses.taxes || 0) +
                    (expenses.insurance || 0) +
                    (expenses.utilities || 0) +
                    (expenses.repairs_maintenance || 0) +
                    (managementAmount || 0) +
                    (expenses.admin || 0) +
                    (expenses.marketing || 0) +
                    (expenses.other || 0)
                  ).toLocaleString();
                })()}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginTop: '2px',
                }}
              >
                Total Expenses as % of EGI:{' '}
                {pct(year1.expenseRatio || 0)}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
