/* eslint-disable */
// DocumentAnalysisTab - Try Cactus-style comprehensive OM analysis
// Renders Claude-generated analysis with rich formatting
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, AlertTriangle, TrendingUp, Search, Shield, HelpCircle, BarChart3, Loader2, RefreshCw, ChevronDown, ChevronUp, Download } from 'lucide-react';

// Section icon/color mapping
const SECTION_META = {
  'executive summary': { icon: '📋', color: '#1e3a5f', bg: '#eff6ff' },
  'investment thesis': { icon: '🔍', color: '#065f46', bg: '#ecfdf5' },
  'swot': { icon: '📊', color: '#7c3aed', bg: '#f5f3ff' },
  'cross-document': { icon: '📝', color: '#92400e', bg: '#fffbeb' },
  'trend analysis': { icon: '📈', color: '#0369a1', bg: '#f0f9ff' },
  'occupancy': { icon: '🏢', color: '#4338ca', bg: '#eef2ff' },
  'rent': { icon: '🔑', color: '#b45309', bg: '#fffbeb' },
  'tenancy': { icon: '🔑', color: '#b45309', bg: '#fffbeb' },
  'occupancy bridge': { icon: '🏗️', color: '#0891b2', bg: '#ecfeff' },
  'pro-forma': { icon: '📝', color: '#9333ea', bg: '#faf5ff' },
  'management assumption': { icon: '📝', color: '#9333ea', bg: '#faf5ff' },
  'operational': { icon: '⚙️', color: '#475569', bg: '#f8fafc' },
  'capex': { icon: '⚙️', color: '#475569', bg: '#f8fafc' },
  'market': { icon: '🌐', color: '#0d9488', bg: '#f0fdfa' },
  'supply': { icon: '🌐', color: '#0d9488', bg: '#f0fdfa' },
  'red flag': { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  'questions': { icon: '❓', color: '#2563eb', bg: '#eff6ff' },
  'seller': { icon: '❓', color: '#2563eb', bg: '#eff6ff' },
  'broker': { icon: '❓', color: '#2563eb', bg: '#eff6ff' },
  'scenario': { icon: '🎯', color: '#ea580c', bg: '#fff7ed' },
  'sensitivity': { icon: '🎯', color: '#ea580c', bg: '#fff7ed' },
  'data-quality': { icon: '🗂️', color: '#64748b', bg: '#f1f5f9' },
  'heat-map': { icon: '🗂️', color: '#64748b', bg: '#f1f5f9' },
};

function getSectionMeta(title) {
  const lower = title.toLowerCase();
  for (const [key, meta] of Object.entries(SECTION_META)) {
    if (lower.includes(key)) return meta;
  }
  return { icon: '📄', color: '#374151', bg: '#f9fafb' };
}

// Parse markdown tables into structured data
function parseMarkdownTable(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  
  const parseRow = (line) => line.split('|').map(c => c.trim()).filter(c => c.length > 0);
  
  const headers = parseRow(lines[0]);
  // Skip separator line (line with ---)
  const startIdx = lines[1] && lines[1].includes('---') ? 2 : 1;
  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('---')) continue;
    const cells = parseRow(lines[i]);
    if (cells.length > 0) rows.push(cells);
  }
  
  return { headers, rows };
}

