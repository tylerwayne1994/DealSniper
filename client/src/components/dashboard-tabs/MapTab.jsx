import React from 'react';
import { MapPin } from 'lucide-react';

function DashboardMapTab() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MapPin size={18} color="#0ea5e9" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Dashboard Map</h3>
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        This tab can render a dashboard-specific map view, independent from the Results page.
      </div>
      <div style={{ height: 360, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Map placeholder — plug in your preferred map component.
      </div>
    </div>
  );
}

export default DashboardMapTab;
