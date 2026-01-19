import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Calculator,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  FileText,
  Phone,
  Mail,
  Layers,
  ArrowRight,
  Rocket,
  Sparkles
} from 'lucide-react';
import { saveDeal } from '../../lib/dealsService';

// ============================================================================
// Helper Functions
// ============================================================================

const fmt = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return '$' + Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const fmtPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toFixed(2) + '%';
};

const fmtNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toLocaleString();
};

// ============================================================================
// Rule-Based Deal Summary Generator (No LLM)
// ============================================================================

const generateDealSummary = (data) => {
  const {
    propertyName,
    address,
    units,
    purchasePrice,
    capRate,
    cashOnCash,
    dscr,
    ltv,
    noi,
    pricePerUnit,
    occupancyRate,
    interestRate,
    holdingPeriod,
    stabilizedValue,
    totalEquityRequired,
    refiValue,
    cashOutRefi
  } = data;

  const summaryParts = [];

  // Opening
  summaryParts.push(`**${propertyName || 'This property'}** located at ${address || 'the specified address'} presents `);

  // Cap Rate Assessment
  if (capRate >= 7) {
    summaryParts.push(`a compelling acquisition opportunity with an attractive going-in cap rate of ${capRate.toFixed(2)}%. `);
  } else if (capRate >= 5) {
    summaryParts.push(`a solid acquisition opportunity with a market-rate cap rate of ${capRate.toFixed(2)}%. `);
  } else if (capRate > 0) {
    summaryParts.push(`an acquisition opportunity with a compressed cap rate of ${capRate.toFixed(2)}%, typical of core markets. `);
  } else {
    summaryParts.push(`an acquisition opportunity requiring further cap rate analysis. `);
  }

  // Cash-on-Cash Assessment
  if (cashOnCash >= 12) {
    summaryParts.push(`The projected cash-on-cash return of ${cashOnCash.toFixed(2)}% is exceptional, significantly exceeding typical investor thresholds. `);
  } else if (cashOnCash >= 8) {
    summaryParts.push(`The projected cash-on-cash return of ${cashOnCash.toFixed(2)}% meets strong investor return requirements. `);
  } else if (cashOnCash >= 5) {
    summaryParts.push(`The projected cash-on-cash return of ${cashOnCash.toFixed(2)}% is moderate and may benefit from value-add strategies. `);
  } else if (cashOnCash > 0) {
    summaryParts.push(`The projected cash-on-cash return of ${cashOnCash.toFixed(2)}% is below typical thresholds and warrants careful consideration. `);
  } else {
    summaryParts.push(`Cash-on-cash return analysis indicates potential negative cash flow in year one, requiring bridge financing or value-add execution. `);
  }

  // DSCR Assessment
  if (dscr >= 1.5) {
    summaryParts.push(`With a debt service coverage ratio of ${dscr.toFixed(2)}x, the property demonstrates excellent debt serviceability and lender comfort. `);
  } else if (dscr >= 1.25) {
    summaryParts.push(`The DSCR of ${dscr.toFixed(2)}x meets conventional lending requirements with adequate cushion. `);
  } else if (dscr >= 1.0) {
    summaryParts.push(`The DSCR of ${dscr.toFixed(2)}x is tight and may require interest reserves or additional equity. `);
  } else if (dscr > 0) {
    summaryParts.push(`⚠️ The DSCR of ${dscr.toFixed(2)}x indicates negative leverage - debt service exceeds NOI. Creative financing may be required. `);
  }

  // Price Per Unit Assessment (for multifamily)
  if (units > 0 && pricePerUnit > 0) {
    if (pricePerUnit < 75000) {
      summaryParts.push(`At ${fmt(pricePerUnit)} per unit, this represents a deep value-add opportunity in a secondary or tertiary market. `);
    } else if (pricePerUnit < 125000) {
      summaryParts.push(`The ${fmt(pricePerUnit)} per unit basis provides strong entry point for value creation. `);
    } else if (pricePerUnit < 200000) {
      summaryParts.push(`At ${fmt(pricePerUnit)} per unit, pricing is consistent with stabilized Class B/C assets in growth markets. `);
    } else {
      summaryParts.push(`The ${fmt(pricePerUnit)} per unit reflects premium market positioning or core asset characteristics. `);
    }
  }

  // Occupancy Assessment
  if (occupancyRate >= 95) {
    summaryParts.push(`Current occupancy of ${(occupancyRate * 100).toFixed(1)}% demonstrates strong tenant demand and market positioning. `);
  } else if (occupancyRate >= 85) {
    summaryParts.push(`Occupancy of ${(occupancyRate * 100).toFixed(1)}% indicates stable operations with upside potential through lease-up. `);
  } else if (occupancyRate >= 70) {
    summaryParts.push(`Current occupancy of ${(occupancyRate * 100).toFixed(1)}% presents significant lease-up opportunity and value creation potential. `);
  } else if (occupancyRate > 0) {
    summaryParts.push(`⚠️ Low occupancy of ${(occupancyRate * 100).toFixed(1)}% requires aggressive lease-up strategy and adequate reserves. `);
  }

  // Refinance Potential
  if (refiValue > purchasePrice && cashOutRefi > 0) {
    summaryParts.push(`Post-stabilization refinance analysis projects ${fmt(refiValue)} valuation with potential ${fmt(cashOutRefi)} cash-out, enabling capital recycling. `);
  }

  // Conclusion
  summaryParts.push(`\n\n**Recommendation:** `);
  
  const score = (capRate >= 5 ? 1 : 0) + (cashOnCash >= 8 ? 1 : 0) + (dscr >= 1.25 ? 1 : 0) + (occupancyRate >= 0.85 ? 1 : 0);
  
  if (score >= 3) {
    summaryParts.push(`This deal meets multiple investment criteria and warrants progression to LOI stage. Proceed with due diligence.`);
  } else if (score >= 2) {
    summaryParts.push(`This deal shows potential but has areas requiring negotiation or value-add execution. Consider revised terms or additional analysis.`);
  } else {
    summaryParts.push(`This deal has significant challenges across key metrics. Recommend passing or substantial price renegotiation.`);
  }

  return summaryParts.join('');
};

// ============================================================================
// Deal Verdict Component
// ============================================================================

const DealVerdict = ({ capRate, cashOnCash, dscr, occupancyRate }) => {
  const score = (capRate >= 5 ? 1 : 0) + (cashOnCash >= 8 ? 1 : 0) + (dscr >= 1.25 ? 1 : 0) + (occupancyRate >= 0.85 ? 1 : 0);
  
  let verdict, color, Icon;
  
  if (score >= 3) {
    verdict = 'DEAL';
    color = '#10b981';
    Icon = CheckCircle;
  } else if (score >= 2) {
    verdict = 'MAYBE';
    color = '#f59e0b';
    Icon = AlertTriangle;
  } else {
    verdict = 'NO DEAL';
    color = '#ef4444';
    Icon = XCircle;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px 32px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 8px 24px rgba(15,23,42,0.12)'
    }}>
      <Icon size={48} color={color} />
      <div>
        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Verdict
        </div>
        <div style={{ fontSize: '42px', fontWeight: '800', color, letterSpacing: '2px' }}>
          {verdict}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Info Row Component
// ============================================================================

const InfoRow = ({ label, value, highlight = false }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #e5e7eb'
  }}>
    <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </span>
    <span style={{ 
      fontSize: '14px', 
      fontWeight: highlight ? '700' : '600', 
      color: highlight ? '#10b981' : '#111827' 
    }}>
      {value}
    </span>
  </div>
);

// ============================================================================
// Section Card Component
// ============================================================================

const SectionCard = ({ title, icon: Icon, children }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(15,23,42,0.08)'
  }}>
    <div style={{
      padding: '16px 20px',
      backgroundColor: '#1d4ed8',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}>
      {Icon && <Icon size={18} color="white" />}
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h3>
    </div>
    <div style={{ padding: '16px 20px' }}>
      {children}
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

const DealOrNoDealTab = ({ scenarioData, calculations, dealId, marketCapRate, marketCapRateLoading, onPushToPipeline, underwritingResult, recommendedStructure }) => {
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  // Optional AI underwriting summary (from v3 underwriter)
  const aiSummary = underwritingResult?.summaryText || underwritingResult?.summary_text || null;

  // Extract all data
  const property = scenarioData?.property || {};
  const pricingFinancing = scenarioData?.pricing_financing || {};
  const unitMix = scenarioData?.unit_mix || [];
  const broker = scenarioData?.broker || {};
  
  const fullCalcs = calculations || {};

  // Property Details
  const propertyName = property.property_name || 'Untitled Property';
  const address = [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ') || 'Address Not Specified';
  const assetType = property.property_type || 'Not Specified';
  const yearBuilt = property.year_built || '-';
  const totalUnits = property.units || unitMix.reduce((sum, u) => sum + (u.units || 0), 0) || 0;
  const netRentableSF = property.rba_sqft || unitMix.reduce((sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)), 0) || 0;
  
  // Occupancy - prefer normalized calc_json.current.occupancy, then fall back
  // to parsed property fields. Handles both decimal (0.95) and percentage (95).
  let occupancyRate = fullCalcs?.current?.occupancy;
  if (occupancyRate == null) {
    occupancyRate = fullCalcs?.occupancy?.rate || property.occupancy_rate || property.occupancy || 0;
  }
  if (occupancyRate > 1) {
    occupancyRate = occupancyRate / 100; // Convert from percentage to decimal
  }
  // If no occupancy data, estimate from unit mix (occupied units / total units)
  if (occupancyRate === 0 && totalUnits > 0) {
    const occupiedUnits = unitMix.filter(u => u.occupied !== false).reduce((sum, u) => sum + (u.units || 0), 0);
    occupancyRate = occupiedUnits / totalUnits;
  }
  // Default to 90% if still 0
  if (occupancyRate === 0) occupancyRate = 0.9;
  
  const holdingPeriod = pricingFinancing.hold_period || scenarioData?.underwriting?.holding_period || 5;

  // Transaction Details
  const purchasePrice = pricingFinancing.purchase_price || pricingFinancing.price || 0;
  const pricePerSF = netRentableSF > 0 ? purchasePrice / netRentableSF : 0;
  const capitalImprovements = pricingFinancing.capex_budget || pricingFinancing.renovation_budget || 0;
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
  const totalProjectCost = fullCalcs?.total_project_cost
    || fullCalcs?.acquisition?.totalAcquisitionCosts
    || (purchasePrice + capitalImprovements + closingCosts);

  // Financing
  const loanAmount = fullCalcs?.financing?.loanAmount || 0;
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || (totalProjectCost - loanAmount);
  
  // LTV - handle correctly (should be a percentage like 80, not 0.80 or 8000)
  let ltv = fullCalcs?.financing?.ltv || 0;
  if (ltv === 0) {
    ltv = pricingFinancing.ltv || 0;
  }
  if (ltv === 0 && purchasePrice > 0 && loanAmount > 0) {
    ltv = (loanAmount / purchasePrice) * 100;
  }
  // If LTV is way too high (like 8000), it was calculated wrong - recalculate
  if (ltv > 100) {
    ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  }
  
  // Interest rate - should be like 6.00, not 0.06
  let interestRate = (fullCalcs?.financing?.interestRate != null)
    ? fullCalcs.financing.interestRate
    : (pricingFinancing.interest_rate != null ? pricingFinancing.interest_rate * 100 : 6);
  if (interestRate < 1) {
    interestRate = interestRate * 100;
  }
  
  const loanTerm = pricingFinancing.term_years || fullCalcs?.financing?.loanTermYears || 30;
  const amortization = pricingFinancing.amortization_years || fullCalcs?.financing?.amortizationYears || 30;

  // Returns
  // Use the core engine's levered IRR and Year 1 metrics so
  // Deal-or-No-Deal, Results, and AI all see the same values.
  const projectIRR = fullCalcs?.returns?.leveredIRR || 0;
  const avgCashOnCash = fullCalcs?.year1?.cashOnCash || 0;
  const inPlaceCapRate = fullCalcs?.current?.capRate ?? fullCalcs?.year1?.capRate ?? 0;
  
  // Exit cap rate - handle decimal vs percentage
  let exitCapRate = scenarioData?.underwriting?.exit_cap_rate ?? pricingFinancing.exit_cap_rate ?? fullCalcs?.exit?.capRate ?? 6;
  if (exitCapRate < 1) {
    exitCapRate = exitCapRate * 100;
  }
  
  const dscr = fullCalcs?.current?.dscr ?? fullCalcs?.year1?.dscr ?? 0;
  const noiYear1 = fullCalcs?.year1?.noi || 0;
  // NOI at sale / stabilized NOI from engine only (no new math)
  const noiAtSale = fullCalcs?.stabilized?.noi
    ?? fullCalcs?.returns?.exitNOI
    ?? 0;
  const equityMultiple = fullCalcs?.returns?.equityMultiple || 0;

  // Cash Flow Analysis
  const dayOneCashFlow = fullCalcs?.year1?.cashFlowAfterFinancing || fullCalcs?.year1?.cashFlow || 0;
  // Stabilized cash flow from calc_json.stabilized (single source of truth)
  const stabilizedCashFlow = fullCalcs?.stabilized?.cashflow ?? 0;
  
  // Refinance Analysis - use percentage for cap rate calculation
  // Exit / refi metrics from engine only (no new math)
  const refiValue = fullCalcs?.stabilized?.value
    ?? fullCalcs?.returns?.terminalValue
    ?? 0;
  const cashOutRefi = fullCalcs?.exit?.reversionCashFlow ?? 0;
  const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
  const valueCreation = fullCalcs?.valueCreation ?? 0;

  // Broker Info
  const brokerName = broker.name || property.listing_broker || 'Not Specified';
  const brokerPhone = broker.phone || property.broker_phone || '-';
  const brokerEmail = broker.email || property.broker_email || '-';

  // Best Deal Structure - prioritize AI recommendation from DealStructureTab, then fall back to saved data
  const dealStructure = recommendedStructure || scenarioData?.recommended_structure || scenarioData?.deal_structure?.recommended || 'Traditional Financing';

  // Generate Summary
  const dealSummary = useMemo(() => generateDealSummary({
    propertyName,
    address,
    units: totalUnits,
    purchasePrice,
    capRate: inPlaceCapRate,
    cashOnCash: avgCashOnCash,
    dscr,
    ltv,
    noi: noiYear1,
    pricePerUnit,
    occupancyRate,
    interestRate,
    holdingPeriod,
    stabilizedValue: refiValue,
    totalEquityRequired: totalEquity,
    refiValue,
    cashOutRefi
  }), [propertyName, address, totalUnits, purchasePrice, inPlaceCapRate, avgCashOnCash, dscr, ltv, noiYear1, pricePerUnit, occupancyRate]);

  const effectiveSummaryText = aiSummary || dealSummary;

  // Push to Pipeline Handler
  const handlePushToPipeline = async () => {
    setIsPushing(true);
    
    try {
      // Save to Supabase with all data needed to reconstruct Results page
      await saveDeal({
        dealId,
        address,
        units: totalUnits,
        purchasePrice,
        dealStructure,
        parsedData: scenarioData,      // Original parsed/transformed data
        scenarioData: {
          ...scenarioData,
          calculations: {
            dayOneCashFlow,
            stabilizedCashFlow,
            refiValue,
            cashOutRefiAmount: cashOutRefi,
            inPlaceCapRate,
            avgCashOnCash,
            dscr,
            ltv,
            noiYear1,
            pricePerUnit,
            valueCreation
          }
        },
        marketCapRate: marketCapRate,  // LLM-derived cap rate
        images: scenarioData?.images || [],  // NEW: Include extracted images
        brokerName,
        brokerPhone,
        brokerEmail,
        notes: ''
      });
      
      setPushSuccess(true);
      setTimeout(() => setPushSuccess(false), 3000);
      
      if (onPushToPipeline) {
        onPushToPipeline({ dealId, address, units: totalUnits, purchasePrice });
      }
    } catch (error) {
      console.error('Error pushing to pipeline:', error);
      alert('Failed to push deal to pipeline: ' + error.message);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header with Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              backgroundColor: '#10b981', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '700', 
              fontSize: '16px',
              marginRight: '12px'
            }}>💰</div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              DEAL OR NO DEAL ANALYSIS
            </h2>
          </div>
        </div>

        {/* Top action bar: Push to Pipeline (left) + Run AI Underwriting (right, existing elsewhere) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <button
              onClick={handlePushToPipeline}
              disabled={isPushing}
              style={{
                padding: '12px 24px',
                backgroundColor: pushSuccess ? '#10b981' : isPushing ? '#9ca3af' : '#111827',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: isPushing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(15,23,42,0.2)',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {pushSuccess ? (
                <>
                  <CheckCircle size={18} />
                  Added to Pipeline
                </>
              ) : isPushing ? (
                'Pushing...'
              ) : (
                <>
                  <Rocket size={18} />
                  Push to Pipeline
                </>
              )}
            </button>
          </div>

          {/* The Run AI Underwriting button lives in the parent header on this page; this layout leaves space on the right for it */}
        </div>

        {/* Deal Verdict */}
        <div style={{ marginBottom: '24px' }}>
          <DealVerdict 
            capRate={inPlaceCapRate} 
            cashOnCash={avgCashOnCash} 
            dscr={dscr} 
            occupancyRate={occupancyRate} 
          />
        </div>

        {/* AI Analysis - Only show if available */}
        {aiSummary && (
          <div style={{
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '2px solid #3b82f6',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>AI Investment Analysis</h3>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#374151', whiteSpace: 'pre-wrap' }}>
              {(aiSummary || '').split('**').map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </div>
          </div>
        )}

        {/* Main Content Grid - 4 Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          
          {/* Property Details */}
          <SectionCard title="Property Details" icon={Building2}>
            <InfoRow label="Property Name" value={propertyName} />
            <InfoRow label="Address" value={address} />
            <InfoRow label="Asset Type" value={assetType} />
            <InfoRow label="Year Built" value={yearBuilt} />
            <InfoRow label="Total Units" value={fmtNumber(totalUnits)} />
            <InfoRow label="Net Rentable SF" value={fmtNumber(netRentableSF)} />
            <InfoRow label="Occupancy Rate" value={fmtPercent(occupancyRate * 100)} />
            <InfoRow label="Holding Period" value={`${holdingPeriod} Years`} />
          </SectionCard>

          {/* Transaction Details */}
          <SectionCard title="Transaction Details" icon={DollarSign}>
            <InfoRow label="Purchase Price" value={fmt(purchasePrice)} highlight />
            <InfoRow label="Price Per SF" value={fmt(pricePerSF)} />
            <InfoRow label="Price Per Unit" value={fmt(pricePerUnit)} />
            <InfoRow label="Capital Improvements" value={fmt(capitalImprovements)} />
            <InfoRow label="Closing Costs" value={fmt(closingCosts)} />
            <InfoRow label="Total Project Cost" value={fmt(totalProjectCost)} highlight />
          </SectionCard>

          {/* Financing */}
          <SectionCard title="Financing" icon={Calculator}>
            <InfoRow label="Loan Amount" value={fmt(loanAmount)} />
            <InfoRow label="Total Equity" value={fmt(totalEquity)} highlight />
            <InfoRow label="Loan to Value" value={fmtPercent(ltv)} />
            <InfoRow label="Interest Rate" value={fmtPercent(interestRate)} />
            <InfoRow label="Loan Term" value={`${loanTerm} Years`} />
            <InfoRow label="Amortization" value={`${amortization} Years`} />
          </SectionCard>

          {/* Returns */}
          <SectionCard title="Returns" icon={TrendingUp}>
            <InfoRow label="Project Level IRR" value={fmtPercent(projectIRR)} highlight />
            <InfoRow label="Avg. Cash on Cash" value={fmtPercent(avgCashOnCash)} highlight />
            <InfoRow label="In-Place Cap Rate" value={fmtPercent(inPlaceCapRate)} />
            <InfoRow label="Exit Cap Rate" value={fmtPercent(exitCapRate)} />
            <InfoRow label="Debt Coverage Ratio" value={dscr > 0 ? `${dscr.toFixed(2)}x` : '-'} />
            <InfoRow label="NOI Year 1" value={fmt(noiYear1)} />
            <InfoRow label="NOI at Sale" value={fmt(noiAtSale)} />
            <InfoRow label="Value Creation" value={fmt(valueCreation)} />
            <InfoRow label="Equity Multiple" value={equityMultiple > 0 ? `${equityMultiple.toFixed(2)}x` : '-'} />
          </SectionCard>
        </div>

        {/* Market Cap Rate Analysis */}
        {(marketCapRate || marketCapRateLoading) && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 10px rgba(15,23,42,0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <TrendingUp size={20} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Market Cap Rate Analysis</h3>
              {marketCapRateLoading && (
                <span style={{ fontSize: '12px', color: '#60a5fa', marginLeft: 'auto' }}>Loading...</span>
              )}
            </div>
            
            {marketCapRate && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {/* Market Cap Rate */}
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
                    Market Cap Rate
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#60a5fa' }}>
                    {marketCapRate.market_cap_rate?.toFixed(2) || '-'}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                    Range: {marketCapRate.cap_rate_range_low?.toFixed(1)}% - {marketCapRate.cap_rate_range_high?.toFixed(1)}%
                  </div>
                </div>
                
                {/* Deal Cap Rate */}
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
                    Deal Cap Rate
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>
                    {inPlaceCapRate?.toFixed(2) || '-'}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                    Going-in basis
                  </div>
                </div>
                
                {/* Spread / Value Assessment */}
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>
                    Cap Rate Spread
                  </div>
                  {(() => {
                    const spread = inPlaceCapRate - (marketCapRate.market_cap_rate || 0);
                    const isGoodDeal = spread > 0;
                    return (
                      <>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: isGoodDeal ? '#10b981' : '#ef4444' }}>
                          {spread > 0 ? '+' : ''}{spread.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '10px', color: isGoodDeal ? '#10b981' : '#ef4444', marginTop: '4px', fontWeight: '600' }}>
                          {isGoodDeal ? '✓ Buying Below Market' : '⚠ Buying Above Market'}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* Market Context */}
            {marketCapRate && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '6px', fontWeight: '600' }}>Market Context</div>
                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                  {marketCapRate.rationale || 'Market cap rate analysis based on property type, location, and asset class.'}
                </div>
                {marketCapRate.market_trends && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    <strong style={{ color: '#94a3b8' }}>Trend:</strong> {marketCapRate.market_trends}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                  <span>Asset Class: <strong style={{ color: '#94a3b8' }}>{marketCapRate.asset_class || '-'}</strong></span>
                  <span>Market Tier: <strong style={{ color: '#94a3b8' }}>{marketCapRate.market_tier || '-'}</strong></span>
                  <span>Confidence: <strong style={{ color: marketCapRate.confidence === 'high' ? '#10b981' : marketCapRate.confidence === 'medium' ? '#f59e0b' : '#ef4444' }}>{marketCapRate.confidence || '-'}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cash Flow & Refinance Analysis */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Day One Cash Flow</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: dayOneCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(dayOneCashFlow)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>annual</div>
          </div>
          
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Stabilized Cash Flow</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: stabilizedCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
              {fmt(stabilizedCashFlow)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>projected</div>
          </div>
          
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Refi Value</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
              {fmt(refiValue)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>terminal / exit value</div>
          </div>
          
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 10px rgba(15,23,42,0.08)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Cash-Out Refi</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981' }}>
              {fmt(cashOutRefi)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>levered equity at exit</div>
          </div>
        </div>

        {/* Broker Info & Deal Structure */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Broker/Agent Information */}
          <SectionCard title="Agent/Broker Information" icon={Users}>
            <InfoRow label="Name" value={brokerName} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} /> Phone
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{brokerPhone}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0'
            }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} /> Email
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>{brokerEmail}</span>
            </div>
          </SectionCard>

          {/* Recommended Deal Structure */}
          <SectionCard title="Recommended Deal Structure" icon={Layers}>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#059669', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
                Best Structure for This Deal
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                {dealStructure}
              </div>
            </div>
            <div style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
              Based on the deal metrics, cash flow analysis, and market conditions, this structure optimizes returns while minimizing risk.
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  );
};

export default DealOrNoDealTab;
