import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Play, Pause, RotateCcw, MapPinOff } from 'lucide-react';
import { robustGeocodeAddress } from '../../lib/dealsService';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';
// Module-level constant so this array has a STABLE reference across renders
// (a new array literal each render makes useJsApiLoader think options
// changed and re-initialize the loader). MapTab.jsx's own useJsApiLoader
// call (same shared loader `id`) must request this SAME libraries list too,
// or the two calls conflict with a "Loader must not be called again with
// different options" error.
const MAPS3D_LIBRARIES = ['maps3d'];

/**
 * A satellite "3D fly-around" of the property — orbits the camera heading
 * 360° around a fixed point with tilt engaged.
 *
 * IMPORTANT: this MUST use the real Photorealistic 3D Maps API
 * (google.maps.maps3d.Map3DElement), not the classic 2D google.maps.Map with
 * map.setTilt()/setHeading(). Google decommissioned 45° Imagery in May 2026
 * (Maps JS API v3.65+) — as of that version, satellite/hybrid map types no
 * longer support any tilt/heading rotation at all; map.setTilt(45) is
 * explicitly "ineffective" per Google's own deprecation notice. There is no
 * more classic-2D-map way to get an orbiting camera — Map3DElement is the
 * only supported replacement.
 */
export default function PropertyFlyover3D({ address, latitude, longitude, accent = '#0f5132' }) {
  const { isLoaded } = useJsApiLoader({
    id: 'dealsniper-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS3D_LIBRARIES,
  });

  const [coords, setCoords] = useState(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );
  const [geocodeError, setGeocodeError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const containerRef = useRef(null);
  const mapElRef = useRef(null);
  const headingRef = useRef(0);
  const rafRef = useRef(null);

  // Prefer coordinates the deal already has stored (same ones the map uses)
  // over a fresh client-side geocode — covers async deal loads too.
  useEffect(() => {
    if (latitude != null && longitude != null) setCoords({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  useEffect(() => {
    if (coords || !address) return;
    let cancelled = false;
    // Same Google+Nominatim fallback chain (with address normalization) used
    // by the map's pins — a raw Google-only lookup silently fails whenever
    // the Geocoding API isn't enabled for the configured key.
    robustGeocodeAddress(address).then((loc) => {
      if (cancelled) return;
      if (loc) setCoords({ lat: loc.latitude, lng: loc.longitude });
      else setGeocodeError(true);
    });
    return () => { cancelled = true; };
  }, [address, coords]);

  // Create the 3D map element once the library + coordinates are ready.
  useEffect(() => {
    if (!isLoaded || !coords || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const { Map3DElement } = await window.google.maps.importLibrary('maps3d');
      if (cancelled || !containerRef.current) return;
      const map = new Map3DElement({
        center: { lat: coords.lat, lng: coords.lng, altitude: 80 },
        range: 350,
        tilt: 65,
        heading: 0,
        mode: 'HYBRID',
      });
      map.style.width = '100%';
      map.style.height = '420px';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(map);
      mapElRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapElRef.current) { mapElRef.current.remove(); mapElRef.current = null; }
      setMapReady(false);
    };
  }, [isLoaded, coords]);

  const animate = useCallback(() => {
    if (mapElRef.current) {
      headingRef.current = (headingRef.current + 0.15) % 360;
      mapElRef.current.heading = headingRef.current;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing && mapReady) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, mapReady, animate]);

  const resetView = () => {
    headingRef.current = 0;
    if (mapElRef.current) mapElRef.current.heading = 0;
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="dr-card" style={{ marginTop: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12, color: '#6b7280' }}>
        <MapPinOff size={18} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13 }}>Aerial flyover unavailable — no Google Maps API key configured in this build (REACT_APP_GOOGLE_MAPS_KEY).</span>
      </div>
    );
  }

  if (geocodeError) {
    return (
      <div className="dr-card" style={{ marginTop: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12, color: '#6b7280' }}>
        <MapPinOff size={18} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13 }}>Couldn't locate "{address}" for the aerial flyover — the address may need to be more specific (street number + city + state).</span>
      </div>
    );
  }

  if (!coords) {
    return (
      <div className="dr-card" style={{ marginTop: 24, padding: '20px 24px', color: '#9ca3af', fontSize: 13 }}>
        Locating property for the aerial flyover…
      </div>
    );
  }

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
        <div ref={containerRef} style={{ width: '100%', height: 420, background: '#111' }} />
      ) : (
        <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          Loading aerial imagery…
        </div>
      )}
      <div style={{ padding: '10px 20px', fontSize: 11, color: '#9ca3af' }}>
        Photorealistic 3D imagery orbiting the property — drag to look around manually, or use Play/Pause to control the flyover.
      </div>
    </div>
  );
}

