// NEW Cactus-style wizard tab for property details
// Shows extracted fields with confidence scores + unit mix breakdown

import React, { useMemo } from 'react';
import { Building, Plus, Trash2 } from 'lucide-react';
import ExtractedFieldsTable from '../ExtractedFieldsTable';

export default function PropertyDetailsWizardTab({
  verifiedData,
  confidence = {},
  onViewSource,
  onSelectValue,
  onEditValue,
  onUpdateUnitMix
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
        onEditValue={onEditValue}
      />

      {/* Unit Mix Breakdown */}
      {verifiedData?.unit_mix && verifiedData.unit_mix.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={18} /> Unit Mix Breakdown
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase' }}>Units</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase' }}>Sq Ft</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase' }}>Current Rent</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase' }}>Market Rent</th>
                  {onUpdateUnitMix && (
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: 12, textTransform: 'uppercase', width: 50 }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {verifiedData.unit_mix.map((unit, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>
                      {onUpdateUnitMix ? (
                        <input type="text" value={unit.type || ''} onChange={(e) => onUpdateUnitMix(idx, 'type', e.target.value)}
                          style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: 120 }} />
                      ) : (unit.type || '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151' }}>
                      {onUpdateUnitMix ? (
                        <input type="number" value={unit.units || ''} onChange={(e) => onUpdateUnitMix(idx, 'units', parseInt(e.target.value) || 0)}
                          style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: 70, textAlign: 'center' }} />
                      ) : (unit.units || 0)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151' }}>
                      {onUpdateUnitMix ? (
                        <input type="number" value={unit.unit_sf || ''} onChange={(e) => onUpdateUnitMix(idx, 'unit_sf', parseInt(e.target.value) || 0)}
                          style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: 80, textAlign: 'center' }} />
                      ) : (unit.unit_sf ? unit.unit_sf.toLocaleString() : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151' }}>
                      {onUpdateUnitMix ? (
                        <input type="number" value={unit.rent_current || ''} onChange={(e) => onUpdateUnitMix(idx, 'rent_current', parseFloat(e.target.value) || 0)}
                          style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: 90, textAlign: 'center' }} />
                      ) : (unit.rent_current ? `$${unit.rent_current.toLocaleString()}` : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151' }}>
                      {onUpdateUnitMix ? (
                        <input type="number" value={unit.rent_market || ''} onChange={(e) => onUpdateUnitMix(idx, 'rent_market', parseFloat(e.target.value) || 0)}
                          style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 14, width: 90, textAlign: 'center' }} />
                      ) : (unit.rent_market ? `$${unit.rent_market.toLocaleString()}` : '—')}
                    </td>
                    {onUpdateUnitMix && (
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button onClick={() => onUpdateUnitMix(idx, '_delete')}
                          style={{ padding: 4, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'flex' }}>
                          <Trash2 size={14} color="#dc2626" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827' }}>Total</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#111827' }}>
                    {verifiedData.unit_mix.reduce((s, u) => s + (u.units || 0), 0)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#6b7280' }}>—</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#111827' }}>
                    ${(() => {
                      const totalUnits = verifiedData.unit_mix.reduce((s, u) => s + (u.units || 0), 0);
                      const weightedRent = verifiedData.unit_mix.reduce((s, u) => s + ((u.rent_current || 0) * (u.units || 0)), 0);
                      return totalUnits > 0 ? Math.round(weightedRent / totalUnits).toLocaleString() : '0';
                    })()}
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>avg</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#111827' }}>
                    ${(() => {
                      const totalUnits = verifiedData.unit_mix.reduce((s, u) => s + (u.units || 0), 0);
                      const weightedRent = verifiedData.unit_mix.reduce((s, u) => s + ((u.rent_market || 0) * (u.units || 0)), 0);
                      return totalUnits > 0 ? Math.round(weightedRent / totalUnits).toLocaleString() : '0';
                    })()}
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>avg</span>
                  </td>
                  {onUpdateUnitMix && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
          {onUpdateUnitMix && (
            <button
              onClick={() => onUpdateUnitMix(-1, '_add')}
              style={{
                marginTop: 12, padding: '8px 16px', background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#2563eb'
              }}
            >
              <Plus size={14} /> Add Unit Type
            </button>
          )}
        </div>
      )}

      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#eff6ff',
        borderRadius: 8,
        border: '1px solid #bfdbfe',
        fontSize: 13,
        color: '#1e40af'
      }}>
        <strong>Tip:</strong> Click the pencil icon to edit any value. Click "View Source" to see where each value was extracted from in the original document.
        If multiple values were found, click the conflict button to choose the correct one.
      </div>
    </div>
  );
}
