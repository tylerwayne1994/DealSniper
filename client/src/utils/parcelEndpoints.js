/**
 * US Parcel Boundary REST API Endpoints
 * Statewide endpoints preferred — county-level fallbacks where needed.
 * All endpoints are publicly accessible (no auth required).
 *
 * Usage: getParcelEndpoint(stateAbbrev) → URL string | null
 *        fetchParcelPolygon(lat, lon, stateAbbrev) → GeoJSON Feature | null
 */

// Statewide endpoints (covers 38+ states with a single URL each)
const STATEWIDE_ENDPOINTS = {
  AL: 'https://services7.arcgis.com/jF2q3LPxL7PETdYk/arcgis/rest/services/Alabama_Counties/FeatureServer/0',
  AZ: 'https://server.azgeo.az.gov/arcgis/rest/services/az911/AZ911_Parcel_Provisioning_Boundary/MapServer/0',
  AR: 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6',
  CO: 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0',
  CT: 'https://cteco.uconn.edu/ctmaps/rest/services/Parcels/Parcels/FeatureServer/0',
  DE: 'https://enterprise.firstmaptest.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/FeatureServer/0',
  FL: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
  HI: 'https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25',
  ID: 'https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0',
  IN: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0',
  ME: 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Merged/FeatureServer/0',
  MD: 'https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0',
  MA: 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/L3_TAXPAR_POLY_ASSESS_gdb/FeatureServer/0',
  MN: 'https://pca-gis02.pca.state.mn.us/arcgis/rest/services/base/parcels_open_data_counties/MapServer/0',
  MS: 'https://gis.waggonereng.com/server/rest/services/Hosted/Mississippi_Parcels_Staewide/FeatureServer/0',
  MT: 'https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0',
  NE: 'https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0',
  NH: 'https://nhgeodata.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1',
  NJ: 'https://maps.nj.gov/arcgis/rest/services/Basemap/Parcels_NJ/MapServer/0',
  NM: 'https://gis.ose.nm.gov/server_s/rest/services/Parcels/County_Parcels_2025/MapServer/0',
  NY: 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/0',
  NC: 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1',
  ND: 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0',
  OH: 'https://maps.ohio.gov/arcgis/rest/services/Statewide_Parcels_2022/MapServer/0',
  OR: 'https://maps.dsl.state.or.us/arcgis/rest/services/SlisPublic/FeatureServer/0',
  PA: 'https://gis.dep.pa.gov/depgisprd/rest/services/Parcels/PA_Parcels/MapServer/0',
  RI: 'https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0',
  SC: 'https://gis.scdot.org/hosting/rest/services/SC_Parcels/MapServer/0',
  TN: 'https://tiles.arcgis.com/tiles/YuVBSS7Y1of2Qud1/arcgis/rest/services/Property_Boundaries_86_Counties/VectorTileServer',
  TX: 'https://feature.tnris.org/arcgis/rest/services/Parcels/stratmap19_land_parcels_48/MapServer/0',
  UT: 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/Parcels_Utah_LIR/FeatureServer/0',
  VT: 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0',
  VA: 'https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0',
  WA: 'https://wisaard.dahp.wa.gov/server/rest/services/County_Parcels/MapServer/0',
  WV: 'https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0',
  WI: 'https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels/FeatureServer/0',
  WY: 'https://services7.arcgis.com/IRwObajcV9nxQIrC/ArcGIS/rest/services/WyomingParcels/FeatureServer/0',
};

