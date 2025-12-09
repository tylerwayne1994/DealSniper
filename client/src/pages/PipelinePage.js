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
  Search
} from 'lucide-react';
import { loadPipelineDeals as loadDealsFromSupabase, deleteDeal } from '../lib/dealsService';

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
// Table Styles
// ============================================================================

const thStyle = {
  padding: '14px 12px',
  fontSize: '11px',
  fontWeight: '700',
  color: '#f0fdfa',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap'
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  // Load deals from Supabase on mount
  useEffect(() => {
    loadPipelineDeals();
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
      
      // Navigate with state for sample deals
      navigate('/underwrite', {
        state: {
          dealId: deal.dealId,
          verifiedData: mockScenarioData,
          goToResults: true
        }
      });
    } else {
      // For real deals, load from Supabase via URL param
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

  // Filter deals based on search
  const filteredDeals = pipelineDeals.filter(deal => 
    deal.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.brokerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.dealStructure?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)',
        padding: '24px 32px',
        color: 'white'
      }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ArrowLeft size={18} />
                Dashboard
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                  Deal Pipeline
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#99f6e4', opacity: 0.9 }}>
                  {pipelineDeals.length} {pipelineDeals.length === 1 ? 'deal' : 'deals'} in pipeline
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 12px 10px 40px',
                    width: '250px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              
              {/* Refresh */}
              <button
                onClick={loadPipelineDeals}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
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
        
        {isLoading ? (
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
          /* Pipeline Table */
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1600px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b' }}>
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
                            View
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
        )}

        {/* Summary Stats */}
        {filteredDeals.length > 0 && (
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
