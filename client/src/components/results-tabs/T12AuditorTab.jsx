import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

// ─── Theme ──────────────────────────────────────────────────────────────────
const B  = '#e5e7eb';
const AC = '#4f46e5';
const LB = '#6b7280';
const VL = '#111827';
const card = {
  backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
  marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
};

// ─── Category Colors ────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  'FINANCIAL RED FLAGS':      { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', icon: '💰' },
  'RENT ROLL ISSUES':         { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa', icon: '🏠' },
  'PRO FORMA ASSUMPTIONS':    { bg: '#fefce8', text: '#ca8a04', border: '#fef08a', icon: '📊' },
  'VALUATION CONCERNS':       { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8', icon: '🏷️' },
  'PROPERTY CONDITION':       { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe', icon: '🔧' },
  'MARKET / LOCATION':        { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', icon: '📍' },
  'LEGAL / REGULATORY':       { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: '⚖️' },
  'SELLER NARRATIVE RED FLAGS':{ bg: '#fff1f2', text: '#e11d48', border: '#fecdd3', icon: '🚩' },
  'DATA QUALITY':             { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', icon: '📋' },
  'DEAL STRUCTURE':           { bg: '#f5f3ff', text: '#6d28d9', border: '#c4b5fd', icon: '🤝' },
};

const getCategoryStyle = (cat) => CATEGORY_COLORS[cat] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', icon: '⚠️' };

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtNum = (n) => {
  if (n == null) return '';
  const num = Number(n);
  if (num === 0) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

function getCellHighlight(value, allValues) {
  if (!value || !allValues || allValues.length < 3) return {};
  const nonZero = allValues.filter(v => v !== 0 && v != null);
  if (nonZero.length < 3) return {};
  const sorted = [...nonZero].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median === 0) return {};
  const ratio = value / median;
  if (value < 0 && median > 0) return { backgroundColor: '#fef2f2', color: '#dc2626' };
  if (ratio > 2.5) return { backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 700 };
  if (ratio < 0.3) return { backgroundColor: '#fef9c3', color: '#92400e', fontWeight: 700 };
  if (value < 0) return { backgroundColor: '#fef2f2', color: '#dc2626' };
  return {};
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function T12AuditorTab({ scenarioData, dealId }) {
  const [t12Data, setT12Data] = useState(null);
  const [auditFindings, setAuditFindings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('insights'); // 'insights' | 't12'
  const [highlightedCells, setHighlightedCells] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const tableRef = useRef(null);

  useEffect(() => {
    if (scenarioData?._t12_cached) {
      setT12Data(scenarioData._t12_cached.t12_data || null);
      setAuditFindings(scenarioData._t12_cached.audit_findings || []);
      setSummary(scenarioData._t12_cached.summary || null);
    }
  }, [scenarioData?._t12_cached]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/t12/extract-and-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_markdown: scenarioData?._raw_markdown || '',
          scenarioData: scenarioData || {},
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed: ${response.status}`);
      }
      const data = await response.json();
      if (data.ok) {
        setT12Data(data.t12_data);
        setAuditFindings(data.audit_findings || []);
        setSummary(data.summary || {});
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      console.error('OM audit failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [scenarioData]);

  // Build flat row list for spreadsheet
  const spreadsheetRows = useMemo(() => {
    if (!t12Data?.sections) return [];
    const rows = [];
    let rowIdx = 0;
    t12Data.sections.forEach((section) => {
      rows.push({ type: 'section-header', label: section.name, rowIdx: rowIdx++ });
      (section.lines || []).forEach((line) => {
        const annual = line.annual_total || (line.values || []).reduce((s, v) => s + (v || 0), 0);
        rows.push({ type: 'line', code: line.code || '', description: line.description || '', values: line.values || new Array(12).fill(0), annual, rowIdx: rowIdx++ });
      });
      if (section.subtotal_label) {
        const annual = (section.subtotal_values || []).reduce((s, v) => s + (v || 0), 0);
        rows.push({ type: 'subtotal', label: section.subtotal_label, values: section.subtotal_values || new Array(12).fill(0), annual, rowIdx: rowIdx++ });
      }
      rows.push({ type: 'spacer', rowIdx: rowIdx++ });
    });
    if (t12Data.noi_values) {
      const annual = t12Data.noi_values.reduce((s, v) => s + (v || 0), 0);
      rows.push({ type: 'noi', label: 'Net Operating Income', values: t12Data.noi_values, annual, rowIdx: rowIdx++ });
    }
    return rows;
  }, [t12Data]);

  // Unique categories from findings
  const categories = useMemo(() => {
    const cats = [...new Set(auditFindings.map(f => f.category).filter(Boolean))];
    return ['ALL', ...cats];
  }, [auditFindings]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    if (categoryFilter === 'ALL') return auditFindings;
    return auditFindings.filter(f => f.category === categoryFilter);
  }, [auditFindings, categoryFilter]);

  // Severity badge
  const SeverityBadge = ({ severity }) => {
    const colors = {
      1: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
      2: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
      3: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
      4: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
      5: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    };
    const c = colors[Math.min(severity, 5)] || colors[3];
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 800,
        backgroundColor: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
        flexShrink: 0,
      }}>
        {severity}
      </span>
    );
  };

  const handleFindingClick = (finding) => {
    if (!finding.affected_months || finding.affected_months.length === 0) return;
    const cells = {};
    finding.affected_months.forEach((month) => {
      spreadsheetRows.forEach((row) => {
        if (row.type === 'line' || row.type === 'subtotal' || row.type === 'noi') {
          cells[`${row.rowIdx}-${month - 1}`] = true;
        }
      });
    });
    setHighlightedCells(cells);
    setActiveSubTab('t12');
    if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const months = t12Data?.months || ['Mo 1', 'Mo 2', 'Mo 3', 'Mo 4', 'Mo 5', 'Mo 6', 'Mo 7', 'Mo 8', 'Mo 9', 'Mo 10', 'Mo 11', 'Mo 12'];
  const sourceFile = scenarioData?.source_filename || 'Uploaded Document';
  const isExtracted = t12Data?.is_extracted;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

        {/* ═══ TOP BAR ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: LB, marginBottom: 2 }}>Auditing: {sourceFile}</div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '10px 24px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #dc2626, #ef4444)',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 12px rgba(220,38,38,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Auditing Document...
              </>
            ) : auditFindings.length > 0 ? '⟳ Re-audit' : '🔍 Audit Full Document'}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Error */}
        {error && (
          <div style={{ ...card, borderLeft: '4px solid #dc2626', backgroundColor: '#fef2f2' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Audit Failed</div>
            <div style={{ fontSize: 12, color: '#991b1b' }}>{error}</div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {!t12Data && !loading && !error && (
          <div style={{ ...card, textAlign: 'center', padding: '60px 28px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: VL, marginBottom: 8 }}>OM Document Auditor</div>
            <div style={{ fontSize: 13, color: LB, maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
              Click <strong>"Audit Full Document"</strong> to run AI analysis across your entire uploaded document —
              financials, rent roll, pro forma, property condition, market claims, legal, and more.
              Every claim, number and assumption gets scrutinized.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
              {[
                { icon: '💰', label: 'Financial Audit', desc: 'T-12 anomalies & NOI' },
                { icon: '🏠', label: 'Rent Roll', desc: 'Lease & vacancy flags' },
                { icon: '📊', label: 'Pro Forma', desc: 'Assumption stress test' },
                { icon: '🏷️', label: 'Valuation', desc: 'Cap rate & pricing' },
                { icon: '🚩', label: 'Red Flags', desc: 'Seller narrative audit' },
              ].map((f, i) => (
                <div key={i} style={{ textAlign: 'center', width: 100 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: VL }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: LB }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LOADING STATE ═══ */}
        {loading && (
          <div style={{ ...card, textAlign: 'center', padding: '60px 28px' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #e5e7eb', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: VL, marginBottom: 4 }}>Auditing Full Document...</div>
            <div style={{ fontSize: 12, color: LB }}>Analyzing financials, rent roll, pro forma, property condition, market claims, legal terms, and more</div>
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {(t12Data || auditFindings.length > 0) && !loading && (
          <>
            {/* Sub-tab toggle */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 16, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3, width: 'fit-content' }}>
              {[
                { id: 'insights', label: 'Audit Findings', badge: auditFindings.length || null },
                { id: 't12', label: 'T-12 Spreadsheet', badge: null },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveSubTab(tab.id); setHighlightedCells({}); }}
                  style={{
                    padding: '8px 20px', border: 'none', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    backgroundColor: activeSubTab === tab.id ? 'white' : 'transparent',
                    color: activeSubTab === tab.id ? VL : LB,
                    boxShadow: activeSubTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                  {tab.badge && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 800,
                      backgroundColor: '#fef2f2', color: '#dc2626', padding: '0 5px',
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                AUDIT FINDINGS
                ═══════════════════════════════════════════════════════════════ */}
            {activeSubTab === 'insights' && (
              <div>
                {/* Executive Summary */}
                {summary?.executive_summary && (
                  <div style={{ ...card, borderLeft: '4px solid #4f46e5', marginBottom: 20, padding: '16px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: LB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Executive Summary</div>
                    <div style={{ fontSize: 13, color: VL, lineHeight: 1.7 }}>{summary.executive_summary}</div>
                  </div>
                )}

                {/* Summary bar */}
                {summary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total Findings', value: summary.total_findings || auditFindings.length, color: '#6366f1' },
                      { label: 'Critical', value: summary.critical_count || auditFindings.filter(f => f.severity <= 2).length, color: '#dc2626' },
                      { label: 'Warnings', value: summary.warning_count || auditFindings.filter(f => f.severity === 3).length, color: '#f59e0b' },
                      { label: 'Risk Rating', value: (summary.overall_risk_rating || 'N/A').toUpperCase(), color: summary.overall_risk_rating === 'high' || summary.overall_risk_rating === 'very_high' ? '#dc2626' : '#f59e0b' },
                      { label: 'Data Quality', value: (summary.overall_data_quality || 'N/A').charAt(0).toUpperCase() + (summary.overall_data_quality || 'n/a').slice(1), color: '#10b981' },
                    ].map((m, i) => (
                      <div key={i} style={{ ...card, marginBottom: 0, borderLeft: `4px solid ${m.color}`, padding: '12px 16px' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: LB, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: VL }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category filter pills */}
                {categories.length > 2 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {categories.map((cat) => {
                      const isActive = categoryFilter === cat;
                      const catStyle = cat === 'ALL' ? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', icon: '🔎' } : getCategoryStyle(cat);
                      const count = cat === 'ALL' ? auditFindings.length : auditFindings.filter(f => f.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          style={{
                            padding: '5px 12px', border: `1.5px solid ${isActive ? catStyle.text : catStyle.border}`,
                            borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            backgroundColor: isActive ? catStyle.bg : 'white',
                            color: isActive ? catStyle.text : LB,
                            display: 'flex', alignItems: 'center', gap: 5,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span>{catStyle.icon}</span>
                          {cat === 'ALL' ? 'All' : cat.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 16, height: 16, borderRadius: 8, fontSize: 9, fontWeight: 800,
                            backgroundColor: isActive ? catStyle.text : '#e5e7eb',
                            color: isActive ? 'white' : '#6b7280', padding: '0 4px',
                          }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Findings list */}
                {filteredFindings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredFindings.map((finding, idx) => {
                      const catStyle = getCategoryStyle(finding.category);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleFindingClick(finding)}
                          style={{
                            ...card, marginBottom: 0, padding: '18px 20px',
                            cursor: finding.affected_months?.length ? 'pointer' : 'default',
                            borderLeft: `4px solid ${finding.severity <= 1 ? '#dc2626' : finding.severity <= 2 ? '#ea580c' : finding.severity <= 3 ? '#ca8a04' : finding.severity <= 4 ? '#2563eb' : '#16a34a'}`,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <SeverityBadge severity={finding.severity} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: VL }}>
                                  {finding.title}
                                </div>
                                {finding.category && (
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                                    padding: '2px 8px', borderRadius: 4,
                                    backgroundColor: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {catStyle.icon} {finding.category}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
                                {finding.description}
                              </div>
                              {finding.impact && (
                                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 6 }}>
                                  💥 Impact: {finding.impact}
                                </div>
                              )}
                              {finding.recommendation && (
                                <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 500, marginBottom: 4 }}>
                                  💡 {finding.recommendation}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                {finding.affected_line && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: AC, backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 4 }}>
                                    {finding.affected_line}
                                  </span>
                                )}
                                {finding.affected_months?.map((m) => (
                                  <span key={m} style={{ fontSize: 10, fontWeight: 600, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: 4 }}>
                                    Month {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ ...card, textAlign: 'center', padding: '40px 28px' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: VL }}>No issues detected</div>
                    <div style={{ fontSize: 12, color: LB, marginTop: 4 }}>The document appears clean — no anomalies or red flags found</div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                T-12 SPREADSHEET
                ═══════════════════════════════════════════════════════════════ */}
            {activeSubTab === 't12' && (
              <div>
                {/* Data source badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '3px 10px', borderRadius: 6,
                    backgroundColor: isExtracted ? '#dcfce7' : '#fef3c7',
                    color: isExtracted ? '#166534' : '#92400e',
                  }}>
                    {isExtracted ? '✓ Extracted from document' : '⚡ Generated from annual data'}
                  </span>
                  {t12Data?.source_description && (
                    <span style={{ fontSize: 11, color: LB }}>{t12Data.source_description}</span>
                  )}
                </div>

                <div ref={tableRef} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', minWidth: 1400 }}>
                      <colgroup>
                        <col style={{ width: 40 }} />
                        <col style={{ width: 280 }} />
                        {months.map((_, i) => <col key={i} style={{ width: 90 }} />)}
                        <col style={{ width: 100 }} />
                      </colgroup>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: `2px solid ${B}` }}>
                          <th style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, color: LB, fontSize: 10, borderRight: `1px solid ${B}` }}>#</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#374151', borderRight: `1px solid ${B}` }}>Description</th>
                          {months.map((m, i) => (
                            <th key={i} style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600, color: '#374151', borderRight: `1px solid ${B}`, fontSize: 10 }}>
                              {m}
                            </th>
                          ))}
                          <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#374151', backgroundColor: '#f0f9ff' }}>Annual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spreadsheetRows.map((row) => {
                          if (row.type === 'section-header') {
                            return (
                              <tr key={row.rowIdx} style={{ backgroundColor: '#f1f5f9' }}>
                                <td style={{ padding: '8px 6px', borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`, textAlign: 'center', fontSize: 10, color: LB }}>{row.rowIdx + 1}</td>
                                <td colSpan={14} style={{ padding: '8px', fontWeight: 800, fontSize: 11, color: VL, borderBottom: `1px solid ${B}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {row.label}
                                </td>
                              </tr>
                            );
                          }
                          if (row.type === 'spacer') {
                            return (
                              <tr key={row.rowIdx} style={{ height: 6 }}>
                                <td colSpan={15} style={{ borderBottom: `1px solid ${B}`, padding: 0 }}></td>
                              </tr>
                            );
                          }
                          const isSubtotal = row.type === 'subtotal';
                          const isNOI = row.type === 'noi';
                          const isBold = isSubtotal || isNOI;
                          const bgColor = isNOI ? '#eef2ff' : isSubtotal ? '#fafafa' : 'white';
                          const borderBtm = isBold ? `2px solid ${isNOI ? '#818cf8' : B}` : `1px solid #f1f5f9`;
                          return (
                            <tr key={row.rowIdx} style={{ backgroundColor: bgColor }}>
                              <td style={{ padding: '6px', textAlign: 'center', fontSize: 10, color: '#9ca3af', borderRight: `1px solid ${B}`, borderBottom: borderBtm }}>{row.rowIdx + 1}</td>
                              <td style={{ padding: '6px 8px', fontWeight: isBold ? 700 : 400, color: isNOI ? AC : VL, borderRight: `1px solid ${B}`, borderBottom: borderBtm, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.type === 'line' ? (
                                  <span>{row.code && <span style={{ color: LB, marginRight: 6, fontSize: 10 }}>{row.code}</span>}{row.description}</span>
                                ) : row.label}
                              </td>
                              {(row.values || []).map((val, mi) => {
                                const isHighlighted = highlightedCells[`${row.rowIdx}-${mi}`];
                                const anomalyStyle = row.type === 'line' ? getCellHighlight(val, row.values) : {};
                                return (
                                  <td key={mi} style={{
                                    padding: '6px', textAlign: 'right', fontWeight: isBold ? 700 : 400,
                                    color: val < 0 ? '#dc2626' : (isNOI ? AC : VL),
                                    borderRight: `1px solid ${B}`, borderBottom: borderBtm,
                                    fontSize: 11, fontFamily: 'monospace',
                                    ...(isHighlighted ? { backgroundColor: '#fef9c3', outline: '2px solid #f59e0b', outlineOffset: -2 } : {}),
                                    ...anomalyStyle,
                                  }}>
                                    {fmtNum(val)}
                                  </td>
                                );
                              })}
                              <td style={{
                                padding: '6px 8px', textAlign: 'right', fontWeight: 700,
                                color: row.annual < 0 ? '#dc2626' : (isNOI ? AC : VL),
                                borderBottom: borderBtm, backgroundColor: isNOI ? '#e0e7ff' : '#f0f9ff',
                                fontSize: 11, fontFamily: 'monospace',
                              }}>
                                {fmtNum(row.annual)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
