import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_ENDPOINTS } from '../../config/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import {
  MessageSquare,
  MapPin,
  Star,
  Heart,
  Cog,
  CheckCircle,
  XCircle
} from 'lucide-react';

// City coordinates
const CITIES = {
  kansasCity: { name: 'Kansas City', center: [39.0997, -94.5786], zoom: 12 },
  indianapolis: { name: 'Indianapolis', center: [39.7684, -86.1581], zoom: 12 },
  columbus: { name: 'Columbus', center: [39.9612, -82.9988], zoom: 12 }
};

// Helper to create Tailwind-styled divIcon
function createDivIcon({ bgClass, borderClass = 'border-white/60', icon: Icon, iconColor = '#fff' }) {
  return L.divIcon({
    className: 'atlasai-divicon',
    html: `
      <div class="relative flex items-center justify-center w-9 h-9 rounded-full ${bgClass} border ${borderClass} shadow-2xl backdrop-blur">
        <div class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white/70"></div>
        <span id="icon-slot"></span>
      </div>
    `,
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
}

// Map control component to change view
function CityNavigator({ city }) {
  const map = useMap();
  React.useEffect(() => {
    if (city) {
      map.setView(city.center, city.zoom);
    }
  }, [city, map]);
  return null;
}

function DashboardMapTab() {
  const [activeCityKey, setActiveCityKey] = useState('kansasCity');
  const activeCity = CITIES[activeCityKey];

  const [customPins, setCustomPins] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', units: '', notes: '' });
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' | 'add' | 'upload'
  const [chat, setChat] = useState({ input: '', messages: [], loading: false });
  const [pendingCommands, setPendingCommands] = useState([]);
  const [rapidFireQueue, setRapidFireQueue] = useState([]);

  const baseMarkers = useMemo(() => ([
    // Healthcare (rose)
    {
      id: 'health-1',
      name: 'Healthcare Node',
      category: 'healthcare',
      position: [activeCity.center[0] + 0.01, activeCity.center[1] + 0.01],
      insight: 'Regional medical hub driving stable employment and rent demand.'
    },
    // Manufacturing (amber)
    {
      id: 'mfg-1',
      name: 'Manufacturing Plant',
      category: 'manufacturing',
      position: [activeCity.center[0] - 0.012, activeCity.center[1] - 0.008],
      insight: 'Expanding operations; potential for workforce housing demand.'
    },
    // BuyZones (green)
    {
      id: 'buyzone-1',
      name: 'Buy Zone A',
      category: 'buy',
      position: [activeCity.center[0] + 0.018, activeCity.center[1] - 0.005],
      insight: 'Favorable rent-to-income and crime trend metrics.'
    },
    // AvoidZones (red)
    {
      id: 'avoid-1',
      name: 'Avoid Zone X',
      category: 'avoid',
      position: [activeCity.center[0] - 0.02, activeCity.center[1] + 0.01],
      insight: 'Elevated eviction timelines and declining school ratings.'
    }
  ]), [activeCity]);

  const handleSubmitProperty = async (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    const address = (form.address || '').trim();
    const units = form.units ? parseInt(form.units, 10) : null;
    if (!name && !address) return;
    // Geocode address, then add pin
    const geocodeAddress = (addr) => new Promise((resolve) => enqueueGeocode(addr, resolve));
    let latlng = null;
    if (address) {
      latlng = await geocodeAddress(address);
    }
    if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) {
      const newPin = {
        id: `custom-${Date.now()}`,
        name: name || address,
        category: 'custom',
        position: [latlng.lat, latlng.lng],
        insight: units != null ? `${units} units` : (form.notes || 'Manual research note')
      };
      setCustomPins((prev) => [...prev, newPin]);
      supabase.from('map_prospects').insert({ name: newPin.name, address, units: units || null, lat: latlng.lat, lng: latlng.lng, source: 'manual' }).catch(() => {});
      setForm({ name: '', address: '', units: '', notes: '' });
    }
  };

  const tileUrl = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
  const attribution = '&copy; OpenStreetMap contributors, Humanitarian style';

  // Marker styles by category
  const categoryIcon = (category) => {
    switch (category) {
      case 'healthcare':
        return createDivIcon({ bgClass: 'bg-rose-500/90', icon: Heart });
      case 'manufacturing':
        return createDivIcon({ bgClass: 'bg-amber-500/90', icon: Cog });
      case 'buy':
        return createDivIcon({ bgClass: 'bg-green-500/90', icon: CheckCircle });
      case 'avoid':
        return createDivIcon({ bgClass: 'bg-red-500/90', icon: XCircle });
      case 'custom':
      default:
        return createDivIcon({ bgClass: 'bg-purple-600/90', icon: Star });
    }
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
              const newPin = { id: `cmd-${Date.now()}`, name, category: 'custom', position: [lat, lng], insight: notes || 'From MAX' };
              addPin(newPin);
              // Save to Supabase as LLM-generated pin
              supabase.from('map_prospects').insert({ name, address: null, units: null, lat, lng, source: 'llm' }).catch(() => {});
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
    const jsonMatch = text.match(/\{[\s\S]*\"commands\"[\s\S]*\}/);
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
      if (!job) { geocodeRunning = false; return; }
      const { address, onResult } = job;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en-US' } });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const best = data[0];
          onResult({ lat: parseFloat(best.lat), lng: parseFloat(best.lon) });
        } else {
          onResult(null);
        }
      } catch (e) {
        onResult(null);
      }
      setTimeout(step, 1100); // ~1 req/sec
    };
    step();
  };

  const enqueueGeocode = (address, onResult) => {
    geocodeQueue.push({ address, onResult });
    runGeocodeQueue();
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
    if (!rapidFireQueue.length) return;
    for (const item of rapidFireQueue) {
      const addr = item.address;
      if (!addr) continue;
      enqueueGeocode(addr, (latlng) => {
        if (latlng) {
          const pin = { id: `rf-${item.id}-${Date.now()}`, name: item.name, category: 'custom', position: [latlng.lat, latlng.lng], insight: item.units != null ? `${item.units} units` : 'Rapid Fire' };
          setCustomPins(prev => [...prev, pin]);
          supabase.from('map_prospects').insert({ name: item.name, address: addr, units: item.units || null, lat: latlng.lat, lng: latlng.lng, source: 'rapid_fire' }).catch(() => {});
        }
      });
    }
  };

  // Upload Prospects: parse file and add pins
  const [uploadState, setUploadState] = useState({ parsing: false, rows: 0, geocoded: 0, errors: 0 });
  const handleProspectsFile = async (file) => {
    if (!file) return;
    setUploadState({ parsing: true, rows: 0, geocoded: 0, errors: 0 });
    const pushProspect = (name, address, units, latlng) => {
      const pin = { id: `pros-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: name || address, category: 'custom', position: [latlng.lat, latlng.lng], insight: units != null ? `${units} units` : 'Prospect' };
      setCustomPins(prev => [...prev, pin]);
      // Save to Supabase
      supabase.from('map_prospects').insert({ name: pin.name, address, units: units || null, lat: latlng.lat, lng: latlng.lng, source: 'upload' }).catch(() => {});
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

  // Load saved prospects from Supabase
  const loadSavedProspects = async () => {
    try {
      const { data, error } = await supabase
        .from('map_prospects')
        .select('id,name,address,units,lat,lng,source')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && Array.isArray(data)) {
        const pins = data
          .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
          .map(r => ({ id: r.id || `db-${Math.random().toString(36).slice(2,8)}`, name: r.name || r.address || 'Prospect', category: 'custom', position: [r.lat, r.lng], insight: r.units != null ? `${r.units} units` : (r.source || 'Prospect') }));
        setCustomPins(pins);
      }
    } catch (e) {
      // ignore
    }
  };

  // Save all current pins to Supabase
  const saveAllPins = async () => {
    try {
      const rows = customPins.map(p => ({ name: p.name, address: p.address || null, units: (p.insight && /units/.test(p.insight)) ? parseInt(p.insight, 10) : null, lat: p.position[0], lng: p.position[1], source: 'manual' }));
      await supabase.from('map_prospects').insert(rows);
    } catch (e) {
      // ignore
    }
  };

  // Auto-load toggle
  const [autoLoadSaved, setAutoLoadSaved] = useState(() => localStorage.getItem('atlas.autoLoadProspects') === 'true');
  useEffect(() => {
    if (autoLoadSaved) loadSavedProspects();
  }, [autoLoadSaved]);

  // Intelligence cards per city (placeholder content)
  const intelligenceForCity = (key) => {
    const city = CITIES[key];
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl">
          <div className="text-xs font-semibold text-slate-500">Crime Trends</div>
          <div className="text-sm text-slate-800">Stable to improving in core neighborhoods of {city.name}.</div>
        </div>
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl">
          <div className="text-xs font-semibold text-slate-500">Property Tax</div>
          <div className="text-sm text-slate-800">Moderate and predictable; verify county-specific variations.</div>
        </div>
        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl">
          <div className="text-xs font-semibold text-slate-500">Eviction Timelines</div>
          <div className="text-sm text-slate-800">Reasonable timelines; ensure documentation and local counsel.</div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-screen h-[calc(100vh-56px)] flex bg-slate-50">
      {/* Sidebar */}
      <div className="w-[450px] h-full border-r border-slate-200 bg-white/80 backdrop-blur p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow">
            <MapPin size={16} />
          </div>
          <div className="text-sm font-bold text-slate-800">AtlasAI — Market Navigator</div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            className={`px-3 py-2 text-xs rounded-xl border ${activeTab === 'assistant' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
            onClick={() => setActiveTab('assistant')}
          >
            <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> Market Assistant</span>
          </button>
          <button
            className={`px-3 py-2 text-xs rounded-xl border ${activeTab === 'add' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
            onClick={() => setActiveTab('add')}
          >
            <span className="inline-flex items-center gap-1"><Star size={14} /> Add Property</span>
          </button>
          <button
            className={`px-3 py-2 text-xs rounded-xl border ${activeTab === 'upload' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
            onClick={() => setActiveTab('upload')}
          >
            <span className="inline-flex items-center gap-1"><Star size={14} /> Upload Prospects</span>
          </button>
        </div>

        {/* Active Tab Content */}
        {activeTab === 'assistant' ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl space-y-3">
            <div className="text-xs font-semibold text-slate-500">City Intelligence</div>
            {intelligenceForCity(activeCityKey)}
            <div className="text-xs font-semibold text-slate-500">Ask AtlasAI</div>
            <div className="space-y-2">
              <div className="h-24 overflow-auto rounded-xl border border-slate-200 p-2 text-xs text-slate-700 bg-white/60">
                {chat.messages.length === 0 ? (
                  <div className="text-slate-400">No messages yet. Ask about crime, taxes, or evictions.</div>
                ) : chat.messages.map((m, i) => (
                  <div key={i} className="mb-1">
                    {m.role === 'user' ? (
                      <span className="font-semibold">You:</span>
                    ) : (
                      <span className="font-semibold text-indigo-700">MAX:</span>
                    )}
                    {' '}{m.content}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white/70"
                  placeholder="Type a question..."
                  value={chat.input}
                  onChange={(e) => setChat({ ...chat, input: e.target.value })}
                />
                <button
                  className="px-3 py-2 text-xs rounded-xl bg-indigo-600 text-white shadow"
                  disabled={chat.loading}
                  onClick={async () => {
                    const trimmed = chat.input.trim();
                    if (!trimmed || chat.loading) return;
                    setChat(prev => ({ ...prev, loading: true, messages: [...prev.messages, { role: 'user', content: trimmed }], input: '' }));
                    try {
                      const system = `You are MAX. When asked about the map, output a JSON object at the end with a commands array to control the map. Example:\n{\n  \"commands\": [\n    { \"type\": \"panTo\", \"payload\": { \"center\": [39.0997, -94.5786], \"zoom\": 12 } },\n    { \"type\": \"addPin\", \"payload\": { \"name\": \"Prospect Deal\", \"lat\": 39.101, \"lng\": -94.57, \"notes\": \"Near hospital hub\" } }\n  ]\n}\nOnly include valid numeric lat/lng. Do not include code fences in the JSON.`;
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
                      setChat(prev => ({ ...prev, loading: false, messages: [...prev.messages, { role: 'assistant', content: 'Error contacting MAX.' }] }));
                    }
                  }}
                >{chat.loading ? 'Sending...' : 'Send'}</button>
              </div>
            </div>
          </div>
        ) : activeTab === 'add' ? (
          <form onSubmit={handleSubmitProperty} className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl space-y-3">
            <div className="text-xs font-semibold text-slate-500">Add Property</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Property Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Street Address, City, ST ZIP" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <input className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Units (optional)" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
              <div className="col-span-2">
                <textarea className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" rows={3} placeholder="Research Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="px-3 py-2 text-xs rounded-xl bg-purple-600 text-white shadow">Add Pin</button>
            <div className="flex items-center gap-2 pt-2">
              <input id="auto-load" type="checkbox" className="rounded" checked={autoLoadSaved} onChange={(e) => {
                const v = e.target.checked; setAutoLoadSaved(v); localStorage.setItem('atlas.autoLoadProspects', v ? 'true' : 'false');
              }} />
              <label htmlFor="auto-load" className="text-xs text-slate-600">Auto-load saved prospects on open</label>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl space-y-3">
            <div className="text-xs font-semibold text-slate-500">Upload Prospect Properties</div>
            <div className="text-xs text-slate-700">Upload a CSV or Excel file with address columns; we geocode and pin them.</div>
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={(e) => handleProspectsFile(e.target.files?.[0])} />
            <div className="text-xs text-slate-600">Rows: {uploadState.rows} • Geocoded: {uploadState.geocoded} • Errors: {uploadState.errors}</div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 text-xs rounded-xl border bg-white border-slate-200 text-slate-600"
                onClick={async () => {
                  // Load Rapid Fire "passed" deals from Supabase (screened_deals)
                  try {
                    const { data, error } = await supabase
                      .from('screened_deals')
                      .select('property_address,units,score')
                      .eq('score', 'pass')
                      .limit(500);
                    if (error) return;
                    const rows = (data || [])
                      .filter(d => d?.property_address)
                      .map(d => ({ Address: d.property_address, Units: d.units || null, Name: d.property_address }));
                    setUploadState({ parsing: false, rows: rows.length, geocoded: 0, errors: 0 });
                    rows.forEach(r => {
                      const address = r.Address;
                      const units = r.Units;
                      const name = r.Name;
                      enqueueGeocode(address, (latlng) => {
                        if (latlng) {
                          setUploadState(s => ({ ...s, geocoded: s.geocoded + 1 }));
                          const pin = { id: `pros-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name, category: 'custom', position: [latlng.lat, latlng.lng], insight: units != null ? `${units} units` : 'Prospect' };
                          setCustomPins(prev => [...prev, pin]);
                          supabase.from('map_prospects').insert({ name, address, units: units || null, lat: latlng.lat, lng: latlng.lng, source: 'rapid_fire' }).catch(() => {});
                        } else {
                          setUploadState(s => ({ ...s, errors: s.errors + 1 }));
                        }
                      });
                    });
                  } catch (e) {
                    // ignore
                  }
                }}
              >Load Rapid Fire Passed</button>
              <button
                className="px-3 py-2 text-xs rounded-xl border bg-white border-slate-200 text-slate-600"
                onClick={loadSavedProspects}
              >Load Saved Prospects</button>
              <button
                className="px-3 py-2 text-xs rounded-xl border bg-white border-slate-200 text-slate-600"
                onClick={saveAllPins}
              >Save All Pins</button>
              <button
                className="px-3 py-2 text-xs rounded-xl border bg-white border-slate-200 text-slate-600"
                onClick={loadRapidFireQueue}
              >Load Rapid Fire Queue</button>
              <button
                className="px-3 py-2 text-xs rounded-xl border bg-white border-slate-200 text-slate-600"
                onClick={addAllRapidFireToMap}
                disabled={!rapidFireQueue.length}
              >Add All to Map</button>
            </div>

            {/* Rapid Fire queue list preview */}
            <div className="mt-2 rounded-xl border border-slate-200 bg-white/60 p-2">
              <div className="text-xs font-semibold text-slate-500">Rapid Fire Queue ({rapidFireQueue.length})</div>
              <div className="max-h-40 overflow-auto text-xs text-slate-700">
                {rapidFireQueue.length === 0 ? (
                  <div className="text-slate-400">Click "Load Rapid Fire Queue" to load.</div>
                ) : rapidFireQueue.map((rf) => (
                  <div key={rf.id} className="py-1 border-b border-slate-100">
                    <div className="font-semibold text-slate-800">{rf.name}</div>
                    <div className="text-slate-600">{rf.address}</div>
                    <div className="text-slate-500">{rf.units != null ? `${rf.units} units` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* City Navigation */}
        <div className="flex gap-2">
          {Object.entries(CITIES).map(([key, city]) => (
            <button
              key={key}
              className={`px-3 py-2 text-xs rounded-xl border ${activeCityKey === key ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
              onClick={() => setActiveCityKey(key)}
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 h-full">
        <MapContainer center={activeCity.center} zoom={activeCity.zoom} className="w-full h-full">
          <CityNavigator city={activeCity} />
          <TileLayer url={tileUrl} attribution={attribution} />
          <CommandExecutor commands={pendingCommands} onDone={() => setPendingCommands([])} addPin={addPinFromCommand} />

          {/* Base categorized markers */}
          {baseMarkers.map((m) => (
            <Marker key={m.id} position={m.position} icon={categoryIcon(m.category)}>
              <Popup>
                <div className="min-w-[220px] space-y-1">
                  <div className="text-sm font-bold text-slate-800">{m.name}</div>
                  <div className="text-xs text-slate-600">Influence zone radius ~2 miles</div>
                  <div className="rounded-xl bg-indigo-50 p-2 text-xs text-slate-700">Research Insight: {m.insight}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Influence zones (2 miles ~ 3219m) */}
          {baseMarkers.map((m) => (
            <Circle key={`${m.id}-circle`} center={m.position} radius={3219} pathOptions={{ color: '#64748b', fillColor: '#64748b', fillOpacity: 0.15 }} />
          ))}

          {/* Custom pins from form */}
          {customPins.map((p) => (
            <Marker key={p.id} position={p.position} icon={categoryIcon('custom')}>
              <Popup>
                <div className="min-w-[220px] space-y-1">
                  <div className="text-sm font-bold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-600">Manual pin — custom research</div>
                  <div className="rounded-xl bg-purple-50 p-2 text-xs text-slate-700">Research Insight: {p.insight}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {customPins.map((p) => (
            <Circle key={`${p.id}-circle`} center={p.position} radius={3219} pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.1 }} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default DashboardMapTab;
