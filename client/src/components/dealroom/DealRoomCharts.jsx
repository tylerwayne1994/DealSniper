import React from 'react';

/**
 * Hand-rolled inline-SVG chart components for the Deal Room.
 *
 * These are deliberately NOT built on a charting library: the Deal Room's
 * "Generate Investor Link / Export" produces a single self-contained .html
 * file with zero external scripts, so every chart has to be plain inline
 * SVG markup that renders identically in the live app and in the exported
 * file. All inputs are real numbers passed in as props — nothing here
 * fabricates a data point. Any chart with insufficient data returns null.
 */

const ACCENT = 'var(--dr-accent, #0f5132)';
const MUTED = '#94a3b8';
const GRID = '#e5e7eb';

const fmtShort = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '';
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

/** 5-year NOI (bars) + Cash Flow (line) trend. */
export function NoiCashflowChart({ years = [] }) {
  const valid = years.filter((y) => y && (y.noi != null || y.cashFlow != null));
  if (valid.length < 2) return null;

  const width = 640, height = 260, padL = 56, padR = 16, padT = 16, padB = 32;
  const innerW = width - padL - padR, innerH = height - padT - padB;

  const noiVals = valid.map((y) => Number(y.noi) || 0);
  const cfVals = valid.map((y) => Number(y.cashFlow) || 0);
  const maxVal = Math.max(...noiVals, ...cfVals, 0);
  const minVal = Math.min(...cfVals, 0);
  const range = maxVal - minVal || 1;

  const barW = innerW / valid.length * 0.5;
  const xFor = (i) => padL + (innerW / valid.length) * (i + 0.5);
  const yFor = (v) => padT + innerH - ((v - minVal) / range) * innerH;
  const zeroY = yFor(0);

  const linePoints = valid.map((y, i) => `${xFor(i)},${yFor(cfVals[i])}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: 640 }} role="img" aria-label="NOI and cash flow trend">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={padL} x2={width - padR} y1={padT + innerH * t} y2={padT + innerH * t} stroke={GRID} strokeWidth="1" />
      ))}
      {valid.map((y, i) => {
        const barH = Math.abs(yFor(noiVals[i]) - zeroY);
        const barY = noiVals[i] >= 0 ? yFor(noiVals[i]) : zeroY;
        return (
          <g key={y.year || i}>
            <rect x={xFor(i) - barW / 2} y={barY} width={barW} height={Math.max(barH, 1)} fill={ACCENT} opacity="0.85" rx="2" />
            <text x={xFor(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={MUTED}>Yr {y.year}</text>
          </g>
        );
      })}
      <polyline points={linePoints} fill="none" stroke="#0369a1" strokeWidth="2.5" />
      {valid.map((y, i) => (
        <circle key={`pt-${i}`} cx={xFor(i)} cy={yFor(cfVals[i])} r="3.5" fill="#0369a1" />
      ))}
      <text x={padL} y={12} fontSize="11" fill={MUTED}>{fmtShort(maxVal)}</text>
      <g transform={`translate(${width - 150},${padT})`} fontSize="11">
        <rect width="10" height="10" fill={ACCENT} opacity="0.85" />
        <text x="14" y="9" fill="#374151">NOI</text>
        <line x1="60" y1="5" x2="72" y2="5" stroke="#0369a1" strokeWidth="2.5" />
        <text x="76" y="9" fill="#374151">Cash Flow</text>
      </g>
    </svg>
  );
}

/** Value-creation bridge: purchase price -> value at exit. */
export function ValueCreationBridge({ purchasePrice, valueCreation, exitValue }) {
  if (!purchasePrice || !exitValue) return null;
  const steps = [
    { label: 'Purchase Price', value: purchasePrice },
    { label: 'Value Creation', value: valueCreation || (exitValue - purchasePrice) },
    { label: 'Exit Value', value: exitValue },
  ];
  const width = 520, height = 220, padL = 20, padR = 20, padT = 20, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const maxVal = Math.max(...steps.map((s) => s.value));
  const barW = innerW / steps.length * 0.55;
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label="Value creation bridge">
      {steps.map((s, i) => {
        const x = padL + (innerW / steps.length) * (i + 0.5);
        const barH = innerH - (yFor(s.value) - padT);
        const color = i === 1 ? '#0369a1' : ACCENT;
        return (
          <g key={s.label}>
            <rect x={x - barW / 2} y={yFor(s.value)} width={barW} height={Math.max(barH, 1)} fill={color} opacity="0.85" rx="3" />
            <text x={x} y={yFor(s.value) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">{fmtShort(s.value)}</text>
            <text x={x} y={height - 12} textAnchor="middle" fontSize="11" fill={MUTED}>{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Returns comparison across investor options (only renders with 2+ options). */
export function ReturnsComparisonChart({ options = [] }) {
  const withReturns = options.filter((o) => Array.isArray(o.returns) && o.returns.some((r) => r.label === 'Levered IRR'));
  if (withReturns.length < 2) return null;

  const width = 520, height = 220, padL = 40, padR = 16, padT = 16, padB = 32;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const irrs = withReturns.map((o) => (o.returns.find((r) => r.label === 'Levered IRR')?.value || 0) * 100);
  const maxVal = Math.max(...irrs, 1);
  const barW = innerW / withReturns.length * 0.5;
  const yFor = (v) => padT + innerH - (v / maxVal) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: 520 }} role="img" aria-label="Returns comparison by option">
      {withReturns.map((o, i) => {
        const x = padL + (innerW / withReturns.length) * (i + 0.5);
        const barH = innerH - (yFor(irrs[i]) - padT);
        return (
          <g key={o.name}>
            <rect x={x - barW / 2} y={yFor(irrs[i])} width={barW} height={Math.max(barH, 1)} fill={ACCENT} opacity="0.85" rx="3" />
            <text x={x} y={yFor(irrs[i]) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">{irrs[i].toFixed(1)}%</text>
            <text x={x} y={height - 12} textAnchor="middle" fontSize="11" fill={MUTED}>{o.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Current rent vs market comp vs FMR, by unit type. */
export function RentCompChart({ unitMix = [], marketRent = null }) {
  const rows = unitMix.filter((u) => u && (u.baseRent || u.base_rent || u.currentRent));
  if (rows.length < 1) return null;

  const width = 560, height = 240, padL = 48, padR = 16, padT = 16, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const currentVals = rows.map((r) => Number(r.baseRent ?? r.base_rent ?? r.currentRent) || 0);
  const marketVals = rows.map((r) => Number(r.marketRent ?? r.market_rent) || marketRent || 0);
  const maxVal = Math.max(...currentVals, ...marketVals, 1);
  const groupW = innerW / rows.length;
  const barW = Math.min(groupW * 0.35, 28);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: 560 }} role="img" aria-label="Current rent vs market comp by unit type">
      {rows.map((r, i) => {
        const groupX = padL + groupW * i + groupW / 2;
        const curH = (currentVals[i] / maxVal) * innerH;
        const mktH = (marketVals[i] / maxVal) * innerH;
        return (
          <g key={r.type || i}>
            <rect x={groupX - barW - 2} y={padT + innerH - curH} width={barW} height={Math.max(curH, 1)} fill={ACCENT} opacity="0.85" rx="2" />
            {marketVals[i] > 0 && (
              <rect x={groupX + 2} y={padT + innerH - mktH} width={barW} height={Math.max(mktH, 1)} fill="#0369a1" opacity="0.85" rx="2" />
            )}
            <text x={groupX} y={height - 12} textAnchor="middle" fontSize="11" fill={MUTED}>{r.type || `Unit ${i + 1}`}</text>
          </g>
        );
      })}
      <g transform={`translate(${width - 170},${padT})`} fontSize="11">
        <rect width="10" height="10" fill={ACCENT} opacity="0.85" />
        <text x="14" y="9" fill="#374151">Current Rent</text>
        <rect x="90" width="10" height="10" fill="#0369a1" opacity="0.85" />
        <text x="104" y="9" fill="#374151">Market</text>
      </g>
    </svg>
  );
}
