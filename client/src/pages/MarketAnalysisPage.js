// src/MarketAnalysisPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import Papa from 'papaparse';
import { Search, Home, ArrowLeft, MapPin, Building, Building2, Users, TrendingUp, Download, Sparkles, Loader, AlertCircle, DollarSign, Calculator } from 'lucide-react';
import { MetricCard, SectionCard } from '../components/AdvancedViews';

/* ---- one-time spinner keyframes ---- */
if (typeof document !== 'undefined') {
  const existingStyle = document.querySelector('style[data-spinner]');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.setAttribute('data-spinner', 'true');
    style.textContent = `
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }
}

/* ---------------- PDF Export Function ---------------- */
const exportToPDF = async () => {
  // Check if libraries are available
  if (typeof window === 'undefined') return;
  
  // Load html2canvas and jsPDF from CDN if not already loaded
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  try {
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdf-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px 48px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 16px;
    `;
    loadingDiv.innerHTML = `
      <div style="width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top: 3px solid #06b6d4; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div style="color: #333; font-size: 16px; font-weight: 600;">Generating PDF...</div>
    `;
    document.body.appendChild(loadingDiv);

    // Load required libraries
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    // Wait for libraries to be available
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the main content div (entire page)
    const element = document.getElementById('market-analysis-content') || document.body;
    
    // Configure html2canvas options
    const canvas = await window.html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: -window.scrollY
    });

    // Initialize jsPDF
    const { jsPDF } = window.jspdf;
    
    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Create PDF with proper dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Get location name for filename
    const locationElement = document.querySelector('[data-location]');
    const locationName = locationElement ? locationElement.textContent : 'market_analysis';
    const fileName = `${locationName.replace(/[^a-z0-9]/gi, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`;

    // Save the PDF
    pdf.save(fileName);

    // Remove loading indicator
    document.body.removeChild(loadingDiv);

  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Remove loading indicator if it exists
    const loadingDiv = document.getElementById('pdf-loading');
    if (loadingDiv) document.body.removeChild(loadingDiv);
    
    alert('Failed to generate PDF. Please try again or use your browser\'s print function (Ctrl+P / Cmd+P) and save as PDF.');
  }
};

/* ---------------- helpers ---------------- */
const fmt = (n) => (n || n === 0 ? Number(n).toLocaleString('en-US') : 'N/A');
const formatCurrency = (num) => {
  const n = Number(num);
  if (isNaN(n) || n === 0) return '$0';
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:0, maximumFractionDigits:0 }).format(n);
};
const formatPercent = (num, digits = 1) =>
  num !== null && num !== undefined && !isNaN(num) ? `${Number(num).toFixed(digits)}%` : 'N/A';

const cleanValue = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const num = Number(String(v).replace(/[, %$]/g, ''));
  return isNaN(num) ? null : num;
};
const zeroZip = (z) => {
  if (z === null || z === undefined) return null;
  const s = String(Math.trunc(Number(z) || Number(String(z).replace(/\D/g, '')) || 0));
  return s.padStart(5, '0');
};
const absUrl = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const base = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
  return `${base}${p.startsWith('/') ? p : '/' + p}`;
};
const loadCSV = async (url) => {
  const u = absUrl(url);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${u}: ${res.status}`);
  const text = await res.text();
  return Papa.parse(text, { header: true, dynamicTyping: false, skipEmptyLines: true }).data;
};

// Special loader for building permits (tab-delimited with 2 header rows)
const loadPermitsCSV = async (url) => {
  const u = absUrl(url);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${u}: ${res.status}`);
  const text = await res.text();
  
  // Split into lines and use line 2 (index 1) as headers  
  const lines = text.split('\n');
  const headers = lines[1]; // "Date,State,County,Code,Code,Name,Bldgs,Units,Value..."
  const dataLines = lines.slice(3); // Skip header rows and blank line
  const permitCSV = headers + '\n' + dataLines.join('\n');
  
  const parsed = Papa.parse(permitCSV, { 
    header: true, 
    skipEmptyLines: true, 
    dynamicTyping: true
  });
  
  return parsed.data;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* -------- responsive width hook -------- */
function useContainerWidth(min = 620) {
  const ref = useRef(null);
  const [w, setW] = useState(min);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr?.width) setW(Math.max(min, cr.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w];
}

