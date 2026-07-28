import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Uploadpage from './pages/Uploadpage';
import PipelinePage from './pages/PipelinePage';
import LOIPage from './pages/LOIPage';
import DealDetailPage from './pages/DealDetailPage';
import DashboardPage from './pages/DashboardPage';
import PaymentSuccessRedirect from './pages/PaymentSuccessRedirect';
import UnderwriteV2Page from './pages/UnderwriteV2Page.jsx'; // V2 Underwriter (explicit .jsx to avoid legacy .js)
import UnderwriteAnalysisPage from './pages/UnderwriteAnalysisPage'; // AI Analysis Page

import DueDiligencePage from './pages/DueDiligencePage'; // Due Diligence Checklist
import EmailDealsPage from './pages/EmailDealsPage'; // Email Deal Screener
import TemplatesPage from './pages/TemplatesPage'; // Deal Templates
import SignUpPage from './pages/SignUpPage'; // Sign Up
import SignupCompletePage from './pages/SignupCompletePage'; // Signup Complete
import LoginPage from './pages/LoginPage'; // Login
import ManualEntryPage from './pages/ManualEntryPage'; // Manual Entry
import PitchDeckPage from './pages/PitchDeckPage'; // Pitch Deck Generator
import MapView from './components/maps/Mapview'; // Mapbox Deal Map
import InvestorPortalPage from './pages/InvestorPortalPage'; // Investor Portal / LP Dashboard
import UpdatesPage from './pages/UpdatesPage'; // Updates Notification Center
import DealRoomPage from './pages/DealRoomPage'; // Deal Room
import InvestorGatewayPage from './pages/InvestorGatewayPage'; // Public investor access code entry
import InvestorPitchDeckView from './pages/InvestorPitchDeckView'; // Public read-only investor pitch deck

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapView />} />
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
        <Route path="/due-diligence" element={<DueDiligencePage />} /> {/* Due Diligence Checklist */}
        <Route path="/email-deals" element={<EmailDealsPage />} /> {/* Email Deal Screener */}
        <Route path="/templates" element={<TemplatesPage />} /> {/* Deal Templates */}
        <Route path="/investor-portal" element={<InvestorPortalPage />} /> {/* Investor Portal / LP Dashboard */}
        <Route path="/updates" element={<UpdatesPage />} /> {/* Updates Notification Center */}
          <Route path="/deal-room/:dealId" element={<DealRoomPage />} /> {/* Deal Room */}
          <Route path="/investor" element={<InvestorGatewayPage />} /> {/* Public investor access gateway */}
          <Route path="/investor/view/:code" element={<InvestorPitchDeckView />} /> {/* Public read-only pitch deck */}
      </Routes>
    </Router>
  );
}

export default App;
