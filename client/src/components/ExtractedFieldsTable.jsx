import React, { useState, Fragment } from 'react';
import { CheckCircle, AlertCircle, FileText, File, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ExtractedFieldsTable - Cactus-style document extraction display
 * Shows extracted fields with confidence scores, inline editing, and expandable value selection
 */
export default function ExtractedFieldsTable({ 
  fields = [],
  confidence = {},
  onViewSource,
  onSelectValue,
  onEditValue
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedField, setExpandedField] = useState(null);
  
  const getConfidencePercent = (level) => {
    const percentMap = {
      high: 95,
      medium: 75,
      low: 50,
      missing: 0
    };
    return percentMap[level] || 0;
  };

  const startEditing = (field, e) => {
    e.stopPropagation();
    setEditingField(field.path || field.key);
    setEditValue(field.value !== null && field.value !== undefined ? String(field.value) : '');
  };

  const confirmEdit = (field, e) => {
    e.stopPropagation();
    if (onEditValue) {
      let val = editValue;
      if (val !== '' && !isNaN(val)) {
        val = parseFloat(val);
      }
      onEditValue(field, val);
    }
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingField(null);
    setEditValue('');
  };

  const toggleExpanded = (fieldPath, e) => {
    e.stopPropagation();
    setExpandedField(prev => prev === fieldPath ? null : fieldPath);
  };

  const handleSelectAlternative = (field, value, e) => {
    if (e) e.stopPropagation();
    if (onSelectValue) {
      onSelectValue(field, value);
    }
    setExpandedField(null);
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
            const isExpanded = expandedField === fieldPath;
            
            return (
              <Fragment key={fieldPath}>
              <tr 
                style={{
                  background: hasAlternatives ? '#fffbeb' : '#fff',
                  cursor: level !== 'missing' ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  borderLeft: hasAlternatives ? '3px solid #f59e0b' : '3px solid transparent'
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
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    {field.label}
                    {field.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                  </div>
                </td>
                
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {editingField === fieldPath ? (
                      <>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit(field, e);
                            if (e.key === 'Escape') cancelEdit(e);
                          }}
                          autoFocus
                          style={{
                            padding: '6px 10px',
                            border: '2px solid #3b82f6',
                            borderRadius: 6,
                            fontSize: 14,
                            fontWeight: 500,
                            outline: 'none',
                            width: 160,
                            background: '#eff6ff'
                          }}
                        />
                        <button
                          onClick={(e) => confirmEdit(field, e)}
                          style={{ padding: 4, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', display: 'flex' }}
                        >
                          <Check size={14} color="#16a34a" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: 4, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={14} color="#dc2626" />
                        </button>
                      </>
                    ) : (
                      <>
                        {level !== 'missing' && <CheckCircle size={16} color="#10b981" />}
                        <span style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>
                          {field.value !== null && field.value !== undefined && field.value !== '' 
                            ? field.formatter ? field.formatter(field.value) : field.value 
                            : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not found</span>
                          }
                        </span>
                        
                        {/* Edit button */}
                        {onEditValue && (
                          <button
                            onClick={(e) => startEditing(field, e)}
                            title="Edit value"
                            style={{
                              padding: 4,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              opacity: 0.6,
                              transition: 'opacity 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          >
                            <Pencil size={12} color="#6b7280" />
                          </button>
                        )}
                        
                        {/* Alternatives toggle button */}
                        {hasAlternatives && (
                          <button
                            onClick={(e) => toggleExpanded(fieldPath, e)}
                            title={`${conf.alternatives.length} alternative value${conf.alternatives.length > 1 ? 's' : ''} found — click to choose`}
                            style={{
                              padding: '3px 8px',
                              background: isExpanded ? '#fef3c7' : '#fff7ed',
                              border: '1px solid #f59e0b',
                              borderRadius: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#b45309',
                              transition: 'all 0.15s'
                            }}
                          >
                            <AlertCircle size={12} />
                            {conf.alternatives.length} option{conf.alternatives.length > 1 ? 's' : ''}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
                
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {conf.source ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <File size={12} color="#9ca3af" />
                        <span>{conf.source}</span>
                      </div>
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
              
              {/* Expanded value selection panel */}
              {hasAlternatives && isExpanded && (
                <tr>
                  <td colSpan="4" style={{ padding: '0 16px 16px 16px' }}>
                    <div style={{
                      padding: 16,
                      background: '#fff',
                      border: '2px solid #fcd34d',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(251, 191, 36, 0.15)'
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
                          Multiple values found — select the correct one
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Current value option */}
                        <div
                          onClick={(e) => handleSelectAlternative(field, field.value, e)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            background: '#dcfce7',
                            border: '2px solid #86efac',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="#fff" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                              {field.formatter ? field.formatter(field.value) : field.value}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {conf.source || 'Primary source'} — <strong style={{ color: '#059669' }}>Currently selected</strong>
                            </div>
                          </div>
                        </div>
                        
                        {/* Alternative value options */}
                        {conf.alternatives.map((alt, altIdx) => (
                          <div
                            key={altIdx}
                            onClick={(e) => handleSelectAlternative(field, alt, e)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 16px',
                              background: '#fff',
                              border: '2px solid #e5e7eb',
                              borderRadius: 8,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
                          >
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #d1d5db', background: '#fff' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
                                {field.formatter ? field.formatter(alt) : alt}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                Alternative value {altIdx + 1} — Click to use this value
                              </div>
                            </div>
                            <div style={{ 
                              fontSize: 12, fontWeight: 600, color: '#3b82f6',
                              padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6
                            }}>
                              Select
                            </div>
                          </div>
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
