import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search, Loader } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDFViewerModal - Displays PDF with highlighted extraction source
 * Mirrors Cactus behavior: renders pages via pdf.js + overlays highlight rects
 */
export default function PDFViewerModal({ 
  isOpen,
  onClose,
  pdfUrl,
  highlightInfo = {},
  fieldLabel,
  fieldValue
}) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const [zoom, setZoom] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightRects, setHighlightRects] = useState([]);

  // Normalize search strings so $5,000 == 5000
  const normalizeText = (text = '') =>
    text
      .toString()
      .replace(/[,$]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();

  const computeHighlightRects = useCallback(async (page, viewport, rawSearch = '') => {
    const cleanedSearch = normalizeText(rawSearch);
    if (!cleanedSearch || cleanedSearch.length < 2) return [];

    try {
      const textContent = await page.getTextContent();
      const rects = [];

      textContent.items.forEach(item => {
        const raw = (item.str || '').trim();
        if (!raw) return;

        const normalizedItem = normalizeText(raw);
        if (!normalizedItem) return;

        if (
          normalizedItem.includes(cleanedSearch) ||
          cleanedSearch.includes(normalizedItem)
        ) {
          try {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const x = tx[4];
            const yFromBottom = tx[5];
            const width = (item.width || 0) * viewport.scale;
            const height = (item.height || 0) * viewport.scale;
            const yTop = viewport.height - yFromBottom;

            rects.push({
              leftPct: (x / viewport.width) * 100,
              topPct: (yTop / viewport.height) * 100,
              widthPct: (width / viewport.width) * 100,
              heightPct: (height / viewport.height) * 100
            });
          } catch (err) {
            // Ignore transform failures for individual text runs
          }
        }
      });

      return rects;
    } catch (err) {
      console.error('[PDF Viewer] Failed to compute highlights', err);
      return [];
    }
  }, []);

  const renderPage = useCallback(async () => {
    if (!pdfRef.current || !canvasRef.current) return;
    try {
      const page = await pdfRef.current.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setIsLoading(true);
      await page.render({ canvasContext: context, viewport }).promise;
      setIsLoading(false);

      if (highlightInfo?.searchTerm) {
        const rects = await computeHighlightRects(page, viewport, highlightInfo.searchTerm);
        setHighlightRects(rects);
      } else {
        setHighlightRects([]);
      }
    } catch (err) {
      console.error('[PDF Viewer] Failed to render page', err);
      setError('Unable to render PDF page');
      setHighlightRects([]);
      setIsLoading(false);
    }
  }, [currentPage, zoom, highlightInfo?.searchTerm, computeHighlightRects]);

  useEffect(() => {
    if (!isOpen || !pdfUrl) {
      setError(null);
      setHighlightRects([]);
      setTotalPages(1);
      pdfRef.current = null;
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const loadDocument = async () => {
      try {
        const task = pdfjsLib.getDocument({ url: pdfUrl });
        const doc = await task.promise;
        if (isCancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setTotalPages(doc.numPages || 1);
        const targetPage = Math.min(Math.max(highlightInfo?.page || 1, 1), doc.numPages || 1);
        setCurrentPage(targetPage);
        setIsLoading(false);
      } catch (err) {
        if (!isCancelled) {
          console.error('[PDF Viewer] Failed to load document', err);
          setError('Unable to load PDF document');
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
      setHighlightRects([]);
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [isOpen, pdfUrl]);

  useEffect(() => {
    if (!isOpen || !pdfRef.current || !highlightInfo?.page) return;
    const maxPages = pdfRef.current.numPages || totalPages || 1;
    const target = Math.min(Math.max(highlightInfo.page, 1), maxPages);
    setCurrentPage(target);
  }, [highlightInfo?.page, isOpen, totalPages]);

  useEffect(() => {
    if (!pdfRef.current || !isOpen) return;
    renderPage();
  }, [renderPage, isOpen]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const isNavDisabled = !pdfRef.current || totalPages <= 1;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '90%',
        maxWidth: 1200,
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
              Document Source: {fieldLabel || 'Unknown field'}
            </h3>
            {fieldValue && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Extracted value: <span style={{ 
                  fontWeight: 600, 
                  color: '#10b981',
                  fontFamily: 'monospace',
                  background: '#dcfce7',
                  padding: '2px 6px',
                  borderRadius: 4
                }}>
                  {fieldValue}
                </span>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Toolbar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#f9fafb'
        }}>
          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: 4, marginRight: 'auto' }}>
            <button
              onClick={handleZoomOut}
              style={{
                padding: '6px 12px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <ZoomOut size={14} /> {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              style={{
                padding: '6px 12px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ZoomIn size={14} />
            </button>
          </div>
          
          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || isNavDisabled}
              style={{
                padding: '6px 10px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: currentPage === 1 || isNavDisabled ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 || isNavDisabled ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Page {Math.min(currentPage, totalPages)} of {totalPages}
            </span>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || isNavDisabled}
              style={{
                padding: '6px 10px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: currentPage === totalPages || isNavDisabled ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages || isNavDisabled ? 0.5 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          {highlightInfo?.searchTerm && (
            <div style={{
              padding: '6px 12px',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Search size={14} />
              Highlighting: "{highlightInfo.searchTerm}"
            </div>
          )}
        </div>
        
        {/* PDF Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          {!pdfUrl ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                No PDF available
              </div>
              <div style={{ fontSize: 14 }}>
                The original document could not be loaded
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 900 }}>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 8,
                    background: '#fff',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none'
                }}>
                  {highlightRects.map((rect, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${rect.leftPct}%`,
                        top: `${rect.topPct}%`,
                        width: `${rect.widthPct}%`,
                        height: `${rect.heightPct}%`,
                        background: 'rgba(251, 191, 36, 0.35)',
                        border: '1px solid rgba(217, 119, 6, 0.6)',
                        borderRadius: 4,
                        boxShadow: '0 0 12px rgba(251, 191, 36, 0.45)'
                      }}
                    />
                  ))}
                </div>
                {isLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(249, 250, 251, 0.8)',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#4b5563',
                    gap: 8
                  }}>
                    <Loader size={18} className="spin" /> Rendering PDF...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        {(highlightInfo?.source || error) && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: 12,
            color: error ? '#b91c1c' : '#6b7280'
          }}>
            {error ? (
              <strong>{error}</strong>
            ) : (
              <>
                <strong style={{ color: '#374151' }}>Extraction Location:</strong> {highlightInfo.source}
                {highlightInfo.note && (
                  <span style={{ marginLeft: 12 }}>
                    • <em>{highlightInfo.note}</em>
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
