import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
         ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';

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
    if (v == null || isNaN(v) || !isFinite(v)) return '$0';
    const sign = v < 0 ? '-' : '';
    return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
  };
  const pct = (v) => {
    if (v == null || isNaN(v) || !isFinite(v)) return '0.00%';
    return `${Number(v).toFixed(2)}%`;
  };

  // ── Data sources — ALL from fullCalcs (single source of truth) ──
  const projections = useMemo(() => fullCalcs?.projections || [], [fullCalcs]);
  const debtTimeline = useMemo(() => fullCalcs?.exit?.debtTimeline || [], [fullCalcs]);
  const exitScenarios = fullCalcs?.returns?.exitScenarios || [];
  const selectedScenario = exitScenarios.find(s => s.exitYear === selectedHoldPeriod) || exitScenarios[0] || {};

  // === ALL METRICS sourced from fullCalcs ===
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || 0;
  const loanAmount = fullCalcs?.financing?.loanAmount || 0;
  const rawIRR = fullCalcs?.returns?.leveredIRR || 0;
  const irrVal = isFinite(rawIRR) ? rawIRR : 0;
  const rawEM = fullCalcs?.returns?.leveredEquityMultiple || selectedScenario.equityMultiple || 0;
  const equityMultiple = isFinite(rawEM) ? rawEM : 0;
  const rawCoC = fullCalcs?.year1?.cashOnCash || 0;
  const cocVal = isFinite(rawCoC) ? rawCoC : 0;
  const totalProfit = selectedScenario.totalProfit || 0;
  const startingNOI = fullCalcs?.year1?.noi || noiT12 || 0;
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
  const acquisitionCost = fullCalcs?.acquisition?.totalAcquisitionCosts || (purchasePrice + closingCosts);
  const dscrVal = fullCalcs?.year1?.dscr || dscr || projections[0]?.dscr || 0;
  const safeDscr = isFinite(dscrVal) ? dscrVal : 0;

  // === Financials — Income & Expenses (from fullCalcs.year1) ===
  const rentalIncome = fullCalcs?.year1?.potentialGrossIncome || 0;
  const otherIncome = fullCalcs?.year1?.otherIncome || 0;
  const grossOperatingIncome = rentalIncome + otherIncome;
  const totalOperatingExpenses = fullCalcs?.year1?.totalOperatingExpenses || 0;
  const capitalReserve = scenarioData?.expenses?.capital_reserve || scenarioData?.expenses?.reserves || 0;
  const capitalExpenditure = fullCalcs?.acquisition?.upfrontCapEx || 0;
  const noiYear1 = fullCalcs?.year1?.noi || noiT12 || 0;
  const debtServiceYear1 = fullCalcs?.financing?.annualDebtService || annualDebtService || 0;
  const cashFlowYear1 = fullCalcs?.year1?.cashFlow || 0;

  // === Expense Items for donut chart ===
  const expenseItems = fullCalcs?.year1?.expenseItems || {};
  // Pretty labels for known keys; any unknown key gets a formatted fallback
  const knownLabels = {
    taxes: 'Real Estate Taxes',
    insurance: 'Insurance',
    utilities: 'Gas & Electric',
    repairs_maintenance: 'Repairs & Maintenance',
    management: 'Management Fee',
    payroll: 'Payroll',
    admin: 'General/Admin',
    marketing: 'Advertising',
    other: 'Other Expenses',
    contract_services: 'Contract Services',
    legal_fees: 'Legal Fees',
    accounting: 'Accounting',
    landscaping: 'Landscaping',
    trash: 'Trash Removal',
    reserves: 'Replacement Reserve',
    capital_reserve: 'Capital Reserve',
  };
  const prettyLabel = (key) => knownLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const DONUT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16'];

  const donutData = useMemo(() => {
    const items = [];
    const total = totalOperatingExpenses || Object.values(expenseItems).reduce((s, v) => s + (v || 0), 0) || 1;
    // Iterate ALL keys in expenseItems dynamically
    Object.entries(expenseItems).forEach(([key, val]) => {
      if (val > 0) {
        items.push({ name: prettyLabel(key), value: val, pct: ((val / total) * 100).toFixed(1) });
      }
    });
    // If itemized expenses don't sum to total, add residual as "Other"
    const categorized = items.reduce((s, i) => s + i.value, 0);
    const residual = total - categorized;
    if (total > 0 && residual > 1) {
      items.push({ name: 'Other', value: residual, pct: ((residual / total) * 100).toFixed(1) });
    }
    // Sort by value descending for better visual
    items.sort((a, b) => b.value - a.value);
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseItems, totalOperatingExpenses]);

  // === Loan / Mortgage data ===
  const ltvPct = fullCalcs?.financing?.ltv || 0;
  const interestRate = fullCalcs?.financing?.interestRate || 0;
  const monthlyPayment = fullCalcs?.financing?.monthlyPayment || 0;
  const downPayment = purchasePrice - loanAmount;
  const downPaymentPct = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100) : 0;
  const closingCostPct = purchasePrice > 0 ? ((closingCosts / purchasePrice) * 100) : 0;
  const nonFinancedCapEx = capitalExpenditure;

  // === Key Operating Ratios ===
  const capRateVal = fullCalcs?.year1?.capRate || capRate || 0;
  const grm = rentalIncome > 0 ? (purchasePrice / rentalIncome) : 0;
  const nim = totalOperatingExpenses > 0 ? (noiYear1 / totalOperatingExpenses) : 0;
  const expenseRatio = fullCalcs?.year1?.expenseRatio || 0;

  // Purchase price slider range — based on initial price so range stays stable
  const initialPriceRef = useRef(purchasePrice);
  const basePrice = initialPriceRef.current || purchasePrice;
  const minPrice = Math.round(basePrice * 0.4);
  const maxPrice = Math.round(basePrice * 1.6);

  // Cap rate sensitivity
  const baseCapRate = capRateVal > 0 ? capRateVal : 5.0;
  const baseIdx = 3;
  const capRates = Array.from({ length: 7 }, (_, i) =>
    Number((baseCapRate + (i - baseIdx) * 0.25).toFixed(2))
  );
  const optimizedNOI = fullCalcs?.stabilized?.noi || (startingNOI * 1.15);

  // ── Yearly data ──
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
        netWorthIncrease: cashFlow + principalPaydown,
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
      return { equity: totalEquity, debt: loanAmount, ltc: loanAmount > 0 ? (loanAmount / acquisitionCost) * 100 : 0, dscr: safeDscr };
    }
    const proj = projections[capStructYear - 1];
    const bal = proj?.loanBalance || loanAmount;
    const eqVal = acquisitionCost - bal;
    const yrDscr = proj?.dscr || safeDscr;
    return { equity: eqVal > 0 ? eqVal : totalEquity, debt: bal, ltc: acquisitionCost > 0 ? (bal / acquisitionCost) * 100 : 0, dscr: yrDscr };
  }, [capStructYear, totalEquity, loanAmount, acquisitionCost, safeDscr, projections]);

  const totalCapital = capStructData.equity + capStructData.debt;
  const equityPct = totalCapital > 0 ? Math.round((capStructData.equity / totalCapital) * 100) : 0;
  const debtPct = totalCapital > 0 ? Math.round((capStructData.debt / totalCapital) * 100) : 0;

  // Total Investment Return
  const cumCashFlows = yearlyData.reduce((s, d) => s + d.cashFlow, 0);
  const exitProj = projections.find(p => p.year === selectedHoldPeriod);
  const netSalePrice = exitProj?.grossSalesPrice || selectedScenario.salePrice || 0;
  const loanBalAtExit = exitProj?.loanBalance || 0;
  const financedByDebt = loanAmount;
  const totalCashReceived = cumCashFlows + netSalePrice - Math.abs(loanBalAtExit);
  const totalCashInvested = purchasePrice + closingCosts - financedByDebt;
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

  // Custom donut label renderer
  const renderDonutLabel = ({ cx, cy, midAngle, outerRadius, name, pct: pctVal }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 28;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 10, fontWeight: 500 }}>
        {name}: {pctVal}%
      </text>
    );
  };

  // ── Financial row helper ──
  const FinRow = ({ label, monthly, yearly, color, bold, dot }) => (
    <tr style={{ borderBottom: `1px solid #f3f4f6` }}>
      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: bold ? 700 : 500, color: color || VL }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />}
          {label}
        </span>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: bold ? 700 : 500, color: color || VL, fontSize: 13 }}>{fmt(monthly)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: bold ? 700 : 500, color: color || VL, fontSize: 13 }}>{fmt(yearly)}</td>
    </tr>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════════════════════════
          1. OVERVIEW — KPIs + Purchase Price
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
          2. FINANCIALS + FINANCIAL BREAKDOWN (side by side)
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Financials — Income & Expenses */}
        <div style={card}>
          <div style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: VL }}>Financials</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: LB }}>Income & Expenses</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${B}` }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: LB, fontSize: 12, textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: LB, fontSize: 12, textTransform: 'uppercase' }}>Month</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: LB, fontSize: 12, textTransform: 'uppercase' }}>Year</th>
              </tr>
            </thead>
            <tbody>
              <FinRow label="Rental Income" monthly={rentalIncome / 12} yearly={rentalIncome} dot="#22c55e" />
              <FinRow label="Other Income" monthly={otherIncome / 12} yearly={otherIncome} dot="#06b6d4" />
              <FinRow label="Gross Operating Income (GOI)" monthly={grossOperatingIncome / 12} yearly={grossOperatingIncome} bold color={AC} dot={AC} />
              <FinRow label="Capital Reserve" monthly={capitalReserve / 12} yearly={capitalReserve} dot="#8b5cf6" />
              <FinRow label="Operating Expenses" monthly={totalOperatingExpenses / 12} yearly={totalOperatingExpenses} dot="#ef4444" />
              <FinRow label="Capital Expenditure" monthly={capitalExpenditure / 12} yearly={capitalExpenditure} dot="#f97316" />
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 800, color: '#16a34a' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }} />
                    Net Operating Income (NOI)
                  </span>
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>{fmt(noiYear1 / 12)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>{fmt(noiYear1)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown — Donut Chart */}
        <div style={card}>
          <SectionHead title="Financial Breakdown" color={VL} />
          {donutData.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={380} height={300}>
                  <Pie
                    data={donutData}
                    cx={190}
                    cy={140}
                    innerRadius={60}
                    outerRadius={105}
                    paddingAngle={2}
                    dataKey="value"
                    label={renderDonutLabel}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [fmt(v), 'Amount']} contentStyle={{ borderRadius: 8, border: `1px solid ${B}`, fontSize: 12 }} />
                </PieChart>
              </div>
              {/* Summary cards below donut */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                {[
                  { label: 'Rental Income', value: rentalIncome, color: '#22c55e' },
                  { label: 'Other Income', value: otherIncome, color: '#06b6d4' },
                  { label: 'Operating Expenses', value: totalOperatingExpenses, color: '#ef4444' },
                ].map((c, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${c.color}` }}>
                    <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 4 }}>{c.label}:</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{fmt(c.value)}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
                {[
                  { label: 'Capital Expenditure', value: capitalExpenditure, color: '#f97316' },
                  { label: 'Capital Reserve', value: capitalReserve, color: '#8b5cf6' },
                ].map((c, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${c.color}` }}>
                    <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 4 }}>{c.label}:</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{fmt(c.value)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: LB }}>No expense data available</div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. KEY OPERATING RATIOS + LOAN + MORTGAGE (3-column)
          ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Key Operating Ratios */}
        <div style={card}>
          <SectionHead title="Key Operating Ratios" color={VL} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'Internal Rate Of Return (IRR)', value: `${irrVal.toFixed(2)}%`, icon: '→' },
                { label: 'Equity Multiple (EM)', value: equityMultiple.toFixed(2), icon: '→' },
                { label: 'Capitalization Rate (CAP)', value: `${capRateVal.toFixed(1)}%`, icon: '→' },
                { label: 'Gross Rent Multiplier (GRM)', value: grm.toFixed(2), icon: '→' },
                { label: 'Net Income Multiplier (NIM)', value: nim.toFixed(2), icon: '→' },
                { label: 'Expense Ratio (ER)', value: `${expenseRatio.toFixed(0)}%`, icon: '→' },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                  <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 500, color: LB }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: AC, fontWeight: 700, fontSize: 13 }}>{r.icon}</span>
                      {r.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: VL, fontSize: 14 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Loan */}
        <div style={card}>
          <SectionHead title="Loan" color={VL} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'Loan', badge: `${ltvPct.toFixed(0)}% LTV`, value: loanAmount, badgeColor: AC },
                { label: 'Down Pymt', badge: `${downPaymentPct.toFixed(0)}%`, value: downPayment, badgeColor: '#ef4444' },
                { label: 'Closing Cost', badge: `${closingCostPct.toFixed(0)}%`, value: closingCosts, badgeColor: '#f97316' },
                { label: 'Closing Reserve', value: 0 },
                { label: 'Non-Financed CapEx', value: nonFinancedCapEx },
                { label: 'Total Equity', value: totalEquity, bold: true },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: i < 5 ? `1px solid #f3f4f6` : 'none' }}>
                  <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: r.bold ? 700 : 500, color: r.bold ? VL : LB }}>
                    {r.label}
                    {r.badge && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: r.badgeColor, padding: '2px 6px', background: `${r.badgeColor}10`, borderRadius: 4 }}>
                        {r.badge}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: VL, fontSize: 13 }}>{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mortgage */}
        <div style={card}>
          <SectionHead title="Mortgage" color={VL} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'Avg Interest Rate', value: `${interestRate.toFixed(2)}%`, icon: '→' },
                { label: 'Debt Cost (DC)', value: fmt(debtServiceYear1), icon: '→' },
                { label: 'Payment (month)', value: fmt(monthlyPayment), icon: '→' },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                  <td style={{ padding: '12px 8px', fontSize: 12, fontWeight: 500, color: LB }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: AC, fontWeight: 700, fontSize: 13 }}>{r.icon}</span>
                      {r.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: VL, fontSize: 14 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* DSCR & Cash Flow summary */}
          <div style={{ marginTop: 16, background: '#f9fafb', borderRadius: 10, padding: '14px 16px', border: `1px solid ${B}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: LB }}>DSCR</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: safeDscr >= 1.25 ? '#16a34a' : safeDscr >= 1.0 ? '#eab308' : '#ef4444' }}>{safeDscr.toFixed(2)}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: LB }}>Cash Flow After Debt</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: cashFlowYear1 >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(cashFlowYear1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. PROJECT VALUATION — Cap Rate Sensitivity
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
          5. YEARLY CASH FLOW CHART
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
          6. PROFITABILITY
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Profitability" color={VL}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
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
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', border: `1px solid ${B}`, borderRadius: 6, color: VL, fontWeight: 600, cursor: 'pointer', background: '#fff' }}>
              <option value="monetary">Monetary</option>
              <option value="percentage">Percentage</option>
            </select>
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
          7. CAPITAL STRUCTURE + TOTAL INVESTMENT RETURN (side by side)
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
          <SectionHead title="Total Investment Return" color={VL} />

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
