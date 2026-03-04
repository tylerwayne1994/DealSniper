/* eslint-disable */
// ═══════════════════════════════════════════════════════════════════
// WaterfallTab — Syndication / Partnership Waterfall Calculator
// Full IRR-hurdle engine, GP Catch-up, LP Clawback, running balances
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useCallback } from 'react';

// ── Defaults ──
const DEFAULT_TIERS = [
  { name: 'Capital Return + Pref', hurdle_type: 'IRR', from_pct: 0, to_pct: 8, gp_promote: 0, gp_split: 10, lp_split: 90 },
  { name: 'Promote A', hurdle_type: 'IRR', from_pct: 8, to_pct: 12, gp_promote: 20, gp_split: 20, lp_split: 80 },
  { name: 'Promote B', hurdle_type: 'IRR', from_pct: 12, to_pct: 18, gp_promote: 30, gp_split: 30, lp_split: 70 },
  { name: 'Promote C', hurdle_type: 'IRR', from_pct: 18, to_pct: 100, gp_promote: 40, gp_split: 40, lp_split: 60 },
];

// ── Helpers ──
const fmt = (v) => {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

// ── IRR via bisection (Newton fallback) ──
const calcIRR = (cashFlows) => {
  if (!cashFlows || cashFlows.length < 2) return 0;
  if (!cashFlows.some(c => c < 0) || !cashFlows.some(c => c > 0)) return 0;
  let lo = -0.99, hi = 10.0;
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2;
    let npv = 0;
    for (let j = 0; j < cashFlows.length; j++) npv += cashFlows[j] / Math.pow(1 + mid, j);
    if (npv > 0) lo = mid; else hi = mid;
    if (Math.abs(hi - lo) < 1e-10) break;
  }
  return ((lo + hi) / 2) * 100;
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function WaterfallTab({
  scenarioData, fullCalcs, onFieldChange,
  purchasePrice, annualDebtService, holdPeriod, noiT12,
  vaRentUpside = 0, vaRubsRecovery = 0, vaExpenseSavings = 0,
  marketCapRate = 0,
}) {
  // ── Theme ──
  const B = '#e5e7eb', LB = '#6b7280', VL = '#111827', AC = '#4f46e5';
  const SC = { backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}` };
  const INP = { border: `1.5px solid ${B}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' };

  // ── Collapse ──
  const [fundingOpen, setFundingOpen] = useState(true);
  const [feesOpen, setFeesOpen] = useState(false);
  const [profitOpen, setProfitOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noiBreakdownOpen, setNoiBreakdownOpen] = useState(true);
  const [monthlyDistOpen, setMonthlyDistOpen] = useState(true);

  // ── Config from scenarioData.waterfall ──
  const wf = scenarioData?.waterfall || {};
  const update = useCallback((path, val) => onFieldChange(`waterfall.${path}`, val), [onFieldChange]);

  const partnershipType = wf.partnership_type || 'traditional';
  const gpShare = wf.gp_share ?? 10;
  const lpShare = 100 - gpShare;
  const contributionType = wf.funding?.contribution_type || 'default';

  // GP Fees
  const fees = wf.gp_fees || {};
  const acqFee = fees.acquisition_fee || {};
  const dispFee = fees.disposition_fee || {};
  const assetMgmtFee = fees.asset_mgmt_fee || {};
  const propMgmtFee = fees.property_mgmt_fee || {};
  const orgFee = fees.org_fee || {};
  const capRaiseFee = fees.capital_raise_fee || {};

  // Profit Distribution
  const profitMode = wf.profit_distribution?.mode || 'simple';
  const refinanceProceeds = wf.profit_distribution?.refinance_proceeds !== false;
  const splitMethod = wf.profit_distribution?.split_method || 'return_capital_first';
  const gpCatchup = wf.profit_distribution?.gp_catchup || false;
  const lpClawback = wf.profit_distribution?.lp_clawback || false;
  const tiersToModel = wf.profit_distribution?.tiers_to_model ?? 4;
  const tiers = wf.profit_distribution?.tiers || DEFAULT_TIERS;

  const activeTiers = useMemo(() => {
    const result = [];
    for (let i = 0; i < tiersToModel; i++) {
      if (tiers[i]) {
        result.push({ ...tiers[i] });
      } else {
        result.push({
          name: i === 0 ? 'Capital Return + Pref' : `Promote ${String.fromCharCode(64 + i)}`,
          hurdle_type: 'IRR', from_pct: 0, to_pct: 0, gp_promote: 0,
          gp_split: gpShare, lp_split: lpShare,
        });
      }
    }
    return result;
  }, [tiers, tiersToModel, gpShare, lpShare]);

  // ═══════════════════════════════════════════════════════════════
  // FINANCIAL DATA
  // ═══════════════════════════════════════════════════════════════
  const holdYears = holdPeriod || scenarioData?.exit_details?.holdYrs || fullCalcs?.returns?.holdingPeriod || 5;
  const ltv = scenarioData?.financing?.ltv || 75;
  const loanAmount = purchasePrice * (ltv / 100);
  const closingCosts = scenarioData?.financing?.closing_costs || 0;
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || ((purchasePrice - loanAmount) + closingCosts);
  const lpContribution = totalEquity * (lpShare / 100);
  const gpContribution = totalEquity * (gpShare / 100);
  const egi = fullCalcs?.year1?.effectiveGrossIncome || fullCalcs?.year1?.potentialGrossIncome || noiT12 || 0;

  // ── Value-Add NOI Adjustments ──
  const vaTotalNOIAdj = vaRentUpside + vaRubsRecovery + vaExpenseSavings;
  const hasValueAdd = vaTotalNOIAdj > 0;
  const baseNOI = fullCalcs?.year1?.noi || noiT12 || 0;
  const stabilizedNOI = baseNOI + vaTotalNOIAdj;
  const totalExpenses = fullCalcs?.year1?.totalOperatingExpenses || 0;
  const grossRevenue = fullCalcs?.year1?.effectiveGrossIncome || fullCalcs?.year1?.potentialGrossIncome || 0;
  const dsAnnual = annualDebtService || fullCalcs?.financing?.annualDebtService || 0;
  const baseCashFlow = baseNOI - dsAnnual;
  const stabilizedCashFlow = stabilizedNOI - dsAnnual;
  const mktCapRate = marketCapRate || fullCalcs?.year1?.capRate || (baseNOI > 0 && purchasePrice > 0 ? (baseNOI / purchasePrice) * 100 : 5);
  const stabilizedValue = mktCapRate > 0 ? (stabilizedNOI / (mktCapRate / 100)) : 0;

  // ── GP Fee calculations ──
  const gpFeeCalcs = useMemo(() => {
    const acq = acqFee.type === 'pct_purchase' ? purchasePrice * ((acqFee.pct || 0) / 100) : (acqFee.amount || 0);
    const exitSalePrice = fullCalcs?.returns?.terminalValue || purchasePrice * 1.2;
    const disp = dispFee.type === 'pct_sale' ? exitSalePrice * ((dispFee.pct || 0) / 100) : (dispFee.amount || 0);
    const assetAnnual = Math.max(egi * ((assetMgmtFee.pct || 0) / 100), assetMgmtFee.min_floor || 0);
    const propAnnual = Math.max(egi * ((propMgmtFee.pct || 0) / 100), propMgmtFee.min_floor || 0);
    const org = orgFee.amount || 0;
    const capRaise = (capRaiseFee.pct || 0) > 0 ? lpContribution * ((capRaiseFee.pct || 0) / 100) : (capRaiseFee.amount || 0);
    return { acq, disp, assetAnnual, propAnnual, org, capRaise,
             totalUpfront: acq + org + capRaise,
             totalAnnual: assetAnnual + propAnnual,
             totalDisposition: disp };
  }, [acqFee, dispFee, assetMgmtFee, propMgmtFee, orgFee, capRaiseFee, purchasePrice, egi, lpContribution, fullCalcs]);

  // ── Yearly levered project cash flows (includes value-add adjustments) ──
  const yearlyCashFlows = useMemo(() => {
    const flows = [];
    const yearly = fullCalcs?.yearly || [];
    const exitScenarios = fullCalcs?.returns?.exitScenarios || [];
    const selectedExit = exitScenarios.find(s => s.exitYear === holdYears) || exitScenarios[exitScenarios.length - 1] || {};
    flows.push(-(totalEquity + gpFeeCalcs.totalUpfront));
    for (let y = 1; y <= holdYears; y++) {
      const yearData = yearly[y - 1];
      let cf;
      if (yearData) {
        cf = (yearData.cashFlowAfterFinancing ?? yearData.cashFlow ?? (yearData.noi - annualDebtService)) - gpFeeCalcs.totalAnnual;
      } else {
        cf = ((noiT12 || 100000) * Math.pow(1.02, y - 1) - annualDebtService) - gpFeeCalcs.totalAnnual;
      }
      // Add value-add NOI adjustments (rent upside + RUBS + expense savings)
      cf += vaTotalNOIAdj;
      if (y === holdYears) {
        // Use stabilized NOI for exit valuation when value-add is active
        const baseExit = selectedExit.saleProceeds || selectedExit.terminalValue || fullCalcs?.returns?.terminalValue || purchasePrice * 1.2;
        const saleProceeds = hasValueAdd && stabilizedValue > 0 ? Math.max(baseExit, stabilizedValue) : baseExit;
        const remainingLoan = selectedExit.remainingLoanBalance ?? (loanAmount * Math.pow(0.98, holdYears));
        cf += saleProceeds - remainingLoan - gpFeeCalcs.totalDisposition;
      }
      flows.push(cf);
    }
    return flows;
  }, [fullCalcs, holdYears, totalEquity, gpFeeCalcs, annualDebtService, noiT12, loanAmount, purchasePrice, vaTotalNOIAdj, hasValueAdd, stabilizedValue]);

  // ── Per-year NOI detail (for NOI breakdown table) ──
  const yearlyNOIDetail = useMemo(() => {
    const rows = [];
    const yearly = fullCalcs?.yearly || [];
    for (let y = 0; y < holdYears; y++) {
      const yd = yearly[y];
      const yearBaseNOI = yd?.noi ?? (noiT12 || 0) * Math.pow(1.02, y);
      const yearStabNOI = yearBaseNOI + vaTotalNOIAdj;
      const yearDS = annualDebtService || 0;
      const yearBaseCF = yearBaseNOI - yearDS;
      const yearStabCF = yearStabNOI - yearDS;
      rows.push({
        year: y + 1,
        baseNOI: yearBaseNOI,
        rentUpside: vaRentUpside,
        rubsRecovery: vaRubsRecovery,
        expSavings: vaExpenseSavings,
        stabNOI: yearStabNOI,
        debtService: yearDS,
        baseCF: yearBaseCF,
        stabCF: yearStabCF,
      });
    }
    return rows;
  }, [fullCalcs, holdYears, noiT12, vaTotalNOIAdj, vaRentUpside, vaRubsRecovery, vaExpenseSavings, annualDebtService]);

  // ═══════════════════════════════════════════════════════════════
  // WATERFALL DISTRIBUTION ENGINE (REAL IRR-HURDLE)
  // ═══════════════════════════════════════════════════════════════
  const waterfallResults = useMemo(() => {
    const N = holdYears;
    const lpCF = new Array(N + 1).fill(0);
    const gpCF = new Array(N + 1).fill(0);
    lpCF[0] = -lpContribution;
    gpCF[0] = -gpContribution;

    // Per-tier, per-year tracking for detail table
    // tierDetail[tierIdx][year] = { lpStart, lpDist, lpEnd, gpStart, gpDist, gpEnd }
    const tierDetail = activeTiers.map(() =>
      Array.from({ length: N + 1 }, () => ({ lpStart: 0, lpDist: 0, lpEnd: 0, gpStart: 0, gpDist: 0, gpEnd: 0 }))
    );

    // Tracking: totals by tier
    const lpByTier = {};
    const gpByTier = {};
    activeTiers.forEach(t => { lpByTier[t.name] = 0; gpByTier[t.name] = 0; });

    // Pref return tracking
    let lpPrefTotal = 0;
    let gpPrefTotal = 0;
    let lpReturnOfCapital = 0;
    let gpReturnOfCapital = 0;
    let gpFeesTotal = gpFeeCalcs.totalUpfront + gpFeeCalcs.totalAnnual * N + gpFeeCalcs.totalDisposition;
    let gpCatchupTotal = 0;

    if (profitMode === 'simple') {
      // ═══ SIMPLE MODE ═══
      const gpPct = gpShare / 100;
      const lpPct = lpShare / 100;
      const prefRate = (activeTiers[0]?.to_pct || 8) / 100; // use tier 1 pref rate

      if (splitMethod === 'return_capital_first' || splitMethod === 'pref_then_split') {
        let lpCapLeft = lpContribution;
        let gpCapLeft = gpContribution;
        let lpPrefOwed = 0;
        let gpPrefOwed = 0;

        for (let y = 1; y <= N; y++) {
          let avail = Math.max(yearlyCashFlows[y], 0);

          // Accrue preferred return on unreturned capital
          lpPrefOwed += lpCapLeft * prefRate;
          gpPrefOwed += gpCapLeft * prefRate;

          // 1) Pay LP preferred return
          if (avail > 0 && lpPrefOwed > 0) {
            const paid = Math.min(avail, lpPrefOwed);
            lpCF[y] += paid; avail -= paid; lpPrefOwed -= paid; lpPrefTotal += paid;
            lpByTier['Preferred Return'] = (lpByTier['Preferred Return'] || 0) + paid;
            tierDetail[0][y].lpDist += paid;
          }
          // 2) Pay GP preferred return
          if (avail > 0 && gpPrefOwed > 0) {
            const paid = Math.min(avail, gpPrefOwed);
            gpCF[y] += paid; avail -= paid; gpPrefOwed -= paid; gpPrefTotal += paid;
            gpByTier['Preferred Return'] = (gpByTier['Preferred Return'] || 0) + paid;
            tierDetail[0][y].gpDist += paid;
          }
          // 3) Return LP capital
          if (avail > 0 && lpCapLeft > 0) {
            const r = Math.min(avail, lpCapLeft);
            lpCF[y] += r; avail -= r; lpCapLeft -= r; lpReturnOfCapital += r;
            lpByTier['Return of Capital'] = (lpByTier['Return of Capital'] || 0) + r;
            tierDetail[0][y].lpDist += r;
          }
          // 4) Return GP capital
          if (avail > 0 && gpCapLeft > 0) {
            const r = Math.min(avail, gpCapLeft);
            gpCF[y] += r; avail -= r; gpCapLeft -= r; gpReturnOfCapital += r;
            gpByTier['Return of Capital'] = (gpByTier['Return of Capital'] || 0) + r;
            tierDetail[0][y].gpDist += r;
          }
          // 5) GP Catch-up (if enabled)
          if (avail > 0 && gpCatchup) {
            const totalDistSoFar = lpCF.reduce((s, v) => s + Math.max(v, 0), 0) + gpCF.reduce((s, v) => s + Math.max(v, 0), 0);
            const gpTargetShare = totalDistSoFar * gpPct;
            const gpReceivedSoFar = gpCF.reduce((s, v) => s + Math.max(v, 0), 0);
            const shortfall = gpTargetShare - gpReceivedSoFar;
            if (shortfall > 0) {
              const catchup = Math.min(avail, shortfall);
              gpCF[y] += catchup; avail -= catchup; gpCatchupTotal += catchup;
              gpByTier['GP Catch-up'] = (gpByTier['GP Catch-up'] || 0) + catchup;
            }
          }
          // 6) Split remaining profit
          if (avail > 0) {
            const lpP = avail * lpPct;
            const gpP = avail * gpPct;
            lpCF[y] += lpP; gpCF[y] += gpP;
            lpByTier['Excess Cash Flow'] = (lpByTier['Excess Cash Flow'] || 0) + lpP;
            gpByTier['Excess Cash Flow'] = (gpByTier['Excess Cash Flow'] || 0) + gpP;
            if (activeTiers.length > 1) {
              tierDetail[1][y].lpDist += lpP;
              tierDetail[1][y].gpDist += gpP;
            }
          }

          // Update tier 0 balance tracking
          tierDetail[0][y].lpStart = (y === 1) ? lpContribution : tierDetail[0][y - 1].lpEnd;
          tierDetail[0][y].lpEnd = Math.max(tierDetail[0][y].lpStart - tierDetail[0][y].lpDist, 0);
          tierDetail[0][y].gpStart = (y === 1) ? gpContribution : tierDetail[0][y - 1].gpEnd;
          tierDetail[0][y].gpEnd = Math.max(tierDetail[0][y].gpStart - tierDetail[0][y].gpDist, 0);
        }
      } else {
        // Pro-rata
        for (let y = 1; y <= N; y++) {
          const avail = Math.max(yearlyCashFlows[y], 0);
          const lpP = avail * (lpShare / 100);
          const gpP = avail * (gpShare / 100);
          lpCF[y] = lpP; gpCF[y] = gpP;
          lpByTier['Pro-Rata'] = (lpByTier['Pro-Rata'] || 0) + lpP;
          gpByTier['Pro-Rata'] = (gpByTier['Pro-Rata'] || 0) + gpP;
          tierDetail[0][y].lpDist = lpP;
          tierDetail[0][y].gpDist = gpP;
        }
      }
    } else {
      // ═══ WATERFALL MODE (IRR-HURDLE BASED) ═══
      // Strategy: distribute year-by-year through tiers.
      // Tier 1: preferred return accrual + capital return
      // Subsequent tiers: check if LP cumulative IRR exceeds tier's from_pct hurdle
      // If yes, distribute through this tier's split. If no, all cash stays in prior tier.

      let lpCapLeft = lpContribution;
      let gpCapLeft = gpContribution;
      let lpPrefOwed = 0;

      // Running LP cash flows for IRR checking
      const lpRunning = new Array(N + 1).fill(0);
      lpRunning[0] = -lpContribution;

      for (let y = 1; y <= N; y++) {
        let avail = Math.max(yearlyCashFlows[y], 0);

        // TIER 0: Capital Return + Preferred Return
        const tier0 = activeTiers[0];
        const prefRate = (tier0?.to_pct || 8) / 100;
        const t0LpPct = (tier0?.lp_split ?? 90) / 100;
        const t0GpPct = (tier0?.gp_split ?? 10) / 100;

        tierDetail[0][y].lpStart = lpCapLeft + lpPrefOwed;
        tierDetail[0][y].gpStart = gpCapLeft;

        // Accrue pref on unreturned LP capital
        lpPrefOwed += lpCapLeft * prefRate;

        // Pay LP pref
        if (avail > 0 && lpPrefOwed > 0) {
          const paid = Math.min(avail, lpPrefOwed);
          lpCF[y] += paid; avail -= paid; lpPrefOwed -= paid; lpPrefTotal += paid;
          lpByTier[tier0.name] = (lpByTier[tier0.name] || 0) + paid;
          tierDetail[0][y].lpDist += paid;
        }
        // Return LP capital
        if (avail > 0 && lpCapLeft > 0) {
          const r = Math.min(avail, lpCapLeft);
          lpCF[y] += r; avail -= r; lpCapLeft -= r; lpReturnOfCapital += r;
          lpByTier[tier0.name] = (lpByTier[tier0.name] || 0) + r;
          tierDetail[0][y].lpDist += r;
        }
        // Return GP capital (proportional)
        if (avail > 0 && gpCapLeft > 0) {
          const r = Math.min(avail * t0GpPct, gpCapLeft);
          gpCF[y] += r; avail -= r; gpCapLeft -= r; gpReturnOfCapital += r;
          gpByTier[tier0.name] = (gpByTier[tier0.name] || 0) + r;
          tierDetail[0][y].gpDist += r;
        }

        tierDetail[0][y].lpEnd = lpCapLeft + lpPrefOwed;
        tierDetail[0][y].gpEnd = gpCapLeft;

        // Update running LP for IRR check
        lpRunning[y] = lpCF[y];

        // GP CATCH-UP (if enabled, runs after tier 0 before promote tiers)
        if (avail > 0 && gpCatchup) {
          const totalDistSoFar = lpCF.reduce((s, v) => s + Math.max(v, 0), 0)
                               + gpCF.reduce((s, v) => s + Math.max(v, 0), 0) + avail;
          const gpPromotePct = (activeTiers[1]?.gp_split ?? gpShare) / 100;
          const gpTarget = totalDistSoFar * gpPromotePct;
          const gpReceived = gpCF.reduce((s, v) => s + Math.max(v, 0), 0);
          const shortfall = Math.max(gpTarget - gpReceived, 0);
          if (shortfall > 0) {
            const catchup = Math.min(avail, shortfall);
            gpCF[y] += catchup; avail -= catchup; gpCatchupTotal += catchup;
            gpByTier['GP Catch-up'] = (gpByTier['GP Catch-up'] || 0) + catchup;
          }
        }

        // PROMOTE TIERS (1+): check IRR hurdle before distributing
        for (let ti = 1; ti < activeTiers.length && avail > 0; ti++) {
          const tier = activeTiers[ti];
          const tLp = (tier.lp_split ?? (100 - gpShare)) / 100;
          const tGp = (tier.gp_split ?? gpShare) / 100;
          const hurdleFrom = (tier.from_pct || 0) / 100;

          tierDetail[ti][y].lpStart = 0;
          tierDetail[ti][y].gpStart = 0;

          // Check: does the LP's running IRR already exceed this tier's lower hurdle?
          const testCF = [...lpRunning];
          testCF[y] = (testCF[y] || 0); // current state before this tier
          const currentLpIRR = calcIRR(testCF) / 100;

          if (currentLpIRR < hurdleFrom && y < N) {
            // LP IRR hasn't reached this tier's hurdle yet — skip tier (cash stays below)
            // But still assign remaining to previous tier
            if (ti === 1) {
              // Give remainder to tier 0 split
              const lpA = avail * t0LpPct;
              const gpA = avail * t0GpPct;
              lpCF[y] += lpA; gpCF[y] += gpA;
              lpRunning[y] += lpA;
              avail -= (lpA + gpA);
              lpByTier[tier0.name] = (lpByTier[tier0.name] || 0) + lpA;
              gpByTier[tier0.name] = (gpByTier[tier0.name] || 0) + lpA > 0 ? gpA : 0;
              tierDetail[0][y].lpDist += lpA;
              tierDetail[0][y].gpDist += gpA;
            }
            break; // Don't check further tiers
          }

          // Distribute through this tier
          const lpA = avail * tLp;
          const gpA = avail * tGp;
          lpCF[y] += lpA; gpCF[y] += gpA;
          lpRunning[y] += lpA;
          avail -= (lpA + gpA);
          lpByTier[tier.name] = (lpByTier[tier.name] || 0) + lpA;
          gpByTier[tier.name] = (gpByTier[tier.name] || 0) + gpA;
          tierDetail[ti][y].lpDist = lpA;
          tierDetail[ti][y].gpDist = gpA;
        }
      }

      // LP CLAWBACK (at exit — if LP received more than entitled per final IRR/splits)
      if (lpClawback && N > 0) {
        const finalLpIRR = calcIRR(lpCF);
        const targetTier = activeTiers.find(t => finalLpIRR >= (t.from_pct || 0) && finalLpIRR < (t.to_pct || 100));
        if (targetTier) {
          const targetLpPct = (targetTier.lp_split ?? 90) / 100;
          const totalDist = lpCF.filter(v => v > 0).reduce((s, v) => s + v, 0) + gpCF.filter(v => v > 0).reduce((s, v) => s + v, 0);
          const lpEntitled = totalDist * targetLpPct;
          const lpReceived = lpCF.filter(v => v > 0).reduce((s, v) => s + v, 0);
          if (lpReceived > lpEntitled) {
            const clawback = lpReceived - lpEntitled;
            lpCF[N] -= clawback;
            gpCF[N] += clawback;
            lpByTier['LP Clawback'] = -clawback;
            gpByTier['LP Clawback'] = clawback;
          }
        }
      }
    }

    // ── Compute metrics ──
    const lpTotalDist = lpCF.filter(v => v > 0).reduce((s, v) => s + v, 0);
    const gpTotalDist = gpCF.filter(v => v > 0).reduce((s, v) => s + v, 0);
    const lpNetProfit = lpTotalDist - lpContribution;
    const gpNetProfit = gpTotalDist - gpContribution;
    const lpEMx = lpContribution > 0 ? lpTotalDist / lpContribution : 0;
    const gpEMx = gpContribution > 0 ? gpTotalDist / gpContribution : 0;
    const lpIRR = calcIRR(lpCF);
    const gpIRR = calcIRR(gpCF);
    const lpOpCF = lpCF.slice(1, N).reduce((s, v) => s + Math.max(v, 0), 0);
    const gpOpCF = gpCF.slice(1, N).reduce((s, v) => s + Math.max(v, 0), 0);
    const opYears = Math.max(N - 1, 1);
    const lpCashYield = lpContribution > 0 ? ((lpOpCF / opYears) / lpContribution) * 100 : 0;
    const gpCashYield = gpContribution > 0 ? ((gpOpCF / opYears) / gpContribution) * 100 : 0;
    const lpExcessCF = Math.max(lpTotalDist - lpReturnOfCapital - lpPrefTotal, 0);
    const gpExcessCF = Math.max(gpTotalDist - gpReturnOfCapital - gpPrefTotal - gpCatchupTotal, 0);

    return {
      lpCF, gpCF, tierDetail,
      lpContribution, gpContribution, totalEquity,
      lpTotalDist, gpTotalDist,
      lpNetProfit, gpNetProfit,
      lpEMx, gpEMx, lpIRR, gpIRR,
      lpCashYield, gpCashYield,
      lpByTier, gpByTier,
      lpPrefTotal, gpPrefTotal,
      lpReturnOfCapital, gpReturnOfCapital,
      lpExcessCF, gpExcessCF,
      gpFeesTotal: gpFeeCalcs.totalUpfront + gpFeeCalcs.totalAnnual * N + gpFeeCalcs.totalDisposition,
      gpCatchupTotal,
    };
  }, [yearlyCashFlows, holdYears, lpContribution, gpContribution, lpShare, gpShare,
      profitMode, splitMethod, activeTiers, totalEquity, gpCatchup, lpClawback, gpFeeCalcs]);

  // ── Year labels ──
  const currentYear = new Date().getFullYear();
  const yearLabels = Array.from({ length: holdYears + 1 }, (_, y) => ({
    year: y, label: `Year ${y}`, date: `Jan-${currentYear + y}`
  }));

  // ═══════════════════════════════════════════════════════════════
  // SUB-COMPONENTS
  // ═══════════════════════════════════════════════════════════════
  const SectionHeader = ({ num, title, open, setOpen }) => (
    <div onClick={() => setOpen(!open)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '16px 0',
               borderBottom: open ? `1px solid ${B}` : 'none', marginBottom: open ? 20 : 0 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>{num}. {title}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: LB,
                     transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
    </div>
  );

  const Dropdown = ({ value, onChange, options, width }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...INP, width: width || '100%', cursor: 'pointer', appearance: 'auto' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const TH = ({ children, align }) => (
    <th style={{ padding: '10px 12px', textAlign: align || 'left', fontWeight: 700, color: LB, fontSize: 10, textTransform: 'uppercase' }}>{children}</th>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 0' }}>

      {/* ═══ PARTNERSHIP TYPE & SHARE ═══ */}
      <div style={SC}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 8 }}>Partnership Type</div>
            <Dropdown value={partnershipType}
              onChange={v => update('partnership_type', v)}
              options={[
                { value: 'traditional', label: 'Traditional Partnership' },
                { value: 'jv', label: 'Joint Venture' },
                { value: 'fund', label: 'Fund Structure' },
              ]} />
          </div>
          <div />
        </div>
        <div style={{ borderTop: `1px solid ${B}`, paddingTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: VL, marginBottom: 16 }}>Partnership Share</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>General Partner</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={0} max={100} step={1} value={gpShare}
                  onChange={e => update('gp_share', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  style={{ ...INP, width: 100, fontWeight: 700 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: VL }}>%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>Limited Partner</label>
              <div style={{ fontSize: 16, fontWeight: 700, color: VL, padding: '8px 12px',
                            background: '#f9fafb', borderRadius: 8, border: `1px solid ${B}` }}>
                {lpShare.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 1. FUNDING CONTRIBUTION ═══ */}
      <div style={SC}>
        <SectionHeader num={1} title="Funding Contribution" open={fundingOpen} setOpen={setFundingOpen} />
        {fundingOpen && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: LB, marginBottom: 8 }}>Contribution Type</div>
            <Dropdown value={contributionType}
              onChange={v => update('funding.contribution_type', v)}
              options={[{ value: 'default', label: 'Default' }, { value: 'custom', label: 'Custom Split' }]}
              width={250} />
            <div style={{ fontSize: 12, color: LB, marginTop: 8, fontStyle: 'italic' }}>
              GP funds {gpShare}%, LP funds {lpShare.toFixed(0)}%
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>
              {[
                { label: 'Total Equity Required', val: fmt(totalEquity), bg: '#f9fafb', bc: B, c: VL },
                { label: `LP Contribution (${lpShare.toFixed(0)}%)`, val: fmt(lpContribution), bg: '#f0fdf4', bc: '#a7f3d0', c: '#047857' },
                { label: `GP Contribution (${gpShare}%)`, val: fmt(gpContribution), bg: '#eef2ff', bc: '#c7d2fe', c: AC },
              ].map((card, i) => (
                <div key={i} style={{ padding: 16, borderRadius: 10, background: card.bg, border: `1px solid ${card.bc}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: card.c, textTransform: 'uppercase', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: card.c }}>{card.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 2. GP FEES ═══ */}
      <div style={SC}>
        <SectionHeader num={2} title="GP Fees" open={feesOpen} setOpen={setFeesOpen} />
        {feesOpen && (
          <div>
            {/* Transaction Fees */}
            <div style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Transaction Fees</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              {[
                { label: 'Acquisition Fee', key: 'acquisition_fee', fee: acqFee,
                  types: [{ value: 'fixed', label: 'Fixed Amount ($)' }, { value: 'pct_purchase', label: '% of Purchase' }] },
                { label: 'Disposition Fee', key: 'disposition_fee', fee: dispFee,
                  types: [{ value: 'fixed', label: 'Fixed Amount ($)' }, { value: 'pct_sale', label: '% of Sale Price' }] },
              ].map(({ label, key, fee, types }) => (
                <div key={key}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Dropdown value={fee.type || 'fixed'} onChange={v => update(`gp_fees.${key}.type`, v)} options={types} width={160} />
                    {(fee.type || 'fixed') === 'fixed' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <span style={{ fontSize: 13, color: LB }}>$</span>
                        <input type="number" value={fee.amount || ''} placeholder="0"
                          onChange={e => update(`gp_fees.${key}.amount`, parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <input type="number" value={fee.pct || ''} placeholder="0"
                          onChange={e => update(`gp_fees.${key}.pct`, parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                        <span style={{ fontSize: 13, color: LB }}>%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ongoing Operational Fees */}
            <div style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, borderTop: `1px solid ${B}`, paddingTop: 20 }}>Ongoing Operational Fees</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              {[
                { label: 'Asset Management Fee', key: 'asset_mgmt_fee', fee: assetMgmtFee },
                { label: 'Property Management Fee', key: 'property_mgmt_fee', fee: propMgmtFee },
              ].map(({ label, key, fee }) => (
                <div key={key}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Dropdown value="pct_egi" onChange={() => {}} options={[{ value: 'pct_egi', label: '% of EGI' }]} width={160} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                      <input type="number" value={fee.pct || ''} placeholder="0"
                        onChange={e => update(`gp_fees.${key}.pct`, parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                      <span style={{ fontSize: 13, color: LB }}>%</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, color: LB }}>Minimum Fee Floor</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: LB }}>$</span>
                        <input type="number" value={fee.min_floor || ''} placeholder="0"
                          onChange={e => update(`gp_fees.${key}.min_floor`, parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: LB }}>Payment Frequency</span>
                      <div style={{ marginTop: 4 }}>
                        <Dropdown value={fee.frequency || 'monthly'}
                          onChange={v => update(`gp_fees.${key}.frequency`, v)}
                          options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annually', label: 'Annually' }]} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Capitalization Fees */}
            <div style={{ fontSize: 12, fontWeight: 700, color: VL, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, borderTop: `1px solid ${B}`, paddingTop: 20 }}>Capitalization Fees</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 6 }}>Organizational Fee</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Dropdown value="fixed" onChange={() => {}} options={[{ value: 'fixed', label: 'Fixed Amount ($)' }]} width={160} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 13, color: LB }}>$</span>
                    <input type="number" value={orgFee.amount || ''} placeholder="0"
                      onChange={e => update('gp_fees.org_fee.amount', parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 6 }}>Capital Raise Fee</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <Dropdown value="pct_lp_equity" onChange={() => {}} options={[{ value: 'pct_lp_equity', label: '% LP Equity Raised' }]} width={160} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <input type="number" value={capRaiseFee.pct || ''} placeholder="0"
                      onChange={e => update('gp_fees.capital_raise_fee.pct', parseFloat(e.target.value) || 0)} style={{ ...INP, width: '100%' }} />
                    <span style={{ fontSize: 13, color: LB }}>%</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: LB }}>Payment Time</span>
                  <div style={{ marginTop: 4 }}>
                    <Dropdown value={capRaiseFee.payment_time || 'committed'}
                      onChange={v => update('gp_fees.capital_raise_fee.payment_time', v)}
                      options={[{ value: 'committed', label: 'Committed Capital' }, { value: 'called', label: 'Called Capital' }]} />
                  </div>
                </div>
              </div>
            </div>

            {(gpFeeCalcs.totalUpfront > 0 || gpFeeCalcs.totalAnnual > 0 || gpFeeCalcs.totalDisposition > 0) && (
              <div style={{ marginTop: 20, padding: '14px 18px', background: '#eef2ff', borderRadius: 10, border: '1px solid #c7d2fe' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3', marginBottom: 8 }}>Fee Summary</div>
                <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                  <span>Upfront: <strong>{fmt(gpFeeCalcs.totalUpfront)}</strong></span>
                  <span>Annual: <strong>{fmt(gpFeeCalcs.totalAnnual)}</strong>/yr</span>
                  <span>Disposition: <strong>{fmt(gpFeeCalcs.totalDisposition)}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 3. PROFIT DISTRIBUTION ═══ */}
      <div style={SC}>
        <SectionHeader num={3} title="Profit Distribution" open={profitOpen} setOpen={setProfitOpen} />
        {profitOpen && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>Partnership Profit Share</label>
                <Dropdown value={profitMode}
                  onChange={v => update('profit_distribution.mode', v)}
                  options={[{ value: 'simple', label: 'Simple' }, { value: 'waterfall', label: 'Waterfall' }]} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>GP Share</label>
                <div style={{ fontSize: 16, fontWeight: 700, color: VL, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: `1px solid ${B}` }}>{gpShare}%</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>LP Share</label>
                <div style={{ fontSize: 16, fontWeight: 700, color: VL, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: `1px solid ${B}` }}>{lpShare.toFixed(2)}%</div>
              </div>
            </div>

            {profitMode === 'simple' ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 14 }}>Simple Settings</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>Refinance Proceeds Treatment</label>
                    <Dropdown value={refinanceProceeds ? 'on' : 'off'}
                      onChange={v => update('profit_distribution.refinance_proceeds', v === 'on')}
                      options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>Profit Split Method</label>
                    <Dropdown value={splitMethod}
                      onChange={v => update('profit_distribution.split_method', v)}
                      options={[
                        { value: 'return_capital_first', label: 'Return Capital First' },
                        { value: 'pro_rata', label: 'Pro-Rata' },
                        { value: 'pref_then_split', label: 'Preferred Return Then Split' },
                      ]} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 14 }}>Waterfall Settings</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>GP Catch-up</label>
                    <Dropdown value={gpCatchup ? 'yes' : 'no'}
                      onChange={v => update('profit_distribution.gp_catchup', v === 'yes')}
                      options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>LP Clawback</label>
                    <Dropdown value={lpClawback ? 'yes' : 'no'}
                      onChange={v => update('profit_distribution.lp_clawback', v === 'yes')}
                      options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: LB, marginBottom: 6, display: 'block' }}>Tiers to Model</label>
                    <input type="number" min={1} max={8} value={tiersToModel}
                      onChange={e => update('profit_distribution.tiers_to_model', Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                      style={{ ...INP, width: '100%', fontWeight: 700 }} />
                  </div>
                </div>

                {/* ─── WATERFALL TIERS TABLE (editable GP% / LP%) ─── */}
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 10 }}>Waterfall Tiers</div>
                <div style={{ overflowX: 'auto', border: `1px solid ${B}`, borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: `2px solid ${B}` }}>
                        <TH>Tier Name</TH>
                        <TH>Hurdle Type</TH>
                        <TH align="center">From</TH>
                        <TH align="center">To</TH>
                        <TH align="center">GP Promote</TH>
                        <TH align="center">GP %</TH>
                        <TH align="center">LP %</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTiers.map((tier, idx) => {
                        const updateTier = (field, val) => {
                          const upd = [...activeTiers];
                          upd[idx] = { ...upd[idx], [field]: val };
                          // Auto-sync LP = 100 - GP
                          if (field === 'gp_split') upd[idx].lp_split = 100 - val;
                          if (field === 'lp_split') upd[idx].gp_split = 100 - val;
                          update('profit_distribution.tiers', upd);
                        };
                        return (
                          <tr key={idx} style={{ borderBottom: `1px solid ${B}` }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: VL, whiteSpace: 'nowrap' }}>
                              Tier {idx + 1} - {tier.name}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <Dropdown value={tier.hurdle_type}
                                onChange={v => updateTier('hurdle_type', v)}
                                options={[{ value: 'IRR', label: 'IRR' }, { value: 'EMx', label: 'Equity Multiple' }, { value: 'CoC', label: 'Cash on Cash' }]}
                                width={110} />
                            </td>
                            {/* From % */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <input type="number" value={tier.from_pct} style={{ ...INP, width: 60, textAlign: 'center' }}
                                  onChange={e => updateTier('from_pct', parseFloat(e.target.value) || 0)} />
                                <span style={{ color: LB }}>%</span>
                              </div>
                            </td>
                            {/* To % */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <input type="number" value={tier.to_pct || ''} placeholder="%" style={{ ...INP, width: 60, textAlign: 'center' }}
                                  onChange={e => updateTier('to_pct', parseFloat(e.target.value) || 0)} />
                                <span style={{ color: LB }}>%</span>
                              </div>
                            </td>
                            {/* GP Promote % */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <input type="number" value={tier.gp_promote || ''} placeholder="%" style={{ ...INP, width: 60, textAlign: 'center' }}
                                  onChange={e => updateTier('gp_promote', parseFloat(e.target.value) || 0)} />
                                <span style={{ color: LB }}>%</span>
                              </div>
                            </td>
                            {/* GP % EDITABLE */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <input type="number" min={0} max={100}
                                  value={tier.gp_split ?? gpShare}
                                  style={{ ...INP, width: 60, textAlign: 'center', fontWeight: 700 }}
                                  onChange={e => updateTier('gp_split', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                                <span style={{ color: LB }}>%</span>
                              </div>
                            </td>
                            {/* LP % EDITABLE */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <input type="number" min={0} max={100}
                                  value={tier.lp_split ?? lpShare}
                                  style={{ ...INP, width: 60, textAlign: 'center', fontWeight: 700 }}
                                  onChange={e => updateTier('lp_split', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                                <span style={{ color: LB }}>%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activeTiers[0] && (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: '#eef2ff', borderRadius: 8,
                                border: '1px solid #c7d2fe', fontSize: 12, color: '#3730a3', lineHeight: 1.5 }}>
                    <strong>Tier 1 &ndash; {activeTiers[0].name}:</strong>{' '}
                    Investors first receive their contributed capital back plus a{' '}
                    {activeTiers[0].to_pct || 0}% preferred return ({activeTiers[0].hurdle_type}).{' '}
                    Split: {activeTiers[0].lp_split ?? lpShare}% LP / {activeTiers[0].gp_split ?? gpShare}% GP.
                    {gpCatchup && ' GP Catch-up is enabled — GP receives 100% after pref until caught up.'}
                    {lpClawback && ' LP Clawback is enabled — excess LP distributions are reconciled at exit.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ NOI & CASH FLOW WATERFALL BREAKDOWN ═══ */}
      <div style={SC}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: noiBreakdownOpen ? 20 : 0 }}
          onClick={() => setNoiBreakdownOpen(!noiBreakdownOpen)}>
          <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>NOI &amp; Cash Flow Waterfall</span>
          <span style={{ fontSize: 12, color: LB, transform: noiBreakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
        </div>
        {noiBreakdownOpen && (
          <div>
            {/* ── Waterfall from Revenue → NOI → Cash Flow ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              {/* Current (Day 1) */}
              <div style={{ borderRadius: 12, border: `1px solid ${B}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: '#f9fafb', borderBottom: `1px solid ${B}` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: VL }}>Current (Day 1)</div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {[
                    { label: 'Gross Revenue', value: fmt(grossRevenue), color: VL },
                    { label: 'Total Operating Expenses', value: fmt(-totalExpenses), color: '#ef4444' },
                    { label: 'Net Operating Income (NOI)', value: fmt(baseNOI), color: VL, bold: true, divider: true },
                    { label: 'Annual Debt Service', value: fmt(-dsAnnual), color: '#ef4444' },
                    { label: 'GP Annual Fees', value: fmt(-gpFeeCalcs.totalAnnual), color: '#ef4444' },
                    { label: 'Cash Flow After Debt', value: fmt(baseCashFlow - gpFeeCalcs.totalAnnual), color: baseCashFlow > 0 ? '#047857' : '#ef4444', bold: true, divider: true },
                  ].map((r, i) => (
                    <div key={i}>
                      {r.divider && <div style={{ borderTop: `2px solid ${B}`, margin: '8px 0' }} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                        <span style={{ color: r.bold ? VL : LB, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                        <span style={{ fontWeight: r.bold ? 800 : 600, color: r.color }}>{r.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stabilized (After Value-Add) */}
              <div style={{ borderRadius: 12, border: `2px solid ${hasValueAdd ? '#22c55e' : B}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', background: hasValueAdd ? '#f0fdf4' : '#f9fafb', borderBottom: `1px solid ${hasValueAdd ? '#a7f3d0' : B}` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: hasValueAdd ? '#047857' : VL }}>
                    Stabilized (After Value-Add){!hasValueAdd && <span style={{ fontSize: 11, fontWeight: 400, color: LB, marginLeft: 8 }}> — No adjustments active</span>}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {[
                    { label: 'Gross Revenue', value: fmt(grossRevenue), color: VL },
                    ...(vaRentUpside > 0 ? [{ label: '+ Rent Optimization', value: `+${fmt(vaRentUpside)}`, color: '#22c55e' }] : []),
                    ...(vaRubsRecovery > 0 ? [{ label: '+ RUBS Recovery', value: `+${fmt(vaRubsRecovery)}`, color: '#22c55e' }] : []),
                    { label: 'Total Operating Expenses', value: fmt(-totalExpenses), color: '#ef4444' },
                    ...(vaExpenseSavings > 0 ? [{ label: '+ Expense Savings', value: `+${fmt(vaExpenseSavings)}`, color: '#22c55e' }] : []),
                    { label: 'Stabilized NOI', value: fmt(stabilizedNOI), color: hasValueAdd ? '#047857' : VL, bold: true, divider: true },
                    ...(hasValueAdd ? [{ label: 'NOI Lift from Value-Add', value: `+${fmt(vaTotalNOIAdj)}`, color: '#22c55e' }] : []),
                    { label: 'Annual Debt Service', value: fmt(-dsAnnual), color: '#ef4444' },
                    { label: 'GP Annual Fees', value: fmt(-gpFeeCalcs.totalAnnual), color: '#ef4444' },
                    { label: 'Stabilized Cash Flow', value: fmt(stabilizedCashFlow - gpFeeCalcs.totalAnnual), color: stabilizedCashFlow > 0 ? '#047857' : '#ef4444', bold: true, divider: true },
                    ...(hasValueAdd ? [{ label: 'Stabilized Property Value', value: fmt(Math.round(stabilizedValue)), color: AC }] : []),
                  ].map((r, i) => (
                    <div key={i}>
                      {r.divider && <div style={{ borderTop: `2px solid ${hasValueAdd ? '#a7f3d0' : B}`, margin: '8px 0' }} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}>
                        <span style={{ color: r.bold ? VL : LB, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                        <span style={{ fontWeight: r.bold ? 800 : 600, color: r.color }}>{r.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Year-by-Year NOI Progression Table ── */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${B}` }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: VL, width: 180 }}>Metric</th>
                    {yearlyNOIDetail.map(r => (
                      <th key={r.year} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: VL }}>Year {r.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: VL }}>Base NOI</td>
                    {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: VL }}>{fmt(r.baseNOI)}</td>)}
                  </tr>
                  {vaRentUpside > 0 && (
                    <tr style={{ borderBottom: `1px solid ${B}` }}>
                      <td style={{ padding: '8px 12px', color: '#22c55e', paddingLeft: 20 }}>+ Rent Optimization</td>
                      {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e' }}>+{fmt(r.rentUpside)}</td>)}
                    </tr>
                  )}
                  {vaRubsRecovery > 0 && (
                    <tr style={{ borderBottom: `1px solid ${B}` }}>
                      <td style={{ padding: '8px 12px', color: '#22c55e', paddingLeft: 20 }}>+ RUBS Recovery</td>
                      {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e' }}>+{fmt(r.rubsRecovery)}</td>)}
                    </tr>
                  )}
                  {vaExpenseSavings > 0 && (
                    <tr style={{ borderBottom: `1px solid ${B}` }}>
                      <td style={{ padding: '8px 12px', color: '#22c55e', paddingLeft: 20 }}>+ Expense Savings</td>
                      {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e' }}>+{fmt(r.expSavings)}</td>)}
                    </tr>
                  )}
                  <tr style={{ background: '#f0fdf4', borderBottom: `2px solid ${B}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: '#047857' }}>Stabilized NOI</td>
                    {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>{fmt(r.stabNOI)}</td>)}
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '8px 12px', color: '#ef4444' }}>– Debt Service</td>
                    {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444' }}>{fmt(-r.debtService)}</td>)}
                  </tr>
                  <tr style={{ background: '#f9fafb', borderBottom: `2px solid ${B}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: VL }}>Cash Flow After Debt</td>
                    {yearlyNOIDetail.map(r => <td key={r.year} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: r.stabCF >= 0 ? '#047857' : '#ef4444' }}>{fmt(r.stabCF)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MONTHLY GP / LP DISTRIBUTION BREAKDOWN ═══ */}
      <div style={SC}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: monthlyDistOpen ? 20 : 0 }}
          onClick={() => setMonthlyDistOpen(!monthlyDistOpen)}>
          <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>Monthly GP &amp; LP Distributions</span>
          <span style={{ fontSize: 12, color: LB, transform: monthlyDistOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
        </div>
        {monthlyDistOpen && (() => {
          const lpPct = lpShare / 100;
          const gpPct = gpShare / 100;
          // Current monthly
          const monthlyBaseCF = Math.max((baseCashFlow - gpFeeCalcs.totalAnnual) / 12, 0);
          const monthlyStabCF = Math.max((stabilizedCashFlow - gpFeeCalcs.totalAnnual) / 12, 0);
          const monthlyLPBase = monthlyBaseCF * lpPct;
          const monthlyGPBase = monthlyBaseCF * gpPct;
          const monthlyLPStab = monthlyStabCF * lpPct;
          const monthlyGPStab = monthlyStabCF * gpPct;
          const annualLPBase = monthlyLPBase * 12;
          const annualGPBase = monthlyGPBase * 12;
          const annualLPStab = monthlyLPStab * 12;
          const annualGPStab = monthlyGPStab * 12;
          return (
            <div>
              <div style={{ fontSize: 12, color: LB, marginBottom: 16 }}>
                Operating cash flow split between GP ({gpShare}%) and LP ({lpShare.toFixed(0)}%) — excludes exit proceeds, pref accrual, and promote tiers. Based on {gpShare}/{lpShare.toFixed(0)} contribution split.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: hasValueAdd ? '1fr 1fr' : '1fr', gap: 24 }}>

                {/* Current Distribution */}
                <div style={{ borderRadius: 12, border: `1px solid ${B}`, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', background: '#f9fafb', borderBottom: `1px solid ${B}` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: VL }}>Current (Day 1) Distributions</div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    {/* Cash Flow bar */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>NOI to Distributions Flow</div>
                      {[
                        { label: 'NOI', val: fmt(baseNOI), sub: `${fmt(Math.round(baseNOI / 12))}/mo` },
                        { label: '– Debt Svc', val: fmt(-dsAnnual), sub: `${fmt(Math.round(dsAnnual / 12))}/mo`, color: '#ef4444' },
                        { label: '– GP Fees', val: fmt(-gpFeeCalcs.totalAnnual), sub: `${fmt(Math.round(gpFeeCalcs.totalAnnual / 12))}/mo`, color: '#ef4444' },
                        { label: '= Distributable CF', val: fmt(Math.max(baseCashFlow - gpFeeCalcs.totalAnnual, 0)), sub: `${fmt(Math.round(monthlyBaseCF))}/mo`, color: '#047857', bold: true },
                      ].map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: r.bold ? 'none' : `1px solid #f3f4f6` }}>
                          <span style={{ fontSize: 12, color: r.color || LB, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 12, fontWeight: r.bold ? 800 : 600, color: r.color || VL }}>{r.val}</span>
                            <div style={{ fontSize: 10, color: LB }}>{r.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* LP / GP split */}
                    <div style={{ borderTop: `2px solid ${B}`, paddingTop: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', textTransform: 'uppercase', marginBottom: 6 }}>LP Take-Home ({lpShare.toFixed(0)}%)</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>{fmt(Math.round(monthlyLPBase))}<span style={{ fontSize: 11, color: LB }}>/mo</span></div>
                          <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>{fmt(Math.round(annualLPBase))}/yr</div>
                        </div>
                        <div style={{ padding: 14, borderRadius: 10, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: AC, textTransform: 'uppercase', marginBottom: 6 }}>GP Take-Home ({gpShare}%)</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: AC }}>{fmt(Math.round(monthlyGPBase))}<span style={{ fontSize: 11, color: LB }}>/mo</span></div>
                          <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>{fmt(Math.round(annualGPBase))}/yr</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stabilized Distribution (only if value-add active) */}
                {hasValueAdd && (
                  <div style={{ borderRadius: 12, border: '2px solid #22c55e', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', background: '#f0fdf4', borderBottom: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#047857' }}>Stabilized (After Value-Add)</div>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 6 }}>Stabilized NOI to Distributions</div>
                        {[
                          { label: 'Stabilized NOI', val: fmt(stabilizedNOI), sub: `${fmt(Math.round(stabilizedNOI / 12))}/mo` },
                          { label: '– Debt Svc', val: fmt(-dsAnnual), sub: `${fmt(Math.round(dsAnnual / 12))}/mo`, color: '#ef4444' },
                          { label: '– GP Fees', val: fmt(-gpFeeCalcs.totalAnnual), sub: `${fmt(Math.round(gpFeeCalcs.totalAnnual / 12))}/mo`, color: '#ef4444' },
                          { label: '= Distributable CF', val: fmt(Math.max(stabilizedCashFlow - gpFeeCalcs.totalAnnual, 0)), sub: `${fmt(Math.round(monthlyStabCF))}/mo`, color: '#047857', bold: true },
                        ].map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: r.bold ? 'none' : `1px solid #f3f4f6` }}>
                            <span style={{ fontSize: 12, color: r.color || LB, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 12, fontWeight: r.bold ? 800 : 600, color: r.color || VL }}>{r.val}</span>
                              <div style={{ fontSize: 10, color: LB }}>{r.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '2px solid #a7f3d0', paddingTop: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', textTransform: 'uppercase', marginBottom: 6 }}>LP Take-Home ({lpShare.toFixed(0)}%)</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>{fmt(Math.round(monthlyLPStab))}<span style={{ fontSize: 11, color: LB }}>/mo</span></div>
                            <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>{fmt(Math.round(annualLPStab))}/yr</div>
                            {monthlyLPStab > monthlyLPBase && (
                              <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4, fontWeight: 700 }}>
                                +{fmt(Math.round(monthlyLPStab - monthlyLPBase))}/mo vs current
                              </div>
                            )}
                          </div>
                          <div style={{ padding: 14, borderRadius: 10, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: AC, textTransform: 'uppercase', marginBottom: 6 }}>GP Take-Home ({gpShare}%)</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: AC }}>{fmt(Math.round(monthlyGPStab))}<span style={{ fontSize: 11, color: LB }}>/mo</span></div>
                            <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>{fmt(Math.round(annualGPStab))}/yr</div>
                            {monthlyGPStab > monthlyGPBase && (
                              <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4, fontWeight: 700 }}>
                                +{fmt(Math.round(monthlyGPStab - monthlyGPBase))}/mo vs current
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Full year-by-year distribution table */}
              <div style={{ marginTop: 24, overflowX: 'auto' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: VL, marginBottom: 10 }}>Year-by-Year Distribution Schedule</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${B}` }}>
                      {['Year', 'NOI', 'Value-Add Adj.', 'Stab. NOI', 'Debt Service', 'GP Fees', 'Dist. CF', 'LP Monthly', 'LP Annual', 'GP Monthly', 'GP Annual'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 8px', textAlign: i === 0 ? 'center' : 'right', fontWeight: 700, color: LB, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyNOIDetail.map(r => {
                      const distribCF = Math.max(r.stabCF - gpFeeCalcs.totalAnnual, 0);
                      const lpAnn = distribCF * lpPct;
                      const gpAnn = distribCF * gpPct;
                      return (
                        <tr key={r.year} style={{ borderBottom: `1px solid ${B}` }}>
                          <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: AC }}>Yr {r.year}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: VL }}>{fmt(r.baseNOI)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: vaTotalNOIAdj > 0 ? '#22c55e' : LB }}>{vaTotalNOIAdj > 0 ? `+${fmt(vaTotalNOIAdj)}` : '—'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>{fmt(r.stabNOI)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#ef4444' }}>{fmt(-r.debtService)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#ef4444' }}>{fmt(-gpFeeCalcs.totalAnnual)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: distribCF > 0 ? '#047857' : '#ef4444' }}>{fmt(distribCF)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>{fmt(Math.round(lpAnn / 12))}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: '#047857' }}>{fmt(Math.round(lpAnn))}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: AC }}>{fmt(Math.round(gpAnn / 12))}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', color: AC }}>{fmt(Math.round(gpAnn))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ═══ LP & GP SUMMARY CARDS ═══ */}
      <div style={{ ...SC, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${B}`, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          onClick={() => setResultsOpen(!resultsOpen)}>
          <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>Partnership Returns</span>
          <span style={{ fontSize: 12, color: LB, transform: resultsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
        </div>
        {resultsOpen && (
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* ── LP Card ── */}
              <div style={{ borderRadius: 12, border: '2px solid #a7f3d0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: VL, marginBottom: 16 }}>Limited Partners</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: 14, background: '#f0fdf4', borderRadius: 8 }}>
                    {[
                      { label: 'IRR', val: `${waterfallResults.lpIRR.toFixed(1)}%` },
                      { label: 'Equity Multiple', val: `${waterfallResults.lpEMx.toFixed(2)}X` },
                      { label: 'Cash Yield', val: `${waterfallResults.lpCashYield.toFixed(1)}%` },
                    ].map((m, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: LB, marginBottom: 12 }}>
                    Share on Contribution / Distribution: <strong>{lpShare.toFixed(0)}% / 100%</strong>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: VL, marginBottom: 10 }}>Cash Flow Breakdown</div>
                  {[
                    { label: 'GP Fees', value: fmt(0) },
                    { label: 'Preferred Return', value: fmt(waterfallResults.lpPrefTotal) },
                    { label: 'Return of Capital', value: fmt(waterfallResults.lpReturnOfCapital) },
                    { label: 'Excess Cash Flow', value: fmt(waterfallResults.lpExcessCF) },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                                         borderBottom: i < 3 ? `1px solid ${B}` : 'none', fontSize: 12 }}>
                      <span style={{ color: LB }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: VL }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `2px solid ${B}`, marginTop: 12, paddingTop: 12 }}>
                    {[
                      { label: 'Total Distributions', value: fmt(waterfallResults.lpTotalDist), color: VL },
                      { label: 'Total Contributions', value: fmt(lpContribution), color: VL },
                      { label: 'Net Profit', value: fmt(waterfallResults.lpNetProfit), color: '#047857' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                        <span style={{ fontWeight: i === 2 ? 700 : 600, color: VL }}>{r.label}</span>
                        <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── GP Card ── */}
              <div style={{ borderRadius: 12, border: '2px solid #c7d2fe', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: VL, marginBottom: 16 }}>General Partner</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: 14, background: '#eef2ff', borderRadius: 8 }}>
                    {[
                      { label: 'IRR', val: `${waterfallResults.gpIRR.toFixed(1)}%` },
                      { label: 'Equity Multiple', val: `${waterfallResults.gpEMx.toFixed(2)}X` },
                      { label: 'Cash Yield', val: `${waterfallResults.gpCashYield.toFixed(1)}%` },
                    ].map((m, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: AC }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: LB, marginBottom: 12 }}>
                    Share on Contribution / Distribution: <strong>{gpShare}%</strong>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: VL, marginBottom: 10 }}>Cash Flow Breakdown</div>
                  {[
                    { label: 'GP Fees', value: fmt(waterfallResults.gpFeesTotal) },
                    { label: 'Preferred Return', value: fmt(waterfallResults.gpPrefTotal) },
                    { label: 'Return of Capital', value: fmt(waterfallResults.gpReturnOfCapital) },
                    ...(waterfallResults.gpCatchupTotal > 0 ? [{ label: 'GP Catch-up', value: fmt(waterfallResults.gpCatchupTotal) }] : []),
                    { label: 'Excess Cash Flow', value: fmt(waterfallResults.gpExcessCF) },
                  ].map((r, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                                         borderBottom: i < arr.length - 1 ? `1px solid ${B}` : 'none', fontSize: 12 }}>
                      <span style={{ color: LB }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: VL }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `2px solid ${B}`, marginTop: 12, paddingTop: 12 }}>
                    {[
                      { label: 'Total Distributions', value: fmt(waterfallResults.gpTotalDist), color: VL },
                      { label: 'Total Contributions', value: fmt(gpContribution), color: VL },
                      { label: 'Net Profit', value: fmt(waterfallResults.gpNetProfit), color: AC },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                        <span style={{ fontWeight: i === 2 ? 700 : 600, color: VL }}>{r.label}</span>
                        <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ PARTNERSHIP CASH FLOW OVERVIEW ═══ */}
      <div style={SC}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: overviewOpen ? 20 : 0 }}
          onClick={() => setOverviewOpen(!overviewOpen)}>
          <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>Partnership Cash Flow Overview</span>
          <span style={{ fontSize: 12, color: LB, transform: overviewOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
        </div>
        {overviewOpen && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B}` }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: VL, width: 200, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Annual Cash Flow</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: VL }}>SubTotal</th>
                  {yearLabels.map(yl => (
                    <th key={yl.year} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      <div style={{ color: VL }}>{yl.label}</div>
                      <div style={{ fontSize: 10, color: LB }}>{yl.date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Levered Project Cash Flow */}
                <tr style={{ background: '#faf5ff', borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: AC, fontSize: 11, textTransform: 'uppercase', position: 'sticky', left: 0, background: '#faf5ff', zIndex: 1 }}>Levered Project Cash Flow</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: VL }}>{fmt(yearlyCashFlows.reduce((s, v) => s + v, 0))}</td>
                  {yearlyCashFlows.map((cf, i) => (
                    <td key={i} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: cf < 0 ? '#ef4444' : VL }}>{fmt(cf)}</td>
                  ))}
                </tr>

                <tr><td colSpan={2 + yearLabels.length} style={{ padding: 6 }} /></tr>

                {/* LIMITED PARTNER */}
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td colSpan={2 + yearLabels.length} style={{ padding: '10px 12px', fontWeight: 800, color: '#047857', fontSize: 11, textTransform: 'uppercase', background: '#f0fdf4' }}>Limited Partner</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '8px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Contributions</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(-lpContribution)}</td>
                  {yearLabels.map(yl => (
                    <td key={yl.year} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: yl.year === 0 ? '#ef4444' : LB }}>
                      {yl.year === 0 ? fmt(-lpContribution) : '$0'}
                    </td>
                  ))}
                </tr>
                {Object.entries(waterfallResults.lpByTier).filter(([, v]) => Math.abs(v) > 0.5).map(([tierName, total]) => (
                  <tr key={tierName} style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '6px 12px', paddingLeft: 36, color: LB, fontSize: 11, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{tierName}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: total < 0 ? '#ef4444' : VL }}>{fmt(total)}</td>
                    {yearLabels.map(yl => {
                      if (yl.year === 0) return <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>$0</td>;
                      const share = waterfallResults.lpTotalDist > 0 ? Math.abs(total) / waterfallResults.lpTotalDist : 0;
                      const v = Math.max(waterfallResults.lpCF[yl.year] || 0, 0) * share * (total < 0 ? -1 : 1);
                      return <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', color: v < 0 ? '#ef4444' : VL }}>{fmt(v)}</td>;
                    })}
                  </tr>
                ))}
                <tr style={{ background: '#f0fdf4', borderBottom: `2px solid ${B}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: '#047857', fontSize: 11, textTransform: 'uppercase', position: 'sticky', left: 0, background: '#f0fdf4', zIndex: 1 }}>Limited Partner Cash Flow</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>{fmt(waterfallResults.lpNetProfit)}</td>
                  {waterfallResults.lpCF.map((cf, i) => (
                    <td key={i} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: cf < 0 ? '#ef4444' : '#047857' }}>{fmt(cf)}</td>
                  ))}
                </tr>

                <tr><td colSpan={2 + yearLabels.length} style={{ padding: 6 }} /></tr>

                {/* GENERAL PARTNER */}
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td colSpan={2 + yearLabels.length} style={{ padding: '10px 12px', fontWeight: 800, color: AC, fontSize: 11, textTransform: 'uppercase', background: '#eef2ff' }}>General Partner</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '8px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Contributions</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(-gpContribution)}</td>
                  {yearLabels.map(yl => (
                    <td key={yl.year} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: yl.year === 0 ? '#ef4444' : LB }}>
                      {yl.year === 0 ? fmt(-gpContribution) : '$0'}
                    </td>
                  ))}
                </tr>
                {Object.entries(waterfallResults.gpByTier).filter(([, v]) => Math.abs(v) > 0.5).map(([tierName, total]) => (
                  <tr key={tierName} style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '6px 12px', paddingLeft: 36, color: LB, fontSize: 11, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{tierName}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(total)}</td>
                    {yearLabels.map(yl => {
                      if (yl.year === 0) return <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>$0</td>;
                      const share = waterfallResults.gpTotalDist > 0 ? total / waterfallResults.gpTotalDist : 0;
                      const v = Math.max(waterfallResults.gpCF[yl.year] || 0, 0) * share;
                      return <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', color: VL }}>{fmt(v)}</td>;
                    })}
                  </tr>
                ))}
                <tr style={{ background: '#eef2ff', borderBottom: `2px solid ${B}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: AC, fontSize: 11, textTransform: 'uppercase', position: 'sticky', left: 0, background: '#eef2ff', zIndex: 1 }}>General Partner Cash Flow</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: AC }}>{fmt(waterfallResults.gpNetProfit)}</td>
                  {waterfallResults.gpCF.map((cf, i) => (
                    <td key={i} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: cf < 0 ? '#ef4444' : AC }}>{fmt(cf)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ PARTNERSHIP CASH FLOW DISTRIBUTION DETAIL ═══ */}
      <div style={SC}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: detailOpen ? 20 : 0 }}
          onClick={() => setDetailOpen(!detailOpen)}>
          <span style={{ fontSize: 15, fontWeight: 800, color: VL }}>Partnership Cash Flow Distribution Detail</span>
          <span style={{ fontSize: 12, color: LB, transform: detailOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>&#9660;</span>
        </div>
        {detailOpen && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B}` }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: VL, width: 260, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Detail</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: VL }}>SubTotal</th>
                  {yearLabels.map(yl => (
                    <th key={yl.year} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      <div style={{ color: VL }}>{yl.label}</div>
                      <div style={{ fontSize: 10, color: LB }}>{yl.date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Available Cash for Distribution */}
                <tr style={{ background: '#faf5ff', borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: AC, fontStyle: 'italic', position: 'sticky', left: 0, background: '#faf5ff', zIndex: 1 }}>Available Cash for Distribution</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: VL }}>{fmt(yearlyCashFlows.filter(v => v > 0).reduce((s, v) => s + v, 0))}</td>
                  {yearlyCashFlows.map((cf, i) => (
                    <td key={i} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: cf < 0 ? '#ef4444' : VL }}>
                      {i === 0 ? '$0' : fmt(Math.max(cf, 0))}
                    </td>
                  ))}
                </tr>

                {/* Per-Tier Detail with Starting/Ending Balances */}
                {activeTiers.map((tier, ti) => {
                  const detail = waterfallResults.tierDetail[ti];
                  if (!detail) return null;
                  const hasActivity = detail.some(d => d.lpDist > 0.5 || d.gpDist > 0.5);
                  if (!hasActivity && ti > 0) return null;

                  const lpDistTotal = detail.reduce((s, d) => s + d.lpDist, 0);
                  const gpDistTotal = detail.reduce((s, d) => s + d.gpDist, 0);

                  return (
                    <React.Fragment key={ti}>
                      {/* Tier header */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td colSpan={2 + yearLabels.length} style={{ padding: '10px 12px', fontWeight: 700, color: VL, background: '#f9fafb' }}>
                          Tier {ti + 1} - {tier.name}
                        </td>
                      </tr>

                      {/* LP Starting Balance */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>LP Starting Balance</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}></td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {yl.year === 0 ? fmt(lpContribution) : fmt(detail[yl.year]?.lpStart || 0)}
                          </td>
                        ))}
                      </tr>
                      {/* LP Distribution */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: '#047857', fontWeight: 600, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>LP Distribution</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(lpDistTotal)}</td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', color: '#047857' }}>
                            {yl.year === 0 ? '$0' : fmt(detail[yl.year]?.lpDist || 0)}
                          </td>
                        ))}
                      </tr>
                      {/* LP Ending Balance */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, fontStyle: 'italic', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>LP Ending Balance</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}></td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', fontStyle: 'italic' }}>
                            {yl.year === 0 ? fmt(lpContribution) : fmt(detail[yl.year]?.lpEnd || 0)}
                          </td>
                        ))}
                      </tr>

                      {/* GP Starting Balance */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>GP Starting Balance</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}></td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {yl.year === 0 ? fmt(gpContribution) : fmt(detail[yl.year]?.gpStart || 0)}
                          </td>
                        ))}
                      </tr>
                      {/* GP Distribution */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: AC, fontWeight: 600, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>GP Distribution</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(gpDistTotal)}</td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', color: AC }}>
                            {yl.year === 0 ? '$0' : fmt(detail[yl.year]?.gpDist || 0)}
                          </td>
                        ))}
                      </tr>
                      {/* GP Ending Balance */}
                      <tr style={{ borderBottom: `1px solid ${B}` }}>
                        <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, fontStyle: 'italic', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>GP Ending Balance</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}></td>
                        {yearLabels.map(yl => (
                          <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right', fontStyle: 'italic' }}>
                            {yl.year === 0 ? fmt(gpContribution) : fmt(detail[yl.year]?.gpEnd || 0)}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}

                <tr><td colSpan={2 + yearLabels.length} style={{ padding: 6 }} /></tr>

                {/* ─── Summary ─── */}
                <tr style={{ borderTop: `2px solid ${B}` }}>
                  <td colSpan={2 + yearLabels.length} style={{ padding: '12px 12px 8px', fontWeight: 800, color: VL, textDecoration: 'underline', fontSize: 12 }}>
                    {profitMode === 'simple' ? 'Simple' : 'Waterfall'} &ndash; Summary
                  </td>
                </tr>

                {/* LP Summary */}
                <tr style={{ borderBottom: `1px solid ${B}`, background: '#f0fdf4' }}>
                  <td colSpan={2 + yearLabels.length} style={{ padding: '8px 12px', fontWeight: 700, color: '#047857' }}>LP Cash Flow and Returns</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Distributions</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(waterfallResults.lpTotalDist)}</td>
                  {waterfallResults.lpCF.map((cf, i) => (
                    <td key={i} style={{ padding: '6px 12px', textAlign: 'right' }}>{i === 0 ? '$0' : fmt(Math.max(cf, 0))}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Contributions</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(lpContribution)}</td>
                  {yearLabels.map(yl => (
                    <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>{yl.year === 0 ? fmt(lpContribution) : '$0'}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '6px 12px', paddingLeft: 24, fontWeight: 600, color: '#047857', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>LP Cash Flow</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>{fmt(waterfallResults.lpNetProfit)}</td>
                  {waterfallResults.lpCF.map((cf, i) => (
                    <td key={i} style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: cf < 0 ? '#ef4444' : VL }}>{fmt(cf)}</td>
                  ))}
                </tr>
                {[
                  { label: 'LP IRR', val: `${waterfallResults.lpIRR.toFixed(2)}%` },
                  { label: 'EMx', val: `${waterfallResults.lpEMx.toFixed(2)}x` },
                  { label: 'Cash Yield', val: `${waterfallResults.lpCashYield.toFixed(2)}%` },
                ].map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '6px 12px', paddingLeft: 24, color: AC, fontStyle: 'italic', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{m.label}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: AC }}>{m.val}</td>
                    <td colSpan={yearLabels.length} />
                  </tr>
                ))}

                {/* GP Summary */}
                <tr style={{ borderBottom: `1px solid ${B}`, background: '#eef2ff' }}>
                  <td colSpan={2 + yearLabels.length} style={{ padding: '8px 12px', fontWeight: 700, color: AC }}>GP Cash Flow and Returns</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Distributions</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(waterfallResults.gpTotalDist)}</td>
                  {waterfallResults.gpCF.map((cf, i) => (
                    <td key={i} style={{ padding: '6px 12px', textAlign: 'right' }}>{i === 0 ? '$0' : fmt(Math.max(cf, 0))}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: `1px solid ${B}` }}>
                  <td style={{ padding: '6px 12px', paddingLeft: 24, color: LB, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Contributions</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(gpContribution)}</td>
                  {yearLabels.map(yl => (
                    <td key={yl.year} style={{ padding: '6px 12px', textAlign: 'right' }}>{yl.year === 0 ? fmt(gpContribution) : '$0'}</td>
                  ))}
                </tr>
                {[
                  { label: 'GP IRR', val: `${waterfallResults.gpIRR.toFixed(2)}%` },
                  { label: 'EMx', val: `${waterfallResults.gpEMx.toFixed(2)}x` },
                  { label: 'Cash Yield', val: `${waterfallResults.gpCashYield.toFixed(2)}%` },
                ].map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${B}` }}>
                    <td style={{ padding: '6px 12px', paddingLeft: 24, color: AC, fontStyle: 'italic', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{m.label}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: AC }}>{m.val}</td>
                    <td colSpan={yearLabels.length} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
