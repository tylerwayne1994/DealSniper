import React, { useState } from 'react';

const ExitStrategyTab = ({ scenarioData, fullCalcs }) => {
  const [selectedHoldPeriod, setSelectedHoldPeriod] = useState(5);

  // Handle null/undefined data
  if (!scenarioData && !fullCalcs) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No scenario or calculation data available. Please load or create a deal first.</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract exit data from fullCalcs
  const exitData = fullCalcs?.exit || {};
  const debtTimeline = exitData.debtTimeline || [];
  const equityTimeline = exitData.equityExitTimeline || { rows: [] };
  const equityRows = equityTimeline.rows || [];

  const exitScenarios = fullCalcs?.returns?.exitScenarios || [];
  const holdingPeriod = fullCalcs?.returns?.holdingPeriod || selectedHoldPeriod;

  // Use selected hold period if we have a scenario for it
  let selectedScenario = exitScenarios.find(s => s.exitYear === selectedHoldPeriod);
  if (!selectedScenario && exitScenarios.length > 0) {
    selectedScenario = exitScenarios.find(s => s.exitYear === holdingPeriod) || exitScenarios[0];
  }

  const projectionsArray = fullCalcs?.projections || [];
  const selectedProjection = selectedScenario
    ? projectionsArray.find(p => p.year === selectedScenario.exitYear)
    : null;

  const exitTotalEquity = fullCalcs?.financing?.totalEquityRequired || fullCalcs?.total_project_cost || 0;

  // Determine best scenario based on IRR
  const bestScenario = exitScenarios && exitScenarios.length > 0
    ? exitScenarios.reduce((best, s) => {
        if (!best) return s;
        return s.irr > best.irr ? s : best;
      }, null)
    : null;

  const DebtTimelineCard = ({ timeline }) => {
    if (!timeline || timeline.length === 0) return null;

    const first = timeline[0];
    const last = timeline[timeline.length - 1];

    return (
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '20px', 
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>
          Debt Timeline
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Original Loan Amount</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
              ${first.beginningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Balance at Exit</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
              ${last.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Principal Paid</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
              ${last.cumulativePrincipalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
        <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: '#4b5563', fontWeight: 700 }}>Year</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Beg. Balance</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>End Balance</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Principal</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Interest</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '8px', fontWeight: row.isExitYear ? 700 : 500, color: '#111827' }}>Year {row.year}{row.isExitYear ? ' (Exit)' : ''}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.beginningBalance.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.endingBalance.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>${row.principalPaid.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>${row.interestPaid.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const EquityExitTimelineCard = ({ timeline }) => {
    if (!timeline || !timeline.rows || timeline.rows.length === 0) return null;

    const lastRow = timeline.rows[timeline.rows.length - 1];
    const paybackYear = timeline.paybackYear;

    return (
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '20px', 
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>
          Equity Exit Timeline
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Initial Equity</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
              ${timeline.initialEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Equity Returned by Exit</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
              ${lastRow.equityReturned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Equity Multiple / IRR</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>
              {timeline.finalEquityMultiple.toFixed(2)}x @ {timeline.finalIRR.toFixed(1)}%
            </div>
          </div>
        </div>
        {paybackYear && (
          <div style={{ fontSize: '11px', color: '#0f766e', marginBottom: '12px' }}>
            Full return of capital achieved in year {paybackYear}.
          </div>
        )}
        <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: '#4b5563', fontWeight: 700 }}>Year</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Distributions</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Cum. Distributions</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Equity Remaining</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Equity Returned</th>
              </tr>
            </thead>
            <tbody>
              {timeline.rows.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '8px', fontWeight: row.year === timeline.exitYear ? 700 : 500, color: '#111827' }}>Year {row.year}{row.year === timeline.exitYear ? ' (Exit)' : ''}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.totalDistribution.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.cumulativeDistributions.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.equityRemaining.toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${row.equityReturned.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            backgroundColor: '#10b981', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: '700', 
            fontSize: '16px',
            marginRight: '12px'
          }}>7</div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            EXIT STRATEGY PLAYBOOK
          </h2>
        </div>

        {/* Recommended Exit Summary */}
        {bestScenario && (
          <div style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ecfeff 0%, #e0f2fe 100%)',
            border: '1px solid #7dd3fc'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Recommended Exit (Model View Only)
            </div>
            <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>
              Based on the modeled cash flows, the strongest exit is in year {bestScenario.exitYear}, targeting an
              IRR of {bestScenario.irr.toFixed(1)}% and an equity multiple of {bestScenario.equityMultiple.toFixed(2)}x.
              This corresponds to approximately ${bestScenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} of total profit
              on about ${exitTotalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })} of initial equity.
            </div>
          </div>
        )}

        {/* Hold Period Selector */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
            Select Hold Period
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[3, 5, 7, 10].map(years => (
              <button
                key={years}
                onClick={() => setSelectedHoldPeriod(years)}
                style={{
                  padding: '16px 32px',
                  backgroundColor: selectedHoldPeriod === years ? '#1e293b' : '#f1f5f9',
                  color: selectedHoldPeriod === years ? 'white' : '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {years} Years
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics at Selected Hold Period */}
        {selectedScenario && selectedProjection && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ 
                backgroundColor: '#1e293b', 
                borderRadius: '12px', 
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Projected NOI at Exit
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981' }}>
                  ${selectedProjection.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Exit year {selectedScenario.exitYear}
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: '#1e293b', 
                borderRadius: '12px', 
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Loan Balance at Exit
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>
                  ${selectedProjection.loanBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  ${(debtTimeline.length > 0
                    ? debtTimeline[debtTimeline.length - 1].cumulativePrincipalPaid
                    : 0
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })} principal paid
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: '#1e293b', 
                borderRadius: '12px', 
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Cumulative Cash Flow
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: selectedScenario.cumulativeCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
                  ${equityRows.length > 0
                    ? equityRows[Math.min(equityRows.length - 1, selectedScenario.exitYear - 1)].cumulativeDistributions.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : 0}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  over {selectedHoldPeriod} years
                </div>
              </div>
              
              <div style={{ 
                backgroundColor: '#1e293b', 
                borderRadius: '12px', 
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Total Equity Invested
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>
                  ${exitTotalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  initial investment
                </div>
              </div>
            </div>

            {/* Exit Scenarios Comparison Table */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              padding: '24px',
              marginBottom: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '20px', textTransform: 'uppercase' }}>
                Exit Scenarios - {selectedHoldPeriod} Year Hold
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {[selectedScenario].filter(Boolean).map((scenario, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '24px',
                      borderRadius: '12px',
                      backgroundColor: scenario.capLabel === 'Base Case' ? '#1e293b' : '#f8fafc',
                      border: scenario.capLabel === 'Base Case' ? 'none' : '2px solid #e5e7eb'
                    }}
                  >
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '700', 
                      color: '#10b981',
                      marginBottom: '4px',
                      textTransform: 'uppercase'
                    }}>
                      Base Case
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#94a3b8',
                      marginBottom: '16px'
                    }}>
                      Exit Year {scenario.exitYear}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Sale Price</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: scenario.capLabel === 'Base Case' ? 'white' : '#111827' }}>
                          ${(
                            projectionsArray.find(p => p.year === scenario.exitYear)?.grossSalesPrice || 0
                          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Net Proceeds</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: scenario.capLabel === 'Base Case' ? 'white' : '#111827' }}>
                          ${(
                            projectionsArray.find(p => p.year === scenario.exitYear)?.netSalesProceeds || 0
                          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      
                      <div style={{ borderTop: `1px solid ${scenario.capLabel === 'Base Case' ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`, paddingTop: '12px', marginTop: '4px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Total Profit</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: scenario.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                          ${scenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Equity Multiple</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                            {scenario.equityMultiple.toFixed(2)}x
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>IRR</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                            {scenario.irr.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Hold Periods Comparison */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '20px', textTransform: 'uppercase' }}>
                Hold Period Comparison (Modeled Exits)
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '12px', fontWeight: '700' }}>Hold Period</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Exit NOI</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Sale Price</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Total Profit</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Equity Multiple</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>IRR</th>
                  </tr>
                </thead>
                <tbody>
                  {exitScenarios.map((scenario, idx) => {
                    const isSelected = scenario.exitYear === selectedHoldPeriod;
                    const proj = projectionsArray.find(p => p.year === scenario.exitYear);
                    return (
                      <tr 
                        key={idx}
                        onClick={() => setSelectedHoldPeriod(scenario.exitYear)}
                        style={{ 
                          backgroundColor: isSelected ? '#f0fdf4' : idx % 2 === 0 ? 'white' : '#f9fafb',
                          cursor: 'pointer',
                          borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent'
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#111827' }}>{scenario.exitYear} Years</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#111827' }}>${(proj?.noi || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#111827' }}>${(proj?.grossSalesPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: scenario.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                          ${scenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{scenario.equityMultiple.toFixed(2)}x</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{scenario.irr.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Assumptions Note */}
        <div style={{ 
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>Modeled Exit Summary</div>
          <div style={{ fontSize: '11px', color: '#3b82f6', lineHeight: '1.6' }}>
            All exit metrics on this tab are computed directly from the core calc engine projections 
            (NOI path, debt service, loan balance, and reversion cash flow). No LLM math is used here.
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExitStrategyTab;
