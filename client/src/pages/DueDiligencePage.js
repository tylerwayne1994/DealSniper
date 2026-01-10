import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ClipboardCheck, 
  AlertTriangle,
  CheckCircle2,
  Circle,
  Building2,
  DollarSign,
  Users,
  Scale,
  Wrench,
  Shield,
  MapPin,
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  Send,
  MessageSquare,
  Bot,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react';
import { loadDeal, saveDueDiligenceData, loadDueDiligenceData } from '../lib/dealsService';

// ============================================================================
// Due Diligence Checklist Items
// ============================================================================

const dueDiligenceCategories = [
  {
    id: 'property',
    name: 'Property & Physical',
    icon: Building2,
    color: '#0d9488',
    items: [
      { id: 'property-inspection', name: 'Property Inspection Report', description: 'Full physical inspection of all units, common areas, and systems' },
      { id: 'roof-inspection', name: 'Roof Inspection', description: 'Condition, age, and remaining useful life' },
      { id: 'hvac-inspection', name: 'HVAC Systems Review', description: 'Age, condition, and replacement schedule for all units' },
      { id: 'plumbing-inspection', name: 'Plumbing Inspection', description: 'Water heaters, pipes, fixtures condition' },
      { id: 'electrical-inspection', name: 'Electrical Systems', description: 'Panel capacity, wiring condition, code compliance' },
      { id: 'pest-inspection', name: 'Pest Inspection', description: 'Termite, rodent, and pest inspection report' },
      { id: 'environmental', name: 'Phase I Environmental', description: 'Environmental site assessment' },
      { id: 'survey', name: 'Survey & Plat', description: 'Current property survey and boundary verification' },
      { id: 'parking', name: 'Parking Analysis', description: 'Parking ratio, condition, and compliance' },
    ]
  },
  {
    id: 'financial',
    name: 'Financial & Income',
    icon: DollarSign,
    color: '#8b5cf6',
    items: [
      { id: 't12', name: 'Trailing 12 (T12) Verified', description: 'Verify all income and expenses for past 12 months' },
      { id: 'rent-roll', name: 'Rent Roll Audit', description: 'Verify current rents, lease terms, and tenant info' },
      { id: 'bank-statements', name: 'Bank Statements', description: '12-24 months of operating account statements' },
      { id: 'utility-bills', name: 'Utility Bills Review', description: '12-24 months of all utility bills' },
      { id: 'tax-returns', name: 'Tax Returns', description: '2-3 years of property tax returns' },
      { id: 'accounts-payable', name: 'Accounts Payable', description: 'Outstanding bills and vendor obligations' },
      { id: 'security-deposits', name: 'Security Deposits', description: 'Verify all tenant security deposits' },
      { id: 'proforma-validation', name: 'Pro Forma Validation', description: 'Validate seller pro forma assumptions' },
    ]
  },
  {
    id: 'legal',
    name: 'Legal & Title',
    icon: Scale,
    color: '#f59e0b',
    items: [
      { id: 'title-search', name: 'Title Search', description: 'Full title search and commitment' },
      { id: 'title-insurance', name: 'Title Insurance', description: 'Obtain title insurance policy' },
      { id: 'liens', name: 'Lien Search', description: 'Search for any outstanding liens or judgments' },
      { id: 'zoning', name: 'Zoning Verification', description: 'Verify current zoning and permitted uses' },
      { id: 'permits', name: 'Permits Review', description: 'Review all permits and certificates of occupancy' },
      { id: 'hoa-docs', name: 'HOA/Association Docs', description: 'Review any association documents and fees' },
      { id: 'easements', name: 'Easements Review', description: 'Review any easements or encumbrances' },
      { id: 'litigation', name: 'Litigation Search', description: 'Check for any pending or past litigation' },
    ]
  },
  {
    id: 'leases',
    name: 'Leases & Tenants',
    icon: Users,
    color: '#ec4899',
    items: [
      { id: 'lease-review', name: 'Lease Abstracts', description: 'Review all lease agreements and terms' },
      { id: 'tenant-estoppels', name: 'Tenant Estoppels', description: 'Obtain estoppel certificates from all tenants' },
      { id: 'rent-comps', name: 'Rent Comps', description: 'Verify market rents with comparable properties' },
      { id: 'delinquency', name: 'Delinquency Report', description: 'Review tenant payment history and delinquencies' },
      { id: 'lease-expirations', name: 'Lease Expiration Schedule', description: 'Review upcoming lease expirations' },
      { id: 'tenant-screening', name: 'Tenant Quality Review', description: 'Review tenant screening criteria and quality' },
    ]
  },
  {
    id: 'operations',
    name: 'Operations & Management',
    icon: Wrench,
    color: '#3b82f6',
    items: [
      { id: 'service-contracts', name: 'Service Contracts', description: 'Review all vendor and service contracts' },
      { id: 'pm-agreement', name: 'Property Management', description: 'Review current PM agreement (if applicable)' },
      { id: 'maintenance-records', name: 'Maintenance Records', description: 'Review maintenance history and work orders' },
      { id: 'capex-history', name: 'CapEx History', description: 'Review capital expenditure history' },
      { id: 'insurance-review', name: 'Insurance Review', description: 'Review current insurance policies and claims history' },
      { id: 'employee-review', name: 'Employee/Staff Review', description: 'Review any on-site employees or staff' },
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance & Regulatory',
    icon: Shield,
    color: '#ef4444',
    items: [
      { id: 'code-compliance', name: 'Building Code Compliance', description: 'Verify compliance with current building codes' },
      { id: 'fire-safety', name: 'Fire Safety Compliance', description: 'Fire alarms, sprinklers, extinguishers, exits' },
      { id: 'ada-compliance', name: 'ADA Compliance', description: 'Americans with Disabilities Act compliance' },
      { id: 'lead-paint', name: 'Lead Paint Disclosure', description: 'Lead paint inspection (if pre-1978)' },
      { id: 'asbestos', name: 'Asbestos Survey', description: 'Asbestos inspection (if applicable)' },
      { id: 'rent-control', name: 'Rent Control Review', description: 'Review any rent control or stabilization requirements' },
    ]
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

const fmtMoney = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
};

const fmtPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toFixed(2) + '%';
};

// ============================================================================
// Due Diligence Page Component
// ============================================================================

function DueDiligencePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  
  const [deal, setDeal] = useState(null);
  const [dealResults, setDealResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [checklist, setChecklist] = useState({});
  const [notes, setNotes] = useState({});
  
  // File upload state - stores parsed data summaries, not actual files
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const fileInputRef = useRef(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // UI state
  const [activeSection, setActiveSection] = useState('checklist');
  const [expandedCategories, setExpandedCategories] = useState({});

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load deal data and DD data from Supabase
  useEffect(() => {
    const fetchDeal = async () => {
      if (!dealId) {
        setLoading(false);
        return;
      }

      try {
        if (location.state?.verifiedData) {
          setDealResults(location.state.verifiedData);
        }
        
        const dealData = await loadDeal(dealId);
        if (dealData) {
          setDeal(dealData);
          if (dealData.scenarioData) {
            setDealResults(dealData.scenarioData);
          }
          
          // Load DD data from Supabase
          const ddData = await loadDueDiligenceData(dealId);
          if (ddData) {
            if (ddData.checklist) setChecklist(ddData.checklist);
            if (ddData.notes) setNotes(ddData.notes);
            if (ddData.uploadedDocuments) setUploadedDocuments(ddData.uploadedDocuments);
            if (ddData.chatHistory) setMessages(ddData.chatHistory);
          }
        }
      } catch (error) {
        console.error('Error loading deal:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [dealId, location.state]);

  // Save DD data to Supabase
  const saveToSupabase = useCallback(async () => {
    if (!dealId) return;
    
    setSaving(true);
    try {
      const ddData = {
        checklist,
        notes,
        uploadedDocuments,
        chatHistory: messages,
        lastUpdated: new Date().toISOString()
      };
      
      await saveDueDiligenceData(dealId, ddData);
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Error saving DD data:', error);
      setSaveMessage('Error saving');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  }, [dealId, checklist, notes, uploadedDocuments, messages]);

  // Auto-save when data changes (debounced)
  useEffect(() => {
    if (!dealId || loading) return;
    
    const timeoutId = setTimeout(() => {
      saveToSupabase();
    }, 2000); // Save 2 seconds after last change
    
    return () => clearTimeout(timeoutId);
  }, [checklist, notes, uploadedDocuments, messages, dealId, loading, saveToSupabase]);

  // File upload handlers - parses files and stores summary data (not actual files)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        // Create document record with parsed data summary (no raw file content)
        const documentData = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          parsedData: null,
          aiSummary: null
        };
        
        // Parse CSV files
        if (file.name.endsWith('.csv')) {
          try {
            const lines = event.target.result.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1).filter(l => l.trim()).map(line => {
              const values = line.split(',');
              const row = {};
              headers.forEach((h, i) => {
                row[h] = values[i]?.trim() || '';
              });
              return row;
            });
            documentData.parsedData = { 
              headers, 
              rows: rows.slice(0, 100), // Store first 100 rows max
              totalRows: rows.length
            };
          } catch (err) {
            console.error('Error parsing CSV:', err);
          }
        }
        
        // For non-CSV files, we'll send to AI for parsing/summarization
        if (!file.name.endsWith('.csv') && event.target.result) {
          // Store that file was uploaded, AI will analyze when user asks
          documentData.parsedData = {
            type: 'document',
            note: 'Document uploaded - use DD Assistant to analyze'
          };
        }
        
        setUploadedDocuments(prev => [...prev, documentData]);
      };
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        // For PDFs/images, we just note the upload (can't parse client-side)
        const documentData = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          parsedData: { type: 'document', note: 'Document uploaded - use DD Assistant to analyze' },
          aiSummary: null
        };
        setUploadedDocuments(prev => [...prev, documentData]);
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = (docId) => {
    setUploadedDocuments(prev => prev.filter(d => d.id !== docId));
  };

  // Update AI summary for a document (used when AI analyzes uploaded documents)
  // eslint-disable-next-line no-unused-vars
  const updateDocumentAiSummary = (docId, summary) => {
    setUploadedDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, aiSummary: summary } : doc
    ));
  };

  // Chat handlers
  const sendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const dealContext = {
        address: deal?.address,
        units: deal?.units,
        purchasePrice: deal?.purchasePrice,
        dealResults: dealResults,
        uploadedDocuments: uploadedDocuments.map(d => ({
          name: d.name,
          parsedData: d.parsedData,
          aiSummary: d.aiSummary
        })),
        checklist: checklist,
        notes: notes
      };

      const response = await fetch('http://localhost:8010/api/due-diligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          dealContext: dealContext,
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
          content: data.response
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error || 'Unknown error'}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Connection error. Please check that the server is running and try again.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (dealId) localStorage.removeItem(`dd-chat-${dealId}`);
  };

  // Checklist handlers
  const toggleItem = (itemId) => {
    setChecklist(prev => ({
      ...prev,
      [itemId]: prev[itemId] === 'complete' ? 'pending' : 
                prev[itemId] === 'pending' ? 'issue' :
                prev[itemId] === 'issue' ? undefined : 'complete'
    }));
  };

  const updateNote = (itemId, note) => {
    setNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 size={20} color="#22c55e" />;
      case 'pending':
        return <Circle size={20} color="#f59e0b" style={{ fill: '#fef3c7' }} />;
      case 'issue':
        return <AlertTriangle size={20} color="#ef4444" />;
      default:
        return <Circle size={20} color="#d1d5db" />;
    }
  };

  const getCategoryProgress = (category) => {
    const completed = category.items.filter(item => checklist[item.id] === 'complete').length;
    const issues = category.items.filter(item => checklist[item.id] === 'issue').length;
    return { completed, issues, total: category.items.length };
  };

  const getTotalProgress = () => {
    let completed = 0, issues = 0, total = 0;
    dueDiligenceCategories.forEach(cat => {
      cat.items.forEach(item => {
        total++;
        if (checklist[item.id] === 'complete') completed++;
        if (checklist[item.id] === 'issue') issues++;
      });
    });
    return { completed, issues, total };
  };

  const totalProgress = getTotalProgress();
  const progressPercent = Math.round((totalProgress.completed / totalProgress.total) * 100);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading due diligence...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!dealId || !deal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Deal Not Found</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Please select a deal from your pipeline to view its due diligence.
          </p>
          <button onClick={() => navigate('/pipeline')} style={{ padding: '12px 24px', backgroundColor: '#0d9488', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            Go to Pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e293b', padding: '20px 32px', color: 'white' }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => navigate('/pipeline')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                <ArrowLeft size={18} />
                Pipeline
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardCheck size={24} />
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>Due Diligence</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9, fontSize: '14px' }}>
                    <MapPin size={14} />
                    <span>{deal.address || 'Property Address'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress & Save Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {/* Save Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '13px' }}>
                <Save size={14} />
                <span>{saving ? 'Saving...' : saveMessage || 'Auto-save enabled'}</span>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: '700' }}>{progressPercent}%</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>{totalProgress.completed}/{totalProgress.total} complete</div>
              </div>
              <div style={{ width: '120px', height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? '#22c55e' : 'white', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            {[
              { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
              { id: 'comparison', label: 'Compare Numbers', icon: FileSpreadsheet },
              { id: 'chat', label: 'DD Assistant', icon: MessageSquare }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1800px', margin: '0 auto', padding: '24px 32px' }}>
        
        {/* CHECKLIST SECTION */}
        {activeSection === 'checklist' && (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '24px', padding: '14px 20px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Status:</span>
              {[
                { icon: <Circle size={16} color="#d1d5db" />, label: 'Not Started' },
                { icon: <CheckCircle2 size={16} color="#22c55e" />, label: 'Complete' },
                { icon: <Circle size={16} color="#f59e0b" style={{ fill: '#fef3c7' }} />, label: 'In Progress' },
                { icon: <AlertTriangle size={16} color="#ef4444" />, label: 'Issue' }
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.icon}
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Categories */}
            {dueDiligenceCategories.map(category => {
              const progress = getCategoryProgress(category);
              const Icon = category.icon;
              const isExpanded = expandedCategories[category.id] !== false;
              
              return (
                <div key={category.id} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    style={{ width: '100%', padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${category.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={18} color={category.color} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: 0 }}>{category.name}</h3>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {progress.completed}/{progress.total} complete
                          {progress.issues > 0 && ` • ${progress.issues} issues`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '80px', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(progress.completed / progress.total) * 100}%`, backgroundColor: category.color, borderRadius: '3px' }} />
                      </div>
                      {isExpanded ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #e5e7eb' }}>
                      {category.items.map((item, idx) => (
                        <div key={item.id} style={{ padding: '14px 20px', borderBottom: idx < category.items.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <button onClick={() => toggleItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginTop: '2px' }} title="Click to cycle status">
                            {getStatusIcon(checklist[item.id])}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>{item.name}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{item.description}</div>
                            <input
                              type="text"
                              placeholder="Add notes..."
                              value={notes[item.id] || ''}
                              onChange={(e) => updateNote(item.id, e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* COMPARISON SECTION */}
        {activeSection === 'comparison' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Left: Original Deal Numbers */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#1e293b', color: 'white' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Original Underwriting</h3>
                <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0' }}>Numbers from initial deal analysis</p>
              </div>
              <div style={{ padding: '20px' }}>
                {dealResults ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Purchase Price</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtMoney(dealResults.pricing_financing?.purchase_price || deal?.purchasePrice)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Units</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{dealResults.property?.units || deal?.units || '-'}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Gross Income</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtMoney(dealResults.pnl?.potential_gross_income)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Vacancy Rate</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtPercent(dealResults.pnl?.vacancy_rate)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Operating Expenses</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtMoney(dealResults.pnl?.operating_expenses)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>LTV</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtPercent(dealResults.financing?.ltv)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Interest Rate</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{fmtPercent(dealResults.financing?.interest_rate)}</div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Day 1 Cash Flow</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: deal?.day1CashFlow >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoney(deal?.day1CashFlow)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <Building2 size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <p>No detailed underwriting data available</p>
                    <p style={{ fontSize: '12px' }}>View the deal from Pipeline to load full data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Uploaded/Actual Numbers */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#0d9488', color: 'white' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Actual Numbers</h3>
                <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0' }}>Upload inspection reports & spreadsheets to compare</p>
              </div>
              <div style={{ padding: '20px' }}>
                {/* Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '32px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f9fafb',
                    marginBottom: '16px'
                  }}
                >
                  <Upload size={32} color="#9ca3af" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>Click to upload files</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>CSV, Excel, PDF, or images</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {/* Uploaded Documents */}
                {uploadedDocuments.length > 0 && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {uploadedDocuments.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        {doc.name.endsWith('.csv') || doc.name.includes('xls') ? (
                          <FileSpreadsheet size={20} color="#22c55e" />
                        ) : (
                          <FileText size={20} color="#6b7280" />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{doc.name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {(doc.size / 1024).toFixed(1)} KB
                            {doc.aiSummary && <span style={{ color: '#22c55e', marginLeft: '8px' }}>• AI analyzed</span>}
                          </div>
                        </div>
                        <button onClick={() => removeDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <X size={16} color="#ef4444" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Parsed Data Preview */}
                {uploadedDocuments.some(d => d.parsedData) && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#065f46', marginBottom: '8px' }}>
                      ✓ Data parsed successfully
                    </div>
                    <div style={{ fontSize: '11px', color: '#047857' }}>
                      Use the DD Assistant tab to analyze and compare these numbers with your original underwriting.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHAT SECTION */}
        {activeSection === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', height: 'calc(100vh - 220px)' }}>
            {/* Chat Window */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#0d948815', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={20} color="#0d9488" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>DD Assistant</h3>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Cross-reference numbers & verify deal viability</p>
                  </div>
                </div>
                {messages.length > 0 && (
                  <button onClick={clearChat} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                    Clear
                  </button>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Bot size={48} color="#d1d5db" style={{ marginBottom: '16px' }} />
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Start Your DD Analysis</h4>
                    <p style={{ fontSize: '13px', color: '#6b7280', maxWidth: '400px', margin: '0 auto 24px' }}>
                      Ask me to cross-reference your uploaded documents with the original underwriting, verify numbers, or suggest debt restructuring if needed.
                    </p>
                    <div style={{ display: 'grid', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
                      {[
                        'Compare the actual T12 with our underwriting assumptions',
                        'Are the actual operating expenses higher than projected?',
                        'Does this deal still work with the real numbers?',
                        'What changes to the debt structure would make this deal work?'
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setChatInput(suggestion)}
                          style={{ padding: '10px 14px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', color: '#374151', cursor: 'pointer', textAlign: 'left' }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '80%',
                          padding: '12px 16px',
                          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: msg.role === 'user' ? '#0d9488' : '#f3f4f6',
                          color: msg.role === 'user' ? 'white' : '#111827',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '12px 16px', backgroundColor: '#f3f4f6', borderRadius: '16px 16px 16px 4px', fontSize: '14px', color: '#6b7280' }}>
                          Analyzing...
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask about discrepancies, verify numbers, or get restructuring advice..."
                    style={{ flex: 1, padding: '12px 16px', fontSize: '14px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: '#f9fafb' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: chatInput.trim() && !isChatLoading ? '#0d9488' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: chatInput.trim() && !isChatLoading ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Context Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Deal Summary */}
              <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>Deal Summary</h4>
                <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Address</span>
                    <span style={{ color: '#111827', fontWeight: '500' }}>{deal?.address?.substring(0, 25) || '-'}...</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Units</span>
                    <span style={{ color: '#111827', fontWeight: '500' }}>{deal?.units || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Price</span>
                    <span style={{ color: '#111827', fontWeight: '500' }}>{fmtMoney(deal?.purchasePrice)}</span>
                  </div>
                </div>
              </div>

              {/* Uploaded Documents */}
              <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>Documents ({uploadedDocuments.length})</h4>
                {uploadedDocuments.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>No documents uploaded yet. Go to Compare Numbers tab to upload.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {uploadedDocuments.map(d => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <FileText size={14} color={d.aiSummary ? '#22c55e' : '#6b7280'} />
                        <span style={{ color: '#111827' }}>{d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist Progress */}
              <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>DD Progress</h4>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#6b7280' }}>Completed</span>
                    <span style={{ color: '#22c55e', fontWeight: '600' }}>{totalProgress.completed}/{totalProgress.total}</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#22c55e', borderRadius: '3px' }} />
                  </div>
                </div>
                {totalProgress.issues > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
                    <AlertTriangle size={14} />
                    <span>{totalProgress.issues} issues flagged</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DueDiligencePage;
