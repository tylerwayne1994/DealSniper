import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Papa from 'papaparse';
import { Building2, DollarSign, TrendingUp, MapPin, User, Phone, Mail, Home, GraduationCap, Hospital, Briefcase, X } from 'lucide-react';
import { loadPipelineDeals, deleteDeal, duplicateDeal } from '../lib/dealsService';
import { PipelineTable } from './tables';
import { geocodeAddress } from '../utils/geocode';
import 'mapbox-gl/dist/mapbox-gl.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';
const TIGERWEB_ZCTA_URL = `${API_URL}/api/tigerweb/zcta`;

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

function spreadOverlappingProperties(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const spread = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      spread.push(group[0]);
      return;
    }

    group.forEach((item, idx) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      const angle = idx * 2.399963229728653; // golden angle
      const radiusDeg = 0.00035 * Math.sqrt(idx + 1);
      const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      const dLat = radiusDeg * Math.cos(angle);
      const dLng = (radiusDeg * Math.sin(angle)) / cosLat;

      spread.push({
        ...item,
        _originalLatitude: lat,
        _originalLongitude: lng,
        latitude: lat + dLat,
        longitude: lng + dLng,
      });
    });
  });

  return spread;
}

function HomeMapView() {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [showPOIs, setShowPOIs] = useState({
    schools: false,
    hospitals: false,
    transit: false
  });
  const [distanceFilter, setDistanceFilter] = useState(5); // miles

  const markersRef = useRef([]);
  const [pipelineDeals, setPipelineDeals] = useState([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(true);

  // SFR & MF Sales heatmap state
  const [sfrEnabled, setSfrEnabled] = useState(false);
  const [mfEnabled, setMfEnabled] = useState(false);

  // Data Centers layer state
  const [dataCentersEnabled, setDataCentersEnabled] = useState(false);
  const [dataCenters, setDataCenters] = useState([]);
  const dcMarkersRef = useRef([]);
  const dcPopupRef = useRef(null);
  const sfrDataRef = useRef(null);   // { [zip5]: { price, yoy, momentum, city, state, metro } }
  const mfDataRef = useRef(null);    // { [zip5]: { pricePerUnit, capRate, yoy, trend, city, state } }
  const zctaGeoCache = useRef({});   // { [boundsKey]: GeoJSON features[] }
  const sfrLayerAdded = useRef(false);
  const mfLayerAdded = useRef(false);

  // Sample deals for when database is empty (matches PipelinePage)
  const sampleDeals = [
    {
      dealId: 'sample-001',
      address: '1250 Oakwood Gardens, Dallas, TX 75201',
      units: 48,
      purchasePrice: 3200000,
      dayOneCashFlow: 4250,
      stabilizedCashFlow: 8500,
      refiValue: 4800000,
      cashOutRefiAmount: 1200000,
      userTotalInPocket: 850000,
      postRefiCashFlow: 6200,
      brokerName: 'Marcus Johnson',
      brokerPhone: '(214) 555-0187',
      brokerEmail: 'marcus.j@realtypros.com',
      dealStructure: 'Seller Financing',
      pushedAt: '2025-12-01T10:30:00Z',
      latitude: 32.7767,
      longitude: -96.7970
    },
    {
      dealId: 'sample-002',
      address: '875 Sunrise MHP, Austin, TX 78745',
      units: 72,
      purchasePrice: 5500000,
      dayOneCashFlow: 7800,
      stabilizedCashFlow: 14500,
      refiValue: 8200000,
      cashOutRefiAmount: 2100000,
      userTotalInPocket: 1450000,
      postRefiCashFlow: 11200,
      brokerName: 'Sarah Chen',
      brokerPhone: '(512) 555-0234',
      brokerEmail: 'schen@capitalbrokers.com',
      dealStructure: 'Bank Loan + Equity Partner',
      pushedAt: '2025-12-05T14:15:00Z',
      latitude: 30.2672,
      longitude: -97.7431
    }
  ];

  console.log('HomeMapView rendering, properties:', properties.length);

  // Load deals from pipeline
  useEffect(() => {
    const loadDeals = async () => {
      setIsLoadingPipeline(true);
      try {
        console.log('🔍 [HOME] Loading pipeline deals...');
        const deals = await loadPipelineDeals();
        console.log('📦 [HOME] Loaded deals:', deals);
        console.log('📊 [HOME] Number of deals:', deals.length);
        
        // Use sample deals if database is empty (matches PipelinePage behavior)
        const dealsToUse = Array.isArray(deals) && deals.length > 0 ? deals : sampleDeals;
        console.log('📋 [HOME] Using deals:', dealsToUse.length, 'sample:', deals.length === 0);
        
        // ALWAYS set pipeline deals even if empty - table needs to know
        setPipelineDeals(dealsToUse);
        
        if (!dealsToUse || dealsToUse.length === 0) {
          console.warn('⚠️ [HOME] No pipeline deals found in database');
          setProperties([]);
          setLoading(false);
          setIsLoadingPipeline(false);
          return;
        }

        // If all deals already have coordinates (e.g., sample deals), skip geocoding and render immediately
        const allHaveCoords = dealsToUse.every(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
        if (allHaveCoords) {
          console.log('✅ [HOME] All deals have coordinates; rendering markers without geocoding');
          setProperties(dealsToUse);
          setLoading(false);
          setIsLoadingPipeline(false);
          return;
        }
        
        // Geocode deals that don't have coordinates yet
        const geocodedDeals = await Promise.all(
          dealsToUse.map(async (deal) => {
            console.log('🏠 [HOME] Processing deal:', deal.address, 'lat:', deal.latitude, 'lng:', deal.longitude);
            // Use saved coordinates if available
            if (deal.latitude && deal.longitude) {
              console.log('✅ [HOME] Using saved coordinates for:', deal.address);
              return deal;
            }
            
            // Otherwise geocode (only happens once per property)
            console.log('🌍 [HOME] Geocoding:', deal.address);
            const coords = await geocodeAddress(deal.address);
            if (coords) {
              console.log('✅ [HOME] Geocoded:', deal.address, coords);
              // Save coordinates to database to avoid re-geocoding
              try {
                const { updateDeal } = await import('../lib/dealsService');
                await updateDeal(deal.dealId, {
                  latitude: coords.latitude,
                  longitude: coords.longitude
                });
                console.log('💾 [HOME] Saved coordinates to database for:', deal.address);
              } catch (saveError) {
                console.error('❌ [HOME] Failed to save coordinates:', saveError);
              }
            } else {
              console.log('❌ [HOME] Failed to geocode:', deal.address);
            }
            return {
              ...deal,
              longitude: coords?.longitude,
              latitude: coords?.latitude
            };
          })
        );
        
        console.log('🗺️ [HOME] All geocoded deals:', geocodedDeals);
        // Filter out deals without valid coordinates FOR MAP ONLY
        const validDeals = geocodedDeals.filter(deal => Number.isFinite(deal.longitude) && Number.isFinite(deal.latitude));
        console.log('✅ [HOME] Valid geocoded deals for map:', validDeals.length, validDeals);
        setProperties(validDeals);
        setLoading(false);
      } catch (error) {
        console.error('❌ [HOME] Error loading deals:', error);
        console.error('❌ [HOME] Error stack:', error.stack);
        // Fallback: show sample deals so the map isn't empty
        console.warn('⚠️ [HOME] Falling back to sample deals due to error');
        setProperties(sampleDeals);
        // Don't clear pipelineDeals on error - keep what we have
        setLoading(false);
      } finally {
        setIsLoadingPipeline(false);
      }
    };
    
    loadDeals();

    // Listen for pipeline updates from other components
    const handlePipelineUpdate = () => {
      console.log('🔄 Pipeline updated, reloading deals...');
      loadDeals();
    };
    window.addEventListener('pipelineDealsUpdated', handlePipelineUpdate);

    return () => {
      window.removeEventListener('pipelineDealsUpdated', handlePipelineUpdate);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) {
      console.error('Map container ref is null!');
      return;
    }

    console.log('Initializing map...');
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283],
        zoom: 3.5
      });

      // Mark map as ready immediately so markers can render
      // even if the 'load' event is delayed.
      if (!mapReady) {
        console.log('🟢 Map instance created, setting mapReady=true');
        setMapReady(true);
      }

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl());

      map.current.on('load', () => {
        console.log('✅ Map loaded successfully!');
        
        // Add Mapbox POI layers (FREE - no geocoding needed!)
        // These use Mapbox's built-in place data
        addPOILayers();

        // Signal that map is ready (redundant safeguard)
        if (!mapReady) setMapReady(true);
      });

      map.current.on('error', (e) => {
        console.error('❌ Map error:', e);
      });
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        setMapReady(false);
        console.log('Cleaning up map');
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add POI layers using Mapbox's built-in data
  const addPOILayers = () => {
    if (!map.current) return;

    // Add custom symbols for schools
    map.current.addLayer({
      id: 'poi-schools',
      type: 'symbol',
      source: 'composite',
      'source-layer': 'poi_label',
      filter: ['==', ['get', 'type'], 'school'],
      layout: {
        'icon-image': 'school-15',
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1],
        'icon-allow-overlap': false,
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#4338ca',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    map.current.setLayoutProperty('poi-schools', 'visibility', 'none');

    // Add hospitals
    map.current.addLayer({
      id: 'poi-hospitals',
      type: 'symbol',
      source: 'composite',
      'source-layer': 'poi_label',
      filter: ['==', ['get', 'type'], 'hospital'],
      layout: {
        'icon-image': 'hospital-15',
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1]
      },
      paint: {
        'text-color': '#dc2626',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    map.current.setLayoutProperty('poi-hospitals', 'visibility', 'none');

    // Add transit
    map.current.addLayer({
      id: 'poi-transit',
      type: 'symbol',
      source: 'composite',
      'source-layer': 'poi_label',
      filter: ['match', ['get', 'type'], ['bus_station', 'train_station', 'subway', 'light_rail'], true, false],
      layout: {
        'icon-image': 'rail-15',
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-anchor': 'top',
        'text-offset': [0, 1]
      },
      paint: {
        'text-color': '#059669',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    map.current.setLayoutProperty('poi-transit', 'visibility', 'none');
  };

  // Toggle POI layers
  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;

    Object.entries(showPOIs).forEach(([type, visible]) => {
      const layerId = `poi-${type}`;
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }, [showPOIs]);

  // ─── SFR / MF Heatmap helpers ───
  const zeroZip = (z) => {
    if (z == null) return null;
    const s = String(z).replace(/[^0-9]/g, '');
    return s.padStart(5, '0');
  };

  const sfrColor = (price) => {
    if (price == null) return '#e5e7eb';
    if (price < 150000)  return '#16a34a';
    if (price < 250000)  return '#84cc16';
    if (price < 400000)  return '#eab308';
    if (price < 600000)  return '#f59e0b';
    return '#dc2626';
  };

  const mfColor = (pricePerUnit) => {
    if (pricePerUnit == null) return '#e5e7eb';
    if (pricePerUnit < 60000)  return '#7dd3fc';
    if (pricePerUnit < 100000) return '#38bdf8';
    if (pricePerUnit < 150000) return '#0ea5e9';
    if (pricePerUnit < 200000) return '#0284c7';
    return '#1e3a5f';
  };

  // Load SFR CSV data
  const loadSfrData = useCallback(() => {
    if (sfrDataRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      Papa.parse('/SFR_Median_Sale_Price_by_ZIP_24mo.csv', {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => {
          const data = {};
          results.data.forEach(r => {
            const zip = zeroZip(r.ZIP_Code);
            if (!zip) return;
            const price = parseFloat(r.SFR_MedianSalePrice_Latest);
            if (isNaN(price) || price <= 0) return;
            data[zip] = {
              price: Math.round(price),
              yoy: parseFloat(r.SFR_YoY_PriceChange_Pct) || null,
              twoYr: parseFloat(r.SFR_2Yr_PriceChange_Pct) || null,
              tier: r.SFR_Price_Tier || '',
              momentum: r.SFR_Market_Momentum || '',
              city: r.City || '', state: r.State || '', metro: r.Metro || '',
              county: r.CountyName || '',
            };
          });
          sfrDataRef.current = data;
          console.log(`[SFR Heatmap] Loaded ${Object.keys(data).length} ZIPs`);
          resolve();
        },
        error: (err) => { console.error('[SFR] CSV parse error:', err); resolve(); }
      });
    });
  }, []);

  // Load MF CSV data
  const loadMfData = useCallback(() => {
    if (mfDataRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      Papa.parse('/Multifamily_Sale_Metrics_by_ZIP_MF_Markets_24mo.csv', {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => {
          const data = {};
          results.data.forEach(r => {
            const zip = zeroZip(r.ZIP_Code);
            if (!zip) return;
            const ppu = parseFloat(r.MF_MedianSalePrice_PerUnit_Latest);
            if (isNaN(ppu) || ppu <= 0) return;
            data[zip] = {
              pricePerUnit: Math.round(ppu),
              capRate: parseFloat(r.MF_CapRate_At_Sale_Pct) || null,
              priceSF: parseFloat(r.MF_Price_PerSF) || null,
              yoy: parseFloat(r.MF_YoY_PriceChange_Pct) || null,
              twoYr: parseFloat(r.MF_24Mo_PriceChange_Pct) || null,
              trend: r.MF_Price_Trend || '',
              marketType: r.Market_Type || '',
              grm: parseFloat(r.MF_GrossRentMultiplier) || null,
              volume: parseInt(r.MF_Sale_Volume_Annual_Deals) || null,
              avgSize: parseInt(r.MF_Avg_Building_Size_Units) || null,
              city: r.City || '', state: r.State || '', metro: r.Metro_MSA || '',
              county: r.County || '',
              medianRent: parseFloat(r.Median_Gross_Rent_Monthly) || null,
              renterShare: parseFloat(r.Renter_Share_Pct) || null,
            };
          });
          mfDataRef.current = data;
          console.log(`[MF Heatmap] Loaded ${Object.keys(data).length} ZIPs`);
          resolve();
        },
        error: (err) => { console.error('[MF] CSV parse error:', err); resolve(); }
      });
    });
  }, []);

  // Fetch ZCTA polygon boundaries for visible map bounds
  const fetchZctaBounds = useCallback(async (bounds) => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const geom = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    if (zctaGeoCache.current[geom]) return zctaGeoCache.current[geom];
    const params = new URLSearchParams({
      where: '1=1', geometryType: 'esriGeometryEnvelope', geometry: geom,
      inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'GEOID,BASENAME', returnGeometry: 'true', f: 'geojson', resultRecordCount: '500',
    });
    try {
      const res = await fetch(`${TIGERWEB_ZCTA_URL}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geo = await res.json();
      const features = geo.features || [];
      zctaGeoCache.current[geom] = features;
      return features;
    } catch (err) {
      console.error('[ZCTA fetch]', err); return [];
    }
  }, []);

  // Build or update a heatmap layer on the Mapbox map
  const renderHeatmapLayer = useCallback(async (layerId, dataRef, colorFn, buildPopup) => {
    if (!map.current || !map.current.loaded()) return;
    const zoom = map.current.getZoom();
    if (zoom < 7) return; // too zoomed out
    const features = await fetchZctaBounds(map.current.getBounds());
    if (!features.length) return;

    const data = dataRef.current;
    if (!data) return;

    // Enrich features with color + data
    const enriched = features.map(f => {
      const zip = f.properties?.GEOID || f.properties?.BASENAME || '';
      const zip5 = zeroZip(zip);
      const d = zip5 ? data[zip5] : null;
      return {
        ...f,
        properties: {
          ...f.properties,
          _color: d ? colorFn(layerId === 'sfr-heatmap' ? d.price : d.pricePerUnit) : '#e5e7eb',
          _zip: zip5 || zip,
          _hasData: !!d,
        }
      };
    });

    const geojson = { type: 'FeatureCollection', features: enriched };
    const sourceId = `${layerId}-source`;

    if (map.current.getSource(sourceId)) {
      map.current.getSource(sourceId).setData(geojson);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': ['get', '_color'],
          'fill-opacity': 0.55,
        },
      });
      map.current.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#94a3b8',
          'line-width': 0.8,
        },
      });

      // Click popup
      map.current.on('click', layerId, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties;
        const zip5 = props._zip;
        const d = dataRef.current?.[zip5];
        if (!d) return;
        const html = buildPopup(zip5, d);
        new mapboxgl.Popup({ maxWidth: '360px' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map.current);
      });

      // Hover effect
      map.current.on('mouseenter', layerId, () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', layerId, () => {
        map.current.getCanvas().style.cursor = '';
      });
    }
  }, [fetchZctaBounds]);

  // SFR popup builder
  const buildSfrPopup = (zip, d) => `
    <div style="font-family:Inter,-apple-system,sans-serif;padding:10px;min-width:260px">
      <div style="font-weight:700;font-size:15px;color:#111827;margin-bottom:2px">ZIP ${zip}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:10px">${d.city}${d.state ? ', ' + d.state : ''}${d.metro ? ' · ' + d.metro : ''}</div>
      <div style="text-align:center;padding:12px;background:${sfrColor(d.price)}15;border-radius:10px;border:1px solid ${sfrColor(d.price)}40;margin-bottom:10px">
        <div style="font-size:24px;font-weight:800;color:${sfrColor(d.price)}">${d.price ? '$' + d.price.toLocaleString() : 'N/A'}</div>
        <div style="font-size:11px;color:#6b7280">Median SFR Sale Price</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">YoY CHANGE</span><br/><strong style="color:${(d.yoy || 0) >= 0 ? '#059669' : '#dc2626'}">${d.yoy != null ? (d.yoy >= 0 ? '+' : '') + d.yoy.toFixed(1) + '%' : 'N/A'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">2-YR CHANGE</span><br/><strong style="color:${(d.twoYr || 0) >= 0 ? '#059669' : '#dc2626'}">${d.twoYr != null ? (d.twoYr >= 0 ? '+' : '') + d.twoYr.toFixed(1) + '%' : 'N/A'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">PRICE TIER</span><br/><strong>${d.tier || '–'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">MOMENTUM</span><br/><strong>${d.momentum || '–'}</strong></div>
      </div>
      ${d.county ? '<div style="margin-top:6px;font-size:11px;color:#9ca3af">' + d.county + '</div>' : ''}
    </div>`;

  // MF popup builder
  const buildMfPopup = (zip, d) => `
    <div style="font-family:Inter,-apple-system,sans-serif;padding:10px;min-width:280px">
      <div style="font-weight:700;font-size:15px;color:#111827;margin-bottom:2px">ZIP ${zip}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:10px">${d.city}${d.state ? ', ' + d.state : ''}${d.metro ? ' · ' + d.metro : ''}</div>
      <div style="text-align:center;padding:12px;background:${mfColor(d.pricePerUnit)}15;border-radius:10px;border:1px solid ${mfColor(d.pricePerUnit)}40;margin-bottom:10px">
        <div style="font-size:24px;font-weight:800;color:${mfColor(d.pricePerUnit)}">${d.pricePerUnit ? '$' + d.pricePerUnit.toLocaleString() : 'N/A'}</div>
        <div style="font-size:11px;color:#6b7280">Median Price Per Unit</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:6px;background:#f0fdf4;border-radius:8px">
          <div style="font-size:10px;color:#6b7280;font-weight:600">CAP RATE</div>
          <div style="font-size:16px;font-weight:700;color:#111827">${d.capRate != null ? d.capRate + '%' : '–'}</div>
        </div>
        <div style="text-align:center;padding:6px;background:#eff6ff;border-radius:8px">
          <div style="font-size:10px;color:#6b7280;font-weight:600">GRM</div>
          <div style="font-size:16px;font-weight:700;color:#111827">${d.grm != null ? d.grm.toFixed(1) + 'x' : '–'}</div>
        </div>
        <div style="text-align:center;padding:6px;background:#fefce8;border-radius:8px">
          <div style="font-size:10px;color:#6b7280;font-weight:600">$/SF</div>
          <div style="font-size:16px;font-weight:700;color:#111827">${d.priceSF != null ? '$' + Math.round(d.priceSF) : '–'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">YoY CHANGE</span><br/><strong style="color:${(d.yoy || 0) >= 0 ? '#059669' : '#dc2626'}">${d.yoy != null ? (d.yoy >= 0 ? '+' : '') + d.yoy.toFixed(1) + '%' : 'N/A'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">TREND</span><br/><strong>${d.trend || '–'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">MARKET TYPE</span><br/><strong>${d.marketType || '–'}</strong></div>
        <div><span style="color:#9ca3af;font-weight:600;font-size:10px">ANNUAL DEALS</span><br/><strong>${d.volume != null ? d.volume : '–'}</strong></div>
        ${d.medianRent ? '<div><span style="color:#9ca3af;font-weight:600;font-size:10px">MEDIAN RENT</span><br/><strong>$' + Math.round(d.medianRent).toLocaleString() + '</strong></div>' : ''}
        ${d.renterShare ? '<div><span style="color:#9ca3af;font-weight:600;font-size:10px">RENTER %</span><br/><strong>' + d.renterShare + '%</strong></div>' : ''}
      </div>
      ${d.county ? '<div style="margin-top:6px;font-size:11px;color:#9ca3af">' + d.county + '</div>' : ''}
    </div>`;

  // Remove heatmap layer from map
  const removeHeatmapLayer = useCallback((layerId) => {
    if (!map.current) return;
    const sourceId = `${layerId}-source`;
    if (map.current.getLayer(`${layerId}-outline`)) map.current.removeLayer(`${layerId}-outline`);
    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
  }, []);

  // SFR heatmap toggle
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (!sfrEnabled) {
      removeHeatmapLayer('sfr-heatmap');
      sfrLayerAdded.current = false;
      return;
    }
    let cancelled = false;
    const init = async () => {
      await loadSfrData();
      if (cancelled) return;
      await renderHeatmapLayer('sfr-heatmap', sfrDataRef, sfrColor, buildSfrPopup);
      sfrLayerAdded.current = true;
      // Re-render on map move
      const onMove = () => renderHeatmapLayer('sfr-heatmap', sfrDataRef, sfrColor, buildSfrPopup);
      map.current.on('moveend', onMove);
      // Store cleanup ref
      sfrLayerAdded.current = onMove;
    };
    init();
    return () => {
      cancelled = true;
      if (map.current && typeof sfrLayerAdded.current === 'function') {
        map.current.off('moveend', sfrLayerAdded.current);
      }
    };
  }, [sfrEnabled, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // MF heatmap toggle
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (!mfEnabled) {
      removeHeatmapLayer('mf-heatmap');
      mfLayerAdded.current = false;
      return;
    }
    let cancelled = false;
    const init = async () => {
      await loadMfData();
      if (cancelled) return;
      await renderHeatmapLayer('mf-heatmap', mfDataRef, mfColor, buildMfPopup);
      mfLayerAdded.current = true;
      const onMove = () => renderHeatmapLayer('mf-heatmap', mfDataRef, mfColor, buildMfPopup);
      map.current.on('moveend', onMove);
      mfLayerAdded.current = onMove;
    };
    init();
    return () => {
      cancelled = true;
      if (map.current && typeof mfLayerAdded.current === 'function') {
        map.current.off('moveend', mfLayerAdded.current);
      }
    };
  }, [mfEnabled, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load data centers JSON on mount
  useEffect(() => {
    fetch('/data_centers.json')
      .then(res => res.json())
      .then(data => {
        console.log(`[Data Centers] Loaded ${data.length} records`);
        setDataCenters(data);
      })
      .catch(err => console.error('[Data Centers] Failed to load:', err));
  }, []);

  // Data Centers layer toggle – add/remove markers
  useEffect(() => {
    // Clean up existing DC markers
    dcMarkersRef.current.forEach(m => m.remove());
    dcMarkersRef.current = [];
    if (dcPopupRef.current) { dcPopupRef.current.remove(); dcPopupRef.current = null; }

    if (!dataCentersEnabled || !mapReady || !map.current || dataCenters.length === 0) return;

    dataCenters.forEach(dc => {
      const lat = parseFloat(dc.Latitude);
      const lng = parseFloat(dc.Longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      // Create custom marker element
      const el = document.createElement('div');
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.backgroundColor = '#8b5cf6';
      el.style.borderRadius = '50%';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.border = '2.5px solid white';
      el.style.boxShadow = '0 2px 8px rgba(139,92,246,0.5)';
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.15s';
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`;
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.25)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dcPopupRef.current) dcPopupRef.current.remove();

        const fmt = (val) => (val != null && val !== '' && val !== 'N/A') ? val : '–';
        const fmtMoney = (val) => {
          if (val == null || val === '') return '–';
          const n = parseFloat(val);
          return isNaN(n) ? val : `$${n}B`;
        };

        const html = `
          <div style="font-family:Inter,-apple-system,sans-serif;padding:12px;min-width:300px;max-width:380px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="width:32px;height:32px;border-radius:8px;background:#8b5cf6;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              </div>
              <div>
                <div style="font-weight:700;font-size:14px;color:#111827;line-height:1.2">${fmt(dc['Project Name'])}</div>
                <div style="font-size:11px;color:#6b7280">${fmt(dc['Operator / Developer'])}</div>
              </div>
            </div>
            <div style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;margin-bottom:8px;
              background:${dc.Status?.includes('Operational') ? '#dcfce7' : dc.Status?.includes('Under Construction') ? '#fef3c7' : '#e0e7ff'};
              color:${dc.Status?.includes('Operational') ? '#166534' : dc.Status?.includes('Under Construction') ? '#92400e' : '#3730a3'}">
              ${fmt(dc.Status)}
            </div>
            <div style="font-size:12px;color:#374151;margin-bottom:8px">
              <div style="margin-bottom:2px">📍 ${fmt(dc['Full Address'] || (dc.City + ', ' + dc.State))}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:6px">
              <div style="padding:6px 8px;background:#f5f3ff;border-radius:6px">
                <div style="color:#8b5cf6;font-weight:600;font-size:9px;text-transform:uppercase">Parent Company</div>
                <div style="font-weight:600;color:#111827">${fmt(dc['Parent Company'])}</div>
              </div>
              <div style="padding:6px 8px;background:#fef3c7;border-radius:6px">
                <div style="color:#92400e;font-weight:600;font-size:9px;text-transform:uppercase">Investment</div>
                <div style="font-weight:600;color:#111827">${fmtMoney(dc['Investment ($B)'])}</div>
              </div>
              <div style="padding:6px 8px;background:#e0f2fe;border-radius:6px">
                <div style="color:#0369a1;font-weight:600;font-size:9px;text-transform:uppercase">Capacity</div>
                <div style="font-weight:600;color:#111827">${fmt(dc['Capacity (MW)'])}${dc['Capacity (MW)'] && dc['Capacity (MW)'] !== '–' ? ' MW' : ''}</div>
              </div>
              <div style="padding:6px 8px;background:#dcfce7;border-radius:6px">
                <div style="color:#166534;font-weight:600;font-size:9px;text-transform:uppercase">Site Size</div>
                <div style="font-weight:600;color:#111827">${fmt(dc['Site Size (Acres)'])}${dc['Site Size (Acres)'] ? ' acres' : ''}</div>
              </div>
              <div style="padding:6px 8px;background:#fff7ed;border-radius:6px">
                <div style="color:#9a3412;font-weight:600;font-size:9px;text-transform:uppercase">Est. Completion</div>
                <div style="font-weight:600;color:#111827">${fmt(dc['Est. Completion'])}</div>
              </div>
              <div style="padding:6px 8px;background:#fdf2f8;border-radius:6px">
                <div style="color:#9d174d;font-weight:600;font-size:9px;text-transform:uppercase">Power Source</div>
                <div style="font-weight:600;color:#111827">${fmt(dc['Power Source Notes'])}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:6px">
              <div style="padding:4px 8px;background:#f9fafb;border-radius:4px">
                <span style="color:#6b7280;font-size:9px;font-weight:600">CONSTRUCTION JOBS</span><br/>
                <strong style="color:#111827">${fmt(dc['Jobs (Construction)'])}</strong>
              </div>
              <div style="padding:4px 8px;background:#f9fafb;border-radius:4px">
                <span style="color:#6b7280;font-size:9px;font-weight:600">OPERATIONAL JOBS</span><br/>
                <strong style="color:#111827">${fmt(dc['Jobs (Operational)'])}</strong>
              </div>
            </div>
            ${dc['Key Tenant / Use'] ? `<div style="font-size:11px;padding:4px 8px;background:#f0fdf4;border-radius:4px;margin-bottom:4px"><span style="color:#6b7280;font-weight:600;font-size:9px">KEY TENANT / USE</span><br/><strong style="color:#111827">${dc['Key Tenant / Use']}</strong></div>` : ''}
            ${dc.Notes ? `<div style="font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px">${dc.Notes}</div>` : ''}
          </div>`;

        const popup = new mapboxgl.Popup({ maxWidth: '400px', offset: 15 })
          .setLngLat([lng, lat])
          .setHTML(html)
          .addTo(map.current);
        dcPopupRef.current = popup;
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current);
      dcMarkersRef.current.push(marker);
    });

    return () => {
      dcMarkersRef.current.forEach(m => m.remove());
      dcMarkersRef.current = [];
      if (dcPopupRef.current) { dcPopupRef.current.remove(); dcPopupRef.current = null; }
    };
  }, [dataCentersEnabled, dataCenters, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add markers when properties change AND map is ready
  useEffect(() => {
    console.log('🎯 Markers useEffect triggered, properties:', properties.length, 'mapReady:', mapReady, 'map exists:', !!map.current);
    
    if (!mapReady || !map.current || properties.length === 0) {
      console.log('⚠️ Skipping markers - map not ready or no properties');
      return;
    }

    console.log('🧹 Clearing existing markers:', markersRef.current.length);
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const markerProperties = spreadOverlappingProperties(properties);

    console.log('📍 Adding', markerProperties.length, 'markers to map');
    // Add new markers
    markerProperties.forEach((property, idx) => {
      console.log(`  📌 Marker ${idx + 1}: ${property.address} at [${property.longitude}, ${property.latitude}]`);
      
      const el = document.createElement('div');
      el.className = 'property-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundColor = '#0d9488';
      el.style.borderRadius = '50% 50% 50% 0';
      el.style.transform = 'rotate(-45deg)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="transform: rotate(45deg)"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;

      el.addEventListener('click', () => {
        setSelectedProperty(property);
        // Fly to the property
        map.current.flyTo({
          center: [property.longitude, property.latitude],
          zoom: 12,
          duration: 1500
        });
      });

      try {
        const marker = new mapboxgl.Marker(el)
          .setLngLat([property.longitude, property.latitude])
          .addTo(map.current);

        console.log(`  ✅ Marker ${idx + 1} added successfully`);
        markersRef.current.push(marker);
      } catch (err) {
        console.error(`  ❌ Failed to add marker ${idx + 1}:`, err);
      }
    });

    console.log('✅ All markers added:', markersRef.current.length);

    // Fit map to show all markers
    if (properties.length > 0 && markersRef.current.length > 0) {
      try {
        const bounds = new mapboxgl.LngLatBounds();
        markerProperties.forEach(prop => {
          bounds.extend([prop.longitude, prop.latitude]);
        });
        console.log('🎯 Fitting map to bounds');
        map.current.fitBounds(bounds, { padding: 100, maxZoom: 10 });
      } catch (err) {
        console.error('❌ Failed to fit bounds:', err);
      }
    }
  }, [properties, mapReady]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '0'
    }}>
      {/* Map Container */}
      <div style={{ 
        width: '100%', 
        height: '600px',
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div ref={mapContainer} style={{ 
          width: '100%', 
          height: '100%'
        }} />

      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '20px 32px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px',
          fontWeight: '600',
          color: '#0d9488'
        }}>
          Loading properties...
        </div>
      )}

      {/* POI Filter Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 100,
        minWidth: '220px',
        display: 'none'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
          Points of Interest
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={showPOIs.schools}
              onChange={(e) => setShowPOIs(prev => ({ ...prev, schools: e.target.checked }))}
              style={{ cursor: 'pointer' }}
            />
            <GraduationCap size={16} color="#4338ca" />
            <span>Universities & Colleges</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={showPOIs.hospitals}
              onChange={(e) => setShowPOIs(prev => ({ ...prev, hospitals: e.target.checked }))}
              style={{ cursor: 'pointer' }}
            />
            <Hospital size={16} color="#dc2626" />
            <span>Hospitals & Healthcare</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={showPOIs.transit}
              onChange={(e) => setShowPOIs(prev => ({ ...prev, transit: e.target.checked }))}
              style={{ cursor: 'pointer' }}
            />
            <Briefcase size={16} color="#059669" />
            <span>Public Transit</span>
          </label>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '8px' }}>
            Distance Filter: {distanceFilter} miles
          </label>
          <input
            type="range"
            min="1"
            max="25"
            value={distanceFilter}
            onChange={(e) => setDistanceFilter(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
            <span>1mi</span>
            <span>25mi</span>
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '11px', color: '#6b7280', lineHeight: '1.4' }}>
          ðŸ’¡ Toggle POIs to see nearby universities, hospitals, and transit options
        </div>
      </div>

      {/* Property popup */}
      {selectedProperty && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          minWidth: '450px',
          maxWidth: '600px',
          zIndex: 1000,
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto'
        }}>
          <button
            onClick={() => setSelectedProperty(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              lineHeight: '1',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Ã—
          </button>

          <h3 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '20px', 
            fontWeight: '700',
            color: '#111827',
            paddingRight: '32px'
          }}>
            {selectedProperty.address?.split(',')[0] || selectedProperty.address}
          </h3>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            color: '#6b7280',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            <MapPin size={16} />
            {selectedProperty.address}
          </div>

          {/* Key Metrics Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '20px',
            paddingBottom: '20px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{
              backgroundColor: '#f0fdfa',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Purchase Price</div>
              <div style={{ 
                fontWeight: '700', 
                color: '#0d9488',
                fontSize: '18px'
              }}>
                ${(selectedProperty.purchasePrice / 1000000).toFixed(2)}M
              </div>
            </div>
            
            <div style={{
              backgroundColor: '#fef3c7',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Units</div>
              <div style={{ 
                fontWeight: '700', 
                color: '#d97706',
                fontSize: '18px'
              }}>
                {selectedProperty.units}
              </div>
            </div>

            <div style={{
              backgroundColor: '#dbeafe',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>Deal Structure</div>
              <div style={{ 
                fontWeight: '600', 
                color: '#2563eb',
                fontSize: '13px'
              }}>
                {selectedProperty.dealStructure || 'Traditional'}
              </div>
            </div>
          </div>

          {/* Cash Flow Metrics */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Cash Flow Analysis
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Day 1 Cash Flow</div>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>
                  ${selectedProperty.dayOneCashFlow?.toLocaleString() || 0}/mo
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Stabilized Cash Flow</div>
                <div style={{ fontWeight: '600', color: '#10b981', fontSize: '16px' }}>
                  ${selectedProperty.stabilizedCashFlow?.toLocaleString() || 0}/mo
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Post-Refi Cash Flow</div>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>
                  ${selectedProperty.postRefiCashFlow?.toLocaleString() || 0}/mo
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Total In Pocket</div>
                <div style={{ fontWeight: '600', color: '#10b981', fontSize: '16px' }}>
                  ${(selectedProperty.userTotalInPocket / 1000).toFixed(0)}k
                </div>
              </div>
            </div>
          </div>

          {/* Refi Metrics */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Refinance Potential
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Refi Value</div>
                <div style={{ fontWeight: '600', color: '#111827', fontSize: '16px' }}>
                  ${(selectedProperty.refiValue / 1000000).toFixed(2)}M
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>Cash Out Amount</div>
                <div style={{ fontWeight: '600', color: '#0d9488', fontSize: '16px' }}>
                  ${(selectedProperty.cashOutRefiAmount / 1000000).toFixed(2)}M
                </div>
              </div>
            </div>
          </div>

          {/* Broker Information */}
          {(selectedProperty.brokerName || selectedProperty.brokerEmail || selectedProperty.brokerPhone) && (
            <div style={{ marginBottom: '0' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                Broker Information
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedProperty.brokerName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <User size={16} color="#6b7280" />
                    <span style={{ color: '#111827', fontWeight: '500' }}>{selectedProperty.brokerName}</span>
                  </div>
                )}
                {selectedProperty.brokerPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <Phone size={16} color="#6b7280" />
                    <a href={`tel:${selectedProperty.brokerPhone}`} style={{ color: '#0d9488', textDecoration: 'none' }}>
                      {selectedProperty.brokerPhone}
                    </a>
                  </div>
                )}
                {selectedProperty.brokerEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <Mail size={16} color="#6b7280" />
                    <a href={`mailto:${selectedProperty.brokerEmail}`} style={{ color: '#0d9488', textDecoration: 'none' }}>
                      {selectedProperty.brokerEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Layer Toggles */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <div style={{
          backgroundColor: 'rgba(15,23,42,0.88)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          padding: '10px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b', marginBottom: 6 }}>Data Layers</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              { label: 'SFR Sales', active: sfrEnabled, color: '#f59e0b', toggle: () => setSfrEnabled(v => !v) },
              { label: 'MF Sales', active: mfEnabled, color: '#3b82f6', toggle: () => setMfEnabled(v => !v) },
              { label: 'Data Centers', active: dataCentersEnabled, color: '#8b5cf6', toggle: () => setDataCentersEnabled(v => !v) },
            ].map(({ label, active, color, toggle }) => (
              <button key={label} onClick={toggle} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 20,
                border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                color: active ? color : '#94a3b8',
                backgroundColor: active ? `${color}18` : 'transparent',
                transition: 'all 0.15s', lineHeight: 1,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: active ? color : '#475569' }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SFR Legend */}
        {sfrEnabled && (
          <div style={{
            backgroundColor: 'rgba(15,23,42,0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>SFR Median Sale Price</div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {['#16a34a','#84cc16','#eab308','#f59e0b','#dc2626'].map((c, i) => (
                <div key={i} style={{ flex: 1, height: 8, backgroundColor: c, borderRadius: i === 0 ? '4px 0 0 4px' : i === 4 ? '0 4px 4px 0' : 0 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
              <span>&lt;$150k</span><span>$600k+</span>
            </div>
          </div>
        )}

        {/* MF Legend */}
        {mfEnabled && (
          <div style={{
            backgroundColor: 'rgba(15,23,42,0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>MF Price Per Unit</div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {['#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#1e3a5f'].map((c, i) => (
                <div key={i} style={{ flex: 1, height: 8, backgroundColor: c, borderRadius: i === 0 ? '4px 0 0 4px' : i === 4 ? '0 4px 4px 0' : 0 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
              <span>&lt;$60k</span><span>$200k+</span>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        {(sfrEnabled || mfEnabled) && (
          <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 6, padding: '3px 8px' }}>
            Zoom in to see ZIP polygons (zoom ≥ 7)
          </div>
        )}

        {/* Data Centers Legend */}
        {dataCentersEnabled && (
          <div style={{
            backgroundColor: 'rgba(15,23,42,0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>US Data Centers ({dataCenters.length})</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9, color: '#9ca3af' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
                Click pin for details
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: '13px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
          Your Properties
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#0d9488',
            borderRadius: '50%',
            border: '2px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={10} color="white" />
          </div>
          <span>{properties.length} Properties</span>
        </div>
      </div>
      </div>

      {/* Pipeline Table Below Map */}
      {!loading && !isLoadingPipeline && pipelineDeals && pipelineDeals.length > 0 && (
        <div style={{
          width: '100%',
          marginTop: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          <PipelineTable
            deals={pipelineDeals}
            onViewDeal={handleViewDeal}
            onGenerateLOI={handleGenerateLOI}
            onDueDiligence={handleDueDiligence}
            onDeleteDeal={handleDeleteDeal}
            onDuplicateDeal={handleDuplicateDeal}
            showPitchComingSoon={false}
          />
        </div>
      )}
    </div>
  );

  // Handler functions for pipeline table
  function handleDeleteDeal(dealId) {
    if (window.confirm('Are you sure you want to remove this deal from the pipeline?')) {
      deleteDeal(dealId)
        .then(() => {
          setPipelineDeals(prev => prev.filter(d => d.dealId !== dealId));
          // Notify other components that pipeline has changed
          window.dispatchEvent(new Event('pipelineDealsUpdated'));
        })
        .catch(error => {
          console.error('Error deleting deal:', error);
          alert('Failed to delete deal: ' + error.message);
        });
    }
  }

  function handleDuplicateDeal(deal) {
    duplicateDeal(deal.dealId)
      .then(duplicated => {
        setPipelineDeals(prev => [...prev, duplicated]);
        window.dispatchEvent(new Event('pipelineDealsUpdated'));
      })
      .catch(error => {
        console.error('Error duplicating deal:', error);
        alert('Failed to duplicate deal: ' + error.message);
      });
  }

  function handleViewDeal(deal) {
    if (deal.dealId.startsWith('sample-')) {
      const mockScenarioData = {
        property: {
          address: deal.address,
          units: deal.units,
          property_type: 'Multifamily',
          year_built: 1985,
          rba_sqft: deal.units * 850
        },
        pricing_financing: {
          price: deal.purchasePrice,
          purchase_price: deal.purchasePrice
        },
        financing: {
          ltv: 75,
          interest_rate: 6.5,
          loan_term_years: 10,
          amortization_years: 30,
          io_years: 0,
          loan_fees_percent: 1.5
        },
        pnl: {
          potential_gross_income: deal.units * 1200 * 12,
          vacancy_rate: 5,
          operating_expenses: deal.units * 400 * 12
        },
        unit_mix: [
          { unit_type: '2BR/1BA', units: deal.units, unit_sf: 850, rent_current: 1200 }
        ],
        broker: {
          name: deal.brokerName,
          phone: deal.brokerPhone,
          email: deal.brokerEmail
        }
      };
      
      navigate('/underwrite', {
        state: {
          dealId: deal.dealId,
          scenarioData: mockScenarioData,
          goToResults: true
        }
      });
    } else {
      navigate(`/underwrite?viewDeal=${deal.dealId}`);
    }
  }

  function handleGenerateLOI(deal) {
    navigate(`/loi?dealId=${deal.dealId}`);
  }

  function handleDueDiligence(deal) {
    navigate(`/due-diligence?dealId=${deal.dealId}`);
  }
}

export default HomeMapView;
