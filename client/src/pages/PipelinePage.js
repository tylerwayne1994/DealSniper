import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Phone, 
  Mail, 
  User, 
  Eye, 
  FileText, 
  Trash2,
  Layers,
  ArrowLeft,
  RefreshCw,
  Search,
  ClipboardCheck,
  Presentation,
  Shield,
  AlertTriangle,
  AlertCircle,
  Users,
  Clock,
  Lock,
  Sparkles,
  CreditCard,
  X
} from 'lucide-react';
import { loadPipelineDeals as loadDealsFromSupabase, loadRapidFireDeals as loadRapidFireDealsFromSupabase, deleteDeal, updateDeal } from '../lib/dealsService';

// ============================================================================
// Helper Functions
// ============================================================================

const fmtCompact = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  if (num >= 1000000) {
    return '$' + (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return '$' + (num / 1000).toFixed(0) + 'K';
  }
  return '$' + num.toLocaleString();
};

// ============================================================================
// CRM Calculation Helpers
// ============================================================================

const calculateCapitalMetrics = (deal) => {
  const price = deal.purchasePrice || 0;
  const cashOutRefi = deal.cashOutRefiAmount || 0;
  
  // Calculate from scenario_data if available
  let totalEquityRequired = deal.total_equity_required;
  let sponsorCashIn = deal.sponsor_cash_in;
  let outsideCapital = deal.outside_capital_required;
  let capitalAtRefi = deal.capital_returned_at_refi || cashOutRefi;
  
  // If not in database, calculate from deal structure
  if (!totalEquityRequired) {
    const ltv = 0.75; // Default 75% LTV
    const loanAmount = price * ltv;
    const downPayment = price - loanAmount;
    const closingCosts = price * 0.03; // 3% closing costs
    const reserves = price * 0.02; // 2% reserves
    
    totalEquityRequired = downPayment + closingCosts + reserves;
    
    // Determine sponsor vs outside capital based on structure
    const structure = (deal.dealStructure || '').toLowerCase();
    if (structure.includes('partner') || structure.includes('equity')) {
      sponsorCashIn = totalEquityRequired * 0.3; // Sponsor puts 30%
      outsideCapital = totalEquityRequired * 0.7; // LP puts 70%
    } else if (structure.includes('seller')) {
      sponsorCashIn = totalEquityRequired * 0.5;
      outsideCapital = 0; // Seller financing reduces outside capital need
    } else {
      sponsorCashIn = totalEquityRequired;
      outsideCapital = 0;
    }
  }
  
  return {
    totalEquityRequired: totalEquityRequired || 0,
    sponsorCashIn: sponsorCashIn || 0,
    outsideCapital: outsideCapital || 0,
    capitalAtRefi: capitalAtRefi || 0
  };
};

const calculateEfficiencyMetrics = (deal) => {
  const capital = calculateCapitalMetrics(deal);
  const monthlyCF = (deal.postRefiCashFlow || deal.stabilizedCashFlow || 0);
  
  // Cash-In/Cash-Out Ratio
  const cashRatio = capital.sponsorCashIn > 0 
    ? capital.capitalAtRefi / capital.sponsorCashIn 
    : 0;
  
  // Stabilized Equity Multiple
  const refiValue = deal.refiValue || (deal.purchasePrice || 0) * 1.25;
  const loanAmount = refiValue * 0.75; // Assume 75% LTV on refi
  const equityAfterRefi = refiValue - loanAmount;
  const equityMultiple = capital.totalEquityRequired > 0 
    ? equityAfterRefi / capital.totalEquityRequired 
    : 0;
  
  // Time to Recovery (months)
  const monthsToRecovery = monthlyCF > 0 
    ? capital.sponsorCashIn / monthlyCF 
    : 999;
  
  return {
    cashRatio,
    equityMultiple,
    monthsToRecovery: monthsToRecovery === 999 ? null : monthsToRecovery
  };
};

const assessStructureRisk = (deal) => {
  const structure = (deal.dealStructure || '').toLowerCase();
  const monthlyCF = (deal.postRefiCashFlow || deal.stabilizedCashFlow || 0);
  const price = deal.purchasePrice || 0;
  const annualDebtService = price * 0.75 * 0.065; // 75% LTV, 6.5% rate, assume IO
  const monthlyDebtService = annualDebtService / 12;
  const noi = monthlyCF + monthlyDebtService; // Rough NOI estimate
  const dscr = monthlyDebtService > 0 ? (noi * 12) / annualDebtService : 0;
  
  // Check balloon risk
  const hasBalloonSoon = structure.includes('seller') || structure.includes('bridge');
  
  // Risk assessment
  if (dscr >= 1.25 && !hasBalloonSoon) {
    return { level: 'green', text: 'Survives Stress', reason: `Strong DSCR (${dscr.toFixed(2)}x), no balloon pressure` };
  } else if (dscr >= 1.1 && dscr < 1.25) {
    return { level: 'yellow', text: 'Marginal', reason: `Moderate DSCR (${dscr.toFixed(2)}x), monitor closely` };
  } else if (hasBalloonSoon) {
    return { level: 'yellow', text: 'Marginal', reason: 'Seller financing or bridge loan with balloon risk' };
  } else {
    return { level: 'red', text: 'Breaks Under Stress', reason: `Weak DSCR (${dscr.toFixed(2)}x), vulnerable to rate increases` };
  }
};

