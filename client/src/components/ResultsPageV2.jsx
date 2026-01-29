/* eslint-disable */
// V2 Results Page - Complete with All Advanced Features
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Send, Home, DollarSign, FileText, CreditCard, BarChart3, Users, FileBarChart, TrendingUp, Calculator, PieChart, Calendar, Activity, Layers, LayoutDashboard, RefreshCw, Rocket, MessageSquare, Download, Presentation, MapPin, FileSpreadsheet } from 'lucide-react';
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
import { calculateSensitivity } from '../utils/realEstateCalculations';
import { CostSegAnalysisView } from './CostSegAnalysis';
import MarketResearchTab from './results-tabs/MarketResearchTab';
import DealStructureTab from './results-tabs/DealStructureTab';
import DealExecutionTab from './results-tabs/DealExecutionTab';
import ExpensesTab from './results-tabs/ExpensesTab';
import ProformaTab from './results-tabs/ProformaTab';
import RUBSTab from './results-tabs/RUBSTab';
import UnderwritingTablePage from '../pages/UnderwritingTablePage';
import PropertySpreadsheet from './PropertySpreadsheet';
import { mapParsedDataToSpreadsheet } from '../utils/propertySpreadsheetMapper';
import { saveDeal } from '../lib/dealsService';

const ResultsPageV2 = ({ 
  dealId,
  scenarioData, 
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
  const [showDebug, setShowDebug] = useState(false);
  const [countyTaxData, setCountyTaxData] = useState([]);
  const [countySearch, setCountySearch] = useState('');
  const [showCountyDropdown, setShowCountyDropdown] = useState(false);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [isPushingToPipeline, setIsPushingToPipeline] = useState(false);
  const [pipelineSuccess, setPipelineSuccess] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const tabContentRef = useRef(null);
  // Google Sheets populate handler
  const handlePopulateSheet = async () => {
    try {
      const response = await fetch('https://dealsniper-oh9v.onrender.com/api/sheets/populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioData, fullCalcs })
      });
      const result = await response.json();
      if (result.success) {
        alert(` Populated ${result.updated_cells} cells!`);
      } else {
        alert(` Error: ${result.error}`);
      }
    } catch (error) {
      alert(` Failed: ${error.message}`);
    }
  };
  
  // Automatically trigger AI underwriting when results page loads (only once)
  useEffect(() => {
    const runAIAnalysis = async () => {
      if (!dealId || !scenarioData || underwritingResult || isRunningAI) return;
      
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
        // Silently fail - user can still see the deal data
      } finally {
        setIsRunningAI(false);
      }
    };
    
    runAIAnalysis();
  }, [dealId, scenarioData]); // Only run when dealId or scenarioData changes
  
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
  
  // Track if user has made changes that need recalculation
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const changeTimeoutRef = useRef(null);
  
  // Wrapper for onEditData that tracks changes with debounce to prevent flickering
  const handleFieldChange = (path, value) => {
    if (onEditData) {
      onEditData(path, value);
      
      // Clear previous timeout
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
      
      // Debounce to prevent rapid state changes
      changeTimeoutRef.current = setTimeout(() => {
        setHasUnsavedChanges(true);
      }, 300);
    }
  };
  
  // Handle recalculation
  const handleRecalculate = () => {
    setIsRecalculating(true);
    // The recalculation happens automatically via useMemo in parent
    // This just provides visual feedback
    setTimeout(() => {
      setIsRecalculating(false);
      setHasUnsavedChanges(false);
    }, 500);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, []);
  
  // Chat position state for dragging
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // RentCast API state
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(null);
  
  // Exit Strategy state
  const [selectedHoldPeriod, setSelectedHoldPeriod] = useState(5);
  
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
  
  // Load county tax data from CSV
  useEffect(() => {
    fetch('/Property Taxes by State and County, 2025  Tax Foundation Maps.csv')
      .then(response => response.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          // Parse CSV with quoted fields
          const matches = line.match(/("([^"]*)"|[^,]+)/g);
          if (matches && matches.length >= 5) {
            const state = matches[0].replace(/"/g, '').trim();
            const county = matches[1].replace(/"/g, '').trim();
            const taxRate = matches[4].replace(/"/g, '').replace('%', '').trim();
            data.push({
              state,
              county,
              taxRate: parseFloat(taxRate) || 0,
              fullName: `${county}, ${state}`
            });
          }
        }
        setCountyTaxData(data);
      })
      .catch(err => console.error('Error loading county tax data:', err));
  }, []);
  
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
- Modeled hold IRR (levered): ${(promptLeveredIRR * 100).toFixed(2)}%
- Modeled equity multiple: ${promptEquityMultiple.toFixed(2)}x

Using ALL of the underlying scenario data and structures (Traditional, Seller Finance, Subject To, Hybrid, Equity Partner, Seller Carry, Lease Option, and any others the model exposes), do the following in order:

1. DEAL VERDICT
   - Decide if this is a good deal, marginal deal, or bad deal based purely on the underwritten numbers (cash flow, cap rates, DSCR, IRR, equity multiple, value creation, etc.).
   - Be very direct: label it clearly as a \"Strong Buy\", \"Maybe / Needs Work\", or \"Probably a Pass\" and explain why in 3–5 bullet points.

2. BEST DEBT STRUCTURE FOR DAY-ONE CASH FLOW
   - Evaluate ALL available debt/financing structures in this model.
   - Prioritize day-one cash flow and risk (DSCR and actual dollars of monthly/annual cash flow).
   - Pick ONE structure you would personally use for this deal.
   - For that chosen structure, list: loan amount, equity required, DSCR, cash-on-cash, and day-one annual cash flow, plus 2–3 pros and 2–3 cons.

3. ACQUISITION PLAN
   - Lay out a step-by-step plan for how to acquire this property using your chosen structure.
   - Include negotiation strategy, target offer terms (price, down payment / option fee / seller carry, etc.), key contingencies, and an approximate timeline from LOI to close.

4. FIX-THE-DEAL SCENARIOS (NO DEAL IS DEAD BY DEFAULT)
   - If the deal is weak or negative on day-one cash flow at the current price, figure out how to make it work.
   - Either:
     a) Propose a lower max purchase price that would get to healthy day-one cash flow under at least one structure (give that price and resulting key metrics), OR
     b) Propose a creative structure (or blend of structures) — e.g., deeper seller carry, subject-to, lease option, or hybrid — that gets to positive day-one cash flow.
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
  
  // Destructure scenario data
  const { property, pricing_financing, unit_mix, underwriting } = scenarioData;

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

      await saveDeal({
        dealId,
        address,
        units: totalUnits,
        purchasePrice,
        dealStructure,
        parsedData: scenarioData,
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
        images: scenarioData?.images || [],
        brokerName,
        brokerPhone,
        brokerEmail,
        notes: ''
      });

      // Notify other components that pipeline has changed
      window.dispatchEvent(new Event('pipelineDealsUpdated'));

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
        { id: 'property-analysis', name: 'Property Analysis' },
        { id: 'deal-execution', name: 'Deal Execution' },
        { id: 'expenses', name: 'Expenses' },
        { id: 'proforma', name: 'Pro Forma' },
        { id: 'rubs', name: 'RUBS Analysis' },
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
        yPos = addText(`• Renovation Budget: ${fmt(renovationBudget)}`, yPos);
        yPos = addText(`• Projected Rent Increase: ${pct(scenarioData?.renovations?.rentIncrease || 10)}`, yPos);
      } else {
        yPos = addText('• Operational efficiency improvements', yPos);
        yPos = addText('• Market-rate rent adjustments', yPos);
      }
      yPos = addText('• Enhanced resident services and amenities', yPos);
      
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
      yPos = addMetricRow('Annual Debt Service:', fmt(financing?.annualDebtService || 0), yPos);
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
      
      yPos = addText(`✓ Strong ${pct(year1.cashOnCash || 0)} Year 1 Cash-on-Cash Return`, yPos, 11, true);
      yPos = addText(`✓ Attractive ${pct(fullCalcs?.inPlaceCapRate || 0)} Going-In Cap Rate`, yPos, 11, true);
      yPos = addText(`✓ ${pct(returns?.irr || 0)} IRR with ${(returns?.equityMultiple || 0).toFixed(2)}x Equity Multiple`, yPos, 11, true);
      yPos = addText(`✓ Value-Add Opportunity via Rent Optimization`, yPos, 11, true);
      yPos = addText(`✓ Located in ${propertyData.city || 'High-Growth'} Market`, yPos, 11, true);
      yPos = addText(`✓ Professional Property Management in Place`, yPos, 11, true);
      
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
  // Annual debt service from engine
  const annualDebtService = fullCalcs?.financing?.annualDebtService
    ?? scenarioData.pricing_financing?.annual_debt_service
    ?? 0;

  const capRate = (fullCalcs?.year1?.capRate != null)
    ? fullCalcs.year1.capRate
    : (purchasePrice > 0 && year1NOI > 0 ? (year1NOI / purchasePrice) * 100 : 0);
  const cashOnCash = (fullCalcs?.year1?.cashOnCash != null) ? fullCalcs.year1.cashOnCash : 0;
  const dscr = (fullCalcs?.year1?.dscr != null)
    ? fullCalcs.year1.dscr
    : (annualDebtService > 0 && year1NOI > 0 ? year1NOI / annualDebtService : 0);
  const annualCashFlow = (fullCalcs?.year1?.cashFlowAfterFinancing != null)
    ? fullCalcs.year1.cashFlowAfterFinancing
    : (year1NOI - annualDebtService);
  const stabilizedValue = fullCalcs?.returns?.terminalValue || 0;

  // Tabs with icons - EXPANDED
  const tabs = [
    { id: 'summary', label: 'Summary', icon: Home },
    { id: 'property-spreadsheet', label: 'Property Analysis', icon: FileBarChart },
    { id: 'rubs', label: 'RUBS', icon: Activity },
    { id: 'proforma', label: 'Proforma', icon: FileText },
    { id: 'deal-structure', label: 'Deal Structure', icon: Layers },
    { id: 'deal-execution', label: 'Deal Execution', icon: Rocket },
    { id: 'expenses', label: 'Expenses', icon: FileText },
    { id: 'value-add', label: 'Value-Add Strategy', icon: TrendingUp },
    { id: 'exit-strategy', label: 'Exit Strategy', icon: TrendingUp },
    
    { id: 'amortization', label: 'Amortization', icon: Calculator },
    { id: 'rent-roll', label: 'Rent Roll', icon: Users },
    { id: 'syndication', label: 'Syndication', icon: PieChart },
    
    { id: 'costseg', label: 'Cost Segregation', icon: Calculator },
    { id: 'market-data', label: 'Market Data', icon: BarChart3 },
    { id: 'underwriting-model', label: 'Underwriting Model', icon: FileSpreadsheet }
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

  // Debug panel component
  const DebugPanel = () => (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      zIndex: 9999,
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <button 
        onClick={() => setShowDebug(!showDebug)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
          marginBottom: '8px'
        }}
      >
        {showDebug ? 'Hide Debug' : 'Show Debug Data'}
      </button>
      {showDebug && (
        <div style={{
          backgroundColor: '#1f2937',
          color: '#10b981',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px' }}>===== SCENARIO DATA =====</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>property:</div>
            {JSON.stringify(scenarioData.property, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>pricing_financing:</div>
            {JSON.stringify(scenarioData.pricing_financing, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>pnl:</div>
            {JSON.stringify(scenarioData.pnl, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>expenses:</div>
            {JSON.stringify(scenarioData.expenses, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>unit_mix:</div>
            {JSON.stringify(scenarioData.unit_mix, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>underwriting:</div>
            {JSON.stringify(scenarioData.underwriting, null, 2)}
          </div>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px', marginTop: '16px' }}>===== CALCULATIONS =====</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.year1:</div>
            {JSON.stringify(fullCalcs.year1, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.financing:</div>
            {JSON.stringify(fullCalcs.financing, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.returns:</div>
            {JSON.stringify(fullCalcs.returns, null, 2)}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#60a5fa' }}>fullCalcs.rentRollAnalysis:</div>
            {JSON.stringify(fullCalcs.rentRollAnalysis, null, 2)}
          </div>
          {fullCalcs.debug && (
            <>
              <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px', marginTop: '16px' }}>===== ENGINE DEBUG =====</div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#60a5fa' }}>inputs:</div>
                {JSON.stringify(fullCalcs.debug.inputs, null, 2)}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#60a5fa' }}>intermediates:</div>
                {JSON.stringify(fullCalcs.debug.intermediates, null, 2)}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#60a5fa' }}>mappings:</div>
                {JSON.stringify(fullCalcs.debug.mappings, null, 2)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      
      case 'summary':
        // Use canonical values from fullCalcs so Summary matches engine
        const summaryPurchasePrice = fullCalcs.acquisition?.purchasePrice || pricing_financing?.price || pricing_financing?.purchase_price || 0;
        const closingFees = fullCalcs.acquisition?.closingCosts || 0;
        const capexBudget = fullCalcs.acquisition?.capexBudget || 0;
        const totalCapitalization = fullCalcs.acquisition?.totalAcquisitionCosts || (summaryPurchasePrice + closingFees + capexBudget);

        const year1NOI = fullCalcs.year1?.noi || 0;
        const goingInCapRate = fullCalcs.year1?.capRate != null
          ? fullCalcs.year1.capRate
          : (summaryPurchasePrice > 0 ? (year1NOI / summaryPurchasePrice) * 100 : 0);

        const cashOnCashReturn = fullCalcs.year1?.cashOnCash || 0;
        const summaryDscr = fullCalcs.year1?.dscr || 0;
        const annualCashFlow = fullCalcs.year1?.cashFlowAfterFinancing ?? fullCalcs.year1?.cashFlow ?? 0;
        const summaryAnnualDebtService = fullCalcs.financing?.annualDebtService || 0;

        const stabilizedValue = fullCalcs.returns?.terminalValue || 0;
        const projectedValueCreation = stabilizedValue && totalCapitalization
          ? stabilizedValue - totalCapitalization
          : 0;
        const returnOnCost = totalCapitalization > 0
          ? (projectedValueCreation / totalCapitalization) * 100
          : 0;

        // Property Overview fields from screenshot
        const propType = property?.property_type || property?.type || 'N/A';
        const yearBuilt = property?.year_built || 'N/A';
        const totalUnits = property?.total_units || property?.units || 0;
        const totalBuildings = property?.buildings || property?.building_count || 'N/A';
        const totalSqFt = property?.total_sq_ft || property?.net_rentable_sf || 0;
        // Normalize occupancy from parsed data (handles 0.xx or 90.xx forms)
        let occupancyFraction = 0;
        if (property?.occupancy_rate != null) {
          occupancyFraction = property.occupancy_rate > 1 ? property.occupancy_rate / 100 : property.occupancy_rate;
        } else if (property?.occupancy != null) {
          occupancyFraction = property.occupancy > 1 ? property.occupancy / 100 : property.occupancy;
        } else {
          occupancyFraction = 0.9103; // default ~91% when not provided
        }

        const occupiedUnits = property?.occupied_units || Math.round(totalUnits * occupancyFraction);
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : (occupancyFraction * 100);
        const pricePerUnit = totalUnits > 0 ? summaryPurchasePrice / totalUnits : 0;
        const pricePerSqFt = totalSqFt > 0 ? summaryPurchasePrice / totalSqFt : 0;
        const avgUnitSize = totalUnits > 0 && totalSqFt > 0 ? Math.round(totalSqFt / totalUnits) : 0;
        
        // ============================================================================
        // DEAL SCORE CALCULATION - Hybrid weighted formula
        // ============================================================================
        const calculateDealScore = () => {
          let score = 50; // Start at neutral
          const factors = [];
          const redFlags = [];
          
          // 1. Cap Rate Analysis (vs market) - 20 points max
          const marketCap = marketCapRate?.market_cap_rate || 5.5;
          const capRateDiff = goingInCapRate - marketCap;
          if (capRateDiff >= 1.5) { score += 20; factors.push({ label: 'Cap Rate 1.5%+ above market', impact: '+20', positive: true }); }
          else if (capRateDiff >= 0.5) { score += 12; factors.push({ label: 'Cap Rate above market', impact: '+12', positive: true }); }
          else if (capRateDiff >= 0) { score += 5; factors.push({ label: 'Cap Rate at market', impact: '+5', positive: true }); }
          else if (capRateDiff >= -0.5) { score -= 5; factors.push({ label: 'Cap Rate slightly below market', impact: '-5', positive: false }); }
          else { score -= 15; factors.push({ label: 'Cap Rate well below market', impact: '-15', positive: false }); redFlags.push('Buying below market cap rate'); }
          
          // 2. DSCR Analysis - 15 points max
          if (summaryDscr >= 1.5) { score += 15; factors.push({ label: 'Strong DSCR (1.5x+)', impact: '+15', positive: true }); }
          else if (summaryDscr >= 1.25) { score += 10; factors.push({ label: 'Healthy DSCR (1.25x+)', impact: '+10', positive: true }); }
          else if (summaryDscr >= 1.1) { score += 3; factors.push({ label: 'Adequate DSCR', impact: '+3', positive: true }); }
          else if (summaryDscr >= 1.0) { score -= 5; factors.push({ label: 'Tight DSCR', impact: '-5', positive: false }); redFlags.push('DSCR below 1.1x - limited margin'); }
          else { score -= 20; factors.push({ label: 'Negative DSCR', impact: '-20', positive: false }); redFlags.push('DSCR below 1.0x - cash flow negative'); }
          
          // 3. Cash-on-Cash Return - 15 points max
          if (cashOnCashReturn >= 12) { score += 15; factors.push({ label: 'Excellent CoC (12%+)', impact: '+15', positive: true }); }
          else if (cashOnCashReturn >= 8) { score += 10; factors.push({ label: 'Strong CoC (8%+)', impact: '+10', positive: true }); }
          else if (cashOnCashReturn >= 5) { score += 5; factors.push({ label: 'Acceptable CoC', impact: '+5', positive: true }); }
          else if (cashOnCashReturn >= 0) { score -= 5; factors.push({ label: 'Low CoC return', impact: '-5', positive: false }); }
          else { score -= 15; factors.push({ label: 'Negative cash flow', impact: '-15', positive: false }); redFlags.push('Negative day-one cash flow'); }
          
          // 4. Rent Upside Potential - 15 points max
          const unitMix = scenarioData.unit_mix || [];
          const totalCurrentRent = unitMix.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
          const totalMarketRent = unitMix.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_market || u.rent_current || 0)), 0);
          const rentUpsidePct = totalCurrentRent > 0 ? ((totalMarketRent - totalCurrentRent) / totalCurrentRent) * 100 : 0;
          
          if (rentUpsidePct >= 15) { score += 15; factors.push({ label: 'Strong rent upside (15%+)', impact: '+15', positive: true }); }
          else if (rentUpsidePct >= 8) { score += 10; factors.push({ label: 'Good rent upside', impact: '+10', positive: true }); }
          else if (rentUpsidePct >= 3) { score += 5; factors.push({ label: 'Some rent upside', impact: '+5', positive: true }); }
          else { factors.push({ label: 'Limited rent upside', impact: '0', positive: null }); }
          
          // 5. Expense Ratio Check - 10 points max (also red flag detection)
          const totalExpenses = scenarioData.expenses ? Object.values(scenarioData.expenses).reduce((a, b) => typeof b === 'number' ? a + b : a, 0) : 0;
          const egi = fullCalcs.income?.effectiveGrossIncome || (totalCurrentRent * 12 * 0.95);
          const expenseRatio = egi > 0 ? (totalExpenses / egi) * 100 : 0;
          
          if (expenseRatio >= 35 && expenseRatio <= 50) { score += 10; factors.push({ label: 'Realistic expense ratio', impact: '+10', positive: true }); }
          else if (expenseRatio >= 25 && expenseRatio < 35) { score += 3; factors.push({ label: 'Low expenses (verify)', impact: '+3', positive: null }); redFlags.push('Expense ratio below 35% - may be understated'); }
          else if (expenseRatio < 25) { score -= 10; factors.push({ label: 'Unrealistic expenses', impact: '-10', positive: false }); redFlags.push('Expense ratio below 25% - likely pro forma'); }
          else if (expenseRatio > 55) { score -= 5; factors.push({ label: 'High expense ratio', impact: '-5', positive: false }); }
          
          // 6. Occupancy Analysis - 10 points max
          if (occupancyRate >= 95) { score += 10; factors.push({ label: 'Strong occupancy (95%+)', impact: '+10', positive: true }); }
          else if (occupancyRate >= 90) { score += 7; factors.push({ label: 'Healthy occupancy', impact: '+7', positive: true }); }
          else if (occupancyRate >= 85) { score += 3; factors.push({ label: 'Acceptable occupancy', impact: '+3', positive: true }); }
          else if (occupancyRate >= 75) { score -= 5; factors.push({ label: 'Below market occupancy', impact: '-5', positive: false }); redFlags.push('Occupancy below 85% - verify reason'); }
          else { score -= 15; factors.push({ label: 'Low occupancy', impact: '-15', positive: false }); redFlags.push('Occupancy below 75% - high risk'); }
          
          // 7. Price Per Unit vs Market - 10 points max
          // This would ideally use comp data, for now use rough benchmarks
          const pricePerUnitK = pricePerUnit / 1000;
          if (pricePerUnitK < 80) { score += 10; factors.push({ label: 'Below avg price/unit', impact: '+10', positive: true }); }
          else if (pricePerUnitK < 120) { score += 5; factors.push({ label: 'Reasonable price/unit', impact: '+5', positive: true }); }
          else if (pricePerUnitK < 180) { factors.push({ label: 'Average price/unit', impact: '0', positive: null }); }
          else { score -= 5; factors.push({ label: 'Premium price/unit', impact: '-5', positive: false }); }
          
          // 8. Value Creation Potential - 5 points max
          if (returnOnCost >= 20) { score += 5; factors.push({ label: 'Strong value creation', impact: '+5', positive: true }); }
          else if (returnOnCost >= 10) { score += 3; factors.push({ label: 'Good value creation', impact: '+3', positive: true }); }
          
          // Clamp score between 0-100
          score = Math.max(0, Math.min(100, score));
          
          // Determine grade
          let grade, gradeColor, gradeText;
          if (score >= 85) { grade = 'A+'; gradeColor = '#10b981'; gradeText = 'Excellent Deal'; }
          else if (score >= 75) { grade = 'A'; gradeColor = '#10b981'; gradeText = 'Strong Deal'; }
          else if (score >= 65) { grade = 'B+'; gradeColor = '#22c55e'; gradeText = 'Good Deal'; }
          else if (score >= 55) { grade = 'B'; gradeColor = '#84cc16'; gradeText = 'Solid Deal'; }
          else if (score >= 45) { grade = 'C+'; gradeColor = '#eab308'; gradeText = 'Average Deal'; }
          else if (score >= 35) { grade = 'C'; gradeColor = '#f59e0b'; gradeText = 'Below Average'; }
          else if (score >= 25) { grade = 'D'; gradeColor = '#ef4444'; gradeText = 'Weak Deal'; }
          else { grade = 'F'; gradeColor = '#dc2626'; gradeText = 'Avoid'; }
          
          return { score, grade, gradeColor, gradeText, factors, redFlags, rentUpsidePct, expenseRatio };
        };
        
        const dealScore = calculateDealScore();

        // Extended return & financing metrics for executive-style summary
        const unleveredIRRSummary = fullCalcs.returns?.unleveredIRR ?? 0;
        const leveredIRRSummary = fullCalcs.returns?.leveredIRR ?? 0;
        const unleveredEquityMultipleSummary = fullCalcs.returns?.unleveredEquityMultiple ?? 0;
        const leveredEquityMultipleSummary = fullCalcs.returns?.leveredEquityMultiple ?? 0;
        const minDSCRSummary = fullCalcs.returns?.minDSCR ?? summaryDscr;
        const holdingPeriodYearsSummary = fullCalcs.returns?.holdingPeriod ?? 0;
        const terminalCapRateSummary = fullCalcs.returns?.terminalCapRate ?? 0;
        const marketCapY1Summary = fullCalcs.returns?.marketCapRateY1 ?? (marketCapRate?.market_cap_rate || 0);

        const summaryLoanAmount = fullCalcs.financing?.loanAmount || 0;
        const summaryTotalEquityRequired = fullCalcs.financing?.totalEquityRequired || 0;
        const summaryLtv = fullCalcs.financing?.ltv ?? 0;
        const summaryInterestRate = fullCalcs.financing?.interestRate ?? 0;
        const summaryLoanTermYears = fullCalcs.financing?.loanTermYears || 0;
        const summaryLtc = totalCapitalization > 0 && summaryLoanAmount
          ? (summaryLoanAmount / totalCapitalization) * 100
          : 0;

        const taxAnalysis = fullCalcs.taxAnalysis || null;
        const summaryAfterTaxIRR = taxAnalysis && typeof taxAnalysis.afterTaxIRR === 'number'
          ? taxAnalysis.afterTaxIRR * 100
          : null;
        const summaryAfterTaxMultiple = taxAnalysis && typeof taxAnalysis.afterTaxEquityMultiple === 'number'
          ? taxAnalysis.afterTaxEquityMultiple
          : null;
        const summaryAnnualDepreciation = taxAnalysis?.annualDepreciation ?? null;
        const summaryDepreciationPeriod = taxAnalysis?.depreciationPeriod ?? null;

        const addressLineParts = [];
        if (property?.address) addressLineParts.push(property.address);
        const cityState = [property?.city, property?.state].filter(Boolean).join(', ');
        if (cityState) addressLineParts.push(cityState);
        if (property?.zip) addressLineParts.push(property.zip);
        const addressLine = addressLineParts.join(' · ');

        const keyInvestmentMetrics = [
          // Pricing / value
          { label: 'Purchase Price', value: `$${summaryPurchasePrice.toLocaleString()}` },
          { label: 'Price / Unit', value: pricePerUnit ? `$${pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'N/A' },
          { label: 'Price / Sq Ft', value: pricePerSqFt ? `$${pricePerSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'N/A' },
          { label: 'Stabilized Value', value: stabilizedValue ? `$${stabilizedValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : 'N/A' },
          { label: 'Projected Value Creation', value: projectedValueCreation ? `$${projectedValueCreation.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : 'N/A' },
          { label: 'Return on Cost', value: returnOnCost ? `${returnOnCost.toFixed(1)}%` : 'N/A' },

          // Operations / returns
          { label: 'Going-In Cap Rate', value: `${goingInCapRate.toFixed(2)}%` },
          { label: 'Cash-on-Cash Return', value: `${cashOnCashReturn.toFixed(2)}%` },
          { label: 'Debt Service Coverage', value: `${summaryDscr.toFixed(2)}x` },
          { label: 'Year 1 NOI', value: `$${Math.abs(year1NOI).toLocaleString()}` },
          { label: 'Levered IRR', value: leveredIRRSummary ? `${leveredIRRSummary.toFixed(2)}%` : 'N/A' },
          { label: 'Unlevered IRR', value: unleveredIRRSummary ? `${unleveredIRRSummary.toFixed(2)}%` : 'N/A' },
          { label: 'Levered Equity Multiple', value: leveredEquityMultipleSummary ? `${leveredEquityMultipleSummary.toFixed(2)}x` : 'N/A' },
          { label: 'Unlevered Equity Multiple', value: unleveredEquityMultipleSummary ? `${unleveredEquityMultipleSummary.toFixed(2)}x` : 'N/A' },

          // Capital stack
          { label: 'Equity Required', value: summaryTotalEquityRequired ? `$${summaryTotalEquityRequired.toLocaleString()}` : 'N/A' },
          { label: 'Loan Amount', value: summaryLoanAmount ? `$${summaryLoanAmount.toLocaleString()}` : 'N/A' },
          { label: 'Total Capitalization', value: `$${totalCapitalization.toLocaleString()}` },
          { label: 'Closing & Fees', value: `$${closingFees.toLocaleString()}` },
          { label: 'Capex Budget', value: `$${capexBudget.toLocaleString()}` },
          { label: 'LTV', value: summaryLtv ? `${summaryLtv.toFixed(1)}%` : 'N/A' },
          { label: 'LTC', value: summaryLtc ? `${summaryLtc.toFixed(1)}%` : 'N/A' },
          { label: 'Annual Debt Service', value: summaryAnnualDebtService ? `$${summaryAnnualDebtService.toLocaleString()}` : 'N/A' },

          // Debt terms / exit
          { label: 'Interest Rate', value: summaryInterestRate ? `${summaryInterestRate.toFixed(2)}%` : 'N/A' },
          { label: 'Loan Term', value: summaryLoanTermYears ? `${summaryLoanTermYears} Years` : 'N/A' },
          { label: 'Holding Period', value: holdingPeriodYearsSummary ? `${holdingPeriodYearsSummary} Years` : 'N/A' },
          { label: 'Exit Cap Rate', value: terminalCapRateSummary ? `${terminalCapRateSummary.toFixed(2)}%` : 'N/A' }
        ];

        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

              {/* ========== EXECUTIVE SUMMARY (REPORT STYLE) ========== */}
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '16px', 
                padding: '24px 24px 20px', 
                marginBottom: '24px',
                boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Executive Summary
                </div>

                <div style={{
                  backgroundColor: '#fef3c7',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: '1px solid #facc15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '18px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Recommendation: {dealScore.gradeText.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                    Deal Score {dealScore.score}/100
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: '24px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>
                      {addressLine || 'Subject Property'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, marginBottom: '8px' }}>
                      {totalUnits || 'N/A'}-unit {propType.toLowerCase()} acquisition at ${summaryPurchasePrice.toLocaleString()} 
                      ({pricePerUnit ? `$${pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}/unit` : 'n/a'}
                      {pricePerSqFt ? `, $${pricePerSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 })}/SF` : ''}).
                      Current occupancy is {occupancyRate.toFixed(1)}% ({occupiedUnits} of {totalUnits} units).
                    </div>
                    <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>
                      The deal is projected to generate a going-in cap rate of {goingInCapRate.toFixed(2)}%
                      {marketCapY1Summary ? ` vs a market cap rate of ${marketCapY1Summary.toFixed(2)}%` : ''}, a year-one DSCR of {summaryDscr.toFixed(2)}x
                      and cash-on-cash return of {cashOnCashReturn.toFixed(2)}%. Modeled rent upside is approximately {dealScore.rentUpsidePct.toFixed(1)}%
                      with an expense ratio of {dealScore.expenseRatio.toFixed(1)}%.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Key Investment Metrics
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 18px' }}>
                      {keyInvestmentMetrics.map((metric) => (
                        <div key={metric.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>{metric.label}</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#111827', marginLeft: '12px' }}>{metric.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {taxAnalysis && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      fontSize: 12,
                      color: '#1e3a8a',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Tax / Cost Seg Snapshot:</span>
                    <span>
                      After-Tax IRR{' '}
                      {summaryAfterTaxIRR != null ? `${summaryAfterTaxIRR.toFixed(2)}%` : 'N/A'}
                    </span>
                    <span>
                      After-Tax Equity Multiple{' '}
                      {summaryAfterTaxMultiple != null ? `${summaryAfterTaxMultiple.toFixed(2)}x` : 'N/A'}
                    </span>
                    <span>
                      Annual Depreciation{' '}
                      {summaryAnnualDepreciation != null
                        ? `$${summaryAnnualDepreciation.toLocaleString()}${summaryDepreciationPeriod ? ` over ${summaryDepreciationPeriod}-year schedule` : ''}`
                        : 'N/A'}
                    </span>
                  </div>
                )}
              </div>

              {/* ========== DEAL SCORE SECTION ========== */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '24px', alignItems: 'center' }}>
                  
                  {/* Score Circle */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                      width: '140px', 
                      height: '140px', 
                      borderRadius: '50%', 
                      border: `4px solid ${dealScore.gradeColor}`,
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ fontSize: '36px', fontWeight: '800', color: dealScore.gradeColor }}>{dealScore.grade}</div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>{dealScore.score}/100</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                      {dealScore.gradeText}
                    </div>
                  </div>
                  
                  {/* Score Factors */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                      Score Breakdown
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {dealScore.factors.slice(0, 8).map((factor, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          borderLeft: `3px solid ${factor.positive === true ? '#10b981' : factor.positive === false ? '#ef4444' : '#9ca3af'}`
                        }}>
                          <span style={{ fontSize: '11px', color: '#374151' }}>{factor.label}</span>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            color: factor.positive === true ? '#16a34a' : factor.positive === false ? '#b91c1c' : '#6b7280'
                          }}>{factor.impact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Red Flags */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span> Red Flags ({dealScore.redFlags.length})
                    </div>
                    {dealScore.redFlags.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {dealScore.redFlags.map((flag, idx) => (
                          <div key={idx} style={{
                            padding: '8px 12px',
                            backgroundColor: '#fef2f2',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            fontSize: '11px',
                            color: '#7f1d1d'
                          }}>
                            {flag}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#ecfdf5',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>✓</div>
                        <div style={{ fontSize: '12px', color: '#166534' }}>No major red flags detected</div>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>

            </div>
          </div>
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
                    {fullCalcs.returns?.leveredIRR ? `${(fullCalcs.returns.leveredIRR * 100).toFixed(1)}%` : '-174.0%'}
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
        const grossPotentialRent = pnl.gross_potential_rent || pnl.scheduled_gross_rent_current || scenarioData.income?.gross_potential_rent || fullCalcs?.year1?.potentialGrossIncome || 0;
        const otherIncome = pnl.other_income || scenarioData.income?.other_income || 0;

        // Derive default vacancy, management, and CapEx rates from parsed data so sliders aren’t zero
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
            {/* Recalculate Button - Floating when changes detected */}
            {hasUnsavedChanges && (
              <div style={{
                position: 'sticky',
                top: '10px',
                zIndex: 100,
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '10px'
              }}>
                <button
                  onClick={handleRecalculate}
                  disabled={isRecalculating}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'white',
                    background: isRecalculating 
                      ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: isRecalculating ? 'not-allowed' : 'pointer',
                    boxShadow: isRecalculating 
                      ? '0 4px 15px rgba(0, 0, 0, 0.2)'
                      : '0 4px 20px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.3)',
                    animation: isRecalculating ? 'none' : 'pulse-glow 2s ease-in-out infinite',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <RefreshCw 
                    size={20} 
                    style={{ 
                      animation: isRecalculating ? 'spin 1s linear infinite' : 'none' 
                    }} 
                  />
                  {isRecalculating ? 'Recalculating...' : 'Recalculate All Tabs'}
                </button>
              </div>
            )}
            {/* Investment Memorandum Header */}
            <div style={{ background: 'linear-gradient(135deg, #2d5a7b 0%, #1e3a5f 100%)', padding: '16px 24px', color: 'white', marginBottom: '20px', borderRadius: '0 0 8px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', opacity: 0.9 }}>INVESTMENT MEMORANDUM</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>Prepared by CRE Valuation Pro • Confidential Investment Memorandum</div>
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
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Annual Expenses</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Real Estate Taxes</label>
                    <input type="number" style={inputStyle} value={expensesData.taxes || ''} 
                      onChange={(e) => handleFieldChange('expenses.taxes', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Insurance</label>
                    <input type="number" style={inputStyle} value={expensesData.insurance || ''} 
                      onChange={(e) => handleFieldChange('expenses.insurance', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Repairs & Maintenance</label>
                    <input type="number" style={inputStyle} value={expensesData.repairs || ''} 
                      onChange={(e) => handleFieldChange('expenses.repairs', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Management Fees</label>
                    <input type="number" style={inputStyle} value={expensesData.management || ''} 
                      onChange={(e) => handleFieldChange('expenses.management', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Payroll</label>
                    <input type="number" style={inputStyle} value={expensesData.payroll || ''} 
                      onChange={(e) => handleFieldChange('expenses.payroll', parseFloat(e.target.value) || 0)} />
                  </div>
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
                    <label style={labelStyle}>Other Expenses</label>
                    <input type="number" style={inputStyle} value={expensesData.other || ''} 
                      onChange={(e) => handleFieldChange('expenses.other', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Utilities (Annual)</label>
                    <input type="number" style={readOnlyStyle} value={Math.round(totalUtilitiesMonthly * 12)} readOnly />
                  </div>
                </div>
              </div>

              {/* Utilities Breakdown */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utilities (Monthly)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Gas</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.gas || 0) / 12) || ''} 
                      onChange={(e) => handleFieldChange('expenses.gas', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Electrical</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.electrical || 0) / 12) || ''} 
                      onChange={(e) => handleFieldChange('expenses.electrical', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Water</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.water || 0) / 12) || ''} 
                      onChange={(e) => handleFieldChange('expenses.water', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sewer</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.sewer || 0) / 12) || ''} 
                      onChange={(e) => handleFieldChange('expenses.sewer', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Trash</label>
                    <input type="number" style={inputStyle} value={Math.round((expensesData.trash || 0) / 12) || ''} 
                      onChange={(e) => handleFieldChange('expenses.trash', (parseFloat(e.target.value) || 0) * 12)} />
                  </div>
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

      case 'expenses':
        return (
          <ExpensesTab
            scenarioData={scenarioData}
            fullCalcs={fullCalcs}
            onFieldChange={handleFieldChange}
          />
        );

      case 'value-add':
        // Calculate current metrics (use T12 NOI as baseline)
        const currentNOI = noiT12;
        const currentPurchasePrice = scenarioData.pricing_financing?.purchase_price || 0;
        const currentCapRate = fullCalcs.year1?.capRate || 0;
        const currentDSCR = fullCalcs.year1?.dscr || 0;
        const valueAddTotalUnits = scenarioData.property?.units || 0;
        const valueAddAnnualDebtService = scenarioData.pricing_financing?.annual_debt_service || fullCalcs.financing?.annualDebtService || 0;
        
        // Get current and market rents from actual unit mix data - SHOW TOTAL NOT AVERAGE
        const valueAddUnitMix = scenarioData.unit_mix || [];
        const totalCurrentMonthlyRent = valueAddUnitMix.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
        const avgCurrentRent = valueAddTotalUnits > 0 ? totalCurrentMonthlyRent / valueAddTotalUnits : 0;
        
        // Calculate market rent from unit mix (use rent_market if exists, otherwise use rent_current)
        const valueAddTotalMarketMonthlyRent = valueAddUnitMix.reduce((sum, u) => {
          const marketRent = u.rent_market && u.rent_market > 0 ? u.rent_market : u.rent_current || 0;
          return sum + ((u.units || 0) * marketRent);
        }, 0);
        const avgMarketRent = valueAddTotalUnits > 0 ? valueAddTotalMarketMonthlyRent / valueAddTotalUnits : 0;
        
        // Use calculated totals
        const currentRent = totalCurrentMonthlyRent;
        const marketRent = valueAddTotalMarketMonthlyRent;
        const rentUpside = marketRent - currentRent;
        const totalMonthlyRentUpside = rentUpside;
        const totalAnnualRentUpside = totalMonthlyRentUpside * 12;
        
        // Get expense optimization data with RUBS
        const currentExpenses = {
          taxes: scenarioData.expenses?.taxes || 0,
          insurance: scenarioData.expenses?.insurance || 0,
          utilities: scenarioData.expenses?.utilities || 0,
          repairs: scenarioData.expenses?.repairs_maintenance || 0,
          management: scenarioData.expenses?.management || 0,
          payroll: scenarioData.expenses?.payroll || 0,
          admin: scenarioData.expenses?.admin || 0,
          marketing: scenarioData.expenses?.marketing || 0,
          other: scenarioData.expenses?.other || 0
        };
        
        // RUBS configuration (Ratio Utility Billing System)
        const rubsConfig = scenarioData.value_add?.rubs_config || {
          water: { tenant_paid: false, split_method: 'per_unit' },
          electricity: { tenant_paid: false, split_method: 'sqft' },
          gas: { tenant_paid: false, split_method: 'per_unit' },
          trash: { tenant_paid: false, split_method: 'per_unit' },
          sewer: { tenant_paid: false, split_method: 'per_unit' }
        };
        
        // Tenant Utility Passthrough config (alternative to RUBS - raise rents to cover utilities)
        const utilityPassthroughConfig = scenarioData.value_add?.utility_passthrough_config || {
          water: { enabled: false },
          electricity: { enabled: false },
          gas: { enabled: false },
          trash: { enabled: false },
          sewer: { enabled: false }
        };
        
        // Calculate utility breakdown for value-add
        const valueAddUtilityBreakdown = scenarioData.expenses?.utility_breakdown || {
          water: currentExpenses.utilities / 5,
          electricity: currentExpenses.utilities / 5,
          gas: currentExpenses.utilities / 5,
          trash: currentExpenses.utilities / 5,
          sewer: currentExpenses.utilities / 5
        };
        
        // Calculate RUBS savings (utilities pushed to tenants via RUBS)
        const rubsSavings = Object.keys(valueAddUtilityBreakdown).reduce((total, utility) => {
          if (rubsConfig[utility]?.tenant_paid) {
            return total + (valueAddUtilityBreakdown[utility] || 0);
          }
          return total;
        }, 0);
        
        // Calculate Utility Passthrough savings (raise rent to cover utilities)
        const utilityPassthroughTotal = Object.keys(valueAddUtilityBreakdown).reduce((total, utility) => {
          if (utilityPassthroughConfig[utility]?.enabled) {
            return total + (valueAddUtilityBreakdown[utility] || 0);
          }
          return total;
        }, 0);
        const rentIncreasePerUnit = valueAddTotalUnits > 0 ? (utilityPassthroughTotal / 12) / valueAddTotalUnits : 0;
        
        // Optimized expenses with RUBS and Utility Passthrough
        const optimizedExpenses = scenarioData.value_add?.optimized_expenses || { ...currentExpenses };
        optimizedExpenses.utilities = currentExpenses.utilities - rubsSavings - utilityPassthroughTotal;
        
        const totalCurrentExpenses = Object.values(currentExpenses).reduce((a, b) => a + b, 0);
        const totalOptimizedExpenses = Object.values(optimizedExpenses).reduce((a, b) => a + b, 0);
        const expenseSavings = totalCurrentExpenses - totalOptimizedExpenses;
        
        // Total utility savings (RUBS + Passthrough)
        const totalUtilitySavings = rubsSavings + utilityPassthroughTotal;

        // Simple utility responsibility summary for AI prompt
        const utilityKeys = Object.keys(valueAddUtilityBreakdown);
        const ownerPaidUtilities = utilityKeys.filter((u) => !rubsConfig[u]?.tenant_paid && !utilityPassthroughConfig[u]?.enabled);
        const tenantPaidViaRubs = utilityKeys.filter((u) => rubsConfig[u]?.tenant_paid);
        const tenantPaidViaRentBump = utilityKeys.filter((u) => utilityPassthroughConfig[u]?.enabled);
        
        // Calculate stabilized metrics
        // Use market cap rate if available, otherwise fall back to current cap rate
        const valueAddMarketCapRate = marketCapRate?.market_cap_rate ? (marketCapRate.market_cap_rate / 100) : (currentCapRate / 100 || 0.05);
        const stabilizedNOI = currentNOI + totalAnnualRentUpside + expenseSavings;
        const valueAddStabilizedValue = valueAddMarketCapRate > 0 ? stabilizedNOI / valueAddMarketCapRate : 0;
        const valueCreation = valueAddStabilizedValue - currentPurchasePrice;
        const stabilizedDSCR = valueAddAnnualDebtService > 0 ? stabilizedNOI / valueAddAnnualDebtService : 0;
        
        // iOS-style toggle switch component
        const ToggleSwitch = ({ checked, onChange, label }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              onClick={() => onChange(!checked)}
              style={{ 
                width: '44px', 
                height: '24px', 
                backgroundColor: checked ? '#10b981' : '#d1d5db',
                borderRadius: '12px',
                padding: '2px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: checked ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '50%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s ease'
              }} />
            </div>
            {label && <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{label}</span>}
          </div>
        );
        
        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              
              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: '#e5e7eb', 
                  color: '#111827', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  marginRight: '12px'
                }}>6</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VALUE-ADD STRATEGY
                </h2>
              </div>

              {/* Value Creation Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    CURRENT VALUE
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                    ${currentPurchasePrice.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: marketCapRate ? '2px solid #bae6fd' : '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    MARKET CAP RATE {marketCapRate ? '✓' : ''}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: marketCapRate ? '#0f766e' : '#6b7280' }}>
                    {marketCapRate ? `${marketCapRate.market_cap_rate.toFixed(2)}%` : marketCapRateLoading ? 'Loading...' : '-'}
                  </div>
                  {marketCapRate && (
                    <div style={{ fontSize: '10px', color: '#0f766e', marginTop: '4px' }}>
                      {marketCapRate.asset_class} Class • {marketCapRate.market_tier}
                    </div>
                  )}
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    STABILIZED VALUE
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                    ${valueAddStabilizedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                    @ {marketCapRate ? `${marketCapRate.market_cap_rate.toFixed(2)}%` : `${(valueAddMarketCapRate * 100).toFixed(2)}%`} cap
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    VALUE CREATION
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                    ${valueCreation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ROI ON COST
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                    {currentPurchasePrice > 0 ? ((valueCreation / currentPurchasePrice) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                
                {/* RENT OPTIMIZATION */}
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb', 
                  borderRadius: '16px'
                }}>
                  <div style={{ 
                    marginBottom: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '12px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: '#111827', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>Rent Optimization</h4>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    {/* Individual Unit Rows */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Unit Type</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', textAlign: 'center' }}>Units</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Current Rent</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Market Rent</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>$ Raise Per Unit</div>
                      </div>
                      
                      {valueAddUnitMix.map((unit, index) => {
                        const unitCurrentRent = unit.rent_current || 0;
                        const unitMarketRent = unit.rent_market || unitCurrentRent;
                        const raisePerUnit = unitMarketRent - unitCurrentRent;
                        return (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '14px 16px', backgroundColor: 'white', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e5e7eb' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{unit.unit_type || `Unit ${index + 1}`}</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>{unit.units || 0}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', textAlign: 'right' }}>${unitCurrentRent.toLocaleString()}</div>
                            <div style={{ textAlign: 'right' }}>
                              <input 
                                type="number"
                                value={unitMarketRent}
                                onChange={(e) => {
                                  const newMarketRent = parseFloat(e.target.value) || 0;
                                  const updatedUnitMix = [...valueAddUnitMix];
                                  updatedUnitMix[index] = { ...updatedUnitMix[index], rent_market: newMarketRent };
                                  handleFieldChange('unit_mix', updatedUnitMix);
                                }}
                                style={{ 
                                  width: '100%', 
                                  fontSize: '14px', 
                                  fontWeight: '700', 
                                  color: '#111827', 
                                  backgroundColor: '#f9fafb',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  outline: 'none',
                                  padding: '6px 8px',
                                  textAlign: 'right'
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: raisePerUnit >= 0 ? '#111827' : '#b91c1c', textAlign: 'right' }}>
                              {raisePerUnit >= 0 ? '+' : ''}${raisePerUnit.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total Summary */}
                    <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Total Current Rent</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                          ${currentRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Total Market Rent</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                          ${marketRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb', marginBottom: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Monthly Upside</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                          ${rentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Total Annual Increase</span>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                          ${totalAnnualRentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <strong>Calculation:</strong> (${marketRent.toLocaleString()} market - ${currentRent.toLocaleString()} current) × 12 months = ${totalAnnualRentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })} annual increase
                  </div>
                </div>

                {/* EXPENSE OPTIMIZATION WITH RUBS */}
                <div style={{ 
                  padding: '24px', 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb', 
                  borderRadius: '16px'
                }}>
                  <div style={{ 
                    marginBottom: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '12px'
                  }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: '#111827', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px' 
                    }}>Expense Optimization</h4>
                  </div>

                  {/* RUBS Configuration */}
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '700', color: '#1f2937', textTransform: 'uppercase' }}>
                      RUBS - Ratio Utility Billing System
                    </h5>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
                      Push utility costs to tenants based on unit size or occupancy
                    </div>
                    {Object.keys(valueAddUtilityBreakdown).map(utility => (
                      <div key={utility} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937', textTransform: 'capitalize' }}>
                          {utility}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#1f2937' }}>
                            ${(valueAddUtilityBreakdown[utility] || 0).toLocaleString()}/yr
                          </span>
                          <ToggleSwitch 
                            checked={rubsConfig[utility]?.tenant_paid || false}
                            onChange={(checked) => {
                              const newConfig = { ...rubsConfig, [utility]: { ...rubsConfig[utility], tenant_paid: checked }};
                              handleFieldChange('value_add.rubs_config', newConfig);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#10b981', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>Annual RUBS Savings</span>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>
                          ${rubsSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tenant Utility Passthrough - Rent Increase to Cover Utilities */}
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '700', color: '#1f2937', textTransform: 'uppercase' }}>
                      Tenant Utility Passthrough
                    </h5>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
                      Alternative to RUBS: Raise rents to cover owner-paid utilities instead of billing separately
                    </div>
                    {Object.keys(valueAddUtilityBreakdown).map(utility => {
                      const isDisabled = rubsConfig[utility]?.tenant_paid;
                      return (
                        <div key={`passthrough-${utility}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5e7eb', opacity: isDisabled ? 0.4 : 1 }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937', textTransform: 'capitalize' }}>
                            {utility}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#1f2937' }}>
                              ${(valueAddUtilityBreakdown[utility] || 0).toLocaleString()}/yr
                            </span>
                            <ToggleSwitch 
                              checked={!isDisabled && (utilityPassthroughConfig[utility]?.enabled || false)}
                              onChange={(checked) => {
                                if (isDisabled) return;
                                const newConfig = { ...utilityPassthroughConfig, [utility]: { enabled: checked }};
                                handleFieldChange('value_add.utility_passthrough_config', newConfig);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Passthrough Summary */}
                    {utilityPassthroughTotal > 0 && (
                      <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #60a5fa' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Annual Utility Cost to Cover</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e40af' }}>
                              ${utilityPassthroughTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#1e40af', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Rent Increase Needed Per Unit</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e40af' }}>
                              +${rentIncreasePerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '11px', color: '#3b82f6' }}>
                          <strong>How it works:</strong> ${utilityPassthroughTotal.toLocaleString()}/yr ÷ 12 months ÷ {valueAddTotalUnits} units = ${rentIncreasePerUnit.toFixed(0)}/unit/mo rent increase
                        </div>
                      </div>
                    )}
                    
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#4c1d95' }}>Annual Passthrough Savings</span>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#4c1d95' }}>
                          ${utilityPassthroughTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Expense Comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Current Expenses</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>
                        ${totalCurrentExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11px', color: '#166534', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Optimized Expenses</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>
                        ${totalOptimizedExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {/** Show combined annual savings: rent upside + expense savings */}
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Total Annual Savings (Rent + Expense)</span>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>
                        ${( (expenseSavings || 0) + (totalAnnualRentUpside || 0) ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#4b5563' }}>
                      Rent Upside: ${totalAnnualRentUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })} • Expense Savings: ${expenseSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    {totalUtilitySavings > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#4b5563' }}>
                        RUBS: ${rubsSavings.toLocaleString()} + Passthrough: ${utilityPassthroughTotal.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stabilized Performance Metrics */}
              <div style={{ 
                padding: '24px', 
                backgroundColor: 'white',
                borderRadius: '16px',
                marginBottom: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: '#111827', 
                  marginBottom: '20px',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Current vs Stabilized Performance
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  {/* NOI Comparison */}
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Net Operating Income</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>${currentNOI.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      {noiProforma > 0 && (
                        <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
                          Pro Forma NOI: ${noiProforma.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>${stabilizedNOI.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>

                  {/* Cap Rate */}
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Cap Rate</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Going-In</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>{currentCapRate.toFixed(2)}%</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Market Cap</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>
                        {marketCapRate?.market_cap_rate?.toFixed(2) || currentCapRate.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
                        {marketCapRate ? 'LLM estimate' : 'Same as going-in'}
                      </div>
                    </div>
                  </div>

                  {/* Property Value */}
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Property Value</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>${currentPurchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>${valueAddStabilizedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>

                  {/* DSCR */}
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>DSCR</div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Current</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>{currentDSCR.toFixed(2)}x</div>
                    </div>
                    <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Stabilized</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>{stabilizedDSCR.toFixed(2)}x</div>
                    </div>
                  </div>

                  {/* Value Creation */}
                  <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Value Creation</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
                      ${valueCreation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {currentPurchasePrice > 0 ? ((valueCreation / currentPurchasePrice) * 100).toFixed(1) : '0.0'}% increase in value
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Creative Suggestions */}
              <div style={{ 
                padding: '24px', 
                backgroundColor: 'white',
                border: '1px solid #e5e7eb', 
                borderRadius: '16px'
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: '700', 
                  color: '#111827', 
                  marginBottom: '20px',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  AI Value-Add Recommendations
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#6d28d9', marginBottom: '12px', textTransform: 'uppercase' }}>
                      Revenue Enhancement Ideas
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#4b5563', lineHeight: '1.8' }}>
                      <li>Implement paid parking program (+${(valueAddTotalUnits * 25).toLocaleString()}/mo)</li>
                      <li>Add pet fees ($300/pet one-time + $25/mo)</li>
                      <li>Install package lockers with monthly fee</li>
                      <li>Offer premium storage units</li>
                      <li>Laundry room revenue optimization</li>
                      <li>Vending machines & amenity income</li>
                      <li>Application & admin fees review</li>
                    </ul>
                  </div>

                  <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#6d28d9', marginBottom: '12px', textTransform: 'uppercase' }}>
                      Expense Reduction Ideas
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#4b5563', lineHeight: '1.8' }}>
                      <li>Implement RUBS billing system (utilities)</li>
                      <li>LED lighting conversion (-20% electric)</li>
                      <li>Low-flow fixtures (-15% water)</li>
                      <li>Negotiate insurance quotes annually</li>
                      <li>Contest property tax assessment</li>
                      <li>Bulk purchasing agreements for supplies</li>
                      <li>In-house maintenance vs contractors</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!setInputValue || !handleSendMessage) return;

                    const ownerPaysText = ownerPaidUtilities.length
                      ? ownerPaidUtilities.join(', ')
                      : 'none (all major utilities recovered from tenants)';
                    const rubsText = tenantPaidViaRubs.length
                      ? tenantPaidViaRubs.join(', ')
                      : 'none';
                    const passthroughText = tenantPaidViaRentBump.length
                      ? tenantPaidViaRentBump.join(', ')
                      : 'none';

                    const valueAddPrompt = `You are Max, my multifamily value-add strategist.

Here is the current value-add picture for this deal:
- Current annual NOI: $${currentNOI.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Stabilized annual NOI (after planned value-add): $${stabilizedNOI.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Current DSCR: ${currentDSCR.toFixed(2)}x, Stabilized DSCR: ${stabilizedDSCR.toFixed(2)}x
- Current purchase price / basis: $${currentPurchasePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Stabilized value (at value-add cap rate): $${valueAddStabilizedValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Modeled value creation: $${valueCreation.toLocaleString('en-US', { maximumFractionDigits: 0 })}

Rents and income:
- Total current monthly rent: $${currentRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Total market monthly rent (fully pushed): $${marketRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Total annual rent upside modeled: $${totalAnnualRentUpside.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Total units: ${valueAddTotalUnits}

Expenses and utilities:
- Current total annual operating expenses: $${totalCurrentExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Optimized annual expenses after value-add: $${totalOptimizedExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Annual expense savings modeled: $${expenseSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Annual utility savings (RUBS + passthrough): $${totalUtilitySavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
- Owner currently pays (not recovered from tenants): ${ownerPaysText}
- Utilities billed directly via RUBS: ${rubsText}
- Utilities recovered via rent increases (passthrough): ${passthroughText}

Using ONLY the numbers above and the rest of the underwriting model, do all of the following:

1) Decide whether the best value-add focus for THIS property is primarily:
   - pushing rents (closing the gap between current and market),
   - driving operating expense reductions (especially utilities and controllable expenses),
   - or a balanced mix of both.
   Be explicit and quantify how much of the modeled NOI growth is coming from rent vs expense savings.

2) Look at who is currently paying each major utility and tell me, in plain English, whether I should:
   - push harder on RUBS / tenant-paid utilities,
   - convert more to utility passthrough via rent bumps,
   - or leave utilities as-is to stay competitive.
   Call out any utilities where I am obviously leaving money on the table.

3) Stress-test the modeled value creation:
   - Re-run (conceptually) a softer scenario where I only capture HALF of the rent upside and HALF of the expense savings.
   - In that softer case, estimate what stabilized NOI, DSCR, and value creation would look like.
   - Tell me whether the deal is still worth executing as a value-add play under that more conservative outcome.

4) Give me a concrete value-add game plan for the next 18-24 months:
   - Top 5 rent strategies (unit upgrades, amenities, fees) that fit this deal.
   - Top 5 expense strategies (utilities, payroll/maintenance, management, contracts) that move the needle the most.
   - A simple timeline of which levers to pull first for fastest DSCR and cash-flow improvement.

Keep the answer tight but specific to this property and the numbers above.`;

                    setInputValue(valueAddPrompt);
                    setTimeout(() => handleSendMessage(), 100);
                  }}
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#111827',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 6px rgba(15, 23, 42, 0.15)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#000000'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#111827'}
                >
                  Ask AI for Custom Value-Add Strategy
                </button>
              </div>

            </div>
          </div>
        );

      case 'exit-strategy':
        // ============================================================================
        // EXIT STRATEGY PLAYBOOK (calc-engine only)
        // ============================================================================
        const exitData = fullCalcs.exit || {};
        const debtTimeline = exitData.debtTimeline || [];
        const equityTimeline = exitData.equityExitTimeline || { rows: [] };
        const equityRows = equityTimeline.rows || [];

        const exitScenarios = fullCalcs.returns?.exitScenarios || [];
        const holdingPeriod = fullCalcs.returns?.holdingPeriod || selectedHoldPeriod;

        // Use selected hold period if we have a scenario for it; otherwise
        // fall back to the model's holding period or the first available exit.
        let selectedScenario = exitScenarios.find(s => s.exitYear === selectedHoldPeriod);
        if (!selectedScenario && exitScenarios.length > 0) {
          selectedScenario = exitScenarios.find(s => s.exitYear === holdingPeriod) || exitScenarios[0];
        }

        const projectionsArray = fullCalcs.projections || [];
        const selectedProjection = selectedScenario
          ? projectionsArray.find(p => p.year === selectedScenario.exitYear)
          : null;

        const exitTotalEquity = fullCalcs.financing?.totalEquityRequired || fullCalcs.total_project_cost || 0;

        // Determine a simple "model-favored" exit based on IRR so we can
        // present a deterministic recommended exit strategy without doing
        // any new math. All numbers come directly from calc_json.returns.
        const bestScenario = exitScenarios && exitScenarios.length > 0
          ? exitScenarios.reduce((best, s) => {
              if (!best) return s;
              return s.irr > best.irr ? s : best;
            }, null)
          : null;

        const DebtTimelineCard = ({ timeline }) => {
          if (!timeline || timeline.length === 0) return null;

          const first = timeline[0];
          const last = timeline[timeline.length - 1];

          return (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              padding: '20px', 
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>
                Debt Timeline
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Original Loan Amount</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${first.beginningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Balance at Exit</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${last.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Principal Paid</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
                    ${last.cumulativePrincipalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#4b5563', fontWeight: 700 }}>Year</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Beg. Balance</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>End Balance</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Principal</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((row, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '8px', fontWeight: row.isExitYear ? 700 : 500, color: '#111827' }}>Year {row.year}{row.isExitYear ? ' (Exit)' : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.beginningBalance.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.endingBalance.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>${row.principalPaid.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>${row.interestPaid.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        };

        const EquityExitTimelineCard = ({ timeline }) => {
          if (!timeline || !timeline.rows || timeline.rows.length === 0) return null;

          const lastRow = timeline.rows[timeline.rows.length - 1];
          const paybackYear = timeline.paybackYear;

          return (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              padding: '20px', 
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase' }}>
                Equity Exit Timeline
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Initial Equity</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${timeline.initialEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Equity Returned by Exit</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
                    ${lastRow.equityReturned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Equity Multiple / IRR</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>
                    {timeline.finalEquityMultiple.toFixed(2)}x @ {timeline.finalIRR.toFixed(1)}%
                  </div>
                </div>
              </div>
              {paybackYear && (
                <div style={{ fontSize: '11px', color: '#0f766e', marginBottom: '12px' }}>
                  Full return of capital achieved in year {paybackYear}.
                </div>
              )}
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#4b5563', fontWeight: 700 }}>Year</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Distributions</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Cum. Distributions</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Equity Remaining</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#4b5563', fontWeight: 700 }}>Equity Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.rows.map((row, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '8px', fontWeight: row.year === timeline.exitYear ? 700 : 500, color: '#111827' }}>Year {row.year}{row.year === timeline.exitYear ? ' (Exit)' : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.totalDistribution.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.cumulativeDistributions.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.equityRemaining.toLocaleString()}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>${row.equityReturned.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        };
        
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
                }}>7</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  EXIT STRATEGY PLAYBOOK
                </h2>
              </div>

              {/* Recommended Exit Summary (purely from calc_json) */}
              {bestScenario && (
                <div style={{
                  marginBottom: '24px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ecfeff 0%, #e0f2fe 100%)',
                  border: '1px solid #7dd3fc'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recommended Exit (Model View Only)
                  </div>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.6 }}>
                    Based on the modeled cash flows, the strongest exit is in year {bestScenario.exitYear}, targeting an
                    IRR of {bestScenario.irr.toFixed(1)}% and an equity multiple of {bestScenario.equityMultiple.toFixed(2)}x.
                    This corresponds to approximately ${bestScenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} of total profit
                    on about ${exitTotalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })} of initial equity.
                  </div>
                </div>
              )}

              {/* Hold Period Selector */}
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                padding: '20px', 
                marginBottom: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase' }}>
                  Select Hold Period
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[3, 5, 7, 10].map(years => (
                    <button
                      key={years}
                      onClick={() => setSelectedHoldPeriod(years)}
                      style={{
                        padding: '16px 32px',
                        backgroundColor: selectedHoldPeriod === years ? '#1e293b' : '#f1f5f9',
                        color: selectedHoldPeriod === years ? 'white' : '#475569',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {years} Years
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Metrics at Selected Hold Period */}
              {selectedScenario && selectedProjection && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Projected NOI at Exit
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                        ${selectedProjection.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        Exit year {selectedScenario.exitYear}
                      </div>
                    </div>
                    
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Loan Balance at Exit
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                        ${selectedProjection.loanBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        ${(debtTimeline.length > 0
                          ? debtTimeline[debtTimeline.length - 1].cumulativePrincipalPaid
                          : 0
                        ).toLocaleString(undefined, { maximumFractionDigits: 0 })} principal paid
                      </div>
                    </div>
                    
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Cumulative Cash Flow
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: selectedScenario.cumulativeCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
                        ${equityRows.length > 0
                          ? equityRows[Math.min(equityRows.length - 1, selectedScenario.exitYear - 1)].cumulativeDistributions.toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        over {selectedHoldPeriod} years
                      </div>
                    </div>
                    
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Total Equity Invested
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
                        ${exitTotalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        initial investment
                      </div>
                    </div>
                  </div>

                  {/* Exit Scenarios Comparison Table */}
                  <div style={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px', 
                    padding: '24px',
                    marginBottom: '24px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '20px', textTransform: 'uppercase' }}>
                      Exit Scenarios - {selectedHoldPeriod} Year Hold
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                      {[selectedScenario].filter(Boolean).map((scenario, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '24px',
                            borderRadius: '12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ 
                            fontSize: '12px', 
                            fontWeight: '700', 
                            color: '#10b981',
                            marginBottom: '4px',
                            textTransform: 'uppercase'
                          }}>
                            Base Case
                          </div>
                          <div style={{ 
                            fontSize: '14px', 
                            color: '#94a3b8',
                            marginBottom: '16px'
                          }}>
                            Exit Year {scenario.exitYear}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Sale Price</div>
                              <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                                ${(
                                  projectionsArray.find(p => p.year === scenario.exitYear)?.grossSalesPrice || 0
                                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            
                            <div>
                              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Net Proceeds</div>
                              <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                                ${(
                                  projectionsArray.find(p => p.year === scenario.exitYear)?.netSalesProceeds || 0
                                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            
                            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '4px' }}>
                              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Total Profit</div>
                              <div style={{ fontSize: '24px', fontWeight: '800', color: scenario.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                ${scenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>Equity Multiple</div>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                                  {scenario.equityMultiple.toFixed(2)}x
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>IRR</div>
                                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                                  {scenario.irr.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* All Hold Periods Comparison */}
                  <div style={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px', 
                    padding: '24px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '20px', textTransform: 'uppercase' }}>
                      Hold Period Comparison (Modeled Exits)
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1e293b' }}>
                          <th style={{ padding: '14px 16px', textAlign: 'left', color: 'white', fontSize: '12px', fontWeight: '700' }}>Hold Period</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Exit NOI</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Sale Price</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Total Profit</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>Equity Multiple</th>
                          <th style={{ padding: '14px 16px', textAlign: 'right', color: 'white', fontSize: '12px', fontWeight: '700' }}>IRR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exitScenarios.map((scenario, idx) => {
                          const isSelected = scenario.exitYear === selectedHoldPeriod;
                          const proj = projectionsArray.find(p => p.year === scenario.exitYear);
                          return (
                            <tr 
                              key={idx}
                              onClick={() => setSelectedHoldPeriod(scenario.exitYear)}
                              style={{ 
                                backgroundColor: isSelected ? '#f0fdf4' : idx % 2 === 0 ? 'white' : '#f9fafb',
                                cursor: 'pointer',
                                borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent'
                              }}
                            >
                              <td style={{ padding: '14px 16px', fontWeight: '700', color: '#111827' }}>{scenario.exitYear} Years</td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: '#111827' }}>${(proj?.noi || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', color: '#111827' }}>${(proj?.grossSalesPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: scenario.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                ${scenario.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{scenario.equityMultiple.toFixed(2)}x</td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{scenario.irr.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Assumptions Note */}
              <div style={{ 
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>Modeled Exit Summary</div>
                <div style={{ fontSize: '11px', color: '#3b82f6', lineHeight: '1.6' }}>
                  All exit metrics on this tab are computed directly from the core calc engine projections 
                  (NOI path, debt service, loan balance, and reversion cash flow). No LLM math is used here.
                </div>
              </div>

            </div>
          </div>
        );

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
        // pricing_financing stores as decimal (0.055 for 5.5%)
        // financing object may store as percentage (5.5)
        let amortInterestRate = pricing_financing?.interest_rate || 0;
        if (!amortInterestRate || amortInterestRate === 0) {
          // Check financing object (stored as percentage, convert to decimal)
          const financeRate = scenarioData.financing?.interest_rate || 0;
          if (financeRate > 0) {
            amortInterestRate = financeRate > 1 ? financeRate / 100 : financeRate; // Convert if percentage
          }
        }
        // If still 0, use a default rate for display purposes
        if (!amortInterestRate || amortInterestRate === 0) {
          amortInterestRate = 0.06; // Default 6%
        }
        
        // Get loan term
        const loanTerm = pricing_financing?.term_years || pricing_financing?.amortization_years || scenarioData.financing?.loan_term_years || 30;
        const amortizationYears = pricing_financing?.amortization_years || scenarioData.financing?.amortization_years || loanTerm;
        
        // Calculate monthly and annual debt service
        let monthlyDebtService = pricing_financing?.monthly_payment || fullCalcs.financing?.monthlyPayment || 0;
        let amortAnnualDebtService = pricing_financing?.annual_debt_service || fullCalcs.financing?.annualDebtService || 0;
        
        // If we have loan details but no payment, calculate it
        if ((!monthlyDebtService || monthlyDebtService === 0) && amortLoanAmount > 0 && amortInterestRate > 0 && amortizationYears > 0) {
          const monthlyRate = amortInterestRate / 12;
          const numPayments = amortizationYears * 12;
          monthlyDebtService = amortLoanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          amortAnnualDebtService = monthlyDebtService * 12;
        }
        
        // Loan constant (aka loan factor rate) and spread vs cap rate
        const loanConstant = (amortLoanAmount > 0 && amortAnnualDebtService > 0) ? (amortAnnualDebtService / amortLoanAmount) : null; // decimal e.g. 0.1025 for 10.25%
        // capRate from global scope is already a percentage (e.g. 5.24 for 5.24%), convert to decimal for comparison
        const capRateDecimal = capRate != null ? (capRate > 1 ? capRate / 100 : capRate) : (fullCalcs?.year1?.capRate != null ? (fullCalcs.year1.capRate > 1 ? fullCalcs.year1.capRate / 100 : fullCalcs.year1.capRate) : null);
        const spreadCapMinusConstant = (capRateDecimal != null && loanConstant != null) ? (capRateDecimal - loanConstant) : null;
        const leverageStatus = spreadCapMinusConstant != null ? (spreadCapMinusConstant >= 0 ? 'Positive Leverage' : 'Negative Leverage') : '—';

        // Generate amortization schedule if not available
        let amortSchedule = fullCalcs.amortizationSchedule || [];
        if (amortSchedule.length === 0 && amortLoanAmount > 0 && amortInterestRate > 0 && amortizationYears > 0) {
          const monthlyRate = amortInterestRate / 12;
          const numPayments = amortizationYears * 12;
          const monthlyPayment = amortLoanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
          
          let balance = amortLoanAmount;
          let cumulativePrincipal = 0;
          
          for (let year = 1; year <= Math.min(amortizationYears, loanTerm); year++) {
            let yearlyPrincipal = 0;
            let yearlyInterest = 0;
            
            for (let month = 1; month <= 12; month++) {
              if (balance <= 0) break;
              const interestPayment = balance * monthlyRate;
              const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
              yearlyPrincipal += principalPayment;
              yearlyInterest += interestPayment;
              balance -= principalPayment;
            }
            
            cumulativePrincipal += yearlyPrincipal;
            
            amortSchedule.push({
              year,
              payment: Math.round(yearlyPrincipal + yearlyInterest),
              principal: Math.round(yearlyPrincipal),
              interest: Math.round(yearlyInterest),
              balance: Math.round(Math.max(0, balance)),
              cumulativePrincipal: Math.round(cumulativePrincipal)
            });
          }
        }

        // Neutral card style (match Deal Structure look, no dark colors)
        const darkBoxStyle = {
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
        };
        const darkLabelStyle = {
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '8px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.06em'
        };

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

              {/* Loan Summary Cards - All Dark Theme */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>LOAN AMOUNT</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${amortLoanAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>
                
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>INTEREST RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    {(amortInterestRate * 100).toFixed(2)}%
                  </div>
                </div>
                
                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>LOAN TERM</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    {loanTerm} Years
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>MONTHLY DEBT SERVICE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${monthlyDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>ANNUAL DEBT SERVICE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    ${amortAnnualDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>CAP RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    {capRateDecimal != null ? (capRateDecimal * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>LOAN CONSTANT</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    {loanConstant != null ? (loanConstant * 100).toFixed(2) + '%' : '—'}
                  </div>
                </div>

                <div style={darkBoxStyle}>
                  <div style={darkLabelStyle}>SPREAD (CAP - CONSTANT)</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>
                    {spreadCapMinusConstant != null ? (spreadCapMinusConstant * 100).toFixed(2) + '%' : '—'}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {leverageStatus}
                  </div>
                </div>
              </div>

              {/* Positive/Negative Leverage Explanation */}
              <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', color: '#374151' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Cap rate vs loan constant</div>
                  <div style={{ marginBottom: 6 }}>
                    Cap rate {capRateDecimal != null ? ((capRateDecimal * 100).toFixed(2) + '%') : ''} vs loan constant {loanConstant != null ? ((loanConstant * 100).toFixed(2) + '%') : ''} -&gt; {leverageStatus}.
                  </div>
                  <div style={{ color: '#111827' }}>
                    Cap rate greater than loan constant means positive leverage. The property yield exceeds the cost of debt, so borrowing helps cash flow.
                  </div>
                  <div style={{ marginTop: 4, color: '#111827' }}>
                    Cap rate less than loan constant means negative leverage. The debt costs more than the property yields, hurting cash flow.
                  </div>
                </div>
              </div>
            
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
                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: 'white' }} 
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} 
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                            <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>Year {row.year}</td>
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
            </div>
          </div>
        );

      case 'syndication':
        // Initialize syndication data with defaults
        const syndicationData = scenarioData.syndication || {
          equity_classes: [
            { id: 'class-a', name: 'Class A (Preferred)', type: 'preferred', amount: 0, pref_rate: 8, promote: 0, fees: { acquisition: 0, asset_mgmt: 0 }, voting: false },
            { id: 'class-b', name: 'Class B (LP Common)', type: 'lp', amount: 0, pref_rate: 8, promote: 0, fees: {}, voting: true },
            { id: 'gp', name: 'GP / Sponsor', type: 'gp', amount: 0, pref_rate: 0, promote: 20, fees: { acquisition: 2, asset_mgmt: 1.5, disposition: 1 }, voting: true }
          ],
          pref_type: 'cumulative_soft', // cumulative_soft, cumulative_hard, non_cumulative, compounding_cumulative
          distribution_frequency: 'quarterly', // monthly, quarterly, annually
          waterfall_tiers: [
            { id: 1, name: 'Tier 1: Preferred Return', condition_type: 'pref', pref_rate: 8, split_lp: 100, split_gp: 0 },
            { id: 2, name: 'Tier 2: GP Catch-Up', condition_type: 'catchup', target_split: 70, split_lp: 30, split_gp: 70 },
            { id: 3, name: 'Tier 3: 70/30 Split to 13% IRR', condition_type: 'irr', irr_hurdle: 13, split_lp: 70, split_gp: 30 },
            { id: 4, name: 'Tier 4: 60/40 Split to 18% IRR', condition_type: 'irr', irr_hurdle: 18, split_lp: 60, split_gp: 40 },
            { id: 5, name: 'Tier 5: 50/50 Split Thereafter', condition_type: 'infinity', split_lp: 50, split_gp: 50 }
          ],
          fees: {
            acquisition_fee: { enabled: true, rate: 2, basis: 'purchase_price' },
            asset_mgmt_fee: { enabled: true, rate: 1.5, basis: 'equity', frequency: 'annual' },
            construction_fee: { enabled: false, rate: 3, basis: 'budget' },
            disposition_fee: { enabled: true, rate: 1, basis: 'sale_price' },
            refinance_fee: { enabled: false, rate: 0.5, basis: 'loan_proceeds' }
          },
          events: [],
          scenarios: { base: {}, conservative: {}, aggressive: {} }
        };

        // Calculate total equity and splits
        const totalEquity = syndicationData.equity_classes.reduce((sum, c) => sum + (c.amount || 0), 0) || (fullCalcs.financing?.totalEquityRequired || 500000);
        const syndicationPurchasePrice = fullCalcs.acquisition?.purchasePrice || purchasePrice || 2700000;
        const annualNOI = fullCalcs.year1?.noi || 142597;
        const projectHoldYears = 5;
        
        // Calculate capital accounts over time
        const calculateCapitalAccounts = () => {
          const accounts = {};
          syndicationData.equity_classes.forEach(cls => {
            const classEquity = cls.amount || (totalEquity * (cls.type === 'gp' ? 0.05 : 0.475));
            accounts[cls.id] = [];
            let balance = classEquity;
            
            for (let year = 1; year <= projectHoldYears; year++) {
              const prefAccrued = balance * (cls.pref_rate / 100);
              const distributions = annualNOI * 0.6; // Simplified distribution
              const roc = Math.min(distributions * 0.3, balance);
              const prefPaid = Math.min(prefAccrued, distributions * 0.4);
              const endBalance = balance - roc;
              
              accounts[cls.id].push({
                year,
                begBalance: balance,
                contributed: year === 1 ? classEquity : 0,
                prefAccrued,
                rocPaid: roc,
                prefPaid,
                promote: 0,
                endBalance
              });
              
              balance = endBalance;
            }
          });
          return accounts;
        };

        const capitalAccounts = calculateCapitalAccounts();

        // Calculate fees
        const acquisitionFee = syndicationData.fees.acquisition_fee.enabled ? syndicationPurchasePrice * (syndicationData.fees.acquisition_fee.rate / 100) : 0;
        const assetMgmtFee = syndicationData.fees.asset_mgmt_fee.enabled ? totalEquity * (syndicationData.fees.asset_mgmt_fee.rate / 100) : 0;
        const dispositionFee = syndicationData.fees.disposition_fee.enabled ? syndicationPurchasePrice * (syndicationData.fees.disposition_fee.rate / 100) * 1.2 : 0;

        return (
          <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: '#8b5cf6', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  marginRight: '12px'
                }}>💰</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  SYNDICATION & WATERFALL STRUCTURE
                </h2>
              </div>

              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Total Equity</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>${totalEquity.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Equity Classes</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>{syndicationData.equity_classes.length}</div>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Waterfall Tiers</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>{syndicationData.waterfall_tiers.length}</div>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Pref Type</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginTop: '8px' }}>
                    {syndicationData.pref_type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Equity Classes Configuration */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    🏦 EQUITY CLASS STRUCTURE
                  </h3>
                  <button
                    onClick={() => {
                      const newClass = {
                        id: `class-${Date.now()}`,
                        name: `Class ${String.fromCharCode(65 + syndicationData.equity_classes.length)}`,
                        type: 'lp',
                        amount: 0,
                        pref_rate: 8,
                        promote: 0,
                        fees: {},
                        voting: true
                      };
                      handleFieldChange('syndication.equity_classes', [...syndicationData.equity_classes, newClass]);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Class
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Class Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Type</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Capital</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>% of Total</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Pref Return</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Promote %</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Voting</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syndicationData.equity_classes.map((cls, idx) => {
                        const classAmount = cls.amount || (totalEquity * (cls.type === 'gp' ? 0.05 : 0.475));
                        const pctOfTotal = totalEquity > 0 ? (classAmount / totalEquity * 100) : 0;
                        return (
                          <tr key={cls.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>
                              <input
                                type="text"
                                value={cls.name}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].name = e.target.value;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontWeight: '600' }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <select
                                value={cls.type}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].type = e.target.value;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                              >
                                <option value="preferred">Preferred</option>
                                <option value="lp">LP Common</option>
                                <option value="co-gp">Co-GP</option>
                                <option value="gp">GP/Sponsor</option>
                                <option value="mezz">Mezzanine</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                value={classAmount}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].amount = parseFloat(e.target.value) || 0;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ width: '120px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#6b7280' }}>
                              {pctOfTotal.toFixed(1)}%
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.1"
                                value={cls.pref_rate}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].pref_rate = parseFloat(e.target.value) || 0;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ width: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="1"
                                value={cls.promote}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].promote = parseFloat(e.target.value) || 0;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ width: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={cls.voting}
                                onChange={(e) => {
                                  const updated = [...syndicationData.equity_classes];
                                  updated[idx].voting = e.target.checked;
                                  handleFieldChange('syndication.equity_classes', updated);
                                }}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {syndicationData.equity_classes.length > 1 && (
                                <button
                                  onClick={() => {
                                    const updated = syndicationData.equity_classes.filter((_, i) => i !== idx);
                                    handleFieldChange('syndication.equity_classes', updated);
                                  }}
                                  style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preferred Return Configuration */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  ⚙️ PREFERRED RETURN SETTINGS
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Pref Return Type</label>
                    <select
                      value={syndicationData.pref_type}
                      onChange={(e) => handleFieldChange('syndication.pref_type', e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    >
                      <option value="cumulative_soft">Cumulative Soft</option>
                      <option value="cumulative_hard">Cumulative Hard</option>
                      <option value="non_cumulative">Non-Cumulative</option>
                      <option value="compounding_cumulative">Compounding Cumulative</option>
                      <option value="compounding_non_cumulative">Compounding Non-Cumulative</option>
                    </select>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                      {syndicationData.pref_type === 'cumulative_soft' && 'Unpaid pref carries forward, GP can get catch-up before full pref'}
                      {syndicationData.pref_type === 'cumulative_hard' && 'LP gets full pref before GP paid anything'}
                      {syndicationData.pref_type === 'non_cumulative' && 'Pref doesn\'t carry forward if not paid'}
                      {syndicationData.pref_type.includes('compounding') && 'Unpaid pref accrues interest on itself'}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Distribution Frequency</label>
                    <select
                      value={syndicationData.distribution_frequency}
                      onChange={(e) => handleFieldChange('syndication.distribution_frequency', e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px', display: 'block' }}>Project Hold Period</label>
                    <input
                      type="number"
                      value={projectHoldYears}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', textAlign: 'right' }}
                      readOnly
                    />
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Years</div>
                  </div>
                </div>
              </div>

              {/* Waterfall Tier Structure - DRAG AND DROP STYLE */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                    📊 WATERFALL TIER STRUCTURE
                  </h3>
                  <button
                    onClick={() => {
                      const newTier = {
                        id: syndicationData.waterfall_tiers.length + 1,
                        name: `Tier ${syndicationData.waterfall_tiers.length + 1}`,
                        condition_type: 'irr',
                        irr_hurdle: 15,
                        split_lp: 50,
                        split_gp: 50
                      };
                      handleFieldChange('syndication.waterfall_tiers', [...syndicationData.waterfall_tiers, newTier]);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Tier
                  </button>
                </div>

                {syndicationData.waterfall_tiers.map((tier, idx) => (
                  <div key={tier.id} style={{ 
                    backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white', 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    marginBottom: '12px' 
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Tier Name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            updated[idx].name = e.target.value;
                            handleFieldChange('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Condition</label>
                        <select
                          value={tier.condition_type}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            updated[idx].condition_type = e.target.value;
                            handleFieldChange('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}
                        >
                          <option value="pref">Pref Return</option>
                          <option value="catchup">Catch-Up</option>
                          <option value="irr">IRR Hurdle</option>
                          <option value="equity_multiple">Equity Multiple</option>
                          <option value="roc">Return of Capital</option>
                          <option value="infinity">No Limit</option>
                        </select>
                      </div>

                      {tier.condition_type === 'irr' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>IRR %</label>
                          <input
                            type="number"
                            step="0.5"
                            value={tier.irr_hurdle || 0}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].irr_hurdle = parseFloat(e.target.value) || 0;
                              handleFieldChange('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      {tier.condition_type === 'pref' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Pref %</label>
                          <input
                            type="number"
                            step="0.5"
                            value={tier.pref_rate || 0}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].pref_rate = parseFloat(e.target.value) || 0;
                              handleFieldChange('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      {tier.condition_type === 'catchup' && (
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Target Split</label>
                          <input
                            type="number"
                            value={tier.target_split || 70}
                            onChange={(e) => {
                              const updated = [...syndicationData.waterfall_tiers];
                              updated[idx].target_split = parseFloat(e.target.value) || 70;
                              handleFieldChange('syndication.waterfall_tiers', updated);
                            }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>LP Split %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.split_lp}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            const lpSplit = parseFloat(e.target.value) || 0;
                            updated[idx].split_lp = lpSplit;
                            updated[idx].split_gp = 100 - lpSplit;
                            handleFieldChange('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', display: 'block' }}>GP Split %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.split_gp}
                          onChange={(e) => {
                            const updated = [...syndicationData.waterfall_tiers];
                            const gpSplit = parseFloat(e.target.value) || 0;
                            updated[idx].split_gp = gpSplit;
                            updated[idx].split_lp = 100 - gpSplit;
                            handleFieldChange('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right', backgroundColor: '#fef3c7' }}
                        />
                      </div>

                      <div>
                        <button
                          onClick={() => {
                            const updated = syndicationData.waterfall_tiers.filter((_, i) => i !== idx);
                            handleFieldChange('syndication.waterfall_tiers', updated);
                          }}
                          style={{ width: '100%', padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '18px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fee Structure */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  💵 GP FEE STRUCTURE
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  {/* Acquisition Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Acquisition Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.acquisition_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.acquisition_fee, enabled: e.target.checked };
                          handleFieldChange('syndication.fees.acquisition_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.acquisition_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.acquisition_fee, rate: parseFloat(e.target.value) || 0 };
                            handleFieldChange('syndication.fees.acquisition_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Fee Amount</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${acquisitionFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Management Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Asset Management Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.asset_mgmt_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.asset_mgmt_fee, enabled: e.target.checked };
                          handleFieldChange('syndication.fees.asset_mgmt_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.asset_mgmt_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.asset_mgmt_fee, rate: parseFloat(e.target.value) || 0 };
                            handleFieldChange('syndication.fees.asset_mgmt_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Annual Fee</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${assetMgmtFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disposition Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Disposition Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.disposition_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.disposition_fee, enabled: e.target.checked };
                          handleFieldChange('syndication.fees.disposition_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.disposition_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.disposition_fee, rate: parseFloat(e.target.value) || 0 };
                            handleFieldChange('syndication.fees.disposition_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Est. Fee</label>
                        <div style={{ padding: '8px', backgroundColor: '#d1fae5', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: '#065f46', textAlign: 'right' }}>
                          ${dispositionFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Construction Fee */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Construction/CapEx Fee</label>
                      <input
                        type="checkbox"
                        checked={syndicationData.fees.construction_fee.enabled}
                        onChange={(e) => {
                          const updated = { ...syndicationData.fees.construction_fee, enabled: e.target.checked };
                          handleFieldChange('syndication.fees.construction_fee', updated);
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={syndicationData.fees.construction_fee.rate}
                          onChange={(e) => {
                            const updated = { ...syndicationData.fees.construction_fee, rate: parseFloat(e.target.value) || 0 };
                            handleFieldChange('syndication.fees.construction_fee', updated);
                          }}
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>Budget</label>
                        <input
                          type="number"
                          placeholder="CapEx Budget"
                          style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#dbeafe', borderRadius: '8px', border: '2px solid #60a5fa' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '8px' }}>Total GP Fees (5 Years)</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e40af' }}>
                    ${(acquisitionFee + (assetMgmtFee * projectHoldYears) + dispositionFee).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Capital Account Tracking */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                  📈 CAPITAL ACCOUNTS & RUNNING BALANCES
                </h3>

                {syndicationData.equity_classes.map((cls) => {
                  const accounts = capitalAccounts[cls.id] || [];
                  return (
                    <div key={cls.id} style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', marginBottom: '12px' }}>
                        {cls.name}
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700' }}>Year</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Beg Balance</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Contributed</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Pref Accrued</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>ROC Paid</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Pref Paid</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>Promote</th>
                              <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>End Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.map((acc, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                                <td style={{ padding: '10px', fontWeight: '600' }}>Year {acc.year}</td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>${acc.begBalance.toLocaleString()}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                                  {acc.contributed > 0 ? `$${acc.contributed.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>${acc.prefAccrued.toLocaleString()}</td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#3b82f6' }}>
                                  {acc.rocPaid > 0 ? `$${acc.rocPaid.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                                  {acc.prefPaid > 0 ? `$${acc.prefPaid.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', color: '#f59e0b' }}>
                                  {acc.promote > 0 ? `$${acc.promote.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>${acc.endBalance.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export & AI Integration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => {
                    // Export to Excel/PDF functionality
                    alert('LP Statement export feature - connect to backend API');
                  }}
                  style={{
                    padding: '16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  📊 Download LP Statement (Excel)
                </button>

                <button
                  onClick={() => {
                    if (setInputValue && handleSendMessage) {
                      setInputValue(`Analyze the syndication structure for this deal. Total equity: $${totalEquity.toLocaleString()}, ${syndicationData.equity_classes.length} classes, ${syndicationData.waterfall_tiers.length} waterfall tiers. Pref type: ${syndicationData.pref_type}. What are the key risks and opportunities for LPs?`);
                      setTimeout(() => handleSendMessage(), 100);
                    }
                  }}
                  style={{
                    padding: '16px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  🤖 Ask AI About This Syndication
                </button>
              </div>

            </div>
          </div>
        );

      case 'waterfall':
        return <WaterfallView waterfall={fullCalcs.multiTierWaterfall} />;

      case 'fees':
        return <ManagementFeesView fees={fullCalcs.managementFees} />;

      case 'costseg':
        return (
          <div style={{ padding: '24px' }}>
            <CostSegAnalysisView dealId={dealId} scenarioData={scenarioData} fullCalcs={fullCalcs} />
          </div>
        );

      case 'market-data':
        // Extract location info from scenarioData
        const marketZip = scenarioData?.property?.zip || scenarioData?.property?.zip_code || '';
        const marketCity = scenarioData?.property?.city || '';
        const marketState = scenarioData?.property?.state || '';
        const marketCounty = scenarioData?.property?.county || '';
        const dealAddress = scenarioData?.property?.address || '';
        const propertyName = scenarioData?.property?.property_name || '';
        return (
          <div style={{ padding: '24px' }}>
            {console.debug && console.debug('Rendering MarketResearchTab (MarketAnalysisPage) with', { marketZip, marketCity, marketState, marketCounty, dealAddress, propertyName })}
            <MarketResearchTab
              dealId={dealId}
              initialZip={marketZip}
              initialCity={marketCity}
              initialState={marketState}
              initialCounty={marketCounty}
              dealAddress={dealAddress}
              propertyName={propertyName}
            />
          </div>
        );

      case 'underwriting-model':
        return (
          <div style={{ padding: '24px', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handlePopulateSheet}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                alignSelf: 'flex-start'
              }}
            >
               Populate from Deal Data
            </button>
            <iframe
              src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTIMXq7cZzOuS2aIe2s840j81XlrG-I65Lcf0kD7h5L1zVmuOxcMjZ6IIsTnMzwJ1aQ7KaHRwJV_WM3/pubhtml?widget=true&headers=false"
              style={{
                width: '100%',
                flex: 1,
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              title="Underwriting Model"
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
            const response = await fetch(`https://dealsniper-oh9v.onrender.com/v2/deals/${dealId}/rentcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            console.log('RentCast response:', data);
            if (data.success) {
              setRentcastData(data.data);
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
              
              {/* Section Header with RentCast Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
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
                <button
                  onClick={handleRentcastFetch}
                  disabled={rentcastLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: rentcastLoading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: rentcastLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#2563eb')}
                  onMouseLeave={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#3b82f6')}
                >
                  {rentcastLoading ? 'Loading...' : 'Fetch RentCast Comps'}
                </button>
              </div>

              {/* Summary Cards - Neutral light style */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>TOTAL UNITS</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                    {totalUnitsCount}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>TOTAL SF</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                    {totalSFCount.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>MONTHLY RENT</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                    ${totalMonthlyRent.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>ANNUAL RENT</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>
                    ${totalAnnualRent.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Editable Unit Mix & Rents */}
              <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Unit Mix & Rents (Live‑linked)</div>
                {unitMixData && unitMixData.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Unit Type</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Units</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>SF/Unit</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Current Rent</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Market Rent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitMixData.map((u, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '10px', fontSize: 13 }}>{u.type || u.unit_type || ''}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <input type="number" value={u.units || 0} onChange={(e)=>handleFieldChange(`unit_mix.${idx}.units`, parseInt(e.target.value)||0)} style={{ width: '120px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <input type="number" value={u.unit_sf || u.sf_per_unit || 0} onChange={(e)=>handleFieldChange(`unit_mix.${idx}.unit_sf`, parseInt(e.target.value)||0)} style={{ width: '120px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <input type="number" value={u.rent_current || u.rent || 0} onChange={(e)=>handleFieldChange(`unit_mix.${idx}.rent_current`, parseFloat(e.target.value)||0)} style={{ width: '140px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <input type="number" value={u.rent_market || u.market_rent || u.rent_current || u.rent || 0} onChange={(e)=>handleFieldChange(`unit_mix.${idx}.rent_market`, parseFloat(e.target.value)||0)} style={{ width: '140px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <td style={{ padding: '10px', fontWeight: 700 }}>Totals</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{unitMixData.reduce((s,u)=>s+(u.units||0),0)}</td>
                          <td></td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>${unitMixData.reduce((s,u)=>s+((u.units||0)*(u.rent_current||u.rent||0)*12),0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>${unitMixData.reduce((s,u)=>s+((u.units||0)*(u.rent_market||u.market_rent||u.rent_current||u.rent||0)*12),0).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>No unit mix available</div>
                )}
              </div>
              
              {/* Unit Mix Table */}
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
                  }}>Unit Mix (Parsed Data)</h4>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Unit Type</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}># Units</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>SF per Unit</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Current Rent/Mo</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Market Rent/Mo</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Annual Rent</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>$/SF (Annual)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMixData.map((unit, idx) => {
                      const annualRent = (unit.rent_current || 0) * 12;
                      const psfAnnual = unit.unit_sf > 0 ? annualRent / unit.unit_sf : 0;
                      const marketRentValue = unit.rent_market || unit.rent_current || 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: 'white' }} 
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} 
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                          <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: '#111827' }}>{unit.type || 'N/A'}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{unit.units || 0}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>{(unit.unit_sf || 0).toLocaleString()}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                            ${(unit.rent_current || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <input
                              type="number"
                              value={marketRentValue}
                              onChange={(e) => {
                                const newMarketRent = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                const updatedUnitMix = [...unitMixData];
                                updatedUnitMix[idx] = { ...updatedUnitMix[idx], rent_market: newMarketRent };
                                handleFieldChange('unit_mix', updatedUnitMix);
                              }}
                              style={{
                                width: '100px',
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#111827',
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                textAlign: 'right',
                                outline: 'none'
                              }}
                            />
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                            ${annualRent.toLocaleString()}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                            ${psfAnnual.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #d1d5db' }}>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>TOTAL</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#111827' }}>{totalUnitsCount}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#111827' }}>{totalSFCount.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${totalMonthlyRent.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                        ${unitMixTotalMarketMonthlyRent.toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${totalAnnualRent.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                        ${totalSFCount > 0 ? (totalAnnualRent / totalSFCount).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* RentCast Results */}
              {rentcastData && (
                <div style={{ marginTop: '24px' }}>
                  {/* Summary Cards */}
                  <div style={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb', 
                    borderRadius: '16px', 
                    padding: '24px', 
                    boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 20px 0', 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: '#111827', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.06em' 
                    }}>RentCast Market Data</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      <div style={{ 
                        padding: '20px', 
                        backgroundColor: 'white',
                        borderRadius: '12px', 
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 4px rgba(15,23,42,0.04)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estimated Rent</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>${rentcastData.rent?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        backgroundColor: 'white',
                        borderRadius: '12px', 
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 4px rgba(15,23,42,0.04)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Price per Sq Ft</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>${rentcastData.pricePerSqFt?.toFixed(2) || 'N/A'}</div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        backgroundColor: 'white',
                        borderRadius: '12px', 
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 4px rgba(15,23,42,0.04)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rent Range</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>
                          ${rentcastData.rentRangeLow?.toLocaleString() || 'N/A'} - ${rentcastData.rentRangeHigh?.toLocaleString() || 'N/A'}
                        </div>
                      </div>
                      <div style={{ 
                        padding: '20px', 
                        backgroundColor: 'white',
                        borderRadius: '12px', 
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 4px rgba(15,23,42,0.04)'
                      }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comparable Listings</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827' }}>{rentcastData.comparables?.length || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Map and Comps Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    {/* Map */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb'
                      }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Property Location & Comps
                        </h5>
                      </div>
                      {hasCoords && mapSrc ? (
                        <>
                          <iframe
                            title="Property Map"
                            width="100%"
                            height="400"
                            style={{ border: 0 }}
                            src={mapSrc}
                          />
                          {externalMapUrl && (
                            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#6b7280', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                              <a
                                href={externalMapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                              >
                                Open full map in new tab
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                          No location data available
                        </div>
                      )}
                    </div>

                    {/* Comparables List */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '16px', 
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb'
                      }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Nearby Rental Comps
                        </h5>
                      </div>
                      <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px' }}>
                        {rentcastData.comparables && rentcastData.comparables.length > 0 ? (
                          rentcastData.comparables.map((comp, idx) => (
                            <div key={idx} style={{ 
                              padding: '16px', 
                              marginBottom: '12px', 
                              backgroundColor: '#f9fafb', 
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ fontWeight: '700', fontSize: '16px', color: '#111827' }}>
                                  ${comp.price?.toLocaleString() || 'N/A'}/mo
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                                  {comp.bedrooms || 0} bed • {comp.bathrooms || 0} bath
                                </div>
                              </div>
                              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                                {comp.squareFootage ? `${comp.squareFootage.toLocaleString()} sq ft` : 'Size N/A'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {comp.addressLine1 || 'Address not available'}
                              </div>
                              {comp.distance && (
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                  {comp.distance.toFixed(2)} miles away
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                            No comparable listings found nearby
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        );

      case 'deal-structure':
        return (
          <div style={{ padding: '24px' }}>
            <DealStructureTab 
              scenarioData={scenarioData} 
              calculations={calculations} 
              fullCalcs={fullCalcs} 
              marketCapRate={marketCapRate}
              onRecommendationChange={setRecommendedStructure}
              onSelectedStructureMetricsChange={setSelectedStructureMetrics}
            />
          </div>
        );

      case 'deal-execution':
        return (
          <div style={{ padding: '24px' }}>
            <DealExecutionTab 
              scenarioData={scenarioData}
              fullCalcs={fullCalcs}
              recommendedStructure={recommendedStructure}
              selectedStructureMetrics={selectedStructureMetrics}
            />
          </div>
        );
      
      case 'property-spreadsheet':
        return (
          <div style={{ padding: '24px' }}>
            <PropertySpreadsheet 
              initialData={scenarioData ? mapParsedDataToSpreadsheet(scenarioData) : null}
            />
          </div>
        );
      
      case 'rubs':
        return (
          <div style={{ padding: '24px' }}>
            <RUBSTab 
              scenarioData={scenarioData}
              fullCalcs={fullCalcs}
            />
          </div>
        );
      
      case 'proforma':
        return (
          <ProformaTab
            fullCalcs={fullCalcs}
            scenarioData={scenarioData}
            onFieldChange={handleFieldChange}
          />
        );

      default:
        return <div style={{ padding: '24px', color: '#6b7280' }}>Select a tab to view details</div>;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: 'calc(100vh - 60px)',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative'
    }}>
      
      {/* Main Content - Full Width */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        minWidth: 0,
        overflow: 'hidden'
      }}>
        
        {/* Header with property name */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              {property.property_name || 'Deal Analysis'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {property.address || 'Property Address'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
              {pipelineSuccess ? 'Added to Pipeline' : (isPushingToPipeline ? 'Pushing...' : 'Push to Pipeline')}
            </button>
            {onRunAIAnalysis && (
              <button
                onClick={onRunAIAnalysis}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Calculator size={14} />
                Run AI Underwriting
              </button>
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

        {/* Tabs */}
        <div style={{ 
          display: 'flex',
          gap: '4px',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          overflowX: 'auto',
          flexWrap: 'nowrap'
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: isActive ? 'white' : 'transparent',
                  color: isActive ? '#111827' : '#6b7280',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={16} color={isActive ? '#000000' : '#6b7280'} />
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
        width: 420,
        minWidth: 420,
        maxWidth: 420,
        flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        {/* AI Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 15,
          fontWeight: 600,
          color: '#111827'
        }}>
          <span>Max</span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', cursor: 'default', color: '#9ca3af' }}
          >
            <MessageSquare size={15} />
          </button>
        </div>

        {/* AI Body - Messages */}
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

        {/* AI Footer - Input */}
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
      </div>

      {/* Debug Panel */}
      <DebugPanel />

      {/* Animation styles for Recalculate button */}
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
      `}</style>

    </div>
  );
};

export default ResultsPageV2;


