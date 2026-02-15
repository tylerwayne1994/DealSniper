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
  const SC = { backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}` };
  const cFmt = (v) => { if (v == null || isNaN(v)) return '$0'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); };
  const cPct = (v) => { if (v == null || isNaN(v)) return '0%'; return `${Number(v).toFixed(2)}%`; };

  // ── Data sources ──
  const exitScenarios = fullCalcs?.returns?.exitScenarios || [];
  const projections = useMemo(() => fullCalcs?.projections || [], [fullCalcs]);
  const debtTimeline = useMemo(() => fullCalcs?.exit?.debtTimeline || [], [fullCalcs]);
  const equityRows = useMemo(() => {
    const timeline = fullCalcs?.exit?.equityExitTimeline || { rows: [] };
    return timeline.rows || [];
  }, [fullCalcs]);
  const selectedScenario = exitScenarios.find(s => s.exitYear === selectedHoldPeriod) || exitScenarios[0] || {};
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || fullCalcs?.total_project_cost || 0;
  const loanAmount = fullCalcs?.financing?.loanAmount || 0;
  const irr = fullCalcs?.returns?.leveredIRR || 0;
  const equityMultiple = fullCalcs?.returns?.equityMultiple || selectedScenario.equityMultiple || 0;
  const coc = fullCalcs?.year1?.cashOnCash || 0;
  const totalProfit = selectedScenario.totalProfit || 0;
  const startingNOI = fullCalcs?.year1?.noi || noiT12 || 0;
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
  const acquisitionCost = fullCalcs?.acquisition?.totalAcquisitionCosts || (purchasePrice + closingCosts);

  // ── Purchase price slider ──
  const minPrice = Math.round(purchasePrice * 0.4);
  const maxPrice = Math.round(purchasePrice * 1.6);
  const currentPrice = purchasePrice;

  // ── Cap rate sensitivity ──
  const baseCapRate = capRate > 0 ? capRate : 5.0;
  const capRates = [];
  const baseIdx = 3;
  for (let i = 0; i < 7; i++) {
    capRates.push(Number((baseCapRate + (i - baseIdx) * 0.25).toFixed(2)));
  }

  // Optimized NOI = stabilized / value-add NOI
  const optimizedNOI = fullCalcs?.stabilized?.noi || (startingNOI * 1.15);

  // ── Yearly data for cash flow chart + profitability table ──
  const yearlyData = useMemo(() => {
    const data = [];
    const holdYears = selectedHoldPeriod || 10;
    const annualGrowth = scenarioData?.growth?.income_growth || 0.03;
    const debtSvc = annualDebtService || 0;

    for (let yr = 1; yr <= Math.min(holdYears, 10); yr++) {
      const proj = projections.find(p => p.year === yr);
      const eqRow = equityRows[yr - 1];
      const debtRow = debtTimeline[yr - 1];

      const yrNOI = proj?.noi || (startingNOI * Math.pow(1 + annualGrowth, yr));
      const yrCashFlow = eqRow?.totalDistribution || (yrNOI - debtSvc);
      const yrPrincipalPaydown = debtRow?.principalPaid || 0;
      const yrLoanBalance = proj?.loanBalance || debtRow?.endingBalance || 0;
      const yrSalePrice = proj?.grossSalesPrice || 0;
      const yrNetSaleProceeds = proj?.netSalesProceeds || 0;
      const increaseInValue = 0;
      const netWorthIncrease = yrCashFlow + yrPrincipalPaydown + increaseInValue;

      data.push({
        year: yr,
        label: `Year ${yr}`,
        dateLabel: `${new Date().toLocaleString('default', { month: 'short' })} ${new Date().getFullYear() + yr}`,
        noi: yrNOI,
        cashFlow: yrCashFlow,
        principalPaydown: yrPrincipalPaydown,
        loanBalance: yrLoanBalance,
        salePrice: yrSalePrice,
        netSaleProceeds: yrNetSaleProceeds,
        increaseInValue,
        netWorthIncrease,
        cumulativeCashFlow: 0,
      });
    }
    let running = 0;
    data.forEach(d => { running += d.cashFlow; d.cumulativeCashFlow = running; });
    return data;
  }, [selectedHoldPeriod, scenarioData, projections, equityRows, debtTimeline, startingNOI, annualDebtService]);

  // Averages for profitability
  const avgCashFlow = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.cashFlow, 0) / yearlyData.length : 0;
  const avgPrincipal = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.principalPaydown, 0) / yearlyData.length : 0;
  const avgIncValue = 0;
  const avgNetWorth = yearlyData.length > 0 ? yearlyData.reduce((s, d) => s + d.netWorthIncrease, 0) / yearlyData.length : 0;

  // Capital structure per year
  const capStructData = useMemo(() => {
    if (capStructYear === 0) {
      return { equity: totalEquity, debt: loanAmount, ltc: loanAmount > 0 ? (loanAmount / acquisitionCost) * 100 : 0, dscr: dscr };
    }
    const debtRow = debtTimeline[capStructYear - 1];
    const bal = debtRow?.endingBalance || loanAmount;
    const eqVal = acquisitionCost - bal;
    return { equity: eqVal > 0 ? eqVal : totalEquity, debt: bal, ltc: acquisitionCost > 0 ? (bal / acquisitionCost) * 100 : 0, dscr: dscr };
  }, [capStructYear, totalEquity, loanAmount, acquisitionCost, dscr, debtTimeline]);

  const totalCapital = capStructData.equity + capStructData.debt;
  const equityPct = totalCapital > 0 ? Math.round((capStructData.equity / totalCapital) * 100) : 0;
  const debtPct = totalCapital > 0 ? Math.round((capStructData.debt / totalCapital) * 100) : 0;

  // Total Investment Return
  const cumCashFlows = yearlyData.reduce((s, d) => s + d.cashFlow, 0);
  const netSalePrice = projections.find(p => p.year === selectedHoldPeriod)?.grossSalesPrice || selectedScenario.salePrice || 0;
  const loanBalAtExit = projections.find(p => p.year === selectedHoldPeriod)?.loanBalance || (debtTimeline[selectedHoldPeriod - 1]?.endingBalance) || 0;
  const financedByDebt = loanAmount;
  const initialInvestment = 0;
  const totalCashInvested = purchasePrice + closingCosts + initialInvestment - financedByDebt;
  const compTotalProfit = (cumCashFlows + netSalePrice - Math.abs(loanBalAtExit)) - totalCashInvested;

  // ── Profitability rows ──
  const profitRows = [
    { label: 'Cash Flow', avg: avgCashFlow, values: yearlyData.map(d => d.cashFlow), pctBase: totalEquity },
    { label: 'Principal Paydown', avg: avgPrincipal, values: yearlyData.map(d => d.principalPaydown), pctBase: totalEquity },
    { label: 'Increase in Value', avg: avgIncValue, values: yearlyData.map(d => d.increaseInValue), pctBase: totalEquity },
    { label: 'Increase in Networth', avg: avgNetWorth, values: yearlyData.map(d => d.netWorthIncrease), pctBase: totalEquity, highlight: true },
  ];

  const formatVal = (v) => {
    if (displayMode === 'monetary') return cFmt(Math.round(v));
    return cPct(totalEquity > 0 ? (v / totalEquity) * 100 : 0);
  };

  const handleFieldChange = (path, value) => {
    if (onFieldChange) onFieldChange(path, value);
  };

  return (
    <div style={{ padding: 0 }}>

      {/* ═══ 1. OVERVIEW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, marginBottom: 24 }}>
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 4, height: 24, backgroundColor: AC, borderRadius: 2 }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Overview</h3>
          </div>
          {/* Top metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 24 }}>
            {[
              { label: 'IRR', value: `${(irr * 100).toFixed(0)}%`, tip: 'Internal Rate of Return — annualized return accounting for time value of money' },
              { label: 'Total Potential Profit', value: cFmt(totalProfit), tip: 'Cumulative profit including cash flow, principal paydown, and sale proceeds' },
              { label: 'Cash on Cash Return', value: `${coc.toFixed(0)}%`, tip: 'Year 1 cash flow divided by total equity invested' },
              { label: 'Equity Multiple', value: `${equityMultiple.toFixed(2)}x`, tip: 'Total cash returned divided by total equity invested' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: LB, fontWeight: 600 }}>{m.label}</span>
                  <span title={m.tip} style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${B}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: LB, cursor: 'help' }}>?</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: VL }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Purchase Price slider */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '20px 24px', border: `1px solid ${B}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: VL, textAlign: 'center', marginBottom: 12 }}>Purchase Price</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: LB, fontWeight: 600 }}>$</span>
                <input
                  type="text"
                  value={currentPrice.toLocaleString()}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                    handleFieldChange('pricing_financing.purchase_price', v);
                    handleFieldChange('pricing_financing.price', v);
                  }}
                  style={{ width: 180, padding: '10px 12px 10px 28px', fontSize: 18, fontWeight: 700, border: `1.5px solid ${AC}`, borderRadius: 10, outline: 'none', textAlign: 'center', color: VL }}
                />
              </div>
              <button
                onClick={() => {
                  handleFieldChange('pricing_financing.purchase_price', currentPrice);
                  handleFieldChange('pricing_financing.price', currentPrice);
                }}
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: AC, background: 'none', border: 'none', cursor: 'pointer' }}
              >Save</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: LB, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{cFmt(minPrice)}</span>
              <input
                type="range"
                min={minPrice}
                max={maxPrice}
                step={50000}
                value={currentPrice}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  handleFieldChange('pricing_financing.purchase_price', v);
                  handleFieldChange('pricing_financing.price', v);
                }}
                style={{ flex: 1, accentColor: AC }}
              />
              <span style={{ fontSize: 12, color: LB, fontWeight: 600, minWidth: 80 }}>{cFmt(maxPrice)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
              <button onClick={() => navigate('/loi-generator')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, color: VL, background: '#fff', border: `1px solid ${B}`, borderRadius: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 14 }}>+</span> Create new LOI
              </button>
              <button onClick={() => { if (onTabChange) onTabChange('exit-strategy'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, color: VL, background: '#fff', border: `1px solid ${B}`, borderRadius: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 14 }}>+</span> Include Refinancing
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. PROJECT VALUATION — Cap Rate Sensitivity ═══ */}
      <div style={SC}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 4, height: 24, backgroundColor: VL, borderRadius: 2 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Project Valuation</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: LB, fontSize: 12, borderBottom: `2px solid ${B}` }}>Cap Rate</th>
                {capRates.map((cr, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 12, borderBottom: `2px solid ${B}`, backgroundColor: i === baseIdx ? `${AC}10` : 'transparent', color: i === baseIdx ? AC : LB, borderRadius: i === baseIdx ? '8px 8px 0 0' : 0 }}>
                    {cr.toFixed(2)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: LB, fontSize: 12, borderBottom: `1px solid ${B}` }}>Based on Starting NOI</td>
                {capRates.map((cr, i) => {
                  const val = cr > 0 ? startingNOI / (cr / 100) : 0;
                  return (
                    <td key={i} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: i === baseIdx ? AC : VL, backgroundColor: i === baseIdx ? `${AC}10` : 'transparent', borderBottom: `1px solid ${B}`, fontSize: 12 }}>
                      {cFmt(Math.round(val))}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: LB, fontSize: 12 }}>Based on Optimized NOI</td>
                {capRates.map((cr, i) => {
                  const val = cr > 0 ? optimizedNOI / (cr / 100) : 0;
                  return (
                    <td key={i} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: i === baseIdx ? AC : VL, backgroundColor: i === baseIdx ? `${AC}10` : 'transparent', fontSize: 12 }}>
                      {cFmt(Math.round(val))}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 3. YEARLY CASH FLOW CHART ═══ */}
      <div style={SC}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 24, backgroundColor: VL, borderRadius: 2 }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Yearly Cash Flow</h3>
          </div>
          <button onClick={() => { if (onTabChange) onTabChange('cashflow'); }} style={{ fontSize: 12, color: LB, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View Details &rsaquo;</button>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearlyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AC} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={AC} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: LB }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: LB }} axisLine={false} tickLine={false} width={60}
                domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => [cFmt(Math.round(v)), 'Cash Flow']} labelStyle={{ fontWeight: 700 }} />
              <Area type="monotone" dataKey="cashFlow" stroke={AC} strokeWidth={2.5} fill="url(#cfGrad)" dot={{ r: 3, fill: AC }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {yearlyData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: LB }}>{cFmt(Math.round(Math.min(...yearlyData.map(d => d.cashFlow))))}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: VL }}>{cFmt(Math.round(Math.max(...yearlyData.map(d => d.cashFlow))))}</span>
          </div>
        )}
      </div>

      {/* ═══ 4. PROFITABILITY TABLE ═══ */}
      <div style={SC}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 24, backgroundColor: VL, borderRadius: 2 }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Profitability</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Include Sale toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: LB, fontWeight: 600 }}>Include Sale</span>
              <div onClick={() => setIncludeSale(!includeSale)} style={{ width: 40, height: 22, backgroundColor: includeSale ? AC : '#d1d5db', borderRadius: 11, padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: includeSale ? 'flex-end' : 'flex-start', transition: 'background 0.2s' }}>
                <div style={{ width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </div>
            </div>
            {/* Monetary / Percentage selector */}
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', border: `1px solid ${B}`, borderRadius: 6, color: VL, fontWeight: 600, cursor: 'pointer' }}>
              <option value="monetary">Monetary</option>
              <option value="percentage">Percentage</option>
            </select>
            {/* Table / Chart toggle */}
            <div style={{ display: 'flex', border: `1px solid ${B}`, borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => setProfitView('table')} style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: profitView === 'table' ? AC : '#fff', color: profitView === 'table' ? '#fff' : LB, border: 'none', cursor: 'pointer' }}>&#9638;</button>
              <button onClick={() => setProfitView('chart')} style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, background: profitView === 'chart' ? AC : '#fff', color: profitView === 'chart' ? '#fff' : LB, border: 'none', cursor: 'pointer' }}>&#9636;</button>
            </div>
          </div>
        </div>

        {profitView === 'table' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B}` }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: LB, minWidth: 140 }}></th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: LB }}>Average</th>
                  {yearlyData.map((d, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: LB, minWidth: 90 }}>
                      <div>Year {d.year}</div>
                      <div style={{ fontSize: 10, fontWeight: 500 }}>{d.dateLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitRows.map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: row.highlight ? `${AC}08` : (ri % 2 === 0 ? '#fff' : '#f9fafb'), borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: row.highlight ? 700 : 600, color: row.highlight ? AC : VL }}>{row.label}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: VL }}>{formatVal(row.avg)}</td>
                    {row.values.map((v, vi) => (
                      <td key={vi} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? AC : (v > 0 ? VL : v < 0 ? '#ef4444' : LB) }}>
                        {formatVal(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: LB }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: LB }} width={60} />
                <Tooltip formatter={(v, name) => [cFmt(Math.round(v)), name]} />
                <Legend />
                <Bar dataKey="cashFlow" name="Cash Flow" fill={AC} radius={[4, 4, 0, 0]} />
                <Bar dataKey="principalPaydown" name="Principal Paydown" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══ 5. CAPITAL STRUCTURE + TOTAL INVESTMENT RETURN (side by side) ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Capital Structure */}
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 24, backgroundColor: VL, borderRadius: 2 }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Capital Structure</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: LB, fontWeight: 600 }}>Year {capStructYear}</span>
                <select value={capStructYear} onChange={(e) => setCapStructYear(Number(e.target.value))} style={{ fontSize: 12, padding: '2px 6px', border: `1px solid ${B}`, borderRadius: 4, color: VL }}>
                  {[0, ...yearlyData.map(d => d.year)].map(yr => <option key={yr} value={yr}>Year {yr}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: LB, fontWeight: 600 }}>LTC</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{Math.round(capStructData.ltc)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: LB, fontWeight: 600 }}>DSCR</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{capStructData.dscr.toFixed(2)}x</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Equity</span>
                <span title="Total equity invested" style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#94a3b8', cursor: 'help' }}>?</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{cFmt(capStructData.equity)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{equityPct}%</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Debt</span>
                <span title="Total debt / loan amount" style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#94a3b8', cursor: 'help' }}>?</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{cFmt(capStructData.debt)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{debtPct}%</div>
            </div>
          </div>
          <div style={{ background: `${AC}08`, borderRadius: 12, padding: '16px 20px', border: `1px solid ${AC}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: LB, fontWeight: 600 }}>Acquisition Cost</span>
              <span title="Purchase price + closing costs + capex" style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${B}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: LB, cursor: 'help' }}>?</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: AC }}>{cFmt(acquisitionCost)}</div>
          </div>
        </div>

        {/* Total Investment Return */}
        <div style={SC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 24, backgroundColor: VL, borderRadius: 2 }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: VL }}>Total Investment Return</h3>
            </div>
            <div style={{ display: 'flex', border: `1px solid ${B}`, borderRadius: 6, overflow: 'hidden' }}>
              <button style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, background: '#fff', color: VL, border: 'none', borderRight: `1px solid ${B}`, cursor: 'pointer' }}>$</button>
              <button style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, background: '#f9fafb', color: LB, border: 'none', cursor: 'pointer' }}>$/sq. ft</button>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: VL, marginBottom: 12 }}>Profit Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {[
                { label: 'Annual Cash Flows', value: cumCashFlows, tip: 'Sum of all annual cash flows over hold period', color: VL },
                { label: 'Net Sale Price', value: netSalePrice, tip: 'Gross sale price at exit', color: VL },
                { label: 'Loan Balance at Exit', value: -Math.abs(loanBalAtExit), tip: 'Remaining loan balance paid off at sale', color: '#ef4444' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 0', color: LB, fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {r.label}
                      <span title={r.tip} style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${B}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: LB, cursor: 'help' }}>?</span>
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: r.color }}>{r.value < 0 ? `$-${Math.abs(r.value).toLocaleString()}` : cFmt(Math.round(r.value))}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '10px 0', fontWeight: 700, color: VL }}>Total Cash Received</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: VL }}>{cFmt(Math.round(cumCashFlows + netSalePrice - Math.abs(loanBalAtExit)))}</td>
              </tr>
              <tr><td colSpan={2} style={{ height: 8 }}></td></tr>
              {[
                { label: 'Purchase Price', value: purchasePrice, color: VL },
                { label: 'Closing Cost and Fees', value: closingCosts, tip: 'Estimated closing costs (legal, title, etc.)', color: VL },
                { label: 'Initial Investment', value: initialInvestment, tip: 'Additional upfront capital investment', color: VL },
                { label: 'Financed By Debt', value: -financedByDebt, tip: 'Loan proceeds used to fund acquisition', color: '#10b981' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 0', color: LB, fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {r.label}
                      {r.tip && <span title={r.tip} style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${B}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: LB, cursor: 'help' }}>?</span>}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: r.color }}>{r.value < 0 ? `$-${Math.abs(r.value).toLocaleString()}` : cFmt(Math.round(r.value))}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '10px 0', fontWeight: 700, color: VL }}>Total Cash Invested</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: VL }}>{cFmt(Math.round(totalCashInvested > 0 ? totalCashInvested : totalEquity))}</td>
              </tr>
              <tr style={{ backgroundColor: `${AC}08`, borderRadius: 8 }}>
                <td style={{ padding: '12px 8px', fontWeight: 800, color: AC, borderRadius: '8px 0 0 8px' }}>Total Profit</td>
                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, fontSize: 16, color: compTotalProfit >= 0 ? '#10b981' : '#ef4444', borderRadius: '0 8px 8px 0' }}>{cFmt(Math.round(compTotalProfit > 0 ? compTotalProfit : totalProfit))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
