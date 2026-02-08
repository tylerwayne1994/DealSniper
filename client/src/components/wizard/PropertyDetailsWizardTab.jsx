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

      {/* Unit Mix & Scheduled Income */}
      {verifiedData?.unit_mix && verifiedData.unit_mix.length > 0 && (() => {
        const mix = verifiedData.unit_mix;
        const totalUnits = mix.reduce((s, u) => s + (u.units || 0), 0);
        const totalSF = mix.reduce((s, u) => s + ((u.unit_sf || 0) * (u.units || 0)), 0);
        const totalCurrentMonthly = mix.reduce((s, u) => s + (u.total_current_monthly || (u.rent_current || 0) * (u.units || 0)), 0);
        const totalMarketMonthly = mix.reduce((s, u) => s + (u.total_market_monthly || (u.rent_market || 0) * (u.units || 0)), 0);
        const avgSF = totalUnits > 0 ? Math.round(totalSF / totalUnits) : 0;
        const avgCurrentRent = totalUnits > 0 ? Math.round(totalCurrentMonthly / totalUnits) : 0;
        const avgMarketRent = totalUnits > 0 ? Math.round(totalMarketMonthly / totalUnits) : 0;

        const th = { padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' };
        const td = { padding: '8px 10px', textAlign: 'center', color: '#374151', fontSize: 13, borderBottom: '1px solid #f3f4f6' };
        const inputStyle = { padding: '3px 6px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, textAlign: 'center', background: '#fff' };
        const canEdit = !!onUpdateUnitMix;

        const renderCell = (unit, idx, field, width, prefix = '', suffix = '') => {
          const val = unit[field];
          if (canEdit) {
            return (
              <input
                type={field === 'type' ? 'text' : 'number'}
                step={field.includes('psf') || field === 'mix_pct' ? '0.01' : '1'}
                value={val || ''}
                onChange={(e) => {
                  const v = field === 'type' ? e.target.value : parseFloat(e.target.value) || 0;
                  onUpdateUnitMix(idx, field, v);
                }}
                style={{ ...inputStyle, width, textAlign: field === 'type' ? 'left' : 'center' }}
              />
            );
          }
          if (val === null || val === undefined || val === 0 || val === '') return '—';
          return `${prefix}${typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}${suffix}`;
        };

        return (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building size={18} /> Unit Mix & Scheduled Income
            </h3>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ ...th, textAlign: 'left', minWidth: 100 }}>Type</th>
                    <th style={{ ...th, minWidth: 55 }}>Units</th>
                    <th style={{ ...th, minWidth: 55 }}>Mix %</th>
                    <th style={{ ...th, minWidth: 65 }}>Unit SF</th>
                    <th style={{ ...th, minWidth: 85 }}>Avg Rent</th>
                    <th style={{ ...th, minWidth: 70 }}>Rent/SF</th>
                    <th style={{ ...th, minWidth: 85 }}>Mkt Rent</th>
                    <th style={{ ...th, minWidth: 70 }}>Mkt/SF</th>
                    <th style={{ ...th, minWidth: 75 }}>Max Rent</th>
                    <th style={{ ...th, minWidth: 100 }}>Total Current</th>
                    <th style={{ ...th, minWidth: 100 }}>Total Market</th>
                    {canEdit && <th style={{ ...th, width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {mix.map((unit, idx) => {
                    const computedCurrentTotal = (unit.rent_current || 0) * (unit.units || 0);
                    const computedMarketTotal = (unit.rent_market || 0) * (unit.units || 0);
                    const computedMixPct = totalUnits > 0 ? ((unit.units || 0) / totalUnits * 100) : 0;
                    const computedRentPSF = unit.unit_sf > 0 ? (unit.rent_current / unit.unit_sf) : 0;
                    const computedMktPSF = unit.unit_sf > 0 ? (unit.rent_market / unit.unit_sf) : 0;

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9fafb'}
                      >
                        <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: '#111827' }}>
                          {renderCell(unit, idx, 'type', 110)}
                        </td>
                        <td style={td}>{renderCell(unit, idx, 'units', 50)}</td>
                        <td style={td}>
                          {canEdit ? renderCell(unit, idx, 'mix_pct', 50, '', '%')
                            : unit.mix_pct ? `${unit.mix_pct}%` : computedMixPct > 0 ? `${computedMixPct.toFixed(0)}%` : '—'}
                        </td>
                        <td style={td}>{renderCell(unit, idx, 'unit_sf', 60)}</td>
                        <td style={td}>{renderCell(unit, idx, 'rent_current', 70, '$')}</td>
                        <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>
                          {canEdit ? renderCell(unit, idx, 'rent_psf', 55, '$')
                            : unit.rent_psf ? `$${unit.rent_psf.toFixed(2)}` : computedRentPSF > 0 ? `$${computedRentPSF.toFixed(2)}` : '—'}
                        </td>
                        <td style={td}>{renderCell(unit, idx, 'rent_market', 70, '$')}</td>
                        <td style={{ ...td, color: '#6b7280', fontSize: 12 }}>
                          {canEdit ? renderCell(unit, idx, 'rent_market_psf', 55, '$')
                            : unit.rent_market_psf ? `$${unit.rent_market_psf.toFixed(2)}` : computedMktPSF > 0 ? `$${computedMktPSF.toFixed(2)}` : '—'}
                        </td>
                        <td style={td}>{renderCell(unit, idx, 'rent_max', 70, '$')}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {canEdit ? renderCell(unit, idx, 'total_current_monthly', 80, '$')
                            : `$${(unit.total_current_monthly || computedCurrentTotal).toLocaleString()}`}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {canEdit ? renderCell(unit, idx, 'total_market_monthly', 80, '$')
                            : `$${(unit.total_market_monthly || computedMarketTotal).toLocaleString()}`}
                        </td>
                        {canEdit && (
                          <td style={td}>
                            <button onClick={() => onUpdateUnitMix(idx, '_delete')}
                              style={{ padding: 3, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'flex' }}>
                              <Trash2 size={12} color="#dc2626" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* Averages row */}
                  <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f1f5f9' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Averages</td>
                    <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }}>—</td>
                    <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }}>—</td>
                    <td style={{ ...td, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{avgSF.toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>${avgCurrentRent.toLocaleString()}</td>
                    <td style={{ ...td, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e2e8f0' }}>
                      {avgSF > 0 ? `$${(avgCurrentRent / avgSF).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ ...td, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>${avgMarketRent.toLocaleString()}</td>
                    <td style={{ ...td, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e2e8f0' }}>
                      {avgSF > 0 ? `$${(avgMarketRent / avgSF).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }}>—</td>
                    <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }}>—</td>
                    <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }}>—</td>
                    {canEdit && <td style={{ ...td, borderBottom: '1px solid #e2e8f0' }} />}
                  </tr>
                  {/* Totals row */}
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 800, color: '#111827', borderBottom: 'none' }}>Totals</td>
                    <td style={{ ...td, fontWeight: 800, color: '#111827', borderBottom: 'none' }}>{totalUnits}</td>
                    <td style={{ ...td, color: '#6b7280', borderBottom: 'none' }}>100%</td>
                    <td style={{ ...td, fontWeight: 600, color: '#111827', borderBottom: 'none' }}>{totalSF.toLocaleString()}</td>
                    <td style={{ ...td, color: '#9ca3af', borderBottom: 'none' }}>—</td>
                    <td style={{ ...td, color: '#9ca3af', borderBottom: 'none' }}>—</td>
                    <td style={{ ...td, color: '#9ca3af', borderBottom: 'none' }}>—</td>
                    <td style={{ ...td, color: '#9ca3af', borderBottom: 'none' }}>—</td>
                    <td style={{ ...td, color: '#9ca3af', borderBottom: 'none' }}>—</td>
                    <td style={{ ...td, fontWeight: 800, color: '#059669', borderBottom: 'none', fontSize: 14 }}>${totalCurrentMonthly.toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 800, color: '#059669', borderBottom: 'none', fontSize: 14 }}>${totalMarketMonthly.toLocaleString()}</td>
                    {canEdit && <td style={{ ...td, borderBottom: 'none' }} />}
                  </tr>
                  {/* Annual row */}
                  <tr style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                    <td colSpan={9} style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#6b7280', borderBottom: 'none', fontSize: 12 }}>Annual Income:</td>
                    <td style={{ ...td, fontWeight: 800, color: '#047857', borderBottom: 'none', fontSize: 14 }}>${(totalCurrentMonthly * 12).toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 800, color: '#047857', borderBottom: 'none', fontSize: 14 }}>${(totalMarketMonthly * 12).toLocaleString()}</td>
                    {canEdit && <td style={{ ...td, borderBottom: 'none' }} />}
                  </tr>
                </tfoot>
              </table>
            </div>
            {canEdit && (
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
        );
      })()}

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
