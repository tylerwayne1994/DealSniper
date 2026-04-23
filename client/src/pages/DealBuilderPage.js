// Deal Builder — Two-column: Chat + Spreadsheet Underwriting Workbook
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Upload, FileText, Loader, CheckCircle, Download,
  Layers, ExternalLink, AlertCircle, Maximize2, Minimize2, BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';

async function wakeBackend() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 45000);
    await fetch(`${API_BASE}/health`, { method: 'GET', mode: 'no-cors', signal: c.signal });
    clearTimeout(t);
  } catch { /* wake-up ping */ }
}

/* ───────────────────────── format helpers ───────────────── */
const pct  = (v) => v != null && v !== 0 ? (typeof v === 'number' && Math.abs(v) < 1 ? (v * 100).toFixed(1) + '%' : Number(v).toFixed(1) + '%') : '—';
const dollar = (v) => v != null && v !== 0 ? '$' + Math.round(v).toLocaleString() : '—';
const neg    = (v) => v != null && v !== 0 ? '($' + Math.abs(Math.round(v)).toLocaleString() + ')' : '—';

/* ─────────── Editable Cell ─────────────── */
function EditableCell({ value, cellKey, overrides, onEdit, isTotal, isNeg }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const display = overrides?.[cellKey] !== undefined ? overrides[cellKey] : value;
  const isOverridden = overrides?.[cellKey] !== undefined;

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const startEdit = () => {
    // Strip formatting to get raw value for editing
    const raw = String(display).replace(/[$,%()\s]/g, '').replace(/,/g, '');
    setDraft(raw === '—' ? '' : raw);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft.trim() === '' || draft === String(value).replace(/[$,%()\s]/g, '').replace(/,/g, '')) {
      // Reset to original if empty or unchanged
      if (onEdit) onEdit(cellKey, undefined);
    } else {
      if (onEdit) onEdit(cellKey, draft.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-0.5 text-[12.5px] text-right tabular-nums bg-white border border-blue-400 rounded outline-none ring-2 ring-blue-100"
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      className={`cursor-pointer hover:bg-blue-100/50 rounded px-1 -mx-1 transition-colors ${isOverridden ? 'text-blue-600 underline decoration-blue-300 decoration-dotted underline-offset-2' : ''}`}
    >
      {display || '—'}
    </span>
  );
}

/* ─────────── Spreadsheet Section Component ─────────────── */
function SheetSection({ title, rows, columns, accent, sectionIdx, overrides, onCellEdit }) {
  const colCount = columns ? columns.length : 1;
  const gridCols = `minmax(220px,2.5fr) repeat(${colCount},minmax(100px,1fr))`;
  return (
    <div className="mb-3 mx-3 rounded-xl overflow-hidden border border-gray-200/80 shadow-sm">
      {/* Section header */}
      <div className={`px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase select-none ${accent ? 'bg-gradient-to-r from-[#1e293b] to-[#334155] text-white' : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border-b border-gray-200/60'}`}>
        {title}
      </div>
      {/* Column headers */}
      {columns && columns.length > 0 && (
        <div className="grid bg-gray-50/80 border-b border-gray-200/60" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-4 py-1.5" />
          {columns.map((c, i) => (
            <div key={i} className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-right select-none">{c}</div>
          ))}
        </div>
      )}
      {/* Rows */}
      {rows.map((row, i) => {
        const isTotal = row.total;
        const isSub = row.sub;
        if (row.label === ' ') return <div key={i} className="h-1.5 bg-gray-50/50" />;
        return (
          <div
            key={i}
            className={`grid transition-colors duration-150 ${isTotal ? 'bg-gradient-to-r from-slate-50 to-blue-50/40 border-b-2 border-gray-300/60' : 'border-b border-gray-100 hover:bg-blue-50/30'}`}
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className={`px-4 py-[7px] text-[12.5px] truncate ${isTotal ? 'font-bold text-slate-800' : isSub ? 'font-semibold text-slate-700' : 'text-slate-500 pl-6'}`}>
              {row.label}
            </div>
            {row.values ? row.values.map((v, j) => {
              const ck = `${sectionIdx}-${i}-${j}`;
              return (
                <div key={j} className={`px-4 py-[7px] text-[13px] text-right tabular-nums ${isTotal ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'} ${typeof v === 'string' && v.startsWith('(') ? '!text-rose-500' : ''}`}>
                  <EditableCell value={v} cellKey={ck} overrides={overrides} onEdit={onCellEdit} isTotal={isTotal} />
                </div>
              );
            }) : (
              <div className={`px-4 py-[7px] text-[13px] text-right tabular-nums ${isTotal ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'} ${typeof row.value === 'string' && row.value.startsWith('(') ? '!text-rose-500' : ''}`}>
                <EditableCell value={row.value || '—'} cellKey={`${sectionIdx}-${i}-0`} overrides={overrides} onEdit={onCellEdit} isTotal={isTotal} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────── Build workbook sections from parsed deal ──────── */
function buildWorkbook(d) {
  if (!d) return null;
  const fin = d.financials || {};
  const exp = d.expenses || {};
  const inc = d.income || {};
  const prop = d.property || {};
  const units = prop.units || 0;

  const askingPrice = fin.asking_price || 0;
  const downPct = 0.25;
  const loanAmt = askingPrice * (1 - downPct);
  const downAmt = askingPrice * downPct;
  const rate = 0.07;
  const amort = 25;
  const mp = loanAmt > 0 ? (loanAmt * (rate / 12)) / (1 - Math.pow(1 + rate / 12, -amort * 12)) : 0;
  const annualDS = mp * 12;

  const origFee = loanAmt * 0.01;
  const closingCosts = askingPrice * 0.02;
  const inspDD = 5000;
  const reserve3mo = (exp.taxes || 0) / 4 + (exp.insurance || 0) / 4 + mp * 3;
  const totalCash = downAmt + origFee + closingCosts + inspDD + reserve3mo;

  const gpr = fin.gross_potential_rent || inc.rental_income || 0;
  const vacRate = 0.06;
  const vacLoss = gpr * vacRate;
  const otherInc = inc.other_income || 0;
  const egi = gpr - vacLoss + otherInc;

  const taxes = exp.taxes || 0;
  const insurance = exp.insurance || 0;
  const utils = (exp.utilities || 0) + (exp.water_sewer || 0);
  const trash = exp.trash || 0;
  const rm = exp.repairs_maintenance || 0;
  const mgmt = exp.management_fee || egi * 0.08;
  const payroll = exp.payroll || 0;
  const marketing = exp.marketing || 0;
  const admin = exp.admin || 0;
  const capex = units * 500;
  const otherExp = exp.other || 0;
  const totalExp = taxes + insurance + utils + trash + rm + mgmt + payroll + marketing + admin + capex + otherExp;

  const taxReassessed = askingPrice * 0.0163;
  const noiDay1 = egi - totalExp;
  const rubsRecovery = utils * 0.9;
  const trashShift = trash;
  const rentBump = units * 40 * 12;
  const stabExpDelta = rubsRecovery + trashShift - (taxReassessed - taxes);
  const noiStab = noiDay1 + rubsRecovery + trashShift + rentBump - (taxReassessed - taxes);

  const cfDay1 = noiDay1 - annualDS;
  const cfStab = noiStab - annualDS;

  const dscr = annualDS > 0 ? noiDay1 / annualDS : 0;
  const dscrStab = annualDS > 0 ? noiStab / annualDS : 0;
  const capRate = askingPrice > 0 ? noiDay1 / askingPrice : 0;
  const capRateStab = askingPrice > 0 ? noiStab / askingPrice : 0;
  const grm = gpr > 0 ? askingPrice / gpr : 0;
  const ppu = units > 0 ? askingPrice / units : 0;
  const expRatio = egi > 0 ? totalExp / egi : 0;
  const coc = totalCash > 0 ? cfDay1 / totalCash : 0;
  const cocStab = totalCash > 0 ? cfStab / totalCash : 0;

  const refiCap = 0.085;
  const stabValue = noiStab > 0 ? noiStab / refiCap : 0;
  const ltvAmts = [0.65, 0.70, 0.75, 0.80].map(l => stabValue * l);
  const refiRate = 0.065;
  const refiAmort = 30;
  const refiPmt = (a) => a > 0 ? (a * (refiRate / 12)) / (1 - Math.pow(1 + refiRate / 12, -refiAmort * 12)) : 0;
  const refiCF = (a) => (noiStab - refiPmt(a) * 12) / 12;

  const investorPrincipal = totalCash;
  const bonus = investorPrincipal * 0.15;
  const totalToInvestor = investorPrincipal + bonus;
  const cashOut75 = ltvAmts[2] - loanAmt;
  const netAfter = cashOut75 - totalToInvestor;
  const covers = cashOut75 >= totalToInvestor;
  const investorROI = investorPrincipal > 0 ? totalToInvestor / investorPrincipal - 1 : 0;

  return [
    {
      title: '1. Deal Assumptions', accent: true,
      rows: [
        { label: 'Purchase Price', value: dollar(askingPrice), sub: true },
        { label: 'Down Payment %', value: pct(downPct) },
        { label: 'Loan Amount', value: dollar(loanAmt) },
        { label: 'Down Payment $', value: dollar(downAmt) },
        { label: 'Interest Rate', value: pct(rate) },
        { label: 'Amortization', value: amort + ' years' },
        { label: 'Monthly Debt Service', value: dollar(mp) },
        { label: 'Annual Debt Service', value: dollar(annualDS), total: true },
      ]
    },
    {
      title: '2. Acquisition Costs',
      rows: [
        { label: 'Origination Fee (1% of loan)', value: dollar(origFee) },
        { label: 'Closing Costs (title, attorney)', value: dollar(closingCosts) },
        { label: 'Inspection / Due Diligence', value: dollar(inspDD) },
        { label: '3-Month Payment Reserve', value: dollar(reserve3mo) },
        { label: 'TOTAL CASH NEEDED (INVESTOR)', value: dollar(totalCash), total: true },
      ]
    },
    {
      title: '3. Income Assumptions',
      rows: [
        { label: 'Gross Potential Rent', value: dollar(gpr), sub: true },
        { label: 'Vacancy & Credit Loss (' + pct(vacRate) + ')', value: neg(vacLoss) },
        { label: 'Other Income', value: dollar(otherInc) },
        { label: 'Effective Gross Income', value: dollar(egi), total: true },
        { label: 'RUBS — Water + Gas (est.)', value: dollar(rubsRecovery) },
        { label: 'CapEx Reserve ($500/unit)', value: neg(capex) },
      ]
    },
    {
      title: '4. Income Statement', columns: ['Day 1', 'Stabilized'],
      rows: [
        { label: 'Gross Potential Rent', values: [dollar(gpr), dollar(gpr + rentBump)] },
        { label: 'Vacancy & Credit Loss', values: [neg(vacLoss), neg((gpr + rentBump) * vacRate)] },
        { label: 'RUBS / Utility Recovery', values: ['—', dollar(rubsRecovery)] },
        { label: 'Other Income', values: [dollar(otherInc), dollar(otherInc)] },
        { label: 'TOTAL OPERATING INCOME', values: [dollar(egi), dollar(gpr + rentBump - (gpr + rentBump) * vacRate + rubsRecovery + otherInc)], total: true },
        { label: ' ', values: ['', ''] },
        { label: 'Property Taxes', values: [dollar(taxes), dollar(taxReassessed)] },
        { label: 'Insurance', values: [dollar(insurance), dollar(insurance)] },
        { label: 'Utilities (owner-paid)', values: [dollar(utils), dollar(Math.max(0, utils - rubsRecovery))] },
        { label: 'Trash / Contract', values: [dollar(trash), dollar(0)] },
        { label: 'Repairs & Maintenance', values: [dollar(rm), dollar(rm)] },
        { label: 'Management Fee', values: [dollar(mgmt), dollar(mgmt)] },
        { label: 'Payroll', values: [dollar(payroll), dollar(payroll)] },
        { label: 'Marketing', values: [dollar(marketing), dollar(marketing)] },
        { label: 'Admin / Other', values: [dollar(admin + otherExp), dollar(admin + otherExp)] },
        { label: 'CapEx Reserve ($500/unit)', values: [dollar(capex), dollar(capex)] },
        { label: 'TOTAL OPERATING EXPENSES', values: [dollar(totalExp), dollar(totalExp - stabExpDelta)], total: true },
        { label: ' ', values: ['', ''] },
        { label: 'NET OPERATING INCOME (NOI)', values: [dollar(noiDay1), dollar(noiStab)], total: true },
      ]
    },
    {
      title: '5. Debt Service & Cash Flow', columns: ['Day 1', 'Stabilized'],
      rows: [
        { label: 'Annual Debt Service', values: [neg(annualDS), neg(annualDS)] },
        { label: 'CASH FLOW BEFORE TAX', values: [dollar(cfDay1), dollar(cfStab)], total: true },
        { label: 'Monthly Cash Flow', values: [dollar(cfDay1 / 12), dollar(cfStab / 12)] },
      ]
    },
    {
      title: '6. Key Metrics', columns: ['Day 1', 'Stabilized'],
      rows: [
        { label: 'DSCR', values: [dscr.toFixed(2) + 'x', dscrStab.toFixed(2) + 'x'], sub: true },
        { label: 'Cap Rate', values: [pct(capRate), pct(capRateStab)] },
        { label: 'GRM', values: [grm.toFixed(2), '—'] },
        { label: 'Price Per Unit', values: [dollar(ppu), '—'] },
        { label: 'Expense Ratio', values: [pct(expRatio), '—'] },
        { label: 'Cash-on-Cash Return', values: [pct(coc), pct(cocStab)], total: true },
      ]
    },
    {
      title: '7. Stabilized Value & Cash-Out Refi',
      rows: [
        { label: 'Refi Cap Rate Assumption', value: pct(refiCap), sub: true },
        { label: 'Stabilized Value (NOI ÷ Cap Rate)', value: dollar(stabValue), total: true },
        { label: '65% LTV — Conservative', value: dollar(ltvAmts[0]) },
        { label: '70% LTV — Moderate', value: dollar(ltvAmts[1]) },
        { label: '75% LTV — Standard', value: dollar(ltvAmts[2]), sub: true },
        { label: '80% LTV — Aggressive', value: dollar(ltvAmts[3]) },
      ]
    },
    {
      title: '8. Post-Refi Monthly Cash Flow',
      rows: [
        { label: '65% LTV', value: dollar(refiCF(ltvAmts[0])) },
        { label: '70% LTV', value: dollar(refiCF(ltvAmts[1])) },
        { label: '75% LTV', value: dollar(refiCF(ltvAmts[2])), sub: true },
        { label: '80% LTV', value: dollar(refiCF(ltvAmts[3])) },
      ]
    },
    {
      title: '9. Investor Structure & Cash-Out (75% LTV)',
      rows: [
        { label: 'Return of Principal', value: dollar(investorPrincipal) },
        { label: 'Bonus Payment (15%)', value: dollar(bonus) },
        { label: 'TOTAL TO INVESTOR AT REFI', value: dollar(totalToInvestor), total: true },
        { label: 'Cash Out Proceeds (75% LTV)', value: dollar(cashOut75) },
        { label: 'YOUR NET AFTER INVESTOR PAY', value: dollar(netAfter), total: true },
        { label: 'Covers Investor?', value: covers ? '✅ Yes' : '❌ No', sub: true },
      ]
    },
    {
      title: '10. Investor Return Metrics',
      rows: [
        { label: 'Investor Total Return', value: dollar(totalToInvestor) },
        { label: 'Investor ROI', value: pct(investorROI) },
        { label: 'Investor CAGR (5yr est.)', value: pct(Math.pow(1 + investorROI, 1 / 5) - 1) },
      ]
    },
    {
      title: '11. Value Add Summary',
      rows: [
        { label: 'RUBS — Water + Gas Billback', value: dollar(rubsRecovery) },
        { label: 'Trash Cost Shift', value: dollar(trashShift) },
        { label: 'Rent Recapture ($40/unit/mo)', value: dollar(rentBump) },
        { label: 'CapEx Reserve (cost)', value: neg(capex) },
        { label: 'TOTAL NET VALUE ADD', value: dollar(rubsRecovery + trashShift + rentBump - capex), total: true },
      ]
    },
    {
      title: '12. Investor Timeline — Strategy A (8% Pref)',
      rows: [
        { label: 'Close (Month 0)', value: neg(investorPrincipal), sub: true },
        { label: 'Year 1 (Day 1 ops)', value: dollar(investorPrincipal * 0.08) },
        { label: 'Year 2 (Stabilizing)', value: dollar(investorPrincipal * 0.08) },
        { label: 'Year 3 (Stabilized)', value: dollar(investorPrincipal * 0.08) },
        { label: 'Year 4 (Hold)', value: dollar(investorPrincipal * 0.08) },
        { label: 'Year 5 (Cash-Out Refi)', value: dollar(totalToInvestor), total: true },
        { label: 'Post-Refi (ongoing)', value: '—' },
      ]
    },
    {
      title: '13. Investor Timeline — Strategy B (Capital Return at Refi)',
      rows: [
        { label: 'Close (Month 0)', value: neg(investorPrincipal), sub: true },
        { label: 'Year 1', value: dollar(cfDay1 * 0.5) },
        { label: 'Year 2', value: dollar((cfDay1 + cfStab) / 2 * 0.5) },
        { label: 'Year 3 (Stabilized)', value: dollar(cfStab * 0.5) },
        { label: 'Year 4', value: dollar(cfStab * 0.5) },
        { label: 'Year 5 (Cash-Out Refi)', value: dollar(totalToInvestor), total: true },
        { label: 'Post-Refi (50/50 split)', value: dollar(refiCF(ltvAmts[2]) * 0.5) },
      ]
    },
  ];
}

/* ──────────────── Workbook Panel ──────────────────────── */
function WorkbookPanel({ dealData, overrides, onCellEdit }) {
  const sections = useMemo(() => buildWorkbook(dealData), [dealData]);
  const prop = dealData?.property || {};

  if (!sections) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="text-center select-none">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <span className="text-3xl opacity-40">📊</span>
          </div>
          <div className="text-sm font-semibold text-gray-400">Underwriting Workbook</div>
          <div className="text-xs text-gray-300 mt-1">Upload an OM to populate the model</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-auto bg-gradient-to-b from-white to-gray-50/50">
      {/* Property header bar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200/60 px-5 py-3 shadow-sm">
        <div className="text-[15px] font-bold text-slate-800 truncate tracking-tight">{prop.name || prop.address || 'Underwriting Model'}</div>
        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
          <span>{[prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(', ')}</span>
          {prop.units ? <><span className="text-gray-300">·</span><span>{prop.units} units</span></> : ''}
          {prop.year_built ? <><span className="text-gray-300">·</span><span>Built {prop.year_built}</span></> : ''}
        </div>
      </div>
      <div className="min-w-[420px] py-3">
        {sections.map((s, i) => (
          <SheetSection key={i} title={s.title} rows={s.rows} columns={s.columns} accent={s.accent} sectionIdx={i} overrides={overrides} onCellEdit={onCellEdit} />
        ))}
        <div className="h-8" />
      </div>
    </div>
  );
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════ */
function DealBuilderPage() {
  const navigate = useNavigate();
  const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [sessionId, setSessionId] = useState(() => {
    try {
      const existing = localStorage.getItem('dealBuilderSessionId');
      return existing || createSessionId();
    } catch {
      return createSessionId();
    }
  });
  const [dealData, setDealData] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ spreadsheet: 0, pitchDeck: 0 });
  const [generationStatus, setGenerationStatus] = useState({ spreadsheet: 'idle', pitchDeck: 'idle' });
  const [downloadUrls, setDownloadUrls] = useState({ spreadsheet: null, pitchDeck: null, dealId: null });
  const [cellOverrides, setCellOverrides] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCellEdit = useCallback((cellKey, value) => {
    setCellOverrides(prev => {
      const next = { ...prev };
      if (value === undefined) { delete next[cellKey]; } else { next[cellKey] = value; }
      return next;
    });
  }, []);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('dealBuilderSessionId', sessionId);
    } catch {
      // Ignore localStorage failures
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const restoreHistory = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        const response = await fetch(`${API_BASE}/api/deal-builder/history/${sessionId}`, {
          headers: userId ? { 'X-Profile-ID': userId } : {}
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.success || cancelled) return;

        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
        }
        if (data.dealData) {
          setDealData(data.dealData);
        }
        if (data.approved) {
          setIsApproved(true);
        }
      } catch (error) {
        console.warn('Deal Builder history restore skipped:', error);
      }
    };

    restoreHistory();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  /* ─── File Upload ─── */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) { alert('Please upload a PDF or image file'); return; }

    setIsUploading(true);
    setUploadProgress(8);
    setUploadStatusText('Initializing upload...');
    setUploadedFile({ name: file.name, size: file.size, type: file.type });
    setMessages(prev => [...prev, { role: 'user', content: `Uploading: ${file.name}`, isUpload: true, fileName: file.name }]);

    try {
      await wakeBackend();
      setUploadProgress(24);
      setUploadStatusText('Connecting to parser...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      setUploadProgress(46);
      setUploadStatusText('Uploading document...');

      const response = await fetch(`${API_BASE}/api/deal-builder/upload`, {
        method: 'POST', headers: userId ? { 'X-Profile-ID': userId } : {}, body: formData
      });

      if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try { const err = await response.json(); msg = err.detail || err.error || msg; } catch { msg = `HTTP ${response.status}: ${response.statusText}`; }
        throw new Error(msg);
      }

      setUploadProgress(76);
      setUploadStatusText('Extracting deal data...');
      const data = await response.json();
      setDealData(data.dealData);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, dealSummary: data.dealSummary }]);
      setUploadProgress(100);
      setUploadStatusText('Upload complete');
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}. Try again with a clear PDF or image.` }]);
      setUploadedFile(null);
      setUploadStatusText('Upload failed');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
      }, 350);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendDealBuilderPrompt = async (userMessage, isApprovalMsg = false) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const response = await fetch(`${API_BASE}/api/deal-builder/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(userId && { 'X-Profile-ID': userId }) },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          deal_data: dealData,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          is_approval: isApprovalMsg,
        })
      });

      if (response.status === 401) { setMessages(prev => [...prev, { role: 'assistant', content: 'Please log in to use Deal Builder.' }]); return; }
      if (response.status === 402) { setMessages(prev => [...prev, { role: 'assistant', content: 'Out of tokens. Purchase more to continue.' }]); return; }

      const data = await response.json();
      if (data.success) {
        if (data.updatedDealData) setDealData(data.updatedDealData);
        setMessages(prev => [...prev, { role: 'assistant', content: data.response, showApproveButton: data.readyForApproval && !isApproved }]);
        if (data.approved) { setIsApproved(true); startGeneration(); }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Unknown'}` }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check your internet and try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBusinessPlan = async () => {
    if (isLoading || isUploading || isGenerating) return;
    const businessPlanPrompt = [
      'Build a complete professional multifamily business plan for this deal from the uploaded documents and extracted data.',
      'Include these sections:',
      '1) Executive Summary',
      '2) Property & Market Overview',
      '3) Underwriting Assumptions (rent, vacancy, expenses, capex, debt)',
      '4) Value-Add Strategy and 12-24 month plan',
      '5) Risk Analysis and mitigations',
      '6) Financial Projections and investor returns',
      '7) Exit strategy and recommendation',
      'Use concrete numbers from the parsed deal and clearly flag assumptions versus sourced values.'
    ].join('\n');

    await sendDealBuilderPrompt(businessPlanPrompt, false);
  };

  /* ─── Chat ─── */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const genKW = ['generate', 'build the spreadsheet', 'make the spreadsheet', 'create the spreadsheet', 'build the model', 'create the model', 'make the pitch deck', 'build it now', 'generate now'];
    if (genKW.some(kw => userMessage.toLowerCase().includes(kw)) && dealData && !isApproved) {
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      handleApprove(); return;
    }

    const approvalKW = ['approved', 'looks good', "let's do it", 'go ahead', 'proceed', 'build it', 'generate', 'create the'];
    const isApprovalMsg = approvalKW.some(kw => userMessage.toLowerCase().includes(kw));
    await sendDealBuilderPrompt(userMessage, isApprovalMsg);
  };

  const handleApprove = () => {
    setMessages(prev => [...prev, { role: 'user', content: 'Approved — generate the spreadsheet and pitch deck.' }]);
    setIsApproved(true); startGeneration();
  };

  /* ─── Generation ─── */
  const startGeneration = async () => {
    setIsGenerating(true);
    setGenerationStatus({ spreadsheet: 'generating', pitchDeck: 'generating' });
    setGenerationProgress({ spreadsheet: 0, pitchDeck: 0 });
    setMessages(prev => [...prev, { role: 'assistant', content: 'Building deliverables — 1-2 minutes...', isGenerationStatus: true }]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const resp = await fetch(`${API_BASE}/api/deal-builder/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(userId && { 'X-Profile-ID': userId }) },
        body: JSON.stringify({ session_id: sessionId, deal_data: dealData })
      });
      if (!resp.ok) throw new Error('Generation failed');

      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`${API_BASE}/api/deal-builder/status/${sessionId}`, { headers: userId ? { 'X-Profile-ID': userId } : {} });
          const st = await sr.json();
          setGenerationProgress({ spreadsheet: st.spreadsheet_progress || 0, pitchDeck: st.pitch_deck_progress || 0 });
          setGenerationStatus({ spreadsheet: st.spreadsheet_status || 'generating', pitchDeck: st.pitch_deck_status || 'generating' });
          if (st.complete) {
            clearInterval(poll); setIsGenerating(false);
            setDownloadUrls({ spreadsheet: st.spreadsheet_url ? `${API_BASE}${st.spreadsheet_url}` : null, pitchDeck: st.pitch_deck_url ? `${API_BASE}${st.pitch_deck_url}` : null, dealId: st.deal_id });
            setMessages(prev => [...prev, { role: 'assistant', content: 'Deal package ready. Download below.', isComplete: true }]);
          }
        } catch (e) { console.error('Poll error:', e); }
      }, 2000);
      setTimeout(() => { clearInterval(poll); if (isGenerating) { setIsGenerating(false); setMessages(prev => [...prev, { role: 'assistant', content: 'Taking longer than expected. Try again.' }]); } }, 300000);
    } catch (error) {
      console.error('Generation error:', error); setIsGenerating(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `Generation failed: ${error.message}` }]);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const clearChat = () => {
    setMessages([]); setInput(''); setUploadedFile(null); setDealData(null);
    setIsApproved(false); setIsGenerating(false);
    setGenerationProgress({ spreadsheet: 0, pitchDeck: 0 });
    setGenerationStatus({ spreadsheet: 'idle', pitchDeck: 'idle' });
    setDownloadUrls({ spreadsheet: null, pitchDeck: null, dealId: null });
    setCellOverrides({});
    setIsFullscreen(false);
    setSessionId(createSessionId());
  };

  /* ─── Progress ─── */
  const ProgressBar = ({ label, progress, status }) => (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-[10px] text-slate-400 font-medium">{status === 'complete' ? 'Done' : status === 'generating' ? `${progress}%` : '...'}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${status === 'complete' ? 'bg-emerald-500' : 'bg-gradient-to-r from-slate-500 to-slate-700'}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  /* ─── Markdown ─── */
  const md = {
    h2: ({ children }) => <h2 className="text-sm font-bold text-slate-800 mt-4 mb-1 pb-0.5 border-b border-gray-200">{children}</h2>,
    h3: ({ children }) => <h3 className="text-[13px] font-bold text-slate-700 mt-2 mb-1">{children}</h3>,
    p: ({ children }) => <p className="mb-1.5 text-[13px] leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="my-1 pl-4 text-[13px]">{children}</ul>,
    ol: ({ children }) => <ol className="my-1 pl-4 text-[13px]">{children}</ol>,
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    strong: ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
    table: ({ children }) => <div className="overflow-x-auto my-2 rounded-lg border border-gray-200"><table className="w-full border-collapse text-xs">{children}</table></div>,
    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
    th: ({ children }) => <th className="px-2.5 py-1.5 text-left font-semibold text-slate-400 border-b border-gray-200 text-[10px] uppercase tracking-widest">{children}</th>,
    td: ({ children }) => <td className="px-2.5 py-1.5 border-b border-gray-100 text-slate-600 text-right text-xs tabular-nums">{children}</td>,
    blockquote: ({ children }) => <blockquote className="my-2 pl-3 border-l-2 border-slate-300 text-slate-500 text-xs">{children}</blockquote>,
    hr: () => <hr className="border-t border-gray-200 my-2" />,
    code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <DashboardShell activeTab="market" title="Deal Builder">
      <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-gray-200/60 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold text-slate-800 tracking-tight">Deal Builder</span>
            <span className="text-xs text-slate-400 hidden sm:inline">Upload OM → Underwrite → Spreadsheet + Pitch Deck</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateBusinessPlan}
              disabled={isLoading || isUploading || isGenerating || !uploadedFile}
              className="text-xs text-white bg-slate-900 rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
              title="Generate full business plan"
            >
              <BookOpen size={12} /> Business Plan
            </button>
            <span className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <AlertCircle size={11} /> <b>10 tokens</b> / deal
            </span>
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-xs text-slate-500 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50 hover:border-gray-300 transition-all">New Deal</button>
            )}
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ═══ LEFT — Chat ═══ */}
          <div className="flex flex-col w-1/2 border-r border-gray-200/60 min-w-0 bg-white">

            <div className="px-4 py-2 border-b border-gray-100 bg-white shrink-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Chat</span>
            </div>

            {/* Upload zone */}
            {!uploadedFile && (
              <div onClick={() => fileInputRef.current?.click()}
                className="mx-4 mt-3 mb-1 border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 shrink-0 group">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <Upload size={18} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="text-[13px] font-semibold text-slate-600">Upload OM, T-12, Rent Roll, or Debt Quote</div>
                <div className="text-xs text-slate-400 mt-1">PDF or image</div>
              </div>
            )}

            {/* File pill */}
            {uploadedFile && (
              <div className="mx-4 mt-3 mb-1 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/60 rounded-lg px-3.5 py-2 text-xs text-emerald-700 shrink-0">
                <FileText size={14} />
                <span className="truncate font-medium">{uploadedFile.name}</span>
                {!isUploading && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                <button onClick={() => fileInputRef.current?.click()} className="ml-auto text-[11px] text-slate-500 border border-gray-200 rounded-md px-2 py-0.5 hover:bg-gray-50 transition-colors">+ Add</button>
              </div>
            )}

            {isUploading && (
              <div className="mx-4 mt-2 mb-1 rounded-xl border border-blue-200 bg-gradient-to-r from-slate-50 to-blue-50 p-3 shadow-sm shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                    <Loader size={14} className="animate-spin text-blue-600" />
                    Uploading and parsing deal file
                  </div>
                  <span className="text-[11px] font-bold text-blue-700">{Math.max(1, uploadProgress)}%</span>
                </div>
                <div className="h-3 rounded-full bg-blue-100 border border-blue-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.max(3, uploadProgress)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600">{uploadStatusText || 'Processing file...'}</div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !uploadedFile && (
                <div className="flex items-center justify-center h-full text-slate-400 text-[13px] select-none">Upload a document to start</div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-br-md shadow-sm'
                      : 'bg-gray-50 border border-gray-200/60 text-slate-700 rounded-bl-md'
                  }`}>
                    {msg.isUpload && (
                      <div className="flex items-center gap-1.5 mb-1.5 opacity-70 text-xs">
                        <FileText size={12} /><span>{msg.fileName}</span>
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{msg.content}</ReactMarkdown>
                    ) : msg.content}

                    {msg.showApproveButton && !isApproved && (
                      <button onClick={handleApprove} className="mt-2.5 flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm hover:shadow transition-all">
                        <CheckCircle size={13} /> Approve & Generate
                      </button>
                    )}
                    {msg.isGenerationStatus && isGenerating && (
                      <div className="mt-2 p-2 bg-white rounded border border-gray-100">
                        <ProgressBar label="Spreadsheet" progress={generationProgress.spreadsheet} status={generationStatus.spreadsheet} />
                        <ProgressBar label="Pitch Deck" progress={generationProgress.pitchDeck} status={generationStatus.pitchDeck} />
                      </div>
                    )}
                    {msg.isComplete && downloadUrls.spreadsheet && (
                      <div className="mt-2 flex flex-col gap-1">
                        <a href={downloadUrls.spreadsheet} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold no-underline hover:bg-emerald-700 shadow-sm hover:shadow transition-all">
                          <Download size={13} /> Spreadsheet (.xlsx)
                        </a>
                        <a href={downloadUrls.pitchDeck} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold no-underline hover:bg-slate-800 shadow-sm hover:shadow transition-all">
                          <Download size={13} /> Pitch Deck (.pdf)
                        </a>
                        {downloadUrls.dealId && (
                          <button onClick={() => navigate('/pipeline')} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all">
                            <Layers size={13} /> Pipeline <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 border border-gray-200/60 rounded-2xl rounded-bl-md text-[13px] text-slate-400">
                    <Loader size={14} className="animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
              <div className="flex gap-2 items-end">
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGenerating}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 shrink-0 transition-all" title="Upload">
                  <Upload size={15} className="text-slate-400" />
                </button>
                <div className="flex-1 relative">
                  <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
                    placeholder={uploadedFile ? "Discuss the deal or say 'approved'..." : 'Upload an OM to start...'}
                    disabled={isLoading || isUploading || isGenerating} rows={1}
                    className="w-full px-3.5 py-2 pr-10 text-[13px] border border-gray-200 rounded-xl resize-none outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 min-h-[38px] max-h-[100px] transition-all"
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || isLoading || isUploading || isGenerating}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-lg ${input.trim() ? 'bg-slate-700 hover:bg-slate-800 shadow-sm' : 'bg-gray-200'} transition-all`}>
                    <Send size={13} color={input.trim() ? 'white' : '#9ca3af'} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT — Workbook ═══ */}
          {!isFullscreen && (
            <div className="flex flex-col w-1/2 min-w-0 bg-gray-50/50">
              <div className="px-4 py-2 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Underwriting Workbook</span>
                <div className="flex items-center gap-1.5">
                  {Object.keys(cellOverrides).length > 0 && (
                    <button onClick={() => setCellOverrides({})} className="text-[10px] text-slate-400 border border-gray-200 rounded-md px-2 py-0.5 hover:bg-gray-50 hover:text-slate-600 transition-all" title="Reset all edits">
                      Reset
                    </button>
                  )}
                  <button onClick={() => setIsFullscreen(true)} className="p-1 rounded-md hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-all" title="Fullscreen">
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
              <WorkbookPanel dealData={dealData} overrides={cellOverrides} onCellEdit={handleCellEdit} />
            </div>
          )}
        </div>

        {/* ═══ Fullscreen Workbook Overlay ═══ */}
        {isFullscreen && (
          <div className="fixed top-0 right-0 bottom-0 z-50 bg-white flex flex-col" style={{ left: '200px', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            <div className="px-5 py-2.5 border-b border-gray-200/60 bg-white shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-bold text-slate-800 tracking-tight">Underwriting Workbook</span>
                <span className="text-xs text-slate-400">Click any value to edit</span>
              </div>
              <div className="flex items-center gap-2">
                {Object.keys(cellOverrides).length > 0 && (
                  <button onClick={() => setCellOverrides({})} className="text-xs text-slate-500 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50 hover:border-gray-300 transition-all">
                    Reset Edits
                  </button>
                )}
                <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500 hover:text-slate-700 transition-all" title="Exit fullscreen">
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>
            <WorkbookPanel dealData={dealData} overrides={cellOverrides} onCellEdit={handleCellEdit} />
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
      </div>
    </DashboardShell>
  );
}

export default DealBuilderPage;
