// UnderwriteAnalysisPage - AI Underwriting Analysis Page
// Shows between wizard verification and results page
// Displays 8-section analysis with verdict and chat for follow-up questions

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Loader, AlertCircle, CheckCircle, TrendingUp, TrendingDown,
  DollarSign, Building, FileText, ArrowRight, ArrowLeft, RefreshCw,
  Target, AlertTriangle, Zap, Calculator, MessageCircle, Send, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = "http://localhost:8010";

// Styles - Light theme matching the rest of the app
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '40px 20px 120px', // Extra bottom padding for chat input bar
    color: '#111827'
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32
  },
  title: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#111827',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: 4
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
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    boxShadow: '0 4px 6px rgba(0,0,0,0.04)'
  },
  loadingCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 60,
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.04)'
  },
  verdictCard: {
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    textAlign: 'center'
  },
  verdictBuy: {
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    border: '2px solid #10b981'
  },
  verdictMaybe: {
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '2px solid #f59e0b'
  },
  verdictPass: {
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '2px solid #ef4444'
  },
  verdictEmoji: {
    fontSize: '4rem',
    marginBottom: 16
  },
  verdictText: {
    fontSize: '2.5rem',
    fontWeight: 900,
    marginBottom: 8
  },
  verdictReason: {
    fontSize: '1.1rem',
    color: '#4b5563',
    maxWidth: 600,
    margin: '0 auto'
  },
  analysisSection: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111827',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  sectionSplit: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1.2fr)',
    gap: 24,
    alignItems: 'flex-start'
  },
  sectionContentLeft: {
    fontSize: '0.95rem',
    lineHeight: 1.7,
    color: '#374151'
  },
  sectionContentRight: {
    fontSize: '0.9rem',
    color: '#111827',
    borderLeft: '1px solid #e5e7eb',
    paddingLeft: 16
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    marginBottom: 12
  },
  // Chat styles - ChatGPT style
  buttonRow: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    marginTop: 32,
    flexWrap: 'wrap'
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 28px',
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  dealSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16,
    marginBottom: 24
  },
  summaryItem: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 16,
    textAlign: 'center'
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4
  },
  summaryValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111827'
  },
  spinner: {
    width: 60,
    height: 60,
    border: '4px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px'
  },
  progressText: {
    fontSize: '1.1rem',
    color: '#374151',
    marginBottom: 8
  },
  progressSubtext: {
    fontSize: '0.9rem',
    color: '#6b7280'
  },
  // Chat styles - ChatGPT style
  chatContainer: {
    marginTop: 24,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    boxShadow: '0 4px 6px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '50vh'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    flexShrink: 0
  },
  chatTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#374151'
  },
  chatClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 120
  },
  chatMessage: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
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
  },
  chatInputArea: {
    padding: '12px 20px 20px',
    background: '#fff',
    flexShrink: 0,
    borderTop: '1px solid #e5e7eb'
  },
  chatInputWrapper: {
    maxWidth: 800,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
    background: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: 24,
    padding: '8px 8px 8px 16px',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  chatTextarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 15,
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
    minHeight: 24,
    maxHeight: 150,
    padding: '4px 0',
    fontFamily: 'inherit'
  },
  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s'
  },
  // no fixed bottom bar here; chat is embedded in the page
};

// Add CSS animation for spinner
const spinnerKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

function UnderwriteAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatMessagesRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Get deal data from navigation state
  const { dealId, verifiedData } = location.state || {};
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Auto-resize textarea
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Run underwriting on mount
  useEffect(() => {
    if (!dealId) {
      setError('No deal ID provided. Please go back and upload a document.');
      setIsLoading(false);
      return;
    }
    
    runUnderwriting();
  }, [dealId]);

  const runUnderwriting = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingStep('Connecting to AI underwriter...');
    
    try {
      // Simulate progress steps
      setTimeout(() => setLoadingStep('Analyzing property financials...'), 1500);
      setTimeout(() => setLoadingStep('Calculating debt service coverage...'), 3000);
      setTimeout(() => setLoadingStep('Evaluating value-add opportunities...'), 5000);
      setTimeout(() => setLoadingStep('Modeling creative financing structures...'), 7000);
      setTimeout(() => setLoadingStep('Running refi analysis...'), 9000);
      setTimeout(() => setLoadingStep('Generating final verdict...'), 11000);
      
      const dealParams = JSON.parse(localStorage.getItem('dealParams') || '{}');

      // Normalize payload for backend: when underwriting_mode === 'my_buy_box',
      // send a flat buy_box with mode flag so the prompt can use it.
      let payload = {};
      if (dealParams.underwriting_mode === 'my_buy_box' && dealParams.buy_box) {
        payload = {
          underwriting_mode: 'my_buy_box',
          buy_box: {
            mode: 'my_buy_box',
            ...dealParams.buy_box
          }
        };
      } else {
        payload = {
          underwriting_mode: dealParams.underwriting_mode || 'standard'
        };
      }

      const response = await fetch(`${API_BASE}/v2/deals/${dealId}/underwrite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Underwriting failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      setAnalysis(data.analysis);
      setVerdict(data.verdict);
      setSummary(data.summary);
      
      // Initialize chat with the analysis context
      setChatMessages([{
        role: 'assistant',
        content: `I've completed the underwriting analysis for this deal. The verdict is **${data.verdict}**. Feel free to ask me any questions about the analysis, creative financing options, or what could make this deal work better.`
      }]);
      
    } catch (err) {
      console.error('Underwriting error:', err);
      setError(err.message || 'Failed to run AI underwriting');
    } finally {
      setIsLoading(false);
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending || !dealId) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    const newMessages = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE}/v2/deals/${dealId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          llm: 'openai',
          model: 'gpt-4o-mini',
          buy_box: JSON.parse(localStorage.getItem('dealParams') || '{}')
        })
      });

      if (!response.ok) {
        throw new Error('Chat failed');
      }

      const data = await response.json();
      setChatMessages([...newMessages, { role: 'assistant', content: data.message.content }]);
      
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages([...newMessages, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  // Parse analysis into sections
  const parseSections = (text) => {
    if (!text) return [];
    
    const sections = [];
    const sectionHeaders = [
      { pattern: /##?\s*1\.?\s*DEAL SNAPSHOT/i, title: 'Deal Snapshot', icon: Building },
      { pattern: /##?\s*2\.?\s*DAY[- ]ONE FINANCIALS/i, title: 'Day-One Financials', icon: DollarSign },
      { pattern: /##?\s*3\.?\s*VALUE[- ]ADD OPPORTUNITIES/i, title: 'Value-Add Opportunities', icon: TrendingUp },
      { pattern: /##?\s*4\.?\s*CREATIVE STRUCTURE A/i, title: 'Creative Structure A — Seller Carry', icon: Calculator },
      { pattern: /##?\s*5\.?\s*CREATIVE STRUCTURE B/i, title: 'Creative Structure B — Equity Partner', icon: Target },
      { pattern: /##?\s*6\.?\s*REFI|EXIT ANALYSIS/i, title: 'Refi / Exit Analysis', icon: RefreshCw },
      { pattern: /##?\s*7\.?\s*RISKS|RED FLAGS/i, title: 'Risks / Red Flags', icon: AlertTriangle },
      { pattern: /##?\s*8\.?\s*FINAL VERDICT/i, title: 'Final Verdict', icon: Zap }
    ];
    
    let currentIndex = 0;
    
    sectionHeaders.forEach((header, i) => {
      const match = text.match(header.pattern);
      if (match) {
        const startIndex = text.indexOf(match[0]);
        
        // Find the end (start of next section or end of text)
        let endIndex = text.length;
        for (let j = i + 1; j < sectionHeaders.length; j++) {
          const nextMatch = text.match(sectionHeaders[j].pattern);
          if (nextMatch) {
            const nextIndex = text.indexOf(nextMatch[0]);
            if (nextIndex > startIndex && nextIndex < endIndex) {
              endIndex = nextIndex;
              break;
            }
          }
        }
        
        const content = text.substring(startIndex + match[0].length, endIndex).trim();
        sections.push({
          title: header.title,
          Icon: header.icon,
          content: content
        });
      }
    });
    
    // If no sections found, just show the whole thing
    if (sections.length === 0) {
      sections.push({
        title: 'Analysis',
        Icon: FileText,
        content: text
      });
    }
    
    return sections;
  };

  const getVerdictStyle = () => {
    switch (verdict) {
      case 'BUY': return styles.verdictBuy;
      case 'PASS': return styles.verdictPass;
      default: return styles.verdictMaybe;
    }
  };

  const getVerdictEmoji = () => {
    switch (verdict) {
      case 'BUY': return '🟢';
      case 'PASS': return '🔴';
      default: return '🟡';
    }
  };

  const getVerdictColor = () => {
    switch (verdict) {
      case 'BUY': return '#10b981';
      case 'PASS': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  // Extract final verdict reason from analysis
  const extractVerdictReason = () => {
    if (!analysis) return '';
    
    // Look for the verdict section
    const verdictMatch = analysis.match(/(?:BUY|MAYBE|PASS)\s+because[:\s]+([^.]+\.)/i);
    if (verdictMatch) return verdictMatch[1];
    
    // Look for text after the verdict emoji
    const emojiMatch = analysis.match(/(?:🟢|🟡|🔴)[^\n]*(?:BUY|MAYBE|PASS)[^\n]*/i);
    if (emojiMatch) return emojiMatch[0].replace(/🟢|🟡|🔴/g, '').trim();
    
    return '';
  };

  const handleContinueToResults = () => {
    navigate('/underwrite', {
      state: {
        dealId,
        verifiedData,
        goToResults: true,
        underwritingResult: {
          analysis,
          verdict,
          summary
        }
      }
    });
  };

  const handleBackToWizard = () => {
    navigate('/underwrite', {
      state: {
        dealId,
        verifiedData,
        returnToWizard: true
      }
    });
  };

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div style={styles.page}>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>AI Underwriting Analysis</h1>
              <p style={styles.subtitle}>
                {summary?.address || 'Analyzing your deal...'}
              </p>
            </div>
            <button 
              style={styles.homeButton}
              onClick={() => navigate('/')}
            >
              <Home size={18} />
              Home
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div style={styles.loadingCard}>
              <div style={styles.spinner} />
              <p style={styles.progressText}>{loadingStep}</p>
              <p style={styles.progressSubtext}>
                Claude is performing comprehensive deal analysis...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div style={{...styles.card, borderColor: '#ef4444'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <AlertCircle size={24} color="#ef4444" />
                <h3 style={{ color: '#ef4444', margin: 0 }}>Analysis Failed</h3>
              </div>
              <p style={{ color: '#cbd5e1', marginBottom: 24 }}>{error}</p>
              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={handleBackToWizard}>
                  <ArrowLeft size={18} />
                  Back to Wizard
                </button>
                <button style={styles.primaryButton} onClick={runUnderwriting}>
                  <RefreshCw size={18} />
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {!isLoading && !error && analysis && (
            <>
              {/* Deal Summary Bar */}
              {summary && (
                <div style={styles.dealSummary}>
                  <div style={styles.summaryItem}>
                    <div style={styles.summaryLabel}>Property</div>
                    <div style={styles.summaryValue}>{summary.units || '—'} Units</div>
                  </div>
                  <div style={styles.summaryItem}>
                    <div style={styles.summaryLabel}>Price</div>
                    <div style={styles.summaryValue}>{formatCurrency(summary.price)}</div>
                  </div>
                  <div style={styles.summaryItem}>
                    <div style={styles.summaryLabel}>NOI</div>
                    <div style={styles.summaryValue}>{formatCurrency(summary.noi)}</div>
                  </div>
                  <div style={styles.summaryItem}>
                    <div style={styles.summaryLabel}>Cap Rate</div>
                    <div style={styles.summaryValue}>{summary.cap_rate?.toFixed(2) || '—'}%</div>
                  </div>
                  <div style={styles.summaryItem}>
                    <div style={styles.summaryLabel}>Verdict</div>
                    <div style={{...styles.summaryValue, color: getVerdictColor()}}>
                      {getVerdictEmoji()} {verdict}
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis + Structured Tables Side-by-Side */}
              {parseSections(analysis).map((section, idx) => (
                <div key={idx} style={styles.analysisSection}>
                  <div style={styles.sectionTitle}>
                    <section.Icon size={22} color="#2563eb" />
                    {section.title}
                  </div>

                  <div style={styles.sectionSplit}> 
                    {/* Left: LLM narrative */}
                    <div style={styles.sectionContentLeft}>
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p style={{marginBottom: 12}}>{children}</p>,
                          ul: ({children}) => <ul style={{marginLeft: 20, marginBottom: 12}}>{children}</ul>,
                          li: ({children}) => <li style={{marginBottom: 6}}>{children}</li>,
                          strong: ({children}) => <strong style={{color: '#111827'}}>{children}</strong>,
                          h3: ({children}) => <h3 style={{color: '#111827', marginTop: 16, marginBottom: 8}}>{children}</h3>,
                          h4: ({children}) => <h4 style={{color: '#374151', marginTop: 12, marginBottom: 6}}>{children}</h4>,
                        }}
                      >
                        {section.content}
                      </ReactMarkdown>
                    </div>

                    {/* Right: simple structured tables */}
                    <div style={styles.sectionContentRight}>
                      {section.title === 'Deal Snapshot' && summary && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Property</th><td>{summary.address || '—'}</td></tr>
                            <tr><th>Units</th><td>{summary.units ?? '—'}</td></tr>
                            <tr><th>Price</th><td>{formatCurrency(summary.price)}</td></tr>
                            <tr><th>NOI</th><td>{formatCurrency(summary.noi)}</td></tr>
                            <tr><th>Cap Rate</th><td>{summary.cap_rate != null ? `${summary.cap_rate.toFixed(2)}%` : '—'}</td></tr>
                          </tbody>
                        </table>
                      )}

                      {section.title === 'Day-One Financials' && verifiedData && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Purchase Price</th><td>{formatCurrency(verifiedData?.pricing_financing?.purchase_price)}</td></tr>
                            <tr><th>Loan Amount</th><td>{formatCurrency(verifiedData?.pricing_financing?.loan_amount)}</td></tr>
                            <tr><th>Down Payment</th><td>{formatCurrency(verifiedData?.pricing_financing?.down_payment)}</td></tr>
                            <tr><th>Interest Rate</th><td>{verifiedData?.pricing_financing?.interest_rate != null ? `${verifiedData.pricing_financing.interest_rate.toFixed(2)}%` : '—'}</td></tr>
                            <tr><th>Annual Debt Service</th><td>{formatCurrency(verifiedData?.pricing_financing?.annual_debt_service)}</td></tr>
                            <tr><th>Year 1 NOI</th><td>{formatCurrency(verifiedData?.pnl?.noi)}</td></tr>
                          </tbody>
                        </table>
                      )}

                      {section.title === 'Value-Add Opportunities' && verifiedData && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Current Avg Rent</th><td>{formatCurrency(verifiedData?.underwriting?.current_avg_rent)}</td></tr>
                            <tr><th>Target Avg Rent</th><td>{formatCurrency(verifiedData?.underwriting?.target_avg_rent)}</td></tr>
                            <tr><th>Projected NOI Uplift</th><td>{formatCurrency(verifiedData?.underwriting?.projected_noi_uplift)}</td></tr>
                            <tr><th>Stabilized NOI</th><td>{formatCurrency(verifiedData?.underwriting?.stabilized_noi)}</td></tr>
                            <tr><th>Stabilized Value</th><td>{formatCurrency(verifiedData?.underwriting?.stabilized_value)}</td></tr>
                          </tbody>
                        </table>
                      )}

                      {section.title.startsWith('Creative Structure A') && verifiedData && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Bank LTV</th><td>{verifiedData?.underwriting?.structure_a_bank_ltv ? `${verifiedData.underwriting.structure_a_bank_ltv.toFixed(1)}%` : '—'}</td></tr>
                            <tr><th>Seller Carry %</th><td>{verifiedData?.underwriting?.structure_a_seller_carry_pct ? `${verifiedData.underwriting.structure_a_seller_carry_pct.toFixed(1)}%` : '—'}</td></tr>
                            <tr><th>Total Cash In</th><td>{formatCurrency(verifiedData?.underwriting?.structure_a_cash_in)}</td></tr>
                            <tr><th>Monthly Cash Flow</th><td>{formatCurrency(verifiedData?.underwriting?.structure_a_monthly_cashflow)}</td></tr>
                            <tr><th>DSCR</th><td>{verifiedData?.underwriting?.structure_a_dscr != null ? verifiedData.underwriting.structure_a_dscr.toFixed(2) : '—'}</td></tr>
                          </tbody>
                        </table>
                      )}

                      {section.title.startsWith('Creative Structure B') && verifiedData && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Partner Equity %</th><td>{verifiedData?.underwriting?.structure_b_partner_equity_pct ? `${verifiedData.underwriting.structure_b_partner_equity_pct.toFixed(1)}%` : '—'}</td></tr>
                            <tr><th>Pref Rate</th><td>{verifiedData?.underwriting?.structure_b_pref_rate ? `${verifiedData.underwriting.structure_b_pref_rate.toFixed(1)}%` : '—'}</td></tr>
                            <tr><th>Real Cash In</th><td>{formatCurrency(verifiedData?.underwriting?.structure_b_real_cash_in)}</td></tr>
                            <tr><th>Monthly Cash Flow After Pref</th><td>{formatCurrency(verifiedData?.underwriting?.structure_b_monthly_cashflow_after_pref)}</td></tr>
                            <tr><th>DSCR</th><td>{verifiedData?.underwriting?.structure_b_dscr != null ? verifiedData.underwriting.structure_b_dscr.toFixed(2) : '—'}</td></tr>
                          </tbody>
                        </table>
                      )}

                      {section.title === 'Refi / Exit Analysis' && verifiedData && (
                        <table style={styles.table}>
                          <tbody>
                            <tr><th>Refi Year</th><td>{verifiedData?.underwriting?.refi_year ?? '—'}</td></tr>
                            <tr><th>Exit Cap Rate</th><td>{verifiedData?.underwriting?.exit_cap_rate != null ? `${verifiedData.underwriting.exit_cap_rate.toFixed(2)}%` : '—'}</td></tr>
                            <tr><th>Refi Value</th><td>{formatCurrency(verifiedData?.underwriting?.refi_value)}</td></tr>
                            <tr><th>Refi Proceeds</th><td>{formatCurrency(verifiedData?.underwriting?.refi_proceeds)}</td></tr>
                            <tr><th>Post-Refi DSCR</th><td>{verifiedData?.underwriting?.post_refi_dscr != null ? verifiedData.underwriting.post_refi_dscr.toFixed(2) : '—'}</td></tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Embedded Chat Under Summary */}
              <div style={styles.chatContainer}>
                <div style={styles.chatHeader}>
                  <div style={styles.chatTitle}>
                    <MessageCircle size={18} />
                    Ask About This Deal
                  </div>
                </div>

                <div style={styles.chatMessages} ref={chatMessagesRef}>
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.chatMessage,
                        ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage)
                      }}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isSending && (
                    <div style={{ ...styles.chatMessage, ...styles.assistantMessage }}>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>

                <div style={styles.chatInputArea}>
                  <div
                    style={{
                      ...styles.chatInputWrapper,
                      ...(isInputFocused
                        ? { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' }
                        : {})
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      style={styles.chatTextarea}
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        autoResizeTextarea();
                      }}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      rows={1}
                      disabled={isSending}
                    />
                    <button
                      style={{
                        ...styles.chatSendButton,
                        opacity: chatInput.trim() && !isSending ? 1 : 0.4,
                        cursor: chatInput.trim() && !isSending ? 'pointer' : 'not-allowed'
                      }}
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isSending}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={styles.buttonRow}>
                <button style={styles.secondaryButton} onClick={handleBackToWizard}>
                  <ArrowLeft size={18} />
                  Edit Deal Data
                </button>
                <button style={styles.secondaryButton} onClick={runUnderwriting}>
                  <RefreshCw size={18} />
                  Re-run Analysis
                </button>
                <button style={styles.primaryButton} onClick={handleContinueToResults}>
                  Continue to Results
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}

export default UnderwriteAnalysisPage;
