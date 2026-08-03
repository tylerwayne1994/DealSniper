import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Lock, Clock, Camera, X, TrendingUp, Building2, Sparkles } from 'lucide-react';
import { buildDealRoomCss, DEAL_ROOM_ACCENT_DEFAULT } from './DealRoomStyles';
import { exportDealRoomHtml } from '../../lib/dealRoomExport';
import { NoiCashflowChart, ValueCreationBridge, ReturnsComparisonChart } from './DealRoomCharts';
import { renderWidget } from './DealRoomWidgets';
import { calculateFullAnalysis } from '../../utils/realEstateCalculations';
import { useDealRoomWidgetData, resolveWidgetDataset as resolveWidgetDatasetShared } from '../../lib/dealRoomWidgetData';

const fmtMoney = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '';
  const n = Math.round(Number(v));
  const abs = Math.abs(n);
  const formatted = `$${abs.toLocaleString()}`;
  return n < 0 ? `(${formatted})` : formatted;
};
const fmtPct = (v) => (v == null || Number.isNaN(Number(v))) ? '' : `${(Number(v) * 100).toFixed(2)}%`;
const fmtMultiple = (v) => (v == null || Number.isNaN(Number(v))) ? '' : `${Number(v).toFixed(2)}x`;
const fileEmoji = (type = '') => {
  const t = (type || '').toLowerCase();
  if (t.includes('pdf')) return '📄';
  if (t.includes('image')) return '🖼️';
  if (t.includes('spreadsheet') || t.includes('excel') || t.includes('csv')) return '📊';
  if (t.includes('word') || t.includes('document')) return '📝';
  return '📁';
};

/**
 * Countdown banner shown at the very top of the deck when the sponsor has
 * set an offering close date (deal.parsedData.dealRoomCloseDate). Hides
 * itself entirely once the date has passed or if none was set — never
 * shows a fabricated deadline.
 */
