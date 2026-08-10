import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { geocodeAddress } from '../../utils/geocode';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';

/**
 * A satellite/hybrid "3D fly-around" of the property — orbits the camera
 * heading 360° around a fixed point with tilt engaged, using the classic
 * Google Maps JS API (map.setTilt/setHeading). This is the reliable,
 * widely-supported way to get an orbiting flyover effect (works anywhere
 * Google has satellite imagery); it does not depend on the newer
 * Photorealistic 3D Tiles preview API, which requires separate allow-listing.
 */
export default function PropertyFlyover3D({ address, latitude, longitude, accent = '#0f5132' }) {
  const { isLoaded } = useJsApiLoader({
    id: 'dealsniper-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [coords, setCoords] = useState(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );
  const [geocodeError, setGeocodeError] = useState(false);
  const [playing, setPlaying] = useState(true);
  const mapRef = useRef(null);
  const headingRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (coords || !address) return;
    let cancelled = false;
    geocodeAddress(address).then((loc) => {
      if (cancelled) return;
      if (loc) setCoords({ lat: loc.latitude, lng: loc.longitude });
      else setGeocodeError(true);
    });
    return () => { cancelled = true; };
  }, [address, coords]);

  const animate = useCallback(() => {
    if (!mapRef.current) return;
    headingRef.current = (headingRef.current + 0.15) % 360;
    mapRef.current.setHeading(headingRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing && isLoaded && coords) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, isLoaded, coords, animate]);

  const onLoad = (map) => {
    mapRef.current = map;
    map.setTilt(45);
    map.setHeading(headingRef.current);
  };

  const resetView = () => {
    headingRef.current = 0;
    if (mapRef.current) mapRef.current.setHeading(0);
  };

  if (!GOOGLE_MAPS_API_KEY || geocodeError) return null;
  if (!coords) return null;

  return (
    <div className="dr-card" style={{ overflow: 'hidden', marginTop: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dr-border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="dr-eyebrow">Aerial View</div>
          <h3 className="dr-h2" style={{ margin: 0, fontSize: 18 }}>Property Flyover</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPlaying((p) => !p)}
            title={playing ? 'Pause' : 'Play'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: `1px solid ${accent}`, background: '#fff', color: accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={resetView}
            title="Reset view"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: 420 }}
          center={coords}
          zoom={19}
          onLoad={onLoad}
          options={{
            mapTypeId: 'satellite',
            tilt: 45,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
          }}
        />
      ) : (
        <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          Loading aerial imagery…
        </div>
      )}
      <div style={{ padding: '10px 20px', fontSize: 11, color: '#9ca3af' }}>
        Satellite imagery orbiting the property — drag to look around manually, or use Play/Pause to control the flyover.
      </div>
    </div>
  );
}
