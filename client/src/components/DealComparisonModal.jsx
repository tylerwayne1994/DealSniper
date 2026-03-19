import React, { useMemo } from 'react';
import { X, TrendingUp, Building2 } from 'lucide-react';

// ============================================================================
// Helpers
// ============================================================================

const fmt = (v) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
};

const fmtK = (v) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const pct = (v, dec = 2) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return `${Number(v).toFixed(dec)}%`;
};

const num = (v, dec = 2) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return Number(v).toFixed(dec);
};

// ============================================================================
// Capital / efficiency helpers (same as PipelinePage)
// ============================================================================

const calcCapital = (deal) => {
  const price = deal.purchasePrice || 0;
  const cashOutRefi = deal.cashOutRefiAmount || 0;
  const ltv = 0.75;
  const loanAmount = price * ltv;
  const downPayment = price - loanAmount;
  const closingCosts = price * 0.03;
  const reserves = price * 0.02;
  const totalEquity = downPayment + closingCosts + reserves;
  const structure = (deal.dealStructure || '').toLowerCase();
  let sponsorCash = totalEquity, outsideCapital = 0;
  if (structure.includes('partner') || structure.includes('equity')) {
    sponsorCash = totalEquity * 0.3; outsideCapital = totalEquity * 0.7;
  } else if (structure.includes('seller')) {
    sponsorCash = totalEquity * 0.5;
  }
  return { totalEquity, sponsorCash, outsideCapital, capitalAtRefi: cashOutRefi || 0 };
};

const calcEfficiency = (deal) => {
  const capital = calcCapital(deal);
  const cashRatio = capital.sponsorCash > 0 ? capital.capitalAtRefi / capital.sponsorCash : 0;
  const refiValue = deal.refiValue || (deal.purchasePrice || 0) * 1.25;
  const loanAmount = refiValue * 0.75;
  const equityAfterRefi = refiValue - loanAmount;
  const equityMultiple = capital.totalEquity > 0 ? equityAfterRefi / capital.totalEquity : 0;
  const monthlyCF = deal.postRefiCashFlow || deal.stabilizedCashFlow || 0;
  const monthsToRecovery = monthlyCF > 0 ? capital.sponsorCash / monthlyCF : null;
  return { cashRatio, equityMultiple, monthsToRecovery };
};

const assessRisk = (deal) => {
  const structure = (deal.dealStructure || '').toLowerCase();
  const monthlyCF = deal.postRefiCashFlow || deal.stabilizedCashFlow || 0;
  const price = deal.purchasePrice || 0;
  const annualDS = price * 0.75 * 0.065;
  const monthlyDS = annualDS / 12;
  const noi = monthlyCF + monthlyDS;
  const dscr = monthlyDS > 0 ? (noi * 12) / annualDS : 0;
  const hasBalloon = structure.includes('seller') || structure.includes('bridge');
  if (dscr >= 1.25 && !hasBalloon) return { level: 'green', text: 'Survives Stress' };
  if (dscr >= 1.1 || hasBalloon) return { level: 'yellow', text: 'Marginal' };
  return { level: 'red', text: 'Breaks Under Stress' };
};

// ============================================================================
// Extraction: pull ALL comparable metrics from a deal
// ============================================================================

