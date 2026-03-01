// V2 Underwriter with Verification Wizard + Results Dashboard
// Flow: Upload → Parse → Wizard (verify/edit) → Results + Chat (side-by-side)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Upload, Home, Loader, AlertCircle, CheckCircle, DollarSign, 
  Building, FileText, ArrowLeft, Landmark
} from 'lucide-react';
import ResultsPageV2 from '../components/ResultsPageV2';
import { loadDealForResults } from '../lib/dealsService';
import WizardStepNavigation from '../components/WizardStepNavigation';
import PropertyDetailsWizardTab from '../components/wizard/PropertyDetailsWizardTab';
import FinancialDataWizardTab from '../components/wizard/FinancialDataWizardTab';
import PDFViewerModal from '../components/PDFViewerModal';
import { loadTemplate, applyFinancingTemplate } from '../lib/templateService';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8010";

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
  const location = useLocation();
  const fileInputRef = useRef(null);
  const chatMessagesRef = useRef(null);

  // Step control: 'upload' | 'verify' | 'results'
  const [step, setStep] = useState('upload');
  const [isLoadingSavedDeal, setIsLoadingSavedDeal] = useState(false);

  // Upload state
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [uploadedFileData, setUploadedFileData] = useState(null);
  
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
  const [savedRentcastData, setSavedRentcastData] = useState(null);
  const [modifiedFields, setModifiedFields] = useState({});
  
  // Underwrite template (loaded from Supabase profiles)
  const [uwTemplate, setUwTemplate] = useState(null);

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

  // ── Load underwrite template on mount ──
  useEffect(() => {
    loadTemplate('underwrite').then(tpl => {
      console.log('[TEMPLATE] Loaded underwrite template:', tpl);
      setUwTemplate(tpl);
    });
  }, []);

  // ── Load saved deal from pipeline (viewDeal query param) ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewDealId = params.get('viewDeal');
    if (!viewDealId) return;

    let cancelled = false;
    const load = async () => {
      setIsLoadingSavedDeal(true);
      try {
        const saved = await loadDealForResults(viewDealId);
        if (cancelled || !saved) {
          if (!saved) setUploadError('Deal not found. It may have been deleted.');
          setIsLoadingSavedDeal(false);
          return;
        }

        // The saved scenarioData (or parsedData) is the deal's full data
        const dealData = saved.scenarioData || saved.parsedData || {};

        // Ensure pricing_financing has _original_purchase_price stamp
        if (dealData.pricing_financing) {
          if (!dealData.pricing_financing._original_purchase_price) {
            dealData.pricing_financing._original_purchase_price =
              dealData.pricing_financing.price || dealData.pricing_financing.purchase_price || 0;
          }
          dealData.pricing_financing.purchase_price =
            dealData.pricing_financing.purchase_price || dealData.pricing_financing.price || saved.purchasePrice || 0;
        }

        // Normalize vacancy_rate if still a decimal
        if (dealData.pnl) {
          const rawVac = dealData.pnl.vacancy_rate || 0;
          if (rawVac > 0 && rawVac < 1) {
            dealData.pnl.vacancy_rate = rawVac * 100;
          }
        }

        // Apply template defaults for missing financing/exit/criteria
        const isEmailDeal = params.get('source') === 'email';
        const templateSlot = isEmailDeal ? 'email_underwrite' : 'underwrite';
        try {
          const tpl = await loadTemplate(templateSlot);
          const fin = dealData.financing || {};
          const hasFinancing = fin.ltv > 0 || fin.interest_rate > 0;
          if (!hasFinancing) {
            applyFinancingTemplate(dealData, tpl);
            console.log(`[TEMPLATE] Applied ${templateSlot} template to loaded deal`);
          }
          // Always apply exit_details and investment_criteria if missing
          if (!dealData.exit_details && tpl.exit_details) {
            dealData.exit_details = { ...tpl.exit_details };
          }
          if (!dealData.investment_criteria?.length && tpl.investment_criteria?.length) {
            dealData.investment_criteria = tpl.investment_criteria.map(c => ({ ...c }));
          }
        } catch (tplErr) {
          console.warn('[TEMPLATE] Could not load template for saved deal:', tplErr);
        }

        setDealId(viewDealId);
        setScenarioData(dealData);
        setVerifiedData(dealData);
        setModifiedFields({});
        setStep('results');

        // Load cached RentCast data if saved with the deal
        if (saved.rentcastData) {
          setSavedRentcastData(saved.rentcastData);
        }

        setMessages([{
          role: 'assistant',
          content: `Welcome back! I've loaded the deal at ${saved.address || dealData.property?.address || 'this property'}. Feel free to adjust assumptions or ask me anything.`
        }]);
      } catch (err) {
        console.error('Error loading saved deal:', err);
        setUploadError('Failed to load deal: ' + err.message);
      } finally {
        if (!cancelled) setIsLoadingSavedDeal(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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
      // Read file data for reliable PDF viewing
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedFileData(ev.target.result);
        const blob = new Blob([ev.target.result], { type: selectedFile.type });
        setUploadedFileUrl(URL.createObjectURL(blob));
      };
      reader.readAsArrayBuffer(selectedFile);
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
      
      // ===== Bridge operating expenses & NOI fields for wizard =====
      // Backend post-processing should handle this, but double-check on frontend too
      if (parsedCopy.pnl) {
        // Bridge operating_expenses → operating_expenses_t12
        if (!parsedCopy.pnl.operating_expenses_t12 && parsedCopy.pnl.operating_expenses) {
          parsedCopy.pnl.operating_expenses_t12 = parsedCopy.pnl.operating_expenses;
          console.log('[BRIDGE] operating_expenses → operating_expenses_t12:', parsedCopy.pnl.operating_expenses);
        }
        // Bridge expenses.total → operating_expenses_t12
        if (!parsedCopy.pnl.operating_expenses_t12 && parsedCopy.expenses?.total) {
          parsedCopy.pnl.operating_expenses_t12 = parsedCopy.expenses.total;
          parsedCopy.pnl.operating_expenses = parsedCopy.expenses.total;
          console.log('[BRIDGE] expenses.total → operating_expenses_t12:', parsedCopy.expenses.total);
        }
        // Bridge noi → noi_t12
        if (!parsedCopy.pnl.noi_t12 && parsedCopy.pnl.noi) {
          parsedCopy.pnl.noi_t12 = parsedCopy.pnl.noi;
          console.log('[BRIDGE] noi → noi_t12:', parsedCopy.pnl.noi);
        }
        // Bridge cap_rate → cap_rate_t12
        if (!parsedCopy.pnl.cap_rate_t12 && parsedCopy.pnl.cap_rate) {
          parsedCopy.pnl.cap_rate_t12 = parsedCopy.pnl.cap_rate;
          console.log('[BRIDGE] cap_rate → cap_rate_t12:', parsedCopy.pnl.cap_rate);
        }
        // Bridge expense_ratio → expense_ratio_t12
        if (!parsedCopy.pnl.expense_ratio_t12 && parsedCopy.pnl.expense_ratio) {
          parsedCopy.pnl.expense_ratio_t12 = parsedCopy.pnl.expense_ratio;
        }
        // If proforma NOI exists but no T12 NOI, use proforma as fallback
        if (!parsedCopy.pnl.noi_t12 && parsedCopy.pnl.noi_proforma) {
          parsedCopy.pnl.noi_t12 = parsedCopy.pnl.noi_proforma;
          parsedCopy.pnl.noi = parsedCopy.pnl.noi_proforma;
          console.log('[BRIDGE] noi_proforma → noi_t12 (fallback):', parsedCopy.pnl.noi_proforma);
        }
        // Calculate NOI if we have GPR/EGI and OpEx but no NOI
        const egi = parsedCopy.pnl.effective_gross_income || parsedCopy.pnl.gross_potential_rent;
        const opex = parsedCopy.pnl.operating_expenses_t12 || parsedCopy.pnl.operating_expenses;
        if (!parsedCopy.pnl.noi_t12 && egi && opex) {
          const calcNoi = egi - opex;
          parsedCopy.pnl.noi = calcNoi;
          parsedCopy.pnl.noi_t12 = calcNoi;
          console.log('[BRIDGE] Calculated NOI = EGI/GPR - OpEx:', egi, '-', opex, '=', calcNoi);
        }
        // Calculate OpEx if we have income and NOI but no expenses
        if (!parsedCopy.pnl.operating_expenses_t12 && egi && parsedCopy.pnl.noi_t12) {
          const calcOpex = egi - parsedCopy.pnl.noi_t12;
          if (calcOpex > 0) {
            parsedCopy.pnl.operating_expenses = calcOpex;
            parsedCopy.pnl.operating_expenses_t12 = calcOpex;
            console.log('[BRIDGE] Calculated OpEx = EGI/GPR - NOI:', egi, '-', parsedCopy.pnl.noi_t12, '=', calcOpex);
          }
        }
      }
      console.log('[BRIDGE] Final pnl state:', JSON.stringify(parsedCopy.pnl, null, 2));
      
      // Ensure financing object exists — apply user's saved template defaults
      if (!parsedCopy.financing) {
        parsedCopy.financing = {};
      }
      if (uwTemplate) {
        applyFinancingTemplate(parsedCopy, uwTemplate);
        console.log('[TEMPLATE] Applied template to parsed data:', uwTemplate.financing);
      } else {
        // Fallback hardcoded defaults if template not loaded yet
        parsedCopy.financing = {
          ltv: parsedCopy.financing.ltv || 75,
          interest_rate: parsedCopy.financing.interest_rate || 6.0,
          loan_term_years: parsedCopy.financing.loan_term_years || 10,
          amortization_years: parsedCopy.financing.amortization_years || 30,
          io_years: parsedCopy.financing.io_years || 0,
          loan_fees_percent: parsedCopy.financing.loan_fees_percent || 1.5,
          ...parsedCopy.financing
        };
      }
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

  // Handle inline edit from ExtractedFieldsTable
  const handleEditValue = (field, newValue) => {
    const pathParts = (field.path || field.key).split('.');
    if (pathParts.length === 2) {
      updateVerifiedField(pathParts[0], pathParts[1], newValue);
    }
  };
  
  // Handle viewing source in PDF
  const handleViewSource = (field, confidence) => {
    console.log('[PDF Viewer] Opening for field:', field.label, confidence);
    setSelectedField(field);
    
    // Extract page number from multiple possible locations in confidence metadata
    let pageNum = null;
    
    // 1. Direct page number from confidence object
    if (confidence?.page && Number.isFinite(Number(confidence.page))) {
      pageNum = Number(confidence.page);
    }
    
    // 2. Try extracting from source string (e.g., "Page 3", "Page 3 header", "T12 Operating Statement on page 8")
    if (!pageNum && confidence?.source) {
      const match = confidence.source.match(/[Pp]age\s*(\d+)/);
      if (match) pageNum = parseInt(match[1], 10);
    }
    
    // 3. Try extracting from note string
    if (!pageNum && confidence?.note) {
      const match = confidence.note.match(/[Pp]age\s*(\d+)/);
      if (match) pageNum = parseInt(match[1], 10);
    }
    
    // 4. Look up the field in _confidence from verifiedData
    if (!pageNum && verifiedData?._confidence) {
      const fieldPath = field.path || field.key;
      const confEntry = verifiedData._confidence[fieldPath];
      if (confEntry?.page && Number.isFinite(Number(confEntry.page))) {
        pageNum = Number(confEntry.page);
      } else if (confEntry?.source) {
        const match = confEntry.source.match(/[Pp]age\s*(\d+)/);
        if (match) pageNum = parseInt(match[1], 10);
      }
    }
    
    console.log('[PDF Viewer] Resolved page:', pageNum, 'for field:', field.label);
    
    setHighlightInfo({
      page: pageNum || 1,
      source: confidence?.source,
      note: confidence?.note,
      searchTerm: field.value?.toString() || confidence?.text || confidence?.raw_value || ''
    });
    
    // Create fresh blob URL from stored file data
    if (uploadedFileData) {
      const blob = new Blob([uploadedFileData], { type: 'application/pdf' });
      setPdfUrl(URL.createObjectURL(blob));
    } else {
      setPdfUrl(uploadedFileUrl);
    }
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

  // Handle unit mix updates (add, delete, edit)
  const handleUpdateUnitMix = (idx, fieldOrAction, value) => {
    setVerifiedData(prev => {
      const updated = { ...prev };
      const mix = [...(updated.unit_mix || [])];
      if (fieldOrAction === '_add') {
        mix.push({ type: '', units: 0, mix_pct: 0, unit_sf: 0, rent_current: 0, rent_psf: 0, rent_market: 0, rent_market_psf: 0, rent_max: 0, total_current_monthly: 0, total_market_monthly: 0 });
      } else if (fieldOrAction === '_delete') {
        mix.splice(idx, 1);
      } else {
        mix[idx] = { ...mix[idx], [fieldOrAction]: value };
      }
      updated.unit_mix = mix;
      return updated;
    });
  };

  // Handle expense line item updates
  const handleUpdateExpenses = (key, value) => {
    setVerifiedData(prev => {
      const updated = { ...prev };
      updated.expenses = { ...(updated.expenses || {}), [key]: value };
      // Recalculate total
      const items = ['taxes', 'insurance', 'utilities', 'repairs_maintenance', 'management', 'payroll', 'admin', 'marketing', 'other'];
      updated.expenses.total = items.reduce((sum, k) => sum + (Number(updated.expenses[k]) || 0), 0);
      return updated;
    });
  };

  // Validate required fields
  const fieldLabels = {
    'property.address': 'Property Address',
    'property.units': 'Total Units',
    'pricing_financing.price': 'Purchase Price',
    'pnl.gross_potential_rent': 'Gross Potential Rent',
    'pnl.operating_expenses_t12': 'Operating Expenses (T12)',
    'pnl.noi_t12': 'NOI (T12)'
  };

  const fieldToTab = {
    'property': 'property',
    'pricing_financing': 'financial',
    'pnl': 'financial'
  };

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
          errors.push({ path: `${section}.${field}`, label: fieldLabels[`${section}.${field}`] || field, tab: fieldToTab[section] || 'property' });
        }
      });
    });

    if (errors.length > 0) {
      console.log('[Validation] Missing required fields:', errors);
      const missingNames = errors.map(e => e.label).join(', ');
      // Jump to the tab with the first missing field
      setActiveTab(errors[0].tab);
      setUploadError(`Missing required fields: ${missingNames}`);
    }
    return errors.length === 0;
  };

  // Complete wizard → move to results
  const handleCompleteWizard = () => {
    if (!validateWizard()) {
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

      // Stamp the original purchase price so the calculation engine can detect
      // price changes and recalculate all financing fields proportionally.
      transformedData.pricing_financing._original_purchase_price =
        transformedData.pricing_financing.price || transformedData.pricing_financing.purchase_price || 0;
    }
    
    // Ensure financing object exists with defaults from pricing_financing
    if (!transformedData.financing) {
      transformedData.financing = {};
    }
    
    // Copy values from pricing_financing to financing object
    const pf = transformedData.pricing_financing || {};
    // Use saved template defaults (if available) instead of hardcoded values
    const tDef = uwTemplate?.financing || { ltv: 75, interest_rate: 6.0, loan_term_years: 10, amortization_years: 30, io_years: 0, loan_fees_percent: 1.5 };
    transformedData.financing.ltv = transformedData.financing.ltv || pf.ltv || tDef.ltv;
    // Interest rate: pricing_financing stores as decimal (0.055), financing uses percentage (5.5)
    transformedData.financing.interest_rate = transformedData.financing.interest_rate || (pf.interest_rate ? pf.interest_rate * 100 : 0) || tDef.interest_rate;
    transformedData.financing.loan_term_years = transformedData.financing.loan_term_years || pf.term_years || tDef.loan_term_years;
    transformedData.financing.amortization_years = transformedData.financing.amortization_years || pf.amortization_years || tDef.amortization_years;
    transformedData.financing.io_years = transformedData.financing.io_years ?? tDef.io_years;
    transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || tDef.loan_fees_percent;

    // Apply exit details + investment criteria from template
    if (uwTemplate) {
      if (!transformedData.exit_details) {
        transformedData.exit_details = { ...uwTemplate.exit_details };
      }
      if (!transformedData.investment_criteria?.length && uwTemplate.investment_criteria?.length) {
        transformedData.investment_criteria = uwTemplate.investment_criteria.map(c => ({ ...c }));
      }
    }
    
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
      // Normalize vacancy_rate to whole-number percentage (e.g. 5 = 5%)
      // Backend already normalizes to whole numbers; only convert if still a decimal
      const rawVac = transformedData.pnl.vacancy_rate || 0.05;
      transformedData.pnl.vacancy_rate = rawVac > 0 && rawVac < 1 ? rawVac * 100 : rawVac;
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

  // Loading saved deal from pipeline
  if (isLoadingSavedDeal) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.container, textAlign: 'center', paddingTop: 120 }}>
          <Loader size={48} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#3b82f6', marginBottom: 20 }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>Loading Deal from Pipeline...</h2>
          <p style={{ color: '#6b7280', marginTop: 8 }}>Pulling your saved underwriting data</p>
        </div>
      </div>
    );
  }

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
              onEditValue={handleEditValue}
              onUpdateUnitMix={handleUpdateUnitMix}
            />
          )}

          {activeTab === 'financial' && (
            <FinancialDataWizardTab
              verifiedData={verifiedData}
              confidence={confidence}
              onViewSource={handleViewSource}
              onSelectValue={handleSelectValue}
              onEditValue={handleEditValue}
              onUpdateExpenses={handleUpdateExpenses}
            />
          )}

          {activeTab === 'financing' && (
            <div style={styles.card}>
              {/* ── Header ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>Financing Assumptions</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0 0' }}>Configure your loan terms to calculate debt service & cash flow</p>
                </div>
              </div>

              {/* ── Senior Loan Card ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 18 }}>🏦</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Senior Loan</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Loan-to-Value (LTV)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" style={{ ...styles.input, paddingRight: 32 }} value={verifiedData?.financing?.ltv || 75} onChange={(e) => updateVerifiedField('financing', 'ltv', parseFloat(e.target.value))} placeholder="75" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Typical: 65–80%</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Interest Rate
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" step="0.1" style={{ ...styles.input, paddingRight: 32 }} value={verifiedData?.financing?.interest_rate || 6.0} onChange={(e) => updateVerifiedField('financing', 'interest_rate', parseFloat(e.target.value))} placeholder="6.0" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Current market: 5.5–7.5%</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Loan Term
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" style={{ ...styles.input, paddingRight: 40 }} value={verifiedData?.financing?.loan_term_years || 10} onChange={(e) => updateVerifiedField('financing', 'loan_term_years', parseFloat(e.target.value))} placeholder="10" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Typical: 5–10 years</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Amortization
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" style={{ ...styles.input, paddingRight: 40 }} value={verifiedData?.financing?.amortization_years || 30} onChange={(e) => updateVerifiedField('financing', 'amortization_years', parseFloat(e.target.value))} placeholder="30" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Typical: 25–30 years</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Interest-Only Period
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" style={{ ...styles.input, paddingRight: 40 }} value={verifiedData?.financing?.io_years || 0} onChange={(e) => updateVerifiedField('financing', 'io_years', parseFloat(e.target.value))} placeholder="0" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>yrs</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Optional: 0–3 years</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Loan Fees
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" step="0.1" style={{ ...styles.input, paddingRight: 32 }} value={verifiedData?.financing?.loan_fees_percent || 1.5} onChange={(e) => updateVerifiedField('financing', 'loan_fees_percent', parseFloat(e.target.value))} placeholder="1.5" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>Origination fees</span>
                  </div>
                </div>

                {/* ── Monthly Payment Display ── */}
                {verifiedData?.pricing_financing?.price && (() => {
                  const P = verifiedData.pricing_financing.price * (verifiedData?.financing?.ltv || 75) / 100;
                  const r = (verifiedData?.financing?.interest_rate || 6) / 100 / 12;
                  const n = (verifiedData?.financing?.amortization_years || 30) * 12;
                  const monthly = r > 0 ? P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : (P / n);
                  return (
                    <div style={{ marginTop: 20, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={18} color="#2563eb" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Monthly Payment</span>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
                        ${monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* ── Financing Summary Cards ── */}
              {verifiedData?.pricing_financing?.price && (() => {
                const purchasePrice = verifiedData.pricing_financing.price;
                const ltvPct = verifiedData?.financing?.ltv || 75;
                const loanFeesPct = verifiedData?.financing?.loan_fees_percent || 1.5;
                const loanAmt = purchasePrice * ltvPct / 100;
                const downPmt = purchasePrice - loanAmt;
                const loanFees = loanAmt * loanFeesPct / 100;
                const closingCosts = purchasePrice * 0.02; // 2% estimate
                const totalAcquisitionCost = purchasePrice + loanFees + closingCosts;
                const ltcPct = (loanAmt / totalAcquisitionCost) * 100;
                const equityRequired = totalAcquisitionCost - loanAmt;

                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>📊</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financing Summary</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                      {/* Total Acquisition Cost */}
                      <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Total Acquisition Cost</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>${totalAcquisitionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                          Purchase + fees + closing
                        </div>
                      </div>
                      {/* Total Loan Amount */}
                      <div style={{ padding: 20, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Total Loan Amount</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1e40af' }}>${loanAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 6 }}>
                          {ltvPct}% of purchase price
                        </div>
                      </div>
                      {/* Down Payment / Equity */}
                      <div style={{ padding: 20, background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Down Payment</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>${downPmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#22c55e', fontWeight: 700, marginTop: 6 }}>
                          <span>↑</span>{(100 - ltvPct).toFixed(1)}%
                        </div>
                      </div>
                      {/* Loan-to-Cost */}
                      <div style={{ padding: 20, background: '#faf5ff', borderRadius: 12, border: '1px solid #d8b4fe' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Loan-to-Cost (LTC)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#6d28d9' }}>{ltcPct.toFixed(1)}%</div>
                        <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 6 }}>
                          Equity: ${equityRequired.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Fees breakdown */}
                    <div style={{ marginTop: 16, padding: 14, background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Loan Fees ({loanFeesPct}%)</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>${loanFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Est. Closing Costs (2%)</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>${closingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Total Cash to Close</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>${(downPmt + loanFees + closingCosts).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
          pdfData={uploadedFileData}
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
        savedRentcastData={savedRentcastData}
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
