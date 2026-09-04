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
import BackOfTheNapkinPage from './pages/BackOfTheNapkinPage.jsx'; // Standalone CRE Agent Skills chat underwrite
import UnderwriteAnalysisPage from './pages/UnderwriteAnalysisPage'; // AI Analysis Page

import DueDiligencePage from './pages/DueDiligencePage'; // Due Diligence Checklist
import EmailDealsPage from './pages/EmailDealsPage'; // Email Deal Screener
import TemplatesPage from './pages/TemplatesPage'; // Deal Templates
import SignUpPage from './pages/SignUpPage'; // Sign Up
import SignupCompletePage from './pages/SignupCompletePage'; // Signup Complete
import LoginPage from './pages/LoginPage'; // Login
import AuthCallbackPage from './pages/AuthCallbackPage'; // Google/OAuth callback + subscription gate
import SetPasswordPage from './pages/SetPasswordPage'; // Recovery-link landing: set password for server-provisioned accounts
import RequireSubscription from './components/RequireSubscription'; // Paid-access route guard
import ManualEntryPage from './pages/ManualEntryPage'; // Manual Entry
import PitchDeckPage from './pages/PitchDeckPage'; // Pitch Deck Generator
import MapView from './components/maps/Mapview'; // Mapbox Deal Map
import InvestorPortalPage from './pages/InvestorPortalPage'; // Investor Portal / LP Dashboard
import UpdatesPage from './pages/UpdatesPage'; // Updates Notification Center
import DealRoomPage from './pages/DealRoomPage'; // Deal Room
import InvestorGatewayPage from './pages/InvestorGatewayPage'; // Public investor access code entry
import InvestorPitchDeckView from './pages/InvestorPitchDeckView'; // Public read-only investor pitch deck
import ClaudeUnderwritePage from './pages/ClaudeUnderwritePage.jsx'; // AI chat-based Business Plan / investment memo generator

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes — landing, auth/payment flow, and investor share links */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signup-complete" element={<SignupCompletePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/payment-success" element={<PaymentSuccessRedirect />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/investor" element={<InvestorGatewayPage />} /> {/* Public investor access gateway */}
        <Route path="/investor/view/:code" element={<InvestorPitchDeckView />} /> {/* Public read-only pitch deck */}

        {/* App routes — require an auth session AND a real paid subscription
            (stripe_customer_id on the profile); unpaid accounts are bounced
            into Stripe Checkout via /auth/callback. See RequireSubscription. */}
        <Route path="/map" element={<RequireSubscription><MapView /></RequireSubscription>} />
        <Route path="/manual-entry" element={<RequireSubscription><ManualEntryPage /></RequireSubscription>} />
        <Route path="/pitch-deck" element={<RequireSubscription><PitchDeckPage /></RequireSubscription>} />
        <Route path="/upload" element={<RequireSubscription><Uploadpage /></RequireSubscription>} />
        <Route path="/pipeline" element={<RequireSubscription><PipelinePage /></RequireSubscription>} />
        <Route path="/loi" element={<RequireSubscription><LOIPage /></RequireSubscription>} />
        <Route path="/deals/:id" element={<RequireSubscription><DealDetailPage /></RequireSubscription>} />
        <Route path="/dashboard" element={<RequireSubscription><DashboardPage /></RequireSubscription>} />
        <Route path="/underwrite" element={<RequireSubscription><UnderwriteV2Page /></RequireSubscription>} /> {/* V2 Underwriter */}
        <Route path="/napkin" element={<RequireSubscription><BackOfTheNapkinPage /></RequireSubscription>} /> {/* Back of the Napkin — CRE Agent Skills chat underwrite */}
        <Route path="/underwrite/analysis" element={<RequireSubscription><UnderwriteAnalysisPage /></RequireSubscription>} /> {/* AI Analysis */}
        <Route path="/due-diligence" element={<RequireSubscription><DueDiligencePage /></RequireSubscription>} /> {/* Due Diligence Checklist */}
        <Route path="/email-deals" element={<RequireSubscription><EmailDealsPage /></RequireSubscription>} /> {/* Email Deal Screener */}
        <Route path="/templates" element={<RequireSubscription><TemplatesPage /></RequireSubscription>} /> {/* Deal Templates */}
        <Route path="/investor-portal" element={<RequireSubscription><InvestorPortalPage /></RequireSubscription>} /> {/* Investor Portal / LP Dashboard */}
        <Route path="/updates" element={<RequireSubscription><UpdatesPage /></RequireSubscription>} /> {/* Updates Notification Center */}
        <Route path="/deal-room/:dealId" element={<RequireSubscription><DealRoomPage /></RequireSubscription>} /> {/* Deal Room (owner view) */}
        <Route path="/business-plan" element={<RequireSubscription><ClaudeUnderwritePage /></RequireSubscription>} /> {/* AI Business Plan generator (chat + artifact canvas) */}
      </Routes>
    </Router>
  );
}

export default App;
