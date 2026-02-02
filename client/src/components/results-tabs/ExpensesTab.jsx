import React from 'react';

export default function ExpensesTab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = (scenarioData && scenarioData.expenses) || {};

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

  const handlePercentChange = (pctPath, amountPath, pctVal, base) => {
    const pctNum = Number(pctVal) || 0;
    const amount = (pctNum / 100) * (base || 0);
    handleChange(pctPath, pctNum);
    handleChange(amountPath, amount);
  };

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

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: `linear-gradient(135deg, ${COLORS.blueDark} 0%, ${COLORS.blue} 100%)`, 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '700', 
              fontSize: '16px',
              marginRight: '12px'
            }}>EXP</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: COLORS.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OPERATING EXPENSES
              </h2>
              <p style={{ fontSize: '12px', color: COLORS.gray, margin: '4px 0 0' }}>
                Editable line items and live impact preview
              </p>
            </div>
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

        {/* Live Impact Preview (top, compact) */}
        <div
          style={{
            borderRadius: '10px',
            backgroundColor: 'white',
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            marginBottom: '16px'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: COLORS.text,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Live Impact Preview
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '500',
                color: COLORS.gray,
              }}
            >
              Updates as you edit
            </span>
          </div>
          <div style={{ padding: '14px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
              {[
                { label: 'NOI', value: fmt(fullCalcs?.year1?.noi || 0) },
                { label: 'Cap Rate', value: pct(fullCalcs?.year1?.capRate || 0) },
                { label: 'Cash Flow', value: fmt(fullCalcs?.year1?.cashFlow || 0), color: (fullCalcs?.year1?.cashFlow || 0) >= 0 ? COLORS.text : '#ef4444' },
                { label: 'Cash-on-Cash', value: pct(fullCalcs?.year1?.cashOnCash || 0) },
                { label: 'DSCR', value: (fullCalcs?.year1?.dscr != null && !Number.isNaN(fullCalcs?.year1?.dscr)) ? `${fullCalcs.year1.dscr.toFixed(2)}x` : 'N/A' },
                { label: 'Expense Ratio', value: pct(fullCalcs?.year1?.expenseRatio || 0) }
              ].map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '10px',
                    textAlign: 'center',
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: COLORS.gray,
                      marginBottom: '4px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      color: m.color || COLORS.text,
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Expenses Section */}
        <div
          style={{
            marginBottom: '24px',
            padding: '28px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{
              backgroundColor: COLORS.blue,
              color: 'white',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>Primary Expenses</div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Annual amounts unless noted</span>
          </div>
          <div
            style={{
              overflowX: 'auto'
            }}
          >
            {(() => {
              const annualGPR = (((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0));
              const rows = [
                { key: 'taxes', label: 'Property Taxes', type: 'amount' },
                { key: 'insurance', label: 'Insurance', type: 'amount' },
                { key: 'utilities', label: 'Total Utilities', type: 'amount' },
                { key: 'repairs_maintenance', label: 'Repairs & Maintenance', type: 'amount' },
                { key: 'management', label: 'Property Management', type: 'percent', pctKey: 'management_pct' },
                { key: 'vacancy', label: 'Vacancy', type: 'percent', pctKey: 'vacancy_pct' },
                { key: 'capex', label: 'CapEx', type: 'percent', pctKey: 'capex_pct' },
                { key: 'admin', label: 'Admin', type: 'amount' },
                { key: 'marketing', label: 'Marketing', type: 'amount' },
                { key: 'other', label: 'Other', type: 'amount' }
              ];
              const managementAmount = ((expenses.management_pct || 0) / 100) * annualGPR || (expenses.management || 0);
              return (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: COLORS.blue, color: 'white', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>Item</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Percent</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Annual Amount</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>Monthly</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>% of GRI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const { key, label, type, pctKey } = row;
                      const rawVal = (key === 'utilities') ? totalUtilities : (expenses[key] || 0);
                      const percentVal = pctKey ? (expenses[pctKey] || 0) : 0;
                      const val = type === 'percent' 
                        ? ((percentVal || 0) / 100) * annualGPR || rawVal
                        : rawVal;
                      const monthly = val / 12;
                      const pctOfGri = annualGPR > 0 ? (val / annualGPR) * 100 : 0;
                      return (
                        <tr key={key} style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: (['utilities','management','vacancy','capex'].includes(key) ? '#f9fafb' : 'white') }}>
                          <td style={{ padding: '12px', fontWeight: '600', color: '#374151' }}>{label}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {type === 'percent' ? (
                              <>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={percentVal}
                                  onChange={(e) => handlePercentChange(`expenses.${pctKey}`, `expenses.${key}`, parseFloat(e.target.value) || 0, annualGPR)}
                                  style={{
                                    width: '120px',
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
                                <span style={{ marginLeft: '6px', color: COLORS.gray, fontWeight: 700 }}>%</span>
                              </>
                            ) : (
                              <span style={{ color: '#6b7280' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {type === 'percent' ? (
                              <span style={{ fontWeight: '600', color: '#111827' }}>${Number(val || 0).toLocaleString()}</span>
                            ) : (
                              <input
                                type="number"
                                value={val || 0}
                                onChange={(e) => handleChange(`expenses.${key}`, parseFloat(e.target.value) || 0)}
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
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#374151', fontWeight: '600' }}>${Number(monthly || 0).toLocaleString()}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{pct(pctOfGri || 0)}</td>
                        </tr>
                      );
                    })}
                    {/* Totals Row */}
                    <tr style={{ backgroundColor: '#eef2ff', borderTop: `2px solid ${COLORS.border}` }}>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#111827' }}>Total Operating Expenses</td>
                      {(() => {
                        const total =
                          (expenses.taxes || 0) +
                          (expenses.insurance || 0) +
                          (expenses.utilities || 0) +
                          (expenses.repairs_maintenance || 0) +
                          (managementAmount || 0) +
                          (expenses.admin || 0) +
                          (expenses.marketing || 0) +
                          (expenses.other || 0);
                        const monthlyTotal = total / 12;
                        const pctTotal = annualGPR > 0 ? (total / annualGPR) * 100 : 0;
                        return (
                          <>
                            <td style={{ padding: '12px', textAlign: 'right' }}></td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: COLORS.text }}>${Number(total).toLocaleString()}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>${Number(monthlyTotal).toLocaleString()}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#374151' }}>{pct(pctTotal || 0)}</td>
                          </>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
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
