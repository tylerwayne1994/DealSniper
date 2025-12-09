// Cost Segregation Analysis Component
// Full-featured cost seg tab with allocation, depreciation schedules, and tax impact

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  DollarSign, 
  Building, 
  FileText,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

const COLORS = {
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  primary: '#3b82f6',
  gray: '#6b7280',
  teal: '#0d9488'
};

// Format currency
const fmt = (val) => {
  if (val === null || val === undefined) return '$0';
  const num = Number(val);
  if (isNaN(num)) return '$0';
  const prefix = num < 0 ? '-$' : '$';
  return prefix + Math.abs(num).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

// Format percentage
const pct = (val) => {
  if (val === null || val === undefined) return '0.00%';
  return Number(val).toFixed(2) + '%';
};

// Metric Card Component
const MetricCard = ({ label, value, subtext, icon: Icon, color = COLORS.primary, highlight = false }) => (
  <div style={{
    padding: '20px',
    backgroundColor: highlight ? '#f0fdf4' : 'white',
    border: highlight ? '2px solid #10b981' : '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>{label}</div>
      {Icon && <Icon size={18} color={color} />}
    </div>
    <div style={{ fontSize: '24px', fontWeight: '700', color: highlight ? COLORS.success : '#111827', marginBottom: '4px' }}>{value}</div>
    {subtext && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{subtext}</div>}
  </div>
);

// Slider Input Component
const SliderInput = ({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '%', description }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          style={{
            width: '70px',
            padding: '6px 8px',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            fontSize: '13px',
            textAlign: 'right'
          }}
        />
        <span style={{ fontSize: '13px', color: '#6b7280' }}>{suffix}</span>
      </div>
    </div>
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
      style={{
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        appearance: 'none',
        background: `linear-gradient(to right, ${COLORS.primary} 0%, ${COLORS.primary} ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`,
        cursor: 'pointer'
      }}
    />
    {description && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{description}</div>}
  </div>
);

// Number Input Component  
const NumberInput = ({ label, value, onChange, prefix = '$', suffix = '', description }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {prefix && <span style={{ fontSize: '14px', color: '#6b7280' }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          flex: 1,
          padding: '10px 12px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          fontSize: '14px'
        }}
      />
      {suffix && <span style={{ fontSize: '14px', color: '#6b7280' }}>{suffix}</span>}
    </div>
    {description && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{description}</div>}
  </div>
);

// Section Component
const Section = ({ title, children, collapsible = false, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div style={{ 
      marginBottom: '24px', 
      backgroundColor: 'white', 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div 
        style={{ 
          padding: '16px 20px', 
          borderBottom: isOpen ? '1px solid #e5e7eb' : 'none',
          backgroundColor: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: collapsible ? 'pointer' : 'default'
        }}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111827' }}>{title}</h4>
        {collapsible && (isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
      </div>
      {isOpen && <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  );
};

// Main Cost Segregation Analysis Component
export const CostSegAnalysisView = ({ dealId, scenarioData, fullCalcs }) => {
  // State
  const [costSegData, setCostSegData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Input state (overrides)
  const [inputs, setInputs] = useState({
    purchase_price: 0,
    land_percent: 20,
    closing_costs: 0,
    five_year_percent: 15,
    seven_year_percent: 0,
    fifteen_year_percent: 10,
    is_residential: true,
    bonus_depreciation_percent: 60,
    federal_tax_rate: 37,
    state_tax_rate: 5,
    ltcg_rate: 20,
    hold_period_years: 5,
    exit_sale_price: 0,
    exit_cap_rate: 6,
    initial_equity: 0
  });
  
  // Initialize inputs from scenario data
  useEffect(() => {
    if (scenarioData) {
      const pricing = scenarioData.pricing_financing || {};
      const property = scenarioData.property || {};
      
      setInputs(prev => ({
        ...prev,
        purchase_price: pricing.price || pricing.purchase_price || prev.purchase_price,
        closing_costs: pricing.closing_costs || (pricing.price || 0) * 0.02,
        hold_period_years: pricing.hold_period || 5,
        exit_cap_rate: pricing.exit_cap_rate || 6,
        initial_equity: (pricing.price || 0) * 0.25 + (pricing.closing_costs || 0),
        is_residential: (property.type || '').toLowerCase().includes('multifamily') || 
                        (property.type || '').toLowerCase().includes('apartment')
      }));
    }
  }, [scenarioData]);
  
  // Fetch cost seg analysis
  const fetchCostSegAnalysis = useCallback(async () => {
    if (!dealId) {
      setError('No deal ID available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8010/v2/deals/${dealId}/costseg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCostSegData(data);
        // Update inputs with values used in calculation
        if (data.inputs) {
          setInputs(prev => ({ ...prev, ...data.inputs }));
        }
      } else {
        setError(data.error || 'Failed to calculate cost segregation');
      }
    } catch (err) {
      console.error('Cost seg fetch error:', err);
      setError('Failed to fetch cost segregation analysis');
    } finally {
      setLoading(false);
    }
  }, [dealId, inputs]);
  
  // Calculate on mount
  useEffect(() => {
    if (dealId && inputs.purchase_price > 0) {
      fetchCostSegAnalysis();
    }
  }, [dealId]); // Only on mount/dealId change
  
  // Handle input change
  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };
  
  // Recalculate
  const handleRecalculate = () => {
    fetchCostSegAnalysis();
  };
  
  // Calculate long-life percent
  const longLifePercent = Math.max(0, 100 - inputs.five_year_percent - inputs.seven_year_percent - inputs.fifteen_year_percent);
  
  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: '700', 
              fontSize: '16px',
              marginRight: '12px'
            }}>11</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                COST SEGREGATION ANALYSIS
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                MACRS depreciation with bonus and accelerated schedules
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: showSettings ? '#10b981' : 'white',
                color: showSettings ? 'white' : '#374151',
                border: showSettings ? 'none' : '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Settings size={16} />
              {showSettings ? 'Hide' : 'Show'} Assumptions
            </button>
            <button
              onClick={handleRecalculate}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: loading ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Calculating...' : 'Recalculate'}
            </button>
          </div>
        </div>
      
      {/* Error Display */}
      {error && (
        <div style={{ 
          padding: '16px 20px', 
          backgroundColor: '#fef2f2', 
          color: '#b91c1c', 
          borderRadius: '12px', 
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: '600',
          border: '2px solid #fca5a5'
        }}>
          ⚠️ {error}
        </div>
      )}
      
      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
            COST SEG ASSUMPTIONS
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {/* Column 1: Basic Inputs */}
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
                Deal Parameters
              </h5>
              <NumberInput
                label="Purchase Price"
                value={inputs.purchase_price}
                onChange={(v) => handleInputChange('purchase_price', v)}
              />
              <NumberInput
                label="Closing Costs"
                value={inputs.closing_costs}
                onChange={(v) => handleInputChange('closing_costs', v)}
              />
              <NumberInput
                label="Initial Equity"
                value={inputs.initial_equity}
                onChange={(v) => handleInputChange('initial_equity', v)}
                description="Down payment + closing costs"
              />
              <NumberInput
                label="Hold Period"
                value={inputs.hold_period_years}
                onChange={(v) => handleInputChange('hold_period_years', v)}
                prefix=""
                suffix="years"
              />
            </div>
            
            {/* Column 2: Allocation */}
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
                Cost Seg Allocation
              </h5>
              <SliderInput
                label="Land %"
                value={inputs.land_percent}
                onChange={(v) => handleInputChange('land_percent', v)}
                max={40}
                description="Non-depreciable"
              />
              <SliderInput
                label="5-Year Property"
                value={inputs.five_year_percent}
                onChange={(v) => handleInputChange('five_year_percent', v)}
                max={40}
                description="Appliances, carpet, fixtures"
              />
              <SliderInput
                label="15-Year Property"
                value={inputs.fifteen_year_percent}
                onChange={(v) => handleInputChange('fifteen_year_percent', v)}
                max={30}
                description="Parking, landscaping, site work"
              />
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#f3f4f6', 
                borderRadius: '6px',
                marginTop: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280' }}>{inputs.is_residential ? '27.5-Year' : '39-Year'} Structure:</span>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{longLifePercent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            
            {/* Column 3: Tax Rates */}
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
                Tax Rates & Exit
              </h5>
              <SliderInput
                label="Federal Tax Rate"
                value={inputs.federal_tax_rate}
                onChange={(v) => handleInputChange('federal_tax_rate', v)}
                min={10}
                max={40}
              />
              <SliderInput
                label="State Tax Rate"
                value={inputs.state_tax_rate}
                onChange={(v) => handleInputChange('state_tax_rate', v)}
                max={15}
              />
              <SliderInput
                label="Bonus Depreciation"
                value={inputs.bonus_depreciation_percent}
                onChange={(v) => handleInputChange('bonus_depreciation_percent', v)}
                description="2024: 60%, 2025: 40%, 2026: 20%"
              />
              <SliderInput
                label="Exit Cap Rate"
                value={inputs.exit_cap_rate}
                onChange={(v) => handleInputChange('exit_cap_rate', v)}
                min={4}
                max={10}
                step={0.25}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Results */}
      {costSegData && (
        <>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.1 }}>
                <TrendingUp size={48} color="white" />
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>After-Tax IRR</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                {pct(costSegData.metrics?.after_tax_irr)}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                {costSegData.comparison?.irr_improvement > 0 ? 
                  `+${costSegData.comparison.irr_improvement.toFixed(2)}% vs standard` : 
                  'With cost segregation'}
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>After-Tax Multiple</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                {(costSegData.metrics?.after_tax_equity_multiple || 0).toFixed(2)}x
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Return on equity</div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Year-1 Bonus</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                {fmt(costSegData.metrics?.year_1_bonus_depreciation)}
              </div>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>
                {inputs.bonus_depreciation_percent}% bonus rate
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Year-1 Tax Shield</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                {fmt(costSegData.metrics?.year_1_tax_shield)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {(inputs.federal_tax_rate + inputs.state_tax_rate).toFixed(0)}% marginal
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Total Depr (Hold)</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
                {fmt(costSegData.metrics?.total_depreciation_over_hold)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Over {inputs.hold_period_years} years
              </div>
            </div>
          </div>
          
          {/* Allocation & Exit Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Allocation Breakdown */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                COST SEG ALLOCATION
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Land (Non-Depreciable)</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{fmt(costSegData.allocation?.land_value)}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{inputs.land_percent}% of purchase</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Building Value</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{fmt(costSegData.allocation?.building_value)}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{100 - inputs.land_percent}% depreciable</div>
                </div>
              </div>
              
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Depreciation Allocation</div>
                
                {/* 5-Year */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: COLORS.success }}></div>
                    <span style={{ fontSize: '13px', color: '#374151' }}>5-Year Property</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(costSegData.allocation?.five_year_basis)}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>({inputs.five_year_percent}%)</span>
                  </div>
                </div>
                
                {/* 15-Year */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: COLORS.warning }}></div>
                    <span style={{ fontSize: '13px', color: '#374151' }}>15-Year Property</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(costSegData.allocation?.fifteen_year_basis)}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>({inputs.fifteen_year_percent}%)</span>
                  </div>
                </div>
                
                {/* Long-Life */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: COLORS.primary }}></div>
                    <span style={{ fontSize: '13px', color: '#374151' }}>{inputs.is_residential ? '27.5-Year' : '39-Year'} Structure</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(costSegData.allocation?.long_life_basis)}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>({longLifePercent.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Exit Tax Analysis */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                EXIT TAX ANALYSIS
              </h3>
              {costSegData.exit_taxes && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Sale Price</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>{fmt(costSegData.exit_taxes.sale_price)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Adjusted Basis</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>{fmt(costSegData.exit_taxes.adjusted_basis)}</div>
                    </div>
                  </div>
                  
                  <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Total Gain</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.success }}>{fmt(costSegData.exit_taxes.total_gain)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>├ Recapture (5/7/15yr) - Ordinary</span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{fmt(costSegData.exit_taxes.recapture_5_7_year + costSegData.exit_taxes.recapture_15_year)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>├ Unrecaptured §1250 (25% max)</span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{fmt(costSegData.exit_taxes.unrecaptured_1250)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>└ Long-Term Capital Gain</span>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{fmt(costSegData.exit_taxes.long_term_capital_gain)}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Total Exit Tax</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: COLORS.danger }}>{fmt(costSegData.exit_taxes.total_exit_tax)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>After-Tax Proceeds</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: COLORS.primary }}>{fmt(costSegData.exit_taxes.after_tax_proceeds)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Annual Tax Impact Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
              ANNUAL TAX IMPACT (WITH COST SEG)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Year</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Pre-Tax CF</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.warning }}>Bonus Depr</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.success }}>5-Yr Depr</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.warning }}>15-Yr Depr</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.primary }}>27.5/39-Yr</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#111827', backgroundColor: '#f3f4f6' }}>Total Depr</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Taxable Inc</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.danger }}>Tax (Benefit)</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.primary, backgroundColor: '#eff6ff' }}>After-Tax CF</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#6b7280' }}>Cum. Depr</th>
                  </tr>
                </thead>
                <tbody>
                  {costSegData.annual_tax_impact?.map((year, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>Year {year.year}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{fmt(year.pre_tax_cf)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: year.bonus_depreciation > 0 ? COLORS.warning : '#d1d5db' }}>
                        {year.bonus_depreciation > 0 ? fmt(year.bonus_depreciation) : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: COLORS.success }}>{fmt(year.five_year_depreciation)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: COLORS.warning }}>{fmt(year.fifteen_year_depreciation)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: COLORS.primary }}>{fmt(year.long_life_depreciation)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', backgroundColor: '#f3f4f6' }}>{fmt(year.total_depreciation)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: year.taxable_income < 0 ? COLORS.success : '#374151' }}>
                        {fmt(year.taxable_income)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: year.tax_liability < 0 ? COLORS.success : COLORS.danger }}>
                        {year.tax_liability < 0 ? `(${fmt(Math.abs(year.tax_liability))})` : fmt(year.tax_liability)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.primary, backgroundColor: '#eff6ff' }}>
                        {fmt(year.after_tax_cf)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{fmt(year.cumulative_depreciation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Comparison Section */}
          {costSegData.comparison?.standard_irr !== null && (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                COST SEG VS STANDARD DEPRECIATION
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Standard Depreciation IRR</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#6b7280' }}>{pct(costSegData.comparison.standard_irr)}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Straight-line only</div>
                </div>
                <div style={{ padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center', border: '2px solid #10b981' }}>
                  <div style={{ fontSize: '12px', color: COLORS.success, marginBottom: '8px' }}>With Cost Segregation</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.success }}>{pct(costSegData.metrics?.after_tax_irr)}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>MACRS + Bonus</div>
                </div>
                <div style={{ padding: '20px', backgroundColor: '#eff6ff', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: COLORS.primary, marginBottom: '8px' }}>IRR Improvement</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: COLORS.primary }}>
                    +{costSegData.comparison.irr_improvement?.toFixed(2) || 0}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Additional return</div>
                </div>
              </div>
              
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fefce8', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Info size={20} color={COLORS.warning} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', color: '#713f12' }}>
                  <strong>Note:</strong> Cost segregation allows you to accelerate depreciation deductions by reclassifying building 
                  components into shorter recovery periods (5, 7, and 15 years) instead of the standard 27.5 or 39-year schedule. 
                  Combined with bonus depreciation, this can significantly improve after-tax returns in the early years of ownership.
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Loading State */}
      {loading && !costSegData && (
        <div style={{ 
          padding: '80px', 
          textAlign: 'center', 
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite', marginBottom: '20px', color: '#10b981' }} />
          <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Calculating cost segregation analysis...</p>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !costSegData && !error && (
        <div style={{ 
          padding: '80px', 
          textAlign: 'center', 
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <Calculator size={64} style={{ marginBottom: '20px', opacity: 0.3, color: '#10b981' }} />
          <p style={{ marginBottom: '24px', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Ready to generate cost segregation analysis</p>
          <button
            onClick={handleRecalculate}
            style={{
              padding: '12px 32px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            Calculate Now
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default CostSegAnalysisView;
