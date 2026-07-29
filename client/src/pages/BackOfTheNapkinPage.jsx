// Back of the Napkin — standalone, automatic full-deal-read feature.
//
// This page is intentionally separate from the platform's real Underwrite
// flow (UnderwriteV2Page / ResultsPageV2 / v2_underwriter). It does not
// create or touch any deal record. Upload a deal document (OM, T-12, rent
// roll) and it is immediately turned into a full structured underwrite
// report — OM issues, market outlook, strategy/play, recommended purchase
// price, investor payback feasibility — powered entirely by the CRE Agent
// Skills library dropped into backend/cre-agent-skills-main/ (plus the
// standalone scenario-matrix-analyzer skill). A follow-up chat box is
// available below the report for further questions on the same document.
//
// UI intentionally mirrors the results page's design system (emerald/cyan
// gradient, white Card containers, Ghost/Primary buttons) — see
// client/src/components/results-tabs/underwritex.jsx for the source of
// truth for these tokens. Recreated locally here (not imported) since
// underwritex.jsx doesn't export them and this page must stay decoupled.
import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, NotebookPen, Loader, AlertTriangle, TrendingUp, Target, DollarSign, Users, ListChecks, RotateCcw } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { uploadNapkinDocument, sendNapkinChatMessage, generateNapkinReport } from '../lib/napkinService';

const GRAD = 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)';

const Card = ({ children, className = '', style = {} }) => (
  <div
    className={className}
    style={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...style }}
  >
    {children}
  </div>
);

const GradBanner = ({ children }) => (
  <div style={{ background: GRAD, color: '#ffffff', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    {children}
  </div>
);

const Ghost = ({ children, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer', border: '1px solid #d1d5db',
      backgroundColor: '#ffffff', color: disabled ? '#9ca3af' : '#374151',
    }}
  >
    {children}
  </button>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
    <span style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={13} />
    </span>
    {children}
  </div>
);

const VERDICT_STYLES = {
  PURSUE: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  'PURSUE WITH CONDITIONS': { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  PASS: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
};

const SEVERITY_STYLES = {
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  moderate: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  minor: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
};

const fmtMoney = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return null;
  return `$${Math.round(v).toLocaleString()}`;
};
const fmtPct = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return `${(v <= 1 ? v * 100 : v).toFixed(1)}%`;
};

