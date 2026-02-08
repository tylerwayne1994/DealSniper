// V2 Underwriter with Verification Wizard + Results Dashboard
// Flow: Upload → Parse → Wizard (verify/edit) → Results + Chat (side-by-side)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Home, Loader, AlertCircle, CheckCircle, DollarSign, 
  Building, FileText, ArrowLeft, Landmark
} from 'lucide-react';
import ResultsPageV2 from '../components/ResultsPageV2';
import WizardStepNavigation from '../components/WizardStepNavigation';
import PropertyDetailsWizardTab from '../components/wizard/PropertyDetailsWizardTab';
import FinancialDataWizardTab from '../components/wizard/FinancialDataWizardTab';
import PDFViewerModal from '../components/PDFViewerModal';

const API_BASE = "http://localhost:8010";

// Styles (keeping consistent with V1)
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '40px 20px'
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 900,
    color: '#111827',
    letterSpacing: '-0.03em'
  },
  homeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px rgba(0,0,0,.04)',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24
  },
  uploadZone: {
    border: '2px dashed #d1d5db',
    borderRadius: 16,
    padding: 60,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#f9fafb'
  },
  uploadZoneActive: {
    borderColor: '#3b82f6',
    background: '#eff6ff'
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
  },
  inputSuccess: {
    borderColor: '#10b981',
    background: '#f0fdf4'
  },
  inputError: {
    borderColor: '#ef4444',
    background: '#fef2f2'
  },
  chatContainer: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: 600
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  message: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 1.5
  },
  userMessage: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    borderBottomRightRadius: 4
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    background: '#f3f4f6',
    color: '#111827',
    borderBottomLeftRadius: 4
  }
};

