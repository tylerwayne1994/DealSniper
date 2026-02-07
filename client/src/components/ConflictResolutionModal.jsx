import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

/**
 * ConflictResolutionModal - Allows user to pick correct value when multiple found
 * Shows all alternatives and lets user select the right one
 */
export default function ConflictResolutionModal({
  isOpen,
  onClose,
  field,
  alternatives = [],
  currentValue,
  onSelectValue
}) {
  const [selectedValue, setSelectedValue] = useState(currentValue);
  const [customValue, setCustomValue] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  
  if (!isOpen) return null;
  
  const handleConfirm = () => {
    const finalValue = useCustom ? customValue : selectedValue;
    onSelectValue(field, finalValue);
    onClose();
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 600,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={22} color="#d97706" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
              Resolve Value Conflict
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0 0' }}>
              Multiple values found for: <strong>{field?.label}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#9ca3af'
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 24
        }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            The parser found multiple possible values for this field. Please select the correct one:
          </p>
          
          {/* Current value */}
          {currentValue && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                CURRENTLY SELECTED:
              </label>
              <div
                onClick={() => { setSelectedValue(currentValue); setUseCustom(false); }}
                style={{
                  padding: 16,
                  border: `2px solid ${selectedValue === currentValue && !useCustom ? '#10b981' : '#d1d5db'}`,
                  borderRadius: 10,
                  background: selectedValue === currentValue && !useCustom ? '#dcfce7' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <input
                  type="radio"
                  checked={selectedValue === currentValue && !useCustom}
                  onChange={() => { setSelectedValue(currentValue); setUseCustom(false); }}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>
                    {field?.formatter ? field.formatter(currentValue) : currentValue}
                  </div>
                </div>
                {selectedValue === currentValue && !useCustom && (
                  <CheckCircle size={20} color="#10b981" />
                )}
              </div>
            </div>
          )}
          
          {/* Alternatives */}
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
            OTHER VALUES FOUND:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {alternatives.map((alt, idx) => (
              <div
                key={idx}
                onClick={() => { setSelectedValue(alt); setUseCustom(false); }}
                style={{
                  padding: 16,
                  border: `2px solid ${selectedValue === alt && !useCustom ? '#10b981' : '#d1d5db'}`,
                  borderRadius: 10,
                  background: selectedValue === alt && !useCustom ? '#dcfce7' : '#f9fafb',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
                onMouseEnter={(e) => {
                  if (selectedValue !== alt || useCustom) {
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedValue !== alt || useCustom) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }
                }}
              >
                <input
                  type="radio"
                  checked={selectedValue === alt && !useCustom}
                  onChange={() => { setSelectedValue(alt); setUseCustom(false); }}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>
                    {field?.formatter ? field.formatter(alt) : alt}
                  </div>
                </div>
                {selectedValue === alt && !useCustom && (
                  <CheckCircle size={20} color="#10b981" />
                )}
              </div>
            ))}
          </div>
          
          {/* Custom value */}
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
            OR ENTER CUSTOM VALUE:
          </label>
          <div
            style={{
              padding: 16,
              border: `2px solid ${useCustom ? '#10b981' : '#d1d5db'}`,
              borderRadius: 10,
              background: useCustom ? '#dcfce7' : '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={customValue}
                onChange={(e) => { setCustomValue(e.target.value); setUseCustom(true); }}
                onFocus={() => setUseCustom(true)}
                placeholder="Enter custom value..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 15,
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          background: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!useCustom && !selectedValue}
            style={{
              padding: '10px 24px',
              background: selectedValue || (useCustom && customValue) ? 
                'linear-gradient(135deg, #10b981, #059669)' : '#d1d5db',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: selectedValue || (useCustom && customValue) ? 'pointer' : 'not-allowed',
              boxShadow: selectedValue || (useCustom && customValue) ? 
                '0 4px 6px rgba(16, 185, 129, 0.3)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