const detectComplexityFlags = (deal) => {
  const structure = (deal.dealStructure || '').toLowerCase();
  
  return {
    multipleParties: deal.has_multiple_parties ?? (structure.includes('partner') || structure.includes('syndicate')),
    sellerDependent: deal.has_seller_dependency ?? (structure.includes('seller') || structure.includes('subto')),
    prefAccrual: deal.has_pref_accrual ?? structure.includes('pref'),
    balloonRisk: deal.has_balloon_risk ?? (structure.includes('seller') || structure.includes('bridge')),
    lpApproval: deal.requires_lp_approval ?? structure.includes('partner')
  };
};

const isSystemRecommended = (deal) => {
  const capital = calculateCapitalMetrics(deal);
  const risk = assessStructureRisk(deal);
  const complexity = detectComplexityFlags(deal);
  
  // System recommends if: low cash in, good DSCR, GP control, simple structure
  const lowCashIn = capital.sponsorCashIn < capital.totalEquityRequired * 0.5;
  const goodRisk = risk.level === 'green';
  const simpleStructure = !complexity.multipleParties && !complexity.lpApproval;
  
  if (lowCashIn && goodRisk && simpleStructure) {
    return { 
      recommended: true, 
      reason: `Lower cash requirement ($${(capital.sponsorCashIn / 1000).toFixed(0)}K), maintains control, strong DSCR` 
    };
  }
  
  return { recommended: false, reason: '' };
};

const getStatusColor = (status) => {
  const colors = {
    sourced: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
    underwritten: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    loi: { bg: '#e9d5ff', text: '#7e22ce', border: '#c084fc' },
    contract: { bg: '#fed7aa', text: '#c2410c', border: '#fdba74' },
    financing: { bg: '#ccfbf1', text: '#0f766e', border: '#5eead4' },
    closed: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    dead: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
  };
  return colors[status] || colors.sourced;
};

const getStatusLabel = (status) => {
  const labels = {
    sourced: 'Sourced',
    underwritten: 'Underwritten',
    loi: 'LOI Sent',
    contract: 'Under Contract',
    financing: 'Financing Secured',
    closed: 'Closed',
    dead: 'Dead'
  };
  return labels[status] || 'Sourced';
};

const calculateDaysInStage = (stageChangedAt) => {
  if (!stageChangedAt) return 0;
  const now = new Date();
  const changed = new Date(stageChangedAt);
  const diffTime = Math.abs(now - changed);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// ============================================================================
// Table Styles - Premium Modern Design
// ============================================================================

const thStyle = {
  padding: '18px 16px',
  fontSize: '10px',
  fontWeight: '800',
  color: '#ffffff',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '1.8px',
  whiteSpace: 'nowrap',
  background: 'linear-gradient(180deg, #1e3a5f 0%, #0f2744 50%, #0a1929 100%)',
  borderBottom: '3px solid #14b8a6',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
  position: 'relative',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
};

const tdStyle = {
  padding: '14px 12px',
  fontSize: '13px',
  color: '#374151',
  verticalAlign: 'middle'
};

// ============================================================================
// Stat Card Component
// ============================================================================

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div style={{
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      backgroundColor: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginTop: '2px' }}>
        {value}
      </div>
    </div>
  </div>
);

// ============================================================================
// Pipeline Page Component
// ============================================================================

