// Shared Deal Room widget data helpers — used by BOTH the read-only
// InvestorDealRoom (investor + sponsor preview) and the sponsor-side
// DealRoomLayoutEditor (so the editor's live widget previews use the exact
// same data-resolution logic the investor will actually see, not a mock).
import { useEffect, useMemo, useState } from 'react';
import { loadMarketDataForLocation } from './marketDataLookup';

// Mirrors backend/deal_room_layout.py's WIDGET_WHITELIST exactly — the
// backend is the real enforcement point (400s on a mismatch), this copy is
// only used to build the editor's "+ Add Widget" menu.
export const SECTION_WIDGET_WHITELIST = {
  financials: ['table', 'summaryCard', 'barChart', 'lineChart'],
  comps: ['table', 'map', 'barChart', 'summaryCard'],
  marketData: ['lineChart', 'barChart', 'summaryCard'],
  participation: ['table', 'pieChart'],
  calculator: ['slider', 'summaryCard'],
  documents: ['table'],
};

export const SECTION_LABELS = {
  financials: 'Financial Overview',
  comps: 'Comps',
  marketData: 'Market Data',
  participation: 'Ownership Breakdown',
  calculator: 'Investor Stress-Test',
  documents: 'Documents',
};

export const WIDGET_TYPE_META = {
  table: { label: 'Table', icon: 'Table' },
  summaryCard: { label: 'Summary Cards', icon: 'Gauge' },
  barChart: { label: 'Bar Chart', icon: 'BarChart3' },
  pieChart: { label: 'Pie Chart', icon: 'PieChart' },
  lineChart: { label: 'Line Chart', icon: 'TrendingUp' },
  map: { label: 'Map', icon: 'MapPin' },
  slider: { label: 'Interactive Slider', icon: 'SlidersHorizontal' },
};

/** Fetches Comps (from scenario_data.rentcast_cache) and Market Data (from
 * the static public CSVs) once for a deal's location — shared by the
 * read-only view and the editor's live preview so they never disagree. */
export function useDealRoomWidgetData({ scenarioData, enableMarketData = true }) {
  const comps = useMemo(() => {
    const raw = scenarioData?.rentcast_cache?.data?.comparables;
    return Array.isArray(raw) ? raw : [];
  }, [scenarioData]);

  const property = scenarioData?.property || {};
  const propertyCity = property.city || '';
  const propertyState = property.state || '';
  const propertyZip = property.zip || property.zipcode || '';

  const [marketMetrics, setMarketMetrics] = useState([]);
  useEffect(() => {
    if (!enableMarketData) return;
    if (!propertyCity && !propertyZip) return;
    let cancelled = false;
    loadMarketDataForLocation({ city: propertyCity, state: propertyState, zip: propertyZip }).then((m) => {
      if (!cancelled) setMarketMetrics(m);
    });
    return () => { cancelled = true; };
  }, [propertyCity, propertyState, propertyZip, enableMarketData]);

  return { comps, marketMetrics, property };
}

/** Resolves a widget's dataBinding into the shape its renderer needs. Pure
 * function — same logic used by InvestorDealRoom and the layout editor. */
export function resolveWidgetDataset(sectionId, widget, { comps = [], marketMetrics = [], property = {} } = {}) {
  if (sectionId === 'comps') {
    if (widget.type === 'table') {
      return {
        rows: comps,
        columns: [
          { key: 'formattedAddress', label: 'Address' },
          { key: 'price', label: 'Rent/mo', format: 'money' },
          { key: 'bedrooms', label: 'Bed' },
          { key: 'bathrooms', label: 'Bath' },
          { key: 'squareFootage', label: 'SqFt', format: 'number' },
          { key: 'distance', label: 'Miles' },
        ],
      };
    }
    if (widget.type === 'map') {
      const subjectLat = property.lat ?? property.latitude;
      const subjectLng = property.lng ?? property.longitude;
      const points = comps
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => ({ lat: c.latitude, lng: c.longitude, label: c.formattedAddress || c.addressLine1 }));
      if (subjectLat != null && subjectLng != null) {
        points.unshift({ lat: subjectLat, lng: subjectLng, label: 'Subject Property', isSubject: true });
      }
      return { points };
    }
    if (widget.type === 'barChart') {
      return {
        data: comps.slice(0, 10).map((c) => ({
          category: (c.formattedAddress || c.addressLine1 || 'Comp').split(',')[0],
          value: c.price,
          format: 'money',
        })),
      };
    }
    if (widget.type === 'summaryCard') {
      const rents = comps.map((c) => Number(c.price)).filter((v) => !Number.isNaN(v));
      const avgRent = rents.length ? rents.reduce((a, b) => a + b, 0) / rents.length : null;
      return {
        items: [
          { label: 'Comps Found', value: comps.length, format: 'number' },
          avgRent != null ? { label: 'Avg Comp Rent', value: avgRent, format: 'money' } : null,
        ].filter(Boolean),
      };
    }
  }
  if (sectionId === 'marketData') {
    if (widget.type === 'summaryCard') {
      return {
        items: marketMetrics.map((m) => ({
          label: m.label,
          value: m.value,
          format: m.format === 'text' ? undefined : m.format,
          sourceLabel: m.dataSource,
        })),
      };
    }
    if (widget.type === 'barChart') {
      return {
        data: marketMetrics
          .filter((m) => m.format === 'pct' || m.format === 'number')
          .map((m) => ({ category: m.label, value: m.value, format: m.format })),
      };
    }
  }
  return null;
}
