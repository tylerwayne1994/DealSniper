import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Listings from './pages/Listings';
import About from './pages/About';
import Contact from './pages/Contact';
import PropertyDetail from './pages/PropertyDetail';
import CreateListing from './pages/CreateListing';
import Dashboard from './pages/Dashboard';
import EditListing from './pages/EditListing';

function App() {
  return (
    <div className="App">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/create-listing" element={<CreateListing />} />
          <Route path="/edit-listing/:id" element={<EditListing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;