/* ---------------- Investment Algorithm ---------------- */
function calculateInvestmentScore(data) {
  // Initialize with default values to prevent errors
  const scores = {
    renterDemand: 0,
    cashFlow: 0,
    appreciation: 0,
    marketStability: 0,
    regulatory: 0
  };
  
  const weights = {
    renterDemand: 0.30,
    cashFlow: 0.25,
    appreciation: 0.20,
    marketStability: 0.15,
    regulatory: 0.10
  };
  
  let dataPoints = 0;
  let maxPoints = 0;
  
  // 1. RENTER DEMAND SCORE (30%)
  const renterPct = cleanValue(data.pct_renter);
  if (renterPct != null && !isNaN(renterPct)) {
    maxPoints += 40;
    if (renterPct >= 40) { scores.renterDemand += 40; dataPoints++; }
    else if (renterPct >= 30) { scores.renterDemand += 30; dataPoints++; }
    else if (renterPct >= 20) { scores.renterDemand += 20; dataPoints++; }
    else { scores.renterDemand += 5; dataPoints++; }
  }
  
  const vacancy = cleanValue(data.vacancyRate);
  if (vacancy != null && !isNaN(vacancy)) {
    maxPoints += 30;
    if (vacancy >= 3 && vacancy <= 7) { scores.renterDemand += 30; dataPoints++; }
    else if (vacancy > 7 && vacancy <= 10) { scores.renterDemand += 20; dataPoints++; }
    else if (vacancy < 3) { scores.renterDemand += 15; dataPoints++; }
    else { scores.renterDemand += 5; dataPoints++; }
  }
  
  const popGrowth = cleanValue(data.population_change_pct_17_23);
  if (popGrowth != null && !isNaN(popGrowth)) {
    maxPoints += 30;
    if (popGrowth >= 10) { scores.renterDemand += 30; dataPoints++; }
    else if (popGrowth >= 5) { scores.renterDemand += 20; dataPoints++; }
    else if (popGrowth >= 0) { scores.renterDemand += 10; dataPoints++; }
    else { scores.renterDemand += 0; dataPoints++; }
  }
  
  // 2. CASH FLOW SCORE (25%)
  const medianRent = cleanValue(data.medianGrossRent);
  const income = cleanValue(data.medianHouseholdIncome);
  if (medianRent && income && income > 0) {
    const rentToIncome = (medianRent * 12) / income;
    maxPoints += 40;
    if (rentToIncome >= 0.25 && rentToIncome <= 0.35) { scores.cashFlow += 40; dataPoints++; }
    else if (rentToIncome > 0.20 && rentToIncome < 0.40) { scores.cashFlow += 30; dataPoints++; }
    else if (rentToIncome <= 0.20) { scores.cashFlow += 10; dataPoints++; }
    else { scores.cashFlow += 5; dataPoints++; }
  }
  
  const employment = cleanValue(data.employmentRate);
  if (employment != null && !isNaN(employment)) {
    maxPoints += 30;
    if (employment >= 60) { scores.cashFlow += 30; dataPoints++; }
    else if (employment >= 50) { scores.cashFlow += 20; dataPoints++; }
    else if (employment >= 40) { scores.cashFlow += 10; dataPoints++; }
    else { scores.cashFlow += 5; dataPoints++; }
  }
  
  const fmr2br = cleanValue(data.fmr_2br);
  if (medianRent && fmr2br && fmr2br > 0) {
    const rentGap = (medianRent - fmr2br) / fmr2br;
    maxPoints += 30;
    if (rentGap >= -0.1 && rentGap <= 0.1) { scores.cashFlow += 30; dataPoints++; }
    else if (rentGap > 0.1) { scores.cashFlow += 20; dataPoints++; }
    else { scores.cashFlow += 10; dataPoints++; }
  }
  
  // 3. APPRECIATION SCORE (20%)
  const zhvi5y = cleanValue(data.zhvi_5y_growth_pct);
  if (zhvi5y != null && !isNaN(zhvi5y)) {
    maxPoints += 40;
    if (zhvi5y >= 40) { scores.appreciation += 40; dataPoints++; }
    else if (zhvi5y >= 25) { scores.appreciation += 30; dataPoints++; }
    else if (zhvi5y >= 10) { scores.appreciation += 20; dataPoints++; }
    else if (zhvi5y >= 0) { scores.appreciation += 10; dataPoints++; }
    else { scores.appreciation += 0; dataPoints++; }
  }
  
  if (income != null && !isNaN(income)) {
    maxPoints += 30;
    if (income >= 75000) { scores.appreciation += 30; dataPoints++; }
    else if (income >= 60000) { scores.appreciation += 20; dataPoints++; }
    else if (income >= 45000) { scores.appreciation += 15; dataPoints++; }
    else { scores.appreciation += 10; dataPoints++; }
  }
  
  // 4. MARKET STABILITY SCORE (15%)
  const density = cleanValue(data.density_sqmi);
  if (density != null && !isNaN(density)) {
    maxPoints += 40;
    if (density >= 1000 && density <= 8000) { scores.marketStability += 40; dataPoints++; }
    else if (density >= 500 && density < 1000) { scores.marketStability += 30; dataPoints++; }
    else if (density > 8000) { scores.marketStability += 20; dataPoints++; }
    else { scores.marketStability += 10; dataPoints++; }
  }
  
  const totalUnits = cleanValue(data.total_units) || cleanValue(data.totalHousingUnits);
  if (totalUnits != null && !isNaN(totalUnits)) {
    maxPoints += 30;
    if (totalUnits >= 5000) { scores.marketStability += 30; dataPoints++; }
    else if (totalUnits >= 2000) { scores.marketStability += 20; dataPoints++; }
    else if (totalUnits >= 500) { scores.marketStability += 10; dataPoints++; }
    else { scores.marketStability += 5; dataPoints++; }
  }
  
  // 5. REGULATORY SCORE (10%) - Use defaults if missing
  const landlordScore = cleanValue(data.landlord_friendly_score);
  if (landlordScore != null && !isNaN(landlordScore)) {
    const normalizedScore = landlordScore > 1 ? landlordScore / 5 : landlordScore;
    scores.regulatory = normalizedScore * 100;
    dataPoints++;
  } else {
    scores.regulatory = 50; // Default to neutral if no data
  }
  
  // Calculate weighted total
  let totalScore = 0;
  for (const [category, score] of Object.entries(scores)) {
    totalScore += (score / 100) * weights[category] * 100;
  }
  
  // Determine recommendation
  let recommendation = '';
  let confidence = '';
  let reasons = [];
  
  if (totalScore >= 75) {
    recommendation = 'STRONG BUY';
    confidence = 'High';
  } else if (totalScore >= 60) {
    recommendation = 'BUY';
    confidence = 'Moderate-High';
  } else if (totalScore >= 45) {
    recommendation = 'HOLD/RESEARCH';
    confidence = 'Moderate';
  } else if (totalScore >= 30) {
    recommendation = 'CAUTION';
    confidence = 'Low-Moderate';
  } else {
    recommendation = 'AVOID';
    confidence = 'Low';
  }
  
  // Generate specific reasons
  if (renterPct != null) {
    if (renterPct < 25) reasons.push(`Low renter demand (${renterPct.toFixed(1)}%)`);
    if (renterPct >= 40) reasons.push(`Strong renter base (${renterPct.toFixed(1)}%)`);
  }
  if (popGrowth != null) {
    if (popGrowth >= 10) reasons.push(`Excellent population growth (${popGrowth.toFixed(1)}%)`);
    if (popGrowth < 0) reasons.push(`Declining population (${popGrowth.toFixed(1)}%)`);
  }
  if (vacancy != null) {
    if (vacancy >= 3 && vacancy <= 7) reasons.push(`Healthy vacancy rate (${vacancy.toFixed(1)}%)`);
    if (vacancy > 10) reasons.push(`High vacancy risk (${vacancy.toFixed(1)}%)`);
  }
  if (zhvi5y != null && zhvi5y >= 25) {
    reasons.push(`Strong appreciation history (${zhvi5y.toFixed(1)}% over 5 years)`);
  }
  if (employment != null && employment >= 60) {
    reasons.push(`Strong employment (${employment.toFixed(1)}%)`);
  }
  
  // Always return a valid object
  return {
    totalScore: Math.round(totalScore),
    recommendation: recommendation || 'HOLD/RESEARCH',
    confidence: confidence || 'Moderate',
    reasons: reasons.length > 0 ? reasons : ['Limited data available for comprehensive analysis'],
    breakdown: scores,
    dataPoints: dataPoints
  };
}
function norm01(v, lo, hi) {
  if (v == null || isNaN(v) || lo == null || hi == null || lo === hi) return 0;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

function bandScore(v, idealLo, idealHi, hardLo, hardHi) {
  // 1.0 inside [idealLo, idealHi]; linearly taper to 0.0 at [hardLo, hardHi] bounds
  if (v == null || isNaN(v)) return 0;
  if (v >= idealLo && v <= idealHi) return 1;
  if (v < idealLo) return Math.max(0, (v - hardLo) / (idealLo - hardLo));
  // v > idealHi
  return Math.max(0, (hardHi - v) / (hardHi - idealHi));
}

function computeRangesAll(rows) {
  const acc = {
    popGrowth: [], employmentRate: [], income: [], homeValueGrowth: [],
    rentBurden: [], vacancy: [], density: [], listingsPerK: [], fmrGap: [], renterPct: []
  };
  for (const r of rows) {
    const p17 = cleanValue(r.population_2017);
    const p23 = cleanValue(r.population_2023 ?? r.population);
    if (p17 && p23) acc.popGrowth.push(((p23 - p17) / p17) * 100);
    const emp = cleanValue(r.employmentRate); if (emp != null) acc.employmentRate.push(emp);
    const inc = cleanValue(r.medianHouseholdIncome); if (inc != null) acc.income.push(inc);
    const zhvi5 = cleanValue(r.zhvi_5y_growth_pct); const zhvi1 = cleanValue(r.zhvi_1y_growth_pct);
    const hvg = zhvi5 != null ? zhvi5 : zhvi1; if (hvg != null) acc.homeValueGrowth.push(hvg);
    const rent = cleanValue(r.medianGrossRent); if (rent && inc) acc.rentBurden.push((rent * 12) / inc);
    const vac = cleanValue(r.vacancyRate); if (vac != null) acc.vacancy.push(vac);
    const dens = cleanValue(r.density_sqmi); if (dens != null) acc.density.push(dens);
    const units = cleanValue(r.total_units ?? r.totalHousingUnits);
    const listings = Number(r._totalListings || 0);
    if (units) acc.listingsPerK.push((listings / units) * 1000);
    const fmr2 = cleanValue(r.fmr_2br);
    const live2 = Number(r._avgLive2br || NaN);
    if (fmr2 && live2) acc.fmrGap.push((live2 - fmr2) / fmr2);
    const pctR = cleanValue(r.pct_renter); if (pctR != null) acc.renterPct.push(pctR);
  }
  const range = a => a.length ? [Math.min(...a), Math.max(...a)] : [null, null];
  return {
    popGrowth: range(acc.popGrowth),
    employmentRate: range(acc.employmentRate),
    income: range(acc.income),
    homeValueGrowth: range(acc.homeValueGrowth),
    rentBurden: range(acc.rentBurden),
    vacancy: range(acc.vacancy),
    density: range(acc.density),
    listingsPerK: range(acc.listingsPerK),
    fmrGap: range(acc.fmrGap),
    renterPct: range(acc.renterPct),
  };
}

function scoreMarket(row, ranges) {
  // Core metrics
  const p17 = cleanValue(row.population_2017);
  const p23 = cleanValue(row.population_2023 ?? row.population);
  const popG = (p17 && p23) ? ((p23 - p17) / p17) * 100 : null;
  const emp = cleanValue(row.employmentRate);
  const inc = cleanValue(row.medianHouseholdIncome);
  const zhvi5 = cleanValue(row.zhvi_5y_growth_pct);
  const zhvi1 = cleanValue(row.zhvi_1y_growth_pct);
  const hvg = zhvi5 != null ? zhvi5 : zhvi1;

  // Affordability / demand
  const rent = cleanValue(row.medianGrossRent);
  const rentBurden = (rent && inc) ? (rent * 12) / inc : null; // want ~25–33%
  const vac = cleanValue(row.vacancyRate); // want ~5–7%
  const dens = cleanValue(row.density_sqmi);
  const units = cleanValue(row.total_units ?? row.totalHousingUnits);
  const listings = Number(row._totalListings || 0);
  const listingsPerK = (units && listings) ? (listings / units) * 1000 : null;

  // FMR alignment
  const fmr2 = cleanValue(row.fmr_2br);
  const live2 = Number(row._avgLive2br || NaN);
  const fmrGap = (fmr2 && live2) ? (live2 - fmr2) / fmr2 : null; // <=0 is better (undervalued vs FMR)

  // Tenure mix
  const pctR = cleanValue(row.pct_renter); // want 45–65%

  // Normalize
  const sPop  = norm01(popG, ranges.popGrowth[0], ranges.popGrowth[1]);
  const sJob  = norm01(emp,   ranges.employmentRate[0], ranges.employmentRate[1]);
  const sInc  = norm01(inc,   ranges.income[0], ranges.income[1]);
  const sHvg  = norm01(hvg,   ranges.homeValueGrowth[0], ranges.homeValueGrowth[1]);

  const sBurden = bandScore(rentBurden, 0.25, 0.33, 0.15, 0.45);
  const sVac    = bandScore(vac, 0.05, 0.07, 0.02, 0.12);
  const sDense  = bandScore(dens, 1000, 6000, 200, 15000); // flexible, tweak
  const sList   = (listingsPerK == null) ? 0.5 : bandScore(listingsPerK, 2, 6, 0, 12); // mid supply best
  const sFmr    = (fmrGap == null) ? 0.5 : bandScore(fmrGap, -0.08, 0.02, -0.20, 0.12); // undervalued or near parity
  const sTenure = (pctR == null) ? 0.5 : bandScore(pctR, 45, 65, 25, 80);

  // Landlord-friendly (0..1)
  let lf = row.landlord_friendly_score != null ? Number(row.landlord_friendly_score) : null;
  if (lf != null) lf = lf > 1 ? lf / 100 : lf;
  const sLF = lf == null ? 0.5 : Math.max(0, Math.min(1, lf));

  // Optional crime (plug a real 0..1 input when you have it)
  const sCrime = 0.5;

  const W = {
    pop: 0.16, job: 0.14, inc: 0.10, hvg: 0.10,     // growth/level
    burden: 0.12, vac: 0.10, fmr: 0.08,             // demand/affordability
    density: 0.06, listings: 0.06, tenure: 0.04,    // structure/supply
    ll: 0.02, safety: 0.02
  };

  let raw =
    W.pop*sPop + W.job*sJob + W.inc*sInc + W.hvg*sHvg +
    W.burden*sBurden + W.vac*sVac + W.fmr*sFmr +
    W.density*sDense + W.listings*sList + W.tenure*sTenure +
    W.ll*sLF + W.safety*(1 - sCrime);

  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

/* ---------------- charts ---------------- */
const BarChart = ({ data, dataKey, title, color = '#06b6d4', width = 700, height = 320, slim = true }) => {
  const entries = Object.entries(data.liveRentStats || {}).filter(([, v]) => (v[dataKey] || 0) > 0);
  
  if (entries.length === 0) return (
    <div style={{ 
      background: '#ffffff', 
      border: '2px dashed #e5e7eb', 
      borderRadius: 16, 
      padding: 32, 
      textAlign: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,.06)'
    }}>
      <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>
        📊 No rent data available
      </div>
    </div>
  );
  
  const maxValue = Math.max(...entries.map(([, v]) => v[dataKey]));
  const gap = 20;
  const pad = 60;
  const barsArea = Math.max(0, width - pad * 2);
  const barWidth = Math.max(50, Math.min(80, (barsArea / entries.length) - gap));
  
  // Mashvisor-style color palette
  const colors = ['#0ea5e9', '#0891b2', '#0e7490', '#155e75', '#164e63', '#083344', '#0c4a6e'];

  return (
    <div style={{ 
      background: '#ffffff', 
      border: '1px solid #e5e7eb', 
      borderRadius: 16, 
      padding: 24, 
      boxShadow: '0 2px 4px rgba(0,0,0,.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: 600, 
          color: '#0f172a', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
          margin: 0
        }}>
          <div style={{
            background: '#0ea5e9',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem'
          }}>
            📊
          </div>
          {title}
        </h3>
        <div style={{
          background: '#fef3c7',
          color: '#92400e',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          📈 Live Data
        </div>
      </div>
      
      <div style={{ overflowX:'auto' }}>
        <svg width={width} height={height + 60} style={{ minWidth:'100%' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = height * (1 - ratio);
            return (
              <g key={idx}>
                <line 
                  x1={pad} 
                  y1={y} 
                  x2={width - pad} 
                  y2={y} 
                  stroke="#f1f5f9" 
                  strokeWidth="1.5"
                />
                <text 
                  x={pad - 10} 
                  y={y + 4} 
                  fill="#64748b" 
                  fontSize="12" 
                  textAnchor="end"
                  fontWeight="500"
                >
                  {formatCurrency(maxValue * ratio)}
                </text>
              </g>
            );
          })}
          
          {/* Bars */}
          {entries.map(([bed, val], i) => {
            const value = val[dataKey] || 0;
            const barHeight = maxValue > 0 ? (value / maxValue) * height : 0;
            const x = pad + i * (barWidth + gap);
            const bedLabel = String(bed).toLowerCase() === '0' || String(bed).toLowerCase() === 'studio' ? 'Studio' : `${bed} BD`;
            const barColor = colors[i % colors.length];
            
            return (
              <g key={i}>
                {/* Main bar with rounded top */}
                <rect 
                  x={x} 
                  y={height - barHeight} 
                  width={barWidth} 
                  height={barHeight} 
                  fill={barColor} 
                  rx="6"
                  ry="6"
                />
                
                {/* Value label on top */}
                <text 
                  x={x + barWidth / 2} 
                  y={height - barHeight - 8} 
                  textAnchor="middle" 
                  fill="#0f172a" 
                  fontSize="14" 
                  fontWeight="700"
                >
                  {formatCurrency(value)}
                </text>
                
                {/* Category label below */}
                <text 
                  x={x + barWidth / 2} 
                  y={height + 20} 
                  textAnchor="middle" 
                  fill="#64748b" 
                  fontSize="13" 
                  fontWeight="500"
                >
                  {bedLabel}
                </text>
                
                {/* Listing count */}
                <text 
                  x={x + barWidth / 2} 
                  y={height + 38} 
                  textAnchor="middle" 
                  fill="#94a3b8" 
                  fontSize="11" 
                  fontWeight="500"
                >
                  {val.count || 0} {val.count === 1 ? 'listing' : 'listings'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const DonutChart = ({ data, title, width = 360, height = 360, totalListings }) => {
  const entries = Object.entries(data.liveRentStats || {}).filter(([, v]) => v.count > 0);
  if (entries.length === 0) return (
    <div style={{ color:'#9ca3af', background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24 }}>
      No rent data available
    </div>
  );

  const total = entries.reduce((sum, [, v]) => sum + v.count, 0);
  const centerX = width / 2, centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 20;
  const innerRadius = outerRadius * 0.6;
  let currentAngle = -90;
  const colors = ['#06b6d4','#10b981','#f59e0b','#0ea5e9','#ef4444','#f97316','#14b8a6','#3b82f6'];

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#333', marginBottom:24, display:'flex', alignItems:'center', gap:8 }}>
        <Building size={20} style={{ color:'#06b6d4' }} /> {title}
      </h3>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width={width} height={height}>
          <defs>
            {colors.map((c, i) => (
              <linearGradient key={i} id={`donut-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: c, stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: c, stopOpacity: 0.7 }} />
              </linearGradient>
            ))}
          </defs>
          {entries.map(([bed, val], i) => {
            const pct = val.count / total;
            const angle = pct * 360;
            const start = currentAngle * Math.PI / 180;
            const end = (currentAngle + angle) * Math.PI / 180;
            const x1 = centerX + outerRadius * Math.cos(start);
            const y1 = centerY + outerRadius * Math.sin(start);
            const x2 = centerX + outerRadius * Math.cos(end);
            const y2 = centerY + outerRadius * Math.sin(end);
            const x3 = centerX + innerRadius * Math.cos(end);
            const y3 = centerY + innerRadius * Math.sin(end);
            const x4 = centerX + innerRadius * Math.cos(start);
            const y4 = centerY + innerRadius * Math.sin(start);
            const large = angle > 180 ? 1 : 0;
            const path = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${x4} ${y4} Z`;
            currentAngle += angle;
            return <path key={i} d={path} fill={`url(#donut-${i})`} style={{ filter:'drop-shadow(0 4px 6px rgba(0,0,0,0.08))' }} />;
          })}
          <text x={centerX} y={centerY - 5} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="800">
            {totalListings}
          </text>
          <text x={centerX} y={centerY + 15} textAnchor="middle" fill="#64748b" fontSize="13">
            Total Listings
          </text>
        </svg>
      </div>
    </div>
  );
};

const LineChart = ({ points, title, width = 700, height = 280 }) => {
  const valid = points.filter(p => p.y != null && !isNaN(p.y));
  if (valid.length < 2) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
        border: '2px dashed #cbd5e1', 
        borderRadius: 24, 
        padding: 32, 
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 500 }}>
          📊 Not enough population history to plot
        </div>
      </div>
    );
  }
  
  const pad = { left: 70, right: 30, top: 30, bottom: 50 };
  const ys = valid.map(p => Number(p.y));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const isGrowth = ys[ys.length - 1] > ys[0];
  
  const scaleX = (i) => pad.left + (i / (valid.length - 1)) * (width - pad.left - pad.right);
  const scaleY = (y) => pad.top + (1 - (y - minY) / Math.max(1, (maxY - minY))) * (height - pad.top - pad.bottom);
  
  // Create curved path using quadratic bezier curves
  let pathD = '';
  if (valid.length === 2) {
    const x1 = scaleX(0), y1 = scaleY(valid[0].y);
    const x2 = scaleX(1), y2 = scaleY(valid[1].y);
    const midX = (x1 + x2) / 2;
    const curveOffset = isGrowth ? -20 : 20; // Convex for growth, concave for decline
    const midY = (y1 + y2) / 2 + curveOffset;
    pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
  } else {
    // For more than 2 points, create smooth curves between each segment
    pathD = valid.map((p, i) => {
      const x = scaleX(i), y = scaleY(p.y);
      if (i === 0) return `M ${x} ${y}`;
      
      const prevX = scaleX(i - 1), prevY = scaleY(valid[i - 1].y);
      const controlX = (prevX + x) / 2;
      const curveOffset = isGrowth ? -15 : 15;
      const controlY = (prevY + y) / 2 + curveOffset;
      return `Q ${controlX} ${controlY} ${x} ${y}`;
    }).join(' ');
  }
  
  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
      border: '1px solid #e2e8f0', 
      borderRadius: 24, 
      padding: 32, 
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: isGrowth 
          ? 'linear-gradient(90deg, #10b981, #06b6d4)' 
          : 'linear-gradient(90deg, #f59e0b, #ef4444)'
      }} />
      
      <h3 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 700, 
        color: '#1e293b', 
        marginBottom: 24, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12 
      }}>
        <div style={{
          background: isGrowth 
            ? 'linear-gradient(135deg, #10b981, #06b6d4)' 
            : 'linear-gradient(135deg, #f59e0b, #ef4444)',
          borderRadius: '50%',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <TrendingUp size={20} style={{ color: '#fff' }} />
        </div>
        {title}
        <div style={{
          background: isGrowth ? '#dcfce7' : '#fef3c7',
          color: isGrowth ? '#166534' : '#92400e',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: '0.8rem',
          fontWeight: 600,
          marginLeft: 'auto'
        }}>
          {isGrowth ? '📈 Growing' : '📉 Declining'}
        </div>
      </h3>
      
      <svg width={width} height={height}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ 
              stopColor: isGrowth ? '#10b981' : '#f59e0b', 
              stopOpacity: 1 
            }} />
            <stop offset="100%" style={{ 
              stopColor: isGrowth ? '#06b6d4' : '#ef4444', 
              stopOpacity: 1 
            }} />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ 
              stopColor: isGrowth ? '#10b981' : '#f59e0b', 
              stopOpacity: 0.3 
            }} />
            <stop offset="100%" style={{ 
              stopColor: isGrowth ? '#06b6d4' : '#ef4444', 
              stopOpacity: 0.05 
            }} />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
          const y = pad.top + r * (height - pad.top - pad.bottom);
          return (
            <g key={idx}>
              <line 
                x1={pad.left} 
                y1={y} 
                x2={width - pad.right} 
                y2={y} 
                stroke="#f1f5f9" 
                strokeWidth="1" 
                strokeDasharray="4,4"
              />
              <text 
                x={pad.left - 15} 
                y={y + 5} 
                fontSize="13" 
                fill="#64748b" 
                textAnchor="end"
                fontWeight="500"
              >
                {fmt(minY + (1 - r) * (maxY - minY))}
              </text>
            </g>
          );
        })}
        
        {/* X-axis labels */}
        {valid.map((p, i) => (
          <text 
            key={i} 
            x={scaleX(i)} 
            y={height - 15} 
            fontSize="14" 
            fill="#475569" 
            textAnchor="middle"
            fontWeight="600"
          >
            {p.xLabel}
          </text>
        ))}
        
        {/* Area fill */}
        <path 
          d={`${pathD} L ${scaleX(valid.length - 1)} ${height - pad.bottom} L ${pad.left} ${height - pad.bottom} Z`}
          fill="url(#areaGradient)"
        />
        
        {/* Main curved line */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="url(#lineGradient)" 
          strokeWidth="4"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
        />
        
        {/* Data points */}
        {valid.map((p, i) => (
          <g key={i}>
            <circle 
              cx={scaleX(i)} 
              cy={scaleY(p.y)} 
              r="7" 
              fill="#fff" 
              stroke={isGrowth ? '#10b981' : '#f59e0b'}
              strokeWidth="3"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
            />
            <circle 
              cx={scaleX(i)} 
              cy={scaleY(p.y)} 
              r="3" 
              fill={isGrowth ? '#10b981' : '#f59e0b'}
            />
            <text 
              x={scaleX(i)} 
              y={scaleY(p.y) - 18} 
              textAnchor="middle" 
              fontSize="13" 
              fill="#1e293b" 
              fontWeight="700"
              style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
            >
              {fmt(p.y)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const FMRChart = ({ fmrs, title, width = 700, height = 280 }) => {
  const keys = ['fmr_0br','fmr_1br','fmr_2br','fmr_3br','fmr_4br'];
  const labels = ['Studio','1 BD','2 BD','3 BD','4 BD'];
  const vals = keys.map(k => cleanValue(fmrs?.[k]));
  const pairs = labels.map((lab, i) => ({ lab, val: vals[i] })).filter(p => p.val != null && !isNaN(p.val));
  
  if (!pairs.length) {
    return (
      <div style={{ 
        background: '#ffffff', 
        border: '2px dashed #e5e7eb', 
        borderRadius: 16, 
        padding: 32, 
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,.06)'
      }}>
        <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>
          📊 No FMR data available
        </div>
      </div>
    );
  }
  
  const pad = 60; 
  const gap = 20;
  const maxValue = Math.max(...pairs.map(p => p.val));
  const barWidth = Math.max(50, Math.min(80, (width - pad*2 - gap*(pairs.length-1)) / pairs.length));
  
  return (
    <div style={{ 
      background: '#ffffff', 
      border: '1px solid #e5e7eb', 
      borderRadius: 16, 
      padding: 24, 
      boxShadow: '0 2px 4px rgba(0,0,0,.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: 600, 
          color: '#0f172a', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
          margin: 0
        }}>
          <div style={{
            background: '#0ea5e9',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem'
          }}>
            📊
          </div>
          {title}
        </h3>
      </div>
      
      <svg width={width} height={height + 50}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = height * (1 - ratio);
          return (
            <g key={idx}>
              <line 
                x1={pad} 
                y1={y} 
                x2={width - pad} 
                y2={y} 
                stroke="#f1f5f9" 
                strokeWidth="1.5"
              />
              <text 
                x={pad - 10} 
                y={y + 4} 
                fill="#64748b" 
                fontSize="12" 
                textAnchor="end"
                fontWeight="500"
              >
                {formatCurrency(maxValue * ratio)}
              </text>
            </g>
          );
        })}
        
        {/* Bars */}
        {pairs.map((p, i) => {
          const h = (p.val / maxValue) * height;
          const x = pad + i * (barWidth + gap);
          
          // Color palette matching Mashvisor
          const colors = ['#0ea5e9', '#0891b2', '#0e7490', '#155e75', '#164e63'];
          const barColor = colors[i % colors.length];
          
          return (
            <g key={i}>
              {/* Main bar with rounded top */}
              <rect 
                x={x} 
                y={height - h} 
                width={barWidth} 
                height={h} 
                fill={barColor} 
                rx="6"
                ry="6"
              />
              
              {/* Value label on top of bar */}
              <text 
                x={x + barWidth / 2} 
                y={height - h - 8} 
                textAnchor="middle" 
                fill="#0f172a" 
                fontSize="14" 
                fontWeight="700"
              >
                {formatCurrency(p.val)}
              </text>
              
              {/* Category label below */}
              <text 
                x={x + barWidth / 2} 
                y={height + 20} 
                textAnchor="middle" 
                fill="#64748b" 
                fontSize="13" 
                fontWeight="500"
              >
                {p.lab}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ---------------- constants ---------------- */
const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming'
];

// master + fallbacks (you kept these in /public)
const MASTER_CSV = '/zip_city_units_rent_percent_pop_2017_23.csv';
const FMR_CSV = '/fmr_by_zip_clean.csv';
const LANDLORD_CSV = '/landlord_friendly_scores.csv';
const DP03_CSV = '/ZIPACSDP5Y2023.DP03-Data.csv';
const DP04_CSV = '/ZIPACSDP5Y2023.DP04-Data.csv';
const DENSITY_CSV = '/zcta_density.csv';
const RENTER_OWNER_CSV = '/zip_renter_owner_stats_with_counts.csv';
const ZHVI_CSV = '/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';
const ZHVF_GROWTH_CSV = '/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';
const PERMITS_2024_CSV = '/co2408y.txt';
const PERMITS_2025_CSV = '/co2508y.txt';
const MIGRATION_CSV = '/migration_with_clean_zipcodes.csv';

/* ---------------- main page ---------------- */
const MarketAnalysisPage = ({ setCurrentPage, initialZip, initialCity, initialState, initialCounty, dealAddress: propDealAddress, propertyName, embedMode = false, exposeGenerateAI = null }) => {
  const [formData, setFormData] = useState({ location: '' });
  const [zipData, setZipData] = useState({});
  const [uniqueZips, setUniqueZips] = useState([]);
  const [cityIndex, setCityIndex] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketData, setMarketData] = useState([]);
  const [totalListings, setTotalListings] = useState(0);
  const [results, setResults] = useState({});
  const [ranges, setRanges] = useState(null);

  // Cap Rate calculation state
  const [expenseRatio, setExpenseRatio] = useState(0.35); // Default 35%
  const [capRate, setCapRate] = useState(null);
  const [noi, setNoi] = useState(null);

  const [chartsRef, chartsWidth] = useContainerWidth(620);
  // AI summary state
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [migrationRows, setMigrationRows] = useState([]);
  // Helper to calculate Cap Rate and NOI
  useEffect(() => {
    if (!results || Object.keys(results).length === 0) {
      setCapRate(null);
      setNoi(null);
      return;
    }
    // Use FMR 2BR if available, else medianGrossRent
    const grossRent = results.fmr_2br || results.medianGrossRent || 0;
    // Annualize rent
    const annualIncome = grossRent * 12;
    // Estimate expenses
    const expenses = annualIncome * expenseRatio;
    // NOI
    const netOperatingIncome = annualIncome - expenses;
    setNoi(netOperatingIncome);
    // Use ZHVI as property value if available, else fallback to medianHouseholdIncome * 4 (rough proxy)
    const propertyValue = results.zhvi || (results.medianHouseholdIncome ? results.medianHouseholdIncome * 4 : null);
    if (propertyValue && propertyValue > 0) {
      setCapRate(((netOperatingIncome / propertyValue) * 100).toFixed(2));
    } else {
      setCapRate(null);
    }
  }, [results, expenseRatio]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError('');

        // Load everything in parallel
        const [
          masterRows, landlordRows, fmrRows,
          dp03, dp04, density, renterOwner,
          zhviRows, zhvfGrowthRows,
          permits2024, permits2025
          , migrationRows
        ] = await Promise.all([
          loadCSV(MASTER_CSV),
          loadCSV(LANDLORD_CSV).catch(() => []),
          loadCSV(FMR_CSV).catch(() => []),
          loadCSV(DP03_CSV),
          loadCSV(DP04_CSV),
          loadCSV(DENSITY_CSV),
          loadCSV(RENTER_OWNER_CSV),
          loadCSV(ZHVI_CSV).catch(() => []),
          loadCSV(ZHVF_GROWTH_CSV).catch(() => []),
          loadPermitsCSV(PERMITS_2024_CSV).catch(() => []),
          loadPermitsCSV(PERMITS_2025_CSV).catch(() => []),
          loadCSV(MIGRATION_CSV).catch(() => [])
        ]);

        // Debug: Log column names to understand the CSV structure
        if (zhviRows && zhviRows.length > 0) {
          console.log('ZHVI CSV columns:', Object.keys(zhviRows[0]));
        }
        if (zhvfGrowthRows && zhvfGrowthRows.length > 0) {
          console.log('ZHVF CSV columns:', Object.keys(zhvfGrowthRows[0]));
        }

        // Fixed ZHVI (home values) data processing
        const zhviByZip = {};
        for (const r of zhviRows || []) {
          const zip = zeroZip(r.RegionName);
          if (!zip) continue;
          
          // Get latest available month value - using correct column names
          const latestValue = r['06-30-25'] || r['05-31-25'] || r['04-30-25'] || r['03-31-25'] || r['02-28-25'] || r['01-31-25'];
          
          if (latestValue != null) {
            zhviByZip[zip] = {
              currentValue: cleanValue(latestValue),
              city: r.City,
              metro: r.Metro,
              state: r.State
            };
          }
        }

        // Fixed ZHVF growth forecast data  
        const zhvfByZip = {};
        for (const r of zhvfGrowthRows || []) {
          const zip = zeroZip(r.RegionName);
          if (!zip) continue;
          
          zhvfByZip[zip] = {
            forecast_3m: cleanValue(r['2025-09-30']),    // 3 months out
            forecast_1y: cleanValue(r['2025-07-31']),    // ~1 year out  
            forecast_12m: cleanValue(r['2026-06-30'])    // 12+ months out
          };
        }

        // landlord map
        const landlordByState = {};
        for (const r of landlordRows || []) {
          const s = (r.State || r.state || r.state_usps || '').toString().trim();
          if (!s) continue;
          
          // Calculate composite score from individual components if available
          let totalScore = 0;
          let componentCount = 0;
          
          if (r.RentalPropertiesScore != null) { totalScore += Number(r.RentalPropertiesScore); componentCount++; }
          if (r.RentAsIncomeScore != null) { totalScore += Number(r.RentAsIncomeScore); componentCount++; }
          if (r.EvictionScore != null) { totalScore += Number(r.EvictionScore); componentCount++; }
          if (r.DepositAmountScore != null) { totalScore += Number(r.DepositAmountScore); componentCount++; }
          if (r.DepositReturnScore != null) { totalScore += Number(r.DepositReturnScore); componentCount++; }
          if (r.RepairPolicyScore != null) { totalScore += Number(r.RepairPolicyScore); componentCount++; }
          if (r.TerminationNoticeScore != null) { totalScore += Number(r.TerminationNoticeScore); componentCount++; }
          if (r.RentControlScore != null) { totalScore += Number(r.RentControlScore); componentCount++; }
          
          const avgScore = componentCount > 0 ? totalScore / componentCount : null;
          const category = avgScore >= 3.5 ? 'Very Landlord Friendly' : 
                          avgScore >= 2.5 ? 'Landlord Friendly' :
                          avgScore >= 1.5 ? 'Neutral' : 
                          avgScore > 0 ? 'Tenant Friendly' : null;
          
          landlordByState[s.toUpperCase()] = { 
            score: avgScore,
            note: category,
            evictionScore: r.EvictionScore,
            rentControlScore: r.RentControlScore
          };
        }

        // FMR by zip
        const fmrByZip = {};
        for (const r of fmrRows || []) {
          const z = zeroZip(r.zip);
          if (!z) continue;
          fmrByZip[z] = {
            fmr_0br: cleanValue(r.fmr_0br),
            fmr_1br: cleanValue(r.fmr_1br),
            fmr_2br: cleanValue(r.fmr_2br),
            fmr_3br: cleanValue(r.fmr_3br),
            fmr_4br: cleanValue(r.fmr_4br),
            hud_area_name: r.hud_area_name || null,
            county_fips: r.county_fips || null,
            county_name: r.county_name || null,
          };
        }

        // DP03/DP04/density/renter-owner indexes (fallbacks)
        const dp03ByZip = {};
        for (const r of dp03) {
          const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
          if (!zip) continue;
          dp03ByZip[zip] = {
            medianHouseholdIncome: cleanValue(r.DP03_0062E),
            employmentRate: cleanValue(r.DP03_0002PE)
          };
        }
        const dp04ByZip = {};
        for (const r of dp04) {
          const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
          if (!zip) continue;
          dp04ByZip[zip] = {
            medianGrossRent: cleanValue(r.DP04_0134E),
            totalHousingUnits: cleanValue(r.DP04_0001E),
            vacantUnits: cleanValue(r.DP04_0003E),
            occupiedUnits: cleanValue(r.DP04_0002E),
            vacancyRate: cleanValue(r.DP04_0003PE)
          };
        }
        const densityByZip = {};
        for (const r of density) {
          const zip = zeroZip(r.ZCTA);
          if (!zip) continue;
          const land = cleanValue(r.land_sqmi);
          const pop = cleanValue(r.population);
          let dens = cleanValue(r.density_sqmi);
          if (dens == null && land > 0 && pop > 0) dens = pop / land;
          densityByZip[zip] = { land_sqmi: land, population: pop, density_sqmi: dens };
        }
        const roByZip = {};
        for (const r of renterOwner) {
          const zip = zeroZip(r.zip);
          if (!zip) continue;
          roByZip[zip] = {
            total_units: cleanValue(r.total_units),
            owner_units: cleanValue(r.owner_units),
            renter_units: cleanValue(r.renter_units),
            pct_owner: cleanValue(r.pct_owner),
            pct_renter: cleanValue(r.pct_renter)
          };
        }

        // Building Permits data by county (2024 and 2025)
        const permitsByCounty = {};
        for (const r of permits2024 || []) {
          const stateFips = r.State;
          const countyFips = r.County;
          if (!stateFips || !countyFips) continue;
          
          const fips = String(stateFips).padStart(2, "0") + String(countyFips).padStart(3, "0");
          
          permitsByCounty[fips] = {
            countyName: r.Name,
            units2024_1unit: cleanValue(r.Units) || 0,
            units2024_2units: cleanValue(r.Units_1) || 0,
            units2024_34units: cleanValue(r.Units_2) || 0,
            units2024_5plus: cleanValue(r.Units_3) || 0,
            totalUnits2024: (cleanValue(r.Units) || 0) + (cleanValue(r.Units_1) || 0) + 
                           (cleanValue(r.Units_2) || 0) + (cleanValue(r.Units_3) || 0)
          };
        }
        
        for (const r of permits2025 || []) {
          const stateFips = r.State;
          const countyFips = r.County;
          if (!stateFips || !countyFips) continue;
          
          const fips = String(stateFips).padStart(2, "0") + String(countyFips).padStart(3, "0");
          
          if (!permitsByCounty[fips]) {
            permitsByCounty[fips] = { countyName: r.Name };
          }
          
          permitsByCounty[fips].units2025_1unit = cleanValue(r.Units) || 0;
          permitsByCounty[fips].units2025_2units = cleanValue(r.Units_1) || 0;
          permitsByCounty[fips].units2025_34units = cleanValue(r.Units_2) || 0;
          permitsByCounty[fips].units2025_5plus = cleanValue(r.Units_3) || 0;
          permitsByCounty[fips].totalUnits2025 = (cleanValue(r.Units) || 0) + (cleanValue(r.Units_1) || 0) + 
                                                  (cleanValue(r.Units_2) || 0) + (cleanValue(r.Units_3) || 0);
          
          // Calculate YoY growth
          if (permitsByCounty[fips].totalUnits2024 && permitsByCounty[fips].totalUnits2024 > 0) {
            permitsByCounty[fips].permitGrowth = 
              ((permitsByCounty[fips].totalUnits2025 - permitsByCounty[fips].totalUnits2024) / 
               permitsByCounty[fips].totalUnits2024) * 100;
          }
        }

        console.log('[Permits] Processed counties:', Object.keys(permitsByCounty).length);

        // Merge master with fallbacks
        const zips = {};
        const cityIdx = {};
        for (const r of masterRows) {
          const zip = zeroZip(r.zip); if (!zip) continue;
          const city = (r.city || '').toString().trim().toUpperCase();
          const state = (r.state || '').toString().trim().toUpperCase();
          const cityKey = `${city}, ${state}`;

          const mhi = cleanValue(r.medianHouseholdIncome) ?? dp03ByZip[zip]?.medianHouseholdIncome ?? null;
          const emp = cleanValue(r.employmentRate) ?? dp03ByZip[zip]?.employmentRate ?? null;
          const mgr = cleanValue(r.medianGrossRent) ?? dp04ByZip[zip]?.medianGrossRent ?? null;

          const th = cleanValue(r.totalHousingUnits) ?? dp04ByZip[zip]?.totalHousingUnits ?? null;
          const vu = cleanValue(r.vacantUnits) ?? dp04ByZip[zip]?.vacantUnits ?? null;
          const oc = cleanValue(r.occupiedUnits) ?? dp04ByZip[zip]?.occupiedUnits ?? null;
          const vr = cleanValue(r.vacancyRate) ?? dp04ByZip[zip]?.vacancyRate ?? null;

          const ro = roByZip[zip] || {};
          const dens = densityByZip[zip] || {};

          const population_2017 = cleanValue(r.population_2017);
          const population_2023 = cleanValue(r.population_2023 ?? r.population ?? dens.population ?? null);
          const population_change_pct_17_23 = (population_2017 && population_2023)
            ? ((population_2023 - population_2017) / population_2017) * 100 : null;

          const rent_to_income = (mhi && mgr) ? (mgr * 12) / mhi : null;
          const ls = landlordByState[state] || null;

          // Link permits data via county FIPS from FMR data
          const fmrData = fmrByZip[zip] || {};
          const countyFipsForZip = fmrData.county_fips;
          const permitsForCounty = countyFipsForZip ? permitsByCounty[countyFipsForZip] : null;

          zips[zip] = {
            zip, city, state,
            medianHouseholdIncome: mhi,
            employmentRate: emp,
            medianGrossRent: mgr,
            totalHousingUnits: th,
            vacantUnits: vu,
            occupiedUnits: oc,
            vacancyRate: vr,
            total_units: ro.total_units ?? cleanValue(r.total_units),
            owner_units: ro.owner_units ?? cleanValue(r.owner_units),
            renter_units: ro.renter_units ?? cleanValue(r.renter_units),
            pct_owner: ro.pct_owner ?? cleanValue(r.pct_owner),
            pct_renter: ro.pct_renter ?? cleanValue(r.pct_renter),
            population: population_2023 ?? null,
            population_2017,
            population_2023,
            population_change_pct_17_23,
            density_sqmi: cleanValue(r.density_sqmi) ?? dens.density_sqmi ?? null,
            landlord_friendly_score: ls?.score ?? null,
            landlord_friendly_note: ls?.note ?? null,
            eviction_score: ls?.evictionScore ?? null,
            rent_control_score: ls?.rentControlScore ?? null,
            ...(fmrData),
            zhvi: cleanValue(r.zhvi) ?? zhviByZip[zip]?.currentValue ?? null,
            zhvf_1y: cleanValue(r.zhvf_1y) ?? zhvfByZip[zip]?.forecast_1y ?? null,
            zhvi_5y_growth_pct: cleanValue(r.zhvi_5y_growth_pct),
            zhvi_1y_growth_pct: cleanValue(r.zhvi_1y_growth_pct),
            zhvf_forecast_3m: zhvfByZip[zip]?.forecast_3m ?? null,
            zhvf_forecast_12m: zhvfByZip[zip]?.forecast_12m ?? null,
            rent_to_income,
            // Add building permits data from county-level data
            units2024_1unit: permitsForCounty?.units2024_1unit ?? null,
            units2024_2units: permitsForCounty?.units2024_2units ?? null,
            units2024_34units: permitsForCounty?.units2024_34units ?? null,
            units2024_5plus: permitsForCounty?.units2024_5plus ?? null,
            totalUnits2024: permitsForCounty?.totalUnits2024 ?? null,
            units2025_1unit: permitsForCounty?.units2025_1unit ?? null,
            units2025_2units: permitsForCounty?.units2025_2units ?? null,
            units2025_34units: permitsForCounty?.units2025_34units ?? null,
            units2025_5plus: permitsForCounty?.units2025_5plus ?? null,
            totalUnits2025: permitsForCounty?.totalUnits2025 ?? null,
            permitGrowth: permitsForCounty?.permitGrowth ?? null,
          };

          if (!cityIdx[cityKey]) cityIdx[cityKey] = [];
          cityIdx[cityKey].push(zip);
        }

        if (cancelled) return;
        setZipData(zips);
        setUniqueZips(Object.keys(zips).sort());
        setCityIndex(cityIdx);
        setRanges(computeRangesAll(Object.values(zips))); // Using improved ranges function
        setMigrationRows(migrationRows || []);

        // Debug: Check if ZHVI data is properly loaded
        console.log('Sample ZIP data with ZHVI:', Object.values(zips).slice(0, 5));

        // state rental CSVs (best-effort) for live listings
        let allRentData = [];
        for (const stateName of STATES) {
          let csvText = null;
          let fileName = `${stateName}_Rental_Data - ${stateName}_Rental_Data.csv`;
          try {
            const response = await fetch(`/states/${fileName}`);
            if (response.ok) csvText = await response.text();
          } catch {}
          if (!csvText) {
            fileName = `${stateName}_Rental_Data.csv`;
            try {
              const response = await fetch(`/states/${fileName}`);
              if (response.ok) csvText = await response.text();
            } catch {}
          }
          if (csvText) {
            const parsed = Papa.parse(csvText, { header:true, skipEmptyLines:true });
            if (parsed.data?.length) allRentData = allRentData.concat(parsed.data.map(row => ({ ...row, state: stateName })));
          }
        }
        if (cancelled) return;
        setMarketData(allRentData);
        setLoading(false);
        // If initial location was provided from parent (Results tab), prefill and run
        if (initialZip || initialCity) {
          setFormData({ location: initialZip || initialCity });
          // delay to let state settle
          setTimeout(() => {
            try { handleSubmit(new Event('submit')); } catch (e) { /* ignore */ }
          }, 250);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading data:', err);
        setError('Failed to load market data. Please try again.');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Generate AI summary using the computed `results` object
  const generateAISummary = useCallback(async () => {
    if (!results || Object.keys(results).length === 0) {
      console.log('No results available for AI summary');
      return;
    }
    console.log('Generating AI summary with results:', results);
    setSummaryLoading(true); setSummaryError(''); setAiSummary(null);
    try {
      const marketData = {
        homeValue: results.zhvi,
        fmr_0br: results.fmr_0br,
        fmr_1br: results.fmr_1br,
        fmr_2br: results.fmr_2br,
        fmr_3br: results.fmr_3br,
        fmr_4br: results.fmr_4br,
        medianIncome: results.medianHouseholdIncome,
        medianGrossRent: results.medianGrossRent,
        vacancyRate: results.vacancyRate,
        totalUnits: results.totalHousingUnits || results.total_units,
        population: results.population,
        pct_renter: results.pct_renter,
        landlordScore: results.landlord_friendly_score,
        zhvi_1y_growth_pct: results.zhvi_1y_growth_pct,
        zhvi_5y_growth_pct: results.zhvi_5y_growth_pct,
        permitGrowth: results.permitGrowth
      };

      const location = {
        zip: results.zip || (formData.location || '').trim(),
        city: results.city || initialCity || null,
        state: results.state || initialState || null,
        county: results.county || initialCounty || null
      };

      const fullAddress = propDealAddress ? `${propDealAddress}, ${location.city || ''} ${location.state || ''}`.trim() : `${location.city || ''} ${location.state || ''} ${location.zip || ''}`.trim();

      console.log('Calling AI API with:', { marketData, location, fullAddress });
      const resp = await fetch('http://localhost:8010/api/market-data/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData, location, dealAddress: fullAddress, propertyName: propertyName || null })
      });
      const data = await resp.json();
      console.log('AI API response:', data);
      if (data.success) setAiSummary(data.summary);
      else setSummaryError(data.error || 'AI service returned an error');
    } catch (e) {
      console.error('AI summary error:', e);
      setSummaryError('Failed to contact AI service');
    } finally {
      setSummaryLoading(false);
    }
  }, [results, formData.location, initialCity, initialState, initialCounty, propDealAddress, propertyName]);

  // If parent wants a handle to trigger AI generation, expose it whenever it changes
  useEffect(() => {
    try {
      if (typeof exposeGenerateAI === 'function') {
        console.log('Exposing generateAISummary to parent');
        exposeGenerateAI(generateAISummary);
      }
    } catch (e) {
      console.error('Error exposing AI function:', e);
    }
  }, [exposeGenerateAI, generateAISummary]);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault(); setError('');

    const loc = (formData.location || '').trim().toLowerCase();
    if (!loc) { setError('Please enter a ZIP code or city'); return; }

    const zipMatch = uniqueZips.find(z => z.toLowerCase() === loc || z.toLowerCase().startsWith(loc));
    const resolvedZip = zipMatch || null;

    // Try city key "CITY, ST" or just city
    let cityKey = null;
    if (!resolvedZip) {
      const keys = Object.keys(cityIndex);
      const exactCity = keys.find(k => k.toLowerCase() === loc);
      if (exactCity) cityKey = exactCity;
      else {
        const byCity = keys.find(k => k.split(',')[0].trim().toLowerCase() === loc);
        if (byCity) cityKey = byCity;
      }
    }
    if (!resolvedZip && !cityKey) { setError('No matching ZIP or City found in dataset.'); return; }

    // LIVE RENT slice
    const rentData = marketData.filter(row => {
      const rowZip = zeroZip(row.zipCode);
      const rowCity = (row.city || '').toString().trim().toLowerCase();
      if (resolvedZip) return rowZip === resolvedZip;
      if (!cityKey) return false;
      const cityOnly = cityKey.split(',')[0].trim().toLowerCase();
      return rowCity === cityOnly;
    });
    const rentStats = rentData.reduce((acc, row) => {
      const bed = row.bed ? `${row.bed}` : 'Studio';
      if (!acc[bed]) acc[bed] = { rents: [], sqfts: [], rentPerSf: [], count: 0 };
      const r = cleanValue(row.rent); const s = cleanValue(row.sqft); const rpsf = cleanValue(row.rentPerSf);
      if (r != null) acc[bed].rents.push(r);
      if (s != null) acc[bed].sqfts.push(s);
      if (rpsf != null) acc[bed].rentPerSf.push(rpsf);
      acc[bed].count++;
      return acc;
    }, {});
    const rentAverages = Object.keys(rentStats).reduce((acc, bed) => {
      const d = rentStats[bed];
      acc[bed] = {
        avgRent: d.rents.length ? d.rents.reduce((a,b)=>a+b,0)/d.rents.length : 0,
        avgSqft: d.sqfts.length ? d.sqfts.reduce((a,b)=>a+b,0)/d.sqfts.length : 0,
        avgRentPerSf: d.rentPerSf.length ? d.rentPerSf.reduce((a,b)=>a+b,0)/d.rentPerSf.length : 0,
        count: d.count
      };
      return acc;
    }, {});
    setTotalListings(rentData.length);

    // Build result object
    let base = {};
    if (resolvedZip) {
      base = zipData[resolvedZip] || {};
    } else if (cityKey) {
      const zipsInCity = cityIndex[cityKey] || [];
      const agg = (field, sum = true) => {
        const vals = zipsInCity.map(z => cleanValue(zipData[z]?.[field])).filter(v => v != null);
        if (!vals.length) return null;
        return sum ? vals.reduce((a,b)=>a+b,0) : (vals.reduce((a,b)=>a+b,0) / vals.length);
      };
      const pop17 = agg('population_2017');
      const pop23 = agg('population_2023') ?? agg('population');
      const popChange = (pop17 && pop23) ? ((pop23 - pop17) / pop17) * 100 : null;

      base = {
        city: cityKey.split(',')[0],
        state: cityKey.split(',')[1].trim(),
        population_2017: pop17,
        population_2023: pop23,
        population: pop23,
        population_change_pct_17_23: popChange,
        medianHouseholdIncome: agg('medianHouseholdIncome', false),
        employmentRate: agg('employmentRate', false),
        medianGrossRent: agg('medianGrossRent', false),
        totalHousingUnits: agg('totalHousingUnits'),
        vacantUnits: agg('vacantUnits'),
        occupiedUnits: agg('occupiedUnits'),
        vacancyRate: agg('vacancyRate', false),
        total_units: agg('total_units'),
        owner_units: agg('owner_units'),
        renter_units: agg('renter_units'),
        pct_owner: agg('pct_owner', false),
        pct_renter: agg('pct_renter', false),
        density_sqmi: agg('density_sqmi', false),
        landlord_friendly_score: agg('landlord_friendly_score', false),
        landlord_friendly_note: zipData[zipsInCity[0]]?.landlord_friendly_note || null,
        fmr_0br: agg('fmr_0br', false),
        fmr_1br: agg('fmr_1br', false),
        fmr_2br: agg('fmr_2br', false),
        fmr_3br: agg('fmr_3br', false),
        fmr_4br: agg('fmr_4br', false),
        zhvi: agg('zhvi', false),
        zhvi_5y_growth_pct: agg('zhvi_5y_growth_pct', false),
        zhvi_1y_growth_pct: agg('zhvi_1y_growth_pct', false),
        zhvf_1y: agg('zhvf_1y', false),
        zhvf_forecast_3m: agg('zhvf_forecast_3m', false),
        zhvf_forecast_12m: agg('zhvf_forecast_12m', false),
        // Building permits (county-level data, same for all ZIPs in same county)
        units2024_1unit: agg('units2024_1unit', false),
        units2024_2units: agg('units2024_2units', false),
        units2024_34units: agg('units2024_34units', false),
        units2024_5plus: agg('units2024_5plus', false),
        totalUnits2024: agg('totalUnits2024', false),
        units2025_1unit: agg('units2025_1unit', false),
        units2025_2units: agg('units2025_2units', false),
        units2025_34units: agg('units2025_34units', false),
        units2025_5plus: agg('units2025_5plus', false),
        totalUnits2025: agg('totalUnits2025', false),
        permitGrowth: agg('permitGrowth', false),
      };
    }

    // Stash needed fields for improved scoring
    base._totalListings = totalListings;
    base._avgLive2br = rentAverages['2']?.avgRent || rentAverages['2 BD']?.avgRent || null;

    const marketScore = ranges ? scoreMarket(base, ranges) : null;
    
    // Debug: Check if we have the data needed for investment analysis
    console.log('Investment Analysis Input Data:', {
      pct_renter: base.pct_renter,
      vacancyRate: base.vacancyRate,
      population_change: base.population_change_pct_17_23,
      landlord_score: base.landlord_friendly_score,
      zhvi_data: base.zhvi,
      zhvf_forecast: base.zhvf_forecast_12m
    });
    
    const investmentAnalysis = calculateInvestmentScore(base);
    console.log('Investment Analysis Result:', investmentAnalysis);
    
    setResults({ ...base, liveRentStats: rentAverages, neil_market_score: marketScore, investmentAnalysis });
  };

  const ai = (results && Object.keys(results).length)
    ? (() => {
        const score = results.neil_market_score != null ? results.neil_market_score : 0;
        let verdict = 'Weak';
        if (score >= 75) verdict = 'Strong';
        else if (score >= 60) verdict = 'Solid';
        else if (score >= 45) verdict = 'Mixed';
        const notes = [];
        const popChg = cleanValue(results.population_change_pct_17_23);
        if (popChg != null) notes.push(`Population ${popChg >= 0 ? 'up' : 'down'} ${formatPercent(popChg, 1)} since 2017`);
        return { score, verdict, notes };
      })()
    : null;

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:64, height:64, border:'2px solid #e2e8f0', borderTop:'2px solid #06b6d4', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
          <h2 style={{ color:'#333', fontSize:'1.25rem', fontWeight:600 }}>Loading Market Data...</h2>
          <div style={{ color:'#666', marginTop:8 }}>Analyzing market data for your location</div>
        </div>
      </div>
    );
  }

  // If embedded inside Results, render compact Results-style tables
  if (embedMode && Object.keys(results).length > 0) {
    const InfoRow = ({ label, value, highlight = false }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: highlight ? '700' : '600', color: highlight ? '#10b981' : '#111827' }}>{value}</span>
      </div>
    );

    const addr = [results.city, results.state, results.zip].filter(Boolean).join(', ');
    const vacancy = results.vacancyRate != null ? Number(results.vacancyRate) : null;
    const occupancy = vacancy != null ? `${(100 - vacancy).toFixed(1)}%` : 'N/A';
    const totalUnits = results.total_units ?? results.totalHousingUnits ?? results.totalUnits ?? null;
    const totalUnitsDisplay = totalUnits != null ? fmt(totalUnits) : 'N/A';
    const zhvi = results.zhvi != null ? formatCurrency(results.zhvi) : 'N/A';
    const pricePerUnit = (results.zhvi && (results.total_units || results.totalHousingUnits)) ? formatCurrency(Number(results.zhvi) / Number(results.total_units || results.totalHousingUnits)) : 'N/A';
    const pricePerSf = results.zhvi_per_sf != null ? formatCurrency(results.zhvi_per_sf) : 'N/A';
    const fmr2 = results.fmr_2br != null ? formatCurrency(results.fmr_2br) : 'N/A';
    const medianRent = results.medianGrossRent != null ? formatCurrency(results.medianGrossRent) : 'N/A';
    const landlordScore = results.landlord_friendly_score != null ? (Number(results.landlord_friendly_score) > 1 ? (Number(results.landlord_friendly_score)).toFixed(1) : (Number(results.landlord_friendly_score) * 5).toFixed(1)) + '/5' : 'N/A';
    const permitGrowth = results.permitGrowth != null ? `${Number(results.permitGrowth).toFixed(1)}%` : 'N/A';
    const pop = results.population != null ? fmt(results.population) : 'N/A';
    const popChange = results.population_change_pct_17_23 != null ? formatPercent(results.population_change_pct_17_23) : 'N/A';
    const medianIncome = results.medianHouseholdIncome != null ? formatCurrency(results.medianHouseholdIncome) : 'N/A';
    const densityVal = results.density_sqmi != null ? `${Number(results.density_sqmi).toFixed(1)}/sq mi` : 'N/A';
    const employmentVal = results.employmentRate != null ? `${Number(results.employmentRate).toFixed(1)}%` : 'N/A';
    const totalHousingUnits = results.totalHousingUnits ?? results.total_units ?? null;
    const totalHousingUnitsDisplay = totalHousingUnits != null ? fmt(totalHousingUnits) : 'N/A';
    const occupiedUnits = results.occupiedUnits ?? results.occupied_units ?? results.occupied ?? null;
    const occupiedUnitsDisplay = occupiedUnits != null ? fmt(occupiedUnits) : 'N/A';
    const vacantUnits = results.vacantUnits ?? results.vacant_units ?? results.vacancy_units ?? null;
    const vacantUnitsDisplay = vacantUnits != null ? fmt(vacantUnits) : (vacancy != null && totalHousingUnits != null ? fmt(Math.round(totalHousingUnits * (vacancy/100))) : 'N/A');
    const vacancyRateDisplay = results.vacancyRate != null ? `${Number(results.vacancyRate).toFixed(1)}%` : (vacancy != null ? `${vacancy.toFixed(1)}%` : 'N/A');
    const ownerUnits = results.owner_units ?? results.ownerUnits ?? results.ownerOccupied ?? null;
    const renterUnits = results.renter_units ?? results.renterUnits ?? results.renterOccupied ?? null;
    const pctOwner = results.pct_owner != null ? `${Number(results.pct_owner).toFixed(1)}%` : (results.pctOwner != null ? `${Number(results.pctOwner).toFixed(1)}%` : 'N/A');
    const pctRenter = results.pct_renter != null ? `${Number(results.pct_renter).toFixed(1)}%` : (results.pctRenter != null ? `${Number(results.pctRenter).toFixed(1)}%` : 'N/A');
    const ownerDisplay = ownerUnits != null ? `${fmt(ownerUnits)} (${pctOwner})` : 'N/A';
    const renterDisplay = renterUnits != null ? `${fmt(renterUnits)} (${pctRenter})` : 'N/A';
    const zhvi1y = results.zhvi_1y_growth_pct != null ? formatPercent(results.zhvi_1y_growth_pct) : 'N/A';
    const zhvi5y = results.zhvi_5y_growth_pct != null ? formatPercent(results.zhvi_5y_growth_pct) : 'N/A';
    const zhvf12 = results.zhvf_forecast_12m != null ? `${Number(results.zhvf_forecast_12m).toFixed(1)}%` : (results.zhvf_12m != null ? `${Number(results.zhvf_12m).toFixed(1)}%` : 'N/A');
    // Migration summary (best-effort): compute inflow/outflow/net for ZIP
    const zipPad = String(results.zip || '').padStart(5, '0');
    let inflowSum = null, outflowSum = null;
    if (migrationRows && migrationRows.length > 0 && zipPad) {
      inflowSum = 0; outflowSum = 0;
      migrationRows.forEach(r => {
        try {
          const dest = String(r.dest_zip || r.to_zip || r.zip_dest || r.zip || r.dst_zip || r.ZIP_DEST || '').padStart(5, '0');
          const src = String(r.src_zip || r.from_zip || r.zip_src || r.origin_zip || r.zip || r.origin || '').padStart(5, '0');
          const val = Number(r.migrants || r.count || r.total || r.net || r.MIGRANTS || r.estimate || 0) || 0;
          if (dest === zipPad) inflowSum += val;
          if (src === zipPad) outflowSum += val;
        } catch (e) { /* ignore parse errors */ }
      });
      if (inflowSum === 0) inflowSum = null;
      if (outflowSum === 0) outflowSum = null;
    }
    const migrationInDisplay = inflowSum != null ? fmt(inflowSum) : 'N/A';
    const migrationOutDisplay = outflowSum != null ? fmt(outflowSum) : 'N/A';
    const migrationNetDisplay = (inflowSum != null && outflowSum != null) ? fmt(inflowSum - outflowSum) : 'N/A';

    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <SectionCard title="Market Snapshot" icon={Home}>
            <InfoRow label="Total Units" value={totalUnitsDisplay} />
            <InfoRow label="Population" value={pop} />
            <InfoRow label="Pop. Change (5yr)" value={popChange} />
            <InfoRow label="Density" value={densityVal} />
            <InfoRow label="Median Income" value={medianIncome} />
            <InfoRow label="Employment Rate" value={employmentVal} />
          </SectionCard>

          <SectionCard title="Housing Market" icon={Building2}>
            <InfoRow label="Total Housing Units" value={totalHousingUnitsDisplay} />
            <InfoRow label="Occupied Units" value={occupiedUnitsDisplay} />
            <InfoRow label="Vacant Units" value={vacantUnitsDisplay} />
            <InfoRow label="Vacancy Rate" value={vacancyRateDisplay} />
            <InfoRow label="Owner-Occupied" value={ownerDisplay} />
            <InfoRow label="Renter-Occupied" value={renterDisplay} />
          </SectionCard>

          <SectionCard title="Rent & Home Values" icon={DollarSign}>
            <InfoRow label="Median Rent" value={medianRent} />
            <InfoRow label="FMR 2BR" value={fmr2} />
            <InfoRow label="Home Value (ZHVI)" value={zhvi} />
            <InfoRow label="1yr Value Growth" value={zhvi1y} />
            <InfoRow label="5yr Value Growth" value={zhvi5y} />
            <InfoRow label="12m Forecast" value={zhvf12} />
          </SectionCard>

          <SectionCard title="Migration Trends" icon={Users}>
            <InfoRow label="Inflow (est)" value={migrationInDisplay} />
            <InfoRow label="Outflow (est)" value={migrationOutDisplay} />
            <InfoRow label="Net Migration" value={migrationNetDisplay} />
          </SectionCard>

          <SectionCard title="Returns & Analysis" icon={TrendingUp}>
            <InfoRow label="Market Score" value={results.neil_market_score != null ? `${results.neil_market_score}/100` : 'N/A'} />
            <InfoRow label="Recommendation" value={results.investmentAnalysis?.recommendation || 'N/A'} />
            <InfoRow label="Confidence" value={results.investmentAnalysis?.confidence || 'N/A'} />
            <InfoRow label="In-place Cap Rate" value={capRate != null ? `${capRate}%` : 'N/A'} />
            <InfoRow label="NOI (est)" value={noi != null ? formatCurrency(noi) : 'N/A'} />
            <InfoRow label="Investment Score" value={results.investmentAnalysis?.totalScore != null ? `${results.investmentAnalysis.totalScore}/100` : 'N/A'} />
            <InfoRow label="Top Reasons" value={results.investmentAnalysis?.reasons ? results.investmentAnalysis.reasons.join(', ') : 'N/A'} />
          </SectionCard>
          {(aiSummary || summaryLoading || summaryError) && (
            <SectionCard title="AI Investment Analysis" icon={Sparkles}>
              {summaryError && (
                <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} />
                  {summaryError}
                </div>
              )}

              {summaryLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1' }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Analyzing market data...</span>
                </div>
              )}

              {aiSummary && (
                <div style={{ color: '#1e293b', fontSize: '0.92rem', lineHeight: '1.6', maxHeight: '360px', overflowY: 'auto' }}>
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginTop: '12px', marginBottom: '8px' }}>{children}</h1>,
                      h2: ({children}) => <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginTop: '10px', marginBottom: '8px' }}>{children}</h2>,
                      p: ({children}) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                      ul: ({children}) => <ul style={{ paddingLeft: '18px', marginBottom: '8px' }}>{children}</ul>,
                      li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>
                    }}
                  >
                    {aiSummary}
                  </ReactMarkdown>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="market-analysis-content" style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#111827',
      padding: 40,
      position: 'relative'
    }}>
      
      <div style={{ maxWidth:1400, margin:'0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {/* Back to Home removed to match Results tab layout */}
            
            {/* Export to PDF Button */}
            {Object.keys(results).length > 0 && (
              <button
                onClick={exportToPDF}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none'
                }}
              >
                <Download size={16} /> Export
              </button>
            )}
            {Object.keys(results).length > 0 && (
              <button
                onClick={generateAISummary}
                disabled={summaryLoading}
                style={{
                  marginLeft: 8,
                  backgroundColor: summaryLoading ? '#9ca3af' : '#6366f1',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: summaryLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none'
                }}
              >
                {summaryLoading ? 'Analyzing...' : 'Generate AI Analysis'}
              </button>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Home size={20} color="#0ea5e9" />
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Market Analysis</h2>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>View housing, economic, and demographic data for this market</p>
          </div>
          {/* AI Summary (rendered in the Investment Analysis panel) */}
        </div>

        {/* search */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #e6eef6', 
          borderRadius: 12, 
          padding: 18, 
          marginBottom: 28, 
          boxShadow: '0 1px 2px rgba(16,24,40,0.04)'
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 720 }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#0ea5e9', zIndex: 2 }}>
                  <MapPin size={18} />
                </div>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                  placeholder="e.g., 92054 or Oceanside"
                  style={{
                    width: '100%',
                    paddingLeft: 42,
                    paddingRight: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    background: '#ffffff',
                    border: '1px solid #d1e8fb',
                    borderRadius: 10,
                    color: '#0f172a',
                    fontSize: 14,
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>
              <button onClick={handleSubmit} style={{ backgroundColor: '#06a6e3', color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>ANALYZE MARKET</button>
            </div>
            {error && (
              <div style={{ 
                marginTop: 20, 
                padding: 14,
                background: '#fff6f6',
                border: '1px solid #fbcaca',
                borderRadius: 8,
                color: '#c24141',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center'
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>

        {Object.keys(results).length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'minmax(320px,420px) 1fr', gap:24 }}>
            {/* LEFT COLUMN */}
            <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
              {/* Location Data Attribute for PDF filename */}
              <div data-location={results.zip || results.city || 'market'} style={{ display: 'none' }}></div>
              
              {/* Total Units */}
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,.06)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                  <Home style={{ color:'#10b981' }} size={24} />
                  <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#333' }}>Total Units</h3>
                </div>
                <div style={{ fontSize:'2.4rem', fontWeight:800, color:'#10b981' }}>
                  {fmt(results.total_units ?? results.occupiedUnits ?? results.totalHousingUnits)}
                </div>
                <div style={{ color:'#64748b', marginTop:4 }}>From renter/owner dataset (fallback to occupied/ACS if missing)</div>
              </div>

              {/* Building Permits */}
              {(results.totalUnits2024 != null || results.totalUnits2025 != null) && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,.06)' }}>
                  <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#333', marginBottom:16 }}>Building Permits</h3>
                  <div style={{ fontSize:'0.875rem', color:'#64748b', marginBottom:16 }}>County-level data (Aug 2024 & Aug 2025)</div>
                  
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    {/* 2024 Column */}
                    {results.totalUnits2024 != null && (
                      <div style={{ padding:16, background:'#f8fafc', borderRadius:12 }}>
                        <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', marginBottom:8 }}>2024</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>1-Unit (SF)</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2024_1unit)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>2-Units</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2024_2units)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>3-4 Units</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2024_34units)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>5+ Units (MF)</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2024_5plus)}</span>
                          </div>
                          <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:8, marginTop:4 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                              <span style={{ fontWeight:600, color:'#0f172a' }}>Total</span>
                              <span style={{ fontWeight:700, color:'#0f172a' }}>{fmt(results.totalUnits2024)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 2025 Column */}
                    {results.totalUnits2025 != null && (
                      <div style={{ padding:16, background:'#f0fdf4', borderRadius:12, border:'1px solid #86efac' }}>
                        <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#16a34a', textTransform:'uppercase', marginBottom:8 }}>2025</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>1-Unit (SF)</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2025_1unit)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>2-Units</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2025_2units)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>3-4 Units</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2025_34units)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                            <span style={{ color:'#64748b' }}>5+ Units (MF)</span>
                            <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.units2025_5plus)}</span>
                          </div>
                          <div style={{ borderTop:'1px solid #bbf7d0', paddingTop:8, marginTop:4 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.875rem' }}>
                              <span style={{ fontWeight:600, color:'#0f172a' }}>Total</span>
                              <span style={{ fontWeight:700, color:'#16a34a' }}>{fmt(results.totalUnits2025)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* YoY Growth Badge */}
                  {results.permitGrowth != null && (
                    <div style={{ marginTop:16, padding:12, background:'#eff6ff', borderRadius:8, textAlign:'center' }}>
                      <span style={{ fontSize:'0.75rem', color:'#64748b', marginRight:8 }}>YoY Growth:</span>
                      <span style={{ 
                        fontSize:'1rem', 
                        fontWeight:700, 
                        color: results.permitGrowth >= 0 ? '#16a34a' : '#dc2626' 
                      }}>
                        {results.permitGrowth >= 0 ? '↑' : '↓'} {Math.abs(results.permitGrowth).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Population & Demographics - use Results-style SectionCard + MetricCard */}
              <SectionCard title="Population & Demographics" icon={Home}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  <MetricCard label="Population" value={fmt(results.population)} icon={Home} />
                  <MetricCard label="Pop. Change (5yr)" value={results.population_change_pct_17_23 != null ? formatPercent(results.population_change_pct_17_23) : 'N/A'} icon={TrendingUp} color={results.population_change_pct_17_23 >= 0 ? '#10b981' : '#ef4444'} />
                  <MetricCard label="Median Income" value={formatCurrency(results.medianHouseholdIncome)} icon={DollarSign} />
                </div>

                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight:700, color:'#0f172a', marginBottom:8 }}>Population Trend</h4>
                  <div>
                    <LineChart
                      title="Population Trend"
                      width={Math.min(chartsWidth - 16, 700)}
                      points={[
                        { xLabel: '2017', y: results.population_2017 != null ? Number(results.population_2017) : null },
                        { xLabel: '2023', y: results.population != null ? Number(results.population) : null }
                      ]}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Housing Market */}
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#0f172a', marginBottom:16 }}>Housing Market</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Total Housing Units</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.totalHousingUnits)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Occupied Units</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.occupiedUnits)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Vacant Units</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.vacantUnits)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Vacancy Rate</span>
                    <span style={{ fontWeight:600, color: results.vacancyRate > 10 ? '#ef4444' : '#0f172a' }}>{formatPercent(results.vacancyRate)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Owner-Occupied</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>{fmt(results.owner_units)} ({formatPercent(results.pct_owner)})</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Renter-Occupied</span>
                    <span style={{ fontWeight:600, color:'#10b981' }}>{fmt(results.renter_units)} ({formatPercent(results.pct_renter)})</span>
                  </div>
                </div>
              </div>

              {/* Rent & Value */}
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,.06)' }}>
                <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#0f172a', marginBottom:16 }}>Rent & Home Values</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom:4, textTransform:'uppercase' }}>Median Rent</div>
                    <div style={{ fontSize:'1.5rem', fontWeight:700, color:'#10b981' }}>{formatCurrency(results.medianGrossRent)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom:4, textTransform:'uppercase' }}>FMR 2BR</div>
                    <div style={{ fontSize:'1.5rem', fontWeight:700, color:'#0ea5e9' }}>
                      {results.fmr_2br != null ? formatCurrency(results.fmr_2br) : 'N/A'}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>Home Value (ZHVI)</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>{results.zhvi != null ? formatCurrency(results.zhvi) : 'N/A'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>1yr Value Growth</span>
                    <span style={{ fontWeight:600, color: results.zhvi_1y_growth_pct >= 0 ? '#10b981' : '#ef4444' }}>
                      {results.zhvi_1y_growth_pct != null ? formatPercent(results.zhvi_1y_growth_pct) : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>5yr Value Growth</span>
                    <span style={{ fontWeight:600, color: results.zhvi_5y_growth_pct >= 0 ? '#10b981' : '#ef4444' }}>
                      {results.zhvi_5y_growth_pct != null ? formatPercent(results.zhvi_5y_growth_pct) : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <span style={{ color:'#64748b', fontSize:'0.875rem' }}>12m Forecast</span>
                    <span style={{ fontWeight:600, color:'#0f172a' }}>
                      {results.zhvf_forecast_12m != null ? formatPercent(results.zhvf_forecast_12m) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Landlord-Friendly Score */}
              {results.landlord_friendly_score != null && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, padding:24, boxShadow:'0 2px 4px rgba(0,0,0,.06)' }}>
                  <h3 style={{ fontSize:'1.25rem', fontWeight:600, color:'#0f172a', marginBottom:8 }}>Landlord-Friendly Score</h3>
                  <div style={{ fontSize:'2.5rem', fontWeight:800, color:'#0ea5e9', marginBottom:8 }}>
                    {(Number(results.landlord_friendly_score) > 1 ? Number(results.landlord_friendly_score).toFixed(1) : (Number(results.landlord_friendly_score)*5).toFixed(1))}/5
                  </div>
                  {results.landlord_friendly_note && (
                    <div style={{ fontSize:'0.875rem', color:'#64748b', marginTop:8 }}>{results.landlord_friendly_note}</div>
                  )}
                </div>
              )}

              {/* AI Market Score removed to match Results tab UI */}

              {/* Perplexity AI Investment Analysis (use SectionCard for Results parity) */}
              {(aiSummary || summaryLoading || summaryError) && (
                <SectionCard title="AI Investment Analysis" icon={Sparkles}>
                  {summaryError && (
                    <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={16} />
                      {summaryError}
                    </div>
                  )}

                  {summaryLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6366f1' }}>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Analyzing market data and generating investment insights...</span>
                    </div>
                  )}

                  {aiSummary && (
                    <div style={{ color: '#1e293b', fontSize: '0.95rem', lineHeight: '1.7', maxHeight: '600px', overflowY: 'auto' }}>
                      <ReactMarkdown
                        components={{
                          h1: ({children}) => <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '12px' }}>{children}</h1>,
                          h2: ({children}) => <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e40af', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>{children}</h2>,
                          h3: ({children}) => <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginTop: '16px', marginBottom: '8px' }}>{children}</h3>,
                          p: ({children}) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                          ul: ({children}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                          li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                          strong: ({children}) => <strong style={{ color: '#111827', fontWeight: '700' }}>{children}</strong>
                        }}
                      >
                        {aiSummary}
                      </ReactMarkdown>
                    </div>
                  )}
                </SectionCard>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div ref={chartsRef} style={{ display:'flex', flexDirection:'column', gap:24 }}>
              <LineChart
                title="Population Trend"
                width={chartsWidth - 16}
                points={[
                  { xLabel: '2017', y: results.population_2017 != null ? Number(results.population_2017) : null },
                  { xLabel: '2023', y: results.population != null ? Number(results.population) : null }
                ]}
              />
              
              <FMRChart
                title="HUD Fair Market Rents"
                width={chartsWidth - 16}
                fmrs={{
                  fmr_0br: results.fmr_0br,
                  fmr_1br: results.fmr_1br,
                  fmr_2br: results.fmr_2br,
                  fmr_3br: results.fmr_3br,
                  fmr_4br: results.fmr_4br
                }}
              />
              {/* Live rent charts removed to match Results tab UI; keep FMRChart visible */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketAnalysisPage;