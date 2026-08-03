import React, { useMemo, useRef, useState } from 'react';
import {
  GripVertical, Plus, X, Palette, Type, Save, Loader2, Check,
  Table as TableIcon, Gauge, BarChart3, PieChart as PieChartIcon, TrendingUp, MapPin, SlidersHorizontal,
} from 'lucide-react';
import { saveDealRoomLayout } from '../../lib/dealRoomLayoutService';
import { useDealRoomWidgetData, resolveWidgetDataset, SECTION_WIDGET_WHITELIST, SECTION_LABELS, WIDGET_TYPE_META } from '../../lib/dealRoomWidgetData';
import { renderWidget } from './DealRoomWidgets';
import { DEAL_ROOM_FONT_OPTIONS } from './DealRoomStyles';

const WIDGET_ICONS = {
  Table: TableIcon, Gauge, BarChart3, PieChart: PieChartIcon, TrendingUp, MapPin, SlidersHorizontal,
};

// Only these two sections have a real per-widget rendering path today (see
// InvestorDealRoom.jsx) — the other four (Financials/Ownership/Stress-Test/
// Documents) keep their own hand-built, already-polished JSX and aren't
// widget-editable yet, so they're intentionally not offered here.
const EDITABLE_SECTIONS = ['comps', 'marketData'];

const ACCENT_SWATCHES = [
  { id: 'green', value: '#0f5132', label: 'Deep Green' },
  { id: 'emerald', value: '#059669', label: 'Emerald' },
  { id: 'navy', value: '#1e3a5f', label: 'Navy' },
  { id: 'slate', value: '#334155', label: 'Slate' },
  { id: 'burgundy', value: '#7c2d3a', label: 'Burgundy' },
  { id: 'charcoal', value: '#1f2937', label: 'Charcoal' },
];

let widgetIdCounter = 0;
const newWidgetId = () => `w${Date.now()}${widgetIdCounter++}`;

const DEFAULT_BINDING = { comps: 'comps', marketData: 'marketMetrics' };

function WidgetTypeIcon({ name, size = 14 }) {
  const Icon = WIDGET_ICONS[name] || TableIcon;
  return <Icon size={size} />;
}

/**
 * Sponsor-side drag-and-drop editor for the investor-facing Deal Room's
 * widget-based sections (Comps, Market Data) plus the global theme (accent
 * color + font). Saves to `deal_room_layouts` via saveDealRoomLayout —
 * the backend re-validates every widget against WIDGET_WHITELIST
 * regardless of what this UI allows, so there's no write-side security
 * gap even if this component has a bug.
 */
