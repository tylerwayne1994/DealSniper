import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell } from 'recharts';
import { Clock, Percent, Layers, Users, TrendingUp, Home as HomeIcon, DollarSign, Briefcase, Activity, Map as MapIcon, Info, Shield } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import Papa from 'papaparse';
import 'leaflet/dist/leaflet.css';

// Error boundary to prevent blank screens and surface errors to the UI
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error, info) {
    console.error('🔥 ErrorBoundary caught error:', error, info);
    this.setState({ hasError: true, error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white rounded-xl shadow border text-sm text-red-700">
          <div className="font-bold mb-2">Something went wrong rendering Market Research</div>
          <div className="mb-2">Error: {String(this.state.error?.message || this.state.error)}</div>
          <details className="text-xs text-gray-600 whitespace-pre-wrap mb-3">
            {this.state.info?.componentStack}
          </details>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => window.location.reload()}>Reload page</button>
            <button className="px-3 py-1 bg-gray-100 text-gray-800 rounded" onClick={() => console.log('ErrorBoundary info:', this.state)}>Log details</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// Lightweight loading UI so the tab never flashes a "no data" message while fetches run
const LoadingState = ({ propertyLocation }) => {
  const locationLabel = [propertyLocation?.city, propertyLocation?.state].filter(Boolean).join(', ');
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Loading market data</div>
          <div className="text-xs text-gray-600">{locationLabel || 'Fetching property context...'}</div>
        </div>
        <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 animate-pulse" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/5" />
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Heatmap layer for RIR
const HeatLayer = ({ points, heatMetric }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 26,
      maxZoom: 12,
      minOpacity: 0.28,
      gradient: heatMetric === 'affordability'
        ? { 0.0: '#e0f2fe', 0.35: '#bfdbfe', 0.65: '#2563eb', 1.0: '#1e3a8a' }
        : { 0.0: '#fff1f2', 0.35: '#fecdd3', 0.65: '#ef4444', 1.0: '#991b1b' }
    }).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points, heatMetric]);
  return null;
};

// ZIP Circle Markers with actual data
const ZipDataMarkers = ({ zipCentroids, fmrData, migrationData, metric, onSelectZip }) => {
  const map = useMap();
  
  const markersData = useMemo(() => {
    console.log(`🎯 Building markers for metric: ${metric}`);
    console.log('  zipCentroids count:', Object.keys(zipCentroids).length);
    console.log('  fmrData count:', Object.keys(fmrData).length);
    console.log('  migrationData count:', Object.keys(migrationData).length);
    
    const markers = [];
    Object.entries(zipCentroids).forEach(([zip, coords]) => {
      let value = null;
      let color = '#9ca3af';
      let displayValue = 'N/A';
      
      if (metric === 'fmr') {
        const fmr2 = fmrData[zip]?.fmr2;
        if (fmr2) {
          value = fmr2;
          displayValue = `$${Math.round(fmr2).toLocaleString()}`;
          color = fmr2 < 1000 ? '#16a34a' : fmr2 < 1400 ? '#84cc16' : fmr2 < 1800 ? '#eab308' : fmr2 < 2200 ? '#f59e0b' : '#dc2626';
          markers.push({ zip, coords, value, color, displayValue, county: fmrData[zip]?.county, state: fmrData[zip]?.state });
        }
      } else if (metric === 'migration') {
        const migRate = migrationData[zip]?.migrationRate;
        if (migRate !== null && migRate !== undefined) {
          value = migRate;
          displayValue = `${migRate > 0 ? '+' : ''}${migRate.toFixed(1)}‰`;
          color = migRate < -5 ? '#dc2626' : migRate < 0 ? '#f59e0b' : migRate < 5 ? '#84cc16' : '#16a34a';
          markers.push({ zip, coords, value, color, displayValue, netMig: migrationData[zip]?.netMigration, pop: migrationData[zip]?.population2021 });
        }
      }
    });
    console.log(`✅ GENERATED ${markers.length} MARKERS for ${metric}`);
    if (markers.length > 0) {
      console.log('Sample markers:', markers.slice(0, 5));
    } else {
      console.warn('⚠️ NO MARKERS GENERATED! Check data alignment.');
    }
    return markers;
  }, [zipCentroids, fmrData, migrationData, metric]);
  
  return (
    <>
      {markersData.slice(0, 2000).map(({ zip, coords, color, displayValue, county, state, netMig, pop }) => (
        <CircleMarker
          key={zip}
          center={[coords.lat, coords.lng]}
          radius={5}
          pathOptions={{ fillColor: color, color: color, weight: 1, fillOpacity: 0.7, opacity: 0.9 }}
          eventHandlers={{ click: () => onSelectZip && onSelectZip(zip, coords, metric === 'fmr' ? fmrData[zip] : migrationData[zip]) }}
        >
          <LeafletTooltip direction="top" offset={[0, -5]} opacity={0.95} className="text-xs">
            <div style={{ minWidth: '120px' }}>
              <div className="font-bold">ZIP {zip}</div>
              {county && <div className="text-[10px] text-gray-600">{county}, {state}</div>}
              <div className="font-semibold text-sm mt-1">
                {metric === 'fmr' ? `FMR (2BR): ${displayValue}` : `Migration: ${displayValue}`}
              </div>
              {netMig !== undefined && <div className="text-[10px]">Net: {netMig > 0 ? '+' : ''}{netMig.toLocaleString()} people</div>}
              {pop && <div className="text-[10px]">Pop: {pop.toLocaleString()}</div>}
            </div>
          </LeafletTooltip>
        </CircleMarker>
      ))}
    </>
  );
};

