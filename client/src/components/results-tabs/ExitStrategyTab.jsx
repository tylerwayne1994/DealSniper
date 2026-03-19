/**
 * ExitStrategyTab.jsx — Comprehensive Exit Strategy Playbook
 *
 * Sections:
 *   1. Optimal Exit Banner
 *   2. Exit Assumptions (editable cap adj, selling costs, hold period)
 *   3. Hold Period Quick-Select
 *   4. Key Metrics Dashboard (4 cards)
 *   5. Exit Scenario Detail Card + Disposition Waterfall
 *   6. Cap Rate Sensitivity Matrix
 *   7. Cash Flow Waterfall (annual CF + reversion)
 *   8. Hold Period Comparison Table (10 years)
 *   9. Debt Timeline
 *  10. Equity Exit Timeline
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, Calendar, DollarSign, BarChart3, Wallet,
  Target, Shield, ArrowUpRight, Edit3,
  ChevronDown, ChevronUp, Zap, AlertTriangle, Check
} from 'lucide-react';

// ─── Helpers ───
const fmt = (v) => {
  if (v == null || isNaN(v)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
};
const pct = (v, d = 1) => {
  if (v == null || isNaN(v)) return '0%';
  return `${v.toFixed(d)}%`;
};
const fmtCompact = (v) => {
  if (v == null || isNaN(v)) return '$0';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

// ─── Style tokens ───
const B = '#e5e7eb', AC = '#4f46e5', LB = '#6b7280', VL = '#111827';
const SC = {
  backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
  marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
};

const profitC = v => v >= 0 ? '#10b981' : '#ef4444';
const irrColor = v => v >= 20 ? '#10b981' : v >= 12 ? '#059669' : v >= 7 ? '#f59e0b' : '#ef4444';

export default function ExitStrategyTab({ scenarioData, fullCalcs, onFieldChange }) {
  // ─── State ───
  const [selectedHoldPeriod, setSelectedHoldPeriod] = useState(
    fullCalcs?.returns?.holdingPeriod || scenarioData?.exit_details?.holdYrs || 5
  );
  const [showSensitivity, setShowSensitivity] = useState(true);
  const [showDebtTimeline, setShowDebtTimeline] = useState(true);
  const [showEquityTimeline, setShowEquityTimeline] = useState(true);
  const [editingAssumptions, setEditingAssumptions] = useState(false);

  // ─── Exit assumptions from scenarioData (editable) ───
  const exitDetails = useMemo(() => scenarioData?.exit_details || {}, [scenarioData?.exit_details]);
  const closingPct = exitDetails.closingPct ?? 2;
  const brokerPct = exitDetails.brokerPct ?? 2;
  const capAdj = exitDetails.capAdj ?? 0;
  const strategy = exitDetails.strategy ?? 'cap_rate';
  const growthPct = exitDetails.growthPct ?? 3;

  const updateExitField = useCallback((field, value) => {
    if (onFieldChange) {
      const updated = { ...exitDetails, [field]: value };
      onFieldChange('exit_details', updated);
    }
  }, [onFieldChange, exitDetails]);

  // ─── Extract calculation data ───
  const exitData = fullCalcs?.exit || {};
  const debtTimeline = exitData.debtTimeline || [];
  const equityTimeline = exitData.equityExitTimeline || { rows: [] };
  const equityRows = equityTimeline.rows || [];
  const exitScenarios = useMemo(() => fullCalcs?.returns?.exitScenarios || [], [fullCalcs?.returns?.exitScenarios]);
  const projectionsArray = useMemo(() => fullCalcs?.projections || [], [fullCalcs?.projections]);
  const exitTotalEquity = fullCalcs?.financing?.totalEquityRequired || fullCalcs?.total_project_cost || 0;
  const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
  const goingInCap = fullCalcs?.year1?.capRate || (purchasePrice > 0 && fullCalcs?.year1?.noi > 0 ? (fullCalcs.year1.noi / purchasePrice) * 100 : 5.5);
  const exitCapRate = fullCalcs?.returns?.exitCapRate || (goingInCap + capAdj / 100);

  // ─── Selected scenario ───
  const selectedScenario = useMemo(() => {
    let s = exitScenarios.find(s => s.exitYear === selectedHoldPeriod);
    if (!s && exitScenarios.length > 0) {
      s = exitScenarios[0];
    }
    return s;
  }, [exitScenarios, selectedHoldPeriod]);

  const selectedProjection = useMemo(() => {
    return selectedScenario ? projectionsArray.find(p => p.year === selectedScenario.exitYear) : null;
  }, [selectedScenario, projectionsArray]);

  // ─── Best scenario ───
  const bestScenario = useMemo(() => {
    if (!exitScenarios.length) return null;
    return exitScenarios.reduce((best, s) => (!best || s.irr > best.irr) ? s : best, null);
  }, [exitScenarios]);

  // ─── Sensitivity matrix: cap rate vs hold period ───
  const sensitivityMatrix = useMemo(() => {
    if (!projectionsArray.length || exitTotalEquity <= 0) return [];
    const capRates = [-100, -50, 0, 50, 100].map(bps => ({
      bps,
      label: `${bps >= 0 ? '+' : ''}${bps} bps`,
      capRate: (exitCapRate * 100 + bps) / 100,
    }));
    const years = [3, 5, 7, 10].filter(y => y <= projectionsArray.length);
    return capRates.map(cr => ({
      ...cr,
      scenarios: years.map(yr => {
        const proj = projectionsArray.find(p => p.year === yr);
        if (!proj) return { year: yr, salePrice: 0, totalProfit: 0, irr: 0, em: 0 };
        const exitNOI = proj.noi || 0;
        const salePrice = cr.capRate > 0 ? exitNOI / cr.capRate : 0;
        const sellingCosts = salePrice * ((closingPct + brokerPct) / 100);
        const netProceeds = salePrice - sellingCosts;
        const loanPayoff = proj.loanBalance || 0;
        const reversionCF = netProceeds - loanPayoff;
        let cumCF = 0;
        for (let i = 0; i < yr && i < projectionsArray.length; i++) {
          cumCF += projectionsArray[i].cashFlowAfterFinancing || 0;
        }
        const totalReturn = cumCF + reversionCF;
        const em = exitTotalEquity > 0 ? totalReturn / exitTotalEquity : 0;
        const irr = yr > 0 && em > 0 ? (Math.pow(em, 1 / yr) - 1) * 100 : 0;
        return { year: yr, salePrice, irr, em };
      }),
    }));
  }, [projectionsArray, exitCapRate, exitTotalEquity, closingPct, brokerPct]);

  // ─── Annual cash flow data for waterfall visual ───
  const cashFlowBars = useMemo(() => {
    return projectionsArray.slice(0, Math.min(selectedHoldPeriod, 10)).map((p, i) => {
      const isExit = (i + 1) === selectedHoldPeriod;
      const reversion = isExit ? (p.reversionCashFlow || 0) : 0;
      return {
        year: p.year,
        operatingCF: p.cashFlowAfterFinancing || 0,
        reversion,
        total: (p.cashFlowAfterFinancing || 0) + reversion,
        isExit,
      };
    });
  }, [projectionsArray, selectedHoldPeriod]);

  // ─── Empty state ───
  if (!scenarioData && !fullCalcs) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: LB }}>
        <p>No scenario data available. Upload a deal to see exit analysis.</p>
      </div>
    );
  }

  if (!exitScenarios.length && !projectionsArray.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: LB }}>
        <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>Exit scenarios could not be calculated.</p>
        <p style={{ fontSize: 12 }}>Ensure purchase price, NOI, and financing data are filled in.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>

      {/* ═══ 1. OPTIMAL EXIT BANNER ═══ */}
      {bestScenario && (
        <div style={{
          ...SC,
          border: `2px solid ${AC}`,
          background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: AC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="white" />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: AC, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Optimal Exit Strategy
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: VL }}>
                Year {bestScenario.exitYear} Exit — {pct(bestScenario.irr)} IRR
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Equity Multiple', value: `${bestScenario.equityMultiple.toFixed(2)}x`, color: AC },
                { label: 'Total Profit', value: fmt(bestScenario.totalProfit), color: '#10b981' },
                { label: 'Total Return', value: fmt(bestScenario.totalCashReturned), color: VL },
                { label: 'Initial Equity', value: fmt(exitTotalEquity), color: LB },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: LB, textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. EXIT ASSUMPTIONS (Editable) ═══ */}
      <div style={SC}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingAssumptions ? 16 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={20} color={AC} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exit Assumptions</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!editingAssumptions && (
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: LB }}>Exit Cap: <strong style={{ color: VL }}>{pct(exitCapRate * 100)}</strong></span>
                <span style={{ color: LB }}>Selling Costs: <strong style={{ color: VL }}>{closingPct + brokerPct}%</strong></span>
                <span style={{ color: LB }}>Hold: <strong style={{ color: VL }}>{selectedHoldPeriod}yr</strong></span>
                <span style={{ color: LB }}>Strategy: <strong style={{ color: VL }}>{strategy === 'cap_rate' ? 'Cap Rate' : 'Growth'}</strong></span>
              </div>
            )}
            <button
              onClick={() => setEditingAssumptions(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${B}`,
                background: editingAssumptions ? AC : '#fff',
                color: editingAssumptions ? '#fff' : LB,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Edit3 size={12} /> {editingAssumptions ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>

        {editingAssumptions && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Exit Strategy</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: 'cap_rate', label: 'Cap Rate' }, { key: 'value_growth', label: 'Growth' }].map(s => (
                  <button key={s.key} onClick={() => updateExitField('strategy', s.key)}
                    style={{
                      flex: 1, padding: '8px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: strategy === s.key ? `2px solid ${AC}` : `1px solid ${B}`,
                      background: strategy === s.key ? `${AC}10` : '#fff',
                      color: strategy === s.key ? AC : LB,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {strategy === 'cap_rate' ? (
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Cap Rate Adj (bps)</label>
                <input type="number" step="10" value={capAdj} onChange={e => updateExitField('capAdj', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 13, outline: 'none' }} />
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>+/- from market cap at exit</div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Annual Growth %</label>
                <input type="number" step="0.5" value={growthPct} onChange={e => updateExitField('growthPct', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 13, outline: 'none' }} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Closing Costs %</label>
              <input type="number" step="0.5" value={closingPct} onChange={e => updateExitField('closingPct', Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Broker Fee %</label>
              <input type="number" step="0.5" value={brokerPct} onChange={e => updateExitField('brokerPct', Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Hold Period (yrs)</label>
              <input type="number" min="1" max="10" step="1" value={exitDetails.holdYrs ?? selectedHoldPeriod}
                onChange={e => { const v = Number(e.target.value); updateExitField('holdYrs', v); setSelectedHoldPeriod(v); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 13, outline: 'none' }} />
            </div>
          </div>
        )}
      </div>

      {/* ═══ 3. HOLD PERIOD QUICK-SELECT ═══ */}
      <div style={SC}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Calendar size={20} color={AC} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hold Period</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 5, 7, 10].map(years => {
            const scenario = exitScenarios.find(s => s.exitYear === years);
            const isBest = bestScenario && years === bestScenario.exitYear;
            const isSelected = selectedHoldPeriod === years;
            return (
              <button
                key={years}
                onClick={() => setSelectedHoldPeriod(years)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: isSelected ? AC : '#f9fafb',
                  color: isSelected ? 'white' : LB,
                  border: isSelected ? 'none' : isBest ? `2px solid ${AC}` : `1px solid ${B}`,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800 }}>{years}</div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Year{years > 1 ? 's' : ''}</div>
                {scenario && (
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: isSelected ? 'rgba(255,255,255,0.8)' : irrColor(scenario.irr) }}>
                    {pct(scenario.irr)} IRR
                  </div>
                )}
                {isBest && !isSelected && (
                  <div style={{ position: 'absolute', top: -6, right: -6, background: AC, color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 99 }}>
                    BEST
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 4. KEY METRICS DASHBOARD ═══ */}
      {selectedScenario && selectedProjection && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Sale Price', value: fmt(selectedProjection.grossSalesPrice || 0), sub: `Year ${selectedScenario.exitYear} · ${pct(exitCapRate * 100)} cap`, icon: DollarSign, bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
            { label: 'Net Proceeds', value: fmt(selectedProjection.netSalesProceeds || 0), sub: `After ${closingPct + brokerPct}% selling costs`, icon: ArrowUpRight, bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
            { label: 'Loan Balance', value: fmt(selectedProjection.loanBalance || 0), sub: `${fmt(debtTimeline.length > 0 ? debtTimeline[Math.min(debtTimeline.length - 1, selectedHoldPeriod - 1)]?.cumulativePrincipalPaid || 0 : 0)} principal paid`, icon: Shield, bg: '#faf5ff', border: '#d8b4fe', color: '#7c3aed' },
            { label: 'Net to Equity', value: fmt(selectedProjection.reversionCashFlow || 0), sub: 'After loan payoff', icon: Wallet, bg: (selectedProjection.reversionCashFlow || 0) >= 0 ? '#ecfdf5' : '#fef2f2', border: (selectedProjection.reversionCashFlow || 0) >= 0 ? '#a7f3d0' : '#fecaca', color: (selectedProjection.reversionCashFlow || 0) >= 0 ? '#047857' : '#b91c1c' },
          ].map(m => (
            <div key={m.label} style={{ padding: '18px 16px', borderRadius: 14, backgroundColor: m.bg, border: `1px solid ${m.border}`, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <m.icon size={14} color={m.color} />
                <span style={{ fontSize: 10, fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 10, color: LB, marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ 5. EXIT SCENARIO DETAIL CARD ═══ */}
      {selectedScenario && selectedProjection && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={20} color={AC} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exit Scenario — {selectedHoldPeriod} Year Hold
            </h3>
          </div>

          {/* Return metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total Profit', value: fmt(selectedScenario.totalProfit), color: profitC(selectedScenario.totalProfit), large: true },
              { label: 'IRR', value: pct(selectedScenario.irr), color: irrColor(selectedScenario.irr) },
              { label: 'Equity Multiple', value: `${selectedScenario.equityMultiple.toFixed(2)}x`, color: AC },
              { label: 'Projected Exit NOI', value: fmt(selectedProjection.noi), color: VL },
              { label: 'Avg Annual CF', value: fmt((selectedScenario.cumulativeCashFlow || 0) / selectedScenario.exitYear), color: profitC(selectedScenario.cumulativeCashFlow || 0) },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 12, border: `1px solid ${B}`, background: '#f9fafb' }}>
                <div style={{ fontSize: 10, color: LB, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: m.large ? 24 : 20, fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Disposition waterfall breakdown */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '16px 20px', border: `1px solid ${B}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', marginBottom: 12 }}>Disposition Waterfall</div>
            {[
              { label: 'Gross Sale Price', value: selectedProjection.grossSalesPrice || 0, color: VL, indent: 0 },
              { label: `Less: Selling Costs (${closingPct + brokerPct}%)`, value: -(selectedProjection.sellingCosts || 0), color: '#ef4444', indent: 1 },
              { label: 'Net Sales Proceeds', value: selectedProjection.netSalesProceeds || 0, color: VL, indent: 0, bold: true, border: true },
              { label: 'Less: Loan Payoff', value: -(selectedProjection.loanPayoff || selectedProjection.loanBalance || 0), color: '#ef4444', indent: 1 },
              { label: 'Reversion Cash Flow', value: selectedProjection.reversionCashFlow || 0, color: profitC(selectedProjection.reversionCashFlow || 0), indent: 0, bold: true, border: true },
              { label: `Plus: Cumulative Operating CF (${selectedHoldPeriod}yr)`, value: selectedScenario.cumulativeCashFlow || 0, color: '#10b981', indent: 1 },
              { label: 'Total Return to Equity', value: selectedScenario.totalCashReturned || 0, color: AC, indent: 0, bold: true, border: true },
              { label: 'Less: Initial Equity', value: -exitTotalEquity, color: '#ef4444', indent: 1 },
              { label: 'Total Profit', value: selectedScenario.totalProfit || 0, color: profitC(selectedScenario.totalProfit || 0), indent: 0, bold: true, border: true, large: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${row.large ? 10 : 6}px ${row.indent ? 12 : 0}px`,
                borderTop: row.border ? `2px solid ${B}` : 'none',
                marginTop: row.border ? 6 : 0,
                paddingTop: row.border ? 10 : undefined,
              }}>
                <span style={{ fontSize: row.large ? 13 : 12, fontWeight: row.bold ? 700 : 400, color: row.bold ? VL : LB, paddingLeft: row.indent * 16 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: row.large ? 16 : 13, fontWeight: row.bold ? 800 : 600, color: row.color }}>
                  {fmt(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 6. CAP RATE SENSITIVITY MATRIX ═══ */}
      {sensitivityMatrix.length > 0 && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSensitivity ? 16 : 0, cursor: 'pointer' }} onClick={() => setShowSensitivity(p => !p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={20} color={AC} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exit Cap Rate Sensitivity</h3>
            </div>
            {showSensitivity ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
          </div>

          {showSensitivity && (
            <>
              <div style={{ fontSize: 12, color: LB, marginBottom: 14 }}>
                How IRR and equity multiple change with different exit cap rates and hold periods
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: `2px solid ${B}` }}>Exit Cap Δ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: `2px solid ${B}` }}>Exit Cap</th>
                      {[3, 5, 7, 10].filter(y => y <= projectionsArray.length).map(yr => (
                        <th key={yr} colSpan={2} style={{
                          padding: '10px 14px', textAlign: 'center', fontWeight: 700,
                          color: yr === selectedHoldPeriod ? AC : '#374151',
                          borderBottom: `2px solid ${yr === selectedHoldPeriod ? AC : B}`,
                          backgroundColor: yr === selectedHoldPeriod ? `${AC}08` : '#f9fafb',
                        }}>
                          {yr}-Year {yr === selectedHoldPeriod ? '★' : ''}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '6px 14px', borderBottom: `1px solid ${B}` }} />
                      <th style={{ padding: '6px 14px', borderBottom: `1px solid ${B}` }} />
                      {[3, 5, 7, 10].filter(y => y <= projectionsArray.length).map(yr => (
                        <React.Fragment key={yr}>
                          <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: LB, borderBottom: `1px solid ${B}` }}>IRR</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: LB, borderBottom: `1px solid ${B}` }}>EM</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityMatrix.map((row, ri) => {
                      const isBase = row.bps === 0;
                      return (
                        <tr key={ri} style={{ backgroundColor: isBase ? `${AC}06` : 'white', borderLeft: isBase ? `3px solid ${AC}` : '3px solid transparent' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: isBase ? AC : VL, borderBottom: `1px solid ${B}` }}>
                            {row.label} {isBase && '(Base)'}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: VL, borderBottom: `1px solid ${B}` }}>
                            {pct(row.capRate * 100)}
                          </td>
                          {row.scenarios.map(s => (
                            <React.Fragment key={s.year}>
                              <td style={{
                                padding: '10px 8px', textAlign: 'center', fontWeight: 700,
                                color: irrColor(s.irr), borderBottom: `1px solid ${B}`,
                                backgroundColor: s.year === selectedHoldPeriod && isBase ? `${AC}10` : undefined,
                              }}>
                                {pct(s.irr)}
                              </td>
                              <td style={{
                                padding: '10px 8px', textAlign: 'center', fontWeight: 600,
                                color: s.em >= 2 ? '#10b981' : s.em >= 1.5 ? '#059669' : VL,
                                borderBottom: `1px solid ${B}`,
                                backgroundColor: s.year === selectedHoldPeriod && isBase ? `${AC}10` : undefined,
                              }}>
                                {s.em.toFixed(2)}x
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af' }}>
                ★ = Selected hold period. IRR colors: <span style={{ color: '#10b981', fontWeight: 700 }}>green</span> ≥20%, <span style={{ color: '#059669', fontWeight: 700 }}>teal</span> ≥12%, <span style={{ color: '#f59e0b', fontWeight: 700 }}>yellow</span> ≥7%, <span style={{ color: '#ef4444', fontWeight: 700 }}>red</span> &lt;7%.
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 7. CASH FLOW WATERFALL VISUAL ═══ */}
      {cashFlowBars.length > 0 && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash Flow Waterfall</h3>
          </div>
          <div style={{ fontSize: 12, color: LB, marginBottom: 16 }}>
            Annual operating cash flow plus exit reversion proceeds
          </div>

          {(() => {
            const maxVal = Math.max(...cashFlowBars.map(b => b.total), 1);
            const minVal = Math.min(...cashFlowBars.map(b => Math.min(b.operatingCF, 0)), 0);
            const range = maxVal - minVal || 1;
            const chartHeight = 200;
            return (
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: chartHeight, padding: '0 4px' }}>
                {cashFlowBars.map(bar => {
                  const opH = Math.max(0, bar.operatingCF / range * chartHeight);
                  const revH = Math.max(0, bar.reversion / range * chartHeight);
                  return (
                    <div key={bar.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: bar.total >= 0 ? '#10b981' : '#ef4444', marginBottom: 4, whiteSpace: 'nowrap' }}>
                        {fmtCompact(bar.total)}
                      </div>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {bar.reversion > 0 && (
                          <div style={{
                            width: '80%', height: revH, background: 'linear-gradient(180deg, #f59e0b, #d97706)', borderRadius: '4px 4px 0 0',
                          }} title={`Reversion: ${fmt(bar.reversion)}`} />
                        )}
                        {bar.operatingCF > 0 && (
                          <div style={{
                            width: '80%', height: opH, background: AC,
                            borderRadius: bar.reversion > 0 ? 0 : '4px 4px 0 0',
                          }} title={`Operating CF: ${fmt(bar.operatingCF)}`} />
                        )}
                        {bar.operatingCF < 0 && (
                          <div style={{
                            width: '80%', height: Math.max(0, -bar.operatingCF / range * chartHeight), background: '#ef4444', borderRadius: '0 0 4px 4px',
                          }} title={`Operating CF: ${fmt(bar.operatingCF)}`} />
                        )}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: bar.isExit ? 700 : 500, color: bar.isExit ? AC : LB, marginTop: 6 }}>
                        Yr {bar.year}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: AC }} />
              <span style={{ color: LB }}>Operating Cash Flow</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#f59e0b' }} />
              <span style={{ color: LB }}>Exit Reversion</span>
            </div>
          </div>

          {/* Cumulative tracker */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            {(() => {
              let cumCF = 0;
              cashFlowBars.forEach(b => { cumCF += b.total; });
              return [
                { label: 'Cumulative Cash Flow', value: fmt(cumCF), color: profitC(cumCF) },
                { label: 'Initial Equity', value: fmt(exitTotalEquity), color: VL },
                { label: 'Return on Equity', value: exitTotalEquity > 0 ? pct(cumCF / exitTotalEquity * 100) : '0%', color: AC },
                { label: 'Payback Period', value: (() => {
                  let running = -exitTotalEquity;
                  for (let i = 0; i < cashFlowBars.length; i++) {
                    running += cashFlowBars[i].total;
                    if (running >= 0) return `${cashFlowBars[i].year} years`;
                  }
                  return `>${selectedHoldPeriod} years`;
                })(), color: VL },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, border: `1px solid ${B}`, background: '#f9fafb' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: LB, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ═══ 8. HOLD PERIOD COMPARISON TABLE ═══ */}
      {exitScenarios.length > 0 && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <BarChart3 size={20} color={AC} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hold Period Comparison</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['Hold Period', 'Exit NOI', 'Sale Price', 'Net Proceeds', 'Total Profit', 'Equity Multiple', 'IRR'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#374151', borderBottom: `2px solid ${B}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exitScenarios.map((scenario, idx) => {
                  const isSelected = scenario.exitYear === selectedHoldPeriod;
                  const isBest = bestScenario && scenario.exitYear === bestScenario.exitYear;
                  const proj = projectionsArray.find(p => p.year === scenario.exitYear);
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedHoldPeriod(scenario.exitYear)}
                      style={{
                        cursor: 'pointer',
                        borderLeft: isSelected ? `3px solid ${AC}` : '3px solid transparent',
                        backgroundColor: isSelected ? `${AC}08` : 'white',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${B}`, fontWeight: 700, color: VL }}>
                        {scenario.exitYear} Year{scenario.exitYear > 1 ? 's' : ''}
                        {isBest && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: AC, backgroundColor: `${AC}15`, padding: '2px 8px', borderRadius: 999 }}>★ BEST</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: VL, fontWeight: 600 }}>{fmt(proj?.noi || 0)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: VL, fontWeight: 600 }}>{fmt(proj?.grossSalesPrice || 0)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: VL, fontWeight: 600 }}>{fmt(proj?.netSalesProceeds || 0)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 700, color: profitC(scenario.totalProfit) }}>{fmt(scenario.totalProfit)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 700, color: AC }}>{scenario.equityMultiple.toFixed(2)}x</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 700, color: irrColor(scenario.irr) }}>{pct(scenario.irr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ 9. DEBT TIMELINE ═══ */}
      {debtTimeline.length > 0 && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDebtTimeline ? 16 : 0, cursor: 'pointer' }} onClick={() => setShowDebtTimeline(p => !p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={20} color={AC} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Debt Timeline</h3>
            </div>
            {showDebtTimeline ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
          </div>
          {showDebtTimeline && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Original Loan', value: fmt(debtTimeline[0]?.beginningBalance || 0), color: VL },
                  { label: 'Balance at Exit', value: fmt(debtTimeline[Math.min(debtTimeline.length - 1, selectedHoldPeriod - 1)]?.endingBalance || 0), color: VL },
                  { label: 'Total Principal Paid', value: fmt(debtTimeline[Math.min(debtTimeline.length - 1, selectedHoldPeriod - 1)]?.cumulativePrincipalPaid || 0), color: '#10b981' },
                  { label: 'Total Interest Paid', value: fmt(debtTimeline.slice(0, selectedHoldPeriod).reduce((s, r) => s + (r.interestPaid || 0), 0)), color: '#ef4444' },
                ].map(m => (
                  <div key={m.label} style={{ padding: 14, borderRadius: 12, border: `1px solid ${B}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: LB, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Loan paydown progress bar */}
              {(() => {
                const orig = debtTimeline[0]?.beginningBalance || 1;
                const remaining = debtTimeline[Math.min(debtTimeline.length - 1, selectedHoldPeriod - 1)]?.endingBalance || 0;
                const paidPct = ((orig - remaining) / orig * 100);
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: LB, marginBottom: 4 }}>
                      <span>Loan Paydown Progress</span>
                      <span style={{ fontWeight: 700, color: VL }}>{paidPct.toFixed(1)}% paid</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${paidPct}%`, background: `linear-gradient(90deg, ${AC}, #10b981)`, borderRadius: 5, transition: 'width .3s' }} />
                    </div>
                  </div>
                );
              })()}

              <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                      {['Year', 'Beg. Balance', 'Principal', 'Interest', 'Debt Service', 'End Balance'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#374151', borderBottom: `2px solid ${B}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {debtTimeline.map((row, idx) => {
                      const isExit = row.year === selectedHoldPeriod;
                      return (
                        <tr key={idx} style={{
                          borderLeft: isExit ? `3px solid ${AC}` : row.isExitYear ? `3px solid #f59e0b` : '3px solid transparent',
                          backgroundColor: isExit ? `${AC}06` : 'white',
                        }}>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${B}`, fontWeight: isExit ? 700 : 500, color: VL }}>
                            Year {row.year}{isExit ? ' (Selected)' : row.isExitYear ? ' (Exit)' : ''}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: VL }}>{fmt(row.beginningBalance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 600, color: '#10b981' }}>{fmt(row.principalPaid)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 600, color: '#ef4444' }}>{fmt(row.interestPaid)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 600, color: VL }}>{fmt(row.annualDebtService)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 600, color: VL }}>{fmt(row.endingBalance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 10. EQUITY EXIT TIMELINE ═══ */}
      {equityRows.length > 0 && (
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showEquityTimeline ? 16 : 0, cursor: 'pointer' }} onClick={() => setShowEquityTimeline(p => !p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={20} color="#22c55e" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Equity Exit Timeline</h3>
            </div>
            {showEquityTimeline ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
          </div>
          {showEquityTimeline && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Initial Equity', value: fmt(equityTimeline.initialEquity), color: VL },
                  { label: 'Total Returned', value: fmt(equityRows[equityRows.length - 1]?.equityReturned || 0), color: '#10b981' },
                  { label: 'Equity Multiple', value: `${equityTimeline.finalEquityMultiple?.toFixed(2) || '0.00'}x`, color: AC },
                  { label: 'IRR', value: pct(equityTimeline.finalIRR || 0), color: irrColor(equityTimeline.finalIRR || 0) },
                ].map(m => (
                  <div key={m.label} style={{ padding: 14, borderRadius: 12, border: `1px solid ${B}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: LB, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {equityTimeline.paybackYear && (
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginBottom: 14, padding: '8px 14px', backgroundColor: '#f0fdf4', borderRadius: 8, display: 'inline-block' }}>
                  <Check size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                  Full return of capital in Year {equityTimeline.paybackYear}
                </div>
              )}

              <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                      {['Year', 'Annual CF', 'Exit Proceeds', 'Total Distribution', 'Cumulative', 'Equity Remaining', '% Returned'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, color: '#374151', borderBottom: `2px solid ${B}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equityRows.map((row, idx) => {
                      const isExit = row.year === equityTimeline.exitYear;
                      return (
                        <tr key={idx} style={{
                          borderLeft: isExit ? '3px solid #22c55e' : '3px solid transparent',
                          backgroundColor: isExit ? '#f0fdf410' : 'white',
                        }}>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${B}`, fontWeight: isExit ? 700 : 500, color: VL }}>
                            Year {row.year}{isExit ? ' (Exit)' : ''}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: (row.annualDistribution || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(row.annualDistribution || 0)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: '#f59e0b', fontWeight: 600 }}>{fmt(row.exitDistribution || 0)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 700, color: VL }}>{fmt(row.totalDistribution)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 700, color: AC }}>{fmt(row.cumulativeDistributions)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, color: LB }}>{fmt(row.equityRemaining)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `1px solid ${B}`, fontWeight: 600, color: (row.equityReturnPct || 0) >= 100 ? '#10b981' : VL }}>{pct(row.equityReturnPct || 0, 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ NOTE ═══ */}
      <div style={{
        padding: '14px 18px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginTop: 4,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>Analysis Notes</div>
        <div style={{ fontSize: 11, color: '#3b82f6', lineHeight: 1.6 }}>
          All exit metrics are computed from the core calculation engine projections (NOI growth path, debt service, loan amortization, and reversion cash flow).
          The sensitivity matrix shows how returns change at different exit cap rates across hold periods. Exit cap rate adjustments and selling costs can be edited above.
        </div>
      </div>
    </div>
  );
}
