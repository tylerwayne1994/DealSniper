import React, { useState, Fragment } from 'react';
import { CheckCircle, AlertCircle, FileText, File } from 'lucide-react';

/**
 * ExtractedFieldsTable - Cactus-style document extraction display
 * Shows extracted fields with confidence scores, sources, and inline conflict resolution
 */
export default function ExtractedFieldsTable({ 
  fields = [],
  confidence = {},
  onViewSource,
  onSelectValue
}) {
  
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
    <div style={{ marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              FIELD NAME ↕
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              VALUE
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              SOURCE
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CONFIDENCE
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => {
            const fieldPath = field.path || field.key;
            const conf = confidence[fieldPath] || {};
            const level = conf.level || 'missing';
            const hasAlternatives = conf.alternatives && conf.alternatives.length > 0;
            // Conflicts are always expanded inline
            const expanded = hasAlternatives;
            
            return (
              <Fragment key={fieldPath}>
              <tr 
                style={{
                  background: '#fff',
                  cursor: level !== 'missing' ? 'pointer' : 'default',
                  transition: 'all 0.15s'
                }}
                onClick={() => level !== 'missing' && onViewSource && onViewSource(field, conf)}
                onMouseEnter={(e) => {
                  if (level !== 'missing') {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <td style={{ padding: '16px', borderLeft: '3px solid transparent' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    {field.label}
                  </div>
                </td>
                
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {level !== 'missing' && <CheckCircle size={16} color="#10b981" />}
                    <span style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>
                      {field.value !== null && field.value !== undefined && field.value !== '' 
                        ? field.formatter ? field.formatter(field.value) : field.value 
                        : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not found</span>
                      }
                    </span>
                  </div>
                </td>
                
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {conf.source ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <File size={12} color="#9ca3af" />
                          <span>{conf.source.split(' ')[0]}</span>
                        </div>
                      </>
                    ) : 'Unknown'}
                  </div>
                </td>
                
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 700,
                    color: level === 'high' ? '#10b981' : level === 'medium' ? '#f59e0b' : '#ef4444'
                  }}>
                    {level === 'high' && '↑'}
                    {getConfidencePercent(level)}%
                  </div>
                </td>
              </tr>
              
              {/* Inline conflict resolution like Cactus */}
              {hasAlternatives && expanded && (
                <tr>
                  <td colSpan="4" style={{ padding: '0 16px 16px 16px', background: '#fffbeb' }}>
                    <div style={{
                      padding: 16,
                      background: '#fff',
                      border: '2px solid #fcd34d',
                      borderRadius: 8
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 16,
                        color: '#92400e'
                      }}>
                        <AlertCircle size={16} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {conf.alternatives.length} conflicting values found - select the correct one
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Current value */}
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 16,
                          background: '#f9fafb',
                          border: '2px solid #e5e7eb',
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                        >
                          <input
                            type="radio"
                            name={fieldPath}
                            value={field.value}
                            defaultChecked
                            onChange={() => onSelectValue && onSelectValue(field, field.value)}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                              {field.formatter ? field.formatter(field.value) : field.value}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {conf.source || 'Primary source'}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                            {getConfidencePercent(level)}%
                          </div>
                        </label>
                        
                        {/* Alternative values */}
                        {conf.alternatives.map((alt, altIdx) => (
                          <label key={altIdx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 16,
                            background: '#fff',
                            border: '2px solid #e5e7eb',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                          >
                            <input
                              type="radio"
                              name={fieldPath}
                              value={alt}
                              onChange={() => onSelectValue && onSelectValue(field, alt)}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                                {field.formatter ? field.formatter(alt) : alt}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                Alternative source {altIdx + 1}
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                              {Math.max(50, getConfidencePercent(level) - (altIdx + 1) * 10)}%
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
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
