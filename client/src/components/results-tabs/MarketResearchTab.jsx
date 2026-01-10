import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  MapPin, 
  Home, 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Sparkles,
  Loader,
  AlertCircle,
  Building
} from 'lucide-react';

// ============================================================================
// Helper Functions
// ============================================================================

const fmt = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return Number(val).toLocaleString();
};

const fmtCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return '$' + Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const fmtPercent = (val, decimals = 1) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return Number(val).toFixed(decimals) + '%';
};

// Map state abbreviations to full names for city-level migration data
const STATE_ABBR_TO_FULL = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia'
};

const getFullStateName = (stateInput) => {
  if (!stateInput) return '';
  const trimmed = String(stateInput).trim();
  if (!trimmed) return '';

  const upper = trimmed.toUpperCase();
  if (STATE_ABBR_TO_FULL[upper]) return STATE_ABBR_TO_FULL[upper];

  // Assume already a full state name
  return trimmed;
};

// Resolve the correct city population CSV for a given state
const getCityPopCsvPath = (stateInput) => {
  const fullName = getFullStateName(stateInput);
  if (!fullName) return '';

  // Handle naming exceptions
  if (fullName === 'Illinois') {
    return '/all us cities pop/illinois-cities-by-population-2025.csv';
  }
  if (fullName === 'South Carolina') {
    return '/all us cities pop/south-carolina-cities-by-population-2025_with_fips.csv';
  }

  const fileName = fullName.replace(/\s+/g, '_') + '_Cities_with_State_Column__FIPS_and_GEOID.csv';
  return `/all us cities pop/${fileName}`;
};

// ============================================================================
// UI Components
// ============================================================================

const InfoRow = ({ label, value, highlight = false }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #e5e7eb'
  }}>
    <span style={{
      fontSize: '12px',
      color: '#6b7280',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }}>
      {label}
    </span>
    <span style={{
      fontSize: '13px',
      fontWeight: highlight ? 700 : 600,
      color: highlight ? '#16a34a' : '#111827'
    }}>
      {value}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }) => (
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
    marginBottom: '16px'
  }}>
    <div style={{
      padding: '14px 18px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      backgroundColor: '#f9fafb'
    }}>
      {Icon && <Icon size={18} color="#4b5563" />}
      <h3 style={{
        margin: 0,
        fontSize: '13px',
        fontWeight: 700,
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '0.08em'
      }}>
        {title}
      </h3>
    </div>
    <div style={{ padding: '16px 20px' }}>
      {children}
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

