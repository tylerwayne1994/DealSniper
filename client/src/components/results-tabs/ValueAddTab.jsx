/* eslint-disable */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ═══════════════════════════════════════════════════════════════════
// Default renovation line items — common multifamily value-add plays
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_RENO_ITEMS = [
  { id: 'kitchen', name: 'Kitchen Upgrade', costPerUnit: 5000 },
  { id: 'bathroom', name: 'Bathroom Refresh', costPerUnit: 3000 },
  { id: 'flooring', name: 'Flooring Replacement', costPerUnit: 2500 },
  { id: 'paint', name: 'Paint & Finishes', costPerUnit: 1500 },
  { id: 'appliances', name: 'New Appliances', costPerUnit: 2000 },
  { id: 'lighting', name: 'Lighting & Fixtures', costPerUnit: 800 },
  { id: 'hvac', name: 'HVAC / Mechanical', costPerUnit: 1200 },
  { id: 'windows', name: 'Windows & Doors', costPerUnit: 1800 },
  { id: 'exterior', name: 'Exterior / Curb Appeal', costPerUnit: 0, isCommon: true, totalCost: 50000 },
  { id: 'amenity', name: 'Amenity Improvements', costPerUnit: 0, isCommon: true, totalCost: 75000 },
  { id: 'security', name: 'Security / Access Control', costPerUnit: 0, isCommon: true, totalCost: 25000 },
];

const EXPENSE_OPT_ITEMS = [
  { id: 'insurance', name: 'Insurance Renegotiation', defaultSavingsPct: 15, expKey: 'insurance' },
  { id: 'tax_appeal', name: 'Property Tax Appeal', defaultSavingsPct: 10, expKey: 'taxes' },
  { id: 'management', name: 'Management Fee Reduction', defaultSavingsPct: 20, expKey: 'management' },
  { id: 'maintenance', name: 'Maintenance Contracts', defaultSavingsPct: 15, expKey: 'repairs_maintenance' },
  { id: 'energy', name: 'Energy Efficiency (LED, Low-Flow)', defaultSavingsPct: 25, expKey: 'utilities' },
  { id: 'landscaping', name: 'Landscape Contract', defaultSavingsPct: 10, expKey: 'landscaping' },
];

