// Email Deals Page - Auto-Screen Broker Emails
// Matches the UI style of ResultsPageV2 and DashboardPage
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  Link2,
  TrendingUp,
  DollarSign,
  Building2,
  Settings,
  Upload,
  Inbox,
  Loader2
} from 'lucide-react';
import DashboardShell from '../components/DashboardShell';

// ============================================================================
// Email Deals Page - Auto-Screen Broker Emails
// ============================================================================

function EmailDealsPage() {
  const navigate = useNavigate();
  
  // Connection status
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // checking, connected, disconnected, error
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [emailCount, setEmailCount] = useState(0);
  const [dealsCount, setDealsCount] = useState(0);
  const [emailAddress, setEmailAddress] = useState('');
  
  // Deals list
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  // Filters
  const [scoreFilter, setScoreFilter] = useState('all');
  
  // Buy Box modal
  const [showBuyBox, setShowBuyBox] = useState(false);
  const [buyBox, setBuyBox] = useState({
    min_price: '',
    max_price: '',
    max_price_per_unit: '',
    min_units: '',
    max_units: '',
    min_cap_rate: '',
    min_dscr: '',
    min_cash_on_cash: '',
    max_expense_ratio: '',
    assumed_ltv: 0.75,
    assumed_interest_rate: 0.07
  });
  const [savingBuyBox, setSavingBuyBox] = useState(false);

  // ============================================================================
  // API Calls
  // ============================================================================
  
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8010/api/email-deals/status');
      const data = await response.json();
      
      setGmailConnected(data.connected);
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      setLastSyncAt(data.last_sync_at);
      setEmailCount(data.raw_emails_count || 0);
      setDealsCount(data.screened_deals_count || 0);
      setEmailAddress(data.email_address || '');
    } catch (error) {
      console.error('Error checking status:', error);
      setConnectionStatus('error');
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const url = scoreFilter === 'all' 
        ? 'http://localhost:8010/api/email-deals/list' 
        : `http://localhost:8010/api/email-deals/list?score_filter=${scoreFilter}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      setDeals(data.deals || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  }, [scoreFilter]);

  const fetchBuyBox = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8010/api/email-deals/buy-box');
      const data = await response.json();
      setBuyBox({
        min_price: data.min_price || '',
        max_price: data.max_price || '',
        max_price_per_unit: data.max_price_per_unit || '',
        min_units: data.min_units || '',
        max_units: data.max_units || '',
        min_cap_rate: data.min_cap_rate ? (data.min_cap_rate * 100).toFixed(1) : '',
        min_dscr: data.min_dscr || '',
        min_cash_on_cash: data.min_cash_on_cash ? (data.min_cash_on_cash * 100).toFixed(1) : '',
        max_expense_ratio: data.max_expense_ratio ? (data.max_expense_ratio * 100).toFixed(1) : '',
        assumed_ltv: data.assumed_ltv || 0.75,
        assumed_interest_rate: data.assumed_interest_rate || 0.07
      });
    } catch (error) {
      console.error('Error fetching buy box:', error);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    
    try {
      const response = await fetch('http://localhost:8010/api/email-deals/sync');
      const data = await response.json();
      
      if (data.success) {
        setSyncMessage(data.message);
        await checkStatus();
        await fetchDeals();
      } else {
        setSyncMessage('Sync failed: ' + (data.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncMessage('Error: ' + error.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const handleConnectGmail = () => {
    // Open OAuth in new window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      'http://localhost:8010/auth/google',
      'gmail_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Poll for popup close
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        checkStatus();
      }
    }, 500);
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Gmail?')) return;
    
    try {
      await fetch('/api/email-deals/disconnect', { method: 'DELETE' });
      await checkStatus();
      setDeals([]);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleSaveBuyBox = async () => {
    setSavingBuyBox(true);
    
    try {
      const payload = {
        min_price: buyBox.min_price ? parseFloat(buyBox.min_price) : null,
        max_price: buyBox.max_price ? parseFloat(buyBox.max_price) : null,
        max_price_per_unit: buyBox.max_price_per_unit ? parseFloat(buyBox.max_price_per_unit) : null,
        min_units: buyBox.min_units ? parseInt(buyBox.min_units) : null,
        max_units: buyBox.max_units ? parseInt(buyBox.max_units) : null,
        min_cap_rate: buyBox.min_cap_rate ? parseFloat(buyBox.min_cap_rate) / 100 : null,
        min_dscr: buyBox.min_dscr ? parseFloat(buyBox.min_dscr) : null,
        min_cash_on_cash: buyBox.min_cash_on_cash ? parseFloat(buyBox.min_cash_on_cash) / 100 : null,
        max_expense_ratio: buyBox.max_expense_ratio ? parseFloat(buyBox.max_expense_ratio) / 100 : null,
        assumed_ltv: buyBox.assumed_ltv,
        assumed_interest_rate: buyBox.assumed_interest_rate
      };
      
      await fetch('/api/email-deals/buy-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setShowBuyBox(false);
    } catch (error) {
      console.error('Error saving buy box:', error);
    } finally {
      setSavingBuyBox(false);
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================
  
  useEffect(() => {
    checkStatus();
    fetchBuyBox();
  }, [checkStatus, fetchBuyBox]);

  useEffect(() => {
    if (gmailConnected) {
      fetchDeals();
    }
  }, [gmailConnected, fetchDeals]);

  // ============================================================================
  // Styles (matching ResultsPageV2 / DashboardPage)
  // ============================================================================
  
  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  };

  const buttonPrimary = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#0d9488',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  };

  const buttonSecondary = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#f9fafb',
    color: '#111827',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: '#374151',
    fontSize: '12px'
  };

  const getScoreBadge = (score) => {
    const styles = {
      pass: { bg: '#dcfce7', color: '#166534', text: 'PASS' },
      maybe: { bg: '#fef3c7', color: '#92400e', text: 'MAYBE' },
      fail: { bg: '#fee2e2', color: '#991b1b', text: 'FAIL' }
    };
    const s = styles[score] || styles.maybe;
    return (
      <span style={{
        padding: '4px 10px',
        backgroundColor: s.bg,
        color: s.color,
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {s.text}
      </span>
    );
  };

  const getSourceIcon = (source) => {
    const colors = {
      crexi: '#2563eb',
      loopnet: '#dc2626',
      marcus_millichap: '#7c3aed',
      cbre: '#059669',
      colliers: '#0891b2',
      other: '#6b7280'
    };
    return (
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        backgroundColor: colors[source] || colors.other,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Link2 size={16} color="white" />
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <DashboardShell activeTab="email-deals" title="Email Deals">
      {/* Header */}
      <div style={{ 
        backgroundColor: '#1e293b', 
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 20px',
                backgroundColor: 'transparent',
                color: '#f0fdfa',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>

            <div style={{
              padding: '14px 20px',
              color: '#f0fdfa',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderLeft: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Mail size={16} />
              Email Deal Screener
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {syncMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px',
          backgroundColor: syncMessage.includes('Error') ? '#ef4444' : '#10b981',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          {syncMessage.includes('Error') ? <XCircle size={20} /> : <CheckCircle size={20} />}
          {syncMessage}
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        
        {/* Connection Status Card */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: gmailConnected ? '#dcfce7' : '#fee2e2',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                {connectionStatus === 'checking' ? (
                  <Loader2 size={24} color="#6b7280" style={{ animation: 'spin 1s linear infinite' }} />
                ) : gmailConnected ? (
                  <CheckCircle size={24} color="#166534" />
                ) : (
                  <AlertCircle size={24} color="#991b1b" />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  {connectionStatus === 'checking' ? 'Checking Connection...' :
                   gmailConnected ? 'Gmail Connected' : 'Gmail Not Connected'}
                  {gmailConnected && emailAddress ? ` • ${emailAddress}` : ''}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {gmailConnected 
                    ? `${emailCount} emails synced • ${dealsCount} deals found${lastSyncAt ? ` • Last sync: ${new Date(lastSyncAt).toLocaleString()}` : ''}`
                    : 'Connect your Gmail to auto-screen broker deal emails'}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {gmailConnected ? (
                <>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    style={{
                      ...buttonPrimary,
                      backgroundColor: syncing ? '#6b7280' : '#0d9488',
                      cursor: syncing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button onClick={() => setShowBuyBox(true)} style={buttonSecondary}>
                    <Settings size={18} />
                    Buy Box
                  </button>
                  <button onClick={handleDisconnect} style={{ ...buttonSecondary, color: '#dc2626' }}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={handleConnectGmail} style={buttonPrimary}>
                  <Mail size={18} />
                  Connect Gmail
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Deals Section */}
        {gmailConnected && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Filter:</span>
              {['all', 'pass', 'maybe', 'fail'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setScoreFilter(filter)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: scoreFilter === filter ? '#1e293b' : '#f1f5f9',
                    color: scoreFilter === filter ? 'white' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {filter === 'all' ? 'All Deals' : filter}
                </button>
              ))}
            </div>

            {/* Deals List */}
            {loading ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
                <Loader2 size={40} color="#6b7280" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: '#6b7280', margin: 0 }}>Loading deals...</p>
              </div>
            ) : deals.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  backgroundColor: '#f0fdfa', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Inbox size={40} color="#0d9488" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                  No Deals Found
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px', margin: '0 auto' }}>
                  {emailCount === 0 
                    ? 'Click "Sync Now" to fetch deal emails from your inbox.'
                    : 'No deals match your current filters. Try adjusting your buy box criteria.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deals.map(deal => (
                  <div key={deal.id} style={{ ...cardStyle, padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      {getSourceIcon(deal.source)}
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            color: '#6b7280', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {deal.source.replace('_', ' ')}
                          </span>
                          {getScoreBadge(deal.score)}
                        </div>
                        
                        <h4 style={{ 
                          margin: '0 0 6px', 
                          fontSize: '15px', 
                          fontWeight: '600', 
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {deal.property_name || deal.email_subject || 'Untitled Deal'}
                        </h4>
                        
                        {deal.property_address && (
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>
                            {deal.property_address}
                          </p>
                        )}
                        
                        <a 
                          href={deal.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            fontSize: '12px', 
                            color: '#0d9488', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={12} />
                          View Listing
                        </a>
                        
                        {deal.screening_notes && (
                          <p style={{ 
                            margin: '8px 0 0', 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            {deal.screening_notes}
                          </p>
                        )}
                      </div>
                      
                      {/* Metrics */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(4, 1fr)', 
                        gap: '16px',
                        flexShrink: 0
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>
                            CAP RATE
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                            {deal.estimated_cap_rate ? `${(deal.estimated_cap_rate * 100).toFixed(1)}%` : '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>
                            DSCR
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                            {deal.estimated_dscr ? `${deal.estimated_dscr.toFixed(2)}x` : '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>
                            COC
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                            {deal.estimated_cash_on_cash ? `${(deal.estimated_cash_on_cash * 100).toFixed(1)}%` : '--'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>
                            $/UNIT
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                            {deal.estimated_price_per_unit ? `$${(deal.estimated_price_per_unit / 1000).toFixed(0)}k` : '--'}
                          </div>
                        </div>
                      </div>
                      
                      {/* CTA Button */}
                      <button
                        onClick={() => navigate('/upload')}
                        style={{
                          ...buttonPrimary,
                          padding: '10px 16px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <Upload size={14} />
                        Upload OM
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state when not connected */}
        {!gmailConnected && connectionStatus !== 'checking' && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              backgroundColor: '#fef3c7', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <Mail size={50} color="#d97706" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Auto-Screen Broker Emails
            </h2>
            <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '500px', margin: '0 auto 32px', lineHeight: '1.6' }}>
              Connect your Gmail to automatically find and screen deal emails from CREXi, LoopNet, Marcus & Millichap, CBRE, and other brokers. We'll run napkin underwriting against your buy box criteria.
            </p>
            <button onClick={handleConnectGmail} style={{ ...buttonPrimary, padding: '16px 32px', fontSize: '16px' }}>
              <Mail size={20} />
              Connect Gmail (Read-Only)
            </button>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>
              We only read your emails. We never send, delete, or modify anything.
            </p>
          </div>
        )}
      </div>

      {/* Buy Box Modal */}
      {showBuyBox && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                Buy Box Criteria
              </h2>
              <button 
                onClick={() => setShowBuyBox(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
              >
                <XCircle size={24} color="#6b7280" />
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
              Set your investment criteria. Deals that don't meet these thresholds will be flagged.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Min Price ($)</label>
                <input
                  type="number"
                  value={buyBox.min_price}
                  onChange={(e) => setBuyBox({ ...buyBox, min_price: e.target.value })}
                  style={inputStyle}
                  placeholder="500,000"
                />
              </div>
              <div>
                <label style={labelStyle}>Max Price ($)</label>
                <input
                  type="number"
                  value={buyBox.max_price}
                  onChange={(e) => setBuyBox({ ...buyBox, max_price: e.target.value })}
                  style={inputStyle}
                  placeholder="50,000,000"
                />
              </div>
              <div>
                <label style={labelStyle}>Min Units</label>
                <input
                  type="number"
                  value={buyBox.min_units}
                  onChange={(e) => setBuyBox({ ...buyBox, min_units: e.target.value })}
                  style={inputStyle}
                  placeholder="10"
                />
              </div>
              <div>
                <label style={labelStyle}>Max Units</label>
                <input
                  type="number"
                  value={buyBox.max_units}
                  onChange={(e) => setBuyBox({ ...buyBox, max_units: e.target.value })}
                  style={inputStyle}
                  placeholder="500"
                />
              </div>
              <div>
                <label style={labelStyle}>Min Cap Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={buyBox.min_cap_rate}
                  onChange={(e) => setBuyBox({ ...buyBox, min_cap_rate: e.target.value })}
                  style={inputStyle}
                  placeholder="5.5"
                />
              </div>
              <div>
                <label style={labelStyle}>Max Price/Unit ($)</label>
                <input
                  type="number"
                  value={buyBox.max_price_per_unit}
                  onChange={(e) => setBuyBox({ ...buyBox, max_price_per_unit: e.target.value })}
                  style={inputStyle}
                  placeholder="200,000"
                />
              </div>
              <div>
                <label style={labelStyle}>Min DSCR</label>
                <input
                  type="number"
                  step="0.01"
                  value={buyBox.min_dscr}
                  onChange={(e) => setBuyBox({ ...buyBox, min_dscr: e.target.value })}
                  style={inputStyle}
                  placeholder="1.20"
                />
              </div>
              <div>
                <label style={labelStyle}>Min Cash-on-Cash (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={buyBox.min_cash_on_cash}
                  onChange={(e) => setBuyBox({ ...buyBox, min_cash_on_cash: e.target.value })}
                  style={inputStyle}
                  placeholder="8.0"
                />
              </div>
              <div>
                <label style={labelStyle}>Max Expense Ratio (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={buyBox.max_expense_ratio}
                  onChange={(e) => setBuyBox({ ...buyBox, max_expense_ratio: e.target.value })}
                  style={inputStyle}
                  placeholder="50.0"
                />
              </div>
            </div>
            
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>
                Financing Assumptions (for napkin calcs)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '11px' }}>LTV</label>
                  <select
                    value={buyBox.assumed_ltv}
                    onChange={(e) => setBuyBox({ ...buyBox, assumed_ltv: parseFloat(e.target.value) })}
                    style={inputStyle}
                  >
                    <option value="0.70">70%</option>
                    <option value="0.75">75%</option>
                    <option value="0.80">80%</option>
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '11px' }}>Interest Rate</label>
                  <select
                    value={buyBox.assumed_interest_rate}
                    onChange={(e) => setBuyBox({ ...buyBox, assumed_interest_rate: parseFloat(e.target.value) })}
                    style={inputStyle}
                  >
                    <option value="0.06">6.0%</option>
                    <option value="0.065">6.5%</option>
                    <option value="0.07">7.0%</option>
                    <option value="0.075">7.5%</option>
                    <option value="0.08">8.0%</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBuyBox(false)} style={buttonSecondary}>
                Cancel
              </button>
              <button 
                onClick={handleSaveBuyBox} 
                disabled={savingBuyBox}
                style={{
                  ...buttonPrimary,
                  backgroundColor: savingBuyBox ? '#6b7280' : '#0d9488'
                }}
              >
                {savingBuyBox ? 'Saving...' : 'Save Buy Box'}
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
      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </DashboardShell>
  );
}
export default EmailDealsPage;
