// Monte Carlo probabilistic stress-testing engine.
// Wraps the REAL deterministic calc engine (calculateFullAnalysis) with
// repeated random sampling of key underwriting assumptions. Pure/no I/O so
// it can run in a loop on the main thread or inside a Web Worker unchanged.
import { calculateIRR } from './realEstateCalculations';

// ─── Random samplers ────────────────────────────────────────────────────────

// Box-Muller normal distribution, clamped to [min, max].
export function sampleNormal(mean, stdDev, min = -Infinity, max = Infinity) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.min(max, Math.max(min, mean + z * stdDev));
}

// Triangular distribution — useful for skewed risks like vacancy (more
// downside surprise potential than upside).
export function sampleTriangular(min, mode, max) {
  if (max <= min) return min;
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function sampleUniform(min, max) {
  return min + Math.random() * (max - min);
}

function drawFrom(config) {
  if (!config || config.enabled === false) return null;
  if (config.dist === 'triangular') return sampleTriangular(config.min, config.mode, config.max);
  if (config.dist === 'uniform') return sampleUniform(config.min, config.max);
  return sampleNormal(config.mean, config.stdDev, config.min, config.max);
}

// ─── Rate normalization (mirrors realEstateCalculations.js conventions) ────
function normalizeDecimalRate(val, fallback) {
  if (val == null || val === 0) return fallback;
  return val > 1 ? val / 100 : val;
}

// ─── Default distribution assumptions, derived from the deal's own base case ──
export function getDefaultDistributions(scenarioData = {}, fullCalcs = {}) {
  const exitCapBase = normalizeDecimalRate(scenarioData?.underwriting?.exit_cap_rate, 0.0725);
  const incomeGrowthBase = normalizeDecimalRate(scenarioData?.underwriting?.income_growth_rate, 0.03);
  const expenseGrowthBase = normalizeDecimalRate(scenarioData?.underwriting?.expense_growth_rate, 0.03);
  const vacancyBase = normalizeDecimalRate(scenarioData?.pnl?.vacancy_rate, 0.05);
  const rateRaw = scenarioData?.financing?.interest_rate || scenarioData?.pricing_financing?.interest_rate || 6.5;
  const interestRateBase = rateRaw > 1 ? rateRaw / 100 : rateRaw;

  return {
    exitCapRate: {
      label: 'Exit Cap Rate', enabled: true, dist: 'normal', unit: 'pct',
      mean: exitCapBase, stdDev: 0.005, min: Math.max(0.02, exitCapBase - 0.02), max: exitCapBase + 0.02,
    },
    incomeGrowth: {
      label: 'Rent Growth', enabled: true, dist: 'normal', unit: 'pct',
      mean: incomeGrowthBase, stdDev: 0.01, min: -0.02, max: incomeGrowthBase + 0.05,
    },
    expenseGrowth: {
      label: 'Expense Growth', enabled: true, dist: 'normal', unit: 'pct',
      mean: expenseGrowthBase, stdDev: 0.01, min: 0, max: expenseGrowthBase + 0.05,
    },
    vacancyRate: {
      label: 'Vacancy Rate', enabled: true, dist: 'triangular', unit: 'pct',
      min: Math.max(0, vacancyBase - 0.03), mode: vacancyBase, max: vacancyBase + 0.10,
    },
    interestRate: {
      label: 'Interest Rate', enabled: true, dist: 'normal', unit: 'pct',
      mean: interestRateBase, stdDev: 0.0075, min: Math.max(0.02, interestRateBase - 0.03), max: interestRateBase + 0.03,
    },
    renoDelay: {
      label: 'Renovation / Stabilization Delay', enabled: false, dist: 'triangular', unit: 'months',
      min: 0, mode: 1, max: 6,
    },
  };
}

// ─── Simulation ──────────────────────────────────────────────────────────────
export function runMonteCarloSimulation({ scenarioData, calculateFullAnalysisFn, distributions, iterations = 10000, collectCashFlowPaths = false }) {
  const leveredIRR = [];
  const leveredEM = [];
  const cashOnCash = [];
  const minDSCR = [];
  const cashFlowByYear = collectCashFlowPaths ? Array.from({ length: 10 }, () => []) : null;
  let errors = 0;

  for (let i = 0; i < iterations; i++) {
    const exitCapDraw = drawFrom(distributions.exitCapRate);
    const incomeGrowthDraw = drawFrom(distributions.incomeGrowth);
    const expenseGrowthDraw = drawFrom(distributions.expenseGrowth);
    const vacancyDraw = drawFrom(distributions.vacancyRate);
    const interestRateDraw = drawFrom(distributions.interestRate);
    const renoDelayDraw = drawFrom(distributions.renoDelay);

    const scenario = {
      ...scenarioData,
      underwriting: {
        ...scenarioData.underwriting,
        ...(exitCapDraw != null ? { exit_cap_rate: exitCapDraw } : {}),
        ...(incomeGrowthDraw != null ? { income_growth_rate: incomeGrowthDraw } : {}),
        ...(expenseGrowthDraw != null ? { expense_growth_rate: expenseGrowthDraw } : {}),
      },
      pnl: {
        ...scenarioData.pnl,
        ...(vacancyDraw != null ? { vacancy_rate: vacancyDraw } : {}),
      },
      pricing_financing: {
        ...scenarioData.pricing_financing,
        ...(interestRateDraw != null ? { interest_rate: interestRateDraw * 100 } : {}),
      },
      financing: scenarioData.financing
        ? { ...scenarioData.financing, ...(interestRateDraw != null ? { interest_rate: interestRateDraw * 100 } : {}) }
        : scenarioData.financing,
    };

    try {
      const a = calculateFullAnalysisFn(scenario);
      let irr = a?.returns?.leveredIRR;
      let em = a?.returns?.leveredEquityMultiple;
      const coc = a?.year1?.cashOnCash;
      const dscr = a?.returns?.minDSCR ?? a?.year1?.dscr;
      const projections = a?.projections || [];
      const yearCashFlows = projections.map((p) => p?.cashFlowAfterFinancing);

      // Renovation/stabilization delay: a real IRR/EM recompute off the
      // ACTUAL levered cash flow stream (haircut to year 1 proportional to
      // months lost), not a hardcoded fudge factor on the final numbers.
      if (renoDelayDraw && renoDelayDraw > 0 && a?.cashFlowArrays?.leveredCashFlows?.length > 1) {
        const delayFraction = Math.min(1, renoDelayDraw / 12);
        const adjustedLeveredCF = [...a.cashFlowArrays.leveredCashFlows];
        adjustedLeveredCF[1] = adjustedLeveredCF[1] * (1 - delayFraction);
        if (yearCashFlows.length > 0 && Number.isFinite(yearCashFlows[0])) {
          yearCashFlows[0] = yearCashFlows[0] * (1 - delayFraction);
        }
        const recomputedIrr = calculateIRR(adjustedLeveredCF);
        if (Number.isFinite(recomputedIrr)) irr = recomputedIrr * 100;
        const invested = Math.abs(adjustedLeveredCF[0] || 0);
        if (invested > 0) em = adjustedLeveredCF.slice(1).reduce((s, v) => s + v, 0) / invested;
      }

      if (Number.isFinite(irr) && Number.isFinite(em) && Math.abs(irr) < 1000) {
        leveredIRR.push(irr);
        leveredEM.push(em);
        if (Number.isFinite(coc)) cashOnCash.push(coc);
        if (Number.isFinite(dscr)) minDSCR.push(dscr);
        if (cashFlowByYear) {
          yearCashFlows.forEach((cf, yi) => { if (yi < 10 && Number.isFinite(cf)) cashFlowByYear[yi].push(cf); });
        }
      } else {
        errors++;
      }
    } catch {
      errors++;
    }

    // Yield progress every 1000 iterations (caller decides what to do with it)
    /* eslint-disable-next-line no-restricted-globals */
    if (typeof self !== 'undefined' && self.postMessage && (i % 1000 === 0 || i === iterations - 1)) {
      /* eslint-disable-next-line no-restricted-globals */
      self.postMessage({ type: 'progress', completed: i + 1, total: iterations });
    }
  }

  return { leveredIRR, leveredEM, cashOnCash, minDSCR, cashFlowByYear, iterations, errors };
}

// ─── Statistics ──────────────────────────────────────────────────────────────
export function percentile(sortedValues, p) {
  if (!sortedValues || !sortedValues.length) return null;
  const idx = (p / 100) * (sortedValues.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

export function summarizeDistribution(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return {
    mean,
    stdDev: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: percentile(sorted, 5),
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
  };
}

export function probabilityBelow(values, threshold) {
  if (!values || !values.length) return null;
  return (values.filter((v) => v < threshold).length / values.length) * 100;
}

export function buildHistogram(values, bucketCount = 24) {
  if (!values || !values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ x0: min, x1: max, mid: min, count: values.length }];
  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    x0: min + i * width, x1: min + (i + 1) * width, mid: min + (i + 0.5) * width, count: 0,
  }));
  values.forEach((v) => {
    let idx = Math.floor((v - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  });
  return buckets;
}

// Per-year percentile bands across every simulated iteration's cash flow —
// powers the "fan chart" view (range of outcomes over the hold period,
// not just the final IRR/EM distribution).
export function buildCashFlowFanChart(cashFlowByYear) {
  if (!cashFlowByYear) return [];
  return cashFlowByYear.map((yearValues, i) => {
    if (!yearValues || !yearValues.length) return { year: i + 1, p5: null, p25: null, p50: null, p75: null, p95: null };
    const sorted = [...yearValues].sort((a, b) => a - b);
    return {
      year: i + 1,
      p5: percentile(sorted, 5),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p95: percentile(sorted, 95),
    };
  });
}