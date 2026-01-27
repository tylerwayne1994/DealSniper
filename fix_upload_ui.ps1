# Redesign upload UI to match results-tabs styling
$file = "client\src\components\dashboard-tabs\MapTab.jsx"
$content = Get-Content $file -Raw

# Replace the old Upload section gradient card with clean white card design
$oldUploadCard = @'
              {/* Upload Spreadsheets - Purple Card */}
              <div style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                borderRadius: '12px',
                padding: '24px',
                color: 'white',
                boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)',
                marginBottom: '16px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700' }}>
                  📊 Upload Property Spreadsheets
                </h4>
                <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '16px' }}>
                  Upload CSV or Excel files with property data (max 2000 properties per file)
                </p>
'@

$newUploadCard = @'
              {/* Upload Spreadsheets - Clean White Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                overflow: 'hidden',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)',
                marginBottom: '16px'
              }}>
                {/* Header */}
                <div style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>📊</span>
                    Upload Property Spreadsheets
                  </h4>
                </div>
                
                {/* Content */}
                <div style={{ padding: '20px 24px' }}>
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  Upload CSV or Excel files with property data (max 2000 properties per file)
                </p>
'@

$content = $content -replace [regex]::Escape($oldUploadCard), $newUploadCard

# Fix the closing div for the upload card
$content = $content -replace `
  '(\s+onChange=\{handleUploadedSheetFile\}\s+style=\{\{[^}]+\}\}\s+/>\s+</div>)', `
  '$1`n                </div>'

# Update Rapid Fire card to match
$oldRapidCard = @'
              {/* Rapid Fire - Pink Card */}
              <div style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                borderRadius: '12px',
                padding: '24px',
                color: 'white',
                boxShadow: '0 10px 30px rgba(236, 72, 153, 0.3)'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700' }}>
                  ⚡ Rapid Fire Mode
                </h4>
                <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '16px' }}>
                  Add a list of addresses to analyze in bulk
                </p>
'@

$newRapidCard = @'
              {/* Rapid Fire - Clean White Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                overflow: 'hidden',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)'
              }}>
                {/* Header */}
                <div style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>⚡</span>
                    Rapid Fire Mode
                  </h4>
                </div>
                
                {/* Content */}
                <div style={{ padding: '20px 24px' }}>
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  Add a list of addresses to analyze in bulk
                </p>
'@

$content = $content -replace [regex]::Escape($oldRapidCard), $newRapidCard

# Add closing div for rapid fire card content
$content = $content -replace `
  '(\s+<\/button>\s+<\/div>\s+<\/div>\s+<\/div>\s+{/\* Upload Tab \*/}\s+<\/div>)', `
  '                </div>`n$1'

Write-Host "Updated upload UI styling" -ForegroundColor Green
Set-Content $file -Value $content -NoNewline
