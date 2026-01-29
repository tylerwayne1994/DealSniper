// V2 Underwriter with Verification Wizard + Results Dashboard
// Flow: Upload → Parse → Wizard (verify/edit) → Results + Chat (side-by-side)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Upload, Home, Loader, AlertCircle, CheckCircle, DollarSign, 
  Building, FileText, ArrowLeft, Landmark, Calculator
} from 'lucide-react';
import ResultsPageV2 from '../components/ResultsPageV2';
import { loadDealForResults } from '../lib/dealsService';

const API_BASE = process.env.REACT_APP_API_URL || "https://dealsniper-1.onrender.com";

// Styles (keeping consistent with V1)
const styles = {
  page: {
    minHeight: '100vh',
    background: '#ffffff',
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
  const pdfDocRef = useRef(null);
  const pdfCanvasRef = useRef(null);

  // Step control: 'upload' | 'verify' | 'results'
  const [step, setStep] = useState('upload');

  // Upload state
  const [file, setFile] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sourceSnippets, setSourceSnippets] = useState({});
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [activeFieldPath, setActiveFieldPath] = useState(null);
  const [zoom, setZoom] = useState(1.4); // zoom factor for main PDF canvas
  const [pageHighlights, setPageHighlights] = useState({}); // per-page highlight rects
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // Deal setup form state (Deal Manager style)
  const [dealName, setDealName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyType, setPropertyType] = useState('multifamily');
  const [transactionType, setTransactionType] = useState('acquisition');
  const [debtStructure, setDebtStructure] = useState('traditional');
  const [subjectToAvailable, setSubjectToAvailable] = useState(true);
  const [underwritingMode, setUnderwritingMode] = useState('hardcoded'); // 'hardcoded' | 'buybox'
  const [autoRunAIAfterUpload, setAutoRunAIAfterUpload] = useState(false);
  
  // Buy Box parameters (user-defined)
  const [buyBoxParams, setBuyBoxParams] = useState({
    minUnits: 50,
    maxUnits: 500,
    minCapRate: 5.0,
    maxCapRate: 8.0,
    minDSCR: 1.25,
    minCashOnCash: 8.0,
    maxPricePerUnit: 150000,
    targetMarkets: ['TX', 'FL', 'AZ', 'NC', 'GA'],
    maxVacancy: 10,
    minYearBuilt: 1980
  });
  
  // Parse result
  const [dealId, setDealId] = useState(null);
  
  // Wizard state (editable copy of parsed data)
  const [verifiedData, setVerifiedData] = useState(null);
  const [activeTab, setActiveTab] = useState('property');
  const [validationErrors, setValidationErrors] = useState({});
  
  // Results page state (live scenario modeling)
  const [scenarioData, setScenarioData] = useState(null);
  const [modifiedFields, setModifiedFields] = useState({});
  const [underwritingResult, setUnderwritingResult] = useState(null);
  
  // Market cap rate state (from LLM research)
  const [marketCapRate, setMarketCapRate] = useState(null);
  const [marketCapRateLoading, setMarketCapRateLoading] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Handle navigation state (coming back from AI analysis page)
  useEffect(() => {
    if (location.state) {
      const {
        dealId: incomingDealId,
        verifiedData: incomingData,
        goToResults,
        returnToWizard,
        underwritingResult: incomingUnderwritingResult
      } = location.state;
      
      if (incomingDealId) {
        setDealId(incomingDealId);
      }
      
      if (incomingData) {
        setVerifiedData(incomingData);
        if (incomingUnderwritingResult) {
          setUnderwritingResult(incomingUnderwritingResult);
        }
        
        // Transform and go to results if requested
        if (goToResults) {
          const transformedData = JSON.parse(JSON.stringify(incomingData));
          if (transformedData.pricing_financing) {
            transformedData.pricing_financing.purchase_price = transformedData.pricing_financing.price || transformedData.pricing_financing.purchase_price;
            transformedData.pricing_financing.down_payment_pct = transformedData.pricing_financing.down_payment_pct || 40;
          }
          if (!transformedData.financing) {
            transformedData.financing = {};
          }
          transformedData.financing.ltv = transformedData.financing.ltv || 75;
          transformedData.financing.interest_rate = transformedData.financing.interest_rate || 6.0;
          transformedData.financing.loan_term_years = transformedData.financing.loan_term_years || 10;
          transformedData.financing.amortization_years = transformedData.financing.amortization_years || 30;
          transformedData.financing.io_years = transformedData.financing.io_years || 0;
          transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || 1.5;
          if (transformedData.pnl) {
            transformedData.pnl.potential_gross_income = transformedData.pnl.gross_potential_rent || transformedData.pnl.potential_gross_income || 0;
            transformedData.pnl.vacancy_rate = (transformedData.pnl.vacancy_rate || 0.05) * 100;
          }
          setScenarioData(transformedData);
          setModifiedFields({});
          setStep('results');
          setMessages([{
            role: 'assistant',
            content: `I've analyzed your deal at ${incomingData.property?.address}. I can help you run scenarios, evaluate different assumptions, or discuss creative financing strategies.`
          }]);
        } else if (returnToWizard) {
          setStep('verify');
        }
      }
    }
  }, [location.state]);

  // Handle viewDeal URL param - load deal from Supabase
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const viewDealId = searchParams.get('viewDeal');
    if (viewDealId && viewDealId !== 'true') {
      // Load deal from Supabase
      const loadDeal = async () => {
        try {
          console.log('[VIEW DEAL] Loading deal from Supabase:', viewDealId);
          const dealData = await loadDealForResults(viewDealId);
          
          if (dealData) {
            console.log('[VIEW DEAL] Loaded deal data:', dealData);
            setDealId(viewDealId);
            
            // Set scenario data from saved parsed data
            const savedScenarioData = dealData.scenarioData || dealData.parsedData;
            setScenarioData(savedScenarioData);
            
            // Set market cap rate if saved
            if (dealData.marketCapRate) {
              setMarketCapRate(dealData.marketCapRate);
            }
            
            // Go directly to results
            setStep('results');
            setMessages([{
              role: 'assistant',
              content: `Welcome back! I've loaded your previously saved deal at ${dealData.address}. You can continue analyzing or make changes to the scenario.`
            }]);
          } else {
            console.error('[VIEW DEAL] Deal not found in Supabase');
            alert('Deal not found. It may have been deleted.');
            navigate('/pipeline');
          }
        } catch (error) {
          console.error('[VIEW DEAL] Error loading deal:', error);
          alert('Error loading deal: ' + error.message);
          navigate('/pipeline');
        }
      };
      
      loadDeal();
    }
  }, [searchParams, navigate]);

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

  // Fetch market cap rate when scenarioData changes (and we have property info)
  useEffect(() => {
    const fetchMarketCapRate = async () => {
      if (!scenarioData?.property?.address) return;
      if (marketCapRate) return; // Already fetched
      
      setMarketCapRateLoading(true);
      console.log('[MARKET CAP RATE] Fetching for:', scenarioData.property.address);
      
      try {
        // Parse city/state from address
        const address = scenarioData.property.address || '';
        const parts = address.split(',').map(p => p.trim());
        let city = '';
        let state = '';
        
        if (parts.length >= 2) {
          city = parts[parts.length - 2] || '';
          // State might include zip, extract just state
          const stateZip = parts[parts.length - 1] || '';
          state = stateZip.split(' ')[0] || '';
        }
        
        const requestBody = {
          property_type: scenarioData.deal_setup?.property_type || 'multifamily',
          city: city,
          state: state,
          address: address,
          units: scenarioData.property?.units || 0,
          year_built: scenarioData.property?.year_built || 0,
          purchase_price: scenarioData.pricing_financing?.purchase_price || scenarioData.pricing_financing?.price || 0
        };
        
        console.log('[MARKET CAP RATE] Request:', requestBody);
        
        const response = await fetch(`${API_BASE}/v2/market-cap-rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[MARKET CAP RATE] Response:', data);
          setMarketCapRate(data);
        } else {
          console.error('[MARKET CAP RATE] Error:', response.status);
        }
      } catch (err) {
        console.error('[MARKET CAP RATE] Fetch error:', err);
      } finally {
        setMarketCapRateLoading(false);
      }
    };
    
    fetchMarketCapRate();
  }, [scenarioData?.property?.address]);

  // Compute approximate highlight rectangles for a given snippet text on a page
  const computeHighlightRects = async (page, viewport, searchText) => {
    if (!searchText || !window.pdfjsLib || !window.pdfjsLib.Util) return [];
    try {
      const textContent = await page.getTextContent();
      const loweredSearch = searchText.toLowerCase();
      const rects = [];

      textContent.items.forEach((item) => {
        const rawStr = (item.str || '').trim();
        if (!rawStr || rawStr.length < 3) return;
        const lowerStr = rawStr.toLowerCase();
        if (!lowerStr) return;

        // Simple fuzzy match: either the snippet contains this run or vice versa
        if (loweredSearch.includes(lowerStr) || lowerStr.includes(loweredSearch)) {
          try {
            const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
            const x = tx[4];
            const yFromBottom = tx[5];
            const width = (item.width || 0) * viewport.scale;
            const height = (item.height || 0) * viewport.scale;

            // Convert PDF bottom-left origin to canvas top-left coordinates
            const yTop = viewport.height - yFromBottom;

            rects.push({
              leftPct: (x / viewport.width) * 100,
              topPct: (yTop / viewport.height) * 100,
              widthPct: (width / viewport.width) * 100,
              heightPct: (height / viewport.height) * 100,
            });
          } catch (e) {
            // Ignore individual text-run failures
          }
        }
      });

      return rects;
    } catch (e) {
      console.error('[V2] Failed computing highlight rects', e);
      return [];
    }
  };

  const renderMainPdfPage = async (pageNum = 1, highlightMeta = null) => {
    const doc = pdfDocRef.current;
    const canvas = pdfCanvasRef.current;
    if (!doc || !canvas) return;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom });
      const ctx = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // After rendering, compute highlight rectangles for the active snippet on this page
      if (highlightMeta && highlightMeta.text) {
        const rects = await computeHighlightRects(page, viewport, highlightMeta.text);
        setPageHighlights((prev) => ({
          ...prev,
          [pageNum]: rects,
        }));
      } else {
        // If no highlight requested, clear any existing highlights for this page
        setPageHighlights((prev) => ({
          ...prev,
          [pageNum]: [],
        }));
      }
    } catch (err) {
      console.error('[V2] Main PDF render failed', err);
    }
  };

  // Re-render current page whenever zoom changes (and doc is loaded)
  useEffect(() => {
    if (pdfDocRef.current && pdfCanvasRef.current && pdfPages.length > 0) {
      let highlightMeta = null;
      if (activeFieldPath && sourceSnippets && sourceSnippets[activeFieldPath]) {
        const meta = sourceSnippets[activeFieldPath];
        if (typeof meta.page === 'number' && meta.page === currentPageNum) {
          highlightMeta = meta;
        }
      }
      renderMainPdfPage(currentPageNum, highlightMeta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Generate PDF thumbnails + store doc for big viewer
  const genPdfThumbs = async (pdfFile) => {
    setLoadingPreview(true);
    try {
      let pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = () => {
            pdfjsLib = window.pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve();
            } else {
              reject(new Error('Failed to load pdf.js'));
            }
          };
          s.onerror = () => reject(new Error('Failed to load pdf.js'));
          document.head.appendChild(s);
        });
      }

      const ab = await pdfFile.arrayBuffer();
  const doc = await window.pdfjsLib.getDocument({ data: ab }).promise;
  pdfDocRef.current = doc;
  setCurrentPageNum(1);

      const pages = [];
      const MAX = Math.min(doc.numPages, 40);
      for (let p = 1; p <= MAX; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const thumb = canvas.toDataURL('image/png');
        pages.push({ pageNum: p, thumbnail: thumb });
      }

      setPdfPages(pages);
      // Render the first page large so text is readable
      await renderMainPdfPage(1);
    } catch (err) {
      console.error('[V2] PDF preview failed', err);
      setPdfPages([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setUploadError(`Only PDF is supported. Got: ${selectedFile.type || 'unknown'}`);
        return;
      }
      setFile(selectedFile);
      setUploadError(null);
      setSourceSnippets({});
      setActiveFieldPath(null);
      setPageHighlights({});
      setCurrentPageNum(1);
      genPdfThumbs(selectedFile);
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
      
      // Add extracted images from backend response
      if (data.images && data.images.length > 0) {
        parsedCopy.images = data.images;
        console.log(`[IMAGES] Added ${data.images.length} extracted images to parsed data`);
      }

      // Normalize vacancy rate from parser so 5 (5%) doesn't become 500%
      if (parsedCopy.pnl && typeof parsedCopy.pnl.vacancy_rate === 'number') {
        const rawVacancy = parsedCopy.pnl.vacancy_rate;
        // If parser gave a whole-number percent (e.g. 5 for 5%), convert to decimal 0.05
        if (rawVacancy > 1) {
          parsedCopy.pnl.vacancy_rate = rawVacancy / 100;
        }
      }
      
      // Store deal setup info
      parsedCopy.deal_setup = {
        deal_name: dealName || parsedCopy.property?.address || 'Untitled Deal',
        property_address: propertyAddress || parsedCopy.property?.address || '',
        property_type: propertyType,
        transaction_type: transactionType,
        debt_structure: debtStructure,
        subject_to_available: subjectToAvailable,
        underwriting_mode: underwritingMode,
        buy_box: underwritingMode === 'buybox' ? buyBoxParams : null
      };
      
      // Ensure financing object exists with defaults based on debt structure
      if (!parsedCopy.financing) {
        parsedCopy.financing = {};
      }
      
      // Set financing defaults based on debt structure selection
      const debtStructureDefaults = {
        'traditional': { ltv: 75, interest_rate: 6.5, loan_term_years: 10, amortization_years: 30, io_years: 0 },
        'seller-finance': { ltv: 80, interest_rate: 6.0, loan_term_years: 5, amortization_years: 20, io_years: 0 },
        'subject-to': { ltv: 0, interest_rate: 0, loan_term_years: 0, amortization_years: 30, io_years: 0, original_loan_amount: 0, monthly_payment: 0, remaining_payments: 0 },
        'hybrid': { ltv: 75, interest_rate: 6.5, loan_term_years: 10, amortization_years: 30, io_years: 0, original_loan_amount: 0, monthly_payment: 0, remaining_payments: 0 },
        'equity-partner': { ltv: 75, interest_rate: 6.5, loan_term_years: 10, amortization_years: 30, io_years: 0, partner_down_payment_pct: 100, partner_closing_costs_pct: 100, your_equity_pct: 5 },
        'seller-carry': { ltv: 75, interest_rate: 6.5, loan_term_years: 10, amortization_years: 30, io_years: 0, seller_carry_pct: 15, seller_carry_rate: 5.0, seller_carry_term_months: 60, seller_carry_io: true }
      };
      
      const defaults = debtStructureDefaults[debtStructure] || debtStructureDefaults['traditional'];
      
      parsedCopy.financing = {
        ltv: parsedCopy.financing.ltv || defaults.ltv,
        interest_rate: parsedCopy.financing.interest_rate || defaults.interest_rate,
        loan_term_years: parsedCopy.financing.loan_term_years || defaults.loan_term_years,
        amortization_years: parsedCopy.financing.amortization_years || defaults.amortization_years,
        io_years: parsedCopy.financing.io_years || defaults.io_years,
        loan_fees_percent: parsedCopy.financing.loan_fees_percent || 1.5,
        ...parsedCopy.financing
      };

      // Fire off a best-effort request for OCR-based source snippets so the
      // verify step can show exactly which lines drove the key numbers.
      if (file) {
        try {
          const srcForm = new FormData();
          srcForm.append('file', file);
          const srcResp = await fetch(`${API_BASE}/ocr/sources`, {
            method: 'POST',
            body: srcForm,
          });
          if (srcResp.ok) {
            const srcJson = await srcResp.json();
            setSourceSnippets(srcJson.sources || {});
          }
        } catch (err) {
          console.warn('[V2] /ocr/sources call failed', err);
        }
      }
      
      // Initialize proforma with current parsed values as defaults
      const rentProjections = (parsedCopy.unit_mix || []).map(unit => ({
        type: unit.type || '',
        units: unit.units || 0,
        proforma_rent: unit.rent_market || unit.rent_current || 0
      }));
      
      parsedCopy.proforma = {
        // Pricing
        purchase_price: parsedCopy.pricing_financing?.price || 0,
        // Expenses from parsed data
        insurance: parsedCopy.expenses?.insurance || 0,
        taxes: parsedCopy.expenses?.taxes || 0,
        annual_debt_service: 0, // Will be calculated
        property_management_pct: parsedCopy.expenses?.management ? 
          ((parsedCopy.expenses.management / (parsedCopy.pnl?.gross_potential_rent || 1)) * 100) : 0,
        vacancy_pct: parsedCopy.pnl?.vacancy_rate ? (parsedCopy.pnl.vacancy_rate * 100) : 5,
        capex_pct: 0,
        payroll: parsedCopy.expenses?.payroll || 0,
        // Utilities (monthly) - divide annual by 12 if available
        gas_monthly: parsedCopy.expenses?.gas ? (parsedCopy.expenses.gas / 12) : 0,
        electrical_monthly: parsedCopy.expenses?.electric ? (parsedCopy.expenses.electric / 12) : 0,
        water_monthly: parsedCopy.expenses?.water ? (parsedCopy.expenses.water / 12) : 0,
        sewer_monthly: parsedCopy.expenses?.sewer ? (parsedCopy.expenses.sewer / 12) : 0,
        trash_monthly: parsedCopy.expenses?.trash ? (parsedCopy.expenses.trash / 12) : 0,
        total_utilities: parsedCopy.expenses?.utilities || 0,
        // Rent projections from unit mix
        rent_projections: rentProjections.length > 0 ? rentProjections : [{ type: '', units: '', proforma_rent: '' }]
      };
      
      setVerifiedData(parsedCopy);

      // Flag ANY important fields that did NOT auto-populate so they show red immediately
      const initialErrors = {};

      // Property tab
      if (!parsedCopy?.property?.address) initialErrors['property.address'] = true;
      if (!parsedCopy?.property?.city) initialErrors['property.city'] = true;
      if (!parsedCopy?.property?.state) initialErrors['property.state'] = true;
      if (!parsedCopy?.property?.zip) initialErrors['property.zip'] = true;
      if (!parsedCopy?.property?.units) initialErrors['property.units'] = true;
      if (!parsedCopy?.property?.year_built) initialErrors['property.year_built'] = true;
      if (!parsedCopy?.property?.rba_sqft) initialErrors['property.rba_sqft'] = true;
      if (!parsedCopy?.property?.property_type) initialErrors['property.property_type'] = true;

      // Financials tab (T12)
      if (!parsedCopy?.pricing_financing?.price) initialErrors['pricing_financing.price'] = true;
      if (!parsedCopy?.pnl?.gross_potential_rent) initialErrors['pnl.gross_potential_rent'] = true;
      if (parsedCopy?.pnl?.other_income == null || parsedCopy.pnl.other_income === 0)
        initialErrors['pnl.other_income'] = true;
      if (!parsedCopy?.pnl?.vacancy_rate) initialErrors['pnl.vacancy_rate'] = true;
      if (!parsedCopy?.pnl?.operating_expenses) initialErrors['pnl.operating_expenses'] = true;
      if (!parsedCopy?.pnl?.noi) initialErrors['pnl.noi'] = true;

      // Expenses tab
      if (!parsedCopy?.expenses?.taxes) initialErrors['expenses.taxes'] = true;
      if (!parsedCopy?.expenses?.insurance) initialErrors['expenses.insurance'] = true;
      if (!parsedCopy?.expenses?.utilities) initialErrors['expenses.utilities'] = true;
      if (!parsedCopy?.expenses?.repairs_maintenance) initialErrors['expenses.repairs_maintenance'] = true;
      if (!parsedCopy?.expenses?.management) initialErrors['expenses.management'] = true;
      if (!parsedCopy?.expenses?.payroll) initialErrors['expenses.payroll'] = true;
      if (!parsedCopy?.expenses?.marketing) initialErrors['expenses.marketing'] = true;

      // Proforma tab (all optional but highlight if parser could not auto-fill at all)
      if (!parsedCopy?.proforma?.purchase_price) initialErrors['proforma.purchase_price'] = true;
      if (!parsedCopy?.proforma?.insurance) initialErrors['proforma.insurance'] = true;
      if (!parsedCopy?.proforma?.taxes) initialErrors['proforma.taxes'] = true;
      if (!parsedCopy?.proforma?.annual_debt_service) initialErrors['proforma.annual_debt_service'] = true;
      if (!parsedCopy?.proforma?.property_management_pct) initialErrors['proforma.property_management_pct'] = true;
      if (!parsedCopy?.proforma?.vacancy_pct) initialErrors['proforma.vacancy_pct'] = true;
      if (!parsedCopy?.proforma?.capex_pct) initialErrors['proforma.capex_pct'] = true;
      if (!parsedCopy?.proforma?.payroll) initialErrors['proforma.payroll'] = true;

      if (Object.keys(initialErrors).length > 0) {
        setValidationErrors(initialErrors);
      }
      
      // Decide next step: verify wizard or auto-run AI results
      if (autoRunAIAfterUpload) {
        try {
          const transformedData = JSON.parse(JSON.stringify(parsedCopy));
          if (transformedData.pricing_financing) {
            transformedData.pricing_financing.purchase_price = transformedData.pricing_financing.price || transformedData.pricing_financing.purchase_price;
            transformedData.pricing_financing.down_payment_pct = transformedData.pricing_financing.down_payment_pct || 40;
          }
          if (!transformedData.financing) {
            transformedData.financing = {};
          }
          transformedData.financing.ltv = transformedData.financing.ltv || 75;
          transformedData.financing.interest_rate = transformedData.financing.interest_rate || 6.0;
          transformedData.financing.loan_term_years = transformedData.financing.loan_term_years || 10;
          transformedData.financing.amortization_years = transformedData.financing.amortization_years || 30;
          transformedData.financing.io_years = transformedData.financing.io_years || 0;
          transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || 1.5;
          if (transformedData.pnl) {
            transformedData.pnl.potential_gross_income = transformedData.pnl.gross_potential_rent || transformedData.pnl.potential_gross_income || 0;
            transformedData.pnl.vacancy_rate = (transformedData.pnl.vacancy_rate || 0.05) * 100;
          }
          setScenarioData(transformedData);
          setModifiedFields({});
          setStep('results');
        } catch (e) {
          console.warn('[V2] Failed to auto-prepare scenario for AI run, falling back to wizard', e);
          setStep('verify');
        } finally {
          setAutoRunAIAfterUpload(false);
        }
      } else {
        // Move to wizard step
        setStep('verify');
      }

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

  // Get confidence level for a field from parsed data
  const getFieldConfidence = (section, field) => {
    const confidence = verifiedData?._confidence;
    if (!confidence) return null;
    
    const fieldPath = `${section}.${field}`;
    return confidence[fieldPath] || null;
  };

  // Get input style based on confidence level
  const getConfidenceInputStyle = (section, field, baseStyle = {}) => {
    const confidence = getFieldConfidence(section, field);
    const value = verifiedData?.[section]?.[field];
    
    // Default border
    let borderColor = '#d1d5db';
    let backgroundColor = '#fff';
    let boxShadow = 'none';
    
    if (confidence) {
      switch (confidence.level) {
        case 'missing':
          // Red - data not found, user must fill
          borderColor = '#ef4444';
          backgroundColor = '#fef2f2';
          boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
          break;
        case 'low':
          // Orange - estimated/inferred
          borderColor = '#f97316';
          backgroundColor = '#fff7ed';
          boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.2)';
          break;
        case 'medium':
          // Yellow - ambiguous, has alternatives
          borderColor = '#eab308';
          backgroundColor = '#fefce8';
          boxShadow = '0 0 0 2px rgba(234, 179, 8, 0.2)';
          break;
        case 'high':
          // Green subtle - confident
          borderColor = '#22c55e';
          backgroundColor = '#f0fdf4';
          break;
        default:
          break;
      }
    } else if (!value && value !== 0) {
      // No confidence data but field is empty - flag as needing attention
      borderColor = '#ef4444';
      backgroundColor = '#fef2f2';
    }
    
    return {
      ...baseStyle,
      border: `1px solid ${borderColor}`,
      backgroundColor,
      boxShadow,
      transition: 'all 0.2s ease'
    };
  };

  // Get confidence indicator (icon/badge) for a field
  const getConfidenceIndicator = (section, field) => {
    const confidence = getFieldConfidence(section, field);
    if (!confidence) return null;
    
    const indicators = {
      missing: { icon: '⚠️', color: '#ef4444', label: 'Not found in document' },
      low: { icon: '🔶', color: '#f97316', label: 'Estimated value' },
      medium: { icon: '⚡', color: '#eab308', label: 'Multiple values found - verify' },
      high: { icon: '✓', color: '#22c55e', label: 'Confident' }
    };
    
    const ind = indicators[confidence.level];
    if (!ind) return null;
    
    return {
      ...ind,
      note: confidence.note,
      source: confidence.source,
      alternatives: confidence.alternatives
    };
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

  const getValueAtPath = (obj, path) => {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  };

  // Complete wizard → move to chat
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
    }
    
    // Ensure financing object exists with defaults
    if (!transformedData.financing) {
      transformedData.financing = {};
    }
    transformedData.financing.ltv = transformedData.financing.ltv || 75;
    transformedData.financing.interest_rate = transformedData.financing.interest_rate || 6.0;
    transformedData.financing.loan_term_years = transformedData.financing.loan_term_years || 10;
    transformedData.financing.amortization_years = transformedData.financing.amortization_years || 30;
    transformedData.financing.io_years = transformedData.financing.io_years || 0;
    transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || 1.5;
    
    // ============================================
    // CALCULATE DEBT SERVICE BASED ON DEBT STRUCTURE
    // ============================================
    const purchasePrice = transformedData.pricing_financing?.price || 0;
    const structure = transformedData.deal_setup?.debt_structure || debtStructure || 'traditional';
    const fin = transformedData.financing;
    
    // Helper function to calculate monthly payment
    const calcMonthlyPayment = (principal, annualRate, amortMonths) => {
      if (principal <= 0 || amortMonths <= 0) return 0;
      const r = annualRate / 100 / 12;
      if (r === 0) return principal / amortMonths;
      return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
    };
    
    let totalMonthlyDebt = 0;
    let totalAnnualDebt = 0;
    let primaryLoanAmount = 0;
    let downPaymentAmount = 0;
    
    if (structure === 'traditional' || structure === 'seller-finance') {
      // Traditional/Seller Finance: LTV-based loan
      primaryLoanAmount = purchasePrice * (fin.ltv || 75) / 100;
      downPaymentAmount = purchasePrice - primaryLoanAmount;
      const monthlyPayment = calcMonthlyPayment(primaryLoanAmount, fin.interest_rate || 6.0, (fin.amortization_years || 30) * 12);
      totalMonthlyDebt = monthlyPayment;
      totalAnnualDebt = monthlyPayment * 12;
      
    } else if (structure === 'subject-to') {
      // Subject To: Use seller's existing payment
      totalMonthlyDebt = fin.monthly_payment || 0;
      totalAnnualDebt = totalMonthlyDebt * 12;
      primaryLoanAmount = fin.current_loan_balance || 0;
      downPaymentAmount = fin.cash_to_seller || 0;
      
    } else if (structure === 'hybrid') {
      // Hybrid: Subject To + New Loan
      const subtoMonthly = fin.subto_monthly_payment || 0;
      const newLoanAmount = fin.new_loan_amount || 0;
      const newLoanMonthly = calcMonthlyPayment(newLoanAmount, fin.interest_rate || 6.0, (fin.amortization_years || 30) * 12);
      totalMonthlyDebt = subtoMonthly + newLoanMonthly;
      totalAnnualDebt = totalMonthlyDebt * 12;
      primaryLoanAmount = (fin.subto_loan_balance || 0) + newLoanAmount;
      downPaymentAmount = purchasePrice - primaryLoanAmount;
      
    } else if (structure === 'equity-partner') {
      // Equity Partner: Traditional loan + partner pref return
      primaryLoanAmount = purchasePrice * (fin.ltv || 75) / 100;
      downPaymentAmount = purchasePrice - primaryLoanAmount;
      const partnerContribution = downPaymentAmount * (fin.partner_down_payment_pct || 100) / 100;
      const partnerPrefAnnual = partnerContribution * (fin.partner_pref_return || 8) / 100;
      const loanMonthly = calcMonthlyPayment(primaryLoanAmount, fin.interest_rate || 6.5, (fin.amortization_years || 30) * 12);
      totalMonthlyDebt = loanMonthly + (partnerPrefAnnual / 12); // Include partner pref as debt obligation
      totalAnnualDebt = (loanMonthly * 12) + partnerPrefAnnual;
      // Store partner details for results page
      transformedData.financing.partner_contribution = partnerContribution;
      transformedData.financing.partner_pref_annual = partnerPrefAnnual;
      transformedData.financing.your_cash_in = downPaymentAmount * (fin.your_equity_pct || 5) / 100;
      
    } else if (structure === 'seller-carry') {
      // Seller Carry: Primary Loan + Seller Note
      primaryLoanAmount = purchasePrice * (fin.ltv || 75) / 100;
      const sellerCarryAmount = purchasePrice * (fin.seller_carry_pct || 15) / 100;
      const yourCashDown = purchasePrice - primaryLoanAmount - sellerCarryAmount;
      downPaymentAmount = yourCashDown;
      
      const loanMonthly = calcMonthlyPayment(primaryLoanAmount, fin.interest_rate || 6.5, (fin.amortization_years || 30) * 12);
      
      // Seller carry payment
      let sellerCarryMonthly = 0;
      if (fin.seller_carry_io) {
        // Interest only
        sellerCarryMonthly = sellerCarryAmount * (fin.seller_carry_rate || 5) / 100 / 12;
      } else {
        sellerCarryMonthly = calcMonthlyPayment(sellerCarryAmount, fin.seller_carry_rate || 5, fin.seller_carry_term_months || 60);
      }
      
      totalMonthlyDebt = loanMonthly + sellerCarryMonthly;
      totalAnnualDebt = totalMonthlyDebt * 12;
      
      // Store seller carry details for results page
      transformedData.financing.seller_carry_amount = sellerCarryAmount;
      transformedData.financing.seller_carry_monthly = sellerCarryMonthly;
      transformedData.financing.primary_loan_monthly = loanMonthly;
      transformedData.financing.your_cash_down = yourCashDown;
    }
    
    // Update pricing_financing with calculated values for the calculation engine
    if (!transformedData.pricing_financing) {
      transformedData.pricing_financing = {};
    }
    transformedData.pricing_financing.loan_amount = primaryLoanAmount;
    transformedData.pricing_financing.monthly_payment = totalMonthlyDebt;
    transformedData.pricing_financing.annual_debt_service = totalAnnualDebt;
    transformedData.pricing_financing.down_payment = downPaymentAmount;
    transformedData.pricing_financing.interest_rate = (fin.interest_rate || 6.0) / 100; // Convert to decimal
    transformedData.pricing_financing.term_years = fin.loan_term_years || 10;
    transformedData.pricing_financing.amortization_years = fin.amortization_years || 30;
    
    // Store debt structure info
    transformedData.financing.debt_structure = structure;
    transformedData.financing.total_monthly_debt = totalMonthlyDebt;
    transformedData.financing.total_annual_debt = totalAnnualDebt;
    
    console.log('[DEBT CALCULATION]', {
      structure,
      purchasePrice,
      primaryLoanAmount,
      downPaymentAmount,
      totalMonthlyDebt,
      totalAnnualDebt
    });
    // ============================================
    
    // Ensure required fields for calculations
    if (transformedData.pnl) {
      transformedData.pnl.potential_gross_income = transformedData.pnl.gross_potential_rent || transformedData.pnl.potential_gross_income || 0;
      // Keep vacancy_rate as a DECIMAL fraction (e.g. 0.05 for 5%). The
      // parser normalization step has already converted whole-number
      // percentages to decimals, so here we only guard against missing/edge
      // values instead of scaling again (which previously produced 500%+
      // vacancy in projections).
      const rawVacancy = transformedData.pnl.vacancy_rate;
      if (typeof rawVacancy === 'number') {
        transformedData.pnl.vacancy_rate = rawVacancy > 1 ? rawVacancy / 100 : rawVacancy;
      } else {
        transformedData.pnl.vacancy_rate = 0.05;
      }
    }
    
    console.log('[WIZARD COMPLETE] Original Data:', verifiedData);
    console.log('[WIZARD COMPLETE] Transformed Data:', transformedData);
    
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
    
    // Store buy box params for the AI analysis page to use
    const dealParams = {
      underwriting_mode: verifiedData?.deal_setup?.underwriting_mode || 'hardcoded',
      buy_box: verifiedData?.deal_setup?.buy_box || null,
      property_type: verifiedData?.deal_setup?.property_type || 'multifamily',
      transaction_type: verifiedData?.deal_setup?.transaction_type || 'acquisition',
      debt_structure: verifiedData?.deal_setup?.debt_structure || 'traditional'
    };
    localStorage.setItem('dealParams', JSON.stringify(dealParams));

    // Build a full underwriting scenario from the wizard data using the
    // same transformation logic as the Results page, so the JS
    // calculation engine and the AI underwriter see the exact same
    // structure and numbers.
    const scenarioForAI = JSON.parse(JSON.stringify(verifiedData));

    if (scenarioForAI.pricing_financing) {
      scenarioForAI.pricing_financing.purchase_price = scenarioForAI.pricing_financing.price || scenarioForAI.pricing_financing.purchase_price;
      scenarioForAI.pricing_financing.down_payment_pct = scenarioForAI.pricing_financing.down_payment_pct || (scenarioForAI.pricing_financing.down_payment && scenarioForAI.pricing_financing.price ? (scenarioForAI.pricing_financing.down_payment / scenarioForAI.pricing_financing.price) * 100 : 40);
    }

    if (!scenarioForAI.financing) {
      scenarioForAI.financing = {};
    }
    scenarioForAI.financing.ltv = scenarioForAI.financing.ltv || 75;
    scenarioForAI.financing.interest_rate = scenarioForAI.financing.interest_rate || 6.0;
    scenarioForAI.financing.loan_term_years = scenarioForAI.financing.loan_term_years || 10;
    scenarioForAI.financing.amortization_years = scenarioForAI.financing.amortization_years || 30;
    scenarioForAI.financing.io_years = scenarioForAI.financing.io_years || 0;
    scenarioForAI.financing.loan_fees_percent = scenarioForAI.financing.loan_fees_percent || 1.5;

    const purchasePriceAI = scenarioForAI.pricing_financing?.price || 0;
    const structureAI = scenarioForAI.deal_setup?.debt_structure || dealParams.debt_structure || 'traditional';
    const finAI = scenarioForAI.financing;

    const calcMonthlyPaymentAI = (principal, annualRate, amortMonths) => {
      if (principal <= 0 || amortMonths <= 0) return 0;
      const r = annualRate / 100 / 12;
      if (r === 0) return principal / amortMonths;
      return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
    };

    let totalMonthlyDebtAI = 0;
    let totalAnnualDebtAI = 0;
    let primaryLoanAmountAI = 0;
    let downPaymentAmountAI = 0;

    if (structureAI === 'traditional' || structureAI === 'seller-finance') {
      primaryLoanAmountAI = purchasePriceAI * (finAI.ltv || 75) / 100;
      downPaymentAmountAI = purchasePriceAI - primaryLoanAmountAI;
      const monthlyPaymentAI = calcMonthlyPaymentAI(primaryLoanAmountAI, finAI.interest_rate || 6.0, (finAI.amortization_years || 30) * 12);
      totalMonthlyDebtAI = monthlyPaymentAI;
      totalAnnualDebtAI = monthlyPaymentAI * 12;
    } else if (structureAI === 'subject-to') {
      totalMonthlyDebtAI = finAI.monthly_payment || 0;
      totalAnnualDebtAI = totalMonthlyDebtAI * 12;
      primaryLoanAmountAI = finAI.current_loan_balance || 0;
      downPaymentAmountAI = finAI.cash_to_seller || 0;
    } else if (structureAI === 'hybrid') {
      const subtoMonthlyAI = finAI.subto_monthly_payment || 0;
      const newLoanAmountAI = finAI.new_loan_amount || 0;
      const newLoanMonthlyAI = calcMonthlyPaymentAI(newLoanAmountAI, finAI.interest_rate || 6.0, (finAI.amortization_years || 30) * 12);
      totalMonthlyDebtAI = subtoMonthlyAI + newLoanMonthlyAI;
      totalAnnualDebtAI = totalMonthlyDebtAI * 12;
      primaryLoanAmountAI = (finAI.subto_loan_balance || 0) + newLoanAmountAI;
      downPaymentAmountAI = purchasePriceAI - primaryLoanAmountAI;
    } else if (structureAI === 'equity-partner') {
      primaryLoanAmountAI = purchasePriceAI * (finAI.ltv || 75) / 100;
      downPaymentAmountAI = purchasePriceAI - primaryLoanAmountAI;
      const partnerContributionAI = downPaymentAmountAI * (finAI.partner_down_payment_pct || 100) / 100;
      const partnerPrefAnnualAI = partnerContributionAI * (finAI.partner_pref_return || 8) / 100;
      const loanMonthlyAI = calcMonthlyPaymentAI(primaryLoanAmountAI, finAI.interest_rate || 6.5, (finAI.amortization_years || 30) * 12);
      totalMonthlyDebtAI = loanMonthlyAI + (partnerPrefAnnualAI / 12);
      totalAnnualDebtAI = (loanMonthlyAI * 12) + partnerPrefAnnualAI;
      scenarioForAI.financing.partner_contribution = partnerContributionAI;
      scenarioForAI.financing.partner_pref_annual = partnerPrefAnnualAI;
      scenarioForAI.financing.your_cash_in = downPaymentAmountAI * (finAI.your_equity_pct || 5) / 100;
    } else if (structureAI === 'seller-carry') {
      primaryLoanAmountAI = purchasePriceAI * (finAI.ltv || 75) / 100;
      const sellerCarryAmountAI = purchasePriceAI * (finAI.seller_carry_pct || 15) / 100;
      const yourCashDownAI = purchasePriceAI - primaryLoanAmountAI - sellerCarryAmountAI;
      downPaymentAmountAI = yourCashDownAI;

      const loanMonthlyAI = calcMonthlyPaymentAI(primaryLoanAmountAI, finAI.interest_rate || 6.5, (finAI.amortization_years || 30) * 12);

      let sellerCarryMonthlyAI = 0;
      if (finAI.seller_carry_io) {
        sellerCarryMonthlyAI = sellerCarryAmountAI * (finAI.seller_carry_rate || 5) / 100 / 12;
      } else {
        sellerCarryMonthlyAI = calcMonthlyPaymentAI(sellerCarryAmountAI, finAI.seller_carry_rate || 5, finAI.seller_carry_term_months || 60);
      }

      totalMonthlyDebtAI = loanMonthlyAI + sellerCarryMonthlyAI;
      totalAnnualDebtAI = totalMonthlyDebtAI * 12;

      scenarioForAI.financing.seller_carry_amount = sellerCarryAmountAI;
      scenarioForAI.financing.seller_carry_monthly = sellerCarryMonthlyAI;
      scenarioForAI.financing.primary_loan_monthly = loanMonthlyAI;
      scenarioForAI.financing.your_cash_down = yourCashDownAI;
    }

    if (!scenarioForAI.pricing_financing) {
      scenarioForAI.pricing_financing = {};
    }
    scenarioForAI.pricing_financing.loan_amount = primaryLoanAmountAI;
    scenarioForAI.pricing_financing.monthly_payment = totalMonthlyDebtAI;
    scenarioForAI.pricing_financing.annual_debt_service = totalAnnualDebtAI;
    scenarioForAI.pricing_financing.down_payment = downPaymentAmountAI;
    scenarioForAI.pricing_financing.interest_rate = (finAI.interest_rate || 6.0) / 100;
    scenarioForAI.pricing_financing.term_years = finAI.loan_term_years || 10;
    scenarioForAI.pricing_financing.amortization_years = finAI.amortization_years || 30;

    scenarioForAI.financing.debt_structure = structureAI;
    scenarioForAI.financing.total_monthly_debt = totalMonthlyDebtAI;
    scenarioForAI.financing.total_annual_debt = totalAnnualDebtAI;

    if (scenarioForAI.pnl) {
      scenarioForAI.pnl.potential_gross_income = scenarioForAI.pnl.gross_potential_rent || scenarioForAI.pnl.potential_gross_income || 0;
      const rawVacancyAI = scenarioForAI.pnl.vacancy_rate;
      if (typeof rawVacancyAI === 'number') {
        scenarioForAI.pnl.vacancy_rate = rawVacancyAI > 1 ? rawVacancyAI / 100 : rawVacancyAI;
      } else {
        scenarioForAI.pnl.vacancy_rate = 0.05;
      }
    }

    // Run the exact same full analysis used by the Results page so the AI
    // sees the identical calc_json that powers Deal / No Deal.
    const { calculateFullAnalysis } = require('../utils/realEstateCalculations');
    const fullAnalysisForAI = calculateFullAnalysis(scenarioForAI);

    // Build wizard structure snapshot for the AI prompt.
    const wizardStructure = {
      strategy: scenarioForAI.deal_setup?.debt_structure || dealParams.debt_structure || 'traditional',
      deal_setup: scenarioForAI.deal_setup || {},
      financing: scenarioForAI.financing || {}
    };

    // Best-effort: push the latest wizard-edited data to the backend as the
    // current scenario JSON so the AI analysis prompt uses THESE numbers,
    // not just the original parsed OM snapshot.
    if (dealId && verifiedData) {
      try {
        fetch(`${API_BASE}/v2/deals/${dealId}/scenario`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: scenarioForAI })
        }).catch(err => {
          console.warn('[V2] Failed to update scenario before AI analysis', err);
        });
      } catch (err) {
        console.warn('[V2] Error scheduling scenario update', err);
      }
    }

    // Navigate to the AI analysis page with deal data
    navigate('/underwrite/analysis', {
      state: {
        dealId,
        verifiedData: scenarioForAI,
        scenarioData: scenarioForAI,
        fullCalcs: fullAnalysisForAI,
        wizardStructure
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
    { id: 'proforma', label: 'Proforma', icon: Calculator },
    { id: 'unitMix', label: 'Unit Mix', icon: Home },
    { id: 'additional', label: 'Additional Data', icon: FileText }
  ];

  // ============ RENDER ============

  // STEP 1: Upload (Deal Manager Style)
  if (step === 'upload') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.container, maxWidth: 800 }}>
          <div style={styles.header}>
            <h1 style={styles.title}>Deal Sniper</h1>
            <button 
              style={styles.homeButton}
              onClick={() => navigate('/dashboard')}
            >
              <Home size={18} />
              Home
            </button>
          </div>

          <div style={styles.card}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  New Deal Analysis
                </h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Automated Underwriting</p>
              </div>
            </div>

            {/* Deal Name */}
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Enter Deal Name or Pick From AI Chat"
                style={{
                  ...styles.input,
                  fontSize: 16,
                  fontWeight: 600,
                  padding: '14px 16px'
                }}
              />
            </div>

            {/* Property Type & Transaction Type Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 6, display: 'block' }}>Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  style={{ ...styles.input, cursor: 'pointer' }}
                >
                  <option value="multifamily">Multifamily</option>
                  <option value="office">Office</option>
                  <option value="retail">Retail</option>
                  <option value="industrial">Industrial</option>
                  <option value="mixed-use">Mixed Use</option>
                  <option value="self-storage">Self Storage</option>
                  <option value="mobile-home">Mobile Home Park</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 6, display: 'block' }}>Transaction Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  style={{ ...styles.input, cursor: 'pointer', borderColor: '#f59e0b' }}
                >
                  <option value="acquisition">Acquisition</option>
                  <option value="refinance">Refinance</option>
                  <option value="development">Development</option>
                  <option value="value-add">Value-Add</option>
                </select>
              </div>
            </div>

            {/* Debt Structure */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 6, display: 'block' }}>Debt Structure</label>
              <select
                value={debtStructure}
                onChange={(e) => setDebtStructure(e.target.value)}
                style={{ ...styles.input, cursor: 'pointer' }}
              >
                <option value="traditional">Traditional (Freddie/Fannie, Bank Loan)</option>
                <option value="seller-finance">Seller Finance</option>
                <option value="subject-to">Subject To</option>
                <option value="hybrid">Hybrid (Subject To + Traditional/Seller Finance)</option>
                <option value="equity-partner">Equity Partner</option>
                <option value="seller-carry">Seller Carry</option>
                <option value="lease-option">Lease Option</option>
              </select>
            </div>

            {/* Subject-To availability toggle */}
            <div style={{
              marginBottom: 24,
              padding: 12,
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                  Is "Subject To" actually available on this deal?
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  If not, AI will ignore Subject To / Hybrid structures and choose the next best option.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{subjectToAvailable ? 'Yes' : 'No'}</span>
                <div
                  onClick={() => setSubjectToAvailable(!subjectToAvailable)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 999,
                    backgroundColor: subjectToAvailable ? '#22c55e' : '#d1d5db',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: subjectToAvailable ? 'flex-end' : 'flex-start',
                    transition: 'all 0.15s ease-in-out'
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '999px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.3)'
                    }}
                  />
                </div>
              </label>
            </div>

            {/* Underwriting Mode Toggle */}
            <div style={{ 
              padding: 20, 
              background: '#f9fafb', 
              borderRadius: 12, 
              marginBottom: 24,
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Underwriting Mode
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Choose analysis criteria for AI evaluation
                  </div>
                </div>
                <div style={{ display: 'flex', background: '#e5e7eb', borderRadius: 8, padding: 3 }}>
                  <button
                    onClick={() => setUnderwritingMode('hardcoded')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: underwritingMode === 'hardcoded' ? '#fff' : 'transparent',
                      color: underwritingMode === 'hardcoded' ? '#111827' : '#6b7280',
                      boxShadow: underwritingMode === 'hardcoded' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setUnderwritingMode('buybox')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: underwritingMode === 'buybox' ? '#fff' : 'transparent',
                      color: underwritingMode === 'buybox' ? '#111827' : '#6b7280',
                      boxShadow: underwritingMode === 'buybox' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    My Buy Box
                  </button>
                </div>
              </div>

              {/* Buy Box Parameters (shown when buybox mode selected) */}
              {underwritingMode === 'buybox' && (
                <div style={{ 
                  background: '#fff', 
                  borderRadius: 8, 
                  padding: 16,
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                    📋 Your Buy Box Criteria
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Min Units</label>
                      <input
                        type="number"
                        value={buyBoxParams.minUnits}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, minUnits: parseInt(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Max Units</label>
                      <input
                        type="number"
                        value={buyBoxParams.maxUnits}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, maxUnits: parseInt(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Min Cap Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={buyBoxParams.minCapRate}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, minCapRate: parseFloat(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Max Cap Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={buyBoxParams.maxCapRate}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, maxCapRate: parseFloat(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Min DSCR</label>
                      <input
                        type="number"
                        step="0.01"
                        value={buyBoxParams.minDSCR}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, minDSCR: parseFloat(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Min Cash-on-Cash (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={buyBoxParams.minCashOnCash}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, minCashOnCash: parseFloat(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Max $/Unit</label>
                      <input
                        type="number"
                        value={buyBoxParams.maxPricePerUnit}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, maxPricePerUnit: parseInt(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Max Vacancy (%)</label>
                      <input
                        type="number"
                        value={buyBoxParams.maxVacancy}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, maxVacancy: parseInt(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Min Year Built</label>
                      <input
                        type="number"
                        value={buyBoxParams.minYearBuilt}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, minYearBuilt: parseInt(e.target.value)})}
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Target Markets</label>
                      <input
                        type="text"
                        value={buyBoxParams.targetMarkets.join(', ')}
                        onChange={(e) => setBuyBoxParams({...buyBoxParams, targetMarkets: e.target.value.split(',').map(s => s.trim())})}
                        placeholder="TX, FL, AZ..."
                        style={{ ...styles.input, padding: '8px 12px', fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Run AI Underwriting - navigate to MAX AI page */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => navigate('/underwrite/max')}
                disabled={isUploading}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: isUploading ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: isUploading ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)'
                }}
              >
                <CheckCircle size={18} />
                🤖 Run AI Underwriting
              </button>
            </div>

            {/* File Upload Zone */}
            <div
              style={{
                ...styles.uploadZone,
                ...(file ? styles.uploadZoneActive : {}),
                padding: 40
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload style={{ width: 48, height: 48, color: '#9ca3af', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {file ? file.name : 'Drop files or click to browse'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                PDF files only • Offering Memorandums, Rent Rolls, T12s
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {/* Error Message */}
            {uploadError && (
              <div style={{ marginTop: 20, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertCircle size={20} color="#b91c1c" />
                <span style={{ color: '#991b1b', fontSize: 14 }}>{uploadError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              style={{
                ...styles.button,
                width: '100%',
                marginTop: 24,
                padding: '16px 24px',
                fontSize: 16,
                justifyContent: 'center',
                background: file ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#9ca3af',
                cursor: file ? 'pointer' : 'not-allowed',
                ...(isUploading ? { opacity: 0.7 } : {})
              }}
              onClick={handleUpload}
              disabled={!file || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader size={20} className="spin" />
                  Parsing with Claude AI...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Create Deal
                </>
              )}
            </button>

            {/* OR divider + Manual Entry button */}
            <div style={{ margin: '32px 0', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: '#e5e7eb' }} />
              <span style={{ position: 'relative', background: '#fff', padding: '0 16px', color: '#6b7280', fontSize: 14, fontWeight: 600 }}>OR</span>
            </div>
            <button
              onClick={() => navigate('/manual-entry')}
              style={{ 
                ...styles.button, 
                width: '100%',
                padding: '16px 24px',
                fontSize: 16,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' 
              }}
            >
              <FileText size={20} /> Enter Manually
            </button>
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
    const sourcedFields = Object.entries(sourceSnippets || {}).map(([path, meta]) => ({
      path,
      page: meta?.page,
      text: meta?.text,
    }));

    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button onClick={() => navigate('/dashboard')} style={styles.homeButton}>
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

          {/* Confidence Legend */}
          {verifiedData?._confidence && (
            <div style={{ 
              marginBottom: 20, 
              padding: '12px 16px', 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Field Confidence:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#fef2f2', border: '2px solid #ef4444' }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Not found</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#fefce8', border: '2px solid #eab308' }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Multiple values - verify</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f0fdf4', border: '2px solid #22c55e' }} />
                <span style={{ fontSize: 12, color: '#64748b' }}>Confident</span>
              </div>
              {verifiedData?.data_quality?.critical_missing?.length > 0 && (
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: 12, 
                  color: '#dc2626', 
                  fontWeight: 600,
                  background: '#fef2f2',
                  padding: '4px 10px',
                  borderRadius: 20
                }}>
                  ⚠️ {verifiedData.data_quality.critical_missing.length} fields need attention
                </span>
              )}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Property Information</h3>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Address
                      {getConfidenceIndicator('property', 'address')?.icon && (
                        <span title={getConfidenceIndicator('property', 'address')?.note || getConfidenceIndicator('property', 'address')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'address')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={verifiedData?.property?.address || ''}
                      onChange={(e) => updateVerifiedField('property', 'address', e.target.value)}
                      style={getConfidenceInputStyle('property', 'address', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      City
                      {getConfidenceIndicator('property', 'city')?.icon && (
                        <span title={getConfidenceIndicator('property', 'city')?.note || getConfidenceIndicator('property', 'city')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'city')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={verifiedData?.property?.city || ''}
                      onChange={(e) => updateVerifiedField('property', 'city', e.target.value)}
                      style={getConfidenceInputStyle('property', 'city', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      State
                      {getConfidenceIndicator('property', 'state')?.icon && (
                        <span title={getConfidenceIndicator('property', 'state')?.note || getConfidenceIndicator('property', 'state')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'state')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={verifiedData?.property?.state || ''}
                      onChange={(e) => updateVerifiedField('property', 'state', e.target.value)}
                      style={getConfidenceInputStyle('property', 'state', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      ZIP
                      {getConfidenceIndicator('property', 'zip')?.icon && (
                        <span title={getConfidenceIndicator('property', 'zip')?.note || getConfidenceIndicator('property', 'zip')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'zip')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={verifiedData?.property?.zip || ''}
                      onChange={(e) => updateVerifiedField('property', 'zip', e.target.value)}
                      style={getConfidenceInputStyle('property', 'zip', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Total Units
                      {getConfidenceIndicator('property', 'units')?.icon && (
                        <span title={getConfidenceIndicator('property', 'units')?.note || getConfidenceIndicator('property', 'units')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'units')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={verifiedData?.property?.units || ''}
                      onChange={(e) => updateVerifiedField('property', 'units', parseInt(e.target.value || 0))}
                      style={getConfidenceInputStyle('property', 'units', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Year Built
                      {getConfidenceIndicator('property', 'year_built')?.icon && (
                        <span title={getConfidenceIndicator('property', 'year_built')?.note || getConfidenceIndicator('property', 'year_built')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'year_built')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={verifiedData?.property?.year_built || ''}
                      onChange={(e) => updateVerifiedField('property', 'year_built', parseInt(e.target.value || 0))}
                      style={getConfidenceInputStyle('property', 'year_built', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      Building SF
                      {getConfidenceIndicator('property', 'rba_sqft')?.icon && (
                        <span title={getConfidenceIndicator('property', 'rba_sqft')?.note || getConfidenceIndicator('property', 'rba_sqft')?.label} style={{ marginLeft: 6 }}>
                          {getConfidenceIndicator('property', 'rba_sqft')?.icon}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={verifiedData?.property?.rba_sqft || ''}
                      onChange={(e) => updateVerifiedField('property', 'rba_sqft', parseInt(e.target.value || 0))}
                      style={getConfidenceInputStyle('property', 'rba_sqft', { width: '100%', padding: 8, borderRadius: 6 })}
                    />
                  </div>
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
                    {getConfidenceIndicator('pricing_financing', 'price')?.icon && (
                      <span title={getConfidenceIndicator('pricing_financing', 'price')?.note || getConfidenceIndicator('pricing_financing', 'price')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pricing_financing', 'price')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pricing_financing', 'price', {
                      ...styles.input,
                      ...(validationErrors['pricing_financing.price'] ? styles.inputError : {})
                    })}
                    value={verifiedData?.pricing_financing?.price || ''}
                    onChange={(e) => updateVerifiedField('pricing_financing', 'price', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                  {getConfidenceIndicator('pricing_financing', 'price')?.alternatives && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#eab308' }}>
                      Alternatives found: {getConfidenceIndicator('pricing_financing', 'price').alternatives.map(v => `$${v.toLocaleString()}`).join(', ')}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Gross Potential Rent *
                    {getConfidenceIndicator('pnl', 'gross_potential_rent')?.icon && (
                      <span title={getConfidenceIndicator('pnl', 'gross_potential_rent')?.note || getConfidenceIndicator('pnl', 'gross_potential_rent')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pnl', 'gross_potential_rent')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pnl', 'gross_potential_rent', {
                      ...styles.input,
                      ...(validationErrors['pnl.gross_potential_rent'] ? styles.inputError : {})
                    })}
                    value={verifiedData?.pnl?.gross_potential_rent || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'gross_potential_rent', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Other Income
                    {getConfidenceIndicator('pnl', 'other_income')?.icon && (
                      <span title={getConfidenceIndicator('pnl', 'other_income')?.note || getConfidenceIndicator('pnl', 'other_income')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pnl', 'other_income')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pnl', 'other_income', styles.input)}
                    value={verifiedData?.pnl?.other_income || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'other_income', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Vacancy Rate (%)
                    {getConfidenceIndicator('pnl', 'vacancy_rate')?.icon && (
                      <span title={getConfidenceIndicator('pnl', 'vacancy_rate')?.note || getConfidenceIndicator('pnl', 'vacancy_rate')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pnl', 'vacancy_rate')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pnl', 'vacancy_rate', styles.input)}
                    value={verifiedData?.pnl?.vacancy_rate ? (verifiedData.pnl.vacancy_rate * 100) : ''}
                    onChange={(e) => updateVerifiedField('pnl', 'vacancy_rate', parseFloat(e.target.value) / 100)}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Operating Expenses *
                    {getConfidenceIndicator('pnl', 'operating_expenses')?.icon && (
                      <span title={getConfidenceIndicator('pnl', 'operating_expenses')?.note || getConfidenceIndicator('pnl', 'operating_expenses')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pnl', 'operating_expenses')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pnl', 'operating_expenses', {
                      ...styles.input,
                      ...(validationErrors['pnl.operating_expenses'] ? styles.inputError : {})
                    })}
                    value={verifiedData?.pnl?.operating_expenses || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'operating_expenses', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Net Operating Income (NOI) *
                    {getConfidenceIndicator('pnl', 'noi')?.icon && (
                      <span title={getConfidenceIndicator('pnl', 'noi')?.note || getConfidenceIndicator('pnl', 'noi')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('pnl', 'noi')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('pnl', 'noi', {
                      ...styles.input,
                      ...(validationErrors['pnl.noi'] ? styles.inputError : {})
                    })}
                    value={verifiedData?.pnl?.noi || ''}
                    onChange={(e) => updateVerifiedField('pnl', 'noi', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                  {getConfidenceIndicator('pnl', 'noi')?.alternatives && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#eab308' }}>
                      Alternatives: {getConfidenceIndicator('pnl', 'noi').alternatives.map(v => `$${v.toLocaleString()}`).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Compact panel to show all NOI variants the parser found */}
              {verifiedData?.pnl && (
                (() => {
                  const pnl = verifiedData.pnl || {};
                  const variants = [
                    { key: 'noi', label: 'Default NOI (used in underwriting)' },
                    { key: 'noi_t12', label: 'T-12 NOI' },
                    { key: 'noi_t3', label: 'T-3 NOI' },
                    { key: 'noi_t1', label: 'T-1 NOI' },
                    { key: 'noi_trailing_1', label: 'Trailing 1 Month NOI' },
                    { key: 'noi_proforma', label: 'Pro Forma NOI' },
                    { key: 'noi_stabilized', label: 'Stabilized NOI' },
                  ].filter(v => typeof pnl[v.key] === 'number' && pnl[v.key] !== 0);

                  if (!variants.length) return null;

                  return (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                        NOI Versions Found in OM
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        These are all distinct NOI figures the parser detected (T-12, T-3, Pro Forma, etc.) so you can see exactly what the OM shows.
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr',
                        gap: 8,
                        fontSize: 13,
                        background: '#f9fafb',
                        borderRadius: 8,
                        padding: 8,
                        border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ fontWeight: 600, color: '#4b5563' }}>Label</div>
                        <div style={{ fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Amount</div>
                        {variants.map(v => (
                          <React.Fragment key={v.key}>
                            <div style={{ color: '#111827' }}>{v.label}</div>
                            <div style={{ color: '#111827', textAlign: 'right' }}>
                              {pnl[v.key]?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Compact panels to show cap rate and vacancy variants when present */}
              {verifiedData?.pnl && (() => {
                const pnl = verifiedData.pnl || {};

                const capVariants = [
                  { key: 'cap_rate', label: 'Default Cap Rate (used in underwriting)' },
                  { key: 'cap_rate_t12', label: 'T-12 / In-Place Cap Rate' },
                  { key: 'cap_rate_proforma', label: 'Pro Forma Cap Rate' },
                  { key: 'cap_rate_stabilized', label: 'Stabilized Cap Rate' },
                ].filter(v => typeof pnl[v.key] === 'number' && pnl[v.key] !== 0);

                const vacVariants = [
                  { key: 'vacancy_rate', label: 'Default Vacancy Rate (used in underwriting)' },
                  { key: 'vacancy_rate_t12', label: 'T-12 Vacancy Rate' },
                  { key: 'vacancy_rate_current', label: 'Current Point-in-Time Vacancy' },
                  { key: 'vacancy_rate_stabilized', label: 'Pro Forma / Stabilized Vacancy' },
                ].filter(v => typeof pnl[v.key] === 'number' && pnl[v.key] !== 0);

                if (!capVariants.length && !vacVariants.length) return null;

                const formatPct = (val) => {
                  if (typeof val !== 'number') return '';
                  const pct = val > 1 ? val : val * 100;
                  return `${pct.toFixed(1)}%`;
                };

                return (
                  <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                    {capVariants.length > 0 && (
                      <div style={{
                        fontSize: 13,
                        background: '#f9fafb',
                        borderRadius: 8,
                        padding: 8,
                        border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>Cap Rate Versions Found</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                          Multiple cap rates (T-12, Pro Forma, Stabilized) from the OM.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <div style={{ fontWeight: 600, color: '#4b5563' }}>Label</div>
                          <div style={{ fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Cap Rate</div>
                          {capVariants.map(v => (
                            <React.Fragment key={v.key}>
                              <div style={{ color: '#111827' }}>{v.label}</div>
                              <div style={{ color: '#111827', textAlign: 'right' }}>
                                {formatPct(pnl[v.key])}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {vacVariants.length > 0 && (
                      <div style={{
                        fontSize: 13,
                        background: '#f9fafb',
                        borderRadius: 8,
                        padding: 8,
                        border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>Vacancy Versions Found</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                          Different vacancy assumptions (T-12, current, stabilized) extracted from the OM.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <div style={{ fontWeight: 600, color: '#4b5563' }}>Label</div>
                          <div style={{ fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Vacancy</div>
                          {vacVariants.map(v => (
                            <React.Fragment key={v.key}>
                              <div style={{ color: '#111827' }}>{v.label}</div>
                              <div style={{ color: '#111827', textAlign: 'right' }}>
                                {formatPct(pnl[v.key])}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Generic panel listing any fields where the parser found multiple candidate values */}
              {verifiedData?._confidence && (() => {
                const entries = Object.entries(verifiedData._confidence || {}).filter(([, info]) => info && Array.isArray(info.alternatives) && info.alternatives.length > 0);
                if (!entries.length) return null;

                return (
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      Fields With Multiple Values Found in OM
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      These fields had more than one plausible value in the documents. The value shown in the wizard is the one currently selected for underwriting.
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 2fr',
                      gap: 8,
                      fontSize: 12,
                      background: '#f9fafb',
                      borderRadius: 8,
                      padding: 8,
                      border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontWeight: 600, color: '#4b5563' }}>Field</div>
                      <div style={{ fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Used in Wizard</div>
                      <div style={{ fontWeight: 600, color: '#4b5563' }}>Other Values Found</div>
                      {entries.map(([path, info]) => {
                        const currentVal = getValueAtPath(verifiedData, path);
                        const formatVal = (v) => {
                          if (v === null || v === undefined) return '—';
                          if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                          return String(v);
                        };
                        return (
                          <React.Fragment key={path}>
                            <div style={{ color: '#111827' }}>{path}</div>
                            <div style={{ color: '#111827', textAlign: 'right' }}>{formatVal(currentVal)}</div>
                            <div style={{ color: '#111827' }}>
                              {info.alternatives.map((alt, idx) => (
                                <span key={idx}>
                                  {idx > 0 ? ', ' : ''}{formatVal(alt)}
                                </span>
                              ))}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
                    {getConfidenceIndicator('expenses', 'taxes')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'taxes')?.note || getConfidenceIndicator('expenses', 'taxes')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'taxes')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'taxes', styles.input)}
                    value={verifiedData?.expenses?.taxes || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'taxes', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Insurance
                    {getConfidenceIndicator('expenses', 'insurance')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'insurance')?.note || getConfidenceIndicator('expenses', 'insurance')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'insurance')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'insurance', styles.input)}
                    value={verifiedData?.expenses?.insurance || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'insurance', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Utilities
                    {getConfidenceIndicator('expenses', 'utilities')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'utilities')?.note || getConfidenceIndicator('expenses', 'utilities')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'utilities')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'utilities', styles.input)}
                    value={verifiedData?.expenses?.utilities || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'utilities', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Repairs & Maintenance
                    {getConfidenceIndicator('expenses', 'repairs_maintenance')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'repairs_maintenance')?.note || getConfidenceIndicator('expenses', 'repairs_maintenance')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'repairs_maintenance')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'repairs_maintenance', styles.input)}
                    value={verifiedData?.expenses?.repairs_maintenance || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'repairs_maintenance', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Management & Leasing
                    {getConfidenceIndicator('expenses', 'management')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'management')?.note || getConfidenceIndicator('expenses', 'management')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'management')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'management', styles.input)}
                    value={verifiedData?.expenses?.management || ''}
                    onChange={(e) => updateVerifiedField('expenses', 'management', parseFloat(e.target.value))}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Marketing & Turnover
                    {getConfidenceIndicator('expenses', 'marketing')?.icon && (
                      <span title={getConfidenceIndicator('expenses', 'marketing')?.note || getConfidenceIndicator('expenses', 'marketing')?.label} style={{ marginLeft: 6 }}>
                        {getConfidenceIndicator('expenses', 'marketing')?.icon}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    style={getConfidenceInputStyle('expenses', 'marketing', styles.input)}
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
              
              {/* Structure Type Indicator */}
              <div style={{ 
                padding: 12, 
                background: debtStructure === 'subject-to' ? '#fef3c7' : 
                           debtStructure === 'equity-partner' ? '#dbeafe' : 
                           debtStructure === 'seller-carry' ? '#f3e8ff' :
                           debtStructure === 'hybrid' ? '#fce7f3' : '#f0fdf4',
                borderRadius: 8, 
                marginBottom: 20,
                border: `1px solid ${debtStructure === 'subject-to' ? '#fcd34d' : 
                                     debtStructure === 'equity-partner' ? '#93c5fd' : 
                                     debtStructure === 'seller-carry' ? '#c4b5fd' :
                                     debtStructure === 'hybrid' ? '#f9a8d4' : '#86efac'}`
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
                  Structure: {debtStructure === 'traditional' ? 'Traditional (Freddie/Fannie, Bank Loan)' :
                             debtStructure === 'seller-finance' ? 'Seller Finance' :
                             debtStructure === 'subject-to' ? 'Subject To' :
                             debtStructure === 'hybrid' ? 'Hybrid (Subject To + Traditional/Seller Finance)' :
                             debtStructure === 'equity-partner' ? 'Equity Partner' :
                             debtStructure === 'seller-carry' ? 'Seller Carry' : debtStructure}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {debtStructure === 'traditional' || debtStructure === 'seller-finance' ? 
                    'Standard financing with purchase price, interest rate, term, amortization, and down payment.' :
                   debtStructure === 'subject-to' ? 
                    'Taking over existing loan. Enter the seller\'s current loan details.' :
                   debtStructure === 'hybrid' ? 
                    'Combining Subject To with additional financing (new loan or seller finance).' :
                   debtStructure === 'equity-partner' ? 
                    'Partner funding down payment and/or closing costs.' :
                   debtStructure === 'seller-carry' ? 
                    'Seller carrying a portion of the purchase price as a note.' : ''}
                </div>
              </div>

              {/* TRADITIONAL & SELLER FINANCE FIELDS */}
              {(debtStructure === 'traditional' || debtStructure === 'seller-finance') && (
                <>
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
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.ltv ?? 75}
                        onChange={(e) => updateVerifiedField('financing', 'ltv', e.target.value === '' ? 0 : parseFloat(e.target.value))}
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
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.interest_rate ?? 6.0}
                        onChange={(e) => updateVerifiedField('financing', 'interest_rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
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
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.loan_term_years ?? 10}
                        onChange={(e) => updateVerifiedField('financing', 'loan_term_years', e.target.value === '' ? 0 : parseFloat(e.target.value))}
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
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.amortization_years ?? 30}
                        onChange={(e) => updateVerifiedField('financing', 'amortization_years', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="30"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 25-30 years</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Down Payment %
                      </label>
                      <input
                        type="number"
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.down_payment_pct ?? (100 - (verifiedData?.financing?.ltv ?? 75))}
                        onChange={(e) => {
                          const dp = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          updateVerifiedField('financing', 'down_payment_pct', dp);
                          updateVerifiedField('financing', 'ltv', 100 - dp);
                        }}
                        placeholder="25"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 20-30%</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Closing Costs %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.closing_costs_pct ?? 3}
                        onChange={(e) => updateVerifiedField('financing', 'closing_costs_pct', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="3"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 2-4%</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Loan Fees %
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.loan_fees_percent ?? 1.5}
                        onChange={(e) => updateVerifiedField('financing', 'loan_fees_percent', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="1.5"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Origination fees</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Interest-Only Years
                      </label>
                      <input
                        type="number"
                        min="0"
                        style={styles.input}
                        value={verifiedData?.financing?.io_years ?? 0}
                        onChange={(e) => updateVerifiedField('financing', 'io_years', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Optional: 0-3 years</span>
                    </div>
                  </div>
                </>
              )}

              {/* SUBJECT TO FIELDS */}
              {debtStructure === 'subject-to' && (
                <>
                  <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                    Enter the existing loan details you're taking over "subject to" the existing financing.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Original Loan Amount
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.original_loan_amount || ''}
                        onChange={(e) => updateVerifiedField('financing', 'original_loan_amount', parseFloat(e.target.value))}
                        placeholder="$0"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>If known - helps calculate remaining balance</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Current Loan Balance *
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.current_loan_balance || ''}
                        onChange={(e) => updateVerifiedField('financing', 'current_loan_balance', parseFloat(e.target.value))}
                        placeholder="$0"
                      />
                      <span style={{ fontSize: 12, color: '#f59e0b' }}>Required for accurate underwriting</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Interest Rate % *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        style={styles.input}
                        value={verifiedData?.financing?.interest_rate || ''}
                        onChange={(e) => updateVerifiedField('financing', 'interest_rate', parseFloat(e.target.value))}
                        placeholder="0.0"
                      />
                      <span style={{ fontSize: 12, color: '#f59e0b' }}>Required - existing loan rate</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Monthly Payment (P&I) *
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.monthly_payment || ''}
                        onChange={(e) => updateVerifiedField('financing', 'monthly_payment', parseFloat(e.target.value))}
                        placeholder="$0"
                      />
                      <span style={{ fontSize: 12, color: '#f59e0b' }}>Required - seller's current payment</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Remaining Payments (Months)
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.remaining_payments || ''}
                        onChange={(e) => updateVerifiedField('financing', 'remaining_payments', parseFloat(e.target.value))}
                        placeholder="0"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Months left on the loan</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Down Payment Amount
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.down_payment || ''}
                        onChange={(e) => updateVerifiedField('financing', 'down_payment', parseFloat(e.target.value))}
                        placeholder="$0"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Cash down payment at closing</span>
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
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Original loan amortization</span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                        Cash to Seller (Equity Pickup)
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={verifiedData?.financing?.cash_to_seller || ''}
                        onChange={(e) => updateVerifiedField('financing', 'cash_to_seller', parseFloat(e.target.value))}
                        placeholder="$0"
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Amount paid to seller above existing loan</span>
                    </div>
                  </div>
                </>
              )}

              {/* HYBRID FIELDS (Subject To + Traditional/Seller Finance) */}
              {debtStructure === 'hybrid' && (
                <>
                  <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                    Hybrid structure combines Subject To with additional financing. Fill in both sections.
                  </p>
                  
                  {/* Subject To Section */}
                  <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, marginBottom: 20, border: '1px solid #fcd34d' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>📋 Existing Loan (Subject To)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Current Loan Balance
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.subto_loan_balance || ''}
                          onChange={(e) => updateVerifiedField('financing', 'subto_loan_balance', parseFloat(e.target.value))}
                          placeholder="$0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Interest Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={styles.input}
                          value={verifiedData?.financing?.subto_interest_rate || ''}
                          onChange={(e) => updateVerifiedField('financing', 'subto_interest_rate', parseFloat(e.target.value))}
                          placeholder="0.0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Monthly Payment
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.subto_monthly_payment || ''}
                          onChange={(e) => updateVerifiedField('financing', 'subto_monthly_payment', parseFloat(e.target.value))}
                          placeholder="$0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Remaining Payments (Months)
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.subto_remaining_payments || ''}
                          onChange={(e) => updateVerifiedField('financing', 'subto_remaining_payments', parseFloat(e.target.value))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* New Loan Section */}
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12 }}>💰 Additional Financing (New Loan/Seller Finance)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          New Loan Amount
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.new_loan_amount || ''}
                          onChange={(e) => updateVerifiedField('financing', 'new_loan_amount', parseFloat(e.target.value))}
                          placeholder="$0"
                        />
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
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* EQUITY PARTNER FIELDS */}
              {debtStructure === 'equity-partner' && (
                <>
                  <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                    Equity partner funding structure. Define the split and who covers what.
                  </p>
                  
                  {/* Traditional Loan Section */}
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, marginBottom: 20, border: '1px solid #86efac' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12 }}>🏦 Primary Loan</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Interest Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={styles.input}
                          value={verifiedData?.financing?.interest_rate || 6.5}
                          onChange={(e) => updateVerifiedField('financing', 'interest_rate', parseFloat(e.target.value))}
                          placeholder="6.5"
                        />
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
                      </div>
                    </div>
                  </div>

                  {/* Equity Partner Section */}
                  <div style={{ padding: 16, background: '#dbeafe', borderRadius: 8, border: '1px solid #93c5fd' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>🤝 Equity Partner Contribution</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Partner Covers Down Payment %
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.partner_down_payment_pct || 100}
                          onChange={(e) => updateVerifiedField('financing', 'partner_down_payment_pct', parseFloat(e.target.value))}
                          placeholder="100"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>% of down payment funded by partner</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Partner Covers Closing Costs %
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.partner_closing_costs_pct || 100}
                          onChange={(e) => updateVerifiedField('financing', 'partner_closing_costs_pct', parseFloat(e.target.value))}
                          placeholder="100"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>% of closing costs funded by partner</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Your Equity % (of Down Payment)
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.your_equity_pct || 5}
                          onChange={(e) => updateVerifiedField('financing', 'your_equity_pct', parseFloat(e.target.value))}
                          placeholder="5"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>e.g., You put 5% of the 25% down</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Partner Preferred Return %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={styles.input}
                          value={verifiedData?.financing?.partner_pref_return || 8}
                          onChange={(e) => updateVerifiedField('financing', 'partner_pref_return', parseFloat(e.target.value))}
                          placeholder="8"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Annual preferred return to partner</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Profit Split (Your %)
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.your_profit_split || 50}
                          onChange={(e) => updateVerifiedField('financing', 'your_profit_split', parseFloat(e.target.value))}
                          placeholder="50"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>After pref return, your share of remaining profits</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* SELLER CARRY FIELDS */}
              {debtStructure === 'seller-carry' && (
                <>
                  <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                    Seller carrying a portion of the purchase price. Define the primary loan and seller carry terms.
                  </p>
                  
                  {/* Primary Loan Section */}
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, marginBottom: 20, border: '1px solid #86efac' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12 }}>🏦 Primary Loan</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Interest Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={styles.input}
                          value={verifiedData?.financing?.interest_rate || 6.5}
                          onChange={(e) => updateVerifiedField('financing', 'interest_rate', parseFloat(e.target.value))}
                          placeholder="6.5"
                        />
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
                      </div>
                    </div>
                  </div>

                  {/* Seller Carry Section */}
                  <div style={{ padding: 16, background: '#f3e8ff', borderRadius: 8, border: '1px solid #c4b5fd' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#6b21a8', marginBottom: 12 }}>📝 Seller Carry Note</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Seller Carry % (of Purchase Price)
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.seller_carry_pct || 15}
                          onChange={(e) => updateVerifiedField('financing', 'seller_carry_pct', parseFloat(e.target.value))}
                          placeholder="15"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Portion seller is carrying</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Seller Carry Interest Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={styles.input}
                          value={verifiedData?.financing?.seller_carry_rate || 5.0}
                          onChange={(e) => updateVerifiedField('financing', 'seller_carry_rate', parseFloat(e.target.value))}
                          placeholder="5.0"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Rate on seller note</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Seller Carry Term (Months)
                        </label>
                        <input
                          type="number"
                          style={styles.input}
                          value={verifiedData?.financing?.seller_carry_term_months || 60}
                          onChange={(e) => updateVerifiedField('financing', 'seller_carry_term_months', parseFloat(e.target.value))}
                          placeholder="60"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Balloon term (e.g., 60 = 5 years)</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Interest Only?
                        </label>
                        <select
                          style={{ ...styles.input, cursor: 'pointer' }}
                          value={verifiedData?.financing?.seller_carry_io ? 'yes' : 'no'}
                          onChange={(e) => updateVerifiedField('financing', 'seller_carry_io', e.target.value === 'yes')}
                        >
                          <option value="yes">Yes - Interest Only</option>
                          <option value="no">No - Amortizing</option>
                        </select>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Interest only until balloon</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Your Cash Down %
                        </label>
                        <input
                          type="number"
                          min="0"
                          style={styles.input}
                          value={verifiedData?.financing?.your_cash_down_pct ?? (100 - (verifiedData?.financing?.ltv ?? 75) - (verifiedData?.financing?.seller_carry_pct ?? 15))}
                          onChange={(e) => updateVerifiedField('financing', 'your_cash_down_pct', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="10"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Remaining after LTV + seller carry</span>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                          Closing Costs %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          style={styles.input}
                          value={verifiedData?.financing?.closing_costs_pct ?? 3}
                          onChange={(e) => updateVerifiedField('financing', 'closing_costs_pct', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="3"
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Typical: 2-4%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* Calculated loan summary - show for structures that have traditional loan component */}
              {verifiedData?.pricing_financing?.price && (debtStructure === 'traditional' || debtStructure === 'seller-finance' || debtStructure === 'equity-partner' || debtStructure === 'seller-carry') && (
                <div style={{ marginTop: 24, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 12 }}>Calculated Loan Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Primary Loan Amount</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${((verifiedData.pricing_financing.price * (verifiedData.financing?.ltv || 75) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {debtStructure === 'seller-carry' ? 'Seller Carry Amount' : 'Down Payment'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${debtStructure === 'seller-carry' 
                          ? ((verifiedData.pricing_financing.price * (verifiedData.financing?.seller_carry_pct || 15) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})
                          : ((verifiedData.pricing_financing.price * (100 - (verifiedData.financing?.ltv || 75)) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})
                        }
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
                  {debtStructure === 'seller-carry' && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Your Cash Down</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                            ${((verifiedData.pricing_financing.price * (verifiedData.financing?.your_cash_down_pct || 10) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Seller Note Monthly</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                            ${(() => {
                              const sellerAmount = verifiedData.pricing_financing.price * (verifiedData.financing?.seller_carry_pct || 15) / 100;
                              const rate = (verifiedData.financing?.seller_carry_rate || 5) / 100 / 12;
                              if (verifiedData.financing?.seller_carry_io) {
                                return (sellerAmount * rate).toLocaleString(undefined, {maximumFractionDigits: 0});
                              }
                              const n = verifiedData.financing?.seller_carry_term_months || 60;
                              if (rate === 0) return (sellerAmount / n).toLocaleString(undefined, {maximumFractionDigits: 0});
                              const payment = sellerAmount * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
                              return payment.toLocaleString(undefined, {maximumFractionDigits: 0});
                            })()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Total Monthly Debt</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                            ${(() => {
                              // Primary loan payment
                              const P = verifiedData.pricing_financing.price * (verifiedData.financing?.ltv || 75) / 100;
                              const r = (verifiedData.financing?.interest_rate || 6) / 100 / 12;
                              const n = (verifiedData.financing?.amortization_years || 30) * 12;
                              let primaryPayment = 0;
                              if (r === 0) {
                                primaryPayment = P / n;
                              } else {
                                primaryPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                              }
                              // Seller carry payment
                              const sellerAmount = verifiedData.pricing_financing.price * (verifiedData.financing?.seller_carry_pct || 15) / 100;
                              const sellerRate = (verifiedData.financing?.seller_carry_rate || 5) / 100 / 12;
                              let sellerPayment = 0;
                              if (verifiedData.financing?.seller_carry_io) {
                                sellerPayment = sellerAmount * sellerRate;
                              } else {
                                const sellerN = verifiedData.financing?.seller_carry_term_months || 60;
                                if (sellerRate === 0) {
                                  sellerPayment = sellerAmount / sellerN;
                                } else {
                                  sellerPayment = sellerAmount * (sellerRate * Math.pow(1 + sellerRate, sellerN)) / (Math.pow(1 + sellerRate, sellerN) - 1);
                                }
                              }
                              return (primaryPayment + sellerPayment).toLocaleString(undefined, {maximumFractionDigits: 0});
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {debtStructure === 'equity-partner' && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Partner Contribution</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                            ${(() => {
                              const downPayment = verifiedData.pricing_financing.price * (100 - (verifiedData.financing?.ltv || 75)) / 100;
                              const partnerPct = verifiedData.financing?.partner_down_payment_pct || 100;
                              return (downPayment * partnerPct / 100).toLocaleString(undefined, {maximumFractionDigits: 0});
                            })()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Your Cash In</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                            ${(() => {
                              const downPayment = verifiedData.pricing_financing.price * (100 - (verifiedData.financing?.ltv || 75)) / 100;
                              const yourPct = verifiedData.financing?.your_equity_pct || 5;
                              return (downPayment * yourPct / 100).toLocaleString(undefined, {maximumFractionDigits: 0});
                            })()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Partner Annual Pref</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
                            ${(() => {
                              const downPayment = verifiedData.pricing_financing.price * (100 - (verifiedData.financing?.ltv || 75)) / 100;
                              const partnerPct = verifiedData.financing?.partner_down_payment_pct || 100;
                              const partnerAmount = downPayment * partnerPct / 100;
                              const prefReturn = verifiedData.financing?.partner_pref_return || 8;
                              return (partnerAmount * prefReturn / 100).toLocaleString(undefined, {maximumFractionDigits: 0});
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Subject To Summary */}
              {debtStructure === 'subject-to' && verifiedData?.financing?.current_loan_balance && (
                <div style={{ marginTop: 24, padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>Subject To Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Taking Over Loan</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${(verifiedData.financing.current_loan_balance || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Monthly Payment</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                        ${(verifiedData.financing.monthly_payment || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Annual Debt Service</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                        ${((verifiedData.financing.monthly_payment || 0) * 12).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'proforma' && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={20} /> Proforma
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.purchase_price || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'purchase_price', parseFloat(e.target.value))}
                    placeholder="Enter purchase price"
                  />
                  {verifiedData?.pricing_financing?.price && (
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>Current: {verifiedData.pricing_financing.price.toLocaleString()}</span>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Insurance
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.insurance || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'insurance', parseFloat(e.target.value))}
                    placeholder="Enter insurance"
                  />
                  {verifiedData?.expenses?.insurance && (
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>Current: {verifiedData.expenses.insurance.toLocaleString()}</span>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Taxes
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.taxes || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'taxes', parseFloat(e.target.value))}
                    placeholder="Enter taxes"
                  />
                  {verifiedData?.expenses?.taxes && (
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>Current: {verifiedData.expenses.taxes.toLocaleString()}</span>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Annual Debt Service
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.annual_debt_service || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'annual_debt_service', parseFloat(e.target.value))}
                    placeholder="Enter annual debt service"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Property Management (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={verifiedData?.proforma?.property_management_pct || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'property_management_pct', parseFloat(e.target.value))}
                    placeholder="Enter property management %"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Vacancy (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={verifiedData?.proforma?.vacancy_pct || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'vacancy_pct', parseFloat(e.target.value))}
                    placeholder="Enter vacancy %"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    CapEx (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={styles.input}
                    value={verifiedData?.proforma?.capex_pct || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'capex_pct', parseFloat(e.target.value))}
                    placeholder="Enter CapEx %"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Payroll
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.payroll || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'payroll', parseFloat(e.target.value))}
                    placeholder="Enter payroll"
                  />
                  <span style={{ fontSize: 12, color: '#3b82f6' }}>0</span>
                </div>
              </div>

              {/* Utilities Section */}
              <h4 style={{ marginTop: 32, marginBottom: 16, fontSize: 15, fontWeight: 700, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
                Utilities (Monthly)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Gas (Monthly)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.gas_monthly || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'gas_monthly', parseFloat(e.target.value))}
                    placeholder="Enter monthly gas"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Electrical (Monthly)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.electrical_monthly || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'electrical_monthly', parseFloat(e.target.value))}
                    placeholder="Enter monthly electrical"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Water (Monthly)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.water_monthly || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'water_monthly', parseFloat(e.target.value))}
                    placeholder="Enter monthly water"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Sewer (Monthly)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.sewer_monthly || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'sewer_monthly', parseFloat(e.target.value))}
                    placeholder="Enter monthly sewer"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Trash (Monthly)
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.trash_monthly || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'trash_monthly', parseFloat(e.target.value))}
                    placeholder="Enter monthly trash"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                    Total Utilities
                  </label>
                  <input
                    type="number"
                    style={styles.input}
                    value={verifiedData?.proforma?.total_utilities || ''}
                    onChange={(e) => updateVerifiedField('proforma', 'total_utilities', parseFloat(e.target.value))}
                    placeholder="Enter total utilities"
                  />
                  {verifiedData?.expenses?.utilities && (
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>Current: {verifiedData.expenses.utilities.toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* Proforma Rents Section */}
              <h4 style={{ marginTop: 32, marginBottom: 16, fontSize: 15, fontWeight: 700, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
                Proforma Rents
              </h4>
              {(verifiedData?.proforma?.rent_projections || [{ type: '', units: '', proforma_rent: '' }]).map((rent, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                      Type (Bed/Bath)
                    </label>
                    <input
                      type="text"
                      style={styles.input}
                      value={rent.type || ''}
                      onChange={(e) => {
                        const newRents = [...(verifiedData?.proforma?.rent_projections || [{ type: '', units: '', proforma_rent: '' }])];
                        newRents[idx] = { ...newRents[idx], type: e.target.value };
                        updateVerifiedField('proforma', 'rent_projections', newRents);
                      }}
                      placeholder="e.g., 2BR/2BA"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                      Units
                    </label>
                    <input
                      type="number"
                      style={styles.input}
                      value={rent.units || ''}
                      onChange={(e) => {
                        const newRents = [...(verifiedData?.proforma?.rent_projections || [{ type: '', units: '', proforma_rent: '' }])];
                        newRents[idx] = { ...newRents[idx], units: parseFloat(e.target.value) };
                        updateVerifiedField('proforma', 'rent_projections', newRents);
                      }}
                      placeholder="Number of units"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280', fontWeight: 700 }}>
                      Proforma Rent
                    </label>
                    <input
                      type="number"
                      style={styles.input}
                      value={rent.proforma_rent || ''}
                      onChange={(e) => {
                        const newRents = [...(verifiedData?.proforma?.rent_projections || [{ type: '', units: '', proforma_rent: '' }])];
                        newRents[idx] = { ...newRents[idx], proforma_rent: parseFloat(e.target.value) };
                        updateVerifiedField('proforma', 'rent_projections', newRents);
                      }}
                      placeholder="Enter proforma rent"
                    />
                  </div>
                  {idx > 0 && (
                    <button
                      onClick={() => {
                        const newRents = [...(verifiedData?.proforma?.rent_projections || [])];
                        newRents.splice(idx, 1);
                        updateVerifiedField('proforma', 'rent_projections', newRents);
                      }}
                      style={{
                        alignSelf: 'flex-end',
                        padding: '12px 16px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const currentRents = verifiedData?.proforma?.rent_projections || [{ type: '', units: '', proforma_rent: '' }];
                  updateVerifiedField('proforma', 'rent_projections', [...currentRents, { type: '', units: '', proforma_rent: '' }]);
                }}
                style={{
                  marginTop: 8,
                  padding: '10px 20px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14
                }}
              >
                + Add Another Unit Type
              </button>
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
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
              }}
            >
              <CheckCircle size={18} />
              Skip to Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Results + Chat (side-by-side)
  if (step === 'results') {
    const handleRunAIFromResults = () => {
      if (!dealId || !scenarioData) return;

      // Derive buy box / underwriting mode from scenarioData if present
      const setup = scenarioData.deal_setup || verifiedData?.deal_setup || {};
      const dealParams = {
        underwriting_mode: setup.underwriting_mode || 'hardcoded',
        buy_box: setup.buy_box || null,
        property_type: setup.property_type || 'multifamily',
        transaction_type: setup.transaction_type || 'acquisition',
        debt_structure: setup.debt_structure || 'traditional'
      };
      localStorage.setItem('dealParams', JSON.stringify(dealParams));

      // Use the already-transformed scenario and full calculation engine
      // output so the AI underwriter sees the exact same numbers as the
      // Results / Deal-or-No-Deal views.
      const fullCalcs = calculations?.fullAnalysis || calculations || null;

      const wizardStructure = {
        strategy: setup.debt_structure || setup.strategy || 'traditional',
        deal_setup: setup,
        financing: scenarioData.financing || {}
      };

      // Push latest scenario (results-edited) into backend so AI sees it
      try {
        fetch(`${API_BASE}/v2/deals/${dealId}/scenario`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: scenarioData })
        }).catch(err => {
          console.warn('[V2] Failed to update scenario from results before AI analysis', err);
        });
      } catch (err) {
        console.warn('[V2] Error scheduling scenario update from results', err);
      }

      navigate('/underwrite/analysis', {
        state: {
          dealId,
          verifiedData: scenarioData,
          scenarioData,
          fullCalcs,
          wizardStructure
        }
      });
    };

    return (
      <ResultsPageV2
        scenarioData={scenarioData}
        dealId={dealId}
        underwritingResult={underwritingResult}
        setUnderwritingResult={setUnderwritingResult}
        modifiedFields={modifiedFields}
        calculations={calculations}
        messages={messages}
        inputValue={inputValue}
        setInputValue={setInputValue}
        isSending={isSending}
        handleSendMessage={handleSendMessage}
        chatMessagesRef={chatMessagesRef}
        onEditData={(path, value) => modifyScenarioField(path, value)}
        onGoHome={() => navigate('/dashboard')}
        onReturnToWizard={() => setStep('wizard')}
        isChatMinimized={isChatMinimized}
        setIsChatMinimized={setIsChatMinimized}
        marketCapRate={marketCapRate}
        marketCapRateLoading={marketCapRateLoading}
        onRunAIAnalysis={handleRunAIFromResults}
      />
    );
  }

  return null;
}

export default UnderwriteV2Page;