function MarketResearchTab({ marketData, propertyLocation = {}, loading = false, onRefetchMarketData }) {

  const hasMarketData = !!marketData;
  const isLoading = !!loading;
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
  const [heatMetric, setHeatMetric] = useState('rir'); // 'rir' | 'affordability'
  const [selectedDriveTime, setSelectedDriveTime] = useState(drive_time_minutes);
  const [csvLoading, setCsvLoading] = useState(true);
  const [fmrData, setFmrData] = useState({});
  const [migrationData, setMigrationData] = useState({});
  const [selectedFeature, setSelectedFeature] = useState(null); // { type: 'county'|'zip'|'city', id, data, source }
  const [showZipHeat, setShowZipHeat] = useState(true);
  const mapRef = useRef(null);

  const zipCode = property_location?.zip || propertyLocation?.zip;

  // Get property county FIPS - try multiple sources
  const propertyCountyFips = useMemo(() => {
    // Try direct FIPS
    let fips = county?.fips || county_data?.fips || county?.county_fips || county_data?.county_fips;
    
    // If not found, try to construct from state + county codes
    if (!fips && (county?.state_code || state?.code) && (county?.code || county?.county_code)) {
      const stateCode = String(county?.state_code || state?.code).padStart(2, '0');
      const countyCode = String(county?.code || county?.county_code).padStart(3, '0');
      fips = stateCode + countyCode;
    }
    
    console.log('🏠 Property county FIPS:', fips);
    console.log('  county object:', county);
    console.log('  county_data object:', county_data);
    console.log('  state object:', state);
    console.log('  zipCode:', zipCode);
    return fips;
  }, [county, county_data, state, zipCode]);

  // Load CSV data on mount
  useEffect(() => {
    console.log('🔄 STARTING CSV DATA LOAD...');
    const loadCSVData = async () => {
      try {
        // Load ZIP centroids
        console.log('📍 Fetching ZIP centroids from /zcta_centroids.csv...');
        const centroidsRes = await fetch('/zcta_centroids.csv');
        if (!centroidsRes.ok) {
          console.error('❌ ZIP centroids fetch failed:', centroidsRes.status);
          return;
        }
        const centroidsTxt = await centroidsRes.text();
        Papa.parse(centroidsTxt, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const centroids = {};
            results.data.forEach((row) => {
              const zip = String(row.geoid || '').padStart(5, '0');
              if (zip && row.y && row.x) {
                centroids[zip] = { lat: parseFloat(row.y), lng: parseFloat(row.x) };
              }
            });
            console.log('✅ ZIP CENTROIDS LOADED:', Object.keys(centroids).length, 'ZIPs');
            console.log('Sample ZIP centroids:', Object.entries(centroids).slice(0, 3));
            setZipCentroids(centroids);
          }
        });

        // Load FMR data (ZIP level)
        console.log('💵 Fetching FMR data from /fmr_by_zip_clean.csv...');
        const fmrRes = await fetch('/fmr_by_zip_clean.csv');
        if (!fmrRes.ok) {
          console.error('❌ FMR fetch failed:', fmrRes.status);
          return;
        }
        const fmrTxt = await fmrRes.text();
        Papa.parse(fmrTxt, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            const fmrMapByZip = {};
            const fmrMapByCounty = {};
            results.data.forEach((row) => {
              const zip = String(row.zip || '').padStart(5, '0');
              const fips = row.county_fips ? String(row.county_fips).padStart(5, '0') : null;
              
              if (zip) {
                fmrMapByZip[zip] = {
                  fmr0: row.fmr_0br || null,
                  fmr1: row.fmr_1br || null,
                  fmr2: row.fmr_2br || null,
                  fmr3: row.fmr_3br || null,
                  fmr4: row.fmr_4br || null,
                  county: row.county_name,
                  state: row.state_usps,
                };
              }
              
              if (fips && !fmrMapByCounty[fips]) {
                fmrMapByCounty[fips] = {
                  fmr0: row.fmr_0br || null,
                  fmr1: row.fmr_1br || null,
                  fmr2: row.fmr_2br || null,
                  fmr3: row.fmr_3br || null,
                  fmr4: row.fmr_4br || null,
                  county: row.county_name,
                  state: row.state_usps,
                };
              }
            });
            console.log('✅ FMR DATA LOADED:', Object.keys(fmrMapByZip).length, 'ZIPs,', Object.keys(fmrMapByCounty).length, 'counties');
            console.log('Sample FMR data (ZIP):', Object.entries(fmrMapByZip).slice(0, 3));
            console.log('Sample FMR data (County):', Object.entries(fmrMapByCounty).slice(0, 3));
            setFmrData(fmrMapByZip);
            setFmrByCounty(fmrMapByCounty);
          }
        });

        // Load migration data
        console.log('🚶 Fetching migration data from /migration_with_clean_zipcodes.csv...');
        const migRes = await fetch('/migration_with_clean_zipcodes.csv');
        if (!migRes.ok) {
          console.error('❌ Migration fetch failed:', migRes.status);
          return;
        }
        const migTxt = await migRes.text();
        Papa.parse(migTxt, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            const migMap = {};
            let validCount = 0;
            results.data.forEach((row) => {
              const zip = String(row.ZIP || '').padStart(5, '0');
              const pop = row.pop_2021;
              if (zip && pop > 0) {
                validCount++;
                migMap[zip] = {
                  migrationRate: row.n2_0_net_pc || 0,  // Net migration per capita
                  netMigration: row.n2_0_net || 0,       // Raw net migration count
                  population2021: pop,
                  inflow: row.n2_0_in || 0,
                  outflow: row.n2_0_out || 0,
                };
              }
            });
            console.log('✅ MIGRATION DATA LOADED:', Object.keys(migMap).length, 'ZIPs with valid data out of', results.data.length, 'rows');
            console.log('Sample migration data:', Object.entries(migMap).slice(0, 3));
            setMigrationData(migMap);
          }
        });

        console.log('✅ ALL CSV DATA LOADED SUCCESSFULLY');
        setCsvLoading(false);
      } catch (err) {
        console.error('CSV load error:', err);
        setCsvLoading(false);
      }
    };

    loadCSVData();
  }, []);

  // Sync selectedDriveTime with marketData when it updates
  useEffect(() => {
    setSelectedDriveTime(drive_time_minutes);
  }, [drive_time_minutes]);

  const handleDriveTimeChange = (newDriveTime) => {
    setSelectedDriveTime(newDriveTime);
    if (onRefetchMarketData) {
      onRefetchMarketData(newDriveTime);
    }
  };

  const zipPoint = useMemo(() => {
    if (!zipCode) return null;
    const zip = String(zipCode).padStart(5, '0');
    return zipCentroids[zip] || null;
  }, [zipCode, zipCentroids]);

  const findNearestZipWithData = (lat, lng, dataset) => {
    if (!lat || !lng) return null;
    let best = null;
    Object.entries(zipCentroids).forEach(([zip, c]) => {
      if (!c || !dataset[zip]) return;
      const dlat = c.lat - lat;
      const dlng = c.lng - lng;
      const dist2 = dlat * dlat + dlng * dlng;
      if (best === null || dist2 < best.dist2) best = { zip, coords: c, dist2 };
    });
    return best ? { zip: best.zip, coords: best.coords, data: dataset[best.zip] } : null;
  };

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

  const heatPoints = useMemo(() => {
    return rirPoints.map((p) => {
      const rir = p.rir ?? 0;
      const affordabilityWeight = 1 - Math.min(Math.max(rir, 0), 0.35) / 0.35; // lower RIR -> hotter if affordability mode
      const rirWeight = Math.min(Math.max(rir, 0), 0.35) / 0.35; // normalize 0-1 roughly up to 35%
      const weight = heatMetric === 'affordability' ? affordabilityWeight : rirWeight;
      return [p.lat, p.lng, weight];
    });
  }, [rirPoints, heatMetric]);

  // Load county GeoJSON separately
  useEffect(() => {
    let cancelled = false;
    const loadCountyGeo = async () => {
      try {
        console.log('🗺️ Fetching county GeoJSON...');
        const res = await fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json');
        if (!res.ok) {
          console.error('❌ County GeoJSON fetch failed:', res.status);
          return;
        }
        const geoJson = await res.json();
        console.log('✅ COUNTY GEOJSON LOADED:', geoJson?.features?.length, 'counties');
        if (!cancelled) setCountyGeoJson(geoJson);
      } catch (e) {
        console.error('❌ County GeoJSON load error:', e);
      }
    };
    loadCountyGeo();
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
    if (subjectLocation?.lat && subjectLocation?.lng) {
      mapRef.current.setView(mapCenter, mapZoom, { animate: true });
      return;
    }

    if (rirPoints.length) {
      const bounds = L.latLngBounds(rirPoints.map((p) => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 9 });
    } else {
      mapRef.current.setView(mapCenter, mapZoom, { animate: true });
    }
  }, [mapCenter, mapZoom, subjectLocation, rirPoints]);

  useEffect(() => {
    const fetchIsochrone = async () => {
      try {
        const origin = subjectLocation || { lat: mapCenter[0], lng: mapCenter[1] };
        if (!origin?.lat || !origin?.lng) {
          setIsochrone(null);
          return;
        }
        
        console.log(`Fetching isochrone for ${selectedDriveTime} minutes...`);
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/driving/${origin.lng},${origin.lat}?contours_minutes=${selectedDriveTime}&polygons=true&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn('Isochrone fetch failed:', res.status);
          setIsochrone(null);
          return;
        }
        const gj = await res.json();
        console.log(`Isochrone loaded for ${selectedDriveTime} minutes:`, gj);
        setIsochrone(gj);
      } catch (e) {
        console.warn('Isochrone fetch error:', e);
        setIsochrone(null);
      }
    };

    fetchIsochrone();
  }, [subjectLocation, mapCenter, selectedDriveTime]);

  if (!hasMarketData) {
    if (isLoading) {
      return <LoadingState propertyLocation={propertyLocation} />;
    }
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
              <div key={card.title} className="relative bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 p-4 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500" />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center border border-sky-100 shadow-inner"><Shield size={16} className="text-sky-500" /></div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{card.title}</div>
                      <div className="text-[11px] text-gray-500">{card.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-red-600">{fmtPercentFromFraction(card.rir ?? 0)}</div>
                </div>
                <div className="mt-2 text-[11px] text-gray-600">Rent-to-Income Ratio (RIR) <span className="text-gray-400">{meta.score}</span></div>
                <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400" style={{ width: `${Math.min(Math.max(((card.rir ?? 0) * 100), 6), 70)}%` }} />
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
        </div>

        {/* Leaflet Heat Map (county FMR choropleth + ZIP RIR overlay) */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
          <style>{`
            .leaflet-container .leaflet-tooltip-pane {
              z-index: 1100 !important;
            }
            .leaflet-container .leaflet-overlay-pane {
              z-index: 400 !important;
            }
          `}</style>
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

              {countyGeoJson && mapMode === 'counties' && (() => {
                console.log('🗺️ RENDERING COUNTY GEOJSON');
                console.log('  countyGeoJson exists:', !!countyGeoJson);
                console.log('  mapMode:', mapMode);
                console.log('  propertyCountyFips:', propertyCountyFips);
                console.log('  fmrByCounty count:', Object.keys(fmrByCounty).length);
                return (
                  <GeoJSON
                    key={`county-${propertyCountyFips}`}
                    data={countyGeoJson}
                    style={(feature) => {
                      const fips = feature?.id;
                      const fmrRow = fmrByCounty[fips];
                      const val = fmrRow?.fmr2;
                      const isPropertyCounty = fips === propertyCountyFips;
                      if (isPropertyCounty) {
                        console.log('⭐ HIGHLIGHTING PROPERTY COUNTY:', fips, fmrRow);
                      }
                      return { 
                        fillColor: fmrColor(val), 
                        weight: isPropertyCounty ? 3 : 0.6, 
                        color: isPropertyCounty ? '#2563eb' : '#ffffff', 
                        fillOpacity: isPropertyCounty ? 0.35 : 0.82, 
                        opacity: isPropertyCounty ? 1 : 0.35 
                      };
                    }}
                  onEachFeature={(feature, layer) => {
                    const fips = feature?.id;
                    const fmrRow = fmrByCounty[fips];
                    const isPropertyCounty = fips === propertyCountyFips;
                    if (fmrRow) {
                      const rent = fmrRow.fmr2;
                      layer.bindTooltip(
                        `<div style="font-size:12px;color:#111"><div style="font-weight:700">${fmrRow.county || 'County'}, ${fmrRow.state || ''}${isPropertyCounty ? ' <span style="color:#2563eb">★ Your Property</span>' : ''}</div><div>HUD FMR (2BR): ${rent ? `$${Math.round(rent).toLocaleString()}` : 'N/A'}</div><div style="color:#6b7280">FIPS: ${fips}</div></div>`,
                        { sticky: true }
                      );
                    }

                    // Click to select county and surface metrics
                    layer.on('click', () => {
                      const payload = fmrRow || { note: 'No county FMR data available' };
                      setSelectedFeature({ type: 'county', id: fips, data: payload, source: fmrRow ? 'county_fmr' : 'none' });
                      if (!fmrRow && subjectLocation) {
                        // fallback: nearest zip with data
                        const nearest = findNearestZipWithData(subjectLocation.lat, subjectLocation.lng, fmrData);
                        if (nearest) setSelectedFeature({ type: 'zip', id: nearest.zip, data: nearest.data, source: 'nearest_zip' });
                      }
                    });
                  }}
                  />
                );
              })()}

              {isochrone && (
                <GeoJSON
                  key={`isochrone-${selectedDriveTime}`}
                  data={isochrone}
                  style={() => ({ fillColor: '#3b82f6', color: '#1d4ed8', weight: 2, fillOpacity: 0.22, opacity: 0.6 })}
                />
              )}

              {heatPoints.length > 0 && heatMetric === 'rir' && (
                <HeatLayer points={heatPoints} heatMetric={heatMetric} />
              )}

              {heatMetric === 'fmr' && Object.keys(zipCentroids).length > 0 && Object.keys(fmrData).length > 0 && (() => {
                console.log('📍 RENDERING FMR MARKERS');
                return (
                  <ZipDataMarkers 
                    zipCentroids={zipCentroids}
                    fmrData={fmrData}
                    migrationData={migrationData}
                    metric="fmr"
                  />
                );
              })()}

              {heatMetric === 'migration' && Object.keys(zipCentroids).length > 0 && Object.keys(migrationData).length > 0 && (() => {
                console.log('🚶 RENDERING MIGRATION MARKERS');
                return (
                  <ZipDataMarkers 
                    zipCentroids={zipCentroids}
                    fmrData={fmrData}
                    migrationData={migrationData}
                    metric="migration"
                  />
                );
              })()}

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
            <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-[1000] pointer-events-auto">
              <div className="bg-white/95 backdrop-blur rounded-full shadow-sm border px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                <select
                  value={selectedDriveTime}
                  onChange={(e) => handleDriveTimeChange(Number(e.target.value))}
                  className="bg-transparent border-none outline-none font-semibold cursor-pointer"
                >
                  <option value={5}>5-min</option>
                  <option value={10}>10-min</option>
                  <option value={15}>15-min</option>
                  <option value={20}>20-min</option>
                  <option value={30}>30-min</option>
                </select>
                <span>Drive</span>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-full shadow-sm border px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <label className="text-xs mr-2">ZIP Heat</label>
                <input type="checkbox" checked={showZipHeat} onChange={() => setShowZipHeat((s) => !s)} />
              </div>
            </div>

            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex justify-center z-[1000] pointer-events-auto">
              <div className="flex flex-wrap gap-2 items-center bg-white/95 backdrop-blur border border-gray-200 rounded-full px-3 py-2 shadow-md">
                <div className="flex gap-2">
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
                <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
                  <span className="text-gray-600 text-xs">Heat</span>
                  <select
                    value={heatMetric}
                    onChange={(e) => setHeatMetric(e.target.value)}
                    className="text-gray-900 text-xs border rounded px-2 py-1 bg-white shadow-inner"
                  >
                    <option value="rir">Rent-to-Income</option>
                    <option value="affordability">Affordability</option>
                    <option value="fmr">Fair Market Rent</option>
                    <option value="migration">Migration Rate</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="absolute top-3 right-3 w-72 bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-3 z-[1000] pointer-events-auto">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500">Analysis Area</div>
                  <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {drive_time_minutes}-min Drive</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Market Metrics</div>
              </div>

            {/* Selected metrics panel */}
            {selectedFeature && (
              <div className="absolute top-28 right-3 w-80 bg-white rounded-xl shadow-lg border border-gray-100 p-4 space-y-3 z-[1200]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Selected {selectedFeature.type?.toUpperCase()}</div>
                  <button className="text-xs text-gray-500" onClick={() => setSelectedFeature(null)}>Close</button>
                </div>
                <div className="text-xs text-gray-600">
                  {selectedFeature.source === 'none' && <div className="text-red-600">No direct data available — showing fallback where possible</div>}
                  {selectedFeature.type === 'county' && selectedFeature.data && (
                    <div>
                      <div className="font-semibold">{selectedFeature.data.county || 'County'}</div>
                      <div>FMR (2BR): {selectedFeature.data.fmr2 ? `$${Math.round(selectedFeature.data.fmr2).toLocaleString()}` : 'N/A'}</div>
                    </div>
                  )}
                  {selectedFeature.type === 'zip' && selectedFeature.data && (
                    <div>
                      <div className="font-semibold">ZIP {selectedFeature.id}</div>
                      {selectedFeature.data.fmr2 && <div>FMR (2BR): ${Math.round(selectedFeature.data.fmr2).toLocaleString()}</div>}
                      {selectedFeature.data.migrationRate !== undefined && <div>Migration (‰): {selectedFeature.data.migrationRate}</div>}
                      {selectedFeature.data.population2021 && <div>Population: {selectedFeature.data.population2021.toLocaleString()}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
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

            <div className="absolute bottom-4 left-3 bg-white/95 backdrop-blur rounded-xl shadow-md border border-gray-100 p-4 w-72 z-[1000] pointer-events-auto">
              <div className="flex items-center justify-between mb-3 text-sm font-semibold text-gray-900">
                <span>
                  {heatMetric === 'fmr' ? 'Fair Market Rent (2BR)' :
                   heatMetric === 'migration' ? 'Migration Rate' :
                   heatMetric === 'rir' ? 'Rent-to-Income Ratio' : 'Affordability'}
                </span>
                <div className="flex gap-2 text-xs text-gray-500">
                  {mapMode === 'counties' && <span className="px-2 py-1 rounded-full border bg-gray-50">Counties</span>}
                  <span className="px-2 py-1 rounded-full border bg-white">ZIP Heat</span>
                </div>
              </div>
              
              {(heatMetric === 'fmr' || mapMode === 'counties') && (
                <div className="space-y-2 text-xs text-gray-700 mb-3">
                  {DOLLAR_SCALE.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: r.color }}></span>
                      <span>{r.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-gray-500"><span className="inline-block w-3 h-3 rounded bg-gray-200" /> No data</div>
                </div>
              )}
              
              {heatMetric === 'migration' && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-4 rounded" style={{ background: 'linear-gradient(to right, #dc2626, #f59e0b, #eab308, #84cc16, #16a34a, #059669)' }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>Outflow</span>
                    <span>Neutral</span>
                    <span>Inflow</span>
                  </div>
                </div>
              )}
              
              {(heatMetric === 'rir' || heatMetric === 'affordability') && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-4 rounded" style={{ 
                      background: heatMetric === 'affordability' 
                        ? 'linear-gradient(to right, #e0f2fe, #bfdbfe, #2563eb, #1e3a8a)'
                        : 'linear-gradient(to right, #fff1f2, #fecdd3, #ef4444, #991b1b)'
                    }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>{heatMetric === 'affordability' ? 'Less Affordable' : 'Low RIR'}</span>
                    <span>{heatMetric === 'affordability' ? 'More Affordable' : 'High RIR'}</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 text-[11px] text-gray-600 border-t pt-3">
                <div className="flex items-start gap-2">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {heatMetric === 'fmr' ? 'ZIP colors show HUD Fair Market Rent for 2-bedroom units.' :
                     heatMetric === 'migration' ? 'Heat shows net migration rate per 1,000 population.' :
                     heatMetric === 'rir' ? 'Higher rent-to-income ratio appears hotter (red).' :
                     'Lower RIR appears hotter (more room for rent growth).'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demographic Metrics Grid (matching reference design) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Analysis Area</div>
              <div className="text-base font-bold text-gray-900">{drive_time_minutes}-min Drive</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full border bg-blue-50 text-blue-700 font-semibold">Market Metrics</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Population */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Population</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{fmt(safeAggregations.population)}</div>
            <div className="text-xs text-blue-600 font-semibold">High</div>
            <div className="text-[10px] text-gray-500 mt-2">
              {(() => {
                const countyPop = county_data?.population || 0;
                if (countyPop > 0) {
                  const diff = ((safeAggregations.population - countyPop) / countyPop * 100).toFixed(1);
                  return `${diff}% vs region average of ${fmt(Math.round(countyPop))} per sq`;
                }
                return 'Area population density';
              })()}
            </div>
          </div>

          {/* Growth */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Growth</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
            <div className="text-xs text-red-600 font-semibold">{localPopGrowthPct < 0 ? 'Low' : 'High'}</div>
            <div className="text-[10px] text-gray-500 mt-2">
              Yearly Population Growth compared to Texas average of 1.2%
            </div>
          </div>

          {/* Households */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <HomeIcon size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Households</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{fmt(Math.round(households))}</div>
            <div className="text-xs text-blue-600 font-semibold">High</div>
            <div className="text-[10px] text-gray-500 mt-2">
              388 households per 1,000 people, compared to Texas average of 383
            </div>
          </div>

          {/* Single Family */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <HomeIcon size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Single Family</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">60,142</div>
            <div className="text-xs text-red-600 font-semibold">Low</div>
            <div className="text-[10px] text-gray-500 mt-2">
              105.2 homes per 1,000 people, compared to Texas average of 268.7
            </div>
          </div>

          {/* Income */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Income</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{fmtCurrency(safeAggregations.median_income)}</div>
            <div className="text-xs text-blue-600 font-semibold">High</div>
            <div className="text-[10px] text-gray-500 mt-2">
              Median Household Income compared to Texas average of ${aggregations?.comparisons?.income_state ? Math.round(aggregations.comparisons.income_state).toLocaleString() : '63,799'}
            </div>
          </div>

          {/* Businesses */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Businesses</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{fmt(aggregations?.businesses ?? 17476)}</div>
            <div className="text-xs text-blue-600 font-semibold">High</div>
            <div className="text-[10px] text-gray-500 mt-2">
              31 businesses per 1,000 people, compared to Texas average of 15
            </div>
          </div>

          {/* Walk Score */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Walk Score</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{aggregations?.walk_score ?? 70}</div>
            <div className="text-xs text-gray-600 font-semibold">Average</div>
            <div className="text-[10px] text-gray-500 mt-2">
              This area is somewhat walkable. The national average is 48, based on 100 point scale.
            </div>
          </div>

          {/* Affordability */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Percent size={18} className="text-blue-600" />
              <span className="text-xs font-semibold text-gray-600">Affordability</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">{safeAggregations.affordability}</div>
            <div className="text-xs text-blue-600 font-semibold">Rent ${fmtCurrency(safeAggregations.median_rent)}/mo</div>
            <div className="text-[10px] text-gray-500 mt-2">
              Rent-to-income ratio shows market affordability
            </div>
          </div>
        </div>
      </div>

      {/* Market Comparison with charts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-6 bg-blue-600 rounded-full" />
          <h3 className="text-xl font-bold text-gray-900">Market Comparison</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6 ml-7">Local Area vs. State & National Averages</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Median Household Income Chart */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info size={16} className="text-blue-600" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">Median Household Income</div>
                <div className="text-xs text-gray-600">Annual household earnings comparison</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-900 mb-3 ml-11">
              The {drive_time_minutes} minute drive time area has a median household income of <span className="font-bold">{fmtCurrency(safeAggregations.median_income)}</span>
            </div>
            
            <div className="text-xs text-gray-700 space-y-1 mb-4 ml-11">
              {(() => {
                const cityDiff = aggregations?.comparisons?.income_city ? ((safeAggregations.median_income - aggregations.comparisons.income_city) / aggregations.comparisons.income_city * 100) : null;
                const stateDiff = aggregations?.comparisons?.income_state ? ((safeAggregations.median_income - aggregations.comparisons.income_state) / aggregations.comparisons.income_state * 100) : null;
                const usaDiff = aggregations?.comparisons?.income_usa ? ((safeAggregations.median_income - aggregations.comparisons.income_usa) / aggregations.comparisons.income_usa * 100) : null;
                return (
                  <>
                    {cityDiff !== null && (
                      <div>This is <span className={cityDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(cityDiff).toFixed(1)}% {cityDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">{city?.name || 'City'}</span> (closest city) average ({fmtCurrency(aggregations.comparisons.income_city)}).</div>
                    )}
                    {stateDiff !== null && (
                      <div>This is <span className={stateDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(stateDiff).toFixed(1)}% {stateDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">State</span> average ({fmtCurrency(aggregations.comparisons.income_state)}) and <span className={usaDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(usaDiff || 0).toFixed(1)}% {(usaDiff || 0) >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">USA</span> average ({fmtCurrency(aggregations.comparisons.income_usa || 0)}).</div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-3 mb-3 ml-11 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#4f46e5]" />
                <span className="text-gray-700">Local Area: {fmtCurrency(safeAggregations.median_income)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#818cf8]" />
                <span className="text-gray-700">{city?.name || 'City'}: {fmtCurrency(aggregations?.comparisons?.income_city || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#a5b4fc]" />
                <span className="text-gray-700">State: {fmtCurrency(aggregations?.comparisons?.income_state || 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#c7d2fe]" />
                <span className="text-gray-700">USA: {fmtCurrency(aggregations?.comparisons?.income_usa || 0)}</span>
              </div>
            </div>
            
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[
                    { name: 'Median Household Income', 
                      local: safeAggregations.median_income, 
                      city: aggregations?.comparisons?.income_city || 0,
                      state: aggregations?.comparisons?.income_state || 0,
                      usa: aggregations?.comparisons?.income_usa || 0
                    }
                  ]} 
                  margin={{ top: 10, right: 20, left: 20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `$${Math.round(v/1000)}k`} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(v) => fmtCurrency(v)} 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="local" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="city" fill="#818cf8" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="state" fill="#a5b4fc" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="usa" fill="#c7d2fe" radius={[8, 8, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Population Growth Chart */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info size={16} className="text-blue-600" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">Population Growth</div>
                <div className="text-xs text-gray-600">Annual population change trends</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-900 mb-3 ml-11">
              The {drive_time_minutes} minute drive time area has an annual population growth rate of <span className="font-bold">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</span>
            </div>
            
            <div className="text-xs text-gray-700 space-y-1 mb-4 ml-11">
              {(() => {
                const cityDiff = aggregations?.comparisons?.pop_growth_city !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_city) : null;
                const stateDiff = aggregations?.comparisons?.pop_growth_state !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_state) : null;
                const usaDiff = aggregations?.comparisons?.pop_growth_usa !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_usa) : null;
                return (
                  <>
                    {cityDiff !== null && (
                      <div>This is <span className={cityDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(cityDiff).toFixed(1)}% {cityDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">{city?.name || 'City'}</span> (closest city) average</div>
                    )}
                    {stateDiff !== null && (
                      <div>This is <span className={stateDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(stateDiff).toFixed(1)}% {stateDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">State</span> average and <span className={usaDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(usaDiff || 0).toFixed(1)}% {(usaDiff || 0) >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">USA</span> average</div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-3 mb-3 ml-11 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#4f46e5]" />
                <span className="text-gray-700">Local Area: {localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#818cf8]" />
                <span className="text-gray-700">{city?.name || 'City'}: {aggregations?.comparisons?.pop_growth_city !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_city) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#a5b4fc]" />
                <span className="text-gray-700">State: {aggregations?.comparisons?.pop_growth_state !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_state) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#c7d2fe]" />
                <span className="text-gray-700">USA: {aggregations?.comparisons?.pop_growth_usa !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_usa) : 'N/A'}</span>
              </div>
            </div>
            
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[
                    { name: 'Population Growth', 
                      local: localPopGrowthPct || 0, 
                      city: aggregations?.comparisons?.pop_growth_city || 0,
                      state: aggregations?.comparisons?.pop_growth_state || 0,
                      usa: aggregations?.comparisons?.pop_growth_usa || 0
                    }
                  ]} 
                  margin={{ top: 10, right: 20, left: 20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `${v.toFixed(1)}%`} axisLine={false} tickLine={false} />
                  <Tooltip 
                    formatter={(v) => fmtPercent(v)} 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                  <Bar dataKey="local" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="city" fill="#818cf8" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="state" fill="#a5b4fc" radius={[8, 8, 0, 0]} barSize={60} />
                  <Bar dataKey="usa" fill="#c7d2fe" radius={[8, 8, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Housing Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-blue-600 rounded-full" />
          <h3 className="text-xl font-bold text-gray-900">Housing Market</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">Median Home Value</div>
            <div className="text-3xl font-bold text-gray-900">{county_data.median_home_value ? fmtCurrency(county_data.median_home_value) : 'N/A'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">Median Gross Rent</div>
            <div className="text-3xl font-bold text-gray-900">{fmtCurrency(safeAggregations.median_rent)}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">Owner-Occupied Rate</div>
            <div className="text-3xl font-bold text-gray-900">{fmtPercent(county_data.owner_occupied_rate || 0)}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">FMR (2BR)</div>
            <div className="text-3xl font-bold text-gray-900">{fmtCurrency(fmr?.fmr_2br || 0)}</div>
            <div className="text-xs text-gray-500">ZIP {fmr?.zip || zipCode || ''}</div>
          </div>
        </div>
      </div>

      {/* Migration Data */}
      {zip_data && zip_data.net_migration !== undefined && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            <h3 className="text-xl font-bold text-gray-900">Migration Trends</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Net Migration</div>
              <div className={`text-3xl font-bold ${zip_data.net_migration >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {zip_data.net_migration >= 0 ? '+' : ''}{fmt(Math.round(zip_data.net_migration))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Net Per Capita</div>
              <div className="text-3xl font-bold text-gray-900">{zip_data.net_migration_per_capita?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">In-Migration</div>
              <div className="text-3xl font-bold text-blue-600">{fmt(Math.round(zip_data.in_migration || 0))}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Out-Migration</div>
              <div className="text-3xl font-bold text-orange-600">{fmt(Math.round(zip_data.out_migration || 0))}</div>
            </div>
          </div>
        </div>
      )}

      {/* MSA Construction Data */}
      {(msa_data && msa_data.msa_name) || (msa_units && (msa_units.ytd_5plus_units || msa_units.ytd_total_units)) ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            <h3 className="text-xl font-bold text-gray-900">Multifamily Construction Activity</h3>
          </div>
          {msa_data?.msa_name && <p className="text-sm text-gray-600 mb-6">{msa_data.msa_name}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">YTD Total Permits</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(msa_data?.ytd_total_units || msa_units?.ytd_total_units || 0)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">YTD 5+ Unit Buildings</div>
              <div className="text-3xl font-bold text-blue-600">{fmt(msa_data?.ytd_5plus_units || msa_units?.ytd_5plus_units || 0)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Current Month Permits</div>
              <div className="text-3xl font-bold text-green-600">{msa_data?.current_month_units || msa_units?.current_month_units ? fmt(msa_data.current_month_units || msa_units.current_month_units) : 'N/A'}</div>
            </div>
          </div>
          {(msa_units?.absorption_units !== undefined || msa_units?.absorption_rate !== undefined) && (
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500">Absorption Units (proxy)</div>
                <div className="text-3xl font-bold text-gray-900">{fmt(Math.round(msa_units.absorption_units || 0))}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500">Absorption Rate</div>
                <div className="text-3xl font-bold text-gray-900">{msa_units.absorption_rate !== undefined ? fmtPercent(msa_units.absorption_rate * 100) : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Employment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-blue-600 rounded-full" />
          <h3 className="text-xl font-bold text-gray-900">Employment</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">Unemployment Rate</div>
            <div className={`text-3xl font-bold ${county_data.unemployment_rate < 5 ? 'text-green-600' : county_data.unemployment_rate < 7 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fmtPercent(county_data.unemployment_rate)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-500">Labor Force Health</div>
            <div className="text-base text-gray-700 mt-1">
              {county_data.unemployment_rate < 5 ? 'Strong labor market with low unemployment' : county_data.unemployment_rate < 7 ? 'Moderate labor market conditions' : 'Elevated unemployment levels'}
            </div>
          </div>
        </div>
      </div>

      {/* Landlord & Zip Renter/Owner */}
      {(zip_renter_owner && (zip_renter_owner.renter_share !== undefined || zip_renter_owner.owner_share !== undefined)) || (aggregations.businesses || aggregations.walk_score) ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-blue-600 rounded-full" />
            <h3 className="text-xl font-bold text-gray-900">Local Housing Profile</h3>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Renter Share</div>
              <div className="text-3xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.renter_share ?? 0)}</div>
              <div className="text-xs text-gray-500">{fmt(Math.round(zip_renter_owner?.renter_count ?? 0))} renters</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Owner Share</div>
              <div className="text-3xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.owner_share ?? 0)}</div>
              <div className="text-xs text-gray-500">{fmt(Math.round(zip_renter_owner?.owner_count ?? 0))} owners</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">Businesses</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
              <div className="text-xs text-gray-500">Walk Score: {aggregations?.walk_score ?? 'N/A'}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Wrap MarketResearchTab with ErrorBoundary to avoid blank screens
export default function MarketResearchTabWrapper(props) {
  return (
    <ErrorBoundary>
      <MarketResearchTab {...props} />
    </ErrorBoundary>
  );
}
