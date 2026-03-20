import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, Info, ExternalLink,
  ArrowLeft, Loader, Send, XCircle, TrendingUp, Building2,
  DollarSign, BarChart3, AlertOctagon, Zap, Search
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

// ─── Grade rendering ───
const gradeStyles = {
  'A+': { bg: '#ecfdf5', border: '#10b981', text: '#047857', ring: '#10b981' },
  'A':  { bg: '#ecfdf5', border: '#10b981', text: '#047857', ring: '#10b981' },
  'A-': { bg: '#ecfdf5', border: '#10b981', text: '#047857', ring: '#10b981' },
  'B+': { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', ring: '#3b82f6' },
  'B':  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', ring: '#3b82f6' },
  'B-': { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', ring: '#3b82f6' },
  'C+': { bg: '#fef3f2', border: '#f97316', text: '#c2410c', ring: '#f97316' },
  'C':  { bg: '#fef3f2', border: '#f97316', text: '#c2410c', ring: '#f97316' },
  'C-': { bg: '#fef3f2', border: '#ef4444', text: '#b91c1c', ring: '#ef4444' },
  'D+': { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', ring: '#dc2626' },
  'D':  { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', ring: '#dc2626' },
  'D-': { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', ring: '#dc2626' },
  'F':  { bg: '#fef2f2', border: '#7f1d1d', text: '#7f1d1d', ring: '#7f1d1d' },
};

const severityConfig = {
  critical: { icon: XCircle, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'CRITICAL' },
  warning:  { icon: AlertTriangle, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'WARNING' },
  info:     { icon: Info, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'INFO' },
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
  const startRef = useRef(0);

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

    startRef.current = Date.now();
    timerRef.current = setInterval(() => setScanTime(Math.floor((Date.now() - startRef.current) / 1000)), 100);

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
      setScanTime(Math.floor((Date.now() - startRef.current) / 1000));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isScanning) {
      e.preventDefault();
      handleScan();
    }
  };

  const gs = result ? (gradeStyles[result.grade] || gradeStyles['C']) : null;
  const listingImage = result?.listing_data?.image_url || null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', fontFamily: 'Figtree, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#fff', padding: '16px 24px', borderBottom: '1px solid #e6e9ef' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f6f7fb', border: '1px solid #e6e9ef', borderRadius: 8, color: '#323338', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e1e2e', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={22} color="#dc2626" />
                AI Red Flag Scanner
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#676879' }}>
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
          background: '#fff', borderRadius: 14, padding: '28px 32px', marginBottom: 24,
          border: '1px solid #e6e9ef', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1e2e', marginBottom: 4 }}>
            Paste Listing URL
          </div>
          <div style={{ fontSize: 12, color: '#676879', marginBottom: 14 }}>
            Crexi, LoopNet, Apartments.com, Zillow, Realtor.com, or any commercial listing page
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <Search size={16} color="#9ca3af" />
              </div>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://www.crexi.com/properties/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isScanning}
                style={{
                  width: '100%', padding: '12px 16px 12px 40px', fontSize: 14, fontWeight: 500,
                  background: '#fff', border: '1px solid #d0d4e4',
                  borderRadius: 10, color: '#1e1e2e', outline: 'none',
                  transition: 'border-color 0.2s', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#d0d4e4'}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={!url.trim() || isScanning}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700,
                cursor: !url.trim() || isScanning ? 'not-allowed' : 'pointer',
                background: !url.trim() || isScanning
                  ? '#e5e7eb'
                  : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                color: !url.trim() || isScanning ? '#9ca3af' : '#fff',
                boxShadow: url.trim() && !isScanning ? '0 2px 8px rgba(220,38,38,0.25)' : 'none',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
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

          {/* Notes / paste listing text */}
          <div style={{ marginTop: 12 }}>
            <textarea
              placeholder="Paste listing details here (address, units, price, cap rate, NOI, year built, occupancy, etc.) — works as fallback if URL fetch is blocked by the site"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isScanning}
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 13,
                background: '#f9fafb', border: '1px solid #e6e9ef',
                borderRadius: 8, color: '#374151', outline: 'none',
                boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e6e9ef'}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Tip: If the URL scan fails, paste the listing text above — AI will analyze whatever you provide
            </div>
          </div>

          {/* Supported sites */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Crexi', 'LoopNet', 'Apartments.com', 'Zillow', 'Realtor.com', 'Any listing URL'].map(s => (
              <span key={s} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <XCircle size={20} color="#dc2626" />
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>Scan Failed</div>
              <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 2 }}>{error}</div>
            </div>
          </div>
        )}

        {/* Loading animation */}
        {isScanning && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '48px 36px', textAlign: 'center',
            border: '1px solid #e6e9ef', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: '#fef2f2', marginBottom: 16 }}>
              <Shield size={32} color="#dc2626" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e1e2e', marginBottom: 8 }}>Analyzing Listing...</div>
            <div style={{ fontSize: 13, color: '#676879', maxWidth: 500, margin: '0 auto' }}>
              Fetching page data, extracting metrics, comparing against market norms, and grading the deal
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12 }}>
              {[
                { t: 2, label: 'Fetching page...' },
                { t: 5, label: 'Extracting metrics...' },
                { t: 10, label: 'Market comparison...' },
                { t: 15, label: 'Grading deal...' },
              ].map((step, i) => (
                <span key={i} style={{
                  color: scanTime >= step.t ? '#16a34a' : '#d1d5db',
                  fontWeight: scanTime >= step.t ? 600 : 400,
                  transition: 'all 0.3s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {scanTime >= step.t ? <CheckCircle size={13} color="#16a34a" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #d1d5db' }} />}
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ RESULTS ═══════════════ */}
        {result && !isScanning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Grade Card — with optional listing image */}
            <div style={{
              background: '#fff', borderRadius: 14, overflow: 'hidden',
              border: '1px solid #e6e9ef', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'row',
            }}>
              {/* Listing photo (if available) */}
              {listingImage && (
                <div style={{ width: 220, minHeight: 180, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={listingImage}
                    alt="Listing"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 28, flex: 1 }}>
                {/* Grade circle */}
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  border: `4px solid ${gs.ring}`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: gs.bg, boxShadow: `0 0 20px ${gs.ring}20`,
                }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: gs.text, lineHeight: 1 }}>
                    {result.grade}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1e1e2e', marginBottom: 6 }}>
                    {result.headline}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65 }}>
                    {result.recommendation}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <a href={result.raw_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <ExternalLink size={12} /> View Original Listing
                    </a>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Scanned in {scanTime}s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column: Listing Data + Market Context */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Extracted Listing Data */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef',
                padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} color="#3b82f6" />
                  Listing Data Extracted
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: '#f8f9fc', border: '1px solid #eef0f4',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af', marginBottom: 3 }}>{r.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>{r.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Market Context */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef',
                padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={18} color="#10b981" />
                  Market Context
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const mc = result.market_context || {};
                    const rows = [
                      { label: 'Market Cap Rate', value: mc.estimated_market_cap_rate, icon: TrendingUp, color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe' },
                      { label: 'Market Price / Unit', value: mc.estimated_price_per_unit_market, icon: DollarSign, color: '#10b981', bg: '#ecfdf5', border: '#d1fae5' },
                      { label: 'Typical Expense Ratio', value: mc.estimated_expense_ratio, icon: BarChart3, color: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe' },
                      { label: 'Market Rent Range', value: mc.market_rent_range, icon: Building2, color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe' },
                      { label: 'Market Vacancy', value: mc.market_vacancy, icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
                    ].filter(r => r.value);
                    return rows.map((r, i) => {
                      const Icon = r.icon;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 10,
                          background: r.bg, border: `1px solid ${r.border}`,
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#fff', border: `1px solid ${r.border}`,
                          }}>
                            <Icon size={16} color={r.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: r.color }}>{r.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>{r.value}</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {result.market_context?.market_trends && (
                    <div style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: '#f8f9fc', fontSize: 12, color: '#6b7280',
                      lineHeight: 1.6, border: '1px solid #eef0f4',
                    }}>
                      <strong style={{ color: '#1e1e2e' }}>Trends:</strong> {result.market_context.market_trends}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Red Flags */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e6e9ef',
              padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1e2e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertOctagon size={18} color="#dc2626" />
                Red Flags ({result.red_flags?.length || 0})
              </div>
              {result.red_flags && result.red_flags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.red_flags.map((rf, i) => {
                    const sev = severityConfig[rf.severity] || severityConfig.info;
                    const SevIcon = sev.icon;
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 14, padding: '14px 18px', borderRadius: 12,
                        background: sev.bg, border: `1px solid ${sev.border}`,
                      }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          <SevIcon size={18} color={sev.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>{rf.flag}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                              padding: '2px 8px', borderRadius: 999,
                              background: sev.color, color: '#fff',
                            }}>
                              {sev.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{rf.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: '#10b981' }}>
                  <CheckCircle size={28} style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 700 }}>No red flags detected! This deal looks clean.</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', paddingBottom: 24 }}>
              <button
                onClick={() => { setResult(null); setUrl(''); setNotes(''); setError(''); inputRef.current?.focus(); }}
                style={{
                  padding: '12px 24px', borderRadius: 10, border: '1px solid #e6e9ef',
                  background: '#fff', color: '#323338', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Zap size={16} />
                Scan Another Deal
              </button>
              {['A+', 'A', 'A-', 'B+', 'B', 'B-'].includes(result.grade) && (
                <button
                  onClick={() => navigate('/underwrite')}
                  style={{
                    padding: '12px 24px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                  }}
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
            background: '#fff', borderRadius: 14, padding: '48px 36px', textAlign: 'center',
            border: '1px solid #e6e9ef', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 18, background: '#fef2f2',
              marginBottom: 20, border: '1px solid #fecaca',
            }}>
              <Shield size={36} color="#dc2626" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#1e1e2e' }}>Screen Deals in 30 Seconds</h3>
            <p style={{ margin: '0 auto', maxWidth: 500, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
              Paste any listing URL and get an instant AI analysis — cap rate vs market, price per unit benchmarks,
              expense ratio flags, and a letter grade. Know if a deal is worth uploading before wasting your time.
            </p>
            <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 600, margin: '28px auto 0' }}>
              {[
                { icon: TrendingUp, title: 'Cap Rate Check', desc: 'Compare broker cap vs market avg', color: '#3b82f6', bg: '#eff6ff' },
                { icon: DollarSign, title: 'Price / Unit', desc: 'Compare against submarket comps', color: '#10b981', bg: '#ecfdf5' },
                { icon: BarChart3, title: 'Expense Audit', desc: 'Flag unrealistic expense ratios', color: '#8b5cf6', bg: '#f5f3ff' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} style={{
                    padding: '24px 16px', borderRadius: 12, background: '#f8f9fc',
                    border: '1px solid #eef0f4',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: f.bg,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 12,
                    }}>
                      <Icon size={22} color={f.color} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1e2e', marginBottom: 4 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{f.desc}</div>
                  </div>
                );
              })}
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
