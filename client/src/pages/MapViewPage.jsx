import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidHlsZXJ3YXluZTEyIiwiYSI6ImNtanl5b3RkNTZwYnMzZ3B3eHN3eGJ4OHAifQ.Jz3DXX3FplxJPTqMQSRbCA';

function MapViewPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-98.5795);
  const [lat, setLat] = useState(39.8283);
  const [zoom, setZoom] = useState(3.5);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Update state on map move
    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });

    return () => map.current.remove();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.coords}>
          Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
      </div>
      <div ref={mapContainer} style={styles.mapContainer} />
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden'
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    background: 'rgba(255, 255, 255, 0.9)',
    padding: '12px 16px',
    margin: '12px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontSize: '13px',
    fontFamily: 'monospace'
  },
  coords: {
    color: '#333'
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%'
  }
};

export default MapViewPage;
