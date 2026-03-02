/* eslint-disable */
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ═══════════════════════════════════════════════════════════════════
// Default renovation line items — common multifamily value-add plays
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_RENO_ITEMS = [
  { id: 'kitchen', name: 'Kitchen Upgrade', costPerUnit: 5000, icon: '🍳' },
  { id: 'bathroom', name: 'Bathroom Refresh', costPerUnit: 3000, icon: '🚿' },
  { id: 'flooring', name: 'Flooring Replacement', costPerUnit: 2500, icon: '🏠' },
  { id: 'paint', name: 'Paint & Finishes', costPerUnit: 1500, icon: '🎨' },
  { id: 'appliances', name: 'New Appliances', costPerUnit: 2000, icon: '🧊' },
  { id: 'lighting', name: 'Lighting & Fixtures', costPerUnit: 800, icon: '💡' },
  { id: 'hvac', name: 'HVAC / Mechanical', costPerUnit: 1200, icon: '❄️' },
  { id: 'windows', name: 'Windows & Doors', costPerUnit: 1800, icon: '🪟' },
  { id: 'exterior', name: 'Exterior / Curb Appeal', costPerUnit: 0, icon: '🏗️', isCommon: true, totalCost: 50000 },
  { id: 'amenity', name: 'Amenity Improvements', costPerUnit: 0, icon: '🏊', isCommon: true, totalCost: 75000 },
  { id: 'security', name: 'Security / Access Control', costPerUnit: 0, icon: '🔒', isCommon: true, totalCost: 25000 },
];

const DEFAULT_OTHER_INCOME = [
  { id: 'pet_rent', name: 'Pet Rent', perUnitMonthly: 35, pctUnits: 40, icon: '🐾' },
  { id: 'parking', name: 'Parking Premium', perUnitMonthly: 75, pctUnits: 30, icon: '🅿️' },
  { id: 'storage', name: 'Storage Units', perUnitMonthly: 50, pctUnits: 20, icon: '📦' },
  { id: 'laundry', name: 'Laundry Income', perUnitMonthly: 25, pctUnits: 100, icon: '🧺' },
  { id: 'cable_internet', name: 'Cable / Internet', perUnitMonthly: 45, pctUnits: 60, icon: '📡' },
  { id: 'app_fees', name: 'Application Fees', annual: 5000, icon: '📋', isFlat: true },
  { id: 'late_fees', name: 'Late Fees', annual: 3000, icon: '⏰', isFlat: true },
];

const EXPENSE_OPT_ITEMS = [
  { id: 'insurance', name: 'Insurance Renegotiation', icon: '🛡️', defaultSavingsPct: 15, expKey: 'insurance' },
  { id: 'tax_appeal', name: 'Property Tax Appeal', icon: '🏛️', defaultSavingsPct: 10, expKey: 'taxes' },
  { id: 'management', name: 'Management Fee Reduction', icon: '👔', defaultSavingsPct: 20, expKey: 'management' },
  { id: 'maintenance', name: 'Maintenance Contracts', icon: '🔧', defaultSavingsPct: 15, expKey: 'repairs_maintenance' },
  { id: 'energy', name: 'Energy Efficiency (LED, Low-Flow)', icon: '💡', defaultSavingsPct: 25, expKey: 'utilities' },
  { id: 'landscaping', name: 'Landscape Contract', icon: '🌿', defaultSavingsPct: 10, expKey: 'landscaping' },
];

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
}) {
  // ── Local UI state ──
  const [renoOpen, setRenoOpen] = useState(true);
  const [otherIncOpen, setOtherIncOpen] = useState(true);
  const [expOptOpen, setExpOptOpen] = useState(true);
  const [leaseUpOpen, setLeaseUpOpen] = useState(true);

  // ── Theme ──
  const vB = '#e5e7eb', vLB = '#6b7280', vVL = '#111827', vAC = '#4f46e5';
  const vSC = { backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${vB}` };
  const vFmt = (v) => { if (v == null || isNaN(v)) return '$0'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); };
  const vPct = (v) => { if (v == null || isNaN(v)) return '0.0%'; return `${Number(v).toFixed(2)}%`; };
  const vINP = { padding: '8px 12px', border: `1px solid ${vB}`, borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'right', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };

  // ── Toggle ──
  const VToggle = ({ checked, onChange, color }) => (
    <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, backgroundColor: checked ? (color || vAC) : '#d1d5db', borderRadius: 11, padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: checked ? 'flex-end' : 'flex-start', transition: 'background 0.2s' }}>
      <div style={{ width: 18, height: 18, backgroundColor: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  );

  // ── Section toggle heading ──
  const SectionToggle = ({ title, icon, open, setOpen, badge, badgeColor }) => (
    <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: vVL }}>{title}</h3>
        {badge && <span style={{ fontSize: 10, fontWeight: 700, color: badgeColor || '#10b981', background: `${badgeColor || '#10b981'}15`, padding: '2px 10px', borderRadius: 6, border: `1px solid ${badgeColor || '#10b981'}30` }}>{badge}</span>}
      </div>
      <span style={{ fontSize: 16, color: vLB, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
    </div>
  );

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
  // OTHER INCOME STREAMS (NEW)
  // ═════════════════════════════════════════════════════════════
  const otherIncConfig = scenarioData?.value_add?.other_income || {};
  const otherIncItems = DEFAULT_OTHER_INCOME.map(d => {
    const saved = otherIncConfig[d.id];
    return saved ? { ...d, ...saved } : { ...d, enabled: false };
  });

  const updateOtherInc = (id, changes) => {
    const updated = { ...otherIncConfig, [id]: { ...(otherIncConfig[id] || {}), ...changes } };
    onFieldChange('value_add.other_income', updated);
  };

  const totalAnnualOtherIncome = otherIncItems.reduce((s, item) => {
    if (!item.enabled) return s;
    if (item.isFlat) return s + (item.annual || 0);
    const units = Math.round(totalUnits * ((item.pctUnits || 0) / 100));
    return s + ((item.perUnitMonthly || 0) * units * 12);
  }, 0);

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
  const totalNOILift = totalAnnualRentUpside + totalRubsRecovery + totalAnnualOtherIncome + totalExpSavings;
  const stabilizedNOI = currentNOI + totalNOILift;
  const stabilizedValue = mktCapRate > 0 ? stabilizedNOI / mktCapRate : 0;
  const valueCreation = stabilizedValue - currentPurchasePrice;
  const netValueCreation = valueCreation - totalRenoBudget;
  const stabilizedDSCR = dsAnnual > 0 ? stabilizedNOI / dsAnnual : 0;

  // ═════════════════════════════════════════════════════════════
  // WATERFALL DATA (ENHANCED)
  // ═════════════════════════════════════════════════════════════
  const waterfallItems = [];
  if (totalAnnualRentUpside > 0) waterfallItems.push({ label: 'Rent Upside', value: totalAnnualRentUpside, color: '#4f46e5' });
  if (totalRubsRecovery > 0) waterfallItems.push({ label: 'RUBS Recovery', value: totalRubsRecovery, color: '#0ea5e9' });
  if (totalAnnualOtherIncome > 0) waterfallItems.push({ label: 'Other Income', value: totalAnnualOtherIncome, color: '#8b5cf6' });
  if (totalExpSavings > 0) waterfallItems.push({ label: 'Expense Savings', value: totalExpSavings, color: '#f59e0b' });
  const waterfallMax = Math.max(totalNOILift, valueCreation, 1);

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
            <span style={{ fontSize: 22 }}>🔄</span>
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
            <span style={{ fontSize: 18 }}>📈</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: vVL }}>Property Value Creation Calculator</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: vLB }}>Calculate potential value creation from all value-add strategies</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginTop: 20, marginBottom: 20 }}>
            {[
              { label: '% Rent Increase', icon: '📈', val: avgMarketRent > 0 && avgCurrentRent > 0 ? ((avgMarketRent - avgCurrentRent) / avgCurrentRent * 100).toFixed(1) : '0', suffix: '%' },
              { label: 'Avg. Rent', icon: '$', val: Math.round(avgCurrentRent), suffix: '/mo' },
              { label: 'Units', icon: '🏢', val: totalUnits, suffix: 'units' },
              { label: '% Vacancy', icon: '%', val: (expenses.vacancy_pct || 5).toFixed(0), suffix: '%' },
              { label: 'Exp. Ratio', icon: '📊', val: (totalCurrentExpenses > 0 && currentNOI + totalCurrentExpenses > 0 ? (totalCurrentExpenses / (currentNOI + totalCurrentExpenses) * 100) : 0).toFixed(0), suffix: '%' },
              { label: 'Cap Rate', icon: '⊙', val: (mktCapRate * 100).toFixed(2), suffix: '%' },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, fontWeight: 600, color: vLB, marginBottom: 6 }}>{f.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: `1px solid ${vB}`, borderRadius: 8, background: '#f9fafb' }}>
                  <span style={{ fontSize: 12, color: vLB }}>{f.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: vVL }}>{f.val}</span>
                  <span style={{ fontSize: 11, color: vLB }}>{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Annual Revenue Increase', val: totalAnnualRentUpside + totalRubsRecovery + totalAnnualOtherIncome, icon: '$', color: vAC },
              { label: 'Expense Savings', val: totalExpSavings, icon: '✂️', color: '#f59e0b' },
              { label: 'Total NOI Impact', val: totalNOILift, icon: '📈', color: '#10b981' },
              { label: 'Estimated Value Add', val: valueCreation, icon: '🏢', color: vVL },
            ].map((c, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '20px 24px', textAlign: 'center', border: `1px solid ${vB}` }}>
                <div style={{ fontSize: 14, marginBottom: 8, color: vLB }}>{c.icon}</div>
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
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: vVL }}>Rent Optimization</h3>
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
          <SectionToggle title="Renovation / CapEx Budget" icon="🏗️" open={renoOpen} setOpen={setRenoOpen}
            badge={totalRenoBudget > 0 ? vFmt(totalRenoBudget) : null} badgeColor="#f59e0b" />

          {renoOpen && (
            <div style={{ marginTop: 20 }}>
              {/* Timeline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: '#f9fafb', padding: '12px 16px', borderRadius: 10, border: `1px solid ${vB}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: vVL }}>Renovation Timeline</span>
                <input type="range" min={3} max={36} step={1} value={renoTimeline}
                  onChange={e => onFieldChange('value_add.renovation_timeline_months', parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: '#f59e0b', height: 5 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', minWidth: 80 }}>{renoTimeline} months</span>
              </div>

              {/* Interior renovation items */}
              <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Interior Renovations (per unit)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#fffbeb' }}>
                    {['', 'Item', 'Cost / Unit', 'Total Cost', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 || i === 4 ? 'center' : (i >= 2 ? 'right' : 'left'), fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', borderBottom: '2px solid #fde68a', width: i === 0 ? 50 : i === 4 ? 50 : 'auto' }}>{h}</th>
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
                        <span style={{ marginRight: 8 }}>{item.icon}</span>{item.name}
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
                        <span style={{ marginRight: 8 }}>{item.icon}</span>{item.name}
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
                  <div key={i} style={{ background: i === 3 ? '#fffbeb' : '#f9fafb', borderRadius: 10, padding: '14px 16px', border: `1px solid ${i === 3 ? '#fde68a' : vB}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

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
            4. OTHER INCOME STREAMS (NEW)
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <SectionToggle title="Other Income Streams" icon="💰" open={otherIncOpen} setOpen={setOtherIncOpen}
            badge={totalAnnualOtherIncome > 0 ? `+${vFmt(totalAnnualOtherIncome)}/yr` : null} badgeColor="#8b5cf6" />

          {otherIncOpen && (
            <div style={{ marginTop: 20 }}>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: vLB }}>Toggle income streams and customize amounts to model additional revenue sources beyond rent.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {otherIncItems.filter(i => !i.isFlat).map(item => {
                  const units = Math.round(totalUnits * ((item.pctUnits || 0) / 100));
                  const annualVal = item.enabled ? (item.perUnitMonthly || 0) * units * 12 : 0;
                  return (
                    <div key={item.id} style={{ padding: 16, borderRadius: 12, border: `1px solid ${item.enabled ? '#c4b5fd' : vB}`, background: item.enabled ? '#faf5ff' : '#fff', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{item.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: vVL }}>{item.name}</span>
                        </div>
                        <VToggle checked={item.enabled} onChange={v => updateOtherInc(item.id, { enabled: v })} color="#8b5cf6" />
                      </div>
                      {item.enabled && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: vLB, textTransform: 'uppercase' }}>$/Unit/Month</label>
                            <input type="number" value={item.perUnitMonthly || 0} onChange={e => updateOtherInc(item.id, { perUnitMonthly: parseFloat(e.target.value) || 0 })}
                              style={{ ...vINP, width: '100%', marginTop: 4 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: vLB, textTransform: 'uppercase' }}>% Units Participating</label>
                            <input type="number" min={0} max={100} value={item.pctUnits || 0} onChange={e => updateOtherInc(item.id, { pctUnits: Math.min(100, parseInt(e.target.value) || 0) })}
                              style={{ ...vINP, width: '100%', marginTop: 4 }} />
                          </div>
                          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${vB}` }}>
                            <span style={{ fontSize: 11, color: vLB }}>{units} units × ${item.perUnitMonthly}/mo × 12</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>{vFmt(annualVal)}/yr</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Flat fee items */}
              <div style={{ fontSize: 11, fontWeight: 700, color: vLB, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 20, marginBottom: 10 }}>Flat Annual Income</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {otherIncItems.filter(i => i.isFlat).map(item => (
                  <div key={item.id} style={{ padding: 14, borderRadius: 10, border: `1px solid ${item.enabled ? '#c4b5fd' : vB}`, background: item.enabled ? '#faf5ff' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: vVL }}>{item.icon} {item.name}</span>
                      <VToggle checked={item.enabled} onChange={v => updateOtherInc(item.id, { enabled: v })} color="#8b5cf6" />
                    </div>
                    {item.enabled && (
                      <input type="number" value={item.annual || 0} onChange={e => updateOtherInc(item.id, { annual: parseInt(e.target.value) || 0 })}
                        style={{ ...vINP, width: '100%' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Other Income Total */}
              <div style={{ marginTop: 16, background: totalAnnualOtherIncome > 0 ? '#faf5ff' : '#f9fafb', borderRadius: 10, padding: '14px 18px', border: `1px solid ${totalAnnualOtherIncome > 0 ? '#c4b5fd' : vB}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: vVL }}>Total Additional Income</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: totalAnnualOtherIncome > 0 ? '#8b5cf6' : vLB }}>{vFmt(totalAnnualOtherIncome)}<span style={{ fontSize: 11, color: vLB }}>/yr</span></span>
              </div>
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
                <div style={{ fontSize: 18, marginBottom: 4 }}>📊</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: computedUtilityTotal > 0 ? '#4338ca' : vLB, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: computedUtilityTotal > 0 ? '#4338ca' : vVL }}>{vFmt(computedUtilityTotal)}<span style={{ fontSize: 10, color: vLB }}>/yr</span></div>
                <div style={{ fontSize: 11, color: vLB, marginTop: 2 }}>{vFmt(Math.round(computedUtilityTotal / 12))}/mo</div>
                <div style={{ fontSize: 10, color: vLB }}>{totalUnits > 0 ? vFmt(Math.round(computedUtilityTotal / 12 / totalUnits)) : '$0'}/unit/mo</div>
              </div>
            </div>
            {totalUtilityCost === 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
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
          <SectionToggle title="Expense Optimization" icon="✂️" open={expOptOpen} setOpen={setExpOptOpen}
            badge={totalExpSavings > 0 ? `−${vFmt(totalExpSavings)}/yr` : null} badgeColor="#f59e0b" />

          {expOptOpen && (
            <div style={{ marginTop: 20 }}>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: vLB }}>Model expense reductions from renegotiated contracts, tax appeals, and operational efficiencies.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fffbeb' }}>
                    {['', 'Category', 'Current Cost', 'Savings %', 'Annual Savings'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: i <= 1 ? (i === 0 ? 'center' : 'left') : 'right', fontSize: 10, fontWeight: 700, color: vLB, textTransform: 'uppercase', borderBottom: '2px solid #fde68a', width: i === 0 ? 50 : 'auto' }}>{h}</th>
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
                        <span style={{ marginRight: 8 }}>{item.icon}</span>{item.name}
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
                  <tr style={{ background: '#fffbeb', borderTop: '2px solid #fde68a' }}>
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
          <SectionToggle title="Lease-Up / Absorption Timeline" icon="📅" open={leaseUpOpen} setOpen={setLeaseUpOpen}
            badge={leaseUpData.monthsToStab > 0 ? `${leaseUpData.monthsToStab} mo to stabilize` : 'Stabilized'} badgeColor="#0ea5e9" />

          {leaseUpOpen && (
            <div style={{ marginTop: 20 }}>
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
            8. ENHANCED VALUE-ADD WATERFALL
            ═══════════════════════════════════════════════════════ */}
        <div style={vSC}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: vVL }}>Value-Add Waterfall</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', minHeight: 220, padding: '0 20px' }}>
            {/* Current NOI block */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: vLB, marginBottom: 6 }}>{vFmt(currentNOI)}</div>
              <div style={{ width: '100%', maxWidth: 80, height: Math.max(waterfallMax > 0 ? (currentNOI / waterfallMax) * 160 : 0, 10), background: '#94a3b8', borderRadius: '8px 8px 0 0' }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: vLB, marginTop: 8, textAlign: 'center' }}>Current NOI</div>
            </div>

            {/* Source bars */}
            {waterfallItems.map((item, i) => {
              const pctH = waterfallMax > 0 ? (item.value / waterfallMax) * 160 : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: item.color, marginBottom: 6 }}>+{vFmt(item.value)}</div>
                  <div style={{ width: '100%', maxWidth: 80, height: Math.max(pctH, 10), background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`, borderRadius: '8px 8px 0 0', transition: 'height 0.3s' }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: vLB, marginTop: 8, textAlign: 'center', lineHeight: 1.3 }}>{item.label}</div>
                </div>
              );
            })}

            {waterfallItems.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', fontSize: 22, color: '#d1d5db' }}>→</div>
                {/* Stabilized NOI */}
                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', marginBottom: 6 }}>{vFmt(stabilizedNOI)}</div>
                  <div style={{ width: '100%', maxWidth: 90, height: Math.max(waterfallMax > 0 ? (stabilizedNOI / waterfallMax) * 160 : 0, 10), background: 'linear-gradient(180deg, #16a34a 0%, #15803dcc 100%)', borderRadius: '8px 8px 0 0' }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginTop: 8, textAlign: 'center' }}>Stabilized NOI</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', fontSize: 22, color: '#d1d5db' }}>→</div>
                {/* Value Creation */}
                <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: vVL, marginBottom: 6 }}>{vFmt(valueCreation)}</div>
                  <div style={{ width: '100%', maxWidth: 100, height: Math.max(waterfallMax > 0 ? (Math.abs(valueCreation) / waterfallMax) * 160 : 0, 10), background: valueCreation >= 0 ? `linear-gradient(180deg, ${vVL} 0%, ${vVL}cc 100%)` : 'linear-gradient(180deg, #ef4444 0%, #dc2626cc 100%)', borderRadius: '8px 8px 0 0' }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: vVL, marginTop: 8, textAlign: 'center' }}>
                    Value Creation<br /><span style={{ color: vLB, fontWeight: 500 }}>@ {vPct(mktCapRate * 100)} cap</span>
                  </div>
                </div>
              </>
            )}
            {waterfallItems.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: vLB, fontSize: 13 }}>
                Enable value-add strategies above to see the waterfall
              </div>
            )}
          </div>

          {/* Waterfall breakdown strip */}
          {totalNOILift > 0 && (
            <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 10, padding: '14px 18px', border: `1px solid ${vB}`, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {waterfallItems.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: w.color }} />
                  <span style={{ color: vLB }}>{w.label}:</span>
                  <span style={{ fontWeight: 700, color: vVL }}>{vFmt(w.value)}</span>
                  <span style={{ color: vLB }}>({(w.value / totalNOILift * 100).toFixed(0)}%)</span>
                </div>
              ))}
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
                { label: 'Other Income', cur: vFmt(0), stab: vFmt(totalAnnualOtherIncome), delta: totalAnnualOtherIncome, isCurrency: true },
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
              { label: 'Total NOI Lift', val: vFmt(totalNOILift), sub: `${waterfallItems.length} active strategies` },
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
            <span style={{ fontSize: 18 }}>⚡</span>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>📈 Rent Optimization</div>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>💧 RUBS Recovery</div>
                  <div style={{ fontSize: 12, color: vLB, marginTop: 4 }}>Utility cost recovery from tenants</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalRubsRecovery > 0 ? '#16a34a' : vLB, marginTop: 8 }}>+{vFmt(totalRubsRecovery)}<span style={{ fontSize: 11, fontWeight: 500, color: vLB }}>/yr</span></div>
                </div>
                <VToggle checked={scenarioData?.value_add?.apply_rubs || false} onChange={v => {
                  onFieldChange('value_add.apply_rubs', v);
                  onFieldChange('value_add.annual_rubs_recovery', totalRubsRecovery);
                }} />
              </div>
            </div>
            {/* Other Income toggle */}
            <div style={{ padding: 20, borderRadius: 12, border: `2px solid ${scenarioData?.value_add?.apply_other_income ? '#8b5cf6' : vB}`, backgroundColor: scenarioData?.value_add?.apply_other_income ? '#faf5ff' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>💰 Other Income</div>
                  <div style={{ fontSize: 12, color: vLB, marginTop: 4 }}>Pet rent, parking, storage, etc.</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: totalAnnualOtherIncome > 0 ? '#16a34a' : vLB, marginTop: 8 }}>+{vFmt(totalAnnualOtherIncome)}<span style={{ fontSize: 11, fontWeight: 500, color: vLB }}>/yr</span></div>
                </div>
                <VToggle checked={scenarioData?.value_add?.apply_other_income || false} onChange={v => {
                  onFieldChange('value_add.apply_other_income', v);
                  onFieldChange('value_add.annual_other_income', totalAnnualOtherIncome);
                }} />
              </div>
            </div>
            {/* Expense Savings toggle */}
            <div style={{ padding: 20, borderRadius: 12, border: `2px solid ${scenarioData?.value_add?.apply_expense_savings ? '#f59e0b' : vB}`, backgroundColor: scenarioData?.value_add?.apply_expense_savings ? '#fffbeb' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vVL }}>✂️ Expense Savings</div>
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
          {(scenarioData?.value_add?.apply_rent_upside || scenarioData?.value_add?.apply_rubs || scenarioData?.value_add?.apply_other_income || scenarioData?.value_add?.apply_expense_savings) && (
            <div style={{ marginTop: 16, padding: '14px 18px', backgroundColor: '#ecfdf5', borderRadius: 10, border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <div style={{ fontSize: 13, color: '#047857' }}>
                <strong>Adjusted NOI:</strong> {vFmt(currentNOI
                  + (scenarioData?.value_add?.apply_rent_upside ? totalAnnualRentUpside : 0)
                  + (scenarioData?.value_add?.apply_rubs ? totalRubsRecovery : 0)
                  + (scenarioData?.value_add?.apply_other_income ? totalAnnualOtherIncome : 0)
                  + (scenarioData?.value_add?.apply_expense_savings ? totalExpSavings : 0)
                )}
                <span style={{ color: vLB, marginLeft: 8 }}>(Base: {vFmt(currentNOI)})</span>
                <span style={{ color: '#16a34a', marginLeft: 8 }}>+{vFmt(
                  (scenarioData?.value_add?.apply_rent_upside ? totalAnnualRentUpside : 0)
                  + (scenarioData?.value_add?.apply_rubs ? totalRubsRecovery : 0)
                  + (scenarioData?.value_add?.apply_other_income ? totalAnnualOtherIncome : 0)
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
