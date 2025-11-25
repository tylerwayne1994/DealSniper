import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UploadDealPage from './pages/UploadDealPage';
import PipelinePage from './pages/PipelinePage';
import DealDetailPage from './pages/DealDetailPage';
import DashboardPage from './pages/DashboardPage';
import DealWizardPage from './pages/DealWizardPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<UploadDealPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wizard" element={<DealWizardPage />} />
      </Routes>
    </Router>
  );
}

export default App;
