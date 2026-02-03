import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export default function RentRollTab({ scenarioData, dealId, onUnitMixChange }) {
  const unitMixData = scenarioData?.unit_mix || [];
  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(null);

  const totalUnitsCount = unitMixData.reduce((sum, u) => sum + (u.units || 0), 0);
  const totalSFCount = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)), 0);
  const totalMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)), 0);
  const totalAnnualRent = totalMonthlyRent * 12;
  const unitMixTotalMarketMonthlyRent = unitMixData.reduce((sum, u) => sum + ((u.units || 0) * (u.rent_market != null ? u.rent_market : (u.rent_current || 0))), 0);

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

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '999px', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', marginRight: '12px' }}>R</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Rent Roll</div>
          </div>
          <button onClick={handleRentcastFetch} disabled={rentcastLoading} style={{ padding: '8px 16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: rentcastLoading ? 'not-allowed' : 'pointer', opacity: rentcastLoading ? 0.6 : 1 }}>
            {rentcastLoading ? 'Loading...' : '🔍 RentCast'}
          </button>
        </div>

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
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>${totalMonthlyRent.toLocaleString()}</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ANNUAL RENT</div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>${totalAnnualRent.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ marginBottom: '32px', overflowX: 'auto' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e3a8a' }}>Unit Mix</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>Unit composition and rental data</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #d1d5db' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Unit Name</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Average Unit...</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Occupied Units</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Vacant Units</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Total Units</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Occupancy Pe...</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Average Rent</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Average Mark...</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Average Renu...</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Total Market R...</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>Total Rent</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid #d1d5db' }}>$</th>
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
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{unit.type || 'N/A'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{unit.unit_sf || 0}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{occupiedUnits}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{vacantUnits}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{totalUnits}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{occupancyPct}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>${avgRent.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                      <input
                        type="number"
                        style={{ width: '80px', border: '1px solid #d1d5db', padding: '4px', fontSize: '11px', textAlign: 'right' }}
                        value={avgMarket}
                        onChange={(e) => handleMarketRentChange(idx, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>${avgMarket.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>${totalMarketRent.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>${totalRent.toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>$</td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#e0f2fe', fontWeight: 700 }}>
                <td style={{ padding: '8px', borderRight: '1px solid #0ea5e9' }}>TOTAL</td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>-</td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  {unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  {unitMixData.reduce((sum, u) => sum + ((u.units || 0) - Math.round((u.units || 0) * 0.95)), 0)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>{totalUnitsCount}</td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  {totalUnitsCount > 0 ? ((unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0) / totalUnitsCount) * 100).toFixed(1) : 0}%
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  ${(totalMonthlyRent / (unitMixData.reduce((sum, u) => sum + Math.round((u.units || 0) * 0.95), 0) || 1)).toFixed(0)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  ${(unitMixTotalMarketMonthlyRent / totalUnitsCount || 0).toFixed(0)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  ${(unitMixTotalMarketMonthlyRent / totalUnitsCount || 0).toFixed(0)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  ${unitMixTotalMarketMonthlyRent.toLocaleString()}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #0ea5e9' }}>
                  ${totalMonthlyRent.toLocaleString()}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>$</td>
              </tr>
            </tbody>
          </table>
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
