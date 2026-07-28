/* eslint-disable */
// Investor Portal / LP Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import { loadPipelineDeals, updateDeal } from '../lib/dealsService';
import {
  listInvestors, createInvestor, updateInvestor, deleteInvestor,
  listAllocations, createAllocation, updateAllocation, deleteAllocation,
  listDistributions, createDistribution, deleteDistribution,
  listDocuments, uploadDocument, deleteDocument,
  listUpdates, createUpdate, deleteUpdate,
  getDashboardSummary,
} from '../lib/investorService';
import {
  Users, Plus, Trash2, DollarSign, FileText, Upload, Send,
  TrendingUp, Building2, ChevronDown, ChevronRight, Edit2, X,
  PieChart, Briefcase, BarChart3, Calendar, Download, Eye,
} from 'lucide-react';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '$0';
  return '$' + Math.round(Number(v)).toLocaleString();
};
const pct = (v) => (v != null && !isNaN(v) ? Number(v).toFixed(2) + '%' : '0%');
// Some saved calc fields come through as a decimal fraction (0.065) and others
// as a whole percentage (6.5) depending on which underwriting engine produced
// them — normalize to a whole percentage for display.
const asPct = (v) => {
  const n = Number(v) || 0;
  return n > 0 && n < 1 ? n * 100 : n;
};

// ── Styles ──
const card = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 24,
  marginBottom: 16,
};
const metricCard = (color) => ({
  ...card,
  padding: '20px 24px',
  borderLeft: `4px solid ${color}`,
});
const btnPrimary = {
  padding: '8px 16px',
  background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const btnDanger = {
  ...btnPrimary,
  background: '#ef4444',
  padding: '6px 10px',
  fontSize: 12,
};
const btnGhost = {
  ...btnPrimary,
  background: '#ffffff',
  color: '#6b7280',
  border: '1px solid #e5e7eb',
};
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 13,
  boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };
