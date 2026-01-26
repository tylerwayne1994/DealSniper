import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_ENDPOINTS } from '../../config/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { loadPipelineDeals } from '../../lib/dealsService';
import {
  MessageSquare,
  MapPin,
  Star,
  Heart,
  Cog,
  CheckCircle,
  XCircle,
  Building2,
  Filter
} from 'lucide-react';

// Mapbox access token (shared with HomeMapView)
const MAPBOX_TOKEN = 'pk.eyJ1IjoidHlsZXJ3YXluZTEyIiwiYSI6ImNtanl5b3RkNTZwYnMzZ3B3eHN3eGJ4OHAifQ.Jz3DXX3FplxJPTqMQSRbCA';
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
  const [mapStyle, setMapStyle] = useState('mapbox'); // 'mapbox' | 'satellite' | 'streets' | 'dark'
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Uploaded property sheets state
  const [uploadedSheets, setUploadedSheets] = useState([]); // Array of { id, name, properties: [...] }
  const [sheetPreview, setSheetPreview] = useState(null); // Current sheet being previewed
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0, failed: [] });
  const [showGeocodeErrors, setShowGeocodeErrors] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

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

  // Map tile layer configurations
  const tileConfigs = {
    mapbox: {
      url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      attribution: '&copy; Mapbox &copy; OpenStreetMap'
    },
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap, &copy; CartoDB'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar, Earthstar Geographics'
    },
    streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap, &copy; CartoDB'
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
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please check the format.');
    }
  };

  // NEW: Batch geocode properties from preview
  const geocodeSheetProperties = async () => {
    if (!sheetPreview) return;

    setIsGeocoding(true);
    setGeocodingProgress({ current: 0, total: sheetPreview.properties.length, failed: [] });

    const results = [];
    const failed = [];

    for (let i = 0; i < sheetPreview.properties.length; i++) {
      const prop = sheetPreview.properties[i];
      setGeocodingProgress(prev => ({ ...prev, current: i + 1 }));

      if (!prop.address) {
        failed.push({ ...prop, reason: 'No address found' });
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
          results.push({
            ...prop,
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            geocodeStatus: 'success'
          });
        } else {
          failed.push({ ...prop, reason: 'Address not found' });
        }

        // Rate limit: ~1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Geocoding failed for ${prop.address}:`, error);
        failed.push({ ...prop, reason: error.message });
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
      height: 'calc(100vh - 56px)',
      backgroundColor: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Main Map Area - Left Side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Secondary Row - Tab Buttons */}
        <div style={{ 
          display: 'flex',
          gap: '4px',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          overflowX: 'auto',
          flexWrap: 'nowrap'
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

        {/* Tab Content Area */}
        <div style={{ 
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          overflowY: 'auto',
          maxHeight: '200px'
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
              {/* NEW: Property Sheet Upload */}
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#eff6ff', 
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                  📊 Upload Property Spreadsheet (CSV/XLSX)
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Upload up to 2000 properties. Blue pins will appear on the map.
                </div>
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
                  onChange={(e) => handleUploadedSheetFile(e.target.files?.[0])}
                  style={{ fontSize: '13px', padding: '4px' }}
                />
              </div>

              {/* Original Upload for Rapid Fire */}
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fef3c7', 
                borderRadius: '8px',
                border: '1px solid #fbbf24'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                  🔥 Upload to Rapid Fire Queue
                </div>
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  onChange={(e) => handleProspectsFile(e.target.files?.[0])}
                  style={{ fontSize: '13px', marginBottom: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                  onClick={loadRapidFireQueue}
                >
                  Load Rapid Fire Queue
                </button>
                <button
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    opacity: !rapidFireQueue.length ? 0.5 : 1
                  }}
                  onClick={addAllRapidFireToMap}
                  disabled={!rapidFireQueue.length}
                >
                  Add All to Map
                </button>
              </div>
              {processingStatus && (
                <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                  {processingStatus}
                </div>
              )}
              {rapidFireQueue.length > 0 && (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Queue: {rapidFireQueue.length} properties
                </div>
              )}
            </div>
          )}

          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={14} style={{ color: '#6b7280' }} />
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Show on Map:</label>
                <select 
                  value={mapFilter} 
                  onChange={(e) => setMapFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '13px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="all">All Pins</option>
                  <option value="pipeline">📋 Pipeline Only</option>
                  <option value="rapidfire">🔥 Rapid Fire Only</option>
                  <option value="prospects">🏘️ Prospect Cities Only</option>
                </select>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  ({customPins.filter(p => {
                    if (mapFilter === 'all') return true;
                    if (mapFilter === 'pipeline') return p.category === 'pipeline';
                    if (mapFilter === 'rapidfire') return p.category === 'rapidfire';
                    if (mapFilter === 'prospects') return p.category === 'prospect';
                    return true;
                  }).length} visible)
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} style={{ color: '#6b7280' }} />
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Map Style:</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setMapStyle('mapbox')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: mapStyle === 'mapbox' ? '#3b82f6' : 'white',
                      color: mapStyle === 'mapbox' ? 'white' : '#6b7280',
                      border: mapStyle === 'mapbox' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Mapbox
                  </button>
                  <button
                    onClick={() => setMapStyle('voyager')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: mapStyle === 'voyager' ? '#3b82f6' : 'white',
                      color: mapStyle === 'voyager' ? 'white' : '#6b7280',
                      border: mapStyle === 'voyager' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Clean
                  </button>
                  <button
                    onClick={() => setMapStyle('satellite')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: mapStyle === 'satellite' ? '#3b82f6' : 'white',
                      color: mapStyle === 'satellite' ? 'white' : '#6b7280',
                      border: mapStyle === 'satellite' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Satellite
                  </button>
                  <button
                    onClick={() => setMapStyle('streets')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: mapStyle === 'streets' ? '#3b82f6' : 'white',
                      color: mapStyle === 'streets' ? 'white' : '#6b7280',
                      border: mapStyle === 'streets' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Streets
                  </button>
                  <button
                    onClick={() => setMapStyle('dark')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: mapStyle === 'dark' ? '#3b82f6' : 'white',
                      color: mapStyle === 'dark' ? 'white' : '#6b7280',
                      border: mapStyle === 'dark' ? 'none' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ width: '100%', height: '100%' }}>
            <TileLayer 
              url={tileUrl} 
              attribution={attribution} 
              tileSize={mapStyle === 'mapbox' ? 512 : undefined}
              zoomOffset={mapStyle === 'mapbox' ? -1 : undefined}
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
            {baseMarkers.map((m) => (
              <Circle key={`${m.id}-circle`} center={m.position} radius={3219} pathOptions={{ color: '#64748b', fillColor: '#64748b', fillOpacity: 0.15 }} />
            ))}

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
                <Popup>
                  <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {p.source === 'uploaded' ? '📊 Uploaded Property' :
                       p.category === 'pipeline' ? '📋 Pipeline Deal' :
                       p.category === 'rapidfire' ? '🔥 Rapid Fire Queue' : 
                       p.category === 'prospect' ? '🏘️ Prospect City' : 
                       'Manual pin — custom research'}
                    </div>
                    <div style={{
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '12px',
                      color: '#1e293b',
                      backgroundColor: p.source === 'uploaded' ? '#dbeafe' :
                                     p.category === 'pipeline' ? '#d1fae5' :
                                     p.category === 'rapidfire' ? '#fed7aa' : 
                                     p.category === 'prospect' ? '#bfdbfe' : 
                                     '#e9d5ff'
                    }}>
                      {p.insight}
                    </div>
                    {p.source === 'uploaded' && p.propertyData && (
                      <div style={{
                        borderRadius: '8px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        fontSize: '11px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Property Data:</div>
                        {Object.entries(p.propertyData).map(([key, value]) => (
                          <div key={key} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '500', color: '#6b7280' }}>{key}:</span>
                            <span style={{ color: '#111827' }}>{value || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(p.category === 'rapidfire' || p.category === 'prospect' || p.category === 'custom' || p.source === 'uploaded') && (
                      <button
                        onClick={() => deletePin(p.id, p.dbId)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginTop: '4px'
                        }}
                      >
                        🗑️ Delete Pin
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {customPins
              .filter(p => {
                if (mapFilter === 'all') return true;
                if (mapFilter === 'pipeline') return p.category === 'pipeline';
                if (mapFilter === 'rapidfire') return p.category === 'rapidfire';
                if (mapFilter === 'prospects') return p.category === 'prospect';
                return true;
              })
              .filter(p => p.category !== 'pipeline' && p.category !== 'rapidfire' && p.category !== 'prospect')
              .map((p) => {
                const color = '#7c3aed';
                return (
                  <Circle key={`${p.id}-circle`} center={p.position} radius={3219} pathOptions={{ color, fillColor: color, fillOpacity: 0.08 }} />
                );
              })}
          </MapContainer>
        </div>

      </div>

      {/* Max AI Sidebar - Right Side */}
      <div style={{
        width: 420,
        minWidth: 420,
        maxWidth: 420,
        flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        {/* AI Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 15,
          fontWeight: 600,
          color: '#111827'
        }}>
          <span>Max</span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', cursor: 'default', color: '#9ca3af' }}
          >
            <MessageSquare size={15} />
          </button>
        </div>

        {/* AI Body - Messages */}
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

        {/* AI Input */}
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
      </div>

      {/* Property Sheet Preview Modal */}
      {showPreviewModal && sheetPreview && (
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
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            maxHeight: '80vh',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Preview: {sheetPreview.name}
              </h2>
              <button
                onClick={() => { setShowPreviewModal(false); setSheetPreview(null); }}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
              {sheetPreview.properties.length} properties found
            </div>

            {/* Property List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Address</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetPreview.properties.map((prop, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', color: '#111827' }}>{prop.address || 'No address found'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          backgroundColor: prop.geocodeStatus === 'success' ? '#d1fae5' : '#fef3c7',
                          color: prop.geocodeStatus === 'success' ? '#065f46' : '#92400e'
                        }}>
                          {prop.geocodeStatus === 'success' ? 'Geocoded' : 'Pending'}
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
                onClick={() => { setShowPreviewModal(false); setSheetPreview(null); }}
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
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { results, failed } = await geocodeSheetProperties();
                  if (failed.length === 0) {
                    await saveUploadedProperties(results);
                  }
                }}
                disabled={isGeocoding}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isGeocoding ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: isGeocoding ? 'not-allowed' : 'pointer'
                }}
              >
                {isGeocoding ? `Geocoding... (${geocodingProgress.current}/${geocodingProgress.total})` : 'Geocode & Add to Map'}
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
