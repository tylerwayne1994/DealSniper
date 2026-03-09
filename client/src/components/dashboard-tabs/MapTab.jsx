import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { API_ENDPOINTS } from '../../config/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { loadPipelineDeals } from '../../lib/dealsService';
import MapOverlayLayers, { COUNTY_METRIC_OPTIONS, ZIP_METRIC_OPTIONS, ZIP_HEATMAP_METRIC_OPTIONS } from './MapOverlayLayers';
import MSA_COORDINATES from '../../data/msaCoordinates';
import {
  MessageSquare,
  MapPin,
  Star,
  Heart,
  Cog,
  CheckCircle,
  XCircle,
  Building2,
  Filter,
  Calendar,
  Download,
  UploadCloud,
  FileSpreadsheet,
  Layers
} from 'lucide-react';

// ─── Zone color by prefix ────────────────
// ─── Zoning Category Colors (legend-driven) ─────────────────────────────────
const CATEGORY_COLORS = {
  'Residential':               '#a8d8a8', // green
  'Commercial':                '#f9d57a', // gold
  'Industrial':                '#c8a8d8', // purple
  'Agricultural':              '#d4e8a0', // lime
  'Mixed Use':                 '#e8b4a0', // warm salmon
  'Institutional / Public':    '#a8c8e8', // sky blue
  'Open Space / Parks':        '#6dcf6d', // bright green
  'Overlay / Special District':'#e0c8f0', // lavender
  'Planned Development':       '#f0c8a0', // peach
  'Transportation':            '#b0b0b0', // grey
  'Right-of-Way':              '#c0c0c0', // light grey
  'Timberland Production Zone':'#8fbc8f', // dark sea green
  'Town Specific':             '#dcc8a0', // tan
  'RPD':                       '#b8d8b8', // pale green
  'Jurisdictional':            '#a0a0d0', // slate blue
  'Unknown':                   '#cccccc', // default grey
};
const DEFAULT_ZONE_COLOR = '#cccccc';

// Fallback: first-character prefix guess (used when legend has no match)
const ZONE_PREFIX_COLORS = {
  R: '#a8d8a8', C: '#f9d57a', I: '#c8a8d8', A: '#d4e8a0', M: '#e8b4a0', O: '#a8c8e8',
};

function zoneColor(zoneCode, legend) {
  if (!zoneCode) return DEFAULT_ZONE_COLOR;
  // Try legend lookup first (keys are UPPER-CASED)
  if (legend) {
    const entry = legend[String(zoneCode).trim().toUpperCase()];
    if (entry?.category) return CATEGORY_COLORS[entry.category] || DEFAULT_ZONE_COLOR;
  }
  // Fallback to prefix guess
  const prefix = String(zoneCode).charAt(0).toUpperCase();
  return ZONE_PREFIX_COLORS[prefix] || DEFAULT_ZONE_COLOR;
}

// ─── ZoningOverlayLayer (child of MapContainer, uses useMap) ─────────
function ZoningOverlayLayer({ serviceKey, enabled, zoneFilter }) {
  const map = useMap();
  const layerRef = useRef(null);
  const debounceRef = useRef(null);
  const initialFitDone = useRef(false);
  const prevServiceKey = useRef(null);

  const fetchAndRender = useCallback(async (fitBounds = false) => {
    if (!map || !serviceKey) return;
    const bounds = map.getBounds();
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
      const url = `${API_ENDPOINTS.zoningData(serviceKey)}?bbox=${bbox}`;
      const res = await fetch(url);
      if (!res.ok) { console.error('[Zoning] fetch error', res.status); return; }
      const geojson = await res.json();
      const config = geojson._zoning_config || {};
      const zoneField = config.zone_field || 'ZONE_CODE';
      const legend = config.legend || {};  // { CODE_UPPER: { full_name, category } }

      // Remove previous layer
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }

      const layer = L.geoJSON(geojson, {
        filter: (feature) => {
          if (!zoneFilter) return true;
          const code = String(feature.properties?.[zoneField] || '').toLowerCase();
          return code.includes(zoneFilter.toLowerCase());
        },
        style: (feature) => {
          const code = feature.properties?.[zoneField] || '';
          return {
            fillColor: zoneColor(code, legend),
            fillOpacity: 0.45,
            color: '#555',
            weight: 1.2,
          };
        },
        onEachFeature: (feature, lyr) => {
          const props = feature.properties || {};
          // ── Build clean zoning popup ──
          const zoneVal = props[zoneField] || 'Unknown';
          const labelVal = config.label_field && props[config.label_field] && props[config.label_field] !== zoneVal
            ? props[config.label_field] : '';

          // Look up legend entry for this zone code
          const legendEntry = legend[String(zoneVal).trim().toUpperCase()] || null;
          const fullName = legendEntry?.full_name && legendEntry.full_name !== zoneVal
            ? legendEntry.full_name : '';
          const category = legendEntry?.category || '';
          const catColor = CATEGORY_COLORS[category] || '';

          // Fields to always skip (metadata/audit/shape junk)
          const SKIP = new Set([
            'OBJECTID', 'FID', 'GlobalID', 'Shape', 'Shape_Length', 'Shape_Area',
            'Shape.STArea()', 'Shape.STLength()', 'Shape__Area', 'Shape__Length',
            'CREATED', 'EDITED', 'CREATOR', 'EDITOR', 'created_user', 'created_date',
            'last_edited_user', 'last_edited_date', 'EditDate', 'CreateDate',
            'Shape.area', 'Shape.len', 'SHAPE.AREA', 'SHAPE.LEN', 'SHAPE.STArea()',
            'SHAPE.STLength()', 'SE_ANNO_CAD_DATA',
            zoneField, // shown in header already
          ]);
          if (config.label_field) SKIP.add(config.label_field);

          // Only show fields with real values
          const rows = Object.entries(props)
            .filter(([k, v]) => {
              if (SKIP.has(k)) return false;
              if (k.startsWith('Shape') || k.startsWith('SHAPE')) return false;
              if (v === null || v === undefined || v === '' || v === ' ' || v === '-' || v === 'N/A') return false;
              if (typeof v === 'number' && (String(v).length > 12)) return false; // skip epoch timestamps
              return true;
            })
            .map(([k, v]) => {
              // Clean up field name: replace underscores, title-case
              const clean = k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
              return `<tr><td style="font-weight:600;color:#6b7280;padding:2px 8px 2px 0;font-size:11px;white-space:nowrap">${clean}</td><td style="color:#111827;padding:2px 0;font-size:11px">${v}</td></tr>`;
            })
            .join('');

          // Category badge
          const categoryBadge = category
            ? `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:10px;font-weight:600;color:#1f2937;background:${catColor};border:1px solid rgba(0,0,0,0.1);margin-top:3px">${category}</span>`
            : '';

          const header = `<div style="padding:6px 0 4px;border-bottom:1px solid #e5e7eb;margin-bottom:4px">`
            + `<div style="font-weight:700;font-size:14px;color:#1d4ed8">${zoneVal}</div>`
            + (fullName ? `<div style="font-size:11px;color:#374151;margin-top:1px">${fullName}</div>` : '')
            + (labelVal && labelVal !== fullName ? `<div style="font-size:11px;color:#6b7280;margin-top:1px">${labelVal}</div>` : '')
            + categoryBadge
            + `<div style="font-size:9px;color:#9ca3af;margin-top:2px">${config.label || 'Zoning'}</div>`
            + `</div>`;

          lyr.bindPopup(
            `<div style="max-height:280px;overflow-y:auto;font-family:Inter,sans-serif">${header}<table>${rows}</table></div>`,
            { maxWidth: 320 }
          );

          // Highlight on hover
          lyr.on('mouseover', () => {
            lyr.setStyle({ weight: 3, color: '#1d4ed8', fillOpacity: 0.7 });
            lyr.bringToFront();
          });
          lyr.on('mouseout', () => {
            layer.resetStyle(lyr);
          });
        },
      });

      layer.addTo(map);
      layerRef.current = layer;

      if (fitBounds && geojson.features?.length > 0) {
        const b = layer.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [40, 40] });
      }
    } catch (err) {
      console.error('[Zoning] Error fetching zoning data:', err);
    }
  }, [map, serviceKey, zoneFilter]);

  // Fetch on mount or when service changes, and auto-refetch on pan/zoom with debounce
  useEffect(() => {
    if (!enabled || !serviceKey) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }

    const isNewService = prevServiceKey.current !== serviceKey;
    prevServiceKey.current = serviceKey;

    // Fetch immediately, fit bounds only on first load of a new service
    if (isNewService) { initialFitDone.current = false; }
    fetchAndRender(!initialFitDone.current);
    initialFitDone.current = true;

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchAndRender(false), 500);
    };
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [enabled, serviceKey, fetchAndRender, map]);

  // Re-render when filter text changes (client-side filter only)
  useEffect(() => {
    if (!enabled || !serviceKey) return;
    fetchAndRender(false);
  }, [zoneFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // Imperative-only; no JSX rendered
}

// ─── ParcelOverlayLayer (child of MapContainer, uses useMap) ─────────
function ParcelOverlayLayer({ enabled }) {
  const map = useMap();
  const layerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const fetchAndRender = useCallback(async () => {
    if (!map || !enabled) { console.log('[Parcels] skip: map=', !!map, 'enabled=', enabled); return; }

    const zoom = map.getZoom();
    const center = map.getCenter();
    console.log('[Parcels] fetchAndRender called — zoom:', zoom, 'center:', center.lat.toFixed(4), center.lng.toFixed(4));

    // Clean up previous
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }

    if (zoom < 14) { console.log('[Parcels] zoom too low (' + zoom + ' < 14), skipping'); return; }

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const bounds = map.getBounds();
    const params = new URLSearchParams({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
      zoom,
      limit: 3000,
    });

    const url = `${API_ENDPOINTS.parcels}?${params}`;
    console.log('[Parcels] fetching:', url);

    try {
      const res = await fetch(url, { signal: abortRef.current.signal });
      console.log('[Parcels] response status:', res.status);
      if (!res.ok) { console.error('[Parcels] fetch error', res.status, await res.text()); return; }
      const geojson = await res.json();
      console.log('[Parcels] received:', geojson.features?.length, 'features, meta:', geojson._parcel_meta);

      if (!geojson.features?.length) { console.log('[Parcels] no features returned'); return; }

      const layer = L.geoJSON(geojson, {
        style: () => ({
          fillColor: '#7c3aed',
          fillOpacity: 0.03,
          color: '#e11d48',
          weight: 2,
          dashArray: null,
        }),
        onEachFeature: (feature, lyr) => {
          const props = feature.properties || {};
          const pid = props.pid || props.id || 'N/A';
          const rows = Object.entries(props)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => `<tr><td style="font-weight:600;color:#6b7280;padding:2px 8px 2px 0;font-size:11px;white-space:nowrap">${k}</td><td style="color:#111827;padding:2px 0;font-size:11px">${v}</td></tr>`)
            .join('');
          lyr.bindPopup(
            `<div style="font-family:Inter,sans-serif"><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#e11d48">📐 Parcel ${pid}</div><table>${rows}</table></div>`,
            { maxWidth: 300 }
          );
          lyr.on('mouseover', () => {
            lyr.setStyle({ weight: 3.5, color: '#be123c', fillOpacity: 0.15 });
            lyr.bringToFront();
          });
          lyr.on('mouseout', () => { layer.resetStyle(lyr); });
        },
      });

      layer.addTo(map);
      layerRef.current = layer;
      console.log('[Parcels] ✅ layer added to map with', geojson.features.length, 'features');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Parcels] ❌ Error fetching parcel data:', err);
      } else {
        console.log('[Parcels] fetch aborted (superseded)');
      }
    }
  }, [map, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }

    fetchAndRender();

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchAndRender(), 600);
    };
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [enabled, fetchAndRender, map]);

  return null;
}

// Helper to create Tailwind-styled divIcon
function createDivIcon({ bgClass, borderClass = 'border-white/60', icon: Icon, iconColor = '#fff', size = 'normal' }) {
  const sizeClasses = size === 'small' ? 'w-7 h-7' : 'w-9 h-9';
  const iconAnchor = size === 'small' ? [14, 14] : [18, 18];
  const popupAnchor = size === 'small' ? [0, -14] : [0, -18];
  
  return L.divIcon({
    className: 'atlasai-divicon',
    html: `
      <div class="relative flex items-center justify-center ${sizeClasses} rounded-full ${bgClass} border ${borderClass} shadow-lg backdrop-blur">
        <div class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/70"></div>
        <span id="icon-slot"></span>
      </div>
    `,
    iconAnchor: iconAnchor,
    popupAnchor: popupAnchor
  });
}

