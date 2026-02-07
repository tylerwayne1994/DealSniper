// NEW Cactus-style wizard tab for property details
// Shows extracted fields with confidence, sources, and conflict resolution

import React, { useMemo } from 'react';
import { Building } from 'lucide-react';
import ExtractedFieldsTable from '../components/ExtractedFieldsTable';

export default function PropertyDetailsWizardTab({
  verifiedData,
  confidence = {},
  onViewSource,
  onSelectValue
}) {
  
  // Define fields to display with formatters
  const propertyFields = useMemo(() => [
    {
      key: 'property.address',
      path: 'property.address',
      label: 'Property Address',
      value: verifiedData?.property?.address,
      required: true,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.city',
      path: 'property.city',
      label: 'City',
      value: verifiedData?.property?.city,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.state',
      path: 'property.state',
      label: 'State',
      value: verifiedData?.property?.state,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.zip',
      path: 'property.zip',
      label: 'ZIP Code',
      value: verifiedData?.property?.zip,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.units',
      path: 'property.units',
      label: 'Total Units',
      value: verifiedData?.property?.units,
      required: true,
      formatter: (val) => val ? `${val} units` : '0 units'
    },
    {
      key: 'property.year_built',
      path: 'property.year_built',
      label: 'Year Built',
      value: verifiedData?.property?.year_built,
      formatter: (val) => val || 'Unknown'
    },
    {
      key: 'property.rba_sqft',
      path: 'property.rba_sqft',
      label: 'Total Square Feet',
      value: verifiedData?.property?.rba_sqft,
      formatter: (val) => val ? `${val.toLocaleString()} SF` : 'Not specified'
    },
    {
      key: 'property.property_type',
      path: 'property.property_type',
      label: 'Property Type',
      value: verifiedData?.property?.property_type,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.property_class',
      path: 'property.property_class',
      label: 'Property Class',
      value: verifiedData?.property?.property_class,
      formatter: (val) => val || 'Not specified'
    },
    {
      key: 'property.parking_spaces',
      path: 'property.parking_spaces',
      label: 'Parking Spaces',
      value: verifiedData?.property?.parking_spaces,
      formatter: (val) => val ? `${val} spaces` : 'Not specified'
    }
  ], [verifiedData]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 32
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Building size={24} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
            Property Information
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
            Review extracted property details and their confidence scores
          </p>
        </div>
      </div>

      <ExtractedFieldsTable
        fields={propertyFields}
        confidence={confidence}
        onViewSource={onViewSource}
        onSelectValue={onSelectValue}
      />

      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#eff6ff',
        borderRadius: 8,
        border: '1px solid #bfdbfe',
        fontSize: 13,
        color: '#1e40af'
      }}>
        <strong>Tip:</strong> Click "View Source" to see where each value was extracted from in the original document.
        If multiple values were found, click the conflict button to choose the correct one.
      </div>
    </div>
  );
}
