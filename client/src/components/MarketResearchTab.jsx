// Market Research Tab - Perplexity API Integration
// Tier 1: Quick Market Check (sonar) - fast, cheap
// Tier 2: Deep Market Research (sonar-deep-research) - institutional-grade IC memo

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  MapPin,
  Building2,
  Users,
  Briefcase,
  Shield,
  BarChart3,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader,
  AlertCircle,
  Zap
} from 'lucide-react';

// ============================================================================
// Score Card Component
// ============================================================================

const ScoreCard = ({ label, score, icon: Icon, description, inverted = false }) => {
  // For inverted scores (like supply risk), lower is better
  const getScoreColor = (s, inv) => {
    if (s === null || s === undefined) return '#9ca3af';
    const effectiveScore = inv ? 100 - s : s;
    if (effectiveScore >= 70) return '#10b981';
    if (effectiveScore >= 50) return '#f59e0b';
    return '#ef4444';
  };
  
  const color = getScoreColor(score, inverted);
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {Icon && <Icon size={20} color={color} />}
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '32px', fontWeight: '700', color }}>
          {score !== null && score !== undefined ? score : '—'}
        </span>
        <span style={{ fontSize: '16px', color: '#9ca3af' }}>/100</span>
      </div>
      {description && (
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{description}</span>
      )}
    </div>
  );
};

// ============================================================================
// Investability Badge
// ============================================================================

const InvestabilityBadge = ({ investability }) => {
  const configs = {
    'Strong': { bg: '#dcfce7', color: '#166534', icon: CheckCircle },
    'Neutral': { bg: '#fef3c7', color: '#92400e', icon: AlertTriangle },
    'Weak': { bg: '#fee2e2', color: '#991b1b', icon: AlertCircle }
  };
  
  const config = configs[investability] || configs['Neutral'];
  const Icon = config.icon;
  
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      backgroundColor: config.bg,
      color: config.color,
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '600'
    }}>
      <Icon size={16} />
      {investability || 'Unknown'}
    </div>
  );
};

// ============================================================================
// Bullet List Component
// ============================================================================

const BulletList = ({ title, items, icon: Icon, positive = true }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <div style={{
      backgroundColor: positive ? '#f0fdf4' : '#fef2f2',
      borderRadius: '12px',
      padding: '16px',
      border: `1px solid ${positive ? '#bbf7d0' : '#fecaca'}`
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '12px' 
      }}>
        {Icon && <Icon size={18} color={positive ? '#16a34a' : '#dc2626'} />}
        <span style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          color: positive ? '#166534' : '#991b1b' 
        }}>
          {title}
        </span>
      </div>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ 
            fontSize: '13px', 
            color: '#374151', 
            marginBottom: '6px',
            lineHeight: '1.5'
          }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ============================================================================
// Key Metrics Table
// ============================================================================

