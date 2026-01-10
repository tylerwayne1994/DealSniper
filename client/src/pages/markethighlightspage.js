import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { BarChart3, Search, Home, ArrowLeft, MapPin, TrendingUp, Building, Users } from 'lucide-react';

// Add CSS animation for spinner
if (typeof document !== 'undefined') {
  const existingStyle = document.querySelector('style[data-spinner]');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.setAttribute('data-spinner', 'true');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

const RentalMarketAnalysis = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState({
    location: '',
  });
  const [marketData, setMarketData] = useState([]);
  const [renterOwnerData, setRenterOwnerData] = useState([]);
  const [uniqueCities, setUniqueCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});
  const [countyMetrics, setCountyMetrics] = useState(null);
  const [error, setError] = useState('');
  const [bedDistribution, setBedDistribution] = useState({});
  const [totalListings, setTotalListings] = useState(0);

  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
    'Wisconsin', 'Wyoming'
  ];

  const cityToCountyMap = {
    'phoenix': 'Maricopa County, Arizona',
    'las vegas': 'Clark County, Nevada',
    'reno': 'Washoe County, Nevada',
    'sparks': 'Washoe County, Nevada',
    'henderson': 'Clark County, Nevada',
    'north las vegas': 'Clark County, Nevada',
    'boulder city': 'Clark County, Nevada',
    'summerlin': 'Clark County, Nevada',
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      let allData = [];
      
      for (const state of states) {
        let csvText = null;
        let fileName = '';
        
        // Try long filename first
        fileName = `${state}_Rental_Data - ${state}_Rental_Data.csv`;
        console.log(`Trying to load: /states/${fileName}`);
        try {
          const response = await fetch(`/states/${fileName}`);
          console.log(`Response for ${fileName}:`, response.status, response.ok);
          if (response.ok) {
            csvText = await response.text();
            console.log(`Successfully loaded long format for ${state}, length: ${csvText.length}`);
          }
        } catch (err) {
          console.log(`Long format failed for ${state}:`, err);
        }
        
        // If long format failed, try short filename
        if (!csvText) {
          fileName = `${state}_Rental_Data.csv`;
          console.log(`Trying to load: /states/${fileName}`);
          try {
            const response = await fetch(`/states/${fileName}`);
            console.log(`Response for ${fileName}:`, response.status, response.ok);
            if (response.ok) {
              csvText = await response.text();
              console.log(`Successfully loaded short format for ${state}, length: ${csvText.length}`);
            }
          } catch (err) {
            console.log(`Short format failed for ${state}:`, err);
          }
        }
        
        // Process the CSV data if we successfully loaded it
        if (csvText) {
          console.log(`Processing CSV data for ${state}`);
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                const stateData = results.data.map(row => ({ ...row, state }));
                allData = [...allData, ...stateData];
                console.log(`Added ${stateData.length} records from ${state}. Total so far: ${allData.length}`);
              } else {
                console.log(`No data found in CSV for ${state}`);
              }
            },
          });
        } else {
          console.log(`No CSV data loaded for ${state}`);
        }
      }
      
      console.log(`Total records loaded: ${allData.length}`);
      setMarketData(allData);
      
      // Extract unique cities
      const cities = [...new Set(allData.map(row => row.city?.trim()).filter(Boolean))].sort();
      setUniqueCities(cities);
      console.log(`Found ${cities.length} unique cities`);

      // Load renter vs owner data
      try {
        const renterResponse = await fetch('/Renter_vs_Owner_Percentages_by_County (1).csv');
        if (renterResponse.ok) {
          const renterText = await renterResponse.text();
          Papa.parse(renterText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              setRenterOwnerData(results.data);
            },
          });
        }
      } catch (err) {
        console.log('Failed to load renter/owner data:', err);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load rental data. Please try again.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const loc = formData.location.trim().toLowerCase();
    if (!loc) {
      setError('Please enter a location');
      return;
    }

    const filtered = marketData.filter(row => 
      (row.zipCode?.toLowerCase() === loc) || 
      (row.city?.toLowerCase().includes(loc))
    );

    if (filtered.length === 0) {
      setError(`No rental data found for "${formData.location}". Try searching for a different city or zip code.`);
      return;
    }

    // Group by bedroom count
    const grouped = filtered.reduce((acc, row) => {
      const bed = row.bed ? `${row.bed}` : 'Studio';
      if (!acc[bed]) {
        acc[bed] = { rents: [], sqfts: [], rentPerSf: [], count: 0 };
      }
      
      if (row.rent && !isNaN(parseFloat(row.rent))) {
        acc[bed].rents.push(parseFloat(row.rent));
      }
      if (row.sqft && !isNaN(parseFloat(row.sqft))) {
        acc[bed].sqfts.push(parseFloat(row.sqft));
      }
      if (row.rentPerSf && !isNaN(parseFloat(row.rentPerSf))) {
        acc[bed].rentPerSf.push(parseFloat(row.rentPerSf));
      }
      acc[bed].count++;
      return acc;
    }, {});

    // Calculate averages
    const averages = Object.keys(grouped).reduce((acc, bed) => {
      const data = grouped[bed];
      acc[bed] = {
        avgRent: data.rents.length > 0 ? data.rents.reduce((a, b) => a + b, 0) / data.rents.length : 0,
        avgSqft: data.sqfts.length > 0 ? data.sqfts.reduce((a, b) => a + b, 0) / data.sqfts.length : 0,
        avgRentPerSf: data.rentPerSf.length > 0 ? data.rentPerSf.reduce((a, b) => a + b, 0) / data.rentPerSf.length : 0,
        count: data.count
      };
      return acc;
    }, {});

    const total = filtered.length;
    setTotalListings(total);

    // Calculate bedroom distribution
    const dist = Object.entries(grouped).reduce((acc, [bed, { count }]) => {
      acc[bed] = (count / total) * 100;
      return acc;
    }, {});

    setBedDistribution(dist);
    setResults(averages);

    // Get county metrics
    const mappedCounty = cityToCountyMap[loc];
    if (mappedCounty) {
      const countyRow = renterOwnerData.find(row => 
        row.County?.toLowerCase() === mappedCounty.toLowerCase()
      );
      if (countyRow) {
        setCountyMetrics({
          owner: parseFloat(countyRow['Percent Owner-Occupied']) || 0,
          renter: parseFloat(countyRow['Percent Renter-Occupied']) || 0,
        });
      } else {
        setCountyMetrics(null);
      }
    } else {
      setCountyMetrics(null);
    }
  };

  const formatCurrency = (num) => {
    if (isNaN(num)) return '$0';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatPercent = (num) => `${num.toFixed(1)}%`;

  // Enhanced Bar Chart Component
  const BarChart = ({ data, dataKey, title, color = '#3b82f6', width = 500, height = 300 }) => {
    const entries = Object.entries(data).filter(([, v]) => v[dataKey] > 0);
    if (entries.length === 0) return <div style={{ color: '#9ca3af' }}>No data available</div>;
    
    const maxValue = Math.max(...entries.map(([, v]) => v[dataKey]));
    const barWidth = (width - 100) / entries.length - 20;
    
    return (
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <BarChart3 size={20} style={{ color: '#06b6d4' }} />
          {title}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <svg width={width} height={height + 60} style={{ minWidth: '100%' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <g key={ratio}>
                <line
                  x1={50}
                  y1={height * (1 - ratio)}
                  x2={width - 50}
                  y2={height * (1 - ratio)}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text
                  x={40}
                  y={height * (1 - ratio) + 5}
                  fill="#6b7280"
                  fontSize="12"
                  textAnchor="end"
                >
                  {dataKey === 'avgRent' || dataKey === 'avgRentPerSf' 
                    ? formatCurrency(maxValue * ratio)
                    : Math.round(maxValue * ratio)
                  }
                </text>
              </g>
            ))}
            
            {entries.map(([bed, val], i) => {
              const barHeight = (val[dataKey] / maxValue) * height;
              const x = 50 + i * (barWidth + 20);
              
              return (
                <g key={i}>
                  <defs>
                    <linearGradient id={`gradient-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.6 }} />
                    </linearGradient>
                  </defs>
                  <rect
                    x={x}
                    y={height - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill={`url(#gradient-${i})`}
                    rx="6"
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={height + 20}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize="14"
                    fontWeight="500"
                  >
                    {bed === '0' ? 'Studio' : `${bed} BD`}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={height - barHeight - 10}
                    textAnchor="middle"
                    fill="#1f2937"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {dataKey === 'avgRent' || dataKey === 'avgRentPerSf' 
                      ? formatCurrency(val[dataKey])
                      : Math.round(val[dataKey])
                    }
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  // Enhanced Donut Chart Component
  const DonutChart = ({ data, title, width = 320, height = 320 }) => {
    const entries = Object.entries(data);
    if (entries.length === 0) return <div style={{ color: '#9ca3af' }}>No data available</div>;
    
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 20;
    const innerRadius = outerRadius * 0.6;
    
    let currentAngle = -90;
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6'];
    
    return (
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Building size={20} style={{ color: '#06b6d4' }} />
          {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative' }}>
            <svg width={width} height={height}>
              <defs>
                {colors.map((color, i) => (
                  <linearGradient key={i} id={`donut-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.7 }} />
                  </linearGradient>
                ))}
              </defs>
              
              {entries.map(([bed, val], i) => {
                const percentage = (val / total);
                const angle = percentage * 360;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angle;
                
                const startAngleRad = (startAngle * Math.PI) / 180;
                const endAngleRad = (endAngle * Math.PI) / 180;
                
                const x1 = centerX + outerRadius * Math.cos(startAngleRad);
                const y1 = centerY + outerRadius * Math.sin(startAngleRad);
                const x2 = centerX + outerRadius * Math.cos(endAngleRad);
                const y2 = centerY + outerRadius * Math.sin(endAngleRad);
                
                const x3 = centerX + innerRadius * Math.cos(endAngleRad);
                const y3 = centerY + innerRadius * Math.sin(endAngleRad);
                const x4 = centerX + innerRadius * Math.cos(startAngleRad);
                const y4 = centerY + innerRadius * Math.sin(startAngleRad);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M ${x1} ${y1}`,
                  `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  `L ${x3} ${y3}`,
                  `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
                  'Z'
                ].join(' ');
                
                currentAngle += angle;
                
                return (
                  <path
                    key={i}
                    d={pathData}
                    fill={`url(#donut-gradient-${i})`}
                    style={{ 
                      filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                      transition: 'opacity 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  />
                );
              })}
              
              <text
                x={centerX}
                y={centerY - 5}
                textAnchor="middle"
                fill="#1f2937"
                fontSize="24"
                fontWeight="bold"
              >
                {totalListings}
              </text>
              <text
                x={centerX}
                y={centerY + 15}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="14"
              >
                Total Units
              </text>
            </svg>
          </div>
        </div>
        
        <div style={{
          marginTop: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px'
        }}>
          {entries.map(([bed, val], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: colors[i % colors.length],
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: '#1f2937',
                  fontWeight: '500'
                }}>
                  {bed === '0' ? 'Studio' : `${bed} BD`}
                </div>
                <div style={{
                  color: '#6b7280',
                  fontSize: '0.875rem'
                }}>
                  {formatPercent(val)} ({Math.round((val / 100) * totalListings)} units)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #06b6d4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <div style={{
            color: '#1f2937',
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>
            Loading Market Data...
          </div>
          <div style={{
            color: '#6b7280',
            marginTop: '8px'
          }}>
            Analyzing rental properties across all markets
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      color: '#1f2937',
      padding: '40px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <button 
            onClick={() => setCurrentPage ? setCurrentPage('home') : window.history.back()}
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              color: '#06b6d4',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f0f9ff';
              e.target.style.color = '#0891b2';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#06b6d4';
            }}
          >
            <ArrowLeft size={20} />
            Back to Home
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Rental Market Analysis
            </h1>
            <p style={{
              color: '#6b7280',
              fontSize: '1.125rem',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Comprehensive rental market insights powered by real-time data across multiple markets
            </p>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <MapPin 
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} 
                  size={20} 
                />
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                  placeholder="Enter city name or zip code (e.g., Las Vegas, Reno, 89123)"
                  style={{
                    width: '100%',
                    paddingLeft: '48px',
                    paddingRight: '16px',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    color: '#1f2937',
                    fontSize: '16px',
                    outline: 'none'
                  }}
                />
              </div>
              <button 
                onClick={handleSubmit}
                style={{
                  padding: '16px 32px',
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Search size={20} />
                Analyze Market
              </button>
            </div>
            
            {error && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626'
              }}>
                {error}
              </div>
            )}
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Building size={24} style={{ color: '#06b6d4' }} />
            Available Markets ({uniqueCities.length} cities)
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {uniqueCities.map(city => (
              <div 
                key={city} 
                style={{
                  background: '#f9fafb',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  color: '#4b5563',
                  cursor: 'pointer',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.color = '#1f2937';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f9fafb';
                  e.target.style.color = '#4b5563';
                  e.target.style.borderColor = '#e5e7eb';
                }}
                onClick={() => setFormData(prev => ({ ...prev, location: city }))}
              >
                {city}
              </div>
            ))}
          </div>
        </div>

        {Object.keys(results).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px'
            }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Users style={{ color: '#06b6d4' }} size={24} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>Total Listings</h3>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#06b6d4' }}>{totalListings.toLocaleString()}</div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '4px' }}>Available properties</div>
              </div>
              
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <TrendingUp style={{ color: '#10b981' }} size={24} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>Avg Rent</h3>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                  {formatCurrency(Object.values(results).reduce((sum, val) => sum + val.avgRent, 0) / Object.keys(results).length)}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '4px' }}>Across all units</div>
              </div>
              
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Building style={{ color: '#f59e0b' }} size={24} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>Avg Size</h3>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {Math.round(Object.values(results).reduce((sum, val) => sum + val.avgSqft, 0) / Object.keys(results).length).toLocaleString()}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '4px' }}>Square feet</div>
              </div>
              
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <BarChart3 style={{ color: '#8b5cf6' }} size={24} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>Price/Sqft</h3>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {formatCurrency(Object.values(results).reduce((sum, val) => sum + val.avgRentPerSf, 0) / Object.keys(results).length)}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '4px' }}>Per square foot</div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '32px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <BarChart 
                  data={results} 
                  dataKey="avgRent" 
                  title="Average Rent by Bedroom Count" 
                  color="#06b6d4" 
                />
                <BarChart 
                  data={results} 
                  dataKey="avgRentPerSf" 
                  title="Average Rent per Square Foot" 
                  color="#f59e0b" 
                />
              </div>
              
              <div>
                <DonutChart 
                  data={bedDistribution} 
                  title="Market Distribution" 
                />
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '24px'
              }}>
                Detailed Breakdown
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <>
                    <thead>
                      <tr>
                        <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Bedrooms</th>
                        <th style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Avg Rent</th>
                        <th style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Avg Sqft</th>
                        <th style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Rent/Sqft</th>
                        <th style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(results).map(([bed, val]) => (
                        <tr key={bed}>
                          <td style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', color: '#1f2937' }}>
                            {bed === '0' ? 'Studio' : `${bed} Bedroom`}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#06b6d4' }}>
                            {formatCurrency(val.avgRent)}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#10b981' }}>
                            {Math.round(val.avgSqft).toLocaleString()}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#f59e0b' }}>
                            {formatCurrency(val.avgRentPerSf)}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#8b5cf6' }}>
                            {val.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                </table>
              </div>
            </div>

            {countyMetrics && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Users size={24} style={{ color: '#06b6d4' }} />
                  County Housing Metrics
                </h3>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '8px' }}>Owner-Occupied</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#06b6d4' }}>{formatPercent(countyMetrics.owner)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '8px' }}>Renter-Occupied</div>
                    <div style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#10b981' }}>{formatPercent(countyMetrics.renter)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RentalMarketAnalysis;