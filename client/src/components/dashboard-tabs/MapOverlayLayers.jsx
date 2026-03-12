/**
 * MapOverlayLayers.jsx
 *
 * Optional overlay layers for the Dashboard map:
 *   1. County Heat Map    — GeoJSON choropleth colored by a selectable metric
 *   2. ZIP Centroid Dots  — CircleMarkers at ZCTA centroids
 *   3. ZIP Heat Map       — ZCTA polygon choropleth via Census TIGERweb API
 *                           with Demographics, Housing & Economy data layers
 *
 * All layers fetch Census CSVs from /public on first enable and cache the
 * result. Click a county, ZIP dot, or ZIP polygon to see a rich tooltip.
 *
 * This component must be rendered **inside** a <MapContainer>.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';

// ────────────────────────────────────────────────────────
// 1. Utility helpers (mirrors CensusMapViewer / MarketHeatMap)
// ────────────────────────────────────────────────────────
const isNum = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));
const clean = (v) => {
  if (v == null || v === '' || v === '-' || v === 'N' || v === '(X)' || /-666|-888|-999/.test(String(v))) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
  return Number.isNaN(n) ? null : n;
};
const extractFips = (geoId) => (typeof geoId === 'string' && geoId.includes('US') ? geoId.split('US')[1] : null);
const parseLoc = (name) => {
  if (typeof name === 'string' && name.includes(',')) {
    const [a, b] = name.split(',').map(s => s.trim());
    return { county: a, state: b };
  }
  return { county: name, state: null };
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const zeroZip = (z) => {
  if (z == null) return null;
  const s = String(Math.trunc(Number(z) || Number(String(z).replace(/\D/g, '')) || 0));
  return s.padStart(5, '0');
};
const fmtDollar = (v) => (v == null ? 'N/A' : '$' + Math.round(v).toLocaleString());
const fmtPct = (v, d = 1) => (v == null ? 'N/A' : v.toFixed(d) + '%');
const fmtNum = (v) => (v == null ? 'N/A' : Number(v).toLocaleString());

// ────────────────────────────────────────────────────────
// 2. Metric definitions (county-level)
// ────────────────────────────────────────────────────────
const COUNTY_METRICS = {
  populationGrowth: { name: 'Population Growth', unit: '%', fmt: v => fmtPct(v) },
  medianHouseholdIncome: { name: 'Median Income', unit: '$', fmt: v => fmtDollar(v) },
  medianGrossRent: { name: 'Median Rent', unit: '$', fmt: v => fmtDollar(v) },
  vacancyRate: { name: 'Vacancy Rate', unit: '%', fmt: v => fmtPct(v) },
  unemploymentRate: { name: 'Unemployment', unit: '%', fmt: v => fmtPct(v) },
  appreciation: { name: 'Appreciation', unit: '%', fmt: v => fmtPct(v) },
  affordability: { name: 'Affordability', unit: '%', fmt: v => fmtPct(v, 0) },
  migrationRate: { name: 'Net Migration', unit: '‰', fmt: v => v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}‰` },
};

// Color scales per metric
const COUNTY_COLOR_SCALES = {
  populationGrowth: [
    { min: -Infinity, max: 0, color: '#dc2626' }, { min: 0, max: 2, color: '#f59e0b' },
    { min: 2, max: 4, color: '#84cc16' }, { min: 4, max: 8, color: '#22c55e' },
    { min: 8, max: Infinity, color: '#166534' },
  ],
  medianHouseholdIncome: [
    { min: -Infinity, max: 35000, color: '#dc2626' }, { min: 35000, max: 50000, color: '#f59e0b' },
    { min: 50000, max: 75000, color: '#eab308' }, { min: 75000, max: 100000, color: '#84cc16' },
    { min: 100000, max: Infinity, color: '#16a34a' },
  ],
  medianGrossRent: [
    { min: -Infinity, max: 800, color: '#16a34a' }, { min: 800, max: 1200, color: '#84cc16' },
    { min: 1200, max: 1600, color: '#eab308' }, { min: 1600, max: 2000, color: '#f59e0b' },
    { min: 2000, max: Infinity, color: '#dc2626' },
  ],
  vacancyRate: [
    { min: -Infinity, max: 3, color: '#166534' }, { min: 3, max: 6, color: '#22c55e' },
    { min: 6, max: 10, color: '#eab308' }, { min: 10, max: 15, color: '#f59e0b' },
    { min: 15, max: Infinity, color: '#dc2626' },
  ],
  unemploymentRate: [
    { min: -Infinity, max: 3, color: '#16a34a' }, { min: 3, max: 5, color: '#84cc16' },
    { min: 5, max: 7, color: '#eab308' }, { min: 7, max: 10, color: '#f59e0b' },
    { min: 10, max: Infinity, color: '#dc2626' },
  ],
  appreciation: [
    { min: -Infinity, max: 0, color: '#dc2626' }, { min: 0, max: 3, color: '#f59e0b' },
    { min: 3, max: 6, color: '#eab308' }, { min: 6, max: 10, color: '#84cc16' },
    { min: 10, max: Infinity, color: '#16a34a' },
  ],
  affordability: [
    { min: -Infinity, max: 20, color: '#16a34a' }, { min: 20, max: 30, color: '#84cc16' },
    { min: 30, max: 40, color: '#eab308' }, { min: 40, max: 50, color: '#f59e0b' },
    { min: 50, max: Infinity, color: '#dc2626' },
  ],
  migrationRate: [
    { min: -Infinity, max: -10, color: '#7f1d1d' }, { min: -10, max: -5, color: '#dc2626' },
    { min: -5, max: 0, color: '#f59e0b' }, { min: 0, max: 5, color: '#84cc16' },
    { min: 5, max: 10, color: '#22c55e' }, { min: 10, max: Infinity, color: '#166534' },
  ],
};

const colorForCounty = (val, metric) => {
  if (!isNum(val)) return '#e5e7eb';
  const scale = COUNTY_COLOR_SCALES[metric] || [];
  for (const r of scale) {
    if (val >= r.min && val < r.max) return r.color;
  }
  return scale.length ? scale[scale.length - 1].color : '#e5e7eb';
};

// ZIP metrics (re-use same approach)
const ZIP_METRICS = {
  density_sqmi: { name: 'Pop. Density', fmt: v => v == null ? 'N/A' : `${v.toFixed(0)}/sq mi` },
  medianHouseholdIncome: { name: 'Median Income', fmt: v => fmtDollar(v) },
  medianGrossRent: { name: 'Median Rent', fmt: v => fmtDollar(v) },
  employmentRate: { name: 'Employment %', fmt: v => fmtPct(v) },
  migrationRate: { name: 'Net Migration', fmt: v => v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}‰` },
};

const ZIP_COLOR_SCALES = {
  density_sqmi: [
    { min: -Infinity, max: 500, color: '#fff7bc' }, { min: 500, max: 1000, color: '#fec44f' },
    { min: 1000, max: 2000, color: '#fe9929' }, { min: 2000, max: 5000, color: '#ec7014' },
    { min: 5000, max: 10000, color: '#cc4c02' }, { min: 10000, max: Infinity, color: '#993404' },
  ],
  medianHouseholdIncome: [
    { min: -Infinity, max: 25000, color: '#ef4444' }, { min: 25000, max: 50000, color: '#f87171' },
    { min: 50000, max: 75000, color: '#fca5a5' }, { min: 75000, max: Infinity, color: '#10b981' },
  ],
  medianGrossRent: [
    { min: -Infinity, max: 1000, color: '#ef4444' }, { min: 1000, max: 1500, color: '#f87171' },
    { min: 1500, max: 2000, color: '#fca5a5' }, { min: 2000, max: Infinity, color: '#10b981' },
  ],
  employmentRate: [
    { min: -Infinity, max: 45, color: '#ef4444' }, { min: 45, max: 48, color: '#f87171' },
    { min: 48, max: 50, color: '#fca5a5' }, { min: 50, max: Infinity, color: '#10b981' },
  ],
  migrationRate: [
    { min: -Infinity, max: -10, color: '#7f1d1d' }, { min: -10, max: -5, color: '#dc2626' },
    { min: -5, max: 0, color: '#f59e0b' }, { min: 0, max: 5, color: '#84cc16' },
    { min: 5, max: 10, color: '#22c55e' }, { min: 10, max: Infinity, color: '#166534' },
  ],
};

const colorForZip = (val, metric) => {
  if (!isNum(val)) return '#d1d5db';
  const scale = ZIP_COLOR_SCALES[metric] || [];
  for (const r of scale) {
    if (val >= r.min && val < r.max) return r.color;
  }
  return scale.length ? scale[scale.length - 1].color : '#d1d5db';
};

// ────────────────────────────────────────────────────────
// 2b. ZIP Heat Map — metric definitions + color scales
// ────────────────────────────────────────────────────────
const TIGERWEB_ZCTA_URL = (process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com') + '/api/tigerweb/zcta';
const CENSUS_ACS_ZCTA_URL = (process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com') + '/api/census/zcta-acs';

const ZIP_HEATMAP_METRICS = {
  population:             { name: 'Population',     group: 'Demographics',       fmt: v => fmtNum(v) },
  density_sqmi:           { name: 'Pop. Density',   group: 'Demographics',       fmt: v => v == null ? 'N/A' : `${v.toFixed(0)}/sq mi` },
  medianHouseholdIncome:  { name: 'Median Income',  group: 'Demographics',       fmt: v => fmtDollar(v) },
  medianHomeValue:        { name: 'Home Value',     group: 'Housing & Economy',  fmt: v => fmtDollar(v) },
  medianGrossRent:        { name: 'Median Rent',    group: 'Housing & Economy',  fmt: v => fmtDollar(v) },
  vacancyRate:            { name: 'Vacancy Rate',   group: 'Housing & Economy',  fmt: v => fmtPct(v) },
  unemploymentRate:       { name: 'Unemployment',   group: 'Housing & Economy',  fmt: v => fmtPct(v) },
  migrationRate:          { name: 'Net Migration',  group: 'Demographics',       fmt: v => v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}‰` },
  // Census ACS Investor Metrics
  rentBurden:             { name: 'Rent Burden %',           group: 'Census ACS Investor', fmt: v => fmtPct(v) },
  netInMigration:         { name: 'Net In-Migration',        group: 'Census ACS Investor', fmt: v => fmtNum(v) },
  renterShare:            { name: 'Renter Household %',      group: 'Census ACS Investor', fmt: v => fmtPct(v) },
  effectiveTaxRate:       { name: 'Eff. Property Tax %',     group: 'Census ACS Investor', fmt: v => fmtPct(v, 2) },
  employmentRateACS:      { name: 'Employment Rate %',       group: 'Census ACS Investor', fmt: v => fmtPct(v) },
  fmr_0br:                { name: 'FMR Studio',     group: 'HUD Fair Market Rent', fmt: v => fmtDollar(v) },
  fmr_1br:                { name: 'FMR 1-Bed',      group: 'HUD Fair Market Rent', fmt: v => fmtDollar(v) },
  fmr_2br:                { name: 'FMR 2-Bed',      group: 'HUD Fair Market Rent', fmt: v => fmtDollar(v) },
  fmr_3br:                { name: 'FMR 3-Bed',      group: 'HUD Fair Market Rent', fmt: v => fmtDollar(v) },
  fmr_4br:                { name: 'FMR 4-Bed',      group: 'HUD Fair Market Rent', fmt: v => fmtDollar(v) },
};

const ZIP_HEATMAP_COLOR_SCALES = {
  population: [
    { min: -Infinity, max: 5000, color: '#eff6ff' }, { min: 5000, max: 15000, color: '#93c5fd' },
    { min: 15000, max: 30000, color: '#3b82f6' }, { min: 30000, max: 60000, color: '#1d4ed8' },
    { min: 60000, max: Infinity, color: '#1e3a5f' },
  ],
  density_sqmi: [
    { min: -Infinity, max: 500, color: '#fff7bc' }, { min: 500, max: 1000, color: '#fec44f' },
    { min: 1000, max: 3000, color: '#fe9929' }, { min: 3000, max: 8000, color: '#ec7014' },
    { min: 8000, max: Infinity, color: '#993404' },
  ],
  medianHouseholdIncome: [
    { min: -Infinity, max: 35000, color: '#dc2626' }, { min: 35000, max: 50000, color: '#f59e0b' },
    { min: 50000, max: 75000, color: '#eab308' }, { min: 75000, max: 100000, color: '#84cc16' },
    { min: 100000, max: Infinity, color: '#16a34a' },
  ],
  medianHomeValue: [
    { min: -Infinity, max: 150000, color: '#dbeafe' }, { min: 150000, max: 300000, color: '#93c5fd' },
    { min: 300000, max: 500000, color: '#3b82f6' }, { min: 500000, max: 800000, color: '#1d4ed8' },
    { min: 800000, max: Infinity, color: '#581c87' },
  ],
  medianGrossRent: [
    { min: -Infinity, max: 800, color: '#16a34a' }, { min: 800, max: 1200, color: '#84cc16' },
    { min: 1200, max: 1600, color: '#eab308' }, { min: 1600, max: 2000, color: '#f59e0b' },
    { min: 2000, max: Infinity, color: '#dc2626' },
  ],
  vacancyRate: [
    { min: -Infinity, max: 3, color: '#166534' }, { min: 3, max: 6, color: '#22c55e' },
    { min: 6, max: 10, color: '#eab308' }, { min: 10, max: 15, color: '#f59e0b' },
    { min: 15, max: Infinity, color: '#dc2626' },
  ],
  unemploymentRate: [
    { min: -Infinity, max: 3, color: '#16a34a' }, { min: 3, max: 5, color: '#84cc16' },
    { min: 5, max: 7, color: '#eab308' }, { min: 7, max: 10, color: '#f59e0b' },
    { min: 10, max: Infinity, color: '#dc2626' },
  ],
  migrationRate: [
    { min: -Infinity, max: -10, color: '#7f1d1d' }, { min: -10, max: -5, color: '#dc2626' },
    { min: -5, max: 0, color: '#f59e0b' }, { min: 0, max: 5, color: '#84cc16' },
    { min: 5, max: 10, color: '#22c55e' }, { min: 10, max: Infinity, color: '#166534' },
  ],
  // Census ACS Investor Metrics
  rentBurden: [
    { min: -Infinity, max: 25, color: '#16a34a' }, { min: 25, max: 30, color: '#84cc16' },
    { min: 30, max: 35, color: '#eab308' }, { min: 35, max: 40, color: '#f59e0b' },
    { min: 40, max: Infinity, color: '#dc2626' },
  ],
  netInMigration: [
    { min: -Infinity, max: 200, color: '#eff6ff' }, { min: 200, max: 1000, color: '#93c5fd' },
    { min: 1000, max: 3000, color: '#3b82f6' }, { min: 3000, max: 8000, color: '#1d4ed8' },
    { min: 8000, max: Infinity, color: '#1e3a5f' },
  ],
  renterShare: [
    { min: -Infinity, max: 20, color: '#dc2626' }, { min: 20, max: 40, color: '#f59e0b' },
    { min: 40, max: 60, color: '#eab308' }, { min: 60, max: 80, color: '#84cc16' },
    { min: 80, max: Infinity, color: '#16a34a' },
  ],
  effectiveTaxRate: [
    { min: -Infinity, max: 0.5, color: '#16a34a' }, { min: 0.5, max: 1.0, color: '#84cc16' },
    { min: 1.0, max: 1.5, color: '#eab308' }, { min: 1.5, max: 2.0, color: '#f59e0b' },
    { min: 2.0, max: Infinity, color: '#dc2626' },
  ],
  employmentRateACS: [
    { min: -Infinity, max: 85, color: '#dc2626' }, { min: 85, max: 90, color: '#f59e0b' },
    { min: 90, max: 95, color: '#eab308' }, { min: 95, max: 98, color: '#84cc16' },
    { min: 98, max: Infinity, color: '#16a34a' },
  ],
  // HUD FMR Rents: red (low) → yellow → green (high)
  fmr_0br: [
    { min: -Infinity, max: 600, color: '#dc2626' }, { min: 600, max: 900, color: '#f97316' },
    { min: 900, max: 1200, color: '#eab308' }, { min: 1200, max: 1600, color: '#84cc16' },
    { min: 1600, max: Infinity, color: '#16a34a' },
  ],
  fmr_1br: [
    { min: -Infinity, max: 700, color: '#dc2626' }, { min: 700, max: 1000, color: '#f97316' },
    { min: 1000, max: 1400, color: '#eab308' }, { min: 1400, max: 1800, color: '#84cc16' },
    { min: 1800, max: Infinity, color: '#16a34a' },
  ],
  fmr_2br: [
    { min: -Infinity, max: 800, color: '#dc2626' }, { min: 800, max: 1200, color: '#f97316' },
    { min: 1200, max: 1600, color: '#eab308' }, { min: 1600, max: 2100, color: '#84cc16' },
    { min: 2100, max: Infinity, color: '#16a34a' },
  ],
  fmr_3br: [
    { min: -Infinity, max: 1000, color: '#dc2626' }, { min: 1000, max: 1500, color: '#f97316' },
    { min: 1500, max: 2000, color: '#eab308' }, { min: 2000, max: 2700, color: '#84cc16' },
    { min: 2700, max: Infinity, color: '#16a34a' },
  ],
  fmr_4br: [
    { min: -Infinity, max: 1200, color: '#dc2626' }, { min: 1200, max: 1800, color: '#f97316' },
    { min: 1800, max: 2400, color: '#eab308' }, { min: 2400, max: 3200, color: '#84cc16' },
    { min: 3200, max: Infinity, color: '#16a34a' },
  ],
};

const colorForZipHeatmap = (val, metric) => {
  if (!isNum(val)) return '#e5e7eb';
  const scale = ZIP_HEATMAP_COLOR_SCALES[metric] || [];
  for (const r of scale) { if (val >= r.min && val < r.max) return r.color; }
  return scale.length ? scale[scale.length - 1].color : '#e5e7eb';
};

const buildZipHeatmapPopup = (zip, z, selectedMetric) => {
  const metricRows = Object.entries(ZIP_HEATMAP_METRICS).map(([key, def]) => {
    const val = z[key];
    const isSel = key === selectedMetric;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;
        ${isSel ? 'background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;' : ''}">
        <span style="font-size:12px;color:#6b7280;${isSel ? 'font-weight:700;color:#1e40af;' : ''}">${def.name}</span>
        <span style="font-size:12px;font-weight:600;color:#111827">${def.fmt(val)}</span>
      </div>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:white;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.12);border:1px solid #e5e7eb;min-width:260px;max-width:320px;">
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;padding:12px 16px;border-radius:12px 12px 0 0">
        <div style="font-weight:700;font-size:14px">ZIP ${zip}</div>
        <div style="opacity:.9;font-size:11px;margin-top:2px">${z.countyName ? z.countyName + (z.stateName ? ', ' + z.stateName : '') : 'ZCTA ' + zip} · Pop: ${fmtNum(z.population)}</div>
      </div>
      <div style="padding:8px 10px;display:flex;flex-direction:column;gap:1px;">
        ${metricRows}
      </div>
    </div>`;
};

// ────────────────────────────────────────────────────────
// 3. Derived metrics helper
// ────────────────────────────────────────────────────────
const calcAppreciation = (c) => {
  let a = 3.2;
  const pg = c.populationGrowth, inc = c.medianHouseholdIncome, vac = c.vacancyRate, un = c.unemploymentRate, pop = c.totalPopulation || 0;
  if (isNum(pg)) { if (pg > 5) a += 7; else if (pg > 3) a += 5; else if (pg > 1.5) a += 3; else if (pg > 0.5) a += 1.5; else if (pg < -1) a -= 4; else if (pg < 0) a -= 2; }
  if (isNum(inc)) { if (inc > 100000) a += 3; else if (inc > 75000) a += 2; else if (inc > 50000) a += 1; else if (inc < 35000) a -= 1.5; }
  if (isNum(vac)) { if (vac < 2) a += 4; else if (vac < 4) a += 2.5; else if (vac < 6) a += 1; else if (vac > 15) a -= 3; else if (vac > 10) a -= 1.5; }
  if (isNum(un)) { if (un < 3) a += 2; else if (un < 5) a += 1; else if (un > 8) a -= 2; else if (un > 6) a -= 1; }
  if (pop > 500000) a += 1.5; else if (pop > 100000) a += 0.8; else if (pop < 25000) a -= 1;
  return clamp(Math.round(a * 10) / 10, -8, 25);
};

const derive = (c) => {
  const d = { ...c };
  d.appreciation = calcAppreciation(c);
  if (isNum(c.medianGrossRent) && isNum(c.medianHouseholdIncome) && c.medianHouseholdIncome > 0)
    d.affordability = (c.medianGrossRent / (c.medianHouseholdIncome / 12)) * 100;
  return d;
};

// ────────────────────────────────────────────────────────
// 4. CSV load helper
// ────────────────────────────────────────────────────────
const loadCSV = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV ${url}: HTTP ${res.status}`);
  const txt = await res.text();
  return Papa.parse(txt, { header: true, dynamicTyping: false, skipEmptyLines: true }).data || [];
};

// ────────────────────────────────────────────────────────
// 5. Popup HTML builders
// ────────────────────────────────────────────────────────
const buildCountyPopup = (c, selectedMetric) => {
  const metricRows = Object.entries(COUNTY_METRICS).map(([key, def]) => {
    const val = c[key];
    const isSel = key === selectedMetric;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;
        ${isSel ? 'background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;' : ''}">
        <span style="font-size:12px;color:#6b7280;${isSel ? 'font-weight:700;color:#1e40af;' : ''}">${def.name}</span>
        <span style="font-size:12px;font-weight:600;color:#111827">${def.fmt(val)}</span>
      </div>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:white;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.12);border:1px solid #e5e7eb;min-width:260px;max-width:320px;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:12px 16px;border-radius:12px 12px 0 0">
        <div style="font-weight:700;font-size:14px">${c.fullName || 'FIPS ' + c.fips}</div>
        <div style="opacity:.9;font-size:11px;margin-top:2px">FIPS: ${c.fips} · Pop: ${fmtNum(c.totalPopulation)}</div>
      </div>
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:2px;">
        ${metricRows}
      </div>
    </div>`;
};

const buildZipPopup = (zip, z, selectedMetric) => {
  const rows = Object.entries(ZIP_METRICS).map(([key, def]) => {
    const val = z[key];
    const isSel = key === selectedMetric;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;
        ${isSel ? 'background:#ecfdf5;border-radius:6px;border:1px solid #a7f3d0;' : ''}">
        <span style="font-size:12px;color:#6b7280;${isSel ? 'font-weight:700;color:#065f46;' : ''}">${def.name}</span>
        <span style="font-size:12px;font-weight:600;color:#111827">${def.fmt(val)}</span>
      </div>`;
  }).join('');

  // Migration detail row
  const migrationDetail = z.migrationRate != null ? `
    <div style="border-top:1px solid #f3f4f6;margin-top:4px;padding-top:6px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
        <div><span style="color:#6b7280">In:</span> <strong>${fmtNum(z.inMigration)}</strong></div>
        <div><span style="color:#6b7280">Out:</span> <strong>${fmtNum(z.outMigration)}</strong></div>
        <div><span style="color:#6b7280">Net:</span> <strong>${fmtNum(z.netMigration)}</strong></div>
        <div><span style="color:#6b7280">Pop 2021:</span> <strong>${fmtNum(z.population2021)}</strong></div>
      </div>
    </div>` : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:white;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.12);border:1px solid #e5e7eb;min-width:240px;max-width:300px;">
      <div style="background:linear-gradient(135deg,#059669,#10b981);color:white;padding:12px 16px;border-radius:12px 12px 0 0">
        <div style="font-weight:700;font-size:14px">ZIP ${zip}</div>
        <div style="opacity:.9;font-size:11px;margin-top:2px">${z.countyName ? z.countyName + (z.stateName ? ', ' + z.stateName : '') : 'ZCTA ' + zip} · Pop: ${fmtNum(z.population || z.population2021)}</div>
      </div>
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:2px;">
        ${rows}
        ${migrationDetail}
      </div>
    </div>`;
};


// ────────────────────────────────────────────────────────
// 6. The overlay React component (runs inside <MapContainer>)
// ────────────────────────────────────────────────────────
export default function MapOverlayLayers({ countyEnabled, zipEnabled, countyMetric, zipMetric, zipHeatmapEnabled, zipHeatmapMetric }) {
  const map = useMap();

  // Data caches (persist across re-renders)
  const countyDataRef = useRef(null);   // { [fips]: { ...metrics } }
  const geoJsonRef = useRef(null);      // GeoJSON FeatureCollection
  const zipDataRef = useRef(null);      // { [zip5]: { ...metrics } }
  const zipCentroidsRef = useRef(null); // [ { zip, lat, lon } ]
  const zipHeatmapDataRef = useRef(null);  // { [zip5]: { ...all metrics } }
  const zipHeatmapGeoCache = useRef({});   // { [boundsKey]: GeoJSON features[] }

  // Layer refs
  const countyLayerRef = useRef(null);
  const zipLayerRef = useRef(null);
  const zipHeatmapLayerRef = useRef(null);

  const [countyLoaded, setCountyLoaded] = useState(false);
  const [zipLoaded, setZipLoaded] = useState(false);
  const [zipHeatmapLoaded, setZipHeatmapLoaded] = useState(false);
  const [loadingCounty, setLoadingCounty] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [loadingZipHeatmap, setLoadingZipHeatmap] = useState(false);

  // ─── Remove helpers ───
  const removeCountyLayer = useCallback(() => {
    if (countyLayerRef.current && map.hasLayer(countyLayerRef.current)) {
      map.removeLayer(countyLayerRef.current);
    }
    countyLayerRef.current = null;
  }, [map]);

  const removeZipLayer = useCallback(() => {
    if (zipLayerRef.current && map.hasLayer(zipLayerRef.current)) {
      map.removeLayer(zipLayerRef.current);
    }
    zipLayerRef.current = null;
  }, [map]);

  const removeZipHeatmapLayer = useCallback(() => {
    if (zipHeatmapLayerRef.current && map.hasLayer(zipHeatmapLayerRef.current)) {
      map.removeLayer(zipHeatmapLayerRef.current);
    }
    zipHeatmapLayerRef.current = null;
  }, [map]);

  // ─── Load county data (once) ───
  const loadCountyData = useCallback(async () => {
    if (countyDataRef.current && geoJsonRef.current) { setCountyLoaded(true); return; }
    setLoadingCounty(true);
    try {
      // Parallel CSV + GeoJSON loads
      const [dp03Raw, dp04Raw, pop23Raw, pop18Raw, empRaw, migRaw, geoRes] = await Promise.all([
        loadCSV('/ACSDP5Y2023.DP03-Data.csv'),
        loadCSV('/ACSDP5Y2023.DP04-Data.csv'),
        loadCSV('/ACSDT5Y2023.B01003-Data.csv'),
        loadCSV('/ACSDT5Y2018.B01003-Data.csv'),
        loadCSV('/ACSST5Y2023.S2301-Data.csv'),
        loadCSV('/migration_with_clean_zipcodes.csv'),
        fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json').then(r => r.json()),
      ]);

      // Skip Census header row (first row = labels, second row onward = data)
      const dp03 = dp03Raw.slice(1);
      const dp04 = dp04Raw.slice(1);
      const pop23 = pop23Raw.slice(1);
      const pop18 = pop18Raw.slice(1);
      const emp = empRaw.slice(1);

      // Build base county map
      const base = {};
      const prime = (row) => {
        const f = extractFips(row.GEO_ID);
        if (!f) return;
        const { county, state } = parseLoc(row.NAME || '');
        if (!base[f]) base[f] = { fips: f, name: county, state, fullName: county && state ? `${county}, ${state}` : `FIPS ${f}` };
      };
      [dp03, dp04, pop23, pop18, emp].forEach(arr => arr.forEach(prime));

      // Income
      dp03.forEach(r => { const f = extractFips(r.GEO_ID); if (f && base[f]) base[f].medianHouseholdIncome = clean(r.DP03_0062E); });
      // Vacancy + rent
      dp04.forEach(r => { const f = extractFips(r.GEO_ID); if (f && base[f]) { base[f].vacancyRate = clean(r.DP04_0003PE); base[f].medianGrossRent = clean(r.DP04_0134E); } });
      // Population growth
      const p23 = new Map(), p18 = new Map();
      pop23.forEach(r => { const f = extractFips(r.GEO_ID); if (f) p23.set(f, r); });
      pop18.forEach(r => { const f = extractFips(r.GEO_ID); if (f) p18.set(f, r); });
      Object.values(base).forEach(c => {
        const r23 = p23.get(c.fips), r18 = p18.get(c.fips);
        if (r23) c.totalPopulation = clean(r23.B01003_001E);
        if (r18) c.historicalPopulation = clean(r18.B01003_001E);
        if (isNum(c.totalPopulation) && isNum(c.historicalPopulation) && c.historicalPopulation > 0)
          c.populationGrowth = ((c.totalPopulation - c.historicalPopulation) / c.historicalPopulation) / 5 * 100;
      });
      // Unemployment
      emp.forEach(r => { const f = extractFips(r.GEO_ID); if (f && base[f]) base[f].unemploymentRate = clean(r.S2301_C04_001E); });

      // Migration (keyed by county FIPS)
      migRaw.forEach(row => {
        const fips5 = String(row.countyfips).padStart(5, '0');
        if (fips5 === '00000' || !base[fips5]) return;
        const rate = clean(row.n2_0_net_pc);
        if (isNum(rate)) base[fips5].migrationRate = Math.round(rate * 1000) / 10;
      });

      // Derive appreciation + affordability
      const out = {};
      Object.entries(base).forEach(([f, c]) => { out[f] = derive(c); });

      countyDataRef.current = out;
      geoJsonRef.current = geoRes;
      setCountyLoaded(true);
      console.log('[Overlay] County data loaded:', Object.keys(out).length, 'counties');
    } catch (err) {
      console.error('[Overlay] Failed to load county data', err);
    } finally {
      setLoadingCounty(false);
    }
  }, []);

  // ─── Load ZIP data (once) ───
  const loadZipData = useCallback(async () => {
    if (zipDataRef.current && zipCentroidsRef.current) { setZipLoaded(true); return; }
    setLoadingZip(true);
    try {
      const [dp03Raw, dp04Raw, densityRaw, migRaw, centroidRows] = await Promise.all([
        loadCSV('/ZIPACSDP5Y2023.DP03-Data.csv'),
        loadCSV('/ZIPACSDP5Y2023.DP04-Data.csv'),
        loadCSV('/zcta_density.csv'),
        loadCSV('/migration_with_clean_zipcodes.csv'),
        loadCSV('/zcta_centroids.csv'),
      ]);

      const zips = {};

      // DP03 — income + employment
      dp03Raw.forEach(r => {
        const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].medianHouseholdIncome = clean(r.DP03_0062E);
        zips[zip].employmentRate = clean(r.DP03_0002PE);
      });

      // DP04 — rent
      dp04Raw.forEach(r => {
        const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].medianGrossRent = clean(r.DP04_0134E);
      });

      // Density
      densityRaw.forEach(r => {
        const zip = zeroZip(r.ZCTA);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].population = clean(r.population);
        zips[zip].land_sqmi = clean(r.land_sqmi);
        let d = clean(r.density_sqmi);
        if (d == null && zips[zip].land_sqmi > 0 && zips[zip].population > 0) d = zips[zip].population / zips[zip].land_sqmi;
        if (d > 300000) d = null; // outlier guard
        zips[zip].density_sqmi = d;
      });

      // Migration (keyed by ZIP)
      migRaw.forEach(row => {
        const zip = zeroZip(row.ZIP);
        const rate = clean(row.n2_0_net_pc);
        if (!zip || !isNum(rate)) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].migrationRate = Math.round(rate * 1000) / 10;
        zips[zip].netMigration = clean(row.n2_0_net);
        zips[zip].inMigration = clean(row.n2_0_in);
        zips[zip].outMigration = clean(row.n2_0_out);
        zips[zip].population2021 = clean(row.pop_2021);
        zips[zip].countyName = row.countyname;
        zips[zip].stateName = row.state_name;
      });

      // Centroids
      const pts = centroidRows
        .map(r => ({ zip: zeroZip(r.geoid), lon: parseFloat(r.x), lat: parseFloat(r.y) }))
        .filter(p => p.zip && Number.isFinite(p.lon) && Number.isFinite(p.lat));

      zipDataRef.current = zips;
      zipCentroidsRef.current = pts;
      setZipLoaded(true);
      console.log('[Overlay] ZIP data loaded:', Object.keys(zips).length, 'zips,', pts.length, 'centroids');
    } catch (err) {
      console.error('[Overlay] Failed to load ZIP data', err);
    } finally {
      setLoadingZip(false);
    }
  }, []);

  // ─── Load ZIP heat map data (once) ───
  const loadZipHeatmapData = useCallback(async () => {
    if (zipHeatmapDataRef.current) { setZipHeatmapLoaded(true); return; }
    setLoadingZipHeatmap(true);
    try {
      const [dp03Raw, dp04Raw, popRaw, densityRaw, migRaw, zhviRaw, fmrRaw] = await Promise.all([
        loadCSV('/ZIPACSDP5Y2023.DP03-Data.csv'),
        loadCSV('/ZIPACSDP5Y2023.DP04-Data.csv'),
        loadCSV('/ZIPACSDT5Y2023.B01003-Data.csv'),
        loadCSV('/zcta_density.csv'),
        loadCSV('/migration_with_clean_zipcodes.csv'),
        loadCSV('/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'),
        loadCSV('/fmr_by_zip_clean.csv'),
      ]);

      const zips = {};

      // DP03 — income + employment
      dp03Raw.forEach(r => {
        const zip = zeroZip(r.NAME ? r.NAME.replace('ZCTA5 ', '') : null);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].medianHouseholdIncome = clean(r.DP03_0062E);
        const empPct = clean(r.DP03_0002PE);
        // Unemployment = 100 - employment% (approximate if no direct field)
        if (isNum(empPct)) zips[zip].unemploymentRate = Math.max(0, 100 - empPct);
      });

      // DP04 — rent, vacancy, housing units
      dp04Raw.forEach(r => {
        const zip = zeroZip(r.NAME ? r.NAME.replace('ZCTA5 ', '') : null);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].medianGrossRent = clean(r.DP04_0134E);
        zips[zip].vacancyRate = clean(r.DP04_0003PE);
        zips[zip].totalHousingUnits = clean(r.DP04_0001E);
      });

      // B01003 — population
      popRaw.forEach(r => {
        const zip = zeroZip(r.NAME ? r.NAME.replace('ZCTA5 ', '') : null);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        const pop = clean(r.B01003_001E);
        if (isNum(pop)) zips[zip].population = pop;
      });

      // Density
      densityRaw.forEach(r => {
        const zip = zeroZip(r.ZCTA);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        if (!zips[zip].population) zips[zip].population = clean(r.population);
        zips[zip].land_sqmi = clean(r.land_sqmi);
        let d = clean(r.density_sqmi);
        if (d == null && zips[zip].land_sqmi > 0 && zips[zip].population > 0)
          d = zips[zip].population / zips[zip].land_sqmi;
        if (d > 300000) d = null;
        zips[zip].density_sqmi = d;
      });

      // Migration
      migRaw.forEach(row => {
        const zip = zeroZip(row.ZIP);
        const rate = clean(row.n2_0_net_pc);
        if (!zip || !isNum(rate)) return;
        zips[zip] = zips[zip] || { zip };
        zips[zip].migrationRate = Math.round(rate * 1000) / 10;
        zips[zip].netMigration = clean(row.n2_0_net);
        zips[zip].countyName = row.countyname;
        zips[zip].stateName = row.state_name;
      });

      // Zillow ZHVI — latest month median home value
      zhviRaw.forEach(row => {
        const zip = zeroZip(row.RegionName);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        // Get last non-empty monthly column value
        const monthCols = Object.keys(row).filter(k => /^\d{2}-\d{2}-\d{2}$/.test(k));
        for (let i = monthCols.length - 1; i >= 0; i--) {
          const v = clean(row[monthCols[i]]);
          if (isNum(v)) { zips[zip].medianHomeValue = Math.round(v); break; }
        }
        if (!zips[zip].countyName && row.CountyName) zips[zip].countyName = row.CountyName;
        if (!zips[zip].stateName && row.StateName) zips[zip].stateName = row.StateName;
      });

      // HUD FMR — Fair Market Rents by bedroom count
      fmrRaw.forEach(row => {
        // CSV has BOM-prefixed first column, papaparse may key it with or without BOM
        const rawZip = row.zip || row['\ufeffzip'] || row[Object.keys(row)[0]];
        const zip = zeroZip(rawZip);
        if (!zip) return;
        zips[zip] = zips[zip] || { zip };
        // Parse rent columns — some rows have a column shift where fmr_0br contains a text name
        const r0 = clean(row.fmr_0br);
        const r1 = clean(row.fmr_1br);
        const r2 = clean(row.fmr_2br);
        const r3 = clean(row.fmr_3br);
        const r4 = clean(row.fmr_4br);
        if (isNum(r0)) zips[zip].fmr_0br = Math.round(r0);
        if (isNum(r1)) zips[zip].fmr_1br = Math.round(r1);
        if (isNum(r2)) zips[zip].fmr_2br = Math.round(r2);
        if (isNum(r3)) zips[zip].fmr_3br = Math.round(r3);
        if (isNum(r4)) zips[zip].fmr_4br = Math.round(r4);
        // If fmr_0br was text (column shift), shift rents: fmr_1br->0br, fmr_2br->1br, etc.
        if (!isNum(r0) && isNum(r1)) {
          zips[zip].fmr_0br = Math.round(r1);
          zips[zip].fmr_1br = isNum(r2) ? Math.round(r2) : undefined;
          zips[zip].fmr_2br = isNum(r3) ? Math.round(r3) : undefined;
          zips[zip].fmr_3br = isNum(r4) ? Math.round(r4) : undefined;
          zips[zip].fmr_4br = undefined;
        }
        if (!zips[zip].countyName && row.county_name) zips[zip].countyName = row.county_name;
        if (!zips[zip].stateName && row.state_usps) zips[zip].stateName = row.state_usps;
      });

      // Census ACS Investor Metrics — Rent Burden, Renter Share, Tax Rate, Employment, In-Migration
      try {
        const acsResp = await fetch(CENSUS_ACS_ZCTA_URL);
        if (acsResp.ok) {
          const acsData = await acsResp.json();
          Object.entries(acsData).forEach(([zipCode, metrics]) => {
            const zip = zeroZip(zipCode);
            if (!zip) return;
            zips[zip] = zips[zip] || { zip };
            if (isNum(metrics.rentBurden))       zips[zip].rentBurden = metrics.rentBurden;
            if (isNum(metrics.netInMigration))   zips[zip].netInMigration = metrics.netInMigration;
            if (isNum(metrics.renterShare))      zips[zip].renterShare = metrics.renterShare;
            if (isNum(metrics.effectiveTaxRate)) zips[zip].effectiveTaxRate = metrics.effectiveTaxRate;
            if (isNum(metrics.employmentRate))   zips[zip].employmentRateACS = metrics.employmentRate;
          });
          console.log('[Overlay] Census ACS investor metrics loaded:', Object.keys(acsData).length, 'zips');
        } else {
          console.warn('[Overlay] Census ACS fetch failed:', acsResp.status);
        }
      } catch (acsErr) {
        console.warn('[Overlay] Census ACS fetch error (non-fatal):', acsErr.message);
      }

      zipHeatmapDataRef.current = zips;
      setZipHeatmapLoaded(true);
      console.log('[Overlay] ZIP heat map data loaded:', Object.keys(zips).length, 'zips');
    } catch (err) {
      console.error('[Overlay] Failed to load ZIP heat map data', err);
    } finally {
      setLoadingZipHeatmap(false);
    }
  }, []);

  // ─── Fetch ZCTA boundaries from TIGERweb for visible bounds ───
  const fetchZctaBoundaries = useCallback(async (bounds) => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const geom = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    const key = geom;

    // Check cache
    if (zipHeatmapGeoCache.current[key]) return zipHeatmapGeoCache.current[key];

    const params = new URLSearchParams({
      where: '1=1',
      geometryType: 'esriGeometryEnvelope',
      geometry: geom,
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'GEOID,BASENAME',
      returnGeometry: 'true',
      f: 'geojson',
      resultRecordCount: '500',
    });

    try {
      const res = await fetch(`${TIGERWEB_ZCTA_URL}?${params.toString()}`);
      if (!res.ok) throw new Error(`TIGERweb HTTP ${res.status}`);
      const geo = await res.json();
      const features = geo.features || [];
      zipHeatmapGeoCache.current[key] = features;
      console.log(`[Overlay] TIGERweb ZCTA: ${features.length} polygons for bounds`);
      return features;
    } catch (err) {
      console.error('[Overlay] TIGERweb fetch failed', err);
      return [];
    }
  }, []);

  // ─── Render ZIP heat map choropleth ───
  const renderZipHeatmapLayer = useCallback(async () => {
    removeZipHeatmapLayer();
    const data = zipHeatmapDataRef.current;
    if (!data) return;

    const zoom = map.getZoom();
    if (zoom < 7) {
      // Too zoomed out — show a hint
      if (!document.getElementById('zip-heatmap-zoom-hint')) {
        const div = document.createElement('div');
        div.id = 'zip-heatmap-zoom-hint';
        div.style.cssText = 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(0,0,0,0.75);color:white;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:500;pointer-events:none;';
        div.textContent = 'Zoom in to see ZIP heat map (zoom 7+)';
        map.getContainer().appendChild(div);
        setTimeout(() => div.remove(), 3000);
      }
      return;
    }

    setLoadingZipHeatmap(true);
    try {
      const bounds = map.getBounds();
      const features = await fetchZctaBoundaries(bounds);
      if (!features.length) return;

      const geoJson = { type: 'FeatureCollection', features };

      const layer = L.geoJSON(geoJson, {
        style: (feature) => {
          const zip = zeroZip(feature.properties?.GEOID || feature.properties?.BASENAME);
          const z = zip ? data[zip] : null;
          const val = z ? z[zipHeatmapMetric] : null;
          return {
            fillColor: colorForZipHeatmap(val, zipHeatmapMetric),
            fillOpacity: 0.55,
            weight: 1,
            color: '#94a3b8',
            opacity: 0.6,
          };
        },
        onEachFeature: (feature, ly) => {
          const zip = zeroZip(feature.properties?.GEOID || feature.properties?.BASENAME);
          const z = zip ? (data[zip] || { zip }) : { zip: '?' };
          ly.bindPopup(buildZipHeatmapPopup(zip || '?', z, zipHeatmapMetric), {
            maxWidth: 360, className: 'overlay-popup', closeButton: true,
          });
          ly.on('mouseover', function () { this.setStyle({ weight: 2.5, fillOpacity: 0.85 }); });
          ly.on('mouseout', function () { this.setStyle({ weight: 1, fillOpacity: 0.55 }); });
        },
      });

      layer.addTo(map);
      zipHeatmapLayerRef.current = layer;
    } catch (err) {
      console.error('[Overlay] ZIP heat map render error', err);
    } finally {
      setLoadingZipHeatmap(false);
    }
  }, [map, zipHeatmapMetric, removeZipHeatmapLayer, fetchZctaBoundaries]);

  // ─── Render county choropleth ───
  const renderCountyLayer = useCallback(() => {
    removeCountyLayer();
    const data = countyDataRef.current;
    const geo = geoJsonRef.current;
    if (!data || !geo) return;

    const layer = L.geoJSON(geo, {
      style: (feature) => {
        const fips = feature.id || feature.properties?.FIPS;
        const c = data[fips];
        const val = c ? c[countyMetric] : null;
        return {
          fillColor: colorForCounty(val, countyMetric),
          fillOpacity: 0.55,
          weight: 0.5,
          color: '#94a3b8',
          opacity: 0.6,
        };
      },
      onEachFeature: (feature, ly) => {
        const fips = feature.id || feature.properties?.FIPS;
        const c = data[fips];
        if (!c) return;
        ly.bindPopup(buildCountyPopup(c, countyMetric), { maxWidth: 360, className: 'overlay-popup', closeButton: true });
        ly.on('mouseover', function () { this.setStyle({ weight: 2, fillOpacity: 0.85 }); });
        ly.on('mouseout', function () { this.setStyle({ weight: 0.5, fillOpacity: 0.55 }); });
      },
    });

    layer.addTo(map);
    countyLayerRef.current = layer;
  }, [map, countyMetric, removeCountyLayer]);

  // ─── Render ZIP centroid layer ───
  const renderZipLayer = useCallback(() => {
    removeZipLayer();
    const data = zipDataRef.current;
    const pts = zipCentroidsRef.current;
    if (!data || !pts) return;

    const group = L.layerGroup();

    // Only render points in viewport (perf)
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const radius = zoom >= 10 ? 6 : zoom >= 8 ? 5 : zoom >= 6 ? 4 : 3;

    const visible = pts.filter(p => bounds.contains([p.lat, p.lon]));
    // Cap at 4000 to avoid lag
    const capped = visible.slice(0, 4000);

    capped.forEach(p => {
      const z = data[p.zip] || {};
      const val = z[zipMetric];
      const color = colorForZip(val, zipMetric);

      const marker = L.circleMarker([p.lat, p.lon], {
        radius,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 0.5,
        color: '#fff',
        opacity: 0.7,
      });

      marker.bindPopup(buildZipPopup(p.zip, z, zipMetric), { maxWidth: 340, className: 'overlay-popup', closeButton: true });
      group.addLayer(marker);
    });

    group.addTo(map);
    zipLayerRef.current = group;
  }, [map, zipMetric, removeZipLayer]);

  // ─── Redraw zip layer on map move ───
  useEffect(() => {
    if (!zipEnabled || !zipLoaded) return;
    const handler = () => renderZipLayer();
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, zipEnabled, zipLoaded, renderZipLayer]);

  // ─── County layer lifecycle ───
  useEffect(() => {
    if (countyEnabled) {
      if (!countyLoaded && !loadingCounty) loadCountyData();
    } else {
      removeCountyLayer();
    }
  }, [countyEnabled, countyLoaded, loadingCounty, loadCountyData, removeCountyLayer]);

  useEffect(() => {
    if (countyEnabled && countyLoaded) renderCountyLayer();
  }, [countyEnabled, countyLoaded, countyMetric, renderCountyLayer]);

  // ─── ZIP layer lifecycle ───
  useEffect(() => {
    if (zipEnabled) {
      if (!zipLoaded && !loadingZip) loadZipData();
    } else {
      removeZipLayer();
    }
  }, [zipEnabled, zipLoaded, loadingZip, loadZipData, removeZipLayer]);

  useEffect(() => {
    if (zipEnabled && zipLoaded) renderZipLayer();
  }, [zipEnabled, zipLoaded, zipMetric, renderZipLayer]);

  // ─── ZIP Heat Map layer lifecycle ───
  useEffect(() => {
    if (zipHeatmapEnabled) {
      if (!zipHeatmapLoaded && !loadingZipHeatmap) loadZipHeatmapData();
    } else {
      removeZipHeatmapLayer();
    }
  }, [zipHeatmapEnabled, zipHeatmapLoaded, loadingZipHeatmap, loadZipHeatmapData, removeZipHeatmapLayer]);

  useEffect(() => {
    if (zipHeatmapEnabled && zipHeatmapLoaded) renderZipHeatmapLayer();
  }, [zipHeatmapEnabled, zipHeatmapLoaded, zipHeatmapMetric, renderZipHeatmapLayer]);

  // Redraw ZIP heat map on map move
  useEffect(() => {
    if (!zipHeatmapEnabled || !zipHeatmapLoaded) return;
    const handler = () => renderZipHeatmapLayer();
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, zipHeatmapEnabled, zipHeatmapLoaded, renderZipHeatmapLayer]);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => { removeCountyLayer(); removeZipLayer(); removeZipHeatmapLayer(); };
  }, [removeCountyLayer, removeZipLayer, removeZipHeatmapLayer]);

  // Inject popup CSS once
  useEffect(() => {
    const id = 'overlay-popup-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .overlay-popup .leaflet-popup-content-wrapper{background:transparent!important;padding:0!important;border-radius:12px!important;box-shadow:none!important}
      .overlay-popup .leaflet-popup-content{margin:0!important;padding:0!important}
      .overlay-popup .leaflet-popup-tip{background:white!important;border:1px solid #e5e7eb!important}
      .overlay-popup .leaflet-popup-close-button{color:white!important;font-size:18px!important;top:6px!important;right:8px!important}
    `;
    document.head.appendChild(style);
  }, []);

  // Show loading indicator on map
  useEffect(() => {
    const id = 'overlay-loading-ctrl';
    const existing = document.getElementById(id);
    const isLoading = loadingCounty || loadingZip || loadingZipHeatmap;

    if (isLoading && !existing) {
      const div = document.createElement('div');
      div.id = id;
      div.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);z-index:1000;background:white;padding:8px 18px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15);font-size:13px;font-weight:600;color:#3b82f6;display:flex;align-items:center;gap:8px;';
      div.innerHTML = '<span class="overlay-spinner"></span> Loading overlay data...';
      map.getContainer().appendChild(div);

      // Add spinner CSS
      if (!document.getElementById('overlay-spinner-css')) {
        const s = document.createElement('style');
        s.id = 'overlay-spinner-css';
        s.textContent = `
          @keyframes overlay-spin { to { transform: rotate(360deg); } }
          .overlay-spinner { width:16px;height:16px;border:2px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:overlay-spin .6s linear infinite; }
        `;
        document.head.appendChild(s);
      }
    } else if (!isLoading && existing) {
      existing.remove();
    }
  }, [loadingCounty, loadingZip, loadingZipHeatmap, map]);

  return null; // This component renders Leaflet layers directly, no React DOM
}

// ────────────────────────────────────────────────────────
// 7. Exported constants for the control panel
// ────────────────────────────────────────────────────────
export const COUNTY_METRIC_OPTIONS = Object.entries(COUNTY_METRICS).map(([key, def]) => ({
  value: key,
  label: def.name,
}));

export const ZIP_METRIC_OPTIONS = Object.entries(ZIP_METRICS).map(([key, def]) => ({
  value: key,
  label: def.name,
}));

// ZIP Heat Map options — grouped by category
export const ZIP_HEATMAP_METRIC_OPTIONS = Object.entries(ZIP_HEATMAP_METRICS).map(([key, def]) => ({
  value: key,
  label: def.name,
  group: def.group,
}));

// Legend component for the control panel
export function OverlayLegend({ type, metric }) {
  const scale = type === 'county'
    ? (COUNTY_COLOR_SCALES[metric] || [])
    : type === 'zipHeatmap'
      ? (ZIP_HEATMAP_COLOR_SCALES[metric] || [])
      : (ZIP_COLOR_SCALES[metric] || []);
  const metricDef = type === 'county'
    ? COUNTY_METRICS[metric]
    : type === 'zipHeatmap'
      ? ZIP_HEATMAP_METRICS[metric]
      : ZIP_METRICS[metric];
  if (!scale.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '2px' }}>
        {metricDef?.name || metric}
      </div>
      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        {scale.map((s, i) => (
          <div key={i} style={{
            flex: 1,
            height: '8px',
            backgroundColor: s.color,
            borderRadius: i === 0 ? '4px 0 0 4px' : i === scale.length - 1 ? '0 4px 4px 0' : '0',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}
