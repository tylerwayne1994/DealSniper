import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Bot,
  Shield,
  Database,
  Play,
  Save,
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
  Clock3,
  Layers,
  Zap,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import RapidFirePage from './RapidFirePage';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../lib/supabase';

const STEPS = [
  { id: 'basic', title: 'Basic Information', subtitle: 'Name, mission, and identity' },
  { id: 'model', title: 'AI Model', subtitle: 'Model + runner selection' },
  { id: 'tools', title: 'Tools & Capabilities', subtitle: 'Enable functionality' },
  { id: 'pattern', title: 'Agent Pattern', subtitle: 'Reasoning style' },
  { id: 'trigger-buybox', title: 'Triggers & Buy Box', subtitle: 'What to hunt and when' },
  { id: 'knowledge', title: 'Knowledge Sources', subtitle: 'Inputs and references' },
  { id: 'instructions', title: 'System Instructions', subtitle: 'Behavior and output format' },
  { id: 'governance', title: 'Governance', subtitle: 'Guardrails and risk controls' },
  { id: 'memory', title: 'Memory Settings', subtitle: 'Retention and continuity' },
];

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 18,
};

const label = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const input = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  color: '#0f172a',
  background: '#ffffff',
  boxSizing: 'border-box',
};

function AgentBuilderPage() {
  const [mode, setMode] = useState('builder');
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [runs, setRuns] = useState([]);
  const [deals, setDeals] = useState([]);
  const runPollRef = useRef(null);
  const runPollTimeoutRef = useRef(null);

  const [platforms, setPlatforms] = useState([
    { platform_id: 'crexi', enabled: true, username: '', password: '' },
    { platform_id: 'zillow', enabled: false, username: '', password: '' },
    { platform_id: 'propstream', enabled: false, username: '', password: '' },
  ]);

  const [agent, setAgent] = useState({
    name: 'Deal Hunter',
    description: 'Find, score, and prioritize on-market and broker-delivered CRE deals that match my buy box.',
    tags: 'multifamily, value-add, cashflow',
    avatar: '',
    model: 'claude-sonnet-4-5-20250929',
    runnerType: 'native',
    underwritingDepth: 'deep',
    pattern: 'react-adaptive',
    tools: {
      rapidfire_batch_underwrite: true,
      browser_search: true,
      om_download: true,
      ai_summary: true,
      pipeline_push: true,
      comp_scan: false,
    },
    runsPerWeek: 3,
    systemInstructions:
      'Prioritize cash-flowing multifamily opportunities. Do not hallucinate financial fields. If data is missing, flag it explicitly and include confidence notes.',
    governance: {
      piiRedaction: true,
      legalPolicyChecks: true,
      requireSourceUrl: true,
      restrictUnknownDocs: true,
    },
    memoryEnabled: true,
    knowledgeSources: {
      vectorStores: '',
      attachments: '',
      notes: 'Use historical wins/losses from previous rapid-fire uploads when ranking similar listings.',
    },
  });

  const [buyBox, setBuyBox] = useState({
    states: 'TX, GA, FL',
    cities: '',
    zip_codes: '',
    property_types: 'Multifamily',
    min_price: '',
    max_price: '',
    min_cap_rate: '6.5',
    max_cap_rate: '',
    min_units: '20',
    max_units: '',
    min_occupancy: '',
    max_occupancy: '',
  });

  const activeStep = STEPS[step];

  const normalizeList = (v) =>
    (v || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const asNumber = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const builderPayload = useMemo(() => ({
    name: agent.name,
    description: agent.description,
    tags: normalizeList(agent.tags),
    avatar: agent.avatar,
    model: agent.model,
    runner_type: agent.runnerType,
    underwriting_depth: agent.underwritingDepth,
    pattern: agent.pattern,
    tools: agent.tools,
    system_instructions: agent.systemInstructions,
    governance: agent.governance,
    memory_enabled: agent.memoryEnabled,
    knowledge_sources: agent.knowledgeSources,
  }), [agent]);

  const buyBoxPayload = useMemo(() => ({
    states: normalizeList(buyBox.states),
    cities: normalizeList(buyBox.cities),
    zip_codes: normalizeList(buyBox.zip_codes),
    property_types: normalizeList(buyBox.property_types),
    min_price: asNumber(buyBox.min_price),
    max_price: asNumber(buyBox.max_price),
    min_cap_rate: asNumber(buyBox.min_cap_rate),
    max_cap_rate: asNumber(buyBox.max_cap_rate),
    min_units: asNumber(buyBox.min_units),
    max_units: asNumber(buyBox.max_units),
    min_occupancy: asNumber(buyBox.min_occupancy),
    max_occupancy: asNumber(buyBox.max_occupancy),
  }), [buyBox]);

  const loadRunsAndDeals = async (uid, configId) => {
    if (!uid || !configId) return;
    const headers = { 'X-User-ID': uid };

    const [runsRes, dealsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/agents/runs?agent_id=${configId}`, { headers }),
      fetch(`${API_BASE_URL}/api/agents/deals?limit=20`, { headers }),
    ]);

    const runsData = await runsRes.json();
    const dealsData = await dealsRes.json();
    const nextRuns = Array.isArray(runsData.runs) ? runsData.runs : [];
    setRuns(nextRuns);
    setDeals(Array.isArray(dealsData.deals) ? dealsData.deals : []);
    return nextRuns;
  };

  const stopRunPolling = () => {
    if (runPollRef.current) {
      clearInterval(runPollRef.current);
      runPollRef.current = null;
    }
    if (runPollTimeoutRef.current) {
      clearTimeout(runPollTimeoutRef.current);
      runPollTimeoutRef.current = null;
    }
  };

  const startRunPolling = (uid, configId, runId) => {
    stopRunPolling();

    const tick = async () => {
      try {
        const latestRuns = await loadRunsAndDeals(uid, configId);
        if (!Array.isArray(latestRuns) || !latestRuns.length) return;

        const run = latestRuns.find((r) => r.id === runId) || latestRuns[0];
        if (!run) return;

        if (run.status === 'completed') {
          setStatus(`Run completed: ${run.deals_found || 0} deals found.`);
          stopRunPolling();
          return;
        }

        if (run.status === 'failed') {
          setStatus(`Run failed: ${run.error || 'Unknown error'}`);
          stopRunPolling();
          return;
        }

        setStatus(`Run in progress (${run.status || 'running'})...`);
      } catch (err) {
        console.error('Run poll error:', err);
      }
    };

    tick();
    runPollRef.current = setInterval(tick, 4000);
    runPollTimeoutRef.current = setTimeout(() => {
      stopRunPolling();
      setStatus('Run is taking longer than expected. Check Recent Runs for updates.');
    }, 10 * 60 * 1000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await supabase.auth.getUser();
        const uid = userRes?.data?.user?.id || '';
        setUserId(uid);
        if (!uid) return;

        const res = await fetch(`${API_BASE_URL}/api/agents/config`, {
          headers: { 'X-User-ID': uid },
        });
        const data = await res.json();
        const config = data?.config;
        if (!config) return;

        setAgentId(config.id || '');
        if (config.buy_box) {
          const bb = config.buy_box;
          setBuyBox((prev) => ({
            ...prev,
            states: (bb.states || []).join(', '),
            cities: (bb.cities || []).join(', '),
            zip_codes: (bb.zip_codes || []).join(', '),
            property_types: (bb.property_types || []).join(', '),
            min_price: bb.min_price ?? '',
            max_price: bb.max_price ?? '',
            min_cap_rate: bb.min_cap_rate ?? '',
            max_cap_rate: bb.max_cap_rate ?? '',
            min_units: bb.min_units ?? '',
            max_units: bb.max_units ?? '',
            min_occupancy: bb.min_occupancy ?? '',
            max_occupancy: bb.max_occupancy ?? '',
          }));
        }

        if (config.builder) {
          const b = config.builder;
          setAgent((prev) => ({
            ...prev,
            name: b.name || prev.name,
            description: b.description || prev.description,
            tags: Array.isArray(b.tags) ? b.tags.join(', ') : prev.tags,
            avatar: b.avatar || prev.avatar,
            model: b.model || prev.model,
            runnerType: b.runner_type || prev.runnerType,
            pattern: b.pattern || prev.pattern,
            underwritingDepth: b.underwriting_depth || prev.underwritingDepth,
            tools: { ...prev.tools, ...(b.tools || {}) },
            systemInstructions: b.system_instructions || prev.systemInstructions,
            governance: { ...prev.governance, ...(b.governance || {}) },
            memoryEnabled: b.memory_enabled ?? prev.memoryEnabled,
            knowledgeSources: { ...prev.knowledgeSources, ...(b.knowledge_sources || {}) },
          }));
        }

        setAgent((prev) => ({ ...prev, runsPerWeek: config.runs_per_week || prev.runsPerWeek }));

        if (Array.isArray(config.platforms)) {
          setPlatforms((prev) =>
            prev.map((p) => {
              const match = config.platforms.find((x) => x.platform_id === p.platform_id);
              return match ? { ...p, enabled: true } : p;
            })
          );
        }

        await loadRunsAndDeals(uid, config.id);
      } catch (err) {
        console.error('Agent Builder init error:', err);
        setStatus('Failed to load existing agent config.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
    return () => stopRunPolling();
  }, []);

  const persistConfig = async () => {
    if (!userId) throw new Error('No authenticated user found.');

    const payload = {
      platforms: platforms
        .filter((p) => p.enabled)
        .map((p) => ({
          platform_id: p.platform_id,
          username: p.username,
          password: p.password,
        })),
      buy_box: buyBoxPayload,
      runs_per_week: Number(agent.runsPerWeek) || 1,
      builder: builderPayload,
    };

    const endpoint = agentId
      ? `${API_BASE_URL}/api/agents/config/${agentId}`
      : `${API_BASE_URL}/api/agents/config`;

    const method = agentId ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Failed saving agent config');
    }

    const data = await res.json();
    const savedId = data?.id || data?.config?.id || agentId;
    if (savedId) setAgentId(savedId);
    return savedId;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('');
    try {
      const savedId = await persistConfig();
      setStatus('Agent Builder saved successfully.');
      if (savedId) await loadRunsAndDeals(userId, savedId);
    } catch (err) {
      console.error(err);
      setStatus(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    setStatus('');
    try {
      const savedId = await persistConfig();
      const res = await fetch(`${API_BASE_URL}/api/agents/config/${savedId}/run`, {
        method: 'POST',
        headers: { 'X-User-ID': userId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Failed triggering run');
      setStatus(`Run started (${data.dispatch || 'queued'}).`);
      await loadRunsAndDeals(userId, savedId);
      if (data?.run_id) startRunPolling(userId, savedId, data.run_id);
    } catch (err) {
      console.error(err);
      setStatus(`Run failed: ${err.message}`);
      stopRunPolling();
    } finally {
      setIsRunning(false);
    }
  };

  const toggleTool = (key) => {
    setAgent((prev) => ({
      ...prev,
      tools: { ...prev.tools, [key]: !prev.tools[key] },
    }));
  };

  const renderStep = () => {
    if (activeStep.id === 'basic') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={label}>Agent Name</label>
            <input style={input} value={agent.name} onChange={(e) => setAgent((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={label}>Agent Description</label>
            <textarea style={{ ...input, minHeight: 120, resize: 'vertical' }} value={agent.description} onChange={(e) => setAgent((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Tags (comma separated)</label>
            <input style={input} value={agent.tags} onChange={(e) => setAgent((p) => ({ ...p, tags: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Avatar URL (optional)</label>
            <input style={input} value={agent.avatar} onChange={(e) => setAgent((p) => ({ ...p, avatar: e.target.value }))} />
          </div>
        </div>
      );
    }

    if (activeStep.id === 'model') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Model</label>
            <select style={input} value={agent.model} onChange={(e) => setAgent((p) => ({ ...p, model: e.target.value }))}>
              <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="o3">OpenAI o3</option>
            </select>
          </div>
          <div>
            <label style={label}>Runner</label>
            <select style={input} value={agent.runnerType} onChange={(e) => setAgent((p) => ({ ...p, runnerType: e.target.value }))}>
              <option value="native">DealSniper Native Browser Agent</option>
              <option value="browseros">BrowserOS Runner</option>
            </select>
          </div>
          <div>
            <label style={label}>Underwriting Depth</label>
            <select style={input} value={agent.underwritingDepth} onChange={(e) => setAgent((p) => ({ ...p, underwritingDepth: e.target.value }))}>
              <option value="fast">Fast Screen</option>
              <option value="deep">Deep Underwrite</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / span 2', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
            BrowserOS mode can be enabled now, and will fall back to the native runner if BrowserOS server is not configured.
          </div>
        </div>
      );
    }

    if (activeStep.id === 'tools') {
      const toolCards = [
        { key: 'rapidfire_batch_underwrite', title: 'Rapid Fire Batch Underwrite', icon: FileSpreadsheet, text: 'Preserves your current Rapid Fire spreadsheet underwriting flow.' },
        { key: 'browser_search', title: 'Browser Deal Hunt', icon: Search, text: 'Search listing portals using buy box filters.' },
        { key: 'om_download', title: 'OM / Flyer Download', icon: Globe, text: 'Collect offering docs when available.' },
        { key: 'ai_summary', title: 'AI Deal Summary', icon: Brain, text: 'Generate concise deal notes and missing-data flags.' },
        { key: 'pipeline_push', title: 'Push to Pipeline', icon: Layers, text: 'Auto-create pipeline rows for matched deals.' },
        { key: 'comp_scan', title: 'Comp Scan', icon: Zap, text: 'Run optional comp and market sanity checks.' },
      ];

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {toolCards.map((tool) => {
            const Icon = tool.icon;
            const on = !!agent.tools[tool.key];
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => toggleTool(tool.key)}
                style={{
                  ...card,
                  textAlign: 'left',
                  borderColor: on ? '#2563eb' : '#e5e7eb',
                  background: on ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} color={on ? '#1d4ed8' : '#475569'} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{tool.title}</div>
                  </div>
                  {on && <Check size={16} color="#1d4ed8" />}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>{tool.text}</div>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeStep.id === 'pattern') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {[
            { id: 'react-adaptive', name: 'ReAct (Reasoning + Acting)', desc: 'Adaptive exploratory workflow; best for noisy listing environments.' },
            { id: 'hierarchical', name: 'Hierarchical Analyst', desc: 'Top-down process with strict validation checkpoints.' },
            { id: 'vp-acquisitions', name: 'Acquisitions VP Persona', desc: 'Decision-first ranking with investment-committee style notes.' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAgent((prev) => ({ ...prev, pattern: p.id }))}
              style={{
                ...card,
                textAlign: 'left',
                borderColor: agent.pattern === p.id ? '#2563eb' : '#e5e7eb',
                background: agent.pattern === p.id ? '#eff6ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>{p.desc}</div>
            </button>
          ))}
        </div>
      );
    }

    if (activeStep.id === 'trigger-buybox') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={label}>Runs Per Week</label>
            <input
              type="range"
              min="1"
              max="7"
              value={agent.runsPerWeek}
              onChange={(e) => setAgent((p) => ({ ...p, runsPerWeek: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{agent.runsPerWeek} scheduled runs per week</div>
          </div>

          <div>
            <label style={label}>States</label>
            <input style={input} value={buyBox.states} onChange={(e) => setBuyBox((p) => ({ ...p, states: e.target.value }))} placeholder="TX, GA" />
          </div>
          <div>
            <label style={label}>Cities</label>
            <input style={input} value={buyBox.cities} onChange={(e) => setBuyBox((p) => ({ ...p, cities: e.target.value }))} placeholder="Dallas, Atlanta" />
          </div>
          <div>
            <label style={label}>Property Types</label>
            <input style={input} value={buyBox.property_types} onChange={(e) => setBuyBox((p) => ({ ...p, property_types: e.target.value }))} placeholder="Multifamily" />
          </div>
          <div>
            <label style={label}>Zip Codes</label>
            <input style={input} value={buyBox.zip_codes} onChange={(e) => setBuyBox((p) => ({ ...p, zip_codes: e.target.value }))} placeholder="75201, 30303" />
          </div>
          <div>
            <label style={label}>Min Price</label>
            <input style={input} type="number" value={buyBox.min_price} onChange={(e) => setBuyBox((p) => ({ ...p, min_price: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Max Price</label>
            <input style={input} type="number" value={buyBox.max_price} onChange={(e) => setBuyBox((p) => ({ ...p, max_price: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Min Cap Rate</label>
            <input style={input} type="number" step="0.1" value={buyBox.min_cap_rate} onChange={(e) => setBuyBox((p) => ({ ...p, min_cap_rate: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Min Units</label>
            <input style={input} type="number" value={buyBox.min_units} onChange={(e) => setBuyBox((p) => ({ ...p, min_units: e.target.value }))} />
          </div>

          <div style={{ gridColumn: '1 / span 2' }}>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: 8 }}>Source Credentials</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {platforms.map((p, idx) => (
                  <div key={p.platform_id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => setPlatforms((prev) => prev.map((x, i) => i === idx ? { ...x, enabled: e.target.checked } : x))}
                      />
                      {p.platform_id}
                    </label>
                    <input
                      style={{ ...input, fontSize: 13 }}
                      placeholder="Email / username"
                      value={p.username}
                      onChange={(e) => setPlatforms((prev) => prev.map((x, i) => i === idx ? { ...x, username: e.target.value } : x))}
                    />
                    <input
                      style={{ ...input, fontSize: 13 }}
                      type="password"
                      placeholder="Password"
                      value={p.password}
                      onChange={(e) => setPlatforms((prev) => prev.map((x, i) => i === idx ? { ...x, password: e.target.value } : x))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeStep.id === 'knowledge') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <div>
            <label style={label}>Vector Stores</label>
            <input style={input} value={agent.knowledgeSources.vectorStores} onChange={(e) => setAgent((p) => ({ ...p, knowledgeSources: { ...p.knowledgeSources, vectorStores: e.target.value } }))} placeholder="market-research-2026, multifamily-history" />
          </div>
          <div>
            <label style={label}>Direct Attachments</label>
            <input style={input} value={agent.knowledgeSources.attachments} onChange={(e) => setAgent((p) => ({ ...p, knowledgeSources: { ...p.knowledgeSources, attachments: e.target.value } }))} placeholder="rent-roll-template.csv, buybox-v1.xlsx" />
          </div>
          <div>
            <label style={label}>Knowledge Notes</label>
            <textarea style={{ ...input, minHeight: 120, resize: 'vertical' }} value={agent.knowledgeSources.notes} onChange={(e) => setAgent((p) => ({ ...p, knowledgeSources: { ...p.knowledgeSources, notes: e.target.value } }))} />
          </div>
        </div>
      );
    }

    if (activeStep.id === 'instructions') {
      return (
        <div>
          <label style={label}>System Instructions</label>
          <textarea style={{ ...input, minHeight: 260, resize: 'vertical' }} value={agent.systemInstructions} onChange={(e) => setAgent((p) => ({ ...p, systemInstructions: e.target.value }))} />
        </div>
      );
    }

    if (activeStep.id === 'governance') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['piiRedaction', 'Enable PII redaction'],
            ['legalPolicyChecks', 'Run legal/policy checks'],
            ['requireSourceUrl', 'Require source URL evidence'],
            ['restrictUnknownDocs', 'Block unknown document types'],
          ].map(([k, text]) => (
            <label key={k} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!agent.governance[k]}
                onChange={(e) => setAgent((p) => ({ ...p, governance: { ...p.governance, [k]: e.target.checked } }))}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{text}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agent.memoryEnabled}
            onChange={(e) => setAgent((p) => ({ ...p, memoryEnabled: e.target.checked }))}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Enable memory across runs</span>
        </label>
        <div style={{ ...card, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#475569' }}>Final review</div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#0f172a', lineHeight: 1.7 }}>
            <div><strong>Agent:</strong> {agent.name}</div>
            <div><strong>Runner:</strong> {agent.runnerType}</div>
            <div><strong>Model:</strong> {agent.model}</div>
            <div><strong>Underwriting depth:</strong> {agent.underwritingDepth}</div>
            <div><strong>Runs/week:</strong> {agent.runsPerWeek}</div>
            <div><strong>Rapid Fire tool:</strong> {agent.tools.rapidfire_batch_underwrite ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardShell activeTab="agent-builder" title="Agent Builder">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Agent Builder</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
              Rapid Fire is now embedded here: use Quick Screen for spreadsheet speed, or Builder for autonomous sourcing + underwriting.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setMode('builder')}
              style={{
                border: '1px solid #d1d5db',
                background: mode === 'builder' ? '#0f172a' : '#fff',
                color: mode === 'builder' ? '#fff' : '#334155',
                borderRadius: 10,
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Agent Builder
            </button>
            <button
              onClick={() => setMode('quick')}
              style={{
                border: '1px solid #d1d5db',
                background: mode === 'quick' ? '#0f172a' : '#fff',
                color: mode === 'quick' ? '#fff' : '#334155',
                borderRadius: 10,
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Quick Screen (Rapid Fire)
            </button>
          </div>
        </div>

        {mode === 'quick' ? (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <RapidFirePage />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 360px', gap: 14 }}>
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 10 }}>Agent Creation Steps</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {STEPS.map((s, i) => {
                  const active = i === step;
                  const complete = i < step;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStep(i)}
                      style={{
                        textAlign: 'left',
                        border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
                        background: active ? '#eff6ff' : '#fff',
                        borderRadius: 10,
                        padding: '10px 11px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 20,
                          background: complete ? '#16a34a' : active ? '#2563eb' : '#cbd5e1',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {complete ? <Check size={12} /> : i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{s.subtitle}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {activeStep.id === 'basic' && <Bot size={17} color="#fff" />}
                  {activeStep.id === 'model' && <Brain size={17} color="#fff" />}
                  {activeStep.id === 'tools' && <Zap size={17} color="#fff" />}
                  {activeStep.id === 'pattern' && <Layers size={17} color="#fff" />}
                  {activeStep.id === 'trigger-buybox' && <Clock3 size={17} color="#fff" />}
                  {activeStep.id === 'knowledge' && <Database size={17} color="#fff" />}
                  {activeStep.id === 'instructions' && <FileSpreadsheet size={17} color="#fff" />}
                  {activeStep.id === 'governance' && <Shield size={17} color="#fff" />}
                  {activeStep.id === 'memory' && <Globe size={17} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{activeStep.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{activeStep.subtitle}</div>
                </div>
              </div>

              {isLoading ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>Loading configuration...</div>
              ) : (
                renderStep()
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    style={{
                      border: '1px solid #d1d5db',
                      background: '#fff',
                      color: '#334155',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: step === 0 ? 'not-allowed' : 'pointer',
                      opacity: step === 0 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Prev
                  </button>
                  <button
                    type="button"
                    disabled={step === STEPS.length - 1}
                    onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                    style={{
                      border: '1px solid #d1d5db',
                      background: '#fff',
                      color: '#334155',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: step === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: step === STEPS.length - 1 ? 0.5 : 1,
                    }}
                  >
                    Next <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isRunning}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: isSaving || isRunning ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Save size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRunNow}
                    disabled={isRunning || isSaving}
                    style={{
                      border: '1px solid #0f172a',
                      background: '#0f172a',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: isRunning || isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Play size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    {isRunning ? 'Launching...' : 'Run Now'}
                  </button>
                </div>
              </div>

              {status && (
                <div style={{ marginTop: 12, fontSize: 13, color: status.toLowerCase().includes('failed') ? '#b91c1c' : '#166534' }}>
                  {status}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <div style={card}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 10 }}>Recent Runs</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {runs.slice(0, 6).map((r) => (
                    <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <strong style={{ color: '#0f172a' }}>{r.status}</strong>
                        <span style={{ color: '#64748b' }}>{r.deals_found || 0} deals</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>{r.started_at || 'No timestamp'}</div>
                      {r.error && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#b91c1c', lineHeight: 1.4 }}>
                          {r.error}
                        </div>
                      )}
                    </div>
                  ))}
                  {!runs.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>No runs yet.</div>}
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 10 }}>Latest Found Deals</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {deals.slice(0, 8).map((d) => (
                    <a key={d.id} href={d.listing_url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.address || 'Unknown address'}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                          {d.platform || 'source'} · ${Number(d.price || 0).toLocaleString()} · Cap {d.cap_rate ?? '-'}%
                        </div>
                      </div>
                    </a>
                  ))}
                  {!deals.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>No sourced deals yet.</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default AgentBuilderPage;
