import React, { useRef, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export default function RentRollTab({ scenarioData, dealId, onUnitMixChange }) {
  const unitMixData = scenarioData?.unit_mix || [];
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(null);

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
  const totalSFCount = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)), 0);
  const totalMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
  const totalAnnualRent = totalMonthlyRent * 12;
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
      });
      const data = await response.json();
      if (data.success) {
        setRentcastData(data.data);
      } else {
        alert(`RentCast error: ${data.error || 'Unknown error'}\nAddress searched: ${data.address_searched || 'N/A'}`);
      }
    } catch (error) {
      console.error('RentCast API error:', error);
      alert('Failed to fetch RentCast data. Check console for details.');
    } finally {
      setRentcastLoading(false);
    }
  };

  // Column resize handlers
  const onResizerMouseDown = (index, e) => {
    const startX = e.clientX;
    const startWidth = colWidths[index];
    resizingRef.current = { index, startX, startWidth };

    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX;
      setColWidths((prev) => {
        const next = [...prev];
        const newWidth = Math.max(80, startWidth + dx);
        next[index] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      resizingRef.current = { index: null, startX: 0, startWidth: 0 };
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Unit Mix</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Unit composition and rental data</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleRentcastFetch} disabled={rentcastLoading} style={{ padding: '6px 10px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: rentcastLoading ? 'not-allowed' : 'pointer', opacity: rentcastLoading ? 0.6 : 1 }}>
              {rentcastLoading ? 'Loading...' : '🔍 RentCast'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', minWidth: 110 }}>Source Document</div>
          <select
            style={{ border: '1px solid #d1d5db', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', minWidth: 260 }}
            defaultValue={scenarioData?.source_filename || ''}
          >
            <option value="">{scenarioData?.source_filename || 'Select a source...'}</option>
          </select>
          <button type="button" style={{ marginLeft: 'auto', fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View Source</button>
        </div>

        {/* Summary cards hidden to match Cactus screenshot */}
        {false && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL UNITS</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#0f172a' }}>{totalUnitsCount}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL SF</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#0f172a' }}>{totalSFCount.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MONTHLY RENT</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>{fmtCurrency(totalMonthlyRent)}</div>
            </div>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ANNUAL RENT</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>{fmtCurrency(totalAnnualRent)}</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Unit Mix Data</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>{unitMixData.length} unit types</div>
              <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>↔ Resize columns by dragging between headers.</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                {initialColumns.map((col, i) => (
                  <th
                    key={col.key}
                    style={{
                      padding: '9px 10px',
                      textAlign: col.align,
                      fontWeight: 600,
                      color: '#374151',
                      borderRight: i === initialColumns.length - 1 ? 'none' : '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      position: 'relative',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</div>
                    {i < initialColumns.length - 1 && (
                      <div
                        onMouseDown={(e) => onResizerMouseDown(i, e)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '8px',
                          height: '100%',
                          cursor: 'col-resize',
                          zIndex: 5,
                        }}
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
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
              This unit mix data will be used in your quick analysis. You can change the selection using the dropdown above.
            </div>
          </div>
        </div>

        {rentcastData && (
          <div style={{ marginTop: '32px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>🔍 RentCast Data</h3>
            <pre style={{ fontSize: '12px', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', overflow: 'auto' }}>
              {JSON.stringify(rentcastData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
