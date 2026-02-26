import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Building2,
  DollarSign,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import DashboardShell from '../components/DashboardShell';

function EmailUnderwritePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [dealsById, setDealsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const userId = userData?.user?.id;
        if (!userId) {
          setJobs([]);
          return;
        }

        const { data: jobRows, error: jobsError } = await supabase
          .from('email_underwrite_jobs')
          .select('*')
          .eq('user_id', userId)
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
              scenario_data
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
        setError(err.message || 'Failed to load email underwrite pipeline');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'done').length;
  const inProgressJobs = jobs.filter(j => j.status !== 'done' && j.status !== 'error').length;

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

  const renderStatusBadge = (status) => {
    const normalized = (status || 'pending').toLowerCase();
    let bg = '#e5e7eb';
    let color = '#111827';
    let label = normalized;

    if (normalized === 'pending' || normalized === 'processing' || normalized === 'underwriting') {
      bg = '#dbeafe';
      color = '#1d4ed8';
      label = 'In Queue';
    } else if (normalized === 'done') {
      bg = '#dcfce7';
      color = '#15803d';
      label = 'Underwritten';
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

    return {
      id: job.id,
      status: job.status,
      subject: job.subject || '(no subject)',
      from: job.from_address,
      createdAt: job.created_at,
      dealId: job.deal_id,
      address: deal?.address || 'Pending underwriting',
      units: deal?.units || null,
      purchasePrice: deal?.purchase_price || null,
      stage: deal?.pipeline_status || null,
      capRate: deal?.market_cap_rate || null,
      dayOneCashFlow: scenarioCalculations.dayOneCashFlow || null,
      stabilizedCashFlow: scenarioCalculations.stabilizedCashFlow || null,
      refiValue: scenarioCalculations.refiValue || null,
    };
  });

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
                  Go to the <strong>Email Deals</strong> page to connect Gmail and see your unique forwarding address.
                </li>
                <li>
                  Forward broker emails with OMs, T12s, and rent rolls from that inbox 
                  using your DealSniper email address.
                </li>
                <li>
                  We parse the attachments, run the underwriter, push the deal into your pipeline, 
                  and list it here once complete.
                </li>
              </ol>
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
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                      No email underwrite jobs yet. Forward your first OM/T12 to get started.
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>{renderStatusBadge(row.status)}</td>
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '12px' }}>{row.address}</div>
                      {row.dealId && (
                        <button
                          onClick={() => navigate(`/underwrite?viewDeal=${row.dealId}`)}
                          style={{
                            marginTop: 4,
                            padding: '4px 8px',
                            borderRadius: '999px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: 'white',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#2563eb',
                            cursor: 'pointer',
                          }}
                        >
                          View Underwrite
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