export default function DealRoomLayoutEditor({ dealId, initialLayout, scenarioData, onSaved, onClose }) {
  const [sections, setSections] = useState(() => {
    const base = Array.isArray(initialLayout?.sections) ? initialLayout.sections : [];
    // Ensure both editable sections exist even if an older/partial layout is missing one.
    return EDITABLE_SECTIONS.map((id) => base.find((s) => s.id === id) || { id, title: SECTION_LABELS[id], widgets: [] });
  });
  const [theme, setTheme] = useState(() => ({
    accent: initialLayout?.theme?.accent || ACCENT_SWATCHES[0].value,
    font: initialLayout?.theme?.font || 'classic',
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(null); // sectionId or null

  const { comps, marketMetrics, property } = useDealRoomWidgetData({ scenarioData, enableMarketData: true });
  const widgetContext = useMemo(() => ({ comps, marketMetrics, property }), [comps, marketMetrics, property]);

  const dragWidget = useRef(null); // { sectionId, index }

  const getSection = (id) => sections.find((s) => s.id === id);
  const updateSectionWidgets = (sectionId, widgets) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, widgets } : s)));
  };

  const addWidget = (sectionId, type) => {
    const widget = { id: newWidgetId(), type, dataBinding: DEFAULT_BINDING[sectionId], config: {} };
    updateSectionWidgets(sectionId, [...(getSection(sectionId)?.widgets || []), widget]);
    setAddMenuOpen(null);
  };

  const removeWidget = (sectionId, widgetId) => {
    updateSectionWidgets(sectionId, (getSection(sectionId)?.widgets || []).filter((w) => w.id !== widgetId));
  };

  const reorderWidget = (sectionId, fromIndex, toIndex) => {
    const widgets = [...(getSection(sectionId)?.widgets || [])];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= widgets.length || toIndex >= widgets.length) return;
    const [moved] = widgets.splice(fromIndex, 1);
    widgets.splice(toIndex, 0, moved);
    updateSectionWidgets(sectionId, widgets);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const merged = Array.isArray(initialLayout?.sections)
        ? initialLayout.sections.map((s) => (EDITABLE_SECTIONS.includes(s.id) ? getSection(s.id) : s))
        : sections;
      const saved = await saveDealRoomLayout(dealId, { sections: merged, theme });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.(saved);
    } catch (e) {
      setError(e.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e6e9ef', overflow: 'hidden' }}>
      {/* Top bar: theme controls + save/cancel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        padding: '16px 20px', borderBottom: '1px solid #e6e9ef', backgroundColor: '#fafbfc',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Customize Deal Room</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Arrange widgets and set the theme investors will see</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={14} color="#6b7280" />
            <div style={{ display: 'flex', gap: 6 }}>
              {ACCENT_SWATCHES.map((s) => (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => setTheme((t) => ({ ...t, accent: s.value }))}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: s.value, cursor: 'pointer',
                    border: theme.accent === s.value ? '2px solid #111827' : '2px solid transparent',
                    outline: theme.accent === s.value ? '1px solid #fff' : 'none',
                    boxShadow: '0 0 0 1px #e5e7eb',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Type size={14} color="#6b7280" />
            <select
              value={theme.font}
              onChange={(e) => setTheme((t) => ({ ...t, font: e.target.value }))}
              style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151' }}
            >
              {Object.entries(DEAL_ROOM_FONT_OPTIONS).map(([key, f]) => (
                <option key={key} value={key}>{f.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {onClose && (
              <button onClick={onClose} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer',
              }}>
                Close
              </button>
            )}
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700,
              borderRadius: 6, border: 'none', background: saved ? '#059669' : theme.accent, color: '#fff',
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={13} /> : saved ? <Check size={13} /> : <Save size={13} />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save Layout'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 20px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Editable sections */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {EDITABLE_SECTIONS.map((sectionId) => {
          const section = getSection(sectionId);
          const widgets = section?.widgets || [];
          const allowedTypes = SECTION_WIDGET_WHITELIST[sectionId] || [];

          return (
            <div key={sectionId} style={{ border: '1px solid #e6e9ef', borderRadius: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: widgets.length ? '1px solid #f0f1f4' : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{SECTION_LABELS[sectionId]}</div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setAddMenuOpen((cur) => (cur === sectionId ? null : sectionId))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
                      color: '#374151', cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Add Widget
                  </button>
                  {addMenuOpen === sectionId && (
                    <div style={{
                      position: 'absolute', right: 0, top: '110%', zIndex: 10, minWidth: 170,
                      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(17,17,17,0.12)', overflow: 'hidden',
                    }}>
                      {allowedTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => addWidget(sectionId, type)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                            padding: '9px 12px', fontSize: 13, border: 'none', background: '#fff', cursor: 'pointer', color: '#374151',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                        >
                          <WidgetTypeIcon name={WIDGET_TYPE_META[type]?.icon} />
                          {WIDGET_TYPE_META[type]?.label || type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {widgets.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                  No widgets yet — this section is hidden from investors until you add one.
                </div>
              ) : (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {widgets.map((widget, i) => (
                    <div
                      key={widget.id}
                      draggable
                      onDragStart={() => { dragWidget.current = { sectionId, index: i }; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragWidget.current;
                        dragWidget.current = null;
                        if (!from || from.sectionId !== sectionId || from.index === i) return;
                        reorderWidget(sectionId, from.index, i);
                      }}
                      style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        border: '1px solid #e6e9ef', borderRadius: 8, padding: 12, background: '#fcfcfd',
                      }}
                    >
                      <div style={{ cursor: 'grab', color: '#9ca3af', paddingTop: 2 }} title="Drag to reorder">
                        <GripVertical size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: theme.accent }}>
                            <WidgetTypeIcon name={WIDGET_TYPE_META[widget.type]?.icon} size={13} />
                            {WIDGET_TYPE_META[widget.type]?.label || widget.type}
                          </div>
                          <button
                            onClick={() => removeWidget(sectionId, widget.id)}
                            title="Remove widget"
                            style={{
                              border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 2,
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <div style={{ pointerEvents: 'none' }}>
                          {renderWidget(widget, resolveWidgetDataset(sectionId, widget, widgetContext), theme.accent) || (
                            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                              No data available yet for this widget.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
