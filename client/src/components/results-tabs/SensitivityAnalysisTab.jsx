import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

// ─── Theme constants (matches rest of results UI) ─────────────────────────
const B = '#e5e7eb';
const LB = '#6b7280';
const VL = '#111827';
const card = {
  backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
  marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
};

// ─── Helpers ───────────────────────────────────────────────────────────────
// fmtPct expects a DECIMAL (0.065 → 6.5%)
const fmtPct = (v, decimals = 1) => `${(v * 100).toFixed(decimals)}%`;
const fmtMoney = (v) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}MM`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
};

// Guard against NaN/Infinity/diverged IRR values
const safePct = (v) => {
  if (v == null || !isFinite(v) || Math.abs(v) > 999) return 'N/A';
  return `${v.toFixed(1)}%`;
};

// Normalize rate: could arrive as percentage (7.25) or decimal (0.0725)
const normalizeRate = (val, fallback) => {
  if (val == null || val === 0) return fallback;
  return val > 1 ? val / 100 : val;
};

// Normalize exit cap rate (same logic as calculateFullAnalysis)
const normalizeExitCap = (raw) => {
  if (raw != null && raw > 0 && raw <= 0.20) raw = raw * 100;
  if (!raw || raw <= 0 || raw > 20) raw = 7.25;
  return raw / 100; // return decimal
};

// Color scale: green → blue → orange → red
function heatColor(value, thresholds) {
  const { green, yellow, red } = thresholds;
  if (value >= green) return { bg: '#dcfce7', text: '#166534' };
  if (value >= yellow) return { bg: '#dbeafe', text: '#1e40af' };
  if (value >= red) return { bg: '#e0e7ff', text: '#3730a3' };
  return { bg: '#fecaca', text: '#991b1b' };
}

// IRR arrives as percentage from calculateFullAnalysis (e.g. 15.0 = 15%)
function irrColor(irr) {
  if (!isFinite(irr)) return { bg: '#f3f4f6', text: '#6b7280' };
  return heatColor(irr, { green: 18, yellow: 12, red: 8 });
}
function emColor(em) {
  if (!isFinite(em)) return { bg: '#f3f4f6', text: '#6b7280' };
  return heatColor(em, { green: 2.0, yellow: 1.6, red: 1.2 });
}
// CoC arrives as percentage from calculateFullAnalysis (e.g. 8.0 = 8%)
function cocColor(coc) {
  if (!isFinite(coc)) return { bg: '#f3f4f6', text: '#6b7280' };
  return heatColor(coc, { green: 8, yellow: 6.5, red: 5 });
}
function occupancyColor(occ) {
  if (occ <= 0.75) return { bg: '#dcfce7', text: '#166534' };
  if (occ <= 0.85) return { bg: '#dbeafe', text: '#1e40af' };
  if (occ <= 0.95) return { bg: '#e0e7ff', text: '#3730a3' };
  return { bg: '#fecaca', text: '#991b1b' };
}

// Valuation color: higher = greener
function valColor(val, purchase) {
  if (!purchase || !val) return { bg: '#f3f4f6', text: '#6b7280' };
  const ratio = val / purchase;
  if (ratio >= 1.3) return { bg: '#dcfce7', text: '#166534' };
  if (ratio >= 1.1) return { bg: '#dbeafe', text: '#1e40af' };
  if (ratio >= 0.95) return { bg: '#e0e7ff', text: '#3730a3' };
  return { bg: '#fecaca', text: '#991b1b' };
}


// ─── MAIN TAB ──────────────────────────────────────────────────────────────
export default function SensitivityAnalysisTab({ scenarioData, fullCalcs, calculateFullAnalysisFn, purchasePrice: propPurchasePrice, annualDebtService: propADS, onFieldChange, marketCapRate, vaRentUpside = 0, vaRubsRecovery = 0, vaExpenseSavings = 0 }) {
  const purchasePrice = propPurchasePrice || scenarioData?.pricing_financing?.purchase_price || scenarioData?.pricing_financing?.price || 0;
  // Normalize exit cap and growth rates the same way calculateFullAnalysis does
  const exitCapRate = normalizeExitCap(scenarioData?.underwriting?.exit_cap_rate);
  const incomeGrowth = normalizeRate(scenarioData?.underwriting?.income_growth_rate, 0.03);
  const holdingPeriod = scenarioData?.underwriting?.holding_period || 5;
  const vacancyRate = scenarioData?.pnl?.vacancy_rate || 0.05;
  const annualDebtService = propADS || fullCalcs?.financing?.annualDebtService || 0;
  const noi = fullCalcs?.year1?.noi || 0;

  // ── Value-Add integration ──
  const totalUnits = scenarioData?.property?.units || scenarioData?.property?.total_units || 0;

  // Stabilized NOI = current NOI + all value-add income from Value-Add tab
  const stabilizedNOI = noi + (vaRentUpside || 0) + (vaRubsRecovery || 0) + (vaExpenseSavings || 0);
  const hasValueAdd = stabilizedNOI > noi;
  const currentLTV = scenarioData?.financing?.ltv || scenarioData?.pricing_financing?.ltv || 75;
  const currentRate = scenarioData?.financing?.interest_rate || scenarioData?.pricing_financing?.interest_rate || 6;
  const currentAmort = scenarioData?.financing?.amortization_years || scenarioData?.pricing_financing?.amortization_years || 30;

  // Current values for highlighting
  const currentEM = fullCalcs?.returns?.leveredEquityMultiple || 0;
  const currentIRR = fullCalcs?.returns?.leveredIRR || 0;
  const currentCoC = fullCalcs?.year1?.cashOnCash || 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1) PURCHASE PRICE × EXIT CAP → EM, IRR, CoC
  // ═══════════════════════════════════════════════════════════════════════════
  const priceCapMatrix = useMemo(() => {
    if (!calculateFullAnalysisFn || !purchasePrice) return [];
    const priceStep = Math.round(purchasePrice * 0.03333); // ~3.3% steps
    const prices = [];
    for (let i = -2; i <= 2; i++) prices.push(purchasePrice + i * priceStep);

    const exitCaps = [];
    const capStep = 0.0025; // 25bps
    for (let i = 2; i >= -2; i--) exitCaps.push(exitCapRate + i * capStep);

    const rows = [];
    prices.forEach((price) => {
      const row = { price, cells: [] };
      exitCaps.forEach((cap) => {
        try {
          const scenario = {
            ...scenarioData,
            pricing_financing: { ...scenarioData.pricing_financing, purchase_price: price },
            underwriting: { ...scenarioData.underwriting, exit_cap_rate: cap },
          };
          const analysis = calculateFullAnalysisFn(scenario);
          row.cells.push({
            exitCap: cap,
            em: analysis.returns?.leveredEquityMultiple || 0,
            irr: analysis.returns?.leveredIRR || 0,
            coc: analysis.year1?.cashOnCash || 0,
            isCurrent: price === purchasePrice && Math.abs(cap - exitCapRate) < 0.001,
          });
        } catch {
          row.cells.push({ exitCap: cap, em: 0, irr: 0, coc: 0, isCurrent: false });
        }
      });
      rows.push(row);
    });
    return { rows, exitCaps };
  }, [scenarioData, purchasePrice, exitCapRate, calculateFullAnalysisFn]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2) RENT GROWTH × EXIT CAP → EM, CoC
  // ═══════════════════════════════════════════════════════════════════════════
  const rentGrowthCapMatrix = useMemo(() => {
    if (!calculateFullAnalysisFn || !purchasePrice) return [];
    const growthRates = [];
    const growthStep = 0.005; // 50bps
    for (let i = -2; i <= 2; i++) growthRates.push(incomeGrowth + i * growthStep);

    const exitCaps = [];
    const capStep = 0.0025;
    for (let i = 2; i >= -2; i--) exitCaps.push(exitCapRate + i * capStep);

    const rows = [];
    growthRates.forEach((growth) => {
      const row = { growth, cells: [] };
      exitCaps.forEach((cap) => {
        try {
          const scenario = {
            ...scenarioData,
            underwriting: { ...scenarioData.underwriting, exit_cap_rate: cap, income_growth_rate: growth },
          };
          const analysis = calculateFullAnalysisFn(scenario);
          row.cells.push({
            exitCap: cap,
            em: analysis.returns?.leveredEquityMultiple || 0,
            coc: analysis.year1?.cashOnCash || 0,
            isCurrent: Math.abs(growth - incomeGrowth) < 0.001 && Math.abs(cap - exitCapRate) < 0.001,
          });
        } catch {
          row.cells.push({ exitCap: cap, em: 0, coc: 0, isCurrent: false });
        }
      });
      rows.push(row);
    });
    return { rows, exitCaps, growthRates };
  }, [scenarioData, incomeGrowth, exitCapRate, calculateFullAnalysisFn]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3) OCCUPANCY STRESS TEST — what occupancy needed for breakeven, 1.25x, etc.
  // ═══════════════════════════════════════════════════════════════════════════
  const occupancyStress = useMemo(() => {
    if (!noi || !annualDebtService) return [];
    const dscrLevels = [
      { label: 'Breakeven', dscr: 1.0 },
      { label: '1.25x DSCR', dscr: 1.25 },
      { label: '1.50x DSCR', dscr: 1.50 },
      { label: '1.75x DSCR', dscr: 1.75 },
      { label: '2.00x DSCR', dscr: 2.00 },
    ];
    const projections = fullCalcs?.projections || [];
    const gpi = fullCalcs?.year1?.potentialGrossIncome || (noi / 0.6); // estimate if missing
    const opex = fullCalcs?.year1?.totalOperatingExpenses || (gpi * 0.4);
    const expenseGrowth = scenarioData?.underwriting?.expense_growth_rate || 0.025;

    // Time periods: T-12, T-3, Year 1–5
    const periods = [
      { label: 'T-12', yearIndex: -1 },
      { label: 'T-3', yearIndex: -0.25 },
    ];
    for (let y = 1; y <= Math.min(holdingPeriod, 5); y++) {
      periods.push({ label: `Year ${y}`, yearIndex: y });
    }

    return periods.map((period) => {
      const yearMult = period.yearIndex <= 0 ? 1 : period.yearIndex;
      const yearGPI = gpi * Math.pow(1 + (incomeGrowth || 0.03), yearMult - 1);
      const yearOpex = opex * Math.pow(1 + expenseGrowth, yearMult - 1);

      const cells = dscrLevels.map(({ label, dscr }) => {
        // NOI needed = DSCR * ADS
        const noiNeeded = dscr * annualDebtService;
        // NOI = GPI * (1 - vacancy) - Opex  →  vacancy = 1 - (NOI + Opex) / GPI
        const occupancyNeeded = yearGPI > 0 ? (noiNeeded + yearOpex) / yearGPI : 1;
        return {
          dscrLabel: label,
          occupancy: Math.min(occupancyNeeded, 1.5), // cap at 150% for display
        };
      });
      return { ...period, cells };
    });
  }, [noi, annualDebtService, fullCalcs, incomeGrowth, holdingPeriod, scenarioData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4) EXIT CAP vs EQUITY MULTIPLE — line chart data
  // ═══════════════════════════════════════════════════════════════════════════
  const exitCapLineData = useMemo(() => {
    if (!calculateFullAnalysisFn || !purchasePrice) return [];
    const points = [];
    for (let cap = exitCapRate - 0.005; cap <= exitCapRate + 0.005; cap += 0.0025) {
      try {
        const scenario = {
          ...scenarioData,
          underwriting: { ...scenarioData.underwriting, exit_cap_rate: cap },
        };
        const analysis = calculateFullAnalysisFn(scenario);
        points.push({
          exitCap: `${(cap * 100).toFixed(2)}%`,
          exitCapNum: cap,
          equityMultiple: parseFloat((analysis.returns?.leveredEquityMultiple || 0).toFixed(2)),
          irr: parseFloat((analysis.returns?.leveredIRR || 0).toFixed(1)),
          isCurrent: Math.abs(cap - exitCapRate) < 0.001,
        });
      } catch {
        // skip
      }
    }
    return points;
  }, [scenarioData, exitCapRate, calculateFullAnalysisFn, purchasePrice]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) RENT GROWTH vs CoC — line chart data
  // ═══════════════════════════════════════════════════════════════════════════
  const rentGrowthLineData = useMemo(() => {
    if (!calculateFullAnalysisFn || !purchasePrice) return [];
    const points = [];
    for (let g = incomeGrowth - 0.01; g <= incomeGrowth + 0.01; g += 0.005) {
      try {
        const scenario = {
          ...scenarioData,
          underwriting: { ...scenarioData.underwriting, income_growth_rate: g },
        };
        const analysis = calculateFullAnalysisFn(scenario);
        points.push({
          rentGrowth: `${(g * 100).toFixed(1)}%`,
          rentGrowthNum: g,
          coc: parseFloat((analysis.year1?.cashOnCash || 0).toFixed(1)),
          equityMultiple: parseFloat((analysis.returns?.leveredEquityMultiple || 0).toFixed(2)),
          isCurrent: Math.abs(g - incomeGrowth) < 0.002,
        });
      } catch {
        // skip
      }
    }
    return points;
  }, [scenarioData, incomeGrowth, calculateFullAnalysisFn, purchasePrice]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6) VALUE-ADD REVALUATION TABLE — NOI changes × Exit Cap Rates
  // ═══════════════════════════════════════════════════════════════════════════
  const noiScenarios = useMemo(() => {
    const scenarios = [];
    // Baseline is stabilized NOI (current NOI + all value-add income)
    // Additional rent bumps on top of stabilized baseline
    const rentBumps = [0, 25, 50, 75, 100, 150];
    rentBumps.forEach(bump => {
      const addlAnnualIncome = bump * totalUnits * 12;
      scenarios.push({
        label: bump === 0 ? (hasValueAdd ? 'Stabilized' : 'Current') : `+$${bump}/unit`,
        type: 'rent',
        newNOI: stabilizedNOI + addlAnnualIncome,
        delta: addlAnnualIncome,
      });
    });
    return scenarios;
  }, [stabilizedNOI, hasValueAdd, totalUnits]);

  const exitCapSteps = useMemo(() => {
    const caps = [];
    for (let i = 3; i >= -2; i--) caps.push(exitCapRate + i * 0.005);
    return caps;
  }, [exitCapRate]);

  const revalMatrix = useMemo(() => {
    return noiScenarios.map(sc => ({
      ...sc,
      valuations: exitCapSteps.map(cap => ({
        cap,
        value: cap > 0 ? sc.newNOI / cap : 0,
      })),
    }));
  }, [noiScenarios, exitCapSteps]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7) CASH-OUT REFI TABLE — Revaluation × LTV → Loan Proceeds
  // ═══════════════════════════════════════════════════════════════════════════
  const ltvSteps = [65, 70, 75, 80];
  const currentLoanBalance = purchasePrice * (currentLTV / 100);

  const cashoutMatrix = useMemo(() => {
    // Use the current exit cap for revaluation
    return noiScenarios.filter(sc => sc.type === 'rent' || sc.highlight).map(sc => {
      const newValue = exitCapRate > 0 ? sc.newNOI / exitCapRate : 0;
      return {
        ...sc,
        newValue,
        ltvCells: ltvSteps.map(ltv => {
          const newLoan = newValue * (ltv / 100);
          const cashout = Math.max(newLoan - currentLoanBalance, 0);
          return { ltv, newLoan, cashout };
        }),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiScenarios, exitCapRate, currentLoanBalance]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8) POST-REFI CASHFLOW TABLE — After cash-out, new debt service & cashflow
  // ═══════════════════════════════════════════════════════════════════════════
  const calcMonthlyPmt = (principal, annualRate, amortYrs) => {
    if (principal <= 0 || amortYrs <= 0) return 0;
    const r = (annualRate / 100) / 12;
    const n = amortYrs * 12;
    if (r === 0) return principal / n;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const refiCashflowMatrix = useMemo(() => {
    const refiRate = currentRate > 1 ? currentRate : currentRate * 100; // normalize to pct
    return noiScenarios.filter(sc => sc.type === 'rent' || sc.highlight).map(sc => {
      const newValue = exitCapRate > 0 ? sc.newNOI / exitCapRate : 0;
      return {
        ...sc,
        newValue,
        ltvCells: ltvSteps.map(ltv => {
          const newLoanAmt = newValue * (ltv / 100);
          const monthlyPmt = calcMonthlyPmt(newLoanAmt, refiRate, currentAmort);
          const newADS = monthlyPmt * 12;
          const annualCashflow = sc.newNOI - newADS;
          const cashout = Math.max(newLoanAmt - currentLoanBalance, 0);
          return { ltv, newLoanAmt, newADS, annualCashflow, monthlyCashflow: annualCashflow / 12, cashout };
        }),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiScenarios, exitCapRate, currentRate, currentAmort, currentLoanBalance]);

  // ─── Table cell style helper ─────────────────────────────────────────────
  const cellStyle = (isHeader = false, isCurrent = false) => ({
    padding: '10px 12px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: isHeader ? 700 : 600,
    color: isHeader ? '#374151' : VL,
    borderBottom: `1px solid ${B}`,
    borderRight: `1px solid ${B}`,
    backgroundColor: isHeader ? '#f8fafc' : 'transparent',
    letterSpacing: isHeader ? '0.5px' : 'normal',
    textTransform: isHeader ? 'uppercase' : 'none',
    ...(isCurrent ? { outline: '2px solid #3b82f6', outlineOffset: -2, borderRadius: 2 } : {}),
  });

  const dscrLevels = ['Breakeven', '1.25x DSCR', '1.50x DSCR', '1.75x DSCR', '2.00x DSCR'];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: VL }}>Sensitivity Analysis</div>
          <div style={{ fontSize: 12, color: LB, marginTop: 4 }}>
            Stress test returns across purchase price, exit cap, rent growth, and occupancy scenarios
          </div>
        </div>

        {/* ═══ KEY METRICS BAR ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Purchase Price', value: fmtMoney(purchasePrice), color: '#3b82f6' },
            { label: 'Exit Cap Rate', value: fmtPct(exitCapRate), color: '#f59e0b', sub: '(current)' },
            { label: 'Rent Growth', value: fmtPct(incomeGrowth), color: '#10b981', sub: '(current)' },
            { label: 'Year 1 DSCR', value: fullCalcs?.year1?.dscr ? `${fullCalcs.year1.dscr.toFixed(2)}x` : 'N/A', color: '#6366f1' },
          ].map((m, i) => (
            <div key={i} style={{ ...card, marginBottom: 0, borderLeft: `4px solid ${m.color}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: VL }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 1: Purchase Price × Exit Cap → EM, IRR, CoC
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>
            Purchase Price vs Exit Cap
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Equity Multiple, IRR, and Cash-on-Cash across purchase price and exit cap rate scenarios
          </div>

          {priceCapMatrix.rows && priceCapMatrix.rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 120 }}></th>
                    {priceCapMatrix.exitCaps?.map((cap, i) => (
                      <th key={i} colSpan={3} style={{
                        ...cellStyle(true),
                        borderBottom: `1px solid ${B}`,
                        ...(Math.abs(cap - exitCapRate) < 0.001 ? { color: '#3b82f6', fontWeight: 800 } : {}),
                      }}>
                        {(cap * 100).toFixed(2)}%
                        {Math.abs(cap - exitCapRate) < 0.001 && <span style={{ fontSize: 9, display: 'block', color: '#3b82f6', fontWeight: 600 }}>(current)</span>}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left' }}>Purchase Price</th>
                    {priceCapMatrix.exitCaps?.map((_, i) => (
                      <React.Fragment key={i}>
                        <th style={cellStyle(true)}>EM</th>
                        <th style={cellStyle(true)}>IRR</th>
                        <th style={cellStyle(true)}>CoC</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceCapMatrix.rows.map((row, ri) => {
                    const isCurrentPrice = row.price === purchasePrice;
                    return (
                      <tr key={ri} style={isCurrentPrice ? { backgroundColor: '#f0f9ff' } : {}}>
                        <td style={{
                          ...cellStyle(false),
                          textAlign: 'left',
                          fontWeight: 700,
                          fontSize: 12,
                          color: isCurrentPrice ? '#2563eb' : VL,
                          whiteSpace: 'nowrap',
                        }}>
                          {fmtMoney(row.price)}
                          {isCurrentPrice && <span style={{ fontSize: 9, color: '#3b82f6', marginLeft: 4 }}>(current)</span>}
                        </td>
                        {row.cells.map((cell, ci) => {
                          const emc = emColor(cell.em);
                          const irrc = irrColor(cell.irr);
                          const cocc = cocColor(cell.coc);
                          return (
                            <React.Fragment key={ci}>
                              <td style={{ ...cellStyle(false, cell.isCurrent), backgroundColor: emc.bg, color: emc.text }}>
                                {cell.em.toFixed(2)}x
                              </td>
                              <td style={{ ...cellStyle(false, cell.isCurrent), backgroundColor: irrc.bg, color: irrc.text }}>
                                {safePct(cell.irr)}
                              </td>
                              <td style={{ ...cellStyle(false, cell.isCurrent), backgroundColor: cocc.bg, color: cocc.text }}>
                                {safePct(cell.coc)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 2: Rent Growth × Exit Cap → EM, CoC
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>
            Rent Growth vs Exit Cap
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Equity Multiple and Cash-on-Cash across rent growth and exit cap rate scenarios
          </div>

          {rentGrowthCapMatrix.rows && rentGrowthCapMatrix.rows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 120 }}></th>
                    {rentGrowthCapMatrix.exitCaps?.map((cap, i) => (
                      <th key={i} colSpan={2} style={{
                        ...cellStyle(true),
                        ...(Math.abs(cap - exitCapRate) < 0.001 ? { color: '#3b82f6', fontWeight: 800 } : {}),
                      }}>
                        {(cap * 100).toFixed(2)}%
                        {Math.abs(cap - exitCapRate) < 0.001 && <span style={{ fontSize: 9, display: 'block', color: '#3b82f6', fontWeight: 600 }}>(current)</span>}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left' }}>Rent Growth</th>
                    {rentGrowthCapMatrix.exitCaps?.map((_, i) => (
                      <React.Fragment key={i}>
                        <th style={cellStyle(true)}>EM</th>
                        <th style={cellStyle(true)}>CoC</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rentGrowthCapMatrix.rows.map((row, ri) => {
                    const isCurrentGrowth = Math.abs(row.growth - incomeGrowth) < 0.001;
                    return (
                      <tr key={ri} style={isCurrentGrowth ? { backgroundColor: '#f0f9ff' } : {}}>
                        <td style={{
                          ...cellStyle(false),
                          textAlign: 'left',
                          fontWeight: 700,
                          color: isCurrentGrowth ? '#2563eb' : VL,
                        }}>
                          {(row.growth * 100).toFixed(2)}%
                          {isCurrentGrowth && <span style={{ fontSize: 9, color: '#3b82f6', marginLeft: 4 }}>(current)</span>}
                        </td>
                        {row.cells.map((cell, ci) => {
                          const emc = emColor(cell.em);
                          const cocc = cocColor(cell.coc);
                          return (
                            <React.Fragment key={ci}>
                              <td style={{ ...cellStyle(false, cell.isCurrent), backgroundColor: emc.bg, color: emc.text }}>
                                {cell.em.toFixed(2)}x
                              </td>
                              <td style={{ ...cellStyle(false, cell.isCurrent), backgroundColor: cocc.bg, color: cocc.text }}>
                                {safePct(cell.coc)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 3: Occupancy Stress Test
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>
            Occupancy Stress Test
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Minimum occupancy required to meet each DSCR threshold by year
          </div>

          {occupancyStress.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 100 }}>Year</th>
                    {dscrLevels.map((lbl, i) => (
                      <th key={i} style={cellStyle(true)}>{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {occupancyStress.map((period, ri) => (
                    <tr key={ri}>
                      <td style={{ ...cellStyle(false), textAlign: 'left', fontWeight: 700 }}>{period.label}</td>
                      {period.cells.map((cell, ci) => {
                        const colors = occupancyColor(cell.occupancy);
                        return (
                          <td key={ci} style={{ ...cellStyle(false), backgroundColor: colors.bg, color: colors.text }}>
                            {(cell.occupancy * 100).toFixed(2)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CHART 1: Exit Cap Rate vs Equity Multiple (Line)
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>Exit Cap Rate vs Equity Multiple</div>
              <div style={{ fontSize: 11, color: LB, marginTop: 2 }}>How exit cap rate impacts your levered equity multiple</div>
            </div>
          </div>

          {exitCapLineData.length > 0 && (
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exitCapLineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="exitCap" stroke={LB} fontSize={11} />
                  <YAxis stroke={LB} fontSize={11} domain={['auto', 'auto']}
                    tickFormatter={(v) => `${v.toFixed(2)}x`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => {
                      if (name === 'equityMultiple') return [`${value.toFixed(2)}x`, 'Equity Multiple'];
                      if (name === 'irr') return [`${value.toFixed(1)}%`, 'IRR'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <ReferenceLine x={`${(exitCapRate * 100).toFixed(2)}%`} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: 'Current', position: 'top', fontSize: 10, fill: '#3b82f6' }} />
                  <Line type="monotone" dataKey="equityMultiple" name="Equity Multiple" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="irr" name="IRR (%)" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} yAxisId={0} hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CHART 2: Rent Growth vs CoC (Line)
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>Rent Growth vs Cash-on-Cash</div>
              <div style={{ fontSize: 11, color: LB, marginTop: 2 }}>Impact of income growth rate on year-1 cash-on-cash return</div>
            </div>
          </div>

          {rentGrowthLineData.length > 0 && (
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rentGrowthLineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="rentGrowth" stroke={LB} fontSize={11} />
                  <YAxis stroke={LB} fontSize={11} domain={['auto', 'auto']}
                    tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => {
                      if (name === 'coc') return [`${value.toFixed(1)}%`, 'Cash-on-Cash'];
                      if (name === 'equityMultiple') return [`${value.toFixed(2)}x`, 'Equity Multiple'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <ReferenceLine x={`${(incomeGrowth * 100).toFixed(1)}%`} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Current', position: 'top', fontSize: 10, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="coc" name="Cash-on-Cash (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6' }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="equityMultiple" name="Equity Multiple" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 4: Value-Add Revaluation — NOI Scenarios × Exit Cap
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🏗️</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>Value-Add Revaluation</div>
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            New property value if you bump rents, across exit cap rate scenarios
          </div>

          {revalMatrix.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 130 }}>Scenario</th>
                    <th style={{ ...cellStyle(true), minWidth: 90 }}>New NOI</th>
                    {exitCapSteps.map((cap, i) => (
                      <th key={i} style={{
                        ...cellStyle(true),
                        ...(Math.abs(cap - exitCapRate) < 0.001 ? { color: '#3b82f6', fontWeight: 800 } : {}),
                      }}>
                        {(cap * 100).toFixed(2)}% Cap
                        {Math.abs(cap - exitCapRate) < 0.001 && <span style={{ fontSize: 9, display: 'block', color: '#3b82f6' }}>(current)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revalMatrix.map((row, ri) => {
                    const isCurrentRow = row.label === 'Current' || row.label === 'Stabilized';
                    return (
                      <tr key={ri} style={isCurrentRow ? { backgroundColor: '#f0f9ff' } : row.highlight ? { backgroundColor: '#f0fdf4' } : {}}>
                        <td style={{
                          ...cellStyle(false), textAlign: 'left', fontWeight: 700,
                          color: row.highlight ? '#059669' : isCurrentRow ? '#2563eb' : row.type === 'expense' ? '#7c3aed' : VL,
                        }}>
                          <div>{row.label}</div>
                          {row.delta > 0 && !isCurrentRow && <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>+{fmtMoney(row.delta)}/yr</div>}
                        </td>
                        <td style={{ ...cellStyle(false), fontWeight: 700, color: VL }}>{fmtMoney(row.newNOI)}</td>
                        {row.valuations.map((v, ci) => {
                          const vc = valColor(v.value, purchasePrice);
                          const isCurCap = Math.abs(v.cap - exitCapRate) < 0.001;
                          return (
                            <td key={ci} style={{
                              ...cellStyle(false, isCurCap && isCurrentRow),
                              backgroundColor: vc.bg, color: vc.text, fontWeight: 600,
                            }}>
                              <div>{fmtMoney(v.value)}</div>
                              {!isCurrentRow && purchasePrice > 0 && (
                                <div style={{ fontSize: 10, color: v.value > purchasePrice ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                  {v.value > purchasePrice ? '+' : ''}{fmtMoney(v.value - purchasePrice)}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 5: Cash-Out Refi Amount — NOI Scenario × LTV
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>💰</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>Cash-Out Refinance Proceeds</div>
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 6 }}>
            How much you can pull out on a cash-out refi at the current {(exitCapRate * 100).toFixed(2)}% exit cap, after paying off existing loan ({fmtMoney(currentLoanBalance)})
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Refi rate: {currentRate > 1 ? currentRate.toFixed(2) : (currentRate * 100).toFixed(2)}% · Amortization: {currentAmort}yr
          </div>

          {cashoutMatrix.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 130 }}>Scenario</th>
                    <th style={{ ...cellStyle(true), minWidth: 100 }}>New Value</th>
                    {ltvSteps.map((ltv, i) => (
                      <th key={i} colSpan={2} style={{ ...cellStyle(true) }}>
                        {ltv}% LTV
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={cellStyle(true)}></th>
                    <th style={cellStyle(true)}></th>
                    {ltvSteps.map((_, i) => (
                      <React.Fragment key={i}>
                        <th style={{ ...cellStyle(true), fontSize: 10 }}>New Loan</th>
                        <th style={{ ...cellStyle(true), fontSize: 10 }}>Cash Out</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashoutMatrix.map((row, ri) => {
                    const isCurrentRow = row.label === 'Current' || row.label === 'Stabilized';
                    return (
                      <tr key={ri} style={isCurrentRow ? { backgroundColor: '#f0f9ff' } : row.highlight ? { backgroundColor: '#f0fdf4' } : {}}>
                        <td style={{
                          ...cellStyle(false), textAlign: 'left', fontWeight: 700,
                          color: row.highlight ? '#059669' : isCurrentRow ? '#2563eb' : VL,
                        }}>
                          {row.label}
                        </td>
                        <td style={{ ...cellStyle(false), fontWeight: 700, color: VL }}>{fmtMoney(row.newValue)}</td>
                        {row.ltvCells.map((cell, ci) => (
                          <React.Fragment key={ci}>
                            <td style={{ ...cellStyle(false), fontWeight: 600, color: VL }}>{fmtMoney(cell.newLoan)}</td>
                            <td style={{
                              ...cellStyle(false), fontWeight: 700,
                              backgroundColor: cell.cashout > 0 ? '#dcfce7' : '#f3f4f6',
                              color: cell.cashout > 0 ? '#166534' : '#6b7280',
                            }}>
                              {cell.cashout > 0 ? fmtMoney(cell.cashout) : '—'}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE 6: Post Cash-Out Refi Cashflow
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>Post-Refi Cashflow</div>
          </div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Annual cashflow after cash-out refi — new debt service based on the larger loan at each LTV
          </div>

          {refiCashflowMatrix.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellStyle(true), textAlign: 'left', minWidth: 130 }}>Scenario</th>
                    <th style={{ ...cellStyle(true) }}>NOI</th>
                    {ltvSteps.map((ltv, i) => (
                      <th key={i} colSpan={3} style={{ ...cellStyle(true) }}>
                        {ltv}% LTV Refi
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={cellStyle(true)}></th>
                    <th style={cellStyle(true)}></th>
                    {ltvSteps.map((_, i) => (
                      <React.Fragment key={i}>
                        <th style={{ ...cellStyle(true), fontSize: 10 }}>Debt Svc</th>
                        <th style={{ ...cellStyle(true), fontSize: 10 }}>Cashflow</th>
                        <th style={{ ...cellStyle(true), fontSize: 10 }}>Cash Out</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {refiCashflowMatrix.map((row, ri) => {
                    const isCurrentRow = row.label === 'Current' || row.label === 'Stabilized';
                    return (
                      <tr key={ri} style={isCurrentRow ? { backgroundColor: '#f0f9ff' } : row.highlight ? { backgroundColor: '#f0fdf4' } : {}}>
                        <td style={{
                          ...cellStyle(false), textAlign: 'left', fontWeight: 700,
                          color: row.highlight ? '#059669' : isCurrentRow ? '#2563eb' : VL,
                        }}>
                          {row.label}
                        </td>
                        <td style={{ ...cellStyle(false), fontWeight: 700, color: VL }}>{fmtMoney(row.newNOI)}</td>
                        {row.ltvCells.map((cell, ci) => (
                          <React.Fragment key={ci}>
                            <td style={{ ...cellStyle(false), color: '#991b1b', fontWeight: 600 }}>
                              {fmtMoney(cell.newADS)}
                            </td>
                            <td style={{
                              ...cellStyle(false), fontWeight: 700,
                              backgroundColor: cell.annualCashflow > 0 ? '#dcfce7' : '#fecaca',
                              color: cell.annualCashflow > 0 ? '#166534' : '#991b1b',
                            }}>
                              <div>{fmtMoney(cell.annualCashflow)}</div>
                              <div style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(cell.monthlyCashflow)}/mo</div>
                            </td>
                            <td style={{
                              ...cellStyle(false), fontWeight: 600,
                              color: cell.cashout > 0 ? '#166534' : '#6b7280',
                            }}>
                              {cell.cashout > 0 ? fmtMoney(cell.cashout) : '—'}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Current financing reference */}
          <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: 10, border: `1px solid ${B}`, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
            <div><span style={{ color: LB }}>Current Loan:</span> <span style={{ fontWeight: 700, color: VL }}>{fmtMoney(currentLoanBalance)}</span></div>
            <div><span style={{ color: LB }}>Current ADS:</span> <span style={{ fontWeight: 700, color: VL }}>{fmtMoney(annualDebtService)}</span></div>
            <div><span style={{ color: LB }}>Current Cashflow:</span> <span style={{ fontWeight: 700, color: noi - annualDebtService > 0 ? '#166534' : '#991b1b' }}>{fmtMoney(noi - annualDebtService)}/yr</span></div>
            <div><span style={{ color: LB }}>Purchase:</span> <span style={{ fontWeight: 700, color: VL }}>{fmtMoney(purchasePrice)}</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}
