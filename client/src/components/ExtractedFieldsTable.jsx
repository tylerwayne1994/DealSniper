import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Eye, FileText, Info } from 'lucide-react';

/**
 * ExtractedFieldsTable - Cactus-style document extraction display
 * Shows extracted fields with confidence scores, sources, and conflicts
 */
export default function ExtractedFieldsTable({ 
  fields = [],
  confidence = {},
  onViewSource,
  onFieldChange,
  onResolveConflict
}) {
  
  const getConfidenceBadge = (level) => {
    const badges = {
      high: { bg: '#dcfce7', color: '#166534', text: 'High', icon: CheckCircle },
      medium: { bg: '#fef3c7', color: '#92400e', text: 'Medium', icon: AlertCircle },
      low: { bg: '#fee2e2', color: '#991b1b', text: 'Low', icon: AlertCircle },
      missing: { bg: '#f3f4f6', color: '#6b7280', text: 'Missing', icon: Info }
    };
    
    const badge = badges[level] || badges.missing;
    const Icon = badge.icon;
    
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: badge.bg,
        color: badge.color
      }}>
        <Icon size={14} />
        {badge.text}
      </span>
    );
  };
  
  const getConfidencePercent = (level) => {
    const percentMap = {
      high: 95,
      medium: 75,
      low: 50,
      missing: 0
    };
    return percentMap[level] || 0;
  };
  
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Field
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Value
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Confidence
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Source
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => {
            const fieldPath = field.path || field.key;
            const conf = confidence[fieldPath] || {};
            const level = conf.level || 'missing';
            const hasAlternatives = conf.alternatives && conf.alternatives.length > 0;
            
            return (
              <tr 
                key={fieldPath}
                style={{
                  borderBottom: idx < fields.length - 1 ? '1px solid #f3f4f6' : 'none',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {field.label}
                  </div>
                  {field.required && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>
                      * Required
                    </div>
                  )}
                </td>
                
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 14, color: '#111827', fontFamily: 'monospace' }}>
                    {field.value !== null && field.value !== undefined && field.value !== '' 
                      ? field.formatter ? field.formatter(field.value) : field.value 
                      : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not found</span>
                    }
                  </div>
                  {hasAlternatives && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => onResolveConflict && onResolveConflict(field, conf.alternatives)}
                        style={{
                          padding: '4px 8px',
                          background: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <AlertCircle size={12} />
                        {conf.alternatives.length} conflicts - click to resolve
                      </button>
                    </div>
                  )}
                </td>
                
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {getConfidenceBadge(level)}
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {getConfidencePercent(level)}%
                    </div>
                  </div>
                </td>
                
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {conf.source || 'Unknown'}
                  </div>
                  {conf.note && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
                      {conf.note}
                    </div>
                  )}
                </td>
                
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {level !== 'missing' && onViewSource && (
                    <button
                      onClick={() => onViewSource(field, conf)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dbeafe';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.borderColor = '#bfdbfe';
                      }}
                    >
                      <Eye size={14} />
                      View Source
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {fields.length === 0 && (
        <div style={{
          padding: 48,
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <FileText size={48} style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>No fields extracted yet</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>Upload a document to begin</div>
        </div>
      )}
    </div>
  );
}
