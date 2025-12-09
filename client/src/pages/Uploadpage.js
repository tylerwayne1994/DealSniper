
import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Upload, ArrowRight, ArrowLeft, AlertCircle, Loader, Check, TrendingUp,
  DollarSign, Building, FileText, ThumbsUp, AlertTriangle,
  Calculator, CheckCircle, XCircle, Home, Edit3,
  Save, RefreshCw, Activity, Target, Briefcase, Award, GitCompare, Layers
} from "lucide-react";
import { 
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';

// ...existing code...

const autoCalculateFinancing = (pricing, setVerifiedData) => {
  const price = pricing?.price;
  const downPct = pricing?.down_payment_pct;
  const rate = pricing?.interest_rate;
  const termYears = pricing?.term_years;
  const amortYears = pricing?.amortization_years || termYears;
  if (price && downPct != null && rate && amortYears) {
    const loanAmount = price * (1 - downPct / 100);
    const monthlyRate = rate;
    const n = amortYears * 12;
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = loanAmount * (monthlyRate / 12) / (1 - Math.pow(1 + monthlyRate / 12, -n));
    } else {
      monthlyPayment = loanAmount / n;
    }
    setVerifiedData(prev => ({
      ...prev,
      pricing_financing: {
        ...prev.pricing_financing,
        loan_amount: loanAmount,
        monthly_payment: monthlyPayment,
        annual_debt_service: monthlyPayment * 12
      }
    }));
  }
};

// Use relative API path - backend runs on same host
const API_BASE = "http://localhost:8010";

