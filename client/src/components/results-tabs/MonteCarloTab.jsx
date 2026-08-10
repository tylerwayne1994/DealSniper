import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, ReferenceLine, ComposedChart, Area, Line } from 'recharts';
import {
  getDefaultDistributions, runMonteCarloSimulation, summarizeDistribution,
  probabilityBelow, buildHistogram, buildCashFlowFanChart,
} from '../../utils/monteCarloEngine';
import { calculateFullAnalysis } from '../../utils/realEstateCalculations';
import { uploadDealDocument } from '../../lib/dealDocumentsService';
import { API_BASE_URL } from '../../config/api';

// ─── Theme (matches SensitivityAnalysisTab / rest of Results UI) ──────────
const B = '#e5e7eb';
const LB = '#6b7280';
const VL = '#111827';
const card = {
  backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
  marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
};

const safePct = (v, decimals = 1) => (v == null || !isFinite(v) || Math.abs(v) > 999) ? 'N/A' : `${v.toFixed(decimals)}%`;
const safeX = (v) => (v == null || !isFinite(v)) ? 'N/A' : `${v.toFixed(2)}x`;

const ITERATION_OPTIONS = [1000, 5000, 10000, 25000];

export default function MonteCarloTab({ scenarioData, fullCalcs, dealId }) {
  const [distributions, setDistributions] = useState(() => getDefaultDistributions(scenarioData, fullCalcs));
  const [iterations, setIterations] = useState(10000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(null);
  const [treasuryRates, setTreasuryRates] = useState([]);
  const [treasuryTerm, setTreasuryTerm] = useState(10);
  const [useLiveRate, setUseLiveRate] = useState(false);
  const [rateSpread, setRateSpread] = useState(0.025);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const workerRef = useRef(null);
  const startRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/treasury-rates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data?.rates)) setTreasuryRates(data.rates); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDistributions(getDefaultDistributions(scenarioData, fullCalcs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioData?.property?.units, fullCalcs?.returns?.leveredIRR]);

  useEffect(() => () => { workerRef.current && workerRef.current.terminate(); }, []);

  const updateDist = (key, patch) => {
    setDistributions((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const applyLiveRate = (term) => {
    const entry = treasuryRates.find((r) => r.term === term);
    if (!entry) return;
    const liveMean = (entry.rate / 100) + rateSpread;
    updateDist('interestRate', { mean: liveMean });
  };

  const runSimulation = () => {
    if (!scenarioData) return;
    setRunning(true);
    setError(null);
    setProgress({ completed: 0, total: iterations });
    startRef.current = performance.now();

    if (workerRef.current) workerRef.current.terminate();
    try {
      const worker = new Worker(new URL('../../workers/monteCarloWorker.js', import.meta.url));
      workerRef.current = worker;
      worker.onmessage = (e) => {
        const { type } = e.data || {};
        if (type === 'progress') {
          setProgress({ completed: e.data.completed, total: e.data.total });
        } else if (type === 'done') {
          setRawResult(e.data.result);
          setElapsedMs(performance.now() - startRef.current);
          setRunning(false);
          worker.terminate();
        } else if (type === 'error') {
          setError(e.data.message || 'Simulation failed');
          setRunning(false);
          worker.terminate();
        }
      };
      worker.onerror = (err) => {
        setError(err?.message || 'Simulation worker failed');
        setRunning(false);
      };
      worker.postMessage({ scenarioData, distributions, iterations, collectCashFlowPaths: true });
    } catch (err) {
      // Web Worker unsupported/blocked — fall back to running on the main thread.
      try {
        const result = runMonteCarloSimulation({ scenarioData, calculateFullAnalysisFn: calculateFullAnalysis, distributions, iterations, collectCashFlowPaths: true });
        setRawResult(result);
        setElapsedMs(performance.now() - startRef.current);
        setRunning(false);
      } catch (fallbackErr) {
        setError(fallbackErr?.message || 'Simulation failed');
        setRunning(false);
      }
    }
  };

  const irrStats = useMemo(() => rawResult && summarizeDistribution(rawResult.leveredIRR), [rawResult]);
  const emStats = useMemo(() => rawResult && summarizeDistribution(rawResult.leveredEM), [rawResult]);
  const cocStats = useMemo(() => rawResult && summarizeDistribution(rawResult.cashOnCash), [rawResult]);
  const dscrStats = useMemo(() => rawResult && summarizeDistribution(rawResult.minDSCR), [rawResult]);
  const probLoss = useMemo(() => rawResult && probabilityBelow(rawResult.leveredEM, 1.0), [rawResult]);
  const probNegIRR = useMemo(() => rawResult && probabilityBelow(rawResult.leveredIRR, 0), [rawResult]);
  const irrHistogram = useMemo(() => rawResult && buildHistogram(rawResult.leveredIRR, 24), [rawResult]);
  const emHistogram = useMemo(() => rawResult && buildHistogram(rawResult.leveredEM, 24), [rawResult]);
  const fanChartData = useMemo(() => rawResult?.cashFlowByYear && buildCashFlowFanChart(rawResult.cashFlowByYear), [rawResult]);

  const saveResultsToDocuments = async () => {
    if (!dealId || !resultsRef.current) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(resultsRef.current, { scale: 2, backgroundColor: '#f9fafb' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const blob = pdf.output('blob');
      await uploadDealDocument(dealId, blob, { fileName: 'Monte_Carlo_Results.pdf', category: 'monte_carlo_analysis' });
      setSaveMsg('Saved to this deal\'s Documents ✓');
    } catch (err) {
      setSaveMsg(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const varRows = [
    { key: 'exitCapRate', suffix: 'bps', mult: 10000 },
    { key: 'incomeGrowth', suffix: 'bps', mult: 10000 },
    { key: 'expenseGrowth', suffix: 'bps', mult: 10000 },
    { key: 'interestRate', suffix: 'bps', mult: 10000 },
  ];

  if (!scenarioData) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ ...card, textAlign: 'center', color: LB, fontSize: 13 }}>No deal data available for simulation.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: VL }}>Monte Carlo Simulation</div>
          <div style={{ fontSize: 12, color: LB, marginTop: 4 }}>
            Run thousands of randomized scenarios across rate, growth, and vacancy volatility to see the full range of possible outcomes — not just base/upside/downside.
          </div>
        </div>

        {/* ═══ ASSUMPTIONS PANEL ═══ */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>Volatility Assumptions</div>
          <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>
            Each enabled variable is randomly redrawn every iteration around the deal's current base case. Adjust the volatility (standard deviation) to widen or narrow the risk range.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {varRows.map(({ key, suffix, mult }) => {
              const d = distributions[key];
              if (!d) return null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 4px', borderBottom: `1px solid #f3f4f6` }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 190, flexShrink: 0 }}>
                    <input type="checkbox" checked={!!d.enabled} onChange={(e) => updateDist(key, { enabled: e.target.checked })} style={{ accentColor: '#10b981' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: VL }}>{d.label}</span>
                  </label>
                  <span style={{ fontSize: 12, color: LB, width: 130, flexShrink: 0 }}>Base: {(d.mean * 100).toFixed(2)}%</span>
                  <span style={{ fontSize: 12, color: LB, flexShrink: 0 }}>±1σ Volatility:</span>
                  <input
                    type="number" step="1" disabled={!d.enabled}
                    value={Math.round((d.stdDev || 0) * mult)}
                    onChange={(e) => updateDist(key, { stdDev: (parseFloat(e.target.value) || 0) / mult })}
                    style={{ width: 80, padding: '5px 8px', borderRadius: 6, border: `1px solid ${B}`, fontSize: 12, color: VL, opacity: d.enabled ? 1 : 0.4 }}
                  />
                  <span style={{ fontSize: 11, color: LB }}>{suffix}</span>
                  {key === 'interestRate' && treasuryRates.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: LB }}>
                        <input type="checkbox" checked={useLiveRate} onChange={(e) => { setUseLiveRate(e.target.checked); if (e.target.checked) applyLiveRate(treasuryTerm); }} style={{ accentColor: '#06b6d4' }} />
                        Use live {treasuryTerm}yr Treasury
                      </label>
                      <select value={treasuryTerm} disabled={!useLiveRate}
                        onChange={(e) => { const t = parseInt(e.target.value, 10); setTreasuryTerm(t); if (useLiveRate) applyLiveRate(t); }}
                        style={{ padding: '3px 6px', borderRadius: 5, border: `1px solid ${B}`, fontSize: 11 }}>
                        {treasuryRates.map((r) => <option key={r.term} value={r.term}>{r.term}yr</option>)}
                      </select>
                      <span style={{ fontSize: 11, color: LB }}>+ spread</span>
                      <input type="number" step="0.1" disabled={!useLiveRate} value={(rateSpread * 100).toFixed(2)}
                        onChange={(e) => { const s = (parseFloat(e.target.value) || 0) / 100; setRateSpread(s); if (useLiveRate) applyLiveRate(treasuryTerm); }}
                        style={{ width: 60, padding: '3px 6px', borderRadius: 5, border: `1px solid ${B}`, fontSize: 11 }} />
                      <span style={{ fontSize: 11, color: LB }}>%</span>
                    </span>
                  )}
                </div>
              );
            })}
            {/* Renovation / stabilization delay — triangular, months */}
            {distributions.renoDelay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 4px', borderBottom: `1px solid #f3f4f6` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 190, flexShrink: 0 }}>
                  <input type="checkbox" checked={!!distributions.renoDelay.enabled} onChange={(e) => updateDist('renoDelay', { enabled: e.target.checked })} style={{ accentColor: '#10b981' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: VL }}>{distributions.renoDelay.label}</span>
                </label>
                <span style={{ fontSize: 12, color: LB }}>Min</span>
                <input type="number" step="1" disabled={!distributions.renoDelay.enabled} value={distributions.renoDelay.min}
                  onChange={(e) => updateDist('renoDelay', { min: parseFloat(e.target.value) || 0 })}
                  style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: `1px solid ${B}`, fontSize: 12 }} />
                <span style={{ fontSize: 12, color: LB }}>Likely</span>
                <input type="number" step="1" disabled={!distributions.renoDelay.enabled} value={distributions.renoDelay.mode}
                  onChange={(e) => updateDist('renoDelay', { mode: parseFloat(e.target.value) || 0 })}
                  style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: `1px solid ${B}`, fontSize: 12 }} />
                <span style={{ fontSize: 12, color: LB }}>Max</span>
                <input type="number" step="1" disabled={!distributions.renoDelay.enabled} value={distributions.renoDelay.max}
                  onChange={(e) => updateDist('renoDelay', { max: parseFloat(e.target.value) || 0 })}
                  style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: `1px solid ${B}`, fontSize: 12 }} />
                <span style={{ fontSize: 11, color: LB }}>months — haircuts Year 1 cash flow proportionally, IRR/EM recomputed off the adjusted cash flow stream</span>
              </div>
            )}
            {/* Vacancy — triangular, edit min/mode/max range instead of stdDev */}
            {distributions.vacancyRate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 190, flexShrink: 0 }}>
                  <input type="checkbox" checked={!!distributions.vacancyRate.enabled} onChange={(e) => updateDist('vacancyRate', { enabled: e.target.checked })} style={{ accentColor: '#10b981' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: VL }}>{distributions.vacancyRate.label}</span>
                </label>
                <span style={{ fontSize: 12, color: LB }}>
                  Range: {(distributions.vacancyRate.min * 100).toFixed(1)}% – {(distributions.vacancyRate.max * 100).toFixed(1)}% (mode {(distributions.vacancyRate.mode * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: LB }}>Iterations:</label>
            <select value={iterations} onChange={(e) => setIterations(parseInt(e.target.value, 10))} disabled={running}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${B}`, fontSize: 12, color: VL }}>
              {ITERATION_OPTIONS.map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
            </select>
            <button onClick={runSimulation} disabled={running}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer',
                background: running ? '#9ca3af' : 'linear-gradient(90deg, #10b981, #06b6d4)', color: '#fff',
              }}>
              {running ? `Running… ${progress ? `${progress.completed.toLocaleString()}/${progress.total.toLocaleString()}` : ''}` : 'Run Simulation'}
            </button>
            {elapsedMs != null && !running && (
              <span style={{ fontSize: 11, color: LB }}>Completed in {(elapsedMs / 1000).toFixed(2)}s{rawResult?.errors ? ` · ${rawResult.errors} skipped (invalid scenario)` : ''}</span>
            )}
            {error && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{error}</span>}
            {rawResult && dealId && (
              <button onClick={saveResultsToDocuments} disabled={saving}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${B}`, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', background: '#fff', color: VL }}>
                {saving ? 'Saving…' : 'Save Results to Documents'}
              </button>
            )}
            {saveMsg && <span style={{ fontSize: 11, color: saveMsg.startsWith('Failed') ? '#dc2626' : '#059669' }}>{saveMsg}</span>}
          </div>
        </div>

        {!rawResult && !running && (
          <div style={{ ...card, textAlign: 'center', color: LB, fontSize: 13, padding: '48px 24px' }}>
            Configure your volatility assumptions above, then run the simulation to see the probability distribution of IRR and equity multiple.
          </div>
        )}

        {rawResult && (
          <div ref={resultsRef}>
            {/* ═══ HEADLINE STATS ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Probability of Loss (EM < 1.0x)', value: safePct(probLoss), color: probLoss > 15 ? '#dc2626' : probLoss > 5 ? '#f59e0b' : '#10b981' },
                { label: 'Probability of Negative IRR', value: safePct(probNegIRR), color: probNegIRR > 15 ? '#dc2626' : probNegIRR > 5 ? '#f59e0b' : '#10b981' },
                { label: 'Median IRR (P50)', value: safePct(irrStats?.p50), color: '#3b82f6' },
                { label: 'Value at Risk — IRR (P5)', value: safePct(irrStats?.p5), color: '#8b5cf6' },
              ].map((m, i) => (
                <div key={i} style={{ ...card, marginBottom: 0, borderLeft: `4px solid ${m.color}`, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: VL }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* ═══ IRR HISTOGRAM ═══ */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>Levered IRR Distribution</div>
              <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>Across {rawResult.iterations.toLocaleString()} simulated scenarios</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={irrHistogram} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <XAxis dataKey="mid" tickFormatter={(v) => `${v.toFixed(0)}%`} stroke={LB} fontSize={10} />
                    <YAxis stroke={LB} fontSize={10} />
                    <RTooltip
                      contentStyle={{ backgroundColor: '#fff', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v) => `~${v.toFixed(1)}% IRR`}
                      formatter={(value) => [value, 'Scenarios']}
                    />
                    <ReferenceLine x={0} stroke="#dc2626" strokeDasharray="4 4" />
                    <Bar dataKey="count">
                      {irrHistogram?.map((b, i) => (
                        <Cell key={i} fill={b.mid < 0 ? '#f87171' : '#34d399'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ═══ EQUITY MULTIPLE HISTOGRAM ═══ */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>Levered Equity Multiple Distribution</div>
              <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>Return of 1.0x = break-even on invested equity</div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emHistogram} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <XAxis dataKey="mid" tickFormatter={(v) => `${v.toFixed(2)}x`} stroke={LB} fontSize={10} />
                    <YAxis stroke={LB} fontSize={10} />
                    <RTooltip
                      contentStyle={{ backgroundColor: '#fff', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(v) => `~${v.toFixed(2)}x`}
                      formatter={(value) => [value, 'Scenarios']}
                    />
                    <ReferenceLine x={1} stroke="#dc2626" strokeDasharray="4 4" />
                    <Bar dataKey="count">
                      {emHistogram?.map((b, i) => (
                        <Cell key={i} fill={b.mid < 1 ? '#f87171' : '#34d399'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ═══ CASH FLOW FAN CHART ═══ */}
            {fanChartData && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 4 }}>Cash Flow Range Over the Hold Period</div>
                <div style={{ fontSize: 11, color: LB, marginBottom: 16 }}>Shaded bands show the 5th–95th and 25th–75th percentile range of levered cash flow each year across every simulated scenario; the line is the median.</div>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={fanChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} stroke={LB} fontSize={10} />
                      <YAxis stroke={LB} fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <RTooltip
                        contentStyle={{ backgroundColor: '#fff', border: `1px solid ${B}`, borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(v) => `Year ${v}`}
                        formatter={(value, name) => [`$${Math.round(value).toLocaleString()}`, name]}
                      />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="2 2" />
                      <Area type="monotone" dataKey="p95" stackId="outer" stroke="none" fill="#a7f3d0" fillOpacity={0.5} name="P95" />
                      <Area type="monotone" dataKey="p5" stackId="outer" stroke="none" fill="#fff" fillOpacity={1} name="P5" />
                      <Area type="monotone" dataKey="p75" stackId="inner" stroke="none" fill="#34d399" fillOpacity={0.6} name="P75" />
                      <Area type="monotone" dataKey="p25" stackId="inner" stroke="none" fill="#fff" fillOpacity={1} name="P25" />
                      <Line type="monotone" dataKey="p50" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Median" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ═══ PERCENTILE TABLE ═══ */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: VL, marginBottom: 16 }}>Percentile Breakdown</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: LB, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, borderBottom: `2px solid ${B}` }}>Metric</th>
                      {['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'].map((p) => (
                        <th key={p} style={{ textAlign: 'center', padding: '8px 12px', color: LB, fontWeight: 700, textTransform: 'uppercase', fontSize: 10, borderBottom: `2px solid ${B}` }}>{p.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Levered IRR', stats: irrStats, fmt: safePct },
                      { label: 'Equity Multiple', stats: emStats, fmt: safeX },
                      { label: 'Year 1 Cash-on-Cash', stats: cocStats, fmt: safePct },
                      { label: 'Min DSCR', stats: dscrStats, fmt: safeX },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: VL, borderBottom: `1px solid #f3f4f6` }}>{row.label}</td>
                        {['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'].map((p) => (
                          <td key={p} style={{ textAlign: 'center', padding: '10px 12px', color: VL, borderBottom: `1px solid #f3f4f6`, fontWeight: p === 'p50' ? 700 : 500 }}>
                            {row.stats ? row.fmt(row.stats[p]) : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
