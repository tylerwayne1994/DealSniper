# Redesign preview modal with clean professional styling
$file = "client\src\components\dashboard-tabs\MapTab.jsx"
$content = Get-Content $file -Raw

# Update preview modal header styling
$oldModalHeader = @'
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                Property Preview
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                {sheetPreview.name} - {sheetPreview.properties.length} properties found
              </p>
            </div>
'@

$newModalHeader = @'
          {/* Modal Header */}
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)',
            borderBottom: '1px solid #e5e7eb',
            borderRadius: '16px 16px 0 0'
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Property Preview
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '500'
            }}>
              {sheetPreview.name} • {sheetPreview.properties.length} properties found
            </p>
          </div>

          {/* Select All Section */}
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
'@

$content = $content -replace [regex]::Escape($oldModalHeader), $newModalHeader

# Update table styling
$oldTableStyle = @'
          {/* Table */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <thead style={{
                position: 'sticky',
                top: 0,
                backgroundColor: '#f3f4f6',
                zIndex: 1
              }}>
'@

$newTableStyle = @'
          {/* Table */}
          <div style={{
            maxHeight: '450px',
            overflowY: 'auto',
            marginBottom: '20px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <thead style={{
                position: 'sticky',
                top: 0,
                backgroundColor: '#1e3a8a',
                zIndex: 1
              }}>
'@

$content = $content -replace [regex]::Escape($oldTableStyle), $newTableStyle

# Update table header cells
$oldHeaderCells = @'
                <tr>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db',
                    width: '50px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedProperties.length === sheetPreview.properties.length}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db'
                  }}>
                    Property Name
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db'
                  }}>
                    Address
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db'
                  }}>
                    Status
                  </th>
                </tr>
'@

$newHeaderCells = @'
                <tr>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: 'white',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #3b82f6',
                    width: '60px'
                  }}>
                    Select
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'white',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #3b82f6'
                  }}>
                    Property Name
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'white',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #3b82f6'
                  }}>
                    Address
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: 'white',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Status
                  </th>
                </tr>
'@

$content = $content -replace [regex]::Escape($oldHeaderCells), $newHeaderCells

# Update table row styling
$oldRowStyle = 'backgroundColor: idx % 2 === 0 \? ''#f9fafb'' : ''white'''
$newRowStyle = 'backgroundColor: idx % 2 === 0 ? ''#ffffff'' : ''#f9fafb'''
$content = $content -replace [regex]::Escape($oldRowStyle), $newRowStyle

# Update cell border styling
$content = $content -replace `
  "padding: '10px 16px',\s+borderBottom: '1px solid #e5e7eb'", `
  "padding: '10px 16px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #f3f4f6'"

Write-Host "Updated preview modal styling" -ForegroundColor Green
Set-Content $file -Value $content -NoNewline
