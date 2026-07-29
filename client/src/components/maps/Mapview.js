import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';
import { loadPipelineDeals, updateDeal } from '../../lib/dealsService';
import { geocodeAddress } from '../../utils/geocode';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

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

const DEFAULT_CENTER = { lat: 39.0997, lng: -94.5786 };

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
  const mapRef = useRef(null);
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState(null);

  // Filter states
  const [cityFilter, setCityFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [capRateMin, setCapRateMin] = useState('');
  const [capRateMax, setCapRateMax] = useState('');
  const [unitsMin, setUnitsMin] = useState('');
  const [unitsMax, setUnitsMax] = useState('');

  const { isLoaded } = useJsApiLoader({
    id: 'dealsniper-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

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

  const located = deals.filter(
    (d) => Number.isFinite(d.longitude) && Number.isFinite(d.latitude)
  );

  // Fit the map to the visible pins whenever the filtered deal list changes
  useEffect(() => {
    if (!mapRef.current || located.length === 0) return;
    if (located.length === 1) {
      mapRef.current.panTo({ lat: located[0].latitude, lng: located[0].longitude });
      mapRef.current.setZoom(12);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    located.forEach((d) => bounds.extend({ lat: d.latitude, lng: d.longitude }));
    mapRef.current.fitBounds(bounds, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

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
    if (mapRef.current && Number.isFinite(deal.longitude) && Number.isFinite(deal.latitude)) {
      mapRef.current.panTo({ lat: deal.latitude, lng: deal.longitude });
      mapRef.current.setZoom(14);
      setActiveDealId(deal.dealId);
    }
  };

  const activeDeal = located.find((d) => d.dealId === activeDealId) || null;

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
        <div style={mapContainerStyle}>
          {!GOOGLE_MAPS_API_KEY ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14, padding: 24, textAlign: 'center' }}>
              Set REACT_APP_GOOGLE_MAPS_KEY in client/.env to load the map.
            </div>
          ) : !isLoaded ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14 }}>
              Loading map…
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={DEFAULT_CENTER}
              zoom={4}
              onLoad={onMapLoad}
              options={{ mapTypeControl: true, streetViewControl: false, fullscreenControl: false }}
            >
              {located.map((deal) => (
                <MarkerF
                  key={deal.dealId}
                  position={{ lat: deal.latitude, lng: deal.longitude }}
                  label={{
                    text: formatShortPrice(deal.purchasePrice) || `${deal.units || '?'} units`,
                    className: 'gm-price-pill',
                  }}
                  onClick={() => setActiveDealId(deal.dealId)}
                />
              ))}

              {activeDeal && (
                <InfoWindowF
                  position={{ lat: activeDeal.latitude, lng: activeDeal.longitude }}
                  onCloseClick={() => setActiveDealId(null)}
                >
                  <div style={{ padding: 4, minWidth: 200, fontFamily: 'inherit' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>{activeDeal.address || 'Deal'}</h3>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>
                      {activeDeal.units ? `${activeDeal.units} Units` : ''}
                      {dealCapRate(activeDeal) ? ` • ${dealCapRate(activeDeal).toFixed(1)}% Cap` : ''}
                    </p>
                    {activeDeal.purchasePrice ? (
                      <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>${activeDeal.purchasePrice.toLocaleString()}</p>
                    ) : null}
                    <button
                      onClick={() => navigate(`/underwrite?viewDeal=${activeDeal.dealId}`)}
                      style={{ width: '100%', padding: 8, background: '#000', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                    >
                      View Deal
                    </button>
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          )}
        </div>
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
