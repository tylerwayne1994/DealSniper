import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Upload, Download, Trash2,
  Eye, ClipboardCheck, Presentation,
  DollarSign, Home, X, StickyNote,
  Folder, FileCheck, BarChart3, AlertTriangle,
  ChevronRight, RefreshCw, Percent, Hash, Calendar,
  Phone, Mail, Layers, Lock, Link2, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadDeal, updateDeal } from '../lib/dealsService';
import { listAllocations, listDistributions } from '../lib/investorService';
import { buildDealRoomData, stripWrappingCodeFence } from '../lib/dealRoomData';
import { fetchDealRoomNarrative } from '../lib/dealRoomNarrativeService';
import BoardOfAdvisors from '../components/BoardOfAdvisors';
import DealChat from '../components/DealChat';
import InvestorDealRoom from '../components/dealroom/InvestorDealRoom';
import { computeDealMetrics, normalizeDealImages, computeDealScore, bandScore } from '../lib/dealMetrics';
import ShareWithInvestorPanel from '../components/dealroom/ShareWithInvestorPanel';
import DealRoomLayoutEditor from '../components/dealroom/DealRoomLayoutEditor';
import { getDealRoomLayout } from '../lib/dealRoomLayoutService';
import { uploadDealDocument } from '../lib/dealDocumentsService';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

// ============================================================================
// Constants & Helpers
// ============================================================================

const STAGE_COLORS = {
  sourced:      { bg: '#c4def6', text: '#1e3a5f', dot: '#579bfc' },
  underwritten: { bg: '#b6e9d1', text: '#15573a', dot: '#00c875' },
  loi:          { bg: '#d4c4f0', text: '#5b2e91', dot: '#a25ddc' },
  contract:     { bg: '#fdcb8a', text: '#7c3a07', dot: '#fdab3d' },
  financing:    { bg: '#c2f5ea', text: '#0d5e56', dot: '#66ccff' },
  closed:       { bg: '#a3e4b8', text: '#14532d', dot: '#037f4c' },
  dead:         { bg: '#f5bebe', text: '#7f1d1d', dot: '#e2445c' },
};

const STAGE_LABELS = {
  sourced: 'Sourced', underwritten: 'Underwritten', loi: 'LOI Sent',
  contract: 'Under Contract', financing: 'Financing Secured',
  closed: 'Closed', dead: 'Dead',
};

const DOC_CATEGORIES = [
  { value: 'all',           label: 'All Files',      color: '#576bfc' },
  { value: 'rent_roll',     label: 'Rent Roll',      color: '#00c875' },
  { value: 'business_plan', label: 'Business Plan',  color: '#a25ddc' },
  { value: 'loi',           label: 'LOI',            color: '#fdab3d' },
  { value: 'contract',      label: 'Contract',       color: '#e2445c' },
  { value: 'inspection',    label: 'Inspection',     color: '#0d9488' },
  { value: 'financials',    label: 'Financials',     color: '#0073ea' },
  { value: 'google_doc',    label: 'Google Doc',     color: '#1a73e8' },
  { value: 'google_sheet',  label: 'Google Sheet',   color: '#188038' },
  { value: 'other',         label: 'Other',          color: '#676879' },
];

const fmt$ = (v) => {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000)    return `${sign}$${(abs / 1000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
};

const fmt$full = (v) => {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v));
};

const fmtPct = (v) => (v == null || isNaN(v)) ? '—' : `${Number(v).toFixed(1)}%`;
const fmtX   = (v) => (v == null || isNaN(v)) ? '—' : `${Number(v).toFixed(2)}x`;

const fileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (type = '') => {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return '📊';
  if (type.includes('word') || type.includes('document')) return '📝';
  return '📁';
};

const normalizeGoogleDocCategory = (url, selected) => {
  if (!url) return selected || 'other';
  const u = url.toLowerCase();
  if (u.includes('docs.google.com/document/')) return 'google_doc';
  if (u.includes('docs.google.com/spreadsheets/')) return 'google_sheet';
  return selected || 'other';
};

// Simple financial score 0-10 (shared implementation lives in dealMetrics.js;
// aliasing here keeps existing call sites in this file unchanged).
const computeScore = computeDealScore;

// ============================================================================
// Sub-components
// ============================================================================

const BreakdownRow = ({ label, value, isTotal, color }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: isTotal ? '10px 0 4px' : '7px 0',
    borderTop: isTotal ? '1px solid #e6e9ef' : 'none',
  }}>
    <span style={{ fontSize: '13px', color: isTotal ? '#323338' : '#676879', fontWeight: isTotal ? '700' : '400' }}>{label}</span>
    <span style={{ fontSize: '13px', fontWeight: isTotal ? '700' : '500', color: color || (isTotal ? '#323338' : '#676879') }}>{value}</span>
  </div>
);

const ActionCard = ({ icon: Icon, label, desc, color, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '14px', borderRadius: '10px',
    backgroundColor: '#fff', border: '1px solid #e6e9ef',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 2px 8px ${color}22`; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e6e9ef'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{
      width: '38px', height: '38px', borderRadius: '8px',
      backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={18} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#323338' }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#9699a6', marginTop: '1px' }}>{desc}</div>
    </div>
    <ChevronRight size={14} color="#c3c6d4" style={{ marginLeft: 'auto', flexShrink: 0 }} />
  </button>
);

