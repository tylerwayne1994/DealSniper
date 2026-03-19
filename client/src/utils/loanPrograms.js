/**
 * loanPrograms.js — Real-Time Debt Quotes & Loan Program Matching Engine
 *
 * Contains a comprehensive database of CRE loan programs and a matching function
 * that ranks programs based on deal characteristics (purchase price, NOI,
 * property type, unit count, DSCR, LTV).
 */

// ─── LOAN PROGRAM DATABASE ───
export const LOAN_PROGRAMS = [
  // ════════ AGENCY ════════
  {
    id: 'freddie-sbl',
    name: 'Freddie Mac SBL',
    category: 'Agency',
    icon: '🏛️',
    color: '#2563eb',
    description: 'Small Balance Loan — ideal for 5-50 unit properties',
    ltvRange: [65, 80],
    rateRange: [5.25, 6.75],
    rateType: 'Fixed',
    termRange: [5, 10],
    amortRange: [25, 30],
    ioRange: [0, 5],
    feesRange: [0.5, 1.5],
    loanRange: [750_000, 7_500_000],
    minDSCR: 1.20,
    minUnits: 5,
    maxUnits: 200,
    propertyTypes: ['multifamily', 'apartment', 'mixed_use'],
    prepayPenalty: 'Yield Maintenance or Step-Down',
    assumable: true,
    nonRecourse: true,
    pros: ['Low rates', 'Non-recourse', 'Assumable', 'Rate lock at application'],
    cons: ['Minimum 5 units', 'Net worth/liquidity requirements', '90%+ occupancy required'],
    processingTime: '45-60 days',
  },
  {
    id: 'fannie-small',
    name: 'Fannie Mae Small Loan',
    category: 'Agency',
    icon: '🏛️',
    color: '#1d4ed8',
    description: 'Delegated underwriting for smaller multifamily',
    ltvRange: [65, 80],
    rateRange: [5.15, 6.50],
    rateType: 'Fixed',
    termRange: [5, 12],
    amortRange: [25, 30],
    ioRange: [0, 5],
    feesRange: [0.5, 2.0],
    loanRange: [750_000, 6_000_000],
    minDSCR: 1.25,
    minUnits: 5,
    maxUnits: 200,
    propertyTypes: ['multifamily', 'apartment'],
    prepayPenalty: 'Yield Maintenance',
    assumable: true,
    nonRecourse: true,
    pros: ['Competitive rates', 'Non-recourse', 'Supplemental loan eligible'],
    cons: ['Strict DSCR requirements', 'Green certification may get better rate'],
    processingTime: '45-60 days',
  },
  {
    id: 'fannie-standard',
    name: 'Fannie Mae Standard',
    category: 'Agency',
    icon: '🏛️',
    color: '#1e40af',
    description: 'Full DUS execution for larger multifamily',
    ltvRange: [65, 80],
    rateRange: [4.90, 6.25],
    rateType: 'Fixed',
    termRange: [5, 15],
    amortRange: [25, 30],
    ioRange: [0, 10],
    feesRange: [0.5, 2.0],
    loanRange: [5_000_000, 100_000_000],
    minDSCR: 1.25,
    minUnits: 5,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment'],
    prepayPenalty: 'Yield Maintenance',
    assumable: true,
    nonRecourse: true,
    pros: ['Best-in-class rates for large deals', 'Long-term fixed available', 'Non-recourse'],
    cons: ['Higher minimum loan amount', 'Longer processing'],
    processingTime: '60-90 days',
  },
  {
    id: 'freddie-conventional',
    name: 'Freddie Mac Conventional',
    category: 'Agency',
    icon: '🏛️',
    color: '#2563eb',
    description: 'Full conventional execution for larger properties',
    ltvRange: [65, 80],
    rateRange: [5.00, 6.40],
    rateType: 'Fixed',
    termRange: [5, 10],
    amortRange: [25, 30],
    ioRange: [0, 5],
    feesRange: [0.5, 1.5],
    loanRange: [5_000_000, 100_000_000],
    minDSCR: 1.25,
    minUnits: 5,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'senior_housing'],
    prepayPenalty: 'Yield Maintenance or Defeasance',
    assumable: true,
    nonRecourse: true,
    pros: ['Competitive rates', 'Flexible prepay options', 'Non-recourse'],
    cons: ['Net worth 100% of loan', 'Liquidity 10% of loan'],
    processingTime: '60-75 days',
  },

  // ════════ HUD/FHA ════════
  {
    id: 'hud-223f',
    name: 'HUD 223(f)',
    category: 'HUD/FHA',
    icon: '🇺🇸',
    color: '#0369a1',
    description: 'FHA-insured permanent loan — lowest rates, longest terms',
    ltvRange: [75, 87],
    rateRange: [4.50, 5.75],
    rateType: 'Fixed',
    termRange: [35, 35],
    amortRange: [35, 35],
    ioRange: [0, 0],
    feesRange: [1.0, 3.5],
    loanRange: [2_000_000, 100_000_000],
    minDSCR: 1.17,
    minUnits: 5,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'senior_housing', 'assisted_living'],
    prepayPenalty: 'Declining (10-1%)',
    assumable: true,
    nonRecourse: true,
    pros: ['Lowest fixed rates available', '35-year fully amortizing', 'Non-recourse', 'High LTV'],
    cons: ['Very slow (6-12 months)', 'Davis-Bacon wages', 'MIP: 0.25-0.65%/yr', 'Extensive documentation'],
    processingTime: '6-12 months',
  },

  // ════════ CMBS ════════
  {
    id: 'cmbs-conduit',
    name: 'CMBS Conduit',
    category: 'CMBS',
    icon: '🏢',
    color: '#7c3aed',
    description: 'Securitized commercial mortgage — all property types',
    ltvRange: [60, 75],
    rateRange: [5.50, 7.50],
    rateType: 'Fixed',
    termRange: [5, 10],
    amortRange: [25, 30],
    ioRange: [0, 5],
    feesRange: [1.0, 2.0],
    loanRange: [2_000_000, 50_000_000],
    minDSCR: 1.25,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use', 'hotel', 'self_storage'],
    prepayPenalty: 'Defeasance or Yield Maintenance',
    assumable: true,
    nonRecourse: true,
    pros: ['All property types', 'Non-recourse', 'Assumable', 'No personal guaranty'],
    cons: ['Lockout periods', 'Defeasance expensive', 'Less flexible servicing'],
    processingTime: '45-75 days',
  },

  // ════════ BRIDGE ════════
  {
    id: 'bridge-light',
    name: 'Bridge Loan (Light)',
    category: 'Bridge',
    icon: '🌉',
    color: '#ea580c',
    description: 'Short-term bridge for value-add with light renovations',
    ltvRange: [70, 80],
    rateRange: [7.50, 10.00],
    rateType: 'Floating',
    termRange: [2, 3],
    amortRange: [0, 0],
    ioRange: [2, 3],
    feesRange: [1.0, 2.5],
    loanRange: [1_000_000, 25_000_000],
    minDSCR: 1.00,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use', 'self_storage'],
    prepayPenalty: 'None or 1% step-down',
    assumable: false,
    nonRecourse: false,
    pros: ['Fast close (2-4 weeks)', 'IO full term', 'Flexible prepay', 'Higher LTV for value-add'],
    cons: ['Higher rates', 'Floating rate risk', 'Recourse', 'Short term'],
    processingTime: '14-30 days',
  },
  {
    id: 'bridge-heavy',
    name: 'Bridge Loan (Heavy)',
    category: 'Bridge',
    icon: '🌉',
    color: '#c2410c',
    description: 'Heavy value-add or repositioning bridge with reno budget',
    ltvRange: [65, 85],
    rateRange: [9.00, 13.00],
    rateType: 'Floating',
    termRange: [1, 3],
    amortRange: [0, 0],
    ioRange: [1, 3],
    feesRange: [1.5, 3.0],
    loanRange: [500_000, 20_000_000],
    minDSCR: 0.0,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use'],
    prepayPenalty: 'None or minimum interest',
    assumable: false,
    nonRecourse: false,
    pros: ['Funds rehab costs', 'IO full term', 'Fast close', 'Future fund hold-backs'],
    cons: ['Highest rates', 'Full recourse', 'Personal guaranty', 'Construction draws'],
    processingTime: '14-30 days',
  },

  // ════════ BANK / CREDIT UNION ════════
  {
    id: 'bank-portfolio',
    name: 'Bank Portfolio Loan',
    category: 'Bank',
    icon: '🏦',
    color: '#0d9488',
    description: 'Local/regional bank balance sheet loan — relationship driven',
    ltvRange: [65, 75],
    rateRange: [6.00, 8.00],
    rateType: 'Fixed or Hybrid',
    termRange: [5, 10],
    amortRange: [20, 30],
    ioRange: [0, 2],
    feesRange: [0.5, 1.5],
    loanRange: [250_000, 15_000_000],
    minDSCR: 1.20,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use', 'single_family'],
    prepayPenalty: 'Step-down or flat 1-2%',
    assumable: false,
    nonRecourse: false,
    pros: ['Flexible underwriting', 'Relationship pricing', 'All property types', 'Low minimums'],
    cons: ['Full recourse', 'Balloon risk', '5-yr rate resets common', 'Personal guaranty'],
    processingTime: '30-60 days',
  },
  {
    id: 'credit-union',
    name: 'Credit Union Loan',
    category: 'Bank',
    icon: '🏦',
    color: '#059669',
    description: 'Member-owned CU loans — flexible terms, competitive rates',
    ltvRange: [70, 80],
    rateRange: [5.50, 7.50],
    rateType: 'Fixed or ARM',
    termRange: [5, 10],
    amortRange: [20, 30],
    ioRange: [0, 2],
    feesRange: [0.5, 1.0],
    loanRange: [100_000, 10_000_000],
    minDSCR: 1.20,
    minUnits: 0,
    maxUnits: 200,
    propertyTypes: ['multifamily', 'apartment', 'mixed_use', 'single_family'],
    prepayPenalty: 'Minimal or none',
    assumable: false,
    nonRecourse: false,
    pros: ['Low fees', 'Competitive rates', 'Flexible prepay', 'Small deal friendly'],
    cons: ['Recourse', 'Membership required', 'Geographic restrictions'],
    processingTime: '30-45 days',
  },

  // ════════ DEBT FUND ════════
  {
    id: 'debt-fund',
    name: 'Debt Fund',
    category: 'Debt Fund',
    icon: '💰',
    color: '#b45309',
    description: 'Private capital lender — higher leverage, transitional deals',
    ltvRange: [70, 85],
    rateRange: [8.00, 12.00],
    rateType: 'Floating',
    termRange: [2, 5],
    amortRange: [0, 30],
    ioRange: [0, 5],
    feesRange: [1.0, 3.0],
    loanRange: [1_000_000, 50_000_000],
    minDSCR: 1.0,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use', 'hotel', 'self_storage'],
    prepayPenalty: 'Minimal or none',
    assumable: false,
    nonRecourse: false,
    pros: ['Higher leverage', 'Fast close', 'Value-add friendly', 'All property types'],
    cons: ['Higher rates', 'Floating rate', 'Short terms', 'Exit fees possible'],
    processingTime: '14-45 days',
  },

  // ════════ LIFE COMPANY ════════
  {
    id: 'life-company',
    name: 'Life Insurance Company',
    category: 'Life Co',
    icon: '🏢',
    color: '#4338ca',
    description: 'Institutional-quality permanent financing — best rates for stabilized',
    ltvRange: [55, 70],
    rateRange: [4.80, 6.25],
    rateType: 'Fixed',
    termRange: [7, 25],
    amortRange: [25, 30],
    ioRange: [0, 10],
    feesRange: [0.5, 1.0],
    loanRange: [5_000_000, 100_000_000],
    minDSCR: 1.30,
    minUnits: 0,
    maxUnits: 9999,
    propertyTypes: ['multifamily', 'apartment', 'office', 'retail', 'industrial'],
    prepayPenalty: 'Yield Maintenance or Defeasance',
    assumable: false,
    nonRecourse: true,
    pros: ['Lowest rates for stabilized', 'Long-term fixed', 'Non-recourse', 'Flexible structure'],
    cons: ['Lower LTV', 'Stringent DSCR', 'High loan minimum', 'Slower process'],
    processingTime: '60-90 days',
  },

  // ════════ SBA ════════
  {
    id: 'sba-504',
    name: 'SBA 504 Loan',
    category: 'SBA',
    icon: '🇺🇸',
    color: '#166534',
    description: 'Small Business Administration 504 — owner-occupied CRE',
    ltvRange: [80, 90],
    rateRange: [5.50, 7.00],
    rateType: 'Fixed',
    termRange: [10, 25],
    amortRange: [20, 25],
    ioRange: [0, 0],
    feesRange: [1.5, 3.0],
    loanRange: [125_000, 5_000_000],
    minDSCR: 1.15,
    minUnits: 0,
    maxUnits: 50,
    propertyTypes: ['mixed_use', 'retail', 'office', 'industrial'],
    prepayPenalty: 'Declining over 10 years',
    assumable: false,
    nonRecourse: false,
    pros: ['Very high LTV', 'Low down payment (10%)', 'Long-term fixed', 'Below market rates'],
    cons: ['Owner-occupied required (51%+)', 'Extensive paperwork', 'SBA guaranty fee'],
    processingTime: '60-90 days',
  },

  // ════════ DSCR / INVESTOR ════════
  {
    id: 'dscr-investor',
    name: 'DSCR Investor Loan',
    category: 'DSCR',
    icon: '📊',
    color: '#9333ea',
    description: 'Qualifies on property cash flow, no personal income verification',
    ltvRange: [65, 80],
    rateRange: [6.50, 9.00],
    rateType: 'Fixed or ARM',
    termRange: [5, 30],
    amortRange: [30, 30],
    ioRange: [0, 5],
    feesRange: [1.0, 3.0],
    loanRange: [100_000, 3_000_000],
    minDSCR: 1.00,
    minUnits: 1,
    maxUnits: 10,
    propertyTypes: ['single_family', 'multifamily', 'apartment', 'mixed_use'],
    prepayPenalty: '3-5 year step-down',
    assumable: false,
    nonRecourse: false,
    pros: ['No income verification', 'Fast close', 'LLC vesting', 'Small property friendly'],
    cons: ['Higher rates', 'Lower LTV for low DSCR', 'Credit score dependent'],
    processingTime: '21-30 days',
  },
];

