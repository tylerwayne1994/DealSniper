# Fix MapTab geocoding bug
$file = "client\src\components\dashboard-tabs\MapTab.jsx"
$content = Get-Content $file -Raw

# 1. Add new state variable for geocoding results (add after line with selectedProperties state)
$content = $content -replace `
  '(\[selectedProperties, setSelectedProperties\] = useState\(\[\]\);  // Track selected property indices)', `
  '$1`n  const [geocodingResults, setGeocodingResults] = useState({ results: [], failed: [] }); // Store geocoding results'

# 2. Fix the geocoding button handler
$oldButtonCode = @'
              <button
                onClick={async () => {
                  if (selectedProperties.length === 0) {
                    alert('Please select at least one property');
                    return;
                  }
                  const { results, failed } = await geocodeSheetProperties();
                  if (failed.length === 0) {
                    await saveUploadedProperties(results);
                  }
                }}
'@

$newButtonCode = @'
              <button
                onClick={async () => {
                  if (selectedProperties.length === 0) {
                    alert('Please select at least one property');
                    return;
                  }
                  const { results, failed } = await geocodeSheetProperties();
                  // Store results in state for potential retry
                  setGeocodingResults({ results, failed });
                  
                  // If some failed, show error modal; otherwise save immediately
                  if (failed.length > 0) {
                    // Error modal will be shown by geocodeSheetProperties setting showGeocodeErrors
                    // Do nothing here - let user decide via modal
                  } else if (results.length > 0) {
                    await saveUploadedProperties(results);
                  } else {
                    alert('No properties could be geocoded successfully.');
                  }
                }}
'@

$content = $content -replace [regex]::Escape($oldButtonCode), $newButtonCode

# 3. Fix handleProceedWithErrors function
$oldHandleFunc = @'
  const handleProceedWithErrors = async (proceed) => {
    setShowGeocodeErrors(false);

    if (!proceed) {
      // User cancelled
      setIsGeocoding(false);
      return;
    }

    // Get successful results from geocoding progress
    const successful = sheetPreview.properties.filter(p =>
      p.geocodeStatus === 'success' &&
      p.latitude && p.longitude
    );

    if (successful.length === 0) {
      alert('No properties could be geocoded successfully.');
      return;
    }

    await saveUploadedProperties(successful);
  };
'@

$newHandleFunc = @'
  const handleProceedWithErrors = async (proceed) => {
    setShowGeocodeErrors(false);

    if (!proceed) {
      // User cancelled - reset state
      setIsGeocoding(false);
      setGeocodingResults({ results: [], failed: [] });
      return;
    }

    // Get successful results from stored geocoding results
    const { results } = geocodingResults;

    if (results.length === 0) {
      alert('No properties could be geocoded successfully.');
      return;
    }

    await saveUploadedProperties(results);
    // Clear stored results after saving
    setGeocodingResults({ results: [], failed: [] });
  };
'@

$content = $content -replace [regex]::Escape($oldHandleFunc), $newHandleFunc

# Write the fixed content
Set-Content $file -Value $content -NoNewline

Write-Host "Fixed geocoding bug in MapTab.jsx" -ForegroundColor Green
