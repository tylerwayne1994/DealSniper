import React, { useState } from 'react';

const API_BASE = 'http://127.0.0.1:8010';

export default function RentRollTab({ scenarioData, dealId, onUnitMixChange }) {
  const unitMixData = scenarioData?.unit_mix || [];

  const [rentcastLoading, setRentcastLoading] = useState(false);
  const [rentcastData, setRentcastData] = useState(null);

  const totalUnitsCount = unitMixData.reduce((sum, u) => sum + (u.units || 0), 0);
  const totalSFCount = unitMixData.reduce(
    (sum, u) => sum + ((u.units || 0) * (u.unit_sf || 0)),
    0,
  );
  const totalMonthlyRent = unitMixData.reduce(
    (sum, u) => sum + ((u.units || 0) * (u.rent_current || 0)),
    0,
  );
  const totalAnnualRent = totalMonthlyRent * 12;
  const unitMixTotalMarketMonthlyRent = unitMixData.reduce(
    (sum, u) =>
      sum +
      ((u.units || 0) * (u.rent_market != null ? u.rent_market : (u.rent_current || 0))),
    0,
  );

  const handleMarketRentChange = (index, newMarketRent) => {
    if (!onUnitMixChange) return;
    const updatedUnitMix = [...unitMixData];
    updatedUnitMix[index] = {
      ...updatedUnitMix[index],
      rent_market: newMarketRent,
    };
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
        alert(
          `RentCast error: ${data.error || 'Unknown error'}\nAddress searched: ${
            data.address_searched || 'N/A'
          }`,
        );
      }
    } catch (error) {
      console.error('RentCast API error:', error);
      alert('Failed to fetch RentCast data. Check console for details.');
    } finally {
      setRentcastLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* Header with RentCast button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                backgroundColor: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '16px',
                marginRight: '12px',
                boxShadow: '0 6px 18px rgba(16,185,129,0.45)',
              }}
            >
              8
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#111827',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              RENT ROLL ANALYSIS
            </h2>
          </div>
          <button
            onClick={handleRentcastFetch}
            disabled={rentcastLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: rentcastLoading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: rentcastLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#2563eb')}
            onMouseLeave={(e) => !rentcastLoading && (e.target.style.backgroundColor = '#3b82f6')}
          >
            {rentcastLoading ? 'Loading...' : 'Fetch RentCast Comps'}
          </button>
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 4px 10px rgba(15,23,42,0.12)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              TOTAL UNITS
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#111827' }}>{totalUnitsCount}</div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 4px 10px rgba(15,23,42,0.12)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              TOTAL SF
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#111827' }}>
              {totalSFCount.toLocaleString()}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 4px 10px rgba(15,23,42,0.12)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              MONTHLY RENT
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>
              ${totalMonthlyRent.toLocaleString()}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 4px 10px rgba(15,23,42,0.12)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              ANNUAL RENT
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: '#10b981' }}>
              ${totalAnnualRent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Unit mix table */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '2px solid #e5e7eb',
              backgroundColor: '#1d4ed8',
              borderRadius: '16px 16px 0 0',
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '700',
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Unit Mix (Parsed Data)
            </h4>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'left',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  Unit Type
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  # Units
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  SF per Unit
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  Current Rent/Mo
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  Market Rent/Mo
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  Annual Rent
                </th>
                <th
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #d1d5db',
                  }}
                >
                  $/SF (Annual)
                </th>
              </tr>
            </thead>
            <tbody>
              {unitMixData.map((unit, idx) => {
                const annualRent = (unit.rent_current || 0) * 12;
                const psfAnnual = unit.unit_sf > 0 ? annualRent / unit.unit_sf : 0;
                const marketRentValue = unit.rent_market || unit.rent_current || 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'background 0.15s',
                      backgroundColor: 'white',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                  >
                    <td
                      style={{
                        padding: '16px 24px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#111827',
                      }}
                    >
                      {unit.type || 'N/A'}
                    </td>
                    <td
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#6b7280',
                        fontWeight: '500',
                      }}
                    >
                      {unit.units || 0}
                    </td>
                    <td
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#6b7280',
                        fontWeight: '500',
                      }}
                    >
                      {(unit.unit_sf || 0).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '16px 24px',
                        textAlign: 'right',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#10b981',
                      }}
                    >
                      ${(unit.rent_current || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <input
                        type="number"
                        value={marketRentValue}
                        onChange={(e) => {
                          const newMarketRent =
                            e.target.value === '' ? 0 : parseFloat(e.target.value);
                          handleMarketRentChange(idx, newMarketRent);
                        }}
                        style={{
                          width: '100px',
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#1e40af',
                          backgroundColor: '#eff6ff',
                          border: '2px solid #93c5fd',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          textAlign: 'right',
                          outline: 'none',
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: '16px 24px',
                        textAlign: 'right',
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: '600',
                      }}
                    >
                      ${annualRent.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '16px 24px',
                        textAlign: 'right',
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: '600',
                      }}
                    >
                      ${psfAnnual.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                style={{
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  borderTop: '2px solid #d1d5db',
                }}
              >
                <td
                  style={{
                    padding: '16px 24px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#111827',
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#111827',
                  }}
                >
                  {totalUnitsCount}
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#111827',
                  }}
                >
                  {totalSFCount.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#10b981',
                  }}
                >
                  ${totalMonthlyRent.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e40af',
                  }}
                >
                  ${unitMixTotalMarketMonthlyRent.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#111827',
                  }}
                >
                  ${totalAnnualRent.toLocaleString()}
                </td>
                <td
                  style={{
                    padding: '16px 24px',
                    textAlign: 'right',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#111827',
                  }}
                >
                  ${totalSFCount > 0 ? (totalAnnualRent / totalSFCount).toFixed(2) : '0.00'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RentCast Results */}
        {rentcastData && (
          <div style={{ marginTop: '24px' }}>
            {/* Summary Cards */}
            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '2px solid #93c5fd',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                marginBottom: '20px',
              }}
            >
              <h4
                style={{
                  margin: '0 0 20px 0',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1e40af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                RentCast Market Data
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#065f46',
                      fontWeight: '700',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Estimated Rent
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#047857',
                    }}
                  >
                    ${rentcastData.rent?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    borderRadius: '12px',
                    border: '2px solid #3b82f6',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#1e3a8a',
                      fontWeight: '700',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Price per Sq Ft
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#1e40af',
                    }}
                  >
                    ${rentcastData.pricePerSqFt?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius: '12px',
                    border: '2px solid #f59e0b',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#78350f',
                      fontWeight: '700',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Rent Range
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      color: '#92400e',
                    }}
                  >
                    ${rentcastData.rentRangeLow?.toLocaleString() || 'N/A'} - $
                    {rentcastData.rentRangeHigh?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                    borderRadius: '12px',
                    border: '2px solid #ec4899',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#831843',
                      fontWeight: '700',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Comparable Listings
                  </div>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: '#9f1239',
                    }}
                  >
                    {rentcastData.comparables?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Map and Comps Side by Side */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
              }}
            >
              {/* Map */}
              <div
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
                  }}
                >
                  <h5
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'white',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Property Location & Comps
                  </h5>
                </div>
                {rentcastData.latitude && rentcastData.longitude ? (
                  <iframe
                    title="Property Map"
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(rentcastData.longitude) - 0.02},${Number(rentcastData.latitude) - 0.02},${Number(rentcastData.longitude) + 0.02},${Number(rentcastData.latitude) + 0.02}&layer=mapnik&marker=${Number(rentcastData.latitude)},${Number(rentcastData.longitude)}`}
                  />
                ) : (
                  <div
                    style={{
                      height: '400px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                    }}
                  >
                    No location data available
                  </div>
                )}
              </div>

              {/* Comparables List */}
              <div
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
                  }}
                >
                  <h5
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'white',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Nearby Rental Comps
                  </h5>
                </div>
                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '16px',
                  }}
                >
                  {rentcastData.comparables && rentcastData.comparables.length > 0 ? (
                    rentcastData.comparables.map((comp, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          marginBottom: '12px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '16px',
                              color: '#10b981',
                            }}
                          >
                            ${comp.price?.toLocaleString() || 'N/A'}/mo
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              fontWeight: '600',
                            }}
                          >
                            {comp.bedrooms || 0} bed • {comp.bathrooms || 0} bath
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#374151',
                            marginBottom: '4px',
                          }}
                        >
                          {comp.squareFootage
                            ? `${comp.squareFootage.toLocaleString()} sq ft`
                            : 'Size N/A'}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#6b7280',
                          }}
                        >
                          {comp.addressLine1 || 'Address not available'}
                        </div>
                        {comp.distance && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#9ca3af',
                              marginTop: '4px',
                            }}
                          >
                            {comp.distance.toFixed(2)} miles away
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#9ca3af',
                      }}
                    >
                      No comparable listings found nearby
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
