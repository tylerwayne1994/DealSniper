import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
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
  const [form, setForm] = useState({ name: '', lat: '', lng: '', notes: '' });
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' | 'add'
  const [chat, setChat] = useState({ input: '', messages: [] });

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

  const handleSubmitProperty = (e) => {
    e.preventDefault();
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && form.name) {
      const newPin = {
        id: `custom-${Date.now()}`,
        name: form.name,
        category: 'custom',
        position: [lat, lng],
        insight: form.notes || 'Manual research note'
      };
      setCustomPins((prev) => [...prev, newPin]);
      setForm({ name: '', lat: '', lng: '', notes: '' });
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
                  <div key={i} className="mb-1"><span className="font-semibold">You:</span> {m}</div>
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
                  onClick={() => {
                    if (chat.input.trim()) {
                      setChat((prev) => ({ input: '', messages: [...prev.messages, prev.input.trim()] }));
                    }
                  }}
                >Send</button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitProperty} className="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-2xl space-y-3">
            <div className="text-xs font-semibold text-slate-500">Add Property</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <input className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Latitude" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
              <input className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" placeholder="Longitude" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
              <div className="col-span-2">
                <textarea className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white" rows={3} placeholder="Research Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="px-3 py-2 text-xs rounded-xl bg-purple-600 text-white shadow">Add Pin</button>
          </form>
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
