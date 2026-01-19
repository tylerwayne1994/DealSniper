import React from 'react';
import { MapPin } from 'lucide-react';

function ResultsMapTab({ scenarioData }) {
  const property = scenarioData?.property || {};
  const address = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MapPin size={18} color="#0ea5e9" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Property Map</h3>
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {address ? `Location: ${address}` : 'No address set yet.'}
      </div>
      <div style={{ height: 360, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Results Map placeholder — embed map for this specific property.
      </div>
    </div>
  );
}

export default ResultsMapTab;
