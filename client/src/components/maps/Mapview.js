import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { loadPipelineDeals, updateDeal } from '../../lib/dealsService';
import { geocodeAddress } from '../../utils/geocode';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidHlsZXJ3YXluZTEiLCJhIjoiY21oNzlqb2xwMHBybjJscHR5ZXVqcHZ2aCJ9.jHao1snG3bwXFRVWcA8tuQ';
mapboxgl.accessToken = MAPBOX_TOKEN;

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100%',
};

const topBarStyle = {
  height: '60px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  background: '#0F172A',
  color: '#fff',
  flexShrink: 0,
};

const bodyStyle = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  position: 'relative',
};

const mapContainerStyle = {
  flex: '1',
  height: '100%',
  position: 'relative',
};

const sidebarStyle = {
  width: '400px',
  height: '100%',
  background: '#fff',
  borderLeft: '1px solid #ddd',
  overflowY: 'auto',
  padding: '0',
};

const propertyCardStyle = {
  padding: '16px',
  borderBottom: '1px solid #eee',
  cursor: 'pointer',
  transition: 'background 0.2s ease',
};

const propertyImageStyle = {
  width: '100%',
  height: '180px',
  background: '#e0e0e0',
  borderRadius: '8px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  color: '#999',
};

const propertyTitleStyle = {
  fontSize: '16px',
  fontWeight: '700',
  margin: '0 0 8px',
  color: '#000',
};

const propertyMetaStyle = {
  fontSize: '14px',
  color: '#666',
  margin: '0 0 4px',
};

const propertyPriceStyle = {
  fontSize: '18px',
  fontWeight: '800',
  color: '#000',
  margin: '8px 0 0',
};

const inputStyle = { padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' };

function formatShortPrice(price) {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(price >= 10_000_000 ? 0 : 1)}M`;
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`;
  return `$${price}`;
}

function dealCapRate(deal) {
  const noi =
    deal.fullScenarioData?.pnl?.noi ??
    deal.fullParsedData?.pnl?.noi ??
    null;
  if (!noi || !deal.purchasePrice) return null;
  return (noi / deal.purchasePrice) * 100;
}

function dealCityState(deal) {
  const prop = deal.fullScenarioData?.property || deal.fullParsedData?.property || {};
  const parts = [prop.city, prop.state].filter(Boolean);
  return parts.join(', ');
}

