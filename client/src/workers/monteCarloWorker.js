// Web Worker: runs the Monte Carlo loop off the main thread so the UI
// never freezes during 10k+ iterations. Posts progress updates, then the
// final raw result arrays (stats are computed back on the main thread).
/* eslint-disable no-restricted-globals */
import { calculateFullAnalysis } from '../utils/realEstateCalculations';
import { runMonteCarloSimulation } from '../utils/monteCarloEngine';

self.onmessage = (e) => {
  const { scenarioData, distributions, iterations, collectCashFlowPaths } = e.data || {};
  try {
    const result = runMonteCarloSimulation({
      scenarioData,
      calculateFullAnalysisFn: calculateFullAnalysis,
      distributions,
      iterations,
      collectCashFlowPaths,
    });
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