function PipelinePage() {
  const navigate = useNavigate();
  const [pipelineDeals, setPipelineDeals] = useState([]);
  const [rapidFireDeals, setRapidFireDeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRapid, setIsLoadingRapid] = useState(true);
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'rapidfire'
  const [selectedRapidFireIds, setSelectedRapidFireIds] = useState([]);
  
  // CRM Feature State
  const [sortBy, setSortBy] = useState('none'); // none, status, risk, cash_ratio, equity_multiple, recovery_time, price
  const [filterStatus, setFilterStatus] = useState([]); // array of statuses
  const [filterRisk, setFilterRisk] = useState([]); // array of 'green', 'yellow', 'red'
  const [filterOutsideCapital, setFilterOutsideCapital] = useState('all'); // 'all', 'yes', 'no'
  const [showStatusModal, setShowStatusModal] = useState(null); // { deal, currentStatus }
  const [showDeathModal, setShowDeathModal] = useState(null); // deal object
  const [deathReason, setDeathReason] = useState('');
  // Compact view permanently enabled to avoid horizontal scrolling

  // Sample deals for demonstration
  const sampleDeals = [
    {
      dealId: 'sample-001',
      address: '1250 Oakwood Gardens, Dallas, TX 75201',
      units: 48,
      purchasePrice: 3200000,
      dayOneCashFlow: 4250,
      stabilizedCashFlow: 8500,
      refiValue: 4800000,
      cashOutRefiAmount: 1200000,
      userTotalInPocket: 850000,
      postRefiCashFlow: 6200,
      brokerName: 'Marcus Johnson',
      brokerPhone: '(214) 555-0187',
      brokerEmail: 'marcus.j@realtypros.com',
      dealStructure: 'Seller Financing',
      pushedAt: '2025-12-01T10:30:00Z',
      deal_stage: 'underwritten',
      stage_changed_at: '2025-12-01T10:30:00Z',
      structure_confidence: 'high',
      backup_structure: 'Traditional Bank Loan'
    },
    {
      dealId: 'sample-002',
      address: '875 Sunrise MHP, Austin, TX 78745',
      units: 72,
      purchasePrice: 5500000,
      dayOneCashFlow: 7800,
      stabilizedCashFlow: 14500,
      refiValue: 8200000,
      cashOutRefiAmount: 2100000,
      userTotalInPocket: 1450000,
      postRefiCashFlow: 11200,
      brokerName: 'Sarah Chen',
      brokerPhone: '(512) 555-0234',
      brokerEmail: 'schen@capitalbrokers.com',
      dealStructure: 'Bank Loan + Equity Partner',
      pushedAt: '2025-12-05T14:15:00Z',
      deal_stage: 'loi',
      stage_changed_at: '2025-12-05T14:15:00Z',
      structure_confidence: 'medium',
      backup_structure: null
    }
  ];

  const loadPipelineDeals = async () => {
    setIsLoading(true);
    try {
      const deals = await loadDealsFromSupabase();
      // If no deals from Supabase, show sample deals for demo
      if (deals.length === 0) {
        setPipelineDeals(sampleDeals);
      } else {
        setPipelineDeals(deals);
      }
    } catch (error) {
      console.error('Error loading pipeline deals:', error);
      // Fallback to sample deals if Supabase fails
      setPipelineDeals(sampleDeals);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRapidFireDeals = async () => {
    setIsLoadingRapid(true);
    try {
      const deals = await loadRapidFireDealsFromSupabase();
      setRapidFireDeals(deals);
    } catch (error) {
      console.error('Error loading Rapid Fire queue deals:', error);
      setRapidFireDeals([]);
    } finally {
      setIsLoadingRapid(false);
    }
  };

  // Load deals from Supabase on mount
  useEffect(() => {
    loadPipelineDeals();
    loadRapidFireDeals();

    // Listen for pipeline updates from other components
    const handlePipelineUpdate = () => {
      console.log('🔄 Pipeline updated, reloading deals...');
      loadPipelineDeals();
      loadRapidFireDeals();
    };
    window.addEventListener('pipelineDealsUpdated', handlePipelineUpdate);

    return () => {
      window.removeEventListener('pipelineDealsUpdated', handlePipelineUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewDeal = (deal) => {
    // For sample deals, create mock scenario data and pass via state
    if (deal.dealId.startsWith('sample-')) {
      // Create mock scenario data for sample deals
      const mockScenarioData = {
        property: {
          address: deal.address,
          units: deal.units,
          property_type: 'Multifamily',
          year_built: 1985,
          rba_sqft: deal.units * 850
        },
        pricing_financing: {
          price: deal.purchasePrice,
          purchase_price: deal.purchasePrice
        },
        financing: {
          ltv: 75,
          interest_rate: 6.5,
          loan_term_years: 10,
          amortization_years: 30,
          io_years: 0,
          loan_fees_percent: 1.5
        },
        pnl: {
          potential_gross_income: deal.units * 1200 * 12,
          vacancy_rate: 5,
          operating_expenses: deal.units * 400 * 12
        },
        unit_mix: [
          { unit_type: '2BR/1BA', units: deal.units, unit_sf: 850, rent_current: 1200 }
        ],
        broker: {
          name: deal.brokerName,
          phone: deal.brokerPhone,
          email: deal.brokerEmail
        }
      };
      
      // Navigate with state for sample deals - go to new underwriting page
      navigate('/underwrite', {
        state: {
          dealId: deal.dealId,
          scenarioData: mockScenarioData,
          goToResults: true
        }
      });
    } else {
      // For real deals, load from Supabase via URL param - go to new underwriting page
      navigate(`/underwrite?viewDeal=${deal.dealId}`);
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (window.confirm('Are you sure you want to remove this deal from the pipeline?')) {
      try {
        // Check if it's a sample deal (starts with 'sample-')
        if (dealId.startsWith('sample-')) {
          // Just remove from local state for sample deals
          const updatedDeals = pipelineDeals.filter(d => d.dealId !== dealId);
          setPipelineDeals(updatedDeals);
        } else {
          // Delete from Supabase
          await deleteDeal(dealId);
          const updatedDeals = pipelineDeals.filter(d => d.dealId !== dealId);
          setPipelineDeals(updatedDeals);
        }
        // Notify other components that pipeline has changed
        window.dispatchEvent(new Event('pipelineDealsUpdated'));
      } catch (error) {
        console.error('Error deleting deal:', error);
        alert('Failed to delete deal: ' + error.message);
      }
    }
  };

  const handleGenerateLOI = (deal) => {
    // Navigate to LOI page with dealId
    navigate(`/loi?dealId=${deal.dealId}`);
  };

  const handleDueDiligence = (deal) => {
    // Navigate to Due Diligence page with dealId
    navigate(`/due-diligence?dealId=${deal.dealId}`);
  };

  // Filter deals based on search
  const filteredDeals = pipelineDeals.filter(deal => 
    deal.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.brokerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.dealStructure?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRapidFireDeals = rapidFireDeals.filter(deal => 
    (deal.name || deal.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteRapidFireDeals = async (dealIds) => {
    if (!dealIds || dealIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to remove ${dealIds.length} deal(s) from the Rapid Fire queue?`)) {
      return;
    }

    try {
      for (const id of dealIds) {
        await deleteDeal(id);
      }
      setRapidFireDeals(prev => prev.filter(d => !dealIds.includes(d.dealId)));
      setSelectedRapidFireIds(prev => prev.filter(id => !dealIds.includes(id)));
    } catch (error) {
      console.error('Error deleting Rapid Fire deal(s):', error);
      alert('Failed to delete Rapid Fire deal(s): ' + error.message);
    }
  };

  // CRM Functions
  const handleStatusChange = async (deal, newStatus) => {
    if (newStatus === 'dead') {
      // Show death reason modal
      setShowDeathModal(deal);
      setShowStatusModal(null);
    } else {
      try {
        const updatedDeal = {
          ...deal,
          deal_stage: newStatus,
          stage_changed_at: new Date().toISOString(),
          death_reason: null
        };
        
        await updateDeal(deal.dealId, {
          deal_stage: newStatus,
          stage_changed_at: new Date().toISOString(),
          death_reason: null
        });
        
        setPipelineDeals(prev => prev.map(d => d.dealId === deal.dealId ? updatedDeal : d));
        setShowStatusModal(null);
      } catch (error) {
        console.error('Error updating deal status:', error);
        alert('Failed to update status: ' + error.message);
      }
    }
  };

  const handleDeathReasonSubmit = async () => {
    if (!deathReason || !showDeathModal) return;
    
    try {
      const updatedDeal = {
        ...showDeathModal,
        deal_stage: 'dead',
        stage_changed_at: new Date().toISOString(),
        death_reason: deathReason
      };
      
      await updateDeal(showDeathModal.dealId, {
        deal_stage: 'dead',
        stage_changed_at: new Date().toISOString(),
        death_reason: deathReason
      });
      
      setPipelineDeals(prev => prev.map(d => d.dealId === showDeathModal.dealId ? updatedDeal : d));
      setShowDeathModal(null);
      setDeathReason('');
    } catch (error) {
      console.error('Error marking deal as dead:', error);
      alert('Failed to mark deal as dead: ' + error.message);
    }
  };

  // Apply sorting and filtering
  const getSortedAndFilteredDeals = () => {
    let deals = [...filteredDeals];
    
    // Apply status filter
    if (filterStatus.length > 0) {
      deals = deals.filter(d => filterStatus.includes(d.deal_stage || 'underwritten'));
    }
    
    // Apply risk filter
    if (filterRisk.length > 0) {
      deals = deals.filter(d => {
        const risk = assessStructureRisk(d);
        return filterRisk.includes(risk.level);
      });
    }
    
    // Apply outside capital filter
    if (filterOutsideCapital !== 'all') {
      deals = deals.filter(d => {
        const capital = calculateCapitalMetrics(d);
        if (filterOutsideCapital === 'yes') return capital.outsideCapital > 0;
        if (filterOutsideCapital === 'no') return capital.outsideCapital === 0;
        return true;
      });
    }
    
    // Apply sorting
    if (sortBy !== 'none') {
      deals.sort((a, b) => {
        switch (sortBy) {
          case 'status': {
            const order = ['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'];
            return order.indexOf(a.deal_stage || 'underwritten') - order.indexOf(b.deal_stage || 'underwritten');
          }
          case 'risk': {
            const riskOrder = { green: 0, yellow: 1, red: 2 };
            const riskA = assessStructureRisk(a);
            const riskB = assessStructureRisk(b);
            return riskOrder[riskA.level] - riskOrder[riskB.level];
          }
          case 'cash_ratio': {
            const effA = calculateEfficiencyMetrics(a);
            const effB = calculateEfficiencyMetrics(b);
            return effB.cashRatio - effA.cashRatio; // Descending (higher is better)
          }
          case 'equity_multiple': {
            const effA = calculateEfficiencyMetrics(a);
            const effB = calculateEfficiencyMetrics(b);
            return effB.equityMultiple - effA.equityMultiple; // Descending
          }
          case 'recovery_time': {
            const effA = calculateEfficiencyMetrics(a);
            const effB = calculateEfficiencyMetrics(b);
            const timeA = effA.monthsToRecovery || 999;
            const timeB = effB.monthsToRecovery || 999;
            return timeA - timeB; // Ascending (shorter is better)
          }
          case 'price':
            return (b.purchasePrice || 0) - (a.purchasePrice || 0); // Descending
          default:
            return 0;
        }
      });
    }
    
    return deals;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header - Premium Modern Design */}
      <div style={{
        backgroundColor: '#000000',
        padding: '28px 32px',
        color: 'white',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 40px rgba(20, 184, 166, 0.08)',
        borderBottom: '1px solid rgba(45, 212, 191, 0.15)'
      }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 18px',
                  backgroundColor: '#000000',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)'
                }}
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
                Dashboard
              </button>
              <div>
                <h1 style={{ 
                  margin: 0, 
                  fontSize: '32px', 
                  fontWeight: '800', 
                  letterSpacing: '-0.5px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: 'none'
                }}>
                  Deal Pipeline
                </h1>
                <p style={{ 
                  margin: '6px 0 0 0', 
                  fontSize: '14px', 
                  color: '#5eead4', 
                  fontWeight: '500',
                  letterSpacing: '0.3px'
                }}>
                  {viewMode === 'pipeline' ? pipelineDeals.length : rapidFireDeals.length}{' '}
                  {viewMode === 'pipeline'
                    ? (pipelineDeals.length === 1 ? 'deal in pipeline' : 'deals in pipeline')
                    : (rapidFireDeals.length === 1 ? 'Rapid Fire lead in queue' : 'Rapid Fire leads in queue')}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* View toggle: Underwritten vs Rapid Fire Queue - Premium Pill */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.3) 0%, rgba(20, 184, 166, 0.15) 100%)', 
                borderRadius: '999px', 
                padding: '5px',
                border: '1px solid rgba(45, 212, 191, 0.2)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}>
                <button
                  type="button"
                  onClick={() => setViewMode('pipeline')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    background: viewMode === 'pipeline' 
                      ? 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' 
                      : 'transparent',
                    color: viewMode === 'pipeline' ? '#ffffff' : 'rgba(148, 163, 184, 0.9)',
                    boxShadow: viewMode === 'pipeline' ? '0 2px 8px rgba(20, 184, 166, 0.4)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Underwritten
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('rapidfire')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    background: viewMode === 'rapidfire' 
                      ? 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)' 
                      : 'transparent',
                    color: viewMode === 'rapidfire' ? '#ffffff' : 'rgba(148, 163, 184, 0.9)',
                    boxShadow: viewMode === 'rapidfire' ? '0 2px 8px rgba(20, 184, 166, 0.4)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Rapid Fire Queue
                </button>
              </div>

              {/* Search - Premium Style */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'rgba(94, 234, 212, 0.6)' 
                }} />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '12px 14px 12px 44px',
                    width: '280px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
                    border: '1px solid rgba(45, 212, 191, 0.2)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.25s',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </div>
              
              {/* Refresh - Premium Button */}
              <button
                onClick={loadPipelineDeals}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 18px',
                  backgroundColor: '#000000',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)'
                }}
              >
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1800px', margin: '0 auto', padding: '24px 32px' }}>
        {viewMode === 'pipeline' ? (
          isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#0f766e' }} />
              <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading pipeline...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '80px 20px',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              border: '2px dashed #e5e7eb'
            }}>
              <Building2 size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#374151' }}>
                {searchTerm ? 'No deals match your search' : 'No deals in pipeline yet'}
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                {searchTerm ? 'Try a different search term' : 'Push deals from the Deal or No Deal tab to see them here'}
              </p>
            </div>
          ) : (
            <>
              {/* CRM Controls - Sort & Filter */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '20px',
                marginBottom: '16px',
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Sort By */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Sort By:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="none">Default Order</option>
                    <option value="status">Deal Stage</option>
                    <option value="risk">Risk Level</option>
                    <option value="cash_ratio">Cash-In/Out Ratio</option>
                    <option value="equity_multiple">Equity Multiple</option>
                    <option value="recovery_time">Recovery Time</option>
                    <option value="price">Purchase Price</option>
                  </select>
                </div>

                {/* Filter by Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Status:</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map(status => {
                      const statusColors = getStatusColor(status);
                      const isSelected = filterStatus.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => {
                            if (isSelected) {
                              setFilterStatus(prev => prev.filter(s => s !== status));
                            } else {
                              setFilterStatus(prev => [...prev, status]);
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: `2px solid ${isSelected ? statusColors.border : '#e5e7eb'}`,
                            backgroundColor: isSelected ? statusColors.bg : 'white',
                            color: isSelected ? statusColors.text : '#6b7280',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          {getStatusLabel(status)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter by Risk */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Risk:</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { level: 'green', label: '🟢 Low', color: '#059669' },
                      { level: 'yellow', label: '🟡 Medium', color: '#d97706' },
                      { level: 'red', label: '🔴 High', color: '#dc2626' }
                    ].map(({ level, label, color }) => {
                      const isSelected = filterRisk.includes(level);
                      return (
                        <button
                          key={level}
                          onClick={() => {
                            if (isSelected) {
                              setFilterRisk(prev => prev.filter(r => r !== level));
                            } else {
                              setFilterRisk(prev => [...prev, level]);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: `2px solid ${isSelected ? color : '#e5e7eb'}`,
                            backgroundColor: isSelected ? `${color}15` : 'white',
                            color: isSelected ? color : '#6b7280',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter by Outside Capital */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Outside Capital:</label>
                  <select
                    value={filterOutsideCapital}
                    onChange={(e) => setFilterOutsideCapital(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Deals</option>
                    <option value="yes">Has Outside Capital</option>
                    <option value="no">Self-Funded Only</option>
                  </select>
                </div>

                {/* Clear Filters */}
                {(filterStatus.length > 0 || filterRisk.length > 0 || filterOutsideCapital !== 'all' || sortBy !== 'none') && (
                  <button
                    onClick={() => {
                      setFilterStatus([]);
                      setFilterRisk([]);
                      setFilterOutsideCapital('all');
                      setSortBy('none');
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>

              {/* Pipeline Table - Premium Design */}
              {/* Pipeline Table - Premium Design */}
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '14px', 
                border: '1px solid rgba(45, 212, 191, 0.15)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(20, 184, 166, 0.04)'
              }}>
                <div style={{ overflowX: 'hidden' }}>
                    // Compact, multi-line row layout (fewer columns)
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ 
                          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 40%, #0a1929 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        }}>
                          <th style={thStyle}>Address</th>
                          <th style={thStyle}>Deal Stage</th>
                          <th style={thStyle}>Units</th>
                          <th style={thStyle}>Purchase Price</th>
                          <th style={thStyle}>Capital</th>
                          <th style={thStyle}>Efficiency</th>
                          <th style={thStyle}>Cash Flow</th>
                          <th style={thStyle}>Broker</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedAndFilteredDeals().map((deal, index) => {
                          const capital = calculateCapitalMetrics(deal);
                          const efficiency = calculateEfficiencyMetrics(deal);
                          const risk = assessStructureRisk(deal);
                          const statusColors = getStatusColor(deal.deal_stage || 'underwritten');
                          const daysInStage = calculateDaysInStage(deal.stage_changed_at);
                          return (
                            <tr 
                              key={deal.dealId || index}
                              style={{ 
                                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                                borderBottom: '1px solid #e5e7eb'
                              }}
                            >
                              {/* Address */}
                              <td style={tdStyle}>
                                <div style={{ fontWeight: '600', color: '#111827' }}>{deal.address || '-'}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{deal.dealStructure || 'Traditional'}</div>
                              </td>
                              {/* Stage */}
                              <td style={tdStyle}>
                                <button
                                  onClick={() => setShowStatusModal({ deal, currentStatus: deal.deal_stage || 'underwritten' })}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: `1px solid ${statusColors.border}`,
                                    backgroundColor: statusColors.bg,
                                    color: statusColors.text,
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Click to change status"
                                >
                                  {getStatusLabel(deal.deal_stage || 'underwritten')}
                                </button>
                                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                                  {daysInStage > 0 ? `${daysInStage} day${daysInStage !== 1 ? 's' : ''} in stage` : 'New'}
                                </div>
                              </td>
                              {/* Units */}
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px', fontWeight: '600' }}>
                                  {deal.units || '-'}
                                </span>
                              </td>
                              {/* Price */}
                              <td style={tdStyle}>
                                <span style={{ fontWeight: '700', color: '#111827' }}>{fmtCompact(deal.purchasePrice)}</span>
                              </td>
                              {/* Capital grouped */}
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 8px', borderRadius: '6px' }}>Equity {fmtCompact(capital.totalEquityRequired)}</span>
                                  <span style={{ background: '#ecfeff', color: '#0e7490', padding: '4px 8px', borderRadius: '6px' }}>Sponsor {fmtCompact(capital.sponsorCashIn)}</span>
                                  <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '4px 8px', borderRadius: '6px' }}>Outside {capital.outsideCapital > 0 ? fmtCompact(capital.outsideCapital) : '-'}</span>
                                  <span style={{ background: '#e7ffe7', color: '#166534', padding: '4px 8px', borderRadius: '6px' }}>Refi {fmtCompact(capital.capitalAtRefi)}</span>
                                </div>
                              </td>
                              {/* Efficiency grouped */}
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px' }}>Ratio {efficiency.cashRatio > 0 ? efficiency.cashRatio.toFixed(2) + 'x' : '-'}</span>
                                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '6px' }}>Multiple {efficiency.equityMultiple > 0 ? efficiency.equityMultiple.toFixed(2) + 'x' : '-'}</span>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '6px' }}>Recovery {efficiency.monthsToRecovery ? Math.round(efficiency.monthsToRecovery) + ' mo' : '-'}</span>
                                  <span title={risk.reason} style={{ background: risk.level === 'green' ? '#dcfce7' : risk.level === 'yellow' ? '#fef3c7' : '#fee2e2', color: risk.level === 'green' ? '#166534' : risk.level === 'yellow' ? '#92400e' : '#991b1b', padding: '4px 8px', borderRadius: '6px' }}>{risk.text}</span>
                                </div>
                              </td>
                              {/* Cash Flow grouped */}
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 8px', borderRadius: '6px' }}>Day1 {fmtCompact(deal.dayOneCashFlow)}</span>
                                  <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 8px', borderRadius: '6px' }}>Stab {fmtCompact(deal.stabilizedCashFlow)}</span>
                                  <span style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 8px', borderRadius: '6px' }}>Refi {fmtCompact(deal.refiValue)}</span>
                                  <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 8px', borderRadius: '6px' }}>Post {fmtCompact(deal.postRefiCashFlow)}</span>
                                </div>
                              </td>
                              {/* Broker grouped */}
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ color: '#374151', fontSize: '12px' }}>{deal.brokerName || '-'}</div>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {deal.brokerPhone && <a href={`tel:${deal.brokerPhone}`} style={{ color: '#0f766e', textDecoration: 'none', fontSize: '12px' }}>{deal.brokerPhone}</a>}
                                    {deal.brokerEmail && <a href={`mailto:${deal.brokerEmail}`} style={{ color: '#0f766e', textDecoration: 'none', fontSize: '12px' }}>{deal.brokerEmail}</a>}
                                  </div>
                                </div>
                              </td>
                              {/* Actions */}
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <button onClick={() => handleViewDeal(deal)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }} title="View full underwriting"><Eye size={12} />Underwrite</button>
                                  <button onClick={() => handleGenerateLOI(deal)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Generate Letter of Intent"><FileText size={12} />LOI</button>
                                  <button onClick={() => handleDueDiligence(deal)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Due diligence checklist"><ClipboardCheck size={12} />DD</button>
                                  <button onClick={() => navigate(`/pitch-deck?dealId=${deal.dealId}`)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Generate pitch deck"><Presentation size={12} />Pitch</button>
                                  <button onClick={() => handleDeleteDeal(deal.dealId)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }} title="Remove from pipeline"><Trash2 size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  
                </div>
              </div>
            </>
          )
        ) : (
          // Rapid Fire Queue View
          isLoadingRapid ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#0f766e' }} />
              <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading Rapid Fire queue...</p>
            </div>
          ) : filteredRapidFireDeals.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '80px 20px',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              border: '2px dashed #e5e7eb'
            }}>
              <Building2 size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#374151' }}>
                {searchTerm ? 'No Rapid Fire leads match your search' : 'No Rapid Fire leads in queue yet'}
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                {searchTerm ? 'Try a different search term' : 'Push DEALs & MAYBEs from Rapid Fire to see them here'}
              </p>
            </div>
          ) : (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '14px', 
              border: '1px solid rgba(45, 212, 191, 0.15)',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(20, 184, 166, 0.04)'
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredRapidFireDeals.length > 0 &&
                      filteredRapidFireDeals.every(d => selectedRapidFireIds.includes(d.dealId))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = filteredRapidFireDeals.map(d => d.dealId);
                        setSelectedRapidFireIds(prev => Array.from(new Set([...prev, ...allIds])));
                      } else {
                        const visibleIds = new Set(filteredRapidFireDeals.map(d => d.dealId));
                        setSelectedRapidFireIds(prev => prev.filter(id => !visibleIds.has(id)));
                      }
                    }}
                  />
                  <span>Select all on this page</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteRapidFireDeals(selectedRapidFireIds)}
                  disabled={selectedRapidFireIds.length === 0}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: selectedRapidFireIds.length === 0 ? 'not-allowed' : 'pointer',
                    backgroundColor: selectedRapidFireIds.length === 0 ? '#e5e7eb' : '#b91c1c',
                    color: selectedRapidFireIds.length === 0 ? '#6b7280' : 'white'
                  }}
                >
                  Delete Selected
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
                  <thead>
                    <tr style={{ 
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 40%, #0a1929 100%)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Select</th>
                      <th style={thStyle}>Property Name</th>
                      <th style={thStyle}>Listing Link</th>
                      <th style={thStyle}>Market / City</th>
                      <th style={thStyle}>Units</th>
                      <th style={thStyle}>Price / Unit</th>
                      <th style={thStyle}>Price</th>
                      <th style={thStyle}>Broker Cap Rate</th>
                      <th style={thStyle}>NOI</th>
                      <th style={thStyle}>Monthly Cashflow</th>
                      <th style={thStyle}>Calculated Cap Rate</th>
                      <th style={thStyle}>DSCR</th>
                      <th style={thStyle}>Cash-on-Cash</th>
                      <th style={thStyle}>Verdict</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRapidFireDeals.map((deal, index) => (
                      <tr
                        key={deal.dealId || index}
                        style={{ 
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedRapidFireIds.includes(deal.dealId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRapidFireIds(prev => prev.includes(deal.dealId) ? prev : [...prev, deal.dealId]);
                              } else {
                                setSelectedRapidFireIds(prev => prev.filter(id => id !== deal.dealId));
                              }
                            }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: '600', color: '#111827', maxWidth: '220px' }}>
                            {deal.name || deal.address || '-'}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {deal.listingUrl ? (
                            <a
                              href={deal.listingUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: '12px',
                                color: '#0f766e',
                                textDecoration: 'underline',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Open Listing
                            </a>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#4b5563', fontSize: '13px' }}>
                            {(deal.city || '')}{deal.state ? `, ${deal.state}` : ''}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ 
                            backgroundColor: '#e0f2fe', 
                            color: '#0369a1', 
                            padding: '4px 10px', 
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '13px'
                          }}>
                            {deal.units ?? '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#111827' }}>
                            {deal.pricePerUnit != null ? fmtCompact(deal.pricePerUnit) : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '700', color: '#111827' }}>
                            {fmtCompact(deal.totalPrice)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>
                            {deal.brokerCapRate != null ? `${deal.brokerCapRate.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#111827' }}>
                            {deal.noi != null ? fmtCompact(deal.noi) : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: '#111827' }}>
                            {deal.monthlyCashFlow != null ? fmtCompact(deal.monthlyCashFlow) : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '600', color: '#111827' }}>
                            {deal.calculatedCapRate != null ? `${deal.calculatedCapRate.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '600', color: deal.dscr != null && deal.dscr >= 1.25 ? '#059669' : '#b91c1c' }}>
                            {deal.dscr != null ? deal.dscr.toFixed(2) : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: '600', color: deal.cashOnCash != null && deal.cashOnCash >= 8 ? '#059669' : '#b91c1c' }}>
                            {deal.cashOnCash != null ? `${deal.cashOnCash.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ 
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            backgroundColor: (deal.verdict || '').toUpperCase() === 'DEAL' ? '#dcfce7' : (deal.verdict || '').toUpperCase() === 'MAYBE' ? '#fef9c3' : '#fee2e2',
                            color: (deal.verdict || '').toUpperCase() === 'DEAL' ? '#166534' : (deal.verdict || '').toUpperCase() === 'MAYBE' ? '#854d0e' : '#991b1b'
                          }}>
                            {(deal.verdict || '').toUpperCase() || 'UNKNOWN'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteRapidFireDeals([deal.dealId])}
                            title="Remove from Rapid Fire queue"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: '4px',
                              color: '#b91c1c'
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Summary Stats */}
        {viewMode === 'pipeline' && filteredDeals.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px',
            marginTop: '24px'
          }}>
            <StatCard 
              label="Total Pipeline Value"
              value={fmtCompact(filteredDeals.reduce((sum, d) => sum + (d.purchasePrice || 0), 0))}
              icon={Building2}
              color="#0f766e"
            />
            <StatCard 
              label="Total Day 1 Cash Flow"
              value={fmtCompact(filteredDeals.reduce((sum, d) => sum + (d.dayOneCashFlow || 0), 0))}
              icon={DollarSign}
              color="#059669"
            />
            <StatCard 
              label="Total Refi Cash-Out"
              value={fmtCompact(filteredDeals.reduce((sum, d) => sum + (d.cashOutRefiAmount || 0), 0))}
              icon={TrendingUp}
              color="#6366f1"
            />
            <StatCard 
              label="Avg. Stabilized CF"
              value={fmtCompact(filteredDeals.reduce((sum, d) => sum + (d.stabilizedCashFlow || 0), 0) / filteredDeals.length)}
              icon={Layers}
              color="#8b5cf6"
            />
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                Change Deal Stage
              </h3>
              <button
                onClick={() => setShowStatusModal(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              {showStatusModal.deal.address}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map(status => {
                const statusColors = getStatusColor(status);
                const isCurrentStatus = status === showStatusModal.currentStatus;
                
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(showStatusModal.deal, status)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `2px solid ${isCurrentStatus ? statusColors.border : '#e5e7eb'}`,
                      backgroundColor: isCurrentStatus ? statusColors.bg : 'white',
                      color: isCurrentStatus ? statusColors.text : '#374151',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                      transition: 'all 0.15s'
                    }}
                  >
                    {getStatusLabel(status)}
                    {isCurrentStatus && ' (Current)'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Death Reason Modal */}
      {showDeathModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>
                Mark Deal as Dead
              </h3>
              <button
                onClick={() => {
                  setShowDeathModal(null);
                  setDeathReason('');
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              {showDeathModal.address}
            </div>
            
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Why did this deal die?
            </label>
            
            <select
              value={deathReason}
              onChange={(e) => setDeathReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            >
              <option value="">Select reason...</option>
              <option value="Seller Rejected">Seller Rejected</option>
              <option value="Financing Fell Through">Financing Fell Through</option>
              <option value="Inspection Issues">Inspection Issues</option>
              <option value="Title Problems">Title Problems</option>
              <option value="Better Deal Found">Better Deal Found</option>
              <option value="Numbers Don't Work">Numbers Don't Work</option>
              <option value="Market Conditions">Market Conditions</option>
              <option value="Other">Other</option>
            </select>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDeathReasonSubmit}
                disabled={!deathReason}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: deathReason ? '#dc2626' : '#e5e7eb',
                  color: deathReason ? 'white' : '#9ca3af',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: deathReason ? 'pointer' : 'not-allowed'
                }}
              >
                Mark as Dead
              </button>
              <button
                onClick={() => {
                  setShowDeathModal(null);
                  setDeathReason('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PipelinePage;
