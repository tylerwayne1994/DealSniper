import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, Info, ExternalLink,
  ArrowLeft, Loader, Send, XCircle, TrendingUp, Building2,
  DollarSign, BarChart3, AlertOctagon, Zap
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

// ─── Grade rendering ───
const gradeStyles = {
  'A+': { bg: '#ecfdf5', border: '#00c875', text: '#047857', ring: '#00c875' },
  'A':  { bg: '#ecfdf5', border: '#00c875', text: '#047857', ring: '#00c875' },
  'A-': { bg: '#ecfdf5', border: '#00c875', text: '#047857', ring: '#00c875' },
  'B+': { bg: '#eff6ff', border: '#579bfc', text: '#1d4ed8', ring: '#579bfc' },
  'B':  { bg: '#eff6ff', border: '#579bfc', text: '#1d4ed8', ring: '#579bfc' },
  'B-': { bg: '#eff6ff', border: '#579bfc', text: '#1d4ed8', ring: '#579bfc' },
  'C+': { bg: '#fffbeb', border: '#fdab3d', text: '#92400e', ring: '#fdab3d' },
  'C':  { bg: '#fffbeb', border: '#fdab3d', text: '#92400e', ring: '#fdab3d' },
  'C-': { bg: '#fffbeb', border: '#fdab3d', text: '#92400e', ring: '#fdab3d' },
  'D+': { bg: '#fef2f2', border: '#e2445c', text: '#991b1b', ring: '#e2445c' },
  'D':  { bg: '#fef2f2', border: '#e2445c', text: '#991b1b', ring: '#e2445c' },
  'D-': { bg: '#fef2f2', border: '#e2445c', text: '#991b1b', ring: '#e2445c' },
  'F':  { bg: '#fef2f2', border: '#7f1d1d', text: '#7f1d1d', ring: '#7f1d1d' },
};

const severityConfig = {
  critical: { icon: XCircle, color: '#e2445c', bg: '#fef2f2', border: '#fecaca', label: 'CRITICAL' },
  warning:  { icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'WARNING' },
  info:     { icon: Info, color: '#579bfc', bg: '#eff6ff', border: '#bfdbfe', label: 'INFO' },
};

