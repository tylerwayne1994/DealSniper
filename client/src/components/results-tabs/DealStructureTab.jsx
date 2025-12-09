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

export default function DealStructureTab({ scenarioData, calculations, fullCalcs, marketCapRate }) {
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allStructures, setAllStructures] = useState(null);
  
  // Extract key data
  const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
  const noi = scenarioData?.pnl?.noi || fullCalcs?.year1?.noi || 0;
  const financing = scenarioData?.financing || {};
  const debtStructure = scenarioData?.deal_setup?.debt_structure || financing?.debt_structure || 'traditional';
  const goingInCapRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 5.5;
  
  // Use market cap rate for exit valuation if available, otherwise use going-in cap rate
  const exitCapRate = marketCapRate?.market_cap_rate || goingInCapRate;
  
  // Proforma NOI for value-add analysis
  const proformaNOI = scenarioData?.proforma?.projected_noi || noi * 1.15; // Default 15% upside
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
  
  // Fetch AI recommendation
  const fetchAIRecommendation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare all structure calculations for the LLM
      const structureComparison = Object.entries(allStructures || {}).map(([key, s]) => ({
        structure: s.name,
        key,
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
        structures: structureComparison,
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
      setAiRecommendation(data.recommendation);
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
      <div style={{
        backgroundColor: isRecommended ? '#f0fdf4' : '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: isRecommended ? '2px solid #10b981' : '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
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
        <div style={{
          backgroundColor: isRecommended ? '#dcfce7' : '#f3f4f6',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: isRecommended ? '#166534' : '#374151' }}>
            {structure.name}
          </div>
        </div>
        
        {/* Financing Breakdown */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
            Financing Breakdown
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Total Loan Amount</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{fmt(structure.loanAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Down Payment</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{fmt(structure.downPayment)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Interest Rate</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{pct(structure.interestRate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>LTV</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{pct(structure.ltv)}</span>
            </div>
            
            {/* Special fields for certain structures */}
            {structure.partnerContribution && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px' }}>
                <span style={{ fontSize: '13px', color: '#1e40af' }}>Partner Contribution</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>{fmt(structure.partnerContribution)}</span>
              </div>
            )}
            {structure.sellerCarryAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f3e8ff', borderRadius: '6px' }}>
                <span style={{ fontSize: '13px', color: '#6b21a8' }}>Seller Carry</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b21a8' }}>{fmt(structure.sellerCarryAmount)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Debt Service */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
            Debt Service
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#92400e' }}>Monthly Payment</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>{fmt(structure.monthlyPayment)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', color: '#92400e' }}>Annual Debt Service</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>{fmt(structure.annualDebtService)}</span>
            </div>
          </div>
        </div>
        
        {/* Performance Metrics */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
            Performance
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: structure.cashflow >= 0 ? '#f0fdf4' : '#fef2f2', 
              borderRadius: '8px',
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
              backgroundColor: structure.dscr >= 1.25 ? '#f0fdf4' : structure.dscr >= 1.0 ? '#fef3c7' : '#fef2f2', 
              borderRadius: '8px',
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
              borderRadius: '8px',
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
              borderRadius: '8px',
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
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
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
            marginRight: '12px'
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
                opacity: isLoading ? 0.7 : 1
              }}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
              {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          )}
        </div>
        
        {/* Value-Add Summary Bar - Dark Theme */}
        <div style={{
          backgroundColor: '#111827',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <TrendingUp size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Value-Add Analysis
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#1e293b', 
              borderRadius: '12px',
              border: '1px solid #334155'
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current NOI</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>{fmt(noi)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#064e3b', 
              borderRadius: '12px',
              border: '1px solid #065f46'
            }}>
              <div style={{ fontSize: '11px', color: '#6ee7b7', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proforma NOI</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>{fmt(proformaNOI)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#1e293b', 
              borderRadius: '12px',
              border: '1px solid #334155'
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>As-Is Value</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>{fmt(asIsValue)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#1e3a5f', 
              borderRadius: '12px',
              border: '1px solid #1e40af'
            }}>
              <div style={{ fontSize: '11px', color: '#93c5fd', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forced Appreciation</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#60a5fa' }}>{fmt(valueAdd)}</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#4c1d95', 
              borderRadius: '12px',
              border: '1px solid #6d28d9'
            }}>
              <div style={{ fontSize: '11px', color: '#c4b5fd', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#a78bfa' }}>{fmt(stabilizedValue)}</div>
            </div>
          </div>
          
          {/* Cap Rate Comparison Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#1e293b', 
              borderRadius: '12px',
              border: '1px solid #334155',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Going-In Cap Rate</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'white' }}>{pct(goingInCapRate)}</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Your Basis</div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: marketCapRate ? '#0c4a6e' : '#1e293b', 
              borderRadius: '12px',
              border: marketCapRate ? '2px solid #0ea5e9' : '1px solid #334155',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: marketCapRate ? '#7dd3fc' : '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Market Cap Rate {marketCapRate ? '✓' : ''}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: marketCapRate ? '#38bdf8' : '#64748b' }}>
                {marketCapRate ? pct(marketCapRate.market_cap_rate) : 'Loading...'}
              </div>
              <div style={{ fontSize: '10px', color: marketCapRate ? '#7dd3fc' : '#64748b', marginTop: '4px' }}>
                {marketCapRate ? `${marketCapRate.asset_class} Class • ${marketCapRate.confidence} confidence` : 'LLM Estimate'}
              </div>
            </div>
            <div style={{ 
              padding: '16px', 
              backgroundColor: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#064e3b' : '#7f1d1d', 
              borderRadius: '12px',
              border: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '2px solid #10b981' : '2px solid #ef4444',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#6ee7b7' : '#fca5a5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spread
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#10b981' : '#ef4444' }}>
                {marketCapRate ? `${(goingInCapRate - marketCapRate.market_cap_rate) > 0 ? '+' : ''}${(goingInCapRate - marketCapRate.market_cap_rate).toFixed(2)}%` : '-'}
              </div>
              <div style={{ fontSize: '10px', color: marketCapRate && (goingInCapRate > marketCapRate.market_cap_rate) ? '#6ee7b7' : '#fca5a5', marginTop: '4px', fontWeight: '600' }}>
                {marketCapRate ? (goingInCapRate > marketCapRate.market_cap_rate ? '✓ Buying Below Market' : '⚠ Above Market') : '-'}
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '16px', padding: '14px 16px', backgroundColor: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #fbbf24' }}>
            <Target size={18} color="#fbbf24" />
            <span style={{ fontSize: '13px', color: '#fcd34d' }}>
              <strong style={{ color: '#fbbf24' }}>Value Creation:</strong> NOI ÷ Cap Rate = Value. Increase NOI by {fmt(proformaNOI - noi)} to create {fmt(valueAdd)} in equity at {marketCapRate ? pct(marketCapRate.market_cap_rate) : pct(goingInCapRate)} cap.
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
                  Let AI analyze all 6 financing structures and recommend the optimal one based on your deal metrics
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