// Render a parsed table with nice styling
function StyledTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ 
                padding: '10px 14px', 
                textAlign: i === 0 ? 'left' : 'left', 
                fontWeight: '600', 
                fontSize: '12px',
                whiteSpace: 'nowrap',
                borderBottom: '2px solid #0f2440'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ 
              backgroundColor: ri % 2 === 0 ? 'white' : '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ 
                  padding: '9px 14px', 
                  color: '#374151',
                  fontWeight: ci === 0 ? '600' : '400'
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Custom markdown components for rich rendering
const markdownComponents = {
  p: ({ children }) => (
    <p style={{ marginBottom: '10px', marginTop: 0, lineHeight: '1.7', color: '#374151', fontSize: '14px' }}>{children}</p>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: '6px', lineHeight: '1.65', color: '#374151', fontSize: '14px' }}>{children}</li>
  ),
  ul: ({ children }) => (
    <ul style={{ marginBottom: '12px', paddingLeft: '20px', listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ marginBottom: '12px', paddingLeft: '20px' }}>{children}</ol>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: '#111827' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '13px' }}>{children}</em>
  ),
  h1: ({ children }) => (
    <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '12px', marginTop: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '10px', marginTop: '18px' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '8px', marginTop: '14px' }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', marginBottom: '6px', marginTop: '10px' }}>{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ 
      borderLeft: '3px solid #3b82f6', 
      paddingLeft: '14px', 
      margin: '12px 0', 
      color: '#4b5563',
      backgroundColor: '#f0f9ff',
      padding: '10px 14px',
      borderRadius: '0 6px 6px 0'
    }}>{children}</blockquote>
  ),
  code: ({ children }) => (
    <code style={{ 
      backgroundColor: '#f3f4f6', 
      padding: '2px 6px', 
      borderRadius: '4px', 
      fontSize: '12px', 
      fontFamily: 'monospace',
      color: '#1e40af'
    }}>{children}</code>
  ),
  // Table components for inline markdown tables
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ backgroundColor: '#1e3a5f', color: 'white' }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', fontSize: '12px', borderBottom: '2px solid #0f2440', color: 'white' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '9px 14px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{children}</td>
  ),
  tr: ({ children, ...props }) => (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>{children}</tr>
  ),
};

