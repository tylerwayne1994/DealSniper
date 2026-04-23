/**
 * Claude Underwriter - Direct Claude Chat for Deal Underwriting
 * 
 * Features:
 * - Streaming chat with Claude
 * - PDF/document upload and preview in canvas
 * - Real-time artifact generation (spreadsheets, documents)
 * - Export to Excel, PDF
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Upload, FileText, X, Loader,
  FileSpreadsheet, File, Image, PanelRightClose,
  PanelRight, MessageSquare, Eye, Copy, Check, Table, FileDown,
  Building2, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import UnderwritingSpreadsheetTemplate from '../components/UnderwritingSpreadsheetTemplate';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

// ============================================================================
// Styles
// ============================================================================

const COLORS = {
  bg: '#f4f4f5',
  white: '#ffffff',
  border: '#e4e4e7',
  borderLight: '#f4f4f5',
  text: '#18181b',
  textMuted: '#71717a',
  textLight: '#a1a1aa',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  userBubble: '#2563eb',
  assistantBubble: '#ffffff',
  canvasBg: '#fafafa',
  artifactBg: '#f0fdf4',
  artifactBorder: '#86efac',
};

// ============================================================================
// Artifact Utilities
// ============================================================================

/**
 * Parse artifacts from Claude's response text.
 * Artifacts are formatted as: ```artifact:type:title\n...content...\n```
 */
const parseArtifacts = (text) => {
  const artifacts = [];
  const artifactRegex = /```artifact:(spreadsheet|document):([^\n]+)\n([\s\S]*?)```/g;
  let match;
  let cleanedText = text;
  
  while ((match = artifactRegex.exec(text)) !== null) {
    const [fullMatch, type, title, content] = match;
    const id = `artifact-${Date.now()}-${artifacts.length}`;
    
    let parsedData = null;
    if (type === 'spreadsheet') {
      try {
        parsedData = JSON.parse(content.trim());
      } catch (e) {
        console.error('Failed to parse spreadsheet artifact:', e);
        continue;
      }
    } else {
      parsedData = content.trim();
    }
    
    artifacts.push({
      id,
      type,
      title: title.trim(),
      data: parsedData,
      raw: content.trim(),
    });
    
    // Replace artifact in text with a reference
    cleanedText = cleanedText.replace(fullMatch, `\n\n**[Artifact: ${title.trim()}]** _(View in Canvas)_\n\n`);
  }
  
  return { artifacts, cleanedText };
};

// ============================================================================
// Spreadsheet Preview Component
// ============================================================================

