import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Building, TrendingUp, Users, Calculator, 
  Sparkles, ChevronRight, AlertTriangle, CheckCircle, 
  Target, Wallet, PiggyBank, ArrowRight, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = "http://localhost:8010";

// Helper function to calculate monthly payment
const calcMonthlyPayment = (principal, annualRate, amortMonths) => {
  if (principal <= 0 || amortMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / amortMonths;
  return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
};

// Calculate all debt structures for comparison
const calculateAllStructures = (purchasePrice, noi, financing, capRate) => {
  const structures = {};
  
  // 1. TRADITIONAL
  const tradLTV = 75;
  const tradRate = 6.5;
  const tradLoanAmount = purchasePrice * tradLTV / 100;
  const tradDownPayment = purchasePrice - tradLoanAmount;
  const tradMonthly = calcMonthlyPayment(tradLoanAmount, tradRate, 360);
  const tradAnnualDebt = tradMonthly * 12;
  const tradCashflow = noi - tradAnnualDebt;
  const tradDSCR = tradAnnualDebt > 0 ? noi / tradAnnualDebt : 0;
  structures.traditional = {
    name: 'Traditional (Bank/Agency)',
    loanAmount: tradLoanAmount,
    downPayment: tradDownPayment,
    interestRate: tradRate,
    monthlyPayment: tradMonthly,
    annualDebtService: tradAnnualDebt,
    cashflow: tradCashflow,
    dscr: tradDSCR,
    cashOutOfPocket: tradDownPayment + (purchasePrice * 0.03), // + closing costs
    ltv: tradLTV
  };
  
  // 2. SELLER FINANCE
  const sfLTV = 85;
  const sfRate = 5.5;
  const sfLoanAmount = purchasePrice * sfLTV / 100;
  const sfDownPayment = purchasePrice - sfLoanAmount;
  const sfMonthly = calcMonthlyPayment(sfLoanAmount, sfRate, 240); // 20yr amort
  const sfAnnualDebt = sfMonthly * 12;
  const sfCashflow = noi - sfAnnualDebt;
  const sfDSCR = sfAnnualDebt > 0 ? noi / sfAnnualDebt : 0;
  structures['seller-finance'] = {
    name: 'Seller Finance',
    loanAmount: sfLoanAmount,
    downPayment: sfDownPayment,
    interestRate: sfRate,
    monthlyPayment: sfMonthly,
    annualDebtService: sfAnnualDebt,
    cashflow: sfCashflow,
    dscr: sfDSCR,
    cashOutOfPocket: sfDownPayment + (purchasePrice * 0.02),
    ltv: sfLTV
  };
  
  // 3. SUBJECT TO (assume existing loan at 60% of value, 4.5% rate from years ago)
  const subtoLoanBalance = purchasePrice * 0.60;
  const subtoRate = 4.5;
  const subtoMonthly = calcMonthlyPayment(subtoLoanBalance, subtoRate, 300); // ~25 yrs remaining
  const subtoAnnualDebt = subtoMonthly * 12;
  const subtoCashToSeller = purchasePrice * 0.10; // Equity pickup to seller
  const subtoCashflow = noi - subtoAnnualDebt;
  const subtoDSCR = subtoAnnualDebt > 0 ? noi / subtoAnnualDebt : 0;
  structures['subject-to'] = {
    name: 'Subject To',
    loanAmount: subtoLoanBalance,
    downPayment: subtoCashToSeller,
    interestRate: subtoRate,
    monthlyPayment: subtoMonthly,
    annualDebtService: subtoAnnualDebt,
    cashflow: subtoCashflow,
    dscr: subtoDSCR,
    cashOutOfPocket: subtoCashToSeller,
    ltv: 60,
    note: 'Taking over existing financing'
  };
  
  // 4. HYBRID (Subject To + Seller Carry gap)
  const hybridSubtoBalance = purchasePrice * 0.55;
  const hybridSellerCarry = purchasePrice * 0.25;
  const hybridCashDown = purchasePrice * 0.20;
  const hybridSubtoRate = 4.5;
  const hybridSellerRate = 5.0;
  const hybridSubtoMonthly = calcMonthlyPayment(hybridSubtoBalance, hybridSubtoRate, 300);
  const hybridSellerMonthly = hybridSellerCarry * hybridSellerRate / 100 / 12; // IO
  const hybridTotalMonthly = hybridSubtoMonthly + hybridSellerMonthly;
  const hybridAnnualDebt = hybridTotalMonthly * 12;
  const hybridCashflow = noi - hybridAnnualDebt;
  const hybridDSCR = hybridAnnualDebt > 0 ? noi / hybridAnnualDebt : 0;
  structures['hybrid'] = {
    name: 'Hybrid (SubTo + Seller Carry)',
    loanAmount: hybridSubtoBalance + hybridSellerCarry,
    downPayment: hybridCashDown,
    interestRate: (hybridSubtoRate + hybridSellerRate) / 2,
    monthlyPayment: hybridTotalMonthly,
    annualDebtService: hybridAnnualDebt,
    cashflow: hybridCashflow,
    dscr: hybridDSCR,
    cashOutOfPocket: hybridCashDown,
    ltv: 80,
    subtoAmount: hybridSubtoBalance,
    sellerCarryAmount: hybridSellerCarry
  };
  
  // 5. EQUITY PARTNER
  const epLTV = 75;
  const epRate = 6.5;
  const epLoanAmount = purchasePrice * epLTV / 100;
  const epTotalEquity = purchasePrice - epLoanAmount;
  const epPartnerEquity = epTotalEquity * 0.95;
  const epYourEquity = epTotalEquity * 0.05;
  const epPartnerPref = epPartnerEquity * 0.08; // 8% pref
  const epLoanMonthly = calcMonthlyPayment(epLoanAmount, epRate, 360);
  const epTotalMonthly = epLoanMonthly + (epPartnerPref / 12);
  const epAnnualDebt = epTotalMonthly * 12;
  const epCashflow = noi - epAnnualDebt;
  const epDSCR = (epLoanMonthly * 12) > 0 ? noi / (epLoanMonthly * 12) : 0;
  structures['equity-partner'] = {
    name: 'Equity Partner',
    loanAmount: epLoanAmount,
    downPayment: epTotalEquity,
    interestRate: epRate,
    monthlyPayment: epTotalMonthly,
    annualDebtService: epAnnualDebt,
    cashflow: epCashflow,
    dscr: epDSCR,
    cashOutOfPocket: epYourEquity + (purchasePrice * 0.01), // Your 5% + some closing
    ltv: epLTV,
    partnerContribution: epPartnerEquity,
    partnerPref: epPartnerPref,
    yourEquity: epYourEquity
  };
  
  // 6. SELLER CARRY (Bank + Seller 2nd)
  const scBankLTV = 70;
  const scSellerPct = 15;
  const scBankRate = 6.5;
  const scSellerRate = 5.0;
  const scBankLoan = purchasePrice * scBankLTV / 100;
  const scSellerCarry = purchasePrice * scSellerPct / 100;
  const scCashDown = purchasePrice - scBankLoan - scSellerCarry;
  const scBankMonthly = calcMonthlyPayment(scBankLoan, scBankRate, 360);
  const scSellerMonthly = scSellerCarry * scSellerRate / 100 / 12; // IO
  const scTotalMonthly = scBankMonthly + scSellerMonthly;
  const scAnnualDebt = scTotalMonthly * 12;
  const scCashflow = noi - scAnnualDebt;
  const scDSCR = (scBankMonthly * 12) > 0 ? noi / (scBankMonthly * 12) : 0; // Bank DSCR
  structures['seller-carry'] = {
    name: 'Seller Carry (Bank + Seller 2nd)',
    loanAmount: scBankLoan + scSellerCarry,
    downPayment: scCashDown,
    interestRate: scBankRate,
    monthlyPayment: scTotalMonthly,
    annualDebtService: scAnnualDebt,
    cashflow: scCashflow,
    dscr: scDSCR,
    cashOutOfPocket: scCashDown + (purchasePrice * 0.02),
    ltv: scBankLTV + scSellerPct,
    bankLoan: scBankLoan,
    sellerCarryAmount: scSellerCarry,
    sellerCarryRate: scSellerRate
  };

  // 7. LEASE OPTION (control now, finance later)
  const optionFee = purchasePrice * 0.03; // 3% option fee
  const leaseMonthlyRent = noi / 12; // approximate using NOI
  const leaseAnnualDebt = leaseMonthlyRent * 12; // treated as "debt" for coverage math
  const leaseCashflow = noi - leaseAnnualDebt; // typically ~0 by design
  const leaseDSCR = leaseAnnualDebt > 0 ? noi / leaseAnnualDebt : 0;
  structures['lease-option'] = {
    name: 'Lease Option',
    loanAmount: 0,
    downPayment: optionFee,
    interestRate: 0,
    monthlyPayment: leaseMonthlyRent,
    annualDebtService: leaseAnnualDebt,
    cashflow: leaseCashflow,
    dscr: leaseDSCR,
    cashOutOfPocket: optionFee,
    ltv: 0,
    note: 'Control the property with an option fee and rent credits; finance at exercise.'
  };
  
  return structures;
};

// Format currency
const fmt = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

// Format percentage
const pct = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  return `${val.toFixed(2)}%`;
};

