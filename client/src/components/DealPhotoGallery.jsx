import React, { useState, useRef } from 'react';
import { X, Upload, Camera, ChevronLeft, ChevronRight, ZoomIn, Wrench, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

// ============================================================================
// CapEx Helpers & Results Panel
// ============================================================================

const URGENCY_COLORS = {
  immediate: { bg: '#fee2e2', text: '#dc2626', label: 'Immediate' },
  '1-2 years': { bg: '#fef3c7', text: '#d97706', label: '1-2 Years' },
  '3-5 years': { bg: '#dbeafe', text: '#2563eb', label: '3-5 Years' },
  cosmetic: { bg: '#f0fdf4', text: '#16a34a', label: 'Cosmetic' },
};
const SEVERITY_COLORS = {
  critical: { bg: '#fee2e2', text: '#dc2626' },
  moderate: { bg: '#fef3c7', text: '#d97706' },
  minor: { bg: '#f0fdf4', text: '#16a34a' },
};
const GRADE_COLORS = { A: '#16a34a', B: '#22c55e', C: '#eab308', D: '#f97316', F: '#dc2626' };

function fmtMoney(val) {
  if (!val && val !== 0) return '-';
  const n = Number(val);
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toLocaleString();
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children }) {
  return (
    <div style={{ marginTop: '8px' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: '700', color: '#374151', textAlign: 'left',
      }}>
        {icon} {title}
        <span style={{ marginLeft: 'auto' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {isOpen && <div style={{ paddingBottom: '4px' }}>{children}</div>}
    </div>
  );
}

function CapExResultsPanel({ estimate, imagesAnalyzed }) {
  const [expandedSection, setExpandedSection] = useState('items');
  if (!estimate) return null;
  const gradeColor = GRADE_COLORS[estimate.property_condition_grade?.[0]] || '#6b7280';

  return (
    <div style={{ borderTop: '2px solid #f97316', backgroundColor: '#fffbf5', overflowY: 'auto', maxHeight: '400px' }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', borderBottom: '1px solid #fed7aa', flexWrap: 'wrap' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '22px', color: '#fff', backgroundColor: gradeColor, flexShrink: 0 }}>
          {estimate.property_condition_grade || '?'}
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>AI CapEx Estimate</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>{estimate.condition_summary?.slice(0, 120)}{estimate.condition_summary?.length > 120 ? '...' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
          {estimate.total_capex_estimate_per_unit > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#ea580c' }}>{fmtMoney(estimate.total_capex_estimate_per_unit)}</div>
              <div style={{ fontSize: '10px', color: '#78716c', textTransform: 'uppercase', fontWeight: '600' }}>per unit</div>
            </div>
          )}
          {estimate.total_capex_estimate_total > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>{fmtMoney(estimate.total_capex_estimate_total)}</div>
              <div style={{ fontSize: '10px', color: '#78716c', textTransform: 'uppercase', fontWeight: '600' }}>total</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280' }}>{imagesAnalyzed}</div>
            <div style={{ fontSize: '10px', color: '#78716c', textTransform: 'uppercase', fontWeight: '600' }}>photos</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        {/* CapEx line items */}
        {estimate.capex_items?.length > 0 && (
          <CollapsibleSection title={`CapEx Items (${estimate.capex_items.length})`} icon={<Wrench size={14} />} isOpen={expandedSection === 'items'} onToggle={() => setExpandedSection(expandedSection === 'items' ? null : 'items')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {estimate.capex_items.map((item, i) => {
                const uc = URGENCY_COLORS[item.urgency] || URGENCY_COLORS.cosmetic;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', backgroundColor: uc.bg, color: uc.text, whiteSpace: 'nowrap', marginTop: '2px' }}>{uc.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{item.item}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{item.observation}</div>
                      {item.notes && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px', fontStyle: 'italic' }}>{item.notes}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#ea580c' }}>{fmtMoney(item.cost_per_unit)}<span style={{ fontSize: '10px', color: '#9ca3af' }}>/unit</span></div>
                      {item.total_cost > 0 && item.total_cost !== item.cost_per_unit && <div style={{ fontSize: '11px', color: '#6b7280' }}>{fmtMoney(item.total_cost)} total</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Deferred maintenance */}
        {estimate.deferred_maintenance_items?.length > 0 && (
          <CollapsibleSection title={`Deferred Maintenance (${estimate.deferred_maintenance_items.length})`} icon={<AlertTriangle size={14} />} isOpen={expandedSection === 'deferred'} onToggle={() => setExpandedSection(expandedSection === 'deferred' ? null : 'deferred')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {estimate.deferred_maintenance_items.map((item, i) => {
                const sc = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.minor;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', backgroundColor: sc.bg, color: sc.text, textTransform: 'capitalize' }}>{item.severity}</span>
                    <div style={{ flex: 1, fontSize: '13px', color: '#1e293b' }}>{item.item}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>{fmtMoney(item.estimated_cost)}</div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Value-add opportunities */}
        {estimate.renovation_opportunities?.length > 0 && (
          <CollapsibleSection title={`Value-Add Opportunities (${estimate.renovation_opportunities.length})`} icon={<TrendingUp size={14} />} isOpen={expandedSection === 'valueadd'} onToggle={() => setExpandedSection(expandedSection === 'valueadd' ? null : 'valueadd')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {estimate.renovation_opportunities.map((opp, i) => (
                <div key={i} style={{ padding: '10px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#15803d' }}>{opp.item}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>+{fmtMoney(opp.estimated_rent_increase_per_unit)}/unit/mo</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '3px' }}>{opp.description}</div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                    <span>Cost: {fmtMoney(opp.cost_per_unit)}/unit</span>
                    {opp.roi_estimate && <span>Payback: {opp.roi_estimate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Per-photo breakdown */}
        {estimate.photo_analysis?.length > 0 && (
          <CollapsibleSection title={`Per-Photo Breakdown (${estimate.photo_analysis.length})`} icon={<Camera size={14} />} isOpen={expandedSection === 'photos'} onToggle={() => setExpandedSection(expandedSection === 'photos' ? null : 'photos')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {estimate.photo_analysis.map((pa, i) => (
                <div key={i} style={{ padding: '8px 10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Photo {pa.photo_index}: {pa.description}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{pa.condition_notes}</div>
                  {pa.items_identified?.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {pa.items_identified.map((tag, j) => (
                        <span key={j} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#f3f4f6', color: '#374151' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Deal Photo Gallery Modal — shows extracted OM photos + user upload + CapEx AI
// ============================================================================

export default function DealPhotoGallery({ deal, images, onClose, onImagesUpdated }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const fileInputRef = useRef(null);

  // CapEx AI state
  const [capexLoading, setCapexLoading] = useState(false);
  const [capexError, setCapexError] = useState(null);
  const [capexResult, setCapexResult] = useState(null);
  const [capexTimer, setCapexTimer] = useState(0);

  const allImages = images || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !deal?.dealId) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await fetch(`${API_BASE_URL}/v2/deals/${deal.dealId}/upload-images`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed: ${res.status}`);
      }

      const data = await res.json();
      if (data.uploaded && data.uploaded.length > 0 && onImagesUpdated) {
        onImagesUpdated([...allImages, ...data.uploaded]);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (img) => {
    if (!window.confirm('Remove this photo?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${deal.dealId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: img.storage_path }),
      });
      if (res.ok && onImagesUpdated) {
        const updated = allImages.filter(i => i.storage_path !== img.storage_path);
        onImagesUpdated(updated);
        if (currentIndex >= updated.length) setCurrentIndex(Math.max(0, updated.length - 1));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRunCapEx = async () => {
    if (!deal?.dealId || allImages.length === 0) return;
    setCapexLoading(true);
    setCapexError(null);
    setCapexResult(null);
    setCapexTimer(0);
    const iv = setInterval(() => setCapexTimer(prev => prev + 1), 1000);
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${deal.dealId}/capex-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_urls: allImages.map(img => img.url), units: deal.units, price: deal.purchasePrice }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Analysis failed: ${res.status}`);
      }
      setCapexResult(await res.json());
    } catch (err) {
      console.error('CapEx analysis error:', err);
      setCapexError(err.message);
    } finally {
      clearInterval(iv);
      setCapexLoading(false);
    }
  };

  const prev = () => setCurrentIndex(i => (i - 1 + allImages.length) % allImages.length);
  const next = () => setCurrentIndex(i => (i + 1) % allImages.length);

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Modal */}
        <div onClick={e => e.stopPropagation()} style={{
          backgroundColor: '#fff', borderRadius: '12px', width: '90vw', maxWidth: '960px',
          maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid #e6e9ef',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#323338' }}>
                {deal?.address || 'Deal'} — Photos
              </h3>
              <span style={{ fontSize: '12px', color: '#676879' }}>
                {allImages.length} photo{allImages.length !== 1 ? 's' : ''}
                {capexResult?.estimate && (
                  <span style={{ marginLeft: '8px', color: '#ea580c', fontWeight: '600' }}>
                    &bull; CapEx: {fmtMoney(capexResult.estimate.total_capex_estimate_per_unit)}/unit
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* CapEx AI button */}
              {allImages.length > 0 && (
                <button onClick={handleRunCapEx} disabled={capexLoading} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                  background: capexLoading ? '#9ca3af' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                  border: 'none', cursor: capexLoading ? 'wait' : 'pointer',
                  boxShadow: capexLoading ? 'none' : '0 2px 8px rgba(249,115,22,0.3)', transition: 'all 0.15s',
                }}>
                  <Wrench size={14} style={capexLoading ? { animation: 'spin 1s linear infinite' } : {}} />
                  {capexLoading ? `Analyzing... ${capexTimer}s` : capexResult ? 'Re-run CapEx AI' : 'Run CapEx AI'}
                </button>
              )}
              {/* Upload button */}
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                backgroundColor: '#579bfc', color: '#fff', borderRadius: '8px', fontSize: '13px',
                fontWeight: '600', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1,
              }}>
                <Upload size={14} />
                {uploading ? 'Uploading...' : 'Upload Photos'}
                <input ref={fileInputRef} type="file" accept="image/*" multiple
                  onChange={handleUpload} disabled={uploading}
                  style={{ display: 'none' }} />
              </label>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
                color: '#676879', borderRadius: '6px',
              }}>
                <X size={20} />
              </button>
            </div>
          </div>

          {uploadError && (
            <div style={{ padding: '8px 20px', backgroundColor: '#fee', color: '#c33', fontSize: '13px' }}>
              {uploadError}
            </div>
          )}

          {capexError && (
            <div style={{ padding: '8px 20px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>
              CapEx Analysis Error: {capexError}
            </div>
          )}

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Main content */}
          {allImages.length === 0 ? (
            /* Empty state */
            <div style={{
              padding: '60px 20px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                backgroundColor: '#f0f1f3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <Camera size={36} color="#c3c6d4" />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#323338' }}>No Photos Yet</h4>
              <p style={{ margin: '0 0 20px', color: '#676879', fontSize: '13px', maxWidth: '360px' }}>
                Upload property photos or re-upload the OM to extract images automatically.
              </p>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
                backgroundColor: '#579bfc', color: '#fff', borderRadius: '8px', fontSize: '14px',
                fontWeight: '600', cursor: 'pointer',
              }}>
                <Upload size={16} /> Upload Photos
                <input ref={fileInputRef} type="file" accept="image/*" multiple
                  onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            </div>
          ) : (
            <>
              {/* Featured image viewer */}
              <div style={{
                position: 'relative', backgroundColor: '#1a1a2e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '300px', maxHeight: '400px', overflow: 'hidden',
              }}>
                <img
                  src={allImages[currentIndex]?.url}
                  alt={`${currentIndex + 1} of ${allImages.length}`}
                  onClick={() => setLightbox(true)}
                  style={{
                    maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', cursor: 'zoom-in',
                  }}
                />

                {/* Nav arrows */}
                {allImages.length > 1 && (
                  <>
                    <button onClick={prev} style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                      backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><ChevronLeft size={20} /></button>
                    <button onClick={next} style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                      backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><ChevronRight size={20} /></button>
                  </>
                )}

                {/* Counter badge */}
                <div style={{
                  position: 'absolute', bottom: '12px', right: '12px',
                  backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px',
                  borderRadius: '999px', fontSize: '12px', fontWeight: '600',
                }}>
                  {currentIndex + 1} / {allImages.length}
                </div>

                {/* Zoom hint */}
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', padding: '4px 8px',
                  borderRadius: '6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <ZoomIn size={12} /> Click to zoom
                </div>

                {/* Page/source label */}
                {allImages[currentIndex]?.page_number && (
                  <div style={{
                    position: 'absolute', top: '12px', left: '12px',
                    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', padding: '4px 10px',
                    borderRadius: '6px', fontSize: '11px',
                  }}>
                    OM Page {allImages[currentIndex].page_number}
                  </div>
                )}

                {/* CapEx loading overlay */}
                {capexLoading && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={40} color="#f97316" style={{ animation: 'spin 1.5s linear infinite' }} />
                    <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700', marginTop: '12px' }}>
                      AI Inspecting {allImages.length} Photos...
                    </div>
                    <div style={{ color: '#f97316', fontSize: '13px', marginTop: '4px' }}>
                      {capexTimer < 5 ? 'Downloading images...' : capexTimer < 15 ? 'Claude Vision analyzing conditions...' : capexTimer < 25 ? 'Estimating costs & identifying repairs...' : 'Finalizing CapEx report...'}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>{capexTimer}s</div>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              <div style={{
                display: 'flex', gap: '8px', padding: '10px 16px',
                overflowX: 'auto', borderTop: '1px solid #e6e9ef',
              }}>
                {allImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={img.url}
                      alt={`Thumb ${idx + 1}`}
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px',
                        cursor: 'pointer', border: idx === currentIndex ? '2px solid #579bfc' : '2px solid transparent',
                        opacity: idx === currentIndex ? 1 : 0.7, transition: 'all 0.15s',
                      }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                      style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: '#d83a52', border: '2px solid #fff',
                        color: '#fff', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CapEx Results Panel */}
          {capexResult?.estimate && (
            <CapExResultsPanel estimate={capexResult.estimate} imagesAnalyzed={capexResult.images_analyzed} />
          )}
          </div>
        </div>
      </div>

      {/* Lightbox (fullscreen zoom) */}
      {lightbox && allImages[currentIndex] && (
        <div onClick={() => setLightbox(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)',
          zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'zoom-out',
        }}>
          <img
            src={allImages[currentIndex].url}
            alt="Fullscreen view"
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }}
          />
          <button onClick={() => setLightbox(false)} style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={22} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ============================================================================
// Thumbnail component for pipeline rows
// ============================================================================

export function DealThumbnail({ images, onClick }) {
  const firstImage = (images || [])[0];

  return (
    <div
      onClick={onClick}
      style={{
        width: '40px', height: '40px', borderRadius: '6px',
        backgroundColor: '#f0f1f3', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, border: '1px solid #e0e3eb',
        transition: 'box-shadow 0.15s', position: 'relative', overflow: 'visible',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 2px #579bfc'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      title={firstImage ? `${images.length} photo${images.length !== 1 ? 's' : ''} — click to view` : 'No photos — click to upload'}
    >
      {firstImage ? (
        <img src={firstImage.url} alt="Property" style={{
          width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px',
        }} />
      ) : (
        <Camera size={16} color="#c3c6d4" />
      )}
      {images && images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '-2px', right: '-2px',
          backgroundColor: '#579bfc', color: '#fff', fontSize: '9px', fontWeight: '700',
          padding: '1px 4px', borderRadius: '999px', lineHeight: 1.2,
        }}>
          {images.length}
        </div>
      )}
    </div>
  );
}
