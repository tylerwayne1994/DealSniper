// V2 Underwriter with Verification Wizard + Results Dashboard
// Flow: Upload → Parse → Wizard (verify/edit) → Results + Chat (side-by-side)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Home, Loader, AlertCircle, CheckCircle, DollarSign, 
  Building, FileText, ArrowLeft, Landmark
} from 'lucide-react';
import ResultsPageV2 from '../components/ResultsPageV2';

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
  
  // Parse result
  const [dealId, setDealId] = useState(null);
  
  // Wizard state (editable copy of parsed data)
  const [verifiedData, setVerifiedData] = useState(null);
  const [activeTab, setActiveTab] = useState('property');
  const [validationErrors, setValidationErrors] = useState({});
  
  // Results page state (live scenario modeling)
  const [scenarioData, setScenarioData] = useState(null);
  const [modifiedFields, setModifiedFields] = useState({});
  
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
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        // Create nested object if it doesn't exist
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = newValue;
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
    
    // Clear validation error
    setValidationErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[`${section}.${field}`];
      return newErrors;
    });
  };

  // Validate required fields
  const validateWizard = () => {
    const errors = {};
    const required = {
      property: ['address', 'units'],
      pricing_financing: ['price'],
      pnl: ['gross_potential_rent', 'operating_expenses', 'noi']
    };

    Object.keys(required).forEach(section => {
      required[section].forEach(field => {
        if (!verifiedData?.[section]?.[field]) {
          errors[`${section}.${field}`] = true;
        }
      });
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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

  // Wizard tabs configuration
  const tabs = [
    { id: 'property', label: 'Property Info', icon: Building },
    { id: 'financial', label: 'Financials', icon: DollarSign },
    { id: 'financing', label: 'Financing', icon: Landmark },
    { id: 'expenses', label: 'Expenses', icon: FileText },
    { id: 'unitMix', label: 'Unit Mix', icon: Home },
    { id: 'additional', label: 'Additional Data', icon: FileText }
  ];

  // ============ RENDER ============

  // STEP 1: Upload
  if (step === 'upload') {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>🎯 V2 Automatic Underwriter</h1>
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

  // STEP 2: Verify/Edit Wizard
  if (step === 'verify') {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
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

          <h1 style={{ ...styles.title, fontSize: '2rem', marginBottom: 8 }}>
            Verify & Complete Deal Information
          </h1>
          <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 24 }}>
            Review the extracted data and fill in any missing fields
          </p>

          {uploadError && (
            <div style={{ marginBottom: 20, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', gap: 12 }}>
              <AlertCircle size={20} color="#b91c1c" />
              <span style={{ color: '#991b1b', fontSize: 14 }}>{uploadError}</span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f9fafb', padding: 4, borderRadius: 12 }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: activeTab === tab.id ? '#fff' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'property' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={20} /> Property Information
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#ef4444' }}>* Required</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Address *
                  </label>
                  <input
                    type="text"
                    style={{
                      ...styles.input,
                      ...(validationErrors['property.address'] ? styles.inputError : {}),
                      ...(verifiedData?.property?.address ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.address || ''}
                    onChange={(e) => updateVerifiedField('property', 'address', e.target.value)}
                    placeholder="Enter property address"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    City
                  </label>
                  <input
                    type="text"
                    style={styles.input}
                    value={verifiedData?.property?.city || ''}
                    onChange={(e) => updateVerifiedField('property', 'city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    State
                  </label>
                  <input
                    type="text"
                    style={styles.input}
                    value={verifiedData?.property?.state || ''}
                    onChange={(e) => updateVerifiedField('property', 'state', e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    style={styles.input}
                    value={verifiedData?.property?.zip || ''}
                    onChange={(e) => updateVerifiedField('property', 'zip', e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Total Units *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['property.units'] ? styles.inputError : {}),
                      ...(verifiedData?.property?.units ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.units || ''}
                    onChange={(e) => updateVerifiedField('property', 'units', parseFloat(e.target.value))}
                    placeholder="Number of units"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Year Built
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.property?.year_built || ''}
                    onChange={(e) => updateVerifiedField('property', 'year_built', parseFloat(e.target.value))}
                    placeholder="Year"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Total Square Feet
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.property?.rba_sqft || ''}
                    onChange={(e) => updateVerifiedField('property', 'rba_sqft', parseFloat(e.target.value))}
                    placeholder="Square feet"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Property Type
                  </label>
                  <input
                    type="text"
                    style={styles.input}
                    value={verifiedData?.property?.property_type || ''}
                    onChange={(e) => updateVerifiedField('property', 'property_type', e.target.value)}
                    placeholder="e.g., Multifamily"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={20} /> Financial Information
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#ef4444' }}>* Required</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['pricing_financing.price'] ? styles.inputError : {}),
                      ...(verifiedData?.pricing_financing?.price ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.pricing_financing?.price || ''}
                    onChange={(e) => updateVerifiedField('pricing_financing', 'price', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Gross Potential Rent *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['pnl.gross_potential_rent'] ? styles.inputError : {}),
                      ...(verifiedData?.pnl?.gross_potential_rent ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.pnl?.gross_potential_rent || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'gross_potential_rent', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Other Income
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.pnl?.other_income || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'other_income', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Vacancy Rate (%)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.pnl?.vacancy_rate ? (verifiedData.pnl.vacancy_rate * 100) : ''}
                    onChange={(e) => updateVerifiedField('pnl', 'vacancy_rate', parseFloat(e.target.value) / 100)}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Operating Expenses *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['pnl.operating_expenses'] ? styles.inputError : {}),
                      ...(verifiedData?.pnl?.operating_expenses ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.pnl?.operating_expenses || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'operating_expenses', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Net Operating Income (NOI) *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['pnl.noi'] ? styles.inputError : {}),
                      ...(verifiedData?.pnl?.noi ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.pnl?.noi || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'noi', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} /> Operating Expenses
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Property Taxes
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.taxes || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'taxes', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Insurance
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.insurance || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'insurance', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Utilities
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.utilities || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'utilities', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Repairs & Maintenance
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.repairs_maintenance || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'repairs_maintenance', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Management & Leasing
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.management || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'management', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Marketing & Turnover
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.expenses?.marketing || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'marketing', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
              </div>
            </div>
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

          {activeTab === 'unitMix' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Home size={20} /> Unit Mix
              </h3>
              {verifiedData?.unit_mix && verifiedData.unit_mix.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Unit Type</th>
                        <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Count</th>
                        <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>SF</th>
                        <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Current Rent</th>
                        <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Market Rent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifiedData.unit_mix.map((unit, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: 12, fontSize: 14 }}>{unit.type}</td>
                          <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>{unit.units}</td>
                          <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>{unit.unit_sf?.toLocaleString()}</td>
                          <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>${unit.rent_current?.toLocaleString()}</td>
                          <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>${unit.rent_market?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontSize: 14 }}>No unit mix data available</p>
              )}
            </div>
          )}

          {activeTab === 'additional' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} /> Additional Parsed Data
              </h3>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                This section shows all data extracted by Claude that doesn't have dedicated fields above.
                This data is still available to the chat assistant.
              </p>

              {/* Financing Details */}
              {verifiedData?.pricing_financing && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#374151', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                    💰 Financing Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {verifiedData.pricing_financing.loan_amount > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Loan Amount</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.loan_amount.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.down_payment > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Down Payment</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.down_payment.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.interest_rate > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Interest Rate</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{(verifiedData.pricing_financing.interest_rate * 100).toFixed(2)}%</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.ltv > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>LTV</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{(verifiedData.pricing_financing.ltv * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.term_years > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Term</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{verifiedData.pricing_financing.term_years} years</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.amortization_years > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Amortization</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{verifiedData.pricing_financing.amortization_years} years</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.monthly_payment > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Monthly Payment</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.monthly_payment.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.annual_debt_service > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Annual Debt Service</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.annual_debt_service.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.price_per_unit > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Price per Unit</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.price_per_unit.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pricing_financing.price_per_sf > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Price per SF</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pricing_financing.price_per_sf.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Underwriting Metrics */}
              {verifiedData?.underwriting && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#374151', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                    📊 Underwriting Metrics
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {verifiedData.underwriting.dscr > 0 && (
                      <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>DSCR</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>{verifiedData.underwriting.dscr.toFixed(2)}</div>
                      </div>
                    )}
                    {verifiedData.underwriting.cap_rate > 0 && (
                      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>Cap Rate</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#1e3a8a' }}>{(verifiedData.underwriting.cap_rate * 100).toFixed(2)}%</div>
                      </div>
                    )}
                    {verifiedData.underwriting.cash_on_cash > 0 && (
                      <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>Cash on Cash</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#78350f' }}>{(verifiedData.underwriting.cash_on_cash * 100).toFixed(2)}%</div>
                      </div>
                    )}
                    {verifiedData.underwriting.irr > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>IRR</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{(verifiedData.underwriting.irr * 100).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Income Details */}
              {verifiedData?.pnl && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#374151', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                    💵 Income & P&L Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {verifiedData.pnl.vacancy_amount > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Vacancy Amount</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pnl.vacancy_amount.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pnl.effective_gross_income > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Effective Gross Income</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>${verifiedData.pnl.effective_gross_income.toLocaleString()}</div>
                      </div>
                    )}
                    {verifiedData.pnl.expense_ratio > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Expense Ratio</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{(verifiedData.pnl.expense_ratio * 100).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Property Details */}
              {verifiedData?.property && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#374151', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                    🏢 Additional Property Info
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {verifiedData.property.land_area_acres > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Land Area</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{verifiedData.property.land_area_acres.toFixed(2)} acres</div>
                      </div>
                    )}
                    {verifiedData.property.property_class && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Property Class</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>Class {verifiedData.property.property_class}</div>
                      </div>
                    )}
                    {verifiedData.property.parking_spaces > 0 && (
                      <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Parking Spaces</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{verifiedData.property.parking_spaces}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Quality */}
              {verifiedData?.data_quality && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#374151', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e5e7eb' }}>
                    ✅ Data Quality
                  </h4>
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 14, color: '#166534', marginBottom: 8 }}>
                      <strong>Confidence Score:</strong> {(verifiedData.data_quality.confidence * 100).toFixed(0)}%
                    </div>
                    {verifiedData.data_quality.missing_fields && verifiedData.data_quality.missing_fields.length > 0 && (
                      <div style={{ fontSize: 13, color: '#166534' }}>
                        <strong>Missing Fields:</strong> {verifiedData.data_quality.missing_fields.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button
              onClick={handleCompleteWizard}
              style={{
                ...styles.button,
                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                boxShadow: '0 4px 6px rgba(107, 114, 128, 0.3)'
              }}
            >
              <ArrowLeft size={18} />
              Skip to Results
            </button>
            <button
              onClick={handleRunAIAnalysis}
              style={{
                ...styles.button,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle size={18} />
              🤖 Run AI Underwriting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Results + Chat (side-by-side)
  if (step === 'results') {
    return (
      <ResultsPageV2
        scenarioData={scenarioData}
        modifiedFields={modifiedFields}
        calculations={calculations}
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
