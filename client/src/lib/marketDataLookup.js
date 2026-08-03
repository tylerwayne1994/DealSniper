// Market Data lookup for the Deal Room's "Market Data" section.
//
// Per-user direction: this reuses the real market data CSVs already bundled
// in client/public/ (same files MapTab.jsx / MapOverlayLayers.jsx already
// load client-side) instead of a live FRED/Census API call — no backend
// caching needed, works instantly in the read-only investor view since
// these are static files shipped with the app bundle.
//
// Sources (all real, sourced from CoStar/Yardi Matrix/BLS/US Census — see
// each row's own data_source/source_url columns, never fabricated):
//   client/public/zip/09_population_growth_zip.csv
//   client/public/zip/01_rent_growth_yoy_zip.csv
//   client/public/zip/03_occupancy_rate_zip.csv
//   client/public/zip/12_job_growth_zip.csv
//   client/public/city/25_composite_market_score_city.csv  (city-level only)
//   client/public/caprates_by_msa_EXPANDED.csv              (MSA-level only)
import Papa from 'papaparse';

const csvCache = new Map();

function loadCSV(path) {
  if (csvCache.has(path)) return csvCache.get(path);
  const promise = new Promise((resolve) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data || []),
      error: () => resolve([]),
    });
  });
  csvCache.set(path, promise);
  return promise;
}

const ZIP_METRICS = [
  { file: '/zip/09_population_growth_zip.csv', key: 'populationGrowthYoy', label: 'Population Growth (YoY)', field: 'population_growth_yoy_pct', format: 'pct' },
  { file: '/zip/01_rent_growth_yoy_zip.csv', key: 'rentGrowthYoy', label: 'Rent Growth (YoY)', field: 'rent_growth_yoy_pct', format: 'pct' },
  { file: '/zip/03_occupancy_rate_zip.csv', key: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancy_rate_pct', format: 'pct' },
  { file: '/zip/12_job_growth_zip.csv', key: 'jobGrowthYoy', label: 'Job Growth (YoY)', field: 'job_growth_yoy_pct', format: 'pct' },
];

const CITY_METRICS = [
  { file: '/city/25_composite_market_score_city.csv', key: 'compositeMarketScore', label: 'Composite Market Score', field: 'composite_mf_score_100', format: 'number' },
];

function matchZipRow(rows, zip) {
  if (!zip) return null;
  const z = String(zip).trim();
  return rows.find((r) => String(r.zip_code || '').trim() === z) || null;
}

function matchCityRow(rows, city) {
  if (!city) return null;
  const c = String(city).trim().toLowerCase();
  return rows.find((r) => String(r.city || '').trim().toLowerCase() === c) || null;
}

function matchMsaRow(rows, city, state) {
  if (!city || !state) return null;
  const target = `${city}, ${state}`.trim().toLowerCase();
  return rows.find((r) => String(r.MSA || '').trim().toLowerCase() === target) || null;
}

/**
 * Look up real market metrics for a deal's location from the static CSVs
 * already bundled in client/public/. Returns only metrics that actually
 * matched a row — never fabricates a value for a location not covered by
 * the data. Safe to call from the read-only investor view (no auth, no
 * backend round-trip, no LLM).
 *
 * @param {{city?: string, state?: string, zip?: string}} location
 * @returns {Promise<Array<{key, label, value, format, dataSource, asOfDate, sourceUrl}>>}
 */
export async function loadMarketDataForLocation({ city, state, zip } = {}) {
  const metrics = [];

  if (zip) {
    for (const m of ZIP_METRICS) {
      const rows = await loadCSV(m.file);
      const row = matchZipRow(rows, zip);
      if (row && row[m.field] !== undefined && row[m.field] !== null && row[m.field] !== '') {
        metrics.push({
          key: m.key,
          label: m.label,
          value: row[m.field],
          format: m.format,
          dataSource: row.data_source || null,
          asOfDate: row.as_of_date || null,
          sourceUrl: row.source_url || null,
        });
      }
    }
  }

  if (city) {
    for (const m of CITY_METRICS) {
      const rows = await loadCSV(m.file);
      const row = matchCityRow(rows, city);
      if (row && row[m.field] !== undefined && row[m.field] !== null && row[m.field] !== '') {
        metrics.push({
          key: m.key,
          label: m.label,
          value: row[m.field],
          format: m.format,
          dataSource: row.data_source || null,
          asOfDate: row.as_of_date || null,
          sourceUrl: row.source_url || null,
        });
      }
    }
  }

  if (city && state) {
    const rows = await loadCSV('/caprates_by_msa_EXPANDED.csv');
    const row = matchMsaRow(rows, city, state);
    if (row) {
      if (row.CapRate_Overall_Market) {
        metrics.push({
          key: 'msaCapRate', label: 'MSA Cap Rate (Overall)', value: row.CapRate_Overall_Market, format: 'pct',
          dataSource: row.CapRate_Data_Source || null, asOfDate: null, sourceUrl: null,
        });
      }
      if (row.CapRate_Trend) {
        metrics.push({
          key: 'msaCapRateTrend', label: 'Cap Rate Trend', value: row.CapRate_Trend, format: 'text',
          dataSource: row.CapRate_Data_Source || null, asOfDate: null, sourceUrl: null,
        });
      }
      if (row.Investor_Demand) {
        metrics.push({
          key: 'msaInvestorDemand', label: 'Investor Demand', value: row.Investor_Demand, format: 'text',
          dataSource: row.CapRate_Data_Source || null, asOfDate: null, sourceUrl: null,
        });
      }
    }
  }

  return metrics;
}
