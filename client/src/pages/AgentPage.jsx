// AI Agents Page - Browser-Use Agent Configuration
// Matches the UI style of PipelinePage and EmailDealsPage
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  ArrowLeft,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Save,
  Play,
  Pause,
  Settings,
  DollarSign,
  Building2,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Search,
} from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../config/api';

// ============================================================================
// Constants
// ============================================================================

const PLATFORMS = [
  { id: 'crexi', name: 'Crexi', url: 'https://www.crexi.com', color: '#2563eb' },
  { id: 'zillow', name: 'Zillow', url: 'https://www.zillow.com', color: '#006aff' },
  { id: 'propstream', name: 'PropStream', url: 'https://www.propstream.com', color: '#0d9488' },
];

const PROPERTY_TYPES = [
  'Multifamily',
  'Self-Storage',
  'Mobile Home Park',
];

const SCHEDULE_OPTIONS = [
  { value: 1, label: '1x per week' },
  { value: 2, label: '2x per week' },
  { value: 3, label: '3x per week' },
  { value: 5, label: '5x per week' },
  { value: 7, label: 'Daily' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// ============================================================================
// Styles (matching Pipeline/EmailDeals pattern)
// ============================================================================

const cardStyle = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  border: '1px solid #e5e7eb',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '20px',
  cursor: 'pointer',
  userSelect: 'none',
};

const sectionTitleStyle = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#111827',
  margin: 0,
};

const sectionSubtitleStyle = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 0 auto',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  backgroundColor: '#f9fafb',
  color: '#111827',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: '600',
  color: '#374151',
  fontSize: '12px',
};

const buttonPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.15s',
  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
};

const buttonSecondary = {
  display: 'inline-flex',
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
  transition: 'background-color 0.15s',
};

const buttonDanger = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 18px',
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

const buttonSuccess = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 24px',
  backgroundColor: '#059669',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)',
};

const pillBadge = (active, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 14px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  border: active ? `2px solid ${color}` : '1px solid #d1d5db',
  backgroundColor: active ? `${color}18` : '#fff',
  color: active ? color : '#6b7280',
  transition: 'all 0.15s',
  userSelect: 'none',
});

const gridRow = (cols = 2) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: '16px',
  marginBottom: '16px',
});

// ============================================================================
// Stat Card Component (matches Pipeline page)
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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
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
// Platform Credential Card Component
// ============================================================================

const PlatformCredentialCard = ({ platform, credentials, onChange, onRemove }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '16px 20px',
      backgroundColor: '#fafbfc',
      marginBottom: '12px',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: platform.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{platform.name}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{platform.url}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {credentials.username && credentials.password && (
            <CheckCircle size={16} color="#059669" />
          )}
          {expanded ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Email / Username</label>
            <input
              type="text"
              placeholder={`Your ${platform.name} login email`}
              value={credentials.username || ''}
              onChange={(e) => onChange(platform.id, 'username', e.target.value)}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={`Your ${platform.name} password`}
                value={credentials.password || ''}
                onChange={(e) => onChange(platform.id, 'password', e.target.value)}
                style={{ ...inputStyle, paddingRight: '40px' }}
                onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: '#6b7280',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} color="#6b7280" />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Encrypted at rest — never stored in plaintext</span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(platform.id)}
              style={{ ...buttonDanger, padding: '6px 12px', fontSize: '11px' }}
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// AI Agent Page Component
// ============================================================================