const extractMetrics = (deal) => {
  const sd = deal.fullScenarioData || {};
  const calcs = sd.calculations || {};
  const pf = sd.pricing_financing || {};
  const inc = sd.income || {};
  const exp = sd.expenses || {};
  const prop = sd.property || {};
  const price = deal.purchasePrice || pf.purchase_price || 0;
  const units = deal.units || prop.units || 0;
  const capital = calcCapital(deal);
  const efficiency = calcEfficiency(deal);
  const risk = assessRisk(deal);

  // Income
  const rentalIncome = Number(inc.rental_income) || Number(inc.gross_potential_rent) || 0;
  const otherIncome = Number(inc.other_income) || 0;
  const vacancyPct = Number(inc.vacancy_rate) || Number(inc.vacancy) || 5;
  const egi = rentalIncome + otherIncome - (rentalIncome * vacancyPct / 100);

  // Expenses
  const taxes = Number(exp.taxes) || 0;
  const insurance = Number(exp.insurance) || 0;
  const totalExpenses = Object.entries(exp).reduce((s, [k, v]) => {
    if (['capital_reserve', 'reserves', 'capex'].includes(k)) return s;
    return s + (Number(v) || 0);
  }, 0);
  const expenseRatio = egi > 0 ? (totalExpenses / egi) * 100 : 0;

  // NOI
  const noi = egi - totalExpenses;
  const capRate = price > 0 ? (noi / price) * 100 : 0;

  // Per-unit
  const pricePerUnit = units > 0 ? price / units : 0;
  const noiPerUnit = units > 0 ? noi / units : 0;
  const rentPerUnit = units > 0 ? rentalIncome / units / 12 : 0;

  // Debt
  const loanAmount = price * (Number(pf.ltv) || 75) / 100;
  const interestRate = Number(pf.interest_rate) || 5.78;
  const dscr = calcs.dscr || (noi > 0 && loanAmount > 0 ? noi / (loanAmount * interestRate / 100) : 0);

  return {
    // Property
    address: deal.address || prop.address || '—',
    city: prop.city || '',
    state: prop.state || '',
    units,
    dealStructure: deal.dealStructure || 'Traditional',
    dealStage: deal.deal_stage || 'underwritten',

    // Pricing
    purchasePrice: price,
    pricePerUnit,
    loanAmount,
    ltv: Number(pf.ltv) || 75,
    interestRate,

    // Income
    rentalIncome,
    otherIncome,
    vacancyPct,
    egi,
    rentPerUnit,

    // Expenses
    totalExpenses,
    taxes,
    insurance,
    expenseRatio,

    // Returns
    noi,
    capRate,
    noiPerUnit,
    dscr,
    dayOneCashFlow: deal.dayOneCashFlow || calcs.dayOneCashFlow || 0,
    stabilizedCashFlow: deal.stabilizedCashFlow || calcs.stabilizedCashFlow || 0,

    // Capital
    totalEquity: capital.totalEquity,
    sponsorCash: capital.sponsorCash,
    outsideCapital: capital.outsideCapital,
    cashRatio: efficiency.cashRatio,
    equityMultiple: efficiency.equityMultiple,
    monthsToRecovery: efficiency.monthsToRecovery,

    // Refi / Exit
    refiValue: deal.refiValue || calcs.refiValue || 0,
    cashOutRefi: deal.cashOutRefiAmount || calcs.cashOutRefiAmount || 0,
    postRefiCashFlow: deal.postRefiCashFlow || calcs.postRefiCashFlow || 0,

    // Risk
    riskLevel: risk.level,
    riskText: risk.text,

    // Broker
    brokerName: deal.brokerName || '',
    brokerEmail: deal.brokerEmail || '',
  };
};

// ============================================================================
// Best-value highlighting helpers
// ============================================================================
// For each metric, define whether "higher is better" or "lower is better"

const HIGHER_BETTER = [
  'units', 'rentalIncome', 'otherIncome', 'egi', 'rentPerUnit', 'noi', 'capRate', 'noiPerUnit',
  'dscr', 'dayOneCashFlow', 'stabilizedCashFlow', 'cashRatio', 'equityMultiple',
  'refiValue', 'cashOutRefi', 'postRefiCashFlow',
];
const LOWER_BETTER = [
  'purchasePrice', 'pricePerUnit', 'interestRate', 'totalExpenses', 'taxes', 'insurance',
  'expenseRatio', 'totalEquity', 'sponsorCash', 'outsideCapital', 'vacancyPct',
];

const getBestIdx = (metrics, key) => {
  const vals = metrics.map(m => Number(m[key]) || 0);
  if (vals.every(v => v === 0)) return -1;
  if (HIGHER_BETTER.includes(key)) {
    const max = Math.max(...vals);
    return vals.indexOf(max);
  }
  if (LOWER_BETTER.includes(key)) {
    const nonZero = vals.filter(v => v > 0);
    if (nonZero.length === 0) return -1;
    const min = Math.min(...nonZero);
    return vals.indexOf(min);
  }
  return -1;
};