// Parse analysis text into sections
function parseAnalysisSections(text) {
  if (!text) return [];
  
  // Split by numbered section headers like "1. Executive Summary" or "## 1."
  // Also handles "**1. Executive Summary**" and plain numbered sections
  const sectionRegex = /^(?:#{1,3}\s*)?(?:\*{0,2})?\s*(\d{1,2})\.\s*(.+?)(?:\*{0,2})?\s*$/gm;
  
  const sections = [];
  let lastIndex = 0;
  let match;
  const matches = [];
  
  while ((match = sectionRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      fullMatch: match[0],
      number: parseInt(match[1]),
      title: match[2].replace(/\*+/g, '').trim()
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.substring(current.index + current.fullMatch.length, nextStart).trim();
    
    sections.push({
      number: current.number,
      title: current.title,
      content: content,
      meta: getSectionMeta(current.title)
    });
  }
  
  // If no sections parsed, treat the whole thing as one section
  if (sections.length === 0 && text.trim().length > 0) {
    sections.push({
      number: 1,
      title: 'Documents Analysis',
      content: text,
      meta: getSectionMeta('executive summary')
    });
  }
  
  return sections;
}

// Render a section's content - handles tables embedded in markdown
function SectionContent({ content }) {
  // Split content by table blocks (lines starting with |)
  const parts = [];
  const lines = content.split('\n');
  let currentBlock = [];
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');
    
    if (isTableLine && !inTable) {
      // Start of table - flush current markdown block
      if (currentBlock.length > 0) {
        parts.push({ type: 'markdown', content: currentBlock.join('\n') });
        currentBlock = [];
      }
      inTable = true;
      currentBlock.push(line);
    } else if (isTableLine && inTable) {
      currentBlock.push(line);
    } else if (!isTableLine && inTable) {
      // End of table
      const tableData = parseMarkdownTable(currentBlock.join('\n'));
      if (tableData && tableData.headers.length > 0 && tableData.rows.length > 0) {
        parts.push({ type: 'table', data: tableData });
      } else {
        parts.push({ type: 'markdown', content: currentBlock.join('\n') });
      }
      currentBlock = [line];
      inTable = false;
    } else {
      currentBlock.push(line);
    }
  }
  
  // Flush remaining
  if (currentBlock.length > 0) {
    if (inTable) {
      const tableData = parseMarkdownTable(currentBlock.join('\n'));
      if (tableData && tableData.headers.length > 0 && tableData.rows.length > 0) {
        parts.push({ type: 'table', data: tableData });
      } else {
        parts.push({ type: 'markdown', content: currentBlock.join('\n') });
      }
    } else {
      parts.push({ type: 'markdown', content: currentBlock.join('\n') });
    }
  }
  
  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === 'table') {
          return <StyledTable key={i} headers={part.data.headers} rows={part.data.rows} />;
        }
        return (
          <ReactMarkdown key={i} components={markdownComponents}>
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

// Collapsible section component
function AnalysisSection({ section, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { number, title, content, meta } = section;
  
  return (
    <div data-section-wrapper style={{ 
      marginBottom: '16px',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      {/* Section header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: 'none',
          backgroundColor: meta.bg,
          cursor: 'pointer',
          textAlign: 'left',
          borderBottom: isOpen ? `2px solid ${meta.color}22` : 'none',
          transition: 'background-color 0.15s'
        }}
      >
        <span style={{ fontSize: '18px' }}>{meta.icon}</span>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: meta.color,
          flex: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.3px'
        }}>
          {title}
        </span>
        {isOpen ? <ChevronUp size={18} color={meta.color} /> : <ChevronDown size={18} color={meta.color} />}
      </button>
      
      {/* Section content */}
      <div data-section-content style={{ display: isOpen ? 'block' : 'none', padding: '20px 24px' }}>
        <SectionContent content={content} />
      </div>
    </div>
  );
}

// Main DocumentAnalysisTab component
export default function DocumentAnalysisTab({ 
  dealId, 
  scenarioData, 
  fullCalcs,
  existingAnalysis,
  onAnalysisGenerated 
}) {
  const [analysis, setAnalysis] = useState(existingAnalysis || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [includeMarketResearch, setIncludeMarketResearch] = useState(true);
  const [generationProgress, setGenerationProgress] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const contentRef = useRef(null);
  
  // Property info for header — must be before callbacks that reference it
  const property = scenarioData?.property || {};
  const addressParts = [property.address, property.city, property.state, property.zip].filter(Boolean);
  const propertyName = property.name || addressParts.join(', ') || 'Subject Property';
  const totalUnits = property.total_units || property.units || 'N/A';
  
  // If existingAnalysis changes from parent, update local state
  useEffect(() => {
    if (existingAnalysis && existingAnalysis !== analysis) {
      setAnalysis(existingAnalysis);
    }
  }, [existingAnalysis]);
  
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress('Preparing analysis data...');
    
    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';
      
      setGenerationProgress(includeMarketResearch 
        ? 'Fetching market research data via Perplexity...' 
        : 'Skipping market research...');
      
      // Use a timeout to show progress updates
      const progressTimer = setTimeout(() => {
        setGenerationProgress('Running comprehensive analysis with Claude AI...');
      }, includeMarketResearch ? 8000 : 2000);
      
      const progressTimer2 = setTimeout(() => {
        setGenerationProgress('Generating 15-section due diligence report...');
      }, includeMarketResearch ? 20000 : 12000);
      
      const progressTimer3 = setTimeout(() => {
        setGenerationProgress('Finalizing analysis — this takes 30-60 seconds...');
      }, 35000);
      
      const response = await fetch(`${API_BASE}/v2/deals/${dealId}/document-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_market_research: includeMarketResearch,
          scenario_data: scenarioData
        })
      });
      
      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Analysis failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        // Notify parent to store in scenarioData
        if (onAnalysisGenerated) {
          onAnalysisGenerated(data.analysis);
        }
        // Save analysis to backend deal storage for persistence
        try {
          await fetch(`${API_BASE}/v2/deals/${dealId}/save-scenario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...scenarioData,
              document_analysis: data.analysis
            })
          });
        } catch (saveErr) {
          console.warn('[DocumentAnalysis] Could not save analysis to backend:', saveErr);
        }
      } else {
        throw new Error('No analysis returned from server');
      }
      
    } catch (err) {
      console.error('[DocumentAnalysis] Error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  }, [dealId, scenarioData, includeMarketResearch, onAnalysisGenerated]);
  
  // PDF Export
  const handleExportPDF = useCallback(async () => {
    if (!contentRef.current) return;
    setIsExportingPDF(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Expand all sections before capture
      const details = contentRef.current.querySelectorAll('[data-section-wrapper]');
      const originalStates = [];
      details.forEach(el => {
        const content = el.querySelector('[data-section-content]');
        if (content) {
          originalStates.push({ el: content, display: content.style.display, maxHeight: content.style.maxHeight });
          content.style.display = 'block';
          content.style.maxHeight = 'none';
        }
      });
      
      await new Promise(r => setTimeout(r, 300));
      
      const canvas = await html2canvas(contentRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#f9fafb',
        logging: false,
        windowWidth: 1100
      });
      
      // Restore collapsed sections
      originalStates.forEach(({ el, display, maxHeight }) => {
        el.style.display = display;
        el.style.maxHeight = maxHeight;
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageContentHeight = pageHeight - margin * 2;
      
      let yOffset = 0;
      let pageNum = 0;
      
      while (yOffset < imgHeight) {
        if (pageNum > 0) pdf.addPage();
        
        const sourceY = (yOffset / imgHeight) * canvas.height;
        const sourceH = Math.min((pageContentHeight / imgHeight) * canvas.height, canvas.height - sourceY);
        
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sourceH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
        
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const sliceH = (sourceH * imgWidth) / canvas.width;
        pdf.addImage(sliceData, 'JPEG', margin, margin, imgWidth, sliceH);
        
        yOffset += pageContentHeight;
        pageNum++;
      }
      
      const filename = `${propertyName.replace(/[^a-zA-Z0-9]/g, '_')}_Documents_Analysis.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('[DocumentAnalysis] PDF export error:', err);
      alert('PDF export failed: ' + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  }, [propertyName]);

  // Parse sections from analysis
  const sections = analysis ? parseAnalysisSections(analysis) : [];
  
  // If no analysis yet, show the generation UI
  if (!analysis) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '80vh' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ 
            backgroundColor: '#1e3a5f', 
            borderRadius: '16px 16px 0 0', 
            padding: '28px 32px',
            color: 'white'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', opacity: 0.8, marginBottom: '6px' }}>
              INSTITUTIONAL DUE DILIGENCE
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
              Documents Analysis
            </h1>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>
              {propertyName} • {totalUnits} Units
            </div>
          </div>
          
          {/* Generation Card */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0 0 16px 16px', 
            padding: '40px 32px',
            border: '1px solid #e5e7eb',
            borderTop: 'none'
          }}>
            {isGenerating ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '60px', height: '60px', 
                  borderRadius: '50%', 
                  backgroundColor: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  animation: 'pulse 2s infinite'
                }}>
                  <Loader2 size={28} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                  Generating Analysis...
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', maxWidth: '400px', margin: '0 auto' }}>
                  {generationProgress}
                </p>
                <div style={{ 
                  marginTop: '24px', 
                  height: '4px', 
                  backgroundColor: '#e5e7eb', 
                  borderRadius: '2px', 
                  overflow: 'hidden',
                  maxWidth: '300px',
                  margin: '24px auto 0'
                }}>
                  <div style={{ 
                    height: '100%', 
                    backgroundColor: '#2563eb',
                    borderRadius: '2px',
                    animation: 'progressBar 45s ease-out forwards'
                  }} />
                </div>
                <style>{`
                  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                  @keyframes progressBar { 0% { width: 5%; } 30% { width: 40%; } 60% { width: 65%; } 80% { width: 80%; } 100% { width: 95%; } }
                `}</style>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <div style={{ 
                    width: '56px', height: '56px', 
                    borderRadius: '50%', 
                    backgroundColor: '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <FileText size={26} color="#2563eb" />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                    Generate Documents Analysis
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                    Run a comprehensive 15-section institutional-grade due diligence analysis on the uploaded offering memorandum. 
                    Powered by Claude AI with optional Perplexity market research.
                  </p>
                </div>
                
                {/* Sections preview */}
                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '10px', 
                  padding: '16px 20px', 
                  marginBottom: '24px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
                    Analysis Sections
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[
                      '📋 Executive Summary',
                      '🔍 Investment Thesis',
                      '📊 SWOT Analysis',
                      '📝 Cross-Doc Synthesis',
                      '📈 Trend Analysis',
                      '🏢 Occupancy Analysis',
                      '🔑 Rent Forensics',
                      '🏗️ Occupancy Bridge',
                      '📝 Pro-Forma Checks',
                      '⚙️ OpEx & CapEx',
                      '🌐 Market Context',
                      '⚠️ Red Flags',
                      '❓ Seller Questions',
                      '🎯 Scenario Narrative',
                      '🗂️ Data Quality Map'
                    ].map((s, i) => (
                      <div key={i} style={{ 
                        fontSize: '12px', 
                        color: '#374151', 
                        padding: '4px 0' 
                      }}>{s}</div>
                    ))}
                  </div>
                </div>
                
                {/* Market research toggle */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '10px', 
                  marginBottom: '24px' 
                }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={includeMarketResearch}
                      onChange={(e) => setIncludeMarketResearch(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600 }}>Include Perplexity Market Research</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>(adds ~10s, more accurate)</span>
                  </label>
                </div>
                
                {/* Error display */}
                {error && (
                  <div style={{ 
                    padding: '12px 16px', 
                    backgroundColor: '#fef2f2', 
                    borderRadius: '8px', 
                    border: '1px solid #fecaca',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#991b1b'
                  }}>
                    <strong>Error:</strong> {error}
                  </div>
                )}
                
                {/* Generate button */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleGenerate}
                    style={{
                      padding: '14px 40px',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'white',
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)'; }}
                    onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 14px rgba(37,99,235,0.35)'; }}
                  >
                    Generate Analysis (1 Token)
                  </button>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                    Takes 30-60 seconds • Uses Claude AI + Perplexity
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // ANALYSIS RESULTS VIEW
  // ============================================================================
  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }} ref={contentRef}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Report Header */}
        <div style={{ 
          backgroundColor: '#1e3a5f', 
          borderRadius: '14px', 
          padding: '24px 28px',
          color: 'white',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', opacity: 0.8, marginBottom: '4px' }}>
              DOCUMENTS ANALYSIS
            </div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
              {propertyName}
            </h1>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
              {totalUnits} Units • Comprehensive Due Diligence Report
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e3a5f',
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isGenerating ? 0.6 : 1
              }}
            >
              <RefreshCw size={14} style={{ animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
              {isGenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e3a5f',
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isExportingPDF ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isExportingPDF ? 0.6 : 1
              }}
            >
              <Download size={14} />
              {isExportingPDF ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>
        
        {/* Loading overlay for regeneration */}
        {isGenerating && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '10px', 
            marginBottom: '16px',
            textAlign: 'center',
            border: '1px solid #bfdbfe'
          }}>
            <Loader2 size={20} color="#2563eb" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }} />
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: 600 }}>{generationProgress || 'Regenerating analysis...'}</span>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: '#fef2f2', 
            borderRadius: '8px', 
            border: '1px solid #fecaca',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#991b1b'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {/* Analysis Sections */}
        {sections.map((section, i) => (
          <AnalysisSection 
            key={i} 
            section={section} 
            defaultOpen={i < 4} 
          />
        ))}
        
        {/* If no sections parsed, render raw */}
        {sections.length === 0 && analysis && (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '24px', 
            border: '1px solid #e5e7eb' 
          }}>
            <ReactMarkdown components={markdownComponents}>{analysis}</ReactMarkdown>
          </div>
        )}
        
        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          padding: '20px 0', 
          fontSize: '11px', 
          color: '#9ca3af' 
        }}>
          Generated by DealSniper AI • Claude + Perplexity • This analysis is for informational purposes only
        </div>
        
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
