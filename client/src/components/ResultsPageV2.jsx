// V2 Results Page - Complete with All Advanced Features
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Home, DollarSign, FileText, CreditCard, BarChart3, Users, FileBarChart, TrendingUp, Calculator, PieChart, Calendar, Activity, Layers, LayoutDashboard } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { 
  AmortizationChart, 
  LoanBalanceChart, 
  SensitivityTable, 
  MonthlyCashFlowChart, 
  OccupancyRampChart,
  ExitScenariosChart,
  WaterfallPieChart,
  ProjectionsTable
} from './AdvancedCharts';
import { 
  RentRollView, 
  ManagementFeesView, 
  WaterfallView, 
  TaxAnalysisView,
  MetricCard 
} from './AdvancedViews';
import { calculateSensitivity } from '../utils/realEstateCalculations';
import { CostSegAnalysisView } from './CostSegAnalysis';
import MarketDataDashboard from './MarketDataDashboard';
import DealStructureTab from './results-tabs/DealStructureTab';
import DealOrNoDealTab from './results-tabs/DealOrNoDealTab';

const ResultsPageV2 = ({ 
  dealId,
  scenarioData, 
  calculations,
  messages,
  inputValue,
  setInputValue,
  isSending,
  handleSendMessage,
  chatMessagesRef,
  onEditData,
  onGoHome,
  onReturnToWizard,
  isChatMinimized,
  setIsChatMinimized,
  marketCapRate,
  marketCapRateLoading
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [showDebug, setShowDebug] = useState(false);
  const [countyTaxData, setCountyTaxData] = useState([]);
  const [countySearch, setCountySearch] = useState('');
  const [showCountyDropdown, setShowCountyDropdown] = useState(false);
  
  // Chat position state for dragging
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // RentCast API state
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(null);
  
  // Handle mouse down on chat header to start dragging
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y
    });
  };
  
  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setChatPosition({ x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  // Load county tax data from CSV
  useEffect(() => {
    fetch('/Property Taxes by State and County, 2025  Tax Foundation Maps.csv')
      .then(response => response.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          // Parse CSV with quoted fields
          const matches = line.match(/("([^"]*)"|[^,]+)/g);
          if (matches && matches.length >= 5) {
            const state = matches[0].replace(/"/g, '').trim();
            const county = matches[1].replace(/"/g, '').trim();
            const taxRate = matches[4].replace(/"/g, '').replace('%', '').trim();
            data.push({
              state,
              county,
              taxRate: parseFloat(taxRate) || 0,
              fullName: `${county}, ${state}`
            });
          }
        }
        setCountyTaxData(data);
      })
      .catch(err => console.error('Error loading county tax data:', err));
  }, []);
  
  // Calculate sensitivity analysis separately (only when needed)
  const sensitivity = useMemo(() => {
    if (!scenarioData || !scenarioData.pricing_financing?.purchase_price) return null;
    
    const purchasePrice = scenarioData.pricing_financing.purchase_price;
    const exitCapRate = scenarioData.underwriting?.exit_cap_rate || 0.06;
    
    return calculateSensitivity(scenarioData, {
      purchasePrice: [purchasePrice * 0.90, purchasePrice * 1.10, purchasePrice * 0.05],
      exitCapRate: [exitCapRate * 0.8, exitCapRate * 1.2, exitCapRate * 0.1],
      incomeGrowth: [0.01, 0.05, 0.01],
      vacancy: [0.03, 0.10, 0.02]
    });
  }, [scenarioData]);
  
  if (!scenarioData || !calculations) return null;

  // Use fullAnalysis if available, otherwise fall back to calculations object
  const fullCalcs = calculations.fullAnalysis || calculations;
  
  // Destructure scenario data
  const { property, pricing_financing, unit_mix, underwriting } = scenarioData;

  // Format helpers
  const fmt = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (isNaN(n)) return num;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  const pct = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (isNaN(n)) return num;
    return `${n.toFixed(2)}%`;
  };

  const display = (val) => val || 'N/A';

  // Key metrics for IM-style summary header
  const purchasePrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
  const totalCapitalization = fullCalcs?.acquisition?.totalAcquisitionCosts || 0;
  const year1NOI = fullCalcs?.year1?.noi || 0;
  const capRate = fullCalcs?.year1?.capRate || (purchasePrice > 0 && year1NOI > 0 ? (year1NOI / purchasePrice) * 100 : 0);
  const cashOnCash = fullCalcs?.year1?.cashOnCash || 0;
  const dscr = fullCalcs?.year1?.dscr || 0;
  const annualCashFlow = fullCalcs?.year1?.cashFlowAfterFinancing ?? fullCalcs?.year1?.cashFlow ?? 0;
  const stabilizedValue = fullCalcs?.returns?.terminalValue || 0;

  // Tabs with icons - EXPANDED
  const tabs = [
    { id: 'summary', label: 'Summary', icon: Home },
    { id: 'deal-structure', label: 'Deal Structure', icon: Layers },
    { id: 'characteristics', label: 'Property', icon: Home },
    { id: 'expenses', label: 'Expenses', icon: FileText },
    { id: 'value-add', label: 'Value-Add Strategy', icon: TrendingUp },
    
    { id: 'amortization', label: 'Amortization', icon: Calculator },
    { id: 'rent-roll', label: 'Rent Roll', icon: Users },
    { id: 'syndication', label: 'Syndication', icon: PieChart },
    
    { id: 'fees', label: 'Fees', icon: CreditCard },
    
    { id: 'costseg', label: 'Cost Segregation', icon: Calculator },
    { id: 'market-data', label: 'Market Data', icon: BarChart3 },
    { id: 'deal-or-no-deal', label: 'Deal or No Deal', icon: DollarSign }
  ];

  // Row component
  const DataRow = ({ label, value, highlight }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: highlight ? '#f0fdf4' : 'transparent'
    }}>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: highlight ? '700' : '600', color: highlight ? '#10b981' : '#111827', textAlign: 'right' }}>{value}</div>
    </div>
  );
  // Section header
  const SectionHeader = ({ title }) => (
    <div style={{
      padding: '14px 16px',
      fontSize: '14px',
      fontWeight: '700',
      color: '#111827',
      borderBottom: '2px solid #e5e7eb',
      backgroundColor: '#f9fafb'
    }}>
      {title}
    </div>
  );

  // Debug panel component
  const DebugPanel = () => (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      zIndex: 9999,
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <button 
        onClick={() => setShowDebug(!showDebug)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
          marginBottom: '8px'
        }}
      >
        {showDebug ? 'Hide Debug' : 'Show Debug Data'}
      </button>
      {showDebug && (
        <div style={{
          backgroundColor: '#1f2937',
          color: '#10b981',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px' }}>===== SCENARIO DATA =====</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>property:</div>
            {JSON.stringify(scenarioData.property, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>pricing_financing:</div>
            {JSON.stringify(scenarioData.pricing_financing, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>pnl:</div>
            {JSON.stringify(scenarioData.pnl, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>expenses:</div>
            {JSON.stringify(scenarioData.expenses, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>unit_mix:</div>
            {JSON.stringify(scenarioData.unit_mix, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>underwriting:</div>
            {JSON.stringify(scenarioData.underwriting, null, 2)}
          </div>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px', marginTop: '16px' }}>===== CALCULATIONS =====</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.year1:</div>
            {JSON.stringify(fullCalcs.year1, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.financing:</div>
            {JSON.stringify(fullCalcs.financing, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.returns:</div>
            {JSON.stringify(fullCalcs.returns, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.rentRollAnalysis:</div>
            {JSON.stringify(fullCalcs.rentRollAnalysis, null, 2)}
          </div>
        </div>
      )}
    </div>
  );

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        // Use canonical values from fullCalcs so Summary matches engine
        const summaryPurchasePrice = fullCalcs.acquisition?.purchasePrice || pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const closingFees = fullCalcs.acquisition?.closingCosts || 0;
        const capexBudget = fullCalcs.acquisition?.capexBudget || 0;
        const totalCapitalization = fullCalcs.acquisition?.totalAcquisitionCosts || (summaryPurchasePrice + closingFees + capexBudget);

        const year1NOI = fullCalcs.year1?.noi || 0;
        const goingInCapRate = fullCalcs.year1?.capRate != null
          ? fullCalcs.year1.capRate
          : (summaryPurchasePrice > 0 ? (year1NOI / summaryPurchasePrice) * 100 : 0);

        const cashOnCashReturn = fullCalcs.year1?.cashOnCash || 0;
        const summaryDscr = fullCalcs.year1?.dscr || 0;
        const annualCashFlow = fullCalcs.year1?.cashFlowAfterFinancing ?? fullCalcs.year1?.cashFlow ?? 0;
        const summaryAnnualDebtService = fullCalcs.financing?.annualDebtService || 0;

        const stabilizedValue = fullCalcs.returns?.terminalValue || 0;
        const projectedValueCreation = stabilizedValue && totalCapitalization
          ? stabilizedValue - totalCapitalization
          : 0;
        const returnOnCost = totalCapitalization > 0
          ? (projectedValueCreation / totalCapitalization) * 100
          : 0;

        // Property Overview fields from screenshot
        const propType = property?.property_type || property?.type || 'N/A';
        const yearBuilt = property?.year_built || 'N/A';
        const totalUnits = property?.total_units || property?.units || 0;
        const totalBuildings = property?.buildings || property?.building_count || 'N/A';
        const totalSqFt = property?.total_sq_ft || property?.net_rentable_sf || 0;
        const rawOccupancyRate = property?.occupancy_rate || 90.9;
        const occupiedUnits = property?.occupied_units || Math.round(totalUnits * (rawOccupancyRate / 100));
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : rawOccupancyRate;
        const pricePerUnit = totalUnits > 0 ? summaryPurchasePrice / totalUnits : 0;
        const pricePerSqFt = totalSqFt > 0 ? summaryPurchasePrice / totalSqFt : 0;
        const avgUnitSize = totalUnits > 0 && totalSqFt > 0 ? Math.round(totalSqFt / totalUnits) : 0;
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

              {/* ========== PROPERTY OVERVIEW SECTION (IM Style) ========== */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '14px',
                  marginRight: '10px'
                }}>1</div>
                <Home style={{ width: '20px', height: '20px', color: '#374151', marginRight: '8px' }} />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PROPERTY OVERVIEW
                </h2>
              </div>

              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                padding: '24px', 
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                  
                  {/* Asset Details Table */}
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
                      ASSET DETAILS
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Property Type</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{propType}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Year Built</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{yearBuilt}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Total Units</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{totalUnits}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Buildings</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{totalBuildings}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Total Sq Ft</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{totalSqFt.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Occupancy Rate Card */}
                  <div style={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
                      OCCUPANCY RATE
                    </div>
                    <div style={{ fontSize: '42px', fontWeight: '800', color: '#10b981' }}>
                      {occupancyRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {occupiedUnits} of {totalUnits} units
                    </div>
                  </div>

                  {/* Price Per Unit Card */}
                  <div style={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
                      PRICE PER UNIT
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: '800', color: 'white' }}>
                      ${pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      acquisition basis
                    </div>
                  </div>

                  {/* Price Per Sq Ft + Avg Unit Size */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Price Per Sq Ft */}
                    <div style={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      flex: 1
                    }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                        PRICE PER SQ FT
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>
                        ${pricePerSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>building area</div>
                    </div>
                    {/* Avg Unit Size */}
                    <div style={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      padding: '16px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      flex: 1
                    }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                        AVG UNIT SIZE
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>
                        {avgUnitSize.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>sq ft per unit</div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ========== INVESTMENT PERFORMANCE METRICS ========== */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '14px',
                  marginRight: '10px'
                }}>2</div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  INVESTMENT PERFORMANCE METRICS
                </h2>
              </div>

              {/* Three Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                
                {/* Going-in Cap Rate - Dark Blue */}
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '24px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '12px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>GOING-IN CAP RATE</div>
                  <div style={{ fontSize: '42px', fontWeight: '800', color: 'white', marginBottom: '8px' }}>
                    {goingInCapRate.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400' }}>
                    Current NOI / Purchase Price
                  </div>
                </div>

                {/* Cash-on-Cash Return - Dark */}
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '24px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '12px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>CASH-ON-CASH RETURN</div>
                  <div style={{ fontSize: '42px', fontWeight: '800', color: cashOnCashReturn >= 0 ? '#10b981' : '#ef4444', marginBottom: '8px' }}>
                    {cashOnCashReturn.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400' }}>
                    Annual Cash Flow / Equity
                  </div>
                </div>

                {/* Debt Service Coverage - Dark */}
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '24px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '12px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>DEBT SERVICE COVERAGE</div>
                  <div style={{ fontSize: '42px', fontWeight: '800', color: summaryDscr >= 1.25 ? '#10b981' : '#ef4444', marginBottom: '8px' }}>
                    {summaryDscr.toFixed(2)}x
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400' }}>
                    NOI / Annual Debt Service
                  </div>
                </div>
              </div>

              {/* Two Info Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                
                {/* Net Operating Income */}
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '8px', 
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>NET OPERATING INCOME (NOI)</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500', marginBottom: '4px' }}>
                    Before Financing (No Debt Modeled)
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: annualCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
                    ${Math.abs(annualCashFlow).toLocaleString()}
                  </div>
                </div>

                {/* Stabilized Value */}
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '8px', 
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>STABILIZED VALUE</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500', marginBottom: '4px' }}>
                    At Exit Cap Rate
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>
                    ${stabilizedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Total Capitalization Summary - Dark gradient card */}
              <div style={{ 
                background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
                borderRadius: '16px', 
                padding: '32px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
                  <DollarSign style={{ width: '24px', height: '24px', color: '#10b981', marginRight: '12px' }} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white', letterSpacing: '0.5px' }}>
                    Total Capitalization Summary
                  </h3>
                </div>

                {/* Top Row - Components */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '28px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                      PURCHASE PRICE
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
                      ${summaryPurchasePrice.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                      + CLOSING & FEES
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
                      ${closingFees.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                      + CAPEX BUDGET
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
                      ${capexBudget.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ 
                    backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                    borderRadius: '12px', 
                    padding: '16px',
                    border: '2px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ fontSize: '11px', color: '#6ee7b7', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase' }}>
                      TOTAL CAPITALIZATION
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#10b981' }}>
                      ${totalCapitalization.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: '28px' }}></div>

                {/* Bottom Section - Value Creation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>
                      Projected Value Creation
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '400' }}>
                      Stabilized Value - Total Investment
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981', marginBottom: '4px' }}>
                      ${projectedValueCreation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6ee7b7', fontWeight: '600' }}>
                      {returnOnCost.toFixed(1)}% Return on Cost
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );

      case 'property':
        // Property Metrics Comparison
        return (
          <div style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
            {/* OLD KEY METRICS - REMOVE THIS SECTION */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'none' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>Key Metrics Comparison</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>Metric</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Current</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Pro Forma</div>
                </div>
                
                {/* Monthly Cashflow */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Monthly Cashflow</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: (scenarioData.pnl?.noi ? ((scenarioData.pnl.noi - (scenarioData.pricing_financing?.annual_debt_service || 0)) / 12) : 0) >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(scenarioData.pnl?.noi ? ((scenarioData.pnl.noi - (scenarioData.pricing_financing?.annual_debt_service || 0)) / 12) : 0)}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                    {fmt(fullCalcs.year1?.cashFlow || 0)}
                  </div>
                </div>
                
                {/* Annualized */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Annualized</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fmt(scenarioData.pnl?.noi ? scenarioData.pnl.noi - (scenarioData.pricing_financing?.annual_debt_service || 0) : 0)}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fmt((fullCalcs.year1?.cashFlow || 0) * 12)}
                  </div>
                </div>
                
                {/* Annualized ROI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Annualized ROI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {scenarioData.pnl?.noi && scenarioData.pricing_financing?.down_payment ? 
                      `${(((scenarioData.pnl.noi - (scenarioData.pricing_financing?.annual_debt_service || 0)) / scenarioData.pricing_financing.down_payment) * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', color: '#ef4444' }}>
                    {fullCalcs.returns?.leveredIRR ? `${(fullCalcs.returns.leveredIRR * 100).toFixed(1)}%` : '-174.0%'}
                  </div>
                </div>
                
                {/* Cap Rate */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Cap Rate</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {scenarioData.pnl?.cap_rate ? `${scenarioData.pnl.cap_rate.toFixed(2)}%` : '5.25%'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.capRate ? `${fullCalcs.year1.capRate.toFixed(2)}%` : '5.28%'}
                  </div>
                </div>
                
                {/* DSCR */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>DSCR</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {scenarioData.underwriting?.dscr ? `${scenarioData.underwriting.dscr.toFixed(2)}x` : 'N/A'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.dscr ? `${fullCalcs.year1.dscr.toFixed(2)}x` : '1.03x'}
                  </div>
                </div>
                
                {/* Cash on Cash */}
                <div style={{ display: 'flex', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Cash on Cash</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {scenarioData.pnl?.noi && scenarioData.pricing_financing?.down_payment ? 
                      `${(((scenarioData.pnl.noi - (scenarioData.pricing_financing?.annual_debt_service || 0)) / scenarioData.pricing_financing.down_payment) * 100).toFixed(1)}%` : '13.1%'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.cashOnCash ? `${fullCalcs.year1.cashOnCash.toFixed(1)}%` : '0.6%'}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Financial Breakdown */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>Detailed Financial Breakdown</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>Item</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Current</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Pro Forma</div>
                </div>
                
                {/* Gross Rents */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Gross Rents</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.pnl?.effective_gross_income || scenarioData.pnl?.gross_potential_rent || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.potentialGrossIncome || 0)}</div>
                </div>
                
                {/* Property Management */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Property Management</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.management || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.08 : 0)}</div>
                </div>
                
                {/* Taxes */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Taxes</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.taxes || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.15 : 0)}</div>
                </div>
                
                {/* Insurance */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Insurance</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.insurance || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.02 : 0)}</div>
                </div>
                
                {/* Utilities */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Utilities</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.utilities || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.08 : 0)}</div>
                </div>
                
                {/* Vacancy Reserve */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Vacancy Reserve</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.pnl?.vacancy_amount || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.vacancyLoss || 0)}</div>
                </div>
                
                {/* Maintenance */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Maintenance</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.repairs_maintenance || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.10 : 0)}</div>
                </div>
                
                {/* Monthly NOI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#111827', fontSize: '14px' }}>Monthly NOI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt((scenarioData.pnl?.noi || 0) / 12)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt((fullCalcs.year1?.noi || 0) / 12)}</div>
                </div>
                
                {/* Yearly NOI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#111827', fontSize: '14px' }}>Yearly NOI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt(scenarioData.pnl?.noi || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt(fullCalcs.year1?.noi || 0)}</div>
                </div>
                
                {/* Mortgage */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Mortgage</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.financing?.loanAmount || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.financing?.loanAmount || 0)}</div>
                </div>
                
                {/* Sale Price */}
                <div style={{ display: 'flex', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Sale Price</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.acquisition?.purchasePrice || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.acquisition?.purchasePrice || 0)}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'characteristics':
        const pnl = scenarioData.pnl || {};
        const expensesData = scenarioData.expenses || {};
        const unitMix = scenarioData.unit_mix || [];
        const financing = scenarioData.financing || {};
        
        // Calculate loan amount from price and down payment if not in fullCalcs
        const charPrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const charDownPct = pricing_financing?.down_payment_pct || 0;
        const charLtv = pricing_financing?.ltv || 0;
        let charLoanAmount = fullCalcs?.financing?.loanAmount || pricing_financing?.loan_amount || 0;
        if (!charLoanAmount && charPrice > 0) {
          if (charDownPct > 0) {
            charLoanAmount = charPrice * (1 - charDownPct / 100);
          } else if (charLtv > 0) {
            charLoanAmount = charPrice * (charLtv / 100);
          }
        }
        
        // Property metrics for this case
        const charTotalUnits = property?.total_units || property?.units || 0;
        const charOccupancyRate = property?.occupancy_rate ? property.occupancy_rate / 100 : 0.909;
        const charPricePerUnit = charTotalUnits > 0 ? (pricing_financing?.price || 0) / charTotalUnits : 0;
        const charPricePerSqFt = (property?.total_sq_ft || property?.rba_sqft) > 0 ? (pricing_financing?.price || 0) / (property?.total_sq_ft || property?.rba_sqft) : 0;
        const charAvgUnitSize = charTotalUnits > 0 && (property?.total_sq_ft || property?.rba_sqft) > 0 ? Math.round((property?.total_sq_ft || property?.rba_sqft) / charTotalUnits) : 0;
        
        // Input style helper - styled like screenshot
        const inputStyle = { 
          width: '100%', 
          padding: '8px 12px', 
          border: '2px solid #e5e7eb', 
          borderRadius: '8px', 
          fontSize: '14px',
          textAlign: 'right',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s'
        };
        const inputStyleLeft = { 
          ...inputStyle,
          textAlign: 'left'
        };
        const readOnlyStyle = {
          ...inputStyle,
          backgroundColor: '#f9fafb',
          color: '#374151',
          border: '2px solid #e5e7eb'
        };
        const labelStyle = { 
          fontSize: '13px', 
          color: '#374151', 
          marginBottom: '6px',
          display: 'block',
          fontWeight: '600'
        };
        const selectStyle = {
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer'
        };
        
        // Calculate totals
        const totalUtilitiesMonthly = ((expensesData.gas || 0) + (expensesData.electrical || 0) + (expensesData.water || 0) + (expensesData.sewer || 0) + (expensesData.trash || 0)) / 12;
        const grossPotentialRent = pnl.gross_potential_rent || pnl.scheduled_gross_rent_current || scenarioData.income?.gross_potential_rent || fullCalcs?.year1?.potentialGrossIncome || 0;
        const otherIncome = pnl.other_income || scenarioData.income?.other_income || 0;
        const vacancyRate = pnl.vacancy_rate || expensesData.vacancy_rate || 5;
        const effectiveGrossIncome = pnl.effective_gross_income || pnl.effective_gross_income_current || fullCalcs?.year1?.effectiveGrossIncome || (grossPotentialRent - (grossPotentialRent * vacancyRate / 100) + otherIncome);
        const totalInitialCash = (fullCalcs.financing?.totalEquityRequired || 0) + 
          ((pricing_financing?.price || 0) * ((scenarioData.acquisition_costs?.closing_costs_pct || 0) / 100)) +
          (scenarioData.acquisition_costs?.rehab_cost || 0);
        
        return (
          <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '0 20px 40px' }}>
            {/* Investment Memorandum Header */}
            <div style={{ background: 'linear-gradient(135deg, #2d5a7b 0%, #1e3a5f 100%)', padding: '16px 24px', color: 'white', marginBottom: '20px', borderRadius: '0 0 8px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', opacity: 0.9 }}>INVESTMENT MEMORANDUM</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>Prepared by CRE Valuation Pro • Confidential Investment Memorandum</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', opacity: 0.9 }}>TOTAL CAPITALIZATION</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>{fmt(totalInitialCash)}</div>
                </div>
              </div>
            </div>

            {/* Property Overview Section with EDITABLE fields */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>1</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Home size={20} color="#374151" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROPERTY OVERVIEW</h3>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                {/* Asset Details - EDITABLE */}
                <div style={{ backgroundColor: '#e5e7eb', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ASSET DETAILS</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Property Type</label>
                      <input type="text" style={{ ...inputStyleLeft, fontSize: '13px', fontWeight: '600' }} value={property?.property_type || ''} 
                        onChange={(e) => onEditData && onEditData('property.property_type', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Year Built</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.year_built || ''} 
                        onChange={(e) => onEditData && onEditData('property.year_built', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Total Units</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.units || ''} 
                        onChange={(e) => onEditData && onEditData('property.units', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Buildings</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.buildings || ''} 
                        onChange={(e) => onEditData && onEditData('property.buildings', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Total Sq Ft</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.rba_sqft || ''} 
                        onChange={(e) => onEditData && onEditData('property.rba_sqft', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
                
                {/* Occupancy Rate */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>OCCUPANCY RATE</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{(charOccupancyRate * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{Math.round(charOccupancyRate * charTotalUnits)} of {charTotalUnits} units</div>
                </div>
                
                {/* Price per Unit */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRICE PER UNIT</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1 }}>${charPricePerUnit.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>acquisition basis</div>
                </div>
                
                {/* Price per Sq Ft & Avg Unit Size */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRICE PER SQ FT</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1 }}>${charPricePerSqFt.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>building area</div>
                  </div>
                  <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AVG UNIT SIZE</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1 }}>{charAvgUnitSize.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>sq ft per unit</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unit Mix & Rent Analysis Section - EDITABLE */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>2</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart size={20} color="#374151" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>UNIT MIX & RENT ANALYSIS</h3>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f2937', color: 'white' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Unit Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Units</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Avg Sq Ft</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Current Rent</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Market Rent</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Upside</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.length > 0 ? unitMix.map((unit, idx) => {
                      const currentRent = unit.rent_current || unit.current_rent || unit.rent || 0;
                      const marketRent = unit.rent_market || unit.market_rent || currentRent;
                      const upside = marketRent - currentRent;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{unit.unit_type || unit.type || `${idx + 1} Bed - ${idx + 1} Bath`}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>{unit.units || unit.count || 1}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{unit.unit_sf || unit.sqft || '850'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#111827' }}>${currentRent.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#2563eb' }}>${marketRent.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: upside > 0 ? '#10b981' : '#6b7280' }}>
                            {upside > 0 ? `+$${upside.toLocaleString()}` : '$0'}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No unit mix data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ALL EDITABLE FIELDS SECTION - Proforma and More */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>Property Details & Financials</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Property Information */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Information</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Address</label>
                      <input type="text" style={inputStyleLeft} value={property?.address || ''} 
                        onChange={(e) => onEditData && onEditData('property.address', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>City</label>
                      <input type="text" style={inputStyleLeft} value={property?.city || ''} 
                        onChange={(e) => onEditData && onEditData('property.city', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>State</label>
                        <input type="text" style={inputStyleLeft} value={property?.state || ''} 
                          onChange={(e) => onEditData && onEditData('property.state', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>ZIP</label>
                        <input type="text" style={inputStyle} value={property?.zip || ''} 
                          onChange={(e) => onEditData && onEditData('property.zip', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Land Area (Acres)</label>
                      <input type="number" step="0.01" style={inputStyle} value={property?.land_area_acres || ''} 
                        onChange={(e) => onEditData && onEditData('property.land_area_acres', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>

                {/* Pricing & Financing */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pricing & Financing</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Purchase Price *</label>
                      <input type="number" style={inputStyle} value={pricing_financing?.price || ''} 
                        onChange={(e) => onEditData && onEditData('pricing_financing.price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Down Payment %</label>
                        <input type="number" style={inputStyle} value={(100 - (financing.ltv || 75)).toFixed(1)} 
                          onChange={(e) => onEditData && onEditData('financing.ltv', 100 - (parseFloat(e.target.value) || 0))} />
                      </div>
                      <div>
                        <label style={labelStyle}>LTV %</label>
                        <input type="number" style={inputStyle} value={financing.ltv || 75} 
                          onChange={(e) => onEditData && onEditData('financing.ltv', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Interest Rate %</label>
                      <input type="number" step="0.1" style={inputStyle} value={financing.interest_rate || 6} 
                        onChange={(e) => onEditData && onEditData('financing.interest_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Term (Years)</label>
                        <input type="number" style={inputStyle} value={financing.term_years || financing.amortization_years || 30} 
                          onChange={(e) => onEditData && onEditData('financing.term_years', parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Amort (Years)</label>
                        <input type="number" style={inputStyle} value={financing.amortization_years || 30} 
                          onChange={(e) => onEditData && onEditData('financing.amortization_years', parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Loan Amount</label>
                      <input type="number" style={readOnlyStyle} value={charLoanAmount || ''} readOnly />
                    </div>
                  </div>
                </div>

                {/* Income */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Income</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Gross Potential Rent (Annual) *</label>
                      <input type="number" style={inputStyle} value={grossPotentialRent || ''} 
                        onChange={(e) => onEditData && onEditData('income.gross_potential_rent', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Other Income (Annual)</label>
                      <input type="number" style={inputStyle} value={otherIncome || ''} 
                        onChange={(e) => onEditData && onEditData('income.other_income', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Effective Gross Income</label>
                      <input type="number" style={readOnlyStyle} value={Math.round(effectiveGrossIncome)} readOnly />
                    </div>
                    <div>
                      <label style={labelStyle}>Vacancy Rate (%)</label>
                      <input type="number" step="0.1" style={inputStyle} value={expensesData.vacancy_rate || ''} 
                        onChange={(e) => onEditData && onEditData('expenses.vacancy_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Property Management (%)</label>
                      <input type="number" step="0.1" style={inputStyle} value={expensesData.management_rate || ''} 
                        onChange={(e) => onEditData && onEditData('expenses.management_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Annual Expenses</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Real Estate Taxes</label>
                    <input type="number" style={inputStyle} value={expensesData.taxes || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.taxes', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Insurance</label>
                    <input type="number" style={inputStyle} value={expensesData.insurance || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.insurance', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Repairs & Maintenance</label>
                    <input type="number" style={inputStyle} value={expensesData.repairs || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.repairs', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Management Fees</label>
                    <input type="number" style={inputStyle} value={expensesData.management || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.management', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Payroll</label>
                    <input type="number" style={inputStyle} value={expensesData.payroll || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.payroll', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>CapEx Rate (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={expensesData.capex_rate || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.capex_rate', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Other Expenses</label>
                    <input type="number" style={inputStyle} value={expensesData.other || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.other', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Utilities (Annual)</label>
                    <input type="number" style={readOnlyStyle} value={Math.round(totalUtilitiesMonthly * 12)} readOnly />
                  </div>
                </div>
              </div>

              {/* Utilities Breakdown */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utilities (Monthly)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Gas</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.gas || 0) / 12) || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.gas', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Electrical</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.electrical || 0) / 12) || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.electrical', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Water</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.water || 0) / 12) || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.water', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sewer</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.sewer || 0) / 12) || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.sewer', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Trash</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.trash || 0) / 12) || ''} 
                      onChange={(e) => onEditData && onEditData('expenses.trash', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                </div>
              </div>

              {/* Acquisition Costs */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acquisition Costs</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Realtor Fees (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.realtor_fee_pct || ''} 
                      onChange={(e) => onEditData && onEditData('acquisition_costs.realtor_fee_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Closing Costs (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.closing_costs_pct || ''} 
                      onChange={(e) => onEditData && onEditData('acquisition_costs.closing_costs_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Acquisition Fee (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.acquisition_fee_pct || ''} 
                      onChange={(e) => onEditData && onEditData('acquisition_costs.acquisition_fee_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Rehab Cost</label>
                    <input type="number" style={inputStyle} value={scenarioData.acquisition_costs?.rehab_cost || ''} 
                      onChange={(e) => onEditData && onEditData('acquisition_costs.rehab_cost', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              {/* Proforma Section */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proforma Analysis</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #86efac' }}>
                    <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>NOI (Year 1)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(fullCalcs.year1?.noi)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #93c5fd' }}>
                    <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Cap Rate</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{pct(fullCalcs.year1?.capRate)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #fcd34d' }}>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Cash-on-Cash</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{pct(fullCalcs.year1?.cashOnCash)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '2px solid #c4b5fd' }}>
                    <div style={{ fontSize: 11, color: '#6b21a8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>DSCR</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{fullCalcs.year1?.dscr?.toFixed(2) || 'N/A'}x</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fce7f3', borderRadius: '8px', border: '2px solid #f9a8d4' }}>
                    <div style={{ fontSize: 11, color: '#9f1239', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Annual Cash Flow</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#be123c' }}>{fmt(fullCalcs.year1?.cashFlow)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#f0fdfa', borderRadius: '8px', border: '2px solid #5eead4' }}>
                    <div style={{ fontSize: 11, color: '#115e59', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Total Expenses</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f766e' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'expenses':
        const totalUtilities = scenarioData.expenses?.utilities || 0;
        const utilityBreakdown = scenarioData.expenses?.utility_breakdown || {};
        
        // If we have a total utilities amount but no breakdown, split evenly across common utilities
        const hasBreakdown = Object.keys(utilityBreakdown).length > 0;
        const defaultUtilities = hasBreakdown ? utilityBreakdown : {
          water: totalUtilities / 8,
          electricity: totalUtilities / 8,
          gas: totalUtilities / 8,
          trash: totalUtilities / 8,
          sewer: totalUtilities / 8,
          internet: totalUtilities / 8,
          landscaping: totalUtilities / 8,
          pest_control: totalUtilities / 8
        };
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
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
                }}>10</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  OPERATING EXPENSES
                </h2>
              </div>

              {/* Main Expenses Section */}
              <div style={{ 
                marginBottom: '24px', 
                padding: '28px', 
                backgroundColor: '#1e293b',
                borderRadius: '16px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
              }}>
                <div style={{ 
                  padding: '16px 20px', 
                  marginBottom: '24px',
                  borderBottom: '1px solid #475569',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: '12px 12px 0 0',
                  marginLeft: '-28px',
                  marginRight: '-28px',
                  marginTop: '-28px'
                }}>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    fontWeight: '700', 
                    color: 'white', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px' 
                  }}>Primary Expenses</h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Taxes</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.taxes || 0}
                      onChange={(e) => onEditData && onEditData('expenses.taxes', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Insurance</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.insurance || 0}
                      onChange={(e) => onEditData && onEditData('expenses.insurance', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Utilities</label>
                    <input 
                      type="number"
                      value={totalUtilities}
                      onChange={(e) => onEditData && onEditData('expenses.utilities', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Repairs & Maintenance</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.repairs_maintenance || 0}
                      onChange={(e) => onEditData && onEditData('expenses.repairs_maintenance', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Management</label>
                    <input 
                      type="range"
                      min="0"
                      max="100000"
                      step="100"
                      value={scenarioData.expenses?.management || 0}
                      onChange={(e) => onEditData && onEditData('expenses.management', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #10b981 0%, #3b82f6 100%)', outline: 'none', WebkitAppearance: 'none', appearance: 'none' }}
                    />
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px', fontWeight: '600' }}>
                      ${(scenarioData.expenses?.management || 0).toLocaleString()}/month ({(((scenarioData.expenses?.management || 0) / ((scenarioData.pnl?.gross_potential_rent || 0) / 12)) * 100).toFixed(1)}% of GRI)
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vacancy</label>
                    <input 
                      type="range"
                      min="0"
                      max="50000"
                      step="100"
                      value={scenarioData.expenses?.vacancy || 0}
                      onChange={(e) => onEditData && onEditData('expenses.vacancy', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 100%)', outline: 'none', WebkitAppearance: 'none', appearance: 'none' }}
                    />
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px', fontWeight: '600' }}>
                      ${(scenarioData.expenses?.vacancy || 0).toLocaleString()}/month ({(((scenarioData.expenses?.vacancy || 0) / ((scenarioData.pnl?.gross_potential_rent || 0) / 12)) * 100).toFixed(1)}% of GRI)
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cap Ex</label>
                    <input 
                      type="range"
                      min="0"
                      max="100000"
                      step="500"
                      value={scenarioData.expenses?.capex || 0}
                      onChange={(e) => onEditData && onEditData('expenses.capex', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #8b5cf6 0%, #ec4899 100%)', outline: 'none', WebkitAppearance: 'none', appearance: 'none' }}
                    />
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px', fontWeight: '600' }}>
                      ${(scenarioData.expenses?.capex || 0).toLocaleString()}/month ({(((scenarioData.expenses?.capex || 0) / ((scenarioData.pnl?.gross_potential_rent || 0) / 12)) * 100).toFixed(1)}% of GRI)
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Admin</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.admin || 0}
                      onChange={(e) => onEditData && onEditData('expenses.admin', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Marketing</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.marketing || 0}
                      onChange={(e) => onEditData && onEditData('expenses.marketing', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Other</label>
                    <input 
                      type="number"
                      value={scenarioData.expenses?.other || 0}
                      onChange={(e) => onEditData && onEditData('expenses.other', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: '#1e293b', color: 'white' }}
                    />
                  </div>
                </div>
              </div>

              {/* Utility Breakdown Section */}
              {totalUtilities > 0 && (
                <div style={{ 
                  marginBottom: '24px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)',
                    padding: '12px 20px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#f0fdfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utility Breakdown</h4>
                    <p style={{ fontSize: '11px', margin: '4px 0 0 0', color: '#99f6e4' }}>
                      {hasBreakdown ? 'Edit individual utility amounts below' : 'Utilities are split evenly. Edit amounts to customize breakdown.'}
                    </p>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>💧 Water</label>
                        <input 
                          type="number"
                          value={defaultUtilities.water || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.water', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>⚡ Electricity</label>
                        <input 
                          type="number"
                          value={defaultUtilities.electricity || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.electricity', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>🔥 Gas</label>
                        <input 
                          type="number"
                          value={defaultUtilities.gas || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.gas', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>🗑️ Trash/Waste</label>
                        <input 
                          type="number"
                          value={defaultUtilities.trash || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.trash', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>🚰 Sewer</label>
                        <input 
                          type="number"
                          value={defaultUtilities.sewer || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.sewer', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>📡 Internet/Cable</label>
                        <input 
                          type="number"
                          value={defaultUtilities.internet || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.internet', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>🌿 Landscaping/Irrigation</label>
                        <input 
                          type="number"
                          value={defaultUtilities.landscaping || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.landscaping', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748b' }}>🐛 Pest Control</label>
                        <input 
                          type="number"
                          value={defaultUtilities.pest_control || 0}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value) || 0;
                            onEditData && onEditData('expenses.utility_breakdown.pest_control', newValue);
                          }}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: '600', backgroundColor: 'white', color: '#1e293b' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utility Breakdown Total</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>
                        ${((defaultUtilities.water || 0) + (defaultUtilities.electricity || 0) + (defaultUtilities.gas || 0) + (defaultUtilities.trash || 0) + (defaultUtilities.sewer || 0) + (defaultUtilities.internet || 0) + (defaultUtilities.landscaping || 0) + (defaultUtilities.pest_control || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Expenses */}
              <div style={{ 
                borderRadius: '16px',
                marginBottom: '24px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)',
                  padding: '12px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#f0fdfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Annual Operating Expenses</span>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#fecaca' }}>
                    ${((scenarioData.expenses?.taxes || 0) + (scenarioData.expenses?.insurance || 0) + (scenarioData.expenses?.utilities || 0) + (scenarioData.expenses?.repairs_maintenance || 0) + (scenarioData.expenses?.management || 0) + (scenarioData.expenses?.admin || 0) + (scenarioData.expenses?.marketing || 0) + (scenarioData.expenses?.other || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            
              {/* Live Impact Preview */}
              <div style={{ 
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)',
                  padding: '12px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#f0fdfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Live Impact Preview</span>
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#99f6e4' }}>Updates as you edit</span>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOI</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>{fmt(fullCalcs.year1?.noi || 0)}</div>
                    </div>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cap Rate</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>{pct(fullCalcs.year1?.capRate || 0)}</div>
                    </div>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash Flow</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: fullCalcs.year1?.cashFlow >= 0 ? '#0f766e' : '#ef4444' }}>{fmt(fullCalcs.year1?.cashFlow || 0)}</div>
                    </div>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash-on-Cash</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>{pct(fullCalcs.year1?.cashOnCash || 0)}</div>
                    </div>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DSCR</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>{fullCalcs.year1?.dscr?.toFixed(2) || 'N/A'}x</div>
                    </div>
                    <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expense Ratio</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>{pct(fullCalcs.year1?.expenseRatio || 0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'value-add':
        // Calculate current metrics
        const currentNOI = fullCalcs.year1?.noi || 0;
        const currentPurchasePrice = scenarioData.pricing_financing?.purchase_price || 0;
        const currentCapRate = fullCalcs.year1?.capRate || 0;
        const currentDSCR = fullCalcs.year1?.dscr || 0;
        const valueAddTotalUnits = scenarioData.property?.units || 0;
        const valueAddAnnualDebtService = scenarioData.pricing_financing?.annual_debt_service || fullCalcs.financing?.annualDebtService || 0;
        
        // Get current and market rents from actual unit mix data - SHOW TOTAL NOT AVERAGE
        const valueAddUnitMix = scenarioData.unit_mix || [];
        const totalCurrentMonthlyRent = valueAddUnitMix.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
        const avgCurrentRent = valueAddTotalUnits > 0 ? totalCurrentMonthlyRent / valueAddTotalUnits : 0;
        
        // Calculate market rent from unit mix (use rent_market if exists, otherwise use rent_current)
        const totalMarketMonthlyRent = valueAddUnitMix.reduce((sum, u) => {
          const marketRent = u.rent_market && u.rent_market > 0 ? u.rent_market : u.rent_current || 0;
          return sum + ((u.units || 0) * marketRent);
        }, 0);
        const avgMarketRent = valueAddTotalUnits > 0 ? totalMarketMonthlyRent / valueAddTotalUnits : 0;
        
        // Use calculated totals
        const currentRent = totalCurrentMonthlyRent;
        const marketRent = totalMarketMonthlyRent;
        const rentUpside = marketRent - currentRent;
        const totalMonthlyRentUpside = rentUpside;
        const totalAnnualRentUpside = totalMonthlyRentUpside * 12;
        
        // Get expense optimization data with RUBS
        const currentExpenses = {
          taxes: scenarioData.expenses?.taxes || 0,
          insurance: scenarioData.expenses?.insurance || 0,
          utilities: scenarioData.expenses?.utilities || 0,
          repairs: scenarioData.expenses?.repairs_maintenance || 0,
          management: scenarioData.expenses?.management || 0,
          admin: scenarioData.expenses?.admin || 0,
          marketing: scenarioData.expenses?.marketing || 0,
          other: scenarioData.expenses?.other || 0
        };
        
        // RUBS configuration (Ratio Utility Billing System)
        const rubsConfig = scenarioData.value_add?.rubs_config || {
          water: { tenant_paid: false, split_method: 'per_unit' },
          electricity: { tenant_paid: false, split_method: 'sqft' },
          gas: { tenant_paid: false, split_method: 'per_unit' },
          trash: { tenant_paid: false, split_method: 'per_unit' },
          sewer: { tenant_paid: false, split_method: 'per_unit' }
        };
        
        // Calculate utility breakdown for value-add
        const valueAddUtilityBreakdown = scenarioData.expenses?.utility_breakdown || {
          water: currentExpenses.utilities / 5,
          electricity: currentExpenses.utilities / 5,
          gas: currentExpenses.utilities / 5,
          trash: currentExpenses.utilities / 5,
          sewer: currentExpenses.utilities / 5
        };
        
        // Calculate RUBS savings (utilities pushed to tenants)
        const rubsSavings = Object.keys(valueAddUtilityBreakdown).reduce((total, utility) => {
          if (rubsConfig[utility]?.tenant_paid) {
            return total + (valueAddUtilityBreakdown[utility] || 0);
          }
          return total;
        }, 0);
        
        // Optimized expenses with RUBS
        const optimizedExpenses = scenarioData.value_add?.optimized_expenses || { ...currentExpenses };
        optimizedExpenses.utilities = currentExpenses.utilities - rubsSavings;
        
        const totalCurrentExpenses = Object.values(currentExpenses).reduce((a, b) => a + b, 0);
        const totalOptimizedExpenses = Object.values(optimizedExpenses).reduce((a, b) => a + b, 0);
        const expenseSavings = totalCurrentExpenses - totalOptimizedExpenses;
        
        // Calculate stabilized metrics
        // Use market cap rate if available, otherwise fall back to current cap rate
        const valueAddMarketCapRate = marketCapRate?.market_cap_rate ? (marketCapRate.market_cap_rate / 100) : (currentCapRate / 100 || 0.05);
        const stabilizedNOI = currentNOI + totalAnnualRentUpside + expenseSavings;
        const valueAddStabilizedValue = valueAddMarketCapRate > 0 ? stabilizedNOI / valueAddMarketCapRate : 0;
        const valueCreation = valueAddStabilizedValue - currentPurchasePrice;
        const stabilizedDSCR = valueAddAnnualDebtService > 0 ? stabilizedNOI / valueAddAnnualDebtService : 0;
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
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
                }}>6</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VALUE-ADD STRATEGY
                </h2>
              </div>

              {/* Value Creation Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    CURRENT VALUE
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>
                    ${currentPurchasePrice.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: marketCapRate ? '#0c4a6e' : '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  border: marketCapRate ? '2px solid #0ea5e9' : 'none'
                }}>
                  <div style={{ fontSize: '11px', color: marketCapRate ? '#7dd3fc' : '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    MARKET CAP RATE {marketCapRate ? '✓' : ''}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: marketCapRate ? '#38bdf8' : '#64748b' }}>
                    {marketCapRate ? `${marketCapRate.market_cap_rate.toFixed(2)}%` : marketCapRateLoading ? 'Loading...' : '-'}
                  </div>
                  {marketCapRate && (
                    <div style={{ fontSize: '10px', color: '#7dd3fc', marginTop: '4px' }}>
                      {marketCapRate.asset_class} Class • {marketCapRate.market_tier}
                    </div>
                  )}
                </div>
                
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    STABILIZED VALUE
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>
                    ${valueAddStabilizedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    @ {marketCapRate ? `${marketCapRate.market_cap_rate.toFixed(2)}%` : `${(valueAddMarketCapRate * 100).toFixed(2)}%`} cap
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    VALUE CREATION
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                    ${valueCreation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ROI ON COST
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>
                    {currentPurchasePrice > 0 ? ((valueCreation / currentPurchasePrice) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                
                {/* RENT OPTIMIZATION */}
                <div style={{ 
                  padding: '28px', 
                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                  border: '1px solid #e5e7eb', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ 
                    padding: '16px 20px', 
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '12px 12px 0 0',
                    marginLeft: '-28px',
                    marginRight: '-28px',
                    marginTop: '-28px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: 'white', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>🎯 Rent Optimization</h4>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    {/* Individual Unit Rows */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px 8px 0 0', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', textTransform: 'uppercase' }}>Unit Type</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', textTransform: 'uppercase', textAlign: 'center' }}>Units</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', textTransform: 'uppercase', textAlign: 'right' }}>Current Rent</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', textTransform: 'uppercase', textAlign: 'right' }}>Market Rent</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'white', textTransform: 'uppercase', textAlign: 'right' }}>$ Raise Per Unit</div>
                      </div>
                      
                      {valueAddUnitMix.map((unit, index) => {
                        const unitCurrentRent = unit.rent_current || 0;
                        const unitMarketRent = unit.rent_market || unitCurrentRent;
                        const raisePerUnit = unitMarketRent - unitCurrentRent;
                        return (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '16px', backgroundColor: 'white', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{unit.unit_type || `Unit ${index + 1}`}</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>{unit.units || 0}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d', textAlign: 'right' }}>${unitCurrentRent.toLocaleString()}</div>
                            <div style={{ textAlign: 'right' }}>
                              <input 
                                type="number"
                                value={unitMarketRent}
                                onChange={(e) => {
                                  const newMarketRent = parseFloat(e.target.value) || 0;
                                  const updatedUnitMix = [...valueAddUnitMix];
                                  updatedUnitMix[index] = { ...updatedUnitMix[index], rent_market: newMarketRent };
                                  onEditData && onEditData('unit_mix', updatedUnitMix);
                                }}
                                style={{ 
                                  width: '100%', 
                                  fontSize: '14px', 
                                  fontWeight: '700', 
                                  color: '#1e40af', 
                                  backgroundColor: '#eff6ff',
                                  border: '2px solid #93c5fd',
                                  borderRadius: '6px',
                                  outline: 'none',
                                  padding: '6px 8px',
                                  textAlign: 'right'
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: raisePerUnit >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                              {raisePerUnit >= 0 ? '+' : ''}${raisePerUnit.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total Summary */}
                    <div style={{ padding: '20px', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderRadius: '12px', border: '2px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Total Current Rent</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                          ${currentRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '2px solid #6ee7b7', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Total Market Rent</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                          ${marketRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '2px solid #6ee7b7', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Monthly Upside</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                          ${rentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '2px solid #6ee7b7' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Total Annual Increase</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                          ${totalAnnualRentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    💡 <strong>Calculation:</strong> (${marketRent.toLocaleString()} market - ${currentRent.toLocaleString()} current) × 12 months = ${totalAnnualRentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })} annual increase
                  </div>
                </div>

                {/* EXPENSE OPTIMIZATION WITH RUBS */}
                <div style={{ 
                  padding: '28px', 
                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                  border: '1px solid #e5e7eb', 
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ 
                    padding: '16px 20px', 
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    borderRadius: '12px 12px 0 0',
                    marginLeft: '-28px',
                    marginRight: '-28px',
                    marginTop: '-28px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: 'white', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>💰 Expense Optimization</h4>
                  </div>

                  {/* RUBS Configuration */}
                  <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '700', color: '#1f2937', textTransform: 'uppercase' }}>
                      ⚡ RUBS - Ratio Utility Billing System
                    </h5>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
                      Push utility costs to tenants based on unit size or occupancy
                    </div>
                    {Object.keys(valueAddUtilityBreakdown).map(utility => (
                      <div key={utility} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937', textTransform: 'capitalize' }}>
                          {utility === 'trash' ? '🗑️' : utility === 'water' ? '💧' : utility === 'electricity' ? '⚡' : utility === 'gas' ? '🔥' : '🚰'} {utility}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#1f2937' }}>
                            ${(valueAddUtilityBreakdown[utility] || 0).toLocaleString()}/yr
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input 
                              type="checkbox"
                              checked={rubsConfig[utility]?.tenant_paid || false}
                              onChange={(e) => {
                                const newConfig = { ...rubsConfig, [utility]: { ...rubsConfig[utility], tenant_paid: e.target.checked }};
                                onEditData && onEditData('value_add.rubs_config', newConfig);
                              }}
                              style={{ marginRight: '6px', width: '16px', height: '16px' }}
                            />
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>Tenant Paid</span>
                          </label>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#10b981', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>Annual RUBS Savings</span>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>
                          ${rubsSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Expense Comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#fee2e2', borderRadius: '12px', border: '2px solid #fca5a5' }}>
                      <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Current Expenses</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>
                        ${totalCurrentExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div style={{ padding: '16px', backgroundColor: '#d1fae5', borderRadius: '12px', border: '2px solid #86efac' }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Optimized Expenses</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>
                        ${totalOptimizedExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderRadius: '12px', border: '2px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#065f46' }}>Annual Expense Savings</span>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>
                        ${expenseSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stabilized Performance Metrics */}
              <div style={{ 
                padding: '28px', 
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: '16px',
                marginBottom: '24px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: 'white', 
                  marginBottom: '24px',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📊 Current vs Stabilized Performance
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  {/* NOI Comparison */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Net Operating Income</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#e2e8f0' }}>${currentNOI.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>${stabilizedNOI.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>

                  {/* Cap Rate */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Cap Rate</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Going-In</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#e2e8f0' }}>{currentCapRate.toFixed(2)}%</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Market Cap</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#60a5fa' }}>
                        {marketCapRate?.market_cap_rate?.toFixed(2) || currentCapRate.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                        {marketCapRate ? 'LLM estimate' : 'Same as going-in'}
                      </div>
                    </div>
                  </div>

                  {/* Property Value */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Property Value</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#e2e8f0' }}>${currentPurchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>${valueAddStabilizedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>

                  {/* DSCR */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>DSCR</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#e2e8f0' }}>{currentDSCR.toFixed(2)}x</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{stabilizedDSCR.toFixed(2)}x</div>
                    </div>
                  </div>

                  {/* Value Creation */}
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '20px', border: '2px solid #10b981' }}>
                    <div style={{ fontSize: '11px', color: '#d1fae5', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Value Creation</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginBottom: '8px' }}>
                      ${valueCreation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '10px', color: '#d1fae5' }}>
                      {currentPurchasePrice > 0 ? ((valueCreation / currentPurchasePrice) * 100).toFixed(1) : '0.0'}% increase in value
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Creative Suggestions */}
              <div style={{ 
                padding: '28px', 
                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                border: '2px solid #8b5cf6', 
                borderRadius: '16px',
                boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)'
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: '#5b21b6', 
                  marginBottom: '20px',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🤖 AI Value-Add Recommendations
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #a78bfa' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#6d28d9', marginBottom: '12px', textTransform: 'uppercase' }}>
                      💸 Revenue Enhancement Ideas
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#4c1d95', lineHeight: '1.8' }}>
                      <li>Implement paid parking program (+${(valueAddTotalUnits * 25).toLocaleString()}/mo)</li>
                      <li>Add pet fees ($300/pet one-time + $25/mo)</li>
                      <li>Install package lockers with monthly fee</li>
                      <li>Offer premium storage units</li>
                      <li>Laundry room revenue optimization</li>
                      <li>Vending machines & amenity income</li>
                      <li>Application & admin fees review</li>
                    </ul>
                  </div>

                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #a78bfa' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#6d28d9', marginBottom: '12px', textTransform: 'uppercase' }}>
                      📉 Expense Reduction Ideas
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#4c1d95', lineHeight: '1.8' }}>
                      <li>Implement RUBS billing system (utilities)</li>
                      <li>LED lighting conversion (-20% electric)</li>
                      <li>Low-flow fixtures (-15% water)</li>
                      <li>Negotiate insurance quotes annually</li>
                      <li>Contest property tax assessment</li>
                      <li>Bulk purchasing agreements for supplies</li>
                      <li>In-house maintenance vs contractors</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // Trigger AI chat with value-add prompt
                    if (setInputValue && handleSendMessage) {
                      setInputValue(`Analyze this deal and provide specific value-add recommendations. Current rent: $${currentRent.toFixed(0)}/unit, Market rent: $${marketRent.toFixed(0)}/unit. Total expenses: $${totalCurrentExpenses.toLocaleString()}. What creative strategies can we use to increase NOI and property value?`);
                      setTimeout(() => handleSendMessage(), 100);
                    }
                  }}
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
                >
                  🤖 Ask AI for Custom Value-Add Strategy
                </button>
              </div>

            </div>
          </div>
        );

      

      case 'amortization':
        // Calculate loan amount from price and down payment if not available
        const amortPrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const amortDownPct = pricing_financing?.down_payment_pct || 0;
        const amortLtv = pricing_financing?.ltv || 0;
        let loanAmount = fullCalcs.financing?.loanAmount || scenarioData.pricing_financing?.loan_amount || 0;
        if (!loanAmount && amortPrice > 0) {
          if (amortDownPct > 0) {
            loanAmount = amortPrice * (1 - amortDownPct / 100);
          } else if (amortLtv > 0) {
            loanAmount = amortPrice * (amortLtv / 100);
          }
        }
        
        // Get interest rate - check multiple sources
        // pricing_financing stores as decimal (0.055 for 5.5%)
        // financing object may store as percentage (5.5)
        let interestRate = pricing_financing?.interest_rate || 0;
        if (!interestRate || interestRate === 0) {
          // Check financing object (stored as percentage, convert to decimal)
          const financeRate = scenarioData.financing?.interest_rate || 0;
          if (financeRate > 0) {
            interestRate = financeRate > 1 ? financeRate / 100 : financeRate; // Convert if percentage
          }
        }
        // If still 0, use a default rate for display purposes
        if (!interestRate || interestRate === 0) {
          interestRate = 0.06; // Default 6%
        }
        
        // Get loan term
        const loanTerm = pricing_financing?.term_years || pricing_financing?.amortization_years || scenarioData.financing?.loan_term_years || 30;
        const amortizationYears = pricing_financing?.amortization_years || scenarioData.financing?.amortization_years || loanTerm;
        
        // Calculate monthly and annual debt service
        let monthlyDebtService = pricing_financing?.monthly_payment || fullCalcs.financing?.monthlyPayment || 0;
        let annualDebtService = pricing_financing?.annual_debt_service || fullCalcs.financing?.annualDebtService || 0;
        
        // If we have loan details but no payment, calculate it
        if ((!monthlyDebtService || monthlyDebtService === 0) && loanAmount > 0 && interestRate > 0 && amortizationYears > 0) {
          const monthlyRate = interestRate / 12;
          const numPayments = amortizationYears * 12;
          monthlyDebtService = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          annualDebtService = monthlyDebtService * 12;
        }
        
        // Generate amortization schedule if not available
        let amortSchedule = fullCalcs.amortizationSchedule || [];
        if (amortSchedule.length === 0 && loanAmount > 0 && interestRate > 0 && amortizationYears > 0) {
          const monthlyRate = interestRate / 12;
          const numPayments = amortizationYears * 12;
          const monthlyPayment = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          
          let balance = loanAmount;
          let cumulativePrincipal = 0;
          
          for (let year = 1; year <= Math.min(amortizationYears, loanTerm); year++) {
            let yearlyPrincipal = 0;
            let yearlyInterest = 0;
            
            for (let month = 1; month <= 12; month++) {
              if (balance <= 0) break;
              const interestPayment = balance * monthlyRate;
              const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
              yearlyPrincipal += principalPayment;
              yearlyInterest += interestPayment;
              balance -= principalPayment;
            }
            
            cumulativePrincipal += yearlyPrincipal;
            
            amortSchedule.push({
              year,
              payment: Math.round(yearlyPrincipal + yearlyInterest),
              principal: Math.round(yearlyPrincipal),
              interest: Math.round(yearlyInterest),
              balance: Math.round(Math.max(0, balance)),
              cumulativePrincipal: Math.round(cumulativePrincipal)
            });
          }
        }

        // Dark box style (like the Current Value boxes)
        const darkBoxStyle = {
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        };
        const darkLabelStyle = {
          fontSize: '11px',
          color: '#94a3b8',
          marginBottom: '10px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        };

        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
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
                }}>9</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  LOAN AMORTIZATION SCHEDULE
                </h2>
              </div>

              {/* Loan Summary Cards - All Dark Theme */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>LOAN AMOUNT</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>
                    ${loanAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>
                
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>INTEREST RATE</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>
                    {(interestRate * 100).toFixed(2)}%
                  </div>
                </div>
                
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>LOAN TERM</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6' }}>
                    {loanTerm} Years
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>MONTHLY DEBT SERVICE</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#8b5cf6' }}>
                    ${monthlyDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>ANNUAL DEBT SERVICE</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b' }}>
                    ${annualDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>
              </div>
            
              {amortSchedule && amortSchedule.length > 0 ? (
                <div style={{ 
                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                  border: '1px solid #e5e7eb', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ 
                    padding: '20px 24px', 
                    borderBottom: '2px solid #e5e7eb', 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: 'white', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>Year-by-Year Breakdown</h4>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Year</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Total Payment</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Principal</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Interest</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Remaining Balance</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Cumulative Principal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amortSchedule.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: 'white' }} 
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} 
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                            <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>Year {row.year}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151' }}>${row.payment.toLocaleString()}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#10b981' }}>${row.principal.toLocaleString()}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>${row.interest.toLocaleString()}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${row.balance.toLocaleString()}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>${row.cumulativePrincipal.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>No amortization schedule available (interest-only loan or no loan)</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'syndication':
        // Initialize syndication data with defaults
        const syndicationData = scenarioData.syndication || {
          equity_classes: [
            { id: 'class-a', name: 'Class A (Preferred)', type: 'preferred', amount: 0, pref_rate: 8, promote: 0, fees: { acquisition: 0, asset_mgmt: 0 }, voting: false },
            { id: 'class-b', name: 'Class B (LP Common)', type: 'lp', amount: 0, pref_rate: 8, promote: 0, fees: {}, voting: true },
            { id: 'gp', name: 'GP / Sponsor', type: 'gp', amount: 0, pref_rate: 0, promote: 20, fees: { acquisition: 2, asset_mgmt: 1.5, disposition: 1 }, voting: true }
          ],
          pref_type: 'cumulative_soft', // cumulative_soft, cumulative_hard, non_cumulative, compounding_cumulative
          distribution_frequency: 'quarterly', // monthly, quarterly, annually
          waterfall_tiers: [
            { id: 1, name: 'Tier 1: Preferred Return', condition_type: 'pref', pref_rate: 8, split_lp: 100, split_gp: 0 },
            { id: 2, name: 'Tier 2: GP Catch-Up', condition_type: 'catchup', target_split: 70, split_lp: 30, split_gp: 70 },
            { id: 3, name: 'Tier 3: 70/30 Split to 13% IRR', condition_type: 'irr', irr_hurdle: 13, split_lp: 70, split_gp: 30 },
            { id: 4, name: 'Tier 4: 60/40 Split to 18% IRR', condition_type: 'irr', irr_hurdle: 18, split_lp: 60, split_gp: 40 },
            { id: 5, name: 'Tier 5: 50/50 Split Thereafter', condition_type: 'infinity', split_lp: 50, split_gp: 50 }
          ],
          fees: {
            acquisition_fee: { enabled: true, rate: 2, basis: 'purchase_price' },
            asset_mgmt_fee: { enabled: true, rate: 1.5, basis: 'equity', frequency: 'annual' },
            construction_fee: { enabled: false, rate: 3, basis: 'budget' },
            disposition_fee: { enabled: true, rate: 1, basis: 'sale_price' },
            refinance_fee: { enabled: false, rate: 0.5, basis: 'loan_proceeds' }
          },
          events: [],
          scenarios: { base: {}, conservative: {}, aggressive: {} }
        };

        // Calculate total equity and splits
        const totalEquity = syndicationData.equity_classes.reduce((sum, c) => sum + (c.amount || 0), 0) || (fullCalcs.financing?.totalEquityRequired || 500000);
        const syndicationPurchasePrice = fullCalcs.acquisition?.purchasePrice || purchasePrice || 2700000;
        const annualNOI = fullCalcs.year1?.noi || 142597;
        const projectHoldYears = 5;
        
        // Calculate capital accounts over time
        const calculateCapitalAccounts = () => {
          const accounts = {};
          syndicationData.equity_classes.forEach(cls => {
            const classEquity = cls.amount || (totalEquity * (cls.type === 'gp' ? 0.05 : 0.475));
            accounts[cls.id] = [];
            let balance = classEquity;
            
            for (let year = 1; year <= projectHoldYears; year++) {
              const prefAccrued = balance * (cls.pref_rate / 100);
              const distributions = annualNOI * 0.6; // Simplified distribution
              const roc = Math.min(distributions * 0.3, balance);
              const prefPaid = Math.min(prefAccrued, distributions * 0.4);
              const endBalance = balance - roc;
              
              accounts[cls.id].push({
                year,
                begBalance: balance,
                contributed: year === 1 ? classEquity : 0,
                prefAccrued,
                rocPaid: roc,
                prefPaid,
                promote: 0,
                endBalance
              });
              
              balance = endBalance;
            }
          });
          return accounts;
        };

        const capitalAccounts = calculateCapitalAccounts();

        // Calculate fees
        const acquisitionFee = syndicationData.fees.acquisition_fee.enabled ? syndicationPurchasePrice * (syndicationData.fees.acquisition_fee.rate / 100) : 0;
        const assetMgmtFee = syndicationData.fees.asset_mgmt_fee.enabled ? totalEquity * (syndicationData.fees.asset_mgmt_fee.rate / 100) : 0;
        const dispositionFee = syndicationData.fees.disposition_fee.enabled ? syndicationPurchasePrice * (syndicationData.fees.disposition_fee.rate / 100) * 1.2 : 0;

        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: '#8b5cf6', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  marginRight: '12px'
                }}>💰</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  SYNDICATION & WATERFALL STRUCTURE
                </h2>
              </div>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Total Equity</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>${totalEquity.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Equity Classes</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>{syndicationData.equity_classes.length}</div>
                </div>
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Waterfall Tiers</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'white' }}>{syndicationData.waterfall_tiers.length}</div>
                </div>
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Pref Type</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginTop: '8px' }}>
                    {syndicationData.pref_type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Equity Classes Configuration */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    🏦 EQUITY CLASS STRUCTURE
                  </h3>
                  <button
                    onClick={() => {
                      const newClass = {
                        id: `class-${Date.now()}`,
                        name: `Class ${String.fromCharCode(65 + syndicationData.equity_classes.length)}`,
                        type: 'lp',
                        amount: 0,
                        pref_rate: 8,
                        promote: 0,
                        fees: {},
                        voting: true
                      };
                      onEditData && onEditData('syndication.equity_classes', [...syndicationData.equity_classes, newClass]);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Class
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Class Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Type</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Capital</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>% of Total</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Pref Return</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Promote %</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Voting</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syndicationData.equity_classes.map((cls, idx) => {
                        const classAmount = cls.amount || (totalEquity * (cls.type === 'gp' ? 0.05 : 0.475));
                        const pctOfTotal = totalEquity > 0 ? (classAmount / totalEquity * 100) : 0;
                        return (
                          <tr key={cls.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>
                              <input
                                type="text"
                                value={cls.name}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].name = e.target.value;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontWeight: '600' }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <select
                                value={cls.type}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].type = e.target.value;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                              >
                                <option value="preferred">Preferred</option>
                                <option value="lp">LP Common</option>
                                <option value="co-gp">Co-GP</option>
                                <option value="gp">GP/Sponsor</option>
                                <option value="mezz">Mezzanine</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                value={classAmount}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].amount = parseFloat(e.target.value) || 0;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ width: '120px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#6b7280' }}>
                              {pctOfTotal.toFixed(1)}%
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.1"
                                value={cls.pref_rate}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].pref_rate = parseFloat(e.target.value) || 0;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ width: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="1"
                                value={cls.promote}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].promote = parseFloat(e.target.value) || 0;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ width: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={cls.voting}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].voting = e.target.checked;
                                  onEditData && onEditData('syndication.equity_classes', updated);
                                }}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {syndicationData.equity_classes.length > 1 && (
                                <button
                                  onClick={() => {
                                    const updated = syndicationData.equity_classes.filter((_, i) => i !== idx);
                                    onEditData && onEditData('syndication.equity_classes', updated);
                                  }}
                                  style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preferred Return Configuration */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  ⚙️ PREFERRED RETURN SETTINGS
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Pref Return Type</label>
                    <select
                      value={syndicationData.pref_type}
                      onChange={(e) => onEditData && onEditData('syndication.pref_type', e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    >
                      <option value="cumulative_soft">Cumulative Soft</option>
                      <option value="cumulative_hard">Cumulative Hard</option>
                      <option value="non_cumulative">Non-Cumulative</option>
                      <option value="compounding_cumulative">Compounding Cumulative</option>
                      <option value="compounding_non_cumulative">Compounding Non-Cumulative</option>
                    </select>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                      {syndicationData.pref_type === 'cumulative_soft' && 'Unpaid pref carries forward, GP can get catch-up before full pref'}
                      {syndicationData.pref_type === 'cumulative_hard' && 'LP gets full pref before GP paid anything'}
                      {syndicationData.pref_type === 'non_cumulative' && 'Pref doesn\'t carry forward if not paid'}
                      {syndicationData.pref_type.includes('compounding') && 'Unpaid pref accrues interest on itself'}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Distribution Frequency</label>
                    <select
                      value={syndicationData.distribution_frequency}
                      onChange={(e) => onEditData && onEditData('syndication.distribution_frequency', e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Project Hold Period</label>
                    <input
                      type="number"
                      value={projectHoldYears}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', textAlign: 'right' }}
                      readOnly
                    />
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Years</div>
                  </div>
                </div>
              </div>

              {/* Waterfall Tier Structure - DRAG AND DROP STYLE */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    📊 WATERFALL TIER STRUCTURE
                  </h3>
                  <button
                    onClick={() => {
                      const newTier = {
                        id: syndicationData.waterfall_tiers.length + 1,
                        name: `Tier ${syndicationData.waterfall_tiers.length + 1}`,
                        condition_type: 'irr',
                        irr_hurdle: 15,
                        split_lp: 50,
                        split_gp: 50
                      };
                      onEditData && onEditData('syndication.waterfall_tiers', [...syndicationData.waterfall_tiers, newTier]);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Tier
                  </button>
                </div>

                {syndicationData.waterfall_tiers.map((tier, idx) => (
                  <div key={tier.id} style={{ 
                    backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white', 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    marginBottom: '12px' 
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Tier Name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            updated[idx].name = e.target.value;
                            onEditData && onEditData('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Condition</label>
                        <select
                          value={tier.condition_type}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            updated[idx].condition_type = e.target.value;
                            onEditData && onEditData('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}
                        >
                          <option value="pref">Pref Return</option>
                          <option value="catchup">Catch-Up</option>
                          <option value="irr">IRR Hurdle</option>
                          <option value="equity_multiple">Equity Multiple</option>
                          <option value="roc">Return of Capital</option>
                          <option value="infinity">No Limit</option>
                        </select>
                      </div>

                      {tier.condition_type === 'irr' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>IRR %</label>
                          <input
                            type="number"
                            step="0.5"
                            value={tier.irr_hurdle || 0}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].irr_hurdle = parseFloat(e.target.value) || 0;
                              onEditData && onEditData('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      {tier.condition_type === 'pref' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Pref %</label>
                          <input
                            type="number"
                            step="0.5"
                            value={tier.pref_rate || 0}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].pref_rate = parseFloat(e.target.value) || 0;
                              onEditData && onEditData('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      {tier.condition_type === 'catchup' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Target Split</label>
                          <input
                            type="number"
                            value={tier.target_split || 70}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].target_split = parseFloat(e.target.value) || 70;
                              onEditData && onEditData('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>LP Split %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.split_lp}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            const lpSplit = parseFloat(e.target.value) || 0;
                            updated[idx].split_lp = lpSplit;
                            updated[idx].split_gp = 100 - lpSplit;
                            onEditData && onEditData('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>GP Split %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.split_gp}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            const gpSplit = parseFloat(e.target.value) || 0;
                            updated[idx].split_gp = gpSplit;
                            updated[idx].split_lp = 100 - gpSplit;
                            onEditData && onEditData('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right', backgroundColor: '#fef3c7' }}
                        />
                      </div>

                      <div>
                        <button
                          onClick={() => {
                            const updated = syndicationData.waterfall_tiers.filter((_, i) => i !== idx);
                            onEditData && onEditData('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '18px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fee Structure */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  💵 GP FEE STRUCTURE
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  {/* Acquisition Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Acquisition Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.acquisition_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.acquisition_fee, enabled: e.target.checked };
                          onEditData && onEditData('syndication.fees.acquisition_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.acquisition_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.acquisition_fee, rate: parseFloat(e.target.value) || 0 };
                            onEditData && onEditData('syndication.fees.acquisition_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Fee Amount</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${acquisitionFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Management Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Asset Management Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.asset_mgmt_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.asset_mgmt_fee, enabled: e.target.checked };
                          onEditData && onEditData('syndication.fees.asset_mgmt_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.asset_mgmt_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.asset_mgmt_fee, rate: parseFloat(e.target.value) || 0 };
                            onEditData && onEditData('syndication.fees.asset_mgmt_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Annual Fee</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${assetMgmtFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disposition Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Disposition Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.disposition_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.disposition_fee, enabled: e.target.checked };
                          onEditData && onEditData('syndication.fees.disposition_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.disposition_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.disposition_fee, rate: parseFloat(e.target.value) || 0 };
                            onEditData && onEditData('syndication.fees.disposition_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Est. Fee</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${dispositionFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Construction Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Construction/CapEx Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.construction_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.construction_fee, enabled: e.target.checked };
                          onEditData && onEditData('syndication.fees.construction_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.construction_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.construction_fee, rate: parseFloat(e.target.value) || 0 };
                            onEditData && onEditData('syndication.fees.construction_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Budget</label>
                        <input
                          type="number"
                          placeholder="CapEx Budget"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#dbeafe', borderRadius: '8px', border: '2px solid #60a5fa' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>Total GP Fees (5 Years)</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e40af' }}>
                    ${(acquisitionFee + (assetMgmtFee * projectHoldYears) + dispositionFee).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Capital Account Tracking */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  📈 CAPITAL ACCOUNTS & RUNNING BALANCES
                </h3>

                {syndicationData.equity_classes.map((cls) => {
                  const accounts = capitalAccounts[cls.id] || [];
                  return (
                    <div key={cls.id} style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', marginBottom: '12px' }}>
                        {cls.name}
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Year</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Beg Balance</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Contributed</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Pref Accrued</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>ROC Paid</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Pref Paid</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Promote</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>End Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.map((acc, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                                <td style={{ padding: '10px', fontWeight: '600' }}>Year {acc.year}</td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>${acc.begBalance.toLocaleString()}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                                  {acc.contributed > 0 ? `$${acc.contributed.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>${acc.prefAccrued.toLocaleString()}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#3b82f6' }}>
                                  {acc.rocPaid > 0 ? `$${acc.rocPaid.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                                  {acc.prefPaid > 0 ? `$${acc.prefPaid.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#f59e0b' }}>
                                  {acc.promote > 0 ? `$${acc.promote.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>${acc.endBalance.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export & AI Integration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => {
                    // Export to Excel/PDF functionality
                    alert('LP Statement export feature - connect to backend API');
                  }}
                  style={{
                    padding: '16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  📊 Download LP Statement (Excel)
                </button>

                <button
                  onClick={() => {
                    if (setInputValue && handleSendMessage) {
                      setInputValue(`Analyze the syndication structure for this deal. Total equity: $${totalEquity.toLocaleString()}, ${syndicationData.equity_classes.length} classes, ${syndicationData.waterfall_tiers.length} waterfall tiers. Pref type: ${syndicationData.pref_type}. What are the key risks and opportunities for LPs?`);
                      setTimeout(() => handleSendMessage(), 100);
                    }
                  }}
                  style={{
                    padding: '16px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  🤖 Ask AI About This Syndication
                </button>
              </div>

            </div>
          </div>
        );

      case 'waterfall':
        return <WaterfallView waterfall={fullCalcs.multiTierWaterfall} />;

      case 'fees':
        return <ManagementFeesView fees={fullCalcs.managementFees} />;

      case 'costseg':
        return (
          <div style={{ padding: '24px' }}>
            <CostSegAnalysisView dealId={dealId} scenarioData={scenarioData} fullCalcs={fullCalcs} />
          </div>
        );

      case 'market-data':
        // Extract location info from scenarioData
        const marketZip = scenarioData?.property?.zip || scenarioData?.property?.zip_code || '';
        const marketCity = scenarioData?.property?.city || '';
        const marketState = scenarioData?.property?.state || '';
        const marketCounty = scenarioData?.property?.county || '';
        return (
          <div style={{ padding: '24px' }}>
            <MarketDataDashboard 
              dealId={dealId}
              initialZip={marketZip}
              initialCity={marketCity}
              initialState={marketState}
              initialCounty={marketCounty}
            />
          </div>
        );

      case 'deal-or-no-deal':
        return (
          <DealOrNoDealTab
            scenarioData={scenarioData}
            calculations={fullCalcs}
            dealId={dealId}
            marketCapRate={marketCapRate}
            marketCapRateLoading={marketCapRateLoading}
            onPushToPipeline={(data) => {
              console.log('Deal pushed to pipeline:', data);
              // Later this will integrate with the Pipeline page
            }}
          />
        );

      case 'rent-roll':
        // Display EXACTLY what was parsed - no calculations, no transformations
        const unitMixData = scenarioData.unit_mix || [];
        const totalUnitsCount = unitMixData.reduce((sum, u) => sum + (u.units || 0), 0);
        const totalSFCount = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)), 0);
        const totalMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
        const totalAnnualRent = totalMonthlyRent * 12;
        const handleRentcastFetch = async () => {
          setRentcastLoading(true);
          try {
            const response = await fetch(`http://localhost:8010/v2/deals/${dealId}/rentcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            console.log('RentCast response:', data);
            if (data.success) {
              setRentcastData(data.data);
            } else {
              alert(`RentCast error: ${data.error || 'Unknown error'}\nAddress searched: ${data.address_searched || 'N/A'}`);
            }
          } catch (error) {
            console.error('RentCast API error:', error);
            alert('Failed to fetch RentCast data. Check console for details.');
          } finally {
            setRentcastLoading(false);
          }
        };
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header with RentCast Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
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
                  }}>8</div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    RENT ROLL ANALYSIS
                  </h2>
                </div>
                <button
                  onClick={handleRentcastFetch}
                  disabled={rentcastLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: rentcastLoading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: rentcastLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#2563eb')}
                  onMouseLeave={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#3b82f6')}
                >
                  {rentcastLoading ? 'Loading...' : 'Fetch RentCast Comps'}
                </button>
              </div>

              {/* Summary Cards - Styled like Summary tab */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>TOTAL UNITS</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: 'white' }}>
                    {totalUnitsCount}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>TOTAL SF</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: 'white' }}>
                    {totalSFCount.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>MONTHLY RENT</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>
                    ${totalMonthlyRent.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: '#1e293b', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>ANNUAL RENT</div>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>
                    ${totalAnnualRent.toLocaleString()}
                  </div>
                </div>
              </div>
              
              {/* Unit Mix Table */}
              <div style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                border: '1px solid #e5e7eb', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                <div style={{ 
                  padding: '20px 24px', 
                  borderBottom: '2px solid #e5e7eb', 
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)'
                }}>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    fontWeight: '700', 
                    color: 'white', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px' 
                  }}>Unit Mix (Parsed Data)</h4>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Unit Type</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}># Units</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>SF per Unit</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Current Rent/Mo</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Market Rent/Mo</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Annual Rent</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>$/SF (Annual)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMixData.map((unit, idx) => {
                      const annualRent = (unit.rent_current || 0) * 12;
                      const psfAnnual = unit.unit_sf > 0 ? annualRent / unit.unit_sf : 0;
                      const marketRentValue = unit.rent_market || unit.rent_current || 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: 'white' }} 
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} 
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                          <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>{unit.type || 'N/A'}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{unit.units || 0}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{(unit.unit_sf || 0).toLocaleString()}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#10b981' }}>
                            ${(unit.rent_current || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <input
                              type="number"
                              value={marketRentValue}
                              onChange={(e) => {
                                const newMarketRent = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                const updatedUnitMix = [...unitMixData];
                                updatedUnitMix[idx] = { ...updatedUnitMix[idx], rent_market: newMarketRent };
                                onEditData && onEditData('unit_mix', updatedUnitMix);
                              }}
                              style={{
                                width: '100px',
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#1e40af',
                                backgroundColor: '#eff6ff',
                                border: '2px solid #93c5fd',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                textAlign: 'right',
                                outline: 'none'
                              }}
                            />
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                            ${annualRent.toLocaleString()}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                            ${psfAnnual.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', borderTop: '2px solid #d1d5db' }}>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>TOTAL</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#111827' }}>{totalUnitsCount}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#111827' }}>{totalSFCount.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#10b981' }}>${totalMonthlyRent.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#9ca3af', fontWeight: '600' }}>-</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${totalAnnualRent.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                        ${totalSFCount > 0 ? (totalAnnualRent / totalSFCount).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* RentCast Results */}
              {rentcastData && (
                <div style={{ marginTop: '24px' }}>
                  {/* Summary Cards */}
                  <div style={{ 
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '2px solid #93c5fd', 
                    borderRadius: '16px', 
                    padding: '24px', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 20px 0', 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: '#1e40af', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>RentCast Market Data</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      <div style={{ 
                        padding: '20px', 
                        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                        borderRadius: '12px', 
                        border: '2px solid #10b981',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#065f46', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Rent</div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#047857' }}>${rentcastData.rent?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        borderRadius: '12px', 
                        border: '2px solid #3b82f6',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#1e3a8a', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price per Sq Ft</div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e40af' }}>${rentcastData.pricePerSqFt?.toFixed(2) || 'N/A'}</div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        borderRadius: '12px', 
                        border: '2px solid #f59e0b',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#78350f', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rent Range</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#92400e' }}>
                          ${rentcastData.rentRangeLow?.toLocaleString() || 'N/A'} - ${rentcastData.rentRangeHigh?.toLocaleString() || 'N/A'}
                        </div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                        borderRadius: '12px', 
                        border: '2px solid #ec4899',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#831843', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comparable Listings</div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#9f1239' }}>{rentcastData.comparables?.length || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Map and Comps Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* Map */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #e5e7eb',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)'
                      }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Property Location & Comps
                        </h5>
                      </div>
                      {rentcastData.latitude && rentcastData.longitude ? (
                        <iframe
                          title="Property Map"
                          width="100%"
                          height="400"
                          style={{ border: 0 }}
                          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${rentcastData.latitude},${rentcastData.longitude}&zoom=14`}
                        />
                      ) : (
                        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                          No location data available
                        </div>
                      )}
                    </div>

                    {/* Comparables List */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #e5e7eb',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)'
                      }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Nearby Rental Comps
                        </h5>
                      </div>
                      <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px' }}>
                        {rentcastData.comparables && rentcastData.comparables.length > 0 ? (
                          rentcastData.comparables.map((comp, idx) => (
                            <div key={idx} style={{ 
                              padding: '16px', 
                              marginBottom: '12px', 
                              backgroundColor: '#f9fafb', 
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ fontWeight: '700', fontSize: '16px', color: '#10b981' }}>
                                  ${comp.price?.toLocaleString() || 'N/A'}/mo
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                                  {comp.bedrooms || 0} bed • {comp.bathrooms || 0} bath
                                </div>
                              </div>
                              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                                {comp.squareFootage ? `${comp.squareFootage.toLocaleString()} sq ft` : 'Size N/A'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {comp.addressLine1 || 'Address not available'}
                              </div>
                              {comp.distance && (
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                  {comp.distance.toFixed(2)} miles away
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                            No comparable listings found nearby
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        );

      case 'deal-structure':
        return (
          <div style={{ padding: '24px' }}>
            <DealStructureTab scenarioData={scenarioData} calculations={calculations} fullCalcs={fullCalcs} marketCapRate={marketCapRate} />
          </div>
        );

      default:
        return <div style={{ padding: '24px', color: '#6b7280' }}>Select a tab to view details</div>;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: 'calc(100vh - 60px)',
      backgroundColor: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative'
    }}>
      
      {/* Main Content - Full Width */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      }}>
        
        {/* Header with property name */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              {property.property_name || 'Deal Analysis'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {property.address || 'Property Address'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </button>
            {onGoHome && (
              <button
                onClick={onGoHome}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                New Deal
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex',
          gap: '4px',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          overflowX: 'auto',
          flexWrap: 'nowrap'
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: isActive ? 'white' : 'transparent',
                  color: isActive ? '#111827' : '#6b7280',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={16} color={isActive ? '#000000' : '#6b7280'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{ 
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f9fafb'
        }}>
          {renderTabContent()}
        </div>

      </div>

      {/* Bottom Chat Panel - ChatGPT Style with Messages */}
      {messages && messages.length > 0 && !isChatMinimized && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTop: '1px solid #e5e7eb',
          zIndex: 1000,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          maxHeight: '500px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Chat Header with Minimize Button */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💬</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                AI Assistant ({messages.length} message{messages.length !== 1 ? 's' : ''})
              </span>
            </div>
            <button
              onClick={() => setIsChatMinimized(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: '#6b7280',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              Hide Messages
            </button>
          </div>

          {/* Messages Area - Scrollable */}
          <div 
            ref={chatMessagesRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '16px',
              maxHeight: '350px',
              minHeight: '150px',
              backgroundColor: '#fafafa'
            }}
          >
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                marginBottom: '12px',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  backgroundColor: msg.role === 'user' ? '#1e40af' : '#f3f4f6',
                  color: msg.role === 'user' ? 'white' : '#111827',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '14px'
                }}>
                  Thinking...
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div style={{ 
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: 'white'
          }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isSending && inputValue.trim()) {
                    handleSendMessage();
                  }
                }}
                placeholder="What price do we need to buy at, or what needs to change to cash flow $1,000/month day one?"
                disabled={isSending}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  fontSize: '15px',
                  border: '1px solid #d1d5db',
                  borderRadius: '24px',
                  outline: 'none',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  backgroundColor: '#f9fafb'
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || !inputValue.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (!isSending && inputValue.trim()) ? '#2c3e50' : '#e5e7eb',
                  color: (!isSending && inputValue.trim()) ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: (!isSending && inputValue.trim()) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: (!isSending && inputValue.trim()) ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Input bar ALWAYS visible - with expand button when messages exist and are minimized */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        padding: '16px',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          {/* Show expand button when messages exist and are minimized */}
          {messages && messages.length > 0 && isChatMinimized && (
            <button
              onClick={() => setIsChatMinimized(false)}
              style={{
                padding: '12px 16px',
                backgroundColor: '#1e40af',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(30, 64, 175, 0.3)',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#1e3a8a';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1e40af';
              }}
            >
              <span style={{ fontSize: '16px' }}>💬</span>
              <span>Show {messages.length}</span>
            </button>
          )}
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isSending && inputValue.trim()) {
                handleSendMessage();
              }
            }}
            placeholder="What price do we need to buy at, or what needs to change to cash flow $1,000/month day one?"
            disabled={isSending}
            style={{
              flex: 1,
              padding: '14px 16px',
              fontSize: '15px',
              border: '1px solid #d1d5db',
              borderRadius: '24px',
              outline: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              backgroundColor: '#f9fafb'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !inputValue.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: (!isSending && inputValue.trim()) ? '#2c3e50' : '#e5e7eb',
              color: (!isSending && inputValue.trim()) ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '24px',
              cursor: (!isSending && inputValue.trim()) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: (!isSending && inputValue.trim()) ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel />

    </div>
  );
};

export default ResultsPageV2;
