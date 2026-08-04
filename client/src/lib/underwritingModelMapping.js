// Maps a deal's real parsed data (v2_underwriter schema — see
// backend/v2_underwriter/routes.py's schema_block) onto the known cell
// addresses of the CRE Underwriting spreadsheet's default "Inputs" sheet
// (see public/spreadsheet/cre-underwriting.js's buildTemplate()). Never
// fabricates a value — a field is simply left at the template's own
// sensible default when the deal doesn't have that data.
//
// Percent-like fields in the parser output are stored as human percentages
// (5.5 meaning 5.5%), but the spreadsheet's "pct"-formatted cells store raw
// 0-1 decimals — pctToDecimal() normalizes defensively either way.

function pctToDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.abs(n) > 1 ? n / 100 : n;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const PROPERTY_TYPE_OPTIONS = ['Multifamily', 'Retail', 'Industrial', 'Office', 'Self-Storage', 'Mixed-Use'];
function normalizePropertyType(raw) {
  if (!raw) return null;
  const match = PROPERTY_TYPE_OPTIONS.find((t) => t.toLowerCase() === String(raw).trim().toLowerCase());
  return match || null;
}

/**
 * @param {Object} scenarioData The deal's parsed_data/scenario_data (v2 schema)
 * @param {Object} [deal] Optional loadDeal() result, for preferredReturnPct/gpPromotePct
 * @returns {Array<{a1: string, value: (string|number)}>} Only cells with a real value to set.
 */
export function mapScenarioDataToInputs(scenarioData, deal) {
  const sc = scenarioData || {};
  const property = sc.property || {};
  const pf = sc.pricing_financing || {};
  const pnl = sc.pnl || {};
  const expenses = sc.expenses || {};
  const underwriting = sc.underwriting || {};
  const unitMix = Array.isArray(sc.unit_mix) ? sc.unit_mix : [];

  const cells = [];
  const put = (a1, value) => { if (value !== null && value !== undefined && value !== '') cells.push({ a1, value }); };

  // ---- Deal ----
  put('B4', property.address || deal?.address || null);
  put('B5', normalizePropertyType(property.property_type));
  put('B7', num(property.units));
  put('B8', num(property.rba_sqft));
  put('B9', num(pf.price));

  // ---- Income (Year 1) ----
  // Prefer a real weighted average from unit_mix; fall back to gross potential rent / units / 12.
  const unitsWithRent = unitMix.filter((u) => num(u.rent_current) != null && num(u.units) != null && u.units > 0);
  if (unitsWithRent.length > 0) {
    const totalUnits = unitsWithRent.reduce((s, u) => s + Number(u.units), 0);
    const weightedRent = unitsWithRent.reduce((s, u) => s + Number(u.units) * Number(u.rent_current), 0);
    if (totalUnits > 0) put('B14', Math.round(weightedRent / totalUnits));
  } else if (num(pnl.gross_potential_rent) != null && num(property.units) > 0) {
    put('B14', Math.round(pnl.gross_potential_rent / property.units / 12));
  }
  put('B16', num(pnl.other_income));
  const vacancyPct = pctToDecimal(pnl.vacancy_rate ?? pnl.vacancy_rate_current ?? pnl.vacancy_rate_t12);
  put('B17', vacancyPct);

  // ---- Operating expenses (Year 1) — maps the parser's 9 named buckets onto
  // the template's 10 labeled rows where there's a clear direct match; rows
  // without an equivalent parser field (Turnover, Landscaping/Grounds) are
  // left at the template's own default, not fabricated. ----
  put('B22', num(expenses.taxes));                 // Property Taxes
  put('B23', num(expenses.insurance));              // Insurance
  put('B24', num(expenses.utilities));              // Utilities
  put('B25', num(expenses.repairs_maintenance));    // Repairs & Maintenance
  put('B26', num(expenses.payroll));                // Payroll
  put('B27', num(expenses.admin));                  // Administrative
  put('B30', num(expenses.marketing));              // Marketing
  put('B31', num(expenses.other));                  // Legal & Professional (closest catch-all slot)

  // Management fee: parser gives a dollar figure, template wants % of EGI.
  const egi = num(pnl.effective_gross_income);
  const mgmtDollars = num(expenses.management);
  if (mgmtDollars != null && egi) put('B32', mgmtDollars / egi);

  // ---- Growth rates ----
  const rentGrowth = pctToDecimal(underwriting.income_growth_rate);
  if (rentGrowth != null) put('B36', rentGrowth);

  // ---- Financing ----
  const loanAmount = num(pf.loan_amount);
  if (loanAmount) put('B42', loanAmount); // manual override (0 = auto-size, template default)
  const ltv = pctToDecimal(pf.ltv);
  if (ltv != null) put('B43', ltv);
  const rate = pctToDecimal(pf.interest_rate);
  if (rate != null) put('B46', rate);
  put('B47', num(pf.amortization_years));

  // ---- Hold & Exit ----
  const hold = num(underwriting.holding_period);
  if (hold && hold >= 1 && hold <= 10) put('B52', hold);
  const exitCap = pctToDecimal(underwriting.exit_cap_rate);
  if (exitCap != null) put('B53', exitCap);

  // ---- Equity structure (deal-level terms, saved on push-to-pipeline) ----
  const prefReturn = pctToDecimal(deal?.preferredReturnPct);
  if (prefReturn != null) put('B58', prefReturn);
  const gpPromote = pctToDecimal(deal?.gpPromotePct);
  if (gpPromote != null) put('B59', 1 - gpPromote); // LP residual split = 1 - GP promote

  return cells;
}