const MarketResearchTab = ({ 
  initialZip, 
  initialCity, 
  initialState, 
  initialCounty, 
  dealAddress,
  propertyName 
}) => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // ============================================================================
  // Load Market Data from CSVs
  // ============================================================================

  useEffect(() => {
    const loadMarketData = async () => {
      try {
        setLoading(true);
        setError('');

        const zip = initialZip || '';
        const city = initialCity || '';
        const state = initialState || '';
        const county = initialCounty || '';

        if (!zip && !city) {
          setError('No ZIP code or city provided');
          setLoading(false);
          return;
        }

        // Load all CSVs
        const Papa = await import('papaparse');
        
        const loadCSV = async (path) => {
          const response = await fetch(path);
          const text = await response.text();
          return Papa.parse(text, { header: true, dynamicTyping: false, skipEmptyLines: true }).data;
        };

        const [
          zipData,
          fmrData,
          dp03Data,
          dp04Data,
          b01003Data,
          landlordData,
          renterOwnerData,
          zhviData,
          zhvfData,
          densityData
        ] = await Promise.all([
          loadCSV('/zip_city_units_rent_percent_pop_2017_23.csv').catch(() => []),
          loadCSV('/fmr_by_zip_clean.csv').catch(() => []),
          loadCSV('/ZIPACSDP5Y2023.DP03-Data.csv').catch(() => []),
          loadCSV('/ZIPACSDP5Y2023.DP04-Data.csv').catch(() => []),
          loadCSV('/ZIPACSDT5Y2023.B01003-Data.csv').catch(() => []),
          // State-level landlord friendliness scores
          loadCSV('/landlord.csv').catch(() => []),
          loadCSV('/zip_renter_owner_stats_with_counts.csv').catch(() => []),
          loadCSV('/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv').catch(() => []),
          loadCSV('/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv').catch(() => []),
          loadCSV('/zcta_density.csv').catch(() => [])
        ]);

        // Helper to zero-pad ZIP
        const zeroZip = (z) => String(z || '').padStart(5, '0');
        
        // Helper to clean numeric values
        const cleanNum = (v) => {
          if (!v) return null;
          const num = Number(String(v).replace(/[, %$]/g, ''));
          return isNaN(num) ? null : num;
        };

        const paddedZip = zeroZip(zip);

        // Find ZIP data
        const zipRow = zipData.find(r => zeroZip(r.zip) === paddedZip) || {};
        const fmrRow = fmrData.find(r => zeroZip(r.zip) === paddedZip) || {};
        const dp03Row = dp03Data.find(r => {
          const name = r.NAME || '';
          return name.includes(paddedZip);
        }) || {};
        const dp04Row = dp04Data.find(r => {
          const name = r.NAME || '';
          return name.includes(paddedZip);
        }) || {};
        const b01003Row = b01003Data.find(r => {
          const name = r.NAME || '';
          return name.includes(paddedZip);
        }) || {};
        const renterOwnerRow = renterOwnerData.find(r => zeroZip(r.zip) === paddedZip) || {};
        const zhviRow = zhviData.find(r => zeroZip(r.RegionName) === paddedZip) || {};
        const zhvfRow = zhvfData.find(r => zeroZip(r.RegionName) === paddedZip) || {};
        const densityRow = densityData.find(r => zeroZip(r.ZCTA) === paddedZip) || {};
        
        // State-level data
        // Match landlord scores by full state name so both
        // abbreviations ("CA") and full names ("California") work
        const stateForLandlord = getFullStateName(state || zipRow.state || '');
        const landlordRow = landlordData.find(r => 
          (r.State || '').trim().toUpperCase() === stateForLandlord.trim().toUpperCase()
        ) || {};

        // Migration / population change data using per-state city CSVs
        let migrationInflow = null;
        let migrationOutflow = null;
        let migrationNet = null;

        try {
          const cityPopPath = getCityPopCsvPath(state || zipRow.state || '');
          if (cityPopPath) {
            const cityPopData = await loadCSV(cityPopPath).catch(() => []);

            if (cityPopData && cityPopData.length) {
              const targetCity = (city || zipRow.city || '').trim().toLowerCase();

              const cityMatch = cityPopData.find(r => {
                const c = (r.city || r.City || '').trim().toLowerCase();
                return c === targetCity;
              });

              if (cityMatch) {
                const pop2020 = cleanNum(cityMatch.pop2020 || cityMatch.Pop2020 || cityMatch.population2020);
                const pop2025 = cleanNum(cityMatch.pop2025 || cityMatch.Pop2025 || cityMatch.population || cityMatch.pop2024);

                if (pop2020 && pop2025) {
                  const netChange = pop2025 - pop2020;
                  // Approximate average annual net migration over 5 years
                  const annualNet = netChange / 5;

                  if (annualNet >= 0) {
                    migrationInflow = Math.round(annualNet);
                    migrationOutflow = 0;
                  } else {
                    migrationInflow = 0;
                    migrationOutflow = Math.round(Math.abs(annualNet));
                  }

                  migrationNet = Math.round(annualNet);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error loading city-level migration data:', e);
        }

        // Compile market data
        const compiled = {
          location: {
            zip: paddedZip,
            city: city || zipRow.city || '',
            state: state || zipRow.state || '',
            county: county || ''
          },
          homeValues: {
            zhvi: cleanNum(zhviRow['06-30-25'] || zhviRow['05-31-25'] || zhviRow['04-30-25']),
            forecast1m: cleanNum(zhvfRow['2025-07-31']),
            forecast3m: cleanNum(zhvfRow['2025-09-30']),
            forecast12m: cleanNum(zhvfRow['2026-06-30']),
            zhvi1yGrowth: cleanNum(zipRow.zhvi_1y_growth_pct),
            zhvi5yGrowth: cleanNum(zipRow.zhvi_5y_growth_pct)
          },
          rents: {
            fmr_0br: cleanNum(fmrRow.fmr_0br),
            fmr_1br: cleanNum(fmrRow.fmr_1br),
            fmr_2br: cleanNum(fmrRow.fmr_2br),
            fmr_3br: cleanNum(fmrRow.fmr_3br),
            fmr_4br: cleanNum(fmrRow.fmr_4br),
            medianGrossRent: cleanNum(dp04Row.DP04_0134E || zipRow.medianGrossRent)
          },
          economic: {
            medianIncome: cleanNum(dp03Row.DP03_0062E || zipRow.medianHouseholdIncome),
            employmentRate: cleanNum(dp03Row.DP03_0002PE || zipRow.employmentRate),
            povertyRate: cleanNum(dp03Row.DP03_0119PE),
            unemploymentRate: cleanNum(dp03Row.DP03_0009PE)
          },
          housing: {
            totalUnits: cleanNum(dp04Row.DP04_0001E || zipRow.total_units),
            vacantUnits: cleanNum(dp04Row.DP04_0003E),
            occupiedUnits: cleanNum(dp04Row.DP04_0002E),
            vacancyRate: cleanNum(dp04Row.DP04_0003PE || zipRow.vacancyRate),
            ownerOccupied: cleanNum(renterOwnerRow.pct_owner),
            renterOccupied: cleanNum(renterOwnerRow.pct_renter || zipRow.pct_renter),
            medianHomeValue: cleanNum(dp04Row.DP04_0089E)
          },
          population: {
            total: cleanNum(b01003Row.B01003_001E || zipRow.population_2023 || zipRow.population),
            population2017: cleanNum(zipRow.population_2017),
            population2023: cleanNum(zipRow.population_2023),
            changePercent: cleanNum(zipRow.population_change_pct_17_23),
            density: cleanNum(densityRow.density_sqmi || zipRow.density_sqmi)
          },
          landlord: {
            // Prefer new landlord.csv schema but gracefully fall back if older columns exist
            score: cleanNum(
              landlordRow['Overall Score'] ?? landlordRow.LandlordFriendlyScore
            ),
            evictionScore: cleanNum(
              landlordRow['Eviction Score'] ?? landlordRow.EvictionScore
            ),
            depositScore: cleanNum(
              landlordRow['Deposit Score'] ?? landlordRow.DepositAmountScore
            ),
            rentControlScore: cleanNum(
              landlordRow['Rent Control Score'] ?? landlordRow.RentControlScore
            ),
            terminationScore: cleanNum(
              landlordRow['Termination Score'] ?? landlordRow.TerminationNoticeScore
            )
          },
          migration: {
            inflow: migrationInflow,
            outflow: migrationOutflow,
            net: migrationNet
          },
          propertyTax: {
            rate: null,
            medianPaid: null
          }
        };

        setMarketData(compiled);
        setLoading(false);

      } catch (err) {
        console.error('Error loading market data:', err);
        setError('Failed to load market data: ' + err.message);
        setLoading(false);
      }
    };

    loadMarketData();
  }, [initialZip, initialCity, initialState, initialCounty]);

  // ============================================================================
  // Generate AI Summary
  // ============================================================================

  const handleGenerateAI = async () => {
    if (!marketData) return;
    
    setAiLoading(true);
    setAiError('');
    setAiSummary('');

    try {
      const fullAddress = dealAddress || 
        `${marketData.location.city}, ${marketData.location.state} ${marketData.location.zip}`;

      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';
      const response = await fetch(`${API_BASE}/api/market-data/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketData: {
            homeValue: marketData.homeValues.zhvi,
            forecast1m: marketData.homeValues.forecast1m,
            forecast3m: marketData.homeValues.forecast3m,
            forecast12m: marketData.homeValues.forecast12m,
            fmr_0br: marketData.rents.fmr_0br,
            fmr_1br: marketData.rents.fmr_1br,
            fmr_2br: marketData.rents.fmr_2br,
            fmr_3br: marketData.rents.fmr_3br,
            fmr_4br: marketData.rents.fmr_4br,
            medianIncome: marketData.economic.medianIncome,
            unemploymentRate: marketData.economic.unemploymentRate,
            povertyRate: marketData.economic.povertyRate,
            totalUnits: marketData.housing.totalUnits,
            censusHomeValue: marketData.housing.medianHomeValue,
            censusRent: marketData.rents.medianGrossRent,
            vacancyRate: marketData.housing.vacancyRate,
            ownerOccupied: marketData.housing.ownerOccupied,
            renterOccupied: marketData.housing.renterOccupied,
            population: marketData.population.total,
            evictionScore: marketData.landlord.evictionScore,
            depositScore: marketData.landlord.depositScore,
            rentControlScore: marketData.landlord.rentControlScore,
            terminationScore: marketData.landlord.terminationScore,
            propertyTaxRate: marketData.propertyTax.rate,
            medianTaxesPaid: marketData.propertyTax.medianPaid,
            migrationInflow: marketData.migration.inflow,
            migrationOutflow: marketData.migration.outflow,
            migrationNet: marketData.migration.net
          },
          location: {
            zip: marketData.location.zip,
            city: marketData.location.city,
            state: marketData.location.state,
            county: marketData.location.county
          },
          dealAddress: fullAddress,
          propertyName: propertyName || ''
        })
      });

      const data = await response.json();
      
      // Handle token errors (402 Payment Required)
      if (response.status === 402) {
        setAiError(`⚠️ Insufficient Tokens: ${data.error || 'You need tokens to generate AI analysis. Check your Dashboard Profile to see your balance and upgrade your plan.'}`);
        return;
      }
      
      if (data.success) {
        setAiSummary(data.summary);
      } else {
        setAiError(data.error || 'Failed to generate AI summary');
      }

    } catch (err) {
      console.error('AI generation error:', err);
      setAiError('Failed to contact AI service: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center' 
      }}>
        <Loader size={48} style={{ 
          animation: 'spin 1s linear infinite', 
          margin: '0 auto 16px',
          color: '#6366f1'
        }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center' 
      }}>
        <AlertCircle size={48} style={{ 
          margin: '0 auto 16px',
          color: '#ef4444'
        }} />
        <p style={{ color: '#ef4444', fontSize: '14px' }}>{error}</p>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center' 
      }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>No market data available</p>
      </div>
    );
  }

  const { location, homeValues, rents, economic, housing, population, landlord, migration } = marketData;

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '999px',
            backgroundColor: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MapPin size={18} color="#111827" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
              Market Research
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
              {location.city}, {location.state} {location.zip}
              {location.county && ` • ${location.county} County`}
            </p>
          </div>
        </div>

        {/* AI Analysis Button */}
        <button
          onClick={handleGenerateAI}
          disabled={aiLoading}
          style={{
            backgroundColor: aiLoading ? '#9ca3af' : '#111827',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: aiLoading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {aiLoading ? (
            <>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Analyzing Market...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate AI Analysis
            </>
          )}
        </button>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <SectionCard title="AI Investment Analysis" icon={Sparkles}>
          <div style={{ 
            fontSize: '14px', 
            lineHeight: '1.7',
            color: '#1e293b'
          }}>
            <ReactMarkdown
              components={{
                h2: ({children}) => <h2 style={{ fontSize: '18px', fontWeight: '700', marginTop: '20px', marginBottom: '12px', color: '#1e293b' }}>{children}</h2>,
                h3: ({children}) => <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '16px', marginBottom: '8px', color: '#475569' }}>{children}</h3>,
                ul: ({children}) => <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                p: ({children}) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                strong: ({children}) => <strong style={{ color: '#0f172a', fontWeight: '700' }}>{children}</strong>
              }}
            >
              {aiSummary}
            </ReactMarkdown>
          </div>
        </SectionCard>
      )}

      {aiError && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#991b1b'
        }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: '14px' }}>{aiError}</span>
        </div>
      )}

      {/* Market Data Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '16px'
      }}>
        {/* Home Values */}
        <SectionCard title="Home Values (Zillow)" icon={Home}>
          <InfoRow label="Current ZHVI" value={fmtCurrency(homeValues.zhvi)} highlight />
          <InfoRow label="1-Year Growth" value={fmtPercent(homeValues.zhvi1yGrowth)} />
          <InfoRow label="5-Year Growth" value={fmtPercent(homeValues.zhvi5yGrowth)} />
          <InfoRow label="12-Month Forecast" value={fmtPercent(homeValues.forecast12m)} />
          <InfoRow label="3-Month Forecast" value={fmtPercent(homeValues.forecast3m)} />
          <InfoRow label="1-Month Forecast" value={fmtPercent(homeValues.forecast1m)} />
        </SectionCard>

        {/* Fair Market Rents */}
        <SectionCard title="Fair Market Rents (HUD)" icon={DollarSign}>
          <InfoRow label="Studio (0BR)" value={fmtCurrency(rents.fmr_0br)} />
          <InfoRow label="1 Bedroom" value={fmtCurrency(rents.fmr_1br)} />
          <InfoRow label="2 Bedroom" value={fmtCurrency(rents.fmr_2br)} highlight />
          <InfoRow label="3 Bedroom" value={fmtCurrency(rents.fmr_3br)} />
          <InfoRow label="4 Bedroom" value={fmtCurrency(rents.fmr_4br)} />
          <InfoRow label="Median Gross Rent" value={fmtCurrency(rents.medianGrossRent)} />
        </SectionCard>

        {/* Economic Indicators */}
        <SectionCard title="Economic Indicators" icon={TrendingUp}>
          <InfoRow label="Median Income" value={fmtCurrency(economic.medianIncome)} highlight />
          <InfoRow label="Employment Rate" value={fmtPercent(economic.employmentRate)} />
          <InfoRow label="Unemployment Rate" value={fmtPercent(economic.unemploymentRate)} />
          <InfoRow label="Poverty Rate" value={fmtPercent(economic.povertyRate)} />
        </SectionCard>

        {/* Housing Market */}
        <SectionCard title="Housing Market" icon={Building2}>
          <InfoRow label="Total Housing Units" value={fmt(housing.totalUnits)} />
          <InfoRow label="Occupied Units" value={fmt(housing.occupiedUnits)} />
          <InfoRow label="Vacant Units" value={fmt(housing.vacantUnits)} />
          <InfoRow label="Vacancy Rate" value={fmtPercent(housing.vacancyRate)} highlight />
          <InfoRow label="Owner-Occupied %" value={fmtPercent(housing.ownerOccupied)} />
          <InfoRow label="Renter-Occupied %" value={fmtPercent(housing.renterOccupied)} />
        </SectionCard>

        {/* Population & Demographics */}
        <SectionCard title="Population & Demographics" icon={Users}>
          <InfoRow label="Total Population" value={fmt(population.total)} highlight />
          <InfoRow label="Population (2017)" value={fmt(population.population2017)} />
          <InfoRow label="Population (2023)" value={fmt(population.population2023)} />
          <InfoRow label="5-Year Change" value={fmtPercent(population.changePercent)} />
          <InfoRow label="Density (per sq mi)" value={fmt(population.density)} />
        </SectionCard>

        {/* Migration Trends */}
        <SectionCard title="Migration Trends" icon={TrendingUp}>
          <InfoRow label="Annual Inflow" value={fmt(migration.inflow)} />
          <InfoRow label="Annual Outflow" value={fmt(migration.outflow)} />
          <InfoRow label="Net Migration" value={fmt(migration.net)} highlight={migration.net > 0} />
          {population.total && migration.net && (
            <InfoRow 
              label="Net per 1,000 Residents" 
              value={((migration.net / population.total) * 1000).toFixed(1)} 
            />
          )}
        </SectionCard>

        {/* Landlord Environment */}
        <SectionCard title="Landlord Environment" icon={Building}>
          <InfoRow label="Overall Score" value={landlord.score ? `${landlord.score.toFixed(1)}/10` : 'N/A'} highlight />
          <InfoRow label="Eviction Score" value={landlord.evictionScore ? `${landlord.evictionScore.toFixed(1)}/10` : 'N/A'} />
          <InfoRow label="Deposit Score" value={landlord.depositScore ? `${landlord.depositScore.toFixed(1)}/10` : 'N/A'} />
          <InfoRow label="Rent Control Score" value={landlord.rentControlScore ? `${landlord.rentControlScore.toFixed(1)}/10` : 'N/A'} />
          <InfoRow label="Termination Score" value={landlord.terminationScore ? `${landlord.terminationScore.toFixed(1)}/10` : 'N/A'} />
        </SectionCard>
      </div>
    </div>
  );
};

export default MarketResearchTab;