const KeyMetricsTable = ({ metrics }) => {
  if (!metrics) return null;
  
  const metricRows = [
    { key: 'population', label: 'Population', icon: Users },
    { key: 'population_growth_last_5y', label: 'Population Growth (5Y)', icon: TrendingUp },
    { key: 'population_growth_next_5y_forecast', label: 'Population Forecast (5Y)', icon: TrendingUp },
    { key: 'population_growth_10y', label: 'Population Growth (10Y)', icon: TrendingUp },
    { key: 'job_growth_last_5y', label: 'Job Growth (5Y)', icon: Briefcase },
    { key: 'job_growth_5y', label: 'Job Growth (5Y)', icon: Briefcase },
    { key: 'rent_growth_last_5y', label: 'Rent Growth (5Y)', icon: DollarSign },
    { key: 'rent_growth_5y', label: 'Rent Growth (5Y)', icon: DollarSign },
    { key: 'vacancy_trend', label: 'Vacancy Trend', icon: Building2 },
    { key: 'new_supply_pipeline_summary', label: 'New Supply Pipeline', icon: Building2 },
    { key: 'units_under_construction', label: 'Units Under Construction', icon: Building2 },
    { key: 'median_income', label: 'Median Income', icon: DollarSign },
    { key: 'median_income_trend', label: 'Income Trend', icon: TrendingUp },
    { key: 'home_price_trend', label: 'Home Price Trend', icon: TrendingUp },
    { key: 'crime_trend', label: 'Crime Trend', icon: Shield },
    { key: 'regulation_summary', label: 'Regulatory Climate', icon: FileText }
  ];
  
  const displayedMetrics = metricRows.filter(m => metrics[m.key]);
  
  if (displayedMetrics.length === 0) return null;
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
          Key Market Metrics
        </span>
      </div>
      <div>
        {displayedMetrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div key={m.key} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: idx < displayedMetrics.length - 1 ? '1px solid #f3f4f6' : 'none'
            }}>
              <Icon size={16} color="#6b7280" style={{ marginRight: '10px', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '13px', color: '#6b7280' }}>{m.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827', textAlign: 'right' }}>
                {metrics[m.key]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Top Employers List
// ============================================================================

const TopEmployersList = ({ employers }) => {
  if (!employers || employers.length === 0) return null;
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
          Top Employers
        </span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {employers.map((emp, idx) => (
            <span key={idx} style={{
              padding: '6px 12px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {emp}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// IC Recommendation Card
// ============================================================================

const ICRecommendationCard = ({ recommendation }) => {
  if (!recommendation) return null;
  
  return (
    <div style={{
      backgroundColor: '#eff6ff',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #bfdbfe'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        marginBottom: '16px' 
      }}>
        <FileText size={20} color="#1d4ed8" />
        <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>
          IC Recommendation
        </span>
      </div>
      
      {recommendation.summary && (
        <p style={{ 
          fontSize: '14px', 
          color: '#1e3a8a', 
          lineHeight: '1.6',
          marginBottom: '16px'
        }}>
          {recommendation.summary}
        </p>
      )}
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        {recommendation.recommended_strategy && (
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Strategy</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
              {recommendation.recommended_strategy}
            </span>
          </div>
        )}
        {recommendation.recommended_hold_period_years && (
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>Hold Period</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
              {recommendation.recommended_hold_period_years} years
            </span>
          </div>
        )}
      </div>
      
      {recommendation.mitigations && recommendation.mitigations.length > 0 && (
        <div>
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
            Risk Mitigations
          </span>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {recommendation.mitigations.map((m, idx) => (
              <li key={idx} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Memo Markdown Viewer
// ============================================================================

const MemoViewer = ({ markdown, expanded, onToggle }) => {
  if (!markdown) return null;
  
  // Simple markdown rendering (headers, bullets, bold)
  const renderMarkdown = (text) => {
    return text.split('\n').map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '16px 0 8px' }}>{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '20px 0 10px' }}>{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '24px 0 12px' }}>{line.slice(2)}</h2>;
      }
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={idx} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px', marginLeft: '20px' }}>{line.slice(2)}</li>;
      }
      // Empty lines
      if (!line.trim()) {
        return <br key={idx} />;
      }
      // Regular paragraphs
      return <p key={idx} style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '8px 0' }}>{line}</p>;
    });
  };
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: '#f9fafb',
          border: 'none',
          borderBottom: expanded ? '1px solid #e5e7eb' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#3b82f6" />
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            Full Market Research Memo
          </span>
        </div>
        {expanded ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
      </button>
      
      {expanded && (
        <div style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
          {renderMarkdown(markdown)}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const MarketResearchTab = ({ dealId, scenarioData }) => {
  const [status, setStatus] = useState(null);
  const [quickReport, setQuickReport] = useState(null);
  const [deepReport, setDeepReport] = useState(null);
  const [loading, setLoading] = useState({ status: true, quick: false, deep: false });
  const [error, setError] = useState(null);
  const [memoExpanded, setMemoExpanded] = useState(false);
  
  // Extract market info from scenario data
  const marketInfo = {
    address: scenarioData?.property?.address || '',
    city: scenarioData?.property?.city || '',
    state: scenarioData?.property?.state || '',
    zip: scenarioData?.property?.zip || '',
    propertyType: scenarioData?.property?.property_type || 'Multifamily'
  };
  
  const marketDisplay = [marketInfo.city, marketInfo.state, marketInfo.zip]
    .filter(Boolean)
    .join(', ') || 'Unknown Market';
  
  // Fetch status on mount
  useEffect(() => {
    if (dealId) {
      fetchStatus();
    }
  }, [dealId]);
  
  const fetchStatus = async () => {
    setLoading(prev => ({ ...prev, status: true }));
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8010/v2/deals/${dealId}/market_research/status`);
      const data = await response.json();
      
      if (response.ok) {
        setStatus(data);
        
        // If reports exist, fetch them
        if (data.quick?.exists || data.deep?.exists) {
          fetchReports();
        }
      } else {
        setError(data.detail || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };
  
  const fetchReports = async () => {
    try {
      const response = await fetch(`http://localhost:8010/v2/deals/${dealId}/market_research/reports`);
      const data = await response.json();
      
      if (response.ok && data.reports) {
        // Find latest quick and deep reports
        const quick = data.reports.find(r => r.tier === 'quick' && !r.error);
        const deep = data.reports.find(r => r.tier === 'deep' && !r.error);
        
        // Fetch full report details if found
        if (quick) {
          const qRes = await fetch(`http://localhost:8010/v2/deals/${dealId}/market_research/report/${quick.id}`);
          if (qRes.ok) {
            setQuickReport(await qRes.json());
          }
        }
        
        if (deep) {
          const dRes = await fetch(`http://localhost:8010/v2/deals/${dealId}/market_research/report/${deep.id}`);
          if (dRes.ok) {
            setDeepReport(await dRes.json());
          }
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };
  
  const runResearch = async (tier) => {
    // Check token balance first
    try {
      const operationType = tier === 'quick' ? 'market_research_results' : 'market_research_dashboard';
      const tokenCheck = await fetch('http://localhost:8010/api/tokens/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_type: operationType })
      });
      
      const tokenData = await tokenCheck.json();
      
      if (!tokenData.has_tokens) {
        const userConfirmed = window.confirm(
          `This will use AI to run ${tier === 'quick' ? 'Quick' : 'Deep'} Market Research.\n\n` +
          `Cost: ${tokenData.tokens_required} token\n` +
          `Your balance: ${tokenData.token_balance} tokens\n\n` +
          `You need more tokens. Check your Dashboard Profile to upgrade.`
        );
        return;
      }
      
      // Confirm token usage
      const userConfirmed = window.confirm(
        `This will use AI to run ${tier === 'quick' ? 'Quick' : 'Deep'} Market Research.\n\n` +
        `Cost: ${tokenData.tokens_required} token\n` +
        `Your balance: ${tokenData.token_balance} tokens\n\n` +
        `Continue?`
      );
      
      if (!userConfirmed) return;
      
    } catch (err) {
      console.error('Token check failed:', err);
      setError('Failed to check token balance. Please try again.');
      return;
    }
    
    setLoading(prev => ({ ...prev, [tier]: true }));
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8010/v2/deals/${dealId}/market_research/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, force_refresh: false })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (tier === 'quick') {
          setQuickReport(data);
        } else {
          setDeepReport(data);
        }
        // Refresh status
        fetchStatus();
      } else {
        setError(data.detail || `Failed to run ${tier} research`);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(prev => ({ ...prev, [tier]: false }));
    }
  };
  
  const formatTimestamp = (ts) => {
    if (!ts) return 'Never';
    try {
      const date = new Date(ts);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };
  
  // Render loading state
  if (loading.status && !status) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Loader size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading market research status...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <MapPin size={24} color="#3b82f6" />
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Market Research
          </h2>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          {marketDisplay}
        </p>
      </div>
      
      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: '13px', color: '#991b1b', flex: 1 }}>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Action Buttons Row */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {/* Quick Check Button */}
        <div style={{
          flex: '1',
          minWidth: '280px',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Zap size={20} color="#f59e0b" />
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
              Quick Market Check
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            Fast, structured snapshot using Perplexity Sonar. ~$0.01-0.05
          </p>
          {status?.quick?.exists && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              Last run: {formatTimestamp(status.quick.timestamp)} • Score: {status.quick.score}/100
            </div>
          )}
          <button
            onClick={() => runResearch('quick')}
            disabled={loading.quick}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: loading.quick ? '#d1d5db' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading.quick ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading.quick ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Running...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {status?.quick?.exists ? 'Refresh Quick Check' : 'Run Quick Check'}
              </>
            )}
          </button>
        </div>
        
        {/* Deep Research Button */}
        <div style={{
          flex: '1',
          minWidth: '280px',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FileText size={20} color="#3b82f6" />
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
              Deep Market Research
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            Institutional-grade IC memo using Perplexity Deep Research. ~$0.30-0.70
          </p>
          {status?.deep?.exists && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              Last run: {formatTimestamp(status.deep.timestamp)} • Score: {status.deep.score}/100 • Cost: ${status.deep.estimated_cost?.toFixed(2)}
            </div>
          )}
          <button
            onClick={() => runResearch('deep')}
            disabled={loading.deep}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: loading.deep ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading.deep ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading.deep ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Running Deep Research...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {status?.deep?.exists ? 'Refresh Deep Research' : 'Run Deep Research'}
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Results Section */}
      {(quickReport || deepReport) && (
        <>
          {/* Use deep report if available, otherwise quick */}
          {(() => {
            const report = deepReport || quickReport;
            const isDeep = !!deepReport;
            
            return (
              <>
                {/* Score Cards */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <ScoreCard 
                    label="Overall Score" 
                    score={report.scores?.overall} 
                    icon={BarChart3}
                    description="Market investability"
                  />
                  <ScoreCard 
                    label="Demand Score" 
                    score={report.scores?.demand} 
                    icon={TrendingUp}
                    description="Population & job growth"
                  />
                  <ScoreCard 
                    label="Supply Risk" 
                    score={report.scores?.supply_risk} 
                    icon={Building2}
                    description="New construction pressure"
                    inverted={true}
                  />
                  <ScoreCard 
                    label="Economic Resilience" 
                    score={report.scores?.economic_resilience} 
                    icon={Briefcase}
                    description="Diversification & stability"
                  />
                  <ScoreCard 
                    label="Landlord Friendliness" 
                    score={report.scores?.landlord_friendliness} 
                    icon={Shield}
                    description="Regulatory environment"
                  />
                </div>
                
                {/* Investability & Thesis */}
                {report.summary && (
                  <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <InvestabilityBadge investability={report.summary.investability} />
                      {report.summary.recommended_hold_period && (
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>
                          Recommended hold: <strong>{report.summary.recommended_hold_period} years</strong>
                        </span>
                      )}
                    </div>
                    {report.summary.thesis && (
                      <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: 0 }}>
                        {report.summary.thesis}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Bull/Bear Cases */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <BulletList 
                    title="Bull Case" 
                    items={report.summary?.bull_case} 
                    icon={TrendingUp}
                    positive={true}
                  />
                  <BulletList 
                    title="Bear Case / Risks" 
                    items={report.summary?.bear_case?.length ? report.summary.bear_case : report.summary?.top_risks} 
                    icon={TrendingDown}
                    positive={false}
                  />
                </div>
                
                {/* Key Metrics & Employers */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <KeyMetricsTable metrics={report.summary?.key_metrics} />
                  {report.summary?.key_metrics?.top_employers && (
                    <TopEmployersList employers={report.summary.key_metrics.top_employers} />
                  )}
                </div>
                
                {/* IC Recommendation (Deep only) */}
                {isDeep && report.ic_recommendation && (
                  <div style={{ marginBottom: '24px' }}>
                    <ICRecommendationCard recommendation={report.ic_recommendation} />
                  </div>
                )}
                
                {/* Full Memo (Deep only) */}
                {isDeep && report.memo_markdown && (
                  <MemoViewer 
                    markdown={report.memo_markdown}
                    expanded={memoExpanded}
                    onToggle={() => setMemoExpanded(!memoExpanded)}
                  />
                )}
              </>
            );
          })()}
        </>
      )}
      
      {/* Empty State */}
      {!quickReport && !deepReport && !loading.status && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <MapPin size={48} color="#d1d5db" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            No Market Research Yet
          </h3>
          <p style={{ fontSize: '13px', color: '#6b7280', maxWidth: '400px', margin: '0 auto' }}>
            Run a Quick Market Check for a fast overview, or Deep Research for an institutional-grade IC memo with citations.
          </p>
        </div>
      )}
    </div>
  );
};

export { MarketResearchTab };
export default MarketResearchTab;