// ═══════════════════════════════════════════════════════════════════
// STABLE TOGGLE COMPONENT — defined outside to avoid remount on re-render
// ═══════════════════════════════════════════════════════════════════
const VToggle = ({ checked, onChange, color, accentColor }) => {
  const activeColor = color || accentColor || '#4f46e5';
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked); } }}
      style={{
        width: 40, height: 22,
        backgroundColor: checked ? activeColor : '#d1d5db',
        borderRadius: 11, padding: 2,
        cursor: 'pointer', display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div style={{
        width: 18, height: 18,
        backgroundColor: '#fff', borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STABLE SECTION TOGGLE — defined outside to avoid remount on re-render
// ═══════════════════════════════════════════════════════════════════
const SectionToggle = ({ title, icon, open, setOpen, badge, badgeColor }) => (
  <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>{title}</h3>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, color: badgeColor || '#10b981', background: `${badgeColor || '#10b981'}15`, padding: '2px 10px', borderRadius: 6, border: `1px solid ${badgeColor || '#10b981'}30` }}>{badge}</span>}
    </div>
    <span style={{ fontSize: 16, color: '#6b7280', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// VALUE-ADD TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ValueAddTab({
  scenarioData,
  fullCalcs,
  onFieldChange,
  rubsEnabled,
  setRubsEnabled,
  noiT12,
  marketCapRate,
  purchasePrice,
  annualDebtService,
  holdPeriod,
}) {
  // ── Local UI state ──
  const [renoOpen, setRenoOpen] = useState(true);
  const [expOptOpen, setExpOptOpen] = useState(true);
  const [leaseUpOpen, setLeaseUpOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);

  // ── Theme ──
  const vB = '#e5e7eb', vLB = '#6b7280', vVL = '#111827', vAC = '#4f46e5';
  const vSC = { backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${vB}` };
  const vFmt = (v) => { if (v == null || isNaN(v)) return '$0'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); };
  const vPct = (v) => { if (v == null || isNaN(v)) return '0.0%'; return `${Number(v).toFixed(2)}%`; };
  const vINP = { padding: '8px 12px', border: `1px solid ${vB}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };

  // ═════════════════════════════════════════════════════════════
  // CORE DATA — from fullCalcs & scenarioData
  // ═════════════════════════════════════════════════════════════
  const currentNOI = fullCalcs?.year1?.noi || noiT12;
  const currentPurchasePrice = purchasePrice || 0;
  const currentCapRate = fullCalcs?.year1?.capRate || 0;
  const currentDSCR = fullCalcs?.year1?.dscr || 0;
  const totalUnits = scenarioData?.property?.units || 0;
  const dsAnnual = annualDebtService || fullCalcs?.financing?.annualDebtService || 0;
  const totalCurrentExpenses = fullCalcs?.year1?.totalOperatingExpenses || 0;

  // Rent data
  const unitMix = scenarioData?.unit_mix || [];
  const totalCurrentMonthlyRent = unitMix.reduce((s, u) => s + ((u.units || 0) * (u.rent_current || 0)), 0);
  const avgCurrentRent = totalUnits > 0 ? totalCurrentMonthlyRent / totalUnits : 0;
  const totalMarketMonthlyRent = unitMix.reduce((s, u) => {
    const mr = u.rent_market && u.rent_market > 0 ? u.rent_market : u.rent_current || 0;
    return s + ((u.units || 0) * mr);
  }, 0);
  const avgMarketRent = totalUnits > 0 ? totalMarketMonthlyRent / totalUnits : 0;
  const rentUpside = totalMarketMonthlyRent - totalCurrentMonthlyRent;
  const totalAnnualRentUpside = rentUpside * 12;

  // Expenses breakdown
  const expenses = scenarioData?.expenses || {};

  // ═════════════════════════════════════════════════════════════
  // RUBS MODEL (existing logic preserved)
  // ═════════════════════════════════════════════════════════════
  const rubsConfig = scenarioData?.value_add?.rubs_config || {};
  const totalUtilityCost = expenses.utilities || 0;
  const utilityProportions = { water_sewer: 0.35, electric: 0.30, gas: 0.15, trash: 0.20 };
  const utilityLabels = { water_sewer: 'Water & Sewer', electric: 'Electric', gas: 'Gas', trash: 'Trash' };
  const defaultRecovery = { water_sewer: 90, electric: 85, gas: 85, trash: 95 };
  const totalPropertySqft = unitMix.reduce((s, u) => s + ((u.units || 0) * (u.sqft || u.avg_sqft || 800)), 0);
  const avgSqftPerUnit = totalUnits > 0 ? totalPropertySqft / totalUnits : 800;

  const utilityBreakdown = {};
  Object.entries(utilityProportions).forEach(([key, pct]) => {
    const customVal = rubsConfig[key]?.annual_cost;
    utilityBreakdown[key] = customVal != null && customVal > 0 ? customVal : Math.round(totalUtilityCost * pct);
  });
  const computedUtilityTotal = Object.values(utilityBreakdown).reduce((s, v) => s + v, 0);

  const rubsSchedule = Object.entries(utilityBreakdown).map(([utility, annualCost]) => {
    const cost = Number(annualCost) || 0;
    const cfg = rubsConfig[utility] || {};
    const lineEnabled = rubsEnabled && (cfg.enabled !== false);
    const method = cfg.split_method || 'per_unit';
    const recoveryPct = cfg.recovery_pct != null ? cfg.recovery_pct : (defaultRecovery[utility] || 90);
    const recoverableAnnual = cost * (recoveryPct / 100);
    let monthlyPerUnit = 0;
    if (lineEnabled && totalUnits > 0) {
      if (method === 'per_unit') monthlyPerUnit = recoverableAnnual / 12 / totalUnits;
      else if (method === 'by_sqft') monthlyPerUnit = (recoverableAnnual / 12 / (totalPropertySqft || 1)) * avgSqftPerUnit;
      else if (method === 'by_occupancy') {
        const occ = 1 - ((expenses.vacancy_pct || 5) / 100);
        const occUnits = Math.round(totalUnits * occ);
        monthlyPerUnit = occUnits > 0 ? recoverableAnnual / 12 / occUnits : 0;
      }
    }
    return { utility, label: utilityLabels[utility] || utility.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), annualCost: cost, monthlyCost: cost / 12, perUnitMonthly: totalUnits > 0 ? cost / 12 / totalUnits : 0, enabled: lineEnabled, method, recoveryPct, ownerRetainPct: 100 - recoveryPct, recoverableAnnual: lineEnabled ? recoverableAnnual : 0, ownerRetainedAnnual: lineEnabled ? cost - recoverableAnnual : cost, monthlyPerUnit, annualRecovery: lineEnabled ? monthlyPerUnit * totalUnits * 12 : 0 };
  });

  const totalRubsRecovery = rubsSchedule.reduce((s, r) => s + r.annualRecovery, 0);
  const totalMonthlyRubsPerUnit = rubsSchedule.reduce((s, r) => s + r.monthlyPerUnit, 0);
  const totalOwnerRetained = rubsSchedule.reduce((s, r) => s + r.ownerRetainedAnnual, 0);

  // ═════════════════════════════════════════════════════════════
  // RENOVATION BUDGET (NEW)
  // ═════════════════════════════════════════════════════════════
  const savedReno = scenarioData?.value_add?.renovations;
  const renoItems = useMemo(() => {
    return DEFAULT_RENO_ITEMS.map(d => {
      const saved = savedReno?.find(r => r.id === d.id);
      return saved ? { ...d, ...saved } : { ...d, enabled: false };
    });
  }, [savedReno]);

  const renoTimeline = scenarioData?.value_add?.renovation_timeline_months || 18;

  const updateReno = (id, changes) => {
    const items = renoItems.map(r => r.id === id ? { ...r, ...changes } : r);
    onFieldChange('value_add.renovations', items);
  };

  const totalRenoPerUnit = renoItems.filter(r => r.enabled && !r.isCommon).reduce((s, r) => s + (r.costPerUnit || 0), 0);
  const totalRenoCommon = renoItems.filter(r => r.enabled && r.isCommon).reduce((s, r) => s + (r.totalCost || 0), 0);
  const totalRenoBudget = (totalRenoPerUnit * totalUnits) + totalRenoCommon;

  // Per-unit ROI: renovation cost vs annual rent increase
  const renoROIByType = useMemo(() => {
    return unitMix.map(u => {
      const cr = u.rent_current || 0;
      const mr = u.rent_market || cr;
      const monthlyIncrease = mr - cr;
      const annualIncrease = monthlyIncrease * 12;
      const paybackMonths = totalRenoPerUnit > 0 && monthlyIncrease > 0 ? totalRenoPerUnit / monthlyIncrease : 0;
      const annualROI = totalRenoPerUnit > 0 ? (annualIncrease / totalRenoPerUnit) * 100 : 0;
      return { type: u.unit_type || u.type || u.bed_bath || 'Unit', units: u.units || 0, currentRent: cr, marketRent: mr, monthlyIncrease, annualIncrease, renoCost: totalRenoPerUnit, paybackMonths, annualROI };
    });
  }, [unitMix, totalRenoPerUnit]);



  // ═════════════════════════════════════════════════════════════
  // EXPENSE OPTIMIZATION (NEW)
  // ═════════════════════════════════════════════════════════════
  const expSavingsConfig = scenarioData?.value_add?.expense_savings || {};
  const expOptItems = EXPENSE_OPT_ITEMS.map(d => {
    const saved = expSavingsConfig[d.id];
    const currentAmount = expenses[d.expKey] || 0;
    const savingsPct = saved?.savings_pct ?? d.defaultSavingsPct;
    const enabled = saved?.enabled || false;
    const annualSavings = enabled ? Math.round(currentAmount * (savingsPct / 100)) : 0;
    return { ...d, currentAmount, savingsPct, enabled, annualSavings };
  });

  const updateExpOpt = (id, changes) => {
    const updated = { ...expSavingsConfig, [id]: { ...(expSavingsConfig[id] || {}), ...changes } };
    onFieldChange('value_add.expense_savings', updated);
  };

  const totalExpSavings = expOptItems.reduce((s, i) => s + i.annualSavings, 0);

  // ═════════════════════════════════════════════════════════════
  // LEASE-UP TIMELINE (NEW)
  // ═════════════════════════════════════════════════════════════
  const leaseUpConfig = scenarioData?.value_add?.lease_up || {};
  const currentOccPct = (() => {
    const raw = scenarioData?.property?.occupancy_rate || fullCalcs?.year1?.occupancyRate || 0.90;
    return raw <= 1 ? raw * 100 : raw;
  })();
  const targetOccPct = leaseUpConfig.target_occupancy || 95;
  const monthlyAbsorb = leaseUpConfig.monthly_absorb_units || 2;

  const updateLeaseUp = (changes) => {
    onFieldChange('value_add.lease_up', { ...leaseUpConfig, ...changes });
  };

  const leaseUpData = useMemo(() => {
    const currentOccUnits = Math.round(totalUnits * (currentOccPct / 100));
    const targetOccUnits = Math.round(totalUnits * (targetOccPct / 100));
    const gap = Math.max(targetOccUnits - currentOccUnits, 0);
    const monthsToStab = monthlyAbsorb > 0 && gap > 0 ? Math.ceil(gap / monthlyAbsorb) : 0;
    const points = [];
    for (let m = 0; m <= Math.max(monthsToStab + 6, 24); m++) {
      const occupied = Math.min(currentOccUnits + m * monthlyAbsorb, targetOccUnits);
      const occPct = totalUnits > 0 ? (occupied / totalUnits) * 100 : 0;
      const monthlyRev = occupied * avgMarketRent;
      points.push({ month: m, label: `M${m}`, occupied, occPct: Number(occPct.toFixed(1)), annualizedRevenue: monthlyRev * 12 });
      if (occupied >= targetOccUnits && m > monthsToStab + 3) break;
    }
    return { currentOccUnits, targetOccUnits, gap, monthsToStab, points };
  }, [currentOccPct, targetOccPct, monthlyAbsorb, totalUnits, avgMarketRent]);

  // ═════════════════════════════════════════════════════════════
  // STABILIZED METRICS (ENHANCED — includes all value-add sources)
  // ═════════════════════════════════════════════════════════════
  const mktCapRate = marketCapRate?.market_cap_rate ? (marketCapRate.market_cap_rate / 100) : (currentCapRate / 100 || 0.05);
  const totalNOILift = totalAnnualRentUpside + totalRubsRecovery + totalExpSavings;
  const stabilizedNOI = currentNOI + totalNOILift;
  const stabilizedValue = mktCapRate > 0 ? stabilizedNOI / mktCapRate : 0;
  const valueCreation = stabilizedValue - currentPurchasePrice;
  const netValueCreation = valueCreation - totalRenoBudget;
  const stabilizedDSCR = dsAnnual > 0 ? stabilizedNOI / dsAnnual : 0;

  // ═════════════════════════════════════════════════════════════
  // RENOVATION FINANCING CALCULATIONS
  // ═════════════════════════════════════════════════════════════
  const renoFinancing = useMemo(() => {
    const renoConfig = scenarioData?.renovation || scenarioData?.value_add?.renovation_finance || {};
    const financed = renoConfig.financed || false;
    const renoLtv = renoConfig.reno_ltv || 80;
    const renoRate = renoConfig.reno_interest_rate || 8.0;
    const renoTermYrs = renoConfig.reno_loan_term_years || 3;
    const renoIoMonths = renoConfig.reno_io_months || 6;

    if (!financed || totalRenoBudget <= 0) {
      return { financed: false, loanAmount: 0, equityNeeded: totalRenoBudget, monthlyPayment: 0, annualDebtService: 0, ioMonthlyPayment: 0 };
    }

    const loanAmount = totalRenoBudget * (renoLtv / 100);
    const equityNeeded = totalRenoBudget - loanAmount;
    const r = (renoRate / 100) / 12;
    const n = renoTermYrs * 12;
    const monthlyPayment = r > 0 && n > 0 ? (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
    const ioMonthlyPayment = loanAmount * r;

    return {
      financed: true,
      loanAmount,
      equityNeeded,
      monthlyPayment,
      annualDebtService: monthlyPayment * 12,
      ioMonthlyPayment,
      ioMonths: renoIoMonths,
      rate: renoRate,
      termYrs: renoTermYrs,
    };
  }, [scenarioData, totalRenoBudget]);

  // ═════════════════════════════════════════════════════════════
  // EXECUTION TIMELINE — Dynamic milestones based on deal data
  // ═════════════════════════════════════════════════════════════
  const holdYears = holdPeriod || scenarioData?.exit_details?.holdYrs || fullCalcs?.returns?.holdingPeriod || 5;
  const totalMonths = holdYears * 12;

  // EXIT-YEAR PROJECTIONS — NOI with appreciation & exit valuation
  const noiGrowthRate = (scenarioData?.exit_details?.growthPct || 3) / 100;
  const exitCapAdj = (scenarioData?.exit_details?.capAdj || 0) / 100;
  const exitCapRate = mktCapRate + exitCapAdj;
  const exitNOI = stabilizedNOI * Math.pow(1 + noiGrowthRate, holdYears);
  const exitValue = exitCapRate > 0 ? exitNOI / exitCapRate : 0;
  const exitAnnualCashflow = exitNOI - dsAnnual;

  // User-specified implementation months for each value-add strategy
  const renoStartMonth = scenarioData?.value_add?.reno_start_month || 1;
  const rentStartMonth = scenarioData?.value_add?.rent_start_month || Math.round(renoTimeline) || 12;
  const rubsStartMonth = scenarioData?.value_add?.rubs_start_month || 3;
  const expenseStartMonth = scenarioData?.value_add?.expense_start_month || 3;
  const leaseUpStartMonth = scenarioData?.value_add?.leaseup_start_month || 1;

  const timelineMilestones = useMemo(() => {
    const ms = [];
    const downPayment = currentPurchasePrice * ((100 - (scenarioData?.financing?.ltv || 75)) / 100);
    const renoMonths = renoTimeline || 12;
    const renoEndMonth = renoStartMonth + renoMonths;
    const monthsToStabilize = leaseUpData.monthsToStab || 0;
    const exitMonth = totalMonths;

    const stabilizedMonthlyNOI = stabilizedNOI / 12;

    // Stabilization = latest completion of all active strategies + buffer
    const allEndMonths = [
      totalRenoBudget > 0 ? renoEndMonth : 0,
      rentUpside > 0 ? rentStartMonth + 1 : 0,
      rubsEnabled && totalRubsRecovery > 0 ? rubsStartMonth + 1 : 0,
      totalExpSavings > 0 ? expenseStartMonth + 1 : 0,
      monthsToStabilize > 0 ? leaseUpStartMonth + monthsToStabilize : 0,
    ];
    const stabMonth = Math.max(...allEndMonths.filter(m => m > 0), 6) + 2;

    // 1. Acquisition
    ms.push({
      month: 0,
      label: 'Property Acquired',
      sublabel: 'Day 1',
      color: '#6366f1',
      above: true,
      metrics: [
        { label: 'Purchase Price', value: vFmt(currentPurchasePrice) },
        { label: 'Down Payment', value: vFmt(downPayment) },
      ],
    });

    // 2. Lease-Up Begins (if there's a gap to fill)
    if (monthsToStabilize > 0) {
      ms.push({
        month: leaseUpStartMonth,
        label: 'Lease-Up Begins',
        sublabel: `${leaseUpData.gap} units to fill`,
        color: '#0ea5e9',
        above: false,
        metrics: [
          { label: 'Current Occ.', value: `${currentOccPct.toFixed(1)}%` },
          { label: 'Duration', value: `${monthsToStabilize} months` },
        ],
      });
    }

    // 3. Renovation Begins (if budget > 0)
    if (totalRenoBudget > 0) {
      ms.push({
        month: renoStartMonth,
        label: 'Renovation Begins',
        sublabel: `Month ${renoStartMonth}–${renoEndMonth}`,
        color: '#f59e0b',
        above: renoStartMonth !== leaseUpStartMonth,
        metrics: [
          { label: 'Reno Budget', value: vFmt(totalRenoBudget) },
          { label: 'Duration', value: `${renoMonths} months` },
        ],
      });

      // Renovation Complete
      ms.push({
        month: renoEndMonth,
        label: 'Renovation Complete',
        sublabel: rentUpside > 0 ? 'Units Updated' : 'CapEx Complete',
        color: '#22c55e',
        above: true,
        metrics: [
          { label: 'Total Invested', value: vFmt(totalRenoBudget) },
          { label: 'Per Unit', value: vFmt(totalRenoPerUnit) },
        ],
      });
    }

    // 4. Rent Increase (if upside exists)
    if (rentUpside > 0) {
      ms.push({
        month: rentStartMonth,
        label: 'Rent Increases',
        sublabel: `New rents active Month ${rentStartMonth}`,
        color: '#22c55e',
        above: false,
        metrics: [
          { label: 'New Rent', value: `${vFmt(totalMarketMonthlyRent)}/mo` },
          { label: 'Rent Upside', value: `+${vFmt(rentUpside)}/mo` },
        ],
      });
    }

    // 5. RUBS (if active)
    if (rubsEnabled && totalRubsRecovery > 0) {
      ms.push({
        month: rubsStartMonth,
        label: 'RUBS Implemented',
        sublabel: `Billing starts Month ${rubsStartMonth}`,
        color: '#8b5cf6',
        above: rubsStartMonth !== rentStartMonth,
        metrics: [
          { label: 'RUBS Recovery', value: `${vFmt(Math.round(totalRubsRecovery / 12))}/mo` },
          { label: 'Annual Savings', value: `${vFmt(totalRubsRecovery)}/yr` },
        ],
      });
    }

    // 6. Expense Optimization (if active)
    if (totalExpSavings > 0) {
      ms.push({
        month: expenseStartMonth,
        label: 'Expense Optimization',
        sublabel: `Contracts renegotiated Month ${expenseStartMonth}`,
        color: '#8b5cf6',
        above: expenseStartMonth !== rubsStartMonth,
        metrics: [
          { label: 'Annual Savings', value: `${vFmt(totalExpSavings)}/yr` },
          { label: 'Monthly Save', value: `${vFmt(Math.round(totalExpSavings / 12))}/mo` },
        ],
      });
    }

    // 7. Stabilized — derived from latest strategy completion
    if (totalNOILift > 0 && stabMonth < exitMonth) {
      ms.push({
        month: Math.min(stabMonth, exitMonth - 3),
        label: 'Stabilized',
        sublabel: 'Full Pro Forma Achieved',
        color: '#0ea5e9',
        above: true,
        metrics: [
          { label: 'Monthly NOI', value: `${vFmt(Math.round(stabilizedMonthlyNOI))}` },
          { label: 'Cash Flow', value: `${vFmt(Math.round(stabilizedMonthlyNOI - (dsAnnual / 12)))}/mo` },
        ],
      });
    }

    // 8. Exit — shows projected exit-year NOI (with appreciation), property value, and cashflow
    ms.push({
      month: exitMonth,
      label: `${holdYears}-Year Exit`,
      sublabel: 'Refinance or Sale',
      color: '#6366f1',
      above: true,
      metrics: [
        { label: `Yr ${holdYears} NOI`, value: vFmt(Math.round(exitNOI)) },
        { label: 'Exit Value', value: vFmt(Math.round(exitValue)) },
        { label: `Yr ${holdYears} Cashflow`, value: vFmt(Math.round(exitAnnualCashflow)) },
      ],
    });

    // Sort milestones by month
    ms.sort((a, b) => a.month - b.month);
    // Alternate above/below for overlapping months
    for (let i = 1; i < ms.length; i++) {
      if (ms[i].month === ms[i - 1].month) ms[i].above = !ms[i - 1].above;
    }

    return ms;
  }, [currentPurchasePrice, scenarioData, totalRenoBudget, renoTimeline, renoStartMonth,
      rentStartMonth, rubsStartMonth, expenseStartMonth, leaseUpStartMonth,
      totalMonths, holdYears, rentUpside, totalMarketMonthlyRent, totalRenoPerUnit,
      rubsEnabled, totalRubsRecovery, totalExpSavings, currentNOI, stabilizedNOI,
      dsAnnual, totalNOILift, leaseUpData, stabilizedValue, valueCreation,
      exitNOI, exitValue, exitAnnualCashflow,
      currentOccPct, currentPurchasePrice]);

  // ═════════════════════════════════════════════════════════════
  // ANIMATED TIMELINE STATE
  // ═════════════════════════════════════════════════════════════
  const LOOP_DURATION_MS = 14000;
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef(null);
  const pausedProgressRef = useRef(0);

  useEffect(() => {
    if (!timelineOpen || isPaused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    // Resume from where we paused
    startTimeRef.current = Date.now() - (pausedProgressRef.current * LOOP_DURATION_MS);
    const tick = () => {
      const now = Date.now();
      const loopProgress = ((now - startTimeRef.current) % LOOP_DURATION_MS) / LOOP_DURATION_MS;
      setTimelineProgress(loopProgress);
      pausedProgressRef.current = loopProgress;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timelineOpen, isPaused]);

  const handleReplay = useCallback(() => {
    pausedProgressRef.current = 0;
    setTimelineProgress(0);
    setIsPaused(false);
    startTimeRef.current = Date.now();
  }, []);

  // Eased progress gives a more readable sweep
  const eased = timelineProgress < 0.5
    ? 2 * timelineProgress * timelineProgress
    : 1 - Math.pow(-2 * timelineProgress + 2, 2) / 2;
  const currentTimelineMonth = eased * totalMonths;
  const timelineProgressPct = (currentTimelineMonth / totalMonths) * 100;
  const tlPct = (month) => (month / totalMonths) * 100;

  // ── Collision-resolved card positions (prevents overlapping) ──
  const { aboveCards, belowCards } = useMemo(() => {
    const MIN_GAP = 18; // minimum % gap between card centers
    const resolve = (cards) => {
      const sorted = cards
        .map(ms => ({ ...ms, adjustedPct: Math.max(6, Math.min(94, (ms.month / totalMonths) * 100)) }))
        .sort((a, b) => a.adjustedPct - b.adjustedPct);
      for (let pass = 0; pass < 12; pass++) {
        let moved = false;
        for (let i = 1; i < sorted.length; i++) {
          const gap = sorted[i].adjustedPct - sorted[i - 1].adjustedPct;
          if (gap < MIN_GAP) {
            const push = (MIN_GAP - gap) / 2 + 0.5;
            sorted[i - 1].adjustedPct = Math.max(4, sorted[i - 1].adjustedPct - push);
            sorted[i].adjustedPct = Math.min(96, sorted[i].adjustedPct + push);
            moved = true;
          }
        }
        if (!moved) break;
      }
      return sorted;
    };
    return {
      aboveCards: resolve(timelineMilestones.filter(ms => ms.above)),
      belowCards: resolve(timelineMilestones.filter(ms => !ms.above)),
    };
  }, [timelineMilestones, totalMonths]);

  // Year marks for timeline
  const yearMarks = useMemo(() => {
    const marks = [];
    for (let y = 0; y <= holdYears; y++) marks.push(y * 12);
    return marks;
  }, [holdYears]);

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: 24, backgroundColor: '#f3f4f6' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ═══════════════════════════════════════════════════════
            0. BEFORE / AFTER VISUAL SUMMARY
            ═══════════════════════════════════════════════════════ */}
        <div style={{ ...vSC, border: '2px solid #10b981', background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: vVL }}>Value-Add Transformation</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: vLB }}>Before → After comparison across all value-add strategies</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'stretch' }}>
            {/* Before */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: `1px solid ${vB}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Current (As-Is)</div>
              {[
                { label: 'NOI', value: vFmt(currentNOI) },
                { label: 'Property Value', value: vFmt(currentPurchasePrice) },
                { label: 'Cap Rate', value: vPct(currentCapRate) },
                { label: 'DSCR', value: `${currentDSCR.toFixed(2)}x` },
                { label: 'Monthly Rent', value: `${vFmt(totalCurrentMonthlyRent)}/mo` },
                { label: 'Cash Flow', value: vFmt(currentNOI - dsAnnual) },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 5 ? `1px solid #f3f4f6` : 'none' }}>
                  <span style={{ fontSize: 12, color: vLB, fontWeight: 600 }}>{r.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: vVL }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 8 }}>
              <div style={{ fontSize: 28, color: '#10b981' }}>→</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textAlign: 'center', lineHeight: 1.3 }}>VALUE<br/>ADD</div>
            </div>

            {/* After */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '2px solid #10b981' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Stabilized (Pro Forma)</div>
              {[
                { label: 'NOI', value: vFmt(stabilizedNOI), delta: totalNOILift },
                { label: 'Property Value', value: vFmt(stabilizedValue), delta: valueCreation },
                { label: 'Cap Rate', value: vPct(currentPurchasePrice > 0 ? (stabilizedNOI / currentPurchasePrice * 100) : 0), delta: currentPurchasePrice > 0 ? (stabilizedNOI / currentPurchasePrice * 100 - currentCapRate) : 0, isPct: true },
                { label: 'DSCR', value: `${stabilizedDSCR.toFixed(2)}x`, delta: stabilizedDSCR - currentDSCR, isRatio: true },
                { label: 'Monthly Rent', value: `${vFmt(totalMarketMonthlyRent)}/mo`, delta: rentUpside },
                { label: 'Cash Flow', value: vFmt(stabilizedNOI - dsAnnual), delta: totalNOILift },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 5 ? `1px solid #f3f4f6` : 'none' }}>
                  <span style={{ fontSize: 12, color: vLB, fontWeight: 600 }}>{r.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: vVL }}>{r.value}</span>
                    {r.delta !== 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: r.delta > 0 ? '#10b981' : '#ef4444', background: r.delta > 0 ? '#ecfdf5' : '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>
                        {r.delta > 0 ? '↑' : '↓'} {r.isPct ? `${Math.abs(r.delta).toFixed(2)}%` : r.isRatio ? `${Math.abs(r.delta).toFixed(2)}` : vFmt(Math.abs(r.delta))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Total NOI Lift', value: vFmt(totalNOILift), color: '#10b981' },
              { label: 'Renovation Budget', value: vFmt(totalRenoBudget), color: '#f59e0b' },
              { label: 'Value Creation', value: vFmt(valueCreation), color: vAC },
              { label: 'Net Value (After Reno)', value: vFmt(netValueCreation), color: netValueCreation >= 0 ? '#10b981' : '#ef4444' },
            ].map((c, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: `1px solid ${vB}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            1. VALUE CREATION CALCULATOR (enhanced)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: vVL }}>Property Value Creation Calculator</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: vLB }}>Calculate potential value creation from all value-add strategies</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginTop: 20, marginBottom: 20 }}>
            {[
              { label: '% Rent Increase', val: avgMarketRent > 0 && avgCurrentRent > 0 ? ((avgMarketRent - avgCurrentRent) / avgCurrentRent * 100).toFixed(1) : '0', suffix: '%' },
              { label: 'Avg. Rent', val: Math.round(avgCurrentRent), suffix: '/mo' },
              { label: 'Units', val: totalUnits, suffix: 'units' },
              { label: '% Vacancy', val: (expenses.vacancy_pct || 5).toFixed(0), suffix: '%' },
              { label: 'Exp. Ratio', val: (totalCurrentExpenses > 0 && currentNOI + totalCurrentExpenses > 0 ? (totalCurrentExpenses / (currentNOI + totalCurrentExpenses) * 100) : 0).toFixed(0), suffix: '%' },
              { label: 'Cap Rate', val: (mktCapRate * 100).toFixed(2), suffix: '%' },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, fontWeight: 600, color: vLB, marginBottom: 6 }}>{f.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: `1px solid ${vB}`, borderRadius: 8, background: '#f9fafb' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: vVL }}>{f.val}</span>
                  <span style={{ fontSize: 11, color: vLB }}>{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Annual Revenue Increase', val: totalAnnualRentUpside + totalRubsRecovery, color: vAC },
              { label: 'Expense Savings', val: totalExpSavings, color: '#f59e0b' },
              { label: 'Total NOI Impact', val: totalNOILift, color: '#10b981' },
              { label: 'Estimated Value Add', val: valueCreation, color: vVL },
            ].map((c, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '20px 24px', textAlign: 'center', border: `1px solid ${vB}` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{vFmt(c.val)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: vLB, marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            2. RENT OPTIMIZATION (existing)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: vVL }}>Rent Optimization</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', padding: '6px 12px', borderRadius: 8, border: `1px solid ${vB}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: vLB }}>Starts Month</span>
              <input type="number" min={1} max={totalMonths} value={scenarioData?.value_add?.rent_start_month || Math.round(renoTimeline) || 12}
                onChange={e => onFieldChange('value_add.rent_start_month', Math.max(1, Math.min(totalMonths, parseInt(e.target.value) || 1)))}
                style={{ ...vINP, width: 55, textAlign: 'center', fontSize: 13, fontWeight: 700 }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Unit Type', 'Units', 'Avg Sqft', 'Current Rent', 'Market Rent', 'Raise / Unit', 'Annual Upside'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Unit Type' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `2px solid ${vB}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unitMix.map((unit, idx) => {
                  const cr = unit.rent_current || 0;
                  const mr = unit.rent_market || cr;
                  const raise = mr - cr;
                  const annUp = raise * (unit.units || 0) * 12;
                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${vB}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: vVL }}>{unit.unit_type || unit.type || unit.bed_bath || `Unit ${idx + 1}`}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: vLB }}>{unit.units || 0}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: vLB }}>{(unit.sqft || unit.avg_sqft || 0) > 0 ? (unit.sqft || unit.avg_sqft).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{vFmt(cr)}/mo</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <input type="number" value={mr} onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          const updated = [...unitMix];
                          updated[idx] = { ...updated[idx], rent_market: v };
                          onFieldChange('unit_mix', updated);
                        }} style={{ ...vINP, width: 100 }} />
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: raise > 0 ? '#16a34a' : raise < 0 ? '#ef4444' : vVL }}>{raise >= 0 ? '+' : ''}{vFmt(raise)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: annUp > 0 ? '#16a34a' : vVL }}>{vFmt(annUp)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: '#f8fafc', borderTop: `2px solid ${vB}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 800, color: vVL }}>Total</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{totalUnits}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: vLB }}>{totalPropertySqft > 0 ? totalPropertySqft.toLocaleString() : '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{vFmt(totalCurrentMonthlyRent)}/mo</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{vFmt(totalMarketMonthlyRent)}/mo</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: rentUpside > 0 ? '#16a34a' : vVL }}>+{vFmt(rentUpside)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{vFmt(totalAnnualRentUpside)}/yr</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            3. RENOVATION BUDGET & PER-UNIT ROI (NEW)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <SectionToggle title="Renovation / CapEx Budget" open={renoOpen} setOpen={setRenoOpen}
            badge={totalRenoBudget > 0 ? vFmt(totalRenoBudget) : null} badgeColor="#f59e0b" />

          {renoOpen && (
            <div style={{ marginTop: 20 }}>
              {/* Timeline + Start Month */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: '#f9fafb', padding: '12px 16px', borderRadius: 10, border: `1px solid ${vB}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: vLB }}>Starts Month</span>
                  <input type="number" min={1} max={totalMonths} value={scenarioData?.value_add?.reno_start_month || 1}
                    onChange={e => onFieldChange('value_add.reno_start_month', Math.max(1, Math.min(totalMonths, parseInt(e.target.value) || 1)))}
                    style={{ ...vINP, width: 55, textAlign: 'center', fontSize: 13, fontWeight: 700 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: vVL }}>Duration</span>
                  <input type="range" min={3} max={36} step={1} value={renoTimeline}
                    onChange={e => onFieldChange('value_add.renovation_timeline_months', parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#f59e0b', height: 5 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', minWidth: 80 }}>{renoTimeline} months</span>
                </div>
              </div>

              {/* Interior renovation items */}
              <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Interior Renovations (per unit)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#eef2ff' }}>
                    {['', 'Item', 'Cost / Unit', 'Total Cost', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 || i === 4 ? 'center' : (i >= 2 ? 'right' : 'left'), fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', borderBottom: '2px solid #c7d2fe', width: i === 0 ? 50 : i === 4 ? 50 : 'auto' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renoItems.filter(r => !r.isCommon).map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${vB}`, opacity: item.enabled ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <VToggle checked={item.enabled} onChange={v => updateReno(item.id, { enabled: v })} color="#f59e0b" />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: vVL }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="number" value={item.costPerUnit} onChange={e => updateReno(item.id, { costPerUnit: parseInt(e.target.value) || 0 })}
                          style={{ ...vINP, width: 90, fontSize: 12, padding: '4px 6px' }} disabled={!item.enabled} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: item.enabled ? '#f59e0b' : vLB }}>
                        {item.enabled ? vFmt(item.costPerUnit * totalUnits) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: vLB }}>{item.enabled ? `${totalUnits} units` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Common area items */}
              <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Common Area / Property-Wide</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <tbody>
                  {renoItems.filter(r => r.isCommon).map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${vB}`, opacity: item.enabled ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', width: 50 }}>
                        <VToggle checked={item.enabled} onChange={v => updateReno(item.id, { enabled: v })} color="#f59e0b" />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: vVL }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input type="number" value={item.totalCost || 0} onChange={e => updateReno(item.id, { totalCost: parseInt(e.target.value) || 0 })}
                          style={{ ...vINP, width: 120, fontSize: 12, padding: '4px 6px' }} disabled={!item.enabled} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: item.enabled ? '#f59e0b' : vLB }}>
                        {item.enabled ? vFmt(item.totalCost || 0) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Renovation Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Interior / Unit', value: vFmt(totalRenoPerUnit), color: '#f59e0b' },
                  { label: 'Interior Total', value: vFmt(totalRenoPerUnit * totalUnits), color: '#f59e0b' },
                  { label: 'Common Area', value: vFmt(totalRenoCommon), color: '#f97316' },
                  { label: 'Total Budget', value: vFmt(totalRenoBudget), color: vVL },
                ].map((c, i) => (
                  <div key={i} style={{ background: i === 3 ? '#eef2ff' : '#f9fafb', borderRadius: 10, padding: '14px 16px', border: `1px solid ${i === 3 ? '#c7d2fe' : vB}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Renovation Financing Toggle */}
              {totalRenoBudget > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Renovation Financing</div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div
                      onClick={() => onFieldChange('renovation.financed', false)}
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                        border: !renoFinancing.financed ? '2px solid #f59e0b' : `1px solid ${vB}`,
                        background: !renoFinancing.financed ? '#eef2ff' : '#fff',
                        color: !renoFinancing.financed ? '#3730a3' : vLB,
                        fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      Cash (No Loan)
                    </div>
                    <div
                      onClick={() => onFieldChange('renovation.financed', true)}
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                        border: renoFinancing.financed ? '2px solid #f59e0b' : `1px solid ${vB}`,
                        background: renoFinancing.financed ? '#eef2ff' : '#fff',
                        color: renoFinancing.financed ? '#3730a3' : vLB,
                        fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      Financed (Reno Loan)
                    </div>
                  </div>

                  {renoFinancing.financed && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>LTV %</div>
                          <input type="number" value={scenarioData?.renovation?.reno_ltv || 80}
                            onChange={e => onFieldChange('renovation.reno_ltv', parseFloat(e.target.value) || 0)}
                            style={{ ...vINP, width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>Interest Rate</div>
                          <input type="number" step="0.1" value={scenarioData?.renovation?.reno_interest_rate || 8.0}
                            onChange={e => onFieldChange('renovation.reno_interest_rate', parseFloat(e.target.value) || 0)}
                            style={{ ...vINP, width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>Term (yrs)</div>
                          <input type="number" value={scenarioData?.renovation?.reno_loan_term_years || 3}
                            onChange={e => onFieldChange('renovation.reno_loan_term_years', parseInt(e.target.value) || 0)}
                            style={{ ...vINP, width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>IO Period (mo)</div>
                          <input type="number" value={scenarioData?.renovation?.reno_io_months || 6}
                            onChange={e => onFieldChange('renovation.reno_io_months', parseInt(e.target.value) || 0)}
                            style={{ ...vINP, width: '100%' }} />
                        </div>
                      </div>

                      {/* Reno Financing Summary Card */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
                        background: '#eef2ff', borderRadius: 10, padding: '16px 18px', border: '1px solid #c7d2fe',
                      }}>
                        {[
                          { label: 'Reno Loan', value: vFmt(renoFinancing.loanAmount), color: '#3730a3' },
                          { label: 'Equity Needed', value: vFmt(renoFinancing.equityNeeded), color: '#4338ca' },
                          { label: 'Monthly Payment', value: `${vFmt(Math.round(renoFinancing.monthlyPayment))}/mo`, color: '#ef4444' },
                          { label: 'Addl. Annual Debt', value: `${vFmt(Math.round(renoFinancing.annualDebtService))}/yr`, color: '#ef4444' },
                        ].map((c, i) => (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Per-Unit Renovation ROI Table */}
              {renoROIByType.length > 0 && totalRenoPerUnit > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Per-Unit Renovation ROI</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Unit Type', 'Units', 'Reno Cost/Unit', 'Rent Increase', 'Payback', 'Annual ROI'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Unit Type' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', borderBottom: `2px solid ${vB}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {renoROIByType.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${vB}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: vVL }}>{r.type}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: vLB }}>{r.units}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{vFmt(r.renoCost)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: r.monthlyIncrease > 0 ? '#16a34a' : vLB }}>
                            {r.monthlyIncrease > 0 ? `+${vFmt(r.monthlyIncrease)}/mo` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: r.paybackMonths > 0 && r.paybackMonths <= 24 ? '#16a34a' : r.paybackMonths > 24 ? '#f59e0b' : vLB }}>
                            {r.paybackMonths > 0 ? `${r.paybackMonths.toFixed(0)} mo` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: r.annualROI >= 15 ? '#16a34a' : r.annualROI > 0 ? '#f59e0b' : vLB }}>
                            {r.annualROI > 0 ? `${r.annualROI.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            5. RUBS (existing - preserved)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: vVL }}>RUBS — Ratio Utility Billing System</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: vLB }}>Owner pays master utility bills → tenants reimburse proportionally</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', padding: '5px 10px', borderRadius: 8, border: `1px solid ${vB}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: vLB }}>Starts Mo.</span>
                <input type="number" min={1} max={totalMonths} value={scenarioData?.value_add?.rubs_start_month || 3}
                  onChange={e => onFieldChange('value_add.rubs_start_month', Math.max(1, Math.min(totalMonths, parseInt(e.target.value) || 1)))}
                  style={{ ...vINP, width: 50, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
              </div>
              <div style={{ textAlign: 'right', marginRight: 8 }}>
                <div style={{ fontSize: 11, color: vLB }}>Implement RUBS</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: rubsEnabled ? vAC : vLB }}>{rubsEnabled ? 'ON' : 'OFF'}</div>
              </div>
              <VToggle checked={rubsEnabled} onChange={(v) => { setRubsEnabled(v); onFieldChange('value_add.rubs_enabled', v); }} />
            </div>
          </div>

          {/* Current Utility Costs */}
          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Current Utility Costs</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {rubsSchedule.map((row) => (
                <div key={row.utility} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: `1px solid ${vB}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{row.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: vVL }}>{vFmt(row.annualCost)}<span style={{ fontSize: 10, color: vLB }}>/yr</span></div>
                  <div style={{ fontSize: 11, color: vLB, marginTop: 2 }}>{vFmt(Math.round(row.monthlyCost))}/mo</div>
                  <div style={{ fontSize: 10, color: vLB }}>{vFmt(Math.round(row.perUnitMonthly))}/unit/mo</div>
                </div>
              ))}
              <div style={{ background: computedUtilityTotal > 0 ? '#eef2ff' : '#f8fafc', borderRadius: 10, padding: '12px 14px', border: `1px solid ${computedUtilityTotal > 0 ? '#c7d2fe' : vB}`, textAlign: 'center' }}>

                <div style={{ fontSize: 10, fontWeight: 700, color: computedUtilityTotal > 0 ? '#4338ca' : vLB, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: computedUtilityTotal > 0 ? '#4338ca' : vVL }}>{vFmt(computedUtilityTotal)}<span style={{ fontSize: 10, color: vLB }}>/yr</span></div>
                <div style={{ fontSize: 11, color: vLB, marginTop: 2 }}>{vFmt(Math.round(computedUtilityTotal / 12))}/mo</div>
                <div style={{ fontSize: 10, color: vLB }}>{totalUnits > 0 ? vFmt(Math.round(computedUtilityTotal / 12 / totalUnits)) : '$0'}/unit/mo</div>
              </div>
            </div>
            {totalUtilityCost === 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#eef2ff', borderRadius: 8, border: '1px solid #c7d2fe', fontSize: 11, color: '#3730a3' }}>
                No utility costs found. Enter utility costs in the Expenses tab or manually adjust values here.
              </div>
            )}
          </div>

          {/* RUBS Billing Table */}
          {rubsEnabled && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>RUBS Billing Schedule</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#eef2ff' }}>
                      {['Utility', 'Annual Cost', 'Enabled', 'Allocation', 'Recovery %', 'RUBS / Unit / Mo', 'Annual Recovery', 'Owner Retains'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Utility' ? 'left' : (h === 'Enabled' || h === 'Allocation' ? 'center' : 'right'), fontSize: 10, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #c7d2fe', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rubsSchedule.map((row) => (
                      <tr key={row.utility} style={{ borderBottom: `1px solid ${vB}`, opacity: row.enabled ? 1 : 0.5 }}>
                        <td style={{ padding: '12px 12px', fontWeight: 600, color: vVL }}>{row.label}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <input type="number" value={row.annualCost} onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            onFieldChange('value_add.rubs_config', { ...rubsConfig, [row.utility]: { ...rubsConfig[row.utility], annual_cost: v } });
                          }} style={{ ...vINP, width: 90, fontSize: 12, padding: '4px 6px' }} />
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          <VToggle checked={row.enabled} onChange={checked => {
                            onFieldChange('value_add.rubs_config', { ...rubsConfig, [row.utility]: { ...rubsConfig[row.utility], enabled: checked, split_method: rubsConfig[row.utility]?.split_method || 'per_unit', recovery_pct: rubsConfig[row.utility]?.recovery_pct ?? (defaultRecovery[row.utility] || 90) } });
                          }} />
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                          {row.enabled ? (
                            <select value={row.method} onChange={e => {
                              onFieldChange('value_add.rubs_config', { ...rubsConfig, [row.utility]: { ...rubsConfig[row.utility], split_method: e.target.value } });
                            }} style={{ padding: '4px 8px', border: `1px solid ${vB}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: vVL, background: '#f9fafb', cursor: 'pointer' }}>
                              <option value="per_unit">Per Unit</option>
                              <option value="by_sqft">By Sqft</option>
                              <option value="by_occupancy">By Occupancy</option>
                            </select>
                          ) : <span style={{ fontSize: 11, color: vLB }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          {row.enabled ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <input type="number" min="0" max="100" value={row.recoveryPct} onChange={e => {
                                const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                onFieldChange('value_add.rubs_config', { ...rubsConfig, [row.utility]: { ...rubsConfig[row.utility], recovery_pct: v } });
                              }} style={{ ...vINP, width: 55, fontSize: 12, padding: '4px 6px' }} />
                              <span style={{ fontSize: 11, color: vLB }}>%</span>
                            </div>
                          ) : <span style={{ fontSize: 11, color: vLB }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: row.enabled ? vAC : vLB }}>{row.enabled ? `$${row.monthlyPerUnit.toFixed(0)}` : '—'}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: row.enabled ? '#16a34a' : vLB }}>{row.enabled ? vFmt(Math.round(row.annualRecovery)) : '—'}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: vLB }}>{vFmt(Math.round(row.ownerRetainedAnnual))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#eef2ff', borderTop: '2px solid #c7d2fe' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 800, color: '#4338ca' }}>Total</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#4338ca' }}>{vFmt(computedUtilityTotal)}</td>
                      <td colSpan={3} />
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: vAC }}>${totalMonthlyRubsPerUnit.toFixed(0)}/unit</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{vFmt(Math.round(totalRubsRecovery))}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: vLB }}>{vFmt(Math.round(totalOwnerRetained))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* RUBS Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 20 }}>
            {[
              { label: 'RUBS / Unit / Mo', val: `$${rubsEnabled ? totalMonthlyRubsPerUnit.toFixed(0) : '0'}`, sub: 'Added to tenant bill monthly', on: rubsEnabled, color: '#4338ca' },
              { label: 'Annual RUBS Recovery', val: rubsEnabled ? vFmt(Math.round(totalRubsRecovery)) : '$0', sub: 'Reduces owner utility expense', on: rubsEnabled, color: '#166534' },
              { label: 'Owner Retains', val: rubsEnabled ? vFmt(Math.round(totalOwnerRetained)) : vFmt(computedUtilityTotal), sub: 'Common area + unrecovered %', on: false },
              { label: 'Effective Recovery Rate', val: rubsEnabled && computedUtilityTotal > 0 ? `${(totalRubsRecovery / computedUtilityTotal * 100).toFixed(0)}%` : '0%', sub: 'Of total utility spend recovered', on: rubsEnabled && totalRubsRecovery > 0, color: '#16a34a' },
            ].map((c, i) => (
              <div key={i} style={{ background: c.on ? `${c.color || vAC}08` : '#f8fafc', borderRadius: 10, padding: '16px 18px', border: `1px solid ${c.on ? `${c.color || vAC}30` : vB}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.on ? (c.color || vAC) : vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.on ? (c.color || vAC) : vLB }}>{c.val}</div>
                <div style={{ fontSize: 10, color: vLB, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            6. EXPENSE OPTIMIZATION (NEW)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <SectionToggle title="Expense Optimization" open={expOptOpen} setOpen={setExpOptOpen}
            badge={totalExpSavings > 0 ? `−${vFmt(totalExpSavings)}/yr` : null} badgeColor="#f59e0b" />

          {expOptOpen && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 12, color: vLB }}>Model expense reductions from renegotiated contracts, tax appeals, and operational efficiencies.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', padding: '5px 10px', borderRadius: 8, border: `1px solid ${vB}`, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: vLB }}>Starts Mo.</span>
                  <input type="number" min={1} max={totalMonths} value={scenarioData?.value_add?.expense_start_month || 3}
                    onChange={e => onFieldChange('value_add.expense_start_month', Math.max(1, Math.min(totalMonths, parseInt(e.target.value) || 1)))}
                    style={{ ...vINP, width: 50, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#eef2ff' }}>
                    {['', 'Category', 'Current Cost', 'Savings %', 'Annual Savings'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: i <= 1 ? (i === 0 ? 'center' : 'left') : 'right', fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', borderBottom: '2px solid #c7d2fe', width: i === 0 ? 50 : 'auto' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expOptItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${vB}`, opacity: item.enabled ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <VToggle checked={item.enabled} onChange={v => updateExpOpt(item.id, { enabled: v })} color="#f59e0b" />
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: vVL }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: vLB }}>{vFmt(item.currentAmount)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <input type="number" min={0} max={100} value={item.savingsPct} onChange={e => updateExpOpt(item.id, { savings_pct: Math.min(100, parseInt(e.target.value) || 0) })}
                            style={{ ...vINP, width: 55, fontSize: 12, padding: '4px 6px' }} disabled={!item.enabled} />
                          <span style={{ fontSize: 11, color: vLB }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: item.enabled && item.annualSavings > 0 ? '#16a34a' : vLB }}>
                        {item.enabled ? `−${vFmt(item.annualSavings)}` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#eef2ff', borderTop: '2px solid #c7d2fe' }}>
                    <td colSpan={2} style={{ padding: '12px 12px', fontWeight: 800, color: vVL }}>Total Expense Savings</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: vLB }}>{vFmt(totalCurrentExpenses)}</td>
                    <td />
                    <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>−{vFmt(totalExpSavings)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            7. LEASE-UP TIMELINE (NEW)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <SectionToggle title="Lease-Up / Absorption Timeline" open={leaseUpOpen} setOpen={setLeaseUpOpen}
            badge={leaseUpData.monthsToStab > 0 ? `${leaseUpData.monthsToStab} mo to stabilize` : 'Stabilized'} badgeColor="#0ea5e9" />

          {leaseUpOpen && (
            <div style={{ marginTop: 20 }}>
              {/* Start month */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#f9fafb', padding: '8px 14px', borderRadius: 8, border: `1px solid ${vB}`, width: 'fit-content' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: vLB }}>Lease-Up Starts Month</span>
                <input type="number" min={1} max={totalMonths} value={scenarioData?.value_add?.leaseup_start_month || 1}
                  onChange={e => onFieldChange('value_add.leaseup_start_month', Math.max(1, Math.min(totalMonths, parseInt(e.target.value) || 1)))}
                  style={{ ...vINP, width: 55, textAlign: 'center', fontSize: 13, fontWeight: 700 }} />
              </div>
              {/* Sliders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase' }}>Current Occupancy</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <input type="range" min={50} max={100} step={0.5} value={currentOccPct}
                      onChange={e => onFieldChange('property.occupancy_rate', parseFloat(e.target.value) / 100)}
                      style={{ flex: 1, accentColor: '#ef4444', height: 5 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: vVL, minWidth: 50, textAlign: 'right' }}>{currentOccPct.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: vLB, marginTop: 4 }}>{leaseUpData.currentOccUnits} of {totalUnits} units</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase' }}>Target Occupancy</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <input type="range" min={70} max={100} step={0.5} value={targetOccPct}
                      onChange={e => updateLeaseUp({ target_occupancy: parseFloat(e.target.value) })}
                      style={{ flex: 1, accentColor: '#10b981', height: 5 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981', minWidth: 50, textAlign: 'right' }}>{targetOccPct.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: vLB, marginTop: 4 }}>{leaseUpData.targetOccUnits} of {totalUnits} units</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase' }}>Monthly Absorption</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <input type="range" min={1} max={Math.max(10, totalUnits > 0 ? Math.round(totalUnits * 0.1) : 5)} step={1} value={monthlyAbsorb}
                      onChange={e => updateLeaseUp({ monthly_absorb_units: parseInt(e.target.value) })}
                      style={{ flex: 1, accentColor: '#0ea5e9', height: 5 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0ea5e9', minWidth: 50, textAlign: 'right' }}>{monthlyAbsorb} units</span>
                  </div>
                  <div style={{ fontSize: 11, color: vLB, marginTop: 4 }}>{monthlyAbsorb} leases/month</div>
                </div>
              </div>

              {/* Chart */}
              {leaseUpData.points.length > 1 && (
                <div style={{ width: '100%', height: 260, marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={leaseUpData.points} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="leaseUpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: vLB }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="occ" domain={[50, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: vLB }} axisLine={false} tickLine={false} width={45} />
                      <Tooltip formatter={(v, name) => [name === 'occPct' ? `${v}%` : `$${Math.round(v).toLocaleString()}`, name === 'occPct' ? 'Occupancy' : 'Revenue']} contentStyle={{ borderRadius: 8, border: `1px solid ${vB}`, fontSize: 12 }} />
                      <Area yAxisId="occ" type="monotone" dataKey="occPct" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#leaseUpGrad)" dot={{ r: 3, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Units to Fill', value: `${leaseUpData.gap}`, color: '#ef4444' },
                  { label: 'Months to Stabilize', value: `${leaseUpData.monthsToStab}`, color: '#0ea5e9' },
                  { label: 'Stabilized Revenue', value: vFmt(leaseUpData.targetOccUnits * avgMarketRent * 12), color: '#10b981' },
                  { label: 'Revenue at Current Occ', value: vFmt(leaseUpData.currentOccUnits * avgMarketRent * 12), color: vLB },
                ].map((c, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', border: `1px solid ${vB}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            ANIMATED VALUE-ADD EXECUTION TIMELINE
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <SectionToggle
            title="Value-Add Execution Timeline"
            open={timelineOpen}
            setOpen={setTimelineOpen}
            badge={`${holdYears}-Year`}
            badgeColor="#6366f1"
          />

          {timelineOpen && (
            <div style={{ marginTop: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  background: '#eef2ff', color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: 20, padding: '3px 12px',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {holdYears}-Year Projection
                </span>
                <span style={{ fontSize: 12, color: vLB, flex: 1 }}>
                  {scenarioData?.property?.name || scenarioData?.property?.address || 'Property'} &middot; {[
                    rentUpside > 0 && 'Rent Increase',
                    rubsEnabled && totalRubsRecovery > 0 && 'RUBS',
                    totalExpSavings > 0 && 'Expense Opt.',
                    totalRenoBudget > 0 && 'Renovation',
                  ].filter(Boolean).join(' + ') || 'Value-Add'} Strategy
                </span>
                {/* Pause / Play / Replay controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button
                    onClick={() => setIsPaused(p => !p)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid #c7d2fe', background: isPaused ? '#eef2ff' : '#fff',
                      cursor: 'pointer', color: '#4338ca', fontSize: 14,
                      transition: 'all 0.15s ease',
                    }}
                    title={isPaused ? 'Play' : 'Pause'}
                  >
                    {isPaused ? '▶' : '❚❚'}
                  </button>
                  <button
                    onClick={handleReplay}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid #c7d2fe', background: '#fff',
                      cursor: 'pointer', color: '#4338ca', fontSize: 14,
                      transition: 'all 0.15s ease',
                    }}
                    title="Replay"
                  >
                    ↻
                  </button>
                </div>
              </div>

              {/* Timeline stage */}
              <div style={{ position: 'relative', height: 380, marginTop: 16, overflow: 'visible' }}>
                {/* Cards ABOVE the track — collision-resolved positions */}
                {aboveCards.map(ms => {
                  const visible = currentTimelineMonth >= ms.month - 0.5;
                  const active = Math.abs(currentTimelineMonth - ms.month) < (totalMonths * 0.04);
                  return (
                    <div key={ms.month + ms.label} style={{
                      position: 'absolute',
                      left: `${ms.adjustedPct}%`,
                      bottom: 'calc(50% + 22px)',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      alignItems: 'center',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: 1, height: visible ? 32 : 0,
                        background: ms.color, opacity: visible ? 0.5 : 0,
                        transition: 'height 0.3s ease, opacity 0.3s ease', flexShrink: 0,
                      }} />
                      <div style={{
                        background: '#fff',
                        border: `1.5px solid ${active ? ms.color : '#e5e7eb'}`,
                        borderRadius: 10, padding: '10px 14px',
                        minWidth: 140, maxWidth: 180,
                        boxShadow: active
                          ? `0 4px 20px ${ms.color}30, 0 1px 4px rgba(0,0,0,0.08)`
                          : '0 1px 4px rgba(0,0,0,0.07)',
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
                        transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        borderTopColor: ms.color, borderTopWidth: 3,
                        position: 'relative',
                      }}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{ms.label}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{ms.sublabel}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                          {ms.metrics.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>{m.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: ms.color }}>{m.value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          position: 'absolute', top: -10, right: 10,
                          background: ms.color, color: '#fff',
                          fontSize: 9, fontWeight: 800,
                          padding: '2px 7px', borderRadius: 10, letterSpacing: '0.04em',
                        }}>
                          {ms.month === 0 ? 'DAY 1' : ms.month === totalMonths ? `YR ${holdYears}` : `M${ms.month}`}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* The Track — centered */}
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)' }}>
                  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, position: 'relative', overflow: 'visible' }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0,
                      width: `${timelineProgressPct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                      borderRadius: 3, boxShadow: '0 0 12px #6366f140',
                    }} />

                    {timelineMilestones.map(ms => {
                      const hit = currentTimelineMonth >= ms.month - 0.5;
                      const active = Math.abs(currentTimelineMonth - ms.month) < (totalMonths * 0.04);
                      return (
                        <div key={ms.month + ms.label} style={{
                          position: 'absolute', left: `${tlPct(ms.month)}%`,
                          top: '50%', transform: 'translate(-50%, -50%)',
                          width: active ? 20 : hit ? 14 : 10,
                          height: active ? 20 : hit ? 14 : 10,
                          borderRadius: '50%',
                          background: hit ? ms.color : '#fff',
                          border: `2px solid ${hit ? ms.color : '#d1d5db'}`,
                          boxShadow: active ? `0 0 0 5px ${ms.color}25, 0 0 18px ${ms.color}50` : 'none',
                          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          zIndex: 5,
                        }} />
                      );
                    })}

                    <div style={{
                      position: 'absolute', left: `${timelineProgressPct}%`,
                      top: '50%', transform: 'translate(-50%, -50%)', zIndex: 8,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#111827', border: '3px solid #fff',
                        boxShadow: '0 0 0 3px #11182730, 0 2px 12px rgba(0,0,0,0.25)',
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', bottom: 28, left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#111827', color: '#fff',
                          fontSize: 10, fontWeight: 700,
                          padding: '3px 9px', borderRadius: 6,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}>
                          {currentTimelineMonth < 1 ? 'Day 1' : `Month ${Math.round(currentTimelineMonth)}`}
                          <div style={{
                            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                            borderTop: '4px solid #111827',
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ position: 'relative', marginTop: 16 }}>
                    {yearMarks.map(m => (
                      <div key={m} style={{
                        position: 'absolute', left: `${tlPct(m)}%`,
                        transform: 'translateX(-50%)', textAlign: 'center',
                      }}>
                        <div style={{ width: 1, height: 6, background: '#d1d5db', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                          {m === 0 ? 'Now' : m === totalMonths ? `Yr ${holdYears}` : `Yr ${m / 12}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cards BELOW the track — collision-resolved positions */}
                {belowCards.map(ms => {
                  const visible = currentTimelineMonth >= ms.month - 0.5;
                  const active = Math.abs(currentTimelineMonth - ms.month) < (totalMonths * 0.04);
                  return (
                    <div key={ms.month + ms.label} style={{
                      position: 'absolute',
                      left: `${ms.adjustedPct}%`,
                      top: 'calc(50% + 22px)',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: 1, height: visible ? 32 : 0,
                        background: ms.color, opacity: visible ? 0.5 : 0,
                        transition: 'height 0.3s ease, opacity 0.3s ease', flexShrink: 0,
                      }} />
                      <div style={{
                        background: '#fff',
                        border: `1.5px solid ${active ? ms.color : '#e5e7eb'}`,
                        borderRadius: 10, padding: '10px 14px',
                        minWidth: 140, maxWidth: 180,
                        boxShadow: active
                          ? `0 4px 20px ${ms.color}30, 0 1px 4px rgba(0,0,0,0.08)`
                          : '0 1px 4px rgba(0,0,0,0.07)',
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
                        transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        borderTopColor: ms.color, borderTopWidth: 3,
                        position: 'relative',
                      }}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{ms.label}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{ms.sublabel}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                          {ms.metrics.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>{m.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: ms.color }}>{m.value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          position: 'absolute', bottom: -10, right: 10,
                          background: ms.color, color: '#fff',
                          fontSize: 9, fontWeight: 800,
                          padding: '2px 7px', borderRadius: 10, letterSpacing: '0.04em',
                        }}>
                          {ms.month === 0 ? 'DAY 1' : ms.month === totalMonths ? `YR ${holdYears}` : `M${ms.month}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom summary bar */}
              <div style={{
                marginTop: 20, background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', gap: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}>
                {[
                  { label: 'Current NOI', value: vFmt(currentNOI), color: '#6b7280' },
                  { label: 'Stabilized NOI', value: vFmt(stabilizedNOI), color: '#22c55e' },
                  { label: 'NOI Lift', value: `+${vFmt(totalNOILift)}`, color: '#22c55e' },
                  { label: 'Renovation Budget', value: vFmt(totalRenoBudget), color: '#f59e0b' },
                  { label: 'Net Value Created', value: vFmt(netValueCreation), color: '#6366f1' },
                  { label: `Yr ${holdYears} Cashflow`, value: vFmt(Math.round(exitAnnualCashflow)), color: '#10b981' },
                  { label: `${holdYears}-Yr Exit Value`, value: vFmt(Math.round(exitValue)), color: '#8b5cf6' },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    flex: 1, padding: '4px 12px',
                    borderRight: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Renovation financing callout (if financed) */}
              {renoFinancing.financed && totalRenoBudget > 0 && (
                <div style={{
                  marginTop: 14, padding: '14px 18px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #e0e7ff 0%, #eef2ff 100%)',
                  border: '1px solid #c7d2fe',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3' }}>Renovation Financing</div>
                      <div style={{ fontSize: 11, color: '#4338ca' }}>
                        {vFmt(renoFinancing.loanAmount)} loan @ {renoFinancing.rate}% &middot; {renoFinancing.termYrs}yr term
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4338ca', fontWeight: 600 }}>RENO LOAN</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#3730a3' }}>{vFmt(renoFinancing.loanAmount)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4338ca', fontWeight: 600 }}>EQUITY NEEDED</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#3730a3' }}>{vFmt(renoFinancing.equityNeeded)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4338ca', fontWeight: 600 }}>MONTHLY PMT</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#3730a3' }}>{vFmt(Math.round(renoFinancing.monthlyPayment))}/mo</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#4338ca', fontWeight: 600 }}>ADDL DEBT SVC</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{vFmt(Math.round(renoFinancing.annualDebtService))}/yr</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            9. CURRENT vs STABILIZED (enhanced)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: vVL }}>Current vs Stabilized Performance</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${vB}` }}>
                {['Metric', 'Current', 'Stabilized', 'Change'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Metric' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Net Operating Income', cur: vFmt(currentNOI), stab: vFmt(stabilizedNOI), delta: totalNOILift, isCurrency: true },
                { label: 'Cap Rate', cur: vPct(currentCapRate), stab: vPct(currentPurchasePrice > 0 ? (stabilizedNOI / currentPurchasePrice * 100) : 0), delta: currentPurchasePrice > 0 ? (stabilizedNOI / currentPurchasePrice * 100 - currentCapRate) : 0, suffix: '%' },
                { label: 'Property Value', cur: vFmt(currentPurchasePrice), stab: vFmt(stabilizedValue), delta: valueCreation, isCurrency: true },
                { label: 'DSCR', cur: `${currentDSCR.toFixed(2)}x`, stab: `${stabilizedDSCR.toFixed(2)}x`, delta: stabilizedDSCR - currentDSCR, suffix: 'x' },
                { label: 'Annual Debt Service', cur: vFmt(dsAnnual), stab: vFmt(dsAnnual), delta: 0, isCurrency: true },
                { label: 'Monthly Rent (Total)', cur: `${vFmt(totalCurrentMonthlyRent)}/mo`, stab: `${vFmt(totalMarketMonthlyRent)}/mo`, delta: rentUpside, isCurrency: true },
                { label: 'RUBS Recovery', cur: vFmt(0), stab: vFmt(totalRubsRecovery), delta: totalRubsRecovery, isCurrency: true },
                { label: 'Expense Savings', cur: vFmt(0), stab: vFmt(totalExpSavings), delta: totalExpSavings, isCurrency: true },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${vB}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: vVL }}>{row.label}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>{row.cur}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{row.stab}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: row.delta > 0 ? '#16a34a' : row.delta < 0 ? '#ef4444' : vLB }}>
                    {row.delta === 0 ? '—' : row.isCurrency ? `+${vFmt(row.delta)}` : `+${row.delta.toFixed(2)}${row.suffix || ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom summary */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Value Creation', val: vFmt(valueCreation), sub: `${currentPurchasePrice > 0 ? ((valueCreation / currentPurchasePrice) * 100).toFixed(1) : '0.0'}% ROI on cost` },
              { label: 'Total NOI Lift', val: vFmt(totalNOILift), sub: `Rent: ${vFmt(totalAnnualRentUpside)} + RUBS: ${vFmt(totalRubsRecovery)}` },
              { label: 'Renovation Budget', val: vFmt(totalRenoBudget), sub: `${renoTimeline} month timeline` },
              { label: 'Net Value Created', val: vFmt(netValueCreation), sub: `Value creation minus reno cost` },
            ].map((c, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', border: `1px solid ${vB}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: vVL }}>{c.val}</div>
                <div style={{ fontSize: 11, color: vLB, marginTop: 4 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            10. APPLY TO OVERVIEW PRO FORMA (enhanced)
            ═══════════════════════════════════════════════════════ */}
        <div style={{ ...vSC, border: `2px solid ${vAC}`, background: 'linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: vVL }}>Apply to Overview Pro Forma</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: vLB }}>Toggle switches to reflect value-add adjustments in Overview tab financials</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            {/* Rent Optimization toggle */}
            <div style={{ padding: 20, borderRadius: 12, border: `2px solid ${scenarioData?.value_add?.apply_rent_upside ? vAC : vB}`, backgroundColor: scenarioData?.value_add?.apply_rent_upside ? '#eef2ff' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>Rent Optimization</div>
                  <div style={{ fontSize: 12, color: vLB, marginTop: 4 }}>Higher rents from market adjustments</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalAnnualRentUpside > 0 ? '#16a34a' : vLB, marginTop: 8 }}>+{vFmt(totalAnnualRentUpside)}<span style={{ fontSize: 11, fontWeight: 500, color: vLB }}>/yr</span></div>
                </div>
                <VToggle checked={scenarioData?.value_add?.apply_rent_upside || false} onChange={v => {
                  onFieldChange('value_add.apply_rent_upside', v);
                  onFieldChange('value_add.annual_rent_upside', totalAnnualRentUpside);
                }} />
              </div>
            </div>
            {/* RUBS toggle */}
            <div style={{ padding: 20, borderRadius: 12, border: `2px solid ${scenarioData?.value_add?.apply_rubs ? '#0ea5e9' : vB}`, backgroundColor: scenarioData?.value_add?.apply_rubs ? '#f0f9ff' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>RUBS Recovery</div>
                  <div style={{ fontSize: 12, color: vLB, marginTop: 4 }}>Utility cost recovery from tenants</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalRubsRecovery > 0 ? '#16a34a' : vLB, marginTop: 8 }}>+{vFmt(totalRubsRecovery)}<span style={{ fontSize: 11, fontWeight: 500, color: vLB }}>/yr</span></div>
                </div>
                <VToggle checked={scenarioData?.value_add?.apply_rubs || false} onChange={v => {
                  onFieldChange('value_add.apply_rubs', v);
                  onFieldChange('value_add.annual_rubs_recovery', totalRubsRecovery);
                }} />
              </div>
            </div>
            {/* Expense Savings toggle */}
            <div style={{ padding: 20, borderRadius: 12, border: `2px solid ${scenarioData?.value_add?.apply_expense_savings ? '#f59e0b' : vB}`, backgroundColor: scenarioData?.value_add?.apply_expense_savings ? '#eef2ff' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>Expense Savings</div>
                  <div style={{ fontSize: 12, color: vLB, marginTop: 4 }}>Optimized contracts & operations</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalExpSavings > 0 ? '#16a34a' : vLB, marginTop: 8 }}>−{vFmt(totalExpSavings)}<span style={{ fontSize: 11, fontWeight: 500, color: vLB }}> expenses/yr</span></div>
                </div>
                <VToggle checked={scenarioData?.value_add?.apply_expense_savings || false} onChange={v => {
                  onFieldChange('value_add.apply_expense_savings', v);
                  onFieldChange('value_add.annual_expense_savings', totalExpSavings);
                }} />
              </div>
            </div>
          </div>

          {/* Active adjustments summary */}
          {(scenarioData?.value_add?.apply_rent_upside || scenarioData?.value_add?.apply_rubs || scenarioData?.value_add?.apply_expense_savings) && (
            <div style={{ marginTop: 16, padding: '14px 18px', backgroundColor: '#ecfdf5', borderRadius: 10, border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#047857' }}>
                <strong>Adjusted NOI:</strong> {vFmt(currentNOI
                  + (scenarioData?.value_add?.apply_rent_upside ? totalAnnualRentUpside : 0)
                  + (scenarioData?.value_add?.apply_rubs ? totalRubsRecovery : 0)
                  + (scenarioData?.value_add?.apply_expense_savings ? totalExpSavings : 0)
                )}
                <span style={{ color: vLB, marginLeft: 8 }}>(Base: {vFmt(currentNOI)})</span>
                <span style={{ color: '#16a34a', marginLeft: 8 }}>+{vFmt(
                  (scenarioData?.value_add?.apply_rent_upside ? totalAnnualRentUpside : 0)
                  + (scenarioData?.value_add?.apply_rubs ? totalRubsRecovery : 0)
                  + (scenarioData?.value_add?.apply_expense_savings ? totalExpSavings : 0)
                )}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
