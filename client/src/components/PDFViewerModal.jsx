import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search } from 'lucide-react';

/**
 * PDFViewerModal - Displays PDF with highlighted extraction source
 * Shows the document and highlights where values were extracted from
 */
export default function PDFViewerModal({ 
  isOpen,
  onClose,
  pdfUrl,
  highlightInfo = {},
  fieldLabel,
  fieldValue
}) {
  const [zoom, setZoom] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  useEffect(() => {
    if (isOpen && highlightInfo.page) {
      setCurrentPage(highlightInfo.page);
    }
  }, [isOpen, highlightInfo.page]);
  
  if (!isOpen) return null;
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  
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
              Document Source: {fieldLabel}
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
              disabled={currentPage === 1}
              style={{
                padding: '6px 10px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 10px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          {highlightInfo.searchTerm && (
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
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#page=${currentPage}&zoom=${Math.round(zoom * 100)}`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              title="PDF Document Viewer"
            />
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: 40
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                No PDF available
              </div>
              <div style={{ fontSize: 14 }}>
                The original document could not be loaded
              </div>
            </div>
          )}
        </div>
        
        {/* Footer info */}
        {highlightInfo.source && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: 12,
            color: '#6b7280'
          }}>
            <strong style={{ color: '#374151' }}>Extraction Location:</strong> {highlightInfo.source}
            {highlightInfo.note && (
              <span style={{ marginLeft: 12 }}>
                • <em>{highlightInfo.note}</em>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
