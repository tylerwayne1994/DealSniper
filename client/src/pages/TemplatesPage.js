import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import {
  FileText, Save, Check, ChevronDown, ChevronUp,
  DollarSign, TrendingUp, Target, Mail, Upload,
  Plus, Trash2, Info, Hammer, Zap
} from 'lucide-react';
import { getLoanPresets, LOAN_CATEGORIES } from '../utils/loanPrograms';

/* ───────────────────────── Default template shapes ───────────────────────── */

const DEFAULT_FINANCING = {
  ltv: 75,
  interest_rate: 6.0,
  loan_term_years: 10,
  amortization_years: 30,
  io_years: 0,
  loan_fees_percent: 1.5,
  spread: 1.5,
  selected_treasury_term: 5,
};

const DEFAULT_EXIT = {
  holdYrs: 5,
  closingPct: 2,
  brokerPct: 2,
  strategy: 'cap_rate',   // 'cap_rate' | 'value_growth'
  capAdj: 0,
  growthPct: 3,
};

const DEFAULT_RENOVATION = {
  total_budget: 0,
  cost_per_unit: 5000,
  timeline_months: 12,
  financed: false,
  reno_ltv: 80,
  reno_interest_rate: 8.0,
  reno_loan_term_years: 3,
  reno_io_months: 6,
};

const DEFAULT_CRITERIA = [
  { key: 'irr', label: 'Internal Rate of Return (IRR)', target: 15, unit: '%' },
  { key: 'coc', label: 'Cash on Cash', target: 7, unit: '%' },
];

const CRITERIA_OPTIONS = [
  { key: 'irr',          label: 'Internal Rate of Return (IRR)', sug: 15,     unit: '%' },
  { key: 'emx',          label: 'Equity Multiple',               sug: 2.0,    unit: 'x' },
  { key: 'coc',          label: 'Cash on Cash',                  sug: 8,      unit: '%' },
  { key: 'total_profit', label: 'Total Profit',                  sug: 500000, unit: '$' },
  { key: 'monthly_cf',   label: 'Monthly Cash Flow',             sug: 5000,   unit: '$' },
];

const blankTemplate = () => ({
  financing: { ...DEFAULT_FINANCING },
  exit_details: { ...DEFAULT_EXIT },
  renovation: { ...DEFAULT_RENOVATION },
  investment_criteria: DEFAULT_CRITERIA.map(c => ({ ...c })),
});

/* ───────────────────────── Styles ───────────────────────── */

const s = {
  page: { maxWidth: 960, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 28 },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 28,
  },
  tab: (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 24px', cursor: 'pointer',
    fontSize: 14, fontWeight: active ? 600 : 500,
    color: active ? '#4f46e5' : '#6b7280',
    borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
    marginBottom: -2, transition: 'all .15s',
    background: 'none',
  }),
  section: {
    background: '#ffffff', borderRadius: 12,
    border: '1px solid #e5e7eb', padding: 24, marginBottom: 20,
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', userSelect: 'none',
  },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: 10,
    fontSize: 15, fontWeight: 600, color: '#111827',
  },
  sectionIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: '#374151',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border .15s',
  },
  inputSuffix: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 13, color: '#9ca3af', pointerEvents: 'none',
  },
  saveBar: {
    display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center',
    padding: '16px 0', position: 'sticky', bottom: 0,
    background: 'linear-gradient(transparent, #f9fafb 30%)',
    zIndex: 10,
  },
  btn: (primary = false) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 24px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #d1d5db',
    background: primary ? '#4f46e5' : '#ffffff',
    color: primary ? '#ffffff' : '#374151',
    transition: 'all .15s',
  }),
  badge: (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: color === 'green' ? '#dcfce7' : color === 'yellow' ? '#e0e7ff' : '#e0e7ff',
    color: color === 'green' ? '#166534' : color === 'yellow' ? '#3730a3' : '#3730a3',
  }),
  stratToggle: (active) => ({
    flex: 1, padding: '10px 16px', borderRadius: 8,
    border: active ? '2px solid #4f46e5' : '1px solid #d1d5db',
    background: active ? '#eef2ff' : '#ffffff',
    color: active ? '#4338ca' : '#6b7280',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    textAlign: 'center', transition: 'all .15s',
  }),
  criteriaRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  sugText: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8,
    border: '1px dashed #c7d2fe', background: '#f5f3ff',
    color: '#6366f1', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', marginTop: 12, transition: 'all .15s',
  },
};