export default function MapView() {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter states
  const [cityFilter, setCityFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [capRateMin, setCapRateMin] = useState('');
  const [capRateMax, setCapRateMax] = useState('');
  const [unitsMin, setUnitsMin] = useState('');
  const [unitsMax, setUnitsMax] = useState('');

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const pipeline = await loadPipelineDeals();

      // Geocode any deals missing coordinates and persist so it only happens once
      const withCoords = await Promise.all(
        (pipeline || []).map(async (deal) => {
          if (Number.isFinite(deal.latitude) && Number.isFinite(deal.longitude)) return deal;
          const coords = await geocodeAddress(deal.address);
          if (coords) {
            try {
              await updateDeal(deal.dealId, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
            } catch (e) {
              console.error('[MapView] Failed to save coordinates:', e);
            }
            return { ...deal, latitude: coords.latitude, longitude: coords.longitude };
          }
          return deal;
        })
      );

      setAllDeals(withCoords);
      setDeals(withCoords);
    } catch (err) {
      console.error('[MapView] Error loading pipeline deals:', err);
      setAllDeals([]);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-94.5786, 39.0997],
      zoom: 4,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
  }, []);

  useEffect(() => {
    if (!map.current) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const located = deals.filter(
      (d) => Number.isFinite(d.longitude) && Number.isFinite(d.latitude)
    );

    located.forEach((deal) => {
      // Zillow-style price pill marker
      const el = document.createElement('div');
      const label = formatShortPrice(deal.purchasePrice) || `${deal.units || '?'} units`;
      el.textContent = label;
      Object.assign(el.style, {
        padding: '4px 10px',
        borderRadius: '999px',
        background: '#0F172A',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '700',
        border: '2px solid #fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      });

      const capRate = dealCapRate(deal);
      const popupHTML = `
        <div style="padding: 12px; min-width: 220px; font-family: inherit;">
          <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 700;">${deal.address || 'Deal'}</h3>
          <p style="margin: 0 0 4px; font-size: 13px; color: #666;">
            ${deal.units ? `${deal.units} Units` : ''}${capRate ? ` &bull; ${capRate.toFixed(1)}% Cap` : ''}
          </p>
          ${deal.purchasePrice ? `<p style="margin: 0 0 8px; font-size: 17px; font-weight: 700;">$${deal.purchasePrice.toLocaleString()}</p>` : ''}
          <button
            onclick="window.location.href='/underwrite?viewDeal=${deal.dealId}'"
            style="width: 100%; padding: 8px; background: #000; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;"
          >
            View Deal
          </button>
        </div>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([deal.longitude, deal.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setHTML(popupHTML))
        .addTo(map.current);
      markers.current.push(marker);
    });

    // Fit the map to the visible pins
    if (located.length === 1) {
      map.current.flyTo({ center: [located[0].longitude, located[0].latitude], zoom: 12 });
    } else if (located.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      located.forEach((d) => bounds.extend([d.longitude, d.latitude]));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 12 });
    }
  }, [deals]);

  const applyFilters = () => {
    let filtered = [...allDeals];

    if (cityFilter) {
      const q = cityFilter.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.address || '').toLowerCase().includes(q) ||
          dealCityState(d).toLowerCase().includes(q)
      );
    }
    if (priceMin) filtered = filtered.filter((d) => d.purchasePrice >= parseFloat(priceMin));
    if (priceMax) filtered = filtered.filter((d) => d.purchasePrice <= parseFloat(priceMax));
    if (capRateMin || capRateMax) {
      filtered = filtered.filter((d) => {
        const cap = dealCapRate(d);
        if (cap == null) return false;
        if (capRateMin && cap < parseFloat(capRateMin)) return false;
        if (capRateMax && cap > parseFloat(capRateMax)) return false;
        return true;
      });
    }
    if (unitsMin) filtered = filtered.filter((d) => d.units >= parseInt(unitsMin));
    if (unitsMax) filtered = filtered.filter((d) => d.units <= parseInt(unitsMax));

    setDeals(filtered);
  };

  const clearFilters = () => {
    setCityFilter('');
    setPriceMin('');
    setPriceMax('');
    setCapRateMin('');
    setCapRateMax('');
    setUnitsMin('');
    setUnitsMax('');
    setDeals(allDeals);
  };

  const handleCardClick = (deal) => {
    if (Number.isFinite(deal.longitude) && Number.isFinite(deal.latitude)) {
      map.current.flyTo({ center: [deal.longitude, deal.latitude], zoom: 14 });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={topBarStyle}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Deal Map</div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Dashboard
        </button>
      </div>

      <div style={bodyStyle}>
        <div ref={mapContainer} style={mapContainerStyle} />
        <div style={sidebarStyle}>
          {/* Filter Bar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #ddd' }}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#f5f5f5',
                border: 'none',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Filters</span>
              <span>{filterOpen ? '▲' : '▼'}</span>
            </button>

            {filterOpen && (
              <div style={{ padding: '16px', background: '#fafafa' }}>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="City, state, or address"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Price Range</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Cap Rate %</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="number" placeholder="Min" value={capRateMin} onChange={(e) => setCapRateMin(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="Max" value={capRateMax} onChange={(e) => setCapRateMax(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Units</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="number" placeholder="Min" value={unitsMin} onChange={(e) => setUnitsMin(e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="Max" value={unitsMax} onChange={(e) => setUnitsMax(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={applyFilters}
                    style={{ flex: 1, padding: '10px', background: '#000', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={clearFilters}
                    style={{ flex: 1, padding: '10px', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '16px', borderBottom: '2px solid #ddd', background: '#f9f9f9' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
              Pipeline Deals ({deals.length})
            </h2>
          </div>
          {loading ? (
            <div style={{ padding: '16px' }}>Loading deals...</div>
          ) : deals.length === 0 ? (
            <div style={{ padding: '16px' }}>
              No pipeline deals yet. Push a deal to the pipeline from a Results page and it will show up here.
            </div>
          ) : (
            deals.map((deal) => {
              const capRate = dealCapRate(deal);
              const cityState = dealCityState(deal);
              const cover = Array.isArray(deal.images) && deal.images.length > 0 ? deal.images[0] : null;
              return (
                <div
                  key={deal.dealId}
                  style={propertyCardStyle}
                  onClick={() => handleCardClick(deal)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  {cover ? (
                    <img src={cover} alt={deal.address} style={{ ...propertyImageStyle, objectFit: 'cover' }} />
                  ) : (
                    <div style={propertyImageStyle}>No Image</div>
                  )}
                  <h3 style={propertyTitleStyle}>{deal.address || 'Untitled Deal'}</h3>
                  <p style={propertyMetaStyle}>
                    {deal.units ? `${deal.units} Units` : ''}
                    {deal.units && cityState ? ' • ' : ''}
                    {cityState}
                  </p>
                  {capRate != null && (
                    <p style={propertyMetaStyle}>Cap Rate: {capRate.toFixed(1)}%</p>
                  )}
                  {deal.purchasePrice ? (
                    <p style={propertyPriceStyle}>${deal.purchasePrice.toLocaleString()}</p>
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/underwrite?viewDeal=${deal.dealId}`);
                    }}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      padding: '9px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    View Deal →
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
