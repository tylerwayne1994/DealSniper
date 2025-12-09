import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Uploadpage from './pages/Uploadpage';
import PipelinePage from './pages/PipelinePage';
import LOIPage from './pages/LOIPage';
import DealDetailPage from './pages/DealDetailPage';
import DashboardPage from './pages/DashboardPage';
import UnderwriteV2Page from './pages/UnderwriteV2Page'; // V2 Underwriter
import UnderwriteAnalysisPage from './pages/UnderwriteAnalysisPage'; // AI Analysis Page
import MarketResearchPage from './pages/MarketResearchPage'; // Market Discovery AI

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<Uploadpage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/loi" element={<LOIPage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/underwrite" element={<UnderwriteV2Page />} /> {/* V2 Underwriter */}
        <Route path="/underwrite/analysis" element={<UnderwriteAnalysisPage />} /> {/* AI Analysis */}
        <Route path="/market-research" element={<MarketResearchPage />} /> {/* Market Discovery */}
      </Routes>
    </Router>
  );
}

export default App;
