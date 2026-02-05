import React, { useState, useEffect } from 'react';
import { Map, Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell } from 'recharts';
import { Clock, Percent, Layers, Users, TrendingUp, Home as HomeIcon, DollarSign, Briefcase, Activity, Map as MapIcon, Info, Shield } from 'lucide-react';

const MAPBOX_TOKEN = 'MAPBOX_TOKEN_REMOVED';

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
    const color = diff >= 0 ? 'text-emerald-600' : 'text-red-600';
    return (
      <div className="text-xs text-gray-700">
        <span className={color}>{absPct}% {dir}</span> the {label} average ({fmtComp}).
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

  const rirHeatmapLayer = {
    id: 'zip-rir-heatmap',
    type: 'heatmap',
    maxzoom: 14,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'rir'], 12, 0.2, 30, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 13, 1.6],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(16,185,129,0)',
        0.2, 'rgba(16,185,129,0.35)',
        0.4, 'rgba(52,211,153,0.45)',
        0.6, 'rgba(253,224,71,0.6)',
        0.8, 'rgba(249,115,22,0.7)',
        1, 'rgba(239,68,68,0.75)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 12, 28, 15, 40],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 0.25]
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

      {/* Layout: RIR cards + Map */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* RIR score stack */}
        <div className="space-y-3">
          {[{
            title: 'Local Market',
            subtitle: `${drive_time_minutes}-Minute Drive Time Area`,
            rir: marketData?.rent_to_income_ratio,
            rent: safeAggregations.median_rent,
            income: safeAggregations.median_income,
            badge: 'vs. closest cities'
          }, {
            title: 'County',
            subtitle: county?.name || 'County',
            rir: county_data?.rent_to_income_ratio,
            rent: county_data?.median_rent ?? safeAggregations.median_rent,
            income: county_data?.median_income ?? safeAggregations.median_income,
            badge: 'vs. closest counties'
          }, {
            title: 'State',
            subtitle: state?.name || 'State',
            rir: state?.rent_to_income_ratio,
            rent: state?.median_rent,
            income: state?.median_income,
            badge: 'vs. other states'
          }].map((card, idx) => {
            const meta = rirLabel(card.rir);
            return (
              <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
                    <Shield size={16} className="text-blue-500" /> {card.title}
                  </div>
                  <div className="text-sm font-semibold text-red-600">{fmtPercentFromFraction(card.rir ?? 0)}</div>
                </div>
                <div className="text-xs text-gray-500 mb-2">{card.subtitle}</div>
                <div className="text-xs text-gray-700 flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Rent-to-Income Ratio (RIR)</span>
                  <span className="text-[11px] text-gray-500">{meta.score}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-1.5 rounded-full bg-red-500"
                    style={{ width: `${Math.min(Math.max(((card.rir ?? 0) * 100), 5), 50)}%` }}
                  />
                </div>
                <div className="text-[11px] text-gray-500 mt-1">{card.badge}</div>
                <div className="flex justify-between text-xs text-gray-600 mt-3">
                  <div>
                    <div className="text-gray-500">Median Rent</div>
                    <div className="font-semibold text-gray-900">{fmtCurrency(card.rent)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500">Income</div>
                    <div className="font-semibold text-gray-900">{fmtCurrency(card.income)}</div>
                  </div>
                </div>
                {idx === 0 && (
                  <div className="mt-3 text-[11px] text-red-600">{meta.label}</div>
                )}
              </div>
            );
          })}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MapIcon size={16} className="text-blue-500" /> Cities Comparison</div>
            <div className="text-xs text-gray-500 mt-2">Rent-to-Income Ratio ranking</div>
          </div>
        </div>

        {/* Mapbox Map with Isochrone */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="h-[540px] relative">
            <Map
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Isochrone polygon */}
              {isochrone && (
                <Source id="isochrone" type="geojson" data={isochrone}>
                  <Layer {...isochroneLayer} />
                  <Layer {...isochroneOutline} />
                </Source>
              )}

              {/* Heatmap for RIR */}
              {zip_rir_points && (
                <Source id="zip-rir-heat" type="geojson" data={zip_rir_points}>
                  <Layer {...rirHeatmapLayer} />
                </Source>
              )}

              {/* ZIP RIR points */}
              {zip_rir_points && (
                <Source id="zip-rir" type="geojson" data={zip_rir_points}>
                  <Layer {...zipRirLayer} />
                </Source>
              )}

              {/* Property marker pinned to coordinates */}
              {property_location && (
                <Marker longitude={property_location.lng} latitude={property_location.lat} anchor="center">
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9999,
                      backgroundColor: '#1d4ed8',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)'
                    }}
                    title="Subject property"
                  />
                </Marker>
              )}
            </Map>

            {/* Map overlays */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-auto">
              <div className="bg-white rounded-lg shadow-sm border px-3 py-2 text-sm font-semibold flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> {drive_time_minutes}-min Drive
              </div>
              {area_classification && (
                <div className="bg-white rounded-lg shadow-sm border px-3 py-2 text-sm flex items-center gap-2">
                  <Layers size={16} className="text-emerald-600" /> {area_classification}
                </div>
              )}
            </div>

            <div className="absolute top-4 right-4 w-72 bg-white rounded-xl shadow-md border border-gray-100 p-4 pointer-events-auto space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500">Analysis Area</div>
                  <div className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1"><Clock size={14} /> {drive_time_minutes}-min Drive</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Market Metrics</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <Users size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(safeAggregations.population)}</div>
                    <div className="text-gray-500">Population</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
                    <div className="text-gray-500">Growth</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <HomeIcon size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(Math.round(households))}</div>
                    <div className="text-gray-500">Households</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmtCurrency(safeAggregations.median_income)}</div>
                    <div className="text-gray-500">Income</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{fmt(aggregations?.businesses ?? 0)}</div>
                    <div className="text-gray-500">Businesses</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Activity size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{aggregations?.walk_score ?? 'N/A'}</div>
                    <div className="text-gray-500">Walk Score</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Percent size={16} className="text-blue-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">{safeAggregations.affordability}</div>
                    <div className="text-gray-500">Affordability</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-md border border-gray-100 p-4 w-72 pointer-events-auto">
              <div className="flex items-center justify-between mb-3 text-sm font-semibold text-gray-900">
                <span>Rent-to-Income Ratio</span>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 rounded-full border bg-gray-50">Counties</span>
                  <span className="px-2 py-1 rounded-full border bg-white">Cities</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-700">
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></span> 12% Most Affordable</div>
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#34d399' }}></span> 15% Very Affordable</div>
                <div className="flex items-center gap-2 opacity-70"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#fde047' }}></span> 16.9% Average</div>
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></span> 20% Less Affordable</div>
                <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span> 30% Least Affordable</div>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-gray-500 mt-3">
                <Info size={14} className="mt-0.5" />
                <span>Lower percentages indicate more room for rent increases. Data shown within 60 miles of property.</span>
              </div>
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
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Market Comparison</h3>
        <p className="text-xs text-gray-500 mb-4">Local Area vs. City, State & USA averages</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Median Household Income Chart */}
          <div className="bg-[#f5f7ff] rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <div className="font-semibold text-gray-900">Median Household Income</div>
                <div className="text-xs text-gray-500">Annual household earnings comparison</div>
              </div>
            </div>
            <div className="text-sm text-gray-900 font-semibold mb-2">The 15 minute drive time area has a median household income of {fmtCurrency(safeAggregations.median_income)}</div>
            <div className="text-xs text-gray-700 space-y-1 mb-3">
              {formatDeltaLine(city?.name || 'City', safeAggregations.median_income, aggregations?.comparisons?.income_city, true)}
              {formatDeltaLine('State', safeAggregations.median_income, aggregations?.comparisons?.income_state, true)}
              {formatDeltaLine('USA', safeAggregations.median_income, aggregations?.comparisons?.income_usa, true)}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local Area', value: safeAggregations.median_income },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.income_city },
                  { name: 'State', value: aggregations?.comparisons?.income_state },
                  { name: 'USA', value: aggregations?.comparisons?.income_usa }
                ]} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {['#3c4bff','#6378ff','#8aa3ff','#b5c8ff'].map((c, i) => <Cell key={`inc-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Population Growth Chart */}
          <div className="bg-[#f5f7ff] rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
              <div>
                <div className="font-semibold text-gray-900">Population Growth</div>
                <div className="text-xs text-gray-500">Annual population change trends</div>
              </div>
            </div>
            <div className="text-sm text-gray-900 font-semibold mb-2">The 15 minute drive time area has an annual population growth rate of {localPopGrowthPct !== undefined ? fmtPercent(localPopGrowthPct) : 'N/A'}</div>
            <div className="text-xs text-gray-700 space-y-1 mb-3">
              {formatDeltaLine(city?.name || 'City', localPopGrowthPct, aggregations?.comparisons?.pop_growth_city)}
              {formatDeltaLine('State', localPopGrowthPct, aggregations?.comparisons?.pop_growth_state)}
              {formatDeltaLine('USA', localPopGrowthPct, aggregations?.comparisons?.pop_growth_usa)}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Local Area', value: localPopGrowthPct },
                  { name: city?.name || 'City', value: aggregations?.comparisons?.pop_growth_city },
                  { name: 'State', value: aggregations?.comparisons?.pop_growth_state },
                  { name: 'USA', value: aggregations?.comparisons?.pop_growth_usa }
                ]} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v?.toFixed ? v.toFixed(1) : v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtPercent(v)} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {['#3c4bff','#6378ff','#8aa3ff','#b5c8ff'].map((c, i) => <Cell key={`pop-${i}`} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
