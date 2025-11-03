import React, { useState } from 'react';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';
import { Link, useNavigate } from 'react-router-dom';

const DashboardContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  background: #f8fafc;
  min-height: 100vh;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: #64748b;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
`;

const StatNumber = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  font-size: 1rem;
  color: #64748b;
  font-weight: 500;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const ListingsGrid = styled.div`
  display: grid;
  gap: 1.5rem;
`;

const ListingCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 1.5rem;
  align-items: center;
`;

const ListingImage = styled.img`
  width: 150px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
`;

const ListingInfo = styled.div`
  flex: 1;
`;

const ListingTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const ListingMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
`;

const ListingPrice = styled.div`
  font-size: 1.125rem;
  font-weight: 600;
  color: #3b82f6;
`;

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  text-align: center;
  
  &.view {
    background: #3b82f6;
    color: white;
    
    &:hover {
      background: #2563eb;
    }
  }
  
  &.edit {
    background: #10b981;
    color: white;
    
    &:hover {
      background: #059669;
    }
  }
  
  &.delete {
    background: #ef4444;
    color: white;
    
    &:hover {
      background: #dc2626;
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const EmptyStateText = styled.p`
  color: #64748b;
  margin-bottom: 2rem;
`;

const CreateListingButton = styled(Link)`
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  display: inline-block;
  transition: background 0.2s;
  
  &:hover {
    background: #2563eb;
  }
`;

const Dashboard = () => {
  const { properties, deleteListing } = useListings();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Filter out initial sample properties - only show user-created ones
  const userListings = properties.filter(property => !property.isSample);

  const totalListings = userListings.length;
  const dealTypeCounts = userListings.reduce((acc, p) => {
    if (p.dealType) {
      acc[p.dealType] = (acc[p.dealType] || 0) + 1;
    }
    return acc;
  }, {});
  
  const cashDeals = dealTypeCounts['cash'] || 0;
  const subjectToDeals = dealTypeCounts['subject-to'] || 0;
  const hybridDeals = dealTypeCounts['hybrid'] || 0;

  const handleDelete = (propertyId) => {
    if (window.confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      deleteListing(propertyId);
    }
  };

  const handleEdit = (propertyId) => {
    navigate(`/edit-listing/${propertyId}`);
  };

  return (
    <DashboardContainer>
      <Header>
        <Title>My Dashboard</Title>
        <Subtitle>Manage your property listings and track performance</Subtitle>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatNumber>{totalListings}</StatNumber>
          <StatLabel>Total Investment Properties</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{dealTypeCounts['seller-finance'] || 0}</StatNumber>
          <StatLabel>Seller Finance Deals</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{subjectToDeals}</StatNumber>
          <StatLabel>Subject-To Deals</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{cashDeals}</StatNumber>
          <StatLabel>Cash Deals</StatLabel>
        </StatCard>
      </StatsGrid>

      <SectionHeader>
        <SectionTitle>Your Listings</SectionTitle>
      </SectionHeader>

      {userListings.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>🏠</EmptyStateIcon>
          <EmptyStateTitle>No listings yet</EmptyStateTitle>
          <EmptyStateText>
            You haven't created any listings yet. Start by adding your first property!
          </EmptyStateText>
          <CreateListingButton to="/create-listing">
            Create Your First Listing
          </CreateListingButton>
        </EmptyState>
      ) : (
        <ListingsGrid>
          {userListings.map((property) => (
            <ListingCard key={property.id}>
              <ListingImage 
                src={property.image || property.propertyPhotos?.[0]?.url || 'https://via.placeholder.com/150x100?text=Property'}
                alt={property.title}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/150x100?text=Property';
                }}
              />
              
              <ListingInfo>
                <ListingTitle>{property.title}</ListingTitle>
                <ListingMeta>
                  <span>📍 {property.location}</span>
                  {property.bedrooms && <span>🛏️ {property.bedrooms} bed</span>}
                  {property.bathrooms && <span>🚿 {property.bathrooms} bath</span>}
                  {property.sqft && <span>📐 {parseInt(property.sqft).toLocaleString()} sqft</span>}
                  {property.dealType && (
                    <span style={{background: '#e2e8f0', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
                      {property.dealType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  )}
                </ListingMeta>
                <ListingPrice>
                  ${property.price.toLocaleString()}
                </ListingPrice>
              </ListingInfo>

              <ActionsContainer>
                <ActionButton 
                  as={Link} 
                  to={`/property/${property.id}`}
                  className="view"
                >
                  View
                </ActionButton>
                <ActionButton 
                  className="edit"
                  onClick={() => handleEdit(property.id)}
                >
                  Edit
                </ActionButton>
                <ActionButton 
                  className="delete"
                  onClick={() => handleDelete(property.id)}
                >
                  Delete
                </ActionButton>
              </ActionsContainer>
            </ListingCard>
          ))}
        </ListingsGrid>
      )}
    </DashboardContainer>
  );
};

export default Dashboard;