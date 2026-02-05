import React, { useState, useEffect } from 'react';
import { Map, Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell } from 'recharts';
import { Clock, Percent, Layers, Users, TrendingUp, Home as HomeIcon, DollarSign, Briefcase, Activity } from 'lucide-react';

const MAPBOX_TOKEN = 'MAPBOX_TOKEN_REMOVED';

// Formatting helpers
const fmt = (val) => val?.toLocaleString() || 'N/A';
const fmtCurrency = (val) => val ? `$${val.toLocaleString()}` : 'N/A';
const fmtPercent = (val) => val !== null && val !== undefined ? `${val.toFixed(1)}%` : 'N/A';
const fmtPercentFromFraction = (val) => val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : 'N/A';

function MarketResearchTab({ marketData }) {
  const [viewState, setViewState] = useState({
    longitude: -98,
    latitude: 39,
    zoom: 3
  });

  // Update map viewport when data loads
  useEffect(() => {
    if (marketData?.property_location) {
      setViewState({
        longitude: marketData.property_location.lng,
        latitude: marketData.property_location.lat,
        zoom: 11
      });
    }
  }, [marketData]);

  if (!marketData) {
    return (
      <div className="p-6 text-center text-gray-500">
        No market data available. Please ensure property address is complete.
      </div>
    );
  }

  const {
    property_location,
    isochrone,
    county_data = {},
    zip_data = {},
    msa_data = {},
    aggregations = {},
    city = {},
    county = {},
    state = {},
    drive_time_minutes = 15,
    area_classification,
    zip_rir_points,
    fmr = {},
    market_cap_rate = {},
    zip_renter_owner = {},
    msa_units = {}
  } = marketData;

  // Safe defaults for aggregations
  const safeAggregations = {
    population: aggregations.population || county_data.population || 0,
    median_income: aggregations.median_income || county_data.median_income || 0,
    median_rent: aggregations.median_rent || 0,
    affordability: aggregations.affordability || 'N/A'
  };

  // Derived metrics
  const localPopGrowthPct = zip_data?.net_migration_per_capita !== undefined ? (zip_data.net_migration_per_capita * 100) : undefined;
  const households = (zip_renter_owner?.owner_count || 0) + (zip_renter_owner?.renter_count || 0);

  // Delta helpers
  const formatDeltaLine = (label, localVal, compVal, currency=false) => {
    if (localVal == null || compVal == null) return null;
    const diff = ((localVal - compVal) / (Math.abs(compVal) || 1)) * 100;
    const dir = diff >= 0 ? 'above' : 'below';
    const absPct = Math.abs(diff).toFixed(1);
    const fmtComp = currency ? fmtCurrency(compVal) : (typeof compVal === 'number' ? compVal.toLocaleString() : compVal);
    return (
      <div className="text-xs text-gray-600 mt-1">
        This is {absPct}% {dir} the {label} average ({fmtComp}).
      </div>
    );
  };

  // Prepare isochrone GeoJSON layer
  const isochroneLayer = {
    id: 'isochrone-fill',
    type: 'fill',
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.35
    }
  };

  const isochroneOutline = {
    id: 'isochrone-outline',
    type: 'line',
    paint: {
      'line-color': '#1d4ed8',
      'line-width': 2
    }
  };

  // Affordability helpers (reserved for future UI)
  // const getAffordabilityColor = (ratio) => {
  //   if (ratio < 25) return 'text-green-600';
  //   if (ratio < 30) return 'text-yellow-600';
  //   if (ratio < 35) return 'text-orange-600';
  //   return 'text-red-600';
  // };
  // const rentToIncomeRatio = county_data?.rent_to_income_ratio || 0;

  // Zip RIR points layer
  const zipRirLayer = {
    id: 'zip-rir-points',
    type: 'circle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 11, 3, 13, 4, 15, 6],
      'circle-opacity': 0.8,
      'circle-color': [
        'step', ['get', 'rir'],
        '#10b981', 15, // Most Affordable
        '#34d399', 18, // Very Affordable
        '#fde047', 22, // Average
        '#f97316', 28, // Less Affordable
        '#ef4444'      // Least Affordable
      ]
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Market Analysis</h2>
        <p className="text-sm text-gray-600">
          {property_location?.address ? (
            <>
              {property_location.address}, {property_location.city}, {property_location.state} {property_location.zip}
            </>
          ) : (
            <>
              {city.name || 'Property'}, {state.name || 'N/A'}
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded inline-flex items-center gap-1">
            <Clock size={14} /> {drive_time_minutes}-Minute Drive
          </span>
          {area_classification && (
            <span className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded inline-flex items-center gap-1">
              <Layers size={14} /> {area_classification}
            </span>
          )}
          {market_cap_rate?.value_percent !== undefined && (
            <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded inline-flex items-center gap-1">
              <Percent size={14} /> {fmtPercent(market_cap_rate.value_percent)}{market_cap_rate?.source ? ` (${market_cap_rate.source})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Mapbox Map with Isochrone */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="h-[500px] relative">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/light-v11"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Property marker pinned to coordinates */}
            {property_location && (
              <Marker longitude={property_location.lng} latitude={property_location.lat} anchor="center">
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9999,
                    backgroundColor: '#ef4444',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                  }}
                  title="Subject property"
                />
              </Marker>
            )}

            {/* Isochrone polygon */}
            {isochrone && (
              <Source id="isochrone" type="geojson" data={isochrone}>
                <Layer {...isochroneLayer} />
                <Layer {...isochroneOutline} />
              </Source>
            )}

            {/* ZIP RIR points */}
            {zip_rir_points && (
              <Source id="zip-rir" type="geojson" data={zip_rir_points}>
                <Layer {...zipRirLayer} />
              </Source>
            )}
          </Map>
        </div>
        <div className="p-4 bg-gray-50 border-t text-sm text-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <p><span className="font-medium">Blue shaded area:</span> {drive_time_minutes}-minute drive-time boundary</p>
            <p><span className="font-medium">Red dot:</span> Subject property location</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">RIR Legend:</span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></span>
                ≤15%
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#34d399' }}></span>
                15–18%
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#fde047' }}></span>
                18–22%
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></span>
                22–28%
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span>
                ≥28%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Population Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Population</div>
          <div className="text-3xl font-bold text-gray-900">{fmt(safeAggregations.population)}</div>
          <div className="text-xs text-gray-600 mt-2">{county.name || 'County'}</div>
        </div>

        {/* Income Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Median Household Income</div>
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
          <div className="text-xs text-gray-600 mt-2">County median income</div>
        </div>

        {/* Affordability Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Market Affordability</div>
          <div className="text-3xl font-bold text-blue-600">
            {safeAggregations.affordability}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Rent: {fmtCurrency(safeAggregations.median_rent)}/mo
          </div>
        </div>
      </div>

      {/* Housing Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Housing Market</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Home Value</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(county_data.median_home_value || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Gross Rent</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(safeAggregations.median_rent)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Owner-Occupied Rate</div>
            <div className="text-2xl font-bold text-gray-900">{fmtPercent(county_data.owner_occupied_rate || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">FMR (2BR)</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(fmr?.fmr_2br || 0)}</div>
            <div className="text-xs text-gray-600">ZIP {fmr?.zip || property_location?.zip || ''}</div>
          </div>
        </div>
      </div>

      {/* Migration Data */}
      {zip_data && zip_data.net_migration !== undefined && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Migration Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Net Migration</div>
              <div className={`text-2xl font-bold ${zip_data.net_migration >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {zip_data.net_migration >= 0 ? '+' : ''}{fmt(Math.round(zip_data.net_migration))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Net Per Capita</div>
              <div className="text-2xl font-bold text-gray-900">{zip_data.net_migration_per_capita?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">In-Migration</div>
              <div className="text-2xl font-bold text-blue-600">{fmt(Math.round(zip_data.in_migration || 0))}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Out-Migration</div>
              <div className="text-2xl font-bold text-orange-600">{fmt(Math.round(zip_data.out_migration || 0))}</div>
            </div>
          </div>
        </div>
      )}

      {/* MSA Construction Data */}
      {(msa_data && msa_data.msa_name) || (msa_units && (msa_units.ytd_5plus_units || msa_units.ytd_total_units)) ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Multifamily Construction Activity</h3>
          {msa_data?.msa_name && <p className="text-sm text-gray-600 mb-4">{msa_data.msa_name}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD Total Permits</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(msa_data.ytd_total_units || msa_units.ytd_total_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD 5+ Unit Buildings</div>
              <div className="text-2xl font-bold text-blue-600">{fmt(msa_data.ytd_5plus_units || msa_units.ytd_5plus_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Current Month Permits</div>
              <div className="text-2xl font-bold text-green-600">{fmt(msa_data.current_month_units || msa_units.current_month_units)}</div>
            </div>
          </div>
          {(msa_units.absorption_units !== undefined || msa_units.absorption_rate !== undefined) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Absorption Units (proxy)</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(Math.round(msa_units.absorption_units || 0))}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Absorption Rate</div>
                <div className="text-2xl font-bold text-gray-900">{msa_units.absorption_rate !== undefined ? fmtPercent(msa_units.absorption_rate * 100) : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Employment */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Unemployment Rate</div>
            <div className={`text-2xl font-bold ${county_data.unemployment_rate < 5 ? 'text-green-600' : county_data.unemployment_rate < 7 ? 'text-yellow-600' : 'text-red-600'}`}>
              {fmtPercent(county_data.unemployment_rate)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Labor Force Health</div>
            <div className="text-sm text-gray-700 mt-2">
              {county_data.unemployment_rate < 5 ? 'Strong labor market with low unemployment' : county_data.unemployment_rate < 7 ? 'Moderate labor market conditions' : 'Elevated unemployment levels'}
            </div>
          </div>
        </div>
      </div>

      {/* Landlord & Zip Renter/Owner */}
      {(zip_renter_owner && (zip_renter_owner.renter_share !== undefined || zip_renter_owner.owner_share !== undefined)) || (aggregations.businesses || aggregations.walk_score) ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Local Housing Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Renter Share</div>
              <div className="text-2xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.renter_share ?? 0)}</div>
              <div className="text-xs text-gray-600">{fmt(Math.round(zip_renter_owner?.renter_count ?? 0))} renters</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Owner Share</div>
              <div className="text-2xl font-bold text-gray-900">{fmtPercentFromFraction(zip_renter_owner?.owner_share ?? 0)}</div>
              <div className="text-xs text-gray-600">{fmt(Math.round(zip_renter_owner?.owner_count ?? 0))} owners</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Businesses</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
              <div className="text-xs text-gray-600">Walk Score: {aggregations?.walk_score ?? 'N/A'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Market Comparison with charts */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Market Comparison</h3>
        <p className="text-xs text-gray-500 mb-4">Local Area vs. City, State & USA averages</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Median Household Income Chart */}
          <div className="bg-gray-50 rounded p-4">
            <div className="font-medium text-gray-900 mb-1">Median Household Income</div>
            <div className="text-xs text-gray-500 mb-3">Annual household earnings comparison</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local', value: safeAggregations.median_income },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.income_city },
                  { name: 'State', value: aggregations?.comparisons?.income_state },
                  { name: 'USA', value: aggregations?.comparisons?.income_usa }
                ]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="value">
                    {['#3b82f6','#60a5fa','#93c5fd','#60a5fa'].map((c, i) => <Cell key={`inc-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Delta lines matching Cactus-style copy */}
            {formatDeltaLine(city?.name || 'City', safeAggregations.median_income, aggregations?.comparisons?.income_city, true)}
            {formatDeltaLine('State', safeAggregations.median_income, aggregations?.comparisons?.income_state, true)}
            {formatDeltaLine('USA', safeAggregations.median_income, aggregations?.comparisons?.income_usa, true)}
          </div>

          {/* Population Growth Chart */}
          <div className="bg-gray-50 rounded p-4">
            <div className="font-medium text-gray-900 mb-1">Population Growth</div>
            <div className="text-xs text-gray-500 mb-3">Annual population change trends</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local', value: localPopGrowthPct },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.pop_growth_city },
                  { name: 'State', value: aggregations?.comparisons?.pop_growth_state },
                  { name: 'USA', value: aggregations?.comparisons?.pop_growth_usa }
                ]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${v?.toFixed ? v.toFixed(1) : v}%`} />
                  <Tooltip formatter={(v) => fmtPercent(v)} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Legend />
                  <Bar dataKey="value">
                    {['#34d399','#86efac','#a7f3d0','#86efac'].map((c, i) => <Cell key={`pop-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Delta lines */}
            {formatDeltaLine(city?.name || 'City', localPopGrowthPct, aggregations?.comparisons?.pop_growth_city)}
            {formatDeltaLine('State', localPopGrowthPct, aggregations?.comparisons?.pop_growth_state)}
            {formatDeltaLine('USA', localPopGrowthPct, aggregations?.comparisons?.pop_growth_usa)}
          </div>
        </div>
      </div>

      {/* Side Market Metrics (Cactus-style) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500">Analysis Area</div>
            <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {drive_time_minutes}-min Drive</div>
          </div>
          <div className="text-xs px-2 py-1 rounded border bg-gray-50">Market Metrics</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Users size={14} /> Population</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(safeAggregations.population)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><TrendingUp size={14} /> Growth</div>
            <div className="text-lg font-semibold text-gray-900">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><HomeIcon size={14} /> Households</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(Math.round(households))}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">Single Family</div>
            <div className="text-lg font-semibold text-gray-900">N/A</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><DollarSign size={14} /> Income</div>
            <div className="text-lg font-semibold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Briefcase size={14} /> Businesses</div>
            <div className="text-lg font-semibold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Activity size={14} /> Walk Score</div>
            <div className="text-lg font-semibold text-gray-900">{aggregations?.walk_score ?? 'N/A'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500 inline-flex items-center gap-1"><Percent size={14} /> Affordability</div>
            <div className="text-lg font-semibold text-blue-600">{safeAggregations.affordability}</div>
          </div>
        </div>
      </div>

      {/* RIR Cards (Local vs County) */}
      {(marketData?.rent_to_income_ratio !== undefined || county_data?.rent_to_income_ratio !== undefined) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded border p-4">
              <div className="text-xs text-gray-500">Local Market</div>
              <div className="text-2xl font-bold text-red-600">{fmtPercent(marketData?.rent_to_income_ratio ?? 0)}</div>
              <div className="text-xs text-gray-500 mt-1">Rent-to-Income Ratio</div>
              <div className="text-xs text-gray-600 mt-2">Median Rent: {fmtCurrency(safeAggregations.median_rent)} · Income: {fmtCurrency(safeAggregations.median_income)}</div>
            </div>
            <div className="rounded border p-4">
              <div className="text-xs text-gray-500">County</div>
              <div className="text-2xl font-bold text-red-600">{fmtPercent(county_data?.rent_to_income_ratio ?? 0)}</div>
              <div className="text-xs text-gray-500 mt-1">Rent-to-Income Ratio</div>
              <div className="text-xs text-gray-600 mt-2">Median Rent: {fmtCurrency(safeAggregations.median_rent)} · Income: {fmtCurrency(safeAggregations.median_income)}</div>
            </div>
            <div className="rounded border p-4">
              <div className="text-xs text-gray-500">State</div>
              <div className="text-2xl font-bold text-gray-900">N/A</div>
              <div className="text-xs text-gray-500 mt-1">Rent-to-Income Ratio</div>
              <div className="text-xs text-gray-600 mt-2">Median Rent: N/A · Income: N/A</div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sources Footer */}
      <div className="bg-gray-50 rounded-lg shadow-sm p-4">
        <p className="text-xs text-gray-500">
          <span className="font-semibold">Data Sources:</span> ACS 2023 5-Year, IRS Migration 2021, Building Permits Survey (May 2025), Mapbox Isochrone, HUD FMR by ZIP, CBSA Monthly MSA Units, landlord.csv, ZIP renter/owner stats. Some values estimated with a low-cost LLM when not available.
        </p>
      </div>
    </div>
  );
}

export default MarketResearchTab;
