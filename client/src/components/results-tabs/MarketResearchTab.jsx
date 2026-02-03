import React, { useState, useEffect, useMemo } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'MAPBOX_TOKEN_REMOVED';

// Formatting helpers
const fmt = (val) => val?.toLocaleString() || 'N/A';
const fmtCurrency = (val) => val ? `$${val.toLocaleString()}` : 'N/A';
const fmtPercent = (val) => val !== null && val !== undefined ? `${val.toFixed(1)}%` : 'N/A';

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
    county_data,
    zip_data,
    msa_data,
    aggregations
  } = marketData;

  // Prepare isochrone GeoJSON layer
  const isochroneLayer = {
    id: 'isochrone-fill',
    type: 'fill',
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.3,
      'fill-outline-color': '#1d4ed8'
    }
  };

  // Calculate affordability color
  const getAffordabilityColor = (ratio) => {
    if (ratio < 25) return 'text-green-600';
    if (ratio < 30) return 'text-yellow-600';
    if (ratio < 35) return 'text-orange-600';
    return 'text-red-600';
  };

  const rentToIncomeRatio = county_data?.rent_to_income_ratio || 0;
  const affordabilityColor = getAffordabilityColor(rentToIncomeRatio);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Market Analysis</h2>
        <p className="text-sm text-gray-600">
          {property_location.address}, {property_location.city}, {property_location.state} {property_location.zip}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          15-Minute Drive Time Market Area
        </p>
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
            {/* Property marker */}
            {property_location && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10
                }}
              >
                <div className="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg" />
              </div>
            )}

            {/* Isochrone polygon */}
            {isochrone && (
              <Source id="isochrone" type="geojson" data={isochrone}>
                <Layer {...isochroneLayer} />
              </Source>
            )}
          </Map>
        </div>
        <div className="p-4 bg-gray-50 border-t text-sm text-gray-600">
          <p><span className="font-medium">Blue shaded area:</span> 15-minute drive-time market boundary</p>
          <p><span className="font-medium">Red dot:</span> Subject property location</p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Population Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Population</div>
          <div className="text-3xl font-bold text-gray-900">{fmt(county_data.population)}</div>
          <div className="text-xs text-gray-600 mt-2">{county_data.county_name}</div>
        </div>

        {/* Income Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Median Household Income</div>
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(county_data.median_household_income)}</div>
          <div className="text-xs text-gray-600 mt-2">Mean: {fmtCurrency(county_data.mean_household_income)}</div>
        </div>

        {/* Affordability Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Rent-to-Income Ratio</div>
          <div className={`text-3xl font-bold ${affordabilityColor}`}>
            {fmtPercent(rentToIncomeRatio)}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {rentToIncomeRatio < 25 ? 'Highly Affordable' : rentToIncomeRatio < 30 ? 'Affordable' : rentToIncomeRatio < 35 ? 'Moderate' : 'Low Affordability'}
          </div>
        </div>
      </div>

      {/* Housing Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Housing Market</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Home Value</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(county_data.median_home_value)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Median Gross Rent</div>
            <div className="text-2xl font-bold text-gray-900">{fmtCurrency(county_data.median_rent)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Owner-Occupied Rate</div>
            <div className="text-2xl font-bold text-gray-900">{fmtPercent(county_data.owner_occupied_rate)}</div>
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
      {msa_data && msa_data.msa_name && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Multifamily Construction Activity</h3>
          <p className="text-sm text-gray-600 mb-4">{msa_data.msa_name}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD Total Permits</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(msa_data.ytd_total_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">YTD 5+ Unit Buildings</div>
              <div className="text-2xl font-bold text-blue-600">{fmt(msa_data.ytd_5plus_units)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Current Month Permits</div>
              <div className="text-2xl font-bold text-green-600">{fmt(msa_data.current_month_units)}</div>
            </div>
          </div>
        </div>
      )}

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

      {/* Comparison Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Comparison</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-700">Local (15-min drive)</span>
            <span className="text-sm text-gray-900">{aggregations.local.description}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-700">City</span>
            <span className="text-sm text-gray-900">{aggregations.city.name}, {aggregations.city.state}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-700">County</span>
            <span className="text-sm text-gray-900">{aggregations.county.name} (Pop: {fmt(aggregations.county.population)})</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-gray-700">State</span>
            <span className="text-sm text-gray-900">{aggregations.state.name}</span>
          </div>
        </div>
      </div>

      {/* Data Sources Footer */}
      <div className="bg-gray-50 rounded-lg shadow-sm p-4">
        <p className="text-xs text-gray-500">
          <span className="font-semibold">Data Sources:</span> U.S. Census Bureau American Community Survey (ACS) 2023 5-Year Estimates, 
          IRS Migration Data 2021, U.S. Census Bureau Building Permits Survey (May 2025), Mapbox Isochrone API. 
          Market boundary represents 15-minute drive-time from subject property.
        </p>
      </div>
    </div>
  );
}

export default MarketResearchTab;
