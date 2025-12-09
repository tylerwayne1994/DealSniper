// Market Data Dashboard - Local Housing Data Display
// Shows census, rent, home value, and economic data for a given ZIP/County

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Home,
  Users,
  Building2,
  Briefcase,
  Shield,
  Search,
  Loader,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  FileText,
  ExternalLink,
  Globe
} from 'lucide-react';
import Papa from 'papaparse';
import ReactMarkdown from 'react-markdown';

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
};

const formatNumber = (value) => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
};

const TrendIndicator = ({ value, inverted = false }) => {
  if (value === null || value === undefined || isNaN(value)) {
    return <Minus size={14} color="#9ca3af" />;
  }
  const num = Number(value);
  const isPositive = inverted ? num < 0 : num > 0;
  const isNegative = inverted ? num > 0 : num < 0;
  
  if (isPositive) return <ArrowUpRight size={14} color="#10b981" />;
  if (isNegative) return <ArrowDownRight size={14} color="#ef4444" />;
  return <Minus size={14} color="#9ca3af" />;
};

// Generate WorldPopulationReview.com URL
const getWorldPopReviewUrl = (city, state, zip) => {
  // Priority: City URL > ZIP URL
  if (city && state) {
    // Format: https://worldpopulationreview.com/us-cities/dallas-texas-population
    const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const stateMap = {
      'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas', 'CA': 'california',
      'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware', 'FL': 'florida', 'GA': 'georgia',
      'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa',
      'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
      'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi', 'MO': 'missouri',
      'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada', 'NH': 'new-hampshire', 'NJ': 'new-jersey',
      'NM': 'new-mexico', 'NY': 'new-york', 'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio',
      'OK': 'oklahoma', 'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island', 'SC': 'south-carolina',
      'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VT': 'vermont',
      'VA': 'virginia', 'WA': 'washington', 'WV': 'west-virginia', 'WI': 'wisconsin', 'WY': 'wyoming',
      'DC': 'district-of-columbia'
    };
    const stateSlug = stateMap[state.toUpperCase()] || state.toLowerCase();
    return `https://worldpopulationreview.com/us-cities/${citySlug}-${stateSlug}-population`;
  }
  if (zip) {
    // Format: https://worldpopulationreview.com/zips/75001
    return `https://worldpopulationreview.com/zips/${zip}`;
  }
  return null;
};

// ============================================================================
// Metric Card Component
// ============================================================================

const MetricCard = ({ label, value, subValue, icon: Icon, trend, format = 'text', color = '#3b82f6' }) => {
  let displayValue = value;
  
  if (format === 'currency') displayValue = formatCurrency(value);
  else if (format === 'percent') displayValue = formatPercent(value);
  else if (format === 'number') displayValue = formatNumber(value);
  else if (value === null || value === undefined) displayValue = '—';
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {Icon && <Icon size={18} color={color} />}
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </span>
        </div>
        {trend !== undefined && <TrendIndicator value={trend} />}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
        {displayValue}
      </div>
      {subValue && (
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {subValue}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Section Header Component
// ============================================================================

const SectionHeader = ({ title, icon: Icon, color = '#3b82f6' }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    marginBottom: '16px',
    marginTop: '24px'
  }}>
    {Icon && <Icon size={20} color={color} />}
    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>
      {title}
    </h3>
  </div>
);

// ============================================================================
// Score Badge Component
// ============================================================================

const ScoreBadge = ({ score, label }) => {
  const getColor = (s) => {
    if (s >= 7) return { bg: '#dcfce7', text: '#166534' };
    if (s >= 5) return { bg: '#fef3c7', text: '#92400e' };
    return { bg: '#fee2e2', text: '#991b1b' };
  };
  
  const colors = getColor(score);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: colors.bg,
      borderRadius: '8px'
    }}>
      <span style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>{score}</span>
      <span style={{ fontSize: '12px', color: colors.text }}>/10</span>
      <span style={{ fontSize: '12px', color: colors.text, marginLeft: '4px' }}>{label}</span>
    </div>
  );
};

// ============================================================================
// FMR Table Component
// ============================================================================

const FMRTable = ({ fmrData }) => {
  if (!fmrData) return null;
  
  const beds = ['0br', '1br', '2br', '3br', '4br'];
  const labels = ['Studio', '1 BR', '2 BR', '3 BR', '4 BR'];
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
          HUD Fair Market Rents (2024)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {beds.map((bed, idx) => (
          <div key={bed} style={{
            padding: '16px',
            textAlign: 'center',
            borderRight: idx < 4 ? '1px solid #f3f4f6' : 'none'
          }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{labels[idx]}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              {formatCurrency(fmrData[`fmr_${bed}`])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const MarketDataDashboard = ({ dealId, initialZip, initialCity, initialState, initialCounty }) => {
  const [searchZip, setSearchZip] = useState(initialZip || '');
  const [searchCounty, setSearchCounty] = useState(initialCounty || '');
  const [searchState, setSearchState] = useState(initialState || '');
  const [activeSearch, setActiveSearch] = useState({ zip: initialZip, county: initialCounty, state: initialState });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [zhviData, setZhviData] = useState(null);
  const [zhvfData, setZhvfData] = useState(null);
  const [fmrData, setFmrData] = useState(null);
  const [dp03Data, setDp03Data] = useState(null);
  const [dp04Data, setDp04Data] = useState(null);
  const [b01003Data, setB01003Data] = useState(null);
  const [landlordData, setLandlordData] = useState(null);
  const [propertyTaxData, setPropertyTaxData] = useState(null);
  const [rentalStatsData, setRentalStatsData] = useState(null);
  
  // CSV data caches (loaded once)
  const [csvCache, setCsvCache] = useState({});
  const [csvLoading, setCsvLoading] = useState(true);
  
  // AI Summary state
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Load CSV files on mount
  useEffect(() => {
    const loadCSVs = async () => {
      setCsvLoading(true);
      try {
        const csvFiles = {
          zhvi: '/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
          zhvf: '/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
          fmr: '/fmr_by_zip_clean.csv',
          dp03: '/ACSDP5Y2023.DP03-Data.csv',
          dp04: '/ACSDP5Y2023.DP04-Data.csv',
          b01003: '/ACSDT5Y2023.B01003-Data.csv',
          landlord: '/landlord_friendly_scores.csv',
          propertyTax: '/Property Taxes by State and County, 2025 Tax Foundation Maps.csv',
          rentalStats: '/zip_renter_owner_stats_with_counts.csv'
        };
        
        const loadedData = {};
        
        for (const [key, path] of Object.entries(csvFiles)) {
          try {
            const response = await fetch(path);
            if (response.ok) {
              const text = await response.text();
              const parsed = Papa.parse(text, { 
                header: true, 
                skipEmptyLines: true,
                dynamicTyping: true 
              });
              loadedData[key] = parsed.data;
              console.log(`Loaded ${key}: ${parsed.data.length} rows`);
            }
          } catch (e) {
            console.warn(`Failed to load ${key}:`, e);
          }
        }
        
        setCsvCache(loadedData);
      } catch (e) {
        console.error('Error loading CSVs:', e);
        setError('Failed to load market data files');
      } finally {
        setCsvLoading(false);
      }
    };
    
    loadCSVs();
  }, []);

  // Search function
  const performSearch = useCallback(() => {
    if (!searchZip && !searchCounty) {
      setError('Please enter a ZIP code or county name');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const zip = searchZip?.trim();
      const county = searchCounty?.trim();
      const state = searchState?.trim()?.toUpperCase();
      
      // Search ZHVI by ZIP
      if (zip && csvCache.zhvi) {
        const found = csvCache.zhvi.find(row => 
          String(row.RegionName).padStart(5, '0') === zip.padStart(5, '0')
        );
        setZhviData(found || null);
      }
      
      // Search ZHVF by ZIP
      if (zip && csvCache.zhvf) {
        const found = csvCache.zhvf.find(row => 
          String(row.RegionName).padStart(5, '0') === zip.padStart(5, '0')
        );
        setZhvfData(found || null);
      }
      
      // Search FMR by ZIP
      if (zip && csvCache.fmr) {
        const found = csvCache.fmr.find(row => 
          String(row.zip).padStart(5, '0') === zip.padStart(5, '0')
        );
        setFmrData(found || null);
      }
      
      // Search Rental Stats by ZIP
      if (zip && csvCache.rentalStats) {
        const found = csvCache.rentalStats.find(row => 
          String(row.zip).padStart(5, '0') === zip.padStart(5, '0')
        );
        setRentalStatsData(found || null);
      }
      
      // Search Census data by county (rows start at index 2 with actual data)
      const searchCountyName = county?.toLowerCase() || '';
      
      if (csvCache.dp03) {
        const found = csvCache.dp03.find(row => {
          const name = (row.NAME || '').toLowerCase();
          return name.includes(searchCountyName) && (!state || name.includes(state.toLowerCase()));
        });
        setDp03Data(found || null);
      }
      
      if (csvCache.dp04) {
        const found = csvCache.dp04.find(row => {
          const name = (row.NAME || '').toLowerCase();
          return name.includes(searchCountyName) && (!state || name.includes(state.toLowerCase()));
        });
        setDp04Data(found || null);
      }
      
      if (csvCache.b01003) {
        const found = csvCache.b01003.find(row => {
          const name = (row.NAME || '').toLowerCase();
          return name.includes(searchCountyName) && (!state || name.includes(state.toLowerCase()));
        });
        setB01003Data(found || null);
      }
      
      // Search Landlord scores by state
      if (state && csvCache.landlord) {
        const found = csvCache.landlord.find(row => {
          const rowState = (row.State || '').toUpperCase();
          return rowState === state || rowState.includes(state);
        });
        setLandlordData(found || null);
      }
      
      // Search Property Tax by county/state
      if (csvCache.propertyTax) {
        const found = csvCache.propertyTax.find(row => {
          const rowCounty = (row.County || '').toLowerCase();
          const rowState = (row.State || '').toLowerCase();
          return rowCounty.includes(searchCountyName) && (!state || rowState.includes(state.toLowerCase()));
        });
        setPropertyTaxData(found || null);
      }
      
      setActiveSearch({ zip, county, state });
      
    } catch (e) {
      setError('Error searching data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [searchZip, searchCounty, searchState, csvCache]);

  // Auto-search on initial load if we have initial values
  useEffect(() => {
    if (!csvLoading && (initialZip || initialCounty) && Object.keys(csvCache).length > 0) {
      performSearch();
    }
  }, [csvLoading, csvCache]);

  // Get the most recent ZHVI value (last column with a date)
  const getCurrentHomeValue = () => {
    if (!zhviData) return null;
    const dateColumns = Object.keys(zhviData).filter(k => k.match(/^\d{2}-\d{2}-\d{2}$/) || k.match(/^\d{4}-\d{2}-\d{2}$/));
    if (dateColumns.length === 0) return null;
    const latestCol = dateColumns[dateColumns.length - 1];
    return zhviData[latestCol];
  };

  // Generate AI Summary using collected data
  const generateAISummary = async () => {
    if (!hasAnyData) return;
    
    setSummaryLoading(true);
    setSummaryError(null);
    setAiSummary(null);
    
    try {
      // Collect all market data into a single object
      const marketData = {
        // Home Values
        homeValue: getCurrentHomeValue(),
        forecast1m: zhvfData?.['2025-07-31'],
        forecast3m: zhvfData?.['2025-09-30'],
        forecast12m: zhvfData?.['2026-06-30'],
        
        // FMR Rents
        fmr0br: fmrData?.fmr_0br,
        fmr1br: fmrData?.fmr_1br,
        fmr2br: fmrData?.fmr_2br,
        fmr3br: fmrData?.fmr_3br,
        fmr4br: fmrData?.fmr_4br,
        
        // Economic Data (DP03)
        medianIncome: dp03Data?.DP03_0062E,
        meanIncome: dp03Data?.DP03_0063E,
        perCapitaIncome: dp03Data?.DP03_0088E,
        unemploymentRate: dp03Data?.DP03_0009E,
        laborForceParticipation: dp03Data?.DP03_0002PE,
        povertyRate: dp03Data?.DP03_0128PE,
        
        // Housing Data (DP04)
        totalUnits: dp04Data?.DP04_0001E,
        censusHomeValue: dp04Data?.DP04_0089E,
        censusRent: dp04Data?.DP04_0134E,
        vacancyRate: dp04Data?.DP04_0003PE,
        ownerOccupied: dp04Data?.DP04_0046PE,
        renterOccupied: dp04Data?.DP04_0047PE,
        
        // Population
        population: b01003Data?.B01003_001E,
        
        // Landlord Scores
        evictionScore: landlordData?.EvictionScore,
        depositScore: landlordData?.DepositAmountScore,
        rentControlScore: landlordData?.RentControlScore,
        terminationScore: landlordData?.TerminationNoticeScore,
        
        // Property Tax
        propertyTaxRate: propertyTaxData?.['Effective Property Tax Rate'] ? (propertyTaxData['Effective Property Tax Rate'] * 100).toFixed(2) : null,
        medianTaxesPaid: propertyTaxData?.['Median Property Taxes Paid 2023'],
        
        // Rental Stats
        renterPercentage: rentalStatsData?.pct_renter
      };
      
      const location = {
        zip: activeSearch.zip,
        city: zhviData?.City || fmrData?.county_name || activeSearch.county,
        state: zhviData?.State || fmrData?.state_usps || activeSearch.state,
        county: activeSearch.county || dp03Data?.NAME?.split(',')[0] || ''
      };
      
      const response = await fetch('http://localhost:8010/api/market-data/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData, location })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAiSummary(data.summary);
      } else {
        setSummaryError(data.error || 'Failed to generate summary');
      }
    } catch (e) {
      console.error('AI Summary error:', e);
      setSummaryError('Failed to connect to AI service');
    } finally {
      setSummaryLoading(false);
    }
  };

  const hasAnyData = zhviData || fmrData || dp03Data || dp04Data || landlordData || propertyTaxData;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <BarChart3 size={24} color="#3b82f6" />
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Market Data Dashboard
          </h2>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          View housing, economic, and demographic data for any market
        </p>
      </div>

      {/* Search Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e5e7eb',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              ZIP Code
            </label>
            <input
              type="text"
              value={searchZip}
              onChange={(e) => setSearchZip(e.target.value)}
              placeholder="e.g., 75001"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ flex: '2', minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              County Name
            </label>
            <input
              type="text"
              value={searchCounty}
              onChange={(e) => setSearchCounty(e.target.value)}
              placeholder="e.g., Dallas"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ flex: '1', minWidth: '80px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              State
            </label>
            <input
              type="text"
              value={searchState}
              onChange={(e) => setSearchState(e.target.value)}
              placeholder="TX"
              maxLength={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                textTransform: 'uppercase'
              }}
            />
          </div>
          <button
            onClick={performSearch}
            disabled={loading || csvLoading}
            style={{
              padding: '10px 24px',
              backgroundColor: loading || csvLoading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || csvLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {loading || csvLoading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {csvLoading ? 'Loading Data...' : 'Searching...'}
              </>
            ) : (
              <>
                <Search size={16} />
                Search
              </>
            )}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: '13px', color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {/* Results Display */}
      {hasAnyData && (
        <>
          {/* Location Header */}
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={20} />
                <span style={{ fontSize: '18px', fontWeight: '700' }}>
                  {zhviData?.City || fmrData?.county_name || activeSearch.county || 'Unknown'}, {zhviData?.State || fmrData?.state_usps || activeSearch.state || ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* World Population Review Link */}
                {getWorldPopReviewUrl(
                  zhviData?.City || fmrData?.county_name || activeSearch.county,
                  zhviData?.State || fmrData?.state_usps || activeSearch.state,
                  activeSearch.zip
                ) && (
                  <a
                    href={getWorldPopReviewUrl(
                      zhviData?.City || fmrData?.county_name || activeSearch.county,
                      zhviData?.State || fmrData?.state_usps || activeSearch.state,
                      activeSearch.zip
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Globe size={16} />
                    Population Data
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={generateAISummary}
                  disabled={summaryLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: summaryLoading ? '#4b5563' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: summaryLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {summaryLoading ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generate AI Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>
              {activeSearch.zip && `ZIP: ${activeSearch.zip}`}
              {activeSearch.zip && activeSearch.county && ' • '}
              {activeSearch.county && `County: ${activeSearch.county}`}
              {zhviData?.Metro && ` • Metro: ${zhviData.Metro}`}
            </div>
          </div>

          {/* AI Summary Display */}
          {(aiSummary || summaryLoading || summaryError) && (
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Sparkles size={20} color="#6366f1" />
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', margin: 0 }}>
                  AI Investment Analysis
                </h3>
              </div>
              
              {summaryError && (
                <div style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  {summaryError}
                </div>
              )}
              
              {summaryLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6366f1' }}>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Analyzing market data and generating investment insights...</span>
                </div>
              )}
              
              {aiSummary && (
                <div style={{ 
                  color: '#1e293b', 
                  fontSize: '15px', 
                  lineHeight: '1.7',
                  maxHeight: '600px',
                  overflowY: 'auto'
                }}>
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '12px' }}>{children}</h1>,
                      h2: ({children}) => <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e40af', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>{children}</h2>,
                      h3: ({children}) => <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginTop: '16px', marginBottom: '8px' }}>{children}</h3>,
                      p: ({children}) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                      ul: ({children}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                      li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                      strong: ({children}) => <strong style={{ color: '#111827', fontWeight: '700' }}>{children}</strong>
                    }}
                  >
                    {aiSummary}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {/* Home Values Section */}
          {(zhviData || zhvfData) && (
            <>
              <SectionHeader title="Home Values (Zillow)" icon={Home} color="#8b5cf6" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard 
                  label="Current Home Value" 
                  value={getCurrentHomeValue()} 
                  format="currency"
                  icon={Home}
                  color="#8b5cf6"
                  subValue="Zillow Home Value Index"
                />
                {zhvfData && (
                  <>
                    <MetricCard 
                      label="1-Month Forecast" 
                      value={zhvfData['2025-07-31']} 
                      format="percent"
                      icon={TrendingUp}
                      color="#8b5cf6"
                      trend={zhvfData['2025-07-31']}
                    />
                    <MetricCard 
                      label="3-Month Forecast" 
                      value={zhvfData['2025-09-30']} 
                      format="percent"
                      icon={TrendingUp}
                      color="#8b5cf6"
                      trend={zhvfData['2025-09-30']}
                    />
                    <MetricCard 
                      label="12-Month Forecast" 
                      value={zhvfData['2026-06-30']} 
                      format="percent"
                      icon={TrendingUp}
                      color="#8b5cf6"
                      trend={zhvfData['2026-06-30']}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* Fair Market Rents */}
          {fmrData && (
            <>
              <SectionHeader title="Rental Market (HUD)" icon={Building2} color="#10b981" />
              <div style={{ marginBottom: '24px' }}>
                <FMRTable fmrData={fmrData} />
                {fmrData.metro && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                    HUD Area: {fmrData.hud_area_name || fmrData.metro}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Economic Data */}
          {dp03Data && (
            <>
              <SectionHeader title="Economic Profile (Census ACS)" icon={Briefcase} color="#f59e0b" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard 
                  label="Median Household Income" 
                  value={dp03Data.DP03_0062E} 
                  format="currency"
                  icon={DollarSign}
                  color="#f59e0b"
                />
                <MetricCard 
                  label="Mean Household Income" 
                  value={dp03Data.DP03_0063E} 
                  format="currency"
                  icon={DollarSign}
                  color="#f59e0b"
                />
                <MetricCard 
                  label="Per Capita Income" 
                  value={dp03Data.DP03_0088E} 
                  format="currency"
                  icon={DollarSign}
                  color="#f59e0b"
                />
                <MetricCard 
                  label="Unemployment Rate" 
                  value={dp03Data.DP03_0009E} 
                  format="percent"
                  icon={Briefcase}
                  color="#f59e0b"
                />
                <MetricCard 
                  label="Labor Force Participation" 
                  value={dp03Data.DP03_0002PE} 
                  format="percent"
                  icon={Users}
                  color="#f59e0b"
                />
                <MetricCard 
                  label="Poverty Rate" 
                  value={dp03Data.DP03_0128PE} 
                  format="percent"
                  icon={AlertCircle}
                  color="#ef4444"
                />
              </div>
            </>
          )}

          {/* Housing Characteristics */}
          {dp04Data && (
            <>
              <SectionHeader title="Housing Characteristics (Census ACS)" icon={Home} color="#06b6d4" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard 
                  label="Total Housing Units" 
                  value={dp04Data.DP04_0001E} 
                  format="number"
                  icon={Building2}
                  color="#06b6d4"
                />
                <MetricCard 
                  label="Median Home Value" 
                  value={dp04Data.DP04_0089E} 
                  format="currency"
                  icon={Home}
                  color="#06b6d4"
                />
                <MetricCard 
                  label="Median Gross Rent" 
                  value={dp04Data.DP04_0134E} 
                  format="currency"
                  icon={DollarSign}
                  color="#06b6d4"
                />
                <MetricCard 
                  label="Vacancy Rate" 
                  value={dp04Data.DP04_0003PE} 
                  format="percent"
                  icon={Building2}
                  color="#06b6d4"
                />
                <MetricCard 
                  label="Owner Occupied" 
                  value={dp04Data.DP04_0046PE} 
                  format="percent"
                  icon={Home}
                  color="#06b6d4"
                />
                <MetricCard 
                  label="Renter Occupied" 
                  value={dp04Data.DP04_0047PE} 
                  format="percent"
                  icon={Users}
                  color="#06b6d4"
                />
              </div>
            </>
          )}

          {/* Population */}
          {b01003Data && (
            <>
              <SectionHeader title="Population (Census)" icon={Users} color="#ec4899" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard 
                  label="Total Population" 
                  value={b01003Data.B01003_001E} 
                  format="number"
                  icon={Users}
                  color="#ec4899"
                />
              </div>
            </>
          )}

          {/* Landlord & Tax Info */}
          {(landlordData || propertyTaxData) && (
            <>
              <SectionHeader title="Investor Metrics" icon={Shield} color="#6366f1" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {landlordData && (
                  <>
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e5e7eb',
                      gridColumn: 'span 2'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase' }}>
                        Landlord Friendliness Scores ({landlordData.State})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <ScoreBadge score={landlordData.EvictionScore} label="Eviction" />
                        <ScoreBadge score={landlordData.DepositAmountScore} label="Deposit" />
                        <ScoreBadge score={landlordData.RentControlScore} label="Rent Control" />
                        <ScoreBadge score={landlordData.TerminationNoticeScore} label="Termination" />
                      </div>
                    </div>
                  </>
                )}
                {propertyTaxData && (
                  <>
                    <MetricCard 
                      label="Effective Property Tax Rate" 
                      value={propertyTaxData['Effective Property Tax Rate'] * 100} 
                      format="percent"
                      icon={DollarSign}
                      color="#6366f1"
                      subValue={`${propertyTaxData.County}, ${propertyTaxData.State}`}
                    />
                    <MetricCard 
                      label="Median Property Taxes Paid" 
                      value={propertyTaxData['Median Property Taxes Paid 2023']} 
                      format="currency"
                      icon={DollarSign}
                      color="#6366f1"
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* Rental Stats */}
          {rentalStatsData && (
            <>
              <SectionHeader title="Rental Demographics" icon={Users} color="#14b8a6" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <MetricCard 
                  label="Total Units" 
                  value={rentalStatsData.total_units} 
                  format="number"
                  icon={Building2}
                  color="#14b8a6"
                />
                <MetricCard 
                  label="Renter Occupied Units" 
                  value={rentalStatsData.renter_occupied} 
                  format="number"
                  icon={Users}
                  color="#14b8a6"
                />
                <MetricCard 
                  label="Owner Occupied Units" 
                  value={rentalStatsData.owner_occupied} 
                  format="number"
                  icon={Home}
                  color="#14b8a6"
                />
                <MetricCard 
                  label="Renter Percentage" 
                  value={rentalStatsData.pct_renter} 
                  format="percent"
                  icon={Users}
                  color="#14b8a6"
                />
              </div>
            </>
          )}
        </>
      )}

      {/* No Data Message */}
      {!csvLoading && !loading && !hasAnyData && activeSearch.zip && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <AlertCircle size={48} color="#9ca3af" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            No Data Found
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            No market data found for the specified location. Try a different ZIP code or county.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!csvLoading && !loading && !hasAnyData && !activeSearch.zip && !activeSearch.county && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd'
        }}>
          <Search size={48} color="#3b82f6" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
            Enter a Location to Get Started
          </h3>
          <p style={{ fontSize: '14px', color: '#3b82f6' }}>
            Search by ZIP code and/or county name to view market data including home values, rents, economic indicators, and more.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketDataDashboard;
