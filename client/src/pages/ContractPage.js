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
  Users,
  AlertCircle,
  RefreshCw,
  Edit3,
  Save,
  PenTool,
  X,
  DollarSign,
  Clock,
  Shield,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { loadDeal } from '../lib/dealsService';

const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';

// ============================================================================
// Signature Modal Component (reuse from LOI pattern)
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
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };
  const saveSignature = () => {
    if (!hasSignature) return;
    onSave(canvasRef.current.toDataURL('image/png'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000 }}>
      <div style={{ backgroundColor:'white',borderRadius:'16px',width:'90%',maxWidth:'600px',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)',overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',backgroundColor:'#f9fafb' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
            <div style={{ width:'40px',height:'40px',borderRadius:'10px',backgroundColor:'#fbbf24',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <PenTool size={20} color="#78350f" />
            </div>
            <div>
              <h3 style={{ margin:0,fontSize:'18px',fontWeight:'700',color:'#111827' }}>Sign Document</h3>
              <p style={{ margin:'2px 0 0 0',fontSize:'13px',color:'#6b7280' }}>Draw your signature below</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',padding:'8px',borderRadius:'8px',color:'#6b7280' }}><X size={24} /></button>
        </div>
        {/* Signer */}
        <div style={{ padding:'16px 24px',backgroundColor:'#fffbeb',borderBottom:'1px solid #fde68a' }}>
          <div style={{ fontSize:'13px',color:'#92400e' }}><strong>Signing as:</strong> {signerName}</div>
        </div>
        {/* Canvas */}
        <div style={{ padding:'24px' }}>
          <div style={{ border:'2px dashed #d1d5db',borderRadius:'12px',padding:'4px',backgroundColor:'#f9fafb' }}>
            <canvas ref={canvasRef} width={520} height={200}
              style={{ width:'100%',height:'200px',cursor:'crosshair',borderRadius:'8px',backgroundColor:'white',touchAction:'none' }}
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
            />
          </div>
          <p style={{ textAlign:'center',fontSize:'12px',color:'#9ca3af',marginTop:'12px' }}>Use your mouse or finger to sign above</p>
        </div>
        {/* Actions */}
        <div style={{ padding:'16px 24px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',backgroundColor:'#f9fafb' }}>
          <button onClick={clearSignature} style={{ padding:'12px 24px',backgroundColor:'white',color:'#374151',border:'1px solid #d1d5db',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:'600' }}>Clear</button>
          <button onClick={saveSignature} disabled={!hasSignature}
            style={{ padding:'12px 32px',backgroundColor:hasSignature?'#fbbf24':'#e5e7eb',color:hasSignature?'#78350f':'#9ca3af',border:'none',borderRadius:'8px',cursor:hasSignature?'pointer':'not-allowed',fontSize:'14px',fontWeight:'700',display:'flex',alignItems:'center',gap:'8px' }}>
            <Check size={18} /> Adopt and Sign
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Shared input style
// ============================================================================
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '6px',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 8.825L1.175 4 2.238 2.938 6 6.7 9.763 2.937 10.825 4z\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '32px',
};

// ============================================================================
// Contract Page Component
// ============================================================================

function ContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  const contractDocRef = useRef(null);

  // Core state
  const [deal, setDeal] = useState(null);
  const [contractContent, setContractContent] = useState('');
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

  // Package selector
  const [selectedPackage, setSelectedPackage] = useState('package1');

  // Form fields
  const [formData, setFormData] = useState({
    // Entity
    entityName: '',
    stateOfFormation: '',
    effectiveDate: '',
    entityAddress: '',
    // Operating Partner
    opFullName: '',
    opAddress: '',
    opTitle: 'Managing Member',
    // Equity Partner
    epFullName: '',
    epAddress: '',
    epTitle: 'Member',
    // Financial
    opCapital: '',
    epCapital: '',
    opOwnershipPct: 70,
    epOwnershipPct: 30,
    preferredReturnPct: 8,
    accrualMethod: 'Monthly',
    paymentSchedule: 'Quarterly',
    assetMgmtFeePct: 2,
    majorDecisionThreshold: 25000,
    minimumInvestment: 50000,
    offeringExemption: '506(b)',
    // Timeline
    disabilityDays: 180,
    curePeriodDays: 30,
    deadlockDays: 60,
    rofoDays: 30,
    closingDays: 60,
    ndaTermYears: 3,
    buybackDeadlineMonths: 36,
    buybackFailurePenaltyPct: 2,
    offeringPeriodMonths: 6,
    // Additional
    additionalTerms: '',
  });

  // Generate reference number
  useEffect(() => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    setReferenceNumber(`DS-CTR-${ts}-${rand}`);
  }, []);

  // Load deal
  useEffect(() => {
    const loadDealData = async () => {
      if (!dealId) return;
      try {
        const supabaseDeal = await loadDeal(dealId);
        if (supabaseDeal) {
          setDeal(supabaseDeal);
          autoFillFromDeal(supabaseDeal);
          return;
        }
      } catch (e) {
        console.log('[Contract] Supabase load failed, trying localStorage:', e);
      }
      // Fallback
      const pipeline = JSON.parse(localStorage.getItem('dealPipeline') || '[]');
      const found = pipeline.find((d) => d.dealId === dealId);
      if (found) {
        setDeal(found);
        autoFillFromDeal(found);
      }
    };

    loadDealData();

    // Profile pre-fill
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
        setFormData((prev) => ({
          ...prev,
          opFullName: fullName || prev.opFullName,
        }));
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    }
  }, [dealId]);

  const autoFillFromDeal = (d) => {
    const sd = d.scenarioData || d.fullScenarioData || {};
    const fin = sd.financing || {};

    const epAmount = fin.equity_partner_amount || fin.ep_amount || 0;
    const epSplit = fin.equity_partner_split || fin.ep_split || 70; // buyer's ownership %
    const prefReturn = fin.preferred_return || fin.pref_return || 8;
    const totalEquity = fin.total_equity || fin.down_payment || 0;
    const opCapital = totalEquity - epAmount;

    setFormData((prev) => ({
      ...prev,
      entityAddress: d.address || prev.entityAddress,
      opCapital: opCapital > 0 ? opCapital : prev.opCapital,
      epCapital: epAmount || prev.epCapital,
      opOwnershipPct: epSplit || prev.opOwnershipPct,
      epOwnershipPct: epSplit ? 100 - epSplit : prev.epOwnershipPct,
      preferredReturnPct: prefReturn || prev.preferredReturnPct,
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  // ---- Generate Contract ----
  const generateContract = async () => {
    if (!deal) return;

    // Token check
    try {
      const tokenCheck = await fetch(`${API_BASE}/api/tokens/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation_type: 'contract_generation' }),
      });
      const tokenData = await tokenCheck.json();

      if (!tokenData.has_tokens) {
        window.alert(
          `This will use AI to generate a Contract Package.\n\nCost: ${tokenData.tokens_required} token\nYour balance: ${tokenData.token_balance} tokens\n\nYou need more tokens. Check your Dashboard Profile to upgrade.`
        );
        return;
      }

      const confirmed = window.confirm(
        `This will use AI to generate Contract Package ${selectedPackage === 'package1' ? 'I' : 'II'}.\n\nCost: ${tokenData.tokens_required} token\nYour balance: ${tokenData.token_balance} tokens\n\nContinue?`
      );
      if (!confirmed) return;
    } catch (err) {
      console.error('Token check failed:', err);
      setError('Failed to check token balance. Please try again.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSignature(null);
    setSignedDate(null);

    try {
      const response = await fetch(`${API_BASE}/v2/generate-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractPackage: selectedPackage,
          deal: {
            address: deal.address,
            units: deal.units,
            purchasePrice: deal.purchasePrice,
            dealStructure: deal.dealStructure,
            dayOneCashFlow: deal.dayOneCashFlow,
            stabilizedCashFlow: deal.stabilizedCashFlow,
          },
          entity: {
            name: formData.entityName,
            stateOfFormation: formData.stateOfFormation,
            effectiveDate: formData.effectiveDate,
            address: formData.entityAddress,
          },
          operatingPartner: {
            fullName: formData.opFullName,
            address: formData.opAddress,
            title: formData.opTitle,
          },
          equityPartner: {
            fullName: formData.epFullName,
            address: formData.epAddress,
            title: formData.epTitle,
          },
          financialTerms: {
            opCapital: formData.opCapital,
            epCapital: formData.epCapital,
            opOwnershipPct: formData.opOwnershipPct,
            epOwnershipPct: formData.epOwnershipPct,
            preferredReturnPct: formData.preferredReturnPct,
            accrualMethod: formData.accrualMethod,
            paymentSchedule: formData.paymentSchedule,
            assetMgmtFeePct: formData.assetMgmtFeePct,
            majorDecisionThreshold: formData.majorDecisionThreshold,
            minimumInvestment: formData.minimumInvestment,
            offeringExemption: formData.offeringExemption,
          },
          timelineTerms: {
            disabilityDays: formData.disabilityDays,
            curePeriodDays: formData.curePeriodDays,
            deadlockDays: formData.deadlockDays,
            rofoDays: formData.rofoDays,
            closingDays: formData.closingDays,
            ndaTermYears: formData.ndaTermYears,
            buybackDeadlineMonths: formData.buybackDeadlineMonths,
            buybackFailurePenaltyPct: formData.buybackFailurePenaltyPct,
            offeringPeriodMonths: formData.offeringPeriodMonths,
          },
          additionalTerms: formData.additionalTerms,
        }),
      });

      if (response.status === 402) {
        const data = await response.json();
        setError(`⚠️ Insufficient Tokens: ${data.detail || 'You need 1 token. Check your Dashboard Profile to upgrade.'}`);
        return;
      }

      if (!response.ok) throw new Error('Failed to generate contract');

      const data = await response.json();
      setContractContent(data.contract);
      setEditedContent(data.contract);
    } catch (err) {
      console.error('Contract generation error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ---- Helpers ----
  const handleSignature = (sigData) => {
    setSignature(sigData);
    setSignedDate(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? editedContent : contractContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const downloadAsPdf = async () => {
    if (!contractDocRef.current) return;
    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(contractDocRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Contract_${selectedPackage === 'package1' ? 'I' : 'II'}_${deal?.address?.replace(/[^a-zA-Z0-9]/g, '_') || 'deal'}_${referenceNumber}.pdf`);
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

  // ---- No deal fallback ----
  if (!deal) {
    return (
      <div style={{ minHeight:'100vh',backgroundColor:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom:'16px' }} />
          <h2 style={{ color:'#1f2937',marginBottom:'8px' }}>Deal Not Found</h2>
          <p style={{ color:'#6b7280',marginBottom:'24px' }}>The deal you're looking for doesn't exist in your pipeline.</p>
          <button onClick={() => navigate('/pipeline')}
            style={{ padding:'12px 24px',backgroundColor:'#0d9488',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:'600' }}>
            Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  // ---- Package descriptions ----
  const packageInfo = {
    package1: {
      label: 'Package I — Formation & Offering',
      docs: ['LLC Operating Agreement', 'Private Placement Memorandum', 'Subscription Agreement', 'Capital Contribution Agreement'],
    },
    package2: {
      label: 'Package II — Protection & Exit',
      docs: ['Preferred Return Agreement', 'Distribution Waterfall Schedule', 'Personal Guarantee', 'Buy-Sell Agreement', 'Non-Disclosure Agreement', 'Equity Buyback Agreement'],
    },
  };

  const canGenerate = formData.entityName && formData.opFullName && formData.epFullName;

  return (
    <div style={{ minHeight:'100vh',backgroundColor:'#f9fafb',fontFamily:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={handleSignature}
        signerName={formData.opFullName || 'Operating Partner'}
      />

      {/* ─── Header ─── */}
      <div style={{ backgroundColor:'#1e293b',padding:'20px 32px',color:'white' }}>
        <div style={{ maxWidth:'1400px',margin:'0 auto' }}>
          <button onClick={() => navigate('/pipeline')}
            style={{ display:'flex',alignItems:'center',gap:'8px',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'8px',padding:'8px 16px',color:'white',cursor:'pointer',marginBottom:'16px',fontSize:'14px' }}>
            <ArrowLeft size={16} /> Back to Pipeline
          </button>
          <div style={{ display:'flex',alignItems:'center',gap:'16px' }}>
            <div style={{ width:'56px',height:'56px',borderRadius:'14px',backgroundColor:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Shield size={28} />
            </div>
            <div>
              <h1 style={{ margin:0,fontSize:'28px',fontWeight:'700' }}>Contract Generator</h1>
              <p style={{ margin:'4px 0 0 0',fontSize:'14px',opacity:0.85 }}>{deal.address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ maxWidth:'1400px',margin:'0 auto',padding:'32px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'420px 1fr',gap:'32px' }}>

          {/* ═══ LEFT COLUMN — FORM ═══ */}
          <div style={{ maxHeight:'calc(100vh - 200px)',overflowY:'auto',paddingRight:'8px' }}>

            {/* Deal Summary */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <Building2 size={18} color="#0d9488" /> Deal Summary
              </h3>
              <div style={{ display:'grid',gap:'12px',fontSize:'14px' }}>
                {[
                  ['Property', deal.address],
                  ['Units', deal.units],
                  ['Purchase Price', formatCurrency(deal.purchasePrice)],
                  ['Structure', deal.dealStructure],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:'flex',justifyContent:'space-between' }}>
                    <span style={{ color:'#6b7280' }}>{k}:</span>
                    <span style={{ fontWeight:'600',color: k === 'Structure' ? '#0d9488' : '#111827',
                      ...(k === 'Structure' ? { backgroundColor:'#f0fdfa',padding:'2px 8px',borderRadius:'4px',fontSize:'13px' } : {})
                    }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Package Selector ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <FileText size={18} color="#0d9488" /> Contract Package
              </h3>
              {['package1','package2'].map((pkg) => (
                <label key={pkg}
                  style={{ display:'block',padding:'14px 16px',border: selectedPackage === pkg ? '2px solid #0d9488' : '1px solid #e5e7eb',
                    borderRadius:'10px',cursor:'pointer',marginBottom:'12px',backgroundColor: selectedPackage === pkg ? '#f0fdfa' : 'white',transition:'all 0.15s' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px' }}>
                    <input type="radio" name="contractPackage" value={pkg} checked={selectedPackage === pkg}
                      onChange={() => setSelectedPackage(pkg)}
                      style={{ width:'16px',height:'16px',accentColor:'#0d9488' }} />
                    <span style={{ fontWeight:'700',fontSize:'14px',color:'#111827' }}>{packageInfo[pkg].label}</span>
                  </div>
                  <div style={{ marginLeft:'26px',display:'flex',flexWrap:'wrap',gap:'6px' }}>
                    {packageInfo[pkg].docs.map((d) => (
                      <span key={d} style={{ fontSize:'11px',padding:'2px 8px',backgroundColor: selectedPackage === pkg ? '#ccfbf1' : '#f3f4f6',
                        borderRadius:'4px',color: selectedPackage === pkg ? '#0f766e' : '#6b7280',fontWeight:'500' }}>{d}</span>
                    ))}
                  </div>
                </label>
              ))}
            </div>

            {/* ── Entity Information ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <Building2 size={18} color="#0d9488" /> Entity Information
              </h3>
              <div style={{ display:'grid',gap:'16px' }}>
                <div>
                  <label style={labelStyle}>Entity Name *</label>
                  <input type="text" name="entityName" value={formData.entityName} onChange={handleInputChange}
                    placeholder="ABC Holdings LLC" style={inputStyle} />
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>State of Formation</label>
                    <input type="text" name="stateOfFormation" value={formData.stateOfFormation} onChange={handleInputChange}
                      placeholder="Texas" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Effective Date</label>
                    <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Principal Office Address</label>
                  <input type="text" name="entityAddress" value={formData.entityAddress} onChange={handleInputChange}
                    placeholder="123 Main St, City, State, ZIP" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* ── Operating Partner ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <User size={18} color="#0d9488" /> Operating Partner (GP)
              </h3>
              <div style={{ display:'grid',gap:'16px' }}>
                <div>
                  <label style={labelStyle}>Full Legal Name *</label>
                  <input type="text" name="opFullName" value={formData.opFullName} onChange={handleInputChange}
                    placeholder="John Smith" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input type="text" name="opAddress" value={formData.opAddress} onChange={handleInputChange}
                    placeholder="123 Main St, City, State, ZIP" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Title</label>
                  <select name="opTitle" value={formData.opTitle} onChange={handleInputChange} style={selectStyle}>
                    <option value="Managing Member">Managing Member</option>
                    <option value="General Partner">General Partner</option>
                    <option value="Manager">Manager</option>
                    <option value="CEO">CEO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Equity Partner ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <Users size={18} color="#0d9488" /> Equity Partner (LP)
              </h3>
              <div style={{ display:'grid',gap:'16px' }}>
                <div>
                  <label style={labelStyle}>Full Legal Name *</label>
                  <input type="text" name="epFullName" value={formData.epFullName} onChange={handleInputChange}
                    placeholder="Jane Doe" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input type="text" name="epAddress" value={formData.epAddress} onChange={handleInputChange}
                    placeholder="456 Oak Ave, City, State, ZIP" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Title</label>
                  <select name="epTitle" value={formData.epTitle} onChange={handleInputChange} style={selectStyle}>
                    <option value="Member">Member</option>
                    <option value="Limited Partner">Limited Partner</option>
                    <option value="Investor">Investor</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Financial Terms ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <DollarSign size={18} color="#0d9488" /> Financial Terms
              </h3>
              <div style={{ display:'grid',gap:'16px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>OP Capital ($)</label>
                    <input type="number" name="opCapital" value={formData.opCapital} onChange={handleInputChange}
                      placeholder="100000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>EP Capital ($)</label>
                    <input type="number" name="epCapital" value={formData.epCapital} onChange={handleInputChange}
                      placeholder="400000" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>OP Ownership %</label>
                    <input type="number" name="opOwnershipPct" value={formData.opOwnershipPct} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>EP Ownership %</label>
                    <input type="number" name="epOwnershipPct" value={formData.epOwnershipPct} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>Preferred Return %</label>
                    <input type="number" name="preferredReturnPct" value={formData.preferredReturnPct} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Asset Mgmt Fee %</label>
                    <input type="number" name="assetMgmtFeePct" value={formData.assetMgmtFeePct} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>Accrual Method</label>
                    <select name="accrualMethod" value={formData.accrualMethod} onChange={handleInputChange} style={selectStyle}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Schedule</label>
                    <select name="paymentSchedule" value={formData.paymentSchedule} onChange={handleInputChange} style={selectStyle}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>Major Decision Threshold ($)</label>
                    <input type="number" name="majorDecisionThreshold" value={formData.majorDecisionThreshold} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Min Investment ($) (PPM)</label>
                    <input type="number" name="minimumInvestment" value={formData.minimumInvestment} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Offering Exemption</label>
                  <select name="offeringExemption" value={formData.offeringExemption} onChange={handleInputChange} style={selectStyle}>
                    <option value="506(b)">Regulation D, Rule 506(b)</option>
                    <option value="506(c)">Regulation D, Rule 506(c)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Timeline Terms ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <Clock size={18} color="#0d9488" /> Timeline & Terms
              </h3>
              <div style={{ display:'grid',gap:'16px' }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>Disability (days)</label>
                    <input type="number" name="disabilityDays" value={formData.disabilityDays} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Cure Period (days)</label>
                    <input type="number" name="curePeriodDays" value={formData.curePeriodDays} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Deadlock (days)</label>
                    <input type="number" name="deadlockDays" value={formData.deadlockDays} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>ROFO (days)</label>
                    <input type="number" name="rofoDays" value={formData.rofoDays} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Closing (days)</label>
                    <input type="number" name="closingDays" value={formData.closingDays} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>NDA Term (years)</label>
                    <input type="number" name="ndaTermYears" value={formData.ndaTermYears} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px' }}>
                  <div>
                    <label style={labelStyle}>Buyback (months)</label>
                    <input type="number" name="buybackDeadlineMonths" value={formData.buybackDeadlineMonths} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Buyback Penalty %</label>
                    <input type="number" name="buybackFailurePenaltyPct" value={formData.buybackFailurePenaltyPct} onChange={handleInputChange} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Offering (months)</label>
                    <input type="number" name="offeringPeriodMonths" value={formData.offeringPeriodMonths} onChange={handleInputChange} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Additional Terms ── */}
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'24px' }}>
              <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                <Edit3 size={18} color="#0d9488" /> Additional Terms
              </h3>
              <textarea name="additionalTerms" value={formData.additionalTerms} onChange={handleInputChange}
                placeholder="Any special conditions, notes, or clauses to include..."
                rows={4}
                style={{ ...inputStyle, resize:'vertical' }} />
            </div>

            {/* ── Generate Button ── */}
            <button onClick={generateContract} disabled={isGenerating || !canGenerate}
              style={{
                width:'100%',padding:'16px 24px',
                backgroundColor: isGenerating ? '#9ca3af' : '#0d9488',
                color:'white',border:'none',borderRadius:'12px',
                cursor: isGenerating || !canGenerate ? 'not-allowed' : 'pointer',
                fontSize:'16px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',
                boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)',marginBottom:'8px'
              }}>
              {isGenerating ? (
                <><Loader2 size={20} style={{ animation:'spin 1s linear infinite' }} /> Generating Contracts...</>
              ) : (
                <><Shield size={20} /> Generate {selectedPackage === 'package1' ? 'Package I' : 'Package II'}</>
              )}
            </button>

            {!canGenerate && (
              <p style={{ fontSize:'13px',color:'#ef4444',textAlign:'center',marginTop:'4px' }}>
                * Entity name, Operating Partner name, and Equity Partner name are required
              </p>
            )}
          </div>

          {/* ═══ RIGHT COLUMN — PREVIEW ═══ */}
          <div>
            <div style={{ backgroundColor:'white',borderRadius:'12px',border:'1px solid #e5e7eb',minHeight:'600px',display:'flex',flexDirection:'column' }}>
              {/* Preview header */}
              <div style={{ padding:'16px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h3 style={{ fontSize:'16px',fontWeight:'700',color:'#111827',margin:0 }}>
                  Contract Preview
                </h3>
                {contractContent && (
                  <div style={{ display:'flex',gap:'8px',flexWrap:'wrap' }}>
                    <button
                      onClick={() => { if (isEditing) setContractContent(editedContent); setIsEditing(!isEditing); }}
                      style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',
                        backgroundColor: isEditing ? '#0d9488' : '#f3f4f6',color: isEditing ? 'white' : '#374151',
                        border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px',fontWeight:'500' }}>
                      {isEditing ? <Save size={14} /> : <Edit3 size={14} />} {isEditing ? 'Save' : 'Edit'}
                    </button>
                    <button onClick={copyToClipboard}
                      style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',backgroundColor:'#f3f4f6',color:'#374151',
                        border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px',fontWeight:'500' }}>
                      {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={() => setShowSignatureModal(true)}
                      style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',
                        backgroundColor: signature ? '#10b981' : '#fbbf24',color: signature ? 'white' : '#78350f',
                        border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px',fontWeight:'600' }}>
                      <PenTool size={14} /> {signature ? 'Signed ✓' : 'Sign'}
                    </button>
                    <button onClick={downloadAsPdf} disabled={isExportingPdf || !signature}
                      title={!signature ? 'Please sign the document first' : 'Download as PDF'}
                      style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',
                        backgroundColor: signature ? '#0d9488' : '#e5e7eb',color: signature ? 'white' : '#9ca3af',
                        border:'none',borderRadius:'6px',cursor: signature ? 'pointer' : 'not-allowed',fontSize:'13px',fontWeight:'500' }}>
                      {isExportingPdf ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} /> : <Download size={14} />} Save as PDF
                    </button>
                    <button onClick={generateContract} disabled={isGenerating}
                      style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',backgroundColor:'#f3f4f6',color:'#374151',
                        border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px',fontWeight:'500' }}>
                      <RefreshCw size={14} /> Regenerate
                    </button>
                  </div>
                )}
              </div>

              {/* Preview content */}
              <div style={{ flex:1,padding:'24px',overflow:'auto' }}>
                {error && (
                  <div style={{ padding:'16px',backgroundColor:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#dc2626',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px' }}>
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                {!contractContent && !isGenerating && !error && (
                  <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#9ca3af',textAlign:'center' }}>
                    <Shield size={64} style={{ marginBottom:'16px',opacity:0.5 }} />
                    <p style={{ fontSize:'16px',fontWeight:'500',marginBottom:'8px' }}>No Contract Generated Yet</p>
                    <p style={{ fontSize:'14px' }}>Fill in the partnership details and click "Generate" to create your contract package.</p>
                  </div>
                )}

                {isGenerating && (
                  <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#6b7280' }}>
                    <Loader2 size={48} style={{ animation:'spin 1s linear infinite',marginBottom:'16px' }} />
                    <p style={{ fontSize:'16px',fontWeight:'500' }}>Generating Contract {selectedPackage === 'package1' ? 'Package I' : 'Package II'}...</p>
                    <p style={{ fontSize:'14px',color:'#9ca3af' }}>This may take 15-30 seconds for a full contract package</p>
                  </div>
                )}

                {contractContent && !isGenerating && (
                  isEditing ? (
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                      style={{ width:'100%',height:'100%',minHeight:'600px',padding:'16px',border:'2px solid #0d9488',
                        borderRadius:'8px',fontSize:'14px',lineHeight:'1.6',fontFamily:'monospace',resize:'none',boxSizing:'border-box' }} />
                  ) : (
                    <div ref={contractDocRef} style={{ backgroundColor:'white',padding:'20px' }}>
                      {/* Contract text */}
                      <pre style={{
                        whiteSpace:'pre-wrap',wordWrap:'break-word',fontSize:'14px',lineHeight:'1.6',
                        color:'#374151',fontFamily:'Georgia, "Times New Roman", serif',margin:0
                      }}>
                        {contractContent}
                      </pre>

                      {/* Signature Area */}
                      <div style={{ margin:'32px 0' }}>
                        <div style={{ fontFamily:'Georgia, "Times New Roman", serif',fontSize:'14px',color:'#374151',marginBottom:'8px' }}>
                          <strong>OPERATING PARTNER SIGNATURE:</strong>
                        </div>
                        {signature ? (
                          <div style={{ marginLeft:'20px' }}>
                            <div style={{ borderBottom:'2px solid #374151',paddingBottom:'8px',display:'inline-block',marginBottom:'4px' }}>
                              <img src={signature} alt="Signature" style={{ maxWidth:'280px',height:'auto',display:'block' }} />
                            </div>
                            <div style={{ fontFamily:'Georgia, "Times New Roman", serif',fontSize:'14px',color:'#374151',marginTop:'8px' }}>
                              <div><strong>Name:</strong> {formData.opFullName}</div>
                              <div><strong>Title:</strong> {formData.opTitle}</div>
                              {formData.entityName && <div><strong>Entity:</strong> {formData.entityName}</div>}
                              <div><strong>Date:</strong> {signedDate}</div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowSignatureModal(true)}
                            style={{ padding:'20px 40px',backgroundColor:'#fffbeb',border:'2px dashed #fbbf24',
                              borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px',
                              color:'#92400e',fontSize:'14px',fontWeight:'600',marginLeft:'20px' }}>
                            <PenTool size={20} /> Click Here to Sign
                          </button>
                        )}
                      </div>

                      {/* Verification Footer */}
                      {signature && (
                        <div style={{ marginTop:'40px',padding:'16px',backgroundColor:'#f0fdf4',borderRadius:'8px',border:'1px solid #bbf7d0' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px' }}>
                            <Check size={18} color="#16a34a" />
                            <span style={{ fontSize:'14px',fontWeight:'600',color:'#15803d' }}>Document Signed Electronically</span>
                          </div>
                          <div style={{ fontSize:'12px',color:'#166534',fontFamily:'monospace' }}>
                            <div>Reference Number: <strong>{referenceNumber}</strong></div>
                            <div style={{ marginTop:'4px' }}>Timestamp: {signedDate} | Verified by DealSniper</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spinner CSS */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ContractPage;
