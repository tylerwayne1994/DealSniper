import React, { useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  height: 600px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
`;

const Legend = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  min-width: 200px;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #1e293b;
    font-weight: 600;
  }
`;

const LegendSection = styled.div`
  margin-bottom: 1.5rem;

  h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #374151;
`;

const ColorDot = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.color};
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
`;

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHlsZXJ3YXluZTEiLCJhIjoiY21oNzlqb2xwMHBybjJscHR5ZXVqcHZ2aCJ9.jHao1snG3bwXFRVWcA8tuQ';

// Deal type colors
const DEAL_COLORS = {
  'seller-finance': '#10b981', // Green
  'hybrid': '#f59e0b',         // Orange  
  'subject-to': '#8b5cf6',     // Purple
  'cash': '#ef4444'            // Red
};



const PropertyMap = ({ filters = {} }) => {
  const { properties: mapProperties } = useListings();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  
  const formatDealType = (dealType) => {
    return dealType.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filterProperties = (properties, filters) => {
    if (!filters || Object.keys(filters).length === 0) {
      return properties;
    }

    return properties.filter(property => {
      // Filter by deal type
      if (filters.type && property.dealType !== filters.type) {
        return false;
      }
      
      // Filter by category
      if (filters.category && property.category !== filters.category) {
        return false;
      }
      
      // Filter by location (if searching)
      if (filters.location && !property.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
      
      // Filter by price range
      if (filters.minPrice && property.price < parseInt(filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice && property.price > parseInt(filters.maxPrice)) {
        return false;
      }
      
      // Filter by bedrooms
      if (filters.bedrooms && property.bedrooms < parseInt(filters.bedrooms)) {
        return false;
      }
      
      return true;
    });
  };

  const addMarkersToMap = useCallback((properties) => {
    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers for filtered properties
    properties.forEach((property) => {
      console.log('Adding marker for:', property.title);

      // Create an accessible SVG teardrop marker so the tip points at the exact coordinate.
      const svgns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgns, 'svg');
      svg.setAttribute('width', '36');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '0 0 36 48');
      svg.style.cursor = 'pointer';
      svg.style.display = 'block';
      svg.style.pointerEvents = 'auto';

      // Outer drop path (teardrop)
      const path = document.createElementNS(svgns, 'path');
      // A smooth teardrop shape; the tip is centered at the bottom of the viewBox
      path.setAttribute('d', 'M18 0 C28 0 34 10 34 18 C34 30 18 48 18 48 C18 48 2 30 2 18 C2 10 8 0 18 0 Z');
      path.setAttribute('fill', DEAL_COLORS[property.dealType] || '#10b981');
      path.setAttribute('stroke', 'white');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('vector-effect', 'non-scaling-stroke');

      // Inner circle highlight for a glossy look
      const circle = document.createElementNS(svgns, 'circle');
      circle.setAttribute('cx', '18');
      circle.setAttribute('cy', '14');
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', 'rgba(255,255,255,0.25)');
      circle.setAttribute('pointer-events', 'none');

      svg.appendChild(path);
      svg.appendChild(circle);

      // Wrap svg in a div to allow consistent sizing and z-indexing if needed
      const wrapper = document.createElement('div');
      wrapper.style.width = '36px';
      wrapper.style.height = '48px';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.transform = 'translateY(0)';
      wrapper.appendChild(svg);

      const popup = new window.mapboxgl.Popup({ offset: [0, -38], className: 'property-popup' })
        .setHTML(`
          <div style="padding: 0; min-width: 280px; font-family: Inter, sans-serif;">
            <img src="${property.image}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" 
                 onerror="this.src='https://via.placeholder.com/280x140?text=Property'"/>
            <div style="padding: 12px 14px;">
              <div style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                $${property.price.toLocaleString()}
              </div>
              <div style="font-weight: 700; margin-bottom: 4px;">${property.title}</div>
              <div style="color: #64748b; margin-bottom: 8px; font-size: 0.9rem;">📍 ${property.location}</div>
              <div style="display: flex; gap: 10px; margin-bottom: 10px; font-size: 0.85rem; color:#374151;">
                <span>🛏️ ${property.bedrooms}</span>
                <span>🚿 ${property.bathrooms}</span>
                <span>📐 ${property.sqft}</span>
              </div>
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <span style="background: ${DEAL_COLORS[property.dealType]}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight:600;">
                  ${formatDealType(property.dealType)}
                </span>
                <span style="background: #64748b; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight:600;">
                  ${property.category === 'multifamily' ? 'Multi-Family' : 'Single Family'}
                </span>
              </div>
              <button onclick="window.location.href='/property/${property.id}'" 
                      style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 600;">
                View Details
              </button>
            </div>
          </div>
        `);

      // Use anchor 'bottom' so the tip of the teardrop points exactly to the coordinates
      const marker = new window.mapboxgl.Marker({
        element: wrapper,
        anchor: 'bottom'
      })
        .setLngLat(property.coordinates)
        .setPopup(popup)
        .addTo(map.current);

      markers.current.push(marker);
      console.log('Marker added:', marker);
    });
  }, []);

  useEffect(() => {
    if (map.current) return;
    
    // Load mapbox-gl directly
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => {
      const link = document.createElement('link');
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-122.3321, 47.6062],
        zoom: 11
      });

      // Add initial markers
      const filteredProperties = filterProperties(mapProperties, filters);
      addMarkersToMap(filteredProperties);
    };
    
    document.head.appendChild(script);
  }, [filters, addMarkersToMap]);

  // Update markers when filters change
  useEffect(() => {
    if (map.current) {
      const filteredProperties = filterProperties(mapProperties, filters);
      addMarkersToMap(filteredProperties);
    }
  }, [filters, addMarkersToMap]);

  return (
    <MapContainer>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <Legend>
        <h3>Property Legend</h3>
        
        <LegendSection>
          <h4>Deal Types</h4>
          <LegendItem>
            <ColorDot color={DEAL_COLORS['seller-finance']} />
            <span>Seller Finance</span>
          </LegendItem>
          <LegendItem>
            <ColorDot color={DEAL_COLORS['hybrid']} />
            <span>Hybrid</span>
          </LegendItem>
          <LegendItem>
            <ColorDot color={DEAL_COLORS['subject-to']} />
            <span>Subject To</span>
          </LegendItem>
          <LegendItem>
            <ColorDot color={DEAL_COLORS['cash']} />
            <span>Cash</span>
          </LegendItem>
        </LegendSection>

        <LegendSection>
          <h4>Categories</h4>
          <LegendItem>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>🏠 Single Family</span>
          </LegendItem>
          <LegendItem>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>🏢 Multi-Family</span>
          </LegendItem>
        </LegendSection>
      </Legend>
    </MapContainer>
  );
};

export default PropertyMap;