// ============================================================================
// Document Row
// ============================================================================
const DocRow = ({ doc, onDelete, onDownload, onToggleVisibility }) => {
  const cat = DOC_CATEGORIES.find(c => c.value === doc.category) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 14px', borderRadius: '8px', backgroundColor: '#fff',
      border: '1px solid #e6e9ef', transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <span style={{ fontSize: '24px', lineHeight: 1 }}>{fileIcon(doc.file_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#323338', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px',
            backgroundColor: `${cat.color}15`, color: cat.color,
          }}>{cat.label}</span>
          <span style={{ fontSize: '11px', color: '#9699a6' }}>{fileSize(doc.file_size)}</span>
          <span style={{ fontSize: '11px', color: '#9699a6' }}>
            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ''}
          </span>
        </div>
      </div>
      <label title="Show this file in the investor Deal Room document vault" style={{
        display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600',
        color: doc.visible_to_investors ? '#00c875' : '#9699a6', cursor: 'pointer', flexShrink: 0, userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={!!doc.visible_to_investors}
          onChange={() => onToggleVisibility(doc)}
          style={{ accentColor: '#00c875' }}
        />
        Investor vault
      </label>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={() => onDownload(doc)} title="Download / Open"
          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e6e9ef', backgroundColor: '#f6f7fb', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#323338' }}>
          <Download size={13} />
        </button>
        <button onClick={() => onDelete(doc)} title="Delete"
          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ffcdd2', backgroundColor: '#ffefef', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#d83a52' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// DealRoomPage
// ============================================================================
function DealRoomPage() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'onesheet');
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [docFilter, setDocFilter] = useState('all');
  const [docStoreMode, setDocStoreMode] = useState('table');
  const [externalDocUrl, setExternalDocUrl] = useState('');
  const [externalDocName, setExternalDocName] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [investorDataLoaded, setInvestorDataLoaded] = useState(false);
  // Business Plan document generation (Deal Room tab -> saved to Documents)
  const [generatingBusinessPlan, setGeneratingBusinessPlan] = useState(false);
  const [businessPlanMsg, setBusinessPlanMsg] = useState('');
  const [businessPlanMarkdown, setBusinessPlanMarkdown] = useState('');
  const businessPlanRenderRef = useRef(null);
  const [dealRoomLayout, setDealRoomLayout] = useState(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [editingLayout, setEditingLayout] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const fileInputRef = useRef(null);

  // ---- Load deal -----------------------------------------------------------
  useEffect(() => {
    const fetchDeal = async () => {
      setLoading(true);
      try {
        const d = await loadDeal(dealId);
        // eslint-disable-next-line no-console
        console.log('[BusinessPlan][load]', {
          routeDealId: dealId,
          loadedDealId: d?.dealId,
          address: d?.address,
          hasBusinessPlanColumn: !!d?.businessPlanMarkdown,
          businessPlanColumnLength: d?.businessPlanMarkdown?.length || 0,
          hasBusinessPlanInParsedData: !!d?.parsedData?.businessPlanMarkdown,
          businessPlanParsedDataLength: d?.parsedData?.businessPlanMarkdown?.length || 0,
        });
        setDeal(d);
        setNotes(d?.notes || '');
        const embeddedDocs = Array.isArray(d?.parsedData?.deal_room_documents) ? d.parsedData.deal_room_documents : [];
        if (embeddedDocs.length > 0) {
          setDocuments(embeddedDocs);
          setDocStoreMode('deal');
        }
      } catch (e) {
        console.error('Failed to load deal:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDeal();
  }, [dealId]);

  // ---- Load documents ------------------------------------------------------
  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const embeddedDocs = Array.isArray(deal?.parsedData?.deal_room_documents) ? deal.parsedData.deal_room_documents : [];
        setDocuments(embeddedDocs);
        setDocStoreMode('deal');
        setDocsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('deal_documents')
        .select('*')
        .eq('deal_id', dealId)
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (!error) {
        const tableDocs = data || [];
        const embeddedDocs = Array.isArray(deal?.parsedData?.deal_room_documents) ? deal.parsedData.deal_room_documents : [];
        if (tableDocs.length > 0) {
          setDocuments(tableDocs);
          setDocStoreMode('table');
        } else {
          setDocuments(embeddedDocs);
          setDocStoreMode(embeddedDocs.length > 0 ? 'deal' : 'table');
        }
      } else {
        const embeddedDocs = Array.isArray(deal?.parsedData?.deal_room_documents) ? deal.parsedData.deal_room_documents : [];
        setDocuments(embeddedDocs);
        setDocStoreMode('deal');
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
      const embeddedDocs = Array.isArray(deal?.parsedData?.deal_room_documents) ? deal.parsedData.deal_room_documents : [];
      setDocuments(embeddedDocs);
      setDocStoreMode('deal');
    } finally {
      setDocsLoading(false);
    }
  }, [dealId, deal?.parsedData]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Lazy-load the real per-deal investor allocations/distributions the
  // first time the Deal Room tab is opened (avoids an unnecessary call on
  // every page load, and requires the backend's Supabase service key).
  // Hard-capped with a client-side timeout: if the backend is slow/cold-
  // starting/unreachable, the request would otherwise hang forever with no
  // feedback and the "Building your Deal Room…" screen would never clear
  // (exactly the stuck-forever bug reported) — after 10s we give up and
  // show the room anyway with whatever loaded.
  useEffect(() => {
    if (activeTab !== 'dealroom' || investorDataLoaded) return;
    let cancelled = false;
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000));
    (async () => {
      try {
        const result = await Promise.race([
          Promise.all([
            listAllocations(dealId).catch(() => []),
            listDistributions(dealId).catch(() => []),
          ]),
          timeout,
        ]);
        if (result !== 'timeout') {
          const [a, d] = result;
          if (!cancelled) { setAllocations(a || []); setDistributions(d || []); }
        } else {
          console.warn('DealRoom: investor data load timed out after 10s, showing room anyway');
        }
      } catch (e) {
        console.warn('DealRoom: failed to load investor data', e);
      } finally {
        if (!cancelled) setInvestorDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, dealId, investorDataLoaded]);

  // Lazy-load the sponsor's saved widget layout (Comps/Market Data section
  // widgets, etc.) the first time the Deal Room tab is opened — falls back
  // to the backend's generated default if the sponsor hasn't customized it.
  // Same 10s hard timeout as above, for the same reason.
  useEffect(() => {
    if (activeTab !== 'dealroom' || dealRoomLayout || !dealId) return;
    let cancelled = false;
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000));
    (async () => {
      try {
        const result = await Promise.race([getDealRoomLayout(dealId), timeout]);
        if (result !== 'timeout') {
          if (!cancelled) setDealRoomLayout(result.layout);
        } else {
          console.warn('DealRoom: layout load timed out after 10s, showing room anyway');
        }
      } catch (e) {
        console.warn('DealRoom: failed to load layout', e);
      } finally {
        if (!cancelled) setLayoutLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, dealId, dealRoomLayout]);


  // Generate (or regenerate) the AI investment thesis, then cache it on the
  // deal record so it doesn't need to be regenerated on every visit.
  const handleGenerateNarrative = async () => {
    if (!deal?.scenarioData) {
      alert('This deal has no parsed data to generate a thesis from yet.');
      return;
    }
    setGeneratingNarrative(true);
    try {
      const narrative = await fetchDealRoomNarrative({
        scenarioData: deal.scenarioData,
        calculations: deal.scenarioData?.calculations,
      });
      const nextParsedData = { ...(deal.parsedData || {}), dealRoomNarrative: narrative };
      await updateDeal(dealId, { parsed_data: nextParsedData });
      setDeal((prev) => (prev ? { ...prev, parsedData: nextParsedData } : prev));
    } catch (e) {
      console.error('Failed to generate investment thesis:', e);
      alert('Failed to generate investment thesis: ' + e.message);
    } finally {
      setGeneratingNarrative(false);
    }
  };

  // Generate a full Business Plan document for this deal (uses the deal's
  // actual configured underwriting strategy + any saved OM/T12/etc. as
  // context — see backend/claude_chat.py's business-plan/generate-for-deal),
  // then renders the returned markdown off-screen, snapshots it to a real
  // multi-page PDF (same html2canvas+jsPDF pattern already used by
  // Pitch Deck / LOI / Contract PDF export elsewhere in this app), and
  // saves it straight onto this deal's Documents so it shows up in the
  // vault automatically — no separate page, no manual download+re-upload.
  const handleGenerateBusinessPlan = async () => {
    if (generatingBusinessPlan) return;
    setGeneratingBusinessPlan(true);
    setBusinessPlanMsg('Generating your business plan\u2026 this can take up to a minute.');
    // eslint-disable-next-line no-console
    console.log('[BusinessPlan][generate:request]', { dealId, currentDealAddress: deal?.address, currentDealUnits: deal?.units });
    try {
      const res = await fetch(`${API_BASE_URL}/api/claude-chat/business-plan/generate-for-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Failed to generate business plan');
      }

      // eslint-disable-next-line no-console
      console.log('[BusinessPlan][generate:response]', {
        dealId,
        currentDealAddress: deal?.address,
        returnedTitle: result.title,
        documentsAttached: result.documents_attached,
        rawMarkdownLength: result.markdown?.length || 0,
        rawMarkdownPreview: (result.markdown || '').slice(0, 300),
      });

      setBusinessPlanMsg('Rendering document\u2026');
      // Safety net: strip a raw ``` fence Claude sometimes wraps the whole
      // response in instead of the expected ```artifact:document: fence
      // (the backend already tries to strip it, but this doesn't depend on
      // that deploy having gone out).
      const cleanMarkdown = stripWrappingCodeFence(result.markdown);
      // eslint-disable-next-line no-console
      console.log('[BusinessPlan][generate:afterStrip]', {
        cleanedLength: cleanMarkdown.length,
        wasFenceStripped: cleanMarkdown.length !== (result.markdown || '').trim().length,
        cleanedPreview: cleanMarkdown.slice(0, 300),
      });
      setBusinessPlanMarkdown(cleanMarkdown);

      // Save the plan onto the deal itself so it shows up as its own
      // "Business Plan" section in the actual Deal Room view (not just a
      // downloadable file) — persisted immediately so it survives a reload,
      // and BEFORE the PDF/Documents step below so it's saved either way.
      // Prefer the dedicated `business_plan_markdown` column (see
      // backend/migrations/add_business_plan_columns.sql) so it's a real,
      // queryable Supabase field — but if that migration hasn't been run
      // yet against this project (column doesn't exist), fall back to
      // storing it inside parsed_data so the feature still works instead of
      // hard-failing.
      const generatedAt = new Date().toISOString();
      try {
        await updateDeal(dealId, { business_plan_markdown: cleanMarkdown, business_plan_generated_at: generatedAt });
        setDeal((prev) => (prev ? { ...prev, businessPlanMarkdown: cleanMarkdown, businessPlanGeneratedAt: generatedAt } : prev));
      } catch (colErr) {
        console.warn('business_plan_markdown column not available yet (run backend/migrations/add_business_plan_columns.sql) — falling back to parsed_data:', colErr);
        const nextParsedData = { ...(deal?.parsedData || {}), businessPlanMarkdown: cleanMarkdown };
        await updateDeal(dealId, { parsed_data: nextParsedData });
        setDeal((prev) => (prev ? { ...prev, parsedData: nextParsedData } : prev));
      }

      // Also export a PDF copy to Documents — best-effort: if this part
      // fails (e.g. a huge plan exceeding storage's size limit), the plan
      // has still been added to the Deal Room above, so don't treat that as
      // a total failure.
      try {
        // Let the off-screen container actually paint before snapshotting it.
        await new Promise((resolve) => setTimeout(resolve, 300));

        const html2canvas = (await import('html2canvas')).default;
        const jsPDF = (await import('jspdf')).default;

        const node = businessPlanRenderRef.current;
        if (!node) throw new Error('Could not render the document for export');

        // scale:2 PNG produced multi-hundred-MB "PDFs" for a long text
        // document (lossless PNG of a tall canvas) and blew past Supabase
        // Storage's max upload size. JPEG at scale 1.5 is dramatically
        // smaller and still perfectly readable for a text/table document.
        const canvas = await html2canvas(node, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        const imgData = canvas.toDataURL('image/jpeg', 0.85);

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const pdfBlob = pdf.output('blob');
        const MAX_UPLOAD_BYTES = 45 * 1024 * 1024; // stay comfortably under Supabase's default limit
        if (pdfBlob.size > MAX_UPLOAD_BYTES) {
          throw new Error(`Generated PDF is too large to save (${(pdfBlob.size / 1024 / 1024).toFixed(1)}MB)`);
        }
        const safeTitle = (result.title || `${deal?.address || 'Deal'} - Business Plan`).replace(/[^a-zA-Z0-9._ -]/g, '');
        const fileName = `${safeTitle}.pdf`;

        setBusinessPlanMsg('Saving PDF to Documents\u2026');
        await uploadDealDocument(dealId, pdfBlob, {
          fileName,
          category: 'business_plan',
        });
        await loadDocuments();

        setBusinessPlanMsg('Business plan added to the Deal Room and saved to Documents \u2713');
      } catch (pdfErr) {
        console.error('Business plan added to Deal Room, but PDF export failed:', pdfErr);
        setBusinessPlanMsg(`Business plan added to the Deal Room \u2713 (PDF copy for Documents failed: ${pdfErr.message})`);
      }
      setTimeout(() => setBusinessPlanMsg(''), 6000);
    } catch (e) {
      console.error('Failed to generate business plan:', e);
      setBusinessPlanMsg(`Failed to generate business plan: ${e.message}`);
    } finally {
      setGeneratingBusinessPlan(false);
      setBusinessPlanMarkdown('');
    }
  };

  const saveDocumentsToDealRecord = async (nextDocs) => {
    const nextParsedData = {
      ...(deal?.parsedData || {}),
      deal_room_documents: nextDocs,
    };
    await updateDeal(dealId, { parsed_data: nextParsedData });
    setDeal(prev => prev ? ({ ...prev, parsedData: nextParsedData }) : prev);
    setDocuments(nextDocs);
    setDocStoreMode('deal');
  };

  // Property photo upload/delete for the Deal Room's hero image + gallery.
  // The backend already persists these onto the deal's `images` column
  // (v2_underwriter/routes.py's upload/delete-images routes) — this just
  // keeps local state (and therefore normalizedImages/heroImage) in sync
  // without a full page reload.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  const handleUploadImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingImages(true);
    setImageUploadError('');
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const res = await fetch(API_ENDPOINTS.dealUploadImages(dealId), { method: 'POST', body: formData });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.detail || result.message || `Upload failed (${res.status})`);
      }
      setDeal((prev) => prev ? ({ ...prev, images: [...(prev.images || []), ...(result.uploaded || [])] }) : prev);
    } catch (e) {
      console.error('Failed to upload property photos:', e);
      setImageUploadError(e.message || 'Failed to upload photos');
    } finally {
      setUploadingImages(false);
    }
  };

  // Some pre-existing images (extracted before storage_path was reliably
  // tracked) have no storage_path — deleting those used to silently no-op.
  // ALSO: images can live in either deal.images (separately uploaded) or the
  // older deal.parsedData.images (populated straight from the parsed PDF),
  // and the two arrays have historically ended up with overlapping/duplicate
  // copies of the same photo. normalizeDealImages() is the single source of
  // truth for what's actually shown on screen (merged + de-duplicated) —
  // using it here too (instead of re-deriving a separate raw merge) keeps
  // `index` always aligned with what the user is looking at, and writing
  // the result back as one canonical `images` array (clearing
  // parsedData.images) cleans up the duplicates for good.
  const handleDeleteImage = async (storagePath, index) => {
    if (storagePath) {
      try {
        const res = await fetch(API_ENDPOINTS.dealDeleteImage(dealId), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storage_path: storagePath }),
        });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      } catch (e) {
        console.error('Failed to delete property photo from storage:', e);
        alert('Failed to delete photo: ' + e.message);
        return;
      }
    }
    if (index == null) return;

    const beforeImages = deal?.images || [];
    const beforeParsedData = deal?.parsedData || {};
    const merged = normalizeDealImages(deal).map((img) => ({ url: img.url, storage_path: img.storage_path }));
    const nextImages = merged.filter((_, i) => i !== index);
    const nextParsedData = { ...beforeParsedData, images: [] };

    setDeal((prev) => prev ? ({ ...prev, images: nextImages, parsedData: nextParsedData }) : prev);
    try {
      await updateDeal(dealId, { images: nextImages, parsed_data: nextParsedData });
    } catch (e) {
      console.error('Failed to save photo removal:', e);
      setDeal((prev) => prev ? ({ ...prev, images: beforeImages, parsedData: beforeParsedData }) : prev);
      alert('Failed to remove photo: ' + e.message);
    }
  };

  // Drag-to-reorder the property photo strip. Same normalizeDealImages-as-
  // source-of-truth approach as handleDeleteImage above — operates on the
  // merged, de-duplicated, on-screen order and writes back a single
  // canonical `images` array.
  const handleReorderImages = async (fromIndex, toIndex) => {
    const beforeImages = deal?.images || [];
    const beforeParsedData = deal?.parsedData || {};
    const merged = normalizeDealImages(deal).map((img) => ({ url: img.url, storage_path: img.storage_path }));
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= merged.length || toIndex >= merged.length) return;
    const reordered = [...merged];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const nextParsedData = { ...beforeParsedData, images: [] };

    setDeal((prev) => prev ? ({ ...prev, images: reordered, parsedData: nextParsedData }) : prev);
    try {
      await updateDeal(dealId, { images: reordered, parsed_data: nextParsedData });
    } catch (e) {
      console.error('Failed to save photo order:', e);
      setDeal((prev) => prev ? ({ ...prev, images: beforeImages, parsedData: beforeParsedData }) : prev);
    }
  };

  const persistDocumentRecord = async (record, userId) => {
    if (docStoreMode === 'table') {
      try {
        const { error } = await supabase
          .from('deal_documents')
          .insert({
            deal_id: dealId,
            user_id: userId,
            ...record,
            uploaded_at: record.uploaded_at || new Date().toISOString(),
          });
        if (!error) return true;
      } catch (e) {
        console.warn('deal_documents insert failed, falling back to deal record:', e);
      }
    }

    const current = Array.isArray(documents) ? documents : [];
    const fallbackDoc = {
      id: record.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...record,
      uploaded_at: record.uploaded_at || new Date().toISOString(),
    };
    await saveDocumentsToDealRecord([fallbackDoc, ...current]);
    return false;
  };

  // ---- Upload document -----------------------------------------------------
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError('You must be logged in to upload files.'); return; }

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`${file.name} exceeds the 50MB limit.`);
        continue;
      }
      setUploading(true);
      setUploadProgress(`Uploading ${file.name}…`);
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${user.id}/${dealId}/${Date.now()}_${safeName}`;

        // Try the dedicated docs bucket first, then fallback to existing image bucket.
        let activeBucket = 'deal-documents';
        let uploadError = null;
        let uploadSuccess = false;

        const first = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: false });
        if (!first.error) {
          uploadSuccess = true;
        } else {
          uploadError = first.error;
          activeBucket = 'deal-images';
          const second = await supabase.storage.from(activeBucket).upload(storagePath, file, { upsert: false });
          if (!second.error) {
            uploadSuccess = true;
            uploadError = null;
          } else {
            uploadError = second.error;
          }
        }

        if (!uploadSuccess) {
          throw uploadError || new Error('Storage upload failed');
        }

        const { data: urlData } = supabase.storage.from(activeBucket).getPublicUrl(storagePath);

        await persistDocumentRecord({
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          category: docCategory,
          storage_path: storagePath,
          bucket: activeBucket,
          public_url: urlData?.publicUrl || '',
          uploaded_at: new Date().toISOString(),
        }, user.id);
      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    setUploadProgress('');
    await loadDocuments();
  };

  // ---- Delete document -----------------------------------------------------
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"?`)) return;
    try {
      if (doc.storage_path) {
        const bucket = doc.bucket || 'deal-documents';
        await supabase.storage.from(bucket).remove([doc.storage_path]);
      }

      if (docStoreMode === 'table') {
        const { error } = await supabase.from('deal_documents').delete().eq('id', doc.id);
        if (!error) {
          setDocuments(prev => prev.filter(d => d.id !== doc.id));
          return;
        }
      }

      const nextDocs = (documents || []).filter(d => d.id !== doc.id);
      await saveDocumentsToDealRecord(nextDocs);
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // ---- Toggle a document's visibility in the investor Deal Room vault ------
  const handleToggleDocVisibility = async (doc) => {
    const nextVisible = !doc.visible_to_investors;
    try {
      if (docStoreMode === 'table') {
        const { error } = await supabase
          .from('deal_documents')
          .update({ visible_to_investors: nextVisible })
          .eq('id', doc.id);
        if (!error) {
          setDocuments(prev => prev.map(d => (d.id === doc.id ? { ...d, visible_to_investors: nextVisible } : d)));
          return;
        }
      }
      const nextDocs = (documents || []).map(d => (d.id === doc.id ? { ...d, visible_to_investors: nextVisible } : d));
      await saveDocumentsToDealRecord(nextDocs);
    } catch (e) {
      console.error('Failed to update document visibility:', e);
    }
  };

  // ---- Deal Room closing date (offering deadline shown to investors) ------
  const handleSetCloseDate = async (dateStr) => {
    const nextParsedData = { ...(deal?.parsedData || {}), dealRoomCloseDate: dateStr || null };
    try {
      await updateDeal(dealId, { parsed_data: nextParsedData });
      setDeal(prev => (prev ? { ...prev, parsedData: nextParsedData } : prev));
    } catch (e) {
      console.error('Failed to save closing date:', e);
    }
  };

  // ---- Download document ---------------------------------------------------
  const handleDownloadDoc = (doc) => {
    const target = doc.public_url || doc.external_url || doc.url;
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  // ---- Link import (Google Docs / Sheets / external) ----------------------
  const handleAddExternalDoc = async () => {
    const url = (externalDocUrl || '').trim();
    if (!url) return;

    try {
      const parsed = new URL(url);
      if (!parsed.protocol.startsWith('http')) {
        setUploadError('Please enter a valid http/https URL.');
        return;
      }
    } catch {
      setUploadError('Please enter a valid URL.');
      return;
    }

    setUploadError('');
    const { data: { user } } = await supabase.auth.getUser();
    const category = normalizeGoogleDocCategory(url, docCategory);
    const fileName = externalDocName?.trim() || (() => {
      if (category === 'google_doc') return 'Google Doc';
      if (category === 'google_sheet') return 'Google Sheet';
      return 'External Link';
    })();

    const record = {
      id: `ext-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file_name: fileName,
      file_size: 0,
      file_type: 'link/url',
      category,
      storage_path: '',
      public_url: url,
      external_url: url,
      uploaded_at: new Date().toISOString(),
    };

    if (user) {
      await persistDocumentRecord(record, user.id);
    } else {
      await saveDocumentsToDealRecord([record, ...(documents || [])]);
    }

    setExternalDocUrl('');
    setExternalDocName('');
    await loadDocuments();
  };

  // ---- Save notes ----------------------------------------------------------
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateDeal(dealId, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (e) {
      console.error('Save notes error:', e);
    } finally {
      setSavingNotes(false);
    }
  };

  // ---- Compute financial metrics -------------------------------------------
  // Shared implementation lives in lib/dealMetrics.js so the public investor
  // pitch-deck view (InvestorPitchDeckView.jsx) can compute identical metrics
  // from a deal object without duplicating this logic.
  const getMetrics = () => computeDealMetrics(deal);

  const metrics = getMetrics();
  const scoreData = computeScore({
    capRate: metrics.capRate,
    dscr: metrics.dscr,
    cashOnCash: metrics.cashOnCash,
    monthlyCF: metrics.monthlyCF,
    units: metrics.units,
  });

  const stage = deal?.dealStage || deal?.deal_stage || 'underwritten';
  const stageColor = STAGE_COLORS[stage] || STAGE_COLORS.underwritten;
  const filteredDocs = docFilter === 'all' ? documents : documents.filter(d => d.category === docFilter);

  // =========================================================================
  // RENDER
  // =========================================================================

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#579bfc' }} />
      </div>
    );
  }

  if (!deal) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle size={40} color="#fdab3d" style={{ marginBottom: '12px' }} />
          <p style={{ color: '#323338', fontSize: '16px', fontWeight: '600' }}>Deal not found</p>
          <button onClick={() => navigate('/pipeline')} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#579bfc', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  const normalizedImages = normalizeDealImages(deal);
  const heroImage = normalizedImages.length > 0 ? normalizedImages[0].url : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', fontFamily: 'Figtree, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ================================================================ */}
      {/* Header */}
      {/* ================================================================ */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e6e9ef', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/pipeline')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            border: '1px solid #e6e9ef', borderRadius: '8px', backgroundColor: 'transparent',
            color: '#323338', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#f6f7fb'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <ArrowLeft size={15} /> Pipeline
          </button>

          <div style={{ width: '1px', height: '28px', backgroundColor: '#e6e9ef' }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#323338', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                {deal.address || 'Untitled Deal'}
              </h1>
              <span style={{
                padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                backgroundColor: stageColor.bg, color: stageColor.text,
              }}>
                {STAGE_LABELS[stage]}
              </span>
              {deal.units && (
                <span style={{ backgroundColor: '#cce5ff', color: '#0073ea', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                  {deal.units} units
                </span>
              )}
            </div>
            {deal.brokerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#676879' }}>Broker: <strong style={{ color: '#323338' }}>{deal.brokerName}</strong></span>
                {deal.brokerPhone && <a href={`tel:${deal.brokerPhone}`} style={{ fontSize: '12px', color: '#579bfc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} />{deal.brokerPhone}</a>}
                {deal.brokerEmail && <a href={`mailto:${deal.brokerEmail}`} style={{ fontSize: '12px', color: '#579bfc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} />{deal.brokerEmail}</a>}
              </div>
            )}
          </div>

          {/* Header quick metrics */}
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
            {[
              { label: 'Ask Price', value: fmt$(metrics.price), color: '#323338' },
              { label: 'Cap Rate', value: fmtPct(metrics.capRate), color: metrics.capRate >= 6 ? '#00c875' : metrics.capRate >= 4 ? '#fdab3d' : '#e2445c' },
              { label: 'DSCR', value: fmtX(metrics.dscr), color: metrics.dscr >= 1.25 ? '#00c875' : metrics.dscr >= 1.0 ? '#fdab3d' : '#e2445c' },
              { label: 'Mo. Cash Flow', value: fmt$(metrics.monthlyCF), color: metrics.monthlyCF >= 0 ? '#00c875' : '#e2445c' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', minWidth: '70px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Two-column main layout */}
      {/* ================================================================ */}
      <div style={{ maxWidth: '1800px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', padding: '20px 24px', alignItems: 'start' }}>

        {/* ============================================================ */}
        {/* LEFT: Tabs */}
        {/* ============================================================ */}
        <div style={{ minWidth: 0 }}>
          {/* Tab nav */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: '#fff', borderRadius: '10px', padding: '5px', border: '1px solid #e6e9ef', width: 'fit-content' }}>
            {[
              { id: 'onesheet',  label: 'One Sheet',  icon: BarChart3 },
              { id: 'dealroom',  label: 'Deal Room',  icon: Presentation },
              { id: 'documents', label: `Documents${documents.length > 0 ? ` (${documents.length})` : ''}`, icon: Folder },
              { id: 'notes',     label: 'Notes',      icon: StickyNote },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 16px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: activeTab === id ? '#0073ea' : 'transparent',
                color: activeTab === id ? '#fff' : '#676879',
                boxShadow: activeTab === id ? '0 1px 4px rgba(0,115,234,0.3)' : 'none',
              }}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* ============================================================ */}
          {/* ONE SHEET TAB */}
          {/* ============================================================ */}
          {activeTab === 'onesheet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Hero image strip (if available) */}
              {heroImage && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', height: '220px', position: 'relative' }}>
                  <img src={heroImage} alt="Property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 50%)' }} />
                  <div style={{ position: 'absolute', bottom: '16px', left: '20px' }}>
                    <div style={{ color: '#fff', fontSize: '22px', fontWeight: '700' }}>{fmt$full(metrics.price)}</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{deal.address}</div>
                  </div>
                  {normalizedImages[0] && (
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(normalizedImages[0].storage_path, 0)}
                      title="Delete photo"
                      style={{
                        position: 'absolute', top: '10px', left: '10px',
                        width: '24px', height: '24px', borderRadius: '50%',
                        border: 'none', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0,
                      }}
                    >×</button>
                  )}
                  {normalizedImages.length > 1 && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                      {normalizedImages.slice(1, 5).map((img, i) => (
                        <div key={i} style={{ position: 'relative', width: '52px', height: '52px' }}>
                          <img src={img.url} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.8)' }} />
                          {(
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(img.storage_path, i + 1)}
                              title="Delete photo"
                              style={{
                                position: 'absolute', top: '-6px', right: '-6px',
                                width: '18px', height: '18px', borderRadius: '50%',
                                border: '2px solid #fff', backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: '11px', lineHeight: 1, padding: 0,
                              }}
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Key metrics grid */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#323338' }}>The Essentials</h3>
                  {/* Board of Advisors + Score badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <DealChat scenarioData={deal.scenarioData} calculations={metrics._full} />
                    <BoardOfAdvisors dealId={dealId} scenarioData={deal.scenarioData} analysis={metrics._full} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Overall Score</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: scoreData.color }}>{scoreData.score}<span style={{ fontSize: '14px', color: '#9699a6' }}>/10</span></div>
                    </div>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      border: `4px solid ${scoreData.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: `${scoreData.color}12`,
                    }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: scoreData.color }}>{scoreData.grade}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Units', value: metrics.units || '—', icon: Hash },
                    { label: 'Price / Unit', value: fmt$(metrics.pricePerUnit), icon: DollarSign },
                    { label: 'Year Built', value: metrics.yearBuilt || '—', icon: Calendar },
                    { label: 'Beds', value: metrics.beds || '—', icon: Home },
                    { label: 'Baths', value: metrics.baths || '—', icon: Home },
                    { label: 'Sq Ft', value: metrics.sqft ? Number(metrics.sqft).toLocaleString() : '—', icon: Layers },
                    { label: 'Down Pmt', value: fmtPct(metrics.downPct), icon: Percent },
                    { label: 'Interest Rate', value: fmtPct(metrics.interestRate), icon: Percent },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} style={{ backgroundColor: '#f6f7fb', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#323338' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Summary */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#323338' }}>Performance Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'Total Investment', value: fmt$(metrics.totalInvestment) },
                    { label: 'ROI (Annual)', value: fmtPct(metrics.roi), color: metrics.roi >= 0 ? '#00c875' : '#e2445c' },
                    { label: 'Cap Rate', value: fmtPct(metrics.capRate), color: metrics.capRate >= 6 ? '#00c875' : '#fdab3d' },
                    { label: 'Cash Flow (Mo.)', value: fmt$(metrics.monthlyCF), color: metrics.monthlyCF >= 0 ? '#00c875' : '#e2445c' },
                    { label: 'LTV', value: fmtPct(metrics.ltv) },
                    { label: 'Annual Income', value: fmt$(metrics.annualGrossRent) },
                    { label: 'Cash-on-Cash', value: fmtPct(metrics.cashOnCash), color: metrics.cashOnCash >= 8 ? '#00c875' : metrics.cashOnCash >= 4 ? '#fdab3d' : '#e2445c' },
                    { label: 'DSCR', value: fmtX(metrics.dscr), color: metrics.dscr >= 1.25 ? '#00c875' : metrics.dscr >= 1 ? '#fdab3d' : '#e2445c' },
                    { label: 'Vacancy Loss (Yr.)', value: fmt$(metrics.annualVacancyLoss) },
                    { label: 'Annual NOI', value: fmt$(metrics.annualNOI), color: '#323338' },
                    { label: 'Debt Service (Yr.)', value: fmt$(metrics.annualDebtService) },
                    { label: 'Monthly P&I', value: fmt$(metrics.monthlyPI) },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ borderRadius: '8px', padding: '12px 14px', backgroundColor: '#f6f7fb' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: color || '#323338' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials (synced from Results Overview model) */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#323338' }}>Financials</h3>
                <div style={{ marginBottom: '12px', fontSize: '12px', color: '#676879' }}>Income & Expenses</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e6e9ef' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: '#676879', textTransform: 'uppercase' }}>Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: '#676879', textTransform: 'uppercase' }}>Current Month</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: '#676879', textTransform: 'uppercase' }}>Current Year</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: '#4f46e5', textTransform: 'uppercase' }}>Pro Forma Month</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: '#4f46e5', textTransform: 'uppercase' }}>Pro Forma Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Rental Income', month: metrics.monthlyRent, year: metrics.annualGrossRent, color: '#111827' },
                        { label: 'Other Income', month: metrics.otherIncomeAnnual / 12, year: metrics.otherIncomeAnnual, color: '#111827' },
                        { label: 'Gross Operating Income (GOI)', month: metrics.grossOperatingIncome / 12, year: metrics.grossOperatingIncome, color: '#4f46e5', bold: true },
                        { label: 'Less: Vacancy Loss', month: -metrics.annualVacancyLoss / 12, year: -metrics.annualVacancyLoss, color: '#111827' },
                        { label: 'Effective Gross Income (EGI)', month: metrics.effectiveGrossIncome / 12, year: metrics.effectiveGrossIncome, color: '#4f46e5', bold: true },
                        { label: 'Operating Expenses', month: metrics.annualExpenses / 12, year: metrics.annualExpenses, color: '#111827' },
                        { label: 'Net Operating Income (NOI)', month: metrics.annualNOI / 12, year: metrics.annualNOI, color: '#16a34a', bold: true },
                        { label: 'Debt Service', month: metrics.monthlyPI, year: metrics.annualDebtService, color: '#111827' },
                        { label: 'Cash Flow (Bottom Line)', month: metrics.monthlyCF, year: metrics.monthlyCF * 12, color: metrics.monthlyCF >= 0 ? '#16a34a' : '#e2445c', bold: true, highlight: true },
                      ].map((row) => (
                        <tr key={row.label} style={{ borderBottom: '1px solid #eef1f6', backgroundColor: row.highlight ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: '10px', fontSize: '13px', color: row.color, fontWeight: row.bold ? 700 : 500 }}>{row.label}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', color: row.color, fontWeight: row.bold ? 700 : 600 }}>{fmt$full(row.month)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', color: row.color, fontWeight: row.bold ? 700 : 600 }}>{fmt$full(row.year)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', color: row.color, fontWeight: row.bold ? 700 : 600 }}>{fmt$full(row.month)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', color: row.color, fontWeight: row.bold ? 700 : 600 }}>{fmt$full(row.year)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Operating Ratios + Loan + Mortgage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', color: '#111827' }}>Key Operating Ratios</h3>
                  <BreakdownRow label="Internal Rate Of Return (IRR)" value={fmtPct(metrics.irr)} />
                  <BreakdownRow label="Equity Multiple (EM)" value={metrics.equityMultiple ? Number(metrics.equityMultiple).toFixed(2) : '—'} />
                  <BreakdownRow label="Capitalization Rate (CAP)" value={fmtPct(metrics.capRate)} />
                  <BreakdownRow label="Gross Rent Multiplier (GRM)" value={metrics.grm ? Number(metrics.grm).toFixed(2) : '—'} />
                  <BreakdownRow label="Net Income Multiplier (NIM)" value={metrics.nim ? Number(metrics.nim).toFixed(2) : '—'} />
                  <BreakdownRow label="Expense Ratio (ER)" value={fmtPct(metrics.expenseRatioPct)} />
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', color: '#111827' }}>Loan</h3>
                  <BreakdownRow label="Loan" value={`${fmt$full(metrics.loanAmount)} (${fmtPct(metrics.ltv)} LTV)`} />
                  <BreakdownRow label="Down Pymt" value={`${fmt$full(metrics.downPayment)} (${fmtPct(metrics.downPct)})`} />
                  <BreakdownRow label="Closing Cost" value={`${fmt$full(metrics.closingCosts)} (${fmtPct(metrics.price > 0 ? (metrics.closingCosts / metrics.price) * 100 : 0)})`} />
                  <BreakdownRow label="Closing Reserve" value={fmt$full(0)} />
                  <BreakdownRow label="Non-Financed CapEx" value={fmt$full(metrics.renovations || 0)} />
                  <BreakdownRow label="Total Equity" value={fmt$full(metrics.totalInvestment)} isTotal />
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', color: '#111827' }}>Mortgage</h3>
                  <BreakdownRow label="Avg Interest Rate" value={fmtPct(metrics.interestRate)} />
                  <BreakdownRow label="Debt Cost (DC)" value={fmt$full(metrics.annualDebtService)} />
                  <BreakdownRow label="Payment (month)" value={fmt$full(metrics.monthlyPI)} />
                  <div style={{ marginTop: '12px', backgroundColor: '#f8fafc', border: '1px solid #e6e9ef', borderRadius: '8px', padding: '10px 12px' }}>
                    <BreakdownRow label="DSCR" value={fmtX(metrics.dscr)} color={metrics.dscr >= 1.25 ? '#16a34a' : metrics.dscr >= 1 ? '#f59e0b' : '#e2445c'} />
                    <BreakdownRow label="Cash Flow After Debt" value={fmt$full(metrics.monthlyCF * 12)} color={metrics.monthlyCF >= 0 ? '#16a34a' : '#e2445c'} />
                  </div>
                </div>
              </div>

              {/* Project Valuation */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#111827' }}>Project Valuation</h3>
                <div style={{ marginBottom: '10px', fontSize: '12px', color: '#676879', fontStyle: 'italic' }}>Implied property value at each cap rate (Value = NOI ÷ Cap Rate)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px', color: '#676879', borderBottom: '2px solid #e6e9ef' }}>Cap Rate → Implied Value</th>
                        {(metrics.capRates || []).map((cr, idx) => (
                          <th key={cr} style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: idx === 3 ? '#4f46e5' : '#676879', borderBottom: idx === 3 ? '2px solid #4f46e5' : '2px solid #e6e9ef', backgroundColor: idx === 3 ? '#eef2ff' : 'transparent' }}>{cr.toFixed(2)}%</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #eef1f6' }}>
                        <td style={{ padding: '10px', fontSize: '12px', color: '#676879', fontWeight: 600 }}>Based on Starting NOI</td>
                        {(metrics.valuationStarting || []).map((v, idx) => (
                          <td key={`start-${idx}`} style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: idx === 3 ? '#4f46e5' : '#111827', backgroundColor: idx === 3 ? '#eef2ff' : 'transparent' }}>{fmt$full(v)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', fontSize: '12px', color: '#676879', fontWeight: 700 }}>Based on Optimized NOI</td>
                        {(metrics.valuationOptimized || []).map((v, idx) => (
                          <td key={`opt-${idx}`} style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: idx === 3 ? '#4f46e5' : '#111827', backgroundColor: idx === 3 ? '#eef2ff' : 'transparent' }}>{fmt$full(v)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Score Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Monthly Breakdown */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#323338' }}>Monthly Breakdown</h3>
                    <span style={{ fontSize: '11px', color: '#9699a6', fontStyle: 'italic' }}>Real-time</span>
                  </div>
                  <BreakdownRow label="Gross Rent" value={fmt$(metrics.monthlyRent)} color="#00c875" />
                  <BreakdownRow label="Principal & Interest" value={`-${fmt$(metrics.monthlyPI)}`} color="#e2445c" />
                  <BreakdownRow label="Property Taxes" value={`-${fmt$(metrics.monthlyTaxes)}`} color="#e2445c" />
                  <BreakdownRow label="Insurance" value={`-${fmt$(metrics.monthlyInsurance)}`} color="#e2445c" />
                  <BreakdownRow label="Maintenance" value={`-${fmt$(metrics.monthlyMaintenance)}`} color="#e2445c" />
                  <BreakdownRow label="Property Mgmt" value={`-${fmt$(metrics.monthlyMgmt)}`} color="#e2445c" />
                  <BreakdownRow label="Vacancy Reserve" value={`-${fmt$(metrics.monthlyVacancyReserve)}`} color="#e2445c" />
                  <BreakdownRow label="Net Cash Flow" value={fmt$(metrics.monthlyCF)} isTotal color={metrics.monthlyCF >= 0 ? '#00c875' : '#e2445c'} />
                </div>

                {/* Capital Needed */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', color: '#323338' }}>Capital Needed</h3>
                  <BreakdownRow label="Down Payment" value={fmt$(metrics.downPayment)} />
                  <BreakdownRow label="Closing Costs (~3%)" value={fmt$(metrics.closingCosts)} />
                  <BreakdownRow label="Renovation / CapEx" value={fmt$(metrics.renovations || 0)} />
                  <BreakdownRow label="Total Capital In" value={fmt$(metrics.totalInvestment)} isTotal />
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0faf4', borderRadius: '8px', border: '1px solid #b6e9d1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: '#676879' }}>Loan Amount</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#323338' }}>{fmt$full(metrics.loanAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#676879' }}>Interest Rate</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#323338' }}>{fmtPct(metrics.interestRate)}</span>
                    </div>
                  </div>

                  {/* Score bars */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#676879', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Score Breakdown</div>
                    {[
                      { label: 'Cap Rate', score: metrics.capRate != null ? bandScore(metrics.capRate, 3, 10) : 5 },
                      { label: 'DSCR',     score: metrics.dscr != null ? bandScore(metrics.dscr, 1.0, 2.0) : 5 },
                      { label: 'Cash-on-Cash', score: metrics.cashOnCash != null ? bandScore(metrics.cashOnCash, 0, 20) : 5 },
                    ].map(({ label, score }) => (
                      <div key={label} style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', color: '#676879' }}>{label}</span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#323338' }}>{score.toFixed(1)}</span>
                        </div>
                        <div style={{ height: '5px', backgroundColor: '#e6e9ef', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            width: `${(score / 10) * 100}%`,
                            backgroundColor: score >= 7 ? '#00c875' : score >= 5 ? '#fdab3d' : '#e2445c',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* DEAL ROOM TAB (investor-facing document) */}
          {/* ============================================================ */}
          {activeTab === 'dealroom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#676879' }}>
                  Closing date shown to investors
                  <input
                    type="date"
                    value={deal?.parsedData?.dealRoomCloseDate || ''}
                    onChange={(e) => handleSetCloseDate(e.target.value)}
                    style={{ fontSize: '12px', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '5px', color: '#374151' }}
                  />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleGenerateBusinessPlan}
                    disabled={generatingBusinessPlan || !(investorDataLoaded && layoutLoaded)}
                    title="Generate a full business plan document from this deal's actual underwriting strategy and save it to Documents"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      border: '1px solid #a7f3d0', background: '#fff', color: '#059669',
                      cursor: (generatingBusinessPlan || !(investorDataLoaded && layoutLoaded)) ? 'default' : 'pointer',
                      opacity: (generatingBusinessPlan || !(investorDataLoaded && layoutLoaded)) ? 0.6 : 1,
                    }}
                  >
                    <FileText size={13} /> {generatingBusinessPlan ? 'Generating\u2026' : 'Generate Business Plan'}
                  </button>
                  <button
                    onClick={() => setEditingLayout((v) => !v)}
                    disabled={!(investorDataLoaded && layoutLoaded)}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      border: '1px solid #d1d5db', background: editingLayout ? '#111827' : '#fff',
                      color: editingLayout ? '#fff' : '#374151',
                      cursor: (investorDataLoaded && layoutLoaded) ? 'pointer' : 'default',
                      opacity: (investorDataLoaded && layoutLoaded) ? 1 : 0.5,
                    }}
                  >
                    {editingLayout ? 'Preview' : 'Customize Layout'}
                  </button>
                  <ShareWithInvestorPanel dealId={dealId} />
                </div>
              </div>
              {businessPlanMsg && (
                <div style={{
                  fontSize: 12.5, padding: '8px 12px', borderRadius: 6, fontWeight: 500,
                  color: businessPlanMsg.startsWith('Failed') ? '#b91c1c' : '#065f46',
                  background: businessPlanMsg.startsWith('Failed') ? '#fef2f2' : '#ecfdf5',
                  border: `1px solid ${businessPlanMsg.startsWith('Failed') ? '#fecaca' : '#a7f3d0'}`,
                }}>
                  {businessPlanMsg}
                </div>
              )}
              {!(investorDataLoaded && layoutLoaded) ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '60px 24px', textAlign: 'center' }}>
                  <div style={{ width: '220px', height: '4px', margin: '0 auto 18px', borderRadius: '999px', backgroundColor: '#e6e9ef', overflow: 'hidden' }}>
                    <div className="dr-loading-bar" style={{ height: '100%', width: '40%', borderRadius: '999px', background: 'linear-gradient(90deg, #10b981, #059669)' }} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#676879', fontWeight: 600 }}>Building your Deal Room…</div>
                  <style>{`
                    @keyframes dr-loading-slide {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(350%); }
                    }
                    .dr-loading-bar { animation: dr-loading-slide 1.1s ease-in-out infinite; }
                  `}</style>
                </div>
              ) : editingLayout ? (
                <DealRoomLayoutEditor
                  dealId={dealId}
                  initialLayout={dealRoomLayout}
                  scenarioData={deal?.scenarioData || deal?.parsedData}
                  onSaved={(layout) => { setDealRoomLayout(layout); setEditingLayout(false); }}
                  onClose={() => setEditingLayout(false)}
                />
              ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', overflow: 'hidden' }}>
                <InvestorDealRoom
                  embedded
                  data={buildDealRoomData({
                    deal,
                    full: metrics._full,
                    metrics,
                    allocations,
                    distributions,
                    images: normalizedImages.map((img) => ({ url: img.url, storage_path: img.storage_path })),
                    narrative: deal?.parsedData?.dealRoomNarrative || null,
                  })}
                  full={metrics._full}
                  metrics={metrics}
                  scenarioData={deal?.scenarioData || deal?.parsedData}
                  documents={(documents || []).filter((d) => d.visible_to_investors)}
                  layout={dealRoomLayout}
                  closeDate={deal?.parsedData?.dealRoomCloseDate}
                  onGenerateNarrative={handleGenerateNarrative}
                  generatingNarrative={generatingNarrative}
                  onUploadImages={handleUploadImages}
                  onDeleteImage={handleDeleteImage}
                  onReorderImages={handleReorderImages}
                  uploadingImages={uploadingImages}
                  imageUploadError={imageUploadError}
                />
              </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* DOCUMENTS TAB */}
          {/* ============================================================ */}
          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Upload area */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${dragOver ? '#0073ea' : '#c3c6d4'}`,
                  borderRadius: '12px', backgroundColor: dragOver ? '#e6f0ff' : '#fff',
                  padding: '32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                  onChange={e => handleUpload(e.target.files)} />
                {uploading ? (
                  <div>
                    <RefreshCw size={28} color="#0073ea" style={{ animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
                    <div style={{ fontSize: '14px', color: '#0073ea', fontWeight: '600' }}>{uploadProgress}</div>
                  </div>
                ) : (
                  <>
                    <Upload size={32} color="#c3c6d4" style={{ marginBottom: '10px' }} />
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#323338', marginBottom: '4px' }}>
                      Drop files here or click to upload
                    </div>
                    <div style={{ fontSize: '12px', color: '#9699a6' }}>Rent rolls, contracts, LOIs, business plans, inspections — up to 50MB each</div>
                  </>
                )}
              </div>

              {/* Category selector + error */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#676879', whiteSpace: 'nowrap' }}>Upload as:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DOC_CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                    <button key={cat.value} onClick={() => setDocCategory(cat.value)} style={{
                      padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', border: '1px solid',
                      borderColor: docCategory === cat.value ? cat.color : '#e6e9ef',
                      backgroundColor: docCategory === cat.value ? `${cat.color}15` : '#fff',
                      color: docCategory === cat.value ? cat.color : '#676879',
                      transition: 'all 0.1s',
                    }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* External URL import */}
              <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e6e9ef', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#676879', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Import Link (Google Docs / Sheets)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={externalDocUrl}
                    onChange={e => setExternalDocUrl(e.target.value)}
                    placeholder="Paste Google Docs or Sheets URL"
                    style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #d0d4e4', fontSize: '13px', color: '#323338', outline: 'none' }}
                  />
                  <input
                    type="text"
                    value={externalDocName}
                    onChange={e => setExternalDocName(e.target.value)}
                    placeholder="Display name (optional)"
                    style={{ padding: '9px 10px', borderRadius: '8px', border: '1px solid #d0d4e4', fontSize: '13px', color: '#323338', outline: 'none' }}
                  />
                  <button
                    onClick={handleAddExternalDoc}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                  >
                    <Link2 size={13} /> Add Link
                  </button>
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#9699a6' }}>
                  Paste URLs like docs.google.com/document/... or docs.google.com/spreadsheets/....
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#9699a6' }}>
                {docStoreMode === 'table'
                  ? 'Document metadata is stored in deal_documents.'
                  : 'Using embedded deal storage fallback for documents.'}
              </div>

              {uploadError && (
                <div style={{ padding: '10px 14px', backgroundColor: '#ffefef', borderRadius: '8px', border: '1px solid #ffcdd2', fontSize: '13px', color: '#d83a52', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} /> {uploadError}
                  <button onClick={() => setUploadError('')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d83a52' }}><X size={13} /></button>
                </div>
              )}

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DOC_CATEGORIES.map(cat => {
                  const count = cat.value === 'all' ? documents.length : documents.filter(d => d.category === cat.value).length;
                  if (cat.value !== 'all' && count === 0) return null;
                  return (
                    <button key={cat.value} onClick={() => setDocFilter(cat.value)} style={{
                      padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', border: '1px solid',
                      borderColor: docFilter === cat.value ? cat.color : '#e6e9ef',
                      backgroundColor: docFilter === cat.value ? `${cat.color}15` : '#fff',
                      color: docFilter === cat.value ? cat.color : '#676879',
                      transition: 'all 0.1s',
                    }}>
                      {cat.label} {count > 0 && <span style={{ fontWeight: '700' }}>({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* File list */}
              {docsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9699a6' }}>
                  <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#579bfc' }} />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px dashed #e6e9ef' }}>
                  <Folder size={40} color="#c3c6d4" style={{ marginBottom: '12px' }} />
                  <p style={{ margin: 0, color: '#9699a6', fontSize: '14px', fontWeight: '600' }}>No documents yet</p>
                  <p style={{ margin: '4px 0 0 0', color: '#c3c6d4', fontSize: '12px' }}>Upload rent rolls, contracts, LOIs and more</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredDocs.map(doc => (
                    <DocRow key={doc.id} doc={doc} onDelete={handleDeleteDoc} onDownload={handleDownloadDoc} onToggleVisibility={handleToggleDocVisibility} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* NOTES TAB */}
          {/* ============================================================ */}
          {activeTab === 'notes' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#323338' }}>Deal Notes</h3>
                <button onClick={handleSaveNotes} disabled={savingNotes} style={{
                  padding: '7px 18px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '700',
                  cursor: savingNotes ? 'default' : 'pointer',
                  backgroundColor: notesSaved ? '#00c875' : '#0073ea', color: '#fff',
                  transition: 'background 0.2s',
                }}>
                  {savingNotes ? 'Saving…' : notesSaved ? '✓ Saved' : 'Save Notes'}
                </button>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add deal notes here — strategy, lender contacts, observations, next steps…"
                style={{
                  width: '100%', minHeight: '320px', padding: '14px', borderRadius: '8px',
                  border: '1px solid #e6e9ef', fontSize: '14px', color: '#323338',
                  resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box', backgroundColor: '#fafbfc',
                }}
                onFocus={e => e.target.style.borderColor = '#0073ea'}
                onBlur={e => e.target.style.borderColor = '#e6e9ef'}
              />
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#9699a6' }}>
                Notes are saved to your deal in Supabase. They are private to your account.
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT: Quick Actions Panel */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Open Underwriting */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
              Underwriting
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => navigate(`/underwrite?viewDeal=${dealId}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 14px',
                  borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #00854d, #00c875)',
                  color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', textAlign: 'left',
                }}
              >
                <Eye size={16} /> View Full Underwriting
              </button>
            </div>
          </div>

          {/* Deal Tools */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
              Deal Tools
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ActionCard icon={Presentation} label="Deal Room"      desc="Investor presentation"        color="#579bfc" onClick={() => setActiveTab('dealroom')} />
              <ActionCard icon={ClipboardCheck} label="Due Diligence" desc="Checklist & tracker"         color="#fdab3d" onClick={() => navigate(`/due-diligence?dealId=${dealId}`)} />
              <ActionCard icon={FileCheck}   label="Contracts"      desc="Purchase agreements"           color="#0d9488" onClick={() => navigate(`/contract?dealId=${dealId}`)} />
            </div>
          </div>

          {/* Documents quick access */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Document Storage
              </div>
              <button onClick={() => setActiveTab('documents')} style={{
                fontSize: '11px', fontWeight: '700', color: '#0073ea', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px',
              }}>
                View all →
              </button>
            </div>
            {documents.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#f6f7fb', borderRadius: '8px', textAlign: 'center' }}>
                <Lock size={18} color="#c3c6d4" style={{ marginBottom: '6px' }} />
                <div style={{ fontSize: '12px', color: '#9699a6', fontWeight: '500' }}>No documents uploaded</div>
                <button onClick={() => { setActiveTab('documents'); }} style={{
                  marginTop: '8px', fontSize: '12px', fontWeight: '700', color: '#0073ea', border: 'none', background: 'transparent', cursor: 'pointer',
                }}>
                  + Upload files
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {documents.slice(0, 5).map(doc => {
                  const cat = DOC_CATEGORIES.find(c => c.value === doc.category) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      onClick={() => doc.public_url && window.open(doc.public_url, '_blank', 'noopener,noreferrer')}>
                      <span style={{ fontSize: '16px' }}>{fileIcon(doc.file_type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#323338', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: cat.color }}>{cat.label}</span>
                      </div>
                    </div>
                  );
                })}
                {documents.length > 5 && (
                  <button onClick={() => setActiveTab('documents')} style={{
                    fontSize: '12px', fontWeight: '700', color: '#0073ea', border: 'none', background: 'transparent', cursor: 'pointer', paddingTop: '4px',
                  }}>
                    +{documents.length - 5} more files →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stage tracker */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9699a6', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
              Deal Stage
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'].map((s, i, arr) => {
                const isCurrent = s === stage;
                const isPast = arr.indexOf(stage) > i && stage !== 'dead';
                const c = STAGE_COLORS[s];
                return (
                  <div key={s} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px',
                    backgroundColor: isCurrent ? c.bg : 'transparent',
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: isCurrent ? c.dot : isPast ? '#c3c6d4' : '#e6e9ef',
                    }} />
                    <span style={{
                      fontSize: '12px', fontWeight: isCurrent ? '700' : '500',
                      color: isCurrent ? c.text : '#9699a6',
                    }}>
                      {STAGE_LABELS[s]}
                    </span>
                    {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', color: c.dot }}>CURRENT</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Off-screen render target for the Business Plan PDF snapshot (see
          handleGenerateBusinessPlan) — must be a real, painted element for
          html2canvas to capture, so it's positioned off-screen rather than
          display:none/unmounted. Fixed pixel width so the PDF's page
          proportions come out consistent regardless of viewport size. */}
      {businessPlanMarkdown && (
        <div style={{ position: 'fixed', top: 0, left: '-99999px', width: '780px', zIndex: -1 }}>
          <div
            ref={businessPlanRenderRef}
            style={{
              width: '780px', padding: '48px 56px', background: '#ffffff', color: '#111827',
              fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '14px', lineHeight: 1.6,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1F4E79', margin: '0 0 16px' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1F4E79', margin: '28px 0 12px', borderBottom: '2px solid #1F4E79', paddingBottom: 6 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2E75B6', margin: '18px 0 8px' }}>{children}</h3>,
                p: (p) => <p style={{ margin: '0 0 10px' }} {...p} />,
                li: (p) => <li style={{ marginBottom: 4 }} {...p} />,
                table: (p) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 16px', fontSize: 13 }} {...p} />,
                th: (p) => <th style={{ background: '#1F4E79', color: '#fff', padding: '6px 10px', textAlign: 'left', border: '1px solid #d1d5db' }} {...p} />,
                td: (p) => <td style={{ padding: '6px 10px', border: '1px solid #d1d5db' }} {...p} />,
              }}
            >
              {businessPlanMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default DealRoomPage;
