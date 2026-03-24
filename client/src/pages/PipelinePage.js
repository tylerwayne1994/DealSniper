import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  FileText, 
  Trash2,
  Layers,
  ArrowLeft,
  RefreshCw,
  Search,
  ClipboardCheck,
  Presentation,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Columns,
  Wrench,
  LayoutGrid,
  List,
  Copy,
  GripVertical
} from 'lucide-react';
import { loadPipelineDeals as loadDealsFromSupabase, loadRapidFireDeals as loadRapidFireDealsFromSupabase, deleteDeal, updateDeal, bulkDeleteDeals, duplicateDeal } from '../lib/dealsService';
import DealComparisonModal from '../components/DealComparisonModal';
import DealPhotoGallery, { DealThumbnail } from '../components/DealPhotoGallery';

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
  
  let totalEquityRequired = deal.total_equity_required;
  let sponsorCashIn = deal.sponsor_cash_in;
  let outsideCapital = deal.outside_capital_required;
  let capitalAtRefi = deal.capital_returned_at_refi || cashOutRefi;
  
  if (!totalEquityRequired) {
    const ltv = 0.75;
    const loanAmount = price * ltv;
    const downPayment = price - loanAmount;
    const closingCosts = price * 0.03;
    const reserves = price * 0.02;
    
    totalEquityRequired = downPayment + closingCosts + reserves;
    
    const structure = (deal.dealStructure || '').toLowerCase();
    if (structure.includes('partner') || structure.includes('equity')) {
      sponsorCashIn = totalEquityRequired * 0.3;
      outsideCapital = totalEquityRequired * 0.7;
    } else if (structure.includes('seller')) {
      sponsorCashIn = totalEquityRequired * 0.5;
      outsideCapital = 0;
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
  
  const cashRatio = capital.sponsorCashIn > 0 
    ? capital.capitalAtRefi / capital.sponsorCashIn 
    : 0;
  
  const refiValue = deal.refiValue || (deal.purchasePrice || 0) * 1.25;
  const loanAmount = refiValue * 0.75;
  const equityAfterRefi = refiValue - loanAmount;
  const equityMultiple = capital.totalEquityRequired > 0 
    ? equityAfterRefi / capital.totalEquityRequired 
    : 0;
  
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
  const annualDebtService = price * 0.75 * 0.065;
  const monthlyDebtService = annualDebtService / 12;
  const noi = monthlyCF + monthlyDebtService;
  const dscr = monthlyDebtService > 0 ? (noi * 12) / annualDebtService : 0;
  
  const hasBalloonSoon = structure.includes('seller') || structure.includes('bridge');
  
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

// ============================================================================
// Monday CRM Style — Status Colors & Helpers
// ============================================================================

const getStatusColor = (status) => {
  const colors = {
    sourced:     { bg: '#c4def6', text: '#1e3a5f', border: '#7fb3de' },
    underwritten:{ bg: '#b6e9d1', text: '#15573a', border: '#6dd4a0' },
    loi:         { bg: '#d4c4f0', text: '#5b2e91', border: '#b494e0' },
    contract:    { bg: '#fdcb8a', text: '#7c3a07', border: '#f9a94b' },
    financing:   { bg: '#c2f5ea', text: '#0d5e56', border: '#6ae0cd' },
    closed:      { bg: '#a3e4b8', text: '#14532d', border: '#5ecc7f' },
    dead:        { bg: '#f5bebe', text: '#7f1d1d', border: '#eb8282' }
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
  return Math.ceil(Math.abs(now - changed) / (1000 * 60 * 60 * 24));
};

// Monday-style group header accent per stage
const stageGroupColor = {
  sourced: '#579bfc',
  underwritten: '#00c875',
  loi: '#a25ddc',
  contract: '#fdab3d',
  financing: '#66ccff',
  closed: '#037f4c',
  dead: '#e2445c'
};

// Monday-style risk badge
const riskBadge = (level) => {
  if (level === 'green')  return { bg: '#00c875', text: '#fff' };
  if (level === 'yellow') return { bg: '#fdab3d', text: '#fff' };
  return { bg: '#e2445c', text: '#fff' };
};

// Monday-style deal-structure badge
const structureBadge = (structure) => {
  const s = (structure || '').toLowerCase();
  if (s.includes('seller'))  return { bg: '#ff642e', text: '#fff' };
  if (s.includes('partner')) return { bg: '#a25ddc', text: '#fff' };
  if (s.includes('syndic'))  return { bg: '#579bfc', text: '#fff' };
  if (s.includes('equity'))  return { bg: '#00c875', text: '#fff' };
  if (s.includes('bridge'))  return { bg: '#fdab3d', text: '#fff' };
  if (s.includes('subto') || s.includes('subject')) return { bg: '#e2445c', text: '#fff' };
  return { bg: '#c4c4c4', text: '#333' };
};

// ============================================================================
// Stat Card — Monday style
// ============================================================================

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div style={{
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e6e9ef',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '8px',
      backgroundColor: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '11px', color: '#676879', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#323338', marginTop: '2px' }}>{value}</div>
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
  const [viewMode, setViewMode] = useState('pipeline');
  const [pipelineViewMode, setPipelineViewMode] = useState('table');
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [selectedRapidFireIds, setSelectedRapidFireIds] = useState([]);
  const [selectedDealIds, setSelectedDealIds] = useState([]);

  // CRM Feature State
  const [sortBy, setSortBy] = useState('none');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterRisk, setFilterRisk] = useState([]);
  const [filterOutsideCapital, setFilterOutsideCapital] = useState('all');
  const [showStatusModal, setShowStatusModal] = useState(null);
  const [showDeathModal, setShowDeathModal] = useState(null);
  const [deathReason, setDeathReason] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [photoGalleryDeal, setPhotoGalleryDeal] = useState(null);

  const handleViewDeal = (deal) => navigate(`/underwrite?viewDeal=${deal.dealId}`);

  const loadPipelineDeals = async () => {
    try {
      setIsLoading(true);
      const deals = await loadDealsFromSupabase();
      setPipelineDeals(deals || []);
    } catch (e) { console.error('Error loading pipeline deals:', e); }
    finally { setIsLoading(false); }
  };

  const loadRapidFireDeals = async () => {
    try {
      setIsLoadingRapid(true);
      const deals = await loadRapidFireDealsFromSupabase();
      setRapidFireDeals(deals || []);
    } catch (e) { console.error('Error loading rapid fire deals:', e); }
    finally { setIsLoadingRapid(false); }
  };

  useEffect(() => { loadPipelineDeals(); loadRapidFireDeals(); }, []);

  const handleDeleteDeal = async (dealId) => {
    if (window.confirm('Are you sure you want to remove this deal from the pipeline?')) {
      try {
        if (dealId.startsWith('sample-')) {
          setPipelineDeals(prev => prev.filter(d => d.dealId !== dealId));
        } else {
          await deleteDeal(dealId);
          setPipelineDeals(prev => prev.filter(d => d.dealId !== dealId));
        }
        window.dispatchEvent(new Event('pipelineDealsUpdated'));
      } catch (error) {
        console.error('Error deleting deal:', error);
        alert('Failed to delete deal: ' + error.message);
      }
    }
  };

  const handleGenerateLOI = (deal) => navigate(`/loi?dealId=${deal.dealId}`);
  const handleDueDiligence = (deal) => navigate(`/due-diligence?dealId=${deal.dealId}`);

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
    if (!window.confirm(`Are you sure you want to remove ${dealIds.length} deal(s) from the Rapid Fire queue?`)) return;
    try {
      for (const id of dealIds) await deleteDeal(id);
      setRapidFireDeals(prev => prev.filter(d => !dealIds.includes(d.dealId)));
      setSelectedRapidFireIds(prev => prev.filter(id => !dealIds.includes(id)));
    } catch (error) {
      console.error('Error deleting Rapid Fire deal(s):', error);
      alert('Failed to delete Rapid Fire deal(s): ' + error.message);
    }
  };

  const handleStatusChange = async (deal, newStatus) => {
    if (newStatus === 'dead') {
      setShowDeathModal(deal);
      setShowStatusModal(null);
    } else {
      try {
        const updatedDeal = { ...deal, deal_stage: newStatus, stage_changed_at: new Date().toISOString(), death_reason: null };
        await updateDeal(deal.dealId, { deal_stage: newStatus, stage_changed_at: new Date().toISOString(), death_reason: null });
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
      const updatedDeal = { ...showDeathModal, deal_stage: 'dead', stage_changed_at: new Date().toISOString(), death_reason: deathReason };
      await updateDeal(showDeathModal.dealId, { deal_stage: 'dead', stage_changed_at: new Date().toISOString(), death_reason: deathReason });
      setPipelineDeals(prev => prev.map(d => d.dealId === showDeathModal.dealId ? updatedDeal : d));
      setShowDeathModal(null);
      setDeathReason('');
    } catch (error) {
      console.error('Error marking deal as dead:', error);
      alert('Failed to mark deal as dead: ' + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDealIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedDealIds.length} deal(s) from the pipeline?`)) return;
    try {
      const realIds = selectedDealIds.filter(id => !id.startsWith('sample-'));
      if (realIds.length > 0) await bulkDeleteDeals(realIds);
      setPipelineDeals(prev => prev.filter(d => !selectedDealIds.includes(d.dealId)));
      setSelectedDealIds([]);
      window.dispatchEvent(new Event('pipelineDealsUpdated'));
    } catch (error) {
      console.error('Error bulk deleting deals:', error);
      alert('Failed to delete deals: ' + error.message);
    }
  };

  const handleDuplicateDeal = async (deal) => {
    try {
      const duplicated = await duplicateDeal(deal.dealId);
      setPipelineDeals(prev => [...prev, duplicated]);
      window.dispatchEvent(new Event('pipelineDealsUpdated'));
    } catch (error) {
      console.error('Error duplicating deal:', error);
      alert('Failed to duplicate deal: ' + error.message);
    }
  };

  const handleKanbanDrop = (e, targetStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    const deal = pipelineDeals.find(d => d.dealId === dealId);
    if (!deal || (deal.deal_stage || 'underwritten') === targetStage) return;
    handleStatusChange(deal, targetStage);
    setDraggedDeal(null);
  };

  const getSortedAndFilteredDeals = () => {
    let deals = [...filteredDeals];
    if (filterStatus.length > 0) deals = deals.filter(d => filterStatus.includes(d.deal_stage || 'underwritten'));
    if (filterRisk.length > 0) deals = deals.filter(d => filterRisk.includes(assessStructureRisk(d).level));
    if (filterOutsideCapital !== 'all') {
      deals = deals.filter(d => {
        const capital = calculateCapitalMetrics(d);
        return filterOutsideCapital === 'yes' ? capital.outsideCapital > 0 : capital.outsideCapital === 0;
      });
    }
    if (sortBy !== 'none') {
      deals.sort((a, b) => {
        switch (sortBy) {
          case 'status': {
            const order = ['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'];
            return order.indexOf(a.deal_stage || 'underwritten') - order.indexOf(b.deal_stage || 'underwritten');
          }
          case 'risk': {
            const ro = { green: 0, yellow: 1, red: 2 };
            return ro[assessStructureRisk(a).level] - ro[assessStructureRisk(b).level];
          }
          case 'cash_ratio': return calculateEfficiencyMetrics(b).cashRatio - calculateEfficiencyMetrics(a).cashRatio;
          case 'equity_multiple': return calculateEfficiencyMetrics(b).equityMultiple - calculateEfficiencyMetrics(a).equityMultiple;
          case 'recovery_time': return (calculateEfficiencyMetrics(a).monthsToRecovery || 999) - (calculateEfficiencyMetrics(b).monthsToRecovery || 999);
          case 'price': return (b.purchasePrice || 0) - (a.purchasePrice || 0);
          default: return 0;
        }
      });
    }
    return deals;
  };

  // Group deals by stage for Monday CRM grouped view
  const getGroupedDeals = () => {
    const deals = getSortedAndFilteredDeals();
    const stageOrder = ['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'];
    const groups = {};
    deals.forEach(deal => {
      const stage = deal.deal_stage || 'underwritten';
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(deal);
    });
    return stageOrder
      .filter(stage => groups[stage] && groups[stage].length > 0)
      .map(stage => ({ stage, label: getStatusLabel(stage), color: stageGroupColor[stage], deals: groups[stage] }));
  };

  const hasActiveFilters = filterStatus.length > 0 || filterRisk.length > 0 || filterOutsideCapital !== 'all' || sortBy !== 'none';

  // Monday CRM table header style
  const thStyle = {
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#676879',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #e6e9ef',
    background: '#fff',
    textTransform: 'none',
    letterSpacing: '0',
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', fontFamily: 'Figtree, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* ================================================================ */}
      {/* Monday-style Header */}
      {/* ================================================================ */}
      <div style={{ backgroundColor: '#fff', padding: '16px 24px', borderBottom: '1px solid #e6e9ef' }}>
        <div style={{ maxWidth: '1900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'transparent', border: '1px solid #e6e9ef', borderRadius: '8px', color: '#323338', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f6f7fb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#323338', letterSpacing: '-0.3px' }}>Deal Pipeline</h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#676879', fontWeight: '400' }}>
                {viewMode === 'pipeline' ? pipelineDeals.length : rapidFireDeals.length}{' '}
                {viewMode === 'pipeline'
                  ? (pipelineDeals.length === 1 ? 'deal in pipeline' : 'deals in pipeline')
                  : (rapidFireDeals.length === 1 ? 'Rapid Fire lead' : 'Rapid Fire leads')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View toggle pill */}
            <div style={{ display: 'flex', backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '3px', border: '1px solid #e6e9ef' }}>
              {['pipeline', 'rapidfire'].map(mode => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{
                  padding: '7px 16px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  backgroundColor: viewMode === mode ? '#fff' : 'transparent',
                  color: viewMode === mode ? '#323338' : '#676879',
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s'
                }}>
                  {mode === 'pipeline' ? 'Underwritten' : 'Rapid Fire Queue'}
                </button>
              ))}
            </div>
            {/* Table / Kanban toggle */}
            {viewMode === 'pipeline' && (
              <div style={{ display: 'flex', backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '3px', border: '1px solid #e6e9ef' }}>
                {[{ key: 'table', icon: List, label: 'Table' }, { key: 'kanban', icon: LayoutGrid, label: 'Kanban' }].map(({ key, icon: Icon, label }) => (
                  <button key={key} type="button" onClick={() => setPipelineViewMode(key)} style={{
                    padding: '7px 12px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    backgroundColor: pipelineViewMode === key ? '#fff' : 'transparent',
                    color: pipelineViewMode === key ? '#323338' : '#676879',
                    boxShadow: pipelineViewMode === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s'
                  }}>
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#676879' }} />
              <input
                type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px 8px 34px', width: '220px', backgroundColor: '#fff', border: '1px solid #e6e9ef', borderRadius: '8px', color: '#323338', fontSize: '13px', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = '#579bfc'}
                onBlur={e => e.target.style.borderColor = '#e6e9ef'}
              />
            </div>
            {/* Refresh */}
            <button
              onClick={() => { loadPipelineDeals(); loadRapidFireDeals(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'transparent', border: '1px solid #e6e9ef', borderRadius: '8px', color: '#323338', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f6f7fb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Monday-style Toolbar (pipeline only) */}
      {/* ================================================================ */}
      {viewMode === 'pipeline' && !isLoading && filteredDeals.length > 0 && (
        <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e6e9ef', padding: '8px 24px' }}>
          <div style={{ maxWidth: '1900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={14} color="#676879" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                padding: '5px 8px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', outline: 'none',
                border: sortBy !== 'none' ? '1px solid #579bfc' : '1px solid transparent',
                backgroundColor: sortBy !== 'none' ? '#e6f0ff' : 'transparent',
                color: sortBy !== 'none' ? '#0073ea' : '#676879',
              }}>
                <option value="none">Sort</option>
                <option value="status">Deal Stage</option>
                <option value="risk">Risk Level</option>
                <option value="cash_ratio">Cash Ratio</option>
                <option value="equity_multiple">Equity Multiple</option>
                <option value="recovery_time">Recovery Time</option>
                <option value="price">Purchase Price</option>
              </select>
            </div>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e6e9ef', margin: '0 4px' }} />
            {/* Filter toggle */}
            <button onClick={() => setShowFilters(!showFilters)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              border: hasActiveFilters ? '1px solid #579bfc' : '1px solid transparent',
              backgroundColor: hasActiveFilters ? '#e6f0ff' : 'transparent',
              color: hasActiveFilters ? '#0073ea' : '#676879',
            }}>
              <Filter size={14} />
              Filter
              {hasActiveFilters && (
                <span style={{ backgroundColor: '#0073ea', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: '700', padding: '1px 6px', marginLeft: '2px' }}>
                  {filterStatus.length + filterRisk.length + (filterOutsideCapital !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button onClick={() => { setFilterStatus([]); setFilterRisk([]); setFilterOutsideCapital('all'); setSortBy('none'); }}
                style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#ffefef', color: '#d83a52', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Clear All
              </button>
            )}
            {/* Compare button — always visible */}
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e6e9ef', margin: '0 4px' }} />
            {selectedDealIds.length >= 2 ? (
              <button onClick={() => setShowComparison(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                border: '1px solid #a25ddc', backgroundColor: '#f3e8ff', color: '#7e22ce',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e9d5ff'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f3e8ff'; }}
              >
                <Columns size={14} />
                Compare ({selectedDealIds.length})
              </button>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#c3c6d4', border: '1px solid #e6e9ef', backgroundColor: '#fafbfc' }}>
                <Columns size={14} />
                Compare {selectedDealIds.length === 1 ? '(select 1 more)' : '(select 2+ deals)'}
              </span>
            )}
            {/* Bulk Delete button */}
            {selectedDealIds.length > 0 && (
              <>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#e6e9ef', margin: '0 4px' }} />
                <button onClick={handleBulkDelete} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  border: '1px solid #e2445c', backgroundColor: '#ffefef', color: '#d83a52',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fde2e4'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffefef'; }}
                >
                  <Trash2 size={14} />
                  Delete Selected ({selectedDealIds.length})
                </button>
              </>
            )}
          </div>

          {/* Expandable filter row */}
          {showFilters && (
            <div style={{ maxWidth: '1900px', margin: '0 auto', padding: '12px 0 4px 0', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #f0f1f3', marginTop: '8px' }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#676879' }}>Status:</span>
                {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map(status => {
                  const isSelected = filterStatus.includes(status);
                  const color = stageGroupColor[status];
                  return (
                    <button key={status} onClick={() => setFilterStatus(prev => isSelected ? prev.filter(s => s !== status) : [...prev, status])}
                      style={{
                        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        border: isSelected ? `2px solid ${color}` : '1px solid #d0d4e4',
                        backgroundColor: isSelected ? `${color}18` : '#fff',
                        color: isSelected ? color : '#676879',
                      }}>
                      {getStatusLabel(status)}
                    </button>
                  );
                })}
              </div>
              <div style={{ width: '1px', height: '20px', backgroundColor: '#e6e9ef' }} />
              {/* Risk */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#676879' }}>Risk:</span>
                {[{ level: 'green', label: 'Low', color: '#00c875' }, { level: 'yellow', label: 'Medium', color: '#fdab3d' }, { level: 'red', label: 'High', color: '#e2445c' }].map(({ level, label, color }) => {
                  const isSelected = filterRisk.includes(level);
                  return (
                    <button key={level} onClick={() => setFilterRisk(prev => isSelected ? prev.filter(r => r !== level) : [...prev, level])}
                      style={{
                        padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        border: isSelected ? `2px solid ${color}` : '1px solid #d0d4e4',
                        backgroundColor: isSelected ? `${color}18` : '#fff',
                        color: isSelected ? color : '#676879',
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ width: '1px', height: '20px', backgroundColor: '#e6e9ef' }} />
              {/* Capital */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#676879' }}>Capital:</span>
                <select value={filterOutsideCapital} onChange={e => setFilterOutsideCapital(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d0d4e4', fontSize: '12px', backgroundColor: '#fff', color: '#323338', cursor: 'pointer', outline: 'none' }}>
                  <option value="all">All</option>
                  <option value="yes">Has Outside Capital</option>
                  <option value="no">Self-Funded Only</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Main Content */}
      {/* ================================================================ */}
      <div style={{ maxWidth: '1900px', margin: '0 auto', padding: '20px 24px' }}>
        {viewMode === 'pipeline' ? (
          isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#579bfc' }} />
              <p style={{ marginTop: '14px', color: '#676879', fontSize: '14px' }}>Loading pipeline...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e6e9ef' }}>
              <Building2 size={44} style={{ color: '#c3c6d4', marginBottom: '14px' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600', color: '#323338' }}>
                {searchTerm ? 'No deals match your search' : 'No deals in pipeline yet'}
              </h3>
              <p style={{ margin: 0, color: '#676879', fontSize: '13px' }}>
                {searchTerm ? 'Try a different search term' : 'Push deals from the Deal or No Deal tab to see them here'}
              </p>
            </div>
          ) : (
            <>
              {pipelineViewMode === 'kanban' ? (
                /* ============================================================ */
                /* Kanban Board View */
                /* ============================================================ */
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', minHeight: '400px' }}>
                  {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map(stage => {
                    const stageDeals = getSortedAndFilteredDeals().filter(d => (d.deal_stage || 'underwritten') === stage);
                    const color = stageGroupColor[stage];
                    return (
                      <div key={stage}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = `${color}10`; }}
                        onDragLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; }}
                        onDrop={e => { e.currentTarget.style.backgroundColor = '#fff'; handleKanbanDrop(e, stage); }}
                        style={{
                          minWidth: '260px', maxWidth: '300px', flex: '1 0 260px',
                          backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e6e9ef',
                          display: 'flex', flexDirection: 'column', transition: 'background 0.15s',
                        }}
                      >
                        {/* Column header */}
                        <div style={{ padding: '14px 14px 10px', borderBottom: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#323338' }}>{getStatusLabel(stage)}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#676879', backgroundColor: '#f6f7fb', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>
                            {stageDeals.length}
                          </span>
                        </div>
                        {/* Cards */}
                        <div style={{ padding: '8px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' }}>
                          {stageDeals.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#c3c6d4', fontSize: '12px', fontStyle: 'italic' }}>
                              Drop deals here
                            </div>
                          )}
                          {stageDeals.map(deal => {
                            const risk = assessStructureRisk(deal);
                            const rColors = riskBadge(risk.level);
                            return (
                              <div key={deal.dealId}
                                draggable
                                onDragStart={e => { e.dataTransfer.setData('text/plain', deal.dealId); setDraggedDeal(deal.dealId); }}
                                onDragEnd={() => setDraggedDeal(null)}
                                style={{
                                  backgroundColor: draggedDeal === deal.dealId ? '#f0f4ff' : '#fff',
                                  border: '1px solid #e6e9ef', borderRadius: '8px', padding: '12px',
                                  cursor: 'grab', userSelect: 'none', transition: 'box-shadow 0.15s, opacity 0.15s',
                                  opacity: draggedDeal === deal.dealId ? 0.6 : 1,
                                  borderLeft: `4px solid ${color}`,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#323338', lineHeight: '1.3', flex: 1 }}>{deal.address || 'Untitled Deal'}</div>
                                  <GripVertical size={14} color="#c3c6d4" style={{ flexShrink: 0, marginTop: '1px' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                  {deal.units && <span style={{ backgroundColor: '#cce5ff', color: '#0073ea', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>{deal.units} units</span>}
                                  <span style={{ backgroundColor: rColors.bg, color: rColors.text, padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>{risk.text}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#676879' }}>
                                  <span>{fmtCompact(deal.purchasePrice)}</span>
                                  <span style={{ color: (deal.dayOneCashFlow || 0) >= 0 ? '#00854d' : '#d83a52', fontWeight: '600' }}>CF: {fmtCompact(deal.dayOneCashFlow)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                  <button onClick={() => handleViewDeal(deal)} title="View" style={{ flex: 1, padding: '4px', backgroundColor: '#00854d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}><Eye size={10} />View</button>
                                  <button onClick={() => handleDuplicateDeal(deal)} title="Clone" style={{ flex: 1, padding: '4px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}><Copy size={10} />Clone</button>
                                  <button onClick={() => handleDeleteDeal(deal.dealId)} title="Delete" style={{ padding: '4px 6px', backgroundColor: '#ffefef', color: '#d83a52', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={10} /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              /* ============================================================ */
              /* Monday-style Grouped Pipeline Table */
              /* ============================================================ */
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e6e9ef', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1800px' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}></th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '40px' }}>
                          <input type="checkbox"
                            checked={getSortedAndFilteredDeals().length > 0 && getSortedAndFilteredDeals().every(d => selectedDealIds.includes(d.dealId))}
                            onChange={e => e.target.checked ? setSelectedDealIds(getSortedAndFilteredDeals().map(d => d.dealId)) : setSelectedDealIds([])}
                            style={{ accentColor: '#579bfc' }}
                          />
                        </th>
                        <th style={thStyle}>Address</th>
                        <th style={thStyle}>Deal Structure</th>
                        <th style={thStyle}>Deal Stage</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Units</th>
                        <th style={thStyle}>Purchase Price</th>
                        <th style={thStyle}>Total Equity</th>
                        <th style={thStyle}>Sponsor Cash</th>
                        <th style={thStyle}>Outside Capital</th>
                        <th style={thStyle}>Refi Cash-Out</th>
                        <th style={thStyle}>Cash Ratio</th>
                        <th style={thStyle}>Eq. Multiple</th>
                        <th style={thStyle}>Recovery</th>
                        <th style={thStyle}>Risk</th>
                        <th style={thStyle}>Day 1 CF</th>
                        <th style={thStyle}>Stab. CF</th>
                        <th style={thStyle}>Refi Value</th>
                        <th style={thStyle}>Post-Refi CF</th>
                        <th style={thStyle}>Broker</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getGroupedDeals().map(group => {
                        const isCollapsed = collapsedGroups[group.stage];
                        return (
                          <React.Fragment key={group.stage}>
                            {/* Group header row */}
                            <tr>
                              <td colSpan={21} style={{ padding: 0 }}>
                                <div onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.stage]: !prev[group.stage] }))}
                                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', backgroundColor: '#fff', borderBottom: '1px solid #e6e9ef', userSelect: 'none' }}>
                                  {isCollapsed ? <ChevronRight size={16} color={group.color} /> : <ChevronDown size={16} color={group.color} />}
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: group.color }}>{group.label}</span>
                                  <span style={{ fontSize: '12px', color: '#676879', backgroundColor: '#f6f7fb', padding: '2px 8px', borderRadius: '999px' }}>
                                    {group.deals.length} {group.deals.length === 1 ? 'deal' : 'deals'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {/* Deal rows */}
                            {!isCollapsed && group.deals.map((deal, idx) => {
                              const capital = calculateCapitalMetrics(deal);
                              const efficiency = calculateEfficiencyMetrics(deal);
                              const risk = assessStructureRisk(deal);
                              const daysInStage = calculateDaysInStage(deal.stage_changed_at);
                              const sColors = structureBadge(deal.dealStructure);
                              const rColors = riskBadge(risk.level);
                              const stColors = getStatusColor(deal.deal_stage || 'underwritten');
                              const isSelected = selectedDealIds.includes(deal.dealId);

                              const cs = { padding: '10px 12px', fontSize: '13px', color: '#323338', verticalAlign: 'middle', borderBottom: '1px solid #f0f1f3' };

                              return (
                                <tr key={deal.dealId || idx}
                                  style={{ backgroundColor: isSelected ? '#e6f0ff' : '#fff', transition: 'background 0.1s' }}
                                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f7f8fa'; }}
                                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fff'; }}
                                >
                                  {/* Photo thumbnail */}
                                  <td style={{ ...cs, padding: '6px 4px 6px 8px', borderLeft: `4px solid ${group.color}`, width: '50px' }}>
                                    <DealThumbnail images={deal.images} onClick={() => setPhotoGalleryDeal(deal)} />
                                  </td>
                                  {/* Checkbox */}
                                  <td style={{ ...cs, textAlign: 'center', paddingLeft: '4px' }}>
                                    <input type="checkbox" checked={isSelected}
                                      onChange={e => e.target.checked ? setSelectedDealIds(prev => [...prev, deal.dealId]) : setSelectedDealIds(prev => prev.filter(id => id !== deal.dealId))}
                                      style={{ accentColor: '#579bfc' }}
                                    />
                                  </td>
                                  {/* Address */}
                                  <td style={cs}><div style={{ fontWeight: '600', color: '#323338' }}>{deal.address || '-'}</div></td>
                                  {/* Deal Structure badge */}
                                  <td style={cs}>
                                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: sColors.bg, color: sColors.text, whiteSpace: 'nowrap' }}>
                                      {deal.dealStructure || 'Traditional'}
                                    </span>
                                  </td>
                                  {/* Stage badge (clickable) */}
                                  <td style={cs}>
                                    <button onClick={() => setShowStatusModal({ deal, currentStatus: deal.deal_stage || 'underwritten' })}
                                      style={{ padding: '4px 12px', borderRadius: '999px', border: 'none', backgroundColor: stColors.bg, color: stColors.text, fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                      title="Click to change stage">
                                      {getStatusLabel(deal.deal_stage || 'underwritten')}
                                    </button>
                                    {daysInStage > 0 && <div style={{ fontSize: '10px', color: '#ababab', marginTop: '2px' }}>{daysInStage}d in stage</div>}
                                  </td>
                                  {/* Units */}
                                  <td style={{ ...cs, textAlign: 'center' }}>
                                    <span style={{ backgroundColor: '#cce5ff', color: '#0073ea', padding: '3px 10px', borderRadius: '999px', fontWeight: '600', fontSize: '12px' }}>{deal.units || '-'}</span>
                                  </td>
                                  {/* Price */}
                                  <td style={cs}><span style={{ fontWeight: '600' }}>{fmtCompact(deal.purchasePrice)}</span></td>
                                  {/* Capital columns — flat text */}
                                  <td style={cs}>{fmtCompact(capital.totalEquityRequired)}</td>
                                  <td style={cs}>{fmtCompact(capital.sponsorCashIn)}</td>
                                  <td style={cs}>
                                    {capital.outsideCapital > 0
                                      ? <span style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>{fmtCompact(capital.outsideCapital)}</span>
                                      : <span style={{ color: '#c3c6d4' }}>—</span>
                                    }
                                  </td>
                                  <td style={cs}>{fmtCompact(capital.capitalAtRefi)}</td>
                                  {/* Efficiency — flat text */}
                                  <td style={cs}><span style={{ fontWeight: '600' }}>{efficiency.cashRatio > 0 ? efficiency.cashRatio.toFixed(2) + 'x' : '-'}</span></td>
                                  <td style={cs}><span style={{ fontWeight: '600' }}>{efficiency.equityMultiple > 0 ? efficiency.equityMultiple.toFixed(2) + 'x' : '-'}</span></td>
                                  <td style={cs}><span style={{ color: '#676879', fontSize: '12px' }}>{efficiency.monthsToRecovery ? Math.round(efficiency.monthsToRecovery) + ' mo' : '-'}</span></td>
                                  {/* Risk badge */}
                                  <td style={cs}>
                                    <span title={risk.reason} style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: rColors.bg, color: rColors.text, whiteSpace: 'nowrap' }}>
                                      {risk.text}
                                    </span>
                                  </td>
                                  {/* Cash flow columns */}
                                  <td style={cs}><span style={{ color: (deal.dayOneCashFlow || 0) >= 0 ? '#00854d' : '#d83a52', fontWeight: '500' }}>{fmtCompact(deal.dayOneCashFlow)}</span></td>
                                  <td style={cs}><span style={{ color: (deal.stabilizedCashFlow || 0) >= 0 ? '#00854d' : '#d83a52', fontWeight: '500' }}>{fmtCompact(deal.stabilizedCashFlow)}</span></td>
                                  <td style={cs}>{fmtCompact(deal.refiValue)}</td>
                                  <td style={cs}><span style={{ color: (deal.postRefiCashFlow || 0) >= 0 ? '#00854d' : '#d83a52', fontWeight: '500' }}>{fmtCompact(deal.postRefiCashFlow)}</span></td>
                                  {/* Broker */}
                                  <td style={cs}>
                                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#323338' }}>{deal.brokerName || '-'}</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                                      {deal.brokerPhone && <a href={`tel:${deal.brokerPhone}`} style={{ color: '#579bfc', textDecoration: 'none', fontSize: '11px' }}>{deal.brokerPhone}</a>}
                                      {deal.brokerEmail && <a href={`mailto:${deal.brokerEmail}`} style={{ color: '#579bfc', textDecoration: 'none', fontSize: '11px' }}>{deal.brokerEmail}</a>}
                                    </div>
                                  </td>
                                  {/* Actions */}
                                  <td style={{ ...cs, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                      <button onClick={() => handleViewDeal(deal)} title="View underwriting" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#00854d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><Eye size={11} />Underwrite</button>
                                      <button onClick={() => handleGenerateLOI(deal)} title="Generate LOI" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#a25ddc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><FileText size={11} />LOI</button>
                                      <button onClick={() => handleDueDiligence(deal)} title="Due diligence" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#fdab3d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><ClipboardCheck size={11} />DD</button>
                                      <button onClick={() => navigate(`/pitch-deck?dealId=${deal.dealId}`)} title="Pitch deck" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#579bfc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><Presentation size={11} />Pitch</button>
                                      <button onClick={() => navigate(`/contract?dealId=${deal.dealId}`)} title="Contracts" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#0d9488', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><FileText size={11} />Contract</button>
                                      <button onClick={() => setPhotoGalleryDeal(deal)} title="AI CapEx Estimator — analyze photos" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><Wrench size={11} />CapEx AI</button>
                                      <button onClick={() => handleDuplicateDeal(deal)} title="Duplicate deal" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}><Copy size={11} />Clone</button>
                                      <button onClick={() => handleDeleteDeal(deal.dealId)} title="Remove" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', backgroundColor: '#ffefef', color: '#d83a52', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </>
          )
        ) : (
          /* ============================================================ */
          /* Rapid Fire Queue — Monday-style */
          /* ============================================================ */
          isLoadingRapid ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#579bfc' }} />
              <p style={{ marginTop: '14px', color: '#676879', fontSize: '14px' }}>Loading Rapid Fire queue...</p>
            </div>
          ) : filteredRapidFireDeals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e6e9ef' }}>
              <Building2 size={44} style={{ color: '#c3c6d4', marginBottom: '14px' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600', color: '#323338' }}>
                {searchTerm ? 'No Rapid Fire leads match your search' : 'No Rapid Fire leads in queue yet'}
              </h3>
              <p style={{ margin: 0, color: '#676879', fontSize: '13px' }}>
                {searchTerm ? 'Try a different search term' : 'Push DEALs & MAYBEs from Rapid Fire to see them here'}
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e6e9ef', overflow: 'hidden' }}>
              {/* Bulk bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e6e9ef' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#676879' }}>
                  <input type="checkbox"
                    checked={filteredRapidFireDeals.length > 0 && filteredRapidFireDeals.every(d => selectedRapidFireIds.includes(d.dealId))}
                    onChange={e => {
                      if (e.target.checked) { setSelectedRapidFireIds(prev => Array.from(new Set([...prev, ...filteredRapidFireDeals.map(d => d.dealId)]))); }
                      else { const vis = new Set(filteredRapidFireDeals.map(d => d.dealId)); setSelectedRapidFireIds(prev => prev.filter(id => !vis.has(id))); }
                    }}
                    style={{ accentColor: '#579bfc' }}
                  />
                  Select all
                </label>
                <button type="button" onClick={() => handleDeleteRapidFireDeals(selectedRapidFireIds)} disabled={selectedRapidFireIds.length === 0}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600,
                    cursor: selectedRapidFireIds.length === 0 ? 'not-allowed' : 'pointer',
                    backgroundColor: selectedRapidFireIds.length === 0 ? '#f0f1f3' : '#e2445c',
                    color: selectedRapidFireIds.length === 0 ? '#c3c6d4' : '#fff'
                  }}>
                  Delete Selected
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1400px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e6e9ef' }}>
                      {['', 'Property Name', 'Listing Link', 'Market / City', 'Units', 'Price / Unit', 'Price', 'Broker Cap Rate', 'NOI', 'Monthly CF', 'Calc Cap Rate', 'DSCR', 'Cash-on-Cash', 'Verdict', 'Actions'].map((h, i) => (
                        <th key={i} style={{ ...thStyle, textAlign: i === 0 || i === 4 || i === 14 ? 'center' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRapidFireDeals.map((deal, index) => {
                      const isSelected = selectedRapidFireIds.includes(deal.dealId);
                      const cs = { padding: '10px 12px', fontSize: '13px', color: '#323338', verticalAlign: 'middle', borderBottom: '1px solid #f0f1f3' };
                      return (
                        <tr key={deal.dealId || index}
                          style={{ backgroundColor: isSelected ? '#e6f0ff' : '#fff', transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f7f8fa'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fff'; }}
                        >
                          <td style={{ ...cs, textAlign: 'center', borderLeft: '4px solid #579bfc', paddingLeft: '8px' }}>
                            <input type="checkbox" checked={isSelected}
                              onChange={e => e.target.checked ? setSelectedRapidFireIds(prev => prev.includes(deal.dealId) ? prev : [...prev, deal.dealId]) : setSelectedRapidFireIds(prev => prev.filter(id => id !== deal.dealId))}
                              style={{ accentColor: '#579bfc' }}
                            />
                          </td>
                          <td style={cs}><div style={{ fontWeight: '600', color: '#323338', maxWidth: '220px' }}>{deal.name || deal.address || '-'}</div></td>
                          <td style={cs}>
                            {deal.listingUrl
                              ? <a href={deal.listingUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#579bfc', textDecoration: 'none', fontWeight: '500' }}>Open Listing ↗</a>
                              : <span style={{ color: '#c3c6d4' }}>—</span>
                            }
                          </td>
                          <td style={cs}><span style={{ color: '#676879' }}>{(deal.city || '')}{deal.state ? `, ${deal.state}` : ''}</span></td>
                          <td style={{ ...cs, textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#cce5ff', color: '#0073ea', padding: '3px 10px', borderRadius: '999px', fontWeight: '600', fontSize: '12px' }}>{deal.units ?? '-'}</span>
                          </td>
                          <td style={cs}>{deal.pricePerUnit != null ? fmtCompact(deal.pricePerUnit) : '-'}</td>
                          <td style={cs}><span style={{ fontWeight: '600' }}>{fmtCompact(deal.totalPrice)}</span></td>
                          <td style={cs}><span style={{ color: '#676879' }}>{deal.brokerCapRate != null ? `${deal.brokerCapRate.toFixed(1)}%` : '-'}</span></td>
                          <td style={cs}>{deal.noi != null ? fmtCompact(deal.noi) : '-'}</td>
                          <td style={cs}>{deal.monthlyCashFlow != null ? fmtCompact(deal.monthlyCashFlow) : '-'}</td>
                          <td style={cs}><span style={{ fontWeight: '600' }}>{deal.calculatedCapRate != null ? `${deal.calculatedCapRate.toFixed(1)}%` : '-'}</span></td>
                          <td style={cs}><span style={{ fontWeight: '600', color: deal.dscr != null && deal.dscr >= 1.25 ? '#00854d' : '#d83a52' }}>{deal.dscr != null ? deal.dscr.toFixed(2) : '-'}</span></td>
                          <td style={cs}><span style={{ fontWeight: '600', color: deal.cashOnCash != null && deal.cashOnCash >= 8 ? '#00854d' : '#d83a52' }}>{deal.cashOnCash != null ? `${deal.cashOnCash.toFixed(1)}%` : '-'}</span></td>
                          <td style={cs}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                              backgroundColor: (deal.verdict || '').toUpperCase() === 'DEAL' ? '#00c875' : (deal.verdict || '').toUpperCase() === 'MAYBE' ? '#fdab3d' : '#e2445c',
                              color: '#fff'
                            }}>
                              {(deal.verdict || '').toUpperCase() || 'UNKNOWN'}
                            </span>
                          </td>
                          <td style={{ ...cs, textAlign: 'center' }}>
                            <button onClick={() => handleDeleteRapidFireDeals([deal.dealId])} title="Remove"
                              style={{ border: 'none', background: '#ffefef', borderRadius: '6px', cursor: 'pointer', padding: '5px', color: '#d83a52', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Summary Stats */}
        {viewMode === 'pipeline' && getSortedAndFilteredDeals().length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '20px' }}>
            <StatCard label="Total Pipeline Value" value={fmtCompact(getSortedAndFilteredDeals().reduce((s, d) => s + (d.purchasePrice || 0), 0))} icon={Building2} color="#579bfc" />
            <StatCard label="Total Day 1 Cash Flow" value={fmtCompact(getSortedAndFilteredDeals().reduce((s, d) => s + (d.dayOneCashFlow || 0), 0))} icon={DollarSign} color="#00c875" />
            <StatCard label="Total Refi Cash-Out" value={fmtCompact(getSortedAndFilteredDeals().reduce((s, d) => s + (d.cashOutRefiAmount || 0), 0))} icon={TrendingUp} color="#a25ddc" />
            <StatCard label="Avg. Stabilized CF" value={fmtCompact(getSortedAndFilteredDeals().reduce((s, d) => s + (d.stabilizedCashFlow || 0), 0) / getSortedAndFilteredDeals().length)} icon={Layers} color="#fdab3d" />
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Status Change Modal */}
      {/* ================================================================ */}
      {showStatusModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(41, 47, 76, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '380px', width: '90%', boxShadow: '0 16px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#323338' }}>Change Deal Stage</h3>
              <button onClick={() => setShowStatusModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#676879' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '13px', color: '#676879', marginBottom: '14px' }}>{showStatusModal.deal.address}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map(status => {
                const isCurrent = status === showStatusModal.currentStatus;
                const color = stageGroupColor[status];
                return (
                  <button key={status} onClick={() => handleStatusChange(showStatusModal.deal, status)}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      border: isCurrent ? `2px solid ${color}` : '1px solid #e6e9ef',
                      backgroundColor: isCurrent ? `${color}15` : '#fff',
                      color: isCurrent ? color : '#323338',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = '#f6f7fb'; }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = '#fff'; }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                    {getStatusLabel(status)}
                    {isCurrent && <span style={{ fontSize: '11px', color: '#ababab', marginLeft: 'auto' }}>Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Death Reason Modal */}
      {/* ================================================================ */}
      {showDeathModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(41, 47, 76, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', maxWidth: '380px', width: '90%', boxShadow: '0 16px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#e2445c' }}>Mark Deal as Dead</h3>
              <button onClick={() => { setShowDeathModal(null); setDeathReason(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#676879' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '13px', color: '#676879', marginBottom: '14px' }}>{showDeathModal.address}</div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#323338', marginBottom: '6px' }}>Why did this deal die?</label>
            <select value={deathReason} onChange={e => setDeathReason(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e6e9ef', fontSize: '13px', marginBottom: '16px', color: '#323338', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#579bfc'}
              onBlur={e => e.target.style.borderColor = '#e6e9ef'}
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDeathReasonSubmit} disabled={!deathReason}
                style={{ flex: 1, padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: deathReason ? '#e2445c' : '#f0f1f3', color: deathReason ? '#fff' : '#c3c6d4', fontSize: '13px', fontWeight: '600', cursor: deathReason ? 'pointer' : 'not-allowed' }}>
                Mark as Dead
              </button>
              <button onClick={() => { setShowDeathModal(null); setDeathReason(''); }}
                style={{ flex: 1, padding: '9px 16px', borderRadius: '8px', border: '1px solid #e6e9ef', backgroundColor: '#fff', color: '#323338', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Deal Comparison Modal */}
      {/* ================================================================ */}
      <DealComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        deals={pipelineDeals.filter(d => selectedDealIds.includes(d.dealId))}
      />

      {/* ================================================================ */}
      {/* Photo Gallery Modal */}
      {/* ================================================================ */}
      {photoGalleryDeal && (
        <DealPhotoGallery
          deal={photoGalleryDeal}
          images={photoGalleryDeal.images || []}
          onClose={() => setPhotoGalleryDeal(null)}
          onImagesUpdated={(updatedImages) => {
            // Update in local state
            setPipelineDeals(prev => prev.map(d =>
              d.dealId === photoGalleryDeal.dealId ? { ...d, images: updatedImages } : d
            ));
            setPhotoGalleryDeal(prev => prev ? { ...prev, images: updatedImages } : null);
            // Persist to Supabase
            updateDeal(photoGalleryDeal.dealId, { images: updatedImages }).catch(err =>
              console.error('Failed to persist images:', err)
            );
          }}
        />
      )}

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
