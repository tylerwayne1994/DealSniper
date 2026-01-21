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
  const [mapStyle, setMapStyle] = useState('voyager'); // 'voyager' | 'satellite' | 'streets' | 'osm'
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const tileUrl = tileConfigs[mapStyle].url;
  const attribution = tileConfigs[mapStyle].attribution;

  // Marker styles by category - ALL RED PINS NOW
  const categoryIcon = (cat, source) => {
    // Everything uses red teardrop pins now
    return createPinIcon('#ef4444', 
      cat === 'rapidfire' ? '🔥' : 
      cat === 'prospect' ? '🏠' : 
      cat === 'pipeline' ? '📋' : 
      '📍'
    );
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                onChange={(e) => handleProspectsFile(e.target.files?.[0])}
                style={{ fontSize: '13px' }}
              />
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
            <TileLayer url={tileUrl} attribution={attribution} />
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
                      {p.category === 'pipeline' ? '📋 Pipeline Deal' :
                       p.category === 'rapidfire' ? '🔥 Rapid Fire Queue' : 
                       p.category === 'prospect' ? '🏘️ Prospect City' : 
                       'Manual pin — custom research'}
                    </div>
                    <div style={{
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '12px',
                      color: '#1e293b',
                      backgroundColor: p.category === 'pipeline' ? '#d1fae5' :
                                     p.category === 'rapidfire' ? '#fed7aa' : 
                                     p.category === 'prospect' ? '#bfdbfe' : 
                                     '#e9d5ff'
                    }}>
                      {p.insight}
                    </div>
                    {(p.category === 'rapidfire' || p.category === 'prospect' || p.category === 'custom') && (
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
                {msg.content}
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
                      const res = await fetch(API_ENDPOINTS.marketResearchChat, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: trimmed, system })
                      });
                      const data = await res.json().catch(() => null);
                      const text = data?.message || data?.content || data?.assistant || 'No response';
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
                  const res = await fetch(API_ENDPOINTS.marketResearchChat, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: trimmed, system })
                  });
                  const data = await res.json().catch(() => null);
                  const text = data?.message || data?.content || data?.assistant || 'No response';
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
    </div>
  );
}

export default DashboardMapTab;