const fmt = (v) => {
  if (v == null || v === 0 || isNaN(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

// ─── Component ───
export default function RedFlagScannerPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scanTime, setScanTime] = useState(0);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsScanning(true);
    setError('');
    setResult(null);
    setScanTime(0);

    // Start timer
    const start = Date.now();
    timerRef.current = setInterval(() => setScanTime(Math.floor((Date.now() - start) / 1000)), 100);

    try {
      const resp = await fetch(API_ENDPOINTS.redFlagScan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), notes: notes.trim() || null }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `Server error (${resp.status})`);
      }
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e.message || 'Failed to scan listing');
    } finally {
      setIsScanning(false);
      clearInterval(timerRef.current);
      setScanTime(Math.floor((Date.now() - start) / 1000));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isScanning) {
      e.preventDefault();
      handleScan();
    }
  };

  const gs = result ? (gradeStyles[result.grade] || gradeStyles['C']) : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f1a', fontFamily: 'Figtree, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2b55 100%)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={22} color="#e2445c" />
                AI Red Flag Scanner
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                Paste a listing URL for a 30-second quick-screen before you waste time uploading
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Input Section */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: 16, padding: '32px 36px', marginBottom: 28,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            Paste Listing URL
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
            Crexi, LoopNet, Apartments.com, CREXi, or any commercial listing page
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://www.crexi.com/properties/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isScanning}
                style={{
                  width: '100%', padding: '14px 16px', fontSize: 15, fontWeight: 500,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10, color: '#fff', outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = '#579bfc'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={!url.trim() || isScanning}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px',
                borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700,
                cursor: !url.trim() || isScanning ? 'not-allowed' : 'pointer',
                background: !url.trim() || isScanning
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg, #e2445c 0%, #ff6b6b 100%)',
                color: !url.trim() || isScanning ? 'rgba(255,255,255,0.3)' : '#fff',
                boxShadow: url.trim() && !isScanning ? '0 4px 16px rgba(226,68,92,0.4)' : 'none',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {isScanning ? (
                <>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Scanning... {scanTime}s
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Scan Deal
                </>
              )}
            </button>
          </div>

          {/* Optional notes */}
          <div style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="Optional: broker notes, context (e.g. 'Broker says 95% occupied, asking price firm')"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isScanning}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 13,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: 'rgba(255,255,255,0.7)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Supported sites */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Crexi', 'LoopNet', 'Apartments.com', 'CREXi', 'Zillow', 'Realtor.com', 'Any listing URL'].map(s => (
              <span key={s} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <XCircle size={20} color="#e2445c" />
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Scan Failed</div>
              <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 2 }}>{error}</div>
            </div>
          </div>
        )}

        {/* Loading animation */}
        {isScanning && (
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: 16, padding: '48px 36px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'rgba(226,68,92,0.15)', marginBottom: 16 }}>
              <Shield size={32} color="#e2445c" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Analyzing Listing...</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 500, margin: '0 auto' }}>
              Fetching page data, extracting metrics, comparing against market norms, and grading the deal
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 24, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              {[
                { t: 2, label: 'Fetching page...' },
                { t: 5, label: 'Extracting metrics...' },
                { t: 10, label: 'Market comparison...' },
                { t: 15, label: 'Grading deal...' },
              ].map((step, i) => (
                <span key={i} style={{ color: scanTime >= step.t ? '#579bfc' : 'rgba(255,255,255,0.2)', fontWeight: scanTime >= step.t ? 600 : 400, transition: 'all 0.3s' }}>
                  {scanTime >= step.t ? '✓' : '○'} {step.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isScanning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Grade Card */}
            <div style={{
              background: gs.bg, border: `2px solid ${gs.border}`, borderRadius: 16,
              padding: '28px 36px', display: 'flex', alignItems: 'center', gap: 28,
            }}>
              {/* Grade circle */}
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                border: `4px solid ${gs.ring}`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: '#fff', boxShadow: `0 0 24px ${gs.ring}40`,
              }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: gs.text, lineHeight: 1 }}>
                  {result.grade}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: gs.text, marginBottom: 6 }}>
                  {result.headline}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  {result.recommendation}
                </div>
                <div style={{ marginTop: 10 }}>
                  <a href={result.raw_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#579bfc', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ExternalLink size={12} /> View Original Listing
                  </a>
                  <span style={{ fontSize: 11, color: '#ababab', marginLeft: 16 }}>Scanned in {scanTime}s</span>
                </div>
              </div>
            </div>

            {/* Two-column: Listing Data + Market Context */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Extracted Listing Data */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef', padding: '24px 28px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} color="#579bfc" />
                  Listing Data Extracted
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(() => {
                    const ld = result.listing_data || {};
                    const rows = [
                      { label: 'Address', value: ld.address },
                      { label: 'Location', value: [ld.city, ld.state].filter(Boolean).join(', ') || null },
                      { label: 'Units', value: ld.units > 0 ? ld.units : null },
                      { label: 'Asking Price', value: ld.asking_price > 0 ? fmt(ld.asking_price) : null },
                      { label: 'Price / Unit', value: ld.price_per_unit > 0 ? fmt(ld.price_per_unit) : null },
                      { label: 'Broker Cap Rate', value: ld.broker_cap_rate > 0 ? `${ld.broker_cap_rate}%` : null },
                      { label: 'Broker NOI', value: ld.broker_noi > 0 ? fmt(ld.broker_noi) : null },
                      { label: 'Gross Income', value: ld.gross_income > 0 ? fmt(ld.gross_income) : null },
                      { label: 'Operating Expenses', value: ld.operating_expenses > 0 ? fmt(ld.operating_expenses) : null },
                      { label: 'Year Built', value: ld.year_built > 0 ? ld.year_built : null },
                      { label: 'Occupancy', value: ld.occupancy > 0 ? `${ld.occupancy}%` : null },
                      { label: 'Property Type', value: ld.property_type },
                      { label: 'Square Footage', value: ld.square_footage > 0 ? ld.square_footage.toLocaleString() + ' SF' : null },
                    ].filter(r => r.value);
                    return rows.map((r, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#f9fafb' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>{r.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Market Context */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef', padding: '24px 28px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={18} color="#00c875" />
                  Market Context
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const mc = result.market_context || {};
                    const rows = [
                      { label: 'Market Cap Rate', value: mc.estimated_market_cap_rate, icon: TrendingUp },
                      { label: 'Market Price / Unit', value: mc.estimated_price_per_unit_market, icon: DollarSign },
                      { label: 'Typical Expense Ratio', value: mc.estimated_expense_ratio, icon: BarChart3 },
                      { label: 'Market Rent Range', value: mc.market_rent_range, icon: Building2 },
                      { label: 'Market Vacancy', value: mc.market_vacancy, icon: AlertTriangle },
                    ].filter(r => r.value);
                    return rows.map((r, i) => {
                      const Icon = r.icon;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                          <Icon size={16} color="#047857" />
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#047857' }}>{r.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>{r.value}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {result.market_context?.market_trends && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f9fafb', fontSize: 12, color: '#6b7280', lineHeight: 1.5, border: '1px solid #e5e7eb' }}>
                      <strong style={{ color: '#1e1e2e' }}>Trends:</strong> {result.market_context.market_trends}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Red Flags */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef', padding: '24px 28px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertOctagon size={18} color="#e2445c" />
                Red Flags ({result.red_flags?.length || 0})
              </div>
              {result.red_flags && result.red_flags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.red_flags.map((rf, i) => {
                    const sev = severityConfig[rf.severity] || severityConfig.info;
                    const SevIcon = sev.icon;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderRadius: 12, background: sev.bg, border: `1px solid ${sev.border}` }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          <SevIcon size={18} color={sev.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: sev.color }}>{rf.flag}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: sev.color, color: '#fff' }}>
                              {sev.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{rf.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: '#10b981', fontWeight: 700 }}>
                  <CheckCircle size={28} style={{ marginBottom: 8 }} />
                  <div>No red flags detected! This deal looks clean.</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => { setResult(null); setUrl(''); setNotes(''); setError(''); inputRef.current?.focus(); }}
                style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #e6e9ef', background: '#fff', color: '#323338', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Zap size={16} />
                Scan Another Deal
              </button>
              {['A+', 'A', 'A-', 'B+', 'B', 'B-'].includes(result.grade) && (
                <button
                  onClick={() => navigate('/underwrite')}
                  style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #00c875 0%, #00a86b 100%)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,200,117,0.3)' }}
                >
                  <Send size={16} />
                  Upload OM for Full Underwrite
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !isScanning && !error && (
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: 16, padding: '48px 36px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 18, background: 'rgba(226,68,92,0.1)', marginBottom: 20, border: '1px solid rgba(226,68,92,0.2)' }}>
              <Shield size={36} color="#e2445c" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Screen Deals in 30 Seconds</h3>
            <p style={{ margin: '0 auto', maxWidth: 500, fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              Paste any listing URL and get an instant AI analysis — cap rate vs market, price per unit benchmarks,
              expense ratio flags, and a letter grade. Know if a deal is worth uploading before wasting your time.
            </p>
            <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 600, margin: '28px auto 0' }}>
              {[
                { icon: '🎯', title: 'Cap Rate Check', desc: 'Compare broker cap vs market avg' },
                { icon: '💰', title: 'Price / Unit', desc: 'Compare against submarket comps' },
                { icon: '📊', title: 'Expense Audit', desc: 'Flag unrealistic expense ratios' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '20px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
