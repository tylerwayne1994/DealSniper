import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2,
  Eye, 
  FileText, 
  Trash2,
  ClipboardCheck,
  Presentation,
  Phone,
  Mail,
  User
} from 'lucide-react';

// Helper function
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

// Table Styles
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

const PipelineTable = ({ 
  deals = [], 
  onViewDeal, 
  onGenerateLOI, 
  onDueDiligence, 
  onDeleteDeal,
  showPitchComingSoon = false // New prop to control pitch button behavior
}) => {
  const navigate = useNavigate();
  const [showComingSoonPopup, setShowComingSoonPopup] = useState(false);

  const handlePitchClick = (deal) => {
    if (showPitchComingSoon) {
      setShowComingSoonPopup(true);
      setTimeout(() => setShowComingSoonPopup(false), 2000);
    } else {
      navigate(`/pitch-deck?dealId=${deal.dealId}`);
    }
  };

  if (!deals || deals.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '80px 20px',
        backgroundColor: '#f9fafb',
        borderRadius: '16px',
        border: '2px dashed #e5e7eb'
      }}>
        <Building2 size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#374151' }}>
          No deals in pipeline yet
        </h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Push deals from Rapid Fire to see them here
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Coming Soon Popup */}
      {showComingSoonPopup && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.92)',
          color: 'white',
          padding: '32px 48px',
          borderRadius: '16px',
          fontSize: '24px',
          fontWeight: '700',
          zIndex: 10000,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          animation: 'fadeIn 0.2s ease-out',
          textAlign: 'center'
        }}>
          <Presentation size={48} style={{ marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          Coming Soon
        </div>
      )}

      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '14px', 
        border: '1px solid rgba(45, 212, 191, 0.15)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 40px rgba(20, 184, 166, 0.04)'
      }}>
        <div style={{ 
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100%'
        }}>
          <table style={{ 
            width: 'max-content',
            minWidth: '100%',
            borderCollapse: 'separate', 
            borderSpacing: '0',
            fontSize: '13px'
          }}>
            <thead>
              <tr>
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
              {deals.map((deal, index) => (
                <tr 
                  key={deal.dealId || index} 
                  style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'all 0.15s',
                    backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                  }}
                >
                  {/* Address */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Building2 size={18} style={{ color: '#14b8a6', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', lineHeight: '1.3' }}>
                          {deal.address || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Units */}
                  <td style={tdStyle}>
                    <span style={{ 
                      backgroundColor: '#ecfdf5', 
                      color: '#065f46', 
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
                      {onViewDeal && (
                        <button
                          onClick={() => onViewDeal(deal)}
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
                      )}
                      
                      {/* Generate LOI Button */}
                      {onGenerateLOI && (
                        <button
                          onClick={() => onGenerateLOI(deal)}
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
                      )}
                      
                      {/* Due Diligence Button */}
                      {onDueDiligence && (
                        <button
                          onClick={() => onDueDiligence(deal)}
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
                      )}
                      
                      {/* Pitch Deck Button */}
                      <button
                        onClick={() => handlePitchClick(deal)}
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
                      {onDeleteDeal && (
                        <button
                          onClick={() => onDeleteDeal(deal.dealId)}
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}
      </style>
    </>
  );
};

export default PipelineTable;
