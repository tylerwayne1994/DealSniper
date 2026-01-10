import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  Download, 
  Copy, 
  Check,
  Loader2,
  Building2,
  User,
  Calendar,
  AlertCircle,
  RefreshCw,
  Edit3,
  Save,
  PenTool,
  X
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { loadDeal } from '../lib/dealsService';

// ============================================================================
// Signature Modal Component (DocuSign-style)
// ============================================================================

const SignatureModal = ({ isOpen, onClose, onSave, signerName }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    if (!hasSignature) return;
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '600px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PenTool size={20} color="#78350f" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                Sign Document
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                Draw your signature below
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: '#6b7280'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Signer Info */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#fffbeb',
          borderBottom: '1px solid #fde68a'
        }}>
          <div style={{ fontSize: '13px', color: '#92400e' }}>
            <strong>Signing as:</strong> {signerName}
          </div>
        </div>

        {/* Canvas Area */}
        <div style={{ padding: '24px' }}>
          <div style={{
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            padding: '4px',
            backgroundColor: '#f9fafb'
          }}>
            <canvas
              ref={canvasRef}
              width={520}
              height={200}
              style={{
                width: '100%',
                height: '200px',
                cursor: 'crosshair',
                borderRadius: '8px',
                backgroundColor: 'white',
                touchAction: 'none'
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '12px'
          }}>
            Use your mouse or finger to sign above
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={clearSignature}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Clear
          </button>
          <button
            onClick={saveSignature}
            disabled={!hasSignature}
            style={{
              padding: '12px 32px',
              backgroundColor: hasSignature ? '#fbbf24' : '#e5e7eb',
              color: hasSignature ? '#78350f' : '#9ca3af',
              border: 'none',
              borderRadius: '8px',
              cursor: hasSignature ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={18} />
            Adopt and Sign
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOI Page Component
// ============================================================================

function LOIPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  const loiDocumentRef = useRef(null);
  
  const [deal, setDeal] = useState(null);
  const [loiContent, setLoiContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  
  // Signature state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState(null);
  const [signedDate, setSignedDate] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  // Form fields for LOI customization
  const [formData, setFormData] = useState({
    buyerName: '',
    buyerEntity: '',
    buyerAddress: '',
    buyerPhone: '',
    buyerEmail: '',
    earnestMoney: 25000,
    earnestMoneyDays: 3,
    dueDiligenceDays: 30,
    closingDays: 45,
    financingContingency: true,
    inspectionContingency: true,
    appraisalContingency: true,
    additionalTerms: ''
  });

  // Generate reference number
  useEffect(() => {
    const generateRefNumber = () => {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `DS-LOI-${timestamp}-${random}`;
    };
    setReferenceNumber(generateRefNumber());
  }, []);

  // Load deal from Supabase (or localStorage as fallback)
  useEffect(() => {
    const loadDealData = async () => {
      if (!dealId) return;
      
      try {
        // First try to load from Supabase
        const supabaseDeal = await loadDeal(dealId);
        if (supabaseDeal) {
          console.log('[LOI] Loaded deal from Supabase:', supabaseDeal);
          setDeal(supabaseDeal);
          // Pre-fill earnest money as 1% of purchase price
          if (supabaseDeal.purchasePrice) {
            setFormData(prev => ({
              ...prev,
              earnestMoney: Math.round(supabaseDeal.purchasePrice * 0.01)
            }));
          }
          return;
        }
      } catch (e) {
        console.log('[LOI] Supabase load failed, trying localStorage:', e);
      }
      
      // Fallback to localStorage
      const pipeline = JSON.parse(localStorage.getItem('dealPipeline') || '[]');
      const foundDeal = pipeline.find(d => d.dealId === dealId);
      if (foundDeal) {
        setDeal(foundDeal);
        // Pre-fill earnest money as 1% of purchase price
        if (foundDeal.purchasePrice) {
          setFormData(prev => ({
            ...prev,
            earnestMoney: Math.round(foundDeal.purchasePrice * 0.01)
          }));
        }
      }
    };
    
    loadDealData();
    
    // Try to load user profile for buyer info
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setFormData(prev => ({
          ...prev,
          buyerName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
          buyerPhone: profile.phone || '',
          buyerEmail: profile.email || ''
        }));
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    }
  }, [dealId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateLOI = async () => {
    if (!deal) return;
    
    // Check token balance first
    try {
      const tokenCheck = await fetch('http://localhost:8010/api/tokens/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_type: 'loi_generation' })
      });
      
      const tokenData = await tokenCheck.json();
      
      if (!tokenData.has_tokens) {
        const userConfirmed = window.confirm(
          `This will use AI to generate a Letter of Intent.\n\n` +
          `Cost: ${tokenData.tokens_required} token\n` +
          `Your balance: ${tokenData.token_balance} tokens\n\n` +
          `You need more tokens. Check your Dashboard Profile to upgrade.`
        );
        return;
      }
      
      // Confirm token usage
      const userConfirmed = window.confirm(
        `This will use AI to generate a Letter of Intent.\n\n` +
        `Cost: ${tokenData.tokens_required} token\n` +
        `Your balance: ${tokenData.token_balance} tokens\n\n` +
        `Continue?`
      );
      
      if (!userConfirmed) return;
      
    } catch (err) {
      console.error('Token check failed:', err);
      setError('Failed to check token balance. Please try again.');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    // Reset signature when regenerating
    setSignature(null);
    setSignedDate(null);
    
    try {
      const response = await fetch('http://localhost:8010/v2/generate-loi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal: {
            address: deal.address,
            units: deal.units,
            purchasePrice: deal.purchasePrice,
            dealStructure: deal.dealStructure,
            dayOneCashFlow: deal.dayOneCashFlow,
            stabilizedCashFlow: deal.stabilizedCashFlow,
            refiValue: deal.refiValue,
            cashOutRefiAmount: deal.cashOutRefiAmount,
            brokerName: deal.brokerName,
            brokerPhone: deal.brokerPhone,
            brokerEmail: deal.brokerEmail
          },
          buyer: {
            name: formData.buyerName,
            entity: formData.buyerEntity,
            address: formData.buyerAddress,
            phone: formData.buyerPhone,
            email: formData.buyerEmail
          },
          terms: {
            earnestMoney: formData.earnestMoney,
            earnestMoneyDays: formData.earnestMoneyDays,
            dueDiligenceDays: formData.dueDiligenceDays,
            closingDays: formData.closingDays,
            financingContingency: formData.financingContingency,
            inspectionContingency: formData.inspectionContingency,
            appraisalContingency: formData.appraisalContingency,
            additionalTerms: formData.additionalTerms
          }
        })
      });

      // Handle token errors (402 Payment Required)
      if (response.status === 402) {
        const data = await response.json();
        setError(`⚠️ Insufficient Tokens: ${data.detail || 'You need 1 token to generate an LOI. Check your Dashboard Profile to see your balance and upgrade your plan.'}`);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to generate LOI');
      }

      const data = await response.json();
      setLoiContent(data.loi);
      setEditedContent(data.loi);
    } catch (err) {
      console.error('LOI generation error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignature = (signatureData) => {
    setSignature(signatureData);
    setSignedDate(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }));
  };

  const copyToClipboard = async () => {
    const content = isEditing ? editedContent : loiContent;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const downloadAsPdf = async () => {
    if (!loiDocumentRef.current) return;
    
    setIsExportingPdf(true);
    
    try {
      const element = loiDocumentRef.current;
      
      // Use html2canvas to capture the document
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`LOI_${deal?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'deal'}_${referenceNumber}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '-';
    return '$' + Number(val).toLocaleString();
  };

  if (!deal) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#1f2937', marginBottom: '8px' }}>Deal Not Found</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            The deal you're looking for doesn't exist in your pipeline.
          </p>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={handleSignature}
        signerName={formData.buyerName || 'Buyer'}
      />

      {/* Header */}
      <div style={{
        backgroundColor: '#1e293b',
        padding: '20px 32px',
        color: 'white'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '16px',
              fontSize: '14px'
            }}
          >
            <ArrowLeft size={16} />
            Back to Pipeline
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
                Letter of Intent Generator
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.85 }}>
                {deal.address}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px' }}>
          
          {/* Left Column - Form */}
          <div>
            {/* Deal Summary */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#111827',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Building2 size={18} color="#0d9488" />
                Deal Summary
              </h3>
              
              <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Property:</span>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{deal.address}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Units:</span>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{deal.units}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Purchase Price:</span>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{formatCurrency(deal.purchasePrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Structure:</span>
                  <span style={{ 
                    fontWeight: '600', 
                    color: '#0d9488',
                    backgroundColor: '#f0fdfa',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}>{deal.dealStructure}</span>
                </div>
              </div>
            </div>

            {/* Buyer Information */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#111827',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <User size={18} color="#0d9488" />
                Buyer Information
              </h3>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Buyer Name *
                  </label>
                  <input
                    type="text"
                    name="buyerName"
                    value={formData.buyerName}
                    onChange={handleInputChange}
                    placeholder="John Smith"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Buyer Entity (optional)
                  </label>
                  <input
                    type="text"
                    name="buyerEntity"
                    value={formData.buyerEntity}
                    onChange={handleInputChange}
                    placeholder="ABC Holdings LLC"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Buyer Address
                  </label>
                  <input
                    type="text"
                    name="buyerAddress"
                    value={formData.buyerAddress}
                    onChange={handleInputChange}
                    placeholder="123 Main St, City, State, ZIP"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="buyerPhone"
                      value={formData.buyerPhone}
                      onChange={handleInputChange}
                      placeholder="(555) 123-4567"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      name="buyerEmail"
                      value={formData.buyerEmail}
                      onChange={handleInputChange}
                      placeholder="buyer@email.com"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LOI Terms */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#111827',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Calendar size={18} color="#0d9488" />
                LOI Terms
              </h3>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Earnest Money ($)
                    </label>
                    <input
                      type="number"
                      name="earnestMoney"
                      value={formData.earnestMoney}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      EMD Due (days)
                    </label>
                    <input
                      type="number"
                      name="earnestMoneyDays"
                      value={formData.earnestMoneyDays}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Due Diligence (days)
                    </label>
                    <input
                      type="number"
                      name="dueDiligenceDays"
                      value={formData.dueDiligenceDays}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      Days to Close
                    </label>
                    <input
                      type="number"
                      name="closingDays"
                      value={formData.closingDays}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Contingencies
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="financingContingency"
                        checked={formData.financingContingency}
                        onChange={handleInputChange}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>Financing Contingency</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="inspectionContingency"
                        checked={formData.inspectionContingency}
                        onChange={handleInputChange}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>Inspection Contingency</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        name="appraisalContingency"
                        checked={formData.appraisalContingency}
                        onChange={handleInputChange}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>Appraisal Contingency</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Additional Terms / Notes
                  </label>
                  <textarea
                    name="additionalTerms"
                    value={formData.additionalTerms}
                    onChange={handleInputChange}
                    placeholder="Any special conditions or terms to include..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateLOI}
              disabled={isGenerating || !formData.buyerName}
              style={{
                width: '100%',
                padding: '16px 24px',
                backgroundColor: isGenerating ? '#9ca3af' : '#0d9488',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isGenerating || !formData.buyerName ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating LOI...
                </>
              ) : (
                <>
                  <FileText size={20} />
                  Generate Letter of Intent
                </>
              )}
            </button>
            
            {!formData.buyerName && (
              <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', marginTop: '8px' }}>
                * Buyer name is required
              </p>
            )}
          </div>

          {/* Right Column - LOI Preview */}
          <div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              minHeight: '600px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Preview Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
                  LOI Preview
                </h3>
                
                {loiContent && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setLoiContent(editedContent);
                        }
                        setIsEditing(!isEditing);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: isEditing ? '#0d9488' : '#f3f4f6',
                        color: isEditing ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
                      {isEditing ? 'Save' : 'Edit'}
                    </button>
                    <button
                      onClick={copyToClipboard}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => setShowSignatureModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: signature ? '#10b981' : '#fbbf24',
                        color: signature ? 'white' : '#78350f',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      <PenTool size={14} />
                      {signature ? 'Signed ✓' : 'Sign'}
                    </button>
                    <button
                      onClick={downloadAsPdf}
                      disabled={isExportingPdf || !signature}
                      title={!signature ? 'Please sign the document first' : 'Download as PDF'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: signature ? '#0d9488' : '#e5e7eb',
                        color: signature ? 'white' : '#9ca3af',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: signature ? 'pointer' : 'not-allowed',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {isExportingPdf ? (
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Download size={14} />
                      )}
                      Save as PDF
                    </button>
                    <button
                      onClick={generateLOI}
                      disabled={isGenerating}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      <RefreshCw size={14} />
                      Regenerate
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Content */}
              <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
                {error && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
                
                {!loiContent && !isGenerating && !error && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#9ca3af',
                    textAlign: 'center'
                  }}>
                    <FileText size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                      No LOI Generated Yet
                    </p>
                    <p style={{ fontSize: '14px' }}>
                      Fill in the buyer information and click "Generate Letter of Intent"
                    </p>
                  </div>
                )}

                {isGenerating && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#6b7280'
                  }}>
                    <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>
                      Generating your Letter of Intent...
                    </p>
                    <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                      This may take a few seconds
                    </p>
                  </div>
                )}

                {loiContent && !isGenerating && (
                  isEditing ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '500px',
                        padding: '16px',
                        border: '2px solid #0d9488',
                        borderRadius: '8px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        fontFamily: 'monospace',
                        resize: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  ) : (
                    <div ref={loiDocumentRef} style={{ backgroundColor: 'white', padding: '20px' }}>
                      {/* LOI Document Content with Inline Signature */}
                      {(() => {
                        // Find signature line patterns and split content
                        const signaturePatterns = [
                          /^(.*)(Buyer(?:'s)?\s*Signature:?\s*_+.*?)$/gims,
                          /^(.*)(Signature:?\s*_+.*?)$/gims,
                          /^(.*)(_+\s*\n\s*(?:Buyer|Purchaser).*?)$/gims
                        ];
                        
                        let beforeSignature = loiContent;
                        let signatureLine = '';
                        let afterSignature = '';
                        
                        // Try to find and split at signature line
                        for (const pattern of signaturePatterns) {
                          const match = loiContent.match(pattern);
                          if (match) {
                            // Split content at the signature section
                            const signatureIndex = loiContent.search(/Buyer(?:'s)?\s*Signature|BUYER(?:'S)?\s*SIGNATURE|Signature:\s*_|_{10,}/i);
                            if (signatureIndex > -1) {
                              beforeSignature = loiContent.substring(0, signatureIndex);
                              const remaining = loiContent.substring(signatureIndex);
                              // Find end of signature block (next section or end)
                              const nextSectionMatch = remaining.match(/\n\n[A-Z]/);
                              if (nextSectionMatch) {
                                signatureLine = remaining.substring(0, nextSectionMatch.index);
                                afterSignature = remaining.substring(nextSectionMatch.index);
                              } else {
                                signatureLine = remaining;
                              }
                              break;
                            }
                          }
                        }
                        
                        // If no pattern matched, just look for underscores near "Buyer" or "Signature"
                        if (signatureLine === '') {
                          const sigIdx = loiContent.search(/_{5,}[\s\S]*?(?:Buyer|Purchaser|Name|Signature)/i);
                          if (sigIdx > -1) {
                            beforeSignature = loiContent.substring(0, sigIdx);
                            signatureLine = loiContent.substring(sigIdx);
                          }
                        }
                        
                        return (
                          <>
                            {/* Content before signature */}
                            <pre style={{
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word',
                              fontSize: '14px',
                              lineHeight: '1.6',
                              color: '#374151',
                              fontFamily: 'Georgia, "Times New Roman", serif',
                              margin: 0
                            }}>
                              {beforeSignature}
                            </pre>
                            
                            {/* Inline Signature Area */}
                            <div style={{ margin: '24px 0' }}>
                              <div style={{ 
                                fontFamily: 'Georgia, "Times New Roman", serif',
                                fontSize: '14px',
                                color: '#374151',
                                marginBottom: '8px'
                              }}>
                                <strong>BUYER SIGNATURE:</strong>
                              </div>
                              
                              {signature ? (
                                <div style={{ marginLeft: '20px' }}>
                                  {/* Signature Image */}
                                  <div style={{
                                    borderBottom: '2px solid #374151',
                                    paddingBottom: '8px',
                                    display: 'inline-block',
                                    marginBottom: '4px'
                                  }}>
                                    <img 
                                      src={signature} 
                                      alt="Signature" 
                                      style={{ 
                                        maxWidth: '280px', 
                                        height: 'auto',
                                        display: 'block'
                                      }} 
                                    />
                                  </div>
                                  
                                  {/* Signer Details */}
                                  <div style={{ 
                                    fontFamily: 'Georgia, "Times New Roman", serif',
                                    fontSize: '14px', 
                                    color: '#374151',
                                    marginTop: '8px'
                                  }}>
                                    <div><strong>Name:</strong> {formData.buyerName}</div>
                                    {formData.buyerEntity && (
                                      <div><strong>Entity:</strong> {formData.buyerEntity}</div>
                                    )}
                                    <div><strong>Date:</strong> {signedDate}</div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowSignatureModal(true)}
                                  style={{
                                    padding: '20px 40px',
                                    backgroundColor: '#fffbeb',
                                    border: '2px dashed #fbbf24',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: '#92400e',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    marginLeft: '20px'
                                  }}
                                >
                                  <PenTool size={20} />
                                  Click Here to Sign
                                </button>
                              )}
                            </div>

                            {/* Content after signature (if any) */}
                            {afterSignature && (
                              <pre style={{
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                color: '#374151',
                                fontFamily: 'Georgia, "Times New Roman", serif',
                                margin: 0
                              }}>
                                {afterSignature}
                              </pre>
                            )}
                            
                            {/* Reference Number & Verification Footer */}
                            {signature && (
                              <div style={{
                                marginTop: '40px',
                                padding: '16px',
                                backgroundColor: '#f0fdf4',
                                borderRadius: '8px',
                                border: '1px solid #bbf7d0'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '8px',
                                  marginBottom: '8px'
                                }}>
                                  <Check size={18} color="#16a34a" />
                                  <span style={{ 
                                    fontSize: '14px', 
                                    fontWeight: '600', 
                                    color: '#15803d' 
                                  }}>
                                    Document Signed Electronically
                                  </span>
                                </div>
                                
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#166534',
                                  fontFamily: 'monospace'
                                }}>
                                  <div>Reference Number: <strong>{referenceNumber}</strong></div>
                                  <div style={{ marginTop: '4px' }}>
                                    Timestamp: {signedDate} | Verified by DealSniper
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LOIPage;
