import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Uploadpage from './pages/Uploadpage';
import PipelinePage from './pages/PipelinePage';
import DealDetailPage from './pages/DealDetailPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<Uploadpage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/deals/:id" element={<DealDetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </Router>
  );
}

export default App;