function CountdownBanner({ closeDate, accent }) {
  if (!closeDate) return null;
  const target = new Date(`${closeDate}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  const msLeft = target.getTime() - Date.now();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  return (
    <div style={{
      background: accent, color: '#fff', padding: '11px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
    }}>
      <Clock size={15} />
      {daysLeft === 1 ? '1 day left to invest' : `${daysLeft} days left to invest`}
      <span style={{ opacity: 0.85, fontWeight: 500 }}>
        — closing {target.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  );
}

/**
 * Due-diligence document vault — only shows files the sponsor explicitly
 * marked visible to investors (never the sponsor's full private document
 * set). Absent entirely if there's nothing to show.
 */
function DocumentVault({ documents }) {
  if (!documents || documents.length === 0) return null;
  return (
    <section id="documents" className="dr-section">
      <div className="dr-eyebrow">Document Vault</div>
      <h2 className="dr-h2 dr-serif">Due Diligence Documents</h2>
      <div className="dr-card" style={{ padding: 0, overflow: 'hidden' }}>
        {documents.map((doc, i) => (
          <a
            key={doc.id || i}
            href={doc.public_url || doc.external_url || doc.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
              borderBottom: i < documents.length - 1 ? '1px solid var(--dr-border)' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{ fontSize: 22 }}>{fileEmoji(doc.file_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
              {doc.category && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' }}>{doc.category.replace(/_/g, ' ')}</div>}
            </div>
            <Download size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}

// Sensitivity presets applied on top of the deal's real underwritten
// assumptions — lets an investor see how the numbers swing without the
// sponsor having to build separate scenarios. Never invents a new deal;
// just shifts exit cap rate / income growth by a disclosed, fixed amount.
const SENSITIVITY_PRESETS = {
  conservative: { label: 'Conservative', exitCapDelta: 0.005, incomeGrowthDelta: -0.01 },
  base: { label: 'Base Case', exitCapDelta: 0, incomeGrowthDelta: 0 },
  upside: { label: 'Upside', exitCapDelta: -0.0025, incomeGrowthDelta: 0.01 },
};

function TableCard({ title, rows }) {
  if (!rows || !rows.length) return null;
  return (
    <div className="dr-card">
      <h3>{title}</h3>
      <table className="dr-table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label + i} className={r.bold ? 'dr-bold' : ''}>
              <td>{r.label}</td>
              <td className="dr-num">
                {r.isPct ? fmtPct(r.value) : r.isMultiple ? fmtMultiple(r.value) : fmtMoney(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Lets an investor slide their own investment amount and hold period and see
 * live IRR / equity multiple / profit for THEIR stake. Grounded entirely in
 * the deal's real underwritten exit-year scenarios (calculateFullAnalysis's
 * returns.exitScenarios) — assumes pro-rata (pari-passu) participation,
 * since IRR/equity-multiple are scale-invariant for a proportional stake.
 * Never fabricates a waterfall/promote split that isn't in the real deal data.
 *
 * Also offers a Conservative / Base / Upside sensitivity toggle that shifts
 * exit cap rate and rent growth by a fixed, disclosed amount and recomputes
 * the real engine (calculateFullAnalysis) — not a separate invented model.
 */
function InvestorCalculator({ full, scenarioData, accent }) {
  const [sensitivity, setSensitivity] = useState('base');

  const adjustedFull = useMemo(() => {
    const preset = SENSITIVITY_PRESETS[sensitivity];
    if (!preset || sensitivity === 'base' || !scenarioData) return full;
    try {
      const baseExitCapDecimal = (full?.returns?.exitCapRate || 0) / 100;
      const rawIncomeGrowth = scenarioData?.underwriting?.income_growth_rate;
      const baseIncomeGrowthDecimal = rawIncomeGrowth != null
        ? (rawIncomeGrowth > 1 ? rawIncomeGrowth / 100 : rawIncomeGrowth)
        : 0.02;

      const clone = JSON.parse(JSON.stringify(scenarioData));
      clone.underwriting = {
        ...(clone.underwriting || {}),
        exit_cap_rate: Math.max(0.02, baseExitCapDecimal + preset.exitCapDelta),
        income_growth_rate: baseIncomeGrowthDecimal + preset.incomeGrowthDelta,
      };
      return calculateFullAnalysis(clone);
    } catch (e) {
      console.warn('InvestorCalculator: sensitivity recompute failed, showing base case', e);
      return full;
    }
  }, [sensitivity, scenarioData, full]);

  const totalEquity = Math.round(adjustedFull?.financing?.totalEquityRequired || 0);
  const exitScenarios = adjustedFull?.returns?.exitScenarios || [];
  const defaultHold = Math.min(adjustedFull?.returns?.holdingPeriod || 5, exitScenarios.length || 5) || 1;
  const maxHold = exitScenarios.length || 1;
  const minInvestment = Math.min(5000, totalEquity || 5000);

  const [investment, setInvestment] = useState(() => {
    const suggested = Math.max(minInvestment, Math.round((totalEquity * 0.1) / 1000) * 1000);
    return Math.min(suggested, totalEquity || suggested);
  });
  const [holdYears, setHoldYears] = useState(defaultHold);

  if (!totalEquity || exitScenarios.length === 0) return null;

  const share = totalEquity > 0 ? investment / totalEquity : 0;
  const scenario = exitScenarios[Math.max(0, Math.min(holdYears, exitScenarios.length) - 1)] || {};
  const yourProfit = (scenario.totalProfit || 0) * share;
  const yourCashReturned = (scenario.totalCashReturned || 0) * share;
  const preset = SENSITIVITY_PRESETS[sensitivity];

  return (
    <section id="calculator" className="dr-section">
      <div className="dr-eyebrow">Investor Calculator</div>
      <h2 className="dr-h2 dr-serif">Model Your Own Investment</h2>
      <div className="dr-card">
        {scenarioData && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {Object.entries(SENSITIVITY_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setSensitivity(key)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  border: sensitivity === key ? 'none' : '1px solid var(--dr-border)',
                  background: sensitivity === key ? accent : '#fff',
                  color: sensitivity === key ? '#fff' : '#374151',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="dr-two-col">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Your Investment</label>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(investment)}</span>
            </div>
            <input
              type="range"
              min={minInvestment}
              max={totalEquity}
              step={1000}
              value={investment}
              onChange={(e) => setInvestment(Number(e.target.value))}
              style={{ width: '100%', accentColor: accent }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              <span>{fmtMoney(minInvestment)}</span>
              <span>{fmtMoney(totalEquity)} (100% of equity)</span>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Hold Period</label>
              <span style={{ fontWeight: 700 }}>{holdYears} {holdYears === 1 ? 'Year' : 'Years'}</span>
            </div>
            <input
              type="range"
              min={1}
              max={maxHold}
              step={1}
              value={holdYears}
              onChange={(e) => setHoldYears(Number(e.target.value))}
              style={{ width: '100%', accentColor: accent }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              <span>1 Year</span>
              <span>{maxHold} Years</span>
            </div>
          </div>
        </div>

        <div className="dr-stat-bar" style={{ marginTop: 24, border: '1px solid var(--dr-border)', borderRadius: 6, overflow: 'hidden' }}>
          <div className="dr-stat">
            <div className="dr-stat-label">Your Equity Share</div>
            <div className="dr-stat-value">{fmtPct(share)}</div>
          </div>
          <div className="dr-stat">
            <div className="dr-stat-label">Projected IRR</div>
            <div className="dr-stat-value">{scenario.irr != null ? `${scenario.irr.toFixed(1)}%` : '—'}</div>
          </div>
          <div className="dr-stat">
            <div className="dr-stat-label">Equity Multiple</div>
            <div className="dr-stat-value">{scenario.equityMultiple != null ? `${scenario.equityMultiple.toFixed(2)}x` : '—'}</div>
          </div>
          <div className="dr-stat">
            <div className="dr-stat-label">Total Profit</div>
            <div className="dr-stat-value">{fmtMoney(yourProfit)}</div>
          </div>
          <div className="dr-stat">
            <div className="dr-stat-label">Total Cash Returned</div>
            <div className="dr-stat-value">{fmtMoney(yourCashReturned)}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 14, lineHeight: 1.5 }}>
          {sensitivity !== 'base' && preset ? (
            <>Showing the <strong>{preset.label}</strong> scenario (exit cap {preset.exitCapDelta >= 0 ? '+' : ''}{(preset.exitCapDelta * 100).toFixed(2)} pts,
            rent growth {preset.incomeGrowthDelta >= 0 ? '+' : ''}{(preset.incomeGrowthDelta * 100).toFixed(1)} pts vs. the sponsor's base case). </>
          ) : null}
          Based on a pro-rata (pari-passu) equity share of this deal's underwritten cash flows at the selected exit year —
          not an invented projection. If this offering has a preferred-return or promote structure, your actual return
          may differ from these deal-level figures — confirm final terms with the sponsor.
        </div>
      </div>
    </section>
  );
}

/**
 * Investor-facing "Deal Room" document. Every section is data-driven from
 * `data` (see lib/dealRoomData.js) — a section simply isn't rendered when
 * its underlying data is absent, per the "no empty headers, no N/A walls"
 * rule. `full`/`metrics` (calculateFullAnalysis + DealRoomPage's metrics)
 * are passed through separately for the chart components. `layout` (from
 * deal_room_layouts, see backend/deal_room_layout.py) drives the two
 * widget-based sections below (Comps, Market Data) — falls back to a
 * generated default (same shape the backend returns) if not provided so
 * this component still works for any caller that hasn't wired it up yet.
 */
export default function InvestorDealRoom({ data, full, metrics, scenarioData, documents, closeDate, layout, accent = DEAL_ROOM_ACCENT_DEFAULT, onGenerateNarrative, generatingNarrative = false, readOnly = false, onUploadImages, onDeleteImage, onReorderImages, uploadingImages = false, imageUploadError = '' }) {
  const containerRef = useRef(null);
  const [activeSection, setActiveSection] = useState('');
  const [progress, setProgress] = useState(0);
  const photoInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [gateEnabled, setGateEnabled] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const dragImageIndex = useRef(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null);

  const layoutSections = layout?.sections || [];
  const getSectionWidgets = (sectionId) => layoutSections.find((s) => s.id === sectionId)?.widgets || [];

  // Comps + Market Data, shared with the sponsor-side layout editor so both
  // always agree on the real data behind each widget (see lib/dealRoomWidgetData.js).
  const { comps, marketMetrics } = useDealRoomWidgetData({
    scenarioData,
    enableMarketData: getSectionWidgets('marketData').length > 0,
  });
  const property = scenarioData?.property || {};

  const resolveWidgetDataset = (sectionId, widget) =>
    resolveWidgetDatasetShared(sectionId, widget, { comps, marketMetrics, property });

  // The sponsor's saved global theme (accent + font) takes precedence over
  // the legacy `accent` prop if present, so a customized theme sticks even
  // if a caller hasn't been updated to pass theme-aware props.
  const effectiveAccent = layout?.theme?.accent || accent;
  const css = useMemo(
    () => buildDealRoomCss({ accent: effectiveAccent, font: layout?.theme?.font }),
    [effectiveAccent, layout?.theme?.font]
  );

  const sections = useMemo(() => {
    const list = [];
    list.push({ id: 'summary', label: 'Executive Summary', show: data.executiveSummary?.length > 0 });
    list.push({ id: 'thesis', label: 'Investment Thesis', show: data.whyMarket?.length > 0 || data.whyAsset?.length > 0 || data.upsidePlays?.length > 0 });
    list.push({ id: 'financials', label: 'Financial Overview', show: data.financialOverview?.length > 0 });
    list.push({ id: 'comps', label: 'Comps', show: getSectionWidgets('comps').length > 0 && comps.length > 0 });
    list.push({ id: 'marketData', label: 'Market Data', show: getSectionWidgets('marketData').length > 0 && marketMetrics.length > 0 });
    list.push({ id: 'documents', label: 'Document Vault', show: (documents?.length || 0) > 0 });
    list.push({ id: 'participation', label: 'Investor Participation', show: data.investorOptions?.length > 0 });
    list.push({ id: 'calculator', label: 'Investor Calculator', show: (full?.financing?.totalEquityRequired || 0) > 0 && (full?.returns?.exitScenarios?.length || 0) > 0 });
    list.push({ id: 'operations', label: 'Operational Plan', show: data.operationalPlan?.length > 0 });
    list.push({ id: 'projections', label: '5-Year Projections', show: data.projections?.length > 0 });
    list.push({ id: 'risks', label: 'Risk Factors', show: data.risks?.length > 0 });
    return list.filter((s) => s.show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, full, documents, comps, marketMetrics, layout]);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const scrolled = window.scrollY;
      const total = el.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0);

      let current = '';
      sections.forEach((s) => {
        const node = document.getElementById(s.id);
        if (node && node.getBoundingClientRect().top < 160) current = s.id;
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDealRoomHtml({
        containerEl: containerRef.current,
        css,
        title: `${data.property.name} — Deal Room`,
        password: gateEnabled && gatePassword ? gatePassword : undefined,
      });
    } catch (e) {
      console.error('[DealRoom] Export failed:', e);
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const hero = data.property.images?.[0];

  return (
    <div className="deal-room">
      <style>{css}</style>
      <div className="dr-progress" style={{ width: `${progress}%` }} />
<CountdownBanner closeDate={closeDate} accent={effectiveAccent} />

      <nav className="dr-nav">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={activeSection === s.id ? 'active' : ''}>{s.label}</a>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }} data-export-exclude>
          {!readOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
              <input type="checkbox" checked={gateEnabled} onChange={(e) => setGateEnabled(e.target.checked)} />
              <Lock size={12} /> Password-protect export
            </label>
          )}
          {!readOnly && gateEnabled && (
            <input
              type="text" placeholder="Password" value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: 110 }}
            />
          )}
          {onGenerateNarrative && (
            <button onClick={onGenerateNarrative} disabled={generatingNarrative} style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer',
            }}>
              {generatingNarrative ? 'Generating…' : (data.whyMarket?.length || data.whyAsset?.length ? 'Regenerate Thesis' : 'Generate Investment Thesis')}
            </button>
          )}
          <button onClick={handleExport} disabled={exporting} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            padding: '6px 12px', borderRadius: 6, border: 'none', background: effectiveAccent, color: '#fff', cursor: 'pointer',
          }}>
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export Investor Link'}
          </button>
        </div>
      </nav>

      <div ref={containerRef}>
        {/* Hero */}
        <div className="dr-hero">
          {hero ? (
            <img src={hero.url} alt={data.property.name} />
          ) : (
            <div className="dr-hero-empty">
              <Camera size={28} />
              {!readOnly && <span>No property photos yet</span>}
            </div>
          )}
          <div className="dr-hero-overlay" />
          <div className="dr-hero-content">
            <div className="dr-hero-title dr-serif">{data.property.name}</div>
            <div className="dr-hero-sub">{data.property.address} — {data.property.assetDescriptor}</div>
            {data.meta.preparerName && (
              <div className="dr-hero-sub" style={{ marginTop: 4 }}>Prepared by {data.meta.preparerName} &middot; {new Date(data.meta.generatedAt).toLocaleDateString()}</div>
            )}
          </div>
          {!readOnly && onUploadImages && (
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }} data-export-exclude>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.length) onUploadImages(e.target.files); e.target.value = ''; }}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingImages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  background: 'rgba(255,255,255,0.95)', color: '#111', cursor: uploadingImages ? 'default' : 'pointer',
                }}
              >
                <Camera size={13} /> {uploadingImages ? 'Uploading…' : (data.property.images?.length ? 'Add Photos' : 'Add Property Photos')}
              </button>
              {imageUploadError && (
                <span style={{ fontSize: 11, color: '#fecaca', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: 5 }}>{imageUploadError}</span>
              )}
            </div>
          )}
        </div>

        {!readOnly && data.property.images?.length > 0 && (
          <div className="dr-photo-strip" data-export-exclude>
            {data.property.images.map((img, i) => (
              <div
                key={img.storage_path || img.url || i}
                className="dr-photo-thumb"
                draggable={!!onReorderImages}
                onDragStart={() => { dragImageIndex.current = i; }}
                onDragOver={(e) => { e.preventDefault(); if (dragOverImageIndex !== i) setDragOverImageIndex(i); }}
                onDragLeave={() => setDragOverImageIndex((cur) => (cur === i ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragImageIndex.current;
                  setDragOverImageIndex(null);
                  dragImageIndex.current = null;
                  if (from == null || from === i || !onReorderImages) return;
                  onReorderImages(from, i);
                }}
                onDragEnd={() => { dragImageIndex.current = null; setDragOverImageIndex(null); }}
                style={{
                  cursor: onReorderImages ? 'grab' : undefined,
                  outline: dragOverImageIndex === i ? '2px solid var(--dr-accent, #0f5132)' : 'none',
                  outlineOffset: 2,
                  transition: 'outline 0.1s',
                }}
              >
                <img src={img.url} alt="" draggable={false} />
                {onDeleteImage && (
                  <button
                    onClick={() => onDeleteImage(img.storage_path)}
                    title="Remove photo"
                    style={{
                      position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                      border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {data.snapshotStats?.length > 0 && (
          <div className="dr-stat-bar">
            {data.snapshotStats.map((s) => (
              <div key={s.label} className="dr-stat">
                <div className="dr-stat-label">{s.label}</div>
                <div className="dr-stat-value">
                  {typeof s.value === 'number' && s.value < 1 && s.value > -1 && s.value !== 0 ? fmtPct(s.value) : (typeof s.value === 'number' ? s.value.toLocaleString() : s.value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Executive Summary */}
        {data.executiveSummary?.length > 0 && (
          <section id="summary" className="dr-section">
            <div className="dr-eyebrow">Executive Summary</div>
            <h2 className="dr-h2 dr-serif">The Opportunity</h2>
            {data.executiveSummary.map((p, i) => <p key={i} className="dr-lead">{p}</p>)}
            <div style={{ marginTop: 24 }}>
              <ValueCreationBridge
                purchasePrice={full?.acquisition?.purchasePrice}
                valueCreation={full?.valueCreation}
                exitValue={full?.stabilized?.value || full?.returns?.terminalValue}
              />
            </div>
          </section>
        )}

        {/* Investment Thesis (AI-grounded, real market + real strategy data) */}
        {(data.whyMarket?.length > 0 || data.whyAsset?.length > 0 || data.upsidePlays?.length > 0) && (
          <section id="thesis" className="dr-section">
            <div className="dr-eyebrow">Investment Thesis</div>
            <h2 className="dr-h2 dr-serif">Why This Deal</h2>
            <div className="dr-two-col">
              {data.whyMarket?.length > 0 && (
                <div className="dr-card">
                  <h3><TrendingUp size={16} /> Why This Market</h3>
                  {data.whyMarket.map((p, i) => <p key={i} style={{ fontSize: 14, marginTop: i ? 10 : 0 }}>{p}</p>)}
                </div>
              )}
              {data.whyAsset?.length > 0 && (
                <div className="dr-card">
                  <h3><Building2 size={16} /> Why This Asset</h3>
                  {data.whyAsset.map((p, i) => <p key={i} style={{ fontSize: 14, marginTop: i ? 10 : 0 }}>{p}</p>)}
                </div>
              )}
            </div>
            {data.upsidePlays?.length > 0 && (
              <div className="dr-two-col" style={{ marginTop: 20 }}>
                {data.upsidePlays.map((play) => (
                  <div key={play.title} className="dr-card">
                    <h3><Sparkles size={16} /> {play.title}</h3>
                    {(play.paragraphs || []).map((p, i) => <p key={i} style={{ fontSize: 14, marginTop: i ? 10 : 0 }}>{p}</p>)}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Financial Overview */}
        {data.financialOverview?.length > 0 && (
          <section id="financials" className="dr-section">
            <div className="dr-eyebrow">Financial Overview</div>
            <h2 className="dr-h2 dr-serif">Acquisition &amp; Operations</h2>
            <div className="dr-two-col">
              {data.financialOverview.map((t) => <TableCard key={t.title} title={t.title} rows={t.rows} />)}
            </div>
          </section>
        )}

        {/* Comps — sponsor-configurable widgets bound to the deal's cached RentCast comps */}
        {sections.some((s) => s.id === 'comps') && (
          <section id="comps" className="dr-section">
            <div className="dr-eyebrow">Comps</div>
            <h2 className="dr-h2 dr-serif">Nearby Comparables</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {getSectionWidgets('comps').map((w) => renderWidget(w, resolveWidgetDataset('comps', w), effectiveAccent))}
            </div>
          </section>
        )}

        {/* Market Data — sponsor-configurable widgets bound to the local market lookup (client/public CSVs) */}
        {sections.some((s) => s.id === 'marketData') && (
          <section id="marketData" className="dr-section">
            <div className="dr-eyebrow">Market Data</div>
            <h2 className="dr-h2 dr-serif">Local Market Snapshot</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {getSectionWidgets('marketData').map((w) => renderWidget(w, resolveWidgetDataset('marketData', w), effectiveAccent))}
            </div>
          </section>
        )}

        {/* Document Vault — only files the sponsor marked visible to investors */}
        <DocumentVault documents={documents} />

        {/* Investor Participation */}
        {data.investorOptions?.length > 0 && (
          <section id="participation" className="dr-section">
            <div className="dr-eyebrow">Investor Participation</div>
            <h2 className="dr-h2 dr-serif">Participation Structures</h2>
            <div className="dr-two-col">
              {data.investorOptions.map((o) => (
                <div key={o.name} className="dr-card">
                  <h3>{o.name}</h3>
                  <table className="dr-table">
                    <tbody>
                      {[...o.terms, ...o.returns].map((r, i) => (
                        <tr key={r.label + i}>
                          <td>{r.label}</td>
                          <td className="dr-num">{r.isPct ? fmtPct(r.value) : r.isMultiple ? fmtMultiple(r.value) : fmtMoney(r.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24 }}>
              <ReturnsComparisonChart options={data.investorOptions} />
            </div>
            {data.distributions?.length > 0 && (
              <div className="dr-card" style={{ marginTop: 20 }}>
                <h3>Distribution History</h3>
                <table className="dr-table">
                  <thead><tr><th>Date</th><th>Type</th><th className="dr-num">Amount</th></tr></thead>
                  <tbody>
                    {data.distributions.map((d, i) => (
                      <tr key={d.id || i}>
                        <td>{d.distribution_date}</td>
                        <td>{d.distribution_type}</td>
                        <td className="dr-num">{fmtMoney(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Interactive Investor Calculator — slide your own investment amount / hold period */}
        <InvestorCalculator full={full} scenarioData={scenarioData} accent={effectiveAccent} />

        {/* Operational Plan */}
        {data.operationalPlan?.length > 0 && (
          <section id="operations" className="dr-section">
            <div className="dr-eyebrow">Operational Plan</div>
            <h2 className="dr-h2 dr-serif">Execution</h2>
            <div className="dr-two-col">
              {data.operationalPlan.map((block) => (
                <div key={block.title} className="dr-card">
                  <h3>{block.title}</h3>
                  <ul className="dr-bullets">
                    {block.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5-Year Projections */}
        {data.projections?.length > 0 && (
          <section id="projections" className="dr-section">
            <div className="dr-eyebrow">Financial Projections</div>
            <h2 className="dr-h2 dr-serif">Five-Year Outlook</h2>
            <NoiCashflowChart years={data.projections} />
            <table className="dr-table" style={{ marginTop: 20 }}>
              <thead>
                <tr>
                  <th>Year</th><th className="dr-num">NOI</th><th className="dr-num">Debt Service</th>
                  <th className="dr-num">Cash Flow</th><th className="dr-num">DSCR</th>
                </tr>
              </thead>
              <tbody>
                {data.projections.map((p) => (
                  <tr key={p.year}>
                    <td>Year {p.year}</td>
                    <td className="dr-num">{fmtMoney(p.noi)}</td>
                    <td className="dr-num">{fmtMoney(p.debtService)}</td>
                    <td className="dr-num">{fmtMoney(p.cashFlow)}</td>
                    <td className="dr-num">{p.dscr != null ? p.dscr.toFixed(2) + 'x' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.exitAnalysis && (
              <div style={{ marginTop: 20 }}>
                <TableCard title={data.exitAnalysis.title} rows={data.exitAnalysis.rows} />
              </div>
            )}
          </section>
        )}

        {/* Risk Factors */}
        {data.risks?.length > 0 && (
          <section id="risks" className="dr-section">
            <div className="dr-eyebrow">Risk Factors</div>
            <h2 className="dr-h2 dr-serif">Risks &amp; Mitigation</h2>
            <table className="dr-table dr-risk-table">
              <thead><tr><th>Risk</th><th>Description</th><th>Mitigation</th></tr></thead>
              <tbody>
                {data.risks.map((r, i) => (
                  <tr key={i}><td>{r.risk}</td><td>{r.description}</td><td>{r.mitigation}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div className="dr-footer">
          <div className="dr-section">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{data.footer.preparer}</div>
            <div style={{ fontSize: 13 }}>
              {[data.footer.contact?.email, data.footer.contact?.phone].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 12, marginTop: 14, color: '#9ca3af' }}>{data.footer.confidentiality}</div>
            <div className="dr-disclaimer">{data.footer.disclaimer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
