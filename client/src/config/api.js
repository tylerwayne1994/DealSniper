// API Configuration for DealSniper
// Automatically uses production or development API based on environment

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8010';

// Helper function for API requests
export const apiUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  authGoogle: `${API_BASE_URL}/auth/google`,
  authGoogleCallback: `${API_BASE_URL}/auth/google/callback`,
  
  // Tokens
  tokensCheck: `${API_BASE_URL}/api/tokens/check`,
  tokensBalance: `${API_BASE_URL}/api/tokens/balance`,
  createTokenCheckout: `${API_BASE_URL}/api/create-token-checkout`,
  creditTokens: `${API_BASE_URL}/api/credit-tokens`,
  
  // Deals V2
  dealUnderwrite: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/underwrite`,
  dealRentcast: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/rentcast`,
  dealCostseg: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/costseg`,
  dealPitchDeck: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/pitch-deck`,
  
  // Market Research
  marketResearchStatus: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/market_research/status`,
  marketResearchReports: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/market_research/reports`,
  marketResearchReport: (dealId, reportId) => `${API_BASE_URL}/v2/deals/${dealId}/market_research/report/${reportId}`,
  marketResearchRun: (dealId) => `${API_BASE_URL}/v2/deals/${dealId}/market_research/run`,
  marketResearchChat: `${API_BASE_URL}/api/market-research/chat`,
  marketDataSummary: `${API_BASE_URL}/api/market-data/summary`,
  
  // LOI
  generateLoi: `${API_BASE_URL}/v2/generate-loi`,
  
  // Email Deals
  emailDealsStatus: `${API_BASE_URL}/api/email-deals/status`,
  emailDealsList: (scoreFilter) => scoreFilter 
    ? `${API_BASE_URL}/api/email-deals/list?score_filter=${scoreFilter}`
    : `${API_BASE_URL}/api/email-deals/list`,
  emailDealsBuyBox: `${API_BASE_URL}/api/email-deals/buy-box`,
  emailDealsSync: `${API_BASE_URL}/api/email-deals/sync`,
  
  // Due Diligence
  dueDiligenceChat: `${API_BASE_URL}/api/due-diligence/chat`,
  
  // Spreadsheet
  spreadsheetTemplate: `${API_BASE_URL}/api/spreadsheet/get-template`,
  spreadsheetApi: `${API_BASE_URL}/api`,
  
  // Health
  health: `${API_BASE_URL}/health`,
};

export default API_BASE_URL;
