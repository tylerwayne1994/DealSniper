// Market Research Page - Perplexity-Powered Chat for Finding Perfect Markets
// UI matches ResultsPageV2 styling
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  TrendingUp,
  DollarSign,
  Users,
  Loader,
  Building2,
  Search,
  Target,
  BarChart3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Suggestion prompts
const SUGGESTIONS = [
  {
    icon: MapPin,
    color: '#10b981',
    title: "Best Markets for Cash Flow",
    desc: "Find markets with strong rent-to-price ratios",
    prompt: "I'm looking for markets with strong cash flow potential. Which cities or metro areas have the best rent-to-price ratios for multifamily investing right now? Consider population growth, job market, and landlord-friendly laws."
  },
  {
    icon: TrendingUp,
    color: '#f59e0b',
    title: "Emerging Growth Markets",
    desc: "Discover up-and-coming investment areas",
    prompt: "What are the top emerging markets for multifamily real estate investment in 2025? I want to find areas with strong appreciation potential, population growth, and economic development before they become too competitive."
  },
  {
    icon: Building2,
    color: '#3b82f6',
    title: "Compare Specific Markets",
    desc: "Analyze cities side-by-side",
    prompt: "Compare the Phoenix, Arizona and Dallas, Texas multifamily markets for investment. Consider factors like population growth, job growth, rent growth, cap rates, appreciation potential, and landlord-friendly laws."
  },
  {
    icon: DollarSign,
    color: '#ec4899',
    title: "Affordable Entry Markets",
    desc: "Find markets with lower barriers",
    prompt: "What markets offer the best opportunities for new multifamily investors with limited capital? I'm looking for areas where I can get started with smaller down payments but still have strong fundamentals."
  }
];

function MarketResearchPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
    setInput(suggestion.prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8010/api/market-research/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          citations: data.citations
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I apologize, but I encountered an error: ${data.error || 'Unknown error'}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but there was a connection error. Please check that the server is running and try again.'
      }]);
    } finally {
      setIsLoading(false);
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
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/')}
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
              <ArrowLeft size={16} />
              Back
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={20} color="#6366f1" />
                Market Finder AI
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                Discover the best markets for your investment strategy
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
                New Search
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
          backgroundColor: '#f9fafb'
        }}>
          <button
            style={{
              padding: '12px 16px',
              backgroundColor: 'white',
              color: '#111827',
              border: 'none',
              borderBottom: '2px solid #6366f1',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={16} />
            Find Markets
          </button>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: 'none',
              borderBottom: '2px solid transparent',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart3 size={16} />
            Pipeline
          </button>
        </div>

        {/* Content Area */}
        <div style={{ 
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f9fafb',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Welcome Section - Only show when no messages */}
          {messages.length === 0 && (
            <div style={{ padding: '40px 24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Sparkles size={32} color="#6366f1" />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                  Find Your Perfect Market
                </h1>
                <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                  Ask me anything about real estate markets. I'll research current data and trends to help you find the best investment opportunities.
                </p>
              </div>

              {/* Suggestion Cards */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px',
                marginBottom: '32px'
              }}>
                {SUGGESTIONS.map((suggestion, idx) => {
                  const Icon = suggestion.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: '20px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: `${suggestion.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        <Icon size={20} color={suggestion.color} />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>
                        {suggestion.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                        {suggestion.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              {messages.map((message, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    marginBottom: '24px',
                    display: 'flex',
                    gap: '12px'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: message.role === 'user' ? '#3b82f6' : '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {message.role === 'user' ? (
                      <Users size={18} color="#fff" />
                    ) : (
                      <Sparkles size={18} color="#fff" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div style={{
                    flex: 1,
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: message.role === 'user' ? '#eff6ff' : 'white',
                    border: message.role === 'user' ? '1px solid #bfdbfe' : '1px solid #e5e7eb'
                  }}>
                    {message.role === 'user' ? (
                      <div style={{ color: '#1e40af', fontSize: '15px', lineHeight: '1.6' }}>
                        {message.content}
                      </div>
                    ) : (
                      <div style={{ color: '#374151', fontSize: '15px', lineHeight: '1.7' }}>
                        <ReactMarkdown
                          components={{
                            h1: ({children}) => <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '12px' }}>{children}</h1>,
                            h2: ({children}) => <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>{children}</h2>,
                            h3: ({children}) => <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginTop: '16px', marginBottom: '8px' }}>{children}</h3>,
                            p: ({children}) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                            ul: ({children}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                            ol: ({children}) => <ol style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ol>,
                            li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                            strong: ({children}) => <strong style={{ color: '#111827', fontWeight: '600' }}>{children}</strong>
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={18} color="#fff" />
                  </div>
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#6b7280'
                  }}>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Researching markets...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - Fixed at bottom */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any market, state, or investment strategy..."
                rows={1}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '15px',
                  color: '#111827',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: '1.5',
                  minHeight: '24px',
                  maxHeight: '120px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: isLoading || !input.trim() ? '#e5e7eb' : '#6366f1',
                  color: 'white',
                  border: 'none',
                  cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                {isLoading ? (
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: '10px', 
              fontSize: '12px', 
              color: '#9ca3af' 
            }}>
              Powered by Perplexity AI • Data may not reflect current market conditions
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MarketResearchPage;
