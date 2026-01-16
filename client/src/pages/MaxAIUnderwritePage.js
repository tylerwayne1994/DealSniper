// MAX AI Underwriting Page
// Clean ChatGPT-style interface for instant OM analysis
// Users upload OMs, set buy box, and get AI underwriting analysis

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Upload, Send, Settings, X, CheckCircle, 
  Loader, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

const MaxAIUnderwritePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  
  // State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m **MAX**, your AI underwriting assistant.\n\nUpload 1-2 OMs (offering memorandums) and I\'ll analyze them against your buy box criteria. Set your preferences using the button below, then upload your files and click **Underwrite Now**.'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isUnderwriting, setIsUnderwriting] = useState(false);
  const [showBuyBoxModal, setShowBuyBoxModal] = useState(false);
  
  // Buy Box State
  const [buyBoxParams, setBuyBoxParams] = useState({
    minUnits: 50,
    maxUnits: 500,
    minCapRate: 5,
    maxCapRate: 8,
    minDSCR: 1.25,
    minCashOnCash: 8,
    maxPricePerUnit: 150000,
    maxVacancy: 10,
    minYearBuilt: 1980,
    targetMarkets: ['TX', 'FL', 'AZ', 'NC', 'GA']
  });
  
  const [debtStructure, setDebtStructure] = useState('traditional');
  const [propertyType, setPropertyType] = useState('multifamily');
  const [transactionType, setTransactionType] = useState('acquisition');

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Handle file upload (mock for now, will implement parsing)
  const handleFileUpload = async (files) => {
    setIsUploading(true);
    
    try {
      // Add files to uploaded list
      const newFiles = files.map(f => ({
        name: f.name,
        size: f.size,
        file: f
      }));
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      // Add system message
      setMessages(prev => [...prev, {
        role: 'system',
        content: `**Uploaded:** ${files.map(f => f.name).join(', ')}\n\nClick **Underwrite Now** to analyze ${files.length === 1 ? 'this deal' : 'these deals'}.`
      }]);
      
    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Upload failed. Please try again.'
      }]);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle underwriting
  const handleUnderwrite = async () => {
    if (uploadedFiles.length === 0) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Please upload at least one OM before underwriting.'
      }]);
      return;
    }

    setIsUnderwriting(true);
    setMessages(prev => [...prev, {
      role: 'system',
      content: 'Parsing OMs and running underwriting analysis...'
    }]);

    try {
      // Step 1: Parse each file
      const parsedDeals = [];
      
      for (const fileObj of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', fileObj.file);

        const parseResponse = await fetch(`${API_BASE}/upload_pdf`, {
          method: 'POST',
          body: formData
        });

        if (!parseResponse.ok) {
          throw new Error(`Failed to parse ${fileObj.name}`);
        }

        const parseResult = await parseResponse.json();
        parsedDeals.push({
          fileName: fileObj.name,
          dealId: parseResult.deal_id,
          parsedData: parseResult.parsed_data
        });
      }

      // Step 2: For each parsed deal, run underwriting
      for (const deal of parsedDeals) {
        // Build scenario with buy box and debt structure
        const scenario = {
          ...deal.parsedData,
          deal_setup: {
            underwriting_mode: 'buybox',
            buy_box: buyBoxParams,
            property_type: propertyType,
            transaction_type: transactionType,
            debt_structure: debtStructure
          }
        };

        // Step 3: Send to MAX AI for analysis
        const aiResponse = await fetch(`${API_BASE}/v2/deals/${deal.dealId}/max-underwrite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyBoxPresets: buyBoxParams,
            dealData: scenario
          })
        });

        if (!aiResponse.ok) {
          throw new Error(`AI underwriting failed for ${deal.fileName}`);
        }

        const aiResult = await aiResponse.json();
        
        // Add AI response to chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiResult.summary_text || aiResult.summaryText || 'Analysis complete.'
        }]);
      }

      // Clear uploaded files after processing
      setUploadedFiles([]);

    } catch (error) {
      console.error('Underwriting error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `**Error:** ${error.message}\n\nPlease try again or contact support.`
      }]);
    } finally {
      setIsUnderwriting(false);
    }
  };

  // Handle regular chat message
  const handleSendMessage = () => {
    if (!inputValue.trim() || isUnderwriting) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage
    }]);

    // Simple responses for now
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I can help you underwrite deals! Upload an OM and click "Underwrite Now" to get started.'
      }]);
    }, 500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              MAX AI Underwriting
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Upload OMs for instant analysis
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowBuyBoxModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Settings size={16} />
            Buy Box Preferences
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: '#ffffff',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Home size={16} />
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Chat Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 1000,
        margin: '0 auto',
        width: '100%',
        padding: '0 20px'
      }}>
        
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: msg.role === 'assistant' ? '#19c37d' : 
                            msg.role === 'system' ? '#f3f4f6' : '#5436da',
                color: msg.role === 'system' ? '#6b7280' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.75rem',
                flexShrink: 0
              }}>
                {msg.role === 'assistant' ? 'M' : msg.role === 'system' ? 'i' : 'Y'}
              </div>
              
              {/* Message Content */}
              <div style={{
                flex: 1,
                background: '#ffffff',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                color: '#374151'
              }}>
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p style={{ marginBottom: '8px', marginTop: 0 }}>{children}</p>,
                    strong: ({children}) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                    ul: ({children}) => <ul style={{ marginBottom: '8px', paddingLeft: '20px' }}>{children}</ul>,
                    li: ({children}) => <li style={{ marginBottom: '4px' }}>{children}</li>
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isUnderwriting && (
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#19c37d',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}>
                M
              </div>
              <div style={{
                background: '#ffffff',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#6b7280', fontSize: '0.9375rem' }}>Analyzing...</span>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '20px 0 24px',
          borderTop: '1px solid #e5e7eb',
          background: '#ffffff'
        }}>
          
          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div style={{
              marginBottom: 16,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap'
            }}>
              {uploadedFiles.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}
                >
                  <FileText size={14} />
                  <span>{f.name}</span>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#374151'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Underwrite Now Button */}
          {uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleUnderwrite}
                disabled={isUnderwriting}
                style={{
                  padding: '12px 32px',
                  background: isUnderwriting ? '#9ca3af' : '#10a37f',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isUnderwriting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                {isUnderwriting ? (
                  <>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Underwriting...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Underwrite Now
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Chat Input */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isUnderwriting}
              style={{
                padding: '12px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                cursor: isUploading || isUnderwriting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Upload size={18} color={isUploading || isUnderwriting ? '#9ca3af' : '#6b7280'} />
            </button>
            
            <input
              type="text"
              placeholder="Ask MAX about deals or upload OMs..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isUnderwriting}
              style={{
                flex: 1,
                padding: '14px 18px',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                fontSize: '0.9375rem',
                outline: 'none',
                background: isUnderwriting ? '#f9fafb' : '#ffffff'
              }}
            />
            
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isUnderwriting}
              style={{
                padding: '10px 16px',
                background: !inputValue.trim() || isUnderwriting ? '#f3f4f6' : '#10a37f',
                color: !inputValue.trim() || isUnderwriting ? '#9ca3af' : '#ffffff',
                border: 'none',
                borderRadius: 8,
                cursor: !inputValue.trim() || isUnderwriting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Buy Box Modal */}
      {showBuyBoxModal && (
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
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            maxWidth: 800,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                Buy Box Preferences
              </h2>
              <button
                onClick={() => setShowBuyBoxModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{ padding: '28px' }}>
              
              {/* Deal Structure Dropdown */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 8
                }}>
                  Debt Structure
                </label>
                <select
                  value={debtStructure}
                  onChange={(e) => setDebtStructure(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: '0.9375rem',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="traditional">Traditional (Freddie/Fannie, Bank Loan)</option>
                  <option value="seller-finance">Seller Finance</option>
                  <option value="subject-to">Subject To</option>
                  <option value="hybrid">Hybrid (Subject To + Traditional/Seller Finance)</option>
                  <option value="equity-partner">Equity Partner</option>
                  <option value="seller-carry">Seller Carry</option>
                  <option value="lease-option">Lease Option</option>
                </select>
              </div>
              
              {/* Property Type & Transaction Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: '0.9375rem',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="multifamily">Multifamily</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed-use">Mixed Use</option>
                  </select>
                </div>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Transaction Type
                  </label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: '0.9375rem',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="acquisition">Acquisition</option>
                    <option value="refinance">Refinance</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>
              
              {/* Buy Box Criteria */}
              <div style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 20
              }}>
                <h3 style={{
                  margin: '0 0 16px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#111827'
                }}>
                  Your Buy Box Criteria
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Min Units
                    </label>
                    <input
                      type="number"
                      value={buyBoxParams.minUnits}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, minUnits: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Max Units
                    </label>
                    <input
                      type="number"
                      value={buyBoxParams.maxUnits}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, maxUnits: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Min Cap Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={buyBoxParams.minCapRate}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, minCapRate: parseFloat(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Max Cap Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={buyBoxParams.maxCapRate}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, maxCapRate: parseFloat(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Min DSCR
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={buyBoxParams.minDSCR}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, minDSCR: parseFloat(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Min Cash-on-Cash (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={buyBoxParams.minCashOnCash}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, minCashOnCash: parseFloat(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Max $/Unit
                    </label>
                    <input
                      type="number"
                      value={buyBoxParams.maxPricePerUnit}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, maxPricePerUnit: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Max Vacancy (%)
                    </label>
                    <input
                      type="number"
                      value={buyBoxParams.maxVacancy}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, maxVacancy: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Min Year Built
                    </label>
                    <input
                      type="number"
                      value={buyBoxParams.minYearBuilt}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, minYearBuilt: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: 6
                    }}>
                      Target Markets
                    </label>
                    <input
                      type="text"
                      value={buyBoxParams.targetMarkets.join(', ')}
                      onChange={(e) => setBuyBoxParams({...buyBoxParams, targetMarkets: e.target.value.split(',').map(s => s.trim())})}
                      placeholder="TX, FL, AZ..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Save Button */}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowBuyBoxModal(false)}
                  style={{
                    padding: '10px 24px',
                    background: '#10a37f',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MaxAIUnderwritePage;