function AgentPage() {
  const navigate = useNavigate();

  // Auth state
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Agent config state
  const [agentId, setAgentId] = useState(null);
  const [agentStatus, setAgentStatus] = useState('inactive'); // inactive, active, paused, running
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [lastRunAt, setLastRunAt] = useState(null);
  const [totalDealsFound, setTotalDealsFound] = useState(0);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState({
    credentials: true,
    buyBox: true,
    schedule: true,
  });

  // Platform credentials (only in state during this session, cleared on nav away)
  const [platformCredentials, setPlatformCredentials] = useState({});
  const [enabledPlatforms, setEnabledPlatforms] = useState([]);

  // Buy box parameters
  const [buyBox, setBuyBox] = useState({
    // Geography
    states: [],
    cities: '',
    zipCodes: '',
    // Property
    propertyTypes: [],
    // Price
    minPrice: '',
    maxPrice: '',
    // Cap Rate
    minCapRate: '',
    maxCapRate: '',
    // Units / Size
    minUnits: '',
    maxUnits: '',
    minSqft: '',
    maxSqft: '',
    // Occupancy
    minOccupancy: '',
    maxOccupancy: '',
    // Additional filters
    minYearBuilt: '',
    maxYearBuilt: '',
    keywords: '',
  });

  // Schedule
  const [runsPerWeek, setRunsPerWeek] = useState(1);

  // ============================================================================
  // Auth — Load current user
  // ============================================================================

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: userData, error } = await supabase.auth.getUser();
        if (error) throw error;
        const uid = userData?.user?.id || null;
        setUserId(uid);
        if (uid) {
          await loadAgentConfig(uid);
        }
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // ============================================================================
  // Load existing agent config from backend
  // ============================================================================

  const loadAgentConfig = async (uid) => {
    try {
      const resp = await fetch(API_ENDPOINTS.agentConfig, {
        headers: { 'X-User-ID': uid },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const cfg = data.config;
      if (!cfg) return;

      setAgentId(cfg.id);
      setAgentStatus(cfg.status || 'active');
      setLastRunAt(cfg.last_run_at || null);
      setRunsPerWeek(cfg.runs_per_week || 1);

      // Restore buy box
      const bb = cfg.buy_box || {};
      setBuyBox({
        states: bb.states || [],
        cities: (bb.cities || []).join(', '),
        zipCodes: (bb.zip_codes || []).join(', '),
        propertyTypes: bb.property_types || [],
        minPrice: bb.min_price ? String(bb.min_price) : '',
        maxPrice: bb.max_price ? String(bb.max_price) : '',
        minCapRate: bb.min_cap_rate ? String(bb.min_cap_rate) : '',
        maxCapRate: bb.max_cap_rate ? String(bb.max_cap_rate) : '',
        minOccupancy: bb.min_occupancy ? String(bb.min_occupancy) : '',
        maxOccupancy: bb.max_occupancy ? String(bb.max_occupancy) : '',
        minUnits: bb.min_units ? String(bb.min_units) : '',
        maxUnits: bb.max_units ? String(bb.max_units) : '',
        minSqft: bb.min_sqft ? String(bb.min_sqft) : '',
        maxSqft: bb.max_sqft ? String(bb.max_sqft) : '',
        minYearBuilt: bb.min_year_built ? String(bb.min_year_built) : '',
        maxYearBuilt: bb.max_year_built ? String(bb.max_year_built) : '',
        keywords: (bb.keywords || []).join(', '),
      });

      // Restore enabled platforms (credentials are NOT returned — only platform IDs)
      const platforms = cfg.platforms || [];
      const enabledIds = platforms.map((p) => p.platform_id);
      setEnabledPlatforms(enabledIds);
      const creds = {};
      enabledIds.forEach((pid) => {
        creds[pid] = { username: '', password: '' };
      });
      setPlatformCredentials(creds);

      // Load deals count from recent runs
      try {
        const runsResp = await fetch(`${API_ENDPOINTS.agentRuns}?agent_id=${cfg.id}`, {
          headers: { 'X-User-ID': uid },
        });
        if (runsResp.ok) {
          const runsData = await runsResp.json();
          const total = (runsData.runs || []).reduce((sum, r) => sum + (r.deals_found || 0), 0);
          setTotalDealsFound(total);
        }
      } catch (_) { /* ignore */ }

    } catch (err) {
      console.error('Error loading agent config:', err);
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCredentialChange = (platformId, field, value) => {
    setPlatformCredentials((prev) => ({
      ...prev,
      [platformId]: { ...(prev[platformId] || {}), [field]: value },
    }));
  };

  const handleAddPlatform = (platformId) => {
    if (!enabledPlatforms.includes(platformId)) {
      setEnabledPlatforms((prev) => [...prev, platformId]);
      setPlatformCredentials((prev) => ({
        ...prev,
        [platformId]: { username: '', password: '' },
      }));
    }
  };

  const handleRemovePlatform = (platformId) => {
    setEnabledPlatforms((prev) => prev.filter((id) => id !== platformId));
    setPlatformCredentials((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  };

  const handleBuyBoxChange = (field, value) => {
    setBuyBox((prev) => ({ ...prev, [field]: value }));
  };

  const togglePropertyType = (type) => {
    setBuyBox((prev) => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(type)
        ? prev.propertyTypes.filter((t) => t !== type)
        : [...prev.propertyTypes, type],
    }));
  };

  const toggleState = (st) => {
    setBuyBox((prev) => ({
      ...prev,
      states: prev.states.includes(st)
        ? prev.states.filter((s) => s !== st)
        : [...prev.states, st],
    }));
  };

  // ============================================================================
  // Save handler (no backend yet — just shows confirmation)
  // ============================================================================

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      // Build payload
      const payload = {
        platforms: enabledPlatforms.map((pid) => ({
          platform_id: pid,
          username: platformCredentials[pid]?.username || '',
          password: platformCredentials[pid]?.password || '',
        })),
        buy_box: {
          states: buyBox.states,
          cities: buyBox.cities ? buyBox.cities.split(',').map((c) => c.trim()).filter(Boolean) : [],
          zip_codes: buyBox.zipCodes ? buyBox.zipCodes.split(',').map((z) => z.trim()).filter(Boolean) : [],
          property_types: buyBox.propertyTypes,
          min_price: buyBox.minPrice ? parseInt(buyBox.minPrice.replace(/[^0-9]/g, '')) : null,
          max_price: buyBox.maxPrice ? parseInt(buyBox.maxPrice.replace(/[^0-9]/g, '')) : null,
          min_cap_rate: buyBox.minCapRate ? parseFloat(buyBox.minCapRate) : null,
          max_cap_rate: buyBox.maxCapRate ? parseFloat(buyBox.maxCapRate) : null,
          min_occupancy: buyBox.minOccupancy ? parseFloat(buyBox.minOccupancy) : null,
          max_occupancy: buyBox.maxOccupancy ? parseFloat(buyBox.maxOccupancy) : null,
          min_units: buyBox.minUnits ? parseInt(buyBox.minUnits) : null,
          max_units: buyBox.maxUnits ? parseInt(buyBox.maxUnits) : null,
          min_sqft: buyBox.minSqft ? parseInt(buyBox.minSqft.replace(/[^0-9]/g, '')) : null,
          max_sqft: buyBox.maxSqft ? parseInt(buyBox.maxSqft.replace(/[^0-9]/g, '')) : null,
          min_year_built: buyBox.minYearBuilt ? parseInt(buyBox.minYearBuilt) : null,
          max_year_built: buyBox.maxYearBuilt ? parseInt(buyBox.maxYearBuilt) : null,
          keywords: buyBox.keywords ? buyBox.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
        },
        runs_per_week: runsPerWeek,
      };

      let resp;
      if (agentId) {
        // Update existing config
        resp = await fetch(API_ENDPOINTS.agentConfigById(agentId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new config
        resp = await fetch(API_ENDPOINTS.agentConfig, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
          body: JSON.stringify(payload),
        });
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }

      const result = await resp.json();
      if (result.id) {
        setAgentId(result.id);
        setAgentStatus(result.status || 'active');
      }

      setSaveMessage('Agent configuration saved successfully');
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      console.error('Error saving agent config:', err);
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Run Now handler
  // ============================================================================

  const handleRunNow = async () => {
    if (!agentId) {
      setSaveMessage('Save your configuration first before running');
      return;
    }
    try {
      setAgentStatus('running');
      const resp = await fetch(API_ENDPOINTS.agentRun(agentId), {
        method: 'POST',
        headers: { 'X-User-ID': userId },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      setSaveMessage(`Agent run started (${data.dispatch || 'queued'})`);
      setTimeout(() => setSaveMessage(''), 4000);
      // Refresh config to update last_run_at after a delay
      setTimeout(() => loadAgentConfig(userId), 5000);
    } catch (err) {
      console.error('Error triggering run:', err);
      setAgentStatus('active');
      setSaveMessage(`Run failed: ${err.message}`);
    }
  };

  // ============================================================================
  // Pause / Resume handler
  // ============================================================================

  const handleTogglePause = async () => {
    if (!agentId) return;
    try {
      const isPaused = agentStatus === 'paused';
      const url = isPaused ? API_ENDPOINTS.agentResume(agentId) : API_ENDPOINTS.agentPause(agentId);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'X-User-ID': userId },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      setAgentStatus(data.status || (isPaused ? 'active' : 'paused'));
    } catch (err) {
      console.error('Error toggling pause:', err);
      setSaveMessage(`Error: ${err.message}`);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <DashboardShell activeTab="agents" title="AI Agents">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
          <Loader2 size={28} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ marginLeft: '12px', color: '#6b7280', fontSize: '14px' }}>Loading...</span>
        </div>
      </DashboardShell>
    );
  }

  if (!userId) {
    return (
      <DashboardShell activeTab="agents" title="AI Agents">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <AlertCircle size={44} color="#dc2626" style={{ marginBottom: '14px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Sign in required
          </h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Please sign in to configure your AI agent.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeTab="agents" title="AI Agents">
      {/* ================================================================ */}
      {/* Page Header — matches Pipeline style */}
      {/* ================================================================ */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e6e9ef', padding: '16px 0', marginBottom: '24px', borderRadius: '8px 8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', backgroundColor: 'transparent',
                border: '1px solid #e6e9ef', borderRadius: '8px',
                color: '#323338', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f7fb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#323338', letterSpacing: '-0.3px' }}>
                AI Deal Finder Agent
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#676879', fontWeight: '400' }}>
                Configure your automated deal-searching agent to scan Crexi, Zillow &amp; PropStream
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '999px',
              backgroundColor: agentStatus === 'active' ? '#dcfce7' : agentStatus === 'running' ? '#dbeafe' : agentStatus === 'paused' ? '#e0f2fe' : '#f3f4f6',
              border: `1px solid ${agentStatus === 'active' ? '#86efac' : agentStatus === 'running' ? '#93c5fd' : agentStatus === 'paused' ? '#7dd3fc' : '#e5e7eb'}`,
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: agentStatus === 'active' ? '#059669' : agentStatus === 'running' ? '#2563eb' : agentStatus === 'paused' ? '#0284c7' : '#9ca3af',
                ...(agentStatus === 'running' ? { animation: 'pulse 1.5s infinite' } : {}),
              }} />
              <span style={{
                fontSize: '12px', fontWeight: '600',
                color: agentStatus === 'active' ? '#059669' : agentStatus === 'running' ? '#2563eb' : agentStatus === 'paused' ? '#0284c7' : '#6b7280',
                textTransform: 'capitalize',
              }}>
                {agentStatus === 'inactive' ? 'Not Configured' : agentStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Toast */}
      {saveMessage && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 20px', borderRadius: '8px',
          backgroundColor: saveMessage.includes('Error') ? '#ef4444' : '#059669',
          color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px', fontWeight: '600',
        }}>
          {saveMessage.includes('Error') ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {saveMessage}
        </div>
      )}

      {/* ================================================================ */}
      {/* Stat Cards Row */}
      {/* ================================================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Agent Status" value={agentStatus === 'inactive' ? 'Setup' : agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)} icon={Bot} color="#2563eb" />
        <StatCard label="Runs / Week" value={runsPerWeek} icon={Clock} color="#0891b2" />
        <StatCard label="Deals Found" value={totalDealsFound} icon={Building2} color="#059669" />
        <StatCard label="Platforms" value={enabledPlatforms.length} icon={Globe} color="#0891b2" />
      </div>

      {/* ================================================================ */}
      {/* Section 1: Platform Credentials */}
      {/* ================================================================ */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div
          style={sectionHeaderStyle}
          onClick={() => toggleSection('credentials')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={16} color="#2563eb" />
          </div>
          <h2 style={sectionTitleStyle}>Platform Credentials</h2>
          <span style={sectionSubtitleStyle}>
            {enabledPlatforms.length} platform{enabledPlatforms.length !== 1 ? 's' : ''} configured
          </span>
          {expandedSections.credentials ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
        </div>

        {expandedSections.credentials && (
          <div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
              Enter your login credentials for each platform. These are encrypted at rest and used only by the agent to log in and search on your behalf.
            </p>

            {/* Enabled platforms */}
            {enabledPlatforms.map((pid) => {
              const platform = PLATFORMS.find((p) => p.id === pid);
              if (!platform) return null;
              return (
                <PlatformCredentialCard
                  key={pid}
                  platform={platform}
                  credentials={platformCredentials[pid] || {}}
                  onChange={handleCredentialChange}
                  onRemove={handleRemovePlatform}
                />
              );
            })}

            {/* Add platform buttons */}
            {PLATFORMS.filter((p) => !enabledPlatforms.includes(p.id)).length > 0 && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                {PLATFORMS.filter((p) => !enabledPlatforms.includes(p.id)).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPlatform(p.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '10px 18px', borderRadius: '8px',
                      border: '2px dashed #d1d5db', backgroundColor: '#fff',
                      color: '#374151', fontSize: '13px', fontWeight: '600',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.color = p.color; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151'; }}
                  >
                    <Plus size={16} />
                    Add {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 2: Buy Box Parameters */}
      {/* ================================================================ */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div
          style={sectionHeaderStyle}
          onClick={() => toggleSection('buyBox')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Search size={16} color="#059669" />
          </div>
          <h2 style={sectionTitleStyle}>Buy Box Parameters</h2>
          <span style={sectionSubtitleStyle}>
            {buyBox.propertyTypes.length} type{buyBox.propertyTypes.length !== 1 ? 's' : ''} selected
          </span>
          {expandedSections.buyBox ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
        </div>

        {expandedSections.buyBox && (
          <div>
            {/* ---- Geography ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <MapPin size={14} color="#059669" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Geography</span>
              </div>

              {/* States multi-select pills */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Target States</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {US_STATES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleState(st)}
                      style={pillBadge(buyBox.states.includes(st), '#059669')}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {buyBox.states.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                    {buyBox.states.length} state{buyBox.states.length !== 1 ? 's' : ''} selected: {buyBox.states.join(', ')}
                  </div>
                )}
              </div>

              <div style={gridRow(2)}>
                <div>
                  <label style={labelStyle}>Cities (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dallas, Houston, Austin"
                    value={buyBox.cities}
                    onChange={(e) => handleBuyBoxChange('cities', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Zip Codes (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. 75201, 77001, 78701"
                    value={buyBox.zipCodes}
                    onChange={(e) => handleBuyBoxChange('zipCodes', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>

            {/* ---- Property Type ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Building2 size={14} color="#2563eb" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Property Type</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PROPERTY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePropertyType(type)}
                    style={pillBadge(buyBox.propertyTypes.includes(type), '#2563eb')}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Price Range ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <DollarSign size={14} color="#2563eb" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price Range</span>
              </div>
              <div style={gridRow(2)}>
                <div>
                  <label style={labelStyle}>Min Price ($)</label>
                  <input
                    type="text"
                    placeholder="e.g. 500,000"
                    value={buyBox.minPrice}
                    onChange={(e) => handleBuyBoxChange('minPrice', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Price ($)</label>
                  <input
                    type="text"
                    placeholder="e.g. 5,000,000"
                    value={buyBox.maxPrice}
                    onChange={(e) => handleBuyBoxChange('maxPrice', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>

            {/* ---- Cap Rate ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <TrendingUp size={14} color="#dc2626" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cap Rate</span>
              </div>
              <div style={gridRow(2)}>
                <div>
                  <label style={labelStyle}>Min Cap Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 5.0"
                    value={buyBox.minCapRate}
                    onChange={(e) => handleBuyBoxChange('minCapRate', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#dc2626'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Cap Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 10.0"
                    value={buyBox.maxCapRate}
                    onChange={(e) => handleBuyBoxChange('maxCapRate', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#dc2626'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>

            {/* ---- Units / Size ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Building2 size={14} color="#0891b2" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Size &amp; Units</span>
              </div>
              <div style={gridRow(4)}>
                <div>
                  <label style={labelStyle}>Min Units</label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={buyBox.minUnits}
                    onChange={(e) => handleBuyBoxChange('minUnits', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#0891b2'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Units</label>
                  <input
                    type="number"
                    placeholder="e.g. 200"
                    value={buyBox.maxUnits}
                    onChange={(e) => handleBuyBoxChange('maxUnits', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#0891b2'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Min Sq Ft</label>
                  <input
                    type="text"
                    placeholder="e.g. 5,000"
                    value={buyBox.minSqft}
                    onChange={(e) => handleBuyBoxChange('minSqft', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#0891b2'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Sq Ft</label>
                  <input
                    type="text"
                    placeholder="e.g. 100,000"
                    value={buyBox.maxSqft}
                    onChange={(e) => handleBuyBoxChange('maxSqft', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#0891b2'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>

            {/* ---- Occupancy % ---- */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <TrendingUp size={14} color="#059669" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Occupancy %</span>
              </div>
              <div style={gridRow(2)}>
                <div>
                  <label style={labelStyle}>Min Occupancy (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g. 85"
                    value={buyBox.minOccupancy}
                    onChange={(e) => handleBuyBoxChange('minOccupancy', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Occupancy (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g. 100"
                    value={buyBox.maxOccupancy}
                    onChange={(e) => handleBuyBoxChange('maxOccupancy', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>

            {/* ---- Additional Filters ---- */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Settings size={14} color="#6b7280" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Additional Filters</span>
              </div>
              <div style={gridRow(3)}>
                <div>
                  <label style={labelStyle}>Min Year Built</label>
                  <input
                    type="number"
                    placeholder="e.g. 1980"
                    value={buyBox.minYearBuilt}
                    onChange={(e) => handleBuyBoxChange('minYearBuilt', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6b7280'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Year Built</label>
                  <input
                    type="number"
                    placeholder="e.g. 2020"
                    value={buyBox.maxYearBuilt}
                    onChange={(e) => handleBuyBoxChange('maxYearBuilt', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6b7280'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Keywords (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. value-add, distressed, off-market"
                    value={buyBox.keywords}
                    onChange={(e) => handleBuyBoxChange('keywords', e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6b7280'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 3: Schedule */}
      {/* ================================================================ */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div
          style={sectionHeaderStyle}
          onClick={() => toggleSection('schedule')}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#ecfdf5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={16} color="#059669" />
          </div>
          <h2 style={sectionTitleStyle}>Run Schedule</h2>
          <span style={sectionSubtitleStyle}>
            {SCHEDULE_OPTIONS.find((o) => o.value === runsPerWeek)?.label || `${runsPerWeek}x/week`}
          </span>
          {expandedSections.schedule ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
        </div>

        {expandedSections.schedule && (
          <div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
              Choose how often the agent runs per week. Each run searches all enabled platforms using your buy box criteria.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {SCHEDULE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRunsPerWeek(opt.value)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: runsPerWeek === opt.value ? '2px solid #059669' : '1px solid #e5e7eb',
                    backgroundColor: runsPerWeek === opt.value ? '#ecfdf5' : '#fff',
                    color: runsPerWeek === opt.value ? '#059669' : '#374151',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    minWidth: '120px',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => { if (runsPerWeek !== opt.value) e.currentTarget.style.borderColor = '#6ee7b7'; }}
                  onMouseLeave={(e) => { if (runsPerWeek !== opt.value) e.currentTarget.style.borderColor = '#e5e7eb'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {lastRunAt && (
              <div style={{ marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
                Last run: {new Date(lastRunAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Action Buttons */}
      {/* ================================================================ */}
      <div style={{
        ...cardStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...buttonPrimary,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleRunNow}
            disabled={enabledPlatforms.length === 0 || !agentId}
            style={{
              ...buttonSuccess,
              opacity: (enabledPlatforms.length === 0 || !agentId) ? 0.5 : 1,
              cursor: (enabledPlatforms.length === 0 || !agentId) ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={16} />
            Run Now
          </button>
          {agentStatus === 'active' && (
            <button
              onClick={handleTogglePause}
              style={buttonSecondary}
            >
              <Pause size={16} />
              Pause Agent
            </button>
          )}
          {agentStatus === 'paused' && (
            <button
              onClick={handleTogglePause}
              style={buttonSecondary}
            >
              <Play size={16} />
              Resume Agent
            </button>
          )}
        </div>

        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {enabledPlatforms.length === 0
            ? 'Add at least one platform to get started'
            : `Agent will search ${enabledPlatforms.length} platform${enabledPlatforms.length !== 1 ? 's' : ''}, ${runsPerWeek}x per week`}
        </div>
      </div>

      {/* Inline keyframes for spinner */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </DashboardShell>
  );
}

export default AgentPage;
