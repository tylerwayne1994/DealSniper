import React, { useState } from 'react';
import styled from 'styled-components';

const SearchContainer = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  margin: -3rem auto 0;
  position: relative;
  max-width: 1000px;
`;

const SearchForm = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: end;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const SearchButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #2563eb;
  }
`;

const SearchBar = ({ onSearch }) => {
  const [filters, setFilters] = useState({
    location: '',
    type: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: ''
  });

  const handleInputChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(filters);
  };

  return (
    <SearchContainer>
      <SearchForm onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Location</Label>
          <Input
            type="text"
            name="location"
            placeholder="Enter city or area"
            value={filters.location}
            onChange={handleInputChange}
          />
        </FormGroup>

        <FormGroup>
          <Label>Deal Type</Label>
          <Select
            name="type"
            value={filters.type}
            onChange={handleInputChange}
          >
            <option value="">All Types</option>
            <option value="seller-finance">Seller Finance</option>
            <option value="hybrid">Hybrid</option>
            <option value="subject-to">Subject To</option>
            <option value="cash">Cash</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Category</Label>
          <Select
            name="category"
            value={filters.category}
            onChange={handleInputChange}
          >
            <option value="">All Categories</option>
            <option value="single-family">🏠 Single Family</option>
            <option value="multifamily">🏢 Multi-Family</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Min Price</Label>
          <Input
            type="number"
            name="minPrice"
            placeholder="$0"
            value={filters.minPrice}
            onChange={handleInputChange}
          />
        </FormGroup>

        <FormGroup>
          <Label>Max Price</Label>
          <Input
            type="number"
            name="maxPrice"
            placeholder="Any"
            value={filters.maxPrice}
            onChange={handleInputChange}
          />
        </FormGroup>

        <FormGroup>
          <Label>Bedrooms</Label>
          <Select
            name="bedrooms"
            value={filters.bedrooms}
            onChange={handleInputChange}
          >
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </Select>
        </FormGroup>

        <SearchButton type="submit">
          🔍 Search Properties
        </SearchButton>
      </SearchForm>
    </SearchContainer>
  );
};

export default SearchBar;