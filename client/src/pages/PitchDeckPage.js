import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Users, Building2 } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { loadDeal } from '../lib/dealsService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Signature Canvas Component
function SignatureCanvas({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData);
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #d1d5db' }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{
          width: '100%',
          height: '200px',
          border: '2px dashed #e5e7eb',
          borderRadius: '6px',
          cursor: 'crosshair',
          backgroundColor: '#ffffff'
        }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={clearCanvas}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Clear
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Cancel
        </button>
        <button
          onClick={saveSignature}
          style={{
            padding: '8px 16px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}

function PitchDeckPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealIdFromUrl = searchParams.get('dealId');
  
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isLoadingDeal, setIsLoadingDeal] = useState(false);
  
  // Deal Structure Questions
  const [structureType, setStructureType] = useState(''); // 'jv' or 'syndication'
  const [purchasePrice, setPurchasePrice] = useState('');
  
  // JV/Equity Partner fields
  const [partnerEquity, setPartnerEquity] = useState('');
  const [cashflowSplit, setCashflowSplit] = useState('50'); // % to partner
  
  // Syndication fields
  const [preferredReturn, setPreferredReturn] = useState('8');
  const [gpSplit, setGpSplit] = useState('20');
  const [lpSplit, setLpSplit] = useState('80');
  
  // Contact Information (for both structures)
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [sponsorWebsite, setSponsorWebsite] = useState('');
  const [signature, setSignature] = useState('');
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [pitchDeckContent, setPitchDeckContent] = useState(null);
  const [pitchDeckSignature, setPitchDeckSignature] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showSourceData, setShowSourceData] = useState(false);

  // Load deal if dealId in URL
  useEffect(() => {
    if (dealIdFromUrl) {
      console.log('[PitchDeck] Loading deal from URL:', dealIdFromUrl);
      loadDealData(dealIdFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealIdFromUrl]);

  const loadDealData = async (dealId) => {
    setIsLoadingDeal(true);
    try {
      console.log('[PitchDeck] Fetching deal data for:', dealId);
      const dealData = await loadDeal(dealId);
      console.log('[PitchDeck] Deal data loaded:', dealData);
      if (dealData) {
        setSelectedDeal(dealData);
        // Pre-fill purchase price from deal
        const price = dealData.purchasePrice || dealData.scenarioData?.financing?.purchase_price || 0;
        console.log('[PitchDeck] Setting purchase price:', price);
        setPurchasePrice(price.toString());
      } else {
        console.error('[PitchDeck] Deal not found');
        alert('Deal not found');
        navigate('/pipeline');
      }
    } catch (error) {
      console.error('[PitchDeck] Error loading deal:', error);
      alert('Failed to load deal: ' + error.message);
      navigate('/pipeline');
    } finally {
      setIsLoadingDeal(false);
    }
  };

  const handleGeneratePitchDeck = async () => {
    if (!structureType) {
      alert('Please select a deal structure (JV/Equity Partner or Syndication)');
      return;
    }
    if (!purchasePrice || isNaN(Number(purchasePrice))) {
      alert('Please enter a valid purchase price');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      console.log('[PitchDeck] Starting pitch deck generation');
      
      const requestBody = {
        structureType,
        purchasePrice: Number(purchasePrice),
        contactInfo: {
          sponsorName: sponsorName || '[Sponsor Name]',
          email: sponsorEmail || '[Email]',
          phone: sponsorPhone || '[Phone]',
          website: sponsorWebsite || '[Website]',
          signature: signature || null
        },
        ...(structureType === 'jv' ? {
          partnerEquity: Number(partnerEquity) || 0,
          cashflowSplit: Number(cashflowSplit) || 50,
        } : {
          preferredReturn: Number(preferredReturn) || 8,
          gpSplit: Number(gpSplit) || 20,
          lpSplit: Number(lpSplit) || 80,
        })
      };

      console.log('[PitchDeck] Request body:', JSON.stringify(requestBody, null, 2));
      console.log('[PitchDeck] Calling API:', `http://127.0.0.1:8010/v2/deals/${selectedDeal.dealId}/pitch-deck`);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';
      const response = await fetch(`${API_BASE}/v2/deals/${selectedDeal.dealId}/pitch-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      console.log('[PitchDeck] Response status:', response.status);
      console.log('[PitchDeck] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const text = await response.text();
        console.error('[PitchDeck] Error response:', text);
        throw new Error(text || 'Failed to generate pitch deck');
      }

      const data = await response.json();
      console.log('[PitchDeck] Success! Response data:', data);
      
      // Backend returns { sections: [...], signature: '...' } format
      if (data.sections && Array.isArray(data.sections)) {
        console.log('[PitchDeck] Found sections:', data.sections.length);
        console.log('[PitchDeck] Signature from response:', data.signature ? 'YES - length: ' + data.signature?.length : 'NO');
        setPitchDeckContent(data.sections);
        setPitchDeckSignature(data.signature || null);
        console.log('[PitchDeck] State updated - signature:', data.signature ? 'saved' : 'none');
      } else {
        // Fallback for other response formats
        const content = data.text || data.content || JSON.stringify(data, null, 2);
        setPitchDeckContent([{ id: 'content', title: 'Pitch Deck', body: content }]);
        setPitchDeckSignature(null);
        console.log('[PitchDeck] Content set (fallback)');
      }
      
    } catch (error) {
      console.error('[PitchDeck] Generation failed:', error);
      console.error('[PitchDeck] Error stack:', error.stack);
      alert('Failed to generate pitch deck: ' + error.message);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationProgress(0), 1000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!pitchDeckContent || !selectedDeal) {
      alert('No pitch deck content to download');
      return;
    }

    try {
      console.log('[PitchDeck] Starting PDF generation...');
      
      // Find the pitch deck content container
      const contentElement = document.querySelector('[data-pitch-deck-content]');
      if (!contentElement) {
        alert('Could not find pitch deck content to export');
        return;
      }

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const maxPageHeight = pageHeight - (margin * 2);

      console.log('[PitchDeck] Capturing content as canvas...');
      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX
      });

      console.log(`[PitchDeck] Canvas captured: ${canvas.width}x${canvas.height}`);

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Split into multiple pages if content exceeds one page
      let yOffset = 0;
      let isFirstPage = true;

      while (yOffset < imgHeight) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        // Calculate how much of the image to show on this page
        const remainingHeight = imgHeight - yOffset;
        const heightForThisPage = Math.min(remainingHeight, maxPageHeight);

        // Calculate source position in the canvas
        const srcY = (yOffset / imgHeight) * canvas.height;
        const srcHeight = (heightForThisPage / imgHeight) * canvas.height;

        // Create a slice of the canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcHeight;
        const ctx = pageCanvas.getContext('2d');

        ctx.drawImage(
          canvas,
          0, srcY,
          canvas.width, srcHeight,
          0, 0,
          canvas.width, srcHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, heightForThisPage);

        yOffset += heightForThisPage;
        console.log(`[PitchDeck] Added page, yOffset: ${yOffset}/${imgHeight}`);
      }

      const fileName = `Pitch_Deck_${selectedDeal.address?.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      console.log('[PitchDeck] PDF downloaded:', fileName);

    } catch (error) {
      console.error('[PitchDeck] PDF generation failed:', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  };

  if (isLoadingDeal) {
    return (
      <DashboardShell activeTab="pitch-deck" title="Pitch Deck">
        <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
          Loading deal data...
        </div>
      </DashboardShell>
    );
  }

  if (!selectedDeal) {
    return (
      <DashboardShell activeTab="pitch-deck" title="Pitch Deck">
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <Building2 size={48} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>No deal selected. Go to Pipeline and click Pitch on a deal.</p>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Go to Pipeline
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeTab="pitch-deck" title="Pitch Deck">
      <div style={{ padding: '32px 40px', backgroundColor: '#f4f6fb', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px 32px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '2px solid #6366f1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Sparkles size={24} style={{ color: '#6366f1' }} />
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#111827' }}>
                    AI PITCH DECK GENERATOR
                  </h1>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  {selectedDeal.address} • {selectedDeal.units} Units
                </p>
              </div>
              <button
                onClick={() => navigate('/pipeline')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                <ArrowLeft size={16} />
                Back to Pipeline
              </button>
            </div>
          </div>

          {/* Questions Section */}
          {!pitchDeckContent && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '24px' }}>
                Deal Structure Configuration
              </h2>

              {/* Purchase Price */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Purchase Price
                </label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="Enter purchase price"
                />
              </div>

              {/* Structure Type */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  Deal Structure Type
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setStructureType('jv')}
                    style={{
                      flex: 1,
                      padding: '16px',
                      backgroundColor: structureType === 'jv' ? '#10b981' : 'white',
                      color: structureType === 'jv' ? 'white' : '#374151',
                      border: `2px solid ${structureType === 'jv' ? '#10b981' : '#d1d5db'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Users size={20} style={{ marginBottom: '8px' }} />
                    <div>JV / Equity Partner</div>
                  </button>
                  <button
                    onClick={() => setStructureType('syndication')}
                    style={{
                      flex: 1,
                      padding: '16px',
                      backgroundColor: structureType === 'syndication' ? '#6366f1' : 'white',
                      color: structureType === 'syndication' ? 'white' : '#374151',
                      border: `2px solid ${structureType === 'syndication' ? '#6366f1' : '#d1d5db'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Building2 size={20} style={{ marginBottom: '8px' }} />
                    <div>Syndication</div>
                  </button>
                </div>
              </div>

              {/* JV/Equity Partner Fields */}
              {structureType === 'jv' && (
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                    JV / Equity Partner Terms
                  </h3>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Partner Equity Amount ($)
                    </label>
                    <input
                      type="number"
                      value={partnerEquity}
                      onChange={(e) => setPartnerEquity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      placeholder="How much is the partner putting in?"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Cash Flow Split to Partner (%)
                    </label>
                    <input
                      type="number"
                      value={cashflowSplit}
                      onChange={(e) => setCashflowSplit(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      placeholder="What % of cash flow goes to partner?"
                      min="0"
                      max="100"
                    />
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      You get {100 - (Number(cashflowSplit) || 0)}% of cash flow
                    </p>
                  </div>
                </div>
              )}

              {/* Syndication Fields */}
              {structureType === 'syndication' && (
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                    Syndication Terms
                  </h3>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Preferred Return (%)
                    </label>
                    <input
                      type="number"
                      value={preferredReturn}
                      onChange={(e) => setPreferredReturn(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      placeholder="Annual preferred return %"
                      min="0"
                      max="20"
                      step="0.5"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        GP Split (%)
                      </label>
                      <input
                        type="number"
                        value={gpSplit}
                        onChange={(e) => {
                          setGpSplit(e.target.value);
                          setLpSplit((100 - Number(e.target.value)).toString());
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        LP Split (%)
                      </label>
                      <input
                        type="number"
                        value={lpSplit}
                        onChange={(e) => {
                          setLpSplit(e.target.value);
                          setGpSplit((100 - Number(e.target.value)).toString());
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    After preferred return, profits split {gpSplit}% GP / {lpSplit}% LP
                  </p>
                </div>
              )}

              {/* Contact Information & Signature (shown for both structures) */}
              {structureType && (
                <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                    Contact Information & Signature
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Sponsor Name
                      </label>
                      <input
                        type="text"
                        value={sponsorName}
                        onChange={(e) => setSponsorName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="Your name or company name"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={sponsorEmail}
                        onChange={(e) => setSponsorEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={sponsorPhone}
                        onChange={(e) => setSponsorPhone(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Website
                      </label>
                      <input
                        type="url"
                        value={sponsorWebsite}
                        onChange={(e) => setSponsorWebsite(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>

                  {/* Digital Signature */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Digital Signature
                    </label>
                    
                    {!isDrawingSignature && !signature && (
                      <button
                        onClick={() => setIsDrawingSignature(true)}
                        style={{
                          width: '100%',
                          padding: '40px',
                          backgroundColor: 'white',
                          border: '2px dashed #d1d5db',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '600'
                        }}
                      >
                        ✍️ Click to Sign
                      </button>
                    )}

                    {isDrawingSignature && (
                      <SignatureCanvas
                        onSave={(signatureData) => {
                          setSignature(signatureData);
                          setIsDrawingSignature(false);
                        }}
                        onCancel={() => setIsDrawingSignature(false)}
                      />
                    )}

                    {signature && !isDrawingSignature && (
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={signature} 
                          alt="Signature" 
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            objectFit: 'contain',
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            padding: '8px'
                          }} 
                        />
                        <button
                          onClick={() => {
                            setSignature('');
                            setIsDrawingSignature(true);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          Clear & Re-sign
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGeneratePitchDeck}
                disabled={isGenerating || !structureType}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: isGenerating || !structureType ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isGenerating || !structureType ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Sparkles size={20} />
                {isGenerating ? 'Generating Pitch Deck...' : 'Generate AI Pitch Deck'}
              </button>

              {/* Progress Bar */}
              {isGenerating && generationProgress > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px' 
                  }}>
                    <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>
                      {generationProgress < 30 ? 'Loading deal data...' :
                       generationProgress < 60 ? 'Analyzing financials...' :
                       generationProgress < 90 ? 'Generating content...' :
                       'Finalizing pitch deck...'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '700' }}>
                      {generationProgress}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${generationProgress}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease',
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Content */}
          {pitchDeckContent && (
            <>
              {/* Source Data Verification */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '2px solid #dbeafe'
              }}>
                <button
                  onClick={() => setShowSourceData(!showSourceData)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: '#111827'
                  }}
                >
                  <span>📊 Source Data Used by AI</span>
                  <span style={{ color: '#6366f1' }}>{showSourceData ? '▼' : '▶'}</span>
                </button>
                
                {showSourceData && selectedDeal && (
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <strong>Property:</strong>
                        <div>Address: {selectedDeal.address}</div>
                        <div>Units: {selectedDeal.units}</div>
                        <div>Asset Type: {selectedDeal.scenarioData?.property?.asset_type || 'N/A'}</div>
                      </div>
                      <div>
                        <strong>Purchase & Cap:</strong>
                        <div>Purchase Price: ${(selectedDeal.purchasePrice || selectedDeal.scenarioData?.financing?.purchase_price || 0).toLocaleString()}</div>
                        <div>LTV: {(selectedDeal.scenarioData?.financing?.ltv || 0)}%</div>
                        <div>Going-in Cap: {selectedDeal.scenarioData?.calculations?.inPlaceCapRate?.toFixed(1) || 'N/A'}%</div>
                      </div>
                      <div>
                        <strong>Returns:</strong>
                        <div>Avg Cash-on-Cash: {selectedDeal.scenarioData?.calculations?.avgCashOnCash?.toFixed(1) || 'N/A'}%</div>
                        <div>IRR: {selectedDeal.scenarioData?.calculations?.leveredIRR?.toFixed(1) || 'N/A'}%</div>
                        <div>Equity Multiple: {selectedDeal.scenarioData?.calculations?.equityMultiple?.toFixed(2) || 'N/A'}x</div>
                      </div>
                      <div>
                        <strong>Cash Flows:</strong>
                        <div>Year 1 NOI: ${(selectedDeal.scenarioData?.calculations?.noiYear1 || 0).toLocaleString()}</div>
                        <div>Day-One CF: ${(selectedDeal.scenarioData?.calculations?.dayOneCashFlow || 0).toLocaleString()}</div>
                        <div>Stabilized CF: ${(selectedDeal.scenarioData?.calculations?.stabilizedCashFlow || 0).toLocaleString()}</div>
                        <div>Exit Value: ${(selectedDeal.scenarioData?.calculations?.refiValue || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#065f46' }}>
                      ✓ These are the actual numbers from your Results page that were sent to the AI
                    </div>
                  </div>
                )}
              </div>

              <div 
                data-pitch-deck-content
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '32px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
              >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>
                  Generated Pitch Deck
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPitchDeckContent(null)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={16} />
                    Download PDF
                  </button>
                </div>
              </div>
              <div style={{
                lineHeight: '1.8',
                color: '#374151',
                fontSize: '14px'
              }}>
                {Array.isArray(pitchDeckContent) && pitchDeckContent.map((section, sectionIdx) => (
                  <div key={section.id || sectionIdx} style={{ marginBottom: '40px' }}>
                    {/* Section Header */}
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#111827',
                      marginBottom: '16px',
                      paddingBottom: '10px',
                      borderBottom: '2px solid #e5e7eb'
                    }}>
                      {section.title}
                    </h3>
                    
                    {/* Section Body */}
                    <div style={{ lineHeight: '1.8' }}>
                      {section.body.split('\n').map((line, lineIdx) => {
                        const trimmed = line.trim();
                        
                        // Skip empty lines
                        if (!trimmed) {
                          return <div key={lineIdx} style={{ height: '12px' }} />;
                        }
                        
                        // Handle bullet points
                        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                          return (
                            <div key={lineIdx} style={{
                              paddingLeft: '20px',
                              marginBottom: '8px',
                              display: 'flex',
                              gap: '10px'
                            }}>
                              <span style={{ color: '#10b981', fontWeight: '700', flexShrink: 0 }}>•</span>
                              <span>{trimmed.replace(/^[\s\-•]+/, '')}</span>
                            </div>
                          );
                        }
                        
                        // Regular paragraph
                        return (
                          <p key={lineIdx} style={{
                            marginBottom: '10px',
                            lineHeight: '1.7'
                          }}>
                            {line}
                          </p>
                        );
                      })}
                    </div>
                    
                    {/* Divider between sections */}
                    {sectionIdx < pitchDeckContent.length - 1 && (
                      <hr style={{
                        border: 'none',
                        borderTop: '1px solid #e5e7eb',
                        marginTop: '30px'
                      }} />
                    )}
                  </div>
                ))}
                
                {/* Display Signature at the bottom if present */}
                {pitchDeckSignature && (
                  <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '2px solid #e5e7eb' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '16px' }}>
                      Digital Signature:
                    </h4>
                    <img 
                      src={pitchDeckSignature} 
                      alt="Digital Signature" 
                      onLoad={() => console.log('[PitchDeck] Signature image loaded successfully')}
                      onError={(e) => console.error('[PitchDeck] Signature image failed to load:', e)}
                      style={{ 
                        maxWidth: '400px', 
                        height: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#ffffff'
                      }} 
                    />
                  </div>
                )}
                
                {/* Debug signature status */}
                {!pitchDeckSignature && console.log('[PitchDeck] No signature in state to display')}
              </div>
            </div>
            </>
          )}

        </div>
      </div>
    </DashboardShell>
  );
}

export default PitchDeckPage;
