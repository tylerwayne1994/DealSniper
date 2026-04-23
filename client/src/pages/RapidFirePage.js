import React, { useState, useMemo } from 'react';
import { Upload, AlertCircle, CheckCircle, XCircle, Loader, Building2, BarChart3 } from 'lucide-react';
import { saveRapidFireDeals } from '../lib/dealsService';

// NOTE: Backend base remains used for underwriting endpoint only
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8010";

/**
 * @typedef {Object} RapidFireDeal
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {string} state
 * @property {number} units
 * @property {number} totalPrice
 * @property {number=} pricePerUnit
 * @property {number=} brokerCapRate
 * @property {number=} calculatedCapRate
 * @property {number=} noi
 * @property {number=} dscr
 * @property {number=} cashOnCash
 * @property {string=} listingUrl
 * @property {'DEAL'|'MAYBE'|'TRASH'} verdict
 * @property {string[]=} verdictReasons
 */

// Table header / cell styles - Premium Modern Design (Compact)
const thStyle = {
  padding: '14px 8px',
  fontSize: '9px',
  fontWeight: '800',
  color: '#ffffff',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  whiteSpace: 'nowrap',
  background: 'linear-gradient(180deg, #1e3a5f 0%, #0f2744 50%, #0a1929 100%)',
  borderBottom: '3px solid #14b8a6',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
  position: 'relative',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
};

const tdStyle = {
  padding: '10px 8px',
  fontSize: '12px',
  color: '#374151',
  verticalAlign: 'middle'
};

const fmtCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  return '$' + num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const fmtPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  return num.toFixed(1) + '%';
};

const verdictStyles = {
  deal: {
    backgroundColor: '#dcfce7',
    color: '#166534'
  },
  maybe: {
    backgroundColor: '#fef9c3',
    color: '#854d0e'
  },
  trash: {
    backgroundColor: '#fee2e2',
    color: '#991b1b'
  },
  invalid: {
    backgroundColor: '#e5e7eb',
    color: '#111827'
  }
};

// Stat Card Component (mirrors PipelinePage)
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

