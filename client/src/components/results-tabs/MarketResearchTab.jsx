import React, { useEffect, useState } from 'react';
import { Percent, Layers, TrendingUp, Map as MapIcon, Globe } from 'lucide-react';

// Shared table/banner primitives — mirrors the CapEx Budget table style used
// elsewhere in the results page (underwritex.jsx's Card/GradBanner/Pill) so
// all Market Analysis data reads as banner + table, not pastel stat cards.
const GRAD = 'bg-gradient-to-r from-emerald-400 to-cyan-500';
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
);
const GradBanner = ({ children, className = '' }) => (
  <div className={`${GRAD} text-white rounded-xl px-5 py-3 flex items-center justify-between ${className}`}>{children}</div>
);
const Pill = ({ children, tone = 'gray' }) => {
  const t = {
    gray: 'bg-gray-100 text-gray-600', green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600', purple: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700', orange: 'bg-orange-100 text-orange-700',
    outline: 'border border-gray-300 text-gray-600',
  }[tone];
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${t}`}>{children}</span>;
};
// A row of table data: a plain row (subtotal=false) or a tinted, bold
// "subtotal" row used as a section divider inside a table (matches the
// "Exterior Subtotal" / "Grand Total" rows in the CapEx table).
const Row = ({ label, value, detail, tone }) => (
  <tr className="border-t border-gray-50">
    <td className="py-2.5 px-4 text-gray-600">{label}</td>
    <td className={`text-right px-4 font-semibold ${tone || 'text-gray-900'}`}>{value}</td>
    <td className="text-right px-4 text-gray-400 text-xs">{detail}</td>
  </tr>
);
const SubtotalRow = ({ label, value, tone = 'emerald' }) => {
  const bg = { emerald: 'bg-emerald-50/60 border-emerald-100', sky: 'bg-sky-50/60 border-sky-100', orange: 'bg-orange-50/60 border-orange-100', cyan: 'bg-cyan-50/60 border-cyan-100' }[tone];
  const text = { emerald: 'text-emerald-700', sky: 'text-sky-800', orange: 'text-orange-600', cyan: 'text-cyan-700' }[tone];
  return (
    <tr className={`${bg} border-t`}>
      <td className="py-2.5 px-4">＋</td>
      <td colSpan={2} className={`font-bold px-0 ${text}`}>{label}{value !== undefined && <span className="float-right pr-4">{value}</span>}</td>
    </tr>
  );
};

// Error boundary to prevent blank screens and surface errors to the UI
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error, info) {
    console.error('🔥 ErrorBoundary caught error:', error, info);
    this.setState({ hasError: true, error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white rounded-xl shadow border text-sm text-red-700">
          <div className="font-bold mb-2">Something went wrong rendering Market Research</div>
          <div className="mb-2">Error: {String(this.state.error?.message || this.state.error)}</div>
          <details className="text-xs text-gray-600 whitespace-pre-wrap mb-3">
            {this.state.info?.componentStack}
          </details>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-emerald-600 text-white rounded" onClick={() => window.location.reload()}>Reload page</button>
            <button className="px-3 py-1 bg-gray-100 text-gray-800 rounded" onClick={() => console.log('ErrorBoundary info:', this.state)}>Log details</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Formatting helpers
const fmt = (val) => val?.toLocaleString() || 'N/A';
const fmtCurrency = (val) => val ? `$${val.toLocaleString()}` : 'N/A';
const fmtPercent = (val) => val !== null && val !== undefined ? `${val.toFixed(1)}%` : 'N/A';
const fmtPercentFromFraction = (val) => val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : 'N/A';
const rirLabel = (rir) => {
  if (rir === undefined || rir === null) return { label: 'N/A', score: 'N/A' };
  if (rir < 0.15) return { label: 'Most Affordable', score: '2/10' };
  if (rir < 0.18) return { label: 'Very Affordable', score: '3/10' };
  if (rir < 0.2) return { label: 'Average', score: '4/10' };
  if (rir < 0.23) return { label: 'Less Affordable', score: '6/10' };
  return { label: 'Poor', score: '8/10' };
};

// Lightweight loading UI so the tab never flashes a "no data" message while fetches run
const LoadingState = ({ propertyLocation }) => {
  const locationLabel = [propertyLocation?.city, propertyLocation?.state].filter(Boolean).join(', ');
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Loading market data</div>
          <div className="text-xs text-gray-600">{locationLabel || 'Fetching property context...'}</div>
        </div>
        <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-emerald-400 via-cyan-500 to-emerald-400 animate-pulse" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-5/6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/5" />
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

function MarketResearchTab({ marketData, propertyLocation = {}, loading = false, onRefetchMarketData }) {

  const hasMarketData = !!marketData;
  const isLoading = !!loading;
  const marketDataSafe = marketData || {};

  const {
    property_location,
    county_data = {},
    zip_data = {},
    msa_data = {},
    aggregations = {},
    city = {},
    county = {},
    state = {},
    area_classification,
    fmr = {},
    market_cap_rate = {},
    zip_renter_owner = {},
    msa_units = {},
    macro_environment = {}
  } = marketDataSafe;

  // Treasury rates for yield curve display
  const [treasuryRates, setTreasuryRates] = useState([]);
  const [treasuryAsOf, setTreasuryAsOf] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const apiBase = process.env.REACT_APP_API_URL || 'https://dealsniper-oh9v.onrender.com';
        const resp = await fetch(`${apiBase}/api/treasury-rates`);
        if (resp.ok) {
          const data = await resp.json();
          setTreasuryRates(data.rates || []);
          setTreasuryAsOf(data.as_of || null);
        }
      } catch (err) {
        console.warn('Failed to fetch treasury rates:', err);
      }
    })();
  }, []);

  // Safe defaults for aggregations
  const zipCode = property_location?.zip || propertyLocation?.zip;
  const safeAggregations = {
    population: aggregations.population || county_data.population || 0,
    median_income: aggregations.median_income || county_data.median_income || 0,
    median_rent: aggregations.median_rent || 0,
    affordability: aggregations.affordability || 'N/A'
  };

  // Derived metrics
  const localPopGrowthPct = zip_data?.net_migration_per_capita !== undefined ? (zip_data.net_migration_per_capita * 100) : undefined;
  const households = (zip_renter_owner?.owner_count || 0) + (zip_renter_owner?.renter_count || 0);

  if (!hasMarketData) {
    if (isLoading) {
      return <LoadingState propertyLocation={propertyLocation} />;
    }
    return (
      <div className="p-6 text-center text-gray-500">
        No market data available. Please ensure property address is complete.
      </div>
    );
  }

  // Delta helpers (reserved for future comparison UI)
  // const formatDeltaLine = (label, localVal, compVal, currency=false) => { ... };

  // Affordability helpers (reserved for future UI)
  // const getAffordabilityColor = (ratio) => {
  //   if (ratio < 25) return 'text-green-600';
  //   if (ratio < 30) return 'text-yellow-600';
  //   if (ratio < 35) return 'text-orange-600';
  //   return 'text-red-600';
  // };
  // const rentToIncomeRatio = county_data?.rent_to_income_ratio || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Market Analysis</h2>
        <p className="text-sm text-gray-600">
          {(property_location?.address || propertyLocation?.address) ? (
            <>
              {property_location?.address || propertyLocation?.address}, {property_location?.city || propertyLocation?.city}, {property_location?.state || propertyLocation?.state} {property_location?.zip || propertyLocation?.zip}
            </>
          ) : (
            <>
              {city.name || 'Property'}, {state.name || 'N/A'}
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {area_classification && (
            <span className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded inline-flex items-center gap-1">
              <Layers size={14} /> {area_classification}
            </span>
          )}
          {market_cap_rate?.value_percent !== undefined && (
            <span className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded inline-flex items-center gap-1">
              <Percent size={14} /> {fmtPercent(market_cap_rate.value_percent)}{market_cap_rate?.source ? ` (${market_cap_rate.source})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Market Snapshot: Rent-to-Income comparison across Local / County / State */}
      <GradBanner><span className="font-bold text-lg">Rent-to-Income Ratio: {fmtPercentFromFraction(marketData?.rent_to_income_ratio)}</span><span className="text-sm font-normal text-white/85">{safeAggregations.affordability}</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Market</th><th className="text-right px-4">Rent-to-Income</th><th className="text-right px-4">Median Rent</th><th className="text-right px-4">Median Income</th><th className="px-4">Rating</th></tr></thead>
          <tbody>
            {[{
              title: 'Local Market',
              subtitle: county?.name ? `Near ${county.name}` : 'Local Submarket',
              rir: marketData?.rent_to_income_ratio,
              rent: safeAggregations.median_rent,
              income: safeAggregations.median_income,
              tone: 'emerald',
            }, {
              title: 'County',
              subtitle: county?.name || 'County',
              rir: county_data?.rent_to_income_ratio,
              rent: county_data?.median_rent ?? safeAggregations.median_rent,
              income: county_data?.median_income ?? safeAggregations.median_income,
              tone: null,
            }, {
              title: 'State',
              subtitle: state?.name || 'State',
              rir: state?.rent_to_income_ratio,
              rent: state?.median_rent,
              income: state?.median_income,
              tone: null,
            }].map((row) => {
              const meta = rirLabel(row.rir);
              return row.tone ? (
                <tr key={row.title} className="bg-emerald-50/60 border-t border-emerald-100">
                  <td className="py-2.5 px-4"><Pill tone="green">{row.title}</Pill> <span className="text-xs text-gray-500">{row.subtitle}</span></td>
                  <td className="text-right px-4 font-bold text-emerald-700">{fmtPercentFromFraction(row.rir ?? 0)}</td>
                  <td className="text-right px-4">{fmtCurrency(row.rent)}</td>
                  <td className="text-right px-4">{fmtCurrency(row.income)}</td>
                  <td className="px-4"><Pill tone={meta.label === 'Poor' ? 'red' : 'green'}>{meta.label}</Pill></td>
                </tr>
              ) : (
                <tr key={row.title} className="border-t border-gray-50">
                  <td className="py-2.5 px-4 text-gray-700">{row.title} <span className="text-xs text-gray-400">{row.subtitle}</span></td>
                  <td className="text-right px-4 font-semibold text-gray-900">{fmtPercentFromFraction(row.rir ?? 0)}</td>
                  <td className="text-right px-4">{fmtCurrency(row.rent)}</td>
                  <td className="text-right px-4">{fmtCurrency(row.income)}</td>
                  <td className="px-4 text-gray-500">{meta.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ============================================================ */}
      {/* =================== BOTTOM HALF REDESIGN =================== */}
      {/* ============================================================ */}

      {/* Macro Environment (FRED Data) */}
      {macro_environment && Object.keys(macro_environment).length > 1 && (
        <>
          <GradBanner>
            <span className="font-bold text-lg flex items-center gap-2"><Globe size={18} /> Macro Environment</span>
            <span className="text-xs font-normal text-white/85">{macro_environment.as_of && `as of ${new Date(macro_environment.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</span>
          </GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Indicator</th><th className="text-right px-4">Value</th><th className="text-right px-4">As Of</th></tr></thead>
              <tbody>
                {[
                  { key: 'mortgage_30yr', tone: 'text-cyan-700' },
                  { key: 'treasury_10yr', tone: 'text-emerald-600' },
                  { key: 'fed_funds_rate', tone: 'text-amber-700' },
                  { key: 'unemployment_rate', tone: 'text-orange-600' },
                  { key: 'gdp_growth', tone: 'text-green-600' },
                  { key: 'cpi_rent_yoy', tone: 'text-red-600' },
                  { key: 'housing_starts', tone: 'text-cyan-600' },
                  { key: 'consumer_sentiment', tone: 'text-emerald-700' },
                ].filter(item => macro_environment[item.key]).map(({ key, tone }) => {
                  const d = macro_environment[key];
                  const isPercent = d.unit === '%';
                  const displayVal = isPercent ? `${d.value}%` : d.unit === 'K' ? `${Math.round(d.value).toLocaleString()}K` : d.value?.toLocaleString();
                  return (
                    <tr key={key} className="border-t border-gray-50">
                      <td className="py-2.5 px-4 text-gray-600">{d.label}</td>
                      <td className={`text-right px-4 font-bold ${tone}`}>{displayVal}</td>
                      <td className="text-right px-4 text-gray-400 text-xs">{d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Treasury Yield Curve */}
      {treasuryRates.length > 0 && (
        <>
          <GradBanner>
            <span className="font-bold text-lg flex items-center gap-2"><TrendingUp size={18} /> Treasury Yield Curve</span>
            <span className="text-xs font-normal text-white/85">{treasuryAsOf && `as of ${new Date(treasuryAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</span>
          </GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Term</th><th className="text-right px-4">Yield</th><th className="text-right px-4">As Of</th></tr></thead>
              <tbody>
                {treasuryRates.map(tr => (
                  <tr key={tr.term} className="border-t border-gray-50">
                    <td className="py-2.5 px-4 text-gray-600">{tr.term}-Year</td>
                    <td className="text-right px-4 font-bold text-emerald-700">{tr.rate.toFixed(2)}%</td>
                    <td className="text-right px-4 text-gray-400 text-xs">{tr.date ? new Date(tr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 border-t border-emerald-100">
                  <td colSpan={3} className="py-2.5 px-4 text-xs text-emerald-700">
                    <span className="font-semibold">💡 Typical CRE Spreads:</span> Agency (Fannie/Freddie): +1.25–1.75% | Bank/CMBS: +1.75–2.50% | Bridge: +3.00–5.00%
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Rent Growth Opportunity + Affordability Summary */}
      <GradBanner><span className="font-bold text-lg">Rent Growth &amp; Affordability</span><span className="text-sm font-normal text-white/85">{safeAggregations.affordability}</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Detail</th></tr></thead>
          <tbody>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">Median Market Rent</td>
              <td className="text-right px-4 font-semibold text-gray-900">{fmtCurrency(safeAggregations.median_rent)}</td>
              <td className="px-4 text-gray-400 text-xs">per unit</td>
            </tr>
            <tr className="bg-emerald-50/60 border-t border-emerald-100">
              <td className="py-2.5 px-4"><Pill tone="green">FMR (2BR)</Pill></td>
              <td className="text-right px-4 font-bold text-emerald-700">{fmtCurrency(fmr?.fmr_2br || 0)}</td>
              <td className="px-4 text-gray-500 text-xs">HUD Fair Market Rent</td>
            </tr>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">Median Home Value</td>
              <td className="text-right px-4 font-semibold text-gray-900">{fmtCurrency(aggregations?.median_home_value || county_data?.median_home_value)}</td>
              <td className="px-4 text-gray-400 text-xs">county level</td>
            </tr>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">Rent-to-Price Ratio</td>
              <td className="text-right px-4 font-semibold text-gray-900">{aggregations?.rent_to_price_ratio ? `${aggregations.rent_to_price_ratio.toFixed(2)}%` : 'N/A'}</td>
              <td className="px-4 text-gray-400 text-xs">{aggregations?.rent_to_price_ratio > 0.8 ? 'Favorable for investors' : aggregations?.rent_to_price_ratio > 0.5 ? 'Moderate' : 'Below average'}</td>
            </tr>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">Rent-to-Income Ratio</td>
              <td className="text-right px-4 font-semibold text-gray-900">{fmtPercentFromFraction(marketData?.rent_to_income_ratio)}</td>
              <td className="px-4 text-gray-400 text-xs">local area</td>
            </tr>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">County Rent-to-Income Ratio</td>
              <td className="text-right px-4 font-semibold text-gray-900">{fmtPercentFromFraction(county_data?.rent_to_income_ratio)}</td>
              <td className="px-4 text-gray-400 text-xs">county comparison</td>
            </tr>
            <tr className="bg-emerald-50 border-t border-emerald-100 font-bold">
              <td className="py-3 px-4">Affordability Rating</td>
              <td className="text-right px-4 text-emerald-700">{safeAggregations.affordability}</td>
              <td className="px-4" />
            </tr>
          </tbody>
        </table>
      </Card>
      <Card className="p-4 text-xs text-gray-700 leading-relaxed">
        {(() => {
          const rir = marketData?.rent_to_income_ratio;
          const rirPct = rir ? (rir * 100).toFixed(1) : null;
          const countyRir = county_data?.rent_to_income_ratio ? (county_data.rent_to_income_ratio * 100).toFixed(1) : null;
          const medIncome = safeAggregations.median_income;
          const medRent = safeAggregations.median_rent;
          const countyName = county?.name || county_data?.county_name || 'the county';

          if (!rirPct) return 'Affordability data not yet available for this location.';

          return (
            <>
              The multifamily affordability ratio for the local market stands at <strong>{rirPct}%</strong>
              {countyRir && <>, compared to {countyName}'s {countyRir}%</>}.
              {' '}The median household income of <strong>{fmtCurrency(medIncome)}</strong> supports
              a median rent of <strong>{fmtCurrency(medRent)}/mo</strong>.
              {' '}{parseFloat(rirPct) < 25
                ? 'This indicates a fundamentally affordable market with room for rent growth without displacing tenants.'
                : parseFloat(rirPct) < 30
                ? 'This suggests moderate affordability — rents are sustainable but growth potential may be limited.'
                : 'High rent burden indicates limited room for rent increases without impacting occupancy.'
              }
            </>
          );
        })()}
      </Card>

      {/* ===== MARKET METRICS GRID (8 data cards matching reference UI) ===== */}
      <GradBanner>
        <span className="font-bold text-lg flex items-center gap-2"><MapIcon size={18} /> Market Overview</span>
        <span className="text-xs font-normal text-white/85">{county?.name || county_data?.county_name || ''}, {state?.name || property_location?.state || ''} · Census 2023</span>
      </GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Rating</th><th className="px-4">Detail</th></tr></thead>
          <tbody>
            <Row label="Population" value={fmt(safeAggregations.population)}
              tone={safeAggregations.population > 200000 ? 'text-emerald-600' : safeAggregations.population > 50000 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.total_housing_units > 0 ? `${fmt(aggregations.total_housing_units)} housing units in county` : 'local market'} />
            <Row label="Growth" value={localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}
              tone={localPopGrowthPct === undefined ? 'text-gray-900' : localPopGrowthPct > 1 ? 'text-emerald-600' : localPopGrowthPct > 0 ? 'text-gray-900' : 'text-red-600'}
              detail={(() => {
                const sg = aggregations?.comparisons?.pop_growth_state;
                const sn = state?.name || property_location?.state || 'state';
                return sg !== undefined && sg !== null ? `vs ${sn} avg ${fmtPercent(sg)}` : 'net migration-based';
              })()} />
            <Row label="Households" value={aggregations?.total_housing_units > 0 ? fmt(aggregations.total_housing_units) : (households > 0 ? fmt(Math.round(households)) : 'N/A')}
              tone={(aggregations?.total_housing_units || households) > 100000 ? 'text-emerald-600' : (aggregations?.total_housing_units || households) > 30000 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.total_housing_units > 0 && safeAggregations.population > 0 ? `${Math.round(aggregations.total_housing_units / safeAggregations.population * 1000)} per 1,000 people` : 'county total'} />
            <Row label="Single Family" value={aggregations?.single_family_total > 0 ? fmt(aggregations.single_family_total) : 'N/A'}
              tone={(aggregations?.single_family_total || 0) > 50000 ? 'text-emerald-600' : (aggregations?.single_family_total || 0) > 10000 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.single_family_total > 0 && safeAggregations.population > 0 ? `${(aggregations.single_family_total / safeAggregations.population * 1000).toFixed(1)} per 1,000 people` : 'detached + attached'} />
            <Row label="Income" value={fmtCurrency(safeAggregations.median_income)}
              tone={safeAggregations.median_income > 75000 ? 'text-emerald-600' : safeAggregations.median_income > 50000 ? 'text-gray-900' : 'text-red-600'}
              detail={(() => {
                const si = aggregations?.comparisons?.income_state;
                const sn = state?.name || property_location?.state || 'state';
                return si ? `${((safeAggregations.median_income - si) / si * 100).toFixed(1)}% vs ${sn}` : 'median household';
              })()} />
            <Row label="Businesses" value={aggregations?.businesses ? fmt(aggregations.businesses) : 'N/A'}
              tone={(aggregations?.businesses || 0) > 5000 ? 'text-emerald-600' : (aggregations?.businesses || 0) > 1000 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.businesses && safeAggregations.population > 0 ? `${Math.round(aggregations.businesses / safeAggregations.population * 1000)} per 1,000 people` : 'LLM estimate'} />
            <Row label="Walk Score" value={aggregations?.walk_score ?? 'N/A'}
              tone={(aggregations?.walk_score || 0) >= 70 ? 'text-emerald-600' : (aggregations?.walk_score || 0) >= 50 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.walk_score != null ? (aggregations.walk_score >= 70 ? 'Very Walkable' : aggregations.walk_score >= 50 ? 'Somewhat Walkable' : 'Car-Dependent') : 'N/A'} />
            <tr className="bg-emerald-50 border-t border-emerald-100 font-bold">
              <td className="py-3 px-4">Affordability</td>
              <td className="text-right px-4 text-emerald-700">{safeAggregations.affordability}</td>
              <td className="px-4 text-emerald-700 text-xs">Rent {fmtCurrency(safeAggregations.median_rent)}/mo</td>
              <td className="px-4 text-gray-500 text-xs font-normal">{marketData?.rent_to_income_ratio != null ? `RIR ${fmtPercentFromFraction(marketData.rent_to_income_ratio)}` : ''}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* ===== EMPLOYMENT & ECONOMY SECTION ===== */}
      <GradBanner><span className="font-bold text-lg">Employment &amp; Economy</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Rating</th><th className="px-4">Detail</th></tr></thead>
          <tbody>
            <Row label="Unemployment" value={fmtPercent(county_data.unemployment_rate)}
              tone={county_data.unemployment_rate < 4 ? 'text-green-600' : county_data.unemployment_rate < 6 ? 'text-yellow-600' : 'text-red-600'}
              detail={county_data.unemployment_rate < 4 ? 'Strong' : county_data.unemployment_rate < 6 ? 'Moderate' : 'Weak'} />
            <Row label="Labor Force" value={aggregations?.labor_force_participation ? fmtPercent(aggregations.labor_force_participation) : 'N/A'}
              tone={(aggregations?.labor_force_participation || 0) > 65 ? 'text-green-600' : (aggregations?.labor_force_participation || 0) > 55 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.labor_force_participation > 65 ? 'High Participation' : aggregations?.labor_force_participation > 55 ? 'Average' : aggregations?.labor_force_participation ? 'Low Participation' : 'N/A'} />
            <Row label="Poverty Rate" value={aggregations?.poverty_rate ? fmtPercent(aggregations.poverty_rate) : 'N/A'}
              tone={(aggregations?.poverty_rate || 0) < 10 ? 'text-green-600' : (aggregations?.poverty_rate || 0) < 15 ? 'text-yellow-600' : 'text-red-600'}
              detail={aggregations?.poverty_rate ? (aggregations.poverty_rate < 10 ? 'Low' : aggregations.poverty_rate < 15 ? 'Average' : 'High') : 'N/A'} />
            <Row label="Total Employed" value={aggregations?.total_civilian_employed ? fmt(aggregations.total_civilian_employed) : 'N/A'}
              tone={(aggregations?.total_civilian_employed || 0) > 100000 ? 'text-green-600' : (aggregations?.total_civilian_employed || 0) > 30000 ? 'text-gray-900' : 'text-red-600'}
              detail={aggregations?.total_civilian_employed > 100000 ? 'Large' : aggregations?.total_civilian_employed > 30000 ? 'Medium' : aggregations?.total_civilian_employed ? 'Small' : 'N/A'} />
          </tbody>
        </table>
      </Card>

      {/* ===== HOUSING MARKET DEEP DIVE ===== */}
      <GradBanner><span className="font-bold text-lg">Housing Market</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Detail</th></tr></thead>
          <tbody>
            <Row label="Median Home Value" value={fmtCurrency(aggregations?.median_home_value || county_data?.median_home_value)}
              tone={(aggregations?.median_home_value || county_data?.median_home_value || 0) > 400000 ? 'text-red-600' : (aggregations?.median_home_value || county_data?.median_home_value || 0) > 200000 ? 'text-gray-900' : 'text-green-600'}
              detail={(aggregations?.median_home_value || county_data?.median_home_value || 0) > 400000 ? 'Expensive' : (aggregations?.median_home_value || county_data?.median_home_value || 0) > 200000 ? 'Average' : 'Affordable'} />
            <Row label="Median Rent" value={fmtCurrency(safeAggregations.median_rent)} detail="monthly gross rent" />
            <Row label="Vacancy Rate" value={aggregations?.vacancy_rate ? fmtPercent(aggregations.vacancy_rate) : 'N/A'}
              tone={(aggregations?.vacancy_rate || 0) < 5 ? 'text-green-600' : (aggregations?.vacancy_rate || 0) < 8 ? 'text-yellow-600' : 'text-red-600'}
              detail={aggregations?.vacancy_rate ? (aggregations.vacancy_rate < 5 ? 'Tight Market' : aggregations.vacancy_rate < 8 ? 'Balanced' : 'High Vacancy') : 'N/A'} />
            <Row label="Owner Costs" value={fmtCurrency(aggregations?.median_owner_costs)} detail="monthly, with mortgage" />
            <SubtotalRow label="Composition" tone="cyan" />
            <Row label="Homeownership Rate" value={aggregations?.homeownership_rate ? fmtPercent(aggregations.homeownership_rate) : 'N/A'} detail="" />
            <Row label="Renter Percentage" value={aggregations?.renter_percentage ? fmtPercent(aggregations.renter_percentage) : 'N/A'} detail="" />
            <Row label="Multifamily Share" value={aggregations?.multifamily_share ? fmtPercent(aggregations.multifamily_share) : 'N/A'} detail="" />
            <Row label="Multifamily Units (5+)" value={aggregations?.multifamily_stock ? fmt(aggregations.multifamily_stock) : 'N/A'} detail="" />
            <Row label="Median Year Built" value={aggregations?.median_year_built || 'N/A'} detail="" />
            <SubtotalRow label={<>HUD Fair Market Rents{fmr?.source === 'hud_api' && <Pill tone="green"> Live API{fmr?.year ? ` · FY${fmr.year}` : ''}</Pill>}</>} tone="emerald" />
            {[0, 1, 2, 3, 4].map(br => {
              const fmrVal = fmr?.[`fmr_${br}br`] || (br === 2 ? fmr?.fmr_2br : null);
              return <Row key={br} label={`FMR ${br}BR`} value={fmrVal ? fmtCurrency(fmrVal) : 'N/A'} tone="text-emerald-700" detail="" />;
            })}
          </tbody>
        </table>
      </Card>

      {/* ===== MIGRATION TRENDS ===== */}
      {zip_data && zip_data.net_migration !== undefined && (
        <>
          <GradBanner><span className="font-bold text-lg">Migration Trends</span></GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Detail</th></tr></thead>
              <tbody>
                <Row label="Net Migration" value={`${zip_data.net_migration >= 0 ? '+' : ''}${fmt(Math.round(zip_data.net_migration))}`}
                  tone={zip_data.net_migration >= 0 ? 'text-green-600' : 'text-red-600'}
                  detail={zip_data.net_migration >= 0 ? 'Net Inflow' : 'Net Outflow'} />
                <Row label="Per Capita" value={zip_data.net_migration_per_capita?.toFixed(3) || '0.000'} detail="net migration per capita" />
                <Row label="In-Migration" value={fmt(Math.round(zip_data.in_migration || 0))} tone="text-emerald-600" detail="people moving in" />
                <Row label="Out-Migration" value={fmt(Math.round(zip_data.out_migration || 0))} tone="text-orange-600" detail="people moving out" />
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ===== RENTER / OWNER PROFILE ===== */}
      {(zip_renter_owner && (zip_renter_owner.renter_share !== undefined || zip_renter_owner.owner_share !== undefined)) && (
        <>
          <GradBanner><span className="font-bold text-lg">Local Housing Profile — ZIP {zipCode || ''}</span></GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Detail</th></tr></thead>
              <tbody>
                <Row label="Renter Share" value={fmtPercentFromFraction(zip_renter_owner?.renter_share ?? 0)} detail={`${fmt(Math.round(zip_renter_owner?.renter_count ?? 0))} renters`} />
                <Row label="Owner Share" value={fmtPercentFromFraction(zip_renter_owner?.owner_share ?? 0)} detail={`${fmt(Math.round(zip_renter_owner?.owner_count ?? 0))} owners`} />
                <Row label="Market Type" value={(zip_renter_owner?.renter_share || 0) > 0.5 ? 'Renter' : 'Owner'} tone="text-emerald-600" detail={(zip_renter_owner?.renter_share || 0) > 0.5 ? 'Favorable for MF' : 'Owner-dominated'} />
                <Row label="Total Households" value={fmt(Math.round((zip_renter_owner?.renter_count || 0) + (zip_renter_owner?.owner_count || 0)))} detail="ZIP-level data" />
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ===== MULTIFAMILY CONSTRUCTION ACTIVITY ===== */}
      {(msa_data && msa_data.msa_name) || (msa_units && (msa_units.ytd_5plus_units || msa_units.ytd_total_units)) ? (
        <>
          <GradBanner>
            <span className="font-bold text-lg">Multifamily Construction Activity</span>
            {msa_data?.msa_name && <span className="text-xs font-normal text-white/85">{msa_data.msa_name}</span>}
          </GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th></tr></thead>
              <tbody>
                <Row label="YTD Total Permits" value={fmt(msa_data?.ytd_total_units || msa_units?.ytd_total_units || 0)} detail="" />
                <Row label="YTD 5+ Unit Buildings" value={fmt(msa_data?.ytd_5plus_units || msa_units?.ytd_5plus_units || 0)} tone="text-emerald-600" detail="" />
                <Row label="Current Month Permits" value={msa_data?.current_month_units || msa_units?.current_month_units ? fmt(msa_data?.current_month_units || msa_units?.current_month_units) : 'N/A'} tone="text-green-600" detail="" />
                {(msa_units?.absorption_units !== undefined || msa_units?.absorption_rate !== undefined) && (
                  <>
                    <Row label="Absorption Units (proxy)" value={fmt(Math.round(msa_units.absorption_units || 0))} detail="" />
                    <Row label="Absorption Rate" value={msa_units.absorption_rate !== undefined ? fmtPercent(msa_units.absorption_rate * 100) : 'N/A'} detail="" />
                  </>
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}

      {/* Market Comparison */}
      <GradBanner><span className="font-bold text-lg">Market Comparison</span><span className="text-xs font-normal text-white/85">Local Area vs. State &amp; National Averages</span></GradBanner>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Local Area</th><th className="text-right px-4">{city?.name || 'City'}</th><th className="text-right px-4">State</th><th className="text-right px-4">USA</th></tr></thead>
          <tbody>
            <tr className="border-t border-gray-50">
              <td className="py-2.5 px-4 text-gray-600">Median Household Income</td>
              <td className="text-right px-4 font-bold text-emerald-700">{fmtCurrency(safeAggregations.median_income)}</td>
              <td className="text-right px-4">{fmtCurrency(aggregations?.comparisons?.income_city || 0)}</td>
              <td className="text-right px-4">{fmtCurrency(aggregations?.comparisons?.income_state || 0)}</td>
              <td className="text-right px-4">{fmtCurrency(aggregations?.comparisons?.income_usa || 0)}</td>
            </tr>
            <tr className="bg-emerald-50/60 border-t border-emerald-100">
              <td className="py-2.5 px-4 text-gray-600">Population Growth</td>
              <td className="text-right px-4 font-bold text-emerald-700">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</td>
              <td className="text-right px-4">{aggregations?.comparisons?.pop_growth_city !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_city) : 'N/A'}</td>
              <td className="text-right px-4">{aggregations?.comparisons?.pop_growth_state !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_state) : 'N/A'}</td>
              <td className="text-right px-4">{aggregations?.comparisons?.pop_growth_usa !== undefined ? fmtPercent(aggregations.comparisons.pop_growth_usa) : 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <Card className="p-4 text-xs text-gray-700 leading-relaxed space-y-2">
        <div>
          The local market has a median household income of <span className="font-bold">{fmtCurrency(safeAggregations.median_income)}</span>.
          {(() => {
            const cityDiff = aggregations?.comparisons?.income_city ? ((safeAggregations.median_income - aggregations.comparisons.income_city) / aggregations.comparisons.income_city * 100) : null;
            const stateDiff = aggregations?.comparisons?.income_state ? ((safeAggregations.median_income - aggregations.comparisons.income_state) / aggregations.comparisons.income_state * 100) : null;
            const usaDiff = aggregations?.comparisons?.income_usa ? ((safeAggregations.median_income - aggregations.comparisons.income_usa) / aggregations.comparisons.income_usa * 100) : null;
            return (
              <>
                {cityDiff !== null && (
                  <> This is <span className={cityDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(cityDiff).toFixed(1)}% {cityDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">{city?.name || 'City'}</span> average.</>
                )}
                {stateDiff !== null && (
                  <> This is <span className={stateDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(stateDiff).toFixed(1)}% {stateDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">State</span> average and <span className={usaDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(usaDiff || 0).toFixed(1)}% {(usaDiff || 0) >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">USA</span> average.</>
                )}
              </>
            );
          })()}
        </div>
        <div>
          The local market has an annual population growth rate of <span className="font-bold">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</span>.
          {(() => {
            const cityDiff = aggregations?.comparisons?.pop_growth_city !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_city) : null;
            const stateDiff = aggregations?.comparisons?.pop_growth_state !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_state) : null;
            const usaDiff = aggregations?.comparisons?.pop_growth_usa !== undefined ? (localPopGrowthPct - aggregations.comparisons.pop_growth_usa) : null;
            return (
              <>
                {cityDiff !== null && (
                  <> This is <span className={cityDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(cityDiff).toFixed(1)}% {cityDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">{city?.name || 'City'}</span> average.</>
                )}
                {stateDiff !== null && (
                  <> This is <span className={stateDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(stateDiff).toFixed(1)}% {stateDiff >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">State</span> average and <span className={usaDiff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{Math.abs(usaDiff || 0).toFixed(1)}% {(usaDiff || 0) >= 0 ? 'above' : 'below'}</span> the <span className="font-semibold">USA</span> average.</>
                )}
              </>
            );
          })()}
        </div>
      </Card>

      {/* Cap Rate */}
      {market_cap_rate?.value_percent !== undefined && (
        <>
          <GradBanner><span className="font-bold text-lg">Investment Metrics</span></GradBanner>
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-gray-500"><th className="py-2.5 px-4">Metric</th><th className="text-right px-4">Value</th><th className="px-4">Detail</th></tr></thead>
              <tbody>
                <Row label="Market Cap Rate" value={fmtPercent(market_cap_rate.value_percent)} tone="text-emerald-700" detail={`Source: ${market_cap_rate.source || 'estimate'}`} />
                <Row label="Rent-to-Price Ratio" value={aggregations?.rent_to_price_ratio ? `${aggregations.rent_to_price_ratio.toFixed(2)}%` : 'N/A'} detail="(Annual Rent / Home Value) × 100" />
                <Row label="Area Classification" value={area_classification || 'N/A'} detail="Based on rent-to-income ratio" />
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// Wrap MarketResearchTab with ErrorBoundary to avoid blank screens
export default function MarketResearchTabWrapper(props) {
  return (
    <ErrorBoundary>
      <MarketResearchTab {...props} />
    </ErrorBoundary>
  );
}