const sectionTitle = { fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 16px' };
const subtle = { fontSize: 12, color: '#6b7280' };

export default function InvestorPortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Data
  const [investors, setInvestors] = useState([]);
  const [deals, setDeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [updates, setUpdates] = useState([]);

  // Modals
  const [showAddInvestor, setShowAddInvestor] = useState(false);
  const [showAddAllocation, setShowAddAllocation] = useState(false);
  const [showAddDistribution, setShowAddDistribution] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);

  // Forms
  const [invForm, setInvForm] = useState({ email: '', first_name: '', last_name: '', company: '', phone: '', investor_type: 'lp' });
  const [allocForm, setAllocForm] = useState({ investor_id: '', commitment_amount: '', contributed_amount: '', ownership_pct: '', preferred_return_pct: '8' });
  const [distForm, setDistForm] = useState({ deal_investor_id: '', amount: '', distribution_type: 'cash_flow', distribution_date: new Date().toISOString().split('T')[0], memo: '', quarter: '' });
  const [docForm, setDocForm] = useState({ deal_investor_id: '', document_type: 'k1', tax_year: new Date().getFullYear(), quarter: '' });
  const [docFile, setDocFile] = useState(null);
  const [updateForm, setUpdateForm] = useState({ title: '', body: '', quarter: '' });
  // Deal Terms — the sponsor's actual negotiated preferred return / GP promote
  // for the selected deal (saved on the deals table, not derived from the demo
  // underwriting engine). Used to default new investor allocations.
  const [dealTermsForm, setDealTermsForm] = useState({ preferred_return_pct: '8', gp_promote_pct: '20' });
  const [savingDealTerms, setSavingDealTerms] = useState(false);

  // ── Load data ──
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      // Each call is caught independently — a failure in one (e.g. the
      // investors API, which needs the backend's Supabase service key)
      // must never block the others (e.g. the deal pipeline dropdown,
      // which talks to Supabase directly from the browser) from loading.
      const [inv, pDeals, dash] = await Promise.all([
        listInvestors().catch((err) => { console.error('Failed to load investors:', err); return []; }),
        loadPipelineDeals().catch((err) => { console.error('Failed to load pipeline deals:', err); return []; }),
        getDashboardSummary().catch(() => null),
      ]);
      setInvestors(inv || []);
      setDeals(pDeals || []);
      setSummary(dash);
    } catch (err) {
      console.error('Failed to load investor portal:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Pull underwriting data from the selected pipeline deal ──
  // Reads the same calculations that were saved when the deal was pushed to
  // pipeline from the underwriting Results page (NOI, cap rate, DSCR, LTV,
  // stabilized/ARV value, cash-on-cash) and estimates the equity required so
  // the Investor Portal fields can be pre-filled instead of typed by hand.
  const dealUnderwriting = React.useMemo(() => {
    if (!selectedDeal) return null;
    const scn = selectedDeal.fullScenarioData || {};
    const calc = scn.calculations || {};
    const pf = scn.pricing_financing || {};
    const purchasePrice = selectedDeal.purchasePrice || pf.purchase_price || pf.price || 0;
    const ltv = calc.ltv || pf.ltv || 75;
    const loanAmount = pf.loan_amount || (purchasePrice * (ltv / 100));
    const capex = pf.capex_budget || pf.renovation_budget || 0;
    const totalEquityRequired = Math.max(purchasePrice - loanAmount + capex, 0);
    return {
      purchasePrice,
      units: selectedDeal.units || 0,
      noiYear1: calc.noiYear1 || 0,
      goingInCapRate: calc.inPlaceCapRate || 0,
      dscr: calc.dscr || 0,
      ltv,
      stabilizedValue: calc.refiValue || 0,
      valueCreation: calc.valueCreation || 0,
      avgCashOnCash: calc.avgCashOnCash || 0,
      dayOneCashFlow: calc.dayOneCashFlow || 0,
      stabilizedCashFlow: calc.stabilizedCashFlow || 0,
      totalEquityRequired,
      preferredReturnPct: selectedDeal.preferredReturnPct ?? 8,
      gpPromotePct: selectedDeal.gpPromotePct ?? 20,
    };
  }, [selectedDeal]);

  // Sync the editable Deal Terms form whenever a different deal is selected
  useEffect(() => {
    if (!selectedDeal) return;
    setDealTermsForm({
      preferred_return_pct: String(selectedDeal.preferredReturnPct ?? 8),
      gp_promote_pct: String(selectedDeal.gpPromotePct ?? 20),
    });
  }, [selectedDeal]);

  // Load deal-specific data when a deal is selected
  useEffect(() => {
    if (!selectedDeal) {
      setAllocations([]);
      setDistributions([]);
      setDocuments([]);
      setUpdates([]);
      return;
    }
    const dealId = selectedDeal.dealId || selectedDeal.id;
    Promise.all([
      listAllocations(dealId).catch(() => []),
      listDistributions(dealId).catch(() => []),
      listDocuments(dealId).catch(() => []),
      listUpdates(dealId).catch(() => []),
    ]).then(([a, d, docs, u]) => {
      setAllocations(a || []);
      setDistributions(d || []);
      setDocuments(docs || []);
      setUpdates(u || []);
    });
  }, [selectedDeal]);

  // ── Handlers ──
  const handleAddInvestor = async () => {
    if (!invForm.email) return;
    try {
      await createInvestor(invForm);
      setInvForm({ email: '', first_name: '', last_name: '', company: '', phone: '', investor_type: 'lp' });
      setShowAddInvestor(false);
      loadAll();
    } catch (err) {
      console.error('Failed to add investor:', err);
      alert('Failed to add investor: ' + err.message);
    }
  };

  const handleDeleteInvestor = async (id) => {
    if (!window.confirm('Delete this investor and all their allocations?')) return;
    try {
      await deleteInvestor(id);
      loadAll();
    } catch (err) {
      console.error('Failed to delete investor:', err);
      alert('Failed to delete investor: ' + err.message);
    }
  };

  const handleAddAllocation = async () => {
    if (!allocForm.investor_id || !selectedDeal) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    try {
      await createAllocation(dealId, {
        investor_id: allocForm.investor_id,
        commitment_amount: parseFloat(allocForm.commitment_amount) || 0,
        contributed_amount: parseFloat(allocForm.contributed_amount) || 0,
        ownership_pct: parseFloat(allocForm.ownership_pct) || 0,
        preferred_return_pct: parseFloat(allocForm.preferred_return_pct) || 8,
      });
      setAllocForm({ investor_id: '', commitment_amount: '', contributed_amount: '', ownership_pct: '', preferred_return_pct: '8' });
      setShowAddAllocation(false);
      // Reload deal data
      setSelectedDeal({ ...selectedDeal });
      loadAll();
    } catch (err) {
      console.error('Failed to add investor to deal:', err);
      alert('Failed to add investor to deal: ' + err.message);
    }
  };

  const handleDeleteAllocation = async (allocId) => {
    if (!window.confirm('Remove this investor from the deal?')) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    try {
      await deleteAllocation(dealId, allocId);
      setSelectedDeal({ ...selectedDeal });
      loadAll();
    } catch (err) {
      console.error('Failed to remove investor from deal:', err);
      alert('Failed to remove investor from deal: ' + err.message);
    }
  };

  // Persist the sponsor's real deal terms (preferred return / GP promote) to
  // the deals table so they carry forward as the default for every investor
  // allocated to this deal.
  const handleSaveDealTerms = async () => {
    if (!selectedDeal) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    setSavingDealTerms(true);
    try {
      await updateDeal(dealId, {
        preferred_return_pct: parseFloat(dealTermsForm.preferred_return_pct) || 8,
        gp_promote_pct: parseFloat(dealTermsForm.gp_promote_pct) || 20,
      });
      await loadAll();
    } catch (err) {
      console.error('Failed to save deal terms:', err);
      alert('Failed to save deal terms: ' + err.message);
    } finally {
      setSavingDealTerms(false);
    }
  };

  // Open the allocation modal pre-filled with the remaining equity needed for
  // this deal (pulled from the underwriting snapshot), so the user doesn't
  // have to look up and retype numbers that already live in the underwriting model.
  const openAddAllocationModal = () => {
    setAllocForm((f) => ({
      ...f,
      preferred_return_pct: String(dealUnderwriting?.preferredReturnPct ?? 8),
    }));
    if (dealUnderwriting && dealUnderwriting.totalEquityRequired > 0) {
      const alreadyCommitted = allocations.reduce((s, a) => s + (parseFloat(a.commitment_amount) || 0), 0);
      const remaining = Math.max(dealUnderwriting.totalEquityRequired - alreadyCommitted, 0);
      setAllocForm((f) => ({
        ...f,
        commitment_amount: remaining > 0 ? String(Math.round(remaining)) : f.commitment_amount,
        contributed_amount: remaining > 0 ? String(Math.round(remaining)) : f.contributed_amount,
        ownership_pct: remaining > 0 ? ((remaining / dealUnderwriting.totalEquityRequired) * 100).toFixed(2) : f.ownership_pct,
      }));
    }
    setShowAddAllocation(true);
  };

  const handleAddDistribution = async () => {
    if (!distForm.deal_investor_id || !distForm.amount) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    try {
      await createDistribution(dealId, {
        ...distForm,
        amount: parseFloat(distForm.amount) || 0,
      });
      setDistForm({ deal_investor_id: '', amount: '', distribution_type: 'cash_flow', distribution_date: new Date().toISOString().split('T')[0], memo: '', quarter: '' });
      setShowAddDistribution(false);
      setSelectedDeal({ ...selectedDeal });
      loadAll();
    } catch (err) {
      console.error('Failed to record distribution:', err);
      alert('Failed to record distribution: ' + err.message);
    }
  };

  const handleDeleteDistribution = async (distId) => {
    if (!window.confirm('Delete this distribution?')) return;
    try {
      await deleteDistribution(distId);
      setSelectedDeal({ ...selectedDeal });
    } catch (err) {
      console.error('Failed to delete distribution:', err);
      alert('Failed to delete distribution: ' + err.message);
    }
  };

  const handleUploadDoc = async () => {
    if (!docFile || !docForm.deal_investor_id || !selectedDeal) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    try {
      await uploadDocument(dealId, docFile, docForm.deal_investor_id, docForm.document_type, docForm.tax_year, docForm.quarter);
      setDocFile(null);
      setDocForm({ deal_investor_id: '', document_type: 'k1', tax_year: new Date().getFullYear(), quarter: '' });
      setShowUploadDoc(false);
      setSelectedDeal({ ...selectedDeal });
    } catch (err) {
      console.error('Failed to upload document:', err);
      alert('Failed to upload document: ' + err.message);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDocument(docId);
      setSelectedDeal({ ...selectedDeal });
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document: ' + err.message);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateForm.title || !updateForm.body || !selectedDeal) return;
    const dealId = selectedDeal.dealId || selectedDeal.id;
    try {
      await createUpdate(dealId, updateForm);
      setUpdateForm({ title: '', body: '', quarter: '' });
      setShowAddUpdate(false);
      setSelectedDeal({ ...selectedDeal });
    } catch (err) {
      console.error('Failed to post update:', err);
      alert('Failed to post update: ' + err.message);
    }
  };

  const handleDeleteUpdate = async (uid) => {
    if (!window.confirm('Delete this update?')) return;
    try {
      await deleteUpdate(uid);
      setSelectedDeal({ ...selectedDeal });
    } catch (err) {
      console.error('Failed to delete update:', err);
      alert('Failed to delete update: ' + err.message);
    }
  };

  // ── Tab navigation ──
  const tabs = [
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'investors', label: 'Investors', icon: Users },
    { id: 'deal-view', label: 'Deal View', icon: Building2 },
    { id: 'distributions', label: 'Distributions', icon: DollarSign },
    { id: 'documents', label: 'K-1 & Documents', icon: FileText },
    { id: 'updates', label: 'Quarterly Updates', icon: Calendar },
  ];

  // ── Deal selector ──
  const dealSelector = (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>Select Deal</label>
      <select
        style={selectStyle}
        value={selectedDeal ? (selectedDeal.dealId || selectedDeal.id || '') : ''}
        onChange={(e) => {
          const d = deals.find(d => (d.dealId || d.id) === e.target.value);
          setSelectedDeal(d || null);
        }}
      >
        <option value="">-- Select a deal --</option>
        {deals.map(d => (
          <option key={d.dealId || d.id} value={d.dealId || d.id}>
            {d.address || d.parsed_data?.property?.address || d.dealId || 'Untitled Deal'}
          </option>
        ))}
      </select>
    </div>
  );

  // ── Modal wrapper ──
  const Modal = ({ show, onClose, title, children }) => {
    if (!show) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={18} /></button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const totalCommitted = summary?.total_committed || 0;
    const totalContributed = summary?.total_contributed || 0;
    const totalDistributed = summary?.total_distributed || 0;
    const totalInvestors = summary?.total_investors || investors.length;
    const totalDeals = summary?.total_deals_with_investors || 0;

    return (
      <div>
        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={metricCard('#059669')}>
            <div style={subtle}>Total Investors</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{totalInvestors}</div>
          </div>
          <div style={metricCard('#059669')}>
            <div style={subtle}>Capital Committed</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{fmt(totalCommitted)}</div>
          </div>
          <div style={metricCard('#8b5cf6')}>
            <div style={subtle}>Capital Contributed</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{fmt(totalContributed)}</div>
          </div>
          <div style={metricCard('#f59e0b')}>
            <div style={subtle}>Total Distributed</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{fmt(totalDistributed)}</div>
          </div>
          <div style={metricCard('#ec4899')}>
            <div style={subtle}>Deals with Investors</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{totalDeals}</div>
          </div>
        </div>

        {/* Recent investors */}
        <div style={card}>
          <h3 style={sectionTitle}>Recent Investors</h3>
          {investors.length === 0 ? (
            <p style={subtle}>No investors yet. Go to the Investors tab to add your first LP.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>Company</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {investors.slice(0, 10).map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>{inv.first_name} {inv.last_name}</td>
                    <td style={{ padding: '10px 12px' }}>{inv.email}</td>
                    <td style={{ padding: '10px 12px' }}>{inv.company || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: inv.investor_type === 'gp' ? '#dbeafe' : '#f0fdf4', color: inv.investor_type === 'gp' ? '#1d4ed8' : '#16a34a' }}>
                        {(inv.investor_type || 'lp').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: inv.status === 'active' ? '#d1fae5' : '#fef3c7', color: inv.status === 'active' ? '#065f46' : '#92400e' }}>
                        {inv.status || 'invited'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderInvestors = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={sectionTitle}>Manage Investors</h3>
        <button style={btnPrimary} onClick={() => setShowAddInvestor(true)}>
          <Plus size={14} /> Add Investor
        </button>
      </div>

      {investors.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Users size={48} style={{ color: '#d1d5db', marginBottom: 12 }} />
          <p style={{ color: '#6b7280', fontSize: 14 }}>No investors yet. Add your first LP to get started.</p>
          <button style={{ ...btnPrimary, marginTop: 12, display: 'inline-flex' }} onClick={() => setShowAddInvestor(true)}>
            <Plus size={14} /> Add Investor
          </button>
        </div>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Name', 'Email', 'Phone', 'Company', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investors.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{inv.first_name} {inv.last_name}</td>
                  <td style={{ padding: '10px 12px' }}>{inv.email}</td>
                  <td style={{ padding: '10px 12px' }}>{inv.phone || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{inv.company || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: inv.investor_type === 'gp' ? '#dbeafe' : '#f0fdf4', color: inv.investor_type === 'gp' ? '#1d4ed8' : '#16a34a' }}>
                      {(inv.investor_type || 'lp').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <select style={{ ...selectStyle, padding: '4px 8px', fontSize: 12, width: 'auto' }}
                      value={inv.status || 'invited'}
                      onChange={async (e) => { await updateInvestor(inv.id, { status: e.target.value }); loadAll(); }}>
                      <option value="invited">Invited</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button style={btnDanger} onClick={() => handleDeleteInvestor(inv.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Investor Modal */}
      <Modal show={showAddInvestor} onClose={() => setShowAddInvestor(false)} title="Add Investor">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input style={inputStyle} value={invForm.first_name} onChange={e => setInvForm({ ...invForm, first_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input style={inputStyle} value={invForm.last_name} onChange={e => setInvForm({ ...invForm, last_name: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={invForm.email} onChange={e => setInvForm({ ...invForm, email: e.target.value })} placeholder="investor@email.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={invForm.phone} onChange={e => setInvForm({ ...invForm, phone: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} value={invForm.company} onChange={e => setInvForm({ ...invForm, company: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Investor Type</label>
            <select style={selectStyle} value={invForm.investor_type} onChange={e => setInvForm({ ...invForm, investor_type: e.target.value })}>
              <option value="lp">Limited Partner (LP)</option>
              <option value="gp">General Partner (GP)</option>
              <option value="co-gp">Co-GP</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={btnGhost} onClick={() => setShowAddInvestor(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleAddInvestor}>Add Investor</button>
        </div>
      </Modal>
    </div>
  );

  const renderDealView = () => (
    <div>
      <h3 style={sectionTitle}>Deal Investor Allocations</h3>
      {dealSelector}

      {selectedDeal ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>
              {selectedDeal.address || selectedDeal.parsed_data?.property?.address || 'Deal'} — Investors
            </h4>
            <button style={btnPrimary} onClick={openAddAllocationModal}>
              <Plus size={14} /> Add Investor to Deal
            </button>
          </div>

          {/* Underwriting snapshot — pulled straight from the underwritten deal */}
          {dealUnderwriting && (
            <div style={card}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#111827' }}>Underwriting Snapshot</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div><div style={subtle}>Purchase Price</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmt(dealUnderwriting.purchasePrice)}</div></div>
                <div><div style={subtle}>NOI (Year 1)</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmt(dealUnderwriting.noiYear1)}</div></div>
                <div><div style={subtle}>Going-In Cap Rate</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{pct(asPct(dealUnderwriting.goingInCapRate))}</div></div>
                <div><div style={subtle}>Stabilized / ARV Value</div><div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{fmt(dealUnderwriting.stabilizedValue)}</div></div>
                <div><div style={subtle}>Value Creation</div><div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{fmt(dealUnderwriting.valueCreation)}</div></div>
                <div><div style={subtle}>Cash-on-Cash</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{pct(asPct(dealUnderwriting.avgCashOnCash))}</div></div>
                <div><div style={subtle}>DSCR</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{(Number(dealUnderwriting.dscr) || 0).toFixed(2)}x</div></div>
                <div><div style={subtle}>LTV</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{pct(dealUnderwriting.ltv)}</div></div>
                <div><div style={subtle}>Est. Total Equity Required</div><div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmt(dealUnderwriting.totalEquityRequired)}</div></div>
              </div>
              {(() => {
                const raised = allocations.reduce((s, a) => s + (parseFloat(a.contributed_amount) || 0), 0);
                const target = dealUnderwriting.totalEquityRequired;
                const raisedPct = target > 0 ? Math.min((raised / target) * 100, 100) : 0;
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      <span>Equity Raised: {fmt(raised)} ({raisedPct.toFixed(0)}%)</span>
                      <span>Remaining: {fmt(Math.max(target - raised, 0))}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${raisedPct}%`, background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)' }} />
                    </div>
                  </div>
                );
              })()}

              {/* Deal Terms — the sponsor's actual negotiated terms, saved to the deal */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Deal Terms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Preferred Return %</label>
                    <input style={inputStyle} type="number" step="0.01" value={dealTermsForm.preferred_return_pct}
                      onChange={e => setDealTermsForm({ ...dealTermsForm, preferred_return_pct: e.target.value })} placeholder="8" />
                  </div>
                  <div>
                    <label style={labelStyle}>GP Promote %</label>
                    <input style={inputStyle} type="number" step="0.01" value={dealTermsForm.gp_promote_pct}
                      onChange={e => setDealTermsForm({ ...dealTermsForm, gp_promote_pct: e.target.value })} placeholder="20" />
                  </div>
                  <button style={btnPrimary} onClick={handleSaveDealTerms} disabled={savingDealTerms}>
                    {savingDealTerms ? 'Saving…' : 'Save Terms'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                  These are the terms you've negotiated for this deal — new investors added below default to this preferred return.
                </div>
              </div>
            </div>
          )}

          {allocations.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 32 }}>
              <p style={subtle}>No investors allocated to this deal yet.</p>
            </div>
          ) : (
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Investor', 'Commitment', 'Contributed', 'Ownership %', 'Pref Return', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map(a => {
                    const inv = a.investors || {};
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{inv.first_name} {inv.last_name} <span style={subtle}>({inv.email})</span></td>
                        <td style={{ padding: '10px 12px' }}>{fmt(a.commitment_amount)}</td>
                        <td style={{ padding: '10px 12px' }}>{fmt(a.contributed_amount)}</td>
                        <td style={{ padding: '10px 12px' }}>{pct(a.ownership_pct)}</td>
                        <td style={{ padding: '10px 12px' }}>{pct(a.preferred_return_pct)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button style={btnDanger} onClick={() => handleDeleteAllocation(a.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Capital stack visualization */}
          {allocations.length > 0 && (
            <div style={card}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Capital Stack</h4>
              <div style={{ display: 'flex', gap: 4, height: 40, borderRadius: 8, overflow: 'hidden' }}>
                {allocations.map((a, i) => {
                  const colors = ['#059669', '#22d3ee', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9'];
                  const ownershipPct = parseFloat(a.ownership_pct) || 0;
                  return (
                    <div key={a.id} style={{ width: `${Math.max(ownershipPct, 5)}%`, backgroundColor: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}
                      title={`${a.investors?.first_name || ''} ${a.investors?.last_name || ''}: ${pct(ownershipPct)}`}>
                      {ownershipPct >= 10 ? `${a.investors?.first_name?.[0] || ''}${a.investors?.last_name?.[0] || ''} ${pct(ownershipPct)}` : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <Building2 size={48} style={{ color: '#d1d5db', marginBottom: 12 }} />
          <p style={{ color: '#6b7280' }}>Select a deal from your pipeline to manage investor allocations.</p>
        </div>
      )}

      {/* Add Allocation Modal */}
      <Modal show={showAddAllocation} onClose={() => setShowAddAllocation(false)} title="Add Investor to Deal">
        <div style={{ display: 'grid', gap: 12 }}>
          {dealUnderwriting && dealUnderwriting.totalEquityRequired > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
              Total equity required for this deal: <strong style={{ color: '#111827' }}>{fmt(dealUnderwriting.totalEquityRequired)}</strong>
            </div>
          )}
          <div>
            <label style={labelStyle}>Investor</label>
            <select style={selectStyle} value={allocForm.investor_id} onChange={e => setAllocForm({ ...allocForm, investor_id: e.target.value })}>
              <option value="">-- Select investor --</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.first_name} {inv.last_name} ({inv.email})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Commitment Amount</label>
              <input style={inputStyle} type="number" value={allocForm.commitment_amount} onChange={e => {
                const val = e.target.value;
                setAllocForm((f) => {
                  const next = { ...f, commitment_amount: val };
                  if (dealUnderwriting && dealUnderwriting.totalEquityRequired > 0) {
                    next.ownership_pct = ((parseFloat(val) || 0) / dealUnderwriting.totalEquityRequired * 100).toFixed(2);
                  }
                  return next;
                });
              }} placeholder="250000" />
            </div>
            <div>
              <label style={labelStyle}>Contributed Amount</label>
              <input style={inputStyle} type="number" value={allocForm.contributed_amount} onChange={e => setAllocForm({ ...allocForm, contributed_amount: e.target.value })} placeholder="250000" />
            </div>
            <div>
              <label style={labelStyle}>Ownership %{dealUnderwriting?.totalEquityRequired > 0 ? ' (auto)' : ''}</label>
              <input style={inputStyle} type="number" step="0.01" value={allocForm.ownership_pct} onChange={e => setAllocForm({ ...allocForm, ownership_pct: e.target.value })} placeholder="10" />
            </div>
            <div>
              <label style={labelStyle}>Preferred Return %</label>
              <input style={inputStyle} type="number" step="0.01" value={allocForm.preferred_return_pct} onChange={e => setAllocForm({ ...allocForm, preferred_return_pct: e.target.value })} placeholder="8" />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={btnGhost} onClick={() => setShowAddAllocation(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleAddAllocation}>Add to Deal</button>
        </div>
      </Modal>
    </div>
  );

  const renderDistributions = () => (
    <div>
      <h3 style={sectionTitle}>Distributions</h3>
      {dealSelector}

      {selectedDeal && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrimary} onClick={() => setShowAddDistribution(true)} disabled={allocations.length === 0}>
              <Plus size={14} /> Record Distribution
            </button>
          </div>

          {/* Summary cards */}
          {allocations.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              {allocations.map(a => {
                const inv = a.investors || {};
                const invDists = distributions.filter(d => d.deal_investor_id === a.id);
                const totalDist = invDists.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
                const roi = parseFloat(a.contributed_amount) > 0 ? (totalDist / parseFloat(a.contributed_amount)) * 100 : 0;
                return (
                  <div key={a.id} style={metricCard('#059669')}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{inv.first_name} {inv.last_name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{inv.email}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={subtle}>Contributed</div>
                        <div style={{ fontWeight: 600 }}>{fmt(a.contributed_amount)}</div>
                      </div>
                      <div>
                        <div style={subtle}>Distributed</div>
                        <div style={{ fontWeight: 600, color: '#059669' }}>{fmt(totalDist)}</div>
                      </div>
                      <div>
                        <div style={subtle}>ROI</div>
                        <div style={{ fontWeight: 600, color: roi > 0 ? '#059669' : '#6b7280' }}>{roi.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Distribution history */}
          {distributions.length > 0 ? (
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['Date', 'Investor', 'Type', 'Amount', 'Quarter', 'Memo', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distributions.map(d => {
                    const inv = d.deal_investors?.investors || {};
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px' }}>{d.distribution_date}</td>
                        <td style={{ padding: '10px 12px' }}>{inv.first_name} {inv.last_name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                            {(d.distribution_type || '').replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#059669' }}>{fmt(d.amount)}</td>
                        <td style={{ padding: '10px 12px' }}>{d.quarter || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{d.memo || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button style={btnDanger} onClick={() => handleDeleteDistribution(d.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: 32 }}>
              <p style={subtle}>No distributions recorded yet.</p>
            </div>
          )}
        </>
      )}

      {/* Add Distribution Modal */}
      <Modal show={showAddDistribution} onClose={() => setShowAddDistribution(false)} title="Record Distribution">
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Investor</label>
            <select style={selectStyle} value={distForm.deal_investor_id} onChange={e => setDistForm({ ...distForm, deal_investor_id: e.target.value })}>
              <option value="">-- Select investor --</option>
              {allocations.map(a => {
                const inv = a.investors || {};
                return <option key={a.id} value={a.id}>{inv.first_name} {inv.last_name} ({inv.email})</option>;
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" value={distForm.amount} onChange={e => setDistForm({ ...distForm, amount: e.target.value })} placeholder="5000" />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={distForm.distribution_date} onChange={e => setDistForm({ ...distForm, distribution_date: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={selectStyle} value={distForm.distribution_type} onChange={e => setDistForm({ ...distForm, distribution_type: e.target.value })}>
                <option value="cash_flow">Cash Flow</option>
                <option value="return_of_capital">Return of Capital</option>
                <option value="capital_gain">Capital Gain</option>
                <option value="refinance">Refinance Proceeds</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Quarter</label>
              <input style={inputStyle} value={distForm.quarter} onChange={e => setDistForm({ ...distForm, quarter: e.target.value })} placeholder="Q1 2025" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Memo</label>
            <input style={inputStyle} value={distForm.memo} onChange={e => setDistForm({ ...distForm, memo: e.target.value })} placeholder="Monthly cash flow distribution" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={btnGhost} onClick={() => setShowAddDistribution(false)}>Cancel</button>
          <button style={{ ...btnPrimary, background: '#059669' }} onClick={handleAddDistribution}>Record Distribution</button>
        </div>
      </Modal>
    </div>
  );

  const renderDocuments = () => (
    <div>
      <h3 style={sectionTitle}>K-1 & Investor Documents</h3>
      {dealSelector}

      {selectedDeal && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrimary} onClick={() => setShowUploadDoc(true)} disabled={allocations.length === 0}>
              <Upload size={14} /> Upload Document
            </button>
          </div>

          {documents.length > 0 ? (
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    {['File', 'Investor', 'Type', 'Tax Year', 'Quarter', 'Uploaded', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => {
                    const inv = doc.deal_investors?.investors || {};
                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={14} /> {doc.file_name}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{inv.first_name} {inv.last_name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: doc.document_type === 'k1' ? '#fef3c7' : '#dbeafe', color: doc.document_type === 'k1' ? '#92400e' : '#1d4ed8' }}>
                            {doc.document_type === 'k1' ? 'K-1' : doc.document_type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{doc.tax_year || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{doc.quarter || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button style={btnDanger} onClick={() => handleDeleteDoc(doc.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: 32 }}>
              <FileText size={48} style={{ color: '#d1d5db', marginBottom: 12 }} />
              <p style={subtle}>No documents uploaded yet. Upload K-1s, quarterly reports, or subscription agreements.</p>
            </div>
          )}
        </>
      )}

      {/* Upload Document Modal */}
      <Modal show={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Upload Document">
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Investor</label>
            <select style={selectStyle} value={docForm.deal_investor_id} onChange={e => setDocForm({ ...docForm, deal_investor_id: e.target.value })}>
              <option value="">-- Select investor --</option>
              {allocations.map(a => {
                const inv = a.investors || {};
                return <option key={a.id} value={a.id}>{inv.first_name} {inv.last_name} ({inv.email})</option>;
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Document Type</label>
              <select style={selectStyle} value={docForm.document_type} onChange={e => setDocForm({ ...docForm, document_type: e.target.value })}>
                <option value="k1">K-1</option>
                <option value="quarterly_report">Quarterly Report</option>
                <option value="subscription_agreement">Subscription Agreement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tax Year</label>
              <input style={inputStyle} type="number" value={docForm.tax_year} onChange={e => setDocForm({ ...docForm, tax_year: parseInt(e.target.value) })} />
            </div>
            <div>
              <label style={labelStyle}>Quarter</label>
              <input style={inputStyle} value={docForm.quarter} onChange={e => setDocForm({ ...docForm, quarter: e.target.value })} placeholder="Q1 2025" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>File</label>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={e => setDocFile(e.target.files[0])} style={{ fontSize: 13 }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={btnGhost} onClick={() => setShowUploadDoc(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleUploadDoc}>Upload</button>
        </div>
      </Modal>
    </div>
  );

  const renderUpdates = () => (
    <div>
      <h3 style={sectionTitle}>Quarterly Updates</h3>
      {dealSelector}

      {selectedDeal && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrimary} onClick={() => setShowAddUpdate(true)}>
              <Plus size={14} /> New Update
            </button>
          </div>

          {updates.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {updates.map(u => (
                <div key={u.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{u.title}</h4>
                      <div style={{ ...subtle, marginBottom: 8 }}>
                        {u.quarter && <span style={{ marginRight: 12 }}>{u.quarter}</span>}
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button style={btnDanger} onClick={() => handleDeleteUpdate(u.id)}><Trash2 size={12} /></button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{u.body}</p>
                  {u.metrics && Object.keys(u.metrics).length > 0 && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                      {Object.entries(u.metrics).map(([k, v]) => (
                        <div key={k}>
                          <div style={subtle}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ fontWeight: 600 }}>{typeof v === 'number' ? fmt(v) : v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: 32 }}>
              <Calendar size={48} style={{ color: '#d1d5db', marginBottom: 12 }} />
              <p style={subtle}>No updates posted yet. Keep your investors informed with quarterly updates.</p>
            </div>
          )}
        </>
      )}

      {/* New Update Modal */}
      <Modal show={showAddUpdate} onClose={() => setShowAddUpdate(false)} title="Post Quarterly Update">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={updateForm.title} onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })} placeholder="Q1 2025 Update" />
            </div>
            <div>
              <label style={labelStyle}>Quarter</label>
              <input style={inputStyle} value={updateForm.quarter} onChange={e => setUpdateForm({ ...updateForm, quarter: e.target.value })} placeholder="Q1 2025" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Update Content</label>
            <textarea style={{ ...inputStyle, minHeight: 150, resize: 'vertical' }} value={updateForm.body}
              onChange={e => setUpdateForm({ ...updateForm, body: e.target.value })}
              placeholder="Property is performing well. Occupancy at 95%. We completed the exterior renovations and are now moving to interior unit upgrades. Cash flow distributions continue as projected..." />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={btnGhost} onClick={() => setShowAddUpdate(false)}>Cancel</button>
          <button style={{ ...btnPrimary, background: '#059669' }} onClick={handleAddUpdate}>Post Update</button>
        </div>
      </Modal>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'investors': return renderInvestors();
      case 'deal-view': return renderDealView();
      case 'distributions': return renderDistributions();
      case 'documents': return renderDocuments();
      case 'updates': return renderUpdates();
      default: return renderOverview();
    }
  };

  return (
    <DashboardShell activeTab="investor-portal" title="Investor Portal">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Investor Portal</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Manage your LPs, track distributions, upload K-1s, and post quarterly updates</p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                  border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#059669' : '#6b7280',
                  borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                  marginBottom: -2, transition: 'all 0.15s',
                }}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Loading investor data...</div>
        ) : (
          renderContent()
        )}
      </div>
    </DashboardShell>
  );
}
