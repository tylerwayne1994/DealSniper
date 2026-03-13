import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Building2,
  TrendingUp,
  Clock,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../config/api';
import DashboardShell from '../components/DashboardShell';

function EmailUnderwritePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [dealsById, setDealsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [deleting, setDeleting] = useState(null); // job id being deleted, or 'all'
  const [aliases, setAliases] = useState([]);
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [aliasLoading, setAliasLoading] = useState(false);
  const [parsingJobId, setParsingJobId] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [debugResult, setDebugResult] = useState(null);
  const [debugging, setDebugging] = useState(false);
  const [resettingJobs, setResettingJobs] = useState(false);

  const handleResetStuckJobs = async () => {
    setResettingJobs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/reset-stuck-jobs`, { method: 'POST' });
      const data = await res.json();
      setSyncMessage(`Reset ${data.reset_count || 0} stuck jobs. They will be retried on next sync.`);
      setTimeout(() => loadPipeline(), 1000);
    } catch (err) {
      setSyncMessage('Reset error: ' + err.message);
    } finally {
      setResettingJobs(false);
    }
  };

  const handleSyncAndProcess = async () => {
    setSyncing(true);
    setSyncMessage('Starting sync...');
    try {
      // Fire off sync (returns immediately — work happens in background)
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/force-sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'running') {
        setSyncMessage('Sync already in progress...');
      } else {
        setSyncMessage('Sync started! Processing emails in background...');
      }
      // Poll for results every 4 seconds
      let polls = 0;
      const maxPolls = 45; // ~3 minutes
      const pollId = setInterval(async () => {
        polls++;
        try {
          const pollRes = await fetch(`${API_BASE_URL}/api/email-underwrite/force-sync/result`);
          const pollData = await pollRes.json();
          if (pollData.status === 'done' || pollData.status === 'error') {
            clearInterval(pollId);
            setSyncing(false);
            if (pollData.status === 'done') {
              const s = pollData.sync || {};
              const parts = [];
              parts.push(`Synced: ${s.synced || 0} new, ${s.already_known || 0} known`);
              if (pollData.reset_stuck) parts.push(`Reset ${pollData.reset_stuck} stuck`);
              if (pollData.orphans_created) parts.push(`Recovered ${pollData.orphans_created} orphans`);
              parts.push(`Processed: ${pollData.jobs_processed || 0} jobs, ${pollData.jobs_errors || 0} errors`);
              setSyncMessage(`Done! ${parts.join('. ')}.`);
            } else {
              setSyncMessage(`Sync error: ${pollData.error || 'unknown'}`);
            }
            loadPipeline();
          } else if (pollData.status === 'running') {
            setSyncMessage(`Syncing & processing... (${polls * 4}s elapsed)`);
            loadPipeline(); // refresh table while processing
          }
        } catch (e) {
          // polling error, keep trying
        }
        if (polls >= maxPolls) {
          clearInterval(pollId);
          setSyncing(false);
          setSyncMessage('Sync may still be running in background. Refresh to check.');
          loadPipeline();
        }
      }, 4000);
    } catch (err) {
      console.error('Force sync error:', err);
      setSyncMessage('Sync error: ' + err.message);
      setSyncing(false);
    }
  };

  const handleDebugPipeline = async () => {
    setDebugging(true);
    setDebugResult(null);
    try {
      // Fire off diagnostics (returns immediately)
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/debug-pipeline`);
      const data = await res.json();
      if (data.status === 'started' || data.status === 'running') {
        setDebugResult({ status: 'running', log: ['Diagnostics started...'] });
        // Poll for results
        let polls = 0;
        const pollId = setInterval(async () => {
          polls++;
          try {
            const pollRes = await fetch(`${API_BASE_URL}/api/email-underwrite/debug-pipeline/result`);
            const pollData = await pollRes.json();
            if (pollData.status && pollData.status !== 'running') {
              clearInterval(pollId);
              setDebugResult(pollData);
              setDebugging(false);
            } else {
              setDebugResult({ status: 'running', log: [`Diagnosing... (${polls * 3}s)`] });
            }
          } catch (e) {
            // keep polling
          }
          if (polls >= 60) { // ~3 minutes
            clearInterval(pollId);
            setDebugResult({ error: 'Diagnostics timed out. Check server logs.' });
            setDebugging(false);
          }
        }, 3000);
      } else {
        // Direct result (unlikely but handle it)
        setDebugResult(data);
        setDebugging(false);
      }
    } catch (err) {
      setDebugResult({ error: err.message });
      setDebugging(false);
    }
  };

  const checkPipelineStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/pipeline-status`);
      const data = await res.json();
      setPipelineStatus(data);
    } catch (err) {
      console.error('Pipeline status error:', err);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!userId) return;
    if (!window.confirm('Delete this email job?')) return;
    setDeleting(jobId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': userId },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Delete failed');
      }
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!userId) return;
    if (!window.confirm(`Delete all ${jobs.length} email jobs? This cannot be undone.`)) return;
    setDeleting('all');
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/jobs`, {
        method: 'DELETE',
        headers: { 'X-User-ID': userId },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Delete failed');
      }
      setJobs([]);
      setDealsById({});
    } catch (err) {
      console.error('Delete all error:', err);
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const loadAliases = async (uid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/aliases`, {
        headers: { 'X-User-ID': uid },
      });
      if (res.ok) {
        const data = await res.json();
        setAliases(data.aliases || []);
        setPrimaryEmail(data.primary_email || '');
      }
    } catch (err) {
      console.error('Failed to load aliases:', err);
    }
  };

  const handleAddAlias = async () => {
    if (!userId || !newAlias.trim()) return;
    setAliasLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ email: newAlias.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add alias');
      setAliases(data.aliases || []);
      setNewAlias('');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setAliasLoading(false);
    }
  };

  const handleRemoveAlias = async (email) => {
    if (!userId) return;
    setAliasLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/aliases`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove alias');
      setAliases(data.aliases || []);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setAliasLoading(false);
    }
  };

  useEffect(() => {
    let pollTimer = null;

    const loadData = async () => {
      try {
        if (!loading) {
          // Don't reset loading state on poll refreshes (only initial load)
        } else {
          setError('');
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const uid = userData?.user?.id;
        if (!uid) {
          setJobs([]);
          return;
        }
        setUserId(uid);
        // Only load aliases on first load
        if (!pollTimer) {
          loadAliases(uid);
          // Use auth email as fallback for display if profile email not set
          if (userData?.user?.email) {
            setPrimaryEmail(prev => prev || userData.user.email);
          }
        }

        const { data: jobRows, error: jobsError } = await supabase
          .from('email_underwrite_jobs')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;

        setJobs(jobRows || []);

        const dealIds = (jobRows || [])
          .map(j => j.deal_id)
          .filter(id => !!id);

        if (dealIds.length > 0) {
          const { data: dealRows, error: dealsError } = await supabase
            .from('deals')
            .select(`
              deal_id,
              address,
              units,
              purchase_price,
              deal_structure,
              pipeline_status,
              created_at,
              market_cap_rate,
              scenario_data,
              parsed_data
            `)
            .in('deal_id', dealIds);

          if (dealsError) throw dealsError;

          const map = {};
          (dealRows || []).forEach(d => {
            map[d.deal_id] = d;
          });
          setDealsById(map);
        } else {
          setDealsById({});
        }
      } catch (err) {
        console.error('Error loading email underwrite pipeline:', err);
        if (loading) setError(err.message || 'Failed to load email underwrite pipeline');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    checkPipelineStatus();

    // Auto-refresh every 30 seconds to pick up background pipeline results
    pollTimer = setInterval(loadData, 30000);
    return () => clearInterval(pollTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // loadPipeline alias for force-sync callback
  const loadPipeline = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      const { data: jobRows } = await supabase
        .from('email_underwrite_jobs')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      setJobs(jobRows || []);

      const dealIds = (jobRows || []).map(j => j.deal_id).filter(Boolean);
      if (dealIds.length > 0) {
        const { data: dealRows } = await supabase
          .from('deals')
          .select('deal_id, address, units, purchase_price, deal_structure, pipeline_status, created_at, market_cap_rate, scenario_data, parsed_data')
          .in('deal_id', dealIds);
        const map = {};
        (dealRows || []).forEach(d => { map[d.deal_id] = d; });
        setDealsById(map);
      }
    } catch (err) {
      console.error('loadPipeline error:', err);
    }
  };

  const totalJobs = jobs.length;

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.12)',
    border: '1px solid #e5e7eb',
  };

  const statValueStyle = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  };

  const statLabelStyle = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6b7280',
    fontWeight: 600,
  };

  const renderStatusBadge = (status, parsedStatus, isFullyParsed) => {
    const normalized = (status || 'pending').toLowerCase();
    let bg = '#e5e7eb';
    let color = '#111827';
    let label = normalized;

    if (isFullyParsed) {
      // Deal has real data — it's been underwritten regardless of job status
      bg = '#dcfce7';
      color = '#15803d';
      label = 'Underwritten';
    } else if (normalized === 'processing') {
      bg = '#fef3c7';
      color = '#92400e';
      label = '⏳ Parsing OM...';
    } else if (normalized === 'pending') {
      bg = '#dbeafe';
      color = '#1d4ed8';
      label = 'In Queue';
    } else if (normalized === 'done' && parsedStatus === 'no_attachment') {
      bg = '#fef3c7';
      color = '#92400e';
      label = 'No Attachment';
    } else if (normalized === 'done') {
      bg = '#fef3c7';
      color = '#92400e';
      label = '⏳ Parsing OM...';
    } else if (normalized === 'error') {
      bg = '#fee2e2';
      color = '#b91c1c';
      label = 'Error';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: bg,
          color,
        }}
      >
        {label}
      </span>
    );
  };

  const rows = jobs.map(job => {
    const deal = job.deal_id ? dealsById[job.deal_id] : null;
    const scenarioCalculations = deal?.scenario_data?.calculations || {};
    const parsedStatus = deal?.parsed_data?.status;
    // Check multiple signals: parsed_data.property exists, OR deal has actual units/price data
    const hasParsedProperty = deal?.parsed_data?.property != null;
    const hasRealData = (deal?.units != null && deal?.units > 0) || (deal?.purchase_price != null && deal?.purchase_price > 0);
    const isFullyParsed = hasParsedProperty || hasRealData;

    return {
      id: job.id,
      status: job.status,
      subject: job.subject || '(no subject)',
      from: job.from_address,
      createdAt: job.created_at,
      dealId: job.deal_id,
      errorMessage: job.error_message || null,
      address: deal?.address || 'Processing...',
      units: deal?.units || null,
      purchasePrice: deal?.purchase_price || null,
      stage: deal?.pipeline_status || null,
      capRate: deal?.market_cap_rate || null,
      dayOneCashFlow: scenarioCalculations.dayOneCashFlow || null,
      stabilizedCashFlow: scenarioCalculations.stabilizedCashFlow || null,
      refiValue: scenarioCalculations.refiValue || null,
      needsParse: !isFullyParsed,
      parsedStatus: parsedStatus || null,
      isFullyParsed,
    };
  });

  // Counts that depend on rows (computed after rows)
  const completedJobs = rows.filter(r => r.isFullyParsed).length;
  const inProgressJobs = rows.filter(r => !r.isFullyParsed && r.status !== 'error').length;

  const handleViewUnderwrite = async (jobId, dealId, needsParse) => {
    if (!needsParse) {
      navigate(`/underwrite?viewDeal=${dealId}&source=email`);
      return;
    }

    // Need to parse the OM attachment first
    setParsingJobId(jobId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-underwrite/parse-om/${jobId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Parse failed');

      console.log('[PARSE-OM] Result:', data);
      navigate(`/underwrite?viewDeal=${dealId}&source=email`);
    } catch (err) {
      console.error('Parse OM error:', err);
      alert('Failed to parse OM: ' + err.message);
    } finally {
      setParsingJobId(null);
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    const num = Number(val);
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
    return '$' + num.toLocaleString();
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <DashboardShell activeTab="email-underwrite" title="Email Underwrite">
      <div style={{ backgroundColor: '#1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
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
                letterSpacing: '0.5px',
              }}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>

            <div
              style={{
                padding: '14px 20px',
                color: '#f0fdfa',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Mail size={16} />
              Email Underwrite Pipeline
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '24px auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '20px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={20} color="#2563eb" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Email Underwrite Pipeline</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  Forward OMs, T12s, and rent rolls and DealSniper will auto-underwrite them into your pipeline.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '8px', fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>
              <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>
                  Send or forward your broker emails with OMs, T12s, and rent rolls to:
                  <br />
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>deals@dealsniper.org</strong>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>(instant processing)</span>
                </li>
                <li>
                  Send from the <strong>same email you signed up with</strong> (or add aliases below) so we can match it to your account.
                </li>
                <li>
                  We automatically parse the attachments, run the underwriter, and push the deal into your pipeline.
                </li>
              </ol>

              {/* Email Aliases Section */}
              <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Linked Sender Emails
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  {primaryEmail ? (
                    <span>Primary: <strong>{primaryEmail}</strong></span>
                  ) : (
                    <span>Primary email not set on profile</span>
                  )}
                </div>
                {aliases.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {aliases.map((alias) => (
                      <span
                        key={alias}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {alias}
                        <button
                          onClick={() => handleRemoveAlias(alias)}
                          disabled={aliasLoading}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0369a1',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '14px',
                            lineHeight: 1,
                          }}
                          title="Remove alias"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="email"
                    placeholder="Add another sending email..."
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddAlias}
                    disabled={aliasLoading || !newAlias.trim()}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: aliasLoading || !newAlias.trim() ? '#94a3b8' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: aliasLoading || !newAlias.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleSyncAndProcess}
                  disabled={syncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: syncing ? '#94a3b8' : '#0d9488',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: syncing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Force Sync Now'}
                </button>
                <button
                  onClick={handleDebugPipeline}
                  disabled={debugging}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: debugging ? '#94a3b8' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: debugging ? 'not-allowed' : 'pointer',
                  }}
                >
                  <AlertTriangle size={14} />
                  {debugging ? 'Diagnosing...' : 'Diagnose Pipeline'}
                </button>
                <button
                  onClick={handleResetStuckJobs}
                  disabled={resettingJobs}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: resettingJobs ? '#94a3b8' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: resettingJobs ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                  {resettingJobs ? 'Resetting...' : 'Reset Stuck Jobs'}
                </button>
                {syncMessage && (
                  <span style={{ fontSize: '12px', color: syncMessage.startsWith('Error') || syncMessage.startsWith('Sync error') ? '#b91c1c' : '#15803d' }}>
                    {syncMessage}
                  </span>
                )}
              </div>

              {/* Pipeline Status */}
              {pipelineStatus && (
                <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: pipelineStatus.running ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', border: `1px solid ${pipelineStatus.running ? '#bbf7d0' : '#fecaca'}`, fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: pipelineStatus.running ? '#166534' : '#991b1b' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pipelineStatus.running ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                    Background Worker: {pipelineStatus.running ? 'RUNNING' : 'STOPPED'}
                  </div>
                  {pipelineStatus.last_run_time && (
                    <div style={{ color: '#64748b', marginTop: '4px' }}>
                      Last run: {new Date(pipelineStatus.last_run_time).toLocaleString()} — Result: {pipelineStatus.last_run_result || 'unknown'}
                    </div>
                  )}
                </div>
              )}

              {/* Debug Results */}
              {debugResult && (
                <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px', color: '#e2e8f0', maxHeight: '400px', overflow: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px', color: '#f59e0b', fontSize: '13px' }}>Pipeline Diagnostic Results</div>
                  {debugResult.error && <div style={{ color: '#ef4444', fontWeight: 600 }}>Error: {debugResult.error}</div>}
                  {debugResult.status && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ padding: '6px 10px', backgroundColor: '#334155', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Total Emails (7d)</div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{debugResult.total_emails_7d}</div>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#334155', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>New Unprocessed</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: debugResult.new_unprocessed > 0 ? '#f59e0b' : '#e2e8f0' }}>{debugResult.new_unprocessed}</div>
                      </div>
                      <div style={{ padding: '6px 10px', backgroundColor: '#334155', borderRadius: '6px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Matched to User</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: debugResult.matched_to_user > 0 ? '#22c55e' : '#e2e8f0' }}>{debugResult.matched_to_user}</div>
                      </div>
                    </div>
                  )}
                  {debugResult.unmatched_details && debugResult.unmatched_details.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>Unmatched Senders (emails from unknown addresses):</div>
                      {debugResult.unmatched_details.map((em, i) => (
                        <div key={i} style={{ color: '#fca5a5', padding: '2px 0' }}>
                          • {em.sender_email} — "{em.subject}"
                        </div>
                      ))}
                      <div style={{ color: '#94a3b8', marginTop: '4px', fontSize: '11px' }}>
                        Add these emails as aliases above, or send from your registered email.
                      </div>
                    </div>
                  )}
                  {debugResult.log && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>Full Debug Log ({debugResult.log.length} entries)</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', color: '#94a3b8', marginTop: '6px', maxHeight: '200px', overflow: 'auto' }}>
                        {debugResult.log.join('\n')}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={statLabelStyle}>Total Email Jobs</div>
                <div style={statValueStyle}>{totalJobs}</div>
              </div>
              <div>
                <div style={statLabelStyle}>Underwritten Deals</div>
                <div style={statValueStyle}>{completedJobs}</div>
              </div>
              <div>
                <div style={statLabelStyle}>In Queue</div>
                <div style={statValueStyle}>{inProgressJobs}</div>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={14} />
                <span>
                  Deals with a green badge are fully underwritten and pushed into the main pipeline.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#0f172a" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Email Underwrite Deals
              </h3>
              {loading && (
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading…</span>
              )}
              {error && !loading && (
                <span style={{ fontSize: '12px', color: '#b91c1c' }}>Error: {error}</span>
              )}
            </div>
            {jobs.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleting === 'all'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  backgroundColor: deleting === 'all' ? '#94a3b8' : '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: deleting === 'all' ? 'not-allowed' : 'pointer',
                }}
              >
                <Trash2 size={13} />
                {deleting === 'all' ? 'Deleting…' : 'Clear All'}
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Property</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Units</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Price</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Stage</th>
                  <th style={{ textAlign: 'right', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Cap Rate</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Email Subject</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>From</th>
                  <th style={{ textAlign: 'left', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Created</th>
                  <th style={{ textAlign: 'right', padding: '10px', fontWeight: 600, color: '#6b7280', fontSize: '11px' }}>Cash Flow (Stab.)</th>
                  <th style={{ width: 40, padding: '10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                      No deals yet. Forward an email with an OM/T12 attachment — it will be automatically parsed and underwritten.
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                      {renderStatusBadge(row.status, row.parsedStatus, row.isFullyParsed)}
                      {row.status === 'error' && row.errorMessage && (
                        <div title={row.errorMessage} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '10px', color: '#b91c1c', cursor: 'help' }}>
                          <AlertTriangle size={10} />
                          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.errorMessage}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '12px' }}>{row.address}</div>
                      {row.dealId && (
                        <button
                          onClick={() => handleViewUnderwrite(row.id, row.dealId, row.needsParse)}
                          disabled={parsingJobId === row.id}
                          style={{
                            marginTop: 4,
                            padding: '4px 8px',
                            borderRadius: '999px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: parsingJobId === row.id ? '#f3f4f6' : 'white',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: parsingJobId === row.id ? '#9ca3af' : '#2563eb',
                            cursor: parsingJobId === row.id ? 'wait' : 'pointer',
                          }}
                        >
                          {parsingJobId === row.id ? '⏳ Parsing OM...' : row.needsParse ? 'Parse & View' : 'View Underwrite'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>{row.units ?? '-'}</td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>{formatCurrency(row.purchasePrice)}</td>
                    <td style={{ padding: '10px', verticalAlign: 'middle', fontSize: '11px', color: '#4b5563' }}>
                      {row.stage || '-'}
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle', textAlign: 'right' }}>
                      {row.capRate != null ? `${(row.capRate * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle', maxWidth: 260 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.subject}</div>
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>{row.from}</td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} color="#6b7280" />
                        <span>{formatDate(row.createdAt)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px', verticalAlign: 'middle', textAlign: 'right' }}>
                      {row.stabilizedCashFlow != null ? formatCurrency(row.stabilizedCashFlow) : '-'}
                    </td>
                    <td style={{ padding: '6px', verticalAlign: 'middle' }}>
                      <button
                        onClick={() => handleDeleteJob(row.id)}
                        disabled={deleting === row.id}
                        title="Delete this job"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          backgroundColor: deleting === row.id ? '#f3f4f6' : 'white',
                          color: '#6b7280',
                          cursor: deleting === row.id ? 'not-allowed' : 'pointer',
                          opacity: deleting === row.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default EmailUnderwritePage;