// ─── CATEGORY METADATA ───
export const LOAN_CATEGORIES = {
  Agency: { icon: '🏛️', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Agency (GSE)' },
  'HUD/FHA': { icon: '🇺🇸', color: '#0369a1', bg: '#ecfeff', border: '#a5f3fc', label: 'HUD / FHA' },
  CMBS: { icon: '🏢', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', label: 'CMBS' },
  Bridge: { icon: '🌉', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'Bridge' },
  Bank: { icon: '🏦', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Bank / CU' },
  'Debt Fund': { icon: '💰', color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Debt Fund' },
  'Life Co': { icon: '🏢', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe', label: 'Life Company' },
  SBA: { icon: '🇺🇸', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', label: 'SBA' },
  DSCR: { icon: '📊', color: '#9333ea', bg: '#faf5ff', border: '#d8b4fe', label: 'DSCR / Investor' },
};


/**
 * Match and score loan programs based on deal characteristics.
 *
 * @param {Object} deal
 * @param {number} deal.purchasePrice  - Total purchase price
 * @param {number} deal.noi            - Net Operating Income (annual)
 * @param {number} deal.units          - Number of units (0 if N/A)
 * @param {string} deal.propertyType   - Property type key
 * @param {number} [deal.desiredLTV]   - Desired LTV (optional)
 * @param {number} [deal.desiredDSCR]  - Minimum acceptable DSCR (optional)
 * @returns {Array<Object>} Ranked array of { program, quote, score, matchReasons, warnings }
 */
export function matchLoanPrograms(deal) {
  const {
    purchasePrice = 0,
    noi = 0,
    units = 0,
    propertyType = 'multifamily',
    desiredLTV,
  } = deal;

  if (purchasePrice <= 0) return [];

  // Normalize property type
  const ptNorm = (propertyType || 'multifamily').toLowerCase().replace(/[\s-]+/g, '_');
  const ptAliases = {
    apartment: 'multifamily',
    multi_family: 'multifamily',
    garden: 'multifamily',
    condo: 'multifamily',
  };
  const ptMatched = ptAliases[ptNorm] || ptNorm;

  const results = [];

  for (const prog of LOAN_PROGRAMS) {
    const matchReasons = [];
    const warnings = [];
    let score = 50; // base

    // ── 1. Property type check ──
    const ptAccepted = prog.propertyTypes.includes(ptMatched) ||
      prog.propertyTypes.includes(ptNorm) ||
      (prog.propertyTypes.includes('multifamily') && ['apartment', 'multifamily', 'garden'].includes(ptMatched));
    if (!ptAccepted) {
      continue; // hard filter
    }
    matchReasons.push('Property type eligible');

    // ── 2. Unit count check ──
    if (units > 0) {
      if (units < prog.minUnits) continue; // hard filter
      if (prog.maxUnits && units > prog.maxUnits) continue;
      matchReasons.push(`${units} units within range`);
      // Bonus if in sweet spot
      if (prog.minUnits >= 5 && units >= 5) score += 5;
    }

    // ── 3. Loan amount feasibility ──
    const midLTV = (prog.ltvRange[0] + prog.ltvRange[1]) / 2;
    const estLoanAmt = purchasePrice * midLTV / 100;
    if (estLoanAmt < prog.loanRange[0]) {
      // Deal too small for this program
      if (estLoanAmt < prog.loanRange[0] * 0.5) continue; // way too small, skip
      warnings.push(`Loan amount ($${fmtCompact(estLoanAmt)}) below minimum ($${fmtCompact(prog.loanRange[0])})`);
      score -= 15;
    } else if (estLoanAmt > prog.loanRange[1]) {
      warnings.push(`Loan may exceed program maximum ($${fmtCompact(prog.loanRange[1])})`);
      score -= 10;
    } else {
      matchReasons.push('Loan amount in range');
      score += 10;
    }

    // ── 4. DSCR check ──
    if (noi > 0 && estLoanAmt > 0) {
      const midRate = (prog.rateRange[0] + prog.rateRange[1]) / 2;
      const amort = prog.amortRange[1] > 0 ? prog.amortRange[1] : 30;
      const r = midRate / 100 / 12;
      const n = amort * 12;
      let monthlyPmt = 0;
      if (r > 0 && n > 0) {
        monthlyPmt = estLoanAmt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      }
      const annualDS = monthlyPmt * 12;
      const estDSCR = annualDS > 0 ? noi / annualDS : 0;

      if (estDSCR < prog.minDSCR) {
        if (estDSCR < prog.minDSCR * 0.8) {
          warnings.push(`DSCR (${estDSCR.toFixed(2)}x) well below minimum (${prog.minDSCR}x)`);
          score -= 20;
        } else {
          warnings.push(`DSCR (${estDSCR.toFixed(2)}x) slightly below minimum (${prog.minDSCR}x)`);
          score -= 10;
        }
      } else {
        matchReasons.push(`DSCR ${estDSCR.toFixed(2)}x meets ${prog.minDSCR}x minimum`);
        score += 15;
        if (estDSCR >= 1.40) score += 5;
      }
    }

    // ── 5. LTV preference ──
    if (desiredLTV) {
      if (desiredLTV >= prog.ltvRange[0] && desiredLTV <= prog.ltvRange[1]) {
        matchReasons.push(`Desired LTV (${desiredLTV}%) available`);
        score += 10;
      } else if (desiredLTV > prog.ltvRange[1]) {
        warnings.push(`Max LTV is ${prog.ltvRange[1]}%, desired ${desiredLTV}%`);
        score -= 5;
      }
    }

    // ── 6. Category bonuses ──
    // Agency & Life Co: better for stabilized
    if (['Agency', 'Life Co', 'HUD/FHA'].includes(prog.category)) {
      if (noi > 0 && purchasePrice > 0) {
        const capRate = (noi / purchasePrice) * 100;
        if (capRate >= 5) score += 10; // Stabilized, good cap rate
      }
      score += 5; // general preference for permanent debt
    }
    // Bridge: bonus for value-add situations
    if (prog.category === 'Bridge') {
      score -= 5; // slight penalty unless user explicitly wants bridge
    }

    // ── 7. Rate competitiveness ──
    const avgRate = (prog.rateRange[0] + prog.rateRange[1]) / 2;
    if (avgRate < 6.0) score += 10;
    else if (avgRate < 7.0) score += 5;
    else if (avgRate > 9.0) score -= 5;

    // ── 8. Non-recourse bonus ──
    if (prog.nonRecourse) score += 5;

    // ── Build quote ──
    const quoteLTV = desiredLTV
      ? Math.min(desiredLTV, prog.ltvRange[1])
      : Math.round((prog.ltvRange[0] + prog.ltvRange[1]) / 2);
    const quoteLoan = purchasePrice * quoteLTV / 100;
    const quoteRate = (prog.rateRange[0] + prog.rateRange[1]) / 2;
    const quoteTerm = prog.termRange[1] >= 10 ? 10 : prog.termRange[1];
    const quoteAmort = prog.amortRange[1] > 0 ? prog.amortRange[1] : 0;
    const quoteIO = Math.min(prog.ioRange[1], 3);
    const quoteFees = (prog.feesRange[0] + prog.feesRange[1]) / 2;

    // Calculate monthly payment
    let quoteMonthly = 0;
    if (quoteAmort > 0 && quoteRate > 0) {
      const r = quoteRate / 100 / 12;
      const n = quoteAmort * 12;
      quoteMonthly = quoteLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else if (quoteRate > 0) {
      quoteMonthly = quoteLoan * (quoteRate / 100 / 12); // IO
    }
    const quoteAnnualDS = quoteMonthly * 12;
    const quoteDSCR = quoteAnnualDS > 0 ? noi / quoteAnnualDS : 0;
    const quoteCashflow = noi - quoteAnnualDS;
    const quoteEquity = purchasePrice - quoteLoan;
    const quoteFeeAmt = quoteLoan * quoteFees / 100;
    const quoteCOOP = quoteEquity + quoteFeeAmt;
    const quoteCoC = quoteCOOP > 0 ? (quoteCashflow / quoteCOOP) * 100 : 0;

    results.push({
      program: prog,
      quote: {
        ltv: quoteLTV,
        loanAmount: quoteLoan,
        rate: quoteRate,
        term: quoteTerm,
        amort: quoteAmort,
        io: quoteIO,
        fees: quoteFees,
        feeAmount: quoteFeeAmt,
        monthlyPayment: quoteMonthly,
        annualDebtService: quoteAnnualDS,
        dscr: quoteDSCR,
        cashflow: quoteCashflow,
        equity: quoteEquity,
        cashOutOfPocket: quoteCOOP,
        cashOnCash: quoteCoC,
      },
      score: Math.max(0, Math.min(100, score)),
      matchReasons,
      warnings,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Get a subset of programs as "quick presets" for template selection.
 * Returns one per category with default params.
 */
export function getLoanPresets() {
  const categories = ['Agency', 'HUD/FHA', 'CMBS', 'Bridge', 'Bank', 'Life Co', 'DSCR'];
  return categories.map(cat => {
    const prog = LOAN_PROGRAMS.find(p => p.category === cat);
    if (!prog) return null;
    const midLTV = Math.round((prog.ltvRange[0] + prog.ltvRange[1]) / 2);
    const midRate = +((prog.rateRange[0] + prog.rateRange[1]) / 2).toFixed(2);
    const term = prog.termRange[1] >= 10 ? 10 : prog.termRange[1];
    const amort = prog.amortRange[1] > 0 ? prog.amortRange[1] : 30;
    const io = Math.min(prog.ioRange[1], 3);
    const fees = +((prog.feesRange[0] + prog.feesRange[1]) / 2).toFixed(2);
    return {
      id: prog.id,
      name: prog.name,
      category: prog.category,
      icon: prog.icon,
      color: prog.color,
      description: prog.description,
      financing: {
        ltv: midLTV,
        interest_rate: midRate,
        loan_term_years: term,
        amortization_years: amort,
        io_years: io,
        loan_fees_percent: fees,
      },
    };
  }).filter(Boolean);
}

// ─── HELPER ───
function fmtCompact(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}
