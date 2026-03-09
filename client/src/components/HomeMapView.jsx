import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { Building2, DollarSign, TrendingUp, MapPin, User, Phone, Mail, Home, GraduationCap, Hospital, Briefcase, X, Layers } from 'lucide-react';
import { loadPipelineDeals, deleteDeal } from '../lib/dealsService';
import { PipelineTable } from './tables';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

// Regrid Parcel Tiles — vector tile layer for property boundary lines
const REGRID_TOKEN = process.env.REACT_APP_REGRID_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJyZWdyaWQuY29tIiwiaWF0IjoxNzczMDcwNzc3LCJleHAiOjE3NzU2NjI3NzcsInUiOjcxMzc3MCwiZyI6MjMxNTMsImNhcCI6InBhOnRzOnBzOmJmOm1hOnR5OmVvOnpvOnNiIn0.n9xInEA21sComIh5H0tL68Ku-AsWsdq0vrErJGly-k0';
const REGRID_TILE_URL = `https://tiles.regrid.com/api/v1/parcels/{z}/{x}/{y}.mvt?token=${REGRID_TOKEN}`;

// Geocode an address to coordinates using Mapbox Geocoding API
async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { longitude, latitude };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
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
  const [showParcels, setShowParcels] = useState(false);
  const parcelPopupRef = useRef(null);
  const markersRef = useRef([]);
  const [pipelineDeals, setPipelineDeals] = useState([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(true);

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

        // Add Regrid parcel tile source & layers (hidden by default)
        addParcelLayers();

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

  // ── Regrid Parcel Lines ──────────────────────────────────────────────
  const addParcelLayers = useCallback(() => {
    if (!map.current) return;
    // Vector tile source
    map.current.addSource('regrid-parcels', {
      type: 'vector',
      tiles: [REGRID_TILE_URL],
      minzoom: 12,
      maxzoom: 20,
    });

    // Parcel fill (subtle on-hover highlight)
    map.current.addLayer({
      id: 'regrid-parcels-fill',
      type: 'fill',
      source: 'regrid-parcels',
      'source-layer': 'parcels',
      minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#6366f1',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.15,
          0.0,
        ],
      },
    });

    // Parcel boundary lines
    map.current.addLayer({
      id: 'regrid-parcels-line',
      type: 'line',
      source: 'regrid-parcels',
      'source-layer': 'parcels',
      minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#6366f1',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          14, 0.5,
          16, 1.2,
          18, 2,
        ],
        'line-opacity': 0.7,
      },
    });

    // Click handler — show parcel info popup
    map.current.on('click', 'regrid-parcels-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0];
      const props = f.properties || {};
      const address = props.address || props.situs_address || props.addr || 'N/A';
      const owner = props.owner || props.owner1 || props.ownernme1 || '';
      const acres = props.ll_gisacre ? Number(props.ll_gisacre).toFixed(2) : (props.acres || '');
      const zoning = props.zoning || props.zoning_code || props.usecode || '';
      const apn = props.parcelnumb || props.apn || props.parcel_id || '';
      const landUse = props.usedesc || props.landuse || props.lu_desclu || '';
      const yearBuilt = props.yearbuilt || props.year_built || '';
      const sqft = props.ll_bldg_footprint_sqft || props.bldg_sqft || props.sqft || '';

      let html = `<div style="font-family:system-ui;max-width:280px">`;
      html += `<div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#111827">${address}</div>`;
      if (owner) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Owner:</b> ${owner}</div>`;
      if (apn) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>APN:</b> ${apn}</div>`;
      if (zoning) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Zoning:</b> ${zoning}</div>`;
      if (landUse) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Land Use:</b> ${landUse}</div>`;
      if (acres) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Acres:</b> ${acres}</div>`;
      if (sqft) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Bldg SF:</b> ${Number(sqft).toLocaleString()}</div>`;
      if (yearBuilt) html += `<div style="font-size:12px;color:#6b7280;margin-bottom:4px"><b>Year Built:</b> ${yearBuilt}</div>`;
      html += `</div>`;

      if (parcelPopupRef.current) parcelPopupRef.current.remove();
      parcelPopupRef.current = new mapboxgl.Popup({ maxWidth: '320px', closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map.current);
    });

    // Cursor change on hover
    map.current.on('mouseenter', 'regrid-parcels-fill', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'regrid-parcels-fill', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  }, []);

  // Toggle parcel layer visibility
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const vis = showParcels ? 'visible' : 'none';
    ['regrid-parcels-fill', 'regrid-parcels-line'].forEach(id => {
      if (map.current.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', vis);
      }
    });
  }, [showParcels]);

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

    console.log('📍 Adding', properties.length, 'markers to map');
    // Add new markers
    properties.forEach((property, idx) => {
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
        properties.forEach(prop => {
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

      {/* Parcel Lines Toggle */}
      <button
        onClick={() => setShowParcels(prev => !prev)}
        title={showParcels ? 'Hide parcel lines' : 'Show parcel lines (zoom in to see)'}
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          backgroundColor: showParcels ? '#6366f1' : 'white',
          color: showParcels ? 'white' : '#374151',
          border: showParcels ? '2px solid #6366f1' : '2px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease',
        }}
      >
        <Layers size={16} />
        Parcels
      </button>

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
