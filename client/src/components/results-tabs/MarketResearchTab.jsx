import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell } from 'recharts';
import { Clock, Percent, Layers, Users, TrendingUp, Home as HomeIcon, DollarSign, Briefcase, Activity, Map as MapIcon, Info, Shield } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, GeoJSON, Marker } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import 'leaflet/dist/leaflet.css';

// Shared Mapbox token (matches dashboard Map tab)
const MAPBOX_TOKEN = 'MAPBOX_TOKEN_REMOVED';

// Formatting helpers
const fmt = (val) => val?.toLocaleString() || 'N/A';
const fmtCurrency = (val) => val ? `$${val.toLocaleString()}` : 'N/A';
const fmtPercent = (val) => val !== null && val !== undefined ? `${val.toFixed(1)}%` : 'N/A';
const fmtPercentFromFraction = (val) => val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : 'N/A';
const rirLabel = (rir) => {
  if (rir === undefined || rir === null) return { label: 'N/A', score: 'N/A' };
  if (rir < 0.15) return { label: 'Most Affordable', score: '2/10' };
  if (rir < 0.18) return { label: 'Very Affordable', score: '3/10' };
  if (rir < 0.2) return { label: 'Average', score: '4/10' };
  if (rir < 0.23) return { label: 'Less Affordable', score: '6/10' };
  return { label: 'Poor', score: '8/10' };
};

const rirColor = (rir) => {
  if (rir === undefined || rir === null) return '#d1d5db';
  if (rir < 0.15) return '#10b981';
  if (rir < 0.18) return '#34d399';
  if (rir < 0.22) return '#fde047';
  if (rir < 0.28) return '#f97316';
  return '#ef4444';
};

const DOLLAR_SCALE = [
  [-Infinity, 900, '#16a34a', '<$900'],
  [900, 1200, '#84cc16', '$900–$1.2k'],
  [1200, 1600, '#eab308', '$1.2k–$1.6k'],
  [1600, 2000, '#f59e0b', '$1.6k–$2.0k'],
  [2000, 2500, '#ea580c', '$2.0k–$2.5k'],
  [2500, Infinity, '#dc2626', '>$2.5k'],
].map(([min, max, color, label]) => ({ min, max, color, label }));

const hudRowToCountyFIPS = (r) => {
  const s = Number(r.state);
  const f = Number(r.fips);
  if (!Number.isFinite(s) || !Number.isFinite(f)) return null;
  const county = Math.floor(f / 100000) % 1000;
  return String(s).padStart(2, '0') + String(county).padStart(3, '0');
};

