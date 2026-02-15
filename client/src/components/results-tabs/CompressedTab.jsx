import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
         ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function CompressedTab({
  scenarioData,
  calculations,
  fullCalcs,
  purchasePrice,
  capRate,
  dscr,
  noiT12,
  annualDebtService,
  selectedHoldPeriod,
  setSelectedHoldPeriod,
  onFieldChange,
  onTabChange,
}) {
  const navigate = useNavigate();

  // Local state
  const [includeSale, setIncludeSale] = useState(true);
  const [displayMode, setDisplayMode] = useState('monetary');
  const [profitView, setProfitView] = useState('table');
  const [capStructYear, setCapStructYear] = useState(0);

  // ── Theme ──
  const B = '#e5e7eb', AC = '#4f46e5', LB = '#6b7280', VL = '#111827';
  const card = {
    backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
    marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
  };

  // ── Formatters ──
  const fmt = (v) => {
    if (v == null || isNaN(v)) return '$0';
    const sign = v < 0 ? '-' : '';
    return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
  };
  const pct = (v) => {
    if (v == null || isNaN(v)) return '0.00%';
    return `${Number(v).toFixed(2)}%`;
  };

  // ── Data sources (same sources as Exit Strategy & other tabs) ──
  const projections = useMemo(() => fullCalcs?.projections || [], [fullCalcs]);
  const debtTimeline = useMemo(() => fullCalcs?.exit?.debtTimeline || [], [fullCalcs]);
  const exitScenarios = fullCalcs?.returns?.exitScenarios || [];
  const selectedScenario = exitScenarios.find(s => s.exitYear === selectedHoldPeriod) || exitScenarios[0] || {};

  // Metrics — leveredIRR is already *100 (e.g. 9.10 = 9.10%)
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || 0;
  const loanAmount = fullCalcs?.financing?.loanAmount || 0;
  const irrVal = fullCalcs?.returns?.leveredIRR || 0;  // Already a percentage number
  const equityMultiple = fullCalcs?.returns?.leveredEquityMultiple || selectedScenario.equityMultiple || 0;
  const cocVal = fullCalcs?.year1?.cashOnCash || 0;     // Already a percentage number
  const totalProfit = selectedScenario.totalProfit || 0;
  const startingNOI = fullCalcs?.year1?.noi || noiT12 || 0;
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
  const acquisitionCost = fullCalcs?.acquisition?.totalAcquisitionCosts || (purchasePrice + closingCosts);

  // DSCR — try multiple sources
  const dscrVal = dscr || fullCalcs?.year1?.dscr || projections[0]?.dscr || 0;

  // Purchase price slider range
  const minPrice = Math.round(purchasePrice * 0.4);
  const maxPrice = Math.round(purchasePrice * 1.6);

  // Cap rate sensitivity
  const baseCapRate = capRate > 0 ? capRate : 5.0;
  const baseIdx = 3;
  const capRates = Array.from({ length: 7 }, (_, i) =>
    Number((baseCapRate + (i - baseIdx) * 0.25).toFixed(2))
  );
  const optimizedNOI = fullCalcs?.stabilized?.noi || (startingNOI * 1.15);

  // ── Yearly data — use projections[].cashFlowAfterFinancing (operating only, no sale) ──
  const yearlyData = useMemo(() => {
    const holdYears = selectedHoldPeriod || 5;
    const count = Math.min(holdYears, projections.length, 10);
    const data = [];

    for (let i = 0; i < count; i++) {
      const p = projections[i];
      if (!p) continue;
      const yr = p.year || (i + 1);
      const cashFlow = p.cashFlowAfterFinancing || 0;
      const debtRow = debtTimeline[i];
      const principalPaydown = debtRow?.principalPaid || 0;
      const increaseInValue = 0;

      data.push({
        year: yr,
        label: `Year ${yr}`,
        dateLabel: `${new Date().toLocaleString('default', { month: 'short' })} ${new Date().getFullYear() + yr}`,
        noi: p.noi || 0,
        cashFlow,
        principalPaydown,
        loanBalance: p.loanBalance || 0,
        salePrice: p.grossSalesPrice || 0,
        netSaleProceeds: p.netSalesProceeds || 0,
        increaseInValue,
        netWorthIncrease: cashFlow + principalPaydown + increaseInValue,
        cumulativeCashFlow: 0,
      });
    }

    let running = 0;
    data.forEach(d => { running += d.cashFlow; d.cumulativeCashFlow = running; });
    return data;
  }, [selectedHoldPeriod, projections, debtTimeline]);

  // Aggregates
  const avgCashFlow = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.cashFlow, 0) / yearlyData.length : 0;
  const avgPrincipal = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.principalPaydown, 0) / yearlyData.length : 0;
  const avgNetWorth = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.netWorthIncrease, 0) / yearlyData.length : 0;

  // Capital structure
  const capStructData = useMemo(() => {
    if (capStructYear === 0) {
      return { equity: totalEquity, debt: loanAmount, ltc: loanAmount > 0 ? (loanAmount / acquisitionCost) * 100 : 0, dscr: dscrVal };
    }
    const proj = projections[capStructYear - 1];
    const bal = proj?.loanBalance || loanAmount;
    const eqVal = acquisitionCost - bal;
    const yrDscr = proj?.dscr || dscrVal;
    return { equity: eqVal > 0 ? eqVal : totalEquity, debt: bal, ltc: acquisitionCost > 0 ? (bal / acquisitionCost) * 100 : 0, dscr: yrDscr };
  }, [capStructYear, totalEquity, loanAmount, acquisitionCost, dscrVal, projections]);

  const totalCapital = capStructData.equity + capStructData.debt;
  const equityPct = totalCapital > 0 ? Math.round((capStructData.equity / totalCapital) * 100) : 0;
  const debtPct = totalCapital > 0 ? Math.round((capStructData.debt / totalCapital) * 100) : 0;

  // Total Investment Return
  const cumCashFlows = yearlyData.reduce((s, d) => s + d.cashFlow, 0);
  const exitProj = projections.find(p => p.year === selectedHoldPeriod);
  const netSalePrice = exitProj?.grossSalesPrice || selectedScenario.salePrice || 0;
  const loanBalAtExit = exitProj?.loanBalance || 0;
  const financedByDebt = loanAmount;
  const initialInvestment = 0;
  const totalCashReceived = cumCashFlows + netSalePrice - Math.abs(loanBalAtExit);
  const totalCashInvested = purchasePrice + closingCosts + initialInvestment - financedByDebt;
  const compTotalProfit = totalCashReceived - (totalCashInvested > 0 ? totalCashInvested : totalEquity);

  // Profitability rows
  const profitRows = [
    { label: 'Cash Flow', avg: avgCashFlow, values: yearlyData.map(d => d.cashFlow) },
    { label: 'Principal Paydown', avg: avgPrincipal, values: yearlyData.map(d => d.principalPaydown) },
    { label: 'Increase in Value', avg: 0, values: yearlyData.map(() => 0) },
    { label: 'Increase in Networth', avg: avgNetWorth, values: yearlyData.map(d => d.netWorthIncrease), highlight: true },
  ];

  const fmtProfitVal = (v) => {
    if (displayMode === 'percentage') return pct(totalEquity > 0 ? (v / totalEquity) * 100 : 0);
    return fmt(v);
  };

  const handleChange = (path, value) => { if (onFieldChange) onFieldChange(path, value); };

  // ── Section heading helper ──
  const SectionHead = ({ title, color, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 4, height: 24, backgroundColor: color || AC, borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: VL, letterSpacing: '-0.01em' }}>{title}</h3>
      </div>
      {children}
    </div>
  );

  // ── Tooltip badge ──
  const Tip = ({ text }) => (
    <span title={text} style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${B}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: LB, cursor: 'help', flexShrink: 0 }}>?</span>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════════════════════════
          1. OVERVIEW
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Overview" color={AC} />

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 28 }}>
          {[
            { label: 'IRR', value: `${irrVal.toFixed(1)}%`, tip: 'Internal Rate of Return — annualized return accounting for time value of money' },
            { label: 'Total Potential Profit', value: fmt(totalProfit), tip: 'Cumulative profit including cash flow, principal paydown, and sale proceeds' },
            { label: 'Cash on Cash Return', value: `${cocVal.toFixed(1)}%`, tip: 'Year 1 cash flow divided by total equity invested' },
            { label: 'Equity Multiple', value: `${equityMultiple.toFixed(2)}x`, tip: 'Total cash returned divided by total equity invested' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: LB, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
                <Tip text={m.tip} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: VL, letterSpacing: '-0.02em' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Purchase Price slider */}
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '24px 28px', border: `1px solid ${B}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: VL, textAlign: 'center', marginBottom: 14 }}>Purchase Price</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: LB, fontWeight: 600 }}>$</span>
              <input
                type="text"
                value={purchasePrice.toLocaleString()}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                  handleChange('pricing_financing.purchase_price', v);
                  handleChange('pricing_financing.price', v);
                }}
                style={{ width: 200, padding: '12px 14px 12px 32px', fontSize: 20, fontWeight: 700, border: `2px solid ${AC}`, borderRadius: 10, outline: 'none', textAlign: 'center', color: VL, background: '#fff' }}
              />
            </div>
            <button
              onClick={() => { handleChange('pricing_financing.purchase_price', purchasePrice); handleChange('pricing_financing.price', purchasePrice); }}
              style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, color: AC, background: 'none', border: 'none', cursor: 'pointer' }}
            >Save</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: LB, fontWeight: 600, minWidth: 85, textAlign: 'right' }}>{fmt(minPrice)}</span>
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={50000}
              value={purchasePrice}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                handleChange('pricing_financing.purchase_price', v);
                handleChange('pricing_financing.price', v);
              }}
              style={{ flex: 1, accentColor: AC, height: 6 }}
            />
            <span style={{ fontSize: 12, color: LB, fontWeight: 600, minWidth: 85 }}>{fmt(maxPrice)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            {[
              { label: '+ Create new LOI', action: () => navigate('/loi-generator') },
              { label: '+ Include Refinancing', action: () => { if (onTabChange) onTabChange('exit-strategy'); } },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} style={{ padding: '10px 22px', fontSize: 12, fontWeight: 600, color: VL, background: '#fff', border: `1px solid ${B}`, borderRadius: 8, cursor: 'pointer' }}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. PROJECT VALUATION — Cap Rate Sensitivity
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Project Valuation" color={VL} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: LB, fontSize: 12, borderBottom: `2px solid ${B}` }}>Cap Rate</th>
                {capRates.map((cr, i) => (
                  <th key={i} style={{
                    padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 12,
                    borderBottom: `2px solid ${i === baseIdx ? AC : B}`,
                    backgroundColor: i === baseIdx ? '#eef2ff' : 'transparent',
                    color: i === baseIdx ? AC : LB,
                    borderRadius: i === baseIdx ? '8px 8px 0 0' : 0,
                  }}>
                    {cr.toFixed(2)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Based on Starting NOI', noi: startingNOI, bold: false },
                { label: 'Based on Optimized NOI', noi: optimizedNOI, bold: true },
              ].map((row, ri) => (
                <tr key={ri}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: LB, fontSize: 12, borderBottom: ri === 0 ? `1px solid ${B}` : 'none' }}>{row.label}</td>
                  {capRates.map((cr, i) => {
                    const val = cr > 0 ? row.noi / (cr / 100) : 0;
                    return (
                      <td key={i} style={{
                        padding: '12px 16px', textAlign: 'center', fontWeight: row.bold ? 700 : 600,
                        color: i === baseIdx ? AC : VL,
                        backgroundColor: i === baseIdx ? '#eef2ff' : 'transparent',
                        borderBottom: ri === 0 ? `1px solid ${B}` : 'none', fontSize: 13,
                      }}>
                        {fmt(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. YEARLY CASH FLOW CHART
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Yearly Cash Flow" color={VL}>
          <button onClick={() => { if (onTabChange) onTabChange('cashflow'); }} style={{ fontSize: 12, color: LB, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View Details ›</button>
        </SectionHead>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearlyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="compCfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AC} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={AC} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: LB }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: LB }} axisLine={false} tickLine={false} width={65}
              />
              <Tooltip
                formatter={(v) => [fmt(v), 'Cash Flow']}
                labelStyle={{ fontWeight: 700 }}
                contentStyle={{ borderRadius: 8, border: `1px solid ${B}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              />
              <Area type="monotone" dataKey="cashFlow" stroke={AC} strokeWidth={2.5} fill="url(#compCfGrad)" dot={{ r: 4, fill: AC, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {yearlyData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
            <span style={{ fontSize: 11, color: LB }}>{fmt(Math.min(...yearlyData.map(d => d.cashFlow)))}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: VL }}>{fmt(Math.max(...yearlyData.map(d => d.cashFlow)))}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. PROFITABILITY
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Profitability" color={VL}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Include Sale toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: LB, fontWeight: 600 }}>Include Sale</span>
              <div
                onClick={() => setIncludeSale(!includeSale)}
                style={{
                  width: 40, height: 22, backgroundColor: includeSale ? AC : '#d1d5db',
                  borderRadius: 11, padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: includeSale ? 'flex-end' : 'flex-start', transition: 'background 0.2s',
                }}
              >
                <div style={{ width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </div>
            </div>
            {/* Monetary / Percentage */}
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', border: `1px solid ${B}`, borderRadius: 6, color: VL, fontWeight: 600, cursor: 'pointer', background: '#fff' }}>
              <option value="monetary">Monetary</option>
              <option value="percentage">Percentage</option>
            </select>
            {/* Table / Chart */}
            <div style={{ display: 'flex', border: `1px solid ${B}`, borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => setProfitView('table')} style={{ padding: '5px 12px', fontSize: 13, fontWeight: 600, background: profitView === 'table' ? AC : '#fff', color: profitView === 'table' ? '#fff' : LB, border: 'none', cursor: 'pointer' }}>▦</button>
              <button onClick={() => setProfitView('chart')} style={{ padding: '5px 12px', fontSize: 13, fontWeight: 600, background: profitView === 'chart' ? AC : '#fff', color: profitView === 'chart' ? '#fff' : LB, border: 'none', cursor: 'pointer', borderLeft: `1px solid ${B}` }}>▤</button>
            </div>
          </div>
        </SectionHead>

        {profitView === 'table' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B}` }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: LB, minWidth: 160 }}></th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: LB }}>Average</th>
                  {yearlyData.map((d, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: LB, minWidth: 100 }}>
                      <div>Year {d.year}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af' }}>{d.dateLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitRows.map((row, ri) => (
                  <tr key={ri} style={{
                    backgroundColor: row.highlight ? '#f5f3ff' : (ri % 2 === 0 ? '#fff' : '#fafafa'),
                    borderBottom: `1px solid ${B}`,
                  }}>
                    <td style={{ padding: '12px 16px', fontWeight: row.highlight ? 700 : 600, color: row.highlight ? AC : VL, fontSize: 12 }}>{row.label}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: VL }}>{fmtProfitVal(row.avg)}</td>
                    {row.values.map((v, vi) => (
                      <td key={vi} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? AC : (v > 0 ? VL : v < 0 ? '#ef4444' : LB) }}>
                        {fmtProfitVal(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: LB }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: LB }} width={65} />
                <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ borderRadius: 8, border: `1px solid ${B}` }} />
                <Legend />
                <Bar dataKey="cashFlow" name="Cash Flow" fill={AC} radius={[4, 4, 0, 0]} />
                <Bar dataKey="principalPaydown" name="Principal Paydown" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. CAPITAL STRUCTURE + TOTAL INVESTMENT RETURN (side by side)
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Capital Structure */}
        <div style={card}>
          <SectionHead title="Capital Structure" color={VL}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: LB, fontWeight: 600 }}>Year {capStructYear}</span>
                <select value={capStructYear} onChange={(e) => setCapStructYear(Number(e.target.value))} style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${B}`, borderRadius: 6, color: VL, background: '#fff' }}>
                  {[0, ...yearlyData.map(d => d.year)].map(yr => <option key={yr} value={yr}>Year {yr}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase' }}>LTC</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{Math.round(capStructData.ltc)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase' }}>DSCR</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{(capStructData.dscr || 0).toFixed(2)}x</div>
                </div>
              </div>
            </div>
          </SectionHead>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Equity', value: capStructData.equity, pctLabel: `${equityPct}%`, tip: 'Total equity invested' },
              { label: 'Debt', value: capStructData.debt, pctLabel: `${debtPct}%`, tip: 'Total debt / loan amount' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{item.label}</span>
                  <span title={item.tip} style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#94a3b8', cursor: 'help' }}>?</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(item.value)}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{item.pctLabel}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#f5f3ff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e0e0ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: LB, fontWeight: 600 }}>Acquisition Cost</span>
              <Tip text="Purchase price + closing costs + capex" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: AC }}>{fmt(acquisitionCost)}</div>
          </div>
        </div>

        {/* Total Investment Return */}
        <div style={card}>
          <SectionHead title="Total Investment Return" color={VL}>
            <div style={{ display: 'flex', border: `1px solid ${B}`, borderRadius: 6, overflow: 'hidden' }}>
              <button style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: '#fff', color: VL, border: 'none', borderRight: `1px solid ${B}`, cursor: 'pointer' }}>$</button>
              <button style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: '#f9fafb', color: LB, border: 'none', cursor: 'pointer' }}>$/sq. ft</button>
            </div>
          </SectionHead>

          <div style={{ fontSize: 13, fontWeight: 700, color: VL, marginBottom: 14 }}>Profit Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {[
                { label: 'Annual Cash Flows', value: cumCashFlows, tip: 'Sum of all annual cash flows over hold period', negative: false },
                { label: 'Net Sale Price', value: netSalePrice, tip: 'Gross sale price at exit', negative: false },
                { label: 'Loan Balance at Exit', value: loanBalAtExit, tip: 'Remaining loan balance paid off at sale', negative: true },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0', color: LB, fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.label}
                      <Tip text={r.tip} />
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: r.negative ? '#ef4444' : VL }}>
                    {r.negative ? `-${fmt(Math.abs(r.value))}` : fmt(r.value)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '12px 0', fontWeight: 700, color: VL }}>Total Cash Received</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: VL, fontSize: 14 }}>{fmt(totalCashReceived)}</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 12 }}></td></tr>

              {[
                { label: 'Purchase Price', value: purchasePrice, negative: false },
                { label: 'Closing Cost and Fees', value: closingCosts, tip: 'Estimated closing costs (legal, title, etc.)', negative: false },
                { label: 'Initial Investment', value: initialInvestment, tip: 'Additional upfront capital investment', negative: false },
                { label: 'Financed By Debt', value: financedByDebt, tip: 'Loan proceeds used to fund acquisition', negative: true, green: true },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0', color: LB, fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.label}
                      {r.tip && <Tip text={r.tip} />}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: r.green ? '#10b981' : VL }}>
                    {r.negative ? `-${fmt(Math.abs(r.value))}` : fmt(r.value)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '12px 0', fontWeight: 700, color: VL }}>Total Cash Invested</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: VL, fontSize: 14 }}>{fmt(totalCashInvested > 0 ? totalCashInvested : totalEquity)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f3ff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e0e0ff' }}>
                    <span style={{ fontWeight: 800, color: AC, fontSize: 14 }}>Total Profit</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: (compTotalProfit > 0 ? compTotalProfit : totalProfit) >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(compTotalProfit > 0 ? compTotalProfit : totalProfit)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
