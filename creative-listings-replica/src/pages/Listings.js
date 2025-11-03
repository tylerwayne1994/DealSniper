import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';
import SearchBar from '../components/SearchBar';
import PropertyCard from '../components/PropertyCard';

const PageHeader = styled.div`
  background: #1e293b;
  color: white;
  padding: 6rem 2rem 4rem;
  margin-top: 70px;
  text-align: center;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
`;

const PropertyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
`;

const FilterSection = styled.div`
  background: #f8fafc;
  padding: 2rem 0;
`;

const SortControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const ResultsCount = styled.div`
  color: #64748b;
  font-weight: 500;
`;

const SortSelect = styled.select`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
`;

const NoResults = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #374151;
  }
`;

const Listings = () => {
  const { properties: allProperties } = useListings();
  const [filteredProperties, setFilteredProperties] = useState(allProperties);
  const [sortBy, setSortBy] = useState('price-low');
  const [searchFilters, setSearchFilters] = useState({});

  const handleSearch = (filters) => {
    let filtered = allProperties.filter(property => {
      if (filters.location && !property.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
      if (filters.type && property.type !== filters.type) {
        return false;
      }
      if (filters.minPrice && property.price < parseInt(filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice && property.price > parseInt(filters.maxPrice)) {
        return false;
      }
      if (filters.bedrooms && property.bedrooms < parseInt(filters.bedrooms)) {
        return false;
      }
      return true;
    });
    setFilteredProperties(filtered);
  };

  const handleSort = (value) => {
    setSortBy(value);
    let sorted = [...filteredProperties];
    
    switch(value) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'sqft-high':
        sorted.sort((a, b) => b.sqft - a.sqft);
        break;
      case 'bedrooms-high':
        sorted.sort((a, b) => b.bedrooms - a.bedrooms);
        break;
      default:
        break;
    }
    
    setFilteredProperties(sorted);
  };

  useEffect(() => {
    setFilteredProperties(allProperties);
  }, [allProperties]);

  useEffect(() => {
    handleSort(sortBy);
  }, [sortBy, allProperties]);

  return (
    <div>
      <PageHeader>
        <Container>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem' }}>
            Property Listings
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: '0.9' }}>
            Discover your perfect property from our extensive collection
          </p>
        </Container>
      </PageHeader>

      <FilterSection>
        <Container>
          <SearchBar onSearch={handleSearch} />
        </Container>
      </FilterSection>

      <Container style={{ padding: '2rem' }}>
        <SortControls>
          <ResultsCount>
            {filteredProperties.length} properties found
          </ResultsCount>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#374151', fontWeight: '500' }}>Sort by:</span>
            <SortSelect 
              value={sortBy} 
              onChange={(e) => handleSort(e.target.value)}
            >
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="sqft-high">Square Feet: Largest</option>
              <option value="bedrooms-high">Bedrooms: Most</option>
            </SortSelect>
          </div>
        </SortControls>

        {filteredProperties.length > 0 ? (
          <PropertyGrid>
            {filteredProperties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </PropertyGrid>
        ) : (
          <NoResults>
            <h3>No properties found</h3>
            <p>Try adjusting your search criteria to find more properties.</p>
          </NoResults>
        )}
      </Container>
    </div>
  );
};

export default Listings;