/**
 * templateService.js — Load saved underwrite templates from Supabase profiles.
 *
 * Templates are stored in profiles.underwrite_templates JSONB:
 * {
 *   underwrite: { financing, exit_details, investment_criteria },
 *   email_underwrite: { financing, exit_details, investment_criteria }
 * }
 */
import { supabase } from './supabase';

const DEFAULTS = {
  financing: {
    ltv: 75,
    interest_rate: 6.0,
    loan_term_years: 10,
    amortization_years: 30,
    io_years: 0,
    loan_fees_percent: 1.5,
    spread: 1.5,
    selected_treasury_term: 5,
  },
  exit_details: {
    holdYrs: 5,
    closingPct: 2,
    brokerPct: 2,
    strategy: 'cap_rate',
    capAdj: 0,
    growthPct: 3,
  },
  renovation: {
    total_budget: 0,
    cost_per_unit: 5000,
    timeline_months: 12,
    financed: false,
    reno_ltv: 80,
    reno_interest_rate: 8.0,
    reno_loan_term_years: 3,
    reno_io_months: 6,
  },
  investment_criteria: [
    { key: 'irr', label: 'Internal Rate of Return (IRR)', target: 15, unit: '%' },
    { key: 'coc', label: 'Cash on Cash', target: 7, unit: '%' },
  ],
};

/**
 * Load a specific template slot ('underwrite' | 'email_underwrite').
 * Returns the template object with financing, exit_details, investment_criteria
 * merged over hardcoded defaults.  Returns defaults if user has no saved template.
 */
export async function loadTemplate(slot = 'underwrite') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...DEFAULTS };

    // profiles.id = auth user ID in this app (not user_id column)
    let data, error;
    ({ data, error } = await supabase
      .from('profiles')
      .select('underwrite_templates')
      .eq('id', user.id)
      .single());

    if (error || !data?.underwrite_templates?.[slot]) {
      return { ...DEFAULTS };
    }

    const saved = data.underwrite_templates[slot];
    return {
      financing: { ...DEFAULTS.financing, ...(saved.financing || {}) },
      exit_details: { ...DEFAULTS.exit_details, ...(saved.exit_details || {}) },
      renovation: { ...DEFAULTS.renovation, ...(saved.renovation || {}) },
      investment_criteria: saved.investment_criteria?.length
        ? saved.investment_criteria
        : DEFAULTS.investment_criteria,
    };
  } catch (err) {
    console.error('[templateService] Failed to load template:', err);
    return { ...DEFAULTS };
  }
}

/**
 * Apply a template's financing defaults onto a parsed data object.
 * Only fills in fields that are missing/zero from the parse.
 */
export function applyFinancingTemplate(parsedData, template) {
  if (!parsedData || !template?.financing) return parsedData;

  const f = parsedData.financing || {};
  const t = template.financing;

  parsedData.financing = {
    ...f,
    ltv: f.ltv || t.ltv,
    interest_rate: f.interest_rate || t.interest_rate,
    loan_term_years: f.loan_term_years || t.loan_term_years,
    amortization_years: f.amortization_years || t.amortization_years,
    io_years: f.io_years ?? t.io_years,
    loan_fees_percent: f.loan_fees_percent || t.loan_fees_percent,
  };

  // Apply exit details template
  if (template.exit_details) {
    const e = parsedData.exit_details || {};
    parsedData.exit_details = {
      holdYrs: e.holdYrs ?? template.exit_details.holdYrs,
      closingPct: e.closingPct ?? template.exit_details.closingPct,
      brokerPct: e.brokerPct ?? template.exit_details.brokerPct,
      strategy: e.strategy || template.exit_details.strategy,
      capAdj: e.capAdj ?? template.exit_details.capAdj,
      growthPct: e.growthPct ?? template.exit_details.growthPct,
    };
  }

  // Apply investment criteria template
  if (template.investment_criteria?.length && !parsedData.investment_criteria?.length) {
    parsedData.investment_criteria = template.investment_criteria.map(c => ({ ...c }));
  }

  // Apply renovation template defaults
  if (template.renovation) {
    const r = parsedData.renovation || parsedData.value_add?.renovation || {};
    const tReno = template.renovation;
    parsedData.renovation = {
      total_budget: r.total_budget || tReno.total_budget || 0,
      cost_per_unit: r.cost_per_unit || tReno.cost_per_unit,
      timeline_months: r.timeline_months || tReno.timeline_months,
      financed: r.financed ?? tReno.financed,
      reno_ltv: r.reno_ltv ?? tReno.reno_ltv,
      reno_interest_rate: r.reno_interest_rate ?? tReno.reno_interest_rate,
      reno_loan_term_years: r.reno_loan_term_years ?? tReno.reno_loan_term_years,
      reno_io_months: r.reno_io_months ?? tReno.reno_io_months,
    };
  }

  return parsedData;
}