function MarketResearchTab({ marketData, propertyLocation = {} }) {

  const hasMarketData = !!marketData;
  const marketDataSafe = marketData || {};

  const {
    property_location,
    county_data = {},
    zip_data = {},
    msa_data = {},
    aggregations = {},
    city = {},
    county = {},
    state = {},
    drive_time_minutes = 15,
    area_classification,
    zip_rir_points,
    fmr = {},
    market_cap_rate = {},
    zip_renter_owner = {},
    msa_units = {}
  } = marketDataSafe;

  const [countyGeoJson, setCountyGeoJson] = useState(null);
  const [fmrByCounty, setFmrByCounty] = useState({});
  const [zipCentroids, setZipCentroids] = useState({});
  const [mapMode, setMapMode] = useState('counties'); // 'counties' | 'cities'
  const [isochrone, setIsochrone] = useState(null);
  const mapRef = useRef(null);

  const zipCode = property_location?.zip || propertyLocation?.zip;

  const zipPoint = useMemo(() => {
    if (!zipCode) return null;
    const zip = String(zipCode).padStart(5, '0');
    return zipCentroids[zip] || null;
  }, [zipCode, zipCentroids]);

  const mapCenter = useMemo(() => {
    if (property_location?.lat && property_location?.lng) return [property_location.lat, property_location.lng];
    if (propertyLocation?.lat && propertyLocation?.lng) return [propertyLocation.lat, propertyLocation.lng];
    if (zipPoint?.lat && zipPoint?.lng) return [zipPoint.lat, zipPoint.lng];
    return [39.8283, -98.5795];
  }, [property_location, propertyLocation, zipPoint]);

  const mapZoom = useMemo(() => {
    if (property_location?.lat || propertyLocation?.lat) return 10;
    if (zipPoint) return 8;
    return 5;
  }, [property_location, propertyLocation, zipPoint]);

  const subjectLocation = useMemo(() => {
    if (property_location?.lat && property_location?.lng) return property_location;
    if (propertyLocation?.lat && propertyLocation?.lng) return propertyLocation;
    return null;
  }, [property_location, propertyLocation]);

  const rirIconFor = useMemo(() => {
    return (rir) => L.divIcon({
      className: 'rir-square',
      html: `<div style="width:18px;height:18px;border-radius:6px;background:${rirColor(rir)};opacity:0.7;border:1px solid rgba(0,0,0,0.18);box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }, []);

  const rirComparisonData = useMemo(() => {
    const rows = [
      { name: `${drive_time_minutes}-min Area`, value: marketData?.rent_to_income_ratio },
      { name: county?.name || 'County', value: county_data?.rent_to_income_ratio },
      { name: state?.name || 'State', value: state?.rent_to_income_ratio }
    ];

    return rows
      .filter((r) => r.value !== undefined && r.value !== null)
      .map((r) => ({ ...r, valuePct: (r.value || 0) * 100 }));
  }, [county?.name, county_data?.rent_to_income_ratio, drive_time_minutes, marketData?.rent_to_income_ratio, state?.name, state?.rent_to_income_ratio]);

  // Safe defaults for aggregations
  const safeAggregations = {
    population: aggregations.population || county_data.population || 0,
    median_income: aggregations.median_income || county_data.median_income || 0,
    median_rent: aggregations.median_rent || 0,
    affordability: aggregations.affordability || 'N/A'
  };

  // Derived metrics
  const localPopGrowthPct = zip_data?.net_migration_per_capita !== undefined ? (zip_data.net_migration_per_capita * 100) : undefined;
  const households = (zip_renter_owner?.owner_count || 0) + (zip_renter_owner?.renter_count || 0);

  // RIR point list for Leaflet heatmap
  const rirPoints = useMemo(() => {
    const feats = zip_rir_points?.features || [];
    return feats
      .map((f) => {
        const coords = f?.geometry?.coordinates;
        const rir = f?.properties?.rir;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        return { lng: coords[0], lat: coords[1], rir };
      })
      .filter(Boolean);
  }, [zip_rir_points]);

  const fmrColor = (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '#e5e7eb';
    return DOLLAR_SCALE.find((r) => v >= r.min && v < r.max)?.color || DOLLAR_SCALE.at(-1).color;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [geoRes, fmrRes] = await Promise.all([
          fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'),
          fetch('/FY26_FMRs - FY26_FMRs.csv')
        ]);

        if (!geoRes.ok || !fmrRes.ok) return;
        const [geoJson, fmrText] = await Promise.all([geoRes.json(), fmrRes.text()]);

        if (!cancelled) setCountyGeoJson(geoJson);

        const parsed = Papa.parse(fmrText, { header: true, dynamicTyping: true, skipEmptyLines: true });
        const lookup = {};
        parsed.data.forEach((row) => {
          const fips = hudRowToCountyFIPS(row);
          if (!fips) return;
          lookup[fips] = {
            county: row.countyname,
            state: row.stusps,
            fmr2: row.fmr_2,
            safmr2: row.safmr2
          };
        });
        if (!cancelled) setFmrByCounty(lookup);
      } catch (e) {
        console.warn('Map data load failed', e);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadZipCentroids = async () => {
      try {
        const res = await fetch('/zcta_centroids.csv');
        if (!res.ok) return;
        const text = await res.text();
        if (cancelled) return;
        const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
        const lookup = {};
        parsed.data.forEach((row) => {
          const zip = row.geoid || row.ZCTA || row.zip;
          const lat = row.y ?? row.lat;
          const lng = row.x ?? row.lon;
          if (!zip || lat == null || lng == null) return;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const zipStr = String(zip).padStart(5, '0');
          lookup[zipStr] = { lat, lng };
        });
        if (!cancelled) setZipCentroids(lookup);
      } catch (e) {
        console.warn('ZIP centroid load failed', e);
      }
    };

    loadZipCentroids();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(mapCenter, mapZoom, { animate: true });
  }, [mapCenter, mapZoom]);

  useEffect(() => {
    const fetchIsochrone = async () => {
      try {
        const origin = subjectLocation || { lat: mapCenter[0], lng: mapCenter[1] };
        if (!origin?.lat || !origin?.lng) return;
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/driving/${origin.lng},${origin.lat}?contours_minutes=5,10,15&polygons=true&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const gj = await res.json();
        setIsochrone(gj);
      } catch (e) {
        console.warn('Isochrone fetch failed', e);
      }
    };

    fetchIsochrone();
  }, [subjectLocation, mapCenter]);

  if (!hasMarketData) {
    return (
      <div className="p-6 text-center text-gray-500">
        No market data available. Please ensure property address is complete.
      </div>
    );
  }

  // Delta helpers
  const formatDeltaLine = (label, localVal, compVal, currency=false) => {
    if (localVal == null || compVal == null) return null;
    const diff = ((localVal - compVal) / (Math.abs(compVal) || 1)) * 100;
    const dir = diff >= 0 ? 'above' : 'below';
    const absPct = Math.abs(diff).toFixed(1);
    const fmtComp = currency ? fmtCurrency(compVal) : (typeof compVal === 'number' ? compVal.toLocaleString() : compVal);
    const color = diff >= 0 ? 'text-emerald-600' : 'text-red-600';
    return (
      <div className="text-xs text-gray-700">
        <span className={color}>{absPct}% {dir}</span> the {label} average ({fmtComp}).
      </div>
    );
  };

  // Affordability helpers (reserved for future UI)
  // const getAffordabilityColor = (ratio) => {
  //   if (ratio < 25) return 'text-green-600';
  //   if (ratio < 30) return 'text-yellow-600';
  //   if (ratio < 35) return 'text-orange-600';
  //   return 'text-red-600';
  // };
  // const rentToIncomeRatio = county_data?.rent_to_income_ratio || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Market Analysis</h2>
        <p className="text-sm text-gray-600">
          {(property_location?.address || propertyLocation?.address) ? (
            <>
              {property_location?.address || propertyLocation?.address}, {property_location?.city || propertyLocation?.city}, {property_location?.state || propertyLocation?.state} {property_location?.zip || propertyLocation?.zip}
            </>
          ) : (
            <>
              {city.name || 'Property'}, {state.name || 'N/A'}
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded inline-flex items-center gap-1">
            <Clock size={14} /> {drive_time_minutes}-Minute Drive
          </span>
          {area_classification && (
            <span className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded inline-flex items-center gap-1">
              <Layers size={14} /> {area_classification}
            </span>
          )}
          {market_cap_rate?.value_percent !== undefined && (
            <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded inline-flex items-center gap-1">
              <Percent size={14} /> {fmtPercent(market_cap_rate.value_percent)}{market_cap_rate?.source ? ` (${market_cap_rate.source})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Layout: RIR cards + Map */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* RIR score stack (compact cards) */}
        <div className="space-y-3">
          {[{
            title: 'Local Market',
            subtitle: `${drive_time_minutes}-Minute Drive Time Area`,
            rir: marketData?.rent_to_income_ratio,
            rent: safeAggregations.median_rent,
            income: safeAggregations.median_income,
            badge: 'vs. closest cities'
          }, {
            title: 'County',
            subtitle: county?.name || 'County',
            rir: county_data?.rent_to_income_ratio,
            rent: county_data?.median_rent ?? safeAggregations.median_rent,
            income: county_data?.median_income ?? safeAggregations.median_income,
            badge: 'vs. closest counties'
          }, {
            title: 'State',
            subtitle: state?.name || 'State',
            rir: state?.rent_to_income_ratio,
            rent: state?.median_rent,
            income: state?.median_income,
            badge: 'vs. other states'
          }].map((card, idx) => {
            const meta = rirLabel(card.rir);
            return (
              <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center border border-sky-100"><Shield size={16} className="text-sky-500" /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{card.title}</div>
                      <div className="text-[11px] text-gray-500">{card.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-red-600">{fmtPercentFromFraction(card.rir ?? 0)}</div>
                </div>
                <div className="mt-2 text-[11px] text-gray-600">Rent-to-Income Ratio (RIR) <span className="text-gray-400">{meta.score}</span></div>
                <div className="mt-2 w-full h-1 bg-gray-200 rounded-full">
                  <div className="h-1 rounded-full bg-red-500" style={{ width: `${Math.min(Math.max(((card.rir ?? 0) * 100), 6), 70)}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-gray-500">{card.badge}</div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-700">
                  <div className="flex items-center gap-1"><span className="text-gray-500">Median Rent</span> <span className="font-semibold text-gray-900">{fmtCurrency(card.rent)}</span></div>
                  <div className="flex items-center gap-1"><span className="text-gray-500">Income</span> <span className="font-semibold text-gray-900">{fmtCurrency(card.income)}</span></div>
                </div>
                {idx === 0 && (
                  <div className="mt-2 text-[11px] text-red-600 font-semibold">{meta.label}</div>
                )}
              </div>
            );
          })}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MapIcon size={16} className="text-blue-500" /> Cities Comparison</div>
            <div className="text-[11px] text-gray-500 mt-1">Rent-to-Income Ratio ranking (lower is more affordable)</div>
            <div className="h-48 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rirComparisonData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}%`} labelFormatter={(l) => l} />
                  <ReferenceLine y={30} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Bar dataKey="valuePct" radius={[8, 8, 0, 0]}>
                    {rirComparisonData.map((_, i) => (
                      <Cell key={`rir-bar-${i}`} fill={['#2563eb', '#60a5fa', '#a5b4fc'][i % 3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Leaflet Heat Map (county FMR choropleth + ZIP RIR overlay) */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="h-[540px] relative">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom
              preferCanvas
              whenCreated={(map) => { mapRef.current = map; map.invalidateSize(); }}
              style={{ width: '100%', height: '100%' }}
              className="leaflet-container"
            >
              <TileLayer
                url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
                attribution="&copy; Mapbox &copy; OpenStreetMap"
                tileSize={512}
                zoomOffset={-1}
              />

              {countyGeoJson && mapMode === 'counties' && (
                <GeoJSON
                  data={countyGeoJson}
                  style={(feature) => {
                    const fips = feature?.id;
                    const fmrRow = fmrByCounty[fips];
                    const val = fmrRow?.fmr2;
                    return { fillColor: fmrColor(val), weight: 0.6, color: '#ffffff', fillOpacity: 0.82, opacity: 0.35 };
                  }}
                  onEachFeature={(feature, layer) => {
                    const fips = feature?.id;
                    const fmrRow = fmrByCounty[fips];
                    if (!fmrRow) return;
                    const rent = fmrRow.fmr2;
                    layer.bindTooltip(
                      `<div style="font-size:12px;color:#111"><div style="font-weight:700">${fmrRow.county || 'County'}, ${fmrRow.state || ''}</div><div>HUD FMR (2BR): ${rent ? `$${Math.round(rent).toLocaleString()}` : 'N/A'}</div>${fmrRow.safmr2 ? `<div>SAFMR (2BR): $${Math.round(fmrRow.safmr2).toLocaleString()}</div>` : ''}<div style="color:#6b7280">FIPS: ${fips}</div></div>`,
                      { sticky: true }
                    );
                  }}
                />
              )}

              {isochrone && (
                <GeoJSON
                  data={isochrone}
                  style={() => ({ fillColor: '#3b82f6', color: '#1d4ed8', weight: 2, fillOpacity: 0.22, opacity: 0.6 })}
                />
              )}

              {rirPoints.map((p, idx) => (
                <Marker key={`rir-${idx}`} position={[p.lat, p.lng]} icon={rirIconFor(p.rir)}>
                  <LeafletTooltip direction="top" offset={[0, -6]} opacity={0.95} className="text-xs">
                    RIR: {fmtPercentFromFraction(p.rir || 0)}
                  </LeafletTooltip>
                </Marker>
              ))}

              {subjectLocation && (
                <CircleMarker
                  center={[subjectLocation.lat, subjectLocation.lng]}
                  radius={12}
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.9, weight: 2 }}
                >
                  <LeafletTooltip direction="right" offset={[8, 0]} opacity={0.95} className="text-xs font-semibold text-blue-700">
                    Subject Property
                  </LeafletTooltip>
                </CircleMarker>
              )}
            </MapContainer>

            {/* Map overlays */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-auto">
              <div className="bg-white/95 backdrop-blur rounded-full shadow-sm border px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> {drive_time_minutes}-min Drive
              </div>
              {area_classification && (
                <div className="bg-white/95 backdrop-blur rounded-full shadow-sm border px-3 py-2 text-sm flex items-center gap-2">
                  <Layers size={16} className="text-emerald-600" /> {area_classification}
                </div>
              )}
            </div>

            <div className="absolute top-4 right-1/2 translate-x-1/2 md:translate-x-0 md:left-4 mt-12 md:mt-0 flex gap-2 pointer-events-auto">
              <button
                onClick={() => setMapMode('counties')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border shadow-sm ${mapMode === 'counties' ? 'bg-white text-gray-900 border-gray-200' : 'bg-white/80 text-gray-600 border-gray-100'}`}
              >
                Counties
              </button>
              <button
                onClick={() => setMapMode('cities')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border shadow-sm ${mapMode === 'cities' ? 'bg-white text-gray-900 border-gray-200' : 'bg-white/80 text-gray-600 border-gray-100'}`}
              >
                Cities
              </button>
            </div>

            <div className="absolute top-4 right-4 w-72 bg-white rounded-xl shadow-md border border-gray-100 p-4 pointer-events-auto space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500">Analysis Area</div>
                  <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {drive_time_minutes}-min Drive</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Market Metrics</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <Users size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(safeAggregations.population)}</div>
                    <div className="text-gray-500">Population</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
                    <div className="text-gray-500">Growth</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <HomeIcon size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(Math.round(households))}</div>
                    <div className="text-gray-500">Households</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
                    <div className="text-gray-500">Income</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
                    <div className="text-gray-500">Businesses</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Activity size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{aggregations?.walk_score ?? 'N/A'}</div>
                    <div className="text-gray-500">Walk Score</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Percent size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{safeAggregations.affordability}</div>
                    <div className="text-gray-500">Affordability</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-md border border-gray-100 p-4 w-72 pointer-events-auto">
              <div className="flex items-center justify-between mb-3 text-sm font-semibold text-gray-900">
                <span>HUD FMR (2BR) Heat</span>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 rounded-full border bg-gray-50">Counties</span>
                  <span className="px-2 py-1 rounded-full border bg-white">ZIP RIR</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-700">
                {DOLLAR_SCALE.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: r.color }}></span>
                    <span>{r.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-gray-500"><span className="inline-block w-3 h-3 rounded bg-gray-200" /> No data</div>
              </div>
              <div className="mt-3 space-y-2 text-[11px] text-gray-600">
                <div className="flex items-start gap-2">
                  <Info size={14} className="mt-0.5" />
                  <span>County colors = HUD FY26 2BR FMR.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Info size={14} className="mt-0.5 text-rose-500" />
                  <span>Red squares = ZIP rent-to-income ratio (RIR). Darker red means higher RIR.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Population Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col justify-between">
          <div className="text-sm text-gray-500 mb-1">Population</div>
          <div className="text-3xl font-bold text-gray-900">{fmt(safeAggregations.population)}</div>
          <div className="text-xs text-gray-600 mt-2">{county.name || 'County'}</div>
        </div>

        {/* Income Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col justify-between">
          <div className="text-sm text-gray-500 mb-1">Median Household Income</div>
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
          <div className="text-xs text-gray-600 mt-2">County median income</div>
        </div>

        {/* Affordability Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col justify-between">
          <div className="text-sm text-gray-500 mb-1">Market Affordability</div>
          <div className="text-3xl font-bold text-blue-600">
            {safeAggregations.affordability}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Rent: {fmtCurrency(safeAggregations.median_rent)}/mo
          </div>
        </div>
      </div>

      {/* Housing Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Housing Market</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Home Value</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(county_data.median_home_value || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Gross Rent</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(safeAggregations.median_rent)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Owner-Occupied Rate</div>
            <div className="text-2xl font-bold text-gray-900">{fmtPercent(county_data.owner_occupied_rate || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">FMR (2BR)</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(fmr?.fmr_2br || 0)}</div>
            <div className="text-xs text-gray-600">ZIP {fmr?.zip || zipCode || ''}</div>
          </div>
        </div>
      </div>

      {/* Migration Data */}
      {zip_data && zip_data.net_migration !== undefined && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Migration Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Net Migration</div>
              <div className={`text-2xl font-bold ${zip_data.net_migration >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {zip_data.net_migration >= 0 ? '+' : ''}{fmt(Math.round(zip_data.net_migration))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Net Per Capita</div>
              <div className="text-2xl font-bold text-gray-900">{zip_data.net_migration_per_capita?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">In-Migration</div>
              <div className="text-2xl font-bold text-blue-600">{fmt(Math.round(zip_data.in_migration || 0))}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Out-Migration</div>
              <div className="text-2xl font-bold text-orange-600">{fmt(Math.round(zip_data.out_migration || 0))}</div>
            </div>
          </div>
        </div>
      )}

      {/* MSA Construction Data */}
      {(msa_data && msa_data.msa_name) || (msa_units && (msa_units.ytd_5plus_units || msa_units.ytd_total_units)) ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Multifamily Construction Activity</h3>
          {msa_data?.msa_name && <p className="text-sm text-gray-600 mb-4">{msa_data.msa_name}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD Total Permits</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(msa_data.ytd_total_units || msa_units.ytd_total_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD 5+ Unit Buildings</div>
              <div className="text-2xl font-bold text-blue-600">{fmt(msa_data.ytd_5plus_units || msa_units.ytd_5plus_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Current Month Permits</div>
              <div className="text-2xl font-bold text-green-600">{fmt(msa_data.current_month_units || msa_units.current_month_units)}</div>
            </div>
          </div>
          {(msa_units.absorption_units !== undefined || msa_units.absorption_rate !== undefined) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Absorption Units (proxy)</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(Math.round(msa_units.absorption_units || 0))}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Absorption Rate</div>
                <div className="text-2xl font-bold text-gray-900">{msa_units.absorption_rate !== undefined ? fmtPercent(msa_units.absorption_rate * 100) : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Employment */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Unemployment Rate</div>
            <div className={`text-2xl font-bold ${county_data.unemployment_rate < 5 ? 'text-green-600' : county_data.unemployment_rate < 7 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fmtPercent(county_data.unemployment_rate)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Labor Force Health</div>
            <div className="text-sm text-gray-700 mt-2">
              {county_data.unemployment_rate < 5 ? 'Strong labor market with low unemployment' : county_data.unemployment_rate < 7 ? 'Moderate labor market conditions' : 'Elevated unemployment levels'}
            </div>
          </div>
        </div>
      </div>

      {/* Landlord & Zip Renter/Owner */}
      {(zip_renter_owner && (zip_renter_owner.renter_share !== undefined || zip_renter_owner.owner_share !== undefined)) || (aggregations.businesses || aggregations.walk_score) ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Housing Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Renter Share</div>
              <div className="text-2xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.renter_share ?? 0)}</div>
              <div className="text-xs text-gray-600">{fmt(Math.round(zip_renter_owner?.renter_count ?? 0))} renters</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Owner Share</div>
              <div className="text-2xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.owner_share ?? 0)}</div>
              <div className="text-xs text-gray-600">{fmt(Math.round(zip_renter_owner?.owner_count ?? 0))} owners</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Businesses</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
              <div className="text-xs text-gray-600">Walk Score: {aggregations?.walk_score ?? 'N/A'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Market Comparison with charts */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Market Comparison</h3>
        <p className="text-xs text-gray-500 mb-4">Local Area vs. City, State & USA averages</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Median Household Income Chart */}
            <div className="bg-[#f6f8ff] border border-[#e6ebfb] rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <div className="font-semibold text-gray-900">Median Household Income</div>
                <div className="text-xs text-gray-500">Annual household earnings comparison</div>
              </div>
            </div>
            <div className="text-sm text-gray-900 font-semibold mb-2">The 15 minute drive time area has a median household income of {fmtCurrency(safeAggregations.median_income)}</div>
            <div className="text-xs text-gray-700 space-y-1 mb-3">
              {formatDeltaLine(city?.name || 'City', safeAggregations.median_income, aggregations?.comparisons?.income_city, true)}
              {formatDeltaLine('State', safeAggregations.median_income, aggregations?.comparisons?.income_state, true)}
              {formatDeltaLine('USA', safeAggregations.median_income, aggregations?.comparisons?.income_usa, true)}
            </div>
            <div className="h-42">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local Area', value: safeAggregations.median_income },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.income_city },
                  { name: 'State', value: aggregations?.comparisons?.income_state },
                  { name: 'USA', value: aggregations?.comparisons?.income_usa }
                ]} margin={{ top: 4, right: 6, left: 0, bottom: 0 }} barSize={18} barGap={6} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" height={24} iconType="circle" iconSize={8} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {['#3c4bff','#6378ff','#8aa3ff','#b5c8ff'].map((c, i) => <Cell key={`inc-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Population Growth Chart */}
          <div className="bg-[#f6f8ff] border border-[#e6ebfb] rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <div className="font-semibold text-gray-900">Population Growth</div>
                <div className="text-xs text-gray-500">Annual population change trends</div>
              </div>
            </div>
            <div className="text-sm text-gray-900 font-semibold mb-2">The 15 minute drive time area has an annual population growth rate of {localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
            <div className="text-xs text-gray-700 space-y-1 mb-3">
              {formatDeltaLine(city?.name || 'City', localPopGrowthPct, aggregations?.comparisons?.pop_growth_city)}
              {formatDeltaLine('State', localPopGrowthPct, aggregations?.comparisons?.pop_growth_state)}
              {formatDeltaLine('USA', localPopGrowthPct, aggregations?.comparisons?.pop_growth_usa)}
            </div>
            <div className="h-42">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local Area', value: localPopGrowthPct },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.pop_growth_city },
                  { name: 'State', value: aggregations?.comparisons?.pop_growth_state },
                  { name: 'USA', value: aggregations?.comparisons?.pop_growth_usa }
                ]} margin={{ top: 4, right: 6, left: 0, bottom: 0 }} barSize={18} barGap={6} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v?.toFixed ? v.toFixed(1) : v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtPercent(v)} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" height={24} iconType="circle" iconSize={8} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {['#3c4bff','#6378ff','#8aa3ff','#b5c8ff'].map((c, i) => <Cell key={`pop-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Side Market Metrics (Cactus-style) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500">Analysis Area</div>
            <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {drive_time_minutes}-min Drive</div>
          </div>
          <div className="text-xs px-2 py-1 rounded border bg-gray-50">Market Metrics</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Users size={14} /> Population</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(safeAggregations.population)}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><TrendingUp size={14} /> Growth</div>
            <div className="text-lg font-semibold text-gray-900">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><HomeIcon size={14} /> Households</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(Math.round(households))}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500">Single Family</div>
            <div className="text-lg font-semibold text-gray-900">N/A</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><DollarSign size={14} /> Income</div>
            <div className="text-lg font-semibold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Briefcase size={14} /> Businesses</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Activity size={14} /> Walk Score</div>
            <div className="text-lg font-semibold text-gray-900">{aggregations?.walk_score ?? 'N/A'}</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-sm p-4 h-full">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500" />
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Percent size={14} /> Affordability</div>
            <div className="text-lg font-semibold text-blue-600">{safeAggregations.affordability}</div>
          </div>
        </div>
      </div>

      {/* Data Sources Footer */}
      <div className="bg-gray-50 rounded-lg shadow-sm p-4">
        <p className="text-xs text-gray-500">
          <span className="font-semibold">Data Sources:</span> ACS 2023 5-Year, IRS Migration 2021, Building Permits Survey (May 2025), Mapbox Isochrone, HUD FMR by ZIP, CBSA Monthly MSA Units, landlord.csv, ZIP renter/owner stats. Some values estimated with a low-cost LLM when not available.
        </p>
      </div>
    </div>
  );
}

export default MarketResearchTab;
