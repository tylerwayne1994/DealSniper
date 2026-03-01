import React from 'react';
import DashboardShell from '../components/DashboardShell';
import { FileText } from 'lucide-react';

function TemplatesPage() {
  return (
    <DashboardShell activeTab="templates" title="Templates">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#6b7280' }}>
        <FileText size={48} style={{ marginBottom: 16, color: '#94a3b8' }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>Templates</h2>
        <p style={{ fontSize: 14 }}>Coming soon — manage your deal templates here.</p>
      </div>
    </DashboardShell>
  );
}

export default TemplatesPage;
