import React, { useState, useRef } from 'react';
import { X, Upload, Camera, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

// ============================================================================
// Deal Photo Gallery Modal — shows extracted OM photos + user upload
// ============================================================================

export default function DealPhotoGallery({ deal, images, onClose, onImagesUpdated }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const fileInputRef = useRef(null);

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
          backgroundColor: '#fff', borderRadius: '12px', width: '90vw', maxWidth: '900px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderBottom: '1px solid #e6e9ef',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#323338' }}>
                {deal?.address || 'Deal'} — Photos
              </h3>
              <span style={{ fontSize: '12px', color: '#676879' }}>
                {allImages.length} photo{allImages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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

          {/* Main content */}
          {allImages.length === 0 ? (
            /* Empty state */
            <div style={{
              padding: '60px 20px', textAlign: 'center', flex: 1,
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
                minHeight: '360px', maxHeight: '460px', overflow: 'hidden',
              }}>
                <img
                  src={allImages[currentIndex]?.url}
                  alt={`Photo ${currentIndex + 1}`}
                  onClick={() => setLightbox(true)}
                  style={{
                    maxWidth: '100%', maxHeight: '460px', objectFit: 'contain', cursor: 'zoom-in',
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
              </div>

              {/* Thumbnail strip */}
              <div style={{
                display: 'flex', gap: '8px', padding: '12px 16px',
                overflowX: 'auto', borderTop: '1px solid #e6e9ef',
              }}>
                {allImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={img.url}
                      alt={`Thumb ${idx + 1}`}
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px',
                        cursor: 'pointer', border: idx === currentIndex ? '2px solid #579bfc' : '2px solid transparent',
                        opacity: idx === currentIndex ? 1 : 0.7, transition: 'all 0.15s',
                      }}
                    />
                    {/* Delete button on hover */}
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
            alt="Fullscreen"
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
      {/* Badge for count > 1 */}
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
