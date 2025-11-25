import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 20px'
  },
  hero: {
    textAlign: 'center',
    marginBottom: '48px'
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '12px',
    letterSpacing: '-1px'
  },
  heroSubtitle: {
    fontSize: '18px',
    color: '#666',
    fontWeight: '400',
    lineHeight: '1.6'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '48px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e0e0e0'
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
    textAlign: 'center'
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '40px',
    textAlign: 'center'
  },
  dropzone: {
    border: '2px dashed #d0d0d0',
    borderRadius: '8px',
    padding: '60px 40px',
    textAlign: 'center',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '32px'
  },
  dropzoneActive: {
    borderColor: '#1a1a1a',
    backgroundColor: '#f0f0f0'
  },
  dropzoneIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    color: '#999'
  },
  dropzoneTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px'
  },
  dropzoneText: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '16px'
  },
  dropzoneButton: {
    display: 'inline-block',
    padding: '10px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    marginTop: '8px'
  },
  fileList: {
    marginTop: '24px'
  },
  fileListTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '16px'
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
    marginBottom: '8px',
    border: '1px solid #e8e8e8'
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '1'
  },
  fileIcon: {
    fontSize: '20px'
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a'
  },
  fileSize: {
    fontSize: '12px',
    color: '#888',
    marginLeft: '8px'
  },
  removeButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: '#d32f2f',
    border: '1px solid #d32f2f',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  continueButton: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '32px'
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  supportedFormats: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#999',
    marginTop: '16px'
  },
  hiddenInput: {
    display: 'none'
  },
  pageSelectionContainer: {
    marginTop: '48px'
  },
  pageSelectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  pageSelectionTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  pageSelectionActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  selectAllButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  clearAllButton: {
    padding: '10px 20px',
    backgroundColor: '#6b7280',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  selectedCount: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  },
  pagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '20px',
    marginTop: '24px'
  },
  pageCard: {
    position: 'relative',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    padding: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff'
  },
  pageCardSelected: {
    border: '3px solid #3b82f6',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
  },
  pagePreview: {
    width: '100%',
    height: '200px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    overflow: 'hidden',
    position: 'relative'
  },
  pagePreviewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  pageNumber: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  checkmark: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    backgroundColor: '#3b82f6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    zIndex: '10'
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginBottom: '24px'
  },
  processButton: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    padding: '16px 20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  },
  infoIcon: {
    fontSize: '20px',
    flexShrink: 0,
    marginTop: '2px'
  },
  infoText: {
    fontSize: '14px',
    color: '#0c4a6e',
    lineHeight: '1.6',
    margin: 0
  }
};