function UnderwriteV2Page() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // Step control: 'upload' | 'verify' | 'results'
  const [step, setStep] = useState('upload');

  // Upload state
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  
  // Parse result
  const [dealId, setDealId] = useState(null);
  
  // Wizard state (editable copy of parsed data)
  const [verifiedData, setVerifiedData] = useState(null);
  const [activeTab, setActiveTab] = useState('property');
  const [completedSteps] = useState([]);
  
  // PDF Viewer Modal state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const [highlightInfo, setHighlightInfo] = useState({});
  
  // Results page state (live scenario modeling)
  const [scenarioData, setScenarioData] = useState(null);
  const [modifiedFields, setModifiedFields] = useState({});
  
  // AI Underwriting result
  const [underwritingResult, setUnderwritingResult] = useState(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Modify scenario field (for live edits from chat)
  const modifyScenarioField = (path, newValue, originalValue) => {
    setScenarioData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let cursor = updated;
      let i = 0;

      while (i < keys.length - 1) {
        const key = keys[i];
        const next = keys[i + 1];

        // If next segment is a numeric index, treat current key as an array
        if (next !== undefined && /^\d+$/.test(next)) {
          const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
          cursor[key] = arr;
          const idx = parseInt(next, 10);
          arr[idx] = { ...(arr[idx] || {}) };
          cursor = arr[idx];
          i += 2; // consumed key and index
        } else {
          // Ensure nested object exists and clone it
          cursor[key] = { ...(cursor[key] || {}) };
          cursor = cursor[key];
          i += 1;
        }
      }

      const lastKey = keys[keys.length - 1];
      cursor[lastKey] = newValue;
      return updated;
    });

    setModifiedFields(prev => ({
      ...prev,
      [path]: { original: originalValue, new: newValue }
    }));
  };

  // Live calculations based on scenarioData using comprehensive calculation engine
  const calculations = useMemo(() => {
    if (!scenarioData) return null;
    
    console.log('[CALCULATIONS] Input scenarioData:', scenarioData);
    
    // Import the calculation engine
    const { calculateFullAnalysis } = require('../utils/realEstateCalculations');
    
    // Run full analysis
    console.log('[CALCULATIONS] Calling calculateFullAnalysis...');
    const fullAnalysis = calculateFullAnalysis(scenarioData);
    console.log('[CALCULATIONS] Full Analysis Result:', fullAnalysis);
    
    // Return in format expected by components (maintaining backward compatibility)
    return {
      // Year 1 metrics (for backward compatibility)
      noi: fullAnalysis.year1.noi,
      capRate: fullAnalysis.year1.capRate,
      dscr: fullAnalysis.year1.dscr,
      cashFlow: fullAnalysis.year1.cashFlow,
      cashOnCash: fullAnalysis.year1.cashOnCash,
      expenseRatio: fullAnalysis.year1.expenseRatio,
      debtYield: fullAnalysis.year1.debtYield,
      effectiveGrossIncome: fullAnalysis.year1.effectiveGrossIncome,
      totalExpenses: fullAnalysis.year1.totalOperatingExpenses,
      
      // Financing
      loanAmount: fullAnalysis.financing.loanAmount,
      annualDebtService: fullAnalysis.financing.annualDebtService,
      equity: fullAnalysis.financing.totalEquityRequired,
      
      // Projections
      projections: fullAnalysis.projections,
      
      // Full analysis object for advanced features
      fullAnalysis: fullAnalysis
    };
  }, [scenarioData]);

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadError(null);
      // Create URL for PDF viewing
      const fileUrl = URL.createObjectURL(selectedFile);
      setUploadedFileUrl(fileUrl);
    }
  };

  // Handle file upload & parse
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/v2/deals/parse`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      
      // DEBUG logging
      console.log('='.repeat(80));
      console.log('V2 PARSE API RESPONSE:');
      console.log('='.repeat(80));
      console.log('Deal ID:', data.deal_id);
      console.log('Complete Parsed JSON:', JSON.stringify(data.parsed, null, 2));
      console.log('='.repeat(80));
      
      setDealId(data.deal_id);
      console.log('[DEAL ID SET]:', data.deal_id);
      
      // Initialize verifiedData as editable copy with default financing
      const parsedCopy = JSON.parse(JSON.stringify(data.parsed));
      // Ensure financing object exists with defaults
      if (!parsedCopy.financing) {
        parsedCopy.financing = {};
      }
      parsedCopy.financing = {
        ltv: parsedCopy.financing.ltv || 75,
        interest_rate: parsedCopy.financing.interest_rate || 6.0,
        loan_term_years: parsedCopy.financing.loan_term_years || 10,
        amortization_years: parsedCopy.financing.amortization_years || 30,
        io_years: parsedCopy.financing.io_years || 0,
        loan_fees_percent: parsedCopy.financing.loan_fees_percent || 1.5,
        ...parsedCopy.financing
      };
      setVerifiedData(parsedCopy);
      
      // Move to wizard step
      setStep('verify');

    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload and parse document');
    } finally {
      setIsUploading(false);
    }
  };

  // Update wizard field
  const updateVerifiedField = (section, field, value) => {
    setVerifiedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };
  
  // Handle viewing source in PDF
  const handleViewSource = (field, confidence) => {
    console.log('[PDF Viewer] Opening for field:', field.label, confidence);
    setSelectedField(field);
    
    // Extract page number from explicit metadata or source string (e.g., "Page 3")
    let pageNum = confidence?.page && Number.isFinite(confidence.page)
      ? Number(confidence.page)
      : 1;
    if ((!pageNum || Number.isNaN(pageNum)) && confidence?.source) {
      const match = confidence.source.match(/[Pp]age\s+(\d+)/);
      if (match) pageNum = parseInt(match[1], 10);
    }
    
    setHighlightInfo({
      page: pageNum || 1,
      source: confidence?.source,
      note: confidence?.note,
      searchTerm: field.value?.toString() || confidence?.text || confidence?.raw_value || ''
    });
    
    setPdfUrl(uploadedFileUrl);
    setPdfViewerOpen(true);
  };
  
  // Handle selecting value from inline conflicts
  const handleSelectValue = (field, selectedValue) => {
    console.log('[Conflict] User selected value:', selectedValue, 'for field:', field.label);
    // Update verifiedData with the selected value
    const pathParts = field.path.split('.');
    if (pathParts.length === 2) {
      updateVerifiedField(pathParts[0], pathParts[1], selectedValue);
    }
  };

  // Validate required fields
  const validateWizard = () => {
    const required = {
      property: ['address', 'units'],
      pricing_financing: ['price'],
      pnl: ['gross_potential_rent', 'operating_expenses_t12', 'noi_t12']
    };

    const errors = [];
    Object.keys(required).forEach(section => {
      required[section].forEach(field => {
        if (!verifiedData?.[section]?.[field]) {
          errors.push(`${section}.${field}`);
        }
      });
    });

    if (errors.length > 0) {
      console.log('[Validation] Missing required fields:', errors);
    }
    return errors.length === 0;
  };

  // Complete wizard → move to results
  const handleCompleteWizard = () => {
    if (!validateWizard()) {
      setUploadError('Please fill in all required fields');
      return;
    }
    
    // Transform API data to match calculation engine expectations
    const transformedData = JSON.parse(JSON.stringify(verifiedData));
    
    // Map API field names to calculation engine field names
    if (transformedData.pricing_financing) {
      transformedData.pricing_financing.purchase_price = transformedData.pricing_financing.price || transformedData.pricing_financing.purchase_price;
      transformedData.pricing_financing.down_payment_pct = transformedData.pricing_financing.down_payment_pct || (transformedData.pricing_financing.down_payment && transformedData.pricing_financing.price ? (transformedData.pricing_financing.down_payment / transformedData.pricing_financing.price) * 100 : 40);
      
      // Calculate loan_amount if not present
      if (!transformedData.pricing_financing.loan_amount && transformedData.pricing_financing.price) {
        const price = transformedData.pricing_financing.price;
        const downPct = transformedData.pricing_financing.down_payment_pct || 0;
        const ltv = transformedData.pricing_financing.ltv || 0;
        if (downPct > 0) {
          transformedData.pricing_financing.loan_amount = price * (1 - downPct / 100);
        } else if (ltv > 0) {
          transformedData.pricing_financing.loan_amount = price * (ltv / 100);
        }
      }
    }
    
    // Ensure financing object exists with defaults from pricing_financing
    if (!transformedData.financing) {
      transformedData.financing = {};
    }
    
    // Copy values from pricing_financing to financing object (interest_rate is stored as decimal like 0.055)
    const pf = transformedData.pricing_financing || {};
    transformedData.financing.ltv = transformedData.financing.ltv || pf.ltv || 75;
    // Interest rate: pricing_financing stores as decimal (0.055), financing uses percentage (5.5) or decimal
    transformedData.financing.interest_rate = transformedData.financing.interest_rate || (pf.interest_rate ? pf.interest_rate * 100 : 0) || 6.0;
    transformedData.financing.loan_term_years = transformedData.financing.loan_term_years || pf.term_years || 10;
    transformedData.financing.amortization_years = transformedData.financing.amortization_years || pf.amortization_years || 30;
    transformedData.financing.io_years = transformedData.financing.io_years || 0;
    transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || 1.5;
    
    // Also ensure pricing_financing has the interest rate if user entered it
    if (pf.interest_rate && pf.interest_rate > 0) {
      // Already in decimal form, good
    } else if (transformedData.financing.interest_rate > 0) {
      // Copy from financing (as decimal)
      transformedData.pricing_financing.interest_rate = transformedData.financing.interest_rate / 100;
    }
    
    // Ensure required fields for calculations
    if (transformedData.pnl) {
      // Map T12 vs pro forma NOI/expenses explicitly
      transformedData.pnl.noi_t12 = transformedData.pnl.noi_t12 || transformedData.pnl.noi || 0;
      transformedData.pnl.noi_proforma = transformedData.pnl.noi_proforma || 0;

      transformedData.pnl.operating_expenses_t12 = transformedData.pnl.operating_expenses_t12 || transformedData.pnl.operating_expenses || 0;
      transformedData.pnl.operating_expenses_proforma = transformedData.pnl.operating_expenses_proforma || 0;

      // Backwards-compat: base legacy fields on T12
      transformedData.pnl.noi = transformedData.pnl.noi_t12;
      transformedData.pnl.operating_expenses = transformedData.pnl.operating_expenses_t12;

      transformedData.pnl.potential_gross_income = transformedData.pnl.gross_potential_rent || transformedData.pnl.potential_gross_income || 0;
      transformedData.pnl.vacancy_rate = (transformedData.pnl.vacancy_rate || 0.05) * 100; // Convert to percentage
    }
    
    console.log('[WIZARD COMPLETE] Original Data:', verifiedData);
    console.log('[WIZARD COMPLETE] Transformed Data:', transformedData);
    console.log('[WIZARD COMPLETE] Interest Rate (pricing_financing):', transformedData.pricing_financing?.interest_rate);
    console.log('[WIZARD COMPLETE] Interest Rate (financing):', transformedData.financing?.interest_rate);
    
    // Initialize scenario data as working copy of transformed data
    setScenarioData(transformedData);
    setModifiedFields({});
    
    setStep('results');
    
    // Add initial greeting
    setMessages([{
      role: 'assistant',
      content: `I've analyzed your deal at ${verifiedData.property?.address}. I can help you run scenarios, evaluate different assumptions, or discuss creative financing strategies. Try asking: "What if I bought this for $60,000 less?"`
    }]);
  };

  // Route to AI Analysis page
  const handleRunAIAnalysis = () => {
    if (!validateWizard()) {
      setUploadError('Please fill in all required fields');
      return;
    }
    
    // Navigate to the AI analysis page with deal data
    navigate('/underwrite/analysis', {
      state: {
        dealId,
        verifiedData
      }
    });
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending || !dealId) {
      console.log('[Chat] Cannot send:', { 
        hasInput: !!inputValue.trim(), 
        isSending, 
        hasDealId: !!dealId 
      });
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsSending(true);

    console.log('[Chat] Sending message:', {
      dealId,
      messageCount: newMessages.length,
      lastMessage: userMessage
    });

    try {
      const response = await fetch(`${API_BASE}/v2/deals/${dealId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages,
          llm: 'openai',
          model: 'gpt-4o-mini',
          buy_box: JSON.parse(localStorage.getItem('dealParams') || '{}')
        })
      });

      console.log('[Chat] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Chat] Error response:', errorData);
        throw new Error(errorData.detail || `Chat failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Chat] Success:', data);
      
      setMessages([...newMessages, data.message]);

    } catch (err) {
      console.error('[Chat] Error:', err);
      // Add error message to chat
      let errorContent = err.message || 'Unable to process your request';
      if (errorContent.includes('401') || errorContent.includes('Unauthorized')) {
        errorContent = 'The OpenAI API key is invalid or expired. Please contact support to update the API key.';
      }
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorContent}`
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  // Wizard tabs configuration with new Cactus-style structure
  const tabs = [
    { id: 'property', label: 'Property Details', subtitle: 'Address & characteristics', icon: Building },
    { id: 'financial', label: 'Financial Data', subtitle: 'Income & expenses', icon: DollarSign },
    { id: 'financing', label: 'Financing Terms', subtitle: 'Loan assumptions', icon: Landmark }
  ];

  // ============ RENDER ============

  // STEP 1: Upload
  if (step === 'upload') {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>V2 Automatic Underwriter</h1>
            <button 
              style={styles.homeButton}
              onClick={() => navigate('/')}
            >
              <Home size={18} />
              Home
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 24, color: '#111827' }}>
              Upload Offering Memorandum
            </h2>
            
            <div
              style={{
                ...styles.uploadZone,
                ...(file ? styles.uploadZoneActive : {})
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload style={{ width: 64, height: 64, color: '#9ca3af', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                {file ? file.name : 'Drop PDF here or click to browse'}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                PDF files only • Maximum 50MB
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <button
                  style={{
                    ...styles.button,
                    ...(isUploading ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                  }}
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader size={18} className="spin" />
                      Parsing with Claude...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Parse & Underwrite
                    </>
                  )}
                </button>
              </div>
            )}

            {/* OR divider + Manual Entry button */}
            <div style={{ margin: '32px 0', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: '#e5e7eb' }} />
              <span style={{ position: 'relative', background: '#fff', padding: '0 16px', color: '#6b7280', fontSize: 14, fontWeight: 600 }}>OR</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => navigate('/manual-entry')}
                style={{ 
                  ...styles.button, 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' 
                }}
              >
                <FileText size={18} /> Enter Manually
              </button>
            </div>

            {uploadError && (
              <div style={{ marginTop: 24, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertCircle size={20} color="#b91c1c" />
                <span style={{ color: '#991b1b', fontSize: 14 }}>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    );
  }

  // STEP 2: Verify/Edit Wizard with Cactus-style UI
  if (step === 'verify') {
    // Extract confidence data from verifiedData
    const confidence = verifiedData?._confidence || {};
    const dataQuality = verifiedData?.data_quality || {};
    
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          {/* Top Navigation Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button onClick={() => navigate('/')} style={styles.homeButton}>
              <Home size={16} /> Home
            </button>
            <button 
              onClick={() => setStep('upload')} 
              style={{ ...styles.homeButton, background: '#f3f4f6' }}
            >
              <ArrowLeft size={16} /> Back to Upload
            </button>
          </div>

          {/* Page Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ ...styles.title, fontSize: '2.25rem', marginBottom: 8 }}>
              Document Review & Verification
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 16 }}>
              Review extracted data with confidence scores and source citations
            </p>
            
            {/* Data Quality Summary */}
            {dataQuality.overall_confidence && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: dataQuality.overall_confidence >= 0.8 ? '#dcfce7' : '#fef3c7',
                border: `1px solid ${dataQuality.overall_confidence >= 0.8 ? '#bbf7d0' : '#fcd34d'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: dataQuality.overall_confidence >= 0.8 ? '#166534' : '#92400e'
              }}>
                <CheckCircle size={16} />
                Overall Confidence: {(dataQuality.overall_confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {uploadError && (
            <div style={{ marginBottom: 20, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', gap: 12 }}>
              <AlertCircle size={20} color="#b91c1c" />
              <span style={{ color: '#991b1b', fontSize: 14 }}>{uploadError}</span>
            </div>
          )}

          {/* Step Navigation */}
          <WizardStepNavigation
            steps={tabs}
            activeStep={activeTab}
            completedSteps={completedSteps}
            onStepClick={setActiveTab}
          />

          {/* Tab Content */}
          {activeTab === 'property' && (
            <PropertyDetailsWizardTab
              verifiedData={verifiedData}
              confidence={confidence}
              onViewSource={handleViewSource}
              onSelectValue={handleSelectValue}
            />
          )}

          {activeTab === 'financial' && (
            <FinancialDataWizardTab
              verifiedData={verifiedData}
              confidence={confidence}
              onViewSource={handleViewSource}
              onSelectValue={handleSelectValue}
            />
          )}

          {activeTab === 'financing' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Landmark size={20} /> Loan & Financing Terms
              </h3>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                Enter your financing assumptions. Default values are typical market terms.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Loan-to-Value (LTV) %
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.financing?.ltv || 75}
                    onChange={(e) => updateVerifiedField('financing', 'ltv', parseFloat(e.target.value))}
                    placeholder="75"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 65-80%</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Interest Rate %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={verifiedData?.financing?.interest_rate || 6.0}
                    onChange={(e) => updateVerifiedField('financing', 'interest_rate', parseFloat(e.target.value))}
                    placeholder="6.0"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Current market: 5.5-7.5%</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Loan Term (Years)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.financing?.loan_term_years || 10}
                    onChange={(e) => updateVerifiedField('financing', 'loan_term_years', parseFloat(e.target.value))}
                    placeholder="10"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 5-10 years</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Amortization (Years)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.financing?.amortization_years || 30}
                    onChange={(e) => updateVerifiedField('financing', 'amortization_years', parseFloat(e.target.value))}
                    placeholder="30"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 25-30 years</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Interest-Only Years
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.financing?.io_years || 0}
                    onChange={(e) => updateVerifiedField('financing', 'io_years', parseFloat(e.target.value))}
                    placeholder="0"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Optional: 0-3 years</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Loan Fees %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={verifiedData?.financing?.loan_fees_percent || 1.5}
                    onChange={(e) => updateVerifiedField('financing', 'loan_fees_percent', parseFloat(e.target.value))}
                    placeholder="1.5"
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Origination fees</span>
                </div>
              </div>
              
              {/* Calculated loan summary */}
              {verifiedData?.pricing_financing?.price && (
                <div style={{ marginTop: 24, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12 }}>Calculated Loan Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Loan Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${((verifiedData.pricing_financing.price * (verifiedData.financing?.ltv || 75) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Down Payment</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${((verifiedData.pricing_financing.price * (100 - (verifiedData.financing?.ltv || 75)) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Est. Monthly Payment</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${(() => {
                          const P = verifiedData.pricing_financing.price * (verifiedData.financing?.ltv || 75) / 100;
                          const r = (verifiedData.financing?.interest_rate || 6) / 100 / 12;
                          const n = (verifiedData.financing?.amortization_years || 30) * 12;
                          if (r === 0) return (P / n).toLocaleString(undefined, {maximumFractionDigits: 0});
                          const payment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                          return payment.toLocaleString(undefined, {maximumFractionDigits: 0});
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep('upload')}
              style={{
                padding: '12px 24px',
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteWizard}
              style={{
                ...styles.button,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle size={18} />
              Complete & Analyze
            </button>
          </div>
        </div>

        {/* PDF Viewer Modal */}
        <PDFViewerModal
          isOpen={pdfViewerOpen}
          onClose={() => setPdfViewerOpen(false)}
          pdfUrl={pdfUrl}
          highlightInfo={highlightInfo}
          fieldLabel={selectedField?.label}
          fieldValue={selectedField?.value}
        />
      </div>
    );
  }

  // STEP 3: Results + Chat (side-by-side)
  if (step === 'results') {
    return (
      <ResultsPageV2
        dealId={dealId}
        scenarioData={scenarioData}
        modifiedFields={modifiedFields}
        calculations={calculations}
        underwritingResult={underwritingResult}
        setUnderwritingResult={setUnderwritingResult}
        messages={messages}
        inputValue={inputValue}
        setInputValue={setInputValue}
        isSending={isSending}
        handleSendMessage={handleSendMessage}
        chatMessagesRef={chatMessagesRef}
        onEditData={(path, value) => modifyScenarioField(path, value)}
        onGoHome={() => navigate('/')}
        isChatMinimized={isChatMinimized}
        setIsChatMinimized={setIsChatMinimized}
      />
    );
  }

  return null;
}

export default UnderwriteV2Page;
