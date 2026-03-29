// Deal Builder Page - AI-Powered Full Deal Underwriting + Pitch Deck + Spreadsheet
// Upload OM → Chat with Max → Generate Pitch Deck + Spreadsheet
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  ArrowLeft, 
  Sparkles, 
  Upload,
  FileText,
  Loader,
  Building2,
  CheckCircle,
  Download,
  X,
  Layers,
  DollarSign,
  TrendingUp,
  PieChart,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

const API_BASE = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';

// Suggestion prompts for getting started
const SUGGESTIONS = [
  {
    icon: Upload,
    color: '#10b981',
    title: "Upload an OM",
    desc: "Start by uploading an Offering Memorandum",
    action: 'upload'
  },
  {
    icon: DollarSign,
    color: '#f59e0b',
    title: "Value-Add Strategy",
    desc: "Find ways to boost NOI and returns",
    prompt: "What are the best value-add strategies for this deal? How can I increase NOI through rent bumps, expense reductions, or RUBS?"
  },
  {
    icon: PieChart,
    color: '#6366f1',
    title: "Capital Structure",
    desc: "Structure the deal for investors",
    prompt: "Help me structure the capital stack for this deal. What's a good LP/GP split? Should I do preferred return or straight equity?"
  },
  {
    icon: TrendingUp,
    color: '#ec4899',
    title: "Deal Weaknesses",
    desc: "Identify risks and red flags",
    prompt: "What are the potential weaknesses or risks in this deal? What should I be worried about?"
  }
];

function DealBuilderPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [dealData, setDealData] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ spreadsheet: 0, pitchDeck: 0 });
  const [generationStatus, setGenerationStatus] = useState({ spreadsheet: 'idle', pitchDeck: 'idle' });
  const [downloadUrls, setDownloadUrls] = useState({ spreadsheet: null, pitchDeck: null, dealId: null });
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize session
  useEffect(() => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.action === 'upload') {
      fileInputRef.current?.click();
    } else if (suggestion.prompt) {
      setInput(suggestion.prompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF or image file');
      return;
    }

    setIsUploading(true);
    setUploadedFile({ name: file.name, size: file.size, type: file.type });

    // Add user message about upload
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: `I'm uploading an OM: ${file.name}`,
      isUpload: true,
      fileName: file.name
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const response = await fetch(`${API_BASE}/api/deal-builder/upload`, {
        method: 'POST',
        headers: userId ? { 'X-Profile-ID': userId } : {},
        body: formData
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          errorMsg = error.detail || error.error || errorMsg;
        } catch {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // Store parsed deal data
      setDealData(data.dealData);
      
      // Add assistant response with parsed data summary
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        dealSummary: data.dealSummary
      }]);

    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I had trouble processing that file: ${error.message}. Please try again with a clear PDF or image of the OM.`
      }]);
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send chat message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Check for explicit generation requests - skip chat and go straight to generation
    const generateKeywords = ['generate', 'build the spreadsheet', 'make the spreadsheet', 'create the spreadsheet', 
                              'build the model', 'create the model', 'make the pitch deck', 'build it now', 
                              'generate now', 'produce the files', 'make the files'];
    const isGenerateRequest = generateKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    
    // If explicitly asking to generate and we have deal data, skip chat and generate directly
    if (isGenerateRequest && dealData && !isApproved) {
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      handleApprove();
      return;
    }
    
    // Check for approval keywords
    const approvalKeywords = ['approved', 'looks good', 'let\'s do it', 'go ahead', 'proceed', 'build it', 'generate', 'create the'];
    const isApprovalMessage = approvalKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const response = await fetch(`${API_BASE}/api/deal-builder/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'X-Profile-ID': userId })
        },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          deal_data: dealData,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          is_approval: isApprovalMessage
        })
      });

      if (response.status === 401) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Please log in to use Deal Builder. Go to the login page, sign in, then try again.'
        }]);
        return;
      }

      if (response.status === 402) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'You are out of tokens for this feature. Please purchase more tokens to continue.'
        }]);
        return;
      }

      const data = await response.json();

      if (data.success) {
        // Update deal data if modified
        if (data.updatedDealData) {
          setDealData(data.updatedDealData);
        }

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          showApproveButton: data.readyForApproval && !isApproved
        }]);

        // If user approved and backend confirmed, start generation
        if (data.approved) {
          setIsApproved(true);
          startGeneration();
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I encountered an error: ${data.error || 'Unknown error'}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'There was a connection error. Please check your internet and try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle approval button click
  const handleApprove = async () => {
    setMessages(prev => [...prev, { role: 'user', content: 'Approved! Generate the spreadsheet and pitch deck.' }]);
    setIsApproved(true);
    startGeneration();
  };

  // Start parallel generation of spreadsheet + pitch deck
  const startGeneration = async () => {
    setIsGenerating(true);
    setGenerationStatus({ spreadsheet: 'generating', pitchDeck: 'generating' });
    setGenerationProgress({ spreadsheet: 0, pitchDeck: 0 });

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: 'Building your deliverables now. This usually takes 1-2 minutes...',
      isGenerationStatus: true
    }]);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // Start generation (backend handles parallel processing)
      const response = await fetch(`${API_BASE}/api/deal-builder/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'X-Profile-ID': userId })
        },
        body: JSON.stringify({
          session_id: sessionId,
          deal_data: dealData
        })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/deal-builder/status/${sessionId}`, {
            headers: userId ? { 'X-Profile-ID': userId } : {}
          });
          const status = await statusRes.json();

          setGenerationProgress({
            spreadsheet: status.spreadsheet_progress || 0,
            pitchDeck: status.pitch_deck_progress || 0
          });

          setGenerationStatus({
            spreadsheet: status.spreadsheet_status || 'generating',
            pitchDeck: status.pitch_deck_status || 'generating'
          });

          // Check if complete
          if (status.complete) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            // Prepend API_BASE to make absolute URLs (backend returns relative paths)
            setDownloadUrls({
              spreadsheet: status.spreadsheet_url ? `${API_BASE}${status.spreadsheet_url}` : null,
              pitchDeck: status.pitch_deck_url ? `${API_BASE}${status.pitch_deck_url}` : null,
              dealId: status.deal_id
            });

            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: 'Your deal package is ready! You can download your spreadsheet and pitch deck below, or view the deal in your pipeline.',
              isComplete: true
            }]);
          }
        } catch (err) {
          console.error('Status poll error:', err);
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setIsGenerating(false);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Generation is taking longer than expected. Please check back in a moment or try again.'
          }]);
        }
      }, 300000);

    } catch (error) {
      console.error('Generation error:', error);
      setIsGenerating(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Generation failed: ${error.message}. Please try again.`
      }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    setUploadedFile(null);
    setDealData(null);
    setIsApproved(false);
    setIsGenerating(false);
    setGenerationProgress({ spreadsheet: 0, pitchDeck: 0 });
    setGenerationStatus({ spreadsheet: 'idle', pitchDeck: 'idle' });
    setDownloadUrls({ spreadsheet: null, pitchDeck: null, dealId: null });
    // New session
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  };

  // Progress bar component
  const ProgressBar = ({ label, progress, status }) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {status === 'complete' ? 'Complete' : status === 'generating' ? `${progress}%` : 'Waiting...'}
        </span>
      </div>
      <div style={{ 
        height: '8px', 
        backgroundColor: '#e5e7eb', 
        borderRadius: '4px', 
        overflow: 'hidden' 
      }}>
        <div style={{ 
          height: '100%', 
          width: `${progress}%`, 
          backgroundColor: status === 'complete' ? '#10b981' : '#6366f1',
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );

  return (
    <DashboardShell activeTab="market" title="Deal Builder">
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        backgroundColor: '#f9fafb'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#eef2ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={22} color="#6366f1" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                Max Deal Builder
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                Upload OM → Underwrite → Get Pitch Deck + Spreadsheet
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
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

        {/* Cost info banner */}
        <div style={{
          padding: '8px 24px',
          backgroundColor: '#fef3c7',
          borderBottom: '1px solid #fcd34d',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} color="#d97706" />
          <span style={{ fontSize: '13px', color: '#92400e' }}>
            <strong>10 tokens</strong> for full deal package (underwriting + spreadsheet + pitch deck)
          </span>
        </div>

        {/* Content Area */}
        <div style={{ 
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Welcome Section - Only show when no messages */}
          {messages.length === 0 && (
            <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Building2 size={40} color="#6366f1" />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                  Build Your Deal Package
                </h1>
                <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '550px', margin: '0 auto', lineHeight: '1.6' }}>
                  Upload an OM and I'll underwrite the deal, identify value-add opportunities, structure the capital stack, and generate a professional spreadsheet + investor pitch deck.
                </p>
              </div>

              {/* Upload Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #d1d5db',
                  borderRadius: '16px',
                  padding: '48px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: '32px',
                  backgroundColor: 'white',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.backgroundColor = '#fafafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <Upload size={48} color="#6366f1" style={{ marginBottom: '16px' }} />
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                  Drop your OM here or click to upload
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  PDF or image files supported
                </p>
              </div>

              {/* Suggestion Cards */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px'
              }}>
                {SUGGESTIONS.slice(1).map((suggestion, idx) => {
                  const Icon = suggestion.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: '16px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: `${suggestion.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px'
                      }}>
                        <Icon size={18} color={suggestion.color} />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                        {suggestion.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {suggestion.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              {messages.map((msg, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{
                    maxWidth: '80%',
                    padding: '14px 18px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    backgroundColor: msg.role === 'user' ? '#6366f1' : 'white',
                    color: msg.role === 'user' ? 'white' : '#111827',
                    border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    {/* File upload indicator */}
                    {msg.isUpload && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '8px'
                      }}>
                        <FileText size={16} />
                        <span style={{ fontSize: '13px' }}>{msg.fileName}</span>
                      </div>
                    )}

                    {/* Message content */}
                    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            p: ({children}) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
                            ul: ({children}) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                            li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                            strong: ({children}) => <strong style={{ fontWeight: '600' }}>{children}</strong>
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {/* Approve button */}
                    {msg.showApproveButton && !isApproved && (
                      <button
                        onClick={handleApprove}
                        style={{
                          marginTop: '12px',
                          padding: '10px 20px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <CheckCircle size={18} />
                        Approve & Generate Package
                      </button>
                    )}

                    {/* Generation progress */}
                    {msg.isGenerationStatus && isGenerating && (
                      <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <ProgressBar 
                          label="Spreadsheet Model" 
                          progress={generationProgress.spreadsheet} 
                          status={generationStatus.spreadsheet}
                        />
                        <ProgressBar 
                          label="Pitch Deck" 
                          progress={generationProgress.pitchDeck} 
                          status={generationStatus.pitchDeck}
                        />
                      </div>
                    )}

                    {/* Download buttons */}
                    {msg.isComplete && downloadUrls.spreadsheet && (
                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <a
                          href={downloadUrls.spreadsheet}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          <Download size={18} />
                          Download Spreadsheet (.xlsx)
                        </a>
                        <a
                          href={downloadUrls.pitchDeck}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 16px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          <Download size={18} />
                          Download Pitch Deck (.pdf)
                        </a>
                        {downloadUrls.dealId && (
                          <button
                            onClick={() => navigate(`/pipeline`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '12px 16px',
                              backgroundColor: 'white',
                              color: '#374151',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <Layers size={18} />
                            View in Pipeline
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {(isLoading || isUploading) && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '16px 16px 16px 4px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Loader size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {isUploading ? 'Processing document...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div style={{ 
            maxWidth: '900px', 
            margin: '0 auto',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end'
          }}>
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isGenerating}
              style={{
                padding: '12px',
                backgroundColor: uploadedFile ? '#dcfce7' : '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: (isUploading || isGenerating) ? 'not-allowed' : 'pointer',
                opacity: (isUploading || isGenerating) ? 0.5 : 1
              }}
              title="Upload OM"
            >
              {uploadedFile ? (
                <CheckCircle size={20} color="#10b981" />
              ) : (
                <Upload size={20} color="#6b7280" />
              )}
            </button>

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={uploadedFile ? "Ask about the deal, discuss structure, or say 'approved' when ready..." : "Upload an OM to get started, or ask a question..."}
                disabled={isLoading || isUploading || isGenerating}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: '50px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '12px',
                  resize: 'none',
                  minHeight: '48px',
                  maxHeight: '120px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isUploading || isGenerating}
                style={{
                  position: 'absolute',
                  right: '8px',
                  bottom: '8px',
                  padding: '8px',
                  backgroundColor: input.trim() ? '#6366f1' : '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: input.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                <Send size={18} color={input.trim() ? 'white' : '#9ca3af'} />
              </button>
            </div>
          </div>
          
          {/* Uploaded file indicator */}
          {uploadedFile && (
            <div style={{ 
              maxWidth: '900px', 
              margin: '8px auto 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              <FileText size={14} />
              <span>{uploadedFile.name}</span>
              <button
                onClick={() => setUploadedFile(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <X size={14} color="#9ca3af" />
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </DashboardShell>
  );
}

export default DealBuilderPage;
