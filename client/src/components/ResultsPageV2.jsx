/* eslint-disable */
// V2 Results Page - Complete with All Advanced Features
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import RentRollTab from './results-tabs/RentRollTab';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Send, Home, DollarSign, FileText, CreditCard, BarChart3, Users, FileBarChart, TrendingUp, Calculator, PieChart, Calendar, Activity, Layers, LayoutDashboard, RefreshCw, Rocket, MessageSquare, Download, Presentation, MapPin, FileSpreadsheet, Wallet, ArrowLeft } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import UnderwriteXBridge from './UnderwriteXBridge';
import { 
  AmortizationChart, 
  LoanBalanceChart, 
  SensitivityTable, 
  MonthlyCashFlowChart, 
  OccupancyRampChart,
  ExitScenariosChart,
  WaterfallPieChart,
  ProjectionsTable
} from './AdvancedCharts';
import { 
  RentRollView, 
  ManagementFeesView, 
  WaterfallView, 
  TaxAnalysisView,
  MetricCard 
} from './AdvancedViews';
import { calculateSensitivity, calculateFullAnalysis } from '../utils/realEstateCalculations';
import SensitivityAnalysisTab from './results-tabs/SensitivityAnalysisTab';
import T12AuditorTab from './results-tabs/T12AuditorTab';
import { CostSegAnalysisView } from './CostSegAnalysis';
import MarketResearchTab from './results-tabs/MarketResearchTab';
import DocumentAnalysisTab from './results-tabs/DocumentAnalysisTab';
import DealStructureTab from './results-tabs/DealStructureTab';
import ExpenseV2Tab from './results-tabs/ExpenseV2Tab';
import ValueAddTab from './results-tabs/ValueAddTab';
import WaterfallTab from './results-tabs/WaterfallTab';
import ExitStrategyTab from './results-tabs/ExitStrategyTab';
import CompressedTab from './results-tabs/CompressedTab';
import UnderwritingTablePage from '../pages/UnderwritingTablePage';
import { saveDeal, updateDeal, loadDeal, loadProfile, robustGeocodeAddress } from '../lib/dealsService';
import ScenarioSheet from './ScenarioSheet';
import { supabase } from '../lib/supabase';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { loadCountyTaxData, lookupFromScenario, computeTaxComparison } from '../utils/countyTaxLookup';
import { buildGoogleSheetsWorkbookPayload } from '../utils/buildGoogleSheetsWorkbookPayload';
import BoardOfAdvisors from './BoardOfAdvisors';
import DealChat from './DealChat';

class UnderwriteXErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[UnderwriteX] Render crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#dc2626', marginBottom: 12 }}>Underwriting panel crashed</h2>
          <div style={{ marginBottom: 12, color: '#374151' }}>{String(this.state.error.message || this.state.error)}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: 12, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ResultsPageV2 = ({ 
  dealId,
  scenarioData, 
  savedRentcastData,
  underwritingResult,
  setUnderwritingResult,
  calculations,
  messages,
  inputValue,
  setInputValue,
  isSending,
  handleSendMessage,
  chatMessagesRef,
  onEditData,
  onGoHome,
  onReturnToWizard,
  isChatMinimized,
  setIsChatMinimized,
  marketCapRate,
  marketCapRateLoading,
  onRunAIAnalysis,
  uploadedFileData,
  uploadedFileUrl
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('t12-auditor');

  const [countyTaxData, setCountyTaxData] = useState([]);
  const [countyTaxEntry, setCountyTaxEntry] = useState(null);
  const [countySearch, setCountySearch] = useState('');
  const [showCountyDropdown, setShowCountyDropdown] = useState(false);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [isPushingToPipeline, setIsPushingToPipeline] = useState(false);
  const [pipelineSuccess, setPipelineSuccess] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [amortSubTab, setAmortSubTab] = useState('schedule');
  const [rubsEnabled, setRubsEnabled] = useState(scenarioData?.value_add?.rubs_enabled || false);
  const [marketData, setMarketData] = useState(null);
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState(scenarioData?.document_analysis || null);
  // Track which expense fields user is entering as monthly (key -> true means monthly input mode)
  const [expenseMonthlyMode, setExpenseMonthlyMode] = useState({});

  // White-label branding config for PDF export
  const [brandConfig, setBrandConfig] = useState(null);
  useEffect(() => {
    loadProfile().then(p => {
      if (p && (p.brandLogoUrl || p.brandCompanyName || p.brandAccentColor !== '#0052FF')) {
        setBrandConfig({
          logoUrl: p.brandLogoUrl,
          companyName: p.brandCompanyName || p.company,
          letterheadText: p.brandLetterheadText,
          primaryColor: p.brandPrimaryColor,
          secondaryColor: p.brandSecondaryColor,
          accentColor: p.brandAccentColor
        });
      }
    }).catch(() => {});
  }, []);

  // ═══ Auto-save: track if deal is in pipeline, debounce saves ═══
  const [isInPipeline, setIsInPipeline] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Google Sheets export state
  const [isSheetsExporting, setIsSheetsExporting] = useState(false);
  const [sheetsExportStatus, setSheetsExportStatus] = useState(null); // null | 'success' | 'error'

  const handleExportToSheets = async () => {
    setIsSheetsExporting(true);
    setSheetsExportStatus(null);
    try {
      // Load user's configured sheet ID from profile
      let userSheetId = '';
      let userSheetTab = 'Model';
      try {
        const prof = await loadProfile();
        console.log('[SheetsExport] Profile loaded:', prof?.googleSheetId ? 'has sheetId' : 'no sheetId');
        if (prof?.googleSheetId) {
          // Extract ID from full URL if pasted
          const urlMatch = prof.googleSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
          userSheetId = urlMatch ? urlMatch[1] : prof.googleSheetId.trim();
        }
        if (prof?.googleSheetTab) userSheetTab = prof.googleSheetTab;
      } catch (profileErr) {
        console.error('[SheetsExport] Failed to load profile:', profileErr);
      }

      if (!userSheetId) {
        setSheetsExportStatus('error');
        alert('No Google Sheet configured. Go to Dashboard ? Google Sheets Export and paste your spreadsheet URL.');
        setIsSheetsExporting(false);
        return;
      }

      if (!scenarioData) {
        setSheetsExportStatus('error');
        alert('No deal data available to export. Please load or underwrite a deal first.');
        setIsSheetsExporting(false);
        return;
      }

      const existingDeal = dealId ? await loadDeal(dealId).catch(() => null) : null;
      const workbookPayload = buildGoogleSheetsWorkbookPayload({
        scenarioData,
        calculations,
        underwritingResult,
        rentcastData: rentcastData || existingDeal?.rentcastData || savedRentcastData,
        marketData,
        documentAnalysis,
        costsegData: existingDeal?.costsegData || null,
        sensitivity,
        countyTaxEntry,
        selectedStructureMetrics,
        recommendedStructure,
        messages,
        dealId,
        baseTabName: userSheetTab || 'Results',
      });

      // Raw deal data for the AI workbook builder — Claude designs one curated,
      // formatted workbook from this; the pre-built workbook is the fallback.
      const dealData = {
        scenarioData,
        fullCalcs: calculations?.fullAnalysis || calculations || {},
        underwritingResult,
        rentcastData: rentcastData || existingDeal?.rentcastData || savedRentcastData,
        marketData,
        documentAnalysis,
        costsegData: existingDeal?.costsegData || null,
        sensitivity,
        countyTaxEntry,
        selectedStructureMetrics,
        recommendedStructure,
      };

      console.log('[SheetsExport] Sending deal data + fallback workbook to API:', {
        hasScenarioData: !!scenarioData,
        hasCalcs: !!calculations,
        sheetId: userSheetId,
        baseTabName: workbookPayload.baseTabName,
        sheetCount: workbookPayload.sheets.length,
        rawSheetCount: workbookPayload.rawSheets.length,
      });

      const response = await fetch(`${API_BASE_URL}/api/sheets/export-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: userSheetId,
          sheetTab: userSheetTab,
          dealData,
          workbook: workbookPayload,
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = errBody.detail || errBody.message || `Server error ${response.status}`;
        console.error('[SheetsExport] API error:', response.status, errMsg);
        setSheetsExportStatus('error');
        alert(`Google Sheets export failed: ${errMsg}`);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setSheetsExportStatus('success');
        window.open(`https://docs.google.com/spreadsheets/d/${userSheetId}`, '_blank');
      } else {
        console.error('[SheetsExport] API returned failure:', result.message);
        setSheetsExportStatus('error');
        alert(`Google Sheets export failed: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[SheetsExport] Exception:', err);
      setSheetsExportStatus('error');
      alert(`Google Sheets export failed: ${err.message}`);
    } finally {
      setIsSheetsExporting(false);
      setTimeout(() => setSheetsExportStatus(null), 4000);
    }
  };

  // Excel template export state & handler
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  
  const handleExportToExcel = async () => {
    setIsExcelExporting(true);
    try {
      // Get profile ID for token deduction
      let profileId = null;
      try {
        const userRes = await supabase.auth.getUser();
        profileId = userRes?.data?.user?.id;
      } catch {}
      
      // Get fullCalcs the same way other parts of the app do
      const fullCalcs = calculations?.fullAnalysis || calculations || {};
      
      // Build sensitivity data from scenarioData
      const sensitivityData = {
        revaluation: scenarioData?.sensitivity?.revaluation || {},
        cashOutRefi: scenarioData?.sensitivity?.cash_out_refi || {},
        postRefiCashflow: scenarioData?.sensitivity?.post_refi_cashflow || {}
      };
      
      // Build waterfall data
      const waterfallData = {
        equity_structure: scenarioData?.financing?.equity_structure || {},
        preferred_return: scenarioData?.financing?.preferred_return,
        promote_split: scenarioData?.financing?.promote_split,
        loans: scenarioData?.financing?.loans || []
      };
      
      const response = await fetch(`${API_BASE_URL}/api/export/excel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(profileId ? { 'X-Profile-ID': profileId } : {})
        },
        body: JSON.stringify({
          scenarioData,
          fullCalcs,
          sensitivityData,
          waterfallData,
          // Extra context for the AI workbook builder
          rentcastData: rentcastData || savedRentcastData || null,
          marketData: marketData || null,
          countyTaxEntry: countyTaxEntry || null,
          sensitivity: sensitivity || null,
          selectedStructureMetrics: selectedStructureMetrics || null,
          recommendedStructure: recommendedStructure || null,
          underwritingResult: underwritingResult || null,
        })
      });
      
      // Handle 402 insufficient tokens
      if (response.status === 402) {
        const err = await response.json();
        alert(`Insufficient tokens. You need 1 token but have ${err.token_balance || 0}. Purchase more tokens in Settings.`);
        return;
      }
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.error || 'Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : 'Underwriting_Model.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('[ExcelExport] Exception:', err);
      alert(`Excel export failed: ${err.message}`);
    } finally {
      setIsExcelExporting(false);
    }
  };

  const autoSaveTimerRef = useRef(null);
  const scenarioSnapshotRef = useRef(null);
  const marketDataFetchedRef = useRef(false);
  const aiAnalysisStartedRef = useRef(false);

  // Check if deal is already in pipeline on mount
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await loadDeal(dealId);
        if (!cancelled && existing) setIsInPipeline(true);
      } catch (e) { /* not in pipeline yet */ }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  // Auto-save scenarioData to pipeline when changes are made (debounced 2s)
  useEffect(() => {
    if (!isInPipeline || !dealId || !scenarioData) return;
    const snap = JSON.stringify(scenarioData);
    if (scenarioSnapshotRef.current === snap) return; // no change
    scenarioSnapshotRef.current = snap;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await updateDeal(dealId, {
          parsed_data: scenarioData,
          scenario_data: scenarioData,
        });
        window.dispatchEvent(new Event('pipelineDealsUpdated'));
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 2000);
      } catch (e) {
        console.error('[AutoSave] Failed:', e);
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus(null), 3000);
      }
    }, 2000);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [scenarioData, isInPipeline, dealId]);

  // -- Keyboard shortcuts: Cmd/Ctrl+S = save, Cmd/Ctrl+P = PDF export --
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!isPushingToPipeline && !isInPipeline) handlePushToPipeline();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (!isExportingPDF) handleExportPDF();
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleExportToSheets();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const propertyLocation = useMemo(() => {
    const lat = scenarioData?.property?.lat ?? scenarioData?.property?.latitude ?? scenarioData?.lat ?? scenarioData?.latitude;
    const lng = scenarioData?.property?.lng ?? scenarioData?.property?.longitude ?? scenarioData?.lng ?? scenarioData?.longitude;
    return {
      address: scenarioData?.property?.address || scenarioData?.address || '',
      city: scenarioData?.property?.city || scenarioData?.city || '',
      state: scenarioData?.property?.state || scenarioData?.state || '',
      zip: scenarioData?.property?.zip || scenarioData?.zip || '',
      lat: lat != null ? Number(lat) : undefined,
      lng: lng != null ? Number(lng) : undefined
    };
  }, [scenarioData]);
  const tabContentRef = useRef(null);
  
  // Market data fetch function - defined at component level so it can be passed as prop
  const fetchMarketData = useCallback(async (driveTimeMinutes = 15) => {
    // Property info can be at root level or under property key
    const address = scenarioData?.address || scenarioData?.property?.address;
    const city = scenarioData?.city || scenarioData?.property?.city;
    const state = scenarioData?.state || scenarioData?.property?.state;
    const zip = scenarioData?.zip || scenarioData?.property?.zip;
    
    if (!address || !city || !state || !zip) {
      console.log('[MARKET ANALYSIS] Missing property data:', { address, city, state, zip });
      return;
    }
    
    setMarketDataLoading(true);
    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';
      console.log('[MARKET ANALYSIS] Fetching data for:', { address, city, state, zip, driveTimeMinutes });
      const response = await fetch(`${API_BASE}/api/market-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: { address, city, state, zip },
          drive_time_minutes: driveTimeMinutes
        })
      });
      
      if (!response.ok) {
        throw new Error(`Market analysis failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[MARKET ANALYSIS] Success:', result);
      setMarketData(result);
    } catch (error) {
      console.error('Market analysis pre-fetch error:', error);
      // Silently fail - tab will show error message
    } finally {
      setMarketDataLoading(false);
    }
  }, [scenarioData]);
  
  // Automatically trigger AI underwriting when results page loads (run once)
  useEffect(() => {
    if (!dealId || !scenarioData || underwritingResult || aiAnalysisStartedRef.current) return;
    aiAnalysisStartedRef.current = true;
    
    const runAIAnalysis = async () => {
      setIsRunningAI(true);
      try {
        const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';
        const response = await fetch(`${API_BASE}/v2/deals/${dealId}/underwrite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioData)
        });
        
        if (!response.ok) {
          throw new Error(`AI Analysis failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (setUnderwritingResult) {
          setUnderwritingResult(result);
        }
      } catch (error) {
        console.error('Auto AI underwriting error:', error);
      } finally {
        setIsRunningAI(false);
      }
    };
    
    runAIAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Automatically fetch market data once when results page loads
  useEffect(() => {
    if (!scenarioData || marketData || marketDataFetchedRef.current) return;
    marketDataFetchedRef.current = true;
    fetchMarketData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioData]);
  
  // AI-recommended deal structure (from DealStructureTab)
  const [recommendedStructure, setRecommendedStructure] = useState(null);
  const [selectedStructureMetrics, setSelectedStructureMetrics] = useState(null);

  // Helper: format assistant plain text into Markdown-like paragraphs when needed
  const formatAssistantMessage = (text) => {
    if (!text) return '';
    // If message already contains markdown-like headings or line breaks, return as-is
    if (/\n\n|## |### |\*\*|^- /m.test(text)) return text;
    // Split into sentences and group into short paragraphs (~2 sentences per paragraph)
    const sentences = text.split(/(?<=[\.\!\?])\s+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length <= 3) return sentences.join('\n\n');
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += 2) {
      paragraphs.push(sentences.slice(i, i + 2).join(' '));
    }
    return paragraphs.join('\n\n');
  };
  
  // Wrapper for onEditData -- calculations update live via useMemo in parent
  const handleFieldChange = (path, value) => {
    if (onEditData) {
      onEditData(path, value);
    }
  };
  
  // Chat position state for dragging
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // RentCast API state
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(savedRentcastData || null);
  
  // Exit Strategy state
  const [selectedHoldPeriod, setSelectedHoldPeriod] = useState(5);

  // Persist chat minimized state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('resultsChatMinimized');
      if (saved !== null) {
        setIsChatMinimized(saved === '1');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('resultsChatMinimized', isChatMinimized ? '1' : '0');
    } catch {}
  }, [isChatMinimized]);
  
  // Handle mouse down on chat header to start dragging
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - chatPosition.x,
      y: e.clientY - chatPosition.y
    });
  };
  
  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setChatPosition({ x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  // Load county tax data from new CSV utility
  useEffect(() => {
    loadCountyTaxData().then(map => {
      // Build legacy array for any downstream county-search dropdowns
      const arr = [];
      map.forEach(entry => arr.push({ state: entry.state, county: entry.county, taxRate: entry.taxRatePercent, fullName: entry.fullName }));
      setCountyTaxData(arr);
    }).catch(err => console.error('Error loading county tax data:', err));
  }, []);

  // Auto-detect county tax entry from scenarioData
  useEffect(() => {
    if (countyTaxData.length === 0) return; // CSV not loaded yet
    const entry = lookupFromScenario(scenarioData);
    setCountyTaxEntry(entry);
  }, [scenarioData?.property_county, scenarioData?.property?.state, scenarioData?.property?.county, countyTaxData]);
  
  // NOTE: Auto-triggering a giant analysis prompt on every deal load was removed —
  // it kept hijacking the AI chat panel unprompted. The user can ask for analysis manually.
  

  // Calculate sensitivity analysis separately (only when needed)
  const sensitivity = useMemo(() => {
    if (!scenarioData || !scenarioData.pricing_financing?.purchase_price) return null;
    
    const purchasePrice = scenarioData.pricing_financing.purchase_price;
    const exitCapRate = scenarioData.underwriting?.exit_cap_rate || 0.06;
    
    return calculateSensitivity(scenarioData, {
      purchasePrice: [purchasePrice * 0.90, purchasePrice * 1.10, purchasePrice * 0.05],
      exitCapRate: [exitCapRate * 0.8, exitCapRate * 1.2, exitCapRate * 0.1],
      incomeGrowth: [0.01, 0.05, 0.01],
      vacancy: [0.03, 0.10, 0.02]
    });
  }, [scenarioData]);
  
  if (!scenarioData || !calculations) return null;

  // Use fullAnalysis if available, otherwise fall back to calculations object
  const fullCalcs = calculations.fullAnalysis || calculations;
  
  // Destructure scenario data with safe defaults
  const { property = {}, pricing_financing = {}, unit_mix = [], underwriting = {} } = scenarioData || {};

  // Header-level Push to Pipeline handler (mirrors DealOrNoDealTab behavior)
  const handlePushToPipeline = async () => {
    if (!scenarioData || !dealId) return;

    setIsPushingToPipeline(true);

    try {
      const propertyData = property || {};
      const pricingFinancing = scenarioData.pricing_financing || {};
      const financing = scenarioData.financing || {};
      const unitMix = scenarioData.unit_mix || [];
      const broker = scenarioData.broker || {};

      const totalUnits = propertyData.units || unitMix.reduce((sum, u) => sum + (u.units || 0), 0) || 0;

      const purchasePrice = pricingFinancing.purchase_price || pricingFinancing.price || 0;
      const capitalImprovements = pricingFinancing.capex_budget || pricingFinancing.renovation_budget || 0;
      const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02) || 0;
      const totalProjectCost = fullCalcs?.total_project_cost
        || fullCalcs?.acquisition?.totalAcquisitionCosts
        || (purchasePrice + capitalImprovements + closingCosts);

      const loanAmount = fullCalcs?.financing?.loanAmount || 0;
      const totalEquity = fullCalcs?.financing?.totalEquityRequired || (totalProjectCost - loanAmount);

      let ltv = fullCalcs?.financing?.ltv || 0;
      if (ltv === 0 && purchasePrice > 0 && loanAmount > 0) {
        ltv = (loanAmount / purchasePrice) * 100;
      }
      if (ltv > 100) {
        ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
      }

      const projectIRR = fullCalcs?.returns?.leveredIRR || 0;
      const avgCashOnCash = fullCalcs?.year1?.cashOnCash || 0;
      const inPlaceCapRate = fullCalcs?.current?.capRate ?? fullCalcs?.year1?.capRate ?? 0;

      const dscr = fullCalcs?.current?.dscr ?? fullCalcs?.year1?.dscr ?? 0;
      const noiYear1 = fullCalcs?.year1?.noi || 0;

      const dayOneCashFlow = fullCalcs?.year1?.cashFlowAfterFinancing || fullCalcs?.year1?.cashFlow || 0;
      const stabilizedCashFlow = fullCalcs?.stabilized?.cashflow ?? 0;

      const refiValue = fullCalcs?.stabilized?.value
        ?? fullCalcs?.returns?.terminalValue
        ?? 0;
      const cashOutRefi = fullCalcs?.exit?.reversionCashFlow ?? 0;
      
      // Calculate userTotalInPocket: cash-out refi minus initial equity invested
      const initialEquity = fullCalcs?.financing?.totalEquityRequired || totalEquity;
      const userTotalInPocket = cashOutRefi - initialEquity;
      
      // Calculate postRefiCashFlow: stabilized cash flow after refinance
      // After refinance, there's new debt service based on refi loan
      const refiLoanAmount = refiValue * 0.75; // Assuming 75% LTV on refi
      const refiInterestRate = pricingFinancing.interest_rate || financing.interest_rate || financing.rate || fullCalcs?.financing?.interestRate || 6.5;
      const refiAmortYears = pricingFinancing.amortization_years || financing.amortization_years || financing.amortization || fullCalcs?.financing?.amortizationYears || 30;
      
      // Monthly payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
      const monthlyRate = (refiInterestRate / 100) / 12;
      const numPayments = refiAmortYears * 12;
      const refiMonthlyPayment = monthlyRate > 0 
        ? refiLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        : 0;
      const refiAnnualDebtService = refiMonthlyPayment * 12;
      
      const stabilizedNOI = fullCalcs?.stabilized?.noi || fullCalcs?.year5?.noi || noiYear1;
      const postRefiCashFlow = stabilizedNOI - refiAnnualDebtService;
      
      const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
      const valueCreation = fullCalcs?.valueCreation ?? 0;

      const address = [
        propertyData.address,
        propertyData.city,
        propertyData.state,
        propertyData.zip
      ].filter(Boolean).join(', ') || 'Address Not Specified';

      const brokerName = broker.name || propertyData.listing_broker || 'Not Specified';
      const brokerPhone = broker.phone || propertyData.broker_phone || '-';
      const brokerEmail = broker.email || propertyData.broker_email || '-';

      const dealStructure = recommendedStructure || scenarioData?.recommended_structure || scenarioData?.deal_structure?.recommended || 'Traditional Financing';

      // Geocode address for map pin — tries Google first, falls back to
      // Nominatim if Google is unavailable (e.g. no API key configured in
      // this environment) or returns nothing, so the deal always ends up
      // with coordinates and shows on the map immediately.
      const coords = await robustGeocodeAddress(address);

      await saveDeal({
        dealId,
        address,
        units: totalUnits,
        purchasePrice,
        dealStructure,
        parsedData: scenarioData,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        scenarioData: {
          ...scenarioData,
          calculations: {
            dayOneCashFlow,
            stabilizedCashFlow,
            refiValue,
            cashOutRefiAmount: cashOutRefi,
            userTotalInPocket,
            postRefiCashFlow,
            inPlaceCapRate,
            avgCashOnCash,
            dscr,
            ltv,
            noiYear1,
            pricePerUnit,
            valueCreation
          }
        },
        marketCapRate: marketCapRate,
        rentcastData: rentcastData || null,
        images: scenarioData?.images || [],
        brokerName,
        brokerPhone,
        brokerEmail,
        notes: ''
      });

      // Notify other components that pipeline has changed
      window.dispatchEvent(new Event('pipelineDealsUpdated'));

      setIsInPipeline(true); // Enable auto-save for future edits
      setPipelineSuccess(true);
      setTimeout(() => setPipelineSuccess(false), 3000);
    } catch (error) {
      console.error('Error pushing to pipeline from Results header:', error);
      alert('Failed to push deal to pipeline: ' + error.message);
    } finally {
      setIsPushingToPipeline(false);
    }
  };

  // PDF Export Handler - captures all tabs and creates PDF
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    
    try {
      // Dynamically import libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      
      // Property name for filename
      const propertyName = property?.property_name || property?.address || 'Deal_Analysis';
      const fileName = `${propertyName.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
      
      // List of all tabs to capture
      const tabs = [
        { id: 'summary', name: 'Summary' },
        { id: 'market-research', name: 'Market Research' },
        { id: 'deal-structure', name: 'Deal Structure' },
        { id: 'rent-roll', name: 'Rent Roll' },
        { id: 'returns', name: 'Returns' },
        { id: 'cost-seg', name: 'Cost Segregation' }
      ];
      
      let isFirstPage = true;
      
      for (const tab of tabs) {
        // Switch to the tab
        setActiveTab(tab.id);
        
        // Wait for tab content to render
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the tab content element
        const element = tabContentRef.current;
        if (!element) continue;
        
        // Store original styles for ALL elements recursively
        const styleBackup = new Map();
        
        const expandElement = (el) => {
          if (!el || el.nodeType !== 1) return;
          
          // Backup original styles
          const computed = window.getComputedStyle(el);
          styleBackup.set(el, {
            overflow: el.style.overflow,
            overflowX: el.style.overflowX,
            overflowY: el.style.overflowY,
            height: el.style.height,
            maxHeight: el.style.maxHeight,
            position: el.style.position
          });
          
          // Force expand everything
          if (computed.overflow !== 'visible' || computed.overflowY !== 'visible') {
            el.style.overflow = 'visible';
            el.style.overflowX = 'visible';
            el.style.overflowY = 'visible';
          }
          
          if (el.style.height && el.style.height !== 'auto') {
            el.style.height = 'auto';
          }
          
          if (el.style.maxHeight && el.style.maxHeight !== 'none') {
            el.style.maxHeight = 'none';
          }
          
          // Handle fixed/sticky positioning
          if (computed.position === 'fixed' || computed.position === 'sticky') {
            el.style.position = 'relative';
          }
          
          // Recursively expand children
          Array.from(el.children).forEach(child => expandElement(child));
        };
        
        // Expand everything starting from root element
        expandElement(element);
        
        // Wait for layout to fully adjust
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Scroll to bottom to trigger any lazy-loaded content
        const maxScroll = element.scrollHeight;
        element.scrollTop = maxScroll;
        await new Promise(resolve => setTimeout(resolve, 300));
        element.scrollTop = 0;
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get the full height after expansion
        const fullHeight = element.scrollHeight;
        console.log(`Capturing ${tab.name} - Full height: ${fullHeight}px`);
        
        // Capture as canvas with full height
        const canvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#f9fafb',
          windowWidth: 1400,
          width: element.scrollWidth,
          height: fullHeight,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX,
          x: 0,
          y: 0
        });
        
        // Restore ALL original styles
        styleBackup.forEach((styles, el) => {
          Object.keys(styles).forEach(prop => {
            el.style[prop] = styles[prop];
          });
        });
        styleBackup.clear();
        
        console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Split into multiple pages if needed
        let yOffset = 0;
        const headerHeight = brandConfig ? 18 : 10;
        const maxPageHeight = pageHeight - (margin * 2) - headerHeight;
        
        while (yOffset < imgHeight) {
          if (!isFirstPage) {
            pdf.addPage();
          }
          isFirstPage = false;
          
          // Add branded header
          if (brandConfig && (brandConfig.companyName || brandConfig.logoUrl)) {
            // Accent color bar at top
            const accent = brandConfig.accentColor || '#0052FF';
            const r = parseInt(accent.slice(1, 3), 16);
            const g = parseInt(accent.slice(3, 5), 16);
            const b = parseInt(accent.slice(5, 7), 16);
            pdf.setFillColor(r, g, b);
            pdf.rect(margin, margin, contentWidth, 1.5, 'F');
            
            // Company name
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            const sec = brandConfig.secondaryColor || '#1A1A1A';
            const sr = parseInt(sec.slice(1, 3), 16);
            const sg = parseInt(sec.slice(3, 5), 16);
            const sb = parseInt(sec.slice(5, 7), 16);
            pdf.setTextColor(sr, sg, sb);
            pdf.text(brandConfig.companyName || '', margin, margin + 6);
            
            // Tab name on the right
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(107, 114, 128);
            pdf.text(tab.name, pageWidth - margin, margin + 6, { align: 'right' });
            
            // Letterhead tagline
            if (brandConfig.letterheadText) {
              pdf.setFontSize(7);
              pdf.setTextColor(156, 163, 175);
              pdf.text(brandConfig.letterheadText, margin, margin + 10);
            }
          } else {
            // Default header: just tab name
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(17, 24, 39);
            pdf.text(tab.name, margin, margin + 5);
          }
          
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
          
          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          
          pdf.addImage(
            pageImgData,
            'JPEG',
            margin,
            margin + headerHeight,
            imgWidth,
            heightForThisPage
          );
          
          yOffset += maxPageHeight;
        }
      }
      
      // Save the PDF
      pdf.save(fileName);
      
      // Reset to summary tab
      setActiveTab('summary');
      
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF: ' + error.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ========================================================================
  // PITCH DECK -> now handled by the Deal Room's investor-facing document,
  // which pulls real strategy/market data and offers its own "Generate
  // Investor Link / Export" action. This button just opens it.
  // ========================================================================
  const handleGeneratePitchDeck = () => {
    if (!dealId) {
      alert('Push this deal to your pipeline first, then open its Deal Room to generate an investor document.');
      return;
    }
    navigate(`/deal-room/${dealId}?tab=dealroom`);
  };

  // Format helpers
  const fmt = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (isNaN(n)) return num;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  const pct = (num) => {
    if (num === null || num === undefined || num === '') return 'N/A';
    const n = Number(num);
    if (isNaN(n)) return num;
    return `${n.toFixed(2)}%`;
  };

  const display = (val) => val || 'N/A';

  // Key metrics for IM-style summary header
  const purchasePrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
  const totalCapitalization = fullCalcs?.acquisition?.totalAcquisitionCosts || 0;

  // Distinguish T12 vs pro forma NOI, but prefer engine Year 1 NOI for consistency
  const noiT12 = scenarioData.pnl?.noi_t12 ?? scenarioData.pnl?.noi ?? 0;
  const noiProforma = scenarioData.pnl?.noi_proforma ?? 0;

  // Normalize Year 1 NOI to engine output when available
  const year1NOI = fullCalcs?.year1?.noi ?? noiT12;
  // Annual debt service: prefer Deal Structure multi-loan total when configured
  const hasMultiLoanStack = scenarioData.financing?.loans?.length > 0;
  const annualDebtService = (hasMultiLoanStack && fullCalcs?.financing?.annualDebtService > 0)
    ? fullCalcs.financing.annualDebtService
    : (fullCalcs?.financing?.annualDebtService ?? scenarioData.pricing_financing?.annual_debt_service ?? 0);

  const capRate = (fullCalcs?.year1?.capRate != null)
    ? fullCalcs.year1.capRate
    : (purchasePrice > 0 && year1NOI > 0 ? (year1NOI / purchasePrice) * 100 : 0);
  const cashOnCash = (fullCalcs?.year1?.cashOnCash != null) ? fullCalcs.year1.cashOnCash : 0;
  // Recalculate DSCR when multi-loan stack overrides engine debt service
  const dscr = (hasMultiLoanStack && annualDebtService > 0 && year1NOI > 0)
    ? year1NOI / annualDebtService
    : ((fullCalcs?.year1?.dscr != null)
        ? fullCalcs.year1.dscr
        : (annualDebtService > 0 && year1NOI > 0 ? year1NOI / annualDebtService : 0));
  // Recalculate cash flow when multi-loan stack overrides engine debt service
  const annualCashFlow = hasMultiLoanStack
    ? (year1NOI - annualDebtService)
    : ((fullCalcs?.year1?.cashFlowAfterFinancing != null)
        ? fullCalcs.year1.cashFlowAfterFinancing
        : (year1NOI - annualDebtService));
  const stabilizedValue = fullCalcs?.returns?.terminalValue || 0;

  // ═══ VALUE-ADD ADJUSTMENTS -- computed at component level for all tabs ═══
  const vaUnitMix = scenarioData.unit_mix || [];
  const vaTotalUnits = scenarioData.property?.units || vaUnitMix.reduce((s, u) => s + (u.units || 0), 0) || 0;
  const vaCurrentMonthlyRent = vaUnitMix.reduce((s, u) => s + ((u.units || 0) * (u.rent_current || 0)), 0);
  const vaMarketMonthlyRent = vaUnitMix.reduce((s, u) => {
    const mr = u.rent_market && u.rent_market > 0 ? u.rent_market : u.rent_current || 0;
    return s + ((u.units || 0) * mr);
  }, 0);
  const vaAnnualRentUpside = (vaMarketMonthlyRent - vaCurrentMonthlyRent) * 12;

  // RUBS recovery -- recompute from rubsConfig
  const vaRubsConfig = scenarioData?.value_add?.rubs_config || {};
  const vaTotalUtilityCost = scenarioData?.expenses?.utilities || 0;
  const vaUtilityProportions = { water_sewer: 0.35, electric: 0.30, gas: 0.15, trash: 0.20 };
  const vaDefaultRecovery = { water_sewer: 90, electric: 85, gas: 85, trash: 95 };
  const vaTotalPropertySqft = vaUnitMix.reduce((s, u) => s + ((u.units || 0) * (u.sqft || u.avg_sqft || 800)), 0);
  const vaAvgSqft = vaTotalUnits > 0 ? vaTotalPropertySqft / vaTotalUnits : 800;
  const vaAnnualRubsRecovery = (() => {
    if (!rubsEnabled) return 0;
    let total = 0;
    Object.entries(vaUtilityProportions).forEach(([key, pct]) => {
      const customVal = vaRubsConfig[key]?.annual_cost;
      const cost = customVal != null && customVal > 0 ? customVal : Math.round(vaTotalUtilityCost * pct);
      const cfg = vaRubsConfig[key] || {};
      if (cfg.enabled === false) return;
      const recoveryPct = cfg.recovery_pct != null ? cfg.recovery_pct : (vaDefaultRecovery[key] || 90);
      const recoverableAnnual = cost * (recoveryPct / 100);
      const method = cfg.split_method || 'per_unit';
      let monthlyPerUnit = 0;
      if (vaTotalUnits > 0) {
        if (method === 'per_unit') {
          monthlyPerUnit = recoverableAnnual / 12 / vaTotalUnits;
        } else if (method === 'by_sqft') {
          monthlyPerUnit = (recoverableAnnual / 12 / (vaTotalPropertySqft || 1)) * vaAvgSqft;
        } else if (method === 'by_occupancy') {
          const occRate = 1 - ((scenarioData.expenses?.vacancy_pct || 5) / 100);
          const occupied = Math.round(vaTotalUnits * occRate);
          monthlyPerUnit = occupied > 0 ? recoverableAnnual / 12 / occupied : 0;
        }
      }
      total += monthlyPerUnit * vaTotalUnits * 12;
    });
    return total;
  })();

  // Keep scenarioData.value_add synced with latest computed values
  useEffect(() => {
    if (scenarioData?.value_add?.apply_rent_upside && vaAnnualRentUpside !== (scenarioData?.value_add?.annual_rent_upside || 0)) {
      handleFieldChange('value_add.annual_rent_upside', vaAnnualRentUpside);
    }
    if (scenarioData?.value_add?.apply_rubs && vaAnnualRubsRecovery !== (scenarioData?.value_add?.annual_rubs_recovery || 0)) {
      handleFieldChange('value_add.annual_rubs_recovery', vaAnnualRubsRecovery);
    }
    // Sync other income & expense savings when their apply toggles are on
    const otherIncome = scenarioData?.value_add?.annual_other_income || 0;
    if (scenarioData?.value_add?.apply_other_income && otherIncome !== (scenarioData?.value_add?._synced_other_income || 0)) {
      handleFieldChange('value_add._synced_other_income', otherIncome);
    }
    const expSavings = scenarioData?.value_add?.annual_expense_savings || 0;
    if (scenarioData?.value_add?.apply_expense_savings && expSavings !== (scenarioData?.value_add?._synced_expense_savings || 0)) {
      handleFieldChange('value_add._synced_expense_savings', expSavings);
    }
  }, [vaAnnualRentUpside, vaAnnualRubsRecovery, scenarioData?.value_add?.apply_rent_upside, scenarioData?.value_add?.apply_rubs, scenarioData?.value_add?.apply_other_income, scenarioData?.value_add?.annual_other_income, scenarioData?.value_add?.apply_expense_savings, scenarioData?.value_add?.annual_expense_savings]); // eslint-disable-line

  // Use UnderwriteX instead of tabs
  const tabs = [];

  // Row component
  const DataRow = ({ label, value, highlight }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: highlight ? '#f0fdf4' : 'transparent'
    }}>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: highlight ? '700' : '600', color: highlight ? '#10b981' : '#111827', textAlign: 'right' }}>{value}</div>
    </div>
  );
  // Section header
  const SectionHeader = ({ title }) => (
    <div style={{
      padding: '14px 16px',
      fontSize: '14px',
      fontWeight: '700',
      color: '#111827',
      borderBottom: '2px solid #e5e7eb',
      backgroundColor: '#f9fafb'
    }}>
      {title}
    </div>
  );

  // Render tab content - use UnderwriteX as the main view
  const renderTabContent = () => {
    return (
      <UnderwriteXBridge
        scenarioData={scenarioData}
        dealId={dealId}
        property={scenarioData?.property}
        pdfData={uploadedFileData}
        pdfUrl={uploadedFileUrl}
        onExportPDF={handleExportPDF}
        onExportToSheets={handleExportToSheets}
        onExportToExcel={handleExportToExcel}
        onGeneratePitchDeck={handleGeneratePitchDeck}
        onPushToPipeline={handlePushToPipeline}
        isSheetsExporting={isSheetsExporting}
        isExcelExporting={isExcelExporting}
        isExportingPDF={isExportingPDF}
        isPushingToPipeline={isPushingToPipeline}
        sheetsExportStatus={sheetsExportStatus}
        isInPipeline={isInPipeline}
        pipelineSuccess={pipelineSuccess}
        onGoHome={onGoHome}
        marketData={marketData}
        marketDataLoading={marketDataLoading}
        onRefetchMarketData={fetchMarketData}
      />
    );
  };

  // -- Header button style helper --
  const hBtnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px',
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    whiteSpace: 'nowrap',
  };

  // Icon-rail items removed (UnderwriteX has its own internal sidebar/nav)

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>

      {/* -- MAIN ROW (content) -- */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Main content area */}
        <div style={{ 
          flex: 1, 
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          backgroundColor: '#f9fafb'
        }}>
          <div
            ref={tabContentRef}
            style={{ flex: 1, overflow: 'auto' }}
          >
            <UnderwriteXErrorBoundary>
              {renderTabContent()}
            </UnderwriteXErrorBoundary>
          </div>
        </div>

      </div>

      {/* Deal Chat + Board of Advisors — floating triggers, available from anywhere on the results page */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 900, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)', borderRadius: 5 }}>
          <DealChat scenarioData={scenarioData} calculations={fullCalcs} />
        </div>
        <div style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)', borderRadius: 5 }}>
          <BoardOfAdvisors dealId={dealId} scenarioData={scenarioData} analysis={fullCalcs} />
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 4px 30px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.5);
            transform: scale(1.02);
          }
        }
        .pulse-button {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ResultsPageV2;

