import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Upload, FileText, Building2, Layers, Sparkles, ArrowLeft, Users } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { loadPipelineDeals, loadDeal } from '../lib/dealsService';

function PitchDeckPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealIdFromUrl = searchParams.get('dealId');
  
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [pipelineDeals, setPipelineDeals] = useState([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [isLoadingDeal, setIsLoadingDeal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [structureType, setStructureType] = useState(null); // 'jv' | 'syndication'
  const [creationMode, setCreationMode] = useState('manual'); // 'manual' | 'ai'
  const [sections, setSections] = useState([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Load deal if dealId in URL
  useEffect(() => {
    if (dealIdFromUrl) {
      loadDealFromPipeline(dealIdFromUrl);
    }
  }, [dealIdFromUrl]);

  // Load pipeline deals
  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setIsLoadingPipeline(true);
    try {
      const deals = await loadPipelineDeals();
      setPipelineDeals(deals);
    } catch (error) {
      console.error('Error loading pipeline deals:', error);
      setPipelineDeals([]);
    } finally {
      setIsLoadingPipeline(false);
    }
  };

  const loadDealFromPipeline = async (dealId) => {
    setIsLoadingDeal(true);
    try {
      const dealData = await loadDeal(dealId);
      if (dealData) {
        setSelectedDeal(dealData);
        setStructureType(null);
        setSections([]);
      } else {
        alert('Deal not found in pipeline');
      }
    } catch (error) {
      console.error('Error loading deal:', error);
      alert('Failed to load deal: ' + error.message);
    } finally {
      setIsLoadingDeal(false);
    }
  };

  const handleSelectDeal = (deal) => {
    loadDealFromPipeline(deal.dealId);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    // TODO: Parse file and create pitch deck data
    alert('File upload for pitch deck coming soon!');
  };

  // Helper: safely format currency
  const fmtCurrency = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const n = Number(value);
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const fmtPercent = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    const n = Number(value);
    return `${n.toFixed(1)}%`;
  };

  const handleGenerateAIDeck = async () => {
    if (!selectedDeal) return;
    if (!structureType) {
      alert('Choose JV/Equity Partner or Syndication first.');
      return;
    }

    try {
      setIsGeneratingAI(true);
      const response = await fetch(`/v2/deals/${selectedDeal.dealId}/pitch-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structureType }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to generate pitch deck');
      }

      const data = await response.json();
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        // Normalize into our local sections format
        setSections(
          data.sections.map((s, idx) => ({
            id: s.id || `section-${idx}`,
            title: s.title || 'Section',
            content: s.body || '',
          }))
        );
      } else if (data.text) {
        setSections([
          {
            id: 'summary',
            title: 'Pitch Deck Narrative',
            content: data.text,
          },
        ]);
      }
    } catch (err) {
      console.error('Error generating AI pitch deck:', err);
      alert('Failed to generate AI pitch deck: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Build initial pitch deck sections once we have a deal + structure choice
  useEffect(() => {
    if (!selectedDeal || !structureType || sections.length > 0) return;

    const { scenarioData, parsedData, dealStructure, purchasePrice, units, address, images } = selectedDeal;
    const calcs = scenarioData?.calculations || {};

    const assetType = parsedData?.property?.asset_type
      || parsedData?.property?.property_type
      || scenarioData?.property?.asset_type
      || 'Multifamily';

    const locationParts = [
      parsedData?.property?.city || scenarioData?.property?.city,
      parsedData?.property?.state || scenarioData?.property?.state,
    ].filter(Boolean);
    const location = locationParts.join(', ');

    const targetIrr = calcs.leveredIRR || calcs.irr || null;
    const equityMultiple = calcs.equityMultiple || null;
    const cashOnCash = calcs.avgCashOnCash || calcs.cashOnCash || null;

    const oneLiner = `${assetType} opportunity in ${location || 'target market'} targeting ${fmtPercent(targetIrr)} IRR and ${equityMultiple ? equityMultiple.toFixed(2) + 'x' : 'strong'} equity multiple.`;

    const basicSections = [
      {
        id: 'cover',
        title: 'Cover Slide',
        content:
          `${address || 'Project Name'}\n` +
          `${assetType} — ${location || 'Target Market'}\n` +
          `${structureType === 'syndication' ? 'Syndication Equity Raise' : 'JV / Equity Partner Opportunity'}\n` +
          `Target IRR: ${fmtPercent(targetIrr)} | Target CoC: ${fmtPercent(cashOnCash)}`,
      },
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        content:
          `${oneLiner}\n\n` +
          `• ${units || parsedData?.property?.units || 'Number of'} units at ${fmtCurrency(purchasePrice)} purchase price.\n` +
          `• ${structureType === 'syndication' ? 'Investor capital raised via syndication with defined waterfall.' : 'Seeking a single equity partner on a joint-venture basis.'}\n` +
          `• Business plan: value-add operations, improved management, and optimized rents.`,
      },
      {
        id: 'deal-overview',
        title: 'Deal Overview',
        content:
          `Purchase Price: ${fmtCurrency(purchasePrice)}\n` +
          `Units: ${units || parsedData?.property?.units || 'N/A'}\n` +
          `Structure: ${structureType === 'syndication' ? 'Syndication' : 'JV / Equity Partner'} (current: ${dealStructure || 'Traditional'})\n` +
          `Target IRR: ${fmtPercent(targetIrr)} | Target CoC: ${fmtPercent(cashOnCash)}\n` +
          `Target Equity Multiple: ${equityMultiple ? equityMultiple.toFixed(2) + 'x' : 'N/A'}`,
      },
      {
        id: 'strategy',
        title: 'Solution / Strategy',
        content:
          `• Execute a focused value-add plan: renovate interiors, tighten operations, and modernize common areas.\n` +
          `• Improve rent collections and bring below-market rents up to market.\n` +
          `• Optimize expenses (taxes, insurance, utilities, and management) based on underwriting.`,
      },
      {
        id: 'returns',
        title: 'Financial Summary & Returns',
        content:
          `IRR Target: ${fmtPercent(targetIrr)}\n` +
          `Average Cash-on-Cash: ${fmtPercent(cashOnCash)}\n` +
          `Equity Multiple: ${equityMultiple ? equityMultiple.toFixed(2) + 'x' : 'N/A'}\n` +
          `Hold Period: ${scenarioData?.hold_period_years || scenarioData?.holdPeriodYears || 5} years (base case).`,
      },
      {
        id: 'ask',
        title: 'Ask & Next Steps',
        content:
          `• Seeking capital partner to fund equity for ${address || 'this project'}.\n` +
          `• Exact raise amount and minimum check size pulled from your underwriting model.\n` +
          `• Next steps: review full model, confirm assumptions, and align on partnership structure.`,
      },
    ];

    setSections(basicSections);
  }, [selectedDeal, structureType, sections.length]);

  return (
    <DashboardShell activeTab="pitch-deck" title="Pitch Deck">
      <div
        style={{
          padding: '32px 40px',
          backgroundColor: '#f4f6fb',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            border: '2px solid #8b5cf6',
            borderRadius: '18px',
            padding: '24px 32px 32px',
            backgroundColor: '#ffffff',
            boxShadow: '0 18px 45px rgba(139,92,246,0.18)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '16px',
                  marginRight: '12px',
                }}
              >
                <Sparkles size={18} />
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                PITCH DECK GENERATOR
              </h2>
            </div>
            
            {/* Upload Button */}
            <button
              onClick={() => document.getElementById('pitch-deck-upload').click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Upload size={16} />
              Upload Deal File
            </button>
            <input
              id="pitch-deck-upload"
              type="file"
              accept=".pdf,.xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* Instructions */}
          <div
            style={{
              backgroundColor: '#f0f9ff',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
              📋 How to Create Your Pitch Deck
            </div>
            <div style={{ fontSize: '12px', color: '#1e3a8a', lineHeight: '1.6' }}>
              Select a deal from your pipeline below, or upload a new deal file (PDF/Excel). Your pitch deck will include property overview, financial metrics, market analysis, and investment highlights.
            </div>
          </div>

          {/* Pipeline Deals Selection */}
          {isLoadingDeal ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Loading deal data...</div>
            </div>
          ) : selectedDeal ? (
            // Show selected deal and pitch deck preview
            <div>
              {/* Back Button */}
              <button
                onClick={() => setSelectedDeal(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '20px',
                }}
              >
                <ArrowLeft size={14} />
                Back to Pipeline
              </button>

              {/* Deal Header */}
              <div
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                      {selectedDeal.address}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                      <span><strong>{selectedDeal.units}</strong> Units</span>
                      <span><strong>${(selectedDeal.purchasePrice / 1000000).toFixed(2)}M</strong> Purchase Price</span>
                      <span><strong>{selectedDeal.dealStructure}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Main Pitch Deck Builder */}
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                {/* Left: Settings & Images */}
                <div style={{ flexBasis: '320px', flexShrink: 0 }}>
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      padding: '16px 18px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                      Deal Structure
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                      Choose how you&apos;re structuring this raise for investors.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setStructureType('jv')}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: structureType === 'jv' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                          backgroundColor: structureType === 'jv' ? '#f5f3ff' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#111827',
                          cursor: 'pointer',
                        }}
                      >
                        <Users size={14} />
                        JV / Equity Partner
                      </button>
                      <button
                        onClick={() => setStructureType('syndication')}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: structureType === 'syndication' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                          backgroundColor: structureType === 'syndication' ? '#f5f3ff' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#111827',
                          cursor: 'pointer',
                        }}
                      >
                        <Layers size={14} />
                        Syndication
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      padding: '16px 18px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                      Creation Mode
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                      Start with editable copy, or let AI draft it.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setCreationMode('manual')}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: creationMode === 'manual' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                          backgroundColor: creationMode === 'manual' ? '#f5f3ff' : '#ffffff',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#111827',
                          cursor: 'pointer',
                        }}
                      >
                        Manual (1–2 Pages)
                      </button>
                      <button
                        onClick={() => setCreationMode('ai')}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: creationMode === 'ai' ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                          backgroundColor: creationMode === 'ai' ? '#f5f3ff' : '#ffffff',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#111827',
                          cursor: 'pointer',
                        }}
                      >
                        AI Draft (LLM)
                      </button>
                    </div>
                    {creationMode === 'ai' && (
                      <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
                        AI pitch deck text will be generated from your underwriting results and market data.
                      </div>
                    )}
                  </div>

                  {selectedDeal.images && selectedDeal.images.length > 0 && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        padding: '16px 18px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                        Property Photos
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
                        Pulled automatically from the OM you uploaded.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                        {selectedDeal.images.map((img, idx) => (
                          <div
                            key={img.storage_path || img.url || idx}
                            style={{
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#f9fafb',
                            }}
                          >
                            <img
                              src={img.url || img.publicUrl}
                              alt={img.filename || `Property image ${idx + 1}`}
                              style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Sections / Preview */}
                <div style={{ flex: 1 }}>
                  {creationMode === 'manual' && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        padding: '18px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>1–2 Page Pitch Deck</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Edit each section below, then copy into your slide template.
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const text = sections.map((s) => `${s.title}\n${'-'.repeat(s.title.length)}\n${s.content}`).join('\n\n');
                            navigator.clipboard.writeText(text).catch(() => {});
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#f9fafb',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Copy Deck Text
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                        {sections.map((section, idx) => (
                          <div
                            key={section.id}
                            style={{
                              borderRadius: '10px',
                              border: '1px solid #e5e7eb',
                              padding: '10px 12px',
                              backgroundColor: '#f9fafb',
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                              {section.title}
                            </div>
                            <textarea
                              value={section.content}
                              onChange={(e) => {
                                const next = [...sections];
                                next[idx] = { ...next[idx], content: e.target.value };
                                setSections(next);
                              }}
                              rows={4}
                              style={{
                                width: '100%',
                                resize: 'vertical',
                                fontSize: '11px',
                                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: '#111827',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {creationMode === 'ai' && (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        padding: '18px 20px',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                        AI Pitch Deck
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                        Uses your underwriting results (NOI, IRR, equity multiple, cap stack, hold period) to draft an investor-ready narrative.
                      </div>
                      <button
                        onClick={handleGenerateAIDeck}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: isGeneratingAI ? '#6d28d9' : '#8b5cf6',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: isGeneratingAI ? 'default' : 'pointer',
                        }}
                        disabled={isGeneratingAI}
                      >
                        {isGeneratingAI ? 'Generating…' : 'Generate AI Draft'}
                      </button>
                      {sections.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>
                            Draft Sections
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                            {sections.map((section, idx) => (
                              <div key={section.id || idx} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                                  {section.title}
                                </div>
                                <textarea
                                  value={section.content}
                                  onChange={(e) => {
                                    const next = [...sections];
                                    next[idx] = { ...next[idx], content: e.target.value };
                                    setSections(next);
                                  }}
                                  rows={4}
                                  style={{
                                    width: '100%',
                                    resize: 'vertical',
                                    fontSize: '11px',
                                    fontFamily:
                                      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#ffffff',
                                    color: '#111827',
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Show pipeline deals grid
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#374151',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Select a Deal from Your Pipeline
              </div>

              {isLoadingPipeline ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Loading pipeline...</div>
                </div>
              ) : pipelineDeals.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '12px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Building2 size={48} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                    No Deals in Pipeline
                  </div>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
                    Upload a deal or push one from your underwriting results first.
                  </div>
                  <button
                    onClick={() => navigate('/underwrite')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Go to Underwriting
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {pipelineDeals.map((deal) => (
                    <div
                      key={deal.dealId}
                      onClick={() => handleSelectDeal(deal)}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: '#ffffff',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#8b5cf6';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'start', marginBottom: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#f0f9ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '12px',
                          }}
                        >
                          <Building2 size={20} style={{ color: '#3b82f6' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#111827',
                              marginBottom: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {deal.address}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {deal.units} Units • ${(deal.purchasePrice / 1000000).toFixed(2)}M
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          paddingTop: '12px',
                          borderTop: '1px solid #f3f4f6',
                          fontSize: '11px',
                          color: '#9ca3af',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {deal.dealStructure || 'Traditional'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Initial structure-choice popup once a deal is loaded */}
      {selectedDeal && !structureType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '22px 24px 20px',
              boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                How are you structuring this deal?
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Choose between a simple JV / equity partner or a full syndication. This shapes how the pitch deck is framed.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => setStructureType('jv')}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    backgroundColor: '#eef2ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={18} color="#4f46e5" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>JV / Equity Partner</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>One or a few partners on the cap stack.</div>
                </div>
              </button>
              <button
                onClick={() => setStructureType('syndication')}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    backgroundColor: '#ecfeff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={18} color="#0ea5e9" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Syndication</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Multiple LP investors with a waterfall structure.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default PitchDeckPage;