const COLORS = {
  primary: '#4F46E5',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  dark: '#111827',
  light: '#F9FAFB',
  border: '#E5E7EB'
};

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(to bottom, #f8fafc, #ffffff)", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  container: { maxWidth: 1400, margin: "0 auto", padding: 20 },
  h1: { fontSize: "2.75rem", fontWeight: 900, color: "#111827", marginBottom: 8, textAlign: "center", letterSpacing: "-0.03em", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  card: { 
    background: "#fff", 
    border: "1px solid #e5e7eb", 
    boxShadow: "0 4px 6px rgba(0,0,0,.04)", 
    borderRadius: 16, 
    padding: 24,
    marginBottom: 20
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  homeButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    background: "#ffffff",
    color: "#374151",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    transition: "border-color 0.2s",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    border: "2px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    transition: "border-color 0.2s",
    outline: "none",
    background: "#fff",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 1rem center",
    backgroundSize: "1em",
  },
  inputError: {
    border: "2px solid #ef4444",
  },
  inputSuccess: {
    border: "2px solid #10b981",
  },
  dealScoreCard: {
    background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
    border: "2px solid",
    borderRadius: 16,
    padding: 24,
    textAlign: "center",
    position: "relative",
  },
};

const getDealScoreColor = (score) => {
  if (score >= 80) return { bg: "#059669", gradient: "linear-gradient(135deg, #10b981, #059669)", text: "#ffffff", label: "STRONG BUY" };
  if (score >= 60) return { bg: "#2563eb", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", text: "#ffffff", label: "BUY" };
  if (score >= 40) return { bg: "#f59e0b", gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)", text: "#ffffff", label: "HOLD" };
  if (score >= 20) return { bg: "#dc2626", gradient: "linear-gradient(135deg, #f87171, #dc2626)", text: "#ffffff", label: "PASS" };
  return { bg: "#991b1b", gradient: "linear-gradient(135deg, #ef4444, #991b1b)", text: "#ffffff", label: "STRONG PASS" };
};

const fmtCurrency = (v) => {
  if (v == null || v === "" || v === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(v));
};

const fmtNumber = (v) => {
  if (v == null || v === "") return "—";
  return new Intl.NumberFormat("en-US").format(Number(v));
};

const fmtPct = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
};

function pagesToSpec(sortedPages) {
  if (!sortedPages.length) return "";
  const ranges = [];
  let start = sortedPages[0];
  let prev = sortedPages[0];
  for (let i = 1; i < sortedPages.length; i++) {
    const cur = sortedPages[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(",");
}

const EnhancedUploadPage = () => {
  const navigate = useNavigate();
  
  // County autocomplete state
  const [countyMatches, setCountyMatches] = useState([]);
  const [error, setError] = useState("");
  
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMsg, setProcessingMsg] = useState("");
  const [backendData, setBackendData] = useState(null);
  const [verifiedData, setVerifiedData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [activeTab, setActiveTab] = useState("property");
  const [resultsTab, setResultsTab] = useState('overview');
  const [cashFlowYears, setCashFlowYears] = useState(10);
  const [proformaRentRows, setProformaRentRows] = useState([{ type: '', units: '', rent: '' }]);
  const [proformaPurchasePrice, setProformaPurchasePrice] = useState(0);
  const [proformaMonthlyRent, setProformaMonthlyRent] = useState(0);

  const parsed = backendData?.parsed || null;

  const onFileInput = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(`Only PDF is supported. Got: ${f.type || "unknown"}`);
      return;
    }
    setError("");
    setFile(f);
    await genPdfThumbs(f);
  };

  const genPdfThumbs = async (pdfFile) => {
    setStep("pageSelect");
    setLoadingPreview(true);
    try {
      let pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => {
            pdfjsLib = window.pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              resolve();
            } else reject(new Error("Failed to load pdf.js"));
          };
          s.onerror = () => reject(new Error("Failed to load pdf.js"));
          document.head.appendChild(s);
        });
      }
      const ab = await pdfFile.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: ab }).promise;

      const pages = [];
      const MAX = Math.min(doc.numPages, 100);
      for (let p = 1; p <= MAX; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push({ pageNum: p, thumbnail: canvas.toDataURL() });
      }
      setPdfPages(pages);
    } catch (e) {
      setError(`PDF preview failed: ${e.message}`);
      setStep("upload");
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePage = (n) =>
    setSelectedPages((prev) => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });

  const selectAll = () => setSelectedPages(new Set(pdfPages.map((p) => p.pageNum)));
  const clearAll = () => setSelectedPages(new Set());

  const calculateMonthlyPayment = (principal, rate, months) => {
    if (!principal || !months) return 0;
    if (rate === 0) return principal / months;
    const monthlyRate = rate / 12;
    return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
  };

  const calculateBalloon = (principal, rate, monthsPaid, amortizationMonths, ioYears) => {
    if (!principal || !monthsPaid || !amortizationMonths) return principal;
    if (ioYears * 12 >= monthsPaid) return principal;
    const monthlyRate = rate / 12;
    const amortMonthsAfterIO = Math.max(0, monthsPaid - ioYears * 12);
    return principal * Math.pow(1 + monthlyRate, amortMonthsAfterIO) -
           calculateMonthlyPayment(principal, rate, amortizationMonths) *
           (Math.pow(1 + monthlyRate, amortMonthsAfterIO) - 1) / monthlyRate;
  };

  const recalculateFinancingMetrics = () => {
    if (!verifiedData?.pricing_financing) {
      console.log("❌ DEBUG: No pricing_financing data found");
      return;
    }

    const pricing = { ...verifiedData.pricing_financing };

    // Set sensible default percentages if not provided
    if (pricing.realtor_fee_pct == null) {
      pricing.realtor_fee_pct = 3;
    }
    if (pricing.closing_costs_pct == null) {
      pricing.closing_costs_pct = 1;
    }
    const financingMode = pricing.financing_mode || 'traditional';

    console.log("🔄 DEBUG: Starting financing calculation");
    console.log("📊 DEBUG: Initial pricing data:", pricing);
    console.log("💰 DEBUG: Financing mode:", financingMode);

    if (financingMode === 'traditional') {
      if (!pricing.loan_amount && pricing.price && pricing.down_payment_pct != null) {
        pricing.loan_amount = pricing.price * (1 - pricing.down_payment_pct / 100);
        console.log("📈 DEBUG: Calculated loan amount:", pricing.loan_amount);
      }
      if (!pricing.amortization_years && pricing.term_years) {
        pricing.amortization_years = pricing.term_years;
        console.log("📅 DEBUG: Set amortization years to term years:", pricing.amortization_years);
      }
    }

    console.log("🔍 DEBUG: Pre-calculation check:");
    console.log("  - Monthly Payment:", pricing.monthly_payment);
    console.log("  - Loan Amount:", pricing.loan_amount);
    console.log("  - Interest Rate:", pricing.interest_rate);
    console.log("  - Amortization Years:", pricing.amortization_years);

    if (!pricing.monthly_payment && pricing.loan_amount && pricing.interest_rate != null && pricing.amortization_years) {
      console.log("💡 DEBUG: Calculating monthly payment...");
      
      if (financingMode === 'seller_finance' && pricing.io_period_years > 0) {
        const ioMonths = pricing.io_period_years * 12;
        const monthsPaid = (pricing.balloon_years || pricing.amortization_years) * 12;
        if (ioMonths >= monthsPaid) {
          pricing.monthly_payment = pricing.loan_amount * (pricing.interest_rate / 12);
        } else {
          pricing.monthly_payment = calculateMonthlyPayment(
            pricing.loan_amount,
            pricing.interest_rate,
            pricing.amortization_years * 12
          );
        }
      } else {
        const principal = financingMode === 'subject_to' ? pricing.existing_loan_balance : pricing.loan_amount;
        const months = (pricing.amortization_years || pricing.remaining_term_years || pricing.term_years) * 12;
        pricing.monthly_payment = calculateMonthlyPayment(principal, pricing.interest_rate, months);
      }
      
      console.log("✅ DEBUG: Calculated monthly payment:", pricing.monthly_payment);
    }

    // CRITICAL FIX: Ensure annual debt service is always calculated
    if (pricing.monthly_payment && !pricing.annual_debt_service) {
      pricing.annual_debt_service = pricing.monthly_payment * 12;
      console.log("✅ DEBUG: Calculated annual debt service from monthly:", pricing.annual_debt_service);
    }

    // Force recalculation if debt service is missing but we have loan details
    if (!pricing.annual_debt_service && pricing.loan_amount && pricing.interest_rate && pricing.amortization_years) {
      console.log("🚨 DEBUG: Force calculating debt service...");
      
      const monthlyPayment = calculateMonthlyPayment(
        pricing.loan_amount,
        pricing.interest_rate,
        pricing.amortization_years * 12
      );
      pricing.monthly_payment = monthlyPayment;
      pricing.annual_debt_service = monthlyPayment * 12;
      
      console.log("🔧 DEBUG: Force calculated values:");
      console.log("  - Monthly Payment:", monthlyPayment);
      console.log("  - Annual Debt Service:", pricing.annual_debt_service);
    }

    if (financingMode === 'seller_finance' && pricing.loan_amount && pricing.interest_rate != null && pricing.balloon_years && pricing.amortization_years) {
      pricing.balloon_amount = calculateBalloon(
        pricing.loan_amount,
        pricing.interest_rate,
        pricing.balloon_years * 12,
        pricing.amortization_years * 12,
        pricing.io_period_years || 0
      );
      console.log("🎈 DEBUG: Calculated balloon amount:", pricing.balloon_amount);
    }

    console.log("📤 DEBUG: Final pricing data before state update:", pricing);

    setVerifiedData(prev => ({
      ...prev,
      pricing_financing: pricing
    }));

    console.log("✅ DEBUG: State updated with new pricing data");
  };

  const processNow = async () => {
    setError("");
    
    try {
      if (!file) {
        setError("No file loaded");
        return;
      }
      if (selectedPages.size === 0) {
        setError("Select at least one page to process.");
        return;
      }
      setStep("processing");
      setProgress(10);
      setProcessingMsg("Uploading PDF to backend...");

      const pages = pagesToSpec(Array.from(selectedPages).sort((a, b) => a - b));
      const pricing = verifiedData?.pricing_financing || {};

      const fd = new FormData();
      fd.append("file", file);
      fd.append("pages", pages);
      fd.append("financing_mode", pricing.financing_mode || "traditional");
      fd.append("price", pricing.price || "");
      if (pricing.monthly_payment) fd.append("monthly_payment", pricing.monthly_payment);
      if (pricing.annual_debt_service) fd.append("annual_debt_service", pricing.annual_debt_service);

      if (pricing.financing_mode === "traditional") {
        if (pricing.down_payment_pct != null) fd.append("down_payment_pct", pricing.down_payment_pct);
        if (pricing.term_years) fd.append("term_years", pricing.term_years);
        if (pricing.amortization_years) fd.append("amortization_years", pricing.amortization_years);
        if (pricing.interest_rate != null) fd.append("interest_rate", pricing.interest_rate);
        if (pricing.loan_amount) fd.append("loan_amount", pricing.loan_amount);
      } else if (pricing.financing_mode === "seller_finance") {
        if (pricing.down_payment_amount != null) fd.append("down_payment_amount", pricing.down_payment_amount);
        if (pricing.interest_rate != null) fd.append("interest_rate", pricing.interest_rate);
        if (pricing.amortization_years) fd.append("amortization_years", pricing.amortization_years);
        if (pricing.balloon_years) fd.append("balloon_years", pricing.balloon_years);
        if (pricing.io_period_years) fd.append("io_period_years", pricing.io_period_years);
      } else if (pricing.financing_mode === "subject_to") {
        if (pricing.existing_loan_balance) fd.append("existing_loan_balance", pricing.existing_loan_balance);
        if (pricing.interest_rate != null) fd.append("interest_rate", pricing.interest_rate);
        if (pricing.remaining_term_years) fd.append("remaining_term_years", pricing.remaining_term_years);
        if (pricing.amortization_years) fd.append("amortization_years", pricing.amortization_years);
      }

      setProgress(30);
      setProcessingMsg("OCR processing with Mistral...");

      console.log("[DEBUG] About to send request to:", `${API_BASE}/ocr/underwrite`);
      console.log("[DEBUG] Selected pages:", selectedPages.size);


      // Add a timeout to the fetch request (60 seconds)
      const fetchWithTimeout = (url, options, timeout = 60000) => {
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out. The backend may be sleeping or slow. Please retry in 30 seconds or check system status.")), timeout)
          )
        ]);
      };

      let res;
      try {
        res = await fetchWithTimeout(`${API_BASE}/ocr/underwrite`, {
          method: "POST",
          body: fd,
        });
      } catch (timeoutErr) {
        setError(timeoutErr.message || "Request timed out. Please try again later.");
        setStep("pageSelect");
        return;
      }

      setProgress(60);
      setProcessingMsg("AI analyzing deal with Claude...");

      console.log("[DEBUG] Backend response status:", res.status);
      console.log("[DEBUG] Backend response ok:", res.ok);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        if (res.status === 403 && errorData.detail?.upgrade_required) {
          setError(errorData.detail.error + " Please upgrade your plan.");
          return;
        }
        
        const errorText = errorData.detail || await res.text().catch(() => "");
        throw new Error(`Backend ${res.status}: ${errorText || res.statusText}`);
      }

      setProgress(80);
      setProcessingMsg("Preparing data for verification...");

      const json = await res.json();
      setBackendData(json);

      // Build pricing_financing with calculated loan_amount
      const parsedPricing = json.parsed?.pricing_financing || {};
      const price = parsedPricing.price || parsedPricing.purchase_price || 0;
      const downPct = parsedPricing.down_payment_pct || 0;
      const ltv = parsedPricing.ltv || 0;
      
      // Calculate loan_amount if not provided
      let calculatedLoanAmount = parsedPricing.loan_amount || 0;
      if (!calculatedLoanAmount && price > 0) {
        if (downPct > 0) {
          calculatedLoanAmount = price * (1 - downPct / 100);
        } else if (ltv > 0) {
          calculatedLoanAmount = price * (ltv / 100);
        }
      }
      
      console.log("📊 DEBUG: Parsed pricing data:", parsedPricing);
      console.log("💰 DEBUG: Calculated loan amount:", calculatedLoanAmount);
      console.log("📋 DEBUG: Parsed PNL data:", json.parsed?.pnl);

      setVerifiedData(prev => ({
        ...JSON.parse(JSON.stringify(json.parsed || {})),
        pricing_financing: {
          ...parsedPricing,
          ...prev?.pricing_financing,
          financing_mode: prev?.pricing_financing?.financing_mode || "traditional",
          loan_amount: calculatedLoanAmount || prev?.pricing_financing?.loan_amount || 0
        }
      }));

      setProgress(100);
      setProcessingMsg("Complete! Please verify data...");
      setStep("verify");
    } catch (e) {
      setError(e.message || String(e));
      setStep("pageSelect");
    }
  };

  const updateVerifiedField = (section, field, value) => {
    setVerifiedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    
    setValidationErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[`${section}.${field}`];
      return newErrors;
    });
  };

  const handleProformaRentChange = (index, field, value) => {
    setProformaRentRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addProformaRentRow = () => {
    setProformaRentRows(prev => [...prev, { type: '', units: '', rent: '' }]);
  };

  const removeProformaRentRow = (index) => {
    if (proformaRentRows.length > 1) {
      setProformaRentRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateRequiredFields = () => {
    const errors = {};
    const required = {
      property: ['address', 'units'],
      pricing_financing: ['price', 'financing_mode'],
      pnl: ['gross_potential_rent', 'operating_expenses', 'noi']
    };

    const financingMode = verifiedData?.pricing_financing?.financing_mode || 'traditional';
    if (financingMode === 'traditional') {
      required.pricing_financing.push('interest_rate', 'term_years');
      if (!verifiedData?.pricing_financing?.loan_amount && !verifiedData?.pricing_financing?.down_payment_pct) {
        errors['pricing_financing.loan_amount'] = true;
        errors['pricing_financing.down_payment_pct'] = true;
      }
    } else if (financingMode === 'seller_finance') {
      required.pricing_financing.push('down_payment_amount', 'interest_rate', 'amortization_years', 'balloon_years');
    } else if (financingMode === 'subject_to') {
      required.pricing_financing.push('existing_loan_balance', 'interest_rate', 'remaining_term_years');
    }

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

  const recalculateMetrics = () => {
    if (!verifiedData) return;
    
    // CRITICAL FIX: Always recalculate financing first
    recalculateFinancingMetrics();
    
    // AUTO-CALCULATE GPR from proforma data if available
    if (verifiedData.proforma?.rent_schedule && verifiedData.proforma.rent_schedule.length > 0) {
      let calculatedGPR = 0;
      verifiedData.proforma.rent_schedule.forEach(row => {
        const units = parseFloat(row.units) || 0;
        const rent = parseFloat(row.rent) || 0;
        calculatedGPR += units * rent * 12; // Annual rent
      });
      
      if (calculatedGPR > 0) {
        verifiedData.pnl.gross_potential_rent = calculatedGPR;
        verifiedData.pnl.gross_potential_rent_source = 'proforma';
      }
    }
    
    const price = parseFloat(verifiedData.pricing_financing?.price) || 0;
    const units = parseFloat(verifiedData.property?.units) || 0;
    // Derive gross rent: prefer existing value, otherwise compute from unit mix
    let grossRent = parseFloat(verifiedData.pnl?.gross_potential_rent) || 0;
    if (!grossRent && Array.isArray(verifiedData.unit_mix)) {
      grossRent = verifiedData.unit_mix.reduce((sum, row) => {
        const units = parseFloat(row.units) || 0;
        const rent = parseFloat(row.rent_current || row.rent || 0) || 0;
        return sum + units * rent * 12;
      }, 0);
      if (grossRent > 0) {
        verifiedData.pnl.gross_potential_rent = grossRent;
      }
    }
    
    // Calculate percentage-based expenses
    let totalExpenses = 0;
    if (grossRent > 0) {
      if (verifiedData.expenses?.vacancy_pct) {
        verifiedData.pnl.vacancy_amount = grossRent * verifiedData.expenses.vacancy_pct / 100;
        totalExpenses += verifiedData.pnl.vacancy_amount;
      }
      if (verifiedData.expenses?.property_management_pct) {
        const mgmtAmount = grossRent * verifiedData.expenses.property_management_pct / 100;
        if (!verifiedData.expenses.management) {
          verifiedData.expenses.management = mgmtAmount;
        }
        totalExpenses += mgmtAmount;
      }
      if (verifiedData.expenses?.capex_pct) {
        verifiedData.expenses.capex = grossRent * verifiedData.expenses.capex_pct / 100;
        totalExpenses += verifiedData.expenses.capex;
      }
    }
    
    // Calculate total utilities
    const utilities = (verifiedData.expenses?.gas || 0) + 
                     (verifiedData.expenses?.electrical || 0) +
                     (verifiedData.expenses?.water || 0) +
                     (verifiedData.expenses?.sewer || 0) +
                     (verifiedData.expenses?.trash || 0);
    if (utilities > 0) {
      verifiedData.expenses.utilities = utilities;
    }
    
  // Calculate total operating expenses (exclude taxes and insurance)
  totalExpenses += (verifiedData.expenses?.utilities || 0) +
          (verifiedData.expenses?.repairs_maintenance || 0) +
          (verifiedData.expenses?.management || 0) +
          (verifiedData.expenses?.payroll || 0) +
          (verifiedData.expenses?.other || 0);
    
    if (totalExpenses > 0) {
      verifiedData.pnl.operating_expenses = totalExpenses;
      verifiedData.expenses.total = totalExpenses;
    }
    
    // Recalculate NOI
    const egi = parseFloat(verifiedData.pnl?.effective_gross_income) || grossRent;
    const expenses = parseFloat(verifiedData.pnl?.operating_expenses) || totalExpenses;
    if (egi && expenses) {
      verifiedData.pnl.noi = egi - expenses;
    }
    
    // Continue with existing calculations
    const noi = parseFloat(verifiedData.pnl?.noi) || 0;
    const debtService = parseFloat(verifiedData.pricing_financing?.annual_debt_service) || 0;
    
    if (price && units) {
      verifiedData.pricing_financing.price_per_unit = Math.round(price / units);
    }
    
    if (price && noi) {
      verifiedData.pnl.cap_rate = noi / price;
      if (!verifiedData.underwriting) verifiedData.underwriting = {};
      verifiedData.underwriting.cap_rate_calculated = noi / price;
    }
    
    if (noi && debtService) {
      if (!verifiedData.underwriting) verifiedData.underwriting = {};
      verifiedData.underwriting.dscr = noi / debtService;
    }
    
    if (expenses && egi) {
      verifiedData.pnl.expense_ratio = expenses / egi;
    }
    
    setVerifiedData({...verifiedData});
  };

  const proceedWithVerifiedData = () => {
    if (!validateRequiredFields()) {
      setError("Please fill in all required fields marked in red");
      return;
    }
    
    // SAVE PROFORMA DATA: Filter out empty rows and add to verifiedData
    const validProformaRows = proformaRentRows.filter(row => 
      row.type && row.units && row.rent
    );
    
    if (validProformaRows.length > 0) {
      verifiedData.proforma = {
        rent_schedule: validProformaRows
      };
    }
    
    // CRITICAL FIX: Validate debt service calculation
    if (verifiedData.pricing_financing?.loan_amount && 
        verifiedData.pricing_financing?.interest_rate && 
        !verifiedData.pricing_financing?.annual_debt_service) {
      
      const monthlyPayment = calculateMonthlyPayment(
        verifiedData.pricing_financing.loan_amount,
        verifiedData.pricing_financing.interest_rate,
        (verifiedData.pricing_financing.amortization_years || verifiedData.pricing_financing.term_years || 30) * 12
      );
      
      verifiedData.pricing_financing.monthly_payment = monthlyPayment;
      verifiedData.pricing_financing.annual_debt_service = monthlyPayment * 12;
    }
    
    recalculateMetrics();
    
    setBackendData(prev => ({
      ...prev,
      parsed: verifiedData
    }));
    
    setStep("done");
  };

  const reset = () => {
    setError("");
    setStep("upload");
    setFile(null);
    setPdfPages([]);
    setSelectedPages(new Set());
    setBackendData(null);
    setVerifiedData(null);
    setValidationErrors({});
    setActiveTab("property");
    setResultsTab('overview');
  };

  // Modified edit data handler to force recalculation
  const handleEditData = () => {
    // Force recalculation when returning from results to edit mode
    if (verifiedData) {
      recalculateFinancingMetrics();
      recalculateMetrics();
    }
    setStep("verify");
  };

  // Generate projections for charts
  const generateProjections = () => {
    const years = [];
    const cashFlow = (parsed?.pnl?.noi || 0) - (parsed?.pricing_financing?.annual_debt_service || 0);
    const price = parsed?.pricing_financing?.price || 0;
    
    for (let i = 1; i <= 10; i++) {
      const projectedCashFlow = cashFlow * Math.pow(1.03, i); // 3% annual growth
      const propertyValue = price * Math.pow(1.04, i); // 4% appreciation
      const netWorth = propertyValue - (parsed?.pricing_financing?.loan_amount || 0) * Math.pow(0.97, i);
      
      years.push({
        year: `Year ${i}`,
        cashFlow: Math.round(projectedCashFlow),
        principalPaydown: Math.round((parsed?.pricing_financing?.loan_amount || 0) * 0.03 * i),
        propertyValue: Math.round(propertyValue),
        netWorth: Math.round(netWorth),
        noi: Math.round((parsed?.pnl?.noi || 0) * Math.pow(1.025, i)),
        expenses: Math.round((parsed?.pnl?.operating_expenses || 0) * Math.pow(1.02, i))
      });
    }
    return years;
  };

  // Expense breakdown for charts
  const getExpenseData = () => {
    const expenses = parsed?.expenses || {};
    const data = [];
    if (expenses.taxes) data.push({ name: 'Taxes', value: expenses.taxes });
    if (expenses.insurance) data.push({ name: 'Insurance', value: expenses.insurance });
    if (expenses.management) data.push({ name: 'Management', value: expenses.management });
    if (expenses.repairs_maintenance) data.push({ name: 'R&M', value: expenses.repairs_maintenance });
    if (expenses.utilities) data.push({ name: 'Utilities', value: expenses.utilities });
    if (expenses.payroll) data.push({ name: 'Payroll', value: expenses.payroll });
    if (expenses.other) data.push({ name: 'Other', value: expenses.other });
    return data;
  };

  if (step === "upload") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ padding: "20px 0" }}>
            <button 
              onClick={() => navigate('/')} 
              style={styles.homeButton}
              onMouseEnter={(e) => {
                e.target.style.background = '#f9fafb';
                e.target.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffffff';
                e.target.style.borderColor = '#e5e7eb';
              }}
            >
              <Home size={16} /> Back to Home
            </button>
          </div>
          
          <div style={{ padding: "20px 0" }}>
            <h1 style={{ ...styles.h1, fontSize: "2.75rem", fontWeight: 900, letterSpacing: "-0.02em" }}>AI-Powered Deal Analyzer</h1>
            <p style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
              Upload OM → Verify Data → Get Deal Score & Recommendations
            </p>
            {error && (
              <div style={{ marginBottom: 20, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <AlertCircle size={20} color="#b91c1c" />
                <span style={{ color: "#991b1b", fontSize: 14 }}>{error}</span>
              </div>
            )}
            <div style={styles.card}>
              <div 
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 12,
                  padding: 48,
                  textAlign: "center",
                  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) onFileInput({ target: { files: [f] } });
                }}
              >
                <div style={{ margin: "0 auto 16px", width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "grid", placeItems: "center" }}>
                  <Upload size={40} color="#fff" />
                </div>
                <div style={{ marginBottom: 12, fontWeight: 900, fontSize: 20, color: "#111827" }}>
                  Drop your file here or click to browse
                </div>
                <div style={{ marginBottom: 12, fontSize: 14, color: "#6b7280" }}>
                  Supports PDF, CSV, Excel (.xlsx, .xls), and Word (.docx, .doc)
                </div>
                <input id="fileInput" type="file" accept=".pdf,.csv,.xlsx,.xls,.docx,.doc" onChange={onFileInput} style={{ display: "none" }} />
                <label htmlFor="fileInput" style={{ ...styles.button, cursor: "pointer" }}>
                  <Upload size={18} /> Choose File
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "pageSelect") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/')} 
              style={styles.homeButton}
              onMouseEnter={(e) => {
                e.target.style.background = '#f9fafb';
                e.target.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffffff';
                e.target.style.borderColor = '#e5e7eb';
              }}
            >
              <Home size={16} /> Home
            </button>
            <button style={{ ...styles.button, background: "#f3f4f6", color: "#374151" }} onClick={() => setStep("upload")}>
              <ArrowLeft size={16} /> Back to Upload
            </button>
          </div>
          
          <h1 style={{ ...styles.h1, fontSize: "2.75rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Select Pages to Analyze</h1>

          {error && (
            <div style={{ marginBottom: 20, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12 }}>
              <AlertCircle size={20} color="#b91c1c" />
              <span style={{ color: "#991b1b", fontSize: 14 }}>{error}</span>
            </div>
          )}

          <div style={styles.card}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
              <button style={{ ...styles.button, background: "#10b981" }} onClick={selectAll}>
                Select All
              </button>
              <button style={{ ...styles.button, background: "#6b7280" }} onClick={clearAll}>
                Clear All
              </button>
              <span style={{ alignSelf: "center", fontSize: 14, color: "#6b7280", fontWeight: 900 }}>
                {selectedPages.size} selected
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, maxHeight: 400, overflowY: "auto" }}>
              {loadingPreview ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60 }}>
                  <Loader size={32} />
                  <div>Generating previews...</div>
                </div>
              ) : (
                pdfPages.map((p) => (
                  <div
                    key={p.pageNum}
                    onClick={() => togglePage(p.pageNum)}
                    style={{
                      border: selectedPages.has(p.pageNum) ? "3px solid #2563eb" : "2px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 8,
                      cursor: "pointer",
                      background: selectedPages.has(p.pageNum) ? "#eff6ff" : "#fff",
                      position: "relative",
                    }}
                  >
                    <img src={p.thumbnail} alt={`Page ${p.pageNum}`} style={{ width: "100%", borderRadius: 8 }} />
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, fontWeight: 900 }}>
                      Page {p.pageNum}
                    </div>
                    {selectedPages.has(p.pageNum) && (
                      <div style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "#2563eb", display: "grid", placeItems: "center" }}>
                        <Check size={16} color="#fff" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                style={{
                  ...styles.button,
                  opacity: selectedPages.size === 0 ? 0.5 : 1,
                  cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer'
                }}
                disabled={selectedPages.size === 0}
                onClick={processNow}
              >
                Process Selected Pages <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ maxWidth: 600, margin: "100px auto" }}>
            <div style={styles.card}>
              <div style={{ textAlign: "center" }}>
                <div style={{ margin: "0 auto 24px", width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "grid", placeItems: "center", animation: "pulse 2s infinite" }}>
                  <Loader size={40} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: "#111827" }}>Analyzing Your Deal</h2>
                <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 24 }}>Please wait while we extract and analyze your deal data</p>
                
                {/* Progress percentage */}
                <div style={{ fontSize: 32, fontWeight: 900, color: "#2563eb", marginBottom: 16 }}>
                  {progress}%
                </div>
                
                {/* Progress bar */}
                <div style={{ width: "100%", height: 16, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 16, position: "relative" }}>
                  <div style={{ 
                    width: `${progress}%`, 
                    height: "100%", 
                    background: "linear-gradient(90deg, #2563eb, #7c3aed, #2563eb)", 
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                    transition: "width 0.3s ease",
                    borderRadius: 999
                  }} />
                </div>
                
                {/* Processing message */}
                <div style={{ 
                  fontSize: 14, 
                  color: "#374151", 
                  fontWeight: 900,
                  padding: "12px 20px",
                  background: "#f3f4f6",
                  borderRadius: 8,
                  display: "inline-block"
                }}>
                  {processingMsg}
                </div>
                
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                  }
                  @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    const tabs = [
      { id: "property", label: "Property Info", icon: Building },
      { id: "financial", label: "Financials", icon: DollarSign },
      { id: "expenses", label: "Expenses", icon: FileText },
      { id: "unitMix", label: "Unit Mix", icon: Home }
    ];

    const financingMode = verifiedData?.pricing_financing?.financing_mode || 'traditional';

    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/')} 
              style={styles.homeButton}
            >
              <Home size={16} /> Home
            </button>
            <button style={{ ...styles.button, background: "#f3f4f6", color: "#374151" }} onClick={() => setStep("pageSelect")}>
              <ArrowLeft size={16} /> Back to Page Selection
            </button>
          </div>
          
          <h1 style={{ ...styles.h1, fontSize: "2.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Verify & Complete Deal Information</h1>
          <p style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
            Review the extracted data and fill in any missing fields for accurate underwriting
          </p>

          {error && (
            <div style={{ marginBottom: 20, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <AlertCircle size={20} color="#b91c1c" />
              <span style={{ color: "#991b1b", fontSize: 14 }}>{error}</span>
            </div>
          )}

          {backendData?.parsed?.data_quality?.missing_critical_fields?.length > 0 && (
            <div style={{ ...styles.card, background: "#fffbeb", borderColor: "#fbbf24", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                <AlertTriangle size={20} color="#f59e0b" style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8, color: "#92400e" }}>Missing Critical Data</div>
                  <div style={{ fontSize: 14, color: "#78350f" }}>
                    The following fields could not be extracted and need your input:
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {backendData.parsed.data_quality.missing_critical_fields.map((field, i) => (
                      <span key={i} style={{ 
                        padding: "4px 12px", 
                        background: "#fef3c7", 
                        borderRadius: 6, 
                        fontSize: 13,
                        border: "1px solid #fde68a"
                      }}>
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#f9fafb", padding: 4, borderRadius: 12 }}>
            {[...tabs, { id: "proforma", label: "Proforma", icon: FileText }].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    background: activeTab === tab.id ? "#fff" : "transparent",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: activeTab === tab.id ? 600 : 500,
                    color: activeTab === tab.id ? "#111827" : "#6b7280",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {activeTab === "proforma" && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={20} /> Proforma
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                {/* Purchase Price */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Purchase Price</label>
                  <input type="number" style={styles.input} placeholder="Enter purchase price" />
                  {verifiedData?.pricing_financing?.price && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.pricing_financing.price}</div>
                  )}
                </div>
                {/* Insurance */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Insurance</label>
                  <input type="number" style={styles.input} placeholder="Enter insurance" />
                  {verifiedData?.expenses?.insurance && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.insurance}</div>
                  )}
                </div>
                {/* Taxes */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Taxes</label>
                  <input type="number" style={styles.input} placeholder="Enter taxes" />
                  {verifiedData?.expenses?.taxes && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.taxes}</div>
                  )}
                </div>
                {/* Annual Debt Service */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Annual Debt Service</label>
                  <input type="number" style={styles.input} placeholder="Enter annual debt service" />
                  {verifiedData?.pricing_financing?.annual_debt_service && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {Number(verifiedData.pricing_financing.annual_debt_service).toFixed(2)}</div>
                  )}
                </div>
                {/* Property Management */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Property Management (%)</label>
                  <input type="number" style={styles.input} placeholder="Enter property management %" />
                  {verifiedData?.expenses?.property_management_pct && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.property_management_pct}</div>
                  )}
                </div>
                {/* Vacancy (%) */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Vacancy (%)</label>
                  <input type="number" style={styles.input} placeholder="Enter vacancy %" />
                  {verifiedData?.expenses?.vacancy_pct && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.vacancy_pct}</div>
                  )}
                </div>
                {/* CapEx (%) */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>CapEx (%)</label>
                  <input type="number" style={styles.input} placeholder="Enter CapEx %" />
                  {verifiedData?.expenses?.capex_pct && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.capex_pct}</div>
                  )}
                </div>
                {/* Payroll */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Payroll</label>
                  <input type="number" style={styles.input} placeholder="Enter payroll" />
                  {verifiedData?.expenses?.payroll && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.payroll}</div>
                  )}
                </div>
                {/* Utilities */}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Gas (Monthly)</label>
                  <input type="number" style={styles.input} placeholder="Enter monthly gas" />
                  {verifiedData?.expenses?.gas && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.gas}</div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Electrical (Monthly)</label>
                  <input type="number" style={styles.input} placeholder="Enter monthly electrical" />
                  {verifiedData?.expenses?.electrical && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.electrical}</div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Water (Monthly)</label>
                  <input type="number" style={styles.input} placeholder="Enter monthly water" />
                  {verifiedData?.expenses?.water && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.water}</div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Sewer (Monthly)</label>
                  <input type="number" style={styles.input} placeholder="Enter monthly sewer" />
                  {verifiedData?.expenses?.sewer && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.sewer}</div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Trash (Monthly)</label>
                  <input type="number" style={styles.input} placeholder="Enter monthly trash" />
                  {verifiedData?.expenses?.trash && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.trash}</div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Total Utilities</label>
                  <input type="number" style={styles.input} placeholder="Enter total utilities" />
                  {verifiedData?.expenses?.utilities && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Current: {verifiedData.expenses.utilities}</div>
                  )}
                </div>
              </div>

              {/* Proforma Rents Section */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "2px solid #e5e7eb" }}>
                <h4 style={{ marginBottom: 16, fontSize: 15, fontWeight: 900, color: "#374151" }}>Proforma Rents</h4>
                
                {proformaRentRows.map((row, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 20, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Type (Bed/Bath)</label>
                      <input 
                        type="text" 
                        style={styles.input} 
                        placeholder="e.g., 2BR/2BA" 
                        value={row.type}
                        onChange={(e) => handleProformaRentChange(index, 'type', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Units</label>
                      <input 
                        type="number" 
                        style={styles.input} 
                        placeholder="Number of units" 
                        value={row.units}
                        onChange={(e) => handleProformaRentChange(index, 'units', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>Proforma Rent</label>
                      <input 
                        type="number" 
                        style={styles.input} 
                        placeholder="Enter proforma rent" 
                        value={row.rent}
                        onChange={(e) => handleProformaRentChange(index, 'rent', e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      {proformaRentRows.length > 1 && (
                        <button
                          onClick={() => removeProformaRentRow(index)}
                          style={{
                            padding: "10px 12px",
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 900
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={addProformaRentRow}
                  style={{
                    marginTop: 12,
                    padding: "10px 16px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  + Add Another Unit Type
                </button>
              </div>
            </div>
          )}

          {activeTab === "property" && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Building size={20} /> Property Information
                <span style={{ marginLeft: "auto", fontSize: 13, color: "#ef4444" }}>* Required fields</span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      County Name (Type exactly: e.g. "Autauga County")
                    </label>
                    <input
                      type="text"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.property?.county ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.property?.county || ""}
                      onChange={async (e) => {
                        const value = e.target.value;
                        updateVerifiedField("property", "county", value);
                        // Autocomplete logic
                        if (!window._countyList) {
                          const Papa = (await import('papaparse')).default;
                          const csv = await fetch('/Property%20Taxes%20by%20State%20and%20County,%202025%20%20Tax%20Foundation%20Maps.csv').then(r => r.text());
                          const data = Papa.parse(csv, { header: true }).data;
                          window._countyList = data.map(row => row.County).filter(Boolean);
                        }
                        const matches = window._countyList.filter(c => c.toLowerCase().startsWith(value.toLowerCase())).slice(0, 10);
                        window._countyMatches = matches;
                        // Force re-render
                        setCountyMatches(matches);
                      }}
                      placeholder="Autauga County"
                      autoComplete="off"
                    />
                    {/* County autocomplete dropdown */}
                    {countyMatches && countyMatches.length > 0 && (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 2, maxHeight: 180, overflowY: 'auto', position: 'absolute', zIndex: 10, width: '100%' }}>
                        {countyMatches.map((county, idx) => (
                          <div
                            key={county}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#374151', borderBottom: idx < countyMatches.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                            onClick={() => {
                              updateVerifiedField("property", "county", county);
                              setCountyMatches([]);
                            }}
                          >{county}</div>
                        ))}
                      </div>
                    )}
                    <button
                      style={{ ...styles.button, marginTop: 8, fontSize: 14, padding: "8px 16px" }}
                      type="button"
                      onClick={async () => {
                        const Papa = (await import('papaparse')).default;
                        const countyName = verifiedData?.property?.county?.trim();
                        const price = parseFloat(verifiedData?.pricing_financing?.price) || 0;
                        if (!countyName || !price) {
                          alert("Enter county and purchase price first.");
                          return;
                        }
                        const csv = await fetch('/Property%20Taxes%20by%20State%20and%20County,%202025%20%20Tax%20Foundation%20Maps.csv').then(r => r.text());
                        const data = Papa.parse(csv, { header: true }).data;
                        const match = data.find(row => row.County === countyName);
                        if (!match) {
                          alert("County not found. Type exactly as in the CSV.");
                          return;
                        }
                        let rateStr = match["Effective Property Tax Rate (2023)"];
                        if (!rateStr) {
                          alert("Tax rate not found for county.");
                          return;
                        }
                        rateStr = rateStr.replace('%','');
                        const rate = parseFloat(rateStr) / 100;
                        const annualTax = price * rate;
                        const monthlyTax = annualTax / 12;
                        updateVerifiedField("expenses", "taxes", Math.round(annualTax));
                        updateVerifiedField("expenses", "monthly_taxes", Math.round(monthlyTax));
                        alert(`Annual Tax: $${Math.round(annualTax)}\nMonthly Tax: $${Math.round(monthlyTax)}`);
                      }}
                    >Calculate Property Tax</button>
                  </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Address *
                  </label>
                  <input
                    type="text"
                    style={{
                      ...styles.input,
                      ...(validationErrors['property.address'] ? styles.inputError : {}),
                      ...(verifiedData?.property?.address ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.address || ""}
                    onChange={(e) => updateVerifiedField("property", "address", e.target.value)}
                    placeholder="Enter property address"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    City
                  </label>
                  <input
                    type="text"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.city ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.city || ""}
                    onChange={(e) => updateVerifiedField("property", "city", e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    State
                  </label>
                  <input
                    type="text"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.state ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.state || ""}
                    onChange={(e) => updateVerifiedField("property", "state", e.target.value)}
                    placeholder="Enter state"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.zip ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.zip || ""}
                    onChange={(e) => updateVerifiedField("property", "zip", e.target.value)}
                    placeholder="Enter ZIP"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Total Units *
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(validationErrors['property.units'] ? styles.inputError : {}),
                      ...(verifiedData?.property?.units ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.units || ""}
                    onChange={(e) => updateVerifiedField("property", "units", parseFloat(e.target.value))}
                    placeholder="Enter number of units"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Year Built
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.year_built ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.year_built || ""}
                    onChange={(e) => updateVerifiedField("property", "year_built", parseInt(e.target.value))}
                    placeholder="Enter year built"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Building SF
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.rba_sqft ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.rba_sqft || ""}
                    onChange={(e) => updateVerifiedField("property", "rba_sqft", parseFloat(e.target.value))}
                    placeholder="Enter square footage"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Land Area (Acres)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.property?.land_area_acres ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.property?.land_area_acres || ""}
                    onChange={(e) => updateVerifiedField("property", "land_area_acres", parseFloat(e.target.value))}
                    placeholder="Enter land area"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "financial" && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={20} /> Financial Information
                <span style={{ marginLeft: "auto", fontSize: 13, color: "#ef4444" }}>* Required fields</span>
              </h3>
              
              <div style={{ marginBottom: 32 }}>
                <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 900, color: "#374151" }}>Pricing & Financing</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Financing Type *
                    </label>
                    <select
                      style={{
                        ...styles.select,
                        ...(validationErrors['pricing_financing.financing_mode'] ? styles.inputError : {}),
                        ...(verifiedData?.pricing_financing?.financing_mode ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.financing_mode || "traditional"}
                      onChange={(e) => {
                        updateVerifiedField("pricing_financing", "financing_mode", e.target.value);
                        const resetFields = [
                          'down_payment_pct', 'term_years', 'amortization_years',
                          'down_payment_amount', 'balloon_years', 'io_period_years',
                          'existing_loan_balance', 'remaining_term_years'
                        ];
                        const newPricing = { ...verifiedData.pricing_financing };
                        resetFields.forEach(field => delete newPricing[field]);
                        setVerifiedData(prev => ({
                          ...prev,
                          pricing_financing: { ...newPricing, financing_mode: e.target.value }
                        }));
                      }}
                    >
                      <option value="traditional">Traditional</option>
                      <option value="seller_finance">Seller Finance</option>
                      <option value="subject_to">Subject-To</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Purchase Price *
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(validationErrors['pricing_financing.price'] ? styles.inputError : {}),
                        ...(verifiedData?.pricing_financing?.price ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.price || ""}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value);
                        setVerifiedData(prev => ({
                          ...prev,
                          pricing_financing: {
                            ...prev.pricing_financing,
                            price
                          }
                        }));
                        autoCalculateFinancing({
                          ...verifiedData?.pricing_financing,
                          price
                        }, setVerifiedData);
                      }}
                      placeholder="Enter purchase price"
                    />
                  </div>
                  {financingMode === 'traditional' && (
                    <>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Down Payment (%) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.down_payment_pct'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.down_payment_pct ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.down_payment_pct || ""}
                          onChange={(e) => {
                            const downPct = parseFloat(e.target.value);
                            setVerifiedData(prev => ({
                              ...prev,
                              pricing_financing: {
                                ...prev.pricing_financing,
                                down_payment_pct: downPct
                              }
                            }));
                            autoCalculateFinancing({
                              ...verifiedData?.pricing_financing,
                              down_payment_pct: downPct
                            }, setVerifiedData);
                          }}
                          placeholder="Enter down payment %"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Term (Years) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.term_years'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.term_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.term_years || ""}
                          onChange={(e) => {
                            const termYears = parseInt(e.target.value);
                            setVerifiedData(prev => ({
                              ...prev,
                              pricing_financing: {
                                ...prev.pricing_financing,
                                term_years: termYears
                              }
                            }));
                            autoCalculateFinancing({
                              ...verifiedData?.pricing_financing,
                              term_years: termYears
                            }, setVerifiedData);
                          }}
                          placeholder="Enter loan term"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Amortization (Years)
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(verifiedData?.pricing_financing?.amortization_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.amortization_years || ""}
                          onChange={(e) => {
                            const amortYears = parseInt(e.target.value);
                            setVerifiedData(prev => ({
                              ...prev,
                              pricing_financing: {
                                ...prev.pricing_financing,
                                amortization_years: amortYears
                              }
                            }));
                            autoCalculateFinancing({
                              ...verifiedData?.pricing_financing,
                              amortization_years: amortYears
                            }, setVerifiedData);
                          }}
                          placeholder="Enter amortization years"
                        />
                      </div>
                    </>
                  )}
                  {financingMode === 'seller_finance' && (
                    <>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Down Payment (Amount $) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.down_payment_amount'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.down_payment_amount ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.down_payment_amount || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "down_payment_amount", parseFloat(e.target.value))}
                          placeholder="Enter down payment amount"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Amortization (Years) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.amortization_years'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.amortization_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.amortization_years || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "amortization_years", parseInt(e.target.value))}
                          placeholder="Enter amortization years"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Balloon (Years) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.balloon_years'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.balloon_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.balloon_years || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "balloon_years", parseInt(e.target.value))}
                          placeholder="Enter balloon years"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Interest-Only Period (Years)
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(verifiedData?.pricing_financing?.io_period_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.io_period_years || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "io_period_years", parseInt(e.target.value))}
                          placeholder="Enter IO period years"
                        />
                      </div>
                    </>
                  )}
                  {financingMode === 'subject_to' && (
                    <>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Existing Loan Balance ($) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.existing_loan_balance'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.existing_loan_balance ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.existing_loan_balance || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "existing_loan_balance", parseFloat(e.target.value))}
                          placeholder="Enter existing loan balance"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Remaining Term (Years) *
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(validationErrors['pricing_financing.remaining_term_years'] ? styles.inputError : {}),
                            ...(verifiedData?.pricing_financing?.remaining_term_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.remaining_term_years || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "remaining_term_years", parseInt(e.target.value))}
                          placeholder="Enter remaining term"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                          Amortization (Years)
                        </label>
                        <input
                          type="number"
                          style={{
                            ...styles.input,
                            ...(verifiedData?.pricing_financing?.amortization_years ? styles.inputSuccess : {})
                          }}
                          value={verifiedData?.pricing_financing?.amortization_years || ""}
                          onChange={(e) => updateVerifiedField("pricing_financing", "amortization_years", parseInt(e.target.value))}
                          placeholder="Enter amortization years"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Loan Amount
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(validationErrors['pricing_financing.loan_amount'] && financingMode === 'traditional' ? styles.inputError : {}),
                        ...(verifiedData?.pricing_financing?.loan_amount ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.loan_amount || ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "loan_amount", parseFloat(e.target.value))}
                      placeholder="Enter loan amount"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      style={{
                        ...styles.input,
                        ...(validationErrors['pricing_financing.interest_rate'] ? styles.inputError : {}),
                        ...(verifiedData?.pricing_financing?.interest_rate ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.interest_rate ? (verifiedData.pricing_financing.interest_rate * 100) : ""}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) / 100;
                        setVerifiedData(prev => ({
                          ...prev,
                          pricing_financing: {
                            ...prev.pricing_financing,
                            interest_rate: rate
                          }
                        }));
                        autoCalculateFinancing({
                          ...verifiedData?.pricing_financing,
                          interest_rate: rate
                        }, setVerifiedData);
                      }}
                      placeholder="Enter interest rate"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Monthly Debt Service
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.monthly_payment ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.monthly_payment !== undefined && verifiedData?.pricing_financing?.monthly_payment !== null ? Number(verifiedData.pricing_financing.monthly_payment).toFixed(2) : ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        updateVerifiedField("pricing_financing", "monthly_payment", v);
                        if (!isNaN(v)) {
                          updateVerifiedField("pricing_financing", "annual_debt_service", v * 12);
                        }
                      }}
                      placeholder="Enter monthly debt service"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Annual Debt Service
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.annual_debt_service ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.annual_debt_service !== undefined && verifiedData?.pricing_financing?.annual_debt_service !== null ? Number(verifiedData.pricing_financing.annual_debt_service).toFixed(2) : ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "annual_debt_service", parseFloat(e.target.value))}
                      placeholder="Enter annual debt service"
                    />
                  </div>
                </div>

                {/* Acquisition & Disposition Costs */}
                <h4 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, fontWeight: 900, color: "#374151" }}>Acquisition & Disposition Costs</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Realtor Fees (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.realtor_fee_pct ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.realtor_fee_pct || ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "realtor_fee_pct", parseFloat(e.target.value))}
                      placeholder="Enter realtor fee %"
                    />
                    {verifiedData?.pricing_financing?.realtor_fee_pct && verifiedData?.pricing_financing?.price && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        {fmtCurrency((verifiedData.pricing_financing.price * verifiedData.pricing_financing.realtor_fee_pct / 100))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Closing Costs (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.closing_costs_pct ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.closing_costs_pct || ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "closing_costs_pct", parseFloat(e.target.value))}
                      placeholder="Enter closing costs %"
                    />
                    {verifiedData?.pricing_financing?.closing_costs_pct && verifiedData?.pricing_financing?.price && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        {fmtCurrency((verifiedData.pricing_financing.price * verifiedData.pricing_financing.closing_costs_pct / 100))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Disposition/Acquisition Fees (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.acquisition_fee_pct ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.acquisition_fee_pct || ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "acquisition_fee_pct", parseFloat(e.target.value))}
                      placeholder="Enter acquisition fee %"
                    />
                    {verifiedData?.pricing_financing?.acquisition_fee_pct && verifiedData?.pricing_financing?.price && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        {fmtCurrency((verifiedData.pricing_financing.price * verifiedData.pricing_financing.acquisition_fee_pct / 100))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Rehab Cost
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pricing_financing?.rehab_cost ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pricing_financing?.rehab_cost || ""}
                      onChange={(e) => updateVerifiedField("pricing_financing", "rehab_cost", parseFloat(e.target.value))}
                      placeholder="Enter rehab cost"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Total Initial Cash Investment
                    </label>
                    <div style={{
                      padding: "10px 14px",
                      background: "#f9fafb",
                      border: "2px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 900
                    }}>
                      {(() => {
                        const price = verifiedData?.pricing_financing?.price || 0;
                        const downPayment = financingMode === 'traditional' 
                          ? price * (verifiedData?.pricing_financing?.down_payment_pct || 0) / 100
                          : (verifiedData?.pricing_financing?.down_payment_amount || 0);
                        const realtorFees = price * (verifiedData?.pricing_financing?.realtor_fee_pct || 0) / 100;
                        const closingCosts = price * (verifiedData?.pricing_financing?.closing_costs_pct || 0) / 100;
                        const acquisitionFees = price * (verifiedData?.pricing_financing?.acquisition_fee_pct || 0) / 100;
                        const rehabCost = verifiedData?.pricing_financing?.rehab_cost || 0;
                        return fmtCurrency(downPayment + realtorFees + closingCosts + acquisitionFees + rehabCost);
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 900, color: "#374151" }}>Income</h4>
                <div style={{ marginBottom: 12, fontSize: 13, color: "#6b7280" }}>
                  <strong>Gross Potential Rent (Annual):</strong> Total possible rent if fully occupied, no vacancy.<br/>
                  <strong>Effective Gross Income (Annual):</strong> Actual expected income after vacancy loss and adding other income.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Gross Potential Rent (Annual) *
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(validationErrors['pnl.gross_potential_rent'] ? styles.inputError : {}),
                        ...(verifiedData?.pnl?.gross_potential_rent ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pnl?.gross_potential_rent || ""}
                      onChange={(e) => {
                        const gross = parseFloat(e.target.value) || 0;
                        const other = verifiedData?.pnl?.other_income || 0;
                        const vacRate = verifiedData?.pnl?.vacancy_rate || 0;
                        const vacancyLoss = gross * vacRate;
                        setVerifiedData(prev => ({
                          ...prev,
                          pnl: {
                            ...prev.pnl,
                            gross_potential_rent: gross,
                            effective_gross_income: gross + other - vacancyLoss
                          }
                        }));
                      }}
                      placeholder="Enter annual gross rent"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Other Income (Annual)
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pnl?.other_income ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pnl?.other_income || ""}
                      onChange={(e) => {
                        const other = parseFloat(e.target.value) || 0;
                        const gross = verifiedData?.pnl?.gross_potential_rent || 0;
                        const vacRate = verifiedData?.pnl?.vacancy_rate || 0;
                        const vacancyLoss = gross * vacRate;
                        setVerifiedData(prev => ({
                          ...prev,
                          pnl: {
                            ...prev.pnl,
                            other_income: other,
                            effective_gross_income: gross + other - vacancyLoss
                          }
                        }));
                      }}
                      placeholder="Enter other income"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                      Effective Gross Income (Annual)
                    </label>
                    <input
                      type="number"
                      style={{
                        ...styles.input,
                        ...(verifiedData?.pnl?.effective_gross_income ? styles.inputSuccess : {})
                      }}
                      value={verifiedData?.pnl?.effective_gross_income || ""}
                      onChange={(e) => updateVerifiedField("pnl", "effective_gross_income", parseFloat(e.target.value))}
                      placeholder="Enter EGI"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "expenses" && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={20} /> Operating Expenses Breakdown
              </h3>
              
              {/* Percentage-based Expenses */}
              <h4 style={{ marginBottom: 16, fontSize: 15, fontWeight: 900, color: "#374151" }}>Percentage-Based Expenses</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Vacancy Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.vacancy_pct ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.vacancy_pct !== undefined && verifiedData?.expenses?.vacancy_pct !== null ? String(verifiedData.expenses.vacancy_pct) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || val === null) {
                        updateVerifiedField("expenses", "vacancy_pct", "");
                      } else if (!isNaN(Number(val))) {
                        updateVerifiedField("expenses", "vacancy_pct", parseFloat(val));
                      }
                    }}
                    placeholder="Enter vacancy %"
                  />
                  {verifiedData?.expenses?.vacancy_pct && verifiedData?.pnl?.gross_potential_rent && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Annual: {fmtCurrency((verifiedData.pnl.gross_potential_rent * verifiedData.expenses.vacancy_pct / 100))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Property Management (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.property_management_pct ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.property_management_pct !== undefined && verifiedData?.expenses?.property_management_pct !== null ? String(verifiedData.expenses.property_management_pct) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || val === null) {
                        updateVerifiedField("expenses", "property_management_pct", "");
                      } else if (!isNaN(Number(val))) {
                        updateVerifiedField("expenses", "property_management_pct", parseFloat(val));
                      }
                    }}
                    placeholder="Enter property mgmt %"
                  />
                  {verifiedData?.expenses?.property_management_pct && verifiedData?.pnl?.gross_potential_rent && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Annual: {fmtCurrency((verifiedData.pnl.gross_potential_rent * verifiedData.expenses.property_management_pct / 100))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Capital Expenditures (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.capex_pct ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.capex_pct !== undefined && verifiedData?.expenses?.capex_pct !== null ? String(verifiedData.expenses.capex_pct) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || val === null) {
                        updateVerifiedField("expenses", "capex_pct", "");
                      } else if (!isNaN(Number(val))) {
                        updateVerifiedField("expenses", "capex_pct", parseFloat(val));
                      }
                    }}
                    placeholder="Enter CapEx %"
                  />
                  {verifiedData?.expenses?.capex_pct && verifiedData?.pnl?.gross_potential_rent && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Annual: {fmtCurrency((verifiedData.pnl.gross_potential_rent * verifiedData.expenses.capex_pct / 100))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Expenses */}
              <h4 style={{ marginBottom: 16, fontSize: 15, fontWeight: 900, color: "#374151" }}>Fixed Annual Expenses</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Real Estate Taxes
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.taxes ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.taxes || ""}
                    onChange={(e) => updateVerifiedField("expenses", "taxes", parseFloat(e.target.value))}
                    placeholder="Enter annual taxes"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Insurance
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.insurance ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.insurance || ""}
                    onChange={(e) => updateVerifiedField("expenses", "insurance", parseFloat(e.target.value))}
                    placeholder="Enter annual insurance"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Repairs & Maintenance
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.repairs_maintenance ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.repairs_maintenance || ""}
                    onChange={(e) => updateVerifiedField("expenses", "repairs_maintenance", parseFloat(e.target.value))}
                    placeholder="Enter R&M costs"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Management Fees
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.management ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.management || ""}
                    onChange={(e) => updateVerifiedField("expenses", "management", parseFloat(e.target.value))}
                    placeholder="Enter management fees"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Payroll
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.payroll ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.payroll || ""}
                    onChange={(e) => updateVerifiedField("expenses", "payroll", parseFloat(e.target.value))}
                    placeholder="Enter payroll costs"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Other Expenses
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.other ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.other || ""}
                    onChange={(e) => updateVerifiedField("expenses", "other", parseFloat(e.target.value))}
                    placeholder="Enter other expenses"
                  />
                </div>
              </div>

              {/* Utilities Section */}
              <h4 style={{ marginTop: 32, marginBottom: 16, fontSize: 15, fontWeight: 900, color: "#374151" }}>Utilities (Monthly)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Gas
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.gas ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.gas || ""}
                    onChange={(e) => updateVerifiedField("expenses", "gas", parseFloat(e.target.value))}
                    placeholder="Enter monthly gas"
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Annual: {fmtCurrency((verifiedData?.expenses?.gas || 0) * 12)}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Electrical
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.electrical ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.electrical || ""}
                    onChange={(e) => updateVerifiedField("expenses", "electrical", parseFloat(e.target.value))}
                    placeholder="Enter monthly electrical"
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Annual: {fmtCurrency((verifiedData?.expenses?.electrical || 0) * 12)}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Water
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.water ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.water || ""}
                    onChange={(e) => updateVerifiedField("expenses", "water", parseFloat(e.target.value))}
                    placeholder="Enter monthly water"
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Annual: {fmtCurrency((verifiedData?.expenses?.water || 0) * 12)}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Sewer
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.sewer ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.sewer || ""}
                    onChange={(e) => updateVerifiedField("expenses", "sewer", parseFloat(e.target.value))}
                    placeholder="Enter monthly sewer"
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Annual: {fmtCurrency((verifiedData?.expenses?.sewer || 0) * 12)}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Trash
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      ...(verifiedData?.expenses?.trash ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.trash || ""}
                    onChange={(e) => updateVerifiedField("expenses", "trash", parseFloat(e.target.value))}
                    placeholder="Enter monthly trash"
                  />
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Annual: {fmtCurrency((verifiedData?.expenses?.trash || 0) * 12)}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280", fontWeight: 900 }}>
                    Total Utilities
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      background: "#f9fafb",
                      ...(verifiedData?.expenses?.utilities ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.utilities || ""}
                    onChange={(e) => updateVerifiedField("expenses", "utilities", parseFloat(e.target.value))}
                    placeholder="Total utilities"
                  />
                </div>
              </div>

              {/* Total Expenses */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "2px solid #e5e7eb" }}>
                <div style={{ maxWidth: 400 }}>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#111827", fontWeight: 900 }}>
                    Total Operating Expenses
                  </label>
                  <input
                    type="number"
                    style={{
                      ...styles.input,
                      background: "#f3f4f6",
                      fontWeight: 900,
                      fontSize: 16,
                      border: "2px solid #9ca3af",
                      ...(verifiedData?.expenses?.total ? styles.inputSuccess : {})
                    }}
                    value={verifiedData?.expenses?.total || ""}
                    onChange={(e) => updateVerifiedField("expenses", "total", parseFloat(e.target.value))}
                    placeholder="Total annual expenses"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "unitMix" && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={20} /> Unit Mix
                <button
                  onClick={() => {
                    const newUnit = { type: "", units: 0, unit_sf: 0, rent_current: 0, rent_market: 0 };
                    setVerifiedData(prev => ({
                      ...prev,
                      unit_mix: [...(prev.unit_mix || []), newUnit]
                    }));
                  }}
                  style={{ 
                    marginLeft: "auto", 
                    padding: "6px 12px", 
                    background: "#10b981", 
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  + Add Unit Type
                </button>
              </h3>
              
              {(!verifiedData?.unit_mix || verifiedData.unit_mix.length === 0) ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  <Home size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <div>No unit mix data available</div>
                  <button
                    onClick={() => {
                      const defaultUnits = [
                        { type: "Studio", units: 0, unit_sf: 0, rent_current: 0, rent_market: 0 },
                        { type: "1BR/1BA", units: 0, unit_sf: 0, rent_current: 0, rent_market: 0 },
                        { type: "2BR/2BA", units: 0, unit_sf: 0, rent_current: 0, rent_market: 0 }
                      ];
                      setVerifiedData(prev => ({
                        ...prev,
                        unit_mix: defaultUnits
                      }));
                    }}
                    style={{ 
                      marginTop: 16,
                      padding: "8px 16px", 
                      background: "#3b82f6", 
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                  >
                    Add Default Unit Types
                  </button>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                      <th style={{ padding: 12, textAlign: "left", fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>Type</th>
                      <th style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>Units</th>
                      <th style={{ padding: 12, textAlign: "right", fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>Unit SF</th>
                      <th style={{ padding: 12, textAlign: "right", fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>Current Rent</th>
                      <th style={{ padding: 12, textAlign: "right", fontSize: 12, color: "#6b7280", textTransform: "uppercase" }}>Market Rent</th>
                      <th style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#6b7280" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifiedData.unit_mix.map((unit, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            style={{ ...styles.input, padding: "6px 10px" }}
                            value={unit.type || ""}
                            onChange={(e) => {
                              const newUnits = [...verifiedData.unit_mix];
                              newUnits[i].type = e.target.value;
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                            placeholder="e.g., 1BR/1BA"
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            style={{ ...styles.input, padding: "6px 10px", textAlign: "center" }}
                            value={unit.units || ""}
                            onChange={(e) => {
                              const newUnits = [...verifiedData.unit_mix];
                              newUnits[i].units = parseInt(e.target.value) || 0;
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            style={{ ...styles.input, padding: "6px 10px", textAlign: "right" }}
                            value={unit.unit_sf || ""}
                            onChange={(e) => {
                              const newUnits = [...verifiedData.unit_mix];
                              newUnits[i].unit_sf = parseFloat(e.target.value) || 0;
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            style={{ ...styles.input, padding: "6px 10px", textAlign: "right" }}
                            value={unit.rent_current || ""}
                            onChange={(e) => {
                              const newUnits = [...verifiedData.unit_mix];
                              newUnits[i].rent_current = parseFloat(e.target.value) || 0;
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            style={{ ...styles.input, padding: "6px 10px", textAlign: "right" }}
                            value={unit.rent_market || ""}
                            onChange={(e) => {
                              const newUnits = [...verifiedData.unit_mix];
                              newUnits[i].rent_market = parseFloat(e.target.value) || 0;
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <button
                            onClick={() => {
                              const newUnits = verifiedData.unit_mix.filter((_, idx) => idx !== i);
                              setVerifiedData(prev => ({...prev, unit_mix: newUnits}));
                            }}
                            style={{ 
                              padding: "4px 8px", 
                              background: "#ef4444", 
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              fontSize: 12,
                              cursor: "pointer"
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
            <button
              onClick={recalculateMetrics}
              style={{ ...styles.button, background: "linear-gradient(135deg, #6b7280, #4b5563)" }}
            >
              <RefreshCw size={18} /> Recalculate Metrics
            </button>
            <button
              onClick={proceedWithVerifiedData}
              style={{ ...styles.button, background: "linear-gradient(135deg, #10b981, #059669)" }}
            >
              <Save size={18} /> Complete Underwriting Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    const property = parsed?.property || {};
    const pricing = parsed?.pricing_financing || {};
    const pnl = parsed?.pnl || {};
    const underwriting = parsed?.underwriting || {};
    const dealAnalysis = parsed?.deal_analysis || {};
    
    // CRITICAL FIX: Ensure debt service is calculated before cash flow
    const debtService = pricing.annual_debt_service || 0;
    const adjustedCashFlow = (pnl.noi || 0) - debtService;

    // Warning if debt service is missing
    if (!pricing.annual_debt_service && pricing.loan_amount) {
      console.warn("Missing debt service calculation - cash flow may be incorrect");
    }
    
    const adjustedCapRate = pricing.price > 0 ? (pnl.noi || 0) / pricing.price : 0;
    const adjustedPricePerUnit = property.units > 0 ? pricing.price / property.units : 0;
    
    const dealScore = dealAnalysis.deal_score || 50;
    const scoreColors = getDealScoreColor(dealScore);
    const projections = generateProjections();
    const expenseData = getExpenseData();

    const tabs = [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'cashflow', label: 'Cash Flow', icon: TrendingUp },
      { id: 'profitability', label: 'Profitability', icon: DollarSign },
      { id: 'sensitivity', label: 'Sensitivity', icon: Target },
      { id: 'financing', label: 'Capital Structure', icon: Calculator },
      { id: 'returns', label: 'Returns', icon: Briefcase },
      { id: 'proforma', label: 'Proforma', icon: Layers },
      { id: 'comparison', label: 'Comparison', icon: GitCompare },
      { id: 'acquisition', label: 'Acquisition Costs', icon: FileText }
    ];

    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 24px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => window.location.href = '/'}
                style={{ 
                  padding: '10px 18px', 
                  background: 'white', 
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#f9fafb'; e.target.style.borderColor = '#d1d5db'; }}
                onMouseLeave={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#E5E7EB'; }}
              >
                <Home size={16} />
                Home
              </button>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: '-0.01em' }}>
                {property.address || 'Property Analysis'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={handleEditData}
                style={{ 
                  padding: '8px 16px', 
                  background: 'white', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: 6, 
                  fontSize: 14, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8 
                }}
              >
                <Edit3 size={16} />
                Edit Data
              </button>
              <button 
                onClick={reset}
                style={{ 
                  padding: '8px 16px', 
                  background: COLORS.primary, 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  fontSize: 14, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8 
                }}
              >
                <Upload size={16} />
                New Deal
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 32 }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setResultsTab(tab.id)}
                  style={{
                    padding: '16px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: resultsTab === tab.id ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                    fontSize: 14,
                    fontWeight: resultsTab === tab.id ? 600 : 400,
                    color: resultsTab === tab.id ? COLORS.primary : '#6B7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: -1,
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: 24 }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* Overview Tab */}
            {resultsTab === 'overview' && (
              <div>
                {/* Deal Score Card - Enhanced UI */}
                <div style={{ 
                  background: 'white', 
                  borderRadius: 16, 
                  marginBottom: 24,
                  overflow: 'hidden',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}>
                  {/* Score Header with Gradient Background */}
                  <div style={{
                    background: scoreColors.gradient,
                    padding: '20px 24px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Background Pattern */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: 0.1,
                      background: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 10px,
                        rgba(255,255,255,0.1) 10px,
                        rgba(255,255,255,0.1) 20px
                      )`
                    }} />
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 800, margin: '0 auto' }}>
                      {/* Score Circle - Smaller */}
                      <div style={{
                        width: 80,
                        height: 80,
                        position: 'relative'
                      }}>
                        <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                          <circle
                            cx="40"
                            cy="40"
                            r="35"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="35"
                            stroke="white"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${(dealScore / 100) * 220} 220`}
                            strokeLinecap="round"
                            style={{
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                              transition: 'stroke-dasharray 0.5s ease'
                            }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center'
                        }}>
                          <div style={{ 
                            fontSize: 28, 
                            fontWeight: 900, 
                            color: scoreColors.text,
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}>
                            {dealScore}
                          </div>
                          <div style={{ 
                            fontSize: 9, 
                            fontWeight: 900,
                            color: scoreColors.text,
                            opacity: 0.9,
                            marginTop: 2,
                            letterSpacing: 1
                          }}>
                            SCORE
                          </div>
                        </div>
                      </div>
                      
                      {/* Recommendation Badge */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        padding: '8px 20px',
                        borderRadius: 100,
                        border: '2px solid rgba(255,255,255,0.3)'
                      }}>
                        <Award size={18} color={scoreColors.text} />
                        <span style={{ 
                          fontSize: 14, 
                          fontWeight: 900, 
                          color: scoreColors.text,
                          letterSpacing: 0.5
                        }}>
                          {dealAnalysis.recommendation || scoreColors.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pros and Cons Section */}
                  <div style={{ padding: 24 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      {/* Strengths */}
                      <div>
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 10, 
                          marginBottom: 20,
                          paddingBottom: 12,
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <ThumbsUp size={18} color="white" />
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>
                            Deal Strengths
                          </span>
                        </div>
                        <div style={{ space: 12 }}>
                          {(dealAnalysis.pros || []).map((pro, i) => (
                            <div key={i} style={{ 
                              display: "flex", 
                              gap: 12, 
                              marginBottom: 12,
                              padding: '10px 12px',
                              background: '#f0fdf4',
                              borderRadius: 8,
                              border: '1px solid #bbf7d0'
                            }}>
                              <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                              <span style={{ fontSize: 14, color: '#064e3b', lineHeight: 1.5 }}>{pro}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weaknesses */}
                      <div>
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 10, 
                          marginBottom: 20,
                          paddingBottom: 12,
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <AlertTriangle size={18} color="white" />
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>
                            Risk Factors
                          </span>
                        </div>
                        <div style={{ space: 12 }}>
                          {(dealAnalysis.cons || []).map((con, i) => (
                            <div key={i} style={{ 
                              display: "flex", 
                              gap: 12, 
                              marginBottom: 12,
                              padding: '10px 12px',
                              background: '#fef2f2',
                              borderRadius: 8,
                              border: '1px solid #fecaca'
                            }}>
                              <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                              <span style={{ fontSize: 14, color: '#7f1d1d', lineHeight: 1.5 }}>{con}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
                  <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>Cap Rate</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.secondary }}>{fmtPct(adjustedCapRate)}</div>
                  </div>
                  <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>DSCR</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.dark }}>{fmtNumber(underwriting.dscr)}</div>
                  </div>
                  <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>Cash Flow</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.info }}>
                      {fmtCurrency(adjustedCashFlow)}
                    </div>
                  </div>
                  <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>Price/Unit</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.warning }}>{fmtCurrency(adjustedPricePerUnit)}</div>
                  </div>
                </div>

                {/* Property & Financial Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building size={20} /> Property Details
                    </h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Address</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{property.address || "—"}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Units</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtNumber(property.units)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Year Built</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{property.year_built || "—"}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Square Footage</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtNumber(property.rba_sqft)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={20} /> Financial Summary
                    </h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Purchase Price</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pricing.price)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>NOI</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pnl.noi)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Loan Amount</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pricing.loan_amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Debt Service</span>
                        <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pricing.annual_debt_service)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proforma Rent Schedule - NEW SECTION */}
                {parsed?.proforma?.rent_schedule && parsed.proforma.rent_schedule.length > 0 && (
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={20} /> Proforma Rent Schedule
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                          <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 900, color: '#6B7280' }}>Unit Type</th>
                          <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 900, color: '#6B7280' }}>Units</th>
                          <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#6B7280' }}>Monthly Rent</th>
                          <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#6B7280' }}>Monthly Income</th>
                          <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#6B7280' }}>Annual Income</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.proforma.rent_schedule.map((row, i) => {
                          const units = parseFloat(row.units) || 0;
                          const rent = parseFloat(row.rent) || 0;
                          const monthlyIncome = units * rent;
                          const annualIncome = monthlyIncome * 12;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                              <td style={{ padding: 12, fontSize: 14 }}>{row.type}</td>
                              <td style={{ padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 900 }}>{units}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(rent)}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>{fmtCurrency(monthlyIncome)}</td>
                              <td style={{ padding: 12, textAlign: 'right', fontSize: 14 }}>{fmtCurrency(annualIncome)}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: '#F9FAFB', fontWeight: 900, borderTop: '2px solid #E5E7EB' }}>
                          <td colSpan={3} style={{ padding: 12, fontSize: 14 }}>Total Gross Potential Rent</td>
                          <td colSpan={2} style={{ padding: 12, textAlign: 'right', fontSize: 16, color: COLORS.primary }}>
                            {fmtCurrency(parsed.pnl?.gross_potential_rent || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {parsed.pnl?.gross_potential_rent_source === 'proforma' && (
                      <div style={{ marginTop: 12, padding: 12, background: '#ECFDF5', borderRadius: 8, fontSize: 13, color: '#047857', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={16} />
                        <span>GPR automatically calculated from proforma rent schedule</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cash Flow Tab */}
            {resultsTab === 'cashflow' && (
              <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900 }}>Cash Flow Projection</h3>
                  <select
                    value={cashFlowYears || 10}
                    onChange={(e) => setCashFlowYears(parseInt(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      fontSize: 14,
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={1}>1 Year</option>
                    <option value={5}>5 Years</option>
                    <option value={10}>10 Years</option>
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={projections.slice(0, cashFlowYears || 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="year" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${(value/1000).toFixed(0)}K`} />
                    <Tooltip 
                      contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8 }}
                      formatter={(value) => fmtCurrency(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cashFlow" 
                      stroke={COLORS.primary} 
                      strokeWidth={3}
                      dot={{ fill: COLORS.primary, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Cash Flow"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="noi" 
                      stroke={COLORS.secondary} 
                      strokeWidth={3}
                      dot={{ fill: COLORS.secondary, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="NOI"
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Profitability Tab */}
            {resultsTab === 'profitability' && (
              <div>
                <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>10-Year Profitability Analysis</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                          <th style={{ padding: 12, textAlign: 'left', color: '#6B7280', fontWeight: 900 }}>Metric</th>
                          {projections.slice(0, 5).map((_, i) => (
                            <th key={i} style={{ padding: 12, textAlign: 'right', color: '#6B7280', fontWeight: 900 }}>
                              Year {i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: 12, fontWeight: 900 }}>Cash Flow</td>
                          {projections.slice(0, 5).map((year, i) => (
                            <td key={i} style={{ padding: 12, textAlign: 'right' }}>{fmtCurrency(year.cashFlow)}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: 12, fontWeight: 900 }}>Property Value</td>
                          {projections.slice(0, 5).map((year, i) => (
                            <td key={i} style={{ padding: 12, textAlign: 'right' }}>{fmtCurrency(year.propertyValue)}</td>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                          <td style={{ padding: 12, fontWeight: 900 }}>Net Worth Increase</td>
                          {projections.slice(0, 5).map((year, i) => (
                            <td key={i} style={{ padding: 12, textAlign: 'right', fontWeight: 900 }}>
                              {fmtCurrency(year.netWorth)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cumulative Cash Flow Chart */}
                <div style={{ background: 'white', borderRadius: 12, padding: 24, marginTop: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Cumulative Returns</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={projections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="year" stroke="#6B7280" fontSize={12} />
                      <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${(value/1000).toFixed(0)}K`} />
                      <Tooltip 
                        contentStyle={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8 }}
                        formatter={(value) => fmtCurrency(value)}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="netWorth" 
                        stroke={COLORS.primary} 
                        fill={COLORS.primary}
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="Net Worth"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Sensitivity Tab */}
            {resultsTab === 'sensitivity' && (
              <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Purchase Price Sensitivity Analysis</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                        <th style={{ padding: 12, textAlign: 'left', fontWeight: 900 }}>Purchase Price</th>
                        <th style={{ padding: 12, textAlign: 'center', fontWeight: 900 }}>Cap Rate</th>
                        <th style={{ padding: 12, textAlign: 'center', fontWeight: 900 }}>DSCR</th>
                        <th style={{ padding: 12, textAlign: 'center', fontWeight: 900 }}>Cash Flow</th>
                        <th style={{ padding: 12, textAlign: 'center', fontWeight: 900 }}>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, -50000, -100000, -150000, -200000].map((reduction, index) => {
                        const testPrice = (pricing.price || 0) + reduction;
                        const testCapRate = (pnl.noi || 0) / testPrice;
                        const testCashFlow = (pnl.noi || 0) - (pricing.annual_debt_service || 0);
                        const color = testCapRate > 0.08 ? COLORS.secondary : testCapRate > 0.06 ? COLORS.warning : COLORS.danger;
                        const isOriginal = reduction === 0;
                        return (
                          <tr key={index} style={{ 
                            borderBottom: '1px solid #F3F4F6',
                            background: isOriginal ? '#FEF3C7' : 'transparent'
                          }}>
                            <td style={{ padding: 12, fontWeight: isOriginal ? 700 : 500 }}>
                              {fmtCurrency(testPrice)}
                              {isOriginal && <span style={{ marginLeft: 8, fontSize: 12, color: '#92400e' }}>(Current)</span>}
                            </td>
                            <td style={{ padding: 12, textAlign: 'center', fontWeight: 900, color }}>
                              {fmtPct(testCapRate)}
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>{fmtNumber(underwriting.dscr)}</td>
                            <td style={{ padding: 12, textAlign: 'center' }}>{fmtCurrency(testCashFlow)}</td>
                            <td style={{ padding: 12, textAlign: 'center', fontWeight: 900 }}>
                              {fmtPct(testCashFlow / testPrice)}
                            </td>
                          </tr>
                        );
                      })}
                      
                      {/* Break-Even Row: Price to Cash Flow $1000/month */}
                      {(() => {
                        const targetMonthlyCashFlow = 1000;
                        const targetAnnualCashFlow = targetMonthlyCashFlow * 12;
                        const noi = pnl.noi || 0;
                        const annualDebtService = pricing.annual_debt_service || 0;
                        
                        // To achieve target cash flow: NOI - Debt Service = Target
                        // Since debt service is based on loan amount which is based on price,
                        // we need to work backwards. For simplicity, we'll assume same loan structure.
                        // Cash Flow = NOI - Debt Service
                        // Target = $12,000/year
                        // We need: Price where (NOI - Debt Service) = $12,000
                        
                        // Current cash flow
                        const currentCashFlow = noi - annualDebtService;
                        const cashFlowShortfall = targetAnnualCashFlow - currentCashFlow;
                        
                        // If we reduce price by X, we reduce debt service proportionally
                        // Simplified: For every $1 reduction in price, cash flow improves by the debt constant
                        // Debt constant = annual debt service / loan amount
                        const loanAmount = pricing.loan_amount || 0;
                        const debtConstant = loanAmount > 0 ? annualDebtService / loanAmount : 0.08; // default 8%
                        
                        // Price reduction needed = shortfall / debt constant (since we're reducing loan amount)
                        const downPaymentPct = pricing.down_payment_pct || 20;
                        const loanToValue = (100 - downPaymentPct) / 100;
                        const priceReductionNeeded = loanToValue > 0 ? cashFlowShortfall / (debtConstant * loanToValue) : 0;
                        
                        const breakEvenPrice = (pricing.price || 0) - priceReductionNeeded;
                        const breakEvenCapRate = noi / breakEvenPrice;
                        const breakEvenCashFlow = targetAnnualCashFlow;
                        const breakEvenROI = breakEvenCashFlow / breakEvenPrice;
                        
                        return (
                          <tr style={{ 
                            borderTop: '3px solid #10b981',
                            background: '#ECFDF5',
                            fontWeight: 900
                          }}>
                            <td style={{ padding: 12 }}>
                              {fmtCurrency(breakEvenPrice)}
                              <div style={{ fontSize: 11, color: '#047857', fontWeight: 900, marginTop: 4 }}>
                                💰 Target: $1,000/mo Cash Flow
                              </div>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center', color: COLORS.secondary }}>
                              {fmtPct(breakEvenCapRate)}
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>{fmtNumber(underwriting.dscr)}</td>
                            <td style={{ padding: 12, textAlign: 'center', color: COLORS.secondary }}>
                              {fmtCurrency(breakEvenCashFlow)}
                            </td>
                            <td style={{ padding: 12, textAlign: 'center', color: COLORS.secondary }}>
                              {fmtPct(breakEvenROI)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                
                {/* Helper Text */}
                <div style={{ marginTop: 16, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#6B7280' }}>
                  <strong>💡 Tip:</strong> The green highlighted row shows the maximum price you should pay to achieve $1,000/month in positive cash flow based on current financing and operating assumptions.
                </div>
              </div>
            )}

            {/* Capital Structure Tab */}
            {resultsTab === 'financing' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Capital Structure</h3>
                    
                    {/* Pie Chart */}
                    {pricing.loan_amount && pricing.price && (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Equity', value: ((pricing.price - pricing.loan_amount) / pricing.price) * 100, fill: COLORS.primary },
                                { name: 'Debt', value: (pricing.loan_amount / pricing.price) * 100, fill: COLORS.info }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
                            >
                              {[COLORS.primary, COLORS.info].map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                          </PieChart>
                        </ResponsiveContainer>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                          <div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>LTV</div>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>
                              {fmtPct((pricing.loan_amount / pricing.price))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>DSCR</div>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>{fmtNumber(underwriting.dscr)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Expense Breakdown</h3>
                    {expenseData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={expenseData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            >
                              {expenseData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => fmtCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Expense Summary Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                          <div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Total Expenses</div>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>
                              {fmtCurrency(expenseData.reduce((sum, item) => sum + item.value, 0))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Per Unit/Month</div>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>
                              {fmtCurrency(expenseData.reduce((sum, item) => sum + item.value, 0) / 12 / (property.units || 1))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>
                        No expense breakdown available
                      </div>
                    )}
                  </div>
                </div>

                {/* PITI Breakdown Section */}
                <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calculator size={20} /> Debt Service & PITI Breakdown
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                    {/* Column 1: Purchase & Loan Info */}
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#6B7280', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Purchase & Financing
                      </h4>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Purchase Price</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.primary }}>
                            {fmtCurrency(pricing.price)}
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Loan Amount</div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {fmtCurrency(pricing.loan_amount)}
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Down Payment</div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {fmtCurrency(pricing.price - pricing.loan_amount)}
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            ({fmtPct((pricing.price - pricing.loan_amount) / pricing.price)})
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Loan Terms */}
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#6B7280', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Loan Terms
                      </h4>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Interest Rate</div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {fmtPct((pricing.interest_rate || 0) / 100)}
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Amortization</div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {pricing.amortization_years || 30} years
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Loan Term</div>
                          <div style={{ fontSize: 20, fontWeight: 900 }}>
                            {pricing.term_years || pricing.amortization_years || 30} years
                          </div>
                        </div>
                        {pricing.balloon_payment && pricing.balloon_payment > 0 && (
                          <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, border: '1px solid #FCD34D' }}>
                            <div style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>Balloon Payment</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#92400e' }}>
                              {fmtCurrency(pricing.balloon_payment)}
                            </div>
                            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                              Due at end of term
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Debt Service & PITI */}
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#6B7280', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Debt Service (PITI)
                      </h4>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
                          <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>Monthly Payment</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#1e40af' }}>
                            {fmtCurrency((pricing.annual_debt_service || 0) / 12)}
                          </div>
                          <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>
                            Principal & Interest
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Annual Debt Service</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.info }}>
                            {fmtCurrency(pricing.annual_debt_service)}
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Property Taxes (Annual)</div>
                          <div style={{ fontSize: 18, fontWeight: 900 }}>
                            {fmtCurrency(parsed?.expenses?.taxes || 0)}
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            {fmtCurrency((parsed?.expenses?.taxes || 0) / 12)}/mo
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#ECFDF5', borderRadius: 8, border: '1px solid #86EFAC' }}>
                          <div style={{ fontSize: 12, color: '#047857', marginBottom: 4 }}>Loan Factor Rate</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#047857' }}>
                            {(() => {
                              const loanFactor = pricing.loan_amount > 0 
                                ? pricing.annual_debt_service / pricing.loan_amount 
                                : 0;
                              return (loanFactor * 100).toFixed(3) + '%';
                            })()}
                          </div>
                          <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                            Annual Debt Service / Loan Amount
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info Row */}
                  <div style={{ 
                    marginTop: 24, 
                    padding: 16, 
                    background: 'linear-gradient(135deg, #F3F4F6, #E5E7EB)', 
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>DEBT SERVICE COVERAGE</div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtNumber(underwriting.dscr)}x</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>ANNUAL CASH FLOW</div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>
                        {fmtCurrency((pnl.noi || 0) - (pricing.annual_debt_service || 0))}
                        {(!pricing.annual_debt_service || pricing.annual_debt_service === 0) && (
                          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8 }}>
                            (No debt modeled)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>MONTHLY CASH FLOW</div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>
                        {fmtCurrency(((pnl.noi || 0) - (pricing.annual_debt_service || 0)) / 12)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>CAP RATE</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: COLORS.secondary }}>
                        {fmtPct((pnl.noi || 0) / (pricing.price || 1))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Returns Tab */}
            {resultsTab === 'returns' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Investment Returns</h3>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>10-Year Cash Flow</div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {fmtCurrency(projections.reduce((sum, year) => sum + year.cashFlow, 0))}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Projected Property Value (Year 10)</div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {fmtCurrency(projections[9]?.propertyValue || 0)}
                      </div>
                    </div>

                    <div style={{ padding: 20, background: COLORS.primary, borderRadius: 8, marginBottom: 20 }}>
                      <div style={{ fontSize: 14, color: 'white', opacity: 0.9, marginBottom: 4 }}>Total Return (10-Year)</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: 'white' }}>
                        {fmtCurrency(projections[9]?.netWorth || 0)}
                      </div>
                    </div>

                    {/* Equity Multiple */}
                    <div style={{ padding: 16, background: '#ECFDF5', borderRadius: 8, border: '1px solid #86EFAC' }}>
                      <div style={{ fontSize: 12, color: '#047857', marginBottom: 4, fontWeight: 900 }}>EQUITY MULTIPLE (10-YEAR)</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#047857' }}>
                        {(() => {
                          const price = pricing.price || 0;
                          const downPayment = pricing.financing_mode === 'traditional'
                            ? price * (pricing.down_payment_pct || 0) / 100
                            : (pricing.down_payment_amount || (price * 0.2));
                          const realtorFees = price * (pricing.realtor_fee_pct || 0) / 100;
                          const closingCosts = price * (pricing.closing_costs_pct || 0) / 100;
                          const acquisitionFees = price * (pricing.acquisition_fee_pct || 0) / 100;
                          const totalCashInvested = downPayment + realtorFees + closingCosts + acquisitionFees;
                          const totalReturn = projections[9]?.netWorth || 0;
                          const multiple = totalCashInvested > 0 ? totalReturn / totalCashInvested : 0;
                          return multiple.toFixed(2) + 'x';
                        })()}
                      </div>
                      <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                        Total Return / Initial Investment
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Return Metrics</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Cap Rate</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.secondary }}>{fmtPct(adjustedCapRate)}</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Cash on Cash (Year 1)</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.info }}>
                          {fmtPct((() => {
                            const cashFlow = (pnl.noi || 0) - (pricing.annual_debt_service || 0);
                            const price = pricing.price || 0;
                            const downPayment = pricing.financing_mode === 'traditional'
                              ? price * (pricing.down_payment_pct || 0) / 100
                              : (pricing.down_payment_amount || (price * 0.2));
                            const realtorFees = price * (pricing.realtor_fee_pct || 0) / 100;
                            const closingCosts = price * (pricing.closing_costs_pct || 0) / 100;
                            const acquisitionFees = price * (pricing.acquisition_fee_pct || 0) / 100;
                            const totalCashInvested = downPayment + realtorFees + closingCosts + acquisitionFees;
                            return totalCashInvested > 0 ? cashFlow / totalCashInvested : 0;
                          })())}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Average Annual Return</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.primary }}>
                          {fmtPct((() => {
                            const price = pricing.price || 0;
                            const downPayment = pricing.financing_mode === 'traditional'
                              ? price * (pricing.down_payment_pct || 0) / 100
                              : (pricing.down_payment_amount || (price * 0.2));
                            const realtorFees = price * (pricing.realtor_fee_pct || 0) / 100;
                            const closingCosts = price * (pricing.closing_costs_pct || 0) / 100;
                            const acquisitionFees = price * (pricing.acquisition_fee_pct || 0) / 100;
                            const totalCashInvested = downPayment + realtorFees + closingCosts + acquisitionFees;
                            const totalReturn = projections[9]?.netWorth || 0;
                            
                            // Approximate IRR using geometric mean
                            const multiple = totalCashInvested > 0 ? totalReturn / totalCashInvested : 0;
                            const years = 10;
                            const annualReturn = Math.pow(multiple, 1/years) - 1;
                            return annualReturn;
                          })())}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>DSCR</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.warning }}>{fmtNumber(underwriting.dscr)}</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Loan Factor Rate</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#047857' }}>
                          {(() => {
                            const loanFactor = pricing.loan_amount > 0 
                              ? pricing.annual_debt_service / pricing.loan_amount 
                              : 0;
                            return (loanFactor * 100).toFixed(3) + '%';
                          })()}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Break-Even Occupancy</span>
                        <span style={{ fontSize: 16, fontWeight: 900 }}>
                          {(() => {
                            const gpr = pnl.gross_potential_rent || 0;
                            const opex = pnl.operating_expenses || 0;
                            const debtService = pricing.annual_debt_service || 0;
                            const breakEven = gpr > 0 ? (opex + debtService) / gpr : 0;
                            return fmtPct(breakEven);
                          })()}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Expense Ratio</span>
                        <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtPct(pnl.expense_ratio)}</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Price Per Unit</span>
                        <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency((pricing.price || 0) / (property.units || 1))}</span>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>Price Per SF</span>
                        <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency((pricing.price || 0) / (property.rba_sqft || 1))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Proforma Tab */}
            {resultsTab === 'proforma' && (() => {
              // Initialize proforma price if not set
              if (proformaPurchasePrice === 0 && pricing.price) {
                setProformaPurchasePrice(pricing.price);
              }
              // Initialize proforma rent if not set
              if (proformaMonthlyRent === 0 && pnl.gross_potential_rent) {
                setProformaMonthlyRent(pnl.gross_potential_rent / 12);
              }
              
              // Calculate proforma metrics based on adjusted price
              const proformaPrice = proformaPurchasePrice || pricing.price || 0;
              const proformaLoanAmount = proformaPrice * (1 - (pricing.down_payment_pct || 20) / 100);
              
              // Calculate proforma rent metrics
              const currentMonthlyRent = (pnl.gross_potential_rent || 0) / 12;
              const proformaMonthlyRentValue = proformaMonthlyRent || currentMonthlyRent;
              const proformaAnnualRent = proformaMonthlyRentValue * 12;
              const proformaRentPerUnit = proformaMonthlyRentValue / (property.units || 1);
              
              // Proforma NOI calculation with adjusted rent
              const rentDifference = proformaAnnualRent - (pnl.gross_potential_rent || 0);
              const proformaNOI = (pnl.noi || 0) + rentDifference;
              const proformaOpex = pnl.operating_expenses || 0;
              const proformaExpenseRatio = proformaAnnualRent > 0 ? proformaOpex / proformaAnnualRent : 0;
              
              // Calculate proforma debt service
              const monthlyRate = (pricing.interest_rate || 0) / 100 / 12;
              const n = (pricing.amortization_years || 30) * 12;
              let proformaMonthlyPayment = 0;
              if (monthlyRate > 0) {
                proformaMonthlyPayment = proformaLoanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
              } else {
                proformaMonthlyPayment = proformaLoanAmount / n;
              }
              const proformaAnnualDebtService = proformaMonthlyPayment * 12;
              
              // Proforma calculations
              const proformaCashFlow = proformaNOI - proformaAnnualDebtService;
              const proformaCapRate = proformaNOI / proformaPrice;
              const proformaDSCR = proformaNOI / proformaAnnualDebtService;
              const proformaPricePerUnit = proformaPrice / (property.units || 1);
              const proformaGRM = proformaPrice / proformaAnnualRent;
              const proformaBreakEven = proformaAnnualRent > 0 ? (proformaOpex + proformaAnnualDebtService) / proformaAnnualRent : 0;
              
              // Total cash invested for proforma
              const proformaDownPayment = proformaPrice * (pricing.down_payment_pct || 20) / 100;
              const proformaRealtorFees = proformaPrice * (pricing.realtor_fee_pct || 0) / 100;
              const proformaClosingCosts = proformaPrice * (pricing.closing_costs_pct || 0) / 100;
              const proformaAcquisitionFees = proformaPrice * (pricing.acquisition_fee_pct || 0) / 100;
              const proformaTotalCashInvested = proformaDownPayment + proformaRealtorFees + proformaClosingCosts + proformaAcquisitionFees;
              const proformaCoCReturn = proformaTotalCashInvested > 0 ? proformaCashFlow / proformaTotalCashInvested : 0;
              
              return (
                <div>
                  {/* Price & Rent Adjustment Section */}
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={20} /> Adjust Proforma Assumptions
                    </h3>
                    
                    {/* Purchase Price Controls */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 12 }}>Purchase Price</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Proforma Purchase Price
                          </label>
                          <input
                            type="number"
                            value={proformaPurchasePrice || pricing.price || 0}
                            onChange={(e) => setProformaPurchasePrice(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 18,
                              fontWeight: 900,
                              border: '2px solid #E5E7EB',
                              borderRadius: 8,
                              outline: 'none'
                            }}
                          />
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            Original: {fmtCurrency(pricing.price)}
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Price Range: {fmtCurrency(proformaPrice)}
                          </label>
                          <input
                            type="range"
                            min={pricing.price * 0.7}
                            max={pricing.price * 1.3}
                            step={10000}
                            value={proformaPurchasePrice || pricing.price || 0}
                            onChange={(e) => setProformaPurchasePrice(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              height: 8,
                              borderRadius: 4,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            <span>{fmtCurrency(pricing.price * 0.7)}</span>
                            <span>{fmtCurrency(pricing.price * 1.3)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Rent Controls */}
                    <div style={{ marginBottom: 16, paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 12 }}>Rental Income</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Proforma Monthly Rent
                          </label>
                          <input
                            type="number"
                            value={proformaMonthlyRent || currentMonthlyRent}
                            onChange={(e) => setProformaMonthlyRent(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 18,
                              fontWeight: 900,
                              border: '2px solid #E5E7EB',
                              borderRadius: 8,
                              outline: 'none'
                            }}
                          />
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            Original: {fmtCurrency(currentMonthlyRent)}
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Rent Range: {fmtCurrency(proformaMonthlyRentValue)}
                          </label>
                          <input
                            type="range"
                            min={currentMonthlyRent * 0.8}
                            max={currentMonthlyRent * 1.3}
                            step={100}
                            value={proformaMonthlyRent || currentMonthlyRent}
                            onChange={(e) => setProformaMonthlyRent(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              height: 8,
                              borderRadius: 4,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            <span>{fmtCurrency(currentMonthlyRent * 0.8)}</span>
                            <span>{fmtCurrency(currentMonthlyRent * 1.3)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Rent Breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Annual Rent</div>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency(proformaAnnualRent)}</div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Rent Per Unit/Mo</div>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency(proformaRentPerUnit)}</div>
                        </div>
                        <div style={{ padding: 12, background: proformaAnnualRent > (pnl.gross_potential_rent || 0) ? '#ECFDF5' : '#FEF2F2', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: proformaAnnualRent > (pnl.gross_potential_rent || 0) ? '#047857' : '#991B1B', marginBottom: 4 }}>
                            Rent Change
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: proformaAnnualRent > (pnl.gross_potential_rent || 0) ? '#047857' : '#991B1B' }}>
                            {proformaAnnualRent > (pnl.gross_potential_rent || 0) ? '+' : ''}{fmtCurrency(rentDifference)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Change Indicators */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                      <div style={{ padding: 12, background: proformaPrice < pricing.price ? '#ECFDF5' : '#FEF3C7', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: proformaPrice < pricing.price ? '#047857' : '#92400e' }}>
                          {proformaPrice < pricing.price ? '✓ ' : '⚠ '}
                          Price {proformaPrice < pricing.price ? 'Decrease' : 'Increase'}: {fmtCurrency(Math.abs(proformaPrice - pricing.price))} 
                          ({fmtPct(Math.abs(proformaPrice - pricing.price) / pricing.price)})
                        </div>
                      </div>
                      <div style={{ padding: 12, background: proformaNOI > (pnl.noi || 0) ? '#ECFDF5' : '#FEF2F2', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: proformaNOI > (pnl.noi || 0) ? '#047857' : '#991B1B' }}>
                          {proformaNOI > (pnl.noi || 0) ? '↑ ' : '↓ '}
                          NOI Impact: {fmtCurrency(Math.abs(proformaNOI - (pnl.noi || 0)))} 
                          ({fmtPct(Math.abs(proformaNOI - (pnl.noi || 0)) / (pnl.noi || 1))})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proforma Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>Cap Rate</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.secondary }}>{fmtPct(proformaCapRate)}</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>DSCR</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.dark }}>{fmtNumber(proformaDSCR)}</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>Cash Flow</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: proformaCashFlow > 0 ? COLORS.secondary : COLORS.danger }}>
                        {fmtCurrency(proformaCashFlow)}
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 900 }}>CoC Return</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.info }}>{fmtPct(proformaCoCReturn)}</div>
                    </div>
                  </div>

                  {/* Detailed Proforma Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20 }}>Proforma Financials</h3>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>Purchase Price</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaPrice)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>Annual Rent</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaAnnualRent)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>Operating Expenses</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaOpex)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>NOI</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaNOI)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>Loan Amount ({100 - (pricing.down_payment_pct || 20)}%)</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaLoanAmount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>Annual Debt Service</span>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaAnnualDebtService)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: '#F9FAFB' }}>
                          <span style={{ fontSize: 14, fontWeight: 900 }}>Annual Cash Flow</span>
                          <span style={{ fontSize: 16, fontWeight: 900, color: proformaCashFlow > 0 ? COLORS.secondary : COLORS.danger }}>
                            {fmtCurrency(proformaCashFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20 }}>Proforma Return Metrics</h3>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Cap Rate</span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.secondary }}>{fmtPct(proformaCapRate)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Cash on Cash</span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.info }}>{fmtPct(proformaCoCReturn)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>DSCR</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtNumber(proformaDSCR)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>GRM</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtNumber(proformaGRM)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Break-Even Occupancy</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtPct(proformaBreakEven)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Expense Ratio</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtPct(proformaExpenseRatio)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Price Per Unit</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency(proformaPricePerUnit)}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#6B7280' }}>Monthly Cash Flow</span>
                            <span style={{ fontSize: 16, fontWeight: 900 }}>{fmtCurrency(proformaCashFlow / 12)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Comparison Tab */}
            {resultsTab === 'comparison' && (() => {
              // Initialize proforma values if not set
              if (proformaPurchasePrice === 0 && pricing.price) {
                setProformaPurchasePrice(pricing.price);
              }
              if (proformaMonthlyRent === 0 && pnl.gross_potential_rent) {
                setProformaMonthlyRent(pnl.gross_potential_rent / 12);
              }
              
              // Calculate proforma metrics with adjusted price AND rent
              const proformaPrice = proformaPurchasePrice || pricing.price || 0;
              const proformaLoanAmount = proformaPrice * (1 - (pricing.down_payment_pct || 20) / 100);
              
              // Proforma rent calculations
              const currentMonthlyRent = (pnl.gross_potential_rent || 0) / 12;
              const proformaMonthlyRentValue = proformaMonthlyRent || currentMonthlyRent;
              const proformaAnnualRent = proformaMonthlyRentValue * 12;
              const currentAnnualRent = pnl.gross_potential_rent || 0;
              
              // Proforma NOI with adjusted rent
              const rentDifference = proformaAnnualRent - currentAnnualRent;
              const proformaNOI = (pnl.noi || 0) + rentDifference;
              const proformaOpex = pnl.operating_expenses || 0;
              const proformaExpenseRatio = proformaAnnualRent > 0 ? proformaOpex / proformaAnnualRent : 0;
              const currentExpenseRatio = currentAnnualRent > 0 ? proformaOpex / currentAnnualRent : 0;
              
              // Proforma debt service
              const monthlyRate = (pricing.interest_rate || 0) / 100 / 12;
              const n = (pricing.amortization_years || 30) * 12;
              let proformaMonthlyPayment = 0;
              if (monthlyRate > 0) {
                proformaMonthlyPayment = proformaLoanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
              } else {
                proformaMonthlyPayment = proformaLoanAmount / n;
              }
              const proformaAnnualDebtService = proformaMonthlyPayment * 12;
              
              // Proforma calculations
              const proformaCashFlow = proformaNOI - proformaAnnualDebtService;
              const proformaCapRate = proformaNOI / proformaPrice;
              const proformaDSCR = proformaNOI / proformaAnnualDebtService;
              const proformaGRM = proformaPrice / proformaAnnualRent;
              const proformaBreakEven = proformaAnnualRent > 0 ? (proformaOpex + proformaAnnualDebtService) / proformaAnnualRent : 0;
              
              // Current metrics
              const currentPrice = pricing.price || 0;
              const currentNOI = pnl.noi || 0;
              const currentCashFlow = currentNOI - (pricing.annual_debt_service || 0);
              const currentCapRate = adjustedCapRate;
              const currentDSCR = underwriting.dscr;
              const currentGRM = currentPrice / currentAnnualRent;
              const currentBreakEven = currentAnnualRent > 0 ? (proformaOpex + (pricing.annual_debt_service || 0)) / currentAnnualRent : 0;
              
              return (
                <div>
                  {/* Price & Rent Adjustment Section */}
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GitCompare size={20} /> Adjust Proforma Assumptions
                    </h3>
                    
                    {/* Purchase Price Controls */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 12 }}>Purchase Price</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Proforma Purchase Price
                          </label>
                          <input
                            type="number"
                            value={proformaPurchasePrice || pricing.price || 0}
                            onChange={(e) => setProformaPurchasePrice(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 18,
                              fontWeight: 900,
                              border: '2px solid #E5E7EB',
                              borderRadius: 8,
                              outline: 'none'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Price Range: {fmtCurrency(proformaPrice)}
                          </label>
                          <input
                            type="range"
                            min={pricing.price * 0.7}
                            max={pricing.price * 1.3}
                            step={10000}
                            value={proformaPurchasePrice || pricing.price || 0}
                            onChange={(e) => setProformaPurchasePrice(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              height: 8,
                              borderRadius: 4,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            <span>{fmtCurrency(pricing.price * 0.7)}</span>
                            <span>{fmtCurrency(pricing.price * 1.3)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Rent Controls */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 12 }}>Rental Income</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'center' }}>
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Proforma Monthly Rent
                          </label>
                          <input
                            type="number"
                            value={proformaMonthlyRent || currentMonthlyRent}
                            onChange={(e) => setProformaMonthlyRent(parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: 12,
                              fontSize: 18,
                              fontWeight: 900,
                              border: '2px solid #E5E7EB',
                              borderRadius: 8,
                              outline: 'none'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, display: 'block' }}>
                            Rent Range: {fmtCurrency(proformaMonthlyRentValue)}
                          </label>
                          <input
                            type="range"
                            min={currentMonthlyRent * 0.8}
                            max={currentMonthlyRent * 1.3}
                            step={100}
                            value={proformaMonthlyRent || currentMonthlyRent}
                            onChange={(e) => setProformaMonthlyRent(parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              height: 8,
                              borderRadius: 4,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            <span>{fmtCurrency(currentMonthlyRent * 0.8)}</span>
                            <span>{fmtCurrency(currentMonthlyRent * 1.3)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 24 }}>Current vs Proforma Analysis</h3>
                    
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                            <th style={{ padding: 16, textAlign: 'left', fontSize: 14, fontWeight: 900, color: '#6B7280' }}>Metric</th>
                            <th style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#6B7280' }}>Current</th>
                            <th style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#6B7280' }}>Proforma</th>
                            <th style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#6B7280' }}>Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Purchase Price */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Purchase Price</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentPrice)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaPrice)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaPrice < currentPrice ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaPrice - currentPrice)} ({fmtPct((proformaPrice - currentPrice) / currentPrice)})
                            </td>
                          </tr>
                          
                          {/* Annual Rent */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Annual Rent</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentAnnualRent)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaAnnualRent)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaAnnualRent > currentAnnualRent ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaAnnualRent - currentAnnualRent)} ({fmtPct((proformaAnnualRent - currentAnnualRent) / currentAnnualRent)})
                            </td>
                          </tr>
                          
                          {/* Monthly Rent */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Monthly Rent</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentMonthlyRent)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaMonthlyRentValue)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaMonthlyRentValue > currentMonthlyRent ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaMonthlyRentValue - currentMonthlyRent)}
                            </td>
                          </tr>
                          
                          {/* NOI */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>NOI</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentNOI)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaNOI)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaNOI > currentNOI ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaNOI - currentNOI)} ({fmtPct((proformaNOI - currentNOI) / currentNOI)})
                            </td>
                          </tr>
                          
                          {/* Cap Rate */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Cap Rate</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(currentCapRate)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(proformaCapRate)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaCapRate > currentCapRate ? COLORS.secondary : COLORS.danger }}>
                              {fmtPct(proformaCapRate - currentCapRate)}
                            </td>
                          </tr>
                          
                          {/* DSCR */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>DSCR</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtNumber(currentDSCR)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtNumber(proformaDSCR)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaDSCR > currentDSCR ? COLORS.secondary : COLORS.danger }}>
                              {fmtNumber(proformaDSCR - currentDSCR)}
                            </td>
                          </tr>
                          
                          {/* GRM */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>GRM</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtNumber(currentGRM)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtNumber(proformaGRM)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaGRM < currentGRM ? COLORS.secondary : COLORS.danger }}>
                              {fmtNumber(proformaGRM - currentGRM)}
                            </td>
                          </tr>
                          
                          {/* Break-Even Occupancy */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Break-Even Occupancy</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(currentBreakEven)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(proformaBreakEven)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaBreakEven < currentBreakEven ? COLORS.secondary : COLORS.danger }}>
                              {fmtPct(proformaBreakEven - currentBreakEven)}
                            </td>
                          </tr>
                          
                          {/* Expense Ratio */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Expense Ratio</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(currentExpenseRatio)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtPct(proformaExpenseRatio)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaExpenseRatio < currentExpenseRatio ? COLORS.secondary : COLORS.danger }}>
                              {fmtPct(proformaExpenseRatio - currentExpenseRatio)}
                            </td>
                          </tr>
                          
                          {/* Annual Cash Flow */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Annual Cash Flow</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentCashFlow)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaCashFlow)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaCashFlow > currentCashFlow ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaCashFlow - currentCashFlow)}
                            </td>
                          </tr>
                          
                          {/* Monthly Cash Flow */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Monthly Cash Flow</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(currentCashFlow / 12)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaCashFlow / 12)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaCashFlow > currentCashFlow ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency((proformaCashFlow - currentCashFlow) / 12)}
                            </td>
                          </tr>
                          
                          {/* Debt Service */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Annual Debt Service</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pricing.annual_debt_service)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaAnnualDebtService)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900, color: proformaAnnualDebtService < pricing.annual_debt_service ? COLORS.secondary : COLORS.danger }}>
                              {fmtCurrency(proformaAnnualDebtService - pricing.annual_debt_service)}
                            </td>
                          </tr>
                          
                          {/* Loan Amount */}
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: 16, fontSize: 14, fontWeight: 900 }}>Loan Amount</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(pricing.loan_amount)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>{fmtCurrency(proformaLoanAmount)}</td>
                            <td style={{ padding: 16, textAlign: 'right', fontSize: 14, fontWeight: 900 }}>
                              {fmtCurrency(proformaLoanAmount - pricing.loan_amount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24 }}>
                      <div style={{ padding: 16, background: proformaCashFlow > currentCashFlow ? '#ECFDF5' : '#FEF2F2', borderRadius: 8, border: `1px solid ${proformaCashFlow > currentCashFlow ? '#86EFAC' : '#FECACA'}` }}>
                        <div style={{ fontSize: 12, color: proformaCashFlow > currentCashFlow ? '#047857' : '#991B1B', marginBottom: 4, fontWeight: 900 }}>
                          CASH FLOW IMPACT
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: proformaCashFlow > currentCashFlow ? '#047857' : '#991B1B' }}>
                          {proformaCashFlow > currentCashFlow ? '↑' : '↓'} {fmtCurrency(Math.abs(proformaCashFlow - currentCashFlow))}
                        </div>
                      </div>
                      
                      <div style={{ padding: 16, background: proformaCapRate > currentCapRate ? '#ECFDF5' : '#FEF2F2', borderRadius: 8, border: `1px solid ${proformaCapRate > currentCapRate ? '#86EFAC' : '#FECACA'}` }}>
                        <div style={{ fontSize: 12, color: proformaCapRate > currentCapRate ? '#047857' : '#991B1B', marginBottom: 4, fontWeight: 900 }}>
                          CAP RATE IMPACT
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: proformaCapRate > currentCapRate ? '#047857' : '#991B1B' }}>
                          {proformaCapRate > currentCapRate ? '↑' : '↓'} {fmtPct(Math.abs(proformaCapRate - currentCapRate))}
                        </div>
                      </div>
                      
                      <div style={{ padding: 16, background: proformaNOI > currentNOI ? '#ECFDF5' : '#FEF2F2', borderRadius: 8, border: `1px solid ${proformaNOI > currentNOI ? '#86EFAC' : '#FECACA'}` }}>
                        <div style={{ fontSize: 12, color: proformaNOI > currentNOI ? '#047857' : '#991B1B', marginBottom: 4, fontWeight: 900 }}>
                          NOI IMPACT
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: proformaNOI > currentNOI ? '#047857' : '#991B1B' }}>
                          {proformaNOI > currentNOI ? '↑' : '↓'} {fmtCurrency(Math.abs(proformaNOI - currentNOI))}
                        </div>
                      </div>
                      
                      <div style={{ padding: 16, background: proformaPrice < currentPrice ? '#ECFDF5' : '#FEF3C7', borderRadius: 8, border: `1px solid ${proformaPrice < currentPrice ? '#86EFAC' : '#FCD34D'}` }}>
                        <div style={{ fontSize: 12, color: proformaPrice < currentPrice ? '#047857' : '#92400e', marginBottom: 4, fontWeight: 900 }}>
                          PRICE SAVINGS
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: proformaPrice < currentPrice ? '#047857' : '#92400e' }}>
                          {proformaPrice < currentPrice ? '✓ ' : '⚠ '}{fmtCurrency(Math.abs(currentPrice - proformaPrice))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Acquisition Costs Tab */}
            {resultsTab === 'acquisition' && (() => {
              const sqft = property.total_sqft || 20000;
              const units = property.units || 1;
              
              // Acquisition cost items
              const acquisitionItems = [
                { description: 'Purchase Price', perUnit: pricing.price / units, amount: pricing.price, perSF: pricing.price / sqft, editable: false },
                { description: 'Acquisition Fee', pct: 1.0, amount: pricing.price * 0.01, perSF: (pricing.price * 0.01) / sqft, editable: true },
                { description: 'Broker Fee', pct: 0, amount: 0, perSF: 0, editable: true },
                { description: '', amount: null, isBlank: true },
                { description: 'Acquisition Legal', perUnit: 5000, amount: 5000, perSF: 5000 / sqft, editable: true },
                { description: 'Title & Escrow / Closing Fees', perUnit: 3500, amount: 3500, perSF: 3500 / sqft, editable: true },
                { description: 'ALTA Survey', perUnit: 4000, amount: 4000, perSF: 4000 / sqft, editable: true },
                { description: 'Environmental Report', perUnit: 3000, amount: 3000, perSF: 3000 / sqft, editable: true },
                { description: 'Geotechnical Report', perUnit: 7500, amount: 7500, perSF: 7500 / sqft, editable: true },
                { description: 'Appraisal', perUnit: 3000, amount: 3000, perSF: 3000 / sqft, editable: true },
                { description: '', amount: null, isBlank: true },
                { description: '', amount: null, isBlank: true },
                { description: '', amount: null, isBlank: true },
              ];
              
              const totalCosts = acquisitionItems.reduce((sum, item) => sum + (item.amount || 0), 0);
              
              return (
                <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 24, color: '#111827', letterSpacing: '-0.02em' }}>
                    Acquisition Costs
                  </h3>
                  
                  {/* Spreadsheet-style table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 900, color: '#374151', width: '30%' }}>Description</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#374151' }}>/ Unit</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#374151' }}>Unit(s)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#2563EB', background: '#EFF6FF' }}>Total</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#374151' }}>/ SF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acquisitionItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB', background: item.isBlank ? '#FAFAFA' : 'white' }}>
                            <td style={{ padding: '10px 16px', color: item.description ? '#111827' : '#9CA3AF', fontWeight: item.description === 'Purchase Price' ? 600 : 400 }}>
                              {item.description || ''}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6B7280' }}>
                              {item.perUnit ? fmtCurrency(item.perUnit) : item.pct !== undefined ? `${item.pct} %` : '-'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6B7280' }}>
                              {item.isBlank ? '' : item.pct !== undefined ? '% Price' : 'Amount'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 900, color: '#2563EB', background: '#F8FAFF' }}>
                              {item.amount != null ? fmtCurrency(item.amount) : '-'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6B7280' }}>
                              {item.perSF ? item.perSF.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Total Row */}
                        <tr style={{ background: '#F0F9FF', borderTop: '2px solid #2563EB' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 900, color: '#111827', fontSize: 15 }}>
                            Total Acquisition Costs
                          </td>
                          <td style={{ padding: '14px 16px' }}></td>
                          <td style={{ padding: '14px 16px' }}></td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: '#2563EB', fontSize: 16 }}>
                            {fmtCurrency(totalCosts)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: '#374151' }}>
                            {(totalCosts / sqft).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
                    <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>TOTAL ACQUISITION</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#111827' }}>{fmtCurrency(totalCosts)}</div>
                    </div>
                    <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>COST PER UNIT</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#111827' }}>{fmtCurrency(totalCosts / units)}</div>
                    </div>
                    <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: 900 }}>COST PER SF</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#111827' }}>${(totalCosts / sqft).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Upgrade Modal - Removed */}
        {false && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 12 }}>
                  60-Page Limit Reached
                </h2>
                <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.6 }}>
                  You've processed 60 pages this month. Purchase 60 more pages to continue analyzing deals.
                </p>
              </div>

              <div style={{ 
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                border: '2px solid #0ea5e9',
                borderRadius: 12,
                padding: 24,
                marginBottom: 24,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, color: '#0369a1', fontWeight: 900, marginBottom: 8 }}>
                  60 PAGE PACK
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#0369a1' }}>
                  $29
                </div>
                <div style={{ fontSize: 14, color: '#0369a1', marginTop: 4 }}>
                  One-time purchase • No subscription
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => {
                    alert('Purchase feature disabled - no authentication required');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 16,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  Buy 60 Pages - $29
                </button>
              </div>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '10px',
                  background: 'transparent',
                  color: '#6b7280',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default EnhancedUploadPage;
