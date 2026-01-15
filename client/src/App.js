import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Uploadpage from './pages/Uploadpage';
import PipelinePage from './pages/PipelinePage';
import LOIPage from './pages/LOIPage';
import DealDetailPage from './pages/DealDetailPage';
import DashboardPage from './pages/DashboardPage';
import PaymentSuccessRedirect from './pages/PaymentSuccessRedirect';
import UnderwriteV2Page from './pages/UnderwriteV2Page'; // V2 Underwriter
import UnderwriteAnalysisPage from './pages/UnderwriteAnalysisPage'; // AI Analysis Page
import MaxAIUnderwritePage from './pages/MaxAIUnderwritePage'; // MAX AI Underwriting
import MarketResearchPage from './pages/MarketResearchPage'; // Market Discovery AI
import DueDiligencePage from './pages/DueDiligencePage'; // Due Diligence Checklist
import EmailDealsPage from './pages/EmailDealsPage'; // Email Deal Screener
import SignUpPage from './pages/SignUpPage'; // Sign Up
import SignupCompletePage from './pages/SignupCompletePage'; // Signup Complete
import LoginPage from './pages/LoginPage'; // Login
import ManualEntryPage from './pages/ManualEntryPage'; // Manual Entry
import PitchDeckPage from './pages/PitchDeckPage'; // Pitch Deck Generator
import MapViewPage from './pages/MapViewPage'; // Map View

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapViewPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signup-complete" element={<SignupCompletePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/manual-entry" element={<ManualEntryPage />} />
        <Route path="/pitch-deck" element={<PitchDeckPage />} />
        <Route path="/upload" element={<Uploadpage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/loi" element={<LOIPage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/payment-success" element={<PaymentSuccessRedirect />} />
        <Route path="/underwrite" element={<UnderwriteV2Page />} /> {/* V2 Underwriter */}
        <Route path="/underwrite/analysis" element={<UnderwriteAnalysisPage />} /> {/* AI Analysis */}
        <Route path="/underwrite/max" element={<MaxAIUnderwritePage />} /> {/* MAX AI Underwriting */}
        <Route path="/market-research" element={<MarketResearchPage />} /> {/* Market Discovery */}
        <Route path="/due-diligence" element={<DueDiligencePage />} /> {/* Due Diligence Checklist */}
        <Route path="/email-deals" element={<EmailDealsPage />} /> {/* Email Deal Screener */}
      </Routes>
    </Router>
  );
}

export default App;