/* ───────────────────────── Field component ───────────────────────── */

function Field({ label, value, onChange, suffix, hint }) {
  return (
    <div>
      <div style={s.fieldLabel}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            ...s.input,
            paddingRight: suffix ? 40 : 12,
          }}
          onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
          onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
        />
        {suffix && <span style={s.inputSuffix}>{suffix}</span>}
      </div>
      {hint && <div style={s.sugText}>{hint}</div>}
    </div>
  );
}

/* ══════════════════════════ MAIN COMPONENT ══════════════════════════ */

function TemplatesPage() {
  const [activeSlot, setActiveSlot] = useState('underwrite'); // 'underwrite' | 'email_underwrite'
  const [templates, setTemplates] = useState({
    underwrite: blankTemplate(),
    email_underwrite: blankTemplate(),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({ financing: false, loanPresets: true, exit: false, renovation: false, criteria: false });
  const [treasuryRates, setTreasuryRates] = useState([]);
  const [treasuryAsOf, setTreasuryAsOf] = useState(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);

  /* ── Fetch Treasury rates from FRED API ── */
  useEffect(() => {
    (async () => {
      setTreasuryLoading(true);
      try {
        const apiBase = process.env.REACT_APP_API_URL || '';
        const resp = await fetch(`${apiBase}/api/treasury-rates`);
        if (resp.ok) {
          const data = await resp.json();
          setTreasuryRates(data.rates || []);
          setTreasuryAsOf(data.as_of || null);
        }
      } catch (err) {
        console.warn('Failed to fetch treasury rates:', err);
      } finally {
        setTreasuryLoading(false);
      }
    })();
  }, []);

  /* ── Load from Supabase ── */
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from('profiles')
          .select('underwrite_templates')
          .eq('user_id', user.id)
          .single();

        if (data?.underwrite_templates) {
          const saved = data.underwrite_templates;
          setTemplates({
            underwrite: { ...blankTemplate(), ...(saved.underwrite || {}) },
            email_underwrite: { ...blankTemplate(), ...(saved.email_underwrite || {}) },
          });
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Current template ── */
  const tpl = templates[activeSlot];

  const updateField = useCallback((section, key, value) => {
    setTemplates(prev => ({
      ...prev,
      [activeSlot]: {
        ...prev[activeSlot],
        [section]: section === 'investment_criteria'
          ? value // full array replacement
          : { ...prev[activeSlot][section], [key]: value },
      },
    }));
    setSaved(false);
  }, [activeSlot]);

  /* ── Save to Supabase ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabase
        .from('profiles')
        .update({ underwrite_templates: templates })
        .eq('user_id', user.id);

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save templates:', err);
      alert('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Criteria helpers ── */
  const addCriterion = () => {
    const existing = tpl.investment_criteria.map(c => c.key);
    const available = CRITERIA_OPTIONS.filter(o => !existing.includes(o.key));
    if (available.length === 0) return;
    const next = available[0];
    updateField('investment_criteria', null, [
      ...tpl.investment_criteria,
      { key: next.key, label: next.label, target: next.sug, unit: next.unit },
    ]);
  };

  const removeCriterion = (idx) => {
    updateField('investment_criteria', null,
      tpl.investment_criteria.filter((_, i) => i !== idx)
    );
  };

  const updateCriterionTarget = (idx, value) => {
    const updated = tpl.investment_criteria.map((c, i) =>
      i === idx ? { ...c, target: value } : c
    );
    updateField('investment_criteria', null, updated);
  };

  const changeCriterionType = (idx, newKey) => {
    const opt = CRITERIA_OPTIONS.find(o => o.key === newKey);
    if (!opt) return;
    const updated = tpl.investment_criteria.map((c, i) =>
      i === idx ? { ...c, key: opt.key, label: opt.label, unit: opt.unit } : c
    );
    updateField('investment_criteria', null, updated);
  };

  /* ── Computed: monthly payment preview ── */
  const monthlyPayment = useMemo(() => {
    const r = (tpl.financing.interest_rate / 100) / 12;
    const n = tpl.financing.amortization_years * 12;
    if (r === 0 || n === 0) return 0;
    // Per $100k loan
    const pmt = (100000 * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return pmt;
  }, [tpl.financing.interest_rate, tpl.financing.amortization_years]);

  const toggle = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <DashboardShell activeTab="templates" title="Templates">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#6b7280' }}>
          Loading templates...
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeTab="templates" title="Templates">
      <div style={s.page}>

        {/* ── Header ── */}
        <div style={s.header}>
          <FileText size={22} style={{ color: '#4f46e5' }} />
          <span style={s.title}>Underwrite Templates</span>
        </div>
        <div style={s.subtitle}>
          Set default financing, exit details, and investment criteria. These defaults are automatically applied when you underwrite a new deal.
        </div>

        {/* ── Tabs: Underwrite vs Email Underwrite ── */}
        <div style={s.tabs}>
          <div
            style={s.tab(activeSlot === 'underwrite')}
            onClick={() => setActiveSlot('underwrite')}
          >
            <Upload size={16} />
            Underwrite Template
          </div>
          <div
            style={s.tab(activeSlot === 'email_underwrite')}
            onClick={() => setActiveSlot('email_underwrite')}
          >
            <Mail size={16} />
            Email Underwrite Template
          </div>
        </div>

        {/* ══════════ SECTION 1: FINANCING ══════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader} onClick={() => toggle('financing')}>
            <div style={s.sectionTitle}>
              <div style={{ ...s.sectionIcon, background: '#dbeafe' }}>
                <DollarSign size={18} style={{ color: '#2563eb' }} />
              </div>
              Financing Defaults
              <span style={s.badge('blue')}>Senior Loan</span>
            </div>
            {collapsed.financing ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronUp size={18} color="#9ca3af" />}
          </div>

          {!collapsed.financing && (
            <>
              <div style={s.grid2}>
                <Field
                  label="LOAN-TO-VALUE (LTV)"
                  value={tpl.financing.ltv}
                  onChange={(v) => updateField('financing', 'ltv', v)}
                  suffix="%"
                  hint="Typical: 65-80%"
                />
                <Field
                  label="INTEREST RATE"
                  value={tpl.financing.interest_rate}
                  onChange={(v) => updateField('financing', 'interest_rate', v)}
                  suffix="%"
                  hint="Current avg: ~6.0%"
                />
              </div>

              <div style={s.grid2}>
                <Field
                  label="AMORTIZATION (YRS)"
                  value={tpl.financing.amortization_years}
                  onChange={(v) => updateField('financing', 'amortization_years', v)}
                  hint="Typical: 25-30 years"
                />
                <Field
                  label="LOAN TERM (YRS)"
                  value={tpl.financing.loan_term_years}
                  onChange={(v) => updateField('financing', 'loan_term_years', v)}
                  hint="Typical: 5-10 years"
                />
              </div>

              <div style={s.grid2}>
                <Field
                  label="INTEREST ONLY (YRS)"
                  value={tpl.financing.io_years}
                  onChange={(v) => updateField('financing', 'io_years', v)}
                  hint="0 = fully amortizing"
                />
                <Field
                  label="LOAN FEES"
                  value={tpl.financing.loan_fees_percent}
                  onChange={(v) => updateField('financing', 'loan_fees_percent', v)}
                  suffix="%"
                  hint="Origination + points"
                />
              </div>

              {/* Monthly payment preview */}
              <div style={{
                marginTop: 20, padding: '14px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase' }}>
                    Est. Monthly Payment (per $100K loan)
                  </div>
                  <div style={{ fontSize: 11, color: '#818cf8', marginTop: 2 }}>
                    Based on rate &amp; amortization
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#4338ca' }}>
                  ${monthlyPayment.toFixed(0)}
                </div>
              </div>

              {/* ── Loan Interest Rate Options (Treasury Bonds) ── */}
              <div style={{ marginTop: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 3, height: 22, background: '#6366f1', borderRadius: 2 }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Loan Interest Rate Options</span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  View and adjust your total interest rate based on Treasury Bond values and custom Spread inputs.
                </div>

                {treasuryLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Loading Treasury rates...
                  </div>
                ) : treasuryRates.length > 0 ? (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ width: 40, padding: '10px 8px' }} />
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase' }}>Term (Years)</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase' }}>Treasury Bonds</th>
                          <th style={{ padding: '10px 4px', textAlign: 'center', color: '#9ca3af', fontSize: 14, fontWeight: 600 }}>+</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase' }}>Spread</th>
                          <th style={{ padding: '10px 4px', textAlign: 'center', color: '#9ca3af', fontSize: 14, fontWeight: 600 }}>=</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#374151', fontSize: 12, textTransform: 'uppercase' }}>Total Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treasuryRates.map(tr => {
                          const isSelected = tpl.financing.selected_treasury_term === tr.term;
                          const spread = tpl.financing.spread ?? 1.5;
                          const totalRate = (tr.rate + spread).toFixed(2);
                          return (
                            <tr key={tr.term} style={{ borderBottom: '1px solid #f3f4f6', background: isSelected ? '#f5f3ff' : 'transparent' }}>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <div
                                  onClick={() => {
                                    updateField('financing', 'selected_treasury_term', tr.term);
                                    updateField('financing', 'interest_rate', parseFloat(totalRate));
                                  }}
                                  style={{
                                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                                    border: isSelected ? '6px solid #4f46e5' : '2px solid #d1d5db',
                                    background: '#fff', transition: 'all .15s',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 500, color: '#111827' }}>{tr.term}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}>{tr.rate.toFixed(2)}%</td>
                              <td />
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={spread}
                                    onChange={(e) => {
                                      const newSpread = parseFloat(e.target.value) || 0;
                                      updateField('financing', 'spread', newSpread);
                                      if (isSelected) {
                                        updateField('financing', 'interest_rate', parseFloat((tr.rate + newSpread).toFixed(2)));
                                      }
                                    }}
                                    style={{
                                      width: 64, padding: '6px 8px', borderRadius: 6, textAlign: 'center',
                                      border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                                      background: '#f9fafb',
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                                  />
                                  <span style={{ fontSize: 13, color: '#9ca3af' }}>%</span>
                                </div>
                              </td>
                              <td />
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: isSelected ? '#4f46e5' : '#374151' }}>{totalRate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {treasuryAsOf && (
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                        Treasury rates as of {treasuryAsOf}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '14px 18px', borderRadius: 8, background: '#e0e7ff', border: '1px solid #c7d2fe', fontSize: 12, color: '#3730a3' }}>
                    Treasury rates unavailable — you can still set the interest rate manually above.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ══════════ LOAN PROGRAM PRESETS ══════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader} onClick={() => toggle('loanPresets')}>
            <div style={s.sectionTitle}>
              <div style={{ ...s.sectionIcon, background: '#fef3c7' }}>
                <Zap size={18} style={{ color: '#d97706' }} />
              </div>
              Loan Program Presets
              <span style={s.badge('yellow')}>Quick Apply</span>
            </div>
            {collapsed.loanPresets ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronUp size={18} color="#9ca3af" />}
          </div>

          {!collapsed.loanPresets && (
            <>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 16 }}>
                Select a loan program to auto-fill financing defaults. You can still edit any field after applying.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {getLoanPresets().map(preset => {
                  const catMeta = LOAN_CATEGORIES[preset.category] || {};
                  return (
                    <div
                      key={preset.id}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 12,
                        border: `1px solid ${catMeta.border || '#e5e7eb'}`,
                        background: catMeta.bg || '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all .15s',
                        position: 'relative',
                      }}
                      onClick={() => {
                        const fin = preset.financing;
                        setTemplates(prev => ({
                          ...prev,
                          [activeSlot]: {
                            ...prev[activeSlot],
                            financing: {
                              ...prev[activeSlot].financing,
                              ltv: fin.ltv,
                              interest_rate: fin.interest_rate,
                              loan_term_years: fin.loan_term_years,
                              amortization_years: fin.amortization_years,
                              io_years: fin.io_years,
                              loan_fees_percent: fin.loan_fees_percent,
                            },
                          },
                        }));
                        setSaved(false);
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = catMeta.color || '#6366f1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = catMeta.border || '#e5e7eb'; e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>{preset.icon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{preset.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{preset.description}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {[
                          { label: 'LTV', value: `${preset.financing.ltv}%` },
                          { label: 'Rate', value: `${preset.financing.interest_rate}%` },
                          { label: 'Term', value: `${preset.financing.loan_term_years}yr` },
                          { label: 'Amort', value: `${preset.financing.amortization_years}yr` },
                          { label: 'IO', value: `${preset.financing.io_years}yr` },
                          { label: 'Fees', value: `${preset.financing.loan_fees_percent}%` },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ textAlign: 'center', padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.7)' }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: catMeta.color || '#111827' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{
                        marginTop: 10, padding: '6px 12px', borderRadius: 8,
                        background: catMeta.color || '#4f46e5', color: '#fff',
                        fontSize: 11, fontWeight: 700, textAlign: 'center',
                        opacity: 0.9,
                      }}>
                        Apply to Template
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ══════════ SECTION 2: EXIT DETAILS ══════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader} onClick={() => toggle('exit')}>
            <div style={s.sectionTitle}>
              <div style={{ ...s.sectionIcon, background: '#e0e7ff' }}>
                <TrendingUp size={18} style={{ color: '#d97706' }} />
              </div>
              Exit Details
            </div>
            {collapsed.exit ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronUp size={18} color="#9ca3af" />}
          </div>

          {!collapsed.exit && (
            <>
              <div style={s.grid3}>
                <Field
                  label="HOLDING PERIOD"
                  value={tpl.exit_details.holdYrs}
                  onChange={(v) => updateField('exit_details', 'holdYrs', v)}
                  suffix="yrs"
                  hint="Typical: 3-7 years"
                />
                <Field
                  label="CLOSING COSTS"
                  value={tpl.exit_details.closingPct}
                  onChange={(v) => updateField('exit_details', 'closingPct', v)}
                  suffix="%"
                  hint="% of exit value"
                />
                <Field
                  label="BROKER COMMISSION"
                  value={tpl.exit_details.brokerPct}
                  onChange={(v) => updateField('exit_details', 'brokerPct', v)}
                  suffix="%"
                  hint="% of exit value"
                />
              </div>

              {/* Strategy toggle */}
              <div style={{ marginTop: 20 }}>
                <div style={s.fieldLabel}>EXIT STRATEGY</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={s.stratToggle(tpl.exit_details.strategy === 'cap_rate')}
                    onClick={() => updateField('exit_details', 'strategy', 'cap_rate')}
                  >
                    Cap Rate Method
                  </div>
                  <div
                    style={s.stratToggle(tpl.exit_details.strategy === 'value_growth')}
                    onClick={() => updateField('exit_details', 'strategy', 'value_growth')}
                  >
                    Value Growth Method
                  </div>
                </div>
              </div>

              {/* Strategy-specific field */}
              <div style={{ ...s.grid2, marginTop: 16 }}>
                {tpl.exit_details.strategy === 'cap_rate' ? (
                  <Field
                    label="CAP RATE ADJUSTMENT"
                    value={tpl.exit_details.capAdj}
                    onChange={(v) => updateField('exit_details', 'capAdj', v)}
                    suffix="bps"
                    hint="+/- from market cap rate at exit"
                  />
                ) : (
                  <Field
                    label="ANNUAL VALUE GROWTH"
                    value={tpl.exit_details.growthPct}
                    onChange={(v) => updateField('exit_details', 'growthPct', v)}
                    suffix="%"
                    hint="Expected annual appreciation"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* ══════════ SECTION 3: RENOVATION / CAPEX ══════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader} onClick={() => toggle('renovation')}>
            <div style={s.sectionTitle}>
              <div style={{ ...s.sectionIcon, background: '#e0e7ff' }}>
                <Hammer size={18} style={{ color: '#d97706' }} />
              </div>
              Renovation / CapEx Defaults
              <span style={s.badge('yellow')}>Value-Add</span>
            </div>
            {collapsed.renovation ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronUp size={18} color="#9ca3af" />}
          </div>

          {!collapsed.renovation && (
            <>
              <div style={s.grid2}>
                <Field
                  label="DEFAULT BUDGET PER UNIT"
                  value={tpl.renovation.cost_per_unit}
                  onChange={(v) => updateField('renovation', 'cost_per_unit', v)}
                  suffix="$"
                  hint="Typical: $3,000-$15,000"
                />
                <Field
                  label="RENOVATION TIMELINE"
                  value={tpl.renovation.timeline_months}
                  onChange={(v) => updateField('renovation', 'timeline_months', v)}
                  suffix="mo"
                  hint="Typical: 6-24 months"
                />
              </div>

              {/* Financing toggle */}
              <div style={{ marginTop: 20 }}>
                <div style={s.fieldLabel}>RENOVATION FINANCING</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={s.stratToggle(tpl.renovation.financed === false)}
                    onClick={() => updateField('renovation', 'financed', false)}
                  >
                    Cash (No Loan)
                  </div>
                  <div
                    style={s.stratToggle(tpl.renovation.financed === true)}
                    onClick={() => updateField('renovation', 'financed', true)}
                  >
                    Financed (Reno Loan)
                  </div>
                </div>
              </div>

              {tpl.renovation.financed && (
                <>
                  <div style={s.grid2}>
                    <Field
                      label="RENO LOAN LTV"
                      value={tpl.renovation.reno_ltv}
                      onChange={(v) => updateField('renovation', 'reno_ltv', v)}
                      suffix="%"
                      hint="% of renovation cost financed"
                    />
                    <Field
                      label="RENO INTEREST RATE"
                      value={tpl.renovation.reno_interest_rate}
                      onChange={(v) => updateField('renovation', 'reno_interest_rate', v)}
                      suffix="%"
                      hint="Bridge/reno loans: 7-12%"
                    />
                  </div>
                  <div style={s.grid2}>
                    <Field
                      label="RENO LOAN TERM"
                      value={tpl.renovation.reno_loan_term_years}
                      onChange={(v) => updateField('renovation', 'reno_loan_term_years', v)}
                      suffix="yrs"
                      hint="Typical: 2-5 years"
                    />
                    <Field
                      label="INTEREST-ONLY PERIOD"
                      value={tpl.renovation.reno_io_months}
                      onChange={(v) => updateField('renovation', 'reno_io_months', v)}
                      suffix="mo"
                      hint="IO during renovation"
                    />
                  </div>
                </>
              )}

              {/* Preview */}
              <div style={{
                marginTop: 20, padding: '14px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
                    Renovation Defaults Summary
                  </div>
                  <div style={{ fontSize: 11, color: '#4338ca', marginTop: 2 }}>
                    ${tpl.renovation.cost_per_unit.toLocaleString()}/unit over {tpl.renovation.timeline_months} months
                    {tpl.renovation.financed ? ` · Financed at ${tpl.renovation.reno_interest_rate}%` : ' · Cash funded'}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#3730a3' }}>
                  {tpl.renovation.financed ? '🏦' : '💵'} {tpl.renovation.financed ? 'Financed' : 'Cash'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ══════════ SECTION 4: INVESTMENT CRITERIA ══════════ */}
        <div style={s.section}>
          <div style={s.sectionHeader} onClick={() => toggle('criteria')}>
            <div style={s.sectionTitle}>
              <div style={{ ...s.sectionIcon, background: '#dcfce7' }}>
                <Target size={18} style={{ color: '#16a34a' }} />
              </div>
              Investment Criteria
            </div>
            {collapsed.criteria ? <ChevronDown size={18} color="#9ca3af" /> : <ChevronUp size={18} color="#9ca3af" />}
          </div>

          {!collapsed.criteria && (
            <>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 8 }}>
                Specify the minimum desired returns for the investment criteria listed below.
              </div>

              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ flex: 2, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Criteria</div>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Target</div>
                <div style={{ width: 36 }} />
              </div>

              {tpl.investment_criteria.map((c, idx) => {
                const availableForSwap = CRITERIA_OPTIONS.filter(o =>
                  o.key === c.key || !tpl.investment_criteria.some(x => x.key === o.key)
                );
                const opt = CRITERIA_OPTIONS.find(o => o.key === c.key);
                return (
                  <div key={c.key + idx}>
                    <div style={s.criteriaRow}>
                      <div style={{ flex: 2 }}>
                        <select
                          value={c.key}
                          onChange={(e) => changeCriterionType(idx, e.target.value)}
                          style={{
                            ...s.input, padding: '8px 10px', fontSize: 13,
                            color: '#111827', background: '#f9fafb', cursor: 'pointer',
                          }}
                        >
                          {availableForSwap.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number"
                          value={c.target}
                          onChange={(e) => updateCriterionTarget(idx, parseFloat(e.target.value) || 0)}
                          style={{ ...s.input, paddingRight: 32, fontSize: 14, fontWeight: 600 }}
                          onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                          onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                        />
                        <span style={s.inputSuffix}>{c.unit}</span>
                      </div>
                      <div
                        style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, color: '#ef4444' }}
                        onClick={() => removeCriterion(idx)}
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </div>
                    </div>
                    {opt && (
                      <div style={{ fontSize: 11, color: '#9ca3af', padding: '2px 0 6px 4px' }}>
                        &gt;{opt.sug}{c.unit} Suggested
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add criteria button */}
              {tpl.investment_criteria.length < CRITERIA_OPTIONS.length && (
                <div style={s.addBtn} onClick={addCriterion}>
                  <Plus size={14} /> Add criteria
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Info banner ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '14px 18px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16,
        }}>
          <Info size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
            <strong>{activeSlot === 'underwrite' ? 'Underwrite' : 'Email Underwrite'} Template</strong> — These
            defaults will be automatically applied to every new deal {activeSlot === 'underwrite' ? 'you upload via the Underwrite page' : 'parsed from your email pipeline'}.
            You can still adjust values on each individual deal.
          </div>
        </div>

        {/* ── Save bar ── */}
        <div style={s.saveBar}>
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
              <Check size={16} /> Template saved
            </div>
          )}
          <button
            style={s.btn(false)}
            onClick={() => {
              setTemplates(prev => ({ ...prev, [activeSlot]: blankTemplate() }));
              setSaved(false);
            }}
          >
            Reset to Defaults
          </button>
          <button
            style={s.btn(true)}
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>

      </div>
    </DashboardShell>
  );
}

export default TemplatesPage;