export default function DealStructureTab({ scenarioData, calculations, fullCalcs, marketCapRate, onRecommendationChange, onSelectedStructureMetricsChange }) {
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allStructures, setAllStructures] = useState(null);

  const subjectToAvailable = scenarioData?.deal_setup?.subject_to_available !== false;
  
  // Extract key data - USE FULLCALCS AS PRIMARY SOURCE FOR CONSISTENCY
  const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
  // CRITICAL: Use fullCalcs.year1.noi as primary source to match Summary and Proforma tabs
  const noi = fullCalcs?.year1?.noi || scenarioData?.pnl?.noi_t12 || scenarioData?.pnl?.noi || 0;
  const financing = scenarioData?.financing || {};
  const debtStructure = scenarioData?.deal_setup?.debt_structure || financing?.debt_structure || 'traditional';
  const goingInCapRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 5.5;
  
  // Use market cap rate for exit valuation if available, otherwise use going-in cap rate
  const exitCapRate = marketCapRate?.market_cap_rate || goingInCapRate;
  
  // Proforma NOI for value-add analysis - use fullCalcs if available
  const proformaNOI = fullCalcs?.stabilized?.noi || scenarioData?.proforma?.projected_noi || noi * 1.15; // Default 15% upside
  const asIsValue = goingInCapRate > 0 ? noi / (goingInCapRate / 100) : purchasePrice;
  const stabilizedValue = exitCapRate > 0 ? proformaNOI / (exitCapRate / 100) : purchasePrice * 1.15;
  const valueAdd = stabilizedValue - asIsValue;
  
  // Calculate all structures on load
  useEffect(() => {
    if (purchasePrice > 0 && noi > 0) {
      const structures = calculateAllStructures(purchasePrice, noi, financing, goingInCapRate);
      setAllStructures(structures);
    }
  }, [purchasePrice, noi, financing, goingInCapRate]);
  
  // Get user's preferred structure data
  const userStructure = allStructures?.[debtStructure] || null;

  // Compute quick health metrics for UI + parent consumers
  const userCashOnCash = userStructure && userStructure.cashOutOfPocket > 0
    ? (userStructure.cashflow / userStructure.cashOutOfPocket) * 100
    : 0;

  // Derive a simple AI-style verdict + confidence score from structure metrics
  let verdictLabel = 'Load a deal to see AI verdict';
  let verdictSubtitle = 'Upload or auto-fill a deal to unlock structure insights.';
  let verdictTheme = {
    background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
    textColor: '#111827',
    badgeBg: '#111827',
    badgeColor: '#ffffff',
    confidenceAccent: '#4b5563',
  };
  let confidenceScore = null;

  if (userStructure) {
    const dscr = userStructure.dscr || 0;
    const coc = userCashOnCash || 0;

    // Simple heuristic buckets similar to "Strong Buy" / "Avoid" UI
    if (dscr >= 1.3 && coc >= 10) {
      verdictLabel = 'Strong Buy';
      verdictSubtitle = 'Debt coverage and cash-on-cash look strong for this deal.';
      verdictTheme = {
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 45%, #0f766e 100%)',
        textColor: '#ecfdf5',
        badgeBg: '#f0fdf4',
        badgeColor: '#16a34a',
        confidenceAccent: '#bbf7d0',
      };
      confidenceScore = 92;
    } else if (dscr < 1.0 || coc < 4) {
      verdictLabel = 'Avoid';
      verdictSubtitle = 'Current structure struggles to cover debt or generate enough cash flow.';
      verdictTheme = {
        background: 'linear-gradient(135deg, #f97373 0%, #ef4444 40%, #991b1b 100%)',
        textColor: '#fef2f2',
        badgeBg: '#fef2f2',
        badgeColor: '#b91c1c',
        confidenceAccent: '#fecaca',
      };
      confidenceScore = 28;
    } else {
      verdictLabel = 'Watch Closely';
      verdictSubtitle = 'Borderline coverage and returns – may work with tighter execution or better pricing.';
      verdictTheme = {
        background: 'linear-gradient(135deg, #facc15 0%, #eab308 40%, #b45309 100%)',
        textColor: '#fefce8',
        badgeBg: '#fefce8',
        badgeColor: '#854d0e',
        confidenceAccent: '#fef3c7',
      };
      confidenceScore = 68;
    }
  }

  // Lift selected structure metrics to parent for use in Deal Execution
  useEffect(() => {
    if (!userStructure) return;
    const selectedMetrics = {
      name: userStructure.name,
      key: debtStructure,
      annualCashFlow: userStructure.cashflow,
      cashOnCash: userCashOnCash,
      dscr: userStructure.dscr,
      capRate: goingInCapRate,
    };
    if (onSelectedStructureMetricsChange) {
      onSelectedStructureMetricsChange(selectedMetrics);
    }
  }, [userStructure, debtStructure, goingInCapRate, onSelectedStructureMetricsChange, userCashOnCash]);
  
  // Fetch AI recommendation
  const fetchAIRecommendation = async () => {
    // Check token balance first
    try {
      const tokenCheck = await fetch('http://localhost:8010/api/tokens/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_type: 'deal_structure_analysis' })
      });
      
      const tokenData = await tokenCheck.json();
      
      if (!tokenData.has_tokens) {
        const userConfirmed = window.confirm(
          `This will use AI to analyze all deal structures.\n\n` +
          `Cost: ${tokenData.tokens_required} token\n` +
          `Your balance: ${tokenData.token_balance} tokens\n\n` +
          `You need more tokens. Check your Dashboard Profile to upgrade.`
        );
        return;
      }
      
      // Confirm token usage
      const userConfirmed = window.confirm(
        `This will use AI to analyze all deal structures.\n\n` +
        `Cost: ${tokenData.tokens_required} token\n` +
        `Your balance: ${tokenData.token_balance} tokens\n\n` +
        `Continue?`
      );
      
      if (!userConfirmed) return;
      
    } catch (err) {
      console.error('Token check failed:', err);
      setError('Failed to check token balance. Please try again.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare all structure calculations for the LLM
      const structureComparison = Object.entries(allStructures || {}).map(([key, s]) => ({
        key,
        structure: s.name,
        loanAmount: s.loanAmount,
        downPayment: s.downPayment,
        cashOutOfPocket: s.cashOutOfPocket,
        monthlyPayment: s.monthlyPayment,
        annualDebtService: s.annualDebtService,
        annualCashflow: s.cashflow,
        monthlyCashflow: s.cashflow / 12,
        dscr: s.dscr,
        cashOnCash: s.cashOutOfPocket > 0 ? (s.cashflow / s.cashOutOfPocket) * 100 : 0
      }));

      const comparisonForAI = subjectToAvailable
        ? structureComparison
        : structureComparison.filter(s => s.key !== 'subject-to' && s.key !== 'hybrid');
      
      // Build comprehensive deal data for LLM
      const dealData = {
        property: {
          address: scenarioData?.property?.address || 'Unknown',
          units: scenarioData?.property?.total_units || 0,
          yearBuilt: scenarioData?.property?.year_built || 'Unknown',
          type: scenarioData?.property?.property_type || 'Multifamily'
        },
        financials: {
          purchasePrice,
          currentNOI: noi,
          proformaNOI,
          asIsValue,
          stabilizedValue,
          valueAddPotential: valueAdd,
          goingInCapRate,
          exitCapRate,
          marketCapRate: marketCapRate?.market_cap_rate || null
        },
        structures: comparisonForAI,
        userPreferredStructure: debtStructure
      };
      
      const response = await fetch(`${API_BASE}/api/deal-structure/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI recommendation');
      }
      
      const data = await response.json();

      // Post-process recommendation: if Subject To / Hybrid are disabled,
      // never allow them to be the final pick.
      if (data.recommendation) {
        let recKey = data.recommendation.recommendedStructure;

        if (!subjectToAvailable && (recKey === 'subject-to' || recKey === 'hybrid')) {
          const allowed = structureComparison.filter(s => s.key !== 'subject-to' && s.key !== 'hybrid');
          if (allowed.length > 0) {
            const ranked = [...allowed].sort((a, b) => {
              const scoreA = (a.dscr >= 1.2 ? 100 : 0) + a.cashOnCash;
              const scoreB = (b.dscr >= 1.2 ? 100 : 0) + b.cashOnCash;
              return scoreB - scoreA;
            });
            recKey = ranked[0].key;
            data.recommendation = {
              ...data.recommendation,
              recommendedStructure: recKey,
              summary:
                (data.recommendation.summary || '') +
                '\n\nNote: Subject To / Hybrid were disabled for this deal, so the assistant recommended the strongest alternative structure instead.'
            };
          }
        }
      }

      setAiRecommendation(data.recommendation);
      
      // Notify parent of the recommended structure
      if (onRecommendationChange && data.recommendation?.recommendedStructure) {
        // Map the key to a user-friendly name
        const structureNames = {
          'traditional': 'Traditional Financing',
          'seller-finance': 'Seller Financing',
          'subject-to': 'Subject To',
          'hybrid': 'Hybrid (SubTo + Seller Carry)',
          'equity-partner': 'Equity Partner',
          'seller-carry': 'Seller Carry (Bank + Seller 2nd)',
          'lease-option': 'Lease Option'
        };
        const structureName = structureNames[data.recommendation.recommendedStructure] || data.recommendation.recommendedStructure;
        onRecommendationChange(structureName);
      }
    } catch (err) {
      console.error('AI Recommendation error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Structure detail card component
  const StructureDetailCard = ({ structure, title, isRecommended = false }) => {
    if (!structure) return null;
    
    const cashOnCash = structure.cashOutOfPocket > 0 
      ? (structure.cashflow / structure.cashOutOfPocket) * 100 
      : 0;
    
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '22px 24px',
          border: isRecommended ? '2px solid #22c55e' : '2px solid #4f46e5',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          {isRecommended ? (
            <Sparkles size={20} color="#10b981" />
          ) : (
            <Building size={20} color="#6b7280" />
          )}
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
            {title}
          </h4>
          {isRecommended && (
            <span style={{
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '9999px',
              marginLeft: 'auto'
            }}>
              RECOMMENDED
            </span>
          )}
        </div>
        
        {/* Structure Name */}
        <div
          style={{
            backgroundColor: isRecommended ? '#dcfce7' : '#eff6ff',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: isRecommended ? '#166534' : '#1d4ed8',
            }}
          >
            {structure.name}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>{title}</div>
        </div>
        
        {/* Financing Breakdown */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Financing Breakdown
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Total Loan Amount</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{fmt(structure.loanAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Down Payment</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{fmt(structure.downPayment)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Interest Rate</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{pct(structure.interestRate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>LTV</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{pct(structure.ltv)}</span>
            </div>
            
            {/* Special fields for certain structures */}
            {structure.partnerContribution && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: '#1e40af' }}>Partner Contribution</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>{fmt(structure.partnerContribution)}</span>
              </div>
            )}
            {structure.sellerCarryAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f3e8ff', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b21a8' }}>Seller Carry</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b21a8' }}>{fmt(structure.sellerCarryAmount)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Debt Service */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Debt Service
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#92400e' }}>Monthly Payment</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>{fmt(structure.monthlyPayment)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#92400e' }}>Annual Debt Service</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>{fmt(structure.annualDebtService)}</span>
            </div>
          </div>
        </div>
        
        {/* Performance Metrics */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Performance
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: structure.cashflow >= 0 ? '#ecfdf5' : '#fef2f2', 
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Annual Cashflow</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: structure.cashflow >= 0 ? '#10b981' : '#ef4444' }}>
                {fmt(structure.cashflow)}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {fmt(structure.cashflow / 12)}/mo
              </div>
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: structure.dscr >= 1.25 ? '#ecfdf5' : structure.dscr >= 1.0 ? '#fef3c7' : '#fef2f2', 
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>DSCR</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: structure.dscr >= 1.25 ? '#10b981' : structure.dscr >= 1.0 ? '#f59e0b' : '#ef4444' }}>
                {structure.dscr.toFixed(2)}x
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {structure.dscr >= 1.25 ? '✓ Strong' : structure.dscr >= 1.0 ? '⚠ Tight' : '✗ Negative'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f3f4f6', 
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cash on Cash</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: cashOnCash >= 8 ? '#10b981' : '#374151' }}>
                {pct(cashOnCash)}
              </div>
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#dbeafe', 
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>Cash Out of Pocket</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>
                {fmt(structure.cashOutOfPocket)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Verdict banner - Strong Buy / Avoid style */}
        <div
          style={{
            ...{
              marginBottom: '20px',
              borderRadius: '16px',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
            },
            background: verdictTheme.background,
            color: verdictTheme.textColor,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                backgroundColor: verdictTheme.badgeBg,
                color: verdictTheme.badgeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  opacity: 0.9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                AI Deal Verdict
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: 2 }}>{verdictLabel}</div>
              <div style={{ fontSize: '13px', marginTop: 4, maxWidth: 520 }}>{verdictSubtitle}</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                opacity: 0.9,
              }}
            >
              {confidenceScore != null ? 'Confidence' : 'Status'}
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                marginTop: 4,
                color: verdictTheme.confidenceAccent,
              }}
            >
              {confidenceScore != null ? `${confidenceScore}%` : 'Waiting...'}
            </div>
            <div style={{ fontSize: '11px', marginTop: 4, opacity: 0.9 }}>
              Based on structure DSCR and cash-on-cash
            </div>
          </div>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '14px',
            marginRight: '12px',
          }}>
            <DollarSign size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Deal Structure Analysis
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Compare your preferred structure vs AI-recommended optimal structure
            </p>
          </div>
          {aiRecommendation && (
            <button
              onClick={fetchAIRecommendation}
              disabled={isLoading}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          )}
        </div>
        
        {/* Value-Add Summary Bar - light card with blue outline (equity-style UI) */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '24px 28px',
            marginBottom: '24px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
            border: '2px solid #4f46e5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <TrendingUp size={20} color="#4f46e5" />
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#111827',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Value-Add Analysis
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current NOI</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>{fmt(noi)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#ecfdf5', 
              borderRadius: '12px',
              border: '1px solid #6ee7b7'
            }}>
              <div style={{ fontSize: '11px', color: '#047857', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proforma NOI</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#047857' }}>{fmt(proformaNOI)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>As-Is Value</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>{fmt(asIsValue)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#eff6ff', 
              borderRadius: '12px',
              border: '1px solid #60a5fa'
            }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forced Appreciation</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#1d4ed8' }}>{fmt(valueAdd)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f5f3ff', 
              borderRadius: '12px',
              border: '1px solid #a855f7'
            }}>
              <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#6b21a8' }}>{fmt(stabilizedValue)}</div>
            </div>
          </div>
          
          {/* Cap Rate Comparison Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Going-In Cap Rate</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827' }}>{pct(goingInCapRate)}</div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Your Basis</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: marketCapRate ? '#e0f2fe' : '#f9fafb', 
              borderRadius: '12px',
              border: marketCapRate ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: marketCapRate ? '#0369a1' : '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Market Cap Rate {marketCapRate ? '✓' : ''}
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: marketCapRate ? '#0ea5e9' : '#9ca3af' }}>
                {marketCapRate ? pct(marketCapRate.market_cap_rate) : 'Loading...'}
              </div>
              <div style={{ fontSize: '10px', color: marketCapRate ? '#0369a1' : '#9ca3af', marginTop: '4px' }}>
                {marketCapRate ? `${marketCapRate.asset_class} Class • ${marketCapRate.confidence} confidence` : 'LLM Estimate'}
              </div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#ecfdf5' : '#fef2f2', 
              borderRadius: '12px',
              border: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '2px solid #10b981' : '2px solid #ef4444',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#047857' : '#b91c1c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spread
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#10b981' : '#ef4444' }}>
                {marketCapRate ? `${(goingInCapRate - marketCapRate.market_cap_rate) > 0 ? '+' : ''}${(goingInCapRate - marketCapRate.market_cap_rate).toFixed(2)}%` : '-'}
              </div>
              <div style={{ fontSize: '10px', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#047857' : '#b91c1c', marginTop: '4px', fontWeight: '600' }}>
                {marketCapRate ? (goingInCapRate > marketCapRate.market_cap_rate ? '✓ Buying Below Market' : '⚠ Above Market') : '-'}
              </div>
            </div>
          </div>
          
          <div
            style={{
              marginTop: '18px',
              padding: '14px 16px',
              backgroundColor: '#eff6ff',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1px dashed #3b82f6',
            }}
          >
            <Target size={18} color="#1d4ed8" />
            <span style={{ fontSize: '13px', color: '#1e3a8a' }}>
              <strong style={{ color: '#1d4ed8' }}>Value Creation:</strong> NOI ÷ Cap Rate = Value. Increase NOI by {fmt(
                proformaNOI - noi,
              )} to create {fmt(valueAdd)} in equity at {marketCapRate
                ? pct(marketCapRate.market_cap_rate)
                : pct(goingInCapRate)}{' '}
              cap.
            </span>
          </div>
        </div>
        
        {/* Two-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* LEFT: User's Preferred Structure */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Wallet size={20} color="#6b7280" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#374151' }}>
                Your Preferred Structure
              </h3>
            </div>
            {userStructure ? (
              <StructureDetailCard structure={userStructure} title="Your Selection" />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f3f4f6', borderRadius: '12px' }}>
                <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#6b7280' }}>Unable to load structure details</p>
              </div>
            )}
          </div>
          
          {/* RIGHT: AI Recommended Structure */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#374151' }}>
                AI Recommended Structure
              </h3>
            </div>
            
            {isLoading ? (
              <div style={{ 
                padding: '60px', 
                textAlign: 'center', 
                backgroundColor: 'white', 
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <div className="spin" style={{ display: 'inline-block', marginBottom: '16px' }}>
                  <Sparkles size={32} color="#6366f1" />
                </div>
                <p style={{ color: '#6b7280', margin: 0 }}>Analyzing all deal structures...</p>
                <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>
                  Calculating cashflow, DSCR, and value-add for each option
                </p>
              </div>
            ) : error ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                backgroundColor: '#fef2f2', 
                borderRadius: '12px',
                border: '1px solid #fecaca'
              }}>
                <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
                <button
                  onClick={fetchAIRecommendation}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </div>
            ) : aiRecommendation ? (
              <div>
                {/* Show recommended structure card */}
                {allStructures && aiRecommendation.recommendedStructure && allStructures[aiRecommendation.recommendedStructure] && (
                  <StructureDetailCard 
                    structure={allStructures[aiRecommendation.recommendedStructure]} 
                    title="AI Recommendation"
                    isRecommended={true}
                  />
                )}
                
                {/* AI Summary */}
                <div style={{
                  marginTop: '16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Sparkles size={16} color="#6366f1" />
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#374151' }}>
                      AI Analysis
                    </h4>
                  </div>
                  <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
                    <ReactMarkdown>{aiRecommendation.summary || ''}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ 
                padding: '60px 40px', 
                textAlign: 'center', 
                backgroundColor: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                borderRadius: '12px',
                border: '2px dashed #d1d5db'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <Sparkles size={32} color="white" />
                </div>
                <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#374151' }}>
                  AI Structure Analysis
                </h4>
                <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
                  Let AI analyze all 7 financing structures and recommend the optimal one based on your deal metrics
                </p>
                <button
                  onClick={fetchAIRecommendation}
                  disabled={isLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  <Sparkles size={18} />
                  Get AI Recommendation
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* All Structures Comparison Table */}
        {allStructures && (
          <div style={{
            marginTop: '32px',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Calculator size={20} color="#374151" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                All Structures Comparison
              </h3>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Structure</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Loan Amount</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Cash Required</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Monthly Payment</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Annual Cashflow</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>DSCR</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Cash on Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(allStructures).map(([key, s]) => {
                    const isPreferred = key === debtStructure;
                    const isRecommended = aiRecommendation?.recommendedStructure === key;
                    const coc = s.cashOutOfPocket > 0 ? (s.cashflow / s.cashOutOfPocket) * 100 : 0;
                    
                    return (
                      <tr 
                        key={key}
                        style={{ 
                          backgroundColor: isRecommended ? '#f0fdf4' : isPreferred ? '#f0f9ff' : 'white',
                          borderLeft: isRecommended ? '4px solid #10b981' : isPreferred ? '4px solid #3b82f6' : '4px solid transparent'
                        }}
                      >
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                          <div style={{ fontWeight: '600', color: '#111827' }}>{s.name}</div>
                          {isRecommended && <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>✓ RECOMMENDED</span>}
                          {isPreferred && !isRecommended && <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '700' }}>★ YOUR CHOICE</span>}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{fmt(s.loanAmount)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{fmt(s.cashOutOfPocket)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{fmt(s.monthlyPayment)}</td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right', 
                          borderBottom: '1px solid #e5e7eb', 
                          fontWeight: '700',
                          color: s.cashflow >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {fmt(s.cashflow)}
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right', 
                          borderBottom: '1px solid #e5e7eb', 
                          fontWeight: '600',
                          color: s.dscr >= 1.25 ? '#10b981' : s.dscr >= 1.0 ? '#f59e0b' : '#ef4444'
                        }}>
                          {s.dscr.toFixed(2)}x
                        </td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right', 
                          borderBottom: '1px solid #e5e7eb', 
                          fontWeight: '600',
                          color: coc >= 8 ? '#10b981' : '#374151'
                        }}>
                          {pct(coc)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
