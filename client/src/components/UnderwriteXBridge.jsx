/* Bridge component to integrate UnderwriteX with ResultsPageV2 handlers */
import React from 'react';
import UnderwriteX from './results-tabs/underwritex';

/**
 * Wraps UnderwriteX and adapts deal data from ResultsPageV2
 */
const UnderwriteXBridge = ({ 
  scenarioData, 
  dealId, 
  property,
  pdfData,
  pdfUrl,
  onExportPDF,
  onExportToSheets,
  onExportToExcel,
  onGeneratePitchDeck,
  onGenerateBusinessPlan,
  onPushToPipeline,
  isSheetsExporting,
  isExcelExporting,
  isExportingPDF,
  isPushingToPipeline,
  sheetsExportStatus,
  isInPipeline,
  pipelineSuccess,
  onGoHome,
  marketData,
  marketDataLoading,
  onRefetchMarketData,
}) => {
  // UnderwriteX's tabs are still self-contained (internal mock CFG), but
  // scenarioData/dealId are passed through so the Parsed Data view and
  // additional-document upload can work with the deal's real parsed JSON.
  // Skip upload phase since we're viewing an existing deal.
  // The header action buttons (PDF/Sheets/Excel/Pitch Deck/Pipeline/New Deal)
  // now live inside UnderwriteX's own top bar, so their handlers/state are
  // forwarded straight through.

  return (
    <UnderwriteX
      skipUploadPhase={true}
      scenarioData={scenarioData}
      dealId={dealId}
      pdfData={pdfData}
      pdfUrl={pdfUrl}
      onExportPDF={onExportPDF}
      onExportToSheets={onExportToSheets}
      onExportToExcel={onExportToExcel}
      onGeneratePitchDeck={onGeneratePitchDeck}
      onGenerateBusinessPlan={onGenerateBusinessPlan}
      onPushToPipeline={onPushToPipeline}
      isSheetsExporting={isSheetsExporting}
      isExcelExporting={isExcelExporting}
      isExportingPDF={isExportingPDF}
      isPushingToPipeline={isPushingToPipeline}
      sheetsExportStatus={sheetsExportStatus}
      isInPipeline={isInPipeline}
      pipelineSuccess={pipelineSuccess}
      onGoHome={onGoHome}
      marketData={marketData}
      marketDataLoading={marketDataLoading}
      onRefetchMarketData={onRefetchMarketData}
    />
  );
};

export default UnderwriteXBridge;
