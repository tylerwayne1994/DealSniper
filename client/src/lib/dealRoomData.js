/**
 * Deal Room data contract.
 *
 * @typedef {Object} DealRoomTableRow
 * @property {string} label
 * @property {number|string|null} value
 *
 * @typedef {Object} DealRoomTable
 * @property {string} title
 * @property {DealRoomTableRow[]} rows
 *
 * @typedef {Object} DealRoomOption           Investor participation option (real allocation or deal-level terms)
 * @property {string} name
 * @property {DealRoomTableRow[]} terms
 * @property {DealRoomTableRow[]} returns
 *
 * @typedef {Object} DealRoomRisk
 * @property {string} risk
 * @property {string} description
 * @property {string} mitigation
 *
 * @typedef {Object} DealRoomData
 * @property {Object} meta               { dealId, generatedAt, preparerName, preparerEmail, preparerPhone }
 * @property {Object} property           { name, address, assetDescriptor, images:[{url,caption}] }
 * @property {DealRoomTableRow[]} snapshotStats     Stat bar under the hero
 * @property {string[]} executiveSummary            Paragraphs (templated from real numbers, not invented)
 * @property {DealRoomTable[]} financialOverview     Acquisition costs + operating summary tables
 * @property {DealRoomOption[]} investorOptions      Real allocations if present, else deal-level terms
 * @property {{title:string, bullets:string[]}[]} operationalPlan
 * @property {Object[]} projections                 Year-by-year rows (from calculateFullAnalysis)
 * @property {DealRoomTable|null} exitAnalysis
 * @property {DealRoomRisk[]} risks
 * @property {Object[]} distributions               Real distribution history, if any
 * @property {Object} footer             { preparer, confidentiality, disclaimer, contact }
 */

const fmt$ = (v) => (v == null || Number.isNaN(Number(v))) ? null : Math.round(Number(v));
const fmtPctDecimal = (v) => (v == null || Number.isNaN(Number(v))) ? null : Number(v) / 100;

/**
 * Claude is instructed to wrap the Business Plan in a single
 * ```artifact:document:<title>``` fence, but doesn't always follow that —
 * sometimes it wraps the whole response in a plain/generic ``` fence
 * instead (no tag), and/or appends a trailing sentence after the closing
 * fence (e.g. "Let me know if you'd like any changes!"). That trailing
 * text broke a naive "does the string end with ```" check, so the fence
 * never got stripped and the whole document rendered as one literal code
 * block. This scans for the LAST line that is just a bare ``` fence
 * (ignoring anything after it) instead of requiring the string to end
 * exactly on the fence, so it's resilient to trailing commentary. This is
 * a client-side safety net so (a) it doesn't matter whether the backend
 * fix has finished deploying yet, and (b) any plan that was already saved
 * to Supabase with the raw fence still attached renders correctly too,
 * without needing to be regenerated. Exported so DealRoomPage.jsx can
 * apply the same cleanup to the PDF snapshot render.
 */
export function stripWrappingCodeFence(text) {
  let t = (text || '').trim();
  for (let pass = 0; pass < 2; pass++) {
    if (!t.startsWith('```')) break;
    const lines = t.split('\n');
    let closeIdx = -1;
    for (let i = lines.length - 1; i >= 1; i--) {
      if (/^```\s*$/.test(lines[i])) { closeIdx = i; break; }
    }
    if (closeIdx === -1) {
      // No proper closing fence line found anywhere in the text -- most
      // likely the response got truncated (hit max_tokens) before Claude
      // ever reached the closing fence. Still strip the opening fence line
      // so the rest of the document renders as real markdown instead of
      // being swallowed into one giant literal code block for its entire
      // length.
      t = lines.slice(1).join('\n').trim();
      break;
    }
    t = lines.slice(1, closeIdx).join('\n').trim();
  }
  return t;
}

/**
 * Build the Deal Room data object from real, already-computed sources.
 * Nothing here invents a value — every field is either a direct pass-through
 * of `deal`/`full`/`metrics`/`allocations`/`distributions`, or a template
 * string built only from those real numbers. Sections are omitted entirely
 * (not shown with "N/A") when the underlying data isn't available.
 *
 * @param {Object} params
 * @param {Object} params.deal        Result of dealsService.loadDeal()
 * @param {Object} params.full        Result of calculateFullAnalysis(scenarioData)
 * @param {Object} params.metrics     DealRoomPage's getMetrics() output
 * @param {Array}  [params.allocations]   Real per-investor allocations for this deal
 * @param {Array}  [params.distributions] Real distribution history for this deal
 * @param {Object} [params.images]    Normalized images array [{url, caption}]
 * @param {Object} [params.narrative] Optional AI-generated { whyMarket, whyAsset, upsidePlays, operationalPlan } — see dealRoomNarrativeService.js. Grounded in real market/strategy data; simply absent if not yet generated.
 * @returns {DealRoomData}
 */
export function buildDealRoomData({ deal, full, metrics, allocations = [], distributions = [], images = [], narrative = null }) {
  const sc = deal?.scenarioData || deal?.parsedData || {};
  const property = sc.property || {};
  const propertyName = property.property_name || deal?.address || 'Untitled Property';
  const assetDescriptor = [
    metrics?.units ? `${metrics.units}-Unit` : null,
    property.property_type || 'Multifamily',
    'Investment',
  ].filter(Boolean).join(' ');

  // ---- Deal timeline (real stage/date data only — no fabricated milestones) --
  const STAGE_ORDER = ['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed'];
  const STAGE_LABELS = {
    sourced: 'Sourced', underwritten: 'Underwritten', loi: 'LOI Sent',
    contract: 'Under Contract', financing: 'Financing Secured', closed: 'Closed',
  };
  const currentStage = deal?.dealStage || 'underwritten';
  const isDead = currentStage === 'dead';
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const timeline = {
    isDead,
    deathReason: isDead ? deal?.deathReason : null,
    sourcedAt: deal?.createdAt || null,
    currentStageSince: deal?.stageChangedAt || null,
    projectedHoldYears: full?.returns?.holdingPeriod || null,
    steps: isDead ? [] : STAGE_ORDER.map((key, i) => ({
      key,
      label: STAGE_LABELS[key],
      status: i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending',
    })),
  };

  // ---- Snapshot stat bar --------------------------------------------------
  const snapshotStats = [
    { label: 'Units', value: metrics?.units || null },
    { label: 'Year Built', value: metrics?.yearBuilt || null },
    { label: 'Total SF', value: metrics?.sqft || null },
    { label: 'Occupancy', value: metrics?.units ? null : null }, // filled below if available
    { label: 'Purchase Price', value: fmt$(metrics?.price) },
    { label: 'Price / Unit', value: fmt$(metrics?.pricePerUnit) },
    { label: 'In-Place Cap Rate', value: metrics?.capRate != null ? fmtPctDecimal(metrics.capRate) : null },
    { label: 'Hold Period (Yrs)', value: full?.returns?.holdingPeriod || null },
  ].filter((row) => row.value !== null && row.value !== undefined);

  // ---- Executive summary (templated from real numbers only) --------------
  const executiveSummary = [];
  if (metrics?.price && metrics?.units) {
    executiveSummary.push(
      `${propertyName} is a ${assetDescriptor.toLowerCase()} located at ${deal?.address || 'the subject address'}, ` +
      `offered at ${fmt$(metrics.price).toLocaleString()} ($${Math.round(metrics.pricePerUnit || 0).toLocaleString()}/unit).`
    );
  }
  if (metrics?.capRate != null && metrics?.annualNOI) {
    executiveSummary.push(
      `The property produces ${Math.round(metrics.annualNOI).toLocaleString()} in current net operating income, ` +
      `reflecting a ${metrics.capRate.toFixed(2)}% in-place cap rate.`
    );
  }
  if (full?.returns?.leveredIRR != null && full?.returns?.leveredEquityMultiple != null) {
    executiveSummary.push(
      `Underwritten over a ${full.returns.holdingPeriod || ''}-year hold, the deal projects a ` +
      `${(full.returns.leveredIRR * 100).toFixed(1)}% levered IRR and a ${full.returns.leveredEquityMultiple.toFixed(2)}x equity multiple.`
    );
  }

  // ---- Financial overview tables ------------------------------------------
  const financialOverview = [];
  if (full?.acquisition) {
    financialOverview.push({
      title: 'Acquisition Costs',
      rows: [
        { label: 'Purchase Price', value: full.acquisition.purchasePrice },
        { label: 'Closing Costs', value: full.acquisition.closingCosts },
        { label: 'Upfront CapEx', value: full.acquisition.upfrontCapEx },
        { label: 'Total Acquisition Cost', value: full.acquisition.totalAcquisitionCosts },
        { label: 'Loan Amount', value: full.financing?.loanAmount },
        { label: 'Total Equity Required', value: full.financing?.totalEquityRequired },
        { label: 'Interest Rate', value: full.financing?.interestRate != null ? full.financing.interestRate / 100 : null, isPct: true },
        { label: 'Annual Debt Service', value: full.financing?.annualDebtService },
      ].filter((r) => r.value !== null && r.value !== undefined),
    });
  }
  if (full?.year1) {
    financialOverview.push({
      title: 'Stabilized Annual Operating Summary',
      rows: [
        { label: 'Gross Potential Income', value: full.year1.potentialGrossIncome },
        { label: 'Vacancy Loss', value: -Math.abs(full.year1.vacancyLoss || 0) },
        { label: 'Other Income', value: full.year1.otherIncome },
        { label: 'Effective Gross Income', value: full.year1.effectiveGrossIncome, bold: true },
        { label: 'Operating Expenses', value: -Math.abs(full.year1.totalOperatingExpenses || 0) },
        { label: 'Net Operating Income', value: full.year1.noi, bold: true },
        { label: 'Annual Debt Service', value: -Math.abs(full.year1.debtService || 0) },
        { label: 'Cash Flow After Financing', value: full.year1.cashFlowAfterFinancing, bold: true },
      ],
    });
  }

  // ---- Investor participation options ------------------------------------
  /** @type {DealRoomOption[]} */
  const investorOptions = [];
  if (Array.isArray(allocations) && allocations.length > 0) {
    allocations.forEach((a) => {
      const inv = a.investors || {};
      const name = [inv.first_name, inv.last_name].filter(Boolean).join(' ') || inv.email || 'Investor';
      investorOptions.push({
        name,
        terms: [
          { label: 'Commitment', value: Number(a.commitment_amount) || 0 },
          { label: 'Contributed', value: Number(a.contributed_amount) || 0 },
          { label: 'Ownership %', value: (Number(a.ownership_pct) || 0) / 100, isPct: true },
          { label: 'Preferred Return', value: (Number(a.preferred_return_pct) || 0) / 100, isPct: true },
        ],
        returns: [],
      });
    });
  } else if (deal?.preferredReturnPct != null || deal?.gpPromotePct != null) {
    investorOptions.push({
      name: 'Proposed Terms',
      terms: [
        { label: 'Preferred Return', value: (Number(deal.preferredReturnPct) || 8) / 100, isPct: true },
        { label: 'GP Promote', value: (Number(deal.gpPromotePct) || 20) / 100, isPct: true },
        { label: 'Total Equity Required', value: full?.financing?.totalEquityRequired || null },
      ].filter((r) => r.value !== null && r.value !== undefined),
      returns: full?.returns ? [
        { label: 'Levered IRR', value: full.returns.leveredIRR, isPct: true },
        { label: 'Equity Multiple', value: full.returns.leveredEquityMultiple, isMultiple: true },
        { label: 'Avg Cash-on-Cash', value: (full.returns.avgCashOnCash || 0) / 100, isPct: true },
      ] : [],
    });
  }

  // ---- 5-year projections --------------------------------------------------
  const projections = Array.isArray(full?.projections) ? full.projections.map((p) => ({
    year: p.year,
    noi: p.noi,
    debtService: p.debtService ?? p.annualDebtService ?? null,
    cashFlow: p.cashFlowAfterFinancing ?? p.cashFlowFromOps ?? null,
    dscr: p.dscr,
  })) : [];

  const exitAnalysis = full?.exit ? {
    title: `Year ${full.returns?.holdingPeriod || projections.length} Exit Analysis`,
    rows: [
      { label: 'Gross Sales Price', value: full.exit.grossSalesPrice },
      { label: 'Selling Costs', value: full.exit.sellingCosts != null ? -Math.abs(full.exit.sellingCosts) : null },
      { label: 'Net Sale Proceeds', value: full.exit.netSalesProceeds },
      { label: 'Loan Payoff', value: full.exit.loanPayoff != null ? -Math.abs(full.exit.loanPayoff) : null },
      { label: 'Net Reversion Cash Flow', value: full.exit.reversionCashFlow, bold: true },
    ].filter((r) => r.value !== null && r.value !== undefined),
  } : null;

  // ---- Operational plan (only if value-add data present, or AI-generated) --
  const operationalPlan = [];
  const valueAdd = sc.value_add || sc.valueAdd;
  if (valueAdd && typeof valueAdd === 'object') {
    Object.entries(valueAdd).forEach(([key, val]) => {
      if (Array.isArray(val) && val.length) {
        operationalPlan.push({ title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), bullets: val.map(String) });
      } else if (typeof val === 'string' && val.trim()) {
        operationalPlan.push({ title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), bullets: [val] });
      }
    });
  }
  if (Array.isArray(narrative?.operationalPlan)) {
    narrative.operationalPlan.forEach((block) => {
      if (block?.title && Array.isArray(block.bullets) && block.bullets.length) {
        operationalPlan.push(block);
      }
    });
  }

  // ---- Risks (only if present in parsed data) -----------------------------
  const risks = Array.isArray(sc.risks) ? sc.risks.map((r) => ({
    risk: r.risk || r.title || 'Risk',
    description: r.description || r.detail || '',
    mitigation: r.mitigation || r.response || '',
  })) : [];

  return {
    meta: {
      dealId: deal?.dealId,
      generatedAt: new Date().toISOString(),
      preparerName: deal?.brokerName || null,
      preparerEmail: deal?.brokerEmail || null,
      preparerPhone: deal?.brokerPhone || null,
    },
    property: {
      name: propertyName,
      address: deal?.address || '',
      latitude: deal?.latitude ?? null,
      longitude: deal?.longitude ?? null,
      assetDescriptor,
      images: images.length ? images : [],
    },
    snapshotStats,
    timeline,
    executiveSummary,
    // AI-grounded thesis sections (undefined/empty until generated — the
    // component only renders these once real content exists).
    whyMarket: Array.isArray(narrative?.whyMarket) ? narrative.whyMarket : [],
    whyAsset: Array.isArray(narrative?.whyAsset) ? narrative.whyAsset : [],
    upsidePlays: Array.isArray(narrative?.upsidePlays) ? narrative.upsidePlays : [],
    // Full AI-generated Business Plan — undefined until the sponsor clicks
    // "Generate Business Plan" in the Deal Room tab; the component only
    // renders this section once it exists. `businessPlanData` is the
    // current, preferred format: structured JSON (title/offeringHighlights/
    // investmentThesis/sections[]) generated via Claude tool-calling and
    // rendered directly into real UI components (see BusinessPlanBlocks.jsx)
    // instead of being parsed from AI-written markdown text.
    // `businessPlanMarkdown` is kept only as a fallback for plans generated
    // before the structured format existed, run through
    // stripWrappingCodeFence() as a safety net for any legacy plan that
    // still has a raw ``` fence wrapped around the whole thing.
    businessPlanData: deal?.businessPlanData || deal?.parsedData?.businessPlanData || null,
    businessPlanMarkdown: (() => {
      if (deal?.businessPlanData || deal?.parsedData?.businessPlanData) return null;
      const raw = deal?.businessPlanMarkdown || deal?.parsedData?.businessPlanMarkdown;
      if (!raw) return null;
      return stripWrappingCodeFence(raw);
    })(),
    financialOverview,
    investorOptions,
    operationalPlan,
    projections,
    exitAnalysis,
    risks,
    distributions: Array.isArray(distributions) ? distributions : [],
    footer: {
      preparer: deal?.brokerName || 'DealSniper',
      confidentiality: 'This document contains confidential and proprietary information prepared solely for the use of prospective investors. Do not distribute without permission.',
      disclaimer: 'All projections are estimates based on assumptions that may not materialize. This is not an offer to sell securities.',
      contact: { name: deal?.brokerName, email: deal?.brokerEmail, phone: deal?.brokerPhone },
    },
  };
}