// County-level fallbacks for states without a statewide endpoint
const COUNTY_ENDPOINTS = {
  AK: {
    'Anchorage': 'https://services2.arcgis.com/Ce3DhLRthdwbHlfF/ArcGIS/rest/services/PropertyInformation_Hosted/FeatureServer/0',
    'Fairbanks North Star': 'https://services.arcgis.com/f4rR7WnIfGBdVYFd/ArcGIS/rest/services/Tax_Parcels/FeatureServer/0',
    'Juneau': 'https://services.arcgis.com/kpMKjjLr8H1rZ4XO/arcgis/rest/services/Juneau_Parcel_Viewer/FeatureServer/0',
    'Kenai Peninsula': 'https://services.arcgis.com/ba4DH9pIcqkXJVfl/ArcGIS/rest/services/Redacted_Parcels_view/FeatureServer/0',
  },
  CA: {
    'Monterey': 'https://maps.co.monterey.ca.us/server/rest/services/Land_Records/Parcels/FeatureServer/0',
    'Kern': 'https://gis.shafter.com/server/rest/services/Parcels_2025_F_SMC/FeatureServer/0',
  },
  GA: {
    'Liberty': 'https://maps.crc.ga.gov/crcarcgis/rest/services/Liberty/Parcels/MapServer/0',
    'Glynn': 'https://gis-web.glynncounty-ga.gov/gis-server/rest/services/Parcels/Parcels/FeatureServer/0',
    'DeKalb': 'https://dcgis.dekalbcountyga.gov/hosted/rest/services/Parcels/MapServer/0',
  },
  IL: {
    'Rock Island': 'https://services9.arcgis.com/6FnscPPlUa9DXXOk/ArcGIS/rest/services/Parcels/FeatureServer/0',
    'Lake': 'https://services3.arcgis.com/HESxeTbDliKKvec2/ArcGIS/rest/services/OpenData_ParcelPolygons/FeatureServer/0',
    'DuPage': 'https://gis.dupageco.org/arcgis/rest/services/ParcelSearch/DuPageAssessmentParcelViewer/MapServer/0',
  },
  IA: {
    'Linn': 'https://services.arcgis.com/XORNS2fPFySPlBgy/arcgis/rest/services/Linn_County_Real_Estate_Parcel/FeatureServer/0',
  },
  KS: {
    'Wyandotte': 'https://gisweb.wycokck.org/arcgis/rest/services/GISPUB/Vacant_Parcels/MapServer/0',
    'Douglas': 'https://gis2.lawrenceks.org/arcgis/rest/services/Parcels/MapServer/0',
    'Osage': 'https://services9.arcgis.com/vyfEIyeUgm6rTXSN/arcgis/rest/services/OS_Parcels/FeatureServer/0',
  },
  KY: {
    'Jefferson': 'https://gis.lojic.org/maps/rest/services/LojicSolutions/OpenDataPVA/MapServer/1',
    'Lexington-Fayette': 'https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Parcel/FeatureServer/0',
  },
  LA: {
    'East Baton Rouge': 'https://maps.brla.gov/gis/rest/services/Cadastral/Tax_Parcel/MapServer/0',
  },
  MI: {
    'Ottawa': 'https://gis.miottawa.org/arcgis/rest/services/HostedServices/Parcels/MapServer/1',
    'Kent': 'https://gis.kentcountymi.gov/agisprod/rest/services/ParcelsWithCondos/FeatureServer/0',
  },
  MO: {
    'Clay': 'https://services7.arcgis.com/3c8lLdmDNevrTlaV/ArcGIS/rest/services/ClayCountyParcelService/FeatureServer/0',
    'St. Louis': 'https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/0',
    'St. Charles': 'https://gis.sccmo.org/arcgis/rest/services/viewers/Public_Viewer/MapServer/1',
  },
  NV: {
    'Churchill': 'https://services2.arcgis.com/uPb1UC2HwTkBAlth/arcgis/rest/services/Churchill_County_Tax_Parcels/FeatureServer/0',
    'Clark': 'https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/BOE_Parcels/FeatureServer/0',
    'Douglas': 'https://apps.douglas.co.us/gisod/rest/services/Parcels/MapServer/4',
    'Washoe': 'https://gisenterprise.washoecounty.gov/server/rest/services/WashoeGIS/Parcels/FeatureServer/0',
  },
  OK: {
    'Oklahoma': 'https://services8.arcgis.com/euhkr1dAJeQBIjV0/arcgis/rest/services/TaxParcelsPublics_view/FeatureServer/0',
  },
  SD: {
    'Minnehaha': 'https://gis.minnehahacounty.org/minnemap/rest/services/Parcels/MapServer/0',
  },
};

// State abbreviation lookup from full name
const STATE_ABBREVS = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC',
};

/**
 * Normalize a state string to 2-letter abbreviation
 */
export function normalizeState(stateStr) {
  if (!stateStr) return null;
  const s = stateStr.trim();
  // Already a 2-letter abbrev?
  if (s.length === 2) return s.toUpperCase();
  // Full name match
  return STATE_ABBREVS[s.toLowerCase()] || null;
}

