/* eslint-disable */
// V2 Results Page - Complete with All Advanced Features
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import RentRollTab from './results-tabs/RentRollTab';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Send, Home, DollarSign, FileText, CreditCard, BarChart3, Users, FileBarChart, TrendingUp, Calculator, PieChart, Calendar, Activity, Layers, LayoutDashboard, RefreshCw, Rocket, MessageSquare, Download, Presentation, MapPin, FileSpreadsheet, Wallet, Moon, Sun } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
import { saveDeal, updateDeal, loadDeal } from '../lib/dealsService';
import { geocodeAddress } from '../utils/geocode';
import ScenarioSheet from './ScenarioSheet';
import { supabase } from '../lib/supabase';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { loadCountyTaxData, lookupFromScenario, computeTaxComparison } from '../utils/countyTaxLookup';

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
  onRunAIAnalysis
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');

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
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  // Track which expense fields user is entering as monthly (key -> true means monthly input mode)
  const [expenseMonthlyMode, setExpenseMonthlyMode] = useState({});

  // â•â•â• Auto-save: track if deal is in pipeline, debounce saves â•â•â•
  const [isInPipeline, setIsInPipeline] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
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

  // ── Keyboard shortcuts: Cmd/Ctrl+S = save, Cmd/Ctrl+P = PDF export ──
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
  
  // Auto-trigger Max deal analysis on mount
  useEffect(() => {
    if (!scenarioData || !calculations) return;
    const hasOnlyWelcomeAssistant =
      messages.length === 1 && messages[0] && messages[0].role === 'assistant';
    if ((messages.length > 0 && !hasOnlyWelcomeAssistant) || isSending) return;
    if (!setInputValue || !handleSendMessage) return;

    const fullCalcsForPrompt = calculations.fullAnalysis || calculations;

    const pricingFinancing = scenarioData.pricing_financing || {};
    const propertyInfo = scenarioData.property || {};

    const dealAddress = [
      propertyInfo.address,
      propertyInfo.city,
      propertyInfo.state,
      propertyInfo.zip
    ].filter(Boolean).join(', ');

    const promptPurchasePrice = pricingFinancing.price
      || pricingFinancing.purchase_price
      || 0;
    const promptYear1NOI = fullCalcsForPrompt.year1?.noi ?? 0;
    const promptCapRate = fullCalcsForPrompt.year1?.capRate != null
      ? fullCalcsForPrompt.year1.capRate
      : (promptPurchasePrice > 0 && promptYear1NOI > 0
          ? (promptYear1NOI / promptPurchasePrice) * 100
          : 0);
    const promptDSCR = fullCalcsForPrompt.year1?.dscr ?? 0;
    const promptCashOnCash = fullCalcsForPrompt.year1?.cashOnCash ?? 0;
    const promptDayOneCashFlow = fullCalcsForPrompt.year1?.cashFlowAfterFinancing
      ?? fullCalcsForPrompt.year1?.cashFlow
      ?? 0;
    const promptLeveredIRR = fullCalcsForPrompt.returns?.leveredIRR ?? 0;
    const promptEquityMultiple = fullCalcsForPrompt.returns?.equityMultiple ?? 0;

    const autoAnalysisPrompt = `You are Max, my AI real estate partner. You have access to the full underwriting model, all deal structures, value-add assumptions, exit scenarios, and market data for this specific property.

Deal context (for quick reference):
- Address: ${dealAddress || 'Not specified'}
- Purchase price: $${promptPurchasePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Year 1 NOI: $${promptYear1NOI.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Going-in cap rate: ${promptCapRate.toFixed(2)}%
- Year 1 DSCR: ${promptDSCR.toFixed(2)}x
- Year 1 cash-on-cash: ${promptCashOnCash.toFixed(2)}%
- Day-one cash flow after financing: $${promptDayOneCashFlow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Modeled hold IRR (levered): ${promptLeveredIRR.toFixed(2)}%
- Modeled equity multiple: ${promptEquityMultiple.toFixed(2)}x

Using ALL of the underlying scenario data and structures (Traditional, Seller Finance, Equity Partner, Seller Carry, Lease Option, and any others the model exposes), do the following in order:

1. DEAL VERDICT
   - Decide if this is a good deal, marginal deal, or bad deal based purely on the underwritten numbers (cash flow, cap rates, DSCR, IRR, equity multiple, value creation, etc.).
   - Be very direct: label it clearly as a \"Strong Buy\", \"Maybe / Needs Work\", or \"Probably a Pass\" and explain why in 3â€“5 bullet points.

2. BEST DEBT STRUCTURE FOR DAY-ONE CASH FLOW
   - Evaluate ALL available debt/financing structures in this model.
   - Prioritize day-one cash flow and risk (DSCR and actual dollars of monthly/annual cash flow).
   - Pick ONE structure you would personally use for this deal.
   - For that chosen structure, list: loan amount, equity required, DSCR, cash-on-cash, and day-one annual cash flow, plus 2â€“3 pros and 2â€“3 cons.

3. ACQUISITION PLAN
   - Lay out a step-by-step plan for how to acquire this property using your chosen structure.
   - Include negotiation strategy, target offer terms (price, down payment / option fee / seller carry, etc.), key contingencies, and an approximate timeline from LOI to close.

4. FIX-THE-DEAL SCENARIOS (NO DEAL IS DEAD BY DEFAULT)
   - If the deal is weak or negative on day-one cash flow at the current price, figure out how to make it work.
   - Either:
     a) Propose a lower max purchase price that would get to healthy day-one cash flow under at least one structure (give that price and resulting key metrics), OR
    b) Propose a creative structure (or blend of structures) -- e.g., deeper seller carry or lease option -- that gets to positive day-one cash flow.
   - Only call the deal truly \"dead\" if, even after changing price and using creative financing, the numbers are still clearly terrible. If that happens, explain exactly why.

5. SUMMARY FOR ME
   - End with a short, plain-English summary: what you would personally do if this were your own money, and what one question I should ask next to explore the deal further.`;

    setInputValue(autoAnalysisPrompt);
    setTimeout(() => handleSendMessage(), 500);
  }, [scenarioData, calculations, messages, isSending, setInputValue, handleSendMessage]);
  
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

      // Geocode address for map pin
      const coords = await geocodeAddress(address);

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
        const maxPageHeight = pageHeight - (margin * 2) - 10;
        
        while (yOffset < imgHeight) {
          if (!isFirstPage) {
            pdf.addPage();
          }
          isFirstPage = false;
          
          // Add header with tab name
          pdf.setFontSize(12);
          pdf.setFontStyle('bold');
          pdf.setTextColor(17, 24, 39);
          pdf.text(tab.name, margin, margin + 5);
          
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
            margin + 10,
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
  // PITCH DECK GENERATOR - Professional Investor Presentation
  // ========================================================================
  const handleGeneratePitchDeck = async () => {
    try {
      setIsExportingPDF(true);
      
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Extract all data
      const propertyData = scenarioData?.property || {};
      const financingData = scenarioData?.financing || {};
      const fullCalcs = calculations || scenarioData?.calculations || {};
      const yearlyData = fullCalcs?.yearly || [];
      const year1 = yearlyData[0] || {};
      const year5 = yearlyData[4] || {};
      const stabilized = fullCalcs?.stabilized || {};
      const financing = fullCalcs?.financing || {};
      const returns = fullCalcs?.returns || {};
      
      const address = [
        propertyData.address,
        propertyData.city,
        propertyData.state,
        propertyData.zip
      ].filter(Boolean).join(', ') || 'Property Address';
      
      const totalUnits = propertyData.total_units || propertyData.units || 0;
      const purchasePrice = financingData.purchase_price || propertyData.purchase_price || 0;
      const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;
      
      // Helper functions for PDF
      const addTitle = (text, y, size = 22) => {
        pdf.setFontSize(size);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(text, margin, y);
        return y + 8;
      };
      
      const addSection = (title, y, size = 14) => {
        pdf.setFontSize(size);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(59, 130, 246);
        pdf.text(title, margin, y);
        return y + 6;
      };
      
      const addText = (text, y, size = 10, bold = false) => {
        pdf.setFontSize(size);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setTextColor(55, 65, 81);
        pdf.text(text, margin, y);
        return y + 5;
      };
      
      const addMetricRow = (label, value, y, highlight = false) => {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(107, 114, 128);
        pdf.text(label, margin, y);
        
        pdf.setFont('helvetica', 'bold');
        if (highlight) {
          pdf.setTextColor(34, 197, 94); // Green
        } else {
          pdf.setTextColor(17, 24, 39); // Dark gray
        }
        pdf.text(value, pageWidth - margin, y, { align: 'right' });
        return y + 5;
      };
      
      const addBox = (x, y, width, height, fillColor = [249, 250, 251]) => {
        pdf.setFillColor(...fillColor);
        pdf.rect(x, y, width, height, 'F');
      };
      
      const checkPageBreak = (y, spaceNeeded = 30) => {
        if (y + spaceNeeded > pageHeight - margin) {
          pdf.addPage();
          return margin + 10;
        }
        return y;
      };
      
      // ======================
      // PAGE 1: COVER PAGE
      // ======================
      let yPos = 60;
      
      // Title
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text('INVESTMENT OPPORTUNITY', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text(address, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 30;
      
      // Key Metrics Box
      addBox(margin, yPos, contentWidth, 70, [239, 246, 255]);
      yPos += 8;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(59, 130, 246);
      pdf.text('DEAL HIGHLIGHTS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      const col1X = margin + 10;
      const col2X = pageWidth / 2 + 10;
      let col1Y = yPos;
      let col2Y = yPos;
      
      // Column 1
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Purchase Price', col1X, col1Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(fmt(purchasePrice), col1X, col1Y + 5);
      col1Y += 12;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text('Units', col1X, col1Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(String(totalUnits), col1X, col1Y + 5);
      col1Y += 12;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text('Cash-on-Cash (Yr 1)', col1X, col1Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(34, 197, 94);
      pdf.text(pct(returns?.cashOnCash_year1 || year1.cashOnCash || 0), col1X, col1Y + 5);
      
      // Column 2
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text('Price Per Unit', col2X, col2Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(fmt(pricePerUnit), col2X, col2Y + 5);
      col2Y += 12;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text('Going-In Cap Rate', col2X, col2Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(17, 24, 39);
      pdf.text(pct(fullCalcs?.inPlaceCapRate || year1.capRate || 0), col2X, col2Y + 5);
      col2Y += 12;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      pdf.text('5-Year IRR', col2X, col2Y);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(34, 197, 94);
      pdf.text(pct(returns?.irr || 0), col2X, col2Y + 5);
      
      yPos += 60;
      
      // Deal Structure
      yPos += 10;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(59, 130, 246);
      pdf.text('DEAL STRUCTURE', margin, yPos);
      yPos += 7;
      
      const structure = scenarioData?.recommended_structure || financingData.structure || 'Traditional Financing';
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);
      pdf.text(structure, margin, yPos);
      
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text('Confidential Investment Memorandum', pageWidth / 2, pageHeight - 10, { align: 'center' });
      pdf.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      
      // ======================
      // PAGE 2: EXECUTIVE SUMMARY
      // ======================
      pdf.addPage();
      yPos = margin + 10;
      
      yPos = addTitle('EXECUTIVE SUMMARY', yPos, 18);
      yPos += 5;
      
      yPos = addSection('Investment Thesis', yPos, 12);
      yPos = addText(`${totalUnits}-unit multifamily property located in ${propertyData.city || 'prime market'}, ${propertyData.state || ''}`, yPos);
      yPos = addText(`offering strong cash flow and value-add upside through strategic rent optimization`, yPos);
      yPos = addText(`and operational improvements.`, yPos);
      yPos += 5;
      
      yPos = addSection('Financial Overview', yPos, 12);
      yPos = addMetricRow('Purchase Price:', fmt(purchasePrice), yPos);
      yPos = addMetricRow('Down Payment (20%):', fmt(purchasePrice * 0.20), yPos);
      yPos = addMetricRow('Year 1 NOI:', fmt(year1.noi || stabilized.noi || 0), yPos);
      yPos = addMetricRow('Year 1 Cash Flow:', fmt(year1.annualCashFlow || 0), yPos, true);
      yPos = addMetricRow('Year 1 Cash-on-Cash:', pct(year1.cashOnCash || 0), yPos, true);
      yPos += 5;
      
      yPos = addSection('Return Projections (5-Year Hold)', yPos, 12);
      yPos = addMetricRow('Average Annual Cash-on-Cash:', pct(returns?.avgCashOnCash || 0), yPos, true);
      yPos = addMetricRow('IRR:', pct(returns?.irr || 0), yPos, true);
      yPos = addMetricRow('Equity Multiple:', `${(returns?.equityMultiple || 0).toFixed(2)}x`, yPos, true);
      yPos = addMetricRow('Projected Sale Price (Year 5):', fmt(returns?.saleProceeds || 0), yPos);
      yPos += 5;
      
      yPos = addSection('Value-Add Strategy', yPos, 12);
      const renovationBudget = scenarioData?.renovations?.budget || fullCalcs?.renovationBudget || 0;
      if (renovationBudget > 0) {
        yPos = addText(`â€¢ Renovation Budget: ${fmt(renovationBudget)}`, yPos);
        yPos = addText(`â€¢ Projected Rent Increase: ${pct(scenarioData?.renovations?.rentIncrease || 10)}`, yPos);
      } else {
        yPos = addText('â€¢ Operational efficiency improvements', yPos);
        yPos = addText('â€¢ Market-rate rent adjustments', yPos);
      }
      yPos = addText('â€¢ Enhanced resident services and amenities', yPos);
      
      // ======================
      // PAGE 3: PROPERTY DETAILS
      // ======================
      pdf.addPage();
      yPos = margin + 10;
      
      yPos = addTitle('PROPERTY OVERVIEW', yPos, 18);
      yPos += 5;
      
      yPos = addSection('Location', yPos, 12);
      yPos = addText(address, yPos, 10, true);
      yPos += 3;
      
      yPos = addSection('Property Details', yPos, 12);
      yPos = addMetricRow('Total Units:', String(totalUnits), yPos);
      yPos = addMetricRow('Building Square Feet:', (propertyData.sqft || 0).toLocaleString() + ' SF', yPos);
      yPos = addMetricRow('Year Built:', String(propertyData.year_built || 'N/A'), yPos);
      yPos = addMetricRow('Property Type:', propertyData.property_type || 'Multifamily', yPos);
      yPos += 5;
      
      yPos = addSection('Unit Mix', yPos, 12);
      const unitMix = propertyData.unit_mix || [];
      if (unitMix.length > 0) {
        unitMix.forEach(unit => {
          yPos = addMetricRow(`${unit.bedroom}BR / ${unit.bathroom}BA:`, `${unit.count} units @ ${fmt(unit.current_rent)}/mo`, yPos);
        });
      } else {
        yPos = addText('Detailed unit mix available upon request', yPos);
      }
      
      yPos += 5;
      yPos = addSection('Market Positioning', yPos, 12);
      yPos = addMetricRow('Current Avg Rent:', fmt(propertyData.avg_rent || 0) + '/month', yPos);
      yPos = addMetricRow('Market Avg Rent:', fmt(propertyData.market_rent || 0) + '/month', yPos);
      yPos = addMetricRow('Rent Upside:', pct(((propertyData.market_rent - propertyData.avg_rent) / propertyData.avg_rent * 100) || 0), yPos, true);
      
      // ======================
      // PAGE 4: FINANCIAL ANALYSIS
      // ======================
      pdf.addPage();
      yPos = margin + 10;
      
      yPos = addTitle('FINANCIAL ANALYSIS', yPos, 18);
      yPos += 5;
      
      yPos = addSection('Acquisition Costs', yPos, 12);
      yPos = addMetricRow('Purchase Price:', fmt(purchasePrice), yPos);
      yPos = addMetricRow('Closing Costs (3%):', fmt(purchasePrice * 0.03), yPos);
      yPos = addMetricRow('Renovation Budget:', fmt(renovationBudget), yPos);
      yPos = addMetricRow('Total Investment:', fmt(purchasePrice + (purchasePrice * 0.03) + renovationBudget), yPos, true);
      yPos += 5;
      
      yPos = addSection('Financing Structure', yPos, 12);
      const loanAmount = financing?.loanAmount || purchasePrice * 0.80;
      const downPayment = purchasePrice - loanAmount;
      yPos = addMetricRow('Loan Amount (80% LTV):', fmt(loanAmount), yPos);
      yPos = addMetricRow('Interest Rate:', pct(financing?.interestRate || 6.5), yPos);
      yPos = addMetricRow('Loan Term:', `${financing?.loanTermYears || 30} years`, yPos);
      if (financing?.ioYears > 0) {
        yPos = addMetricRow('IO Period:', `${financing.ioYears} years`, yPos);
        yPos = addMetricRow('IO Debt Service:', fmt(financing?.ioAnnualDebtService || 0), yPos);
        yPos = addMetricRow('Amortizing Debt Service:', fmt(financing?.amortizingAnnualDebtService || 0), yPos);
      } else {
        yPos = addMetricRow('Annual Debt Service:', fmt(financing?.annualDebtService || 0), yPos);
      }
      yPos += 5;
      
      yPos = addSection('Year 1 Operating Performance', yPos, 12);
      yPos = addMetricRow('Gross Potential Rent:', fmt(year1.grossPotentialRent || 0), yPos);
      yPos = addMetricRow('Vacancy Loss:', fmt((year1.grossPotentialRent || 0) * 0.05), yPos);
      yPos = addMetricRow('Effective Gross Income:', fmt(year1.effectiveGrossIncome || 0), yPos);
      yPos = addMetricRow('Operating Expenses:', fmt(year1.totalExpenses || 0), yPos);
      yPos = addMetricRow('Net Operating Income:', fmt(year1.noi || 0), yPos, true);
      yPos = addMetricRow('Annual Debt Service:', fmt(financing?.annualDebtService || 0), yPos);
      yPos = addMetricRow('Annual Cash Flow:', fmt(year1.annualCashFlow || 0), yPos, true);
      
      // ======================
      // PAGE 5: 5-YEAR PROJECTIONS
      // ======================
      pdf.addPage();
      yPos = margin + 10;
      
      yPos = addTitle('5-YEAR PROJECTIONS', yPos, 18);
      yPos += 5;
      
      // Table header
      addBox(margin, yPos, contentWidth, 8, [59, 130, 246]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('Year', margin + 2, yPos + 5);
      pdf.text('NOI', margin + 25, yPos + 5);
      pdf.text('Cash Flow', margin + 55, yPos + 5);
      pdf.text('CoC Return', margin + 90, yPos + 5);
      pdf.text('DSCR', margin + 125, yPos + 5);
      pdf.text('Property Value', margin + 150, yPos + 5);
      yPos += 8;
      
      // Table rows
      yearlyData.slice(0, 5).forEach((yearData, index) => {
        const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
        addBox(margin, yPos, contentWidth, 7, bgColor);
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        pdf.text(`Year ${index + 1}`, margin + 2, yPos + 5);
        pdf.text(fmt(yearData.noi || 0), margin + 25, yPos + 5);
        pdf.text(fmt(yearData.annualCashFlow || 0), margin + 55, yPos + 5);
        pdf.text(pct(yearData.cashOnCash || 0), margin + 90, yPos + 5);
        pdf.text((yearData.dscr || 0).toFixed(2), margin + 125, yPos + 5);
        pdf.text(fmt(yearData.propertyValue || 0), margin + 150, yPos + 5);
        yPos += 7;
      });
      
      yPos += 8;
      yPos = addSection('Exit Strategy (Year 5)', yPos, 12);
      yPos = addMetricRow('Projected Sale Price:', fmt(returns?.saleProceeds || 0), yPos);
      yPos = addMetricRow('Remaining Loan Balance:', fmt(returns?.remainingLoanBalance || 0), yPos);
      yPos = addMetricRow('Net Proceeds:', fmt((returns?.saleProceeds || 0) - (returns?.remainingLoanBalance || 0)), yPos, true);
      yPos = addMetricRow('Total Return:', fmt(returns?.totalProfit || 0), yPos, true);
      
      // ======================
      // PAGE 6: INVESTMENT SUMMARY
      // ======================
      pdf.addPage();
      yPos = margin + 10;
      
      yPos = addTitle('INVESTMENT SUMMARY', yPos, 18);
      yPos += 5;
      
      addBox(margin, yPos, contentWidth, 90, [254, 249, 195]);
      yPos += 8;
      
      yPos = addSection('Why This Deal Makes Sense', yPos, 14);
      yPos += 3;
      
      yPos = addText(`âœ“ Strong ${pct(year1.cashOnCash || 0)} Year 1 Cash-on-Cash Return`, yPos, 11, true);
      yPos = addText(`âœ“ Attractive ${pct(fullCalcs?.inPlaceCapRate || 0)} Going-In Cap Rate`, yPos, 11, true);
      yPos = addText(`âœ“ ${pct(returns?.irr || 0)} IRR with ${(returns?.equityMultiple || 0).toFixed(2)}x Equity Multiple`, yPos, 11, true);
      yPos = addText(`âœ“ Value-Add Opportunity via Rent Optimization`, yPos, 11, true);
      yPos = addText(`âœ“ Located in ${propertyData.city || 'High-Growth'} Market`, yPos, 11, true);
      yPos = addText(`âœ“ Professional Property Management in Place`, yPos, 11, true);
      
      yPos += 10;
      yPos = addSection('Next Steps', yPos, 12);
      yPos = addText('1. Schedule property tour and market analysis review', yPos);
      yPos = addText('2. Complete due diligence (30 days)', yPos);
      yPos = addText('3. Finalize financing and close transaction', yPos);
      yPos = addText('4. Implement value-add business plan', yPos);
      
      yPos += 10;
      yPos = addSection('Investment Structure', yPos, 12);
      yPos = addText(structure, yPos, 10, true);
      yPos += 3;
      yPos = addText('Equity raised will be used for down payment, closing costs, and initial', yPos);
      yPos = addText('renovations. Cash flow distributed quarterly to investors.', yPos);
      
      // Save PDF
      const fileName = `Pitch_Deck_${address.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      alert('Pitch deck generated successfully!');
      
    } catch (error) {
      console.error('Pitch deck generation error:', error);
      alert('Failed to generate pitch deck: ' + error.message);
    } finally {
      setIsExportingPDF(false);
    }
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
  const annualDebtService = (hasMultiLoanStack && scenarioData.financing?.annual_debt_service > 0)
    ? scenarioData.financing.annual_debt_service
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

  // â•â•â• VALUE-ADD ADJUSTMENTS -- computed at component level for all tabs â•â•â•
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

  // Tabs with icons - EXPANDED
  const tabs = [
    { id: 'summary', label: 'Documents', icon: FileText, accent: '#6366f1' },
    { id: 'scenario-sheet', label: 'Scenario Sheet', icon: FileSpreadsheet, accent: '#8b5cf6' },
    { id: 't12-auditor', label: 'OM Auditor', icon: FileBarChart, accent: '#dc2626' },
    { id: 'compressed', label: 'Overview', icon: LayoutDashboard, accent: '#3b82f6' },
    { id: 'deal-structure', label: 'Deal Structure', icon: Layers, accent: '#0ea5e9' },
    { id: 'expenses-v2', label: 'Expenses', icon: FileText, accent: '#14b8a6' },
    { id: 'value-add', label: 'Value-Add', icon: TrendingUp, accent: '#10b981' },
    { id: 'exit-strategy', label: 'Exit Strategy', icon: TrendingUp, accent: '#f59e0b' },
    { id: 'amortization', label: 'Amortization', icon: Calculator, accent: '#f97316' },
    { id: 'rent-roll', label: 'Rent Roll', icon: Users, accent: '#ef4444' },
    { id: 'costseg', label: 'Cost Seg', icon: Calculator, accent: '#ec4899' },
    { id: 'waterfall', label: 'Waterfall', icon: Wallet, accent: '#6366f1' },
    { id: 'sensitivity', label: 'Stress Test', icon: Activity, accent: '#ef4444' },
    { id: 'market-data', label: 'Market Data', icon: BarChart3, accent: '#a855f7' }
  ];

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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      
      case 'summary':
        return (
          <DocumentAnalysisTab
            dealId={dealId}
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            existingAnalysis={documentAnalysis}
            onAnalysisGenerated={(analysis) => {
              setDocumentAnalysis(analysis);
              // Also persist into scenarioData so it saves when pushing to pipeline
              if (onEditData) {
                onEditData('document_analysis', analysis);
              }
            }}
          />
        );

      case 'scenario-sheet':
        return (
          <div style={{ padding: '16px', backgroundColor: '#f9fafb' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <ScenarioSheet scenarioData={scenarioData} calculations={fullCalcs} marketData={marketData} />
            </div>
          </div>
        );

      case 't12-auditor':
        return (
          <T12AuditorTab
            scenarioData={scenarioData}
            dealId={dealId}
          />
        );

      case 'spreadsheet':
        return (
          <div style={{ height: '100vh' }}>
            <UnderwritingTablePage
              initialScenarioData={scenarioData}
              initialCalculations={calculations}
            />
          </div>
        );

      case 'property':
        // Property Metrics Comparison
        return (
          <div style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
            {/* OLD KEY METRICS - REMOVE THIS SECTION */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'none' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>Key Metrics Comparison</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>Metric</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Current</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Pro Forma</div>
                </div>
                
                {/* Monthly Cashflow */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Monthly Cashflow</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: ((noiT12 - annualDebtService) / 12) >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(noiT12 ? ((noiT12 - annualDebtService) / 12) : 0)}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                    {fmt(fullCalcs.year1?.cashFlow || 0)}
                  </div>
                </div>
                
                {/* Annualized */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Annualized</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fmt(noiT12 ? (noiT12 - annualDebtService) : 0)}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fmt((fullCalcs.year1?.cashFlow || 0) * 12)}
                  </div>
                </div>
                
                {/* Annualized ROI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Annualized ROI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {noiT12 && scenarioData.pricing_financing?.down_payment 
                      ? `${(((noiT12 - annualDebtService) / scenarioData.pricing_financing.down_payment) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px', color: '#ef4444' }}>
                    {fullCalcs.returns?.leveredIRR != null ? `${fullCalcs.returns.leveredIRR.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
                
                {/* Cap Rate */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Cap Rate</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {purchasePrice > 0 && noiT12 > 0 ? `${((noiT12 / purchasePrice) * 100).toFixed(2)}%` : 'N/A'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.capRate ? `${fullCalcs.year1.capRate.toFixed(2)}%` : '5.28%'}
                  </div>
                </div>
                
                {/* DSCR */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>DSCR</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {annualDebtService > 0 && noiT12 > 0 ? `${(noiT12 / annualDebtService).toFixed(2)}x` : 'N/A'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.dscr ? `${fullCalcs.year1.dscr.toFixed(2)}x` : '1.03x'}
                  </div>
                </div>
                
                {/* Cash on Cash */}
                <div style={{ display: 'flex', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Cash on Cash</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {noiT12 && scenarioData.pricing_financing?.down_payment 
                      ? `${(((noiT12 - annualDebtService) / scenarioData.pricing_financing.down_payment) * 100).toFixed(1)}%`
                      : '13.1%'}
                  </div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>
                    {fullCalcs.year1?.cashOnCash ? `${fullCalcs.year1.cashOnCash.toFixed(1)}%` : '0.6%'}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Financial Breakdown */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>Detailed Financial Breakdown</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>Item</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Current</div>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#1f2937', textAlign: 'right', fontSize: '13px' }}>Pro Forma</div>
                </div>
                
                {/* Gross Rents */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Gross Rents</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.pnl?.effective_gross_income || scenarioData.pnl?.gross_potential_rent || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.potentialGrossIncome || 0)}</div>
                </div>
                
                {/* Property Management */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Property Management</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.management || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.08 : 0)}</div>
                </div>
                
                {/* Taxes */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Taxes</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.taxes || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.15 : 0)}</div>
                </div>
                
                {/* Insurance */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Insurance</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.insurance || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.02 : 0)}</div>
                </div>
                
                {/* Utilities */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Utilities</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.utilities || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.08 : 0)}</div>
                </div>
                
                {/* Vacancy Reserve */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Vacancy Reserve</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.pnl?.vacancy_amount || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.vacancyLoss || 0)}</div>
                </div>
                
                {/* Maintenance */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Maintenance</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(scenarioData.expenses?.repairs_maintenance || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses ? fullCalcs.year1.totalOperatingExpenses * 0.10 : 0)}</div>
                </div>
                
                {/* Monthly NOI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#111827', fontSize: '14px' }}>Monthly NOI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt((scenarioData.pnl?.noi || 0) / 12)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt((fullCalcs.year1?.noi || 0) / 12)}</div>
                </div>
                
                {/* Yearly NOI */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '700', color: '#111827', fontSize: '14px' }}>Yearly NOI</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt(scenarioData.pnl?.noi || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>{fmt(fullCalcs.year1?.noi || 0)}</div>
                </div>
                
                {/* Mortgage */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Mortgage</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.financing?.loanAmount || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.financing?.loanAmount || 0)}</div>
                </div>
                
                {/* Sale Price */}
                <div style={{ display: 'flex', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <div style={{ flex: '1', padding: '12px 20px', fontWeight: '500', color: '#111827', fontSize: '14px' }}>Sale Price</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.acquisition?.purchasePrice || 0)}</div>
                  <div style={{ flex: '1', padding: '12px 20px', textAlign: 'right', fontSize: '14px' }}>{fmt(fullCalcs.acquisition?.purchasePrice || 0)}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'characteristics':
        const pnl = scenarioData.pnl || {};
        const expensesData = scenarioData.expenses || {};
        const unitMix = scenarioData.unit_mix || [];
        const financing = scenarioData.financing || {};
        
        // Calculate loan amount from price and down payment if not in fullCalcs
        const charPrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const charDownPct = pricing_financing?.down_payment_pct || 0;
        const charLtv = pricing_financing?.ltv || 0;
        let charLoanAmount = fullCalcs?.financing?.loanAmount || pricing_financing?.loan_amount || 0;
        if (!charLoanAmount && charPrice > 0) {
          if (charDownPct > 0) {
            charLoanAmount = charPrice * (1 - charDownPct / 100);
          } else if (charLtv > 0) {
            charLoanAmount = charPrice * (charLtv / 100);
          }
        }
        
        // Property metrics for this case
        const charTotalUnits = property?.total_units || property?.units || 0;
        // Normalize occupancy for characteristics view (decimal or percent)
        let charOccupancyRate = 0.909;
        if (property?.occupancy_rate != null) {
          charOccupancyRate = property.occupancy_rate > 1 ? property.occupancy_rate / 100 : property.occupancy_rate;
        } else if (property?.occupancy != null) {
          charOccupancyRate = property.occupancy > 1 ? property.occupancy / 100 : property.occupancy;
        }
        const charPricePerUnit = charTotalUnits > 0 ? (pricing_financing?.price || 0) / charTotalUnits : 0;
        const charPricePerSqFt = (property?.total_sq_ft || property?.rba_sqft) > 0 ? (pricing_financing?.price || 0) / (property?.total_sq_ft || property?.rba_sqft) : 0;
        const charAvgUnitSize = charTotalUnits > 0 && (property?.total_sq_ft || property?.rba_sqft) > 0 ? Math.round((property?.total_sq_ft || property?.rba_sqft) / charTotalUnits) : 0;
        
        // Input style helper - styled like screenshot
        const inputStyle = { 
          width: '100%', 
          padding: '8px 12px', 
          border: '2px solid #e5e7eb', 
          borderRadius: '8px', 
          fontSize: '14px',
          textAlign: 'right',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s'
        };
        const inputStyleLeft = { 
          ...inputStyle,
          textAlign: 'left'
        };
        const readOnlyStyle = {
          ...inputStyle,
          backgroundColor: '#f9fafb',
          color: '#374151',
          border: '2px solid #e5e7eb'
        };
        const labelStyle = { 
          fontSize: '13px', 
          color: '#374151', 
          marginBottom: '6px',
          display: 'block',
          fontWeight: '600'
        };
        const selectStyle = {
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer'
        };
        
        // Calculate totals
        const totalUtilitiesMonthly = ((expensesData.gas || 0) + (expensesData.electrical || 0) + (expensesData.water || 0) + (expensesData.sewer || 0) + (expensesData.trash || 0)) / 12;
        
        // ====================================================================
        // SMART MONTHLY VS ANNUAL EXPENSE DETECTION
        // If a value looks suspiciously low for an annual amount, flag it
        // Uses per-unit thresholds to detect monthly values
        // ====================================================================
        const detectMonthlyExpenses = () => {
          const units = charTotalUnits || 1;
          const flags = [];
          
          // Per-unit annual minimums (if below these, likely monthly)
          const thresholds = {
            taxes: { min: 400, label: 'Real Estate Taxes' },
            insurance: { min: 200, label: 'Insurance' },
            repairs: { min: 150, label: 'Repairs & Maintenance' },
            management: { min: 100, label: 'Management Fees' },
            payroll: { min: 100, label: 'Payroll' },
            other: { min: 50, label: 'Other Expenses' },
          };
          
          for (const [key, info] of Object.entries(thresholds)) {
            const val = expensesData[key] || 0;
            if (val <= 0) continue;
            const perUnit = val / units;
            // If per-unit annual amount is below threshold AND the value
            // times 12 would be above it, it's likely a monthly amount
            if (perUnit < info.min && (perUnit * 12) >= info.min) {
              flags.push({ key, label: info.label, value: val, annualized: val * 12 });
            }
          }
          
          // Also check utilities -- they're stored annual, but if per-unit < $30/yr total, suspicious
          const utilKeys = ['gas', 'electrical', 'water', 'sewer', 'trash'];
          for (const key of utilKeys) {
            const val = expensesData[key] || 0;
            if (val <= 0) continue;
            const perUnit = val / units;
            if (perUnit < 20 && (perUnit * 12) >= 20) {
              flags.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), value: val, annualized: val * 12, isUtility: true });
            }
          }
          
          return flags;
        };
        
        const monthlyFlags = detectMonthlyExpenses();
        const grossPotentialRent = pnl.gross_potential_rent || pnl.scheduled_gross_rent_current || scenarioData.income?.gross_potential_rent || fullCalcs?.year1?.potentialGrossIncome || 0;
        const otherIncome = pnl.other_income || scenarioData.income?.other_income || 0;

        // Derive default vacancy, management, and CapEx rates from parsed data so sliders arenâ€™t zero
        let vacancyFraction = 0;
        if (pnl.vacancy_rate != null) {
          vacancyFraction = pnl.vacancy_rate > 1 ? pnl.vacancy_rate / 100 : pnl.vacancy_rate;
        } else if (expensesData.vacancy_rate != null) {
          vacancyFraction = expensesData.vacancy_rate > 1 ? expensesData.vacancy_rate / 100 : (expensesData.vacancy_rate / 100);
        } else {
          vacancyFraction = 0.05;
        }
        const vacancyRatePct = expensesData.vacancy_rate != null
          ? expensesData.vacancy_rate
          : (vacancyFraction * 100);

        let managementRatePct = expensesData.management_rate;
        if (managementRatePct == null) {
          const managementAnnual = expensesData.management || 0;
          if (grossPotentialRent > 0 && managementAnnual > 0) {
            managementRatePct = (managementAnnual / grossPotentialRent) * 100;
          }
        }
        if (managementRatePct == null) {
          managementRatePct = 5;
        }

        let capexRatePct = expensesData.capex_rate;
        if (capexRatePct == null) {
          const capexMonthly = expensesData.capex || scenarioData.expenses?.capex || 0;
          const monthlyGpr = (pnl.gross_potential_rent || grossPotentialRent) / 12 || 0;
          if (monthlyGpr > 0 && capexMonthly > 0) {
            capexRatePct = (capexMonthly / monthlyGpr) * 100;
          } else if (expensesData.capex_pct != null) {
            capexRatePct = expensesData.capex_pct;
          }
        }
        if (capexRatePct == null) {
          capexRatePct = 5;
        }

        const effectiveGrossIncome = pnl.effective_gross_income || pnl.effective_gross_income_current || fullCalcs?.year1?.effectiveGrossIncome || (grossPotentialRent - (grossPotentialRent * vacancyRatePct / 100) + otherIncome);
        const totalInitialCash = (fullCalcs.financing?.totalEquityRequired || 0) + 
          ((pricing_financing?.price || 0) * ((scenarioData.acquisition_costs?.closing_costs_pct || 0) / 100)) +
          (scenarioData.acquisition_costs?.rehab_cost || 0);
        
        return (
          <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '0 20px 40px' }}>
            {/* Investment Memorandum Header */}
            <div style={{ background: 'linear-gradient(135deg, #2d5a7b 0%, #1e3a5f 100%)', padding: '16px 24px', color: 'white', marginBottom: '20px', borderRadius: '0 0 8px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', opacity: 0.9 }}>INVESTMENT MEMORANDUM</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>Prepared by CRE Valuation Pro â€¢ Confidential Investment Memorandum</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', opacity: 0.9 }}>TOTAL CAPITALIZATION</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>{fmt(totalInitialCash)}</div>
                </div>
              </div>
            </div>

            {/* Property Overview Section with EDITABLE fields */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>1</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Home size={20} color="#374151" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROPERTY OVERVIEW</h3>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                {/* Asset Details - EDITABLE */}
                <div style={{ backgroundColor: '#e5e7eb', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ASSET DETAILS</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Property Type</label>
                      <input type="text" style={{ ...inputStyleLeft, fontSize: '13px', fontWeight: '600' }} value={property?.property_type || ''} 
                        onChange={(e) => handleFieldChange('property.property_type', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Year Built</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.year_built || ''} 
                        onChange={(e) => handleFieldChange('property.year_built', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Total Units</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.units || ''} 
                        onChange={(e) => handleFieldChange('property.units', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Buildings</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.buildings || ''} 
                        onChange={(e) => handleFieldChange('property.buildings', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ ...labelStyle, fontSize: '11px' }}>Total Sq Ft</label>
                      <input type="number" style={{ ...inputStyle, fontSize: '13px', fontWeight: '600' }} value={property?.rba_sqft || ''} 
                        onChange={(e) => handleFieldChange('property.rba_sqft', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
                
                {/* Occupancy Rate */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>OCCUPANCY RATE</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{(charOccupancyRate * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{Math.round(charOccupancyRate * charTotalUnits)} of {charTotalUnits} units</div>
                </div>
                
                {/* Price per Unit */}
                <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRICE PER UNIT</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1 }}>${charPricePerUnit.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>acquisition basis</div>
                </div>
                
                {/* Price per Sq Ft & Avg Unit Size */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRICE PER SQ FT</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1 }}>${charPricePerSqFt.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>building area</div>
                  </div>
                  <div style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AVG UNIT SIZE</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1 }}>{charAvgUnitSize.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>sq ft per unit</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unit Mix & Rent Analysis Section - EDITABLE */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>2</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart size={20} color="#374151" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>UNIT MIX & RENT ANALYSIS</h3>
                </div>
              </div>
              
              <div style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1f2937', color: 'white' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Unit Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Units</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Avg Sq Ft</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Current Rent</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Market Rent</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>Upside</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.length > 0 ? unitMix.map((unit, idx) => {
                      const currentRent = unit.rent_current || unit.current_rent || unit.rent || 0;
                      const marketRent = unit.rent_market || unit.market_rent || currentRent;
                      const upside = marketRent - currentRent;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{unit.unit_type || unit.type || `${idx + 1} Bed - ${idx + 1} Bath`}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>{unit.units || unit.count || 1}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{unit.unit_sf || unit.sqft || '850'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#111827' }}>${currentRent.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#2563eb' }}>${marketRent.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: upside > 0 ? '#10b981' : '#6b7280' }}>
                            {upside > 0 ? `+$${upside.toLocaleString()}` : '$0'}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No unit mix data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ALL EDITABLE FIELDS SECTION - Proforma and More */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>Property Details & Financials</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Property Information */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Information</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Address</label>
                      <input type="text" style={inputStyleLeft} value={property?.address || ''} 
                        onChange={(e) => handleFieldChange('property.address', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>City</label>
                      <input type="text" style={inputStyleLeft} value={property?.city || ''} 
                        onChange={(e) => handleFieldChange('property.city', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>State</label>
                        <input type="text" style={inputStyleLeft} value={property?.state || ''} 
                          onChange={(e) => handleFieldChange('property.state', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>ZIP</label>
                        <input type="text" style={inputStyle} value={property?.zip || ''} 
                          onChange={(e) => handleFieldChange('property.zip', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Land Area (Acres)</label>
                      <input type="number" step="0.01" style={inputStyle} value={property?.land_area_acres || ''} 
                        onChange={(e) => handleFieldChange('property.land_area_acres', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>

                {/* Pricing & Financing */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pricing & Financing</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Purchase Price *</label>
                      <input type="number" style={inputStyle} value={pricing_financing?.price || ''} 
                        onChange={(e) => handleFieldChange('pricing_financing.price', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Down Payment %</label>
                        <input type="number" style={inputStyle} value={(100 - (pricingFinancing.ltv || 75)).toFixed(1)} 
                          onChange={(e) => handleFieldChange('pricing_financing.ltv', 100 - (parseFloat(e.target.value) || 0))} />
                      </div>
                      <div>
                        <label style={labelStyle}>LTV %</label>
                        <input type="number" style={inputStyle} value={pricingFinancing.ltv || 75} 
                          onChange={(e) => handleFieldChange('pricing_financing.ltv', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Interest Rate %</label>
                      <input type="number" step="0.1" style={inputStyle} value={pricingFinancing.interest_rate || 6} 
                        onChange={(e) => handleFieldChange('pricing_financing.interest_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Term (Years)</label>
                        <input type="number" style={inputStyle} value={pricingFinancing.term_years || pricingFinancing.amortization_years || 30} 
                          onChange={(e) => handleFieldChange('pricing_financing.term_years', parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Amort (Years)</label>
                        <input type="number" style={inputStyle} value={financing.amortization_years || 30} 
                          onChange={(e) => handleFieldChange('pricing_financing.amortization_years', parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>IO Period (Years)</label>
                      <input type="number" min="0" style={inputStyle} value={financing.io_years || 0} 
                        onChange={(e) => handleFieldChange('financing.io_years', parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Loan Amount</label>
                      <input type="number" style={readOnlyStyle} value={charLoanAmount || ''} readOnly />
                    </div>
                  </div>
                </div>

                {/* Income */}
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Income</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Gross Potential Rent (Annual) *</label>
                      <input type="number" style={inputStyle} value={grossPotentialRent || ''} 
                        onChange={(e) => handleFieldChange('income.gross_potential_rent', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Other Income (Annual)</label>
                      <input type="number" style={inputStyle} value={otherIncome || ''} 
                        onChange={(e) => handleFieldChange('income.other_income', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Effective Gross Income</label>
                      <input type="number" style={readOnlyStyle} value={Math.round(effectiveGrossIncome)} readOnly />
                    </div>
                    <div>
                      <label style={labelStyle}>Vacancy Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        style={inputStyle}
                        value={vacancyRatePct || ''}
                        onChange={(e) => handleFieldChange('expenses.vacancy_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Property Management (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        style={inputStyle}
                        value={managementRatePct || ''}
                        onChange={(e) => handleFieldChange('expenses.management_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operating Expenses</h4>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    All values stored as <strong>annual</strong>. Toggle per field if entering monthly.
                  </div>
                </div>
                
                {/* Monthly detection warning */}
                {monthlyFlags.length > 0 && (
                  <div style={{ 
                    padding: '10px 14px', 
                    backgroundColor: '#fffbeb', 
                    borderRadius: '8px', 
                    border: '1px solid #fbbf24',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '14px' }}>âš ï¸</span>
                    <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
                      {monthlyFlags.length} value(s) look like monthly amounts.
                    </span>
                    <button
                      onClick={() => {
                        monthlyFlags.forEach(flag => {
                          handleFieldChange(`expenses.${flag.key}`, flag.annualized);
                        });
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'white',
                        backgroundColor: '#d97706',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Convert All to Annual (Ã—12)
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { key: 'taxes', label: 'Real Estate Taxes' },
                    { key: 'insurance', label: 'Insurance' },
                    { key: 'repairs', label: 'Repairs & Maintenance' },
                    { key: 'management', label: 'Management Fees' },
                    { key: 'payroll', label: 'Payroll' },
                    { key: 'admin', label: 'General & Admin' },
                    { key: 'marketing', label: 'Marketing' },
                    { key: 'other', label: 'Other Expenses' },
                  ].map(({ key, label }) => {
                    const isMonthly = expenseMonthlyMode[key] || false;
                    const annualValue = expensesData[key] || 0;
                    const displayValue = isMonthly ? Math.round(annualValue / 12) : annualValue;
                    const isFlagged = monthlyFlags.some(f => f.key === key);
                    
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>{label}</label>
                          <div style={{ 
                            display: 'flex', 
                            borderRadius: '4px', 
                            overflow: 'hidden', 
                            border: '1px solid #d1d5db',
                            fontSize: '9px',
                            fontWeight: 700
                          }}>
                            <button
                              onClick={() => setExpenseMonthlyMode(prev => ({ ...prev, [key]: false }))}
                              style={{
                                padding: '2px 6px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: !isMonthly ? '#1e3a5f' : '#f3f4f6',
                                color: !isMonthly ? 'white' : '#6b7280'
                              }}
                            >
                              ANN
                            </button>
                            <button
                              onClick={() => setExpenseMonthlyMode(prev => ({ ...prev, [key]: true }))}
                              style={{
                                padding: '2px 6px',
                                border: 'none',
                                borderLeft: '1px solid #d1d5db',
                                cursor: 'pointer',
                                backgroundColor: isMonthly ? '#1e3a5f' : '#f3f4f6',
                                color: isMonthly ? 'white' : '#6b7280'
                              }}
                            >
                              MO
                            </button>
                          </div>
                        </div>
                        <input 
                          type="number" 
                          style={{
                            ...inputStyle,
                            borderColor: isFlagged ? '#fbbf24' : '#e5e7eb',
                            backgroundColor: isFlagged ? '#fffbeb' : 'white'
                          }} 
                          value={displayValue || ''} 
                          onChange={(e) => {
                            const rawVal = parseFloat(e.target.value) || 0;
                            const annualVal = isMonthly ? rawVal * 12 : rawVal;
                            handleFieldChange(`expenses.${key}`, annualVal);
                          }} 
                        />
                        {annualValue > 0 && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', textAlign: 'right' }}>
                            {isMonthly 
                              ? `= $${annualValue.toLocaleString()}/yr` 
                              : `= $${Math.round(annualValue / 12).toLocaleString()}/mo`
                            }
                            {charTotalUnits > 0 && ` Â· $${Math.round(annualValue / charTotalUnits).toLocaleString()}/unit`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* CapEx Rate + Total Utilities row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={labelStyle}>CapEx Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      style={inputStyle}
                      value={capexRatePct || ''}
                      onChange={(e) => handleFieldChange('expenses.capex_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Utilities (Annual)</label>
                    <input type="number" style={readOnlyStyle} value={Math.round(totalUtilitiesMonthly * 12)} readOnly />
                  </div>
                </div>
              </div>

              {/* Utilities Breakdown */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utilities</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  {[
                    { key: 'gas', label: 'Gas' },
                    { key: 'electrical', label: 'Electrical' },
                    { key: 'water', label: 'Water' },
                    { key: 'sewer', label: 'Sewer' },
                    { key: 'trash', label: 'Trash' },
                  ].map(({ key, label }) => {
                    const isMonthly = expenseMonthlyMode[key] !== undefined ? expenseMonthlyMode[key] : true; // default monthly for utilities
                    const annualValue = expensesData[key] || 0;
                    const displayValue = isMonthly ? Math.round(annualValue / 12) : annualValue;
                    const isFlagged = monthlyFlags.some(f => f.key === key);
                    
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>{label}</label>
                          <div style={{ 
                            display: 'flex', 
                            borderRadius: '4px', 
                            overflow: 'hidden', 
                            border: '1px solid #d1d5db',
                            fontSize: '9px',
                            fontWeight: 700
                          }}>
                            <button
                              onClick={() => setExpenseMonthlyMode(prev => ({ ...prev, [key]: false }))}
                              style={{
                                padding: '2px 6px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: !isMonthly ? '#1e3a5f' : '#f3f4f6',
                                color: !isMonthly ? 'white' : '#6b7280'
                              }}
                            >
                              ANN
                            </button>
                            <button
                              onClick={() => setExpenseMonthlyMode(prev => ({ ...prev, [key]: true }))}
                              style={{
                                padding: '2px 6px',
                                border: 'none',
                                borderLeft: '1px solid #d1d5db',
                                cursor: 'pointer',
                                backgroundColor: isMonthly ? '#1e3a5f' : '#f3f4f6',
                                color: isMonthly ? 'white' : '#6b7280'
                              }}
                            >
                              MO
                            </button>
                          </div>
                        </div>
                        <input 
                          type="number" 
                          style={{
                            ...inputStyle,
                            borderColor: isFlagged ? '#fbbf24' : '#e5e7eb',
                            backgroundColor: isFlagged ? '#fffbeb' : 'white'
                          }} 
                          value={displayValue || ''} 
                          onChange={(e) => {
                            const rawVal = parseFloat(e.target.value) || 0;
                            const annualVal = isMonthly ? rawVal * 12 : rawVal;
                            handleFieldChange(`expenses.${key}`, annualVal);
                          }} 
                        />
                        {annualValue > 0 && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', textAlign: 'right' }}>
                            {isMonthly 
                              ? `= $${annualValue.toLocaleString()}/yr` 
                              : `= $${Math.round(annualValue / 12).toLocaleString()}/mo`
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Acquisition Costs */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acquisition Costs</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Realtor Fees (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.realtor_fee_pct || ''} 
                      onChange={(e) => handleFieldChange('acquisition_costs.realtor_fee_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Closing Costs (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.closing_costs_pct || ''} 
                      onChange={(e) => handleFieldChange('acquisition_costs.closing_costs_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Acquisition Fee (%)</label>
                    <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.acquisition_fee_pct || ''} 
                      onChange={(e) => handleFieldChange('acquisition_costs.acquisition_fee_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Rehab Cost</label>
                    <input type="number" style={inputStyle} value={scenarioData.acquisition_costs?.rehab_cost || ''} 
                      onChange={(e) => handleFieldChange('acquisition_costs.rehab_cost', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              {/* Proforma Section */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proforma Analysis</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #86efac' }}>
                    <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>NOI (Year 1)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{fmt(fullCalcs.year1?.noi)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #93c5fd' }}>
                    <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Cap Rate</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb' }}>{pct(fullCalcs.year1?.capRate)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #fcd34d' }}>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Cash-on-Cash</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{pct(fullCalcs.year1?.cashOnCash)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '2px solid #c4b5fd' }}>
                    <div style={{ fontSize: 11, color: '#6b21a8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>DSCR</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{fullCalcs.year1?.dscr?.toFixed(2) || 'N/A'}x</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fce7f3', borderRadius: '8px', border: '2px solid #f9a8d4' }}>
                    <div style={{ fontSize: 11, color: '#9f1239', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Annual Cash Flow</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#be123c' }}>{fmt(fullCalcs.year1?.cashFlow)}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#f0fdfa', borderRadius: '8px', border: '2px solid #5eead4' }}>
                    <div style={{ fontSize: 11, color: '#115e59', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Total Expenses</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f766e' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'expenses-v2':
        return (
          <ExpenseV2Tab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            onFieldChange={handleFieldChange}
            countyTaxEntry={countyTaxEntry}
          />
        );

      case 'value-add':
        return (
          <ValueAddTab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            onFieldChange={handleFieldChange}
            rubsEnabled={rubsEnabled}
            setRubsEnabled={setRubsEnabled}
            noiT12={noiT12}
            marketCapRate={marketCapRate}
            purchasePrice={purchasePrice}
            annualDebtService={annualDebtService}
            holdPeriod={selectedHoldPeriod}
          />
        );
      // OLD INLINE VALUE-ADD REMOVED -- now in ValueAddTab component

      case 'exit-strategy':
        return (
          <ExitStrategyTab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            onFieldChange={handleFieldChange}
          />
        );

      // OLD INLINE EXIT-STRATEGY REMOVED — now in ExitStrategyTab component

      case 'amortization':
        // Calculate loan amount from price and down payment if not available
        const amortPrice = pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const amortDownPct = pricing_financing?.down_payment_pct || 0;
        const amortLtv = pricing_financing?.ltv || 0;
        let amortLoanAmount = fullCalcs.financing?.loanAmount || scenarioData.pricing_financing?.loan_amount || 0;
        if (!amortLoanAmount && amortPrice > 0) {
          if (amortDownPct > 0) {
            amortLoanAmount = amortPrice * (1 - amortDownPct / 100);
          } else if (amortLtv > 0) {
            amortLoanAmount = amortPrice * (amortLtv / 100);
          }
        }
        
        // Get interest rate - check multiple sources
        // DealStructureTab writes financing.interest_rate as a percentage number (e.g. 5.96)
        // We need it as a decimal (0.0596) for amortization math
        let amortInterestRate = pricing_financing?.interest_rate || 0;
        if (!amortInterestRate || amortInterestRate === 0) {
          const financeRate = scenarioData.financing?.interest_rate || 0;
          if (financeRate > 0) {
            amortInterestRate = financeRate;
          }
        }
        if (!amortInterestRate || amortInterestRate === 0) {
          amortInterestRate = 6; // Default 6%
        }
        // Normalize: if > 1, it's a percentage like 5.96 â†’ convert to decimal 0.0596
        if (amortInterestRate > 1) {
          amortInterestRate = amortInterestRate / 100;
        }
        
        // Get loan term
        const loanTerm = pricing_financing?.term_years || pricing_financing?.amortization_years || scenarioData.financing?.loan_term_years || 30;
        const amortizationYears = pricing_financing?.amortization_years || scenarioData.financing?.amortization_years || loanTerm;
        
        // Calculate monthly and annual debt service
        const amortIOYears = fullCalcs.financing?.ioYears || scenarioData.financing?.io_years || 0;
        let monthlyDebtService = pricing_financing?.monthly_payment || fullCalcs.financing?.amortizingMonthlyPayment || fullCalcs.financing?.monthlyPayment || 0;
        let amortAnnualDebtService = pricing_financing?.annual_debt_service || fullCalcs.financing?.amortizingAnnualDebtService || fullCalcs.financing?.annualDebtService || 0;
        
        // IO period payment
        const ioMonthlyDS = amortLoanAmount > 0 && amortInterestRate > 0 ? (amortLoanAmount * amortInterestRate) / 12 : 0;
        const ioAnnualDS = ioMonthlyDS * 12;
        
        // If we have loan details but no payment, calculate it
        if ((!monthlyDebtService || monthlyDebtService === 0) && amortLoanAmount > 0 && amortInterestRate > 0 && amortizationYears > 0) {
          const monthlyRate = amortInterestRate / 12;
          const numPayments = amortizationYears * 12;
          monthlyDebtService = amortLoanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          amortAnnualDebtService = monthlyDebtService * 12;
        }
        
        // For display: show IO payment if currently in IO period
        const displayMonthlyDS = amortIOYears > 0 ? ioMonthlyDS : monthlyDebtService;
        const displayAnnualDS = amortIOYears > 0 ? ioAnnualDS : amortAnnualDebtService;
        
        // Loan Factor Rate = Monthly Payment per $1,000 of loan amount
        const loanFactorRate = (amortLoanAmount > 0 && monthlyDebtService > 0) ? (monthlyDebtService / amortLoanAmount) * 1000 : null;
        // DSCR for leverage insight — use year 1 debt service (IO if applicable)
        const capRateDecimal = capRate != null ? (capRate > 1 ? capRate / 100 : capRate) : (fullCalcs?.year1?.capRate != null ? (fullCalcs.year1.capRate > 1 ? fullCalcs.year1.capRate / 100 : fullCalcs.year1.capRate) : null);
        const y1DS = amortIOYears > 0 ? ioAnnualDS : amortAnnualDebtService;
        const amortDSCR = (y1DS > 0 && fullCalcs?.year1?.noi > 0) ? (fullCalcs.year1.noi / y1DS) : null;
        const dscrStatus = amortDSCR != null ? (amortDSCR >= 1.25 ? 'Strong' : amortDSCR >= 1.0 ? 'Adequate' : 'Below 1.0x') : '--';

        // Generate amortization schedule if not available
        let amortSchedule = fullCalcs.amortizationSchedule || [];
        if (amortSchedule.length === 0 && amortLoanAmount > 0 && amortInterestRate > 0 && amortizationYears > 0) {
          const monthlyRate = amortInterestRate / 12;
          const numPayments = amortizationYears * 12;
          const amortMonthlyPmt = amortLoanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          
          let balance = amortLoanAmount;
          let cumulativePrincipal = 0;
          
          for (let year = 1; year <= Math.min(amortizationYears + amortIOYears, loanTerm); year++) {
            let yearlyPrincipal = 0;
            let yearlyInterest = 0;
            const isIO = year <= amortIOYears;
            
            for (let month = 1; month <= 12; month++) {
              if (balance <= 0) break;
              const interestPayment = balance * monthlyRate;
              if (isIO) {
                yearlyInterest += interestPayment;
              } else {
                const principalPayment = Math.min(amortMonthlyPmt - interestPayment, balance);
                yearlyPrincipal += principalPayment;
                yearlyInterest += interestPayment;
                balance -= principalPayment;
              }
            }
            
            cumulativePrincipal += yearlyPrincipal;
            
            amortSchedule.push({
              year,
              payment: Math.round(yearlyPrincipal + yearlyInterest),
              principal: Math.round(yearlyPrincipal),
              interest: Math.round(yearlyInterest),
              balance: Math.round(Math.max(0, balance)),
              cumulativePrincipal: Math.round(cumulativePrincipal),
              isIO
            });
          }
        }

        // Neutral card style â€“ redesigned with colored left borders and tinted backgrounds
        const metricCards = [
          { label: 'LOAN AMOUNT', value: '$' + amortLoanAmount.toLocaleString(undefined, {maximumFractionDigits: 0}), color: '#3b82f6', bg: '#eff6ff' },
          { label: 'INTEREST RATE', value: (amortInterestRate * 100).toFixed(2) + '%', color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'LOAN TERM', value: loanTerm + ' Years', color: '#06b6d4', bg: '#ecfeff' },
          ...(amortIOYears > 0 ? [
            { label: 'IO PERIOD', value: amortIOYears + (amortIOYears === 1 ? ' Year' : ' Years'), color: '#7c3aed', bg: '#faf5ff', sub: 'Interest-Only' },
            { label: 'IO MONTHLY PAYMENT', value: '$' + ioMonthlyDS.toLocaleString(undefined, {maximumFractionDigits: 0}), color: '#7c3aed', bg: '#faf5ff', sub: 'Yrs 1\u2013' + amortIOYears },
            { label: 'AMORTIZING PAYMENT', value: '$' + monthlyDebtService.toLocaleString(undefined, {maximumFractionDigits: 0}) + '/mo', color: '#f59e0b', bg: '#fffbeb', sub: 'After IO' },
          ] : [
            { label: 'MONTHLY DEBT SERVICE', value: '$' + monthlyDebtService.toLocaleString(undefined, {maximumFractionDigits: 0}), color: '#f59e0b', bg: '#fffbeb' },
          ]),
          { label: 'ANNUAL DEBT SERVICE', value: '$' + displayAnnualDS.toLocaleString(undefined, {maximumFractionDigits: 0}), color: '#ef4444', bg: '#fef2f2', sub: amortIOYears > 0 ? 'Year 1 (IO)' : undefined },
          { label: 'CAP RATE', value: capRateDecimal != null ? (capRateDecimal * 100).toFixed(2) + '%' : '--', color: '#10b981', bg: '#ecfdf5' },
          { label: 'LOAN FACTOR RATE', value: loanFactorRate != null ? '$' + loanFactorRate.toFixed(2) + ' / $1K' : '--', color: '#6366f1', bg: '#eef2ff', sub: 'per $1,000 borrowed' },
          { label: 'DSCR', value: amortDSCR != null ? amortDSCR.toFixed(2) + 'x' : '--', color: amortDSCR != null && amortDSCR >= 1.25 ? '#10b981' : amortDSCR != null && amortDSCR >= 1.0 ? '#f59e0b' : '#ef4444', bg: amortDSCR != null && amortDSCR >= 1.25 ? '#ecfdf5' : amortDSCR != null && amortDSCR >= 1.0 ? '#fffbeb' : '#fef2f2', sub: dscrStatus },
        ];

        // â”€â”€ Interest Rate Stress Test computation â”€â”€
        const baseRatePct = amortInterestRate * 100;
        const stressRates = [baseRatePct - 1, baseRatePct - 0.5, baseRatePct, baseRatePct + 0.5, baseRatePct + 1];
        // NOI for cash flow calcs
        const stressNOI = fullCalcs?.year1?.noi || 0;
        // Down payment / equity
        const stressEquity = fullCalcs?.financing?.totalEquityRequired || fullCalcs?.financing?.downPayment ||
          (amortPrice > 0 && amortDownPct > 0 ? amortPrice * (amortDownPct / 100) : (amortPrice - amortLoanAmount)) || 0;

        const stressRows = stressRates.map(ratePct => {
          const r = ratePct / 100;
          const mr = r / 12;
          const n = amortizationYears * 12;
          const mp = amortLoanAmount > 0 && r > 0 && n > 0
            ? amortLoanAmount * (mr / (1 - Math.pow(1 + mr, -n)))
            : 0;
          const annualDS = mp * 12;
          const annualCF = stressNOI - annualDS;
          const monthlyCF = annualCF / 12;
          const coc = stressEquity > 0 ? (annualCF / stressEquity) * 100 : 0;
          const dscr = annualDS > 0 ? stressNOI / annualDS : 0;
          return { ratePct, mp, annualDS, annualCF, monthlyCF, coc, dscr };
        });

        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  marginRight: '12px'
                }}>9</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  LOAN AMORTIZATION SCHEDULE
                </h2>
              </div>

              {/* Redesigned Loan Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {metricCards.map((card, i) => (
                  <div key={i} style={{
                    backgroundColor: card.bg,
                    borderRadius: '12px',
                    padding: '16px 18px',
                    borderLeft: `4px solid ${card.color}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                  >
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827', lineHeight: 1.1 }}>{card.value}</div>
                    {card.sub && (
                      <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '700', color: card.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {card.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Loan Factor Rate + DSCR Explanation */}
              <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', color: '#374151' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Loan Factor Rate & DSCR</div>
                  <div style={{ marginBottom: 6 }}>
                    Loan Factor: {loanFactorRate != null ? ('$' + loanFactorRate.toFixed(2) + ' per $1,000 borrowed') : '--'} &nbsp;|&nbsp; DSCR: {amortDSCR != null ? (amortDSCR.toFixed(2) + 'x') : '--'}
                  </div>
                  <div style={{ color: '#111827' }}>
                    The <strong>Loan Factor Rate</strong> is your monthly payment per $1,000 of loan amount. Multiply by your loan amount (in thousands) to quickly estimate monthly debt service. Lower factor = cheaper debt.
                  </div>
                  <div style={{ marginTop: 4, color: '#111827' }}>
                    The <strong>DSCR</strong> (Debt Service Coverage Ratio) measures NOI Ã· Annual Debt Service. Lenders typically require 1.25x+. Above 1.25x is strong, 1.0â€“1.25x is adequate, below 1.0x means the property doesn't cover its debt.
                  </div>
                </div>
              </div>

              {/* â”€â”€ Sub-Tab Selector â”€â”€ */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
                {[
                  { id: 'schedule', label: 'Amortization Schedule' },
                  { id: 'stress', label: 'Interest Rate Stress Test' },
                ].map(st => (
                  <button key={st.id}
                    onClick={() => setAmortSubTab(st.id)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: amortSubTab === st.id ? 'white' : 'transparent',
                      color: amortSubTab === st.id ? '#111827' : '#6b7280',
                      border: 'none',
                      borderBottom: amortSubTab === st.id ? '3px solid #3b82f6' : '3px solid transparent',
                      fontSize: '13px',
                      fontWeight: amortSubTab === st.id ? '700' : '500',
                      cursor: 'pointer',
                      marginBottom: '-2px',
                      transition: 'all 0.15s',
                    }}
                  >{st.label}</button>
                ))}
              </div>

              {/* â”€â”€ Sub-Tab: Amortization Schedule â”€â”€ */}
              {amortSubTab === 'schedule' && (
                <>
                  {amortSchedule && amortSchedule.length > 0 ? (
                    <div style={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                    }}>
                      <div style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #e5e7eb', 
                        backgroundColor: '#f9fafb'
                      }}>
                        <h4 style={{ 
                          margin: 0, 
                          fontSize: '13px', 
                          fontWeight: '700', 
                          color: '#111827', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.08em' 
                        }}>Year-by-Year Breakdown</h4>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                              <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Year</th>
                              <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Total Payment</th>
                              <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Principal</th>
                              <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Interest</th>
                              <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Remaining Balance</th>
                              <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Cumulative Principal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {amortSchedule.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: row.isIO ? '#faf5ff' : 'white' }} 
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = row.isIO ? '#f3e8ff' : '#f9fafb'} 
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = row.isIO ? '#faf5ff' : 'white'}>
                                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                                  Year {row.year}
                                  {row.isIO && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#ede9fe', color: '#7c3aed' }}>IO</span>}
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151' }}>${row.payment.toLocaleString()}</td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${row.principal.toLocaleString()}</td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${row.interest.toLocaleString()}</td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${row.balance.toLocaleString()}</td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>${row.cumulativePrincipal.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                      <p style={{ color: '#6b7280', fontSize: '14px' }}>No amortization schedule available (interest-only loan or no loan)</p>
                    </div>
                  )}
                </>
              )}

              {/* â”€â”€ Sub-Tab: Interest Rate Stress Test â”€â”€ */}
              {amortSubTab === 'stress' && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                }}>
                  {/* Header bar */}
                  <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Interest Rate Sensitivity -- Scenario B (Realistic, Reassessed Tax)
                      </h4>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        Loan: ${amortLoanAmount.toLocaleString()} &bull; NOI: ${stressNOI.toLocaleString()} &bull; Equity: ${stressEquity > 0 ? '$' + stressEquity.toLocaleString() : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Stress test table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #1e3a5f', backgroundColor: '#f0f4f8' }}>METRIC</th>
                          {stressRows.map((sr, i) => {
                            const isBase = Math.abs(sr.ratePct - baseRatePct) < 0.01;
                            return (
                              <th key={i} style={{
                                padding: '14px 20px',
                                textAlign: 'center',
                                fontSize: '13px',
                                fontWeight: '800',
                                color: isBase ? '#ffffff' : '#1e3a5f',
                                backgroundColor: isBase ? '#dc2626' : '#f0f4f8',
                                borderBottom: isBase ? '2px solid #dc2626' : '2px solid #1e3a5f',
                                letterSpacing: '0.02em',
                                minWidth: '100px',
                              }}>
                                {sr.ratePct.toFixed(1)}%
                                {isBase && <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '2px', letterSpacing: '0.08em' }}>(BASE)</div>}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Monthly Payment', key: 'mp', fmt: v => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                          { label: 'Annual Debt Service', key: 'annualDS', fmt: v => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                          { label: 'Annual Cash Flow', key: 'annualCF', fmt: v => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                          { label: 'Monthly Cash Flow', key: 'monthlyCF', fmt: v => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                          { label: `Cash-on-Cash (on $${stressEquity > 0 ? Math.round(stressEquity / 1000) + 'k' : '--'})`, key: 'coc', fmt: v => v.toFixed(1) + '%' },
                          { label: 'DSCR', key: 'dscr', fmt: v => v.toFixed(2) + 'x' },
                        ].map((metric, mIdx) => (
                          <tr key={mIdx} style={{ borderBottom: '1px solid #e5e7eb' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#1e3a5f', backgroundColor: '#f0f4f8', borderRight: '1px solid #e2e8f0' }}>{metric.label}</td>
                            {stressRows.map((sr, i) => {
                              const isBase = Math.abs(sr.ratePct - baseRatePct) < 0.01;
                              const val = sr[metric.key];
                              // Color code: green if positive cash flow / good DSCR, red if negative
                              let valColor = '#111827';
                              if (metric.key === 'annualCF' || metric.key === 'monthlyCF') {
                                valColor = val >= 0 ? '#047857' : '#dc2626';
                              } else if (metric.key === 'dscr') {
                                valColor = val >= 1.25 ? '#047857' : val >= 1.0 ? '#d97706' : '#dc2626';
                              } else if (metric.key === 'coc') {
                                valColor = val >= 8 ? '#047857' : val >= 4 ? '#d97706' : '#dc2626';
                              }
                              return (
                                <td key={i} style={{
                                  padding: '14px 20px',
                                  textAlign: 'center',
                                  fontSize: '14px',
                                  fontWeight: isBase ? '800' : '600',
                                  color: valColor,
                                  backgroundColor: isBase ? '#fef9f0' : 'white',
                                  borderLeft: isBase ? '2px solid #fbbf24' : 'none',
                                  borderRight: isBase ? '2px solid #fbbf24' : 'none',
                                }}>
                                  {metric.fmt(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer note */}
                  <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                      <strong style={{ color: '#334155' }}>How to read:</strong> The <span style={{ color: '#dc2626', fontWeight: 700 }}>red column</span> is your base underwriting rate ({baseRatePct.toFixed(1)}%).
                      Columns to the left show a rate decrease (better terms), columns to the right show a rate increase (worse terms).
                      DSCR â‰¥ 1.25x is green (bankable), 1.0â€“1.25x is amber (tight), &lt; 1.0x is red (debt service coverage shortfall).
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );

      case 'waterfall':
        return (
          <WaterfallTab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            onFieldChange={handleFieldChange}
            purchasePrice={purchasePrice}
            annualDebtService={annualDebtService}
            holdPeriod={selectedHoldPeriod}
            noiT12={noiT12}
            vaRentUpside={scenarioData?.value_add?.apply_rent_upside ? vaAnnualRentUpside : 0}
            vaRubsRecovery={scenarioData?.value_add?.apply_rubs ? vaAnnualRubsRecovery : 0}
            vaExpenseSavings={scenarioData?.value_add?.apply_expense_savings ? (scenarioData?.value_add?.annual_expense_savings || 0) : 0}
            marketCapRate={marketCapRate}
          />
        );

      case 'fees':
        return <ManagementFeesView fees={fullCalcs.managementFees} />;

      case 'costseg':
        return (
          <div style={{ padding: '24px' }}>
            <CostSegAnalysisView dealId={dealId} scenarioData={scenarioData} fullCalcs={fullCalcs} />
          </div>
        );

      case 'sensitivity':
        return (
          <SensitivityAnalysisTab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            calculateFullAnalysisFn={calculateFullAnalysis}
          />
        );

      case 'market-data':
        return (
          <div style={{ padding: '24px' }}>
            <MarketResearchTab
              marketData={marketData}
              loading={marketDataLoading}
              propertyLocation={propertyLocation}
              onRefetchMarketData={fetchMarketData}
            />
          </div>
        );

      
      case 'rent-roll':
        // Display EXACTLY what was parsed - no calculations, no transformations
        const unitMixData = scenarioData.unit_mix || [];
        const totalUnitsCount = unitMixData.reduce((sum, u) => sum + (u.units || 0), 0);
        const totalSFCount = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)), 0);
        const totalMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
        const totalAnnualRent = totalMonthlyRent * 12;
        const unitMixTotalMarketMonthlyRent = unitMixData.reduce(
          (sum, u) => sum + ((u.units || 0) * (u.rent_market != null ? u.rent_market : (u.rent_current || 0))),
          0
        );
        const handleRentcastFetch = async () => {
          setRentcastLoading(true);
          try {
            // Get profile ID for tracking
            let profileId = null;
            try {
              const userRes = await supabase.auth.getUser();
              profileId = userRes?.data?.user?.id;
            } catch {}

            const response = await fetch(`${API_BASE_URL}/v2/deals/${dealId}/rentcast`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(profileId ? { 'X-Profile-ID': profileId } : {})
              }
            });
            const data = await response.json();
            console.log('RentCast response:', data);
            if (data.success) {
              setRentcastData(data.data);
              // Auto-save RentCast data to deal so it persists on return
              try {
                await updateDeal(dealId, { rentcast_data: data.data });
                console.log('[RentCast] Auto-saved rentcast data to deal');
              } catch (saveErr) {
                console.warn('[RentCast] Could not auto-save rentcast data:', saveErr);
              }
            } else {
              alert(`RentCast error: ${data.error || 'Unknown error'}\nAddress searched: ${data.address_searched || 'N/A'}`);
            }
          } catch (error) {
            console.error('RentCast API error:', error);
            alert('Failed to fetch RentCast data. Check console for details.');
          } finally {
            setRentcastLoading(false);
          }
        };

        // Prepare OpenStreetMap embed URL from RentCast coordinates
        const hasCoords = !!(rentcastData && rentcastData.latitude && rentcastData.longitude);
        let mapSrc = null;
        let externalMapUrl = null;
        if (hasCoords) {
          const lat = Number(rentcastData.latitude);
          const lon = Number(rentcastData.longitude);
          const delta = 0.02;
          const minLon = lon - delta;
          const minLat = lat - delta;
          const maxLon = lon + delta;
          const maxLat = lat + delta;
          mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik&marker=${lat},${lon}`;
          externalMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
        }
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  marginRight: '12px'
                }}>8</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  RENT ROLL ANALYSIS
                </h2>
              </div>

              {/* Cactus-style Rent Roll (unified component) */}
              <div style={{ marginTop: '8px', marginBottom: '24px' }}>
                <RentRollTab
                  scenarioData={scenarioData}
                  dealId={dealId}
                  onUnitMixChange={(updated) => handleFieldChange('unit_mix', updated)}
                  initialRentcastData={rentcastData}
                  onRentcastFetch={(data) => setRentcastData(data)}
                />
              </div>
            </div>
          </div>
        );

      case 'compressed':
        return (
          <CompressedTab
            scenarioData={scenarioData}
            calculations={calculations}
            fullCalcs={fullCalcs}
            purchasePrice={purchasePrice}
            capRate={capRate}
            dscr={dscr}
            noiT12={noiT12}
            annualDebtService={annualDebtService}
            selectedHoldPeriod={selectedHoldPeriod}
            setSelectedHoldPeriod={setSelectedHoldPeriod}
            onFieldChange={handleFieldChange}
            onTabChange={setActiveTab}
            countyTaxEntry={countyTaxEntry}
            vaRentUpside={scenarioData?.value_add?.apply_rent_upside ? vaAnnualRentUpside : 0}
            vaRubsRecovery={scenarioData?.value_add?.apply_rubs ? vaAnnualRubsRecovery : 0}
            vaOtherIncome={scenarioData?.value_add?.apply_other_income ? (scenarioData?.value_add?.annual_other_income || 0) : 0}
            vaExpenseSavings={scenarioData?.value_add?.apply_expense_savings ? (scenarioData?.value_add?.annual_expense_savings || 0) : 0}
          />
        );

      case 'deal-structure':
        return (
          <div style={{ padding: '24px' }}>
            <DealStructureTab 
              scenarioData={scenarioData} 
              calculations={calculations} 
              fullCalcs={fullCalcs} 
              marketCapRate={marketCapRate}
              onFieldChange={handleFieldChange}
              onRecommendationChange={setRecommendedStructure}
              onSelectedStructureMetricsChange={setSelectedStructureMetrics}
            />
          </div>
        );
      
      default:
        return <div style={{ padding: '24px', color: '#6b7280' }}>Select a tab to view details</div>;
    }
  };

  return (
    <div className={darkMode ? 'ds-dark' : ''} style={{ 
      display: 'flex', 
      height: 'calc(100vh - 60px)',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: darkMode ? '#0f172a' : '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      color: darkMode ? '#e2e8f0' : 'inherit',
      transition: 'background-color 0.3s, color 0.3s'
                    }}>
      
      {/* Dark mode style overrides */}
      {darkMode && (
        <style>{`
          .ds-dark * { transition: background-color 0.3s, color 0.3s, border-color 0.3s; }
          .ds-dark div[style*="backgroundColor: white"], .ds-dark div[style*="background-color: white"],
          .ds-dark div[style*="backgroundColor: '#fff'"], .ds-dark div[style*="background: '#fff'"] { background-color: #1e293b !important; }
          .ds-dark div[style*="backgroundColor: #fff"] { background-color: #1e293b !important; }
          .ds-dark div[style*="background: #fff"] { background: #1e293b !important; }
          .ds-dark [style*="background: white"] { background: #1e293b !important; }
          .ds-dark [style*="backgroundColor: white"] { background-color: #1e293b !important; }
          .ds-dark [style*="color: #111827"] { color: #f1f5f9 !important; }
          .ds-dark [style*="color: #374151"] { color: #cbd5e1 !important; }
          .ds-dark [style*="color: #6b7280"] { color: #94a3b8 !important; }
          .ds-dark [style*="borderBottom: 1px solid #e5e7eb"] { border-bottom-color: #334155 !important; }
          .ds-dark [style*="border: 1px solid #e5e7eb"] { border-color: #334155 !important; }
          .ds-dark [style*="border-color: #e5e7eb"] { border-color: #334155 !important; }
          .ds-dark [style*="backgroundColor: #f9fafb"] { background-color: #0f172a !important; }
          .ds-dark [style*="background: #f9fafb"] { background: #0f172a !important; }
          .ds-dark [style*="backgroundColor: #f3f4f6"] { background-color: #1e293b !important; }
          .ds-dark [style*="background: #f3f4f6"] { background: #1e293b !important; }
          .ds-dark [style*="backgroundColor: #f8fafc"] { background-color: #1e293b !important; }
          .ds-dark input, .ds-dark select, .ds-dark textarea { background-color: #1e293b !important; color: #e2e8f0 !important; border-color: #475569 !important; }
          .ds-dark table th { background: #0f172a !important; color: #e2e8f0 !important; }
          .ds-dark table td { color: #cbd5e1 !important; border-color: #334155 !important; }
          .ds-dark table tr { border-color: #334155 !important; }
          .ds-dark h2, .ds-dark h3, .ds-dark h4 { color: #f1f5f9 !important; }
          .ds-dark p { color: #94a3b8 !important; }
        `}</style>
      )}

      {/* Main Content - Full Width */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: darkMode ? '#1e293b' : 'white',
        minWidth: 0,
        overflow: 'hidden'
      }}>
        
        {/* Header with property name */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${darkMode ? '#334155' : '#e5e7eb'}`,
          backgroundColor: darkMode ? '#1e293b' : 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: darkMode ? '#f1f5f9' : '#111827' }}>
              {property.property_name || 'Deal Analysis'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: darkMode ? '#94a3b8' : '#6b7280' }}>
              {property.address || 'Property Address'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: '8px',
                backgroundColor: darkMode ? '#334155' : '#f3f4f6',
                color: darkMode ? '#fbbf24' : '#6b7280',
                border: `1px solid ${darkMode ? '#475569' : '#d1d5db'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              style={{
                padding: '8px 16px',
                backgroundColor: isExportingPDF ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isExportingPDF ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={14} />
              {isExportingPDF ? 'Exporting...' : 'Export to PDF'}
            </button>
            <button
              onClick={handleGeneratePitchDeck}
              disabled={isExportingPDF}
              style={{
                padding: '8px 16px',
                backgroundColor: isExportingPDF ? '#9ca3af' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isExportingPDF ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Presentation size={14} />
              {isExportingPDF ? 'Generating...' : 'Pitch Deck'}
            </button>
            <button
              onClick={handlePushToPipeline}
              disabled={isPushingToPipeline}
              style={{
                padding: '8px 16px',
                backgroundColor: pipelineSuccess ? '#10b981' : (isPushingToPipeline ? '#9ca3af' : '#111827'),
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isPushingToPipeline ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Rocket size={14} />
              {pipelineSuccess ? 'Added to Pipeline' : (isPushingToPipeline ? 'Pushing...' : (isInPipeline ? 'Update Pipeline' : 'Push to Pipeline'))}
            </button>
            {autoSaveStatus && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                backgroundColor: autoSaveStatus === 'saving' ? '#fef3c7' : autoSaveStatus === 'saved' ? '#d1fae5' : '#fee2e2',
                color: autoSaveStatus === 'saving' ? '#92400e' : autoSaveStatus === 'saved' ? '#065f46' : '#991b1b',
              }}>
                {autoSaveStatus === 'saving' ? 'â³ Saving...' : autoSaveStatus === 'saved' ? 'âœ“ Auto-saved' : 'âœ— Save failed'}
              </span>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </button>
            {onGoHome && (
              <button
                onClick={onGoHome}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                New Deal
              </button>
            )}
                    </div>
                  </div>

        {/* Tabs -- pill-style with colored accents */}
        <div style={{ 
          display: 'flex',
          gap: '6px',
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const accent = tab.accent || '#3b82f6';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: isActive ? accent : 'transparent',
                  color: isActive ? '#ffffff' : '#4b5563',
                  border: isActive ? 'none' : '1px solid transparent',
                  borderRadius: '9999px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  boxShadow: isActive
                    ? `0 2px 8px ${accent}40, 0 0 0 2px ${accent}20`
                    : 'none',
                  transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  letterSpacing: isActive ? '0.01em' : '0',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = `${accent}14`;
                    e.currentTarget.style.color = accent;
                    e.currentTarget.style.border = `1px solid ${accent}30`;
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#4b5563';
                    e.currentTarget.style.border = '1px solid transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div 
          ref={tabContentRef}
          style={{ 
            flex: 1,
            overflow: 'auto',
            backgroundColor: '#f9fafb'
          }}
        >
          {renderTabContent()}
        </div>

      </div>

      {/* Max AI Sidebar - Right Side */}
      <div style={{
        width: isChatMinimized ? 40 : 420,
        minWidth: isChatMinimized ? 40 : 420,
        maxWidth: isChatMinimized ? 40 : 420,
        flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        {/* AI Header */}
        <div style={{
          padding: isChatMinimized ? '8px' : '10px 14px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isChatMinimized ? 'center' : 'space-between',
          fontSize: 15,
          fontWeight: 600,
          color: '#111827'
        }}>
          {!isChatMinimized && <span>Max</span>}
          <button
            type="button"
            onClick={() => setIsChatMinimized(!isChatMinimized)}
            title={isChatMinimized ? 'Expand chat' : 'Minimize chat'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151' }}
          >
            <MessageSquare size={15} />
          </button>
        </div>

        {/* AI Body - Messages */}
        {!isChatMinimized && (
        <div style={{
          flex: 1,
          padding: '12px 14px',
          overflowY: 'auto',
          minHeight: 0
        }} ref={chatMessagesRef}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#111827' }}>
            Ask about this deal or request analysis.
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 8,
                  padding: '10px 12px',
                  borderRadius: 6,
                  backgroundColor: msg.role === 'user' ? '#e5f0ff' : '#f9fafb',
                  color: '#111827',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 2,
                    color: msg.role === 'user' ? '#1d4ed8' : '#6b7280',
                  }}
                >
                  {msg.role === 'user' ? 'You' : 'Max'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        p: ({children}) => <p style={{ marginBottom: '8px', marginTop: 0 }}>{children}</p>,
                        li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                        ul: ({children}) => <ul style={{ marginBottom: '8px', paddingLeft: '20px' }}>{children}</ul>,
                        ol: ({children}) => <ol style={{ marginBottom: '8px', paddingLeft: '20px' }}>{children}</ol>,
                        strong: ({children}) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                        h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', marginTop: '8px' }}>{children}</h3>,
                        h4: ({children}) => <h4 style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px', marginTop: '6px' }}>{children}</h4>
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div style={{
                padding: '6px 8px',
                borderRadius: 6,
                backgroundColor: '#f9fafb',
                color: '#6b7280',
                fontSize: 11
              }}>
                Thinking...
              </div>
            )}
          </div>
        </div>
        )}

        {/* AI Footer - Input */}
        {!isChatMinimized && (
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '10px 14px 12px',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder={
                isSending
                  ? 'Thinking...'
                  : 'Ask about cash flow, returns, or analysis'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSending && inputValue.trim()) {
                  handleSendMessage();
                }
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                outline: 'none',
              }}
            />
            <button
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#111827',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: isSending || !inputValue.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !inputValue.trim() ? 0.5 : 1
              }}
              onClick={handleSendMessage}
              disabled={isSending || !inputValue.trim()}
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 4px 30px rgba(16, 185, 129, 0.6), 0 0 50px rgba(16, 185, 129, 0.5);
            transform: scale(1.02);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Hide scrollbar on tab strip */
        div::-webkit-scrollbar { height: 0; width: 0; }
      `}</style>

    </div>
  );
};

export default ResultsPageV2;



