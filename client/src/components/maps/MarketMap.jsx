import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MarketMap = ({ markets = [], highlightedZipCodes = [], center = [35.5, -79.0], zoom = 7 }) => {
  const [geoJsonData, setGeoJsonData] = useState(null);

  useEffect(() => {
    // Load the GeoJSON file
    fetch('/Zip_Codes.geojson')
      .then(response => response.json())
      .then(data => setGeoJsonData(data))
      .catch(error => console.error('Error loading GeoJSON:', error));
  }, []);

  // Style function for GeoJSON features
  const getFeatureStyle = (feature) => {
    const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
    const isHighlighted = highlightedZipCodes.includes(zipCode);
    
    return {
      fillColor: isHighlighted ? '#D4AF37' : '#ffffff',
      fillOpacity: isHighlighted ? 0.6 : 0.1,
      color: isHighlighted ? '#B8860B' : '#cccccc',
      weight: isHighlighted ? 2 : 1,
    };
  };

  // Popup content for each feature
  const onEachFeature = (feature, layer) => {
    const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
    const market = markets.find(m => m.zipCodes && m.zipCodes.includes(zipCode));
    
    if (market) {
      layer.bindPopup(`
        <div style="font-family: Arial, sans-serif;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${market.name}</h4>
          <p style="margin: 4px 0;"><strong>ZIP:</strong> ${zipCode}</p>
          ${market.rent ? `<p style="margin: 4px 0;"><strong>In-place rent:</strong> $${market.rent.toLocaleString()}</p>` : ''}
          ${market.occupancy ? `<p style="margin: 4px 0;"><strong>Occupancy:</strong> ${market.occupancy}%</p>` : ''}
          ${market.income ? `<p style="margin: 4px 0;"><strong>Median income:</strong> $${market.income.toLocaleString()}</p>` : ''}
        </div>
      `);
    }
  };

  // Create custom marker icon for city centers
  const createCustomIcon = (color = '#D4AF37') => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div style={{ width: '100%', height: '500px', marginBottom: '32px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {geoJsonData && (
          <GeoJSON 
            data={geoJsonData} 
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}
        
        {markets.map((market, index) => (
          market.lat && market.lng && (
            <Marker 
              key={index} 
              position={[market.lat, market.lng]}
              icon={createCustomIcon()}
            >
              <Popup>
                <div style={{ fontFamily: 'Arial, sans-serif' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>{market.name}</h4>
                  {market.rent && <p style={{ margin: '4px 0' }}><strong>In-place rent:</strong> ${market.rent.toLocaleString()}</p>}
                  {market.occupancy && <p style={{ margin: '4px 0' }}><strong>Occupancy:</strong> {market.occupancy}%</p>}
                  {market.tradeout && <p style={{ margin: '4px 0' }}><strong>Tradeout:</strong> {market.tradeout}%</p>}
                  {market.fico && <p style={{ margin: '4px 0' }}><strong>FICO score:</strong> {market.fico}</p>}
                  {market.income && <p style={{ margin: '4px 0' }}><strong>Median income:</strong> ${market.income.toLocaleString()}</p>}
                  {market.jobGrowth && <p style={{ margin: '4px 0' }}><strong>Job growth:</strong> {market.jobGrowth}%</p>}
                </div>
              </Popup>
            </Marker>
          )
        ))}
        
        <ZoomControl position="topright" />
      </MapContainer>
    </div>
  );
};

export default MarketMap;
