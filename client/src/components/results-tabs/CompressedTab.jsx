import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
         ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { API_ENDPOINTS } from '../../config/api';

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
  vaRentUpside = 0,
  vaRubsRecovery = 0,
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

  // === ALL METRICS sourced from fullCalcs, with Deal Structure overrides ===
  const hasMultiLoanStack = scenarioData.financing?.loans?.length > 0;
  // When Deal Structure is configured, use its total_loan_amount & down_payment
  const loanAmount = (hasMultiLoanStack && scenarioData.financing?.total_loan_amount > 0)
    ? scenarioData.financing.total_loan_amount
    : (fullCalcs?.financing?.loanAmount || 0);
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
  const acquisitionCost = (hasMultiLoanStack && scenarioData.financing?.total_acquisition_cost > 0)
    ? scenarioData.financing.total_acquisition_cost
    : (fullCalcs?.acquisition?.totalAcquisitionCosts || (purchasePrice + closingCosts));
  const dsDownPayment = hasMultiLoanStack ? (scenarioData.financing?.down_payment ?? 0) : null;
  const totalEquity = (hasMultiLoanStack && dsDownPayment != null)
    ? (dsDownPayment + closingCosts + (fullCalcs?.acquisition?.upfrontCapEx || 0))
    : (fullCalcs?.financing?.totalEquityRequired || 0);
  const rawIRR = fullCalcs?.returns?.leveredIRR || 0;
  const irrVal = isFinite(rawIRR) ? rawIRR : 0;
  const rawEM = fullCalcs?.returns?.leveredEquityMultiple || selectedScenario.equityMultiple || 0;
  const equityMultiple = isFinite(rawEM) ? rawEM : 0;
  const rawCoC = fullCalcs?.year1?.cashOnCash || 0;
  const cocVal = isFinite(rawCoC) ? rawCoC : 0;
  const totalProfit = selectedScenario.totalProfit || 0;
  const startingNOI = fullCalcs?.year1?.noi || noiT12 || 0;

  // === Financials — Income & Expenses (from fullCalcs.year1) ===
  const rentalIncome = fullCalcs?.year1?.potentialGrossIncome || 0;
  const otherIncome = fullCalcs?.year1?.otherIncome || 0;
  const grossOperatingIncome = rentalIncome + otherIncome;
  const totalOperatingExpenses = fullCalcs?.year1?.totalOperatingExpenses || 0;
  const capitalReserve = scenarioData?.expenses?.capital_reserve || scenarioData?.expenses?.reserves || 0;
  const capitalExpenditure = fullCalcs?.acquisition?.upfrontCapEx || 0;
  const noiYear1 = fullCalcs?.year1?.noi || noiT12 || 0;

  // === Debt Service: prefer Deal Structure multi-loan total when configured ===
  const debtServiceYear1 = (hasMultiLoanStack && annualDebtService > 0)
    ? annualDebtService
    : (fullCalcs?.financing?.annualDebtService || annualDebtService || 0);
  // Recalculate cash flow with corrected debt service
  const cashFlowYear1 = hasMultiLoanStack
    ? (noiYear1 - debtServiceYear1)
    : (fullCalcs?.year1?.cashFlow || 0);

  // Recalculate DSCR with corrected debt service
  const dscrVal = (hasMultiLoanStack && debtServiceYear1 > 0 && noiYear1 > 0)
    ? (noiYear1 / debtServiceYear1)
    : (fullCalcs?.year1?.dscr || dscr || projections[0]?.dscr || 0);
  const safeDscr = isFinite(dscrVal) ? dscrVal : 0;

  // === Value-Add Pro Forma Adjustments (passed from parent) ===
  const vaTotalAdj = vaRentUpside + vaRubsRecovery;
  const adjNOI = noiYear1 + vaTotalAdj;
  const adjCashFlow = cashFlowYear1 + vaTotalAdj;

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

  // === Loan / Mortgage data — prefer Deal Structure when configured ===
  const ltvPct = hasMultiLoanStack
    ? (purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0)
    : (fullCalcs?.financing?.ltv || 0);
  // Weighted-avg interest rate: use senior loan rate from Deal Structure, else calc engine
  const seniorLoan = hasMultiLoanStack
    ? (scenarioData.financing.loans.find(l => l.type === 'Senior Loan' && l.enabled !== false))
    : null;
  const interestRate = seniorLoan
    ? (Number(seniorLoan.rate) || 0)
    : (fullCalcs?.financing?.interestRate || 0);
  const monthlyPayment = hasMultiLoanStack
    ? (debtServiceYear1 / 12)
    : (fullCalcs?.financing?.monthlyPayment || 0);
  const downPayment = hasMultiLoanStack
    ? (dsDownPayment ?? (purchasePrice - loanAmount))
    : (purchasePrice - loanAmount);
  const downPaymentPct = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100) : 0;
  const closingCostPct = purchasePrice > 0 ? ((closingCosts / purchasePrice) * 100) : 0;
  const nonFinancedCapEx = capitalExpenditure;
  // Recalculate Cash-on-Cash with Deal Structure equity
  const adjCocVal = (hasMultiLoanStack && totalEquity > 0)
    ? ((cashFlowYear1 / totalEquity) * 100)
    : cocVal;

  // === Key Operating Ratios ===
  const capRateVal = fullCalcs?.year1?.capRate || capRate || 0;
  const grm = rentalIncome > 0 ? (purchasePrice / rentalIncome) : 0;
  const nim = totalOperatingExpenses > 0 ? (adjNOI / totalOperatingExpenses) : 0;
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
  const netSalePrice = exitProj?.netSalesProceeds || selectedScenario.salePrice || 0;
  const loanBalAtExit = exitProj?.loanBalance || 0;
  const financedByDebt = loanAmount;
  const totalCashReceived = cumCashFlows + netSalePrice - Math.abs(loanBalAtExit);
  const totalCashInvested = totalEquity; // equity already includes down payment + closing + capex
  const compTotalProfit = totalCashReceived - totalCashInvested;

  // ═══ Equity Partner Detection & GP/LP Returns Calculation ═══
  const epLoan = useMemo(() => {
    const loans = scenarioData?.financing?.loans || [];
    return loans.find(l => l.type === 'Equity Partner' && l.enabled !== false) || null;
  }, [scenarioData?.financing?.loans]);
  const hasEquityPartner = !!epLoan;

  const partnershipReturns = useMemo(() => {
    if (!epLoan) return null;
    const partnerEquity = Number(epLoan.loanDollar) || 0;
    const prefReturnRate = (Number(epLoan.rate) || 8) / 100;
    const balloonYrs = Number(epLoan.balloonYrs) || 5;
    const holdYrs = selectedHoldPeriod || 5;
    const isDoubleInvestment = !!epLoan.doubleInvestment;

    // GP equity = your down payment (total equity minus partner equity)
    const gpEquity = Math.max(0, downPayment);
    const lpEquity = partnerEquity;
    const totalEquityPool = gpEquity + lpEquity;
    if (totalEquityPool <= 0) return null;

    const gpPctOwnership = gpEquity / totalEquityPool;
    const lpPctOwnership = lpEquity / totalEquityPool;

    // Annual preferred payment to LP
    const annualPref = lpEquity * prefReturnRate;
    const totalPrefPaid = annualPref * Math.min(holdYrs, balloonYrs);

    // Balloon payout to LP
    const balloonPayout = isDoubleInvestment ? lpEquity * 2 : lpEquity;

    // Total cost to GP for the partner
    const totalPartnerCost = totalPrefPaid + balloonPayout;

    // Use compTotalProfit if available, else totalProfit
    const dealProfit = compTotalProfit > 0 ? compTotalProfit : totalProfit;

    // GP distributions = total cash - LP distributions
    // LP gets: preferred returns + return of capital (balloon)
    const lpDistributions = totalPrefPaid + balloonPayout;
    const lpProfit = lpDistributions - lpEquity;

    // GP gets: everything else
    const gpDistributions = cumCashFlows + (netSalePrice - Math.abs(loanBalAtExit)) - lpDistributions;
    const gpProfit = gpDistributions - gpEquity;

    // IRR approximation
    const gpIRR = gpEquity > 0 && holdYrs > 0 ? ((Math.pow(Math.max(0, gpDistributions) / gpEquity, 1 / holdYrs) - 1) * 100) : 0;
    const lpIRR = lpEquity > 0 && holdYrs > 0 ? ((Math.pow(Math.max(0, lpDistributions) / lpEquity, 1 / holdYrs) - 1) * 100) : 0;

    // Equity multiples
    const gpEM = gpEquity > 0 ? gpDistributions / gpEquity : 0;
    const lpEM = lpEquity > 0 ? lpDistributions / lpEquity : 0;

    return {
      gpEquity, lpEquity, gpPctOwnership, lpPctOwnership,
      prefReturnRate, annualPref, totalPrefPaid, balloonYrs, balloonPayout, isDoubleInvestment,
      gpDistributions, lpDistributions,
      gpProfit, lpProfit,
      gpIRR, lpIRR, gpEM, lpEM,
      holdYrs, totalPartnerCost,
    };
  }, [epLoan, downPayment, compTotalProfit, totalProfit, selectedHoldPeriod, cumCashFlows, netSalePrice, loanBalAtExit]);

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

  // ── Property data for Deal Overview ──
  const property = scenarioData?.property || {};
  const propertyName = property?.property_name || property?.name || '';
  const propertyAddress = property?.address || scenarioData?.address || '';
  const propertyCity = property?.city || scenarioData?.city || '';
  const propertyState = property?.state || scenarioData?.state || '';
  const propertyZip = property?.zip || scenarioData?.zip || '';
  const fullAddress = [propertyAddress, propertyCity && propertyState ? `${propertyCity}, ${propertyState}` : (propertyCity || propertyState), propertyZip].filter(Boolean).join(' ');
  const assetType = property?.property_type || property?.asset_type || 'multifamily';
  const yearBuilt = property?.year_built || '';
  const totalUnits = property?.total_units || property?.units || 0;
  const netRentableSF = property?.total_sq_ft || property?.rba_sqft || property?.net_rentable_sf || 0;
  const occupancyRate = property?.occupancy_rate || (fullCalcs?.year1?.occupancyRate) || 0;
  const holdingPeriod = selectedHoldPeriod || scenarioData?.exit?.holding_period || 5;
  const pricePerSF = netRentableSF > 0 ? purchasePrice / netRentableSF : 0;
  const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
  const capitalImprovements = fullCalcs?.acquisition?.upfrontCapEx || 0;
  const acquisitionFee = purchasePrice * 0.01;
  const loanFees = loanAmount * 0.01;
  const financingFees = loanAmount * 0.005;
  const totalInterest = debtServiceYear1 * holdingPeriod - (loanAmount - (exitProj?.loanBalance || loanAmount * 0.9));
  const totalProjectCost = purchasePrice + closingCosts + capitalImprovements + acquisitionFee + loanFees + financingFees;
  const loanTermYears = seniorLoan?.term || scenarioData?.pricing_financing?.term_years || 30;
  const amortYears = seniorLoan?.amort || scenarioData?.pricing_financing?.amortization_years || 30;
  const exitCapRate = fullCalcs?.returns?.exitCapRate || selectedScenario?.exitCapRate || (capRateVal + 0.5);
  const noiAtSale = exitProj?.noi || (startingNOI * Math.pow(1.03, holdingPeriod));

  // Property coordinates for satellite map
  const rawLat = property?.lat ?? property?.latitude ?? scenarioData?.lat ?? scenarioData?.latitude;
  const rawLng = property?.lng ?? property?.longitude ?? scenarioData?.lng ?? scenarioData?.longitude;
  const hasRawCoords = rawLat != null && rawLng != null && !isNaN(Number(rawLat)) && !isNaN(Number(rawLng));

  // Geocode address if no coordinates available
  const [geocodedCoords, setGeocodedCoords] = useState(null);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);
  useEffect(() => {
    if (hasRawCoords || geocodeAttempted || !fullAddress) return;
    setGeocodeAttempted(true);
    (async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const data = await res.json();
        if (data?.[0]) {
          setGeocodedCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch (e) { /* silent fail */ }
    })();
  }, [hasRawCoords, geocodeAttempted, fullAddress]);

  const propLat = hasRawCoords ? Number(rawLat) : geocodedCoords?.lat;
  const propLng = hasRawCoords ? Number(rawLng) : geocodedCoords?.lng;
  const hasCoords = propLat != null && propLng != null && !isNaN(propLat) && !isNaN(propLng);

  // Flood zone data
  const [floodData, setFloodData] = useState(null);
  const [floodLoading, setFloodLoading] = useState(false);
  useEffect(() => {
    if (!hasCoords) return;
    setFloodLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.floodZone}?lat=${propLat}&lng=${propLng}`);
        if (res.ok) {
          const data = await res.json();
          setFloodData(data);
        }
      } catch (e) { /* silent fail */ }
      setFloodLoading(false);
    })();
  }, [hasCoords, propLat, propLng]);

  // Custom star marker for satellite map
  const starIcon = useMemo(() => L.divIcon({
    className: 'custom-star-icon',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="#4f46e5" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#fff" stroke-width="1.5"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }), []);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ═══════════════════════════════════════════════════════════════
          1. OVERVIEW — Compact KPIs + Purchase Price
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Overview" color={AC} />

        {/* KPI row — compact */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'IRR', value: `${irrVal.toFixed(1)}%`, tip: 'Internal Rate of Return — annualized return accounting for time value of money' },
            { label: 'Total Potential Profit', value: fmt(totalProfit), tip: 'Cumulative profit including cash flow, principal paydown, and sale proceeds' },
            { label: 'Cash on Cash Return', value: `${(isFinite(adjCocVal) ? adjCocVal : cocVal).toFixed(1)}%`, tip: 'Year 1 cash flow divided by total equity invested' },
            { label: 'Equity Multiple', value: `${equityMultiple.toFixed(2)}x`, tip: 'Total cash returned divided by total equity invested' },
          ].map((m, i) => (
            <div key={i} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: LB, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
                <Tip text={m.tip} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: VL, letterSpacing: '-0.02em' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Purchase Price slider — compact */}
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', border: `1px solid ${B}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: VL }}>Purchase Price</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.02em' }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: LB, fontWeight: 600 }}>$</span>
              <input
                type="text"
                value={purchasePrice.toLocaleString()}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                  handleChange('pricing_financing.purchase_price', v);
                  handleChange('pricing_financing.price', v);
                }}
                style={{ width: 180, padding: '10px 12px 10px 28px', fontSize: 18, fontWeight: 700, border: `2px solid ${AC}`, borderRadius: 8, outline: 'none', textAlign: 'center', color: VL, background: '#fff' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: LB, fontWeight: 600, minWidth: 75, textAlign: 'right' }}>{fmt(minPrice)}</span>
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
              style={{ flex: 1, accentColor: AC, height: 5 }}
            />
            <span style={{ fontSize: 11, color: LB, fontWeight: 600, minWidth: 75 }}>{fmt(maxPrice)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 14 }}>
            {[
              { label: '+ Create new LOI', action: () => navigate('/loi-generator') },
              { label: '+ Include Refinancing', action: () => { if (onTabChange) onTabChange('exit-strategy'); } },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} style={{ padding: '8px 18px', fontSize: 11, fontWeight: 600, color: VL, background: '#fff', border: `1px solid ${B}`, borderRadius: 6, cursor: 'pointer' }}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          1b. LOCATION & MARKET ANALYSIS — Satellite Map + Flood Zone
          ═══════════════════════════════════════════════════════════════ */}
      {fullAddress && (
        <div style={card}>
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px' }}>LOCATION & MARKET ANALYSIS</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: LB }}>📍</span>
              <span style={{ fontSize: 12, color: LB, fontWeight: 500 }}>{fullAddress}</span>
            </div>
          </div>

          {/* Satellite Map — Leaflet if coords available, Google Maps embed as fallback */}
          {hasCoords ? (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${B}`, height: 400 }}>
              <MapContainer 
                center={[propLat, propLng]} 
                zoom={15} 
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={false}
                zoomControl={true}
              >
                <TileLayer 
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="© Esri, Maxar, Earthstar Geographics" 
                />
                <Marker position={[propLat, propLng]} icon={starIcon} />
              </MapContainer>
            </div>
          ) : (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${B}`, height: 400 }}>
              <iframe
                title="Property Location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(fullAddress)}&maptype=satellite&zoom=15`}
              />
            </div>
          )}

          {/* Flood Zone Card */}
          <div style={{ marginTop: 16 }}>
            {floodLoading ? (
              <div style={{ borderRadius: 10, padding: '12px 16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 13, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                🌊 Loading flood zone data...
              </div>
            ) : floodData && floodData.status === 'ok' ? (() => {
              const risk = floodData.risk;
              const bgColor = risk === 'high-coastal' ? '#fef2f2' : risk === 'high' ? '#fffbeb' : '#f0fdf4';
              const borderColor = risk === 'high-coastal' ? '#fca5a5' : risk === 'high' ? '#fcd34d' : '#86efac';
              const badgeColor = risk === 'high-coastal' ? '#dc2626' : risk === 'high' ? '#d97706' : '#16a34a';
              const badgeBg = risk === 'high-coastal' ? '#fee2e2' : risk === 'high' ? '#fef3c7' : '#dcfce7';
              const riskLabel = risk === 'high-coastal' ? 'COASTAL HIGH RISK' : risk === 'high' ? 'HIGH RISK' : 'MINIMAL RISK';
              const bfe = floodData.base_flood_elevation != null ? `${floodData.base_flood_elevation} ft` : 'N/A';
              return (
                <div style={{ borderRadius: 10, padding: '16px 20px', backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 800, color: '#111827', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🌊 Flood Zone</span>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, backgroundColor: badgeBg, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{riskLabel}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>ZONE CODE</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{floodData.zone}</div>
                    </div>
                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>DESCRIPTION</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{floodData.zone_description || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>BASE FLOOD ELEV.</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{bfe}</div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div style={{ borderRadius: 10, padding: '12px 16px', backgroundColor: '#f9fafb', border: `1px solid ${B}`, fontSize: 13, color: LB, display: 'flex', alignItems: 'center', gap: 8 }}>
                🌊 {hasCoords ? 'No flood data available for this location' : 'Flood zone data requires coordinates'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          1c. DEAL OVERVIEW & FINANCIALS
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>DEAL OVERVIEW & FINANCIALS</h3>
        
        {/* Property Details + Transaction Details — side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          {/* Property Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${B}` }}>
              <span style={{ fontSize: 13 }}>🏢</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROPERTY DETAILS</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: LB, fontStyle: 'italic' }}>✏ to edit</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'PROPERTY NAME', value: propertyName || '—' },
                  { label: 'ADDRESS', value: fullAddress || '—' },
                  { label: 'ASSET TYPE', value: assetType },
                  { label: 'YEAR BUILT', value: yearBuilt || '—' },
                  { label: 'TOTAL UNITS', value: totalUnits || '—' },
                  { label: 'NET RENTABLE SF', value: netRentableSF ? netRentableSF.toLocaleString() : '—' },
                  { label: 'OCCUPANCY RATE', value: occupancyRate ? `${(occupancyRate * (occupancyRate < 1 ? 100 : 1)).toFixed(1)}%` : '—' },
                  { label: 'HOLDING PERIOD', value: `${holdingPeriod} Years` },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '7px 0', fontSize: 11, fontWeight: 600, color: LB, textTransform: 'uppercase' }}>{r.label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12, fontWeight: 600, color: VL, textAlign: 'right' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transaction Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${B}` }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TRANSACTION DETAILS</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: LB, fontStyle: 'italic' }}>✏ to edit</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'PURCHASE PRICE', value: fmt(purchasePrice), bold: false },
                  { label: 'PRICE PER SF', value: pricePerSF > 0 ? `$${Math.round(pricePerSF).toLocaleString()}` : '—', indent: true },
                  { label: 'PRICE PER UNIT', value: pricePerUnit > 0 ? `$${Math.round(pricePerUnit).toLocaleString()}` : '—', indent: true },
                  { label: 'CAPITAL IMPROVEMENTS', value: capitalImprovements > 0 ? fmt(capitalImprovements) : '—' },
                  { label: 'CLOSING COSTS', value: fmt(closingCosts) },
                  { label: 'ACQUISITION FEE', value: fmt(Math.round(acquisitionFee)) },
                  { label: 'LOAN FEES', value: fmt(Math.round(loanFees)) },
                  { label: 'FINANCING FEES', value: fmt(Math.round(financingFees)) },
                  { label: 'TOTAL INTEREST', value: fmt(Math.round(totalInterest > 0 ? totalInterest : 0)) },
                  { label: 'TOTAL PROJECT COST', value: fmt(Math.round(totalProjectCost)), highlight: true },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '7px 0', paddingLeft: r.indent ? 12 : 0, fontSize: 11, fontWeight: 600, color: r.highlight ? '#dc2626' : LB, textTransform: 'uppercase' }}>{r.label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12, fontWeight: r.highlight ? 800 : 600, color: r.highlight ? '#dc2626' : VL, textAlign: 'right' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${B}`, margin: '4px 0 16px' }} />

        {/* Returns — full width */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${B}` }}>
            <span style={{ fontSize: 13 }}>📈</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px' }}>RETURNS</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'PROJECT LEVEL LEVERED IRR', value: `${irrVal.toFixed(2)}%` },
                  { label: 'IN-PLACE CAP RATE', value: `${capRateVal.toFixed(2)}%` },
                  { label: 'EXIT CAP RATE', value: `${Number(exitCapRate).toFixed(2)}%` },
                  { label: 'DEBT COVERAGE RATIO', value: `${safeDscr.toFixed(2)}x` },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '7px 0', fontSize: 11, fontWeight: 600, color: LB, textTransform: 'uppercase' }}>{r.label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12, fontWeight: 600, color: VL, textAlign: 'right' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'NOI YEAR 1', value: fmt(startingNOI) },
                  { label: 'NOI AT SALE', value: fmt(Math.round(noiAtSale)) },
                  { label: 'LEVERED EQUITY MULTIPLE', value: `${equityMultiple.toFixed(2)}x` },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '7px 0', fontSize: 11, fontWeight: 600, color: LB, textTransform: 'uppercase' }}>{r.label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12, fontWeight: 600, color: VL, textAlign: 'right' }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {vaRentUpside > 0 && <FinRow label="+ Rent Optimization (Value-Add)" monthly={vaRentUpside / 12} yearly={vaRentUpside} dot="#4f46e5" />}
              {vaRubsRecovery > 0 && <FinRow label="+ RUBS Recovery (Value-Add)" monthly={vaRubsRecovery / 12} yearly={vaRubsRecovery} dot="#0ea5e9" />}
              <tr style={{ borderTop: `2px solid ${B}` }}>
                <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 800, color: '#16a34a' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }} />
                    Net Operating Income (NOI){vaTotalAdj > 0 ? ' ★' : ''}
                  </span>
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>{fmt(adjNOI / 12)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>{fmt(adjNOI)}</td>
              </tr>
              <FinRow label="Debt Service" monthly={debtServiceYear1 / 12} yearly={debtServiceYear1} dot="#dc2626" />
              <tr style={{ borderTop: `2px solid ${B}`, backgroundColor: adjCashFlow >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                <td style={{ padding: '12px 12px', fontSize: 14, fontWeight: 800, color: adjCashFlow >= 0 ? '#16a34a' : '#ef4444' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: adjCashFlow >= 0 ? '#16a34a' : '#ef4444', flexShrink: 0 }} />
                    Cash Flow (Bottom Line){vaTotalAdj > 0 ? ' ★' : ''}
                  </span>
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: adjCashFlow >= 0 ? '#16a34a' : '#ef4444', fontSize: 14 }}>{fmt(adjCashFlow / 12)}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: adjCashFlow >= 0 ? '#16a34a' : '#ef4444', fontSize: 14 }}>{fmt(adjCashFlow)}</td>
              </tr>
              {vaTotalAdj > 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '8px 12px', fontSize: 10, color: '#4f46e5', fontStyle: 'italic' }}>
                    ★ Includes value-add adjustments (+{fmt(vaTotalAdj)}/yr). Toggle in Value-Add tab.
                  </td>
                </tr>
              )}
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
              {/* NOI → Debt Service → Cash Flow bottom line */}
              <div style={{ marginTop: 14, borderTop: `2px solid ${B}`, paddingTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'NOI', value: adjNOI, color: '#16a34a' },
                    { label: 'Debt Service', value: debtServiceYear1, color: '#dc2626' },
                    { label: 'Cash Flow', value: adjCashFlow, color: adjCashFlow >= 0 ? '#16a34a' : '#ef4444' },
                  ].map((c, i) => (
                    <div key={i} style={{ background: i === 2 ? (adjCashFlow >= 0 ? '#f0fdf4' : '#fef2f2') : '#f9fafb', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${c.color}`, fontWeight: i === 2 ? 800 : 700 }}>
                      <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 4 }}>{c.label}:</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{fmt(c.value)}</div>
                    </div>
                  ))}
                </div>
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
              <span style={{ fontSize: 14, fontWeight: 800, color: adjCashFlow >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(adjCashFlow)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. PROJECT VALUATION — Cap Rate Sensitivity
          ═══════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <SectionHead title="Project Valuation" color={VL} />
        <p style={{ margin: '-8px 0 12px', fontSize: 12, color: LB, fontStyle: 'italic' }}>Implied property value at each cap rate (Value = NOI ÷ Cap Rate)</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: LB, fontSize: 12, borderBottom: `2px solid ${B}` }}>Cap Rate → Implied Value</th>
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
                { label: 'Net Sale Proceeds', value: netSalePrice, tip: 'Sale price minus selling costs at exit', negative: false },
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
                { label: 'Down Payment', value: downPayment, negative: false },
                { label: 'Closing Cost and Fees', value: closingCosts, tip: 'Estimated closing costs (legal, title, etc.)', negative: false },
                { label: 'CapEx / Renovation', value: capitalExpenditure, tip: 'Upfront capital improvements', negative: false },
              ].filter(r => r.value > 0).map((r, i) => (
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
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, color: VL, fontSize: 14 }}>{fmt(totalCashInvested)}</td>
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

      {/* ═══════════════════════════════════════════════════════════════
          8. GP / LP PARTNERSHIP RETURNS — Only shown when Equity Partner is active
          ═══════════════════════════════════════════════════════════════ */}
      {hasEquityPartner && partnershipReturns && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

          {/* GP Partnership Returns */}
          <div style={card}>
            <div style={{ background: '#3b5bdb', borderRadius: '12px 12px 0 0', margin: '-24px -28px 20px', padding: '14px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GP Partnership Returns</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'IRR', value: `${partnershipReturns.gpIRR.toFixed(2)}%` },
                  { label: 'Equity Multiple', value: `${partnershipReturns.gpEM.toFixed(2)}x` },
                  { label: 'Total Profit', value: fmt(partnershipReturns.gpProfit) },
                  { label: 'Distributions', value: fmt(partnershipReturns.gpDistributions) },
                  { label: 'Contributions', value: fmt(partnershipReturns.gpEquity) },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 500, color: LB }}>{r.label}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: VL, fontSize: 14 }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LP Partnership Returns */}
          <div style={card}>
            <div style={{ background: '#3b5bdb', borderRadius: '12px 12px 0 0', margin: '-24px -28px 20px', padding: '14px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LP Partnership Returns</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { label: 'IRR', value: `${partnershipReturns.lpIRR.toFixed(2)}%` },
                  { label: 'Equity Multiple', value: `${partnershipReturns.lpEM.toFixed(2)}x` },
                  { label: 'Total Profit', value: fmt(partnershipReturns.lpProfit) },
                  { label: 'Distributions', value: fmt(partnershipReturns.lpDistributions) },
                  { label: 'Contributions', value: fmt(partnershipReturns.lpEquity) },
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid #f3f4f6` }}>
                    <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 500, color: LB }}>{r.label}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: VL, fontSize: 14 }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          8b. EQUITY PARTNER STRUCTURE SUMMARY — Payout details
          ═══════════════════════════════════════════════════════════════ */}
      {hasEquityPartner && partnershipReturns && (
        <div style={card}>
          <SectionHead title="Equity Partner Structure" color={VL} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <div style={{ textAlign: 'center', padding: 14, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Partner Equity</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{fmt(partnershipReturns.lpEquity)}</div>
              <div style={{ fontSize: 10, color: LB, marginTop: 2 }}>{(partnershipReturns.lpPctOwnership * 100).toFixed(0)}% of equity</div>
            </div>
            <div style={{ textAlign: 'center', padding: 14, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Preferred Return</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: AC }}>{(partnershipReturns.prefReturnRate * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 10, color: LB, marginTop: 2 }}>{fmt(partnershipReturns.annualPref)}/yr</div>
            </div>
            <div style={{ textAlign: 'center', padding: 14, background: '#f9fafb', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Balloon Payout</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: partnershipReturns.isDoubleInvestment ? '#f97316' : '#22c55e' }}>{fmt(partnershipReturns.balloonPayout)}</div>
              <div style={{ fontSize: 10, color: LB, marginTop: 2 }}>Year {partnershipReturns.balloonYrs} · {partnershipReturns.isDoubleInvestment ? '2× Return' : '1× Return'}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 14, background: '#fef2f2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: LB, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total Partner Cost</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{fmt(partnershipReturns.totalPartnerCost)}</div>
              <div style={{ fontSize: 10, color: LB, marginTop: 2 }}>Pref + Balloon</div>
            </div>
          </div>

          {/* Ownership split bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Ownership Split</div>
            <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: `1px solid ${B}` }}>
              <div style={{ width: `${partnershipReturns.gpPctOwnership * 100}%`, background: '#3b5bdb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {(partnershipReturns.gpPctOwnership * 100).toFixed(0)}% GP
              </div>
              <div style={{ width: `${partnershipReturns.lpPctOwnership * 100}%`, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {(partnershipReturns.lpPctOwnership * 100).toFixed(0)}% LP
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
