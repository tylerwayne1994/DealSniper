import React, { useRef, useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export default function RentRollTab({ scenarioData, dealId, onUnitMixChange, initialRentcastData, onRentcastFetch }) {
  const unitMixData = scenarioData?.unit_mix || [];
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(initialRentcastData || null);

  // Sync if parent passes cached data after initial render
  useEffect(() => {
    if (initialRentcastData && !rentcastData) {
      setRentcastData(initialRentcastData);
    }
  }, [initialRentcastData]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hoveredComp, setHoveredComp] = useState(null);
  const [selectedComp, setSelectedComp] = useState(null);
  const mapRef = useRef(null);

  // Property info from scenarioData
  const propertyLat = scenarioData?.property?.lat ?? scenarioData?.property?.latitude ?? scenarioData?.lat ?? scenarioData?.latitude;
  const propertyLng = scenarioData?.property?.lng ?? scenarioData?.property?.longitude ?? scenarioData?.lng ?? scenarioData?.longitude;
  const propertyAddress = scenarioData?.property?.address || scenarioData?.address || 'Subject Property';
  const propertyCity = scenarioData?.property?.city || scenarioData?.city || '';
  const propertyState = scenarioData?.property?.state || scenarioData?.state || '';
  const propertyZip = scenarioData?.property?.zip || scenarioData?.property?.zipcode || scenarioData?.zip || '';

  // Column sizing state
  const initialColumns = [
    { key: 'type', label: 'Unit Name', align: 'left', width: 180 },
    { key: 'unit_sf', label: 'Average Unit (SF)', align: 'right', width: 140 },
    { key: 'occupied', label: 'Occupied Units', align: 'right', width: 130 },
    { key: 'vacant', label: 'Vacant Units', align: 'right', width: 120 },
    { key: 'units', label: 'Total Units', align: 'right', width: 120 },
    { key: 'occupancy', label: 'Occupancy %', align: 'right', width: 130 },
    { key: 'avgRent', label: 'Average Rent', align: 'right', width: 130 },
    { key: 'avgMarket', label: 'Average Market Rent', align: 'right', width: 150 },
    { key: 'avgRenu', label: 'Average Renu', align: 'right', width: 140 },
    { key: 'totalMarket', label: 'Total Market Rent', align: 'right', width: 160 },
    { key: 'totalRent', label: 'Total Rent', align: 'right', width: 130 },
    { key: 'actions', label: '$', align: 'center', width: 60 },
  ];
  const [colWidths, setColWidths] = useState(initialColumns.map((c) => c.width));
  const resizingRef = useRef({ index: null, startX: 0, startWidth: 0 });

  const totalUnitsCount = unitMixData.reduce((sum, u) => sum + (u.units || 0), 0);
  const totalMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
  const unitMixTotalMarketMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_market != null ? u.rent_market : (u.rent_current || 0))), 0);

  const fmtCurrency = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleMarketRentChange = (index, newMarketRent) => {
    if (!onUnitMixChange) return;
    const updatedUnitMix = [...unitMixData];
    updatedUnitMix[index] = { ...updatedUnitMix[index], rent_market: newMarketRent };
    onUnitMixChange(updatedUnitMix);
  };

  const handleRentcastFetch = async () => {
    if (!dealId) {
      alert('RentCast requires a deal ID. Upload or load a deal first.');
      return;
    }
    setRentcastLoading(true);
    try {
      const response = await fetch(`${API_BASE}/v2/deals/${dealId}/rentcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: propertyAddress,
          city: propertyCity,
          state: propertyState,
          zip: propertyZip,
          property_type: 'Apartment',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setRentcastData(data.data);
        // Notify parent so it can cache this for pipeline save
        if (onRentcastFetch) onRentcastFetch(data.data);
      } else {
        alert(`RentCast error: ${data.error || 'Unknown error'}\nAddress searched: ${data.address_searched || propertyAddress || 'N/A'}`);
      }
    } catch (error) {
      console.error('RentCast API error:', error);
      alert('Failed to fetch RentCast data. Check console for details.');
    } finally {
      setRentcastLoading(false);
    }
  };

  // Build map center from property + rentcast data
  const mapCenter = useMemo(() => {
    if (rentcastData?.latitude && rentcastData?.longitude) {
      return { lat: Number(rentcastData.latitude), lng: Number(rentcastData.longitude) };
    }
    if (propertyLat != null && propertyLng != null) {
      return { lat: Number(propertyLat), lng: Number(propertyLng) };
    }
    return { lat: 39.8283, lng: -98.5795 }; // US center fallback
  }, [rentcastData, propertyLat, propertyLng]);

  const comps = useMemo(() => {
    if (!rentcastData?.comparables) return [];
    const list = Array.isArray(rentcastData.comparables)
      ? rentcastData.comparables
      : (rentcastData.comparables.listings || []);
    return list.filter(c => c.latitude && c.longitude);
  }, [rentcastData]);

  const hasMapData = (propertyLat != null && propertyLng != null) || (rentcastData?.latitude && rentcastData?.longitude);

  // Leaflet helper component to auto-fit bounds when comps change
  function FitBounds({ center, comps }) {
    const map = useMap();
    useEffect(() => {
      if (!comps.length) return;
      const points = [[center.lat, center.lng], ...comps.map(c => [Number(c.latitude), Number(c.longitude)])];
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }, [map, center, comps]);
    return null;
  }

  // Column resize handlers
  const onResizerMouseDown = (index, e) => {
    const startX = e.clientX;
    const startWidth = colWidths[index];
    resizingRef.current = { index, startX, startWidth };
    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[index] = Math.max(80, startWidth + dx);
        return next;
      });
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Theme constants
  const B = '#e5e7eb';
  const AC = '#4f46e5';
  const LB = '#6b7280';
  const VL = '#111827';
  const card = {
    backgroundColor: '#fff', borderRadius: 16, padding: '24px 28px',
    marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${B}`,
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: VL }}>Unit Mix</div>
            <div style={{ fontSize: '12px', color: LB }}>Unit composition and rental data</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRentcastFetch}
              disabled={rentcastLoading}
              style={{
                padding: '8px 16px',
                background: rentcastLoading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: rentcastLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {rentcastLoading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Fetching Comps...
                </>
              ) : (
                <>📍 Fetch RentCast Comps</>
              )}
            </button>
          </div>
        </div>

        {/* Spinner keyframe */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* ═══ SOURCE DOCUMENT ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: `1px solid ${B}`, padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: LB, minWidth: 110 }}>Source Document</div>
          <select
            style={{ border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', minWidth: 260 }}
            defaultValue={scenarioData?.source_filename || ''}
          >
            <option value="">{scenarioData?.source_filename || 'Select a source...'}</option>
          </select>
          <button type="button" style={{ marginLeft: 'auto', fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View Source</button>
        </div>

        {/* ═══ UNIT MIX TABLE ═══ */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: `1px solid ${B}`, borderRadius: '8px' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: '12px', color: LB }}>Unit Mix Data</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>{unitMixData.length} unit types</div>
              <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>↔ Resize columns by dragging between headers.</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {initialColumns.map((col, i) => (
                      <th
                        key={col.key}
                        style={{
                          padding: '9px 10px', textAlign: col.align, fontWeight: 600, color: '#374151',
                          borderRight: i === initialColumns.length - 1 ? 'none' : `1px solid ${B}`,
                          borderBottom: `1px solid ${B}`, position: 'relative', userSelect: 'none',
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</div>
                        {i < initialColumns.length - 1 && (
                          <div
                            onMouseDown={(e) => onResizerMouseDown(i, e)}
                            style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '100%', cursor: 'col-resize', zIndex: 5 }}
                            title="Drag to resize"
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unitMixData.map((unit, idx) => {
                    const totalUnits = unit.units || 0;
                    const occupiedUnits = Math.round(totalUnits * 0.95);
                    const vacantUnits = totalUnits - occupiedUnits;
                    const occupancyPct = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;
                    const avgRent = unit.rent_current || 0;
                    const avgMarket = unit.rent_market || unit.rent_current || 0;
                    const totalMarketRent = avgMarket * totalUnits;
                    const totalRent = avgRent * occupiedUnits;
                    return (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '9px 10px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{unit.type || 'N/A'}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{(unit.unit_sf || 0).toLocaleString()}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{occupiedUnits}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{vacantUnits}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{totalUnits}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{occupancyPct}%</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{fmtCurrency(avgRent)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <input
                            type="number"
                            style={{ width: '90px', border: '1px solid #d1d5db', padding: '4px 6px', fontSize: '12px', textAlign: 'right', borderRadius: 6 }}
                            value={avgMarket}
                            onChange={(e) => handleMarketRentChange(idx, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{fmtCurrency(avgMarket)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{fmtCurrency(totalMarketRent)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>{fmtCurrency(totalRent)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>$</td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: '#eef2ff', fontWeight: 700 }}>
                    <td style={{ padding: '9px 10px', borderRight: '1px solid #c7d2fe' }}>TOTAL</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>-</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {unitMixData.reduce((sum, u) => sum + ((u.units || 0) - Math.round((u.units || 0) * 0.95)), 0)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>{totalUnitsCount}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {totalUnitsCount > 0 ? ((unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0) / totalUnitsCount) * 100).toFixed(1) : 0}%
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {fmtCurrency(totalMonthlyRent / (unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0) || 1))}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {fmtCurrency(unitMixTotalMarketMonthlyRent / totalUnitsCount || 0)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {fmtCurrency(unitMixTotalMarketMonthlyRent / totalUnitsCount || 0)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {fmtCurrency(unitMixTotalMarketMonthlyRent)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #c7d2fe' }}>
                      {fmtCurrency(totalMonthlyRent)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>$</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', borderTop: `1px solid ${B}` }}>
              This unit mix data will be used in your quick analysis. You can change the selection using the dropdown above.
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RENTCAST RESULTS — SUMMARY CARDS + MAP + COMPS LIST
            ═══════════════════════════════════════════════════════════════ */}
        {rentcastData && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Estimated Rent', value: rentcastData.rent ? `$${rentcastData.rent.toLocaleString()}/mo` : 'N/A', color: '#10b981' },
                { label: 'Price per Sq Ft', value: rentcastData.pricePerSqFt ? `$${rentcastData.pricePerSqFt.toFixed(2)}` : 'N/A', color: '#3b82f6' },
                { label: 'Rent Range', value: rentcastData.rentRangeLow && rentcastData.rentRangeHigh ? `$${rentcastData.rentRangeLow.toLocaleString()} – $${rentcastData.rentRangeHigh.toLocaleString()}` : 'N/A', color: '#f59e0b' },
                { label: 'Nearby Comps', value: comps.length, color: AC },
              ].map((c, i) => (
                <div key={i} style={{ ...card, marginBottom: 0, borderLeft: `4px solid ${c.color}`, padding: '20px 24px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: LB, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: VL }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Map + Comps side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 24 }}>

              {/* ─── INTERACTIVE MAP ─── */}
              <div style={{ ...card, marginBottom: 0, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🗺️</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: VL }}>Property & Rental Comps</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: LB }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      Subject
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: AC, display: 'inline-block' }} />
                      Comp
                    </span>
                  </div>
                </div>
                <div style={{ height: 480 }}>
                  {(hasMapData || comps.length > 0) ? (
                    <MapContainer
                      center={[mapCenter.lat, mapCenter.lng]}
                      zoom={13}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                      ref={mapRef}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution='&copy; Esri'
                      />
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        attribution=''
                      />
                      <FitBounds center={mapCenter} comps={comps} />

                      {/* Subject property marker — red */}
                      <CircleMarker
                        center={[mapCenter.lat, mapCenter.lng]}
                        radius={14}
                        pathOptions={{ fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 3 }}
                        eventHandlers={{ click: () => setSelectedComp(selectedComp === 'subject' ? null : 'subject') }}
                      >
                        {selectedComp === 'subject' && (
                          <Popup>
                            <div style={{ padding: 4 }}>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>📍 {propertyAddress}</div>
                              {rentcastData?.rent && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>Est: ${rentcastData.rent.toLocaleString()}/mo</div>}
                            </div>
                          </Popup>
                        )}
                      </CircleMarker>

                      {/* Comp markers — purple/gold */}
                      {comps.map((comp, idx) => {
                        const isHovered = hoveredComp === idx;
                        return (
                          <CircleMarker
                            key={idx}
                            center={[Number(comp.latitude), Number(comp.longitude)]}
                            radius={isHovered ? 12 : 8}
                            pathOptions={{
                              fillColor: isHovered ? '#f59e0b' : AC,
                              fillOpacity: isHovered ? 1 : 0.85,
                              color: '#fff',
                              weight: 2,
                            }}
                            eventHandlers={{
                              mouseover: () => setHoveredComp(idx),
                              mouseout: () => setHoveredComp(null),
                              click: () => setSelectedComp(selectedComp === idx ? null : idx),
                            }}
                          >
                            {selectedComp === idx && (
                              <Popup>
                                <div style={{ minWidth: 180, padding: 4 }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                                    ${comp.price?.toLocaleString() || 'N/A'}/mo
                                  </div>
                                  <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                                    {comp.bedrooms || '?'} bed • {comp.bathrooms || '?'} bath
                                    {comp.squareFootage ? ` • ${comp.squareFootage.toLocaleString()} sf` : ''}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                                    {comp.formattedAddress || comp.addressLine1 || ''}
                                  </div>
                                  {comp.distance != null && (
                                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 3 }}>
                                      {comp.distance.toFixed(2)} mi away
                                    </div>
                                  )}
                                </div>
                              </Popup>
                            )}
                          </CircleMarker>
                        );
                      })}
                    </MapContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 40 }}>🗺️</span>
                      <span style={{ fontSize: 13 }}>Click "Fetch RentCast Comps" to load map</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── COMPS LIST ─── */}
              <div style={{ ...card, marginBottom: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🏠</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: VL }}>Nearby Rental Comps</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: AC, background: '#eef2ff', padding: '2px 10px', borderRadius: 20 }}>{comps.length}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480, padding: '12px 16px' }}>
                  {comps.length > 0 ? comps.map((comp, idx) => {
                    const isHovered = hoveredComp === idx;
                    const ppsf = comp.price && comp.squareFootage ? (comp.price / comp.squareFootage).toFixed(2) : null;
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredComp(idx)}
                        onMouseLeave={() => setHoveredComp(null)}
                        style={{
                          padding: '16px', marginBottom: 10, borderRadius: 12,
                          border: `1.5px solid ${isHovered ? AC : B}`,
                          backgroundColor: isHovered ? '#f5f3ff' : '#fafafa',
                          transition: 'all 0.15s', cursor: 'default',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: VL }}>
                              ${comp.price?.toLocaleString() || 'N/A'}<span style={{ fontSize: 12, fontWeight: 500, color: LB }}>/mo</span>
                            </div>
                            {ppsf && <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 2 }}>${ppsf}/sf</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {comp.bedrooms != null && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: AC, background: '#eef2ff', padding: '3px 8px', borderRadius: 6 }}>
                                {comp.bedrooms} bed
                              </span>
                            )}
                            {comp.bathrooms != null && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#0ea5e9', background: '#ecfeff', padding: '3px 8px', borderRadius: 6 }}>
                                {comp.bathrooms} bath
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 500 }}>
                          {comp.formattedAddress || comp.addressLine1 || 'Address N/A'}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: LB }}>
                          {comp.squareFootage && <span>{comp.squareFootage.toLocaleString()} sf</span>}
                          {comp.propertyType && <span>{comp.propertyType}</span>}
                          {comp.distance != null && <span style={{ fontWeight: 600 }}>{comp.distance.toFixed(2)} mi</span>}
                          {comp.daysOnMarket != null && <span>{comp.daysOnMarket}d on market</span>}
                        </div>
                        {comp.listingType && (
                          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: '#f59e0b', background: '#fffbeb', display: 'inline-block', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                            {comp.listingType}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>No comps loaded yet</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Click the RentCast button above</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rent Estimate Detail Cards */}
            {(rentcastData.rent || rentcastData.rentRangeLow) && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 16 }}>📊</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: VL }}>RentCast Rent Estimate</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 6 }}>ESTIMATED RENT</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>${rentcastData.rent?.toLocaleString() || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>per month</div>
                  </div>
                  <div style={{ background: '#eff6ff', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 6 }}>RENT RANGE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>
                      ${rentcastData.rentRangeLow?.toLocaleString() || '?'} – ${rentcastData.rentRangeHigh?.toLocaleString() || '?'}
                    </div>
                    <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>low – high</div>
                  </div>
                  <div style={{ background: '#faf5ff', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: 11, color: LB, fontWeight: 600, marginBottom: 6 }}>PRICE PER SQ FT</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>${rentcastData.pricePerSqFt?.toFixed(2) || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: LB, marginTop: 4 }}>/sf/month</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state — before RentCast is clicked */}
        {!rentcastData && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 28px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: VL, marginBottom: 8 }}>Market Rent Comps</div>
            <div style={{ fontSize: 13, color: LB, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Click <strong>"Fetch RentCast Comps"</strong> above to pull nearby rental comparables, see them on an interactive map, and benchmark your rents against the market.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