function ReportView({ report }) {
  const verdictStyle = VERDICT_STYLES[report.verdict] || VERDICT_STYLES.PASS;
  const snap = report.dealSnapshot || {};
  const issues = report.omIssues || [];
  const market = report.marketOutlook || {};
  const strategy = report.strategy || {};
  const val = report.valuation || {};
  const inv = report.investorFeasibility || {};
  const missing = report.missingCriticalData || [];
  const nextSteps = report.nextSteps || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Headline / verdict */}
      <Card style={{ padding: 18, backgroundColor: verdictStyle.bg, border: `1px solid ${verdictStyle.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: verdictStyle.text, letterSpacing: 0.3, textTransform: 'uppercase' }}>{report.verdict || 'Read Complete'}</span>
          {report.confidence && <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Confidence: {report.confidence}</span>}
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#1f2937', margin: 0 }}>{report.headline}</p>
      </Card>

      {/* Deal snapshot */}
      <Card style={{ padding: 18 }}>
        <SectionTitle icon={Target}>Deal Snapshot</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            ['Property', snap.propertyName || snap.address || '—'],
            ['Units', snap.units || '—'],
            ['Asking Price', fmtMoney(snap.askingPrice) || '—'],
            ['$ / Unit', fmtMoney(snap.askingPricePerUnit) || '—'],
            ['Stated Cap Rate', fmtPct(snap.statedCapRate) || '—'],
            ['Stated NOI', fmtMoney(snap.statedNOI) || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* OM Issues */}
      <Card style={{ padding: 18 }}>
        <SectionTitle icon={AlertTriangle}>What's Off In The OM ({issues.length})</SectionTitle>
        {issues.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>No material inconsistencies flagged against the document as provided.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map((iss, i) => {
              const sev = SEVERITY_STYLES[iss.severity] || SEVERITY_STYLES.minor;
              return (
                <div key={i} style={{ backgroundColor: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: sev.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>{iss.severity}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 999, padding: '1px 8px' }}>{iss.category}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{iss.issue}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#374151', margin: '0 0 4px 0', lineHeight: 1.5 }}>{iss.detail}</p>
                  {iss.recommendation && <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>→ {iss.recommendation}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Market outlook + Strategy side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <SectionTitle icon={TrendingUp}>Market Outlook</SectionTitle>
          {market.trend && (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8,
              padding: '3px 10px', borderRadius: 999,
              backgroundColor: market.trend === 'improving' ? '#ecfdf5' : market.trend === 'declining' ? '#fef2f2' : '#f3f4f6',
              color: market.trend === 'improving' ? '#047857' : market.trend === 'declining' ? '#b91c1c' : '#6b7280',
            }}>{market.trend}</span>
          )}
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 10px 0' }}>{market.summary}</p>
          {(market.keyDrivers || []).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Key Drivers</div>
              <ul style={{ margin: '0 0 10px 0', paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                {market.keyDrivers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
          {(market.risks || []).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Risks</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                {market.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionTitle icon={Target}>The Play / Strategy</SectionTitle>
          {strategy.play && <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>{strategy.play}</div>}
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 10px 0' }}>{strategy.rationale}</p>
          {(strategy.keySteps || []).length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
              {strategy.keySteps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </Card>
      </div>

      {/* Valuation + Investor feasibility side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <SectionTitle icon={DollarSign}>What You Should Actually Pay</SectionTitle>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Asking</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#6b7280' }}>{fmtMoney(val.askingPrice) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Recommended Max</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>{fmtMoney(val.recommendedMaxPrice) || '—'}</div>
            </div>
            {val.impliedGoingInCapAtRecommendedPrice != null && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Implied Cap</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{fmtPct(val.impliedGoingInCapAtRecommendedPrice) || '—'}</div>
              </div>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{val.rationale}</p>
        </Card>

        <Card style={{ padding: 18 }}>
          <SectionTitle icon={Users}>Can You Bring Investors In?</SectionTitle>
          {inv.canRaiseCapital && (
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8,
              padding: '3px 10px', borderRadius: 999,
              backgroundColor: inv.canRaiseCapital === 'yes' ? '#ecfdf5' : inv.canRaiseCapital === 'no' ? '#fef2f2' : '#fffbeb',
              color: inv.canRaiseCapital === 'yes' ? '#047857' : inv.canRaiseCapital === 'no' ? '#b91c1c' : '#92400e',
            }}>{inv.canRaiseCapital === 'yes' ? 'Yes, viable' : inv.canRaiseCapital === 'no' ? 'Not as-is' : 'Conditional'}</span>
          )}
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            {inv.assumedPreferredReturn != null && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Assumed Pref</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmtPct(inv.assumedPreferredReturn)}</div>
              </div>
            )}
            {inv.projectedCashOnCash != null && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Proj. Cash-on-Cash</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{fmtPct(inv.projectedCashOnCash)}</div>
              </div>
            )}
            {typeof inv.dscrAdequate === 'boolean' && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>DSCR Adequate</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: inv.dscrAdequate ? '#047857' : '#b91c1c' }}>{inv.dscrAdequate ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{inv.rationale}</p>
        </Card>
      </div>

      {/* Missing data + next steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {missing.length > 0 && (
          <Card style={{ padding: 18 }}>
            <SectionTitle icon={AlertTriangle}>Missing / Needed From You</SectionTitle>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
              {missing.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </Card>
        )}
        {nextSteps.length > 0 && (
          <Card style={{ padding: 18 }}>
            <SectionTitle icon={ListChecks}>Next Steps</SectionTitle>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
              {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Card>
        )}
      </div>

      {report.meta?.disclaimer && (
        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '4px 0' }}>{report.meta.disclaimer}</p>
      )}
    </div>
  );
}

export default function BackOfTheNapkinPage() {
  const [doc, setDoc] = useState(null); // { filename, text }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Follow-up chat (secondary feature, available once a document is loaded)
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

  const runReport = async (documentText) => {
    setReportLoading(true);
    setReportError(null);
    try {
      const r = await generateNapkinReport(documentText);
      setReport(r);
    } catch (e) {
      setReportError(e.message || 'Failed to generate the underwrite report.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setReport(null);
    setMessages([]);
    try {
      const result = await uploadNapkinDocument(file);
      setDoc(result);
      await runReport(result.text);
    } catch (e) {
      setUploadError(e.message || 'Failed to read that file.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setDoc(null);
    setReport(null);
    setReportError(null);
    setUploadError(null);
    setMessages([]);
  };

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);
    setChatError(null);
    try {
      const reply = await sendNapkinChatMessage({ documentText: doc?.text, message, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setChatError(e.message || 'Something went wrong reaching the analyst.');
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardShell activeTab="napkin" title="Back of the Napkin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980, margin: '0 auto', paddingBottom: 40 }}>
        <GradBanner>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 16 }}>
            <NotebookPen size={20} /> Back of the Napkin
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.9 }}>Upload an OM and get a full underwrite — automatically</span>
        </GradBanner>

        {/* Upload zone */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {doc ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#065f46', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '6px 12px' }}>
                <Paperclip size={13} />
                {doc.filename}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, flex: 1, minWidth: 220 }}>
                Upload an OM, rent roll, or T-12 (PDF/XLSX/CSV) and it's turned straight into a full underwrite
                report — OM red flags, market outlook, the actual play, what to pay, and investor feasibility.
              </p>
            )}
            <Ghost onClick={() => fileInputRef.current?.click()} disabled={uploading || reportLoading}>
              {uploading ? <Loader size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {uploading ? 'Reading…' : doc ? 'Upload a different deal' : 'Upload a deal document'}
            </Ghost>
            {doc && (
              <Ghost onClick={reset} disabled={uploading || reportLoading} title="Clear and start over">
                <RotateCcw size={14} /> Reset
              </Ghost>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          {uploadError && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{uploadError}</div>}
        </Card>

        {/* Report / loading / error / empty states */}
        {reportLoading && (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <Loader size={22} className="animate-spin" style={{ color: '#059669', marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>Running the full underwrite…</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Checking the OM for issues, sizing the market, and pricing the deal — usually 20-40 seconds.</div>
          </Card>
        )}
        {reportError && (
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 10 }}>{reportError}</div>
            <Ghost onClick={() => doc && runReport(doc.text)}>Retry</Ghost>
          </Card>
        )}
        {!doc && !reportLoading && (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <NotebookPen size={28} style={{ color: '#d1d5db', marginBottom: 8 }} />
            <div style={{ fontSize: 13.5, color: '#9ca3af' }}>Nothing uploaded yet — drop in a deal document above to get your first read.</div>
          </Card>
        )}
        {report && <ReportView report={report} />}

        {/* Follow-up chat — secondary feature */}
        {doc && (
          <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Ask a follow-up question about this deal
            </div>
            <div ref={bodyRef} style={{ maxHeight: 360, overflowY: 'auto', padding: 16 }}>
              {messages.length === 0 && (
                <p style={{ fontSize: 12.5, color: '#9ca3af', margin: 0 }}>
                  e.g. "What if I offered $2.1M instead?" or "How solid is the rent growth assumption?"
                </p>
              )}
              {messages.map((turn, i) => {
                const isUser = turn.role === 'user';
                return (
                  <div key={i} style={{ marginBottom: 12, textAlign: isUser ? 'right' : 'left' }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '85%', textAlign: 'left',
                      padding: '9px 13px', borderRadius: 11, fontSize: 13, lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      backgroundColor: isUser ? '#ecfdf5' : '#f9fafb',
                      border: `1px solid ${isUser ? '#a7f3d0' : '#e5e7eb'}`,
                      color: isUser ? '#065f46' : '#374151',
                    }}>
                      {turn.content}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader size={13} className="animate-spin" /> Thinking…
                </div>
              )}
              {chatError && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{chatError}</div>}
            </div>
            <div style={{ borderTop: '1px solid #f3f4f6', padding: 12, backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask a follow-up…"
                  style={{ flex: 1, fontSize: 13, padding: '10px 13px', borderRadius: 9, border: '1px solid #d1d5db', color: '#111827' }}
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 16px', borderRadius: 9, border: 'none',
                    background: sending || !input.trim() ? '#e5e7eb' : GRAD,
                    color: sending || !input.trim() ? '#9ca3af' : '#ffffff',
                    cursor: sending || !input.trim() ? 'default' : 'pointer', fontWeight: 700,
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