// Simple overlay modal matching EmailDealsPage buy box style
const RapidFireSetupModal = ({ isOpen, onClose, onSubmit, settings, onChange, hasFile, validationErrors, isSubmitting }) => {
  if (!isOpen) return null;

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
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
    fontSize: '13px'
  };

  const helperStyle = {
    marginTop: '4px',
    fontSize: '11px',
    color: '#6b7280'
  };

  const errorStyle = {
    marginTop: '4px',
    fontSize: '11px',
    color: '#b91c1c'
  };

  const handleNumberChange = (field) => (e) => {
    onChange({ ...settings, [field]: e.target.value });
  };

  // Handle Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && hasFile && !isSubmitting) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
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
    }}
    onKeyDown={handleKeyDown}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '720px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Rapid Fire Underwriting Setup
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
              These assumptions will apply to every property in this spreadsheet. Keep it simple and fast.
            </p>
            {!hasFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12px', color: '#b91c1c' }}>
                <AlertCircle size={14} />
                Upload a spreadsheet first.
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
          >
            <XCircle size={22} color="#6b7280" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={labelStyle}>Vacancy Rate (%)</label>
            <input
              type="number"
              value={settings.vacancyRate}
              onChange={handleNumberChange('vacancyRate')}
              style={inputStyle}
            />
            <p style={helperStyle}>Stress buffer on income, not used to override real NOI if the sheet already has it.</p>
          </div>

          <div>
            <label style={labelStyle}>Expense Ratio (%)</label>
            <input
              type="number"
              value={settings.expenseRatio}
              onChange={handleNumberChange('expenseRatio')}
              style={inputStyle}
            />
            <p style={helperStyle}>If NOI is missing, we'll assume expenses are this % of effective gross income.</p>
          </div>

          <div>
            <label style={labelStyle}>Closing Costs (%)</label>
            <input
              type="number"
              value={settings.closingCosts}
              onChange={handleNumberChange('closingCosts')}
              style={inputStyle}
            />
            <p style={helperStyle}>Percentage of purchase price added as closing costs.</p>
          </div>

          <div>
            <label style={labelStyle}>Realtor / Acquisition Fee (%)</label>
            <input
              type="number"
              value={settings.acquisitionFee}
              onChange={handleNumberChange('acquisitionFee')}
              style={inputStyle}
            />
            <p style={helperStyle}>Acquisition / broker fee as a % of purchase price.</p>
            {validationErrors.acquisitionFee && (
              <p style={errorStyle}>{validationErrors.acquisitionFee}</p>
            )}
          </div>

          <div>
            <label style={labelStyle}>LTV (%)</label>
            <input
              type="number"
              value={settings.ltv}
              onChange={handleNumberChange('ltv')}
              style={inputStyle}
            />
            <p style={helperStyle}>Loan-to-value for simple permanent debt.</p>
          </div>

          <div>
            <label style={labelStyle}>Interest Rate (%)</label>
            <input
              type="number"
              value={settings.interestRate}
              onChange={handleNumberChange('interestRate')}
              style={inputStyle}
            />
            <p style={helperStyle}>Fixed interest rate for the loan.</p>
          </div>

          <div>
            <label style={labelStyle}>Amortization (years)</label>
            <input
              type="number"
              value={settings.amortizationYears}
              onChange={handleNumberChange('amortizationYears')}
              style={inputStyle}
            />
            <p style={helperStyle}>Amortization term for calculating annual debt service.</p>
          </div>

          <div>
            <label style={labelStyle}>Min DSCR</label>
            <input
              type="number"
              value={settings.minDscr}
              onChange={handleNumberChange('minDscr')}
              style={inputStyle}
            />
            <p style={helperStyle}>Minimum DSCR required for a deal to pass.</p>
          </div>

          <div>
            <label style={labelStyle}>Min Cash-on-Cash (%)</label>
            <input
              type="number"
              value={settings.minCoC}
              onChange={handleNumberChange('minCoC')}
              style={inputStyle}
            />
            <p style={helperStyle}>Minimum cash-on-cash return required.</p>
          </div>

          <div>
            <label style={labelStyle}>Min Cap Rate (%)</label>
            <input
              type="number"
              value={settings.minCapRate}
              onChange={handleNumberChange('minCapRate')}
              style={inputStyle}
            />
            <p style={helperStyle}>Minimum going-in cap rate.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={onClose}
            type="button"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            type="button"
            disabled={!hasFile || isSubmitting}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: !hasFile ? '#9ca3af' : '#0d9488',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: !hasFile || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting && <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            Run Rapid Fire Underwriting
          </button>
        </div>
      </div>
    </div>
  );
};

// Token confirmation modal shown before starting AI-powered underwriting (Reonomy)
const TokenConfirmModal = ({ isOpen, onCancel, onConfirm, tokensRequired, tokenBalance }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      padding: '20px'
    }}>
      <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Confirm AI Token Use</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <XCircle size={20} color="#6b7280" />
          </button>
        </div>
        <p style={{ marginTop: 6, color: '#374151', fontSize: '14px' }}>
          Running AI underwriting on Reonomy spreadsheets uses tokens.
        </p>
        <div style={{
          marginTop: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'
        }}>
          <div style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Cost</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{tokensRequired} token</div>
          </div>
          <div style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Your Balance</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{tokenBalance?.token_balance ?? '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Use 1 Token & Continue</button>
        </div>
      </div>
    </div>
  );
};

function RapidFirePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [deals, setDeals] = useState([]);
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [validationErrors, setValidationErrors] = useState({ acquisitionFee: '' });
  const [isPushingToPipeline, setIsPushingToPipeline] = useState(false);

  // Token confirmation modal state
  const [isTokenConfirmOpen, setIsTokenConfirmOpen] = useState(false);
  const [pendingTokenInfo] = useState({ required: 1, balance: null });

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType] = useState('success');

  const [settings, setSettings] = useState({
    vacancyRate: 5,
    expenseRatio: 50,
    closingCosts: 2,
    acquisitionFee: 1,
    ltv: 75,
    interestRate: 6.5,
    amortizationYears: 30,
    minDscr: 1.25,
    minCoC: 8,
    minCapRate: 7,
    underwriteMode: 'fast'
  });

  // Data source: CREXI (default) vs Reonomy off-market
  const [sourceType, setSourceType] = useState('crexi');

  const [verdictFilter, setVerdictFilter] = useState('all');


  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsModalOpen(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    setSelectedFile(file);
    setIsModalOpen(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };


  const validateSettings = () => {
    const errors = { acquisitionFee: '' };
    const fee = Number(settings.acquisitionFee);
    if (isNaN(fee) || fee < 1 || fee > 4) {
      errors.acquisitionFee = 'Realtor / Acquisition Fee must be between 1% and 4%.';
    }
    setValidationErrors(errors);
    return !errors.acquisitionFee;
  };

  const handleRunRapidFire = async () => {
    console.log('🚀 handleRunRapidFire called');
    console.log('📁 Selected file:', selectedFile);
    console.log('⚙️ Settings:', settings);
    console.log('🔍 Source type:', sourceType);
    
    if (!validateSettings()) {
      console.log('❌ Settings validation failed');
      return;
    }
    if (!selectedFile) {
      console.log('❌ No file selected');
      return;
    }

    console.log('✅ Starting rapid fire underwriting...');
    
    setIsSubmitting(true);
    setIsLoadingResults(true);

    try {
      // Quick connectivity check before uploading file
      try {
        const ping = await fetch(`${API_BASE}/health`, { method: 'GET', mode: 'cors' });
        if (!ping.ok) throw new Error(`Backend returned ${ping.status}`);
        console.log('[RapidFire] Backend health check passed');
      } catch (pingErr) {
        throw new Error(`Cannot reach backend server (${API_BASE}). It may be sleeping or restarting. Please wait 30 seconds and try again. Details: ${pingErr.message}`);
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('settings', JSON.stringify(settings));
      formData.append('sourceType', sourceType);

      console.log('[RapidFire] File:', selectedFile.name, 'size:', selectedFile.size, 'type:', selectedFile.type);
      console.log('[RapidFire] Sending to:', `${API_BASE}/v2/rapid-fire/underwrite`);

      const resp = await fetch(`${API_BASE}/v2/rapid-fire/underwrite`, {
        method: 'POST',
        mode: 'cors',
        body: formData,
      });

      console.log('[RapidFire] Response status:', resp.status);

      if (!resp.ok) {
        let errMsg = `Server error ${resp.status}`;
        try {
          const errBody = await resp.json();
          errMsg = errBody.detail || errBody.message || errMsg;
        } catch (_) {
          try { errMsg = (await resp.text()).substring(0, 300) || errMsg; } catch (_2) {}
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();

      console.log('[RapidFire] Received data:', data);
      if (data && data.debug) {
        console.log('[RapidFire] Debug:', data.debug);
        console.log('[RapidFire] Headers:', data.debug.matched_headers);
        console.log('[RapidFire] Total rows:', data.debug.total_rows);
      }
      console.log('[RapidFire] Deals count:', data.deals?.length || 0);
      
      if (data.deals?.length === 0 && data.debug) {
        console.warn('[RapidFire] No deals found - column headers may not match');
      }
      
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setIsModalOpen(false);
    } catch (error) {
      console.error('[RapidFire] Failed:', error);
      alert(`Failed to run rapid fire: ${error.message}`);
      setDeals([]);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
      setIsLoadingResults(false);
    }
  };

  // Token confirm handler (no longer needed - rapid fire is free)
  const handleConfirmTokenAndRun = () => {
    setIsTokenConfirmOpen(false);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredDeals = useMemo(() => {
    if (verdictFilter === 'all') return deals;
    const target = verdictFilter.toUpperCase();
    return deals.filter(d => (d.verdict || '').toUpperCase() === target);
  }, [deals, verdictFilter]);

  const sortedDeals = useMemo(() => {
    if (!sortField) return filteredDeals;
    const sorted = [...filteredDeals].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredDeals, sortField, sortDirection]);

  const totalAnalyzed = deals.length;
  const totalDeals = deals.filter(d => (d.verdict || '').toUpperCase() === 'DEAL').length;
  const totalMaybes = deals.filter(d => (d.verdict || '').toUpperCase() === 'MAYBE').length;
  const totalTrash = deals.filter(d => (d.verdict || '').toUpperCase() === 'TRASH').length;

  const handleSendDealsToPipeline = async () => {
    if (!deals.length) return;

    const selected = deals.filter((d) => {
      const v = (d.verdict || '').toString().toUpperCase();
      return v === 'DEAL' || v === 'MAYBE';
    });

    if (!selected.length) {
      alert('No DEAL or MAYBE rows to send to Pipeline.');
      return;
    }

    try {
      setIsPushingToPipeline(true);
      await saveRapidFireDeals(selected);
      alert(`Sent ${selected.length} Rapid Fire deals to your Pipeline queue.`);
      // Notify pipeline view to reload
      window.dispatchEvent(new Event('pipelineDealsUpdated'));
    } catch (err) {
      console.error('Failed to push Rapid Fire deals to pipeline queue:', err);
      alert('Failed to send Rapid Fire deals to Pipeline. Check console for details.');
    } finally {
      setIsPushingToPipeline(false);
    }
  };

  const renderSortLabel = (label, field) => {
    const active = sortField === field;
    const arrow = !active ? '' : sortDirection === 'asc' ? ' ↑' : ' ↓';
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          color: '#f0fdfa',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          cursor: 'pointer'
        }}
      >
        {label}{arrow}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top section: title + description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          Rapid Fire Underwriting
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', maxWidth: '600px' }}>
          Upload a CREXI export and let us napkin-underwrite every deal in seconds.
        </p>
      </div>

      {/* Upload area */}
      {/* Source selector: CREXI vs Reonomy */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => setSourceType('crexi')}
          style={{
            padding: '8px 14px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: sourceType === 'crexi' ? '#000000' : '#e5e7eb',
            color: sourceType === 'crexi' ? '#ffffff' : '#4b5563',
          }}
        >
          CREXI spreadsheet upload
        </button>
        <button
          type="button"
          onClick={() => setSourceType('propstream')}
          style={{
            padding: '8px 14px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: sourceType === 'propstream' ? '#000000' : '#e5e7eb',
            color: sourceType === 'propstream' ? '#ffffff' : '#4b5563',
          }}
        >
          PropStream spreadsheet upload
        </button>
        <button
          type="button"
          onClick={() => setSourceType('reonomy')}
          style={{
            padding: '8px 14px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: sourceType === 'reonomy' ? '#000000' : '#e5e7eb',
            color: sourceType === 'reonomy' ? '#ffffff' : '#4b5563',
          }}
        >
          Reonomy off-market spreadsheet upload
        </button>
      </div>

      {/* Underwriting depth mode */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Underwrite mode
        </div>
        <button
          type="button"
          onClick={() => setSettings(prev => ({ ...prev, underwriteMode: 'fast' }))}
          style={{
            padding: '7px 12px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: settings.underwriteMode === 'fast' ? '#0f172a' : '#e5e7eb',
            color: settings.underwriteMode === 'fast' ? '#ffffff' : '#475569',
          }}
        >
          Fast Screen
        </button>
        <button
          type="button"
          onClick={() => setSettings(prev => ({ ...prev, underwriteMode: 'deep' }))}
          style={{
            padding: '7px 12px',
            borderRadius: '999px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: settings.underwriteMode === 'deep' ? '#0f172a' : '#e5e7eb',
            color: settings.underwriteMode === 'deep' ? '#ffffff' : '#475569',
          }}
        >
          Deep Underwrite
        </button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: '12px',
          padding: '32px',
          backgroundColor: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '999px',
            backgroundColor: '#e0f2fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Upload size={24} color="#0369a1" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
              {sourceType === 'crexi' ? 'Upload CREXI Spreadsheet' : sourceType === 'propstream' ? 'Upload PropStream Spreadsheet' : 'Upload Reonomy Spreadsheet'}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              Drag and drop or click to upload .xlsx, .xls, or .csv
            </div>
            {selectedFile && (
              <div style={{ fontSize: '12px', color: '#0f766e', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} />
                Selected: {selectedFile.name}
              </div>
            )}
          </div>
        </div>
        <div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #0f766e',
              backgroundColor: '#0f766e',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Upload size={16} />
            Choose File
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingResults && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#0f766e' }} />
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Running rapid fire underwriting...</p>
        </div>
      )}

      {/* Results summary + table */}
      {deals.length > 0 && !isLoadingResults && (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px'
          }}>
            <StatCard 
              label="Total Deals Analyzed"
              value={totalAnalyzed}
              icon={Building2}
              color="#0f766e"
            />
            <StatCard 
              label="Deals Passed"
              value={totalDeals}
              icon={CheckCircle}
              color="#16a34a"
            />
            <StatCard 
              label="Maybes"
              value={totalMaybes}
              icon={BarChart3}
              color="#f59e0b"
            />
            <StatCard 
              label="Rejected"
              value={totalTrash}
              icon={AlertCircle}
              color="#dc2626"
            />
          </div>

          <div style={{ marginTop: '24px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handleSendDealsToPipeline}
              disabled={isPushingToPipeline}
              style={{
                padding: '10px 18px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: isPushingToPipeline ? '#9ca3af' : '#0f766e',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isPushingToPipeline ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {isPushingToPipeline ? 'Sending to Pipeline...' : 'Send DEALs & MAYBEs to Pipeline'}
            </button>

            <label style={{ fontSize: '13px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Filter by verdict:
              <select
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#111827'
                }}
              >
                <option value="all">All</option>
                <option value="DEAL">Deals</option>
                <option value="MAYBE">Maybes</option>
                <option value="TRASH">Trash</option>
              </select>
            </label>
          </div>

          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            border: '1px solid rgba(45, 212, 191, 0.15)',
            overflow: 'auto',
            maxHeight: '600px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12), 0 0 40px rgba(20, 184, 166, 0.05)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ 
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 40%, #0a1929 100%)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}>
                    <th style={thStyle}>Property</th>
                    <th style={thStyle}>Owner</th>
                    <th style={thStyle}>Link</th>
                    <th style={thStyle}>Market</th>
                    <th style={thStyle}>Units</th>
                    <th style={thStyle}>$/Unit</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Broker Cap</th>
                    <th style={thStyle}>NOI</th>
                    <th style={thStyle}>NOI Source</th>
                    <th style={thStyle}>Mo. Cash</th>
                    <th style={thStyle}>{renderSortLabel('Calc Cap', 'calculatedCapRate')}</th>
                    <th style={thStyle}>{renderSortLabel('DSCR', 'dscr')}</th>
                    <th style={thStyle}>Debt Yield</th>
                    <th style={thStyle}>{renderSortLabel('CoC', 'cashOnCash')}</th>
                    <th style={thStyle}>Verdict</th>
                    <th style={thStyle}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeals.map((deal, index) => (
                    <tr 
                      key={deal.id || index}
                      style={{ 
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: '600', color: '#111827', maxWidth: '220px' }}>
                          {deal.name || '-'}
                        </div>
                        {(deal.yearBuilt || deal.sqft) && (
                          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                            {deal.yearBuilt ? `Built ${deal.yearBuilt}` : ''}{deal.yearBuilt && deal.sqft ? ' · ' : ''}{deal.sqft ? `${deal.sqft.toLocaleString()} SF` : ''}
                          </div>
                        )}
                        {deal.annualTaxes != null && (
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>
                            Taxes: {fmtCurrency(deal.annualTaxes)}/yr
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '12px', color: '#4b5563', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deal.ownerName || '-'}
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
                          {deal.city || '-'}{deal.state ? `, ${deal.state}` : ''}
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
                          {deal.pricePerUnit != null ? fmtCurrency(deal.pricePerUnit) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '700', color: '#111827' }}>
                          {fmtCurrency(deal.totalPrice)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>
                          {deal.brokerCapRate != null ? fmtPercent(deal.brokerCapRate) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#111827' }}>
                          {deal.noi != null ? fmtCurrency(deal.noi) : '-'}
                        </span>
                        {deal.noiPerUnit != null && (
                          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                            {fmtCurrency(deal.noiPerUnit)}/unit
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {deal.noiSource ? (
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: deal.noiSource === 'spreadsheet' ? '#dcfce7' :
                                           deal.noiSource?.includes('broker') ? '#fef3c7' :
                                           deal.noiSource?.includes('AI') ? '#e0e7ff' :
                                           deal.noiSource?.includes('FMR') ? '#fce7f3' : '#f3f4f6',
                            color: deal.noiSource === 'spreadsheet' ? '#166534' :
                                   deal.noiSource?.includes('broker') ? '#92400e' :
                                   deal.noiSource?.includes('AI') ? '#3730a3' :
                                   deal.noiSource?.includes('FMR') ? '#9d174d' : '#4b5563',
                          }}>
                            {deal.noiSource === 'spreadsheet' ? '📊 Sheet' :
                             deal.noiSource?.includes('broker') ? '🏢 Broker' :
                             deal.noiSource?.includes('AI') ? '🤖 AI' :
                             deal.noiSource?.includes('gross') ? '📈 Derived' :
                             deal.noiSource?.includes('FMR') ? '🏠 FMR' : deal.noiSource}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#111827' }}>
                          {deal.monthlyCashFlow != null ? fmtCurrency(deal.monthlyCashFlow) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '600', color: '#111827' }}>
                          {deal.calculatedCapRate != null ? fmtPercent(deal.calculatedCapRate) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '600', color: deal.dscr != null && deal.dscr >= 1.25 ? '#059669' : '#b91c1c' }}>
                          {deal.dscr != null ? deal.dscr.toFixed(2) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '600', color: deal.debtYield != null && deal.debtYield >= 10 ? '#059669' : '#b91c1c' }}>
                          {deal.debtYield != null ? fmtPercent(deal.debtYield) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: '600', color: deal.cashOnCash != null && deal.cashOnCash >= 8 ? '#059669' : '#b91c1c' }}>
                          {deal.cashOnCash != null ? fmtPercent(deal.cashOnCash) : '-'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {(() => {
                          const vRaw = deal.verdict || 'MAYBE';
                          const v = (typeof vRaw === 'string' ? vRaw : '').toUpperCase();
                          const style = verdictStyles[v.toLowerCase()] || verdictStyles.maybe;
                          let label = 'Unknown';
                          if (v === 'DEAL') label = 'Deal';
                          else if (v === 'MAYBE') label = 'Maybe';
                          else if (v === 'TRASH') label = 'Trash';
                          else if (v === 'INVALID') label = 'Invalid Data';
                          return (
                            <span style={{
                              ...style,
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'uppercase'
                            }}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '300px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {deal.verdictReasons?.length > 0 ? (
                            deal.verdictReasons.map((reason, ri) => (
                              <div key={ri} style={{ 
                                fontSize: '10px', 
                                color: reason.includes('✓') ? '#059669' : 
                                       reason.includes('⚠') ? '#d97706' : 
                                       reason.includes('below') ? '#dc2626' : '#374151',
                                lineHeight: '1.4',
                                fontWeight: reason.includes('✓') ? 600 : 400,
                              }}>
                                {reason}
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>-</span>
                          )}
                          {deal.aiAnalysis?.used && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span style={{
                                backgroundColor: deal.aiAnalysis.confidence === 'high' ? '#dcfce7' : 
                                               deal.aiAnalysis.confidence === 'medium' ? '#fef9c3' : '#fee2e2',
                                color: deal.aiAnalysis.confidence === 'high' ? '#166534' : 
                                       deal.aiAnalysis.confidence === 'medium' ? '#854d0e' : '#991b1b',
                                padding: '1px 6px',
                                borderRadius: '999px',
                                fontSize: '9px',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                              }}>
                                🤖 {deal.aiAnalysis.confidence || 'medium'}
                              </span>
                            </div>
                          )}
                          {deal.dataQuality && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span style={{
                                backgroundColor: deal.dataQuality.confidence === 'high' ? '#dcfce7' :
                                               deal.dataQuality.confidence === 'medium' ? '#fef9c3' : '#fee2e2',
                                color: deal.dataQuality.confidence === 'high' ? '#166534' :
                                       deal.dataQuality.confidence === 'medium' ? '#854d0e' : '#991b1b',
                                padding: '1px 6px',
                                borderRadius: '999px',
                                fontSize: '9px',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                              }}>
                                DATA {deal.dataQuality.confidence} ({Math.round((deal.dataQuality.score || 0) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal for buy box setup */}
      <RapidFireSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRunRapidFire}
        settings={settings}
        onChange={setSettings}
        hasFile={!!selectedFile}
        validationErrors={validationErrors}
        isSubmitting={isSubmitting}
      />

      {/* Token confirmation modal */}
      <TokenConfirmModal
        isOpen={isTokenConfirmOpen}
        onCancel={() => setIsTokenConfirmOpen(false)}
        onConfirm={handleConfirmTokenAndRun}
        tokensRequired={pendingTokenInfo.required}
        tokenBalance={pendingTokenInfo.balance}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1300 }}>
          <div style={{
            backgroundColor: toastType === 'success' ? '#10b981' : '#f59e0b',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 260
          }}>
            <span style={{ fontWeight: 700 }}>{toastType === 'success' ? 'Success' : 'Notice'}</span>
            <span style={{ flex: 1 }}>{toastMessage}</span>
            <button onClick={() => setToastMessage('')} style={{
              background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16, fontWeight: 700
            }}>×</button>
          </div>
        </div>
      )}

      {/* Spin animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default RapidFirePage;
