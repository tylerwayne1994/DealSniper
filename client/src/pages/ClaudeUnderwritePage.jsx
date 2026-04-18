/**
 * Claude Underwriter - Direct Claude Chat for Deal Underwriting
 * 
 * Features:
 * - Streaming chat with Claude
 * - PDF/document upload and preview in canvas
 * - Real-time document generation
 * - Export to Excel, PDF, PPTX
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Upload, FileText, X, Loader, Download,
  FileSpreadsheet, File, Image, PanelRightClose,
  PanelRight, MessageSquare, Eye, Copy, Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

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

  // Canvas state
  const [showCanvas, setShowCanvas] = useState(true);
  const [activeCanvasTab, setActiveCanvasTab] = useState('chat'); // 'chat', 'document', 'export'

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
            content: `I'm Claude, your CRE underwriting partner. Upload your OM, rent roll, T12, or any deal documents and I'll analyze them from scratch — no broker assumptions, just the real numbers.\n\nI can help you:\n- **Parse and verify** all financial data from documents\n- **Build your own underwriting** with conservative assumptions\n- **Identify value-add opportunities** (RUBS, expense optimization, rent recapture)\n- **Structure the deal** to maximize returns with minimum equity\n- **Generate documents** (underwrite model, business plan, pitch deck)\n\nDrop your files or ask me anything about a deal.`
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

      // Add final message
      if (fullContent) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
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
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
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
    >
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
              Claude Underwriter
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.textMuted }}>
              AI-powered deal analysis and document generation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  onChange={(e) => handleFileUpload(Array.from(e.target.files))}
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
                active={activeCanvasTab === 'document'}
                icon={FileText}
                label="Document Preview"
                onClick={() => setActiveCanvasTab('document')}
              />
              <CanvasTab
                active={activeCanvasTab === 'chat'}
                icon={MessageSquare}
                label="Conversation"
                onClick={() => setActiveCanvasTab('chat')}
              />
              
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
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {activeCanvasTab === 'document' && (
                <>
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
                </>
              )}

              {activeCanvasTab === 'chat' && (
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
                            {msg.role === 'user' ? 'You' : 'Claude'}:
                          </strong>
                          <span style={{ marginLeft: 8, color: COLORS.text }}>
                            {msg.content.slice(0, 200)}{msg.content.length > 200 ? '...' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export Actions */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: COLORS.text,
                  cursor: 'pointer',
                }}
                title="Coming soon"
              >
                <FileSpreadsheet size={14} />
                Export Excel
              </button>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: COLORS.text,
                  cursor: 'pointer',
                }}
                title="Coming soon"
              >
                <Download size={14} />
                Export PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