// ---------------------------------------------------------------------------
// Heuristic population for a SPONSOR-UPLOADED custom template. Unlike the
// stock template above (known, fixed cell addresses), an arbitrary uploaded
// workbook has no known layout — this scans column A of every sheet for a
// label that matches one of the synonyms below, and if found, writes the
// deal's real value into the cell directly to its right (column B), the
// near-universal "label in A, value in B" convention this app's own stock
// template also uses. Best-effort by nature: skips a match if the target
// cell already holds a formula (never overwrites computed cells), and never
// fabricates a value for a label it can't confidently match.
// ---------------------------------------------------------------------------

function colLetterToIndex(letter) {
  let n = 0;
  for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
  return n - 1; // 0-indexed
}
function indexToColLetter(idx) {
  let n = idx + 1, s = '';
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function parseA1(a1) {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m) return null;
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2], 10) };
}

function buildFieldSynonyms(scenarioData, deal) {
  const sc = scenarioData || {};
  const property = sc.property || {};
  const pf = sc.pricing_financing || {};
  const pnl = sc.pnl || {};
  const expenses = sc.expenses || {};
  const underwriting = sc.underwriting || {};

  return [
    { synonyms: ['purchase price', 'acquisition price', 'sale price'], value: num(pf.price) },
    { synonyms: ['units', 'unit count', '# units', 'number of units'], value: num(property.units) },
    { synonyms: ['rentable sf', 'rentable square', 'square feet', 'rsf', 'net rentable area'], value: num(property.rba_sqft) },
    { synonyms: ['vacancy'], value: pctToDecimal(pnl.vacancy_rate ?? pnl.vacancy_rate_current) },
    { synonyms: ['other income'], value: num(pnl.other_income) },
    { synonyms: ['exit cap rate', 'exit cap', 'reversion cap rate', 'terminal cap rate'], value: pctToDecimal(underwriting.exit_cap_rate) },
    { synonyms: ['hold period', 'holding period', 'hold years'], value: num(underwriting.holding_period) },
    { synonyms: ['interest rate'], value: pctToDecimal(pf.interest_rate) },
    { synonyms: ['loan to value', 'ltv'], value: pctToDecimal(pf.ltv) },
    { synonyms: ['amortization'], value: num(pf.amortization_years) },
    { synonyms: ['loan amount'], value: num(pf.loan_amount) },
    { synonyms: ['property tax', 'real estate tax'], value: num(expenses.taxes) },
    { synonyms: ['insurance'], value: num(expenses.insurance) },
    { synonyms: ['utilities'], value: num(expenses.utilities) },
    { synonyms: ['repairs & maintenance', 'repairs and maintenance', 'r&m'], value: num(expenses.repairs_maintenance) },
    { synonyms: ['payroll'], value: num(expenses.payroll) },
    { synonyms: ['marketing'], value: num(expenses.marketing) },
    { synonyms: ['administrative', 'admin expense'], value: num(expenses.admin) },
    { synonyms: ['preferred return', 'pref return', 'lp preferred return'], value: pctToDecimal(deal?.preferredReturnPct) },
  ].filter((f) => f.value !== null && f.value !== undefined);
}

/**
 * @param {Object} app The live CREUnderwriting App instance (window.CREUnderwriting.init() result)
 * @param {Object} scenarioData
 * @param {Object} [deal]
 * @returns {number} Count of fields successfully matched and written.
 */
export function heuristicPopulateFromLabels(app, scenarioData, deal) {
  if (!app?.wb) return 0;
  const fields = buildFieldSynonyms(scenarioData, deal);
  if (fields.length === 0) return 0;
  let matched = 0;

  app.wb.order.forEach((sheetName) => {
    const sheet = app.wb.sheets[sheetName];
    if (!sheet) return;
    Object.keys(sheet.cells).forEach((a1) => {
      const pos = parseA1(a1);
      if (!pos || pos.col !== 0) return; // only scan column A for labels
      const cell = sheet.cells[a1];
      const label = (cell.v !== undefined && cell.v !== null) ? String(cell.v).trim().toLowerCase() : '';
      if (!label) return;

      const field = fields.find((f) => f.synonyms.some((syn) => label.includes(syn)));
      if (!field) return;

      const targetA1 = indexToColLetter(1) + pos.row; // column B, same row
      const targetCell = sheet.cells[targetA1];
      if (targetCell && targetCell.f) return; // never overwrite a formula cell

      const existing = targetCell || {};
      app.wb.setCell(sheetName, targetA1, { v: field.value, fmt: existing.fmt, style: existing.style });
      matched++;
    });
  });

  if (matched > 0) app.renderGrid();
  return matched;
}
