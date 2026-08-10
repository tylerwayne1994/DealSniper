import React, { useMemo } from 'react';
import { TrendingUp, Target, Clock, AlertTriangle, DollarSign } from 'lucide-react';

// Stage-to-close probability weights for a "weighted pipeline value" forecast —
// a standard CRM concept (Salesforce/HubSpot call this "weighted pipeline").
const STAGE_WEIGHT = {
  sourced: 0.1,
  underwritten: 0.25,
  loi: 0.5,
  contract: 0.75,
  financing: 0.9,
  closed: 1,
  dead: 0
};

const STAGE_ORDER = ['sourced', 'underwritten', 'loi', 'contract', 'financing', 'closed', 'dead'];

const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)));

function computeAnalytics(deals) {
  const stageCounts = {};
  const stageValue = {};
  STAGE_ORDER.forEach(s => { stageCounts[s] = 0; stageValue[s] = 0; });

  let weightedValue = 0;
  let totalValue = 0;
  const closeDurations = [];
  const deadDurations = [];
  const staleActive = [];
  const monthBuckets = {};

  deals.forEach(deal => {
    const stage = deal.deal_stage || 'underwritten';
    const price = Number(deal.purchasePrice) || 0;
    if (stageCounts[stage] === undefined) { stageCounts[stage] = 0; stageValue[stage] = 0; }
    stageCounts[stage] += 1;
    stageValue[stage] += price;
    totalValue += price;
    weightedValue += price * (STAGE_WEIGHT[stage] ?? 0.1);

    if (deal.createdAt) {
      const monthKey = new Date(deal.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthBuckets[monthKey]) monthBuckets[monthKey] = { count: 0, value: 0 };
      monthBuckets[monthKey].count += 1;
      monthBuckets[monthKey].value += price;
    }

    if (stage === 'closed' && deal.createdAt && deal.stageChangedAt) {
      closeDurations.push(daysBetween(deal.createdAt, deal.stageChangedAt));
    }
    if (stage === 'dead' && deal.createdAt && deal.stageChangedAt) {
      deadDurations.push(daysBetween(deal.createdAt, deal.stageChangedAt));
    }
    if (stage !== 'closed' && stage !== 'dead' && deal.stageChangedAt) {
      staleActive.push({ deal, days: daysBetween(deal.stageChangedAt, new Date().toISOString()), stage });
    }
  });

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

  const closedCount = stageCounts.closed || 0;
  const deadCount = stageCounts.dead || 0;
  const winRate = (closedCount + deadCount) > 0 ? (closedCount / (closedCount + deadCount)) * 100 : null;

  const months = Object.keys(monthBuckets).sort().slice(-6);

  return {
    stageCounts,
    stageValue,
    totalValue,
    weightedValue,
    winRate,
    avgDaysToClose: avg(closeDurations),
    avgDaysToDead: avg(deadDurations),
    staleActive: staleActive.sort((a, b) => b.days - a.days).slice(0, 6),
    monthly: months.map(m => ({ month: m, ...monthBuckets[m] }))
  };
}

const fmtCompact = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const num = Number(val);
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
};

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '11px', color: '#676879', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{sub}</div>}
    </div>
  </div>
);

export default function PipelineAnalytics({ deals = [], stageGroupColor, getStatusLabel, onOpenDealRoom }) {
  const a = useMemo(() => computeAnalytics(deals), [deals]);
  const maxStageCount = Math.max(1, ...STAGE_ORDER.map(s => a.stageCounts[s] || 0));
  const maxMonthValue = Math.max(1, ...a.monthly.map(m => m.value));

  if (!deals || deals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef' }}>
        <TrendingUp size={44} style={{ color: '#c3c6d4', marginBottom: '14px' }} />
        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600', color: '#323338' }}>No analytics yet</h3>
        <p style={{ margin: 0, color: '#676879', fontSize: '13px' }}>Push deals into the pipeline to see funnel, velocity, and value trends here.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Total Pipeline Value" value={fmtCompact(a.totalValue)} icon={DollarSign} color="#059669" />
        <StatCard label="Weighted Pipeline Value" value={fmtCompact(a.weightedValue)} sub="Value \u00d7 stage close probability" icon={Target} color="#10b981" />
        <StatCard label="Win Rate" value={a.winRate === null ? '\u2014' : `${a.winRate.toFixed(0)}%`} sub={`${a.stageCounts.closed || 0} closed / ${a.stageCounts.dead || 0} dead`} icon={TrendingUp} color="#8b5cf6" />
        <StatCard label="Avg. Days to Close" value={a.avgDaysToClose === null ? '\u2014' : Math.round(a.avgDaysToClose)} sub={a.avgDaysToDead !== null ? `${Math.round(a.avgDaysToDead)}d avg to dead` : undefined} icon={Clock} color="#06b6d4" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px' }}>
        {/* Stage funnel */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>Pipeline Funnel by Stage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {STAGE_ORDER.map(stage => {
              const count = a.stageCounts[stage] || 0;
              const value = a.stageValue[stage] || 0;
              const color = stageGroupColor[stage];
              const widthPct = (count / maxStageCount) * 100;
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '110px', fontSize: '12px', fontWeight: '600', color: '#374151', flexShrink: 0 }}>{getStatusLabel(stage)}</div>
                  <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '6px', height: '22px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${widthPct}%`, height: '100%', backgroundColor: color, borderRadius: '6px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ width: '90px', fontSize: '12px', color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>{count} \u00b7 {fmtCompact(value)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly value trend */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>Pipeline Value Added by Month</div>
          {a.monthly.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#9ca3af', padding: '20px 0', textAlign: 'center' }}>Not enough date history yet</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '160px' }}>
              {a.monthly.map(m => {
                const h = Math.max(4, (m.value / maxMonthValue) * 140);
                return (
                  <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                    <div title={`${fmtCompact(m.value)} \u00b7 ${m.count} deal(s)`} style={{ width: '100%', maxWidth: '36px', height: `${h}px`, background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '600' }}>{m.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stale deals — needs-attention list */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <AlertTriangle size={16} color="#f59e0b" />
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>Deals Needing Attention</div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>(longest time sitting in current stage)</div>
        </div>
        {a.staleActive.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>Nothing stale — every active deal has moved recently.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {a.staleActive.map(({ deal, days, stage }) => (
              <div key={deal.dealId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#f9fafb', cursor: onOpenDealRoom ? 'pointer' : 'default' }}
                onClick={() => onOpenDealRoom && onOpenDealRoom(deal)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stageGroupColor[stage], flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.address || 'Untitled Deal'}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{getStatusLabel(stage)}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: days > 30 ? '#dc2626' : '#f59e0b', flexShrink: 0 }}>{days}d</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
