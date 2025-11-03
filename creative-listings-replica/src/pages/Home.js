import React, { useState } from 'react';
import styled from 'styled-components';
import SearchBar from '../components/SearchBar';
import PropertyMap from '../components/PropertyMap';

const HeroSection = styled.section`
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  color: #1e293b;
  padding: 8rem 2rem 6rem;
  text-align: center;
  margin-top: 70px;
`;

const HeroTitle = styled.h1`
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const HeroSubtitle = styled.p`
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
`;

const MapSection = styled.section`
  padding: 2rem 0 4rem;
`;

const StatsSection = styled.section`
  background: #f8fafc;
  padding: 4rem 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  text-align: center;
`;

const StatCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const StatNumber = styled.div`
  font-size: 3rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  color: #64748b;
  font-weight: 500;
`;

const Home = () => {
  const [mapFilters, setMapFilters] = useState({});

  const handleSearch = (filters) => {
    // Pass filters to the map component to filter markers
    setMapFilters(filters);
  };

  return (
    <div>
      <HeroSection>
        <Container>
          <HeroTitle>Find Your Dream Property</HeroTitle>
          <HeroSubtitle>
            Discover investment opportunities with our interactive map and advanced filters
          </HeroSubtitle>
        </Container>
        <SearchBar onSearch={handleSearch} />
      </HeroSection>

      <MapSection>
        <Container>
          <h2 className="section-title">Explore Properties on the Map</h2>
          <p className="section-subtitle">
            Use the filters above to narrow down properties by deal type and category
          </p>
          <PropertyMap filters={mapFilters} />
        </Container>
      </MapSection>

      <StatsSection>
        <Container>
          <h2 className="section-title">Why Choose eQUITY NEST</h2>
          <StatsGrid>
            <StatCard>
              <StatNumber>1000+</StatNumber>
              <StatLabel>Properties Listed</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>500+</StatNumber>
              <StatLabel>Happy Clients</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>15+</StatNumber>
              <StatLabel>Years Experience</StatLabel>
            </StatCard>
            <StatCard>
              <StatNumber>24/7</StatNumber>
              <StatLabel>Customer Support</StatLabel>
            </StatCard>
          </StatsGrid>
        </Container>
      </StatsSection>
    </div>
  );
};

export default Home;