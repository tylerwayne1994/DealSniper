import React from 'react';

/**
 * Generic Deal Room widgets — rendered by section-widget layout JSON from
 * `deal_room_layouts` (see backend/deal_room_layout.py's WIDGET_WHITELIST).
 *
 * IMPORTANT: like DealRoomCharts.jsx, these are deliberately hand-rolled
 * (inline SVG / plain HTML, no charting library) because the Deal Room's
 * "Export Investor Link" produces a single self-contained .html file with
 * zero external scripts — anything rendered here must work identically
 * inside that static export. Every widget returns null on insufficient
 * data rather than rendering an empty/fabricated chart.
 */

const ACCENT_FALLBACK = 'var(--dr-accent, #0f5132)';
const GRID = '#e5e7eb';
const MUTED = '#6b7280';

const fmtValue = (value, format) => {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'pct') {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    // Values from marketDataLookup/rentcast are already "human" percentages (e.g. 3.4 = 3.4%), not decimals.
    return `${n.toFixed(2)}%`;
  }
  if (format === 'money') {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `$${Math.round(n).toLocaleString()}`;
  }
  if (format === 'number') {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toLocaleString();
  }
  return String(value);
};

/** Generic table: array of records + column definitions, OR falls back to
 * auto-deriving columns from the keys of the first record if none given. */