// Create traditional pin-shaped marker (teardrop style) for properties
function createPinIcon(color = '#ef4444', label = '') {
  return L.divIcon({
    className: 'custom-pin-icon',
    html: `
      <div style="position: relative; width: 32px; height: 42px;">
        <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path d="M16 0C9.4 0 4 5.4 4 12c0 8 12 30 12 30s12-22 12-30c0-6.6-5.4-12-12-12z" 
                fill="${color}" 
                stroke="#fff" 
                stroke-width="2" 
                filter="url(#pin-shadow)"/>
          <circle cx="16" cy="12" r="6" fill="#fff" opacity="0.9"/>
          ${label ? `<text x="16" y="16" text-anchor="middle" font-size="10" fill="${color}" font-weight="bold">${label}</text>` : ''}
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  });
}

// ─── Flood Zone Card (renders inside popups) ────────────────
function FloodZoneCard({ lat, lng }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lng) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const url = `${API_ENDPOINTS.floodZone}?lat=${lat}&lng=${lng}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError('Lookup failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (loading) {
    return (
      <div style={{ borderRadius: '10px', padding: '10px 12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '12px', color: '#0369a1' }}>
        🌊 Loading flood zone data...
      </div>
    );
  }
  if (error || !data || data.status === 'no_data' || data.status === 'no_geocode') {
    return (
      <div style={{ borderRadius: '10px', padding: '10px 12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
        🌊 No flood data available
      </div>
    );
  }

  const risk = data.risk;
  const bgColor = risk === 'high-coastal' ? '#fef2f2' : risk === 'high' ? '#fffbeb' : '#f0fdf4';
  const borderColor = risk === 'high-coastal' ? '#fca5a5' : risk === 'high' ? '#fcd34d' : '#86efac';
  const badgeColor = risk === 'high-coastal' ? '#dc2626' : risk === 'high' ? '#d97706' : '#16a34a';
  const badgeBg = risk === 'high-coastal' ? '#fee2e2' : risk === 'high' ? '#fef3c7' : '#dcfce7';
  const riskLabel = risk === 'high-coastal' ? 'COASTAL HIGH RISK' : risk === 'high' ? 'HIGH RISK' : 'MINIMAL RISK';
  const bfe = data.base_flood_elevation != null ? `${data.base_flood_elevation} ft` : 'N/A';

  return (
    <div style={{ borderRadius: '10px', padding: '12px', backgroundColor: bgColor, border: `1px solid ${borderColor}`, fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: '700', color: '#111827', fontSize: '13px' }}>🌊 Flood Zone</span>
        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', backgroundColor: badgeBg, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{riskLabel}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280', fontWeight: '600' }}>Zone Code</span>
          <span style={{ color: '#111827', fontWeight: '700' }}>{data.zone}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280', fontWeight: '600' }}>Description</span>
          <span style={{ color: '#111827', fontWeight: '500', textAlign: 'right', maxWidth: '60%', fontSize: '11px' }}>{data.zone_description}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280', fontWeight: '600' }}>Base Flood Elev.</span>
          <span style={{ color: '#111827', fontWeight: '700' }}>{bfe}</span>
        </div>
      </div>
    </div>
  );
}

function DashboardMapTab() {
  // Default map center (centered on US)
  const defaultCenter = [39.8283, -98.5795]; // Geographic center of US
  const defaultZoom = 5;

  const [customPins, setCustomPins] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', units: '', notes: '' });
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' | 'add' | 'upload'
  const [chat, setChat] = useState({ input: '', messages: [], loading: false });
  const [pendingCommands, setPendingCommands] = useState([]);
  const [rapidFireQueue, setRapidFireQueue] = useState([]);
  const [processingStatus, setProcessingStatus] = useState('');
  const [mapFilter, setMapFilter] = useState('all'); // 'all' | 'rapidfire' | 'prospects' | 'pipeline'
  const [userId, setUserId] = useState(null);
  const [mapStyle, setMapStyle] = useState('voyager');
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Overlay layer state
  const [countyOverlay, setCountyOverlay] = useState(false);
  const [zipOverlay, setZipOverlay] = useState(false);
  const [countyMetric, setCountyMetric] = useState('populationGrowth');
  const [zipMetric, setZipMetric] = useState('density_sqmi');
  const [zipHeatmap, setZipHeatmap] = useState(false);
  const [zipHeatmapMetric, setZipHeatmapMetric] = useState('medianHouseholdIncome');

  // Development pipeline overlay
  const [devPipelineEnabled, setDevPipelineEnabled] = useState(false);
  const [devPipelineData, setDevPipelineData] = useState([]);
  const [devPipelineFilter, setDevPipelineFilter] = useState('all'); // 'all' | status filter

  // Absorption / market data overlay
  const [absorptionEnabled, setAbsorptionEnabled] = useState(false);
  const [absorptionData, setAbsorptionData] = useState([]);
  const [absorptionFilter, setAbsorptionFilter] = useState('all'); // 'all' | market trend filter

  // Zoning overlay state
  const [zoningEnabled, setZoningEnabled] = useState(false);
  const [zoningServices, setZoningServices] = useState({}); // { key: { label } }
  const [zoningServiceKey, setZoningServiceKey] = useState('');
  const [zoningFilter, setZoningFilter] = useState(''); // text filter by zone code
  const [zoningLoading, setZoningLoading] = useState(false);

  // Parcel overlay state
  const [parcelOverlay, setParcelOverlay] = useState(false);

  // Uploaded property sheets state
  const [uploadedSheets, setUploadedSheets] = useState([]); // Array of { id, name, properties: [...] }
  const [sheetPreview, setSheetPreview] = useState(null); // Current sheet being previewed
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0, failed: [] });
  const [showGeocodeErrors, setShowGeocodeErrors] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState([]);  // Track selected property indices
  const [geocodingResults, setGeocodingResults] = useState({ results: [], failed: [] }); // Store geocoding results

  // Load development pipeline CSV when first enabled — uses the rich national pipeline CSV
  useEffect(() => {
    if (!devPipelineEnabled || devPipelineData.length > 0) return;
    Papa.parse('/Multifamily_ClassA_National_Pipeline_FINAL.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Enrich rows with MSA centroid coordinates when lat/lng is missing
        const enriched = results.data.map(r => {
          let lat = r.Latitude ? Number(r.Latitude) : NaN;
          let lng = r.Longitude ? Number(r.Longitude) : NaN;
          if (isNaN(lat) || isNaN(lng) || !lat) {
            const msa = r.MSA || '';
            const coords = MSA_COORDINATES[msa];
            if (coords) {
              // Add slight jitter so projects in the same MSA don't stack
              lat = coords[0] + (Math.random() - 0.5) * 0.06;
              lng = coords[1] + (Math.random() - 0.5) * 0.06;
            }
          }
          return {
            ...r,
            latitude: lat || null,
            longitude: lng || null,
            // Normalize field names for popup compatibility
            project_name: r.Project_Name || r.project_name || '',
            address: r.Address || r.address || '',
            city: r.City || r.city || '',
            status: r.Status || r.status || '',
            units: r.Units || r.units || '',
            developer: r.Developer || r.developer || '',
            class_type: r.Building_Class || r.class_type || '',
            cost_display: r.Cost_Display || '',
            permit_type: r.Permit_Type || '',
            description: r.Description || '',
            source_url: r.Data_Source || r.source_url || '',
            msa: r.MSA || '',
            occupancy_rate: r.Occupancy_Rate_Pct || '',
            vacancy_rate: r.Vacancy_Rate_Pct || '',
            avg_rent: r.Avg_Effective_Rent_USD || '',
            rent_growth: r.YoY_Rent_Growth_Pct || '',
            absorption_rate: r.Absorption_Rate_Pct || '',
            market_trend: r.Market_Trend || '',
          };
        });
        const valid = enriched.filter(r => r.latitude && r.longitude && !isNaN(Number(r.latitude)));
        setDevPipelineData(valid);
        console.log(`[DevPipeline] Loaded ${valid.length} projects from national pipeline CSV`);
      },
      error: (err) => console.error('[DevPipeline] CSV parse error:', err)
    });
  }, [devPipelineEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load absorption rates CSV when first enabled
  useEffect(() => {
    if (!absorptionEnabled || absorptionData.length > 0) return;
    Papa.parse('/absorption_rates_by_msa.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const enriched = results.data.map(r => {
          const msa = r.MSA || '';
          const coords = MSA_COORDINATES[msa];
          return {
            ...r,
            latitude: coords ? coords[0] : null,
            longitude: coords ? coords[1] : null,
          };
        }).filter(r => r.latitude && r.longitude);
        setAbsorptionData(enriched);
        console.log(`[Absorption] Loaded ${enriched.length} MSA market data points`);
      },
      error: (err) => console.error('[Absorption] CSV parse error:', err)
    });
  }, [absorptionEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load available zoning services when zoning overlay is first enabled
  useEffect(() => {
    if (!zoningEnabled || Object.keys(zoningServices).length > 0) return;
    (async () => {
      try {
        setZoningLoading(true);
        const res = await fetch(API_ENDPOINTS.zoningServices);
        if (res.ok) {
          const data = await res.json();
          setZoningServices(data);
          // Don't auto-select — let user pick from 85 services
        }
      } catch (err) {
        console.error('[Zoning] Failed to load services:', err);
      } finally {
        setZoningLoading(false);
      }
    })();
  }, [zoningEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered pipeline projects
  const filteredPipeline = useMemo(() => {
    if (!devPipelineEnabled) return [];
    if (devPipelineFilter === 'all') return devPipelineData;
    return devPipelineData.filter(p => p.status === devPipelineFilter);
  }, [devPipelineEnabled, devPipelineData, devPipelineFilter]);

  // Unique statuses for the filter dropdown
  const pipelineStatuses = useMemo(() => {
    const s = new Set(devPipelineData.map(p => p.status).filter(Boolean));
    return ['all', ...Array.from(s).sort()];
  }, [devPipelineData]);

  // Filtered absorption data
  const filteredAbsorption = useMemo(() => {
    if (!absorptionEnabled) return [];
    if (absorptionFilter === 'all') return absorptionData;
    return absorptionData.filter(a => a.Market_Trend === absorptionFilter);
  }, [absorptionEnabled, absorptionData, absorptionFilter]);

  // Unique market trends for absorption filter
  const absorptionTrends = useMemo(() => {
    const s = new Set(absorptionData.map(a => a.Market_Trend).filter(Boolean));
    return ['all', ...Array.from(s).sort()];
  }, [absorptionData]);

  // Color by market trend for absorption circles
  const absorptionColor = (trend) => {
    const t = (trend || '').toLowerCase();
    if (t.includes('improving')) return '#22c55e';
    if (t.includes('stable')) return '#3b82f6';
    if (t.includes('softening')) return '#ef4444';
    return '#6b7280';
  };

  // Color by status
  const devPinColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('complete')) return '#22c55e';
    if (s.includes('under construction')) return '#f59e0b';
    if (s.includes('proposed') || s.includes('planning') || s.includes('approved') || s.includes('announced')) return '#8b5cf6';
    if (s.includes('permitted')) return '#0ea5e9';
    return '#6b7280';
  };

  // MapLibre 3D refs
  const maplibreContainerRef = useRef(null);
  const maplibreMapRef = useRef(null);
  const maplibreMarkersRef = useRef([]);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  // Address autocomplete handler
  const handleAddressChange = async (value) => {
    setForm({ ...form, address: value });
    
    if (value.length > 3) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(value)}&addressdetails=1&limit=5`;
        const res = await fetch(url, { 
          headers: { 'Accept-Language': 'en-US' }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const suggestions = data.map(item => ({
              label: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }));
            setAddressSuggestions(suggestions);
            setShowSuggestions(true);
          }
        }
      } catch (e) {
        // ignore autocomplete errors
      }
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setForm({ ...form, address: suggestion.label, lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Load pipeline properties and add to map
  const loadPipelineProperties = async () => {
    try {
      console.log('🔍 Fetching pipeline deals from database...');
      const deals = await loadPipelineDeals();
      console.log('🔍 Raw pipeline deals:', deals);
      console.log(`🔍 Found ${deals?.length || 0} total pipeline deals`);
      
      if (!deals || deals.length === 0) {
        console.warn('⚠️ No pipeline deals found in database');
        setCustomPins(prev => prev.filter(p => p.category !== 'pipeline'));
        return;
      }
      
      const dealsWithCoords = deals.filter(d => {
        const hasCoords = d.latitude && d.longitude && 
                         Number.isFinite(d.latitude) && 
                         Number.isFinite(d.longitude);
        if (!hasCoords) {
          console.warn(`⚠️ Deal missing valid coords:`, d.address, d);
        }
        return hasCoords;
      });
      console.log(`🔍 ${dealsWithCoords.length} deals have valid coordinates`);
      
      const pipelinePins = dealsWithCoords.map(d => ({
        id: `pipeline-${d.dealId}`,
        name: d.address || 'Pipeline Property',
        category: 'pipeline',
        position: [d.latitude, d.longitude],
        insight: `${d.units || '?'} units • $${(d.purchasePrice || 0).toLocaleString()}`,
        source: 'pipeline',
        dealId: d.dealId
      }));
      
      console.log('🔍 Pipeline pins created:', pipelinePins);
      
      setCustomPins(prev => {
        console.log('🔍 Current pins before adding pipeline:', prev.length, prev);
        // Remove existing pipeline pins and add new ones
        const nonPipeline = prev.filter(p => p.category !== 'pipeline');
        const newPins = [...nonPipeline, ...pipelinePins];
        console.log('🔍 New pins array after adding pipeline:', newPins.length, newPins);
        return newPins;
      });
      console.log(`✅ Loaded ${pipelinePins.length} pipeline properties to map`);
    } catch (error) {
      console.error('❌ Failed to load pipeline properties:', error);
      console.error('❌ Error details:', error.message, error.stack);
    }
  };

  // Load pipeline properties and rapid fire queue on mount
  useEffect(() => {
    console.log('🗺️ MapTab mounting - loading pipeline and rapid fire...');
    loadPipelineProperties();
    loadRapidFireQueue();
    
    // Listen for pipeline updates
    const handlePipelineUpdate = () => {
      console.log('🔄 Pipeline update event received');
      loadPipelineProperties();
    };
    window.addEventListener('pipelineDealsUpdated', handlePipelineUpdate);
    
    return () => window.removeEventListener('pipelineDealsUpdated', handlePipelineUpdate);
  }, []);

  const baseMarkers = useMemo(() => ([]), []);

  // ═══ MapLibre GL 3D Map Initialization ═══
  useEffect(() => {
    if (mapStyle !== '3d') {
      // Cleanup MapLibre when not in 3D mode
      if (maplibreMapRef.current) {
        maplibreMapRef.current.remove();
        maplibreMapRef.current = null;
      }
      maplibreMarkersRef.current.forEach(m => m.remove());
      maplibreMarkersRef.current = [];
      return;
    }

    // Wait for container to be rendered
    if (!maplibreContainerRef.current) return;
    // Don't re-initialize if already created
    if (maplibreMapRef.current) return;

    const map = new maplibregl.Map({
      container: maplibreContainerRef.current,
      style: {
        version: 8,
        sources: {
          'satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© Esri, Maxar, Earthstar Geographics'
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium',
            maxzoom: 15
          }
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 22
          }
        ],
        terrain: {
          source: 'terrain-dem',
          exaggeration: 1.5
        }
      },
      center: [-98.5795, 39.8283],
      zoom: 5,
      pitch: 50,
      bearing: -17.6,
      maxPitch: 85,
      antialias: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    maplibreMapRef.current = map;

    return () => {
      map.remove();
      maplibreMapRef.current = null;
      maplibreMarkersRef.current.forEach(m => m.remove());
      maplibreMarkersRef.current = [];
    };
  }, [mapStyle]);

  // ═══ Sync markers onto the MapLibre 3D map ═══
  useEffect(() => {
    if (mapStyle !== '3d' || !maplibreMapRef.current) return;

    // Clear existing markers
    maplibreMarkersRef.current.forEach(m => m.remove());
    maplibreMarkersRef.current = [];

    const map = maplibreMapRef.current;

    // Wait for map to be loaded
    const addMarkers = () => {
      const allPins = [
        ...baseMarkers,
        ...customPins.filter(p => {
          if (mapFilter === 'all') return true;
          if (mapFilter === 'pipeline') return p.category === 'pipeline';
          if (mapFilter === 'rapidfire') return p.category === 'rapidfire';
          if (mapFilter === 'prospects') return p.category === 'prospect';
          return true;
        })
      ];

      // Dev Pipeline markers on 3D map
      if (devPipelineEnabled) {
        filteredPipeline.forEach(proj => {
          const lat = Number(proj.latitude), lng = Number(proj.longitude);
          if (!lat || !lng) return;
          const color = devPinColor(proj.status);
          const el = document.createElement('div');
          el.style.cursor = 'pointer';
          el.style.width = '18px';
          el.style.height = '18px';
          el.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
          const popup = new maplibregl.Popup({ offset: 12, maxWidth: '380px' })
            .setHTML(`
              <div style="font-family:Inter,-apple-system,sans-serif;padding:8px;">
                <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:4px;">${proj.project_name || 'Unknown'}</div>
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${proj.address || ''}, ${proj.city || ''}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                  <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${color}22;color:${color};">${proj.status || 'Unknown'}</span>
                  ${proj.class_type ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#e0e7ff;color:#3730a3;">Class ${proj.class_type}</span>` : ''}
                  ${proj.cost_display ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534;">${proj.cost_display}</span>` : ''}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;color:#374151;">
                  ${proj.units ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">UNITS</span><br/><strong>${Number(proj.units).toLocaleString()}</strong></div>` : ''}
                  ${proj.developer && proj.developer !== 'Unknown' && proj.developer !== 'Unknown Developer' ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">DEVELOPER</span><br/>${proj.developer}</div>` : ''}
                  ${proj.permit_type ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">PERMIT</span><br/>${proj.permit_type.replace('PERMIT - ','')}</div>` : ''}
                  ${proj.occupancy_rate ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">OCCUPANCY</span><br/>${proj.occupancy_rate}%</div>` : ''}
                  ${proj.avg_rent ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">AVG RENT</span><br/>$${Number(proj.avg_rent).toLocaleString()}</div>` : ''}
                  ${proj.rent_growth ? `<div><span style="color:#9ca3af;font-weight:600;font-size:10px;">RENT GROWTH</span><br/>${proj.rent_growth}%</div>` : ''}
                </div>
                ${proj.description ? `<div style="margin-top:6px;font-size:11px;color:#6b7280;line-height:1.4;border-top:1px solid #e5e7eb;padding-top:6px;">${proj.description.substring(0, 150)}${proj.description.length > 150 ? '…' : ''}</div>` : ''}
                ${proj.source_url ? `<a href="${proj.source_url}" target="_blank" rel="noopener" style="font-size:11px;color:#3b82f6;margin-top:4px;display:block;font-weight:600;">View Source →</a>` : ''}
              </div>
            `);
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
          maplibreMarkersRef.current.push(marker);
        });
      }

      // Absorption / Market Data markers on 3D map
      if (absorptionEnabled) {
        filteredAbsorption.forEach(msa => {
          const lat = Number(msa.latitude), lng = Number(msa.longitude);
          if (!lat || !lng) return;
          const color = absorptionColor(msa.Market_Trend);
          const radius = Math.max(16, Math.min(36, Math.sqrt(Number(msa.Net_Absorption_Units_Annual) || 0) * 0.8));
          const el = document.createElement('div');
          el.style.cursor = 'pointer';
          el.style.width = `${radius}px`;
          el.style.height = `${radius}px`;
          el.innerHTML = `<div style="width:${radius}px;height:${radius}px;border-radius:50%;background:${color};opacity:0.7;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="font-size:9px;font-weight:700;color:#fff;">${msa.Absorption_Rate_Pct || ''}%</span></div>`;
          const popup = new maplibregl.Popup({ offset: 12, maxWidth: '380px' })
            .setHTML(`
              <div style="font-family:Inter,-apple-system,sans-serif;padding:10px;">
                <div style="font-weight:700;font-size:15px;color:#111827;margin-bottom:2px;">${msa.MSA}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                  <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${color}22;color:${color};">${msa.Market_Trend || 'Unknown'}</span>
                  <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#e0e7ff;color:#3730a3;">${msa.Market_Tier_Absorption || ''}</span>
                  ${msa.Concession_Prevalence ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;">Concessions: ${msa.Concession_Prevalence}</span>` : ''}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div style="background:#f0fdf4;padding:8px;border-radius:6px;text-align:center;">
                    <div style="font-size:10px;color:#6b7280;font-weight:600;">ABSORPTION</div>
                    <div style="font-size:16px;font-weight:700;color:#166534;">${Number(msa.Net_Absorption_Units_Annual || 0).toLocaleString()}</div>
                    <div style="font-size:10px;color:#6b7280;">units/yr</div>
                  </div>
                  <div style="background:#eff6ff;padding:8px;border-radius:6px;text-align:center;">
                    <div style="font-size:10px;color:#6b7280;font-weight:600;">OCCUPANCY</div>
                    <div style="font-size:16px;font-weight:700;color:#1d4ed8;">${msa.Occupancy_Rate_Pct || 0}%</div>
                    <div style="font-size:10px;color:#6b7280;">vacancy ${msa.Vacancy_Rate_Pct || 0}%</div>
                  </div>
                  <div style="background:#fefce8;padding:8px;border-radius:6px;text-align:center;">
                    <div style="font-size:10px;color:#6b7280;font-weight:600;">AVG RENT</div>
                    <div style="font-size:16px;font-weight:700;color:#92400e;">$${Number(msa.Avg_Effective_Rent_USD || 0).toLocaleString()}</div>
                    <div style="font-size:10px;color:${Number(msa.YoY_Rent_Growth_Pct) >= 0 ? '#166534' : '#dc2626'};">${msa.YoY_Rent_Growth_Pct || 0}% YoY</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;color:#374151;padding-top:6px;border-top:1px solid #e5e7eb;">
                  <div><span style="color:#9ca3af;font-weight:600;font-size:10px;">ABSORPTION RATE</span><br/><strong>${msa.Absorption_Rate_Pct || 0}%</strong></div>
                  <div><span style="color:#9ca3af;font-weight:600;font-size:10px;">UNDER CONSTRUCTION</span><br/><strong>${Number(msa.Total_Units_Under_Construction || 0).toLocaleString()}</strong> units</div>
                  <div><span style="color:#9ca3af;font-weight:600;font-size:10px;">DELIVERED 2024</span><br/><strong>${Number(msa.Units_Delivered_2024 || 0).toLocaleString()}</strong></div>
                  <div><span style="color:#9ca3af;font-weight:600;font-size:10px;">DELIVERED 2025</span><br/><strong>${Number(msa.Units_Delivered_2025 || 0).toLocaleString()}</strong></div>
                </div>
                ${msa.Market_Commentary ? `<div style="margin-top:8px;font-size:11px;color:#6b7280;line-height:1.5;border-top:1px solid #e5e7eb;padding-top:6px;">${msa.Market_Commentary.substring(0, 200)}${msa.Market_Commentary.length > 200 ? '…' : ''}</div>` : ''}
                ${msa.Absorption_Data_Source ? `<div style="margin-top:4px;font-size:10px;color:#9ca3af;">Source: ${msa.Absorption_Data_Source}</div>` : ''}
              </div>
            `);
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
          maplibreMarkersRef.current.push(marker);
        });
      }

      allPins.forEach(pin => {
        let color = '#ef4444';
        if (pin.category === 'pipeline') color = '#22c55e';
        else if (pin.source === 'uploaded') color = '#3b82f6';
        else if (pin.category === 'prospect') color = '#8b5cf6';

        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.style.width = '32px';
        el.style.height = '42px';
        el.innerHTML = `
          <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C9.4 0 4 5.4 4 12c0 8 12 30 12 30s12-22 12-30c0-6.6-5.4-12-12-12z" 
                  fill="${color}" stroke="#fff" stroke-width="2"/>
            <circle cx="16" cy="12" r="6" fill="#fff" opacity="0.9"/>
          </svg>
        `;

        const categoryLabel = pin.category === 'pipeline' ? '📋 Pipeline' :
          pin.source === 'uploaded' ? '📊 Uploaded' :
          pin.category === 'rapidfire' ? '🔥 Rapid Fire' : '🏘️ Prospect';

        const badgeBg = pin.category === 'pipeline' ? '#d1fae5' :
          pin.source === 'uploaded' ? '#dbeafe' :
          pin.category === 'rapidfire' ? '#fecaca' : '#faf5ff';

        const badgeColor = pin.category === 'pipeline' ? '#065f46' :
          pin.source === 'uploaded' ? '#1e40af' :
          pin.category === 'rapidfire' ? '#991b1b' : '#5b21b6';

        const popup = new maplibregl.Popup({ offset: 25, maxWidth: '300px' })
          .setHTML(`
            <div style="font-family: Inter, -apple-system, sans-serif; padding: 8px;">
              <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 6px;">
                ${pin.name || 'Property'}
              </div>
              ${pin.insight ? `<div style="font-size: 12px; color: #374151; padding: 8px; background: #f3f4f6; border-radius: 6px; margin-bottom: 6px;">${pin.insight}</div>` : ''}
              <div style="display: inline-flex; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: ${badgeBg}; color: ${badgeColor};">
                ${categoryLabel}
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pin.position[1], pin.position[0]])
          .setPopup(popup)
          .addTo(map);

        maplibreMarkersRef.current.push(marker);
      });
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.on('load', addMarkers);
    }
  }, [mapStyle, customPins, baseMarkers, mapFilter, devPipelineEnabled, filteredPipeline, absorptionEnabled, filteredAbsorption]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitProperty = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    const address = (form.address || '').trim();
    const units = form.units ? parseInt(form.units, 10) : null;
    if (!name && !address) return;
    
    // Use autocomplete coordinates if available, otherwise geocode
    let latlng = null;
    if (form.lat && form.lng) {
      latlng = { lat: form.lat, lng: form.lng };
    } else if (address) {
      const geocodeAddress = (addr) => new Promise((resolve) => enqueueGeocode(addr, resolve));
      latlng = await geocodeAddress(address);
    }
    
    if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) {
      try {
        const { data: insertedPin, error } = await supabase
          .from('map_prospects')
          .insert({ name: name || address, address, units: units || null, lat: latlng.lat, lng: latlng.lng, source: 'manual', user_id: userId })
          .select('id')
          .single();
        
        const newPin = {
          id: `custom-${Date.now()}`,
          name: name || address,
          category: 'rapidfire',
          position: [latlng.lat, latlng.lng],
          insight: units != null ? `${units} units` : (form.notes || 'Manual research note'),
          dbId: insertedPin?.id,
          source: 'manual'
        };
        setCustomPins((prev) => [...prev, newPin]);
        setForm({ name: '', address: '', units: '', notes: '' });
        console.log('✅ Manual property added to map:', newPin);
      } catch (error) {
        console.error('Failed to save manual property:', error);
      }
    }
  };

  // Map tile layer configurations (all free, no API key needed)
  const tileConfigs = {
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap, &copy; CartoDB'
    },
    modern: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, HERE, Garmin, USGS'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar, Earthstar Geographics'
    },
    streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    }
  };

  const tileUrl = (tileConfigs[mapStyle] || tileConfigs['streets']).url;
  const attribution = (tileConfigs[mapStyle] || tileConfigs['streets']).attribution;

  // Marker styles by category
  const categoryIcon = (cat, source) => {
    let color, label;
    
    if (source === 'uploaded' || cat === 'uploaded') {
      color = '#3b82f6'; // Blue for uploaded properties
      label = '📊';
    } else if (cat === 'pipeline') {
      color = '#22c55e'; // Green
      label = '📋';
    } else if (cat === 'rapidfire') {
      color = '#ef4444'; // Red
      label = '🔥';
    } else if (cat === 'prospect') {
      color = '#ef4444'; // Red
      label = '🏠';
    } else {
      color = '#ef4444'; // Red default
      label = '📍';
    }
    
    return createPinIcon(color, label);
  };

  // Command executor inside the map
  function CommandExecutor({ commands, onDone, addPin }) {
    const map = useMap();
    useEffect(() => {
      if (!commands || commands.length === 0) return;
      commands.forEach(cmd => {
        const { type, payload = {} } = cmd || {};
        try {
          if (type === 'panTo' && Array.isArray(payload.center)) {
            const [lat, lng] = payload.center;
            const zoom = payload.zoom || map.getZoom();
            map.setView([lat, lng], zoom);
          } else if (type === 'setZoom' && typeof payload.zoom === 'number') {
            map.setZoom(payload.zoom);
          } else if (type === 'addPin') {
            const { name, lat, lng, notes } = payload;
            if (Number.isFinite(lat) && Number.isFinite(lng) && name) {
              // Save to Supabase first
              supabase.from('map_prospects')
                .insert({ name, address: null, units: null, lat, lng, source: 'llm', user_id: userId })
                .select('id')
                .single()
                .then(({ data }) => {
                  const newPin = { 
                    id: `cmd-${Date.now()}`, 
                    name, 
                    category: 'custom', 
                    position: [lat, lng], 
                    insight: notes || 'From MAX',
                    dbId: data?.id
                  };
                  addPin(newPin);
                })
                .catch(() => {});
            }
          } else if (type === 'removePin' && payload.id) {
            // Removal handled by parent via a callback if needed
          }
        } catch (e) {
          // Ignore malformed command
        }
      });
      onDone && onDone();
    }, [commands, map, onDone, addPin]);
    return null;
  }

  // Extract commands JSON from assistant text
  const extractCommands = (text) => {
    if (!text) return [];
    // Look for a JSON block containing "commands": [...]
    const jsonMatch = text.match(/\{[\s\S]*"commands"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        const arr = Array.isArray(obj.commands) ? obj.commands : [];
        return arr;
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  // Remove the commands JSON (and MAP COMMANDS section) from visible text
  const stripCommandsFromText = (text) => {
    if (!text) return '';
    let cleaned = text;
    const jsonIndex = cleaned.search(/\{[\s\S]*"commands"[\s\S]*\}/);
    if (jsonIndex >= 0) {
      cleaned = cleaned.slice(0, jsonIndex).trimEnd();
    }
    cleaned = cleaned.replace(/\n+MAP COMMANDS[\s\S]*$/i, '').trim();
    return cleaned;
  };

  // Render assistant content with simple markdown-ish formatting and collapse
  const FormattedMessage = ({ text }) => {
    const [expanded, setExpanded] = useState(false);

    const linkify = (str) => {
      const urlRegex = /(https?:\/\/[^\s)]+)|((www)\.[^\s)]+)/gi;
      const parts = [];
      let lastIndex = 0;
      let match;
      while ((match = urlRegex.exec(str)) !== null) {
        if (match.index > lastIndex) parts.push(str.slice(lastIndex, match.index));
        const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
        parts.push(
          <a key={`${match.index}-${url}`} href={url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{match[0]}</a>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < str.length) parts.push(str.slice(lastIndex));
      return parts;
    };

    const cleaned = stripCommandsFromText(text || '');
    const long = cleaned.length > 1000;

    // Very small markdown-ish parser
    const lines = cleaned.split(/\r?\n/);
    const blocks = [];
    let i = 0;
    let inCode = false;
    let codeLines = [];
    const pushParagraph = (buf) => {
      if (!buf.length) return;
      const para = buf.join(' ').trim();
      if (para) blocks.push({ type: 'p', content: para });
    };
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('```')) {
        if (!inCode) {
          inCode = true; codeLines = []; i++; continue;
        } else {
          blocks.push({ type: 'code', content: codeLines.join('\n') });
          inCode = false; codeLines = []; i++; continue;
        }
      }
      if (inCode) { codeLines.push(line); i++; continue; }

      const h3 = line.match(/^###\s+(.+)/);
      if (h3) { blocks.push({ type: 'h3', content: h3[1].trim() }); i++; continue; }
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) { blocks.push({ type: 'h2', content: h2[1].trim() }); i++; continue; }

      // Unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i++;
        }
        blocks.push({ type: 'ul', items });
        continue;
      }
      // Ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i++;
        }
        blocks.push({ type: 'ol', items });
        continue;
      }

      // Paragraph or blank
      if (line.trim() === '') {
        blocks.push({ type: 'br' });
        i++;
      } else {
        // gather consecutive non-special lines into one paragraph
        const buf = [line.trim()];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^###\s+/.test(lines[i]) &&
          !/^##\s+/.test(lines[i]) &&
          !/^\s*[-*]\s+/.test(lines[i]) &&
          !/^\s*\d+\.\s+/.test(lines[i]) &&
          !lines[i].trim().startsWith('```')
        ) {
          buf.push(lines[i].trim());
          i++;
        }
        pushParagraph(buf);
      }
    }

    const visibleBlocks = !long || expanded ? blocks : blocks.slice(0, 10); // first ~10 blocks when collapsed

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleBlocks.map((b, idx) => {
          if (b.type === 'h2') {
            return <div key={idx} style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: '#111827' }}>{b.content}</div>;
          }
          if (b.type === 'h3') {
            return <div key={idx} style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: '#111827' }}>{b.content}</div>;
          }
          if (b.type === 'ul') {
            return (
              <ul key={idx} style={{ margin: '4px 0 4px 18px', padding: 0 }}>
                {b.items.map((it, i2) => <li key={i2} style={{ marginBottom: 2 }}>{linkify(it)}</li>)}
              </ul>
            );
          }
          if (b.type === 'ol') {
            return (
              <ol key={idx} style={{ margin: '4px 0 4px 18px', padding: 0 }}>
                {b.items.map((it, i2) => <li key={i2} style={{ marginBottom: 2 }}>{linkify(it)}</li>)}
              </ol>
            );
          }
          if (b.type === 'code') {
            return (
              <pre key={idx} style={{ background: '#111827', color: '#e5e7eb', padding: 8, borderRadius: 6, overflowX: 'auto', fontSize: 12 }}>
                <code>{b.content}</code>
              </pre>
            );
          }
          if (b.type === 'br') {
            return <div key={idx} style={{ height: 6 }} />;
          }
          return <div key={idx} style={{ color: '#111827' }}>{linkify(b.content)}</div>;
        })}
        {long && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              marginTop: 6,
              alignSelf: 'flex-start',
              background: 'transparent',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              padding: 0,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  };

  const addPinFromCommand = (pin) => {
    setCustomPins(prev => [...prev, pin]);
  };

  // Delete pin from map and database
  const deletePin = async (pinId, dbId) => {
    // Remove from UI
    setCustomPins(prev => prev.filter(p => p.id !== pinId));
    
    // Delete from database if it has a dbId
    if (dbId) {
      try {
        await supabase.from('map_prospects').delete().eq('id', dbId);
        console.log(`🗑️ Deleted pin from database: ${dbId}`);
      } catch (error) {
        console.error('Failed to delete pin from database:', error);
      }
    }
  };

  // Heuristic parser for spreadsheet rows -> address + units
  const buildAddressFromRow = (row) => {
    const keys = Object.keys(row);
    const get = (predicates) => {
      const key = keys.find(k => predicates.some(p => k.toLowerCase().includes(p)));
      return key ? (row[key] ?? '') : '';
    };
    const address = get(['address', 'street', 'st', 'rd', 'ave']);
    const city = get(['city']);
    let state = get(['state']);
    const zip = get(['zip', 'zipcode', 'postal']);
    // Normalize state (extract 2-letter code if embedded)
    if (state && state.length > 2) {
      const match = state.match(/[A-Z]{2}/);
      state = match ? match[0] : state;
    }
    const parts = [address, city, state, zip].filter(Boolean);
    return parts.join(', ');
  };

  const extractUnitsFromRow = (row) => {
    const keys = Object.keys(row);
    const key = keys.find(k => ['units', 'unit_count', 'total_units', '# units', 'unit'].some(p => k.toLowerCase().includes(p)));
    const val = key ? row[key] : null;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : null;
  };

  // Nominatim geocoding with simple throttle
  const geocodeQueue = [];
  let geocodeRunning = false;
  const runGeocodeQueue = () => {
    if (geocodeRunning) return;
    geocodeRunning = true;
    const step = async () => {
      const job = geocodeQueue.shift();
      if (!job) { 
        geocodeRunning = false; 
        return; 
      }
      const { address, onResult } = job;
      let resultCalled = false;
      const safeOnResult = (result) => {
        if (resultCalled) {
          console.warn('⚠️ Geocode callback already called for:', address);
          return;
        }
        resultCalled = true;
        onResult(result);
      };
      
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en-US' } });
        
        if (!res.ok) {
          console.error(`❌ Geocode API error ${res.status} for:`, address);
          safeOnResult(null);
          setTimeout(step, 1100);
          return;
        }
        
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const best = data[0];
          const lat = parseFloat(best.lat);
          const lng = parseFloat(best.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            safeOnResult({ lat, lng });
          } else {
            console.error('❌ Invalid coordinates for:', address, best);
            safeOnResult(null);
          }
        } else {
          console.warn('⚠️ No results for:', address);
          safeOnResult(null);
        }
      } catch (e) {
        console.error('❌ Geocode exception for:', address, e.message);
        safeOnResult(null);
      }
      setTimeout(step, 1100); // ~1 req/sec
    };
    step();
  };

  const enqueueGeocode = (address, onResult) => {
    return new Promise((resolve) => {
      geocodeQueue.push({ 
        address, 
        onResult: (result) => {
          onResult(result);
          resolve(result);
        }
      });
      runGeocodeQueue();
    });
  };

  // Load Rapid Fire queue deals from Supabase (pipeline_status = 'rapidfire')
  const loadRapidFireQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('deal_id,address,units,parsed_data,created_at')
        .eq('pipeline_status', 'rapidfire')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) return;
      const items = (data || []).map(d => ({
        id: d.deal_id,
        name: (d.parsed_data?.rapidfire?.name) || d.address || 'Rapid Fire Deal',
        address: d.address || d.parsed_data?.rapidfire?.name || '',
        units: d.units || d.parsed_data?.rapidfire?.units || null
      }));
      setRapidFireQueue(items);
    } catch (e) {
      // ignore
    }
  };

  // Add all Rapid Fire queue items to map (geocode each)
  const addAllRapidFireToMap = async () => {
    if (!rapidFireQueue.length) {
      setProcessingStatus('No items in queue to add.');
      return;
    }
    
    setProcessingStatus(`Processing ${rapidFireQueue.length} properties...`);
    console.log('🗺️ Starting to add all Rapid Fire items to map:', rapidFireQueue.length);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const failedAddresses = [];
    
    // eslint-disable-next-line no-restricted-syntax
    for (const item of rapidFireQueue) {
      const addr = item.address;
      
      if (!addr || !addr.trim()) {
        console.warn(`⚠️ [${processed + 1}/${rapidFireQueue.length}] Skipping - no address:`, item.name);
        processed++;
        failed++;
        failedAddresses.push({ name: item.name, reason: 'No address' });
        continue;
      }
      
      const itemIndex = processed + 1;
      // eslint-disable-next-line no-loop-func
      enqueueGeocode(addr, async (latlng) => {
        processed++;
        if (latlng) {
          succeeded++;
          console.log(`✅ [${itemIndex}/${rapidFireQueue.length}] Geocoded:`, item.name, `(${latlng.lat}, ${latlng.lng})`);
          
          try {
            // Save to Supabase first to get ID
            const { data: insertedPin, error: insertError } = await supabase
              .from('map_prospects')
              .insert({ 
                name: item.name, 
                address: addr, 
                units: item.units || null, 
                lat: latlng.lat, 
                lng: latlng.lng, 
                source: 'rapid_fire',
                user_id: userId
              })
              .select('id')
              .single();
            
            const pin = { 
              id: `rf-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, 
              name: item.name, 
              category: 'rapidfire', 
              position: [latlng.lat, latlng.lng], 
              insight: item.units != null ? `${item.units} units` : 'Rapid Fire',
              source: 'rapid_fire',
              dbId: insertedPin?.id
            };
            setCustomPins(prev => [...prev, pin]);
            
            if (insertError) {
              console.error('⚠️ Supabase insert failed for:', item.name, insertError.message);
            }
          } catch (err) {
            console.error('❌ Error creating pin for:', item.name, err);
            failed++;
            succeeded--;
            failedAddresses.push({ name: item.name, reason: err.message });
          }
          
          setProcessingStatus(`✅ Added ${succeeded} of ${rapidFireQueue.length} (${failed} failed)`);
        } else {
          failed++;
          failedAddresses.push({ name: item.name, address: addr, reason: 'Geocoding failed' });
          console.error(`❌ [${itemIndex}/${rapidFireQueue.length}] Failed to geocode:`, item.name, addr);
          setProcessingStatus(`⚠️ Added ${succeeded} of ${rapidFireQueue.length} (${failed} failed)`);
        }
        
        // Log summary when complete
        if (processed === rapidFireQueue.length) {
          console.log(`\n📊 GEOCODING COMPLETE:`);
          console.log(`   ✅ Succeeded: ${succeeded}`);
          console.log(`   ❌ Failed: ${failed}`);
          if (failedAddresses.length > 0) {
            console.log(`\n❌ Failed properties:`);
            failedAddresses.forEach((item, idx) => {
              console.log(`   ${idx + 1}. ${item.name} - ${item.reason}${item.address ? ` (${item.address})` : ''}`);
            });
          }
        }
      });
    }
    
    setProcessingStatus(`⏳ Queued ${rapidFireQueue.length} properties. Geocoding at ~1/sec...`);
  };

  // Upload Prospects: parse file and add pins
  const [, setUploadState] = useState({ parsing: false, rows: 0, geocoded: 0, errors: 0 });
  const handleProspectsFile = async (file) => {
    if (!file) return;
    setUploadState({ parsing: true, rows: 0, geocoded: 0, errors: 0 });
    const pushProspect = async (name, address, units, latlng) => {
      // Save to Supabase first to get ID
      try {
        const { data: insertedPin, error } = await supabase
          .from('map_prospects')
          .insert({ name: name || address, address, units: units || null, lat: latlng.lat, lng: latlng.lng, source: 'upload', user_id: userId })
          .select('id')
          .single();
        
        const pin = { 
          id: `pros-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, 
          name: name || address, 
          category: 'prospect', 
          position: [latlng.lat, latlng.lng], 
          insight: units != null ? `${units} units` : 'Prospect', 
          source: 'prospect_upload',
          dbId: insertedPin?.id
        };
        setCustomPins(prev => [...prev, pin]);
      } catch (error) {
        console.error('Failed to save prospect to database:', error);
      }
    };

    const processRows = (rows) => {
      setUploadState(s => ({ ...s, parsing: false, rows: rows.length }));
      rows.forEach(row => {
        const address = buildAddressFromRow(row);
        const units = extractUnitsFromRow(row);
        const nameKey = Object.keys(row).find(k => ['name', 'property', 'address'].some(p => k.toLowerCase().includes(p)));
        const name = nameKey ? row[nameKey] : null;
        if (!address) {
          setUploadState(s => ({ ...s, errors: s.errors + 1 }));
          return;
        }
        enqueueGeocode(address, (latlng) => {
          if (latlng) {
            setUploadState(s => ({ ...s, geocoded: s.geocoded + 1 }));
            pushProspect(name, address, units, latlng);
          } else {
            setUploadState(s => ({ ...s, errors: s.errors + 1 }));
          }
        });
      });
    };

    const isCsv = (file.name || '').toLowerCase().endsWith('.csv') || (file.type || '').toLowerCase().includes('csv');
    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data)
      });
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      processRows(rows);
    }
  };

  // Load saved prospects from Supabase (includes rapid fire pins)
  const loadSavedProspects = async () => {
    try {
      console.log('🔍 Fetching saved prospects from map_prospects table...');
      const { data, error } = await supabase
        .from('map_prospects')
        .select('id,name,address,units,lat,lng,source')
        .order('created_at', { ascending: false })
        .limit(500);
      
      console.log('🔍 Supabase query result:', { data, error });
      console.log(`🔍 Found ${data?.length || 0} rows in map_prospects`);
      
      if (!error && Array.isArray(data)) {
        const validPins = data.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
        console.log(`🔍 ${validPins.length} have valid coordinates`);
        
        const pins = validPins.map(r => ({ 
          id: `saved-${r.id}`, 
          name: r.name || r.address || 'Saved Property', 
          category: 'rapidfire', 
          position: [r.lat, r.lng], 
          insight: r.units != null ? `${r.units} units` : (r.source || 'Saved Property'), 
          dbId: r.id,
          source: 'saved'
        }));
        
        console.log('🔍 Saved prospect pins created:', pins);
        
        setCustomPins(prev => {
          console.log('🔍 Current pins before adding saved:', prev);
          // Remove old saved pins, keep pipeline pins, add new saved pins
          const nonSaved = prev.filter(p => p.source !== 'saved');
          const newPins = [...nonSaved, ...pins];
          console.log('🔍 New pins array after adding saved:', newPins);
          return newPins;
        });
        console.log(`✅ Loaded ${pins.length} saved properties from database`);
      } else if (error) {
        console.error('❌ Supabase error loading prospects:', error);
      }
    } catch (e) {
      console.error('❌ Failed to load saved prospects:', e);
    }
  };

  // Auto-load saved prospects on mount
  useEffect(() => {
    console.log('🗺️ MapTab mounting - loading saved prospects...');
    loadSavedProspects();
  }, []);

  // NEW: Handle uploaded property sheet file
  const handleUploadedSheetFile = async (file) => {
    if (!file) return;
    
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    let rows = [];

    try {
      if (isCsv) {
        await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              rows = results.data;
              resolve();
            },
            error: reject
          });
        });
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      }

      // Limit to 2000 properties
      if (rows.length > 2000) {
        alert(`File contains ${rows.length} properties. Only the first 2000 will be processed.`);
        rows = rows.slice(0, 2000);
      }

      if (rows.length === 0) {
        alert('No data found in file');
        return;
      }

      // Prepare sheet preview
      const sheetData = {
        id: `sheet-${Date.now()}`,
        name: file.name,
        properties: rows.map((row, idx) => ({
          rowIndex: idx,
          originalData: row,
          address: buildAddressFromRow(row),
          geocodeStatus: 'pending' // 'pending' | 'success' | 'failed'
        }))
      };

      setSheetPreview(sheetData);
      setSelectedProperties(rows.map((_, idx) => idx)); // Select all by default
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please check the format.');
    }
  };

  // NEW: Batch geocode properties from preview
  const geocodeSheetProperties = async () => {
    if (!sheetPreview) return;

    // Filter to only selected properties
    const selectedProps = sheetPreview.properties.filter((_, idx) => selectedProperties.includes(idx));

    setIsGeocoding(true);
    setGeocodingProgress({ current: 0, total: selectedProps.length, failed: [] });

    const results = [];
    const failed = [];

    for (let i = 0; i < selectedProps.length; i++) {
      const prop = selectedProps[i];
      const propIndex = prop.rowIndex;
      
      setGeocodingProgress(prev => ({ ...prev, current: i + 1 }));

      if (!prop.address) {
        failed.push({ ...prop, reason: 'No address found' });
        // Update status to failed in preview
        setSheetPreview(prev => ({
          ...prev,
          properties: prev.properties.map((p, idx) => 
            idx === propIndex ? { ...p, geocodeStatus: 'failed' } : p
          )
        }));
        continue;
      }

      try {
        // Use Nominatim for geocoding (same as existing code)
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(prop.address)}&addressdetails=1&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'DealSniper/1.0' }
        });
        const data = await res.json();

        if (data && data.length > 0) {
          const successProp = {
            ...prop,
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            geocodeStatus: 'success'
          };
          results.push(successProp);
          
          // Update status to success in preview (live update)
          setSheetPreview(prev => ({
            ...prev,
            properties: prev.properties.map((p, idx) => 
              idx === propIndex 
                ? { ...p, geocodeStatus: 'success', latitude: successProp.latitude, longitude: successProp.longitude }
                : p
            )
          }));
        } else {
          failed.push({ ...prop, reason: 'Address not found' });
          // Update status to failed in preview
          setSheetPreview(prev => ({
            ...prev,
            properties: prev.properties.map((p, idx) => 
              idx === propIndex 
                ? { ...p, geocodeStatus: 'failed', latitude: undefined, longitude: undefined }
                : p
            )
          }));
        }

        // Rate limit: ~1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Geocoding failed for ${prop.address}:`, error);
        failed.push({ ...prop, reason: error.message });
        // Update status to failed in preview
        setSheetPreview(prev => ({
          ...prev,
          properties: prev.properties.map((p, idx) => 
            idx === propIndex 
              ? { ...p, geocodeStatus: 'failed', latitude: undefined, longitude: undefined }
              : p
          )
        }));
      }
    }

    setIsGeocoding(false);
    setGeocodingProgress(prev => ({ ...prev, failed }));

    if (failed.length > 0) {
      setShowGeocodeErrors(true);
      return { results, failed };
    }

    // All geocoded successfully
    return { results, failed: [] };
  };

  // NEW: Save geocoded properties to Supabase and show on map
  const saveUploadedProperties = async (properties) => {
    if (!userId) {
      alert('You must be logged in to save properties');
      return;
    }

    try {
      // Insert into uploaded_properties table
      const records = properties.map(prop => ({
        user_id: userId,
        upload_name: sheetPreview.name,
        property_name: prop.originalData.Name || prop.originalData.name || null,
        address: prop.address,
        latitude: prop.latitude,
        longitude: prop.longitude,
        property_data: prop.originalData,
        geocode_status: 'success'
      }));

      const { data, error } = await supabase
        .from('uploaded_properties')
        .insert(records)
        .select();

      if (error) throw error;

      // Add blue pins to map
      const newPins = data.map(record => ({
        id: `upload-${record.id}`,
        name: record.property_name || record.address,
        category: 'uploaded',
        position: [record.latitude, record.longitude],
        insight: 'Uploaded Property',
        source: 'uploaded',
        dbId: record.id,
        propertyData: record.property_data
      }));

      setCustomPins(prev => [...prev, ...newPins]);
      setUploadedSheets(prev => [...prev, { ...sheetPreview, properties: data }]);
      
      setShowPreviewModal(false);
      setSheetPreview(null);
      
      alert(`Successfully added ${newPins.length} properties to the map!`);
    } catch (error) {
      console.error('Error saving properties:', error);
      alert('Failed to save properties. Please try again.');
    }
  };

  // NEW: Handle geocode with errors prompt
  const handleProceedWithErrors = async (proceed) => {
    setShowGeocodeErrors(false);
    
    if (!proceed) {
      // User cancelled
      setIsGeocoding(false);
      return;
    }

    // Get successful results from geocoding progress
    const successful = sheetPreview.properties.filter(p => 
      p.geocodeStatus === 'success' && 
      p.latitude && p.longitude
    );

    if (successful.length === 0) {
      alert('No properties could be geocoded successfully.');
      return;
    }

    await saveUploadedProperties(successful);
  };

  // NEW: Load uploaded properties from Supabase on mount
  useEffect(() => {
    const loadUploadedProperties = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('uploaded_properties')
          .select('*')
          .eq('user_id', userId)
          .eq('geocode_status', 'success')
          .limit(2000);

        if (error) throw error;

        if (data && data.length > 0) {
          const pins = data.map(record => ({
            id: `upload-${record.id}`,
            name: record.property_name || record.address,
            category: 'uploaded',
            position: [record.latitude, record.longitude],
            insight: 'Uploaded Property',
            source: 'uploaded',
            dbId: record.id,
            propertyData: record.property_data
          }));

          setCustomPins(prev => {
            const nonUploaded = prev.filter(p => p.source !== 'uploaded');
            return [...nonUploaded, ...pins];
          });

          console.log(`✅ Loaded ${pins.length} uploaded properties`);
        }
      } catch (error) {
        console.error('Error loading uploaded properties:', error);
      }
    };

    if (userId) {
      loadUploadedProperties();
    }
  }, [userId]);

  return (
    <div style={{ 
      display: 'flex',
      height: '100%',
      backgroundColor: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Main Map Area - Left Side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
        
        {/* Secondary Row - Tab Buttons */}
        <div style={{ 
          display: 'flex',
          gap: '4px',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0
        }}>
          <button
            onClick={() => setActiveTab('add')}
            style={{
              padding: '12px 16px',
              backgroundColor: activeTab === 'add' ? 'white' : 'transparent',
              color: activeTab === 'add' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'add' ? '2px solid #3b82f6' : '2px solid transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'add' ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <MapPin size={16} color={activeTab === 'add' ? '#000000' : '#6b7280'} />
            Add Property
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '12px 16px',
              backgroundColor: activeTab === 'upload' ? 'white' : 'transparent',
              color: activeTab === 'upload' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'upload' ? '2px solid #3b82f6' : '2px solid transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'upload' ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Building2 size={16} color={activeTab === 'upload' ? '#000000' : '#6b7280'} />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            style={{
              padding: '12px 16px',
              backgroundColor: activeTab === 'tools' ? 'white' : 'transparent',
              color: activeTab === 'tools' ? '#111827' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'tools' ? '2px solid #3b82f6' : '2px solid transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'tools' ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Cog size={16} color={activeTab === 'tools' ? '#000000' : '#6b7280'} />
            Tools
          </button>
        </div>

        {/* Tab Content Area — scrollable, capped height so map dominates */}
        <div style={{ 
          padding: '8px 12px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          overflowY: 'auto',
          maxHeight: '180px',
          flexShrink: 0,
        }}>
          {activeTab === 'add' && (
            <form onSubmit={handleSubmitProperty} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white'
                }}
                placeholder="Property Name" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
              />
              <div style={{ position: 'relative' }}>
                <input 
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white'
                  }}
                  placeholder="Street Address, City, ST ZIP" 
                  value={form.address} 
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  type="text"
                  name="address"
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    {addressSuggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectSuggestion(suggestion)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                      >
                        {suggestion.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white'
                  }}
                  placeholder="Units (optional)" 
                  value={form.units} 
                  onChange={(e) => setForm({ ...form, units: e.target.value })} 
                />
                <button 
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Add Pin
                </button>
              </div>
            </form>
          )}

          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    borderRadius: '999px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
                  }}>
                    <Building2 size={18} color="#0f172a" />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.6px' }}>Destination</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>Map Pins</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '4px' }}>▾</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    borderRadius: '999px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
                  }}>
                    <Calendar size={18} color="#0f172a" />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.6px' }}>Batch Window</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>This Week</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '4px' }}>▾</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadRapidFireQueue}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '999px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 18px 35px rgba(15, 23, 42, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} />
                  Refresh Queue
                </button>
              </div>

              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                border: '1px solid #e0e7ff',
                boxShadow: '0 35px 80px -45px rgba(15, 23, 42, 0.65)',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                      Upload Directory
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Centralize property spreadsheets and rapid fire batches.
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Live
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '11px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '14px 24px' }}>Upload Type</th>
                        <th style={{ padding: '14px 24px' }}>Details</th>
                        <th style={{ padding: '14px 24px' }}>Pin Style</th>
                        <th style={{ padding: '14px 24px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: '#eef2ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileSpreadsheet size={18} color="#4c1d95" />
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Property Spreadsheet</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>CSV or XLSX • up to 2,000 rows</div>
                          </div>
                        </td>
                        <td style={{ padding: '18px 24px', color: '#0f172a', fontWeight: '500' }}>
                          Upload clean rent rolls or broker lists to add blue pins with rich property data.
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '999px',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}>Blue Pins</span>
                        </td>
                        <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '999px',
                            border: '1px solid #dbeafe',
                            backgroundColor: '#f8fbff',
                            color: '#1d4ed8',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 12px 25px rgba(59, 130, 246, 0.2)'
                          }}>
                            <UploadCloud size={16} />
                            Upload File
                            <input
                              type="file"
                              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                              onChange={(e) => handleUploadedSheetFile(e.target.files?.[0])}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                          }}>
                            🔥
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Rapid Fire Queue</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>CSV or XLSX • auto geocode</div>
                          </div>
                        </td>
                        <td style={{ padding: '18px 24px', color: '#0f172a', fontWeight: '500' }}>
                          Push prospect batches into the rapid fire workflow for fast outreach-ready pins.
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '999px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}>Red Pins</span>
                        </td>
                        <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '999px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fff7f7',
                            color: '#b91c1c',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 12px 25px rgba(239, 68, 68, 0.2)'
                          }}>
                            <UploadCloud size={16} />
                            Upload File
                            <input
                              type="file"
                              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                              onChange={(e) => handleProspectsFile(e.target.files?.[0])}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '18px 24px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Queue Health</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                      {processingStatus || 'Idle - awaiting new uploads'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      Queue: {rapidFireQueue.length} {rapidFireQueue.length === 1 ? 'property' : 'properties'} ready
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={addAllRapidFireToMap}
                      disabled={!rapidFireQueue.length}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '999px',
                        border: '1px solid #cbd5f5',
                        backgroundColor: rapidFireQueue.length ? '#eef2ff' : '#f1f5f9',
                        color: rapidFireQueue.length ? '#4338ca' : '#94a3b8',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: rapidFireQueue.length ? 'pointer' : 'not-allowed',
                        boxShadow: rapidFireQueue.length ? '0 12px 25px rgba(79, 70, 229, 0.2)' : 'none'
                      }}
                    >
                      Add All to Map
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

              {/* ─── Pin Filter Row ─── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', backgroundColor: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <Filter size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                <select value={mapFilter} onChange={(e) => setMapFilter(e.target.value)}
                  style={{
                    flex: 1, padding: '4px 8px', fontSize: '11px', fontWeight: '500',
                    border: '1px solid #e2e8f0', borderRadius: '6px',
                    backgroundColor: 'white', color: '#334155',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
                    WebkitAppearance: 'none', appearance: 'none', paddingRight: '24px',
                  }}>
                  <option value="all">All Pins</option>
                  <option value="pipeline">Developments Only</option>
                  <option value="rapidfire">Rapid Fire Only</option>
                  <option value="prospects">Prospect Cities</option>
                </select>
                <span style={{
                  fontSize: '10px', fontWeight: '700', color: '#64748b',
                  backgroundColor: '#e2e8f0', padding: '2px 7px', borderRadius: '10px', minWidth: '20px', textAlign: 'center',
                }}>
                  {customPins.filter(p => { if (mapFilter === 'all') return true; if (mapFilter === 'pipeline') return p.category === 'pipeline'; if (mapFilter === 'rapidfire') return p.category === 'rapidfire'; if (mapFilter === 'prospects') return p.category === 'prospect'; return true; }).length}
                </span>
              </div>

              {/* ─── Data Layers ─── */}
              <div style={{ padding: '6px 10px 4px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8', marginBottom: '5px' }}>Data Layers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {[
                    { label: 'Developments', active: devPipelineEnabled, color: '#f59e0b', icon: '🏗️', count: devPipelineEnabled ? filteredPipeline.length : null, toggle: () => setDevPipelineEnabled(v => !v) },
                    { label: 'Absorption', active: absorptionEnabled, color: '#059669', icon: '📊', count: absorptionEnabled ? filteredAbsorption.length : null, toggle: () => setAbsorptionEnabled(v => !v) },
                    { label: 'County', active: countyOverlay, color: '#6366f1', icon: '🗺️', toggle: () => setCountyOverlay(v => !v) },
                    { label: 'ZIP Points', active: zipOverlay, color: '#10b981', icon: '📍', toggle: () => setZipOverlay(v => !v) },
                    { label: 'ZIP Heat', active: zipHeatmap, color: '#7c3aed', icon: '🔥', toggle: () => setZipHeatmap(v => !v) },
                    { label: 'Zoning', active: zoningEnabled, color: '#3b82f6', icon: '📐', toggle: () => { setZoningEnabled(v => { if (v) { setZoningServiceKey(''); setZoningFilter(''); } return !v; }); } },
                    { label: 'Parcels', active: parcelOverlay, color: '#e11d48', icon: '📦', toggle: () => setParcelOverlay(v => !v) },
                  ].map(({ label, active, color, icon, count, toggle }) => (
                    <button key={label} onClick={toggle}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '20px',
                        border: active ? `1.5px solid ${color}` : '1.5px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '11px', fontWeight: active ? '600' : '500',
                        color: active ? color : '#64748b',
                        backgroundColor: active ? `${color}10` : 'white',
                        transition: 'all 0.15s ease',
                        lineHeight: 1,
                      }}>
                      <span style={{ fontSize: '11px' }}>{icon}</span>
                      {label}
                      {count != null && <span style={{
                        fontSize: '9px', fontWeight: '700', color: 'white',
                        backgroundColor: color, borderRadius: '8px', padding: '1px 5px', marginLeft: '1px',
                      }}>{count > 999 ? `${(count/1000).toFixed(1)}k` : count}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Active Layer Settings ─── */}
              {(countyOverlay || zipOverlay || zipHeatmap || devPipelineEnabled || absorptionEnabled || zoningEnabled) && (
                <div style={{
                  padding: '5px 10px 6px', borderTop: '1px solid #f1f5f9',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                  {devPipelineEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#f59e0b', minWidth: '36px' }}>DEV</span>
                      <select value={devPipelineFilter} onChange={(e) => setDevPipelineFilter(e.target.value)}
                        style={{
                          flex: 1, padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                          border: '1px solid #e2e8f0', borderRadius: '5px',
                          backgroundColor: 'white', color: '#334155',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}>
                        {pipelineStatuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
                      </select>
                    </div>
                  )}
                  {absorptionEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#059669', minWidth: '36px' }}>ABS</span>
                      <select value={absorptionFilter} onChange={(e) => setAbsorptionFilter(e.target.value)}
                        style={{
                          flex: 1, padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                          border: '1px solid #e2e8f0', borderRadius: '5px',
                          backgroundColor: 'white', color: '#334155',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}>
                        {absorptionTrends.map(t => <option key={t} value={t}>{t === 'all' ? 'All Trends' : t}</option>)}
                      </select>
                    </div>
                  )}
                  {countyOverlay && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#6366f1', minWidth: '36px' }}>CTY</span>
                      <select value={countyMetric} onChange={(e) => setCountyMetric(e.target.value)}
                        style={{
                          flex: 1, padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                          border: '1px solid #e2e8f0', borderRadius: '5px',
                          backgroundColor: 'white', color: '#334155',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}>
                        {COUNTY_METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  )}
                  {zipOverlay && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#10b981', minWidth: '36px' }}>ZIP</span>
                      <select value={zipMetric} onChange={(e) => setZipMetric(e.target.value)}
                        style={{
                          flex: 1, padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                          border: '1px solid #e2e8f0', borderRadius: '5px',
                          backgroundColor: 'white', color: '#334155',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}>
                        {ZIP_METRIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  )}
                  {zipHeatmap && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#7c3aed', minWidth: '36px' }}>HEAT</span>
                      <select value={zipHeatmapMetric} onChange={(e) => setZipHeatmapMetric(e.target.value)}
                        style={{
                          flex: 1, padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                          border: '1px solid #e2e8f0', borderRadius: '5px',
                          backgroundColor: 'white', color: '#334155',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}>
                        {(() => { const g = {}; ZIP_HEATMAP_METRIC_OPTIONS.forEach(o => { if (!g[o.group]) g[o.group] = []; g[o.group].push(o); }); return Object.entries(g).map(([gr, os]) => <optgroup key={gr} label={gr}>{os.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>); })()}
                      </select>
                    </div>
                  )}
                  {zoningEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#3b82f6', minWidth: '36px' }}>ZONE</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {zoningLoading ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>Loading…</span> : (
                          <select value={zoningServiceKey} onChange={(e) => { setZoningServiceKey(e.target.value); setZoningFilter(''); }}
                            style={{
                              width: '100%', padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                              border: '1px solid #e2e8f0', borderRadius: '5px',
                              backgroundColor: 'white', color: '#334155',
                              WebkitAppearance: 'none', appearance: 'none',
                            }}>
                            <option value="">Select zoning layer</option>
                            {(() => {
                              const groups = {};
                              Object.entries(zoningServices).forEach(([key, svc]) => {
                                const region = svc.region || 'SW';
                                if (!groups[region]) groups[region] = [];
                                groups[region].push({ key, label: svc.label, state: svc.state });
                              });
                              const regionNames = { SW: 'Southwest', NW: 'Northwest', SE: 'Southeast', NE: 'Northeast' };
                              const regionOrder = ['SW', 'SE', 'NW', 'NE'];
                              return regionOrder.filter(r => groups[r]).map(region => {
                                const items = groups[region];
                                const byState = {};
                                items.forEach(item => {
                                  const st = item.state || '??';
                                  if (!byState[st]) byState[st] = [];
                                  byState[st].push(item);
                                });
                                const stateLabels = { AZ: 'AZ', CA: 'CA', NC: 'NC', SC: 'SC' };
                                return (
                                  <optgroup key={region} label={`── ${regionNames[region] || region} (${items.length}) ──`}>
                                    {Object.entries(byState).sort(([a],[b]) => a.localeCompare(b)).flatMap(([st, stItems]) =>
                                      stItems.sort((a,b) => a.label.localeCompare(b.label)).map(({ key, label }) => (
                                        <option key={key} value={key}>{label}, {stateLabels[st] || st}</option>
                                      ))
                                    )}
                                  </optgroup>
                                );
                              });
                            })()}
                          </select>
                        )}
                        {zoningServiceKey && <input type="text" placeholder="Filter zone code…" value={zoningFilter} onChange={(e) => setZoningFilter(e.target.value)}
                          style={{
                            padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                            border: '1px solid #e2e8f0', borderRadius: '5px',
                            backgroundColor: 'white', color: '#334155',
                          }} />}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative', minHeight: '600px' }}>
          {/* ═══ Floating Map Style Switcher (top-right overlay) ═══ */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.6)',
          }}>
            {[
              { key: 'voyager', label: 'Base' },
              { key: 'satellite', label: 'Satellite' },
              { key: 'streets', label: 'Hybrid' },
              { key: '3d', label: '3D' },
            ].map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => setMapStyle(key)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: mapStyle === key ? 700 : 500,
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                  color: mapStyle === key ? '#fff' : '#374151',
                  background: mapStyle === key
                    ? (key === '3d' ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : '#3b82f6')
                    : 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.15s',
                  letterSpacing: key === '3d' ? 1 : 0,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* MapLibre GL 3D Map */}
          {mapStyle === '3d' && (
            <div 
              ref={maplibreContainerRef} 
              style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
            />
          )}

          {/* Leaflet 2D Map */}
          {mapStyle !== '3d' && (
          <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ width: '100%', height: '100%' }}>
            <TileLayer 
              url={tileUrl} 
              attribution={attribution} 
            />
            <CommandExecutor commands={pendingCommands} onDone={() => setPendingCommands([])} addPin={addPinFromCommand} />

            {/* Base categorized markers */}
            {baseMarkers.map((m) => (
              <Marker key={m.id} position={m.position} icon={categoryIcon(m.category)}>
                <Popup>
                  <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Influence zone radius ~2 miles</div>
                    <div style={{ borderRadius: '8px', backgroundColor: '#e0e7ff', padding: '8px', fontSize: '12px', color: '#1e293b' }}>
                      Research Insight: {m.insight}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Influence zones (2 miles ~ 3219m) */}
            {/* Custom pins from form */}
            {customPins
              .filter(p => {
                if (mapFilter === 'all') return true;
                if (mapFilter === 'pipeline') return p.category === 'pipeline';
                if (mapFilter === 'rapidfire') return p.category === 'rapidfire';
                if (mapFilter === 'prospects') return p.category === 'prospect';
                return true;
              })
              .map((p) => (
              <Marker key={p.id} position={p.position} icon={categoryIcon(p.category, p.source)}>
                <Popup maxWidth={350}>
                  <div style={{ 
                    minWidth: '280px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    {/* Header */}
                    <div style={{ 
                      borderBottom: '2px solid #e5e7eb', 
                      paddingBottom: '10px' 
                    }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '700', 
                        color: '#111827',
                        marginBottom: '6px',
                        lineHeight: '1.4'
                      }}>{p.name}</div>
                      <div style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        backgroundColor: 
                          p.source === 'uploaded' ? '#dbeafe' :
                          p.category === 'pipeline' ? '#d1fae5' :
                          p.category === 'rapidfire' ? '#fecaca' : 
                          p.category === 'prospect' ? '#ddd6fe' : 
                          '#fce7f3',
                        color:
                          p.source === 'uploaded' ? '#1e40af' :
                          p.category === 'pipeline' ? '#065f46' :
                          p.category === 'rapidfire' ? '#991b1b' : 
                          p.category === 'prospect' ? '#5b21b6' : 
                          '#831843'
                      }}>
                        {p.source === 'uploaded' ? '📊 Uploaded' :
                         p.category === 'pipeline' ? '📋 Pipeline' :
                         p.category === 'rapidfire' ? '🔥 Rapid Fire' : 
                         p.category === 'prospect' ? '🏘️ Prospect' : 
                         '📍 Custom'}
                      </div>
                    </div>

                    {/* Insight Box */}
                    {p.insight && (
                      <div style={{
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        fontWeight: '500',
                        color: '#374151',
                        background: 
                          p.source === 'uploaded' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' :
                          p.category === 'pipeline' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' :
                          p.category === 'rapidfire' ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)' : 
                          'linear-gradient(135deg, #faf5ff 0%, #e9d5ff 100%)',
                        border: '1px solid',
                        borderColor:
                          p.source === 'uploaded' ? '#bfdbfe' :
                          p.category === 'pipeline' ? '#a7f3d0' :
                          p.category === 'rapidfire' ? '#fca5a5' : 
                          '#c4b5fd'
                      }}>
                        {p.insight}
                      </div>
                    )}

                    {/* Flood Zone */}
                    <FloodZoneCard lat={p.position[0]} lng={p.position[1]} />

                    {/* Property Data Table */}
                    {p.source === 'uploaded' && p.propertyData && (
                      <div style={{
                        borderRadius: '10px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        fontSize: '12px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        border: '2px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          fontWeight: '700', 
                          marginBottom: '10px', 
                          color: '#111827',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Property Details</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(p.propertyData).map(([key, value]) => (
                            <div key={key} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}>
                              <span style={{ 
                                fontWeight: '600', 
                                color: '#6b7280',
                                fontSize: '11px'
                              }}>{key}</span>
                              <span style={{ 
                                color: '#111827',
                                fontWeight: '500',
                                textAlign: 'right',
                                maxWidth: '60%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>{value || 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(p.category === 'rapidfire' || p.category === 'prospect' || p.category === 'custom' || p.source === 'uploaded') && (
                      <button
                        onClick={() => deletePin(p.id, p.dbId)}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                          transition: 'all 0.2s',
                          marginTop: '4px'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                      >
                        🗑️ Delete Pin
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Development Pipeline markers */}
            {devPipelineEnabled && filteredPipeline.map((proj, idx) => {
              const lat = Number(proj.latitude), lng = Number(proj.longitude);
              if (!lat || !lng) return null;
              const color = devPinColor(proj.status);
              return (
                <CircleMarker
                  key={`dev-${idx}`}
                  center={[lat, lng]}
                  radius={7}
                  pathOptions={{ fillColor: color, fillOpacity: 0.85, color: '#fff', weight: 2 }}
                >
                  <Popup maxWidth={360}>
                    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', minWidth: 280, padding: 4 }}>
                      {/* Header */}
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 2 }}>
                        {proj.project_name || 'Unknown Project'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        {proj.address || ''}{proj.address && proj.city ? ', ' : ''}{proj.city || ''}{proj.state ? `, ${proj.state}` : ''}
                      </div>

                      {/* Status + Class + Permit badges */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: `${color}20`, color: color, border: `1px solid ${color}40`
                        }}>{proj.status || 'Unknown'}</span>
                        {proj.building_class && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe'
                          }}>{proj.building_class}</span>
                        )}
                        {proj.permit_type && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a'
                          }}>{proj.permit_type}</span>
                        )}
                      </div>

                      {/* Details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                        {proj.units && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>UNITS</span><br/>
                            <span style={{ fontWeight: 700, color: '#111827' }}>{Number(proj.units).toLocaleString()}</span></div>
                        )}
                        {proj.cost_display && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>EST. COST</span><br/>
                            <span style={{ fontWeight: 700, color: '#111827' }}>{proj.cost_display}</span></div>
                        )}
                        {proj.developer && proj.developer !== 'Unknown' && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>DEVELOPER</span><br/>
                            <span style={{ fontWeight: 600, color: '#374151' }}>{proj.developer}</span></div>
                        )}
                        {proj.issue_date && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>ISSUE DATE</span><br/>
                            <span style={{ color: '#374151' }}>{proj.issue_date}</span></div>
                        )}
                        {proj.occupancy && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>OCCUPANCY</span><br/>
                            <span style={{ color: '#374151' }}>{proj.occupancy}%</span></div>
                        )}
                        {proj.avg_rent && (
                          <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>AVG RENT</span><br/>
                            <span style={{ color: '#374151' }}>${Number(proj.avg_rent).toLocaleString()}</span></div>
                        )}
                      </div>

                      {/* Description */}
                      {proj.description && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.4,
                          borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>{proj.description}</div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Absorption Rate markers */}
            {absorptionEnabled && filteredAbsorption.map((msa, idx) => {
              const lat = Number(msa.latitude), lng = Number(msa.longitude);
              if (!lat || !lng) return null;
              const absUnits = Math.abs(Number(msa.Net_Absorption_Units_Annual) || 0);
              const radius = Math.max(8, Math.min(22, 8 + (absUnits / 1200)));
              const color = absorptionColor(msa.Market_Trend);
              return (
                <CircleMarker
                  key={`abs-${idx}`}
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{ fillColor: color, fillOpacity: 0.55, color: color, weight: 2, opacity: 0.8 }}
                >
                  <Popup maxWidth={380}>
                    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', minWidth: 300, padding: 4 }}>
                      {/* Header */}
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 2 }}>
                        {msa.MSA}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: `${color}20`, color: color, border: `1px solid ${color}40`
                        }}>{msa.Market_Trend || 'Unknown'}</span>
                        {msa.Market_Tier_Absorption && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe'
                          }}>{msa.Market_Tier_Absorption}</span>
                        )}
                      </div>

                      {/* 3-col metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div style={{ textAlign: 'center', padding: '6px 4px', background: '#f0fdf4', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>ABSORPTION</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{Number(msa.Net_Absorption_Units_Annual || 0).toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>units/yr</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '6px 4px', background: '#eff6ff', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>OCCUPANCY</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{msa.Occupancy_Rate_Pct || '–'}%</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>rate</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '6px 4px', background: '#fefce8', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>AVG RENT</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>${Number(msa.Avg_Effective_Rent_USD || 0).toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>effective</div>
                        </div>
                      </div>

                      {/* Detail grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
                        <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>VACANCY</span><br/>
                          <span style={{ color: '#374151' }}>{msa.Vacancy_Rate_Pct || '–'}%</span></div>
                        <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>RENT GROWTH</span><br/>
                          <span style={{ color: Number(msa.YoY_Rent_Growth_Pct) >= 0 ? '#059669' : '#dc2626' }}>{msa.YoY_Rent_Growth_Pct || '–'}%</span></div>
                        <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>UNDER CONST.</span><br/>
                          <span style={{ color: '#374151' }}>{Number(msa.Total_Units_Under_Construction || 0).toLocaleString()}</span></div>
                        <div><span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 11 }}>CONCESSIONS</span><br/>
                          <span style={{ color: '#374151' }}>{msa.Concession_Prevalence || '–'}</span></div>
                      </div>

                      {/* Commentary */}
                      {msa.Market_Commentary && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.4,
                          borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>{msa.Market_Commentary}</div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Data overlay layers (county heat map + ZIP centroids + ZIP heat map) */}
            <MapOverlayLayers
              countyEnabled={countyOverlay}
              zipEnabled={zipOverlay}
              countyMetric={countyMetric}
              zipMetric={zipMetric}
              zipHeatmapEnabled={zipHeatmap}
              zipHeatmapMetric={zipHeatmapMetric}
            />

            {/* Zoning overlay layer */}
            <ZoningOverlayLayer
              enabled={zoningEnabled && !!zoningServiceKey}
              serviceKey={zoningServiceKey}
              zoneFilter={zoningFilter}
            />

            {/* Parcel boundary overlay layer */}
            <ParcelOverlayLayer enabled={parcelOverlay} />
          </MapContainer>
          )}
        </div>

      </div>

      {/* Max AI Sidebar - Right Side */}
      <div style={{
        width: isChatMinimized ? 40 : 420,
        minWidth: isChatMinimized ? 40 : 420,
        maxWidth: isChatMinimized ? 40 : 420,
        height: '100%',
        flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease'
      }}>
        {/* AI Header */}
        <div style={{
          padding: isChatMinimized ? '8px' : '10px 14px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isChatMinimized ? 'center' : 'space-between',
          fontSize: 15,
          fontWeight: 600,
          color: '#111827'
        }}>
          {!isChatMinimized && <span>Max</span>}
          <button
            type="button"
            onClick={() => setIsChatMinimized(!isChatMinimized)}
            title={isChatMinimized ? 'Expand chat' : 'Minimize chat'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151' }}
          >
            <MessageSquare size={15} />
          </button>
        </div>

        {/* AI Body - Messages */}
        {!isChatMinimized && (
        <div style={{
          flex: 1,
          padding: '12px 14px',
          overflowY: 'auto',
          minHeight: 0
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#111827' }}>
            Ask Max about property clusters, market trends, or new investment markets.
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {chat.messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 8,
                  padding: '10px 12px',
                  borderRadius: 6,
                  backgroundColor: msg.role === 'user' ? '#e5f0ff' : '#f9fafb',
                  color: '#111827',
                  fontSize: 13,
                  lineHeight: 1.5
                }}
              >
                {msg.role === 'assistant' ? (
                  <FormattedMessage text={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {chat.loading && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: '#f9fafb',
                color: '#6b7280',
                fontSize: 13,
                fontStyle: 'italic'
              }}>
                Max is thinking...
              </div>
            )}
          </div>
        </div>
        )}

        {/* AI Input */}
        {!isChatMinimized && (
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 13,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                backgroundColor: 'white',
                outline: 'none'
              }}
              placeholder="Ask about markets, trends, or request map commands..."
              value={chat.input}
              onChange={(e) => setChat({ ...chat, input: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const trimmed = chat.input.trim();
                  if (!trimmed || chat.loading) return;
                  setChat(prev => ({ ...prev, loading: true, messages: [...prev.messages, { role: 'user', content: trimmed }], input: '' }));
                  (async () => {
                    try {
                      const system = `You are Max, an AI real estate market analyst with access to comprehensive market data. You help users analyze property clusters, identify market trends, and discover new investment markets.

CAPABILITIES:
- Analyze property patterns and clusters on the map
- Access US Census data (demographics, housing, employment)
- Access migration data, rent data (FMR, SAFMR), property tax rates
- Access Zillow home value indices and growth rates
- Access Cushman & Wakefield market reports
- Perform web searches for current market conditions
- Create map pins, pan/zoom map programmatically

AVAILABLE DATA FILES (in /build folder):
- 2025_National_Migration_Flows_With_Estimates.csv
- ACSDP5Y2023.DP03-Data.csv (Demographics & Economics)
- ACSDP5Y2023.DP04-Data.csv (Housing Characteristics)
- cushman_q32025_full_markets.csv (Commercial market data)
- fmr_by_zip_clean.csv, fy2026_safmrs_fullrange.csv (Fair Market Rents)
- landlord_friendly_scores.csv
- Property Taxes by State and County, 2025.csv
- Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Zillow Home Values)
- Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Growth Forecasts)
- zip_renter_owner_stats_with_counts.csv
- migration_with_clean_zipcodes.csv

When analyzing markets or responding to questions:
1. Reference specific data from these CSV files when relevant
2. Identify trends in property clusters the user has mapped
3. Suggest new markets based on data analysis
4. Perform web searches for current local conditions (crime, development, employers)
5. Use map commands to visualize findings

MAP COMMANDS (output JSON at end of response):
{
  "commands": [
    { "type": "panTo", "payload": { "center": [lat, lng], "zoom": 12 } },
    { "type": "addPin", "payload": { "name": "Property Name", "lat": XX.XXX, "lng": -XX.XXX, "notes": "reason" } }
  ]
}`;
                      // Include profile header for token/auth checks
                      const headers = { 'Content-Type': 'application/json' };
                      if (userId) headers['X-Profile-ID'] = userId;
                      const res = await fetch(API_ENDPOINTS.marketResearchChat, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ message: trimmed, system })
                      });
                      const isJson = res.headers.get('content-type')?.includes('application/json');
                      const data = isJson ? await res.json().catch(() => null) : null;
                      if (res.status === 401) {
                        const msg = 'Please log in to use Market Research.';
                        setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: msg }] }));
                        return;
                      }
                      if (res.status === 402) {
                        const required = data?.tokens_required ?? 1;
                        const balance = data?.token_balance ?? 0;
                        const msg = `You are out of tokens for Market Research. Required: ${required}, Available: ${balance}.`;
                        setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: msg }] }));
                        return;
                      }
                      if (!res.ok) {
                        setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: 'Error contacting Max.' }] }));
                        return;
                      }
                      const text = (data?.response || data?.message || data?.content || data?.assistant || 'No response');
                      const commands = extractCommands(text);
                      if (commands.length > 0) setPendingCommands(commands);
                      setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: text }] }));
                    } catch (err) {
                      setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: 'Error contacting Max.' }] }));
                    }
                  })();
                }
              }}
            />
            <button
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                opacity: chat.loading ? 0.6 : 1
              }}
              disabled={chat.loading}
              onClick={async () => {
                const trimmed = chat.input.trim();
                if (!trimmed || chat.loading) return;
                setChat(prev => ({ ...prev, loading: true, messages: [...prev.messages, { role: 'user', content: trimmed }], input: '' }));
                try {
                  const system = `You are Max, an AI real estate market analyst with access to comprehensive market data. You help users analyze property clusters, identify market trends, and discover new investment markets.

CAPABILITIES:
- Analyze property patterns and clusters on the map
- Access US Census data (demographics, housing, employment)
- Access migration data, rent data (FMR, SAFMR), property tax rates
- Access Zillow home value indices and growth rates
- Access Cushman & Wakefield market reports
- Perform web searches for current market conditions
- Create map pins, pan/zoom map programmatically

AVAILABLE DATA FILES (in /build folder):
- 2025_National_Migration_Flows_With_Estimates.csv
- ACSDP5Y2023.DP03-Data.csv (Demographics & Economics)
- ACSDP5Y2023.DP04-Data.csv (Housing Characteristics)
- cushman_q32025_full_markets.csv (Commercial market data)
- fmr_by_zip_clean.csv, fy2026_safmrs_fullrange.csv (Fair Market Rents)
- landlord_friendly_scores.csv
- Property Taxes by State and County, 2025.csv
- Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Zillow Home Values)
- Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv (Growth Forecasts)
- zip_renter_owner_stats_with_counts.csv
- migration_with_clean_zipcodes.csv

When analyzing markets or responding to questions:
1. Reference specific data from these CSV files when relevant
2. Identify trends in property clusters the user has mapped
3. Suggest new markets based on data analysis
4. Perform web searches for current local conditions (crime, development, employers)
5. Use map commands to visualize findings

MAP COMMANDS (output JSON at end of response):
{
  "commands": [
    { "type": "panTo", "payload": { "center": [lat, lng], "zoom": 12 } },
    { "type": "addPin", "payload": { "name": "Property Name", "lat": XX.XXX, "lng": -XX.XXX, "notes": "reason" } }
  ]
}`;
                  // Include profile header for token/auth checks
                  const headers = { 'Content-Type': 'application/json' };
                  if (userId) headers['X-Profile-ID'] = userId;
                  const res = await fetch(API_ENDPOINTS.marketResearchChat, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ message: trimmed, system })
                  });
                  const isJson = res.headers.get('content-type')?.includes('application/json');
                  const data = isJson ? await res.json().catch(() => null) : null;
                  if (res.status === 401) {
                    const msg = 'Please log in to use Market Research.';
                    setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: msg }] }));
                    return;
                  }
                  if (res.status === 402) {
                    const required = data?.tokens_required ?? 1;
                    const balance = data?.token_balance ?? 0;
                    const msg = `You are out of tokens for Market Research. Required: ${required}, Available: ${balance}.`;
                    setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: msg }] }));
                    return;
                  }
                  if (!res.ok) {
                    setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: 'Error contacting Max.' }] }));
                    return;
                  }
                  const text = (data?.response || data?.message || data?.content || data?.assistant || 'No response');
                  const commands = extractCommands(text);
                  if (commands.length > 0) setPendingCommands(commands);
                  setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: text }] }));
                } catch (err) {
                  setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: 'Error contacting Max.' }] }));
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Property Sheet Preview Modal */}
      {showPreviewModal && sheetPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '900px',
            maxHeight: '85vh',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
                  📊 {sheetPreview.name}
                </h2>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {sheetPreview.properties.length} properties found • {selectedProperties.length} selected
                </div>
              </div>
              <button
                onClick={() => { 
                  setShowPreviewModal(false); 
                  setSheetPreview(null); 
                  setSelectedProperties([]);
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#6b7280',
                  fontWeight: '600'
                }}
              >
                ×
              </button>
            </div>

            {/* Select All Button */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => {
                  if (selectedProperties.length === sheetPreview.properties.length) {
                    setSelectedProperties([]);
                  } else {
                    setSelectedProperties(sheetPreview.properties.map((_, idx) => idx));
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: selectedProperties.length === sheetPreview.properties.length ? '#ef4444' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
              >
                {selectedProperties.length === sheetPreview.properties.length ? '✓ Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Property List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              border: '2px solid #e5e7eb',
              borderRadius: '10px',
              marginBottom: '20px',
              backgroundColor: '#fafafa'
            }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedProperties.length === sheetPreview.properties.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProperties(sheetPreview.properties.map((_, idx) => idx));
                          } else {
                            setSelectedProperties([]);
                          }
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>#</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Address</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetPreview.properties.map((prop, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: selectedProperties.includes(idx) ? '#eff6ff' : 'white',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedProperties.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProperties([...selectedProperties, idx]);
                            } else {
                              setSelectedProperties(selectedProperties.filter(i => i !== idx));
                            }
                          }}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280', fontWeight: '500' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', color: '#111827', fontWeight: '500' }}>{prop.address || 'No address found'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          backgroundColor: 
                            prop.geocodeStatus === 'success' ? '#10b981' : 
                            prop.geocodeStatus === 'failed' ? '#ef4444' : 
                            '#fbbf24',
                          color: 'white',
                          boxShadow: 
                            prop.geocodeStatus === 'success' ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 
                            prop.geocodeStatus === 'failed' ? '0 2px 4px rgba(239, 68, 68, 0.3)' : 
                            '0 2px 4px rgba(251, 191, 36, 0.3)',
                          transition: 'all 0.3s ease'
                        }}>
                          {prop.geocodeStatus === 'success' ? '✓ Success' : 
                           prop.geocodeStatus === 'failed' ? '✗ Failed' : 
                           '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { 
                  setShowPreviewModal(false); 
                  setSheetPreview(null); 
                  setSelectedProperties([]);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (selectedProperties.length === 0) {
                    alert('Please select at least one property');
                    return;
                  }
                  const { results, failed } = await geocodeSheetProperties();
                  // Store results in state for potential retry
                  setGeocodingResults({ results, failed });
                  
                  // If some failed, show error modal; otherwise save immediately
                  if (failed.length > 0) {
                    // Error modal will be shown by geocodeSheetProperties setting showGeocodeErrors
                    // Do nothing here - let user decide via modal
                  } else if (results.length > 0) {
                    await saveUploadedProperties(results);
                  } else {
                    alert('No properties could be geocoded successfully.');
                  }
                }}
                disabled={isGeocoding || selectedProperties.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isGeocoding || selectedProperties.length === 0 ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isGeocoding || selectedProperties.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: isGeocoding || selectedProperties.length === 0 ? 'none' : '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                }}
              >
                {isGeocoding ? `⏳ Geocoding (${geocodingProgress.current}/${geocodingProgress.total})` : `✓ Geocode & Add to Map (${selectedProperties.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geocoding Errors Modal */}
      {showGeocodeErrors && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
              ⚠️ Unable to Geocode Some Properties
            </h3>
            
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              {geocodingProgress.failed.length} properties could not be located. 
              Successfully geocoded: {geocodingProgress.total - geocodingProgress.failed.length}
            </div>

            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#fef3c7'
            }}>
              {geocodingProgress.failed.map((prop, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                  • {prop.address} - {prop.reason}
                </div>
              ))}
            </div>

            <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827', marginBottom: '16px' }}>
              Shall I proceed with the successfully geocoded properties?
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleProceedWithErrors(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                No, Cancel
              </button>
              <button
                onClick={() => handleProceedWithErrors(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardMapTab;