const SpreadsheetPreview = ({ artifact, onDownload, isDownloading }) => {
  const [activeSheet, setActiveSheet] = useState(0);
  
  if (!artifact?.data?.sheets?.length) {
    return (
      <div style={{ padding: 20, color: COLORS.textMuted, textAlign: 'center' }}>
        No spreadsheet data
      </div>
    );
  }
  
  const sheets = artifact.data.sheets;
  const currentSheet = sheets[activeSheet];
  const data = currentSheet?.data || [];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          overflowX: 'auto',
        }}>
          {sheets.map((sheet, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSheet(idx)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: activeSheet === idx ? 600 : 400,
                background: activeSheet === idx ? COLORS.white : 'transparent',
                border: activeSheet === idx ? `1px solid ${COLORS.border}` : '1px solid transparent',
                borderRadius: 6,
                cursor: 'pointer',
                color: COLORS.text,
                whiteSpace: 'nowrap',
              }}
            >
              {sheet.name || `Sheet ${idx + 1}`}
            </button>
          ))}
        </div>
      )}
      
      {/* Title bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSpreadsheet size={16} color="#10b981" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{artifact.title}</span>
        </div>
        <button
          onClick={onDownload}
          disabled={isDownloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            opacity: isDownloading ? 0.7 : 1,
          }}
        >
          {isDownloading ? (
            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FileDown size={12} />
          )}
          Download .xlsx
        </button>
      </div>
      
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 12,
          fontFamily: 'ui-monospace, monospace',
        }}>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {(Array.isArray(row) ? row : [row]).map((cell, colIdx) => {
                  const isHeader = rowIdx === 0;
                  const CellTag = isHeader ? 'th' : 'td';
                  
                  // Format cell value
                  let displayValue = cell;
                  if (typeof cell === 'number') {
                    displayValue = cell.toLocaleString();
                  } else if (typeof cell === 'string' && cell.startsWith('=')) {
                    displayValue = cell; // Show formula
                  }
                  
                  return (
                    <CellTag
                      key={colIdx}
                      style={{
                        padding: '6px 10px',
                        border: `1px solid ${COLORS.border}`,
                        background: isHeader ? '#f5f5f5' : COLORS.white,
                        fontWeight: isHeader ? 600 : 400,
                        textAlign: typeof cell === 'number' ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayValue}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// Document Preview Component
// ============================================================================

const DocumentPreview = ({ artifact, onDownload, isDownloading }) => {
  if (!artifact?.data) {
    return (
      <div style={{ padding: 20, color: COLORS.textMuted, textAlign: 'center' }}>
        No document data
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Title bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} color="#2563eb" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{artifact.title}</span>
        </div>
        <button
          onClick={onDownload}
          disabled={isDownloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            opacity: isDownloading ? 0.7 : 1,
          }}
        >
          {isDownloading ? (
            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FileDown size={12} />
          )}
          Download PDF
        </button>
      </div>
      
      {/* Document content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 24,
        background: COLORS.white,
      }}>
        <div style={{
          maxWidth: 700,
          margin: '0 auto',
          fontSize: 14,
          lineHeight: 1.7,
        }}>
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px', borderBottom: `2px solid ${COLORS.primary}`, paddingBottom: 8 }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: 20, fontWeight: 600, color: COLORS.primary, margin: '24px 0 12px' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>{children}</h3>,
              p: ({ children }) => <p style={{ margin: '0 0 12px' }}>{children}</p>,
              ul: ({ children }) => <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0 0 12px', paddingLeft: 24 }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: 6 }}>{children}</li>,
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', margin: '16px 0' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
                </div>
              ),
              th: ({ children }) => <th style={{ border: `1px solid ${COLORS.border}`, padding: '8px 12px', background: '#f5f5f5', fontWeight: 600, textAlign: 'left' }}>{children}</th>,
              td: ({ children }) => <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px 12px' }}>{children}</td>,
              blockquote: ({ children }) => <blockquote style={{ borderLeft: `3px solid ${COLORS.primary}`, paddingLeft: 16, margin: '12px 0', color: COLORS.textMuted, fontStyle: 'italic' }}>{children}</blockquote>,
            }}
          >
            {artifact.data}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Components
// ============================================================================

// Chat Message Component
const ChatMessage = ({ message, isUser, isStreaming }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      paddingLeft: isUser ? 48 : 0,
      paddingRight: isUser ? 0 : 48,
    }}>
      <div style={{
        maxWidth: '100%',
        padding: isUser ? '12px 16px' : '0',
        borderRadius: isUser ? 16 : 0,
        background: isUser ? COLORS.userBubble : 'transparent',
        color: isUser ? '#fff' : COLORS.text,
      }}>
        {isUser ? (
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="markdown-content" style={{ fontSize: 14, lineHeight: 1.7 }}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: '0 0 12px 0' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: '0 0 12px 0', paddingLeft: 20 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: '0 0 12px 0', paddingLeft: 20 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                  h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, margin: '20px 0 12px' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 10px' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 8px' }}>{children}</h3>,
                  code: ({ inline, children }) => inline ? (
                    <code style={{
                      background: '#f4f4f5',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 13,
                    }}>{children}</code>
                  ) : (
                    <pre style={{
                      background: '#18181b',
                      color: '#fafafa',
                      padding: 16,
                      borderRadius: 8,
                      overflow: 'auto',
                      margin: '12px 0',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}><code>{children}</code></pre>
                  ),
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                      <table style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                        fontSize: 13,
                      }}>{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th style={{
                      border: '1px solid #e4e4e7',
                      padding: '8px 12px',
                      background: '#f4f4f5',
                      fontWeight: 600,
                      textAlign: 'left',
                    }}>{children}</th>
                  ),
                  td: ({ children }) => (
                    <td style={{
                      border: '1px solid #e4e4e7',
                      padding: '8px 12px',
                    }}>{children}</td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote style={{
                      borderLeft: '3px solid #e4e4e7',
                      paddingLeft: 16,
                      margin: '12px 0',
                      color: '#71717a',
                    }}>{children}</blockquote>
                  ),
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 18,
                  background: COLORS.primary,
                  marginLeft: 2,
                  animation: 'blink 1s infinite',
                }} />
              )}
            </div>
            {!isStreaming && message.content && (
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -40,
                  padding: 6,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: COLORS.textLight,
                  borderRadius: 4,
                }}
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// File Upload Chip
const FileChip = ({ file, onRemove }) => {
  const getIcon = () => {
    if (file.file_type === 'application/pdf') return <FileText size={14} />;
    if (file.file_type?.startsWith('image/')) return <Image size={14} />;
    return <File size={14} />;
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 500,
      color: '#1e40af',
    }}>
      {getIcon()}
      <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.filename}
      </span>
      <button
        onClick={() => onRemove(file.file_id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#1e40af',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
};

// Canvas Tab Button
const CanvasTab = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      background: active ? COLORS.white : 'transparent',
      border: active ? `1px solid ${COLORS.border}` : '1px solid transparent',
      borderBottom: active ? '1px solid #fff' : '1px solid transparent',
      borderRadius: '8px 8px 0 0',
      marginBottom: -1,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      color: active ? COLORS.text : COLORS.textMuted,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}
  >
    <Icon size={14} />
    {label}
  </button>
);

// PDF Viewer Component
const PDFViewer = ({ base64Data, filename }) => {
  if (!base64Data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: COLORS.textMuted,
      }}>
        <FileText size={48} strokeWidth={1} />
        <p style={{ marginTop: 12 }}>No PDF to display</p>
      </div>
    );
  }

  return (
    <iframe
      src={`data:application/pdf;base64,${base64Data}`}
      title={filename}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: 8,
      }}
    />
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function ClaudeUnderwritePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Deal context state (loaded from pipeline via ?dealId=)
  const [loadedDeal, setLoadedDeal] = useState(null);
  const [isLoadingDeal, setIsLoadingDeal] = useState(false); // eslint-disable-line no-unused-vars
  const [dealContextInjected, setDealContextInjected] = useState(false); // eslint-disable-line no-unused-vars
  const [dealBannerCollapsed, setDealBannerCollapsed] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // File state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showSpreadsheetTemplate, setShowSpreadsheetTemplate] = useState(false);
  const [spreadsheetTemplateData, setSpreadsheetTemplateData] = useState(null);

  // Canvas state
  const [showCanvas, setShowCanvas] = useState(true);
  const [activeCanvasTab, setActiveCanvasTab] = useState('artifacts'); // 'artifacts', 'document', 'chat'
  
  // Artifact state
  const [artifacts, setArtifacts] = useState([]);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Drag state
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/claude-chat/session`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setSessionId(data.session_id);
          setMessages([{
            role: 'assistant',
            content: `I'm your CRE underwriting partner. Upload your OM, rent roll, T12, or any deal documents and I'll analyze them from scratch — no broker assumptions, just the real numbers.\n\n**Quick actions:**\n- **"Build me a business plan"** → Full investment memo with value-add strategy, scenarios, and exit analysis\n- **"Build me an underwrite model"** → Spreadsheet with pro forma, returns, sensitivity\n- **"Write an executive summary"** → 1-page deal overview\n\n**I can also help you:**\n- Parse and verify all financial data from documents\n- Identify value-add opportunities (RUBS, expense optimization)\n- Structure the deal to maximize returns\n\nDrop your files or ask me anything about a deal.`
          }]);
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, []);

  // Load deal from URL param ?dealId=
  useEffect(() => {
    const dealId = searchParams.get('dealId');
    if (!dealId || !sessionId) return;

    const loadDealFromPipeline = async () => {
      setIsLoadingDeal(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: deal, error } = await supabase
          .from('deals')
          .select('*')
          .eq('deal_id', dealId)
          .eq('user_id', user.id)
          .single();

        if (error || !deal) {
          console.error('Deal not found:', error);
          return;
        }

        setLoadedDeal(deal);

        // Inject deal context into the session
        const res = await fetch(`${API_BASE}/api/claude-chat/inject-deal-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            deal_data: {
              address: deal.address,
              units: deal.units,
              purchase_price: deal.purchase_price,
              deal_structure: deal.deal_structure,
              notes: deal.notes,
              parsed_data: deal.parsed_data,
              scenario_data: deal.scenario_data,
            }
          }),
        });

        const result = await res.json();
        if (result.success) {
          setDealContextInjected(true);
          setMessages(prev => [...prev, {
            role: 'system',
            content: `✅ Deal loaded: **${deal.address}** — ${deal.units} units · $${(deal.purchase_price || 0).toLocaleString()} · All data is in context.`,
          }]);
        }
      } catch (err) {
        console.error('Failed to load deal:', err);
      } finally {
        setIsLoadingDeal(false);
      }
    };

    loadDealFromPipeline();
  }, [searchParams, sessionId]);

  // Fire "Generate Business Plan" directly
  const handleGenerateBusinessPlan = useCallback(async (extraInstructions = '') => {
    if (isStreaming || !sessionId) return;

    const userMessage = extraInstructions
      ? `Generate a complete professional business plan and investment memo for this deal. ${extraInstructions}`
      : 'Generate a complete professional business plan and investment memo for this deal.';

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch(`${API_BASE}/api/claude-chat/business-plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          instructions: extraInstructions,
          conversation_history: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              }
            } catch (e) {}
          }
        }
      }

      if (fullContent) {
        const { artifacts: newArtifacts, cleanedText } = parseArtifacts(fullContent);
        if (newArtifacts.length > 0) {
          setArtifacts(prev => [...prev, ...newArtifacts]);
          setActiveArtifact(newArtifacts[0]);
          setActiveCanvasTab('artifacts');
        }
        setMessages(prev => [...prev, { role: 'assistant', content: cleanedText }]);
      }
    } catch (err) {
      console.error('Business plan error:', err);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [isStreaming, sessionId, messages]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!sessionId || files.length === 0) return;

    setIsUploading(true);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', sessionId);

        const res = await fetch(`${API_BASE}/api/claude-chat/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          setUploadedFiles(prev => [...prev, {
            file_id: data.file_id,
            filename: data.filename,
            file_type: data.file_type,
            preview_available: data.preview_available,
          }]);

          // Auto-select for preview if it's a PDF
          if (data.preview_available) {
            setSelectedFileForPreview(data.file_id);
            setActiveCanvasTab('document');
            // Fetch full preview data
            loadFilePreview(data.file_id);
          }

          // Show system message
          setMessages(prev => [...prev, {
            role: 'system',
            content: `Uploaded: **${data.filename}**`,
          }]);

          // Show blank spreadsheet template for editing
          console.log('[SPREADSHEET] Showing blank template for:', data.filename);
          setSpreadsheetTemplateData({
            filename: data.filename,
            address: 'TBD - Will populate from document',
            propertyType: 'Multifamily',
            yearBuilt: '',
            totalUnits: 0,
            totalSF: 0,
            occupancy: '0%',
            purchasePrice: 0,
            closingCosts: 0,
            totalAcquisition: 0,
            loanAmount: 0,
            downPayment: 0,
            interestRate: 0.06,
            annualDebtService: 0,
            gpr: 0,
            egi: 0,
            opex: 0,
            noi: 0,
            capRate: 0,
            dscr: 0,
            coc: 0,
            file_id: data.file_id,
          });
          setShowSpreadsheetTemplate(true);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Failed to upload ${file.name}: ${err.message}`,
        }]);
      }
    }

    setIsUploading(false);
  };

  // Load file preview
  const loadFilePreview = async (fileId) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/claude-chat/file/${sessionId}/${fileId}`);
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
      }
    } catch (err) {
      console.error('Failed to load preview:', err);
    }
  };

  // Handle file removal
  const handleRemoveFile = async (fileId) => {
    if (!sessionId) return;
    try {
      await fetch(`${API_BASE}/api/claude-chat/session/${sessionId}/file/${fileId}`, {
        method: 'DELETE',
      });
      setUploadedFiles(prev => prev.filter(f => f.file_id !== fileId));
      if (selectedFileForPreview === fileId) {
        setSelectedFileForPreview(null);
        setPreviewData(null);
      }
    } catch (err) {
      console.error('Failed to remove file:', err);
    }
  };

  // Send message with streaming
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !sessionId) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch(`${API_BASE}/api/claude-chat/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          conversation_history: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                // Streaming complete
              } else if (data.type === 'error') {
                console.error('Stream error:', data.content);
                setMessages(prev => [...prev, {
                  role: 'system',
                  content: `Error: ${data.content}`,
                }]);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Add final message and parse artifacts
      if (fullContent) {
        const { artifacts: newArtifacts, cleanedText } = parseArtifacts(fullContent);
        
        // Add artifacts to state
        if (newArtifacts.length > 0) {
          setArtifacts(prev => [...prev, ...newArtifacts]);
          // Auto-select the first new artifact
          setActiveArtifact(newArtifacts[0]);
          setActiveCanvasTab('artifacts');
        }
        
        setMessages(prev => [...prev, { role: 'assistant', content: cleanedText }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${err.message}`,
      }]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [inputValue, isStreaming, sessionId, messages]);

  // Download artifact
  const handleDownloadArtifact = async (artifact) => {
    if (!artifact) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`${API_BASE}/api/claude-chat/artifact/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: artifact.type,
          title: artifact.title,
          data: artifact.type === 'spreadsheet' ? artifact.data : artifact.data,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Create download link
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.media_type });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error(result.detail || 'Download failed');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragActive(false);
    }
  };

  if (isInitializing) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: COLORS.bg,
      }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} color={COLORS.primary} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: COLORS.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {dragActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(59, 130, 246, 0.08)',
          border: '3px dashed #3b82f6',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#fff',
            padding: '32px 48px',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            textAlign: 'center',
          }}>
            <Upload size={40} color="#3b82f6" />
            <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
              Drop files to upload
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              PDF, images, CSV, Excel
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: COLORS.white,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: COLORS.text,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
              AI Underwriter
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.textMuted }}>
              {loadedDeal ? `📍 ${loadedDeal.address}` : 'AI-powered deal analysis and document generation'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Business Plan quick button — always visible, pops when deal loaded */}
          <button
            onClick={() => handleGenerateBusinessPlan()}
            disabled={isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: loadedDeal || uploadedFiles.length > 0 ? '#0f172a' : COLORS.bg,
              border: `1px solid ${loadedDeal || uploadedFiles.length > 0 ? '#0f172a' : COLORS.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: loadedDeal || uploadedFiles.length > 0 ? '#ffffff' : COLORS.textMuted,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              opacity: isStreaming ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            title="Generate a full investment business plan"
          >
            <BookOpen size={15} />
            Business Plan
          </button>

          <button
            onClick={() => setShowCanvas(!showCanvas)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: showCanvas ? COLORS.primary : COLORS.bg,
              border: `1px solid ${showCanvas ? COLORS.primary : COLORS.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: showCanvas ? '#fff' : COLORS.text,
              cursor: 'pointer',
            }}
          >
            {showCanvas ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            Canvas
          </button>
        </div>
      </header>

      {/* Deal Context Banner — shows when a deal is loaded from pipeline */}
      {loadedDeal && !dealBannerCollapsed && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          color: '#fff',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(16,185,129,0.2)',
              border: '1px solid rgba(16,185,129,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building2 size={18} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {loadedDeal.address}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {loadedDeal.units} units · ${(loadedDeal.purchase_price || 0).toLocaleString()} · {loadedDeal.deal_structure || 'Traditional'} · All deal data loaded into context
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Quick action chips */}
            {[
              { label: '📊 Business Plan', action: () => handleGenerateBusinessPlan() },
              { label: '📈 Underwrite Model', action: () => { setInputValue('Build me a complete underwriting model and pro forma for this deal'); textareaRef.current?.focus(); }},
              { label: '📋 Executive Summary', action: () => { setInputValue('Write a 1-page executive summary for this deal'); textareaRef.current?.focus(); }},
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                disabled={isStreaming}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDealBannerCollapsed(true)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              title="Collapse banner"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Collapsed banner re-expand */}
      {loadedDeal && dealBannerCollapsed && (
        <button
          onClick={() => setDealBannerCollapsed(false)}
          style={{
            width: '100%',
            padding: '6px 20px',
            background: '#0f172a',
            border: 'none',
            borderBottom: '1px solid #1e293b',
            color: '#64748b',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Building2 size={12} />
          <span>{loadedDeal.address} — deal data loaded</span>
          <ChevronDown size={12} style={{ marginLeft: 'auto' }} />
        </button>
      )}

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Chat Panel */}
        <div style={{
          flex: showCanvas ? '0 0 50%' : 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: showCanvas ? `1px solid ${COLORS.border}` : 'none',
          transition: 'flex 0.2s ease',
        }}>
          
          {/* Chat Messages */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 20px',
          }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              {messages.map((msg, idx) => (
                msg.role === 'system' ? (
                  <div key={idx} style={{
                    textAlign: 'center',
                    padding: '8px 16px',
                    marginBottom: 16,
                    fontSize: 12,
                    color: COLORS.textMuted,
                  }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <ChatMessage
                    key={idx}
                    message={msg}
                    isUser={msg.role === 'user'}
                    isStreaming={false}
                  />
                )
              ))}
              
              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <ChatMessage
                  message={{ role: 'assistant', content: streamingContent }}
                  isUser={false}
                  isStreaming={true}
                />
              )}
              
              {/* Streaming indicator */}
              {isStreaming && !streamingContent && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 0',
                  color: COLORS.textMuted,
                }}>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Thinking...</span>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 20px 20px',
            background: COLORS.white,
            borderTop: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              
              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {uploadedFiles.map(file => (
                    <FileChip
                      key={file.file_id}
                      file={file}
                      onRemove={handleRemoveFile}
                    />
                  ))}
                </div>
              )}

              {/* Input Box */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                padding: '12px 16px',
                background: COLORS.bg,
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
              }}>
                {/* Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    color: COLORS.textMuted,
                  }}
                  title="Upload documents"
                >
                  {isUploading ? (
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload size={18} />
                  )}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*,.csv,.xlsx,.xls,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handleFileUpload(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />

                {/* Text Input */}
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about a deal or upload documents..."
                  disabled={isStreaming}
                  rows={1}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    lineHeight: 1.5,
                    resize: 'none',
                    color: COLORS.text,
                    fontFamily: 'inherit',
                  }}
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isStreaming}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    background: inputValue.trim() && !isStreaming ? COLORS.primary : COLORS.border,
                    border: 'none',
                    borderRadius: 8,
                    cursor: inputValue.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                    color: '#fff',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>

              <p style={{
                margin: '8px 0 0',
                fontSize: 11,
                color: COLORS.textLight,
                textAlign: 'center',
              }}>
                Drop files anywhere or click the upload button. Supports PDF, images, CSV, Excel.
              </p>

              {/* Quick action suggestion chips — shown when no messages yet */}
              {messages.filter(m => m.role === 'user').length === 0 && !isStreaming && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'center',
                  marginTop: 12,
                }}>
                  {[
                    { icon: '📊', label: 'Business Plan', msg: () => handleGenerateBusinessPlan() },
                    { icon: '📈', label: 'Underwrite Model', msg: 'Build me a complete underwriting model and pro forma for this deal' },
                    { icon: '📋', label: 'Executive Summary', msg: 'Write a concise executive summary for this deal' },
                    { icon: '🔍', label: 'Red Flag Scan', msg: 'Analyze the deal for red flags, risks, and deal killers' },
                    { icon: '💡', label: 'Value-Add Strategy', msg: 'Identify all value-add opportunities and build a phased business plan' },
                  ].map(({ icon, label, msg }) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (typeof msg === 'function') {
                          msg();
                        } else {
                          setInputValue(msg);
                          textareaRef.current?.focus();
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 12px',
                        background: COLORS.white,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        color: COLORS.text,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = COLORS.primary;
                        e.currentTarget.style.color = COLORS.primary;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = COLORS.border;
                        e.currentTarget.style.color = COLORS.text;
                      }}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Panel */}
        {showCanvas && (
          <div style={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.canvasBg,
          }}>
            
            {/* Canvas Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              padding: '12px 16px 0',
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.bg,
            }}>
              <CanvasTab
                active={activeCanvasTab === 'artifacts'}
                icon={Table}
                label={`Artifacts${artifacts.length > 0 ? ` (${artifacts.length})` : ''}`}
                onClick={() => setActiveCanvasTab('artifacts')}
              />
              <CanvasTab
                active={activeCanvasTab === 'document'}
                icon={FileText}
                label="Uploads"
                onClick={() => setActiveCanvasTab('document')}
              />
              <CanvasTab
                active={activeCanvasTab === 'chat'}
                icon={MessageSquare}
                label="Summary"
                onClick={() => setActiveCanvasTab('chat')}
              />
              
              {/* Artifact selector dropdown */}
              {activeCanvasTab === 'artifacts' && artifacts.length > 1 && (
                <div style={{ marginLeft: 'auto', marginBottom: 8 }}>
                  <select
                    value={activeArtifact?.id || ''}
                    onChange={(e) => {
                      const selected = artifacts.find(a => a.id === e.target.value);
                      setActiveArtifact(selected || null);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      background: COLORS.white,
                      cursor: 'pointer',
                    }}
                  >
                    {artifacts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.type === 'spreadsheet' ? '📊' : '📄'} {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* File selector dropdown */}
              {activeCanvasTab === 'document' && uploadedFiles.length > 0 && (
                <div style={{ marginLeft: 'auto', marginBottom: 8 }}>
                  <select
                    value={selectedFileForPreview || ''}
                    onChange={(e) => {
                      setSelectedFileForPreview(e.target.value);
                      if (e.target.value) loadFilePreview(e.target.value);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      background: COLORS.white,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select file...</option>
                    {uploadedFiles.map(f => (
                      <option key={f.file_id} value={f.file_id}>{f.filename}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Canvas Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Artifacts Tab */}
              {activeCanvasTab === 'artifacts' && (
                <>
                  {activeArtifact ? (
                    activeArtifact.type === 'spreadsheet' ? (
                      <SpreadsheetPreview
                        artifact={activeArtifact}
                        onDownload={() => handleDownloadArtifact(activeArtifact)}
                        isDownloading={isDownloading}
                      />
                    ) : (
                      <DocumentPreview
                        artifact={activeArtifact}
                        onDownload={() => handleDownloadArtifact(activeArtifact)}
                        isDownloading={isDownloading}
                      />
                    )
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: 40,
                      color: COLORS.textMuted,
                      textAlign: 'center',
                    }}>
                      <Table size={48} strokeWidth={1} />
                      <p style={{ marginTop: 16, fontSize: 14, fontWeight: 500 }}>
                        No artifacts yet
                      </p>
                      <p style={{ fontSize: 13, color: COLORS.textLight, maxWidth: 300 }}>
                        Ask the AI to "build an underwrite model" or "write a business plan" and it will appear here
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Document/Uploads Tab */}
              {activeCanvasTab === 'document' && (
                <div style={{ padding: 16, height: '100%' }}>
                  {previewData?.file_type === 'application/pdf' && previewData?.base64_data ? (
                    <PDFViewer
                      base64Data={previewData.base64_data}
                      filename={previewData.filename}
                    />
                  ) : previewData?.extracted_text ? (
                    <div style={{
                      background: COLORS.white,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      padding: 20,
                      height: '100%',
                      overflow: 'auto',
                    }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
                        {previewData.filename}
                      </h3>
                      <pre style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                        {previewData.extracted_text}
                      </pre>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: COLORS.textMuted,
                    }}>
                      <Eye size={48} strokeWidth={1} />
                      <p style={{ marginTop: 12, fontSize: 14 }}>
                        Upload a document to preview it here
                      </p>
                      <p style={{ fontSize: 12, color: COLORS.textLight }}>
                        PDF files will be displayed. Other files show extracted text.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Summary Tab */}
              {activeCanvasTab === 'chat' && (
                <div style={{ padding: 16, height: '100%' }}>
                  <div style={{
                    background: COLORS.white,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 20,
                    height: '100%',
                    overflow: 'auto',
                  }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>
                      Conversation Summary
                    </h3>
                    {messages.filter(m => m.role !== 'system').length === 0 ? (
                      <p style={{ color: COLORS.textMuted, fontSize: 13 }}>
                        No messages yet. Start by uploading a document or asking a question.
                      </p>
                    ) : (
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {messages.filter(m => m.role !== 'system').map((msg, idx) => (
                          <div key={idx} style={{ marginBottom: 12 }}>
                            <strong style={{ color: msg.role === 'user' ? COLORS.primary : '#10b981' }}>
                              {msg.role === 'user' ? 'You' : 'AI'}:
                            </strong>
                            <span style={{ marginLeft: 8, color: COLORS.text }}>
                              {msg.content.slice(0, 200)}{msg.content.length > 200 ? '...' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Spreadsheet Template Modal */}
      {showSpreadsheetTemplate && spreadsheetTemplateData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 9998,
          padding: '20px',
          overflow: 'auto'
        }}>
          <div style={{
            width: '95%',
            maxWidth: '1400px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease-out',
            marginTop: '20px',
            marginBottom: '20px'
          }}>
            {/* Header with close button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #ffffff, #fafafa)'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                📊 Blank Underwriting Model
              </h2>
              <button
                onClick={() => setShowSpreadsheetTemplate(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
                onMouseEnter={(e) => e.target.style.color = '#111827'}
                onMouseLeave={(e) => e.target.style.color = '#6b7280'}
              >
                <X size={24} />
              </button>
            </div>

            {/* Spreadsheet Template */}
            <div style={{ padding: '16px' }}>
              <UnderwritingSpreadsheetTemplate 
                dealData={spreadsheetTemplateData}
                isLoading={isUploading}
              />
            </div>

            {/* Footer with instructions */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              background: '#fafafa'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                ✏️ Edit any cell. Then ask me in the chat (left panel) to fill missing fields or analyze the deal.
              </div>
              <button
                onClick={() => setShowSpreadsheetTemplate(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .markdown-content a {
          color: ${COLORS.primary};
          text-decoration: none;
        }
        .markdown-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