/**
 * Get the parcel REST endpoint URL for a given state (and optional county).
 * Returns null if no endpoint is available.
 */
export function getParcelEndpoint(stateAbbrev, county = null) {
  const st = (stateAbbrev || '').toUpperCase();
  
  // Check county-level first (more specific)
  if (county && COUNTY_ENDPOINTS[st]) {
    const countyMap = COUNTY_ENDPOINTS[st];
    // Try exact match, then fuzzy
    const normalCounty = county.toLowerCase().replace(/ county$/i, '').trim();
    for (const [name, url] of Object.entries(countyMap)) {
      if (name.toLowerCase() === normalCounty) return url;
    }
  }
  
  // Statewide endpoint
  return STATEWIDE_ENDPOINTS[st] || null;
}

/**
 * Fetch the parcel polygon GeoJSON for a given lat/lon from an ArcGIS REST endpoint.
 * Returns { geojson, attributes } or null on failure.
 */
export async function fetchParcelPolygon(lat, lon, stateAbbrev, county = null) {
  const endpointUrl = getParcelEndpoint(stateAbbrev, county);
  if (!endpointUrl) return null;

  // Build the spatial query
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    outSR: '4326',
    f: 'geojson',
    returnGeometry: 'true',
  });

  // Some endpoints need /query appended if the URL doesn't already include it
  let queryUrl = endpointUrl;
  if (!queryUrl.toLowerCase().includes('/query')) {
    queryUrl = queryUrl.replace(/\/$/, '') + '/query';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(`${queryUrl}?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    // Handle GeoJSON response
    if (data.features && data.features.length > 0) {
      return {
        geojson: data.features[0],
        attributes: data.features[0].properties || {},
      };
    }

    // Some endpoints return Esri JSON instead of GeoJSON — try to handle
    if (data.features === undefined && data.geometryType) {
      // Retry with f=json and convert
      const jsonParams = new URLSearchParams({
        where: '1=1',
        geometry: `${lon},${lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        outSR: '4326',
        f: 'json',
        returnGeometry: 'true',
      });
      const res2 = await fetch(`${queryUrl}?${jsonParams}`);
      if (!res2.ok) return null;
      const esriData = await res2.json();
      if (esriData.features && esriData.features.length > 0) {
        const feat = esriData.features[0];
        // Convert Esri polygon rings to GeoJSON
        if (feat.geometry && feat.geometry.rings) {
          return {
            geojson: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: feat.geometry.rings,
              },
              properties: feat.attributes || {},
            },
            attributes: feat.attributes || {},
          };
        }
      }
    }

    return null;
  } catch (err) {
    // Silently fail — parcel data is best-effort
    console.warn(`[Parcel] Failed for ${stateAbbrev} at ${lat},${lon}:`, err.message);
    return null;
  }
}

/**
 * Batch fetch parcel polygons for an array of properties.
 * Each property should have { latitude, longitude, state }.
 * Processes in parallel batches with rate limiting.
 * Calls onProgress(current, total) and onParcelFound(property, geojsonFeature) as callbacks.
 */
export async function batchFetchParcels(properties, { onProgress, onParcelFound, batchSize = 5, delayMs = 200 } = {}) {
  const total = properties.length;
  let completed = 0;
  const foundRef = { count: 0 };

  for (let i = 0; i < total; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (prop) => {
        const stateAbbr = normalizeState(prop.state);
        if (!stateAbbr) return null;
        
        const result = await fetchParcelPolygon(prop.latitude, prop.longitude, stateAbbr, prop.county);
        if (result) {
          foundRef.count++;
          // Attach original property data to the GeoJSON feature
          result.geojson.properties = {
            ...result.geojson.properties,
            _uploadedData: prop.originalData || prop.propertyData || {},
            _address: prop.address || '',
            _pinId: prop.id || prop.pinId || '',
          };
          if (onParcelFound) onParcelFound(prop, result.geojson);
        }
        return result;
      })
    );

    completed += batch.length;
    if (onProgress) onProgress(completed, total, foundRef.count);

    // Small delay between batches to be respectful to public APIs
    if (i + batchSize < total) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return { total, found: foundRef.count };
}