function UploadDealPage() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPageSelection, setShowPageSelection] = useState(false);
  const [pdfPages, setPdfPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const acceptedTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.type.includes('pdf')) return '📄';
    if (file.type.includes('sheet') || file.type.includes('excel')) return '📊';
    if (file.type.includes('image')) return '🖼️';
    return '📎';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = async (files) => {
    const validFiles = files.filter(file => acceptedTypes.includes(file.type));
    
    const newFiles = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: file.type
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // If any PDFs were added, we'll need to extract pages after user clicks continue
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleContinue = async () => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);

    // Check if there are any PDFs
    const pdfFiles = uploadedFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      // Extract pages from PDFs for user selection
      await extractPdfPages(pdfFiles);
      setUploading(false);
      setShowPageSelection(true);
    } else {
      // No PDFs, just process other files
      setTimeout(() => {
        console.log('Files to upload:', uploadedFiles.map(f => f.name));
        setUploading(false);
        alert('File upload and OCR processing will be implemented next!');
      }, 1500);
    }
  };

  const extractPdfPages = async (pdfFiles) => {
    const allPages = [];
    
    for (const pdfFile of pdfFiles) {
      try {
        // Read the file as array buffer
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        
        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        
        // Extract each page as thumbnail
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          
          // Set scale for thumbnail (lower = faster rendering, smaller file size)
          const scale = 0.3;
          const viewport = page.getViewport({ scale });
          
          // Create canvas to render the page
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render PDF page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert canvas to base64 image with lower quality for speed
          const thumbnail = canvas.toDataURL('image/jpeg', 0.5);
          
          allPages.push({
            id: `${pdfFile.id}-page-${pageNum}`,
            fileId: pdfFile.id,
            fileName: pdfFile.name,
            pageNumber: pageNum,
            thumbnail: thumbnail
          });
        }
      } catch (error) {
        console.error('Error extracting PDF pages:', error);
        alert(`Failed to extract pages from ${pdfFile.name}`);
      }
    }
    
    setPdfPages(allPages);
    // Select all pages by default
    setSelectedPages(new Set(allPages.map(p => p.id)));
  };

  const togglePageSelection = (pageId) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const selectAllPages = () => {
    setSelectedPages(new Set(pdfPages.map(p => p.id)));
  };

  const clearAllPages = () => {
    setSelectedPages(new Set());
  };

  const processSelectedPages = async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 STARTING OCR PROCESS');
    console.log('='.repeat(60));
    console.log(`📄 Selected ${selectedPages.size} pages for processing`);
    
    setUploading(true);
    
    try {
      // Get the selected pages' image data
      const selectedPagesData = pdfPages
        .filter(page => selectedPages.has(page.id))
        .map(page => page.thumbnail.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      
      console.log(`📦 Prepared ${selectedPagesData.length} images for upload`);
      console.log(`📏 Average image size: ${Math.round(selectedPagesData.reduce((sum, img) => sum + img.length, 0) / selectedPagesData.length / 1024)} KB`);
      
      console.log('📤 Sending to backend OCR endpoint...');
      
      // Send to backend for OCR + parsing
      const response = await fetch('/api/ocr/extract-and-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: selectedPagesData
        })
      });
      
      console.log(`📥 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OCR processing failed:', errorText);
        throw new Error('OCR processing failed');
      }
      
      const result = await response.json();
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ OCR PROCESSING COMPLETE');
      console.log('='.repeat(60));
      console.log('📊 Results:', JSON.stringify(result, null, 2));
      console.log('='.repeat(60) + '\n');
      
      // Navigate to wizard with OCR data
      console.log('🧙 Navigating to wizard with extracted data...');
      navigate('/wizard', { 
        state: { ocrData: result } 
      });
      
    } catch (error) {
      console.error('❌ ERROR:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const backToUpload = () => {
    setShowPageSelection(false);
    setPdfPages([]);
    setSelectedPages(new Set());
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Page selection view
  if (showPageSelection) {
    return (
      <div style={styles.container}>
        <button style={styles.backButton} onClick={backToUpload}>
          ← Back to Upload
        </button>

        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Select Pages to Analyze</h1>
        </div>

        <div style={styles.infoBox}>
          <span style={styles.infoIcon}>💡</span>
          <p style={styles.infoText}>
            <strong>Select only the pages containing financial data.</strong> Choose pages with rent rolls, 
            operating statements, T-12 income/expenses, occupancy reports, and property financials. 
            Skip cover pages, photos, and marketing content to speed up analysis.
          </p>
        </div>

        <div style={styles.pageSelectionContainer}>
          <div style={styles.pageSelectionHeader}>
            <h2 style={styles.pageSelectionTitle}>
              {pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''} found
            </h2>
            <div style={styles.pageSelectionActions}>
              <button style={styles.selectAllButton} onClick={selectAllPages}>
                Select All
              </button>
              <button style={styles.clearAllButton} onClick={clearAllPages}>
                Clear All
              </button>
              <span style={styles.selectedCount}>
                {selectedPages.size} selected
              </span>
            </div>
          </div>

          <div style={styles.pagesGrid}>
            {pdfPages.map(page => {
              const isSelected = selectedPages.has(page.id);
              return (
                <div
                  key={page.id}
                  style={{
                    ...styles.pageCard,
                    ...(isSelected ? styles.pageCardSelected : {})
                  }}
                  onClick={() => togglePageSelection(page.id)}
                >
                  {isSelected && (
                    <div style={styles.checkmark}>✓</div>
                  )}
                  <div style={styles.pagePreview}>
                    {page.thumbnail ? (
                      <img 
                        src={page.thumbnail} 
                        alt={`Page ${page.pageNumber}`}
                        style={styles.pagePreviewImage}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                        <svg width="80" height="100" viewBox="0 0 80 100" style={{ marginBottom: '12px' }}>
                          <rect x="10" y="0" width="60" height="100" fill="#e0e0e0" rx="4"/>
                          <rect x="20" y="15" width="40" height="3" fill="#bbb"/>
                          <rect x="20" y="25" width="40" height="3" fill="#bbb"/>
                          <rect x="20" y="35" width="30" height="3" fill="#bbb"/>
                          <rect x="20" y="45" width="35" height="3" fill="#bbb"/>
                          <rect x="20" y="55" width="40" height="3" fill="#bbb"/>
                          <rect x="20" y="65" width="25" height="3" fill="#bbb"/>
                          <rect x="20" y="75" width="38" height="3" fill="#bbb"/>
                        </svg>
                        <div style={{ fontSize: '13px', color: '#999', fontWeight: '500' }}>Page {page.pageNumber}</div>
                        <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>{page.fileName}</div>
                      </div>
                    )}
                  </div>
                  <div style={styles.pageNumber}>
                    Page {page.pageNumber}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            style={{
              ...styles.processButton,
              ...(selectedPages.size === 0 || uploading ? styles.continueButtonDisabled : {})
            }}
            disabled={selectedPages.size === 0 || uploading}
            onClick={processSelectedPages}
          >
            {uploading ? 'Processing...' : `Process Selected Pages →`}
          </button>
        </div>
      </div>
    );
  }

  // File upload view
  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Upload Deal Documents</h1>
        <p style={styles.heroSubtitle}>
          Upload T-12s, P&Ls, Offering Memorandums, rent rolls, and other property documents.<br />
          Our AI will extract and analyze the data automatically.
        </p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Add Your Documents</h2>
        <p style={styles.cardSubtitle}>
          Drag and drop files or click to browse
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          style={styles.hiddenInput}
        />

        <div
          style={{
            ...styles.dropzone,
            ...(isDragging ? styles.dropzoneActive : {})
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFilePicker}
        >
          <div style={styles.dropzoneIcon}>📁</div>
          <div style={styles.dropzoneTitle}>
            {isDragging ? 'Drop files here' : 'Upload Deal Documents'}
          </div>
          <div style={styles.dropzoneText}>
            Drag & drop your files here, or click to browse
          </div>
          <button
            type="button"
            style={styles.dropzoneButton}
            onClick={(e) => {
              e.stopPropagation();
              openFilePicker();
            }}
          >
            Browse Files
          </button>
        </div>

        <div style={styles.supportedFormats}>
          Supported formats: PDF, Excel (.xlsx, .xls), Images (.jpg, .png)
        </div>

        {uploadedFiles.length > 0 && (
          <div style={styles.fileList}>
            <div style={styles.fileListTitle}>
              Uploaded Files ({uploadedFiles.length})
            </div>
            {uploadedFiles.map(file => (
              <div key={file.id} style={styles.fileItem}>
                <div style={styles.fileInfo}>
                  <span style={styles.fileIcon}>{getFileIcon(file)}</span>
                  <div>
                    <span style={styles.fileName}>{file.name}</span>
                    <span style={styles.fileSize}>{formatFileSize(file.size)}</span>
                  </div>
                </div>
                <button
                  style={styles.removeButton}
                  onClick={() => removeFile(file.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          style={{
            ...styles.continueButton,
            ...(uploadedFiles.length === 0 || uploading ? styles.continueButtonDisabled : {})
          }}
          disabled={uploadedFiles.length === 0 || uploading}
          onClick={handleContinue}
        >
          {uploading ? 'Processing...' : `Continue with ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default UploadDealPage;
