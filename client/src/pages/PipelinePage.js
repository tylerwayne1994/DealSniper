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
  Presentation
} from 'lucide-react';
import { loadPipelineDeals as loadDealsFromSupabase, loadRapidFireDeals as loadRapidFireDealsFromSupabase, deleteDeal } from '../lib/dealsService';

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
      pushedAt: '2025-12-01T10:30:00Z'
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
      pushedAt: '2025-12-05T14:15:00Z'
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
            /* Pipeline Table - Premium Design */
            <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '14px', 
            border: '1px solid rgba(45, 212, 191, 0.15)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(20, 184, 166, 0.04)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1600px' }}>
                <thead>
                  <tr style={{ 
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 40%, #0a1929 100%)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}>
                    <th style={thStyle}>Address</th>
                    <th style={thStyle}>Units/Pads</th>
                    <th style={thStyle}>Purchase Price</th>
                    <th style={thStyle}>Day 1 CF</th>
                    <th style={thStyle}>Stabilized CF</th>
                    <th style={thStyle}>Refi Value</th>
                    <th style={thStyle}>Cash-Out Refi</th>
                    <th style={thStyle}>In Pocket</th>
                    <th style={thStyle}>Post-Refi CF</th>
                    <th style={thStyle}>Agent Name</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Deal Structure</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal, index) => (
                    <tr 
                      key={deal.dealId || index}
                      style={{ 
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* Address */}
                      <td style={tdStyle}>
                        <div style={{ fontWeight: '600', color: '#111827', maxWidth: '200px' }}>
                          {deal.address || '-'}
                        </div>
                      </td>
                      
                      {/* Units/Pads */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: '#e0f2fe', 
                          color: '#0369a1', 
                          padding: '4px 10px', 
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '13px'
                        }}>
                          {deal.units || '-'}
                        </span>
                      </td>
                      
                      {/* Purchase Price */}
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '700', color: '#111827' }}>
                          {fmtCompact(deal.purchasePrice)}
                        </span>
                      </td>
                      
                      {/* Day 1 Cash Flow */}
                      <td style={tdStyle}>
                        <span style={{ 
                          fontWeight: '600', 
                          color: deal.dayOneCashFlow >= 0 ? '#059669' : '#dc2626'
                        }}>
                          {fmtCompact(deal.dayOneCashFlow)}
                        </span>
                      </td>
                      
                      {/* Stabilized Cash Flow */}
                      <td style={tdStyle}>
                        <span style={{ 
                          fontWeight: '600', 
                          color: deal.stabilizedCashFlow >= 0 ? '#059669' : '#dc2626'
                        }}>
                          {fmtCompact(deal.stabilizedCashFlow)}
                        </span>
                      </td>
                      
                      {/* Refi Value */}
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '600', color: '#6366f1' }}>
                          {fmtCompact(deal.refiValue)}
                        </span>
                      </td>
                      
                      {/* Cash-Out Refi Amount */}
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '700', color: '#059669' }}>
                          {fmtCompact(deal.cashOutRefiAmount)}
                        </span>
                      </td>
                      
                      {/* User's Total In Pocket */}
                      <td style={tdStyle}>
                        <span style={{ 
                          fontWeight: '700', 
                          color: deal.userTotalInPocket >= 0 ? '#059669' : '#dc2626'
                        }}>
                          {fmtCompact(deal.userTotalInPocket)}
                        </span>
                      </td>
                      
                      {/* Post-Refi Cash Flow */}
                      <td style={tdStyle}>
                        <span style={{ 
                          fontWeight: '600', 
                          color: deal.postRefiCashFlow >= 0 ? '#059669' : '#dc2626'
                        }}>
                          {fmtCompact(deal.postRefiCashFlow)}
                        </span>
                      </td>
                      
                      {/* Agent Name */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="#6b7280" />
                          <span style={{ color: '#374151', fontSize: '13px' }}>
                            {deal.brokerName || '-'}
                          </span>
                        </div>
                      </td>
                      
                      {/* Phone */}
                      <td style={tdStyle}>
                        {deal.brokerPhone && deal.brokerPhone !== '-' ? (
                          <a 
                            href={`tel:${deal.brokerPhone}`}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              color: '#0f766e',
                              textDecoration: 'none',
                              fontSize: '13px'
                            }}
                          >
                            <Phone size={12} />
                            {deal.brokerPhone}
                          </a>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '13px' }}>-</span>
                        )}
                      </td>
                      
                      {/* Email */}
                      <td style={tdStyle}>
                        {deal.brokerEmail && deal.brokerEmail !== '-' ? (
                          <a 
                            href={`mailto:${deal.brokerEmail}`}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              color: '#0f766e',
                              textDecoration: 'none',
                              fontSize: '13px',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            <Mail size={12} />
                            {deal.brokerEmail}
                          </a>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '13px' }}>-</span>
                        )}
                      </td>
                      
                      {/* Deal Structure */}
                      <td style={tdStyle}>
                        <span style={{ 
                          backgroundColor: '#f0fdf4', 
                          color: '#166534', 
                          padding: '4px 10px', 
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '12px',
                          display: 'inline-block',
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {deal.dealStructure || 'Traditional'}
                        </span>
                      </td>
                      
                      {/* Actions */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {/* View Deal Button */}
                          <button
                            onClick={() => handleViewDeal(deal)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              backgroundColor: '#0f766e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Eye size={14} />
                            Underwrite
                          </button>
                          
                          {/* Generate LOI Button */}
                          <button
                            onClick={() => handleGenerateLOI(deal)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              backgroundColor: '#8b5cf6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <FileText size={14} />
                            LOI
                          </button>
                          
                          {/* Due Diligence Button */}
                          <button
                            onClick={() => handleDueDiligence(deal)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <ClipboardCheck size={14} />
                            DD
                          </button>
                          
                          {/* Pitch Deck Button */}
                          <button
                            onClick={() => navigate(`/pitch-deck?dealId=${deal.dealId}`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Presentation size={14} />
                            Pitch
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteDeal(deal.dealId)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
