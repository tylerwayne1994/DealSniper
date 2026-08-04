// Market Data lookup for the Deal Room's "Market Data" section.
//
// Per-user direction: this reuses the real market data CSVs already bundled
// in client/public/ (same files MapTab.jsx / MapOverlayLayers.jsx already
// load client-side) instead of a live FRED/Census API call — no backend
// caching needed, works instantly in the read-only investor view since
// these are static files shipped with the app bundle.
//
// Pulls from a broad slice of the available data sources (real, sourced
// from CoStar/Yardi Matrix/RealPage/BLS/US Census/FEMA/Real Capital
// Analytics/HUD — every row carries its own data_source/source_url/
// as_of_date columns, never fabricated, and a metric simply isn't included
// if the location isn't covered):
//   client/public/zip/{01_rent_growth_yoy, 03_occupancy_rate,
//     09_population_growth, 12_job_growth}_zip.csv   (zip-level, preferred)
//   client/public/city/{02_effective_rent, 04_concessions,
//     08_supply_demand_ratio, 11_income_wage_growth, 14_price_per_unit,
//     17_transaction_volume, 25_composite_market_score}_city.csv
//   client/public/caprates_by_msa_EXPANDED.csv        (MSA-level cap rates)
//   client/public/fmr_by_zip_clean.csv                (HUD Fair Market Rent + county lookup)
//   client/public/county_property_tax_rates.csv       (county-level effective tax rate)
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

// Zip-level metrics (most granular — preferred whenever a zip is available).
const ZIP_METRICS = [
  { file: '/zip/09_population_growth_zip.csv', key: 'populationGrowthYoy', label: 'Population Growth (YoY)', field: 'population_growth_yoy_pct', format: 'pct' },
  { file: '/zip/01_rent_growth_yoy_zip.csv', key: 'rentGrowthYoy', label: 'Rent Growth (YoY)', field: 'rent_growth_yoy_pct', format: 'pct' },
  { file: '/zip/03_occupancy_rate_zip.csv', key: 'occupancyRate', label: 'Occupancy Rate', field: 'occupancy_rate_pct', format: 'pct' },
  { file: '/zip/12_job_growth_zip.csv', key: 'jobGrowthYoy', label: 'Job Growth (YoY)', field: 'job_growth_yoy_pct', format: 'pct' },
];

// City-level metrics — much richer column set than the zip files, used to
// round out the picture (rents, concessions, supply/demand, incomes,
// pricing, transaction activity, and an overall composite score).
const CITY_METRICS = [
  { file: '/city/02_effective_rent_city.csv', key: 'effectiveRentPerUnit', label: 'Effective Rent / Unit', field: 'effective_rent_per_unit', format: 'money' },
  { file: '/city/04_concessions_city.csv', key: 'concessionRate', label: 'Concession Rate', field: 'concession_rate_pct', format: 'pct' },
  { file: '/city/08_supply_demand_ratio_city.csv', key: 'supplyDemandRatio', label: 'Supply/Demand Ratio', field: 'supply_demand_ratio', format: 'number' },
  { file: '/city/11_income_wage_growth_city.csv', key: 'medianHouseholdIncome', label: 'Median Household Income', field: 'median_household_income', format: 'money' },
  { file: '/city/11_income_wage_growth_city.csv', key: 'rentToIncomeRatio', label: 'Rent-to-Income Ratio', field: 'rent_to_income_ratio_pct', format: 'pct' },
  { file: '/city/14_price_per_unit_city.csv', key: 'pricePerUnit', label: 'Market Price / Unit', field: 'price_per_unit', format: 'money' },
  { file: '/city/17_transaction_volume_city.csv', key: 'capRateTrailing', label: 'Trailing Cap Rate', field: 'cap_rate_trailing_pct', format: 'pct' },
  { file: '/city/25_composite_market_score_city.csv', key: 'compositeMarketScore', label: 'Composite Market Score', field: 'composite_mf_score_100', format: 'number' },
];

function matchZipRow(rows, zip) {
  if (!zip) return null;
  // PapaParse's dynamicTyping strips leading zeros from numeric-looking zip
  // codes (e.g. "06510" -> 6510) — pad both sides back to 5 digits so
  // New England/Puerto Rico zips still match correctly.
  const z = String(zip).trim().padStart(5, '0');
  return rows.find((r) => String(r.zip_code ?? r.zip ?? '').trim().padStart(5, '0') === z) || null;
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

  // HUD Fair Market Rent (2BR benchmark) — also doubles as a zip->county
  // resolver so we can look up the county-level effective property tax
  // rate below without needing the user to supply a county name directly.
  if (zip) {
    const fmrRows = await loadCSV('/fmr_by_zip_clean.csv');
    const z = String(zip).trim().padStart(5, '0');
    const fmrRow = fmrRows.find((r) => String(r.zip || '').trim().padStart(5, '0') === z);
    if (fmrRow) {
      if (fmrRow.fmr_2br) {
        metrics.push({
          key: 'fmr2br', label: 'HUD Fair Market Rent (2BR)', value: fmrRow.fmr_2br, format: 'money',
          dataSource: 'HUD Fair Market Rents', asOfDate: null, sourceUrl: null,
        });
      }
      const countyName = fmrRow.county_name;
      if (countyName) {
        const taxRows = await loadCSV('/county_property_tax_rates.csv');
        const countyTarget = String(countyName).trim().toLowerCase();
        const taxRow = taxRows.find((r) => String(r.county || '').trim().toLowerCase() === countyTarget);
        if (taxRow && taxRow.effective_tax_rate_pct) {
          const pct = parseFloat(String(taxRow.effective_tax_rate_pct).replace('%', ''));
          if (!Number.isNaN(pct)) {
            metrics.push({
              key: 'countyPropertyTaxRate', label: 'County Effective Property Tax Rate', value: pct, format: 'pct',
              dataSource: 'Tax Foundation / County Assessor Data', asOfDate: null, sourceUrl: null,
            });
          }
        }
      }
    }
  }

  return metrics;
}
