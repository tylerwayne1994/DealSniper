import React, { useEffect, useState } from 'react';

// Syndication & waterfall view, adapted from ResultsPageV2 but self-contained
export default function WaterfallTab({ scenarioData }) {
  const [syndicationData, setSyndicationData] = useState(() => {
    const base = scenarioData?.syndication;
    if (base) return base;
    return {
      equity_classes: [
        {
          id: 'class-a',
          name: 'Class A (Preferred)',
          type: 'preferred',
          amount: 0,
          pref_rate: 8,
          promote: 0,
          fees: { acquisition: 0, asset_mgmt: 0 },
          voting: false,
        },
        {
          id: 'class-b',
          name: 'Class B (LP Common)',
          type: 'lp',
          amount: 0,
          pref_rate: 8,
          promote: 0,
          fees: {},
          voting: true,
        },
        {
          id: 'gp',
          name: 'GP / Sponsor',
          type: 'gp',
          amount: 0,
          pref_rate: 0,
          promote: 20,
          fees: { acquisition: 2, asset_mgmt: 1.5, disposition: 1 },
          voting: true,
        },
      ],
      pref_type: 'cumulative_soft',
      distribution_frequency: 'quarterly',
      waterfall_tiers: [
        {
          id: 1,
          name: 'Tier 1: Preferred Return',
          condition_type: 'pref',
          pref_rate: 8,
          split_lp: 100,
          split_gp: 0,
        },
        {
          id: 2,
          name: 'Tier 2: GP Catch-Up',
          condition_type: 'catchup',
          target_split: 70,
          split_lp: 30,
          split_gp: 70,
        },
        {
          id: 3,
          name: 'Tier 3: 70/30 Split to 13% IRR',
          condition_type: 'irr',
          irr_hurdle: 13,
          split_lp: 70,
          split_gp: 30,
        },
        {
          id: 4,
          name: 'Tier 4: 60/40 Split to 18% IRR',
          condition_type: 'irr',
          irr_hurdle: 18,
          split_lp: 60,
          split_gp: 40,
        },
        {
          id: 5,
          name: 'Tier 5: 50/50 Split Thereafter',
          condition_type: 'infinity',
          split_lp: 50,
          split_gp: 50,
        },
      ],
      fees: {
        acquisition_fee: { enabled: true, rate: 2, basis: 'purchase_price' },
        asset_mgmt_fee: { enabled: true, rate: 1.5, basis: 'equity', frequency: 'annual' },
        construction_fee: { enabled: false, rate: 3, basis: 'budget' },
        disposition_fee: { enabled: true, rate: 1, basis: 'sale_price' },
        refinance_fee: { enabled: false, rate: 0.5, basis: 'loan_proceeds' },
      },
      events: [],
      scenarios: { base: {}, conservative: {}, aggressive: {} },
    };
  });

  // If scenarioData.syndication changes, refresh local view (one-way sync)
  useEffect(() => {
    if (scenarioData?.syndication) {
      setSyndicationData(scenarioData.syndication);
    }
  }, [scenarioData?.syndication]);

  const pricing = scenarioData?.pricing_financing || {};
  const purchasePrice = pricing.price || pricing.purchase_price || 2700000;
  const totalEquityFromClasses =
    syndicationData.equity_classes?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
  const totalEquity =
    totalEquityFromClasses || pricing.equity_requirement || pricing.total_equity || 500000;

  const pnl = scenarioData?.pnl || {};
  const annualNOI =
    pnl.noi_proforma ?? pnl.noi_t12 ?? pnl.noi ?? scenarioData?.underwriting?.year1_noi ?? 142597;

  const projectHoldYears = 5;

  const calculateCapitalAccounts = () => {
    const accounts = {};
    (syndicationData.equity_classes || []).forEach((cls) => {
      const classEquity =
        cls.amount || totalEquity * (cls.type === 'gp' ? 0.05 : 0.475);
      accounts[cls.id] = [];
      let balance = classEquity;

      for (let year = 1; year <= projectHoldYears; year++) {
        const prefAccrued = balance * (cls.pref_rate / 100);
        const distributions = annualNOI * 0.6;
        const roc = Math.min(distributions * 0.3, balance);
        const prefPaid = Math.min(prefAccrued, distributions * 0.4);
        const endBalance = balance - roc;

        accounts[cls.id].push({
          year,
          begBalance: balance,
          contributed: year === 1 ? classEquity : 0,
          prefAccrued,
          rocPaid: roc,
          prefPaid,
          promote: 0,
          endBalance,
        });

        balance = endBalance;
      }
    });
    return accounts;
  };

  const capitalAccounts = calculateCapitalAccounts();

  const acquisitionFee =
    syndicationData.fees?.acquisition_fee?.enabled
      ? purchasePrice * (syndicationData.fees.acquisition_fee.rate / 100)
      : 0;
  const assetMgmtFee =
    syndicationData.fees?.asset_mgmt_fee?.enabled
      ? totalEquity * (syndicationData.fees.asset_mgmt_fee.rate / 100)
      : 0;
  const dispositionFee =
    syndicationData.fees?.disposition_fee?.enabled
      ? purchasePrice * (syndicationData.fees.disposition_fee.rate / 100) * 1.2
      : 0;

  const handleLocalChange = (updater) => {
    setSyndicationData((prev) => updater(prev));
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#8b5cf6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '16px',
              marginRight: '12px',
            }}
          >
            💰
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '700',
              color: '#111827',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            SYNDICATION & WATERFALL STRUCTURE
          </h2>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              Total Equity
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
              ${totalEquity.toLocaleString()}
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              Equity Classes
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
              {syndicationData.equity_classes?.length || 0}
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              Waterfall Tiers
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
              {syndicationData.waterfall_tiers?.length || 0}
            </div>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              Pref Type
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#111827',
                marginTop: '8px',
              }}
            >
              {(syndicationData.pref_type || '')
                .replace(/_/g, ' ')
                .toUpperCase() || 'N/A'}
            </div>
          </div>
        </div>

        {/* Equity Classes Table (read-only-ish but locally editable) */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '28px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: '#111827',
              }}
            >
              🏦 EQUITY CLASS STRUCTURE
            </h3>
            <button
              onClick={() =>
                handleLocalChange((prev) => {
                  const nextClasses = prev.equity_classes ? [...prev.equity_classes] : [];
                  nextClasses.push({
                    id: `class-${Date.now()}`,
                    name: `Class ${String.fromCharCode(65 + nextClasses.length)}`,
                    type: 'lp',
                    amount: 0,
                    pref_rate: 8,
                    promote: 0,
                    fees: {},
                    voting: true,
                  });
                  return { ...prev, equity_classes: nextClasses };
                })
              }
              style={{
                padding: '10px 20px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + Add Class
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f3f4f6',
                    borderBottom: '2px solid #e5e7eb',
                  }}
                >
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Class Name
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Capital
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    % of Total
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Pref Return
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Promote %
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Voting
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {(syndicationData.equity_classes || []).map((cls, idx) => {
                  const classAmount =
                    cls.amount || totalEquity * (cls.type === 'gp' ? 0.05 : 0.475);
                  const pctOfTotal =
                    totalEquity > 0 ? (classAmount / totalEquity) * 100 : 0;
                  return (
                    <tr key={cls.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px' }}>
                        <input
                          type="text"
                          value={cls.name}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <select
                          value={cls.type}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = { ...next[idx], type: e.target.value };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                          }}
                        >
                          <option value="preferred">Preferred</option>
                          <option value="lp">LP Common</option>
                          <option value="co-gp">Co-GP</option>
                          <option value="gp">GP/Sponsor</option>
                          <option value="mezz">Mezzanine</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={classAmount}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = {
                                ...next[idx],
                                amount: parseFloat(e.target.value) || 0,
                              };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{
                            width: '120px',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            textAlign: 'right',
                          }}
                        />
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#6b7280',
                        }}
                      >
                        {pctOfTotal.toFixed(1)}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.1"
                          value={cls.pref_rate}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = {
                                ...next[idx],
                                pref_rate: parseFloat(e.target.value) || 0,
                              };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{
                            width: '80px',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            textAlign: 'right',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="1"
                          value={cls.promote}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = {
                                ...next[idx],
                                promote: parseFloat(e.target.value) || 0,
                              };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{
                            width: '80px',
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            textAlign: 'right',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!cls.voting}
                          onChange={(e) =>
                            handleLocalChange((prev) => {
                              const next = [...(prev.equity_classes || [])];
                              next[idx] = { ...next[idx], voting: e.target.checked };
                              return { ...prev, equity_classes: next };
                            })
                          }
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {(syndicationData.equity_classes || []).length > 1 && (
                          <button
                            onClick={() =>
                              handleLocalChange((prev) => {
                                const next = (prev.equity_classes || []).filter(
                                  (_, i) => i !== idx,
                                );
                                return { ...prev, equity_classes: next };
                              })
                            }
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Simple fees summary (read-only numbers) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              Acquisition Fee
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              ${acquisitionFee.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              Annual Asset Management Fee
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              ${assetMgmtFee.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              Disposition Fee (Est.)
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              ${dispositionFee.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Capital accounts snapshot (very compact) */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '700',
              color: '#111827',
            }}
          >
            Capital Accounts Overview (5-Year Simplified)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                  }}
                >
                  <th style={{ padding: '10px', textAlign: 'left' }}>Class</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Year</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Beg. Balance</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>ROC Paid</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Pref Paid</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>End Balance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(capitalAccounts).map(([classId, rows]) => {
                  const cls = (syndicationData.equity_classes || []).find(
                    (c) => c.id === classId,
                  );
                  const label = cls?.name || classId;
                  return rows.map((row) => (
                    <tr key={`${classId}-${row.year}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 10px' }}>{label}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{row.year}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        ${row.begBalance.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        ${row.rocPaid.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        ${row.prefPaid.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        ${row.endBalance.toLocaleString()}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