export function WidgetTable({ title, rows, columns }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const cols = columns && columns.length
    ? columns
    : Object.keys(rows[0]).slice(0, 6).map((key) => ({ key, label: key.replace(/_/g, ' ') }));

  return (
    <div className="dr-card">
      {title && <h3>{title}</h3>}
      <table className="dr-table">
        <thead>
          <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {cols.map((c) => (
                <td key={c.key} className={c.format ? 'dr-num' : undefined}>
                  {fmtValue(row[c.key], c.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single scalar or small key-value set. */
export function WidgetSummaryCard({ items, accent = ACCENT_FALLBACK }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="dr-stat-bar" style={{ border: `1px solid ${GRID}`, borderRadius: 6, overflow: 'hidden' }}>
      {items.map((item) => (
        <div key={item.label} className="dr-stat">
          <div className="dr-stat-label">{item.label}</div>
          <div className="dr-stat-value" style={{ color: item.color || undefined }}>
            {fmtValue(item.value, item.format)}
          </div>
          {item.sourceLabel && (
            <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{item.sourceLabel}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Simple vertical bar chart. data: [{category, value}] */
export function WidgetBarChart({ title, data, accent = ACCENT_FALLBACK }) {
  const valid = (data || []).filter((d) => d.value != null && !Number.isNaN(Number(d.value)));
  if (valid.length < 1) return null;

  const width = 560, height = 220, padL = 48, padR = 16, padT = 16, padB = 40;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const maxVal = Math.max(...valid.map((d) => Number(d.value)), 0);
  const barW = innerW / valid.length;

  return (
    <div className="dr-card">
      {title && <h3>{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke={GRID} strokeWidth={1} />
        ))}
        {valid.map((d, i) => {
          const v = Number(d.value);
          const h = maxVal > 0 ? (v / maxVal) * innerH : 0;
          const x = padL + i * barW + barW * 0.15;
          const y = padT + innerH - h;
          return (
            <g key={d.category || i}>
              <rect x={x} y={y} width={barW * 0.7} height={h} fill={accent} rx={2} />
              <text x={x + barW * 0.35} y={height - padB + 16} fontSize={10} fill={MUTED} textAnchor="middle">
                {String(d.category || '').slice(0, 10)}
              </text>
              <text x={x + barW * 0.35} y={y - 4} fontSize={10} fill="#111827" textAnchor="middle" fontWeight={700}>
                {fmtValue(v, d.format)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Simple donut/pie chart. data: [{category, value}] — should sum to a meaningful whole. */
export function WidgetPieChart({ title, data, accent = ACCENT_FALLBACK }) {
  const valid = (data || []).filter((d) => d.value != null && Number(d.value) > 0);
  const total = valid.reduce((s, d) => s + Number(d.value), 0);
  if (valid.length < 1 || total <= 0) return null;

  const size = 200, cx = size / 2, cy = size / 2, r = 80, innerR = 46;
  const palette = [accent, '#22d3ee', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];
  let cumulative = 0;

  const arc = (startFrac, endFrac) => {
    const startAngle = startFrac * 2 * Math.PI - Math.PI / 2;
    const endAngle = endFrac * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
  };

  return (
    <div className="dr-card">
      {title && <h3>{title}</h3>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 160, height: 160, flexShrink: 0 }}>
          {valid.map((d, i) => {
            const startFrac = cumulative;
            cumulative += Number(d.value) / total;
            return <path key={d.category || i} d={arc(startFrac, cumulative)} fill={palette[i % palette.length]} />;
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          {valid.map((d, i) => (
            <div key={d.category || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: palette[i % palette.length], display: 'inline-block' }} />
              <span style={{ color: '#374151' }}>{d.category}</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>{((Number(d.value) / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Simple time-series line chart. data: [{x (label/date), y (value)}] */
export function WidgetLineChart({ title, data, accent = ACCENT_FALLBACK }) {
  const valid = (data || []).filter((d) => d.y != null && !Number.isNaN(Number(d.y)));
  if (valid.length < 2) return null;

  const width = 560, height = 220, padL = 48, padR = 16, padT = 16, padB = 32;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const yVals = valid.map((d) => Number(d.y));
  const maxY = Math.max(...yVals), minY = Math.min(...yVals, 0);
  const range = maxY - minY || 1;
  const stepX = innerW / (valid.length - 1);

  const points = valid.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - ((Number(d.y) - minY) / range) * innerH;
    return { x, y, label: d.x, val: d.y };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="dr-card">
      {title && <h3>{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke={GRID} strokeWidth={1} />
        ))}
        <path d={path} fill="none" stroke={accent} strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill={accent} />
            <text x={p.x} y={height - padB + 16} fontSize={10} fill={MUTED} textAnchor="middle">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Simple relative-position scatter of geo-located records (comps + subject
 * property) — NOT a tiled map (no external tile server), so it stays
 * fully self-contained for the static HTML export. Positions points by
 * normalizing lat/lng into the plot's bounding box. */
export function WidgetMap({ title, points, accent = ACCENT_FALLBACK }) {
  const valid = (points || []).filter((p) => p.lat != null && p.lng != null && !Number.isNaN(Number(p.lat)) && !Number.isNaN(Number(p.lng)));
  if (valid.length < 1) return null;

  const width = 400, height = 300, pad = 20;
  const lats = valid.map((p) => Number(p.lat)), lngs = valid.map((p) => Number(p.lng));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  const project = (lat, lng) => ({
    x: pad + ((Number(lng) - minLng) / lngRange) * (width - pad * 2),
    // Invert y: higher latitude = further north = higher on screen (smaller y)
    y: pad + (1 - (Number(lat) - minLat) / latRange) * (height - pad * 2),
  });

  return (
    <div className="dr-card">
      {title && <h3>{title}</h3>}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: 400, height: 'auto', background: '#f9fafb', borderRadius: 6 }}>
        {valid.map((p, i) => {
          const { x, y } = project(p.lat, p.lng);
          const isSubject = !!p.isSubject;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isSubject ? 8 : 5} fill={isSubject ? '#ef4444' : accent} stroke="#fff" strokeWidth={2} />
              {p.label && (
                <text x={x} y={y - (isSubject ? 12 : 9)} fontSize={9} fill="#374151" textAnchor="middle">
                  {String(p.label).slice(0, 14)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Dispatches a single widget definition (from deal_room_layouts) to its
 * renderer, given the resolved dataset for its dataBinding. `dataset` is
 * already the specific array/object the widget needs — resolving
 * dataBinding -> dataset happens in the caller (InvestorDealRoom.jsx),
 * which knows about all the real data sources.
 */
export function renderWidget(widget, dataset, accent) {
  if (!widget || dataset == null) return null;
  switch (widget.type) {
    case 'table':
      return <WidgetTable key={widget.id} title={widget.config?.title} rows={dataset.rows} columns={dataset.columns} />;
    case 'summaryCard':
      return <WidgetSummaryCard key={widget.id} items={dataset.items} accent={accent} />;
    case 'barChart':
      return <WidgetBarChart key={widget.id} title={widget.config?.title} data={dataset.data} accent={accent} />;
    case 'pieChart':
      return <WidgetPieChart key={widget.id} title={widget.config?.title} data={dataset.data} accent={accent} />;
    case 'lineChart':
      return <WidgetLineChart key={widget.id} title={widget.config?.title} data={dataset.data} accent={accent} />;
    case 'map':
      return <WidgetMap key={widget.id} title={widget.config?.title} points={dataset.points} accent={accent} />;
    default:
      return null;
  }
}