// ============================================================================
// Stage / Risk badge styling from PipelinePage
// ============================================================================

const stageColors = {
  sourced: '#579bfc', underwritten: '#00c875', loi: '#a25ddc',
  contract: '#fdab3d', financing: '#66ccff', closed: '#037f4c', dead: '#e2445c',
};
const stageLabels = {
  sourced: 'Sourced', underwritten: 'Underwritten', loi: 'LOI Sent',
  contract: 'Under Contract', financing: 'Financing', closed: 'Closed', dead: 'Dead',
};
const riskColors = { green: '#00c875', yellow: '#fdab3d', red: '#e2445c' };

// ============================================================================
// DealComparisonModal Component
// ============================================================================

export default function DealComparisonModal({ isOpen, onClose, deals }) {
  // Extract metrics for all deals
  const metrics = useMemo(() => (deals || []).map(extractMetrics), [deals]);

  if (!isOpen || !deals || deals.length < 2) return null;

  // ── Metric row definition ──
  // Each section is { title, rows: [{ label, key, format, suffix? }] }
  const sections = [
    {
      title: 'Pricing & Structure',
      icon: '💰',
      rows: [
        { label: 'Purchase Price', key: 'purchasePrice', format: 'dollar' },
        { label: 'Price / Unit', key: 'pricePerUnit', format: 'dollar' },
        { label: 'Units', key: 'units', format: 'int' },
        { label: 'Deal Structure', key: 'dealStructure', format: 'text' },
        { label: 'Deal Stage', key: 'dealStage', format: 'stage' },
        { label: 'Loan Amount', key: 'loanAmount', format: 'dollar' },
        { label: 'LTV', key: 'ltv', format: 'pct0' },
        { label: 'Interest Rate', key: 'interestRate', format: 'pct' },
      ]
    },
    {
      title: 'Income',
      icon: '📈',
      rows: [
        { label: 'Rental Income', key: 'rentalIncome', format: 'dollar' },
        { label: 'Other Income', key: 'otherIncome', format: 'dollar' },
        { label: 'Vacancy Rate', key: 'vacancyPct', format: 'pct1' },
        { label: 'Effective Gross Income', key: 'egi', format: 'dollar' },
        { label: 'Rent / Unit / Month', key: 'rentPerUnit', format: 'dollar' },
      ]
    },
    {
      title: 'Expenses',
      icon: '📊',
      rows: [
        { label: 'Total Operating Expenses', key: 'totalExpenses', format: 'dollar' },
        { label: 'Real Estate Taxes', key: 'taxes', format: 'dollar' },
        { label: 'Insurance', key: 'insurance', format: 'dollar' },
        { label: 'Expense Ratio', key: 'expenseRatio', format: 'pct1' },
      ]
    },
    {
      title: 'Returns & Cash Flow',
      icon: '🎯',
      rows: [
        { label: 'Net Operating Income (NOI)', key: 'noi', format: 'dollar' },
        { label: 'Cap Rate', key: 'capRate', format: 'pct1' },
        { label: 'NOI / Unit', key: 'noiPerUnit', format: 'dollar' },
        { label: 'DSCR', key: 'dscr', format: 'num' },
        { label: 'Day 1 Cash Flow / mo', key: 'dayOneCashFlow', format: 'dollar' },
        { label: 'Stabilized Cash Flow / mo', key: 'stabilizedCashFlow', format: 'dollar' },
      ]
    },
    {
      title: 'Capital Structure',
      icon: '🏗️',
      rows: [
        { label: 'Total Equity Required', key: 'totalEquity', format: 'dollar' },
        { label: 'Sponsor Cash In', key: 'sponsorCash', format: 'dollar' },
        { label: 'Outside Capital', key: 'outsideCapital', format: 'dollar' },
        { label: 'Cash Ratio', key: 'cashRatio', format: 'numX' },
        { label: 'Equity Multiple', key: 'equityMultiple', format: 'numX' },
        { label: 'Recovery Time', key: 'monthsToRecovery', format: 'months' },
      ]
    },
    {
      title: 'Refi & Exit',
      icon: '🔄',
      rows: [
        { label: 'Refi Value', key: 'refiValue', format: 'dollar' },
        { label: 'Cash-Out Refi', key: 'cashOutRefi', format: 'dollar' },
        { label: 'Post-Refi Cash Flow / mo', key: 'postRefiCashFlow', format: 'dollar' },
      ]
    },
    {
      title: 'Risk Assessment',
      icon: '⚡',
      rows: [
        { label: 'Risk Level', key: 'riskLevel', format: 'risk' },
      ]
    },
  ];

  // Format a cell value
  const formatValue = (val, format) => {
    switch (format) {
      case 'dollar': return fmtK(val);
      case 'pct': return pct(val);
      case 'pct0': return pct(val, 0);
      case 'pct1': return pct(val, 1);
      case 'num': return num(val);
      case 'numX': return val > 0 ? `${num(val)}x` : '—';
      case 'int': return val > 0 ? val : '—';
      case 'months': return val != null ? `${Math.round(val)} mo` : '—';
      case 'text': return val || '—';
      case 'stage': return null; // handled separately
      case 'risk': return null; // handled separately
      default: return String(val || '—');
    }
  };

  const dealCount = metrics.length;
  const colW = Math.max(180, Math.min(260, 900 / dealCount));

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(41, 47, 76, 0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: 14, width: '95vw', maxWidth: 1600,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid #e6e9ef',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2b55 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                Deal Comparison
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                Comparing {dealCount} deals side-by-side
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'rgba(255,255,255,0.12)', borderRadius: 8,
            cursor: 'pointer', padding: 8, color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 240 + dealCount * colW }}>
            {/* Sticky deal headers */}
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f7f8fc' }}>
                <th style={{ position: 'sticky', left: 0, zIndex: 11, background: '#f7f8fc', width: 240, minWidth: 240, padding: '16px 18px', textAlign: 'left', borderBottom: '2px solid #e6e9ef', fontSize: 13, fontWeight: 700, color: '#676879' }}>
                  METRIC
                </th>
                {metrics.map((m, i) => {
                  const stColor = stageColors[m.dealStage] || '#579bfc';
                  return (
                    <th key={i} style={{ width: colW, minWidth: colW, padding: '14px 16px', borderBottom: '2px solid #e6e9ef', borderLeft: '1px solid #e6e9ef', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e1e2e', marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.address}>
                        {m.address}
                      </div>
                      <div style={{ fontSize: 11, color: '#676879', marginBottom: 6 }}>
                        {m.city}{m.state ? `, ${m.state}` : ''} {m.units > 0 ? `• ${m.units} units` : ''}
                      </div>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, backgroundColor: `${stColor}20`, color: stColor, border: `1px solid ${stColor}40` }}>
                        {stageLabels[m.dealStage] || 'Underwritten'}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map((section, si) => (
                <React.Fragment key={si}>
                  {/* Section header */}
                  <tr>
                    <td colSpan={1 + dealCount} style={{ padding: '14px 18px 8px', fontWeight: 800, fontSize: 14, color: '#1e1e2e', background: '#fff', borderTop: si > 0 ? '2px solid #e6e9ef' : 'none' }}>
                      <span style={{ marginRight: 8 }}>{section.icon}</span>
                      {section.title}
                    </td>
                  </tr>
                  {/* Metric rows */}
                  {section.rows.map((row, ri) => {
                    const bestIdx = getBestIdx(metrics, row.key);
                    return (
                      <tr key={`${si}-${ri}`} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfd' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f2ff'}
                        onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#fafbfd'}
                      >
                        {/* Label cell */}
                        <td style={{ position: 'sticky', left: 0, background: 'inherit', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#323338', borderBottom: '1px solid #f0f1f3', whiteSpace: 'nowrap', zIndex: 5 }}>
                          {row.label}
                        </td>
                        {/* Value cells */}
                        {metrics.map((m, di) => {
                          const val = m[row.key];
                          const isBest = di === bestIdx && dealCount > 1;

                          // Special rendering for stage badge
                          if (row.format === 'stage') {
                            const sc = stageColors[val] || '#579bfc';
                            return (
                              <td key={di} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f0f1f3', borderLeft: '1px solid #f0f1f3' }}>
                                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: `${sc}20`, color: sc }}>
                                  {stageLabels[val] || val}
                                </span>
                              </td>
                            );
                          }

                          // Special rendering for risk badge
                          if (row.format === 'risk') {
                            const rc = riskColors[val] || '#c3c6d4';
                            return (
                              <td key={di} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f0f1f3', borderLeft: '1px solid #f0f1f3' }}>
                                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: `${rc}20`, color: rc }}>
                                  {m.riskText}
                                </span>
                              </td>
                            );
                          }

                          // Special rendering for deal structure (text badge)
                          if (row.format === 'text' && row.key === 'dealStructure') {
                            return (
                              <td key={di} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f0f1f3', borderLeft: '1px solid #f0f1f3' }}>
                                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: '#f0f1f3', color: '#323338' }}>
                                  {val || 'Traditional'}
                                </span>
                              </td>
                            );
                          }

                          const formatted = formatValue(val, row.format);
                          const isNeg = typeof val === 'number' && val < 0;
                          const isDollarOrPct = ['dollar', 'pct', 'pct0', 'pct1', 'num', 'numX'].includes(row.format);

                          return (
                            <td key={di} style={{
                              padding: '10px 16px', textAlign: 'center', fontSize: 14, fontWeight: 700,
                              borderBottom: '1px solid #f0f1f3', borderLeft: '1px solid #f0f1f3',
                              color: isBest ? '#047857' : isNeg ? '#dc2626' : '#323338',
                              background: isBest ? '#ecfdf5' : 'inherit',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                {isBest && isDollarOrPct && <TrendingUp size={13} color="#047857" />}
                                <span>{formatted}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Broker info row */}
              <tr>
                <td colSpan={1 + dealCount} style={{ padding: '14px 18px 8px', fontWeight: 800, fontSize: 14, color: '#1e1e2e', background: '#fff', borderTop: '2px solid #e6e9ef' }}>
                  <span style={{ marginRight: 8 }}>📞</span>
                  Broker
                </td>
              </tr>
              <tr style={{ background: '#fff' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#323338', borderBottom: '1px solid #f0f1f3', zIndex: 5 }}>
                  Broker Contact
                </td>
                {metrics.map((m, di) => (
                  <td key={di} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f0f1f3', borderLeft: '1px solid #f0f1f3', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#323338' }}>{m.brokerName || '—'}</div>
                    {m.brokerEmail && <div style={{ color: '#579bfc', marginTop: 2 }}>{m.brokerEmail}</div>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer — quick summary winner ribbon */}
        <div style={{
          padding: '14px 28px', borderTop: '1px solid #e6e9ef', background: '#f7f8fc',
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          {/* Best by NOI */}
          {(() => {
            const bestNOI = getBestIdx(metrics, 'noi');
            const bestCap = getBestIdx(metrics, 'capRate');
            const bestCF = getBestIdx(metrics, 'dayOneCashFlow');

            const badges = [];
            if (bestNOI >= 0) badges.push({ label: 'Highest NOI', deal: metrics[bestNOI].address, val: fmtK(metrics[bestNOI].noi), color: '#00c875' });
            if (bestCap >= 0) badges.push({ label: 'Best Cap Rate', deal: metrics[bestCap].address, val: pct(metrics[bestCap].capRate, 1), color: '#579bfc' });
            if (bestCF >= 0) badges.push({ label: 'Best Day 1 CF', deal: metrics[bestCF].address, val: fmtK(metrics[bestCF].dayOneCashFlow), color: '#a25ddc' });

            return badges.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #e6e9ef' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#676879', fontWeight: 500 }}>{b.label}:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#323338', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.deal}>{b.deal}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{b.val}</span>
              </div>
            ));
          })()}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#ababab' }}>
            Green cells = best value  |  Press ESC or click outside to close
          </div>
        </div>
      </div>
    </div>
  );
}
