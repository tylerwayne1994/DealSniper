import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Building, TrendingUp, Calculator, 
  Sparkles, AlertTriangle, CheckCircle, 
  Target, Wallet, RefreshCw,
  Shield, Lock, Key, BarChart3, Clock, Activity
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8010";

// ── Helpers ──
const calcMonthlyPayment = (principal, annualRate, amortMonths) => {
  if (principal <= 0 || amortMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / amortMonths;
  return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
};

const fmt = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const pct = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  return `${val.toFixed(2)}%`;
};

// ── Build user's actual structure from financing.loans ──
const buildUserStructureFromLoans = (loans, purchasePrice, noi) => {
  if (!loans || loans.length === 0 || purchasePrice <= 0) return null;

  const enabledLoans = loans.filter(l => l.enabled !== false);
  const debtLoans = enabledLoans.filter(l => l.type !== 'Equity Partner');
  const equityLoans = enabledLoans.filter(l => l.type === 'Equity Partner');

  const loanDetails = debtLoans.map(l => {
    const amt = l.loanAmtMode === 'ltv'
      ? purchasePrice * (Number(l.ltv) || 0) / 100
      : Number(l.loanDollar) || 0;
    const r = (Number(l.rate) || 0) / 100 / 12;
    const n = (Number(l.amort) || 30) * 12;
    let monthlyPmt = 0;
    if (amt > 0 && r > 0 && n > 0) {
      monthlyPmt = amt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    const fees = amt * (Number(l.fees) || 0) / 100;
    return { ...l, loanAmt: amt, monthlyPmt, fees, annualDS: monthlyPmt * 12 };
  });

  const equityDetails = equityLoans.map(l => {
    const partnerEquity = Number(l.loanDollar) || 0;
    const prefReturn = (Number(l.rate) || 8) / 100;
    const annualPref = partnerEquity * prefReturn;
    return { ...l, partnerEquity, annualPref, monthlyPref: annualPref / 12 };
  });

  const totalLoanAmt = loanDetails.reduce((s, l) => s + l.loanAmt, 0);
  const totalMonthlyDebt = loanDetails.reduce((s, l) => s + l.monthlyPmt, 0);
  const totalFees = loanDetails.reduce((s, l) => s + l.fees, 0);
  const totalEquity = equityDetails.reduce((s, l) => s + l.partnerEquity, 0);
  const totalAnnualPref = equityDetails.reduce((s, l) => s + l.annualPref, 0);
  const annualDebtService = totalMonthlyDebt * 12;
  const totalMonthlyPmt = totalMonthlyDebt + (totalAnnualPref / 12);
  const totalAnnualPmt = totalMonthlyPmt * 12;
  const downPayment = Math.max(0, purchasePrice - totalLoanAmt - totalEquity);
  const cashOutOfPocket = downPayment + totalFees;
  const cashflow = noi - totalAnnualPmt;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const cashOnCash = cashOutOfPocket > 0 ? (cashflow / cashOutOfPocket) * 100 : 0;
  const ltv = purchasePrice > 0 ? (totalLoanAmt / purchasePrice * 100) : 0;
  const ltc = (purchasePrice + totalFees) > 0 ? (totalLoanAmt / (purchasePrice + totalFees) * 100) : 0;

  const types = enabledLoans.map(l => l.type);
  let structureName = 'Your Financing Structure';
  if (types.length === 1 && types[0] === 'Senior Loan') structureName = 'Senior Loan';
  else if (types.includes('Equity Partner') && types.includes('Senior Loan')) structureName = 'Senior + Equity Partner';
  else if (types.includes('Seller Financing') && types.includes('Senior Loan')) structureName = 'Senior + Seller Carry';
  else if (types.includes('Mezzanine Loan') && types.includes('Senior Loan')) structureName = 'Senior + Mezzanine';
  else if (types.length > 2) structureName = `${types.length}-Position Capital Stack`;

  return {
    name: structureName, loans: enabledLoans, loanDetails, equityDetails,
    totalLoanAmt, totalMonthlyDebt, totalFees, totalEquity, totalAnnualPref,
    annualDebtService, totalMonthlyPmt, totalAnnualPmt,
    downPayment, cashOutOfPocket, cashflow, dscr, cashOnCash, ltv, ltc,
  };
};

// ── Alternative structures for comparison ──
const generateAlternativeStructures = (purchasePrice, noi) => {
  const alts = {};
  const make = (name, ltv, rate, amortYrs, closingPct, desc) => {
    const loan = purchasePrice * ltv / 100;
    const down = purchasePrice - loan;
    const mo = calcMonthlyPayment(loan, rate, amortYrs * 12);
    const annual = mo * 12;
    const cf = noi - annual;
    const coop = down + purchasePrice * closingPct / 100;
    return {
      name, totalLoanAmt: loan, downPayment: down, cashOutOfPocket: coop,
      totalMonthlyPmt: mo, annualDebtService: annual, cashflow: cf,
      dscr: annual > 0 ? noi / annual : 0,
      cashOnCash: coop > 0 ? (cf / coop) * 100 : 0,
      ltv, desc,
    };
  };
  alts['alt-traditional'] = make('Traditional (75% LTV)', 75, 6.5, 30, 3, '75% LTV, 6.5%, 30yr amort, 3% closing');
  alts['alt-aggressive'] = make('Aggressive (80% LTV)', 80, 6.75, 30, 3, '80% LTV, 6.75%, 30yr amort');
  alts['alt-conservative'] = make('Conservative (65% LTV)', 65, 6.0, 30, 2, '65% LTV, 6.0%, 30yr amort');
  // Seller Finance
  const sfLoan = purchasePrice * 0.85;
  const sfDown = purchasePrice - sfLoan;
  const sfMo = calcMonthlyPayment(sfLoan, 5.5, 240);
  const sfAnnual = sfMo * 12;
  const sfCF = noi - sfAnnual;
  const sfCOOP = sfDown + purchasePrice * 0.02;
  alts['alt-seller-finance'] = {
    name: 'Seller Finance (85% LTV)', totalLoanAmt: sfLoan, downPayment: sfDown,
    cashOutOfPocket: sfCOOP, totalMonthlyPmt: sfMo, annualDebtService: sfAnnual,
    cashflow: sfCF, dscr: sfAnnual > 0 ? noi / sfAnnual : 0,
    cashOnCash: sfCOOP > 0 ? (sfCF / sfCOOP) * 100 : 0, ltv: 85,
    desc: '85% LTV, 5.5%, 20yr amort, 5yr balloon',
  };
  return alts;
};


export default function DealStructureTab({ scenarioData, calculations, fullCalcs, marketCapRate, onRecommendationChange, onSelectedStructureMetricsChange }) {
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Extract key data ──
  const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
  const noi = fullCalcs?.year1?.noi || scenarioData?.pnl?.noi_t12 || scenarioData?.pnl?.noi || 0;
  const financing = useMemo(() => scenarioData?.financing || {}, [scenarioData?.financing]);

  const goingInCapRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 5.5;
  const exitCapRate = marketCapRate?.market_cap_rate || goingInCapRate;
  const proformaNOI = fullCalcs?.stabilized?.noi || scenarioData?.proforma?.projected_noi || noi * 1.15;
  const asIsValue = goingInCapRate > 0 ? noi / (goingInCapRate / 100) : purchasePrice;
  const stabilizedValue = exitCapRate > 0 ? proformaNOI / (exitCapRate / 100) : purchasePrice * 1.15;
  const valueAdd = stabilizedValue - asIsValue;

  // ── Build structure from actual financing.loans ──
  const userLoans = useMemo(() => financing.loans || [], [financing.loans]);

  const userStructure = useMemo(() => {
    if (userLoans.length > 0 && purchasePrice > 0 && noi > 0) {
      return buildUserStructureFromLoans(userLoans, purchasePrice, noi);
    }
    if (purchasePrice > 0 && noi > 0) {
      const legacyLoan = [{
        id: 'senior', type: 'Senior Loan', enabled: true,
        loanAmtMode: 'ltv',
        ltv: Number(financing.ltv) || 70,
        loanDollar: 0,
        rate: Number(financing.interest_rate) || 5.96,
        term: Number(financing.loan_term_years) || 10,
        amort: Number(financing.amortization_years) || 30,
        io: Number(financing.io_years) || 0,
        fees: Number(financing.loan_fees_percent) || 1.5,
      }];
      return buildUserStructureFromLoans(legacyLoan, purchasePrice, noi);
    }
    return null;
  }, [userLoans, purchasePrice, noi, financing]);

  const altStructures = useMemo(() => {
    if (purchasePrice > 0 && noi > 0) return generateAlternativeStructures(purchasePrice, noi);
    return {};
  }, [purchasePrice, noi]);

  // ── AI Verdict ──
  let verdictLabel = 'Load a deal to see AI verdict';
  let verdictSubtitle = 'Upload or auto-fill a deal to unlock structure insights.';
  let verdictTheme = { background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)', textColor: '#111827', badgeBg: '#111827', badgeColor: '#ffffff', confidenceAccent: '#4b5563' };
  let confidenceScore = null;

  if (userStructure) {
    const d = userStructure.dscr || 0;
    const c = userStructure.cashOnCash || 0;
    if (d >= 1.3 && c >= 10) {
      verdictLabel = 'Strong Buy';
      verdictSubtitle = 'Debt coverage and cash-on-cash look strong for this deal.';
      verdictTheme = { background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 45%, #0f766e 100%)', textColor: '#ecfdf5', badgeBg: '#f0fdf4', badgeColor: '#16a34a', confidenceAccent: '#bbf7d0' };
      confidenceScore = 92;
    } else if (d < 1.0 || c < 4) {
      verdictLabel = 'Avoid';
      verdictSubtitle = 'Current structure struggles to cover debt or generate enough cash flow.';
      verdictTheme = { background: 'linear-gradient(135deg, #f97373 0%, #ef4444 40%, #991b1b 100%)', textColor: '#fef2f2', badgeBg: '#fef2f2', badgeColor: '#b91c1c', confidenceAccent: '#fecaca' };
      confidenceScore = 28;
    } else {
      verdictLabel = 'Watch Closely';
      verdictSubtitle = 'Borderline coverage and returns – may work with tighter execution or better pricing.';
      verdictTheme = { background: 'linear-gradient(135deg, #facc15 0%, #eab308 40%, #b45309 100%)', textColor: '#fefce8', badgeBg: '#fefce8', badgeColor: '#854d0e', confidenceAccent: '#fef3c7' };
      confidenceScore = 68;
    }
  }

  // ── Lift metrics to parent ──
  useEffect(() => {
    if (!userStructure) return;
    const selectedMetrics = {
      name: userStructure.name, key: 'user-structure',
      annualCashFlow: userStructure.cashflow, cashOnCash: userStructure.cashOnCash,
      dscr: userStructure.dscr, capRate: goingInCapRate,
    };
    if (onSelectedStructureMetricsChange) onSelectedStructureMetricsChange(selectedMetrics);
  }, [userStructure, goingInCapRate, onSelectedStructureMetricsChange]);

  // ── Fetch AI recommendation ──
  const fetchAIRecommendation = async () => {
    try {
      const tokenCheck = await fetch(`${API_BASE}/api/tokens/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_type: 'deal_structure_analysis' })
      });
      const tokenData = await tokenCheck.json();
      if (!tokenData.has_tokens) {
        window.confirm(`This will use AI to analyze your deal structure.\n\nCost: ${tokenData.tokens_required} token\nYour balance: ${tokenData.token_balance} tokens\n\nYou need more tokens.`);
        return;
      }
      const userConfirmed = window.confirm(`This will use AI to analyze your deal structure.\n\nCost: ${tokenData.tokens_required} token\nYour balance: ${tokenData.token_balance} tokens\n\nContinue?`);
      if (!userConfirmed) return;
    } catch (err) {
      console.error('Token check failed:', err);
      setError('Failed to check token balance.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const dealData = {
        property: {
          address: scenarioData?.property?.address || 'Unknown',
          units: scenarioData?.property?.total_units || 0,
          yearBuilt: scenarioData?.property?.year_built || 'Unknown',
          type: scenarioData?.property?.property_type || 'Multifamily'
        },
        financials: {
          purchasePrice, currentNOI: noi, proformaNOI, asIsValue, stabilizedValue,
          valueAddPotential: valueAdd, goingInCapRate, exitCapRate,
          marketCapRate: marketCapRate?.market_cap_rate || null
        },
        userStructure: userStructure ? {
          name: userStructure.name, totalLoanAmt: userStructure.totalLoanAmt,
          downPayment: userStructure.downPayment, cashOutOfPocket: userStructure.cashOutOfPocket,
          annualDebtService: userStructure.annualDebtService, cashflow: userStructure.cashflow,
          dscr: userStructure.dscr, cashOnCash: userStructure.cashOnCash, ltv: userStructure.ltv,
          loans: userStructure.loans,
        } : null,
        structures: Object.entries(altStructures).map(([key, s]) => ({
          key, structure: s.name, loanAmount: s.totalLoanAmt, downPayment: s.downPayment,
          cashOutOfPocket: s.cashOutOfPocket, monthlyPayment: s.totalMonthlyPmt,
          annualDebtService: s.annualDebtService, annualCashflow: s.cashflow,
          dscr: s.dscr, cashOnCash: s.cashOnCash,
        })),
        userPreferredStructure: 'user-structure',
      };
      const response = await fetch(`${API_BASE}/api/deal-structure/recommend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData)
      });
      if (!response.ok) throw new Error('Failed to get AI recommendation');
      const data = await response.json();
      setAiRecommendation(data.recommendation);
      if (onRecommendationChange && data.recommendation?.recommendedStructure) {
        onRecommendationChange(data.recommendation.recommendedStructure);
      }
    } catch (err) {
      console.error('AI Recommendation error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Color helpers ──
  const dscrColor = (v) => v >= 1.25 ? '#10b981' : v >= 1.0 ? '#f59e0b' : '#ef4444';
  const cfColor = (v) => v >= 0 ? '#10b981' : '#ef4444';
  const cocColor = (v) => v >= 8 ? '#10b981' : '#374151';
  const loanIcon = (type) => ({ 'Senior Loan': '🏦', 'Mezzanine Loan': '🏛️', 'Seller Financing': '🤝', 'Second Debt': '📄', 'Equity Partner': '👥' }[type] || '💰');
  const loanColor = (type) => ({ 'Senior Loan': '#3b82f6', 'Mezzanine Loan': '#f97316', 'Seller Financing': '#a855f7', 'Second Debt': '#06b6d4', 'Equity Partner': '#22c55e' }[type] || '#6b7280');

  // ──────────── RENDER ────────────
  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ═══ AI VERDICT BANNER ═══ */}
        <div style={{
          marginBottom: 20, borderRadius: 16, padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
          background: verdictTheme.background, color: verdictTheme.textColor,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: verdictTheme.badgeBg, color: verdictTheme.badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Deal Verdict</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{verdictLabel}</div>
              <div style={{ fontSize: 13, marginTop: 4, maxWidth: 520 }}>{verdictSubtitle}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>
              {confidenceScore != null ? 'Confidence' : 'Status'}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: verdictTheme.confidenceAccent }}>
              {confidenceScore != null ? `${confidenceScore}%` : 'Waiting...'}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>Based on structure DSCR and cash-on-cash</div>
          </div>
        </div>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, marginRight: 12 }}>
            <DollarSign size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Deal Structure Analysis</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Your financing structure from the Expenses tab — with alternative scenarios</p>
          </div>
          {aiRecommendation && (
            <button onClick={fetchAIRecommendation} disabled={isLoading}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}>
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          )}
        </div>

        {/* ═══ VALUE-ADD ANALYSIS ═══ */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: '24px 28px', marginBottom: 24, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', border: '2px solid #4f46e5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={20} color="#4f46e5" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Value-Add Analysis</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {[
              { label: 'Current NOI', val: noi, bg: '#f9fafb', border: '#e5e7eb', color: '#111827' },
              { label: 'Proforma NOI', val: proformaNOI, bg: '#ecfdf5', border: '#6ee7b7', color: '#047857' },
              { label: 'As-Is Value', val: asIsValue, bg: '#f9fafb', border: '#e5e7eb', color: '#111827' },
              { label: 'Forced Appreciation', val: valueAdd, bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8' },
              { label: 'Total Value', val: stabilizedValue, bg: '#f5f3ff', border: '#a855f7', color: '#6b21a8' },
            ].map((card, i) => (
              <div key={i} style={{ padding: 16, backgroundColor: card.bg, borderRadius: 12, border: `1px solid ${card.border}` }}>
                <div style={{ fontSize: 11, color: card.color === '#111827' ? '#6b7280' : card.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{fmt(card.val)}</div>
              </div>
            ))}
          </div>

          {/* Cap Rate Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
            <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Going-In Cap Rate</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{pct(goingInCapRate)}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Your Basis</div>
            </div>
            <div style={{ padding: 16, backgroundColor: marketCapRate ? '#e0f2fe' : '#f9fafb', borderRadius: 12, border: marketCapRate ? '2px solid #0ea5e9' : '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: marketCapRate ? '#0369a1' : '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Market Cap Rate {marketCapRate ? '✓' : ''}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: marketCapRate ? '#0ea5e9' : '#9ca3af' }}>
                {marketCapRate ? pct(marketCapRate.market_cap_rate) : 'Loading...'}
              </div>
              <div style={{ fontSize: 10, color: marketCapRate ? '#0369a1' : '#9ca3af', marginTop: 4 }}>
                {marketCapRate ? `${marketCapRate.asset_class} Class • ${marketCapRate.confidence} confidence` : 'LLM Estimate'}
              </div>
            </div>
            <div style={{
              padding: 16,
              backgroundColor: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#ecfdf5' : '#fef2f2',
              borderRadius: 12,
              border: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '2px solid #10b981' : '2px solid #ef4444',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#047857' : '#b91c1c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Spread</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#10b981' : '#ef4444' }}>
                {marketCapRate ? `${(goingInCapRate - marketCapRate.market_cap_rate) > 0 ? '+' : ''}${(goingInCapRate - marketCapRate.market_cap_rate).toFixed(2)}%` : '-'}
              </div>
              <div style={{ fontSize: 10, color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#047857' : '#b91c1c', marginTop: 4, fontWeight: 600 }}>
                {marketCapRate ? (goingInCapRate > marketCapRate.market_cap_rate ? '✓ Buying Below Market' : '⚠ Above Market') : '-'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '14px 16px', backgroundColor: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px dashed #3b82f6' }}>
            <Target size={18} color="#1d4ed8" />
            <span style={{ fontSize: 13, color: '#1e3a8a' }}>
              <strong style={{ color: '#1d4ed8' }}>Value Creation:</strong> NOI ÷ Cap Rate = Value. Increase NOI by {fmt(proformaNOI - noi)} to create {fmt(valueAdd)} in equity at {marketCapRate ? pct(marketCapRate.market_cap_rate) : pct(goingInCapRate)} cap.
            </span>
          </div>
        </div>

        {/* ═══ YOUR FINANCING STRUCTURE (from actual loans) ═══ */}
        {userStructure && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', border: '2px solid #4f46e5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Wallet size={20} color="#4f46e5" />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your Financing Structure</h3>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>Configure loans in Expenses → Debt Calculator</span>
            </div>

            {/* Financing Summary 4 cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Total Loan Amount', val: fmt(userStructure.totalLoanAmt), sub: `LTV ${pct(userStructure.ltv)}`, accent: '#3b82f6' },
                { label: 'Down Payment', val: fmt(userStructure.downPayment), sub: `${(userStructure.downPayment / (purchasePrice || 1) * 100).toFixed(1)}% of price`, accent: '#f97316' },
                { label: 'Annual Debt Service', val: fmt(userStructure.annualDebtService), sub: `${fmt(userStructure.totalMonthlyDebt)}/mo`, accent: '#ef4444' },
                { label: 'Cash Out of Pocket', val: fmt(userStructure.cashOutOfPocket), sub: `Incl. ${fmt(userStructure.totalFees)} fees`, accent: '#6366f1' },
              ].map((c, i) => (
                <div key={i} style={{ padding: '16px 14px', borderRadius: 12, border: `2px solid ${c.accent}20`, backgroundColor: `${c.accent}08` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Capital Stack Bar */}
            {userStructure.loans && userStructure.loans.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Capital Stack</div>
                <div style={{ display: 'flex', height: 50, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  {userStructure.loanDetails.map((l, i) => {
                    const pctW = purchasePrice > 0 ? (l.loanAmt / purchasePrice * 100) : 0;
                    return pctW > 0 ? (
                      <div key={i} style={{ width: `${pctW}%`, backgroundColor: loanColor(l.type), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, minWidth: pctW > 5 ? 40 : 0 }}
                        title={`${l.type}: ${fmt(l.loanAmt)} (${pctW.toFixed(1)}%)`}>
                        {pctW > 8 && `${pctW.toFixed(0)}%`}
                      </div>
                    ) : null;
                  })}
                  {userStructure.equityDetails.map((l, i) => {
                    const pctW = purchasePrice > 0 ? (l.partnerEquity / purchasePrice * 100) : 0;
                    return pctW > 0 ? (
                      <div key={`eq-${i}`} style={{ width: `${pctW}%`, backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}
                        title={`Equity Partner: ${fmt(l.partnerEquity)} (${pctW.toFixed(1)}%)`}>
                        {pctW > 8 && `${pctW.toFixed(0)}%`}
                      </div>
                    ) : null;
                  })}
                  {userStructure.downPayment > 0 && (
                    <div style={{ width: `${(userStructure.downPayment / purchasePrice * 100)}%`, backgroundColor: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}
                      title={`Your Equity: ${fmt(userStructure.downPayment)}`}>
                      {(userStructure.downPayment / purchasePrice * 100) > 8 && `${(userStructure.downPayment / purchasePrice * 100).toFixed(0)}%`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  {userStructure.loanDetails.map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: loanColor(l.type) }} />
                      <span style={{ color: '#6b7280' }}>{l.type}</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{fmt(l.loanAmt)}</span>
                    </div>
                  ))}
                  {userStructure.equityDetails.map((l, i) => (
                    <div key={`eq-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#22c55e' }} />
                      <span style={{ color: '#6b7280' }}>Equity Partner</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{fmt(l.partnerEquity)}</span>
                    </div>
                  ))}
                  {userStructure.downPayment > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#94a3b8' }} />
                      <span style={{ color: '#6b7280' }}>Your Equity</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{fmt(userStructure.downPayment)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debt Service Breakdown Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debt Service Breakdown</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Position</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Loan Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Rate</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Term</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Monthly</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStructure.loanDetails.map((l, i) => (
                      <tr key={i} style={{ borderLeft: `3px solid ${loanColor(l.type)}` }}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ marginRight: 6 }}>{loanIcon(l.type)}</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{l.type}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' }}>{fmt(l.loanAmt)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{pct(Number(l.rate))}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{l.amort || '-'}yr</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' }}>{fmt(l.monthlyPmt)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' }}>{fmt(l.annualDS)}</td>
                      </tr>
                    ))}
                    {userStructure.equityDetails.map((l, i) => (
                      <tr key={`eq-${i}`} style={{ borderLeft: '3px solid #22c55e' }}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                          <span style={{ marginRight: 6 }}>👥</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>Equity Partner</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#22c55e' }}>{fmt(l.partnerEquity)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{pct(Number(l.rate))} pref</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>-</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#f97316' }}>{fmt(l.monthlyPref)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#f97316' }}>{fmt(l.annualPref)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#1e2a4a' }}>
                      <td style={{ padding: 12, fontWeight: 800, color: 'white', fontSize: 13 }}>Total</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 800, color: 'white', fontSize: 13 }}>{fmt(userStructure.totalLoanAmt + userStructure.totalEquity)}</td>
                      <td style={{ padding: 12 }}></td>
                      <td style={{ padding: 12 }}></td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 800, color: '#60a5fa', fontSize: 13 }}>{fmt(userStructure.totalMonthlyPmt)}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 800, color: '#60a5fa', fontSize: 13 }}>{fmt(userStructure.totalAnnualPmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Metrics 4 cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: userStructure.cashflow >= 0 ? '#ecfdf5' : '#fef2f2', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Annual Cashflow</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: cfColor(userStructure.cashflow) }}>{fmt(userStructure.cashflow)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{fmt(userStructure.cashflow / 12)}/mo</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: userStructure.dscr >= 1.25 ? '#ecfdf5' : userStructure.dscr >= 1.0 ? '#fef3c7' : '#fef2f2', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>DSCR</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: dscrColor(userStructure.dscr) }}>{userStructure.dscr.toFixed(2)}x</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{userStructure.dscr >= 1.25 ? '✓ Strong' : userStructure.dscr >= 1.0 ? '⚠ Tight' : '✗ Negative'}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Cash on Cash</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: cocColor(userStructure.cashOnCash) }}>{pct(userStructure.cashOnCash)}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 12, backgroundColor: '#dbeafe', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#1e40af', marginBottom: 4 }}>LTC Ratio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{pct(userStructure.ltc)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AI RECOMMENDATION ═══ */}
        <div style={{ marginBottom: 24 }}>
          {isLoading ? (
            <div style={{ padding: 60, textAlign: 'center', backgroundColor: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div className="spin" style={{ display: 'inline-block', marginBottom: 16 }}>
                <Sparkles size={32} color="#6366f1" />
              </div>
              <p style={{ color: '#6b7280', margin: 0 }}>Analyzing your deal structure...</p>
              <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Evaluating financing, cash flow, and risk metrics</p>
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', backgroundColor: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
              <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: 12 }} />
              <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
              <button onClick={fetchAIRecommendation}
                style={{ marginTop: 16, padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          ) : aiRecommendation ? (
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, border: '2px solid #22c55e', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sparkles size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>AI Analysis & Recommendation</h3>
                <span style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>AI</span>
              </div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                <ReactMarkdown>{aiRecommendation.summary || ''}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div style={{ padding: '50px 40px', textAlign: 'center', background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', borderRadius: 12, border: '2px dashed #d1d5db' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Sparkles size={32} color="white" />
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#374151' }}>AI Structure Analysis</h4>
              <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 14 }}>Let AI analyze your financing structure and recommend optimizations</p>
              <button onClick={fetchAIRecommendation} disabled={isLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}>
                <Sparkles size={18} />
                Get AI Recommendation
              </button>
            </div>
          )}
        </div>

        {/* ═══ SCENARIO COMPARISON TABLE ═══ */}
        {userStructure && Object.keys(altStructures).length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Calculator size={20} color="#374151" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Scenario Comparison</h3>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>Your structure vs common alternatives</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Structure</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Loan Amount</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Cash Required</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Monthly Payment</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Annual Cashflow</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>DSCR</th>
                    <th style={{ padding: 12, textAlign: 'right', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Cash on Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {/* User's structure — highlighted */}
                  <tr style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #4f46e5' }}>
                    <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{userStructure.name}</div>
                      <span style={{ fontSize: 10, color: '#4f46e5', fontWeight: 700 }}>★ YOUR STRUCTURE</span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{fmt(userStructure.totalLoanAmt)}</td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{fmt(userStructure.cashOutOfPocket)}</td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{fmt(userStructure.totalMonthlyPmt)}</td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: cfColor(userStructure.cashflow) }}>{fmt(userStructure.cashflow)}</td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: dscrColor(userStructure.dscr) }}>{userStructure.dscr.toFixed(2)}x</td>
                    <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: cocColor(userStructure.cashOnCash) }}>{pct(userStructure.cashOnCash)}</td>
                  </tr>
                  {/* Alternatives */}
                  {Object.entries(altStructures).map(([key, s]) => (
                    <tr key={key} style={{ backgroundColor: 'white' }}>
                      <td style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{s.desc}</div>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>{fmt(s.totalLoanAmt)}</td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>{fmt(s.cashOutOfPocket)}</td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>{fmt(s.totalMonthlyPmt)}</td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: cfColor(s.cashflow) }}>{fmt(s.cashflow)}</td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: dscrColor(s.dscr) }}>{s.dscr.toFixed(2)}x</td>
                      <td style={{ padding: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: cocColor(s.cashOnCash) }}>{pct(s.cashOnCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ DSCR SENSITIVITY ═══ */}
        {userStructure && purchasePrice > 0 && noi > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Activity size={20} color="#374151" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>DSCR Sensitivity</h3>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>How DSCR changes across LTV & rate scenarios</span>
            </div>
            {(() => {
              const seniorRate = userStructure.loanDetails?.[0]?.rate || 6.5;
              const baseRate = Number(seniorRate);
              const rates = [baseRate - 1.0, baseRate - 0.5, baseRate, baseRate + 0.5, baseRate + 1.0];
              const ltvs = [60, 65, 70, 75, 80, 85];
              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: 10, borderBottom: '2px solid #e5e7eb', fontWeight: 700, color: '#374151' }}>LTV ↓ / Rate →</th>
                        {rates.map((r, i) => (
                          <th key={i} style={{ padding: 10, borderBottom: '2px solid #e5e7eb', fontWeight: 700, color: Math.abs(r - baseRate) < 0.01 ? '#4f46e5' : '#374151', backgroundColor: Math.abs(r - baseRate) < 0.01 ? '#eff6ff' : '#f9fafb' }}>
                            {r.toFixed(2)}%{Math.abs(r - baseRate) < 0.01 ? ' ★' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ltvs.map(ltv => (
                        <tr key={ltv}>
                          <td style={{ padding: 10, borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#374151', backgroundColor: '#f9fafb' }}>{ltv}%</td>
                          {rates.map((r, ri) => {
                            const loan = purchasePrice * ltv / 100;
                            const mo = calcMonthlyPayment(loan, r, 360);
                            const annual = mo * 12;
                            const dscr = annual > 0 ? noi / annual : 0;
                            const isUserCell = Math.abs(r - baseRate) < 0.01 && Math.abs(ltv - userStructure.ltv) < 1;
                            return (
                              <td key={ri} style={{
                                padding: 10, borderBottom: '1px solid #e5e7eb', fontWeight: isUserCell ? 800 : 600,
                                color: dscrColor(dscr), backgroundColor: isUserCell ? '#eff6ff' : 'white',
                                border: isUserCell ? '2px solid #4f46e5' : undefined,
                              }}>
                                {dscr.toFixed(2)}x
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: 8, border: '1px dashed #3b82f6' }}>
              <div style={{ fontSize: 11, color: '#1e3a8a' }}>
                <strong>★</strong> = Your current position. <span style={{ color: '#10b981', fontWeight: 700 }}>Green</span> = DSCR ≥ 1.25x (strong). <span style={{ color: '#f59e0b', fontWeight: 700 }}>Yellow</span> = 1.0–1.25x (tight). <span style={{ color: '#ef4444', fontWeight: 700 }}>Red</span> = &lt; 1.0x (negative leverage).
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    </div>
  );
}
