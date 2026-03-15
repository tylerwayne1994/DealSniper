import React, { useMemo } from 'react';
import PropertySpreadsheet from './PropertySpreadsheet';
import { mapParsedDataToSpreadsheet } from '../utils/propertySpreadsheetMapper';

export default function ScenarioSheet({ scenarioData, calculations }) {
  const spreadsheetData = useMemo(() => {
    const mapped = mapParsedDataToSpreadsheet(scenarioData || {});
    const calcs = (calculations && (calculations.fullAnalysis || calculations)) || {};
    if (calcs?.year1 && mapped) {
      if (calcs.year1.noi > 0) {
        mapped.stabilizedNOI = calcs.year1.noi;
        mapped.proFormaNOI = calcs.year1.noi;
      }
    }
    return mapped;
  }, [scenarioData, calculations]);

  if (!spreadsheetData) return null;

  return <PropertySpreadsheet initialData={spreadsheetData} />;
}
