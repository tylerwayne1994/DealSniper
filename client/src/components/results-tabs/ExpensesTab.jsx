import React from 'react';

export default function ExpensesTab({ scenarioData, fullCalcs, onFieldChange }) {
  const expenses = (scenarioData && scenarioData.expenses) || {};

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
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Main Expenses Section */}
        <div
          style={{
            marginBottom: '24px',
            padding: '32px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '2px solid #e5e7eb',
          }}
        >
          <div
            style={{
              marginBottom: '24px',
            }}
          >
            <h4
              style={{
                margin: '0',
                fontSize: '18px',
                fontWeight: '700',
                color: '#111827',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Primary Expenses
            </h4>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px 32px',
            }}
          >
            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Property Taxes
              </label>
              <input
                type="number"
                value={expenses.taxes || 0}
                onChange={(e) =>
                  handleChange('expenses.taxes', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Insurance
              </label>
              <input
                type="number"
                value={expenses.insurance || 0}
                onChange={(e) =>
                  handleChange('expenses.insurance', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Total Utilities
              </label>
              <input
                type="number"
                value={totalUtilities}
                onChange={(e) =>
                  handleChange('expenses.utilities', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Repairs &amp; Maintenance
              </label>
              <input
                type="number"
                value={expenses.repairs_maintenance || 0}
                onChange={(e) =>
                  handleChange(
                    'expenses.repairs_maintenance',
                    parseFloat(e.target.value) || 0,
                  )
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Property Management
              </label>
              <input
                type="range"
                min="0"
                max="100000"
                step="100"
                value={expenses.management || 0}
                onChange={(e) =>
                  handleChange('expenses.management', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background:
                    'linear-gradient(to right, #10b981 0%, #3b82f6 100%)',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              />
              <div
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '6px',
                  fontWeight: '600',
                }}
              >
                ${(expenses.management || 0).toLocaleString()}/month (
                {(((expenses.management || 0) /
                  ((((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0) / 12) || 1)) *
                  100
                ).toFixed(1)}
                % of GRI)
              </div>
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Vacancy
              </label>
              <input
                type="range"
                min="0"
                max="50000"
                step="100"
                value={expenses.vacancy || 0}
                onChange={(e) =>
                  handleChange('expenses.vacancy', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background:
                    'linear-gradient(to right, #ef4444 0%, #f59e0b 100%)',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              />
              <div
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '6px',
                  fontWeight: '600',
                }}
              >
                ${(expenses.vacancy || 0).toLocaleString()}/month (
                {(((expenses.vacancy || 0) /
                  ((((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0) / 12) || 1)) *
                  100
                ).toFixed(1)}
                % of GRI)
              </div>
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Cap Ex
              </label>
              <input
                type="range"
                min="0"
                max="100000"
                step="500"
                value={expenses.capex || 0}
                onChange={(e) =>
                  handleChange('expenses.capex', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background:
                    'linear-gradient(to right, #8b5cf6 0%, #ec4899 100%)',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
              />
              <div
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '6px',
                  fontWeight: '600',
                }}
              >
                ${(expenses.capex || 0).toLocaleString()}/month (
                {(((expenses.capex || 0) /
                  ((((scenarioData && scenarioData.pnl?.gross_potential_rent) || 0) / 12) || 1)) *
                  100
                ).toFixed(1)}
                % of GRI)
              </div>
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Admin
              </label>
              <input
                type="number"
                value={expenses.admin || 0}
                onChange={(e) =>
                  handleChange('expenses.admin', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Marketing
              </label>
              <input
                type="number"
                value={expenses.marketing || 0}
                onChange={(e) =>
                  handleChange('expenses.marketing', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>

            <div
              style={{
                padding: '4px 0 12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Other
              </label>
              <input
                type="number"
                value={expenses.other || 0}
                onChange={(e) =>
                  handleChange('expenses.other', parseFloat(e.target.value) || 0)
                }
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#111827',
                }}
              />
            </div>
          </div>
        </div>

        {/* Utility Breakdown Section */}
        {totalUtilities > 0 && (
          <div
            style={{
              marginBottom: '24px',
              borderRadius: '16px',
              border: '2px solid #e5e7eb',
              backgroundColor: 'white',
            }}
          >
            <div
              style={{
                padding: '16px 20px 8px 20px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  margin: 0,
                  color: '#111827',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Utility Breakdown
              </h4>
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                {[
                  ['water', 'Water'],
                  ['electricity', 'Electricity'],
                  ['gas', 'Gas'],
                  ['trash', 'Trash/Waste'],
                  ['sewer', 'Sewer'],
                  ['internet', 'Internet/Cable'],
                  ['landscaping', 'Landscaping/Irrigation'],
                  ['pest_control', 'Pest Control'],
                ].map(([key, label]) => (
                  <div
                    key={key}
                    style={{
                      padding: '4px 0 12px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        color: '#64748b',
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type="number"
                      value={defaultUtilities[key] || 0}
                      onChange={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        handleChange(`expenses.utility_breakdown.${key}`, newValue);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        backgroundColor: 'white',
                        color: '#1e293b',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '20px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Utility Breakdown Total
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  $
                  {(
                    (defaultUtilities.water || 0) +
                    (defaultUtilities.electricity || 0) +
                    (defaultUtilities.gas || 0) +
                    (defaultUtilities.trash || 0) +
                    (defaultUtilities.sewer || 0) +
                    (defaultUtilities.internet || 0) +
                    (defaultUtilities.landscaping || 0) +
                    (defaultUtilities.pest_control || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Total Expenses */}
        <div
          style={{
            borderRadius: '16px',
            marginBottom: '24px',
            border: '2px solid #e5e7eb',
            backgroundColor: 'white',
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
                {(
                  (expenses.taxes || 0) +
                  (expenses.insurance || 0) +
                  (expenses.utilities || 0) +
                  (expenses.repairs_maintenance || 0) +
                  (expenses.management || 0) +
                  (expenses.admin || 0) +
                  (expenses.marketing || 0) +
                  (expenses.other || 0)
                ).toLocaleString()}
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

        {/* Live Impact Preview */}
        <div
          style={{
            borderRadius: '16px',
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
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
            <span
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#111827',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Live Impact Preview
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '500',
                color: '#6b7280',
              }}
            >
              Updates as you edit
            </span>
          </div>
          <div style={{ padding: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  NOI
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  {fmt(year1.noi || 0)}
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Cap Rate
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  {pct(year1.capRate || 0)}
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Cash Flow
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: (year1.cashFlow || 0) >= 0 ? '#111827' : '#ef4444',
                  }}
                >
                  {fmt(year1.cashFlow || 0)}
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Cash-on-Cash
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  {pct(year1.cashOnCash || 0)}
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  DSCR
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  {year1.dscr != null && !Number.isNaN(year1.dscr)
                    ? `${year1.dscr.toFixed(2)}x`
                    : 'N/A'}
                </div>
              </div>

              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginBottom: '6px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Expense Ratio
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                  }}
                >
                  {pct(year1.expenseRatio || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
