/**
 * countyTaxLookup.js — load county_property_tax_rates.csv and provide
 * lookup by (state, county) → effective tax rate.
 *
 * The CSV lives in client/public/county_property_tax_rates.csv and has columns:
 *   state_fips, county_fips, fips, state, county,
 *   median_home_value, median_taxes_paid, agg_home_value, agg_taxes_paid,
 *   effective_tax_rate, effective_tax_rate_agg, effective_tax_rate_pct
 *
 * effective_tax_rate is a decimal (e.g. 0.00285 = 0.285%)
 * effective_tax_rate_pct is a string like "0.2850%"
 */

let _cache = null;      // Map<string, object>   key = "state|county" lowered
let _allCounties = null; // Array for dropdown search

/**
 * Load & parse the CSV.  Returns a Map keyed by "state|county" (lower-cased)
 * whose values are { state, county, fips, medianHomeValue, medianTaxesPaid,
 *   effectiveTaxRate (decimal), effectiveTaxRatePct (string) }.
 */
export async function loadCountyTaxData() {
  if (_cache) return _cache;

  try {
    const res = await fetch('/county_property_tax_rates.csv');
    const text = await res.text();
    const lines = text.split('\n');
    const map = new Map();
    const list = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length < 12) continue;

      const state = cols[3]?.trim() || '';
      const county = cols[4]?.trim() || '';
      const medianHomeValue = parseFloat(cols[5]) || 0;
      const medianTaxesPaid = parseFloat(cols[6]) || 0;
      const effectiveTaxRate = parseFloat(cols[9]) || 0; // decimal e.g. 0.00285
      const effectiveTaxRatePct = cols[11]?.trim() || '';  // e.g. "0.2850%"
      const fips = cols[2]?.trim() || '';

      if (!state || !county) continue;

      const entry = {
        state,
        county,
        fips,
        medianHomeValue,
        medianTaxesPaid,
        effectiveTaxRate,            // decimal
        effectiveTaxRatePct,         // "0.285%"
        taxRatePercent: effectiveTaxRate * 100,  // 0.285
        fullName: `${county}, ${state}`,
      };

      const key = `${state.toLowerCase()}|${county.toLowerCase()}`;
      map.set(key, entry);
      list.push(entry);
    }

    _cache = map;
    _allCounties = list;
    return map;
  } catch (err) {
    console.error('[CountyTax] Failed to load CSV:', err);
    _cache = new Map();
    _allCounties = [];
    return _cache;
  }
}

/**
 * Get the full county list (for dropdown searches).
 */
export async function getAllCounties() {
  if (!_allCounties) await loadCountyTaxData();
  return _allCounties;
}

/**
 * Lookup by exact state + county strings.
 * @returns {object|null}  { state, county, effectiveTaxRate, taxRatePercent, ... }
 */
export function lookupCountyTax(state, county) {
  if (!_cache) return null;
  if (!state || !county) return null;
  const key = `${state.trim().toLowerCase()}|${county.trim().toLowerCase()}`;
  return _cache.get(key) || null;
}

/**
 * Auto-detect county from scenarioData and return the tax entry (or null).
 * Checks scenarioData.property_county first, then scenarioData.property.state
 * combined with any county-like field.
 */
export function lookupFromScenario(scenarioData) {
  if (!_cache || !scenarioData) return null;

  // 1. Highest priority: explicit property_county selection
  const pc = scenarioData.property_county;
  if (pc?.state && pc?.county) {
    const found = lookupCountyTax(pc.state, pc.county);
    if (found) return found;
  }

  // 2. Fallback: scenarioData.property.state + scenarioData.property.county
  const prop = scenarioData.property || {};
  if (prop.state && prop.county) {
    const found = lookupCountyTax(prop.state, prop.county);
    if (found) return found;
  }

  return null;
}

/**
 * Compute property tax comparison given a county entry + purchase price + current taxes.
 * Returns { countyName, countyRate, currentTax, reassessedTax, delta, deltaPct,
 *           currentRateOnPrice, medianTax, medianHomeValue }
 */
export function computeTaxComparison(countyEntry, purchasePrice, currentTaxes) {
  if (!countyEntry || !purchasePrice) return null;

  const countyRate = countyEntry.effectiveTaxRate;        // decimal, e.g. 0.00285
  const reassessedTax = Math.round(purchasePrice * countyRate);
  const currentTax = Math.round(currentTaxes || 0);
  const delta = reassessedTax - currentTax;
  const deltaPct = currentTax > 0 ? ((delta / currentTax) * 100) : 0;
  const currentRateOnPrice = purchasePrice > 0 && currentTax > 0
    ? (currentTax / purchasePrice)
    : 0;

  return {
    countyName: countyEntry.fullName,
    countyState: countyEntry.state,
    county: countyEntry.county,
    countyRate,                          // decimal
    countyRatePct: countyRate * 100,     // e.g. 0.285
    currentTax,
    reassessedTax,
    delta,
    deltaPct,
    currentRateOnPrice,                  // decimal
    currentRatePctOnPrice: currentRateOnPrice * 100,
    medianTax: countyEntry.medianTaxesPaid,
    medianHomeValue: countyEntry.medianHomeValue,
  };
}
