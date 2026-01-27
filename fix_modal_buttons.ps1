# Update modal buttons and final touches
$file = "client\src\components\dashboard-tabs\MapTab.jsx"
$content = Get-Content $file -Raw

# Update the actions buttons container
$oldActions = @'
            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSheetPreview(null);
                  setSelectedProperties([]);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
'@

$newActions = @'
            {/* Actions */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#f9fafb',
              borderTop: '2px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              borderRadius: '0 0 16px 16px'
            }}>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSheetPreview(null);
                  setSelectedProperties([]);
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#9ca3af';
                  e.target.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.color = '#6b7280';
                }}
              >
                ✕ Cancel
              </button>
'@

$content = $content -replace [regex]::Escape($oldActions), $newActions

# Update the geocode button text
$content = $content -replace `
  '\{isGeocoding \? `⏳ Geocoding\.\.\. \(\$\{geocodingProgress\.current\}/\$\{geocodingProgress\.total\}\)` : `🗺️ Geocode & Add \$\{selectedProperties\.length\} Properties`\}', `
  '{isGeocoding ? `⏳ Geocoding (${geocodingProgress.current}/${geocodingProgress.total})` : `✓ Geocode & Add to Map (${selectedProperties.length})`}'

# Update error modal styling
$oldErrorModal = @'
        {/* Geocoding Errors Modal */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              ⚠️ Geocoding Errors
            </h3>
'@

$newErrorModal = @'
        {/* Geocoding Errors Modal */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4)',
            border: '2px solid #fbbf24'
          }}>
            {/* Error Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderBottom: '1px solid #fbbf24'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                Geocoding Errors
              </h3>
            </div>
            
            <div style={{ padding: '24px' }}>
'@

$content = $content -replace [regex]::Escape($oldErrorModal), $newErrorModal

# Update error modal stats section
$oldErrorStats = @'
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              {geocodingProgress.failed.length} properties could not be geocoded.
              {geocodingProgress.total - geocodingProgress.failed.length} were successful.
            </p>
'@

$newErrorStats = @'
            <div style={{
              padding: '16px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #fbbf24'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Failed</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#b45309' }}>
                    {geocodingProgress.failed.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Successful</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#047857' }}>
                    {geocodingProgress.total - geocodingProgress.failed.length}
                  </div>
                </div>
              </div>
            </div>
'@

$content = $content -replace [regex]::Escape($oldErrorStats), $newErrorStats

# Update error modal action buttons
$oldErrorButtons = @'
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => handleProceedWithErrors(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                No, Go Back
              </button>
              <button
                onClick={() => handleProceedWithErrors(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                }}
              >
                Yes, Proceed
              </button>
            </div>
'@

$newErrorButtons = @'
            </div>
            
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#f9fafb',
              borderTop: '2px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => handleProceedWithErrors(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✕ Cancel
              </button>
              <button
                onClick={() => handleProceedWithErrors(true)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#0d9488',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.3)'
                }}
              >
                ✓ Save Successful Properties
              </button>
            </div>
'@

$content = $content -replace [regex]::Escape($oldErrorButtons), $newErrorButtons

Write-Host "Updated modal buttons and error modal styling" -ForegroundColor Green
Set-Content $file -Value $content -NoNewline
