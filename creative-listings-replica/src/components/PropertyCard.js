import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Card = styled.div`
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #e5e7eb;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  }
`;

const ImageContainer = styled.div`
  position: relative;
  height: 240px;
  overflow: hidden;
`;

const PropertyImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
`;

const DealTypeBadge = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: ${props => 
    props.dealType === 'seller-finance' ? '#10b981' : 
    props.dealType === 'subject-to' ? '#3b82f6' : 
    props.dealType === 'hybrid' ? '#f59e0b' : '#64748b'};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SavedBadge = styled.div`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Content = styled.div`
  padding: 1.5rem;
`;

const PriceSection = styled.div`
  margin-bottom: 1rem;
`;

const MainPrice = styled.h3`
  font-size: 1.75rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.25rem;
`;

const KeyMetrics = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const Metric = styled.div`
  text-align: center;
`;

const MetricLabel = styled.div`
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
`;

const MetricValue = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 1rem;
`;

const PropertyInfo = styled.div`
  margin-bottom: 1rem;
`;

const Location = styled.p`
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
`;

const Features = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const Feature = styled.span`
  background: #f1f5f9;
  color: #475569;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
`;

const DealHighlights = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Highlight = styled.span`
  background: ${props => 
    props.type === 'motivated' ? '#dcfce7' : 
    props.type === 'off-market' ? '#dbeafe' : 
    props.type === 'low-entry' ? '#fef3c7' : '#f3f4f6'};
  color: ${props => 
    props.type === 'motivated' ? '#166534' : 
    props.type === 'off-market' ? '#1e40af' : 
    props.type === 'low-entry' ? '#92400e' : '#374151'};
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: lowercase;
`;

const ViewButton = styled(Link)`
  background: #3b82f6;
  color: white;
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 600;
  text-align: center;
  display: block;
  transition: all 0.2s;
  font-size: 0.95rem;
  
  &:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
`;

const PropertyCard = ({ property }) => {
  const formatDealType = (dealType) => {
    if (!dealType) return '';
    return dealType.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Generate mock highlights for demo purposes
  const getHighlights = () => {
    const highlights = [];
    if (property.dealType === 'seller-finance') {
      highlights.push({ text: 'motivated seller', type: 'motivated' });
      highlights.push({ text: 'low entry fee', type: 'low-entry' });
    }
    if (property.dealType === 'subject-to') {
      highlights.push({ text: 'off market', type: 'off-market' });
    }
    if (property.interestRate && parseFloat(property.interestRate) < 7) {
      highlights.push({ text: 'super low interest rate', type: 'low-entry' });
    }
    return highlights;
  };

  return (
    <Card>
      <ImageContainer>
        <PropertyImage 
          src={property.image || property.propertyPhotos?.[0]?.url || 'https://via.placeholder.com/400x240?text=Property+Image'}
          alt={property.title}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x240?text=Property+Image';
          }}
        />
        {property.dealType && (
          <DealTypeBadge dealType={property.dealType}>
            {formatDealType(property.dealType)}
          </DealTypeBadge>
        )}
        <SavedBadge>
          ❤️ 2 saved
        </SavedBadge>
      </ImageContainer>
      
      <Content>
        <PriceSection>
          <MainPrice>${property.price.toLocaleString()}</MainPrice>
        </PriceSection>

        {/* Key Investment Metrics */}
        {property.dealType !== 'cash' && (property.downPayment || property.monthlyPayment) && (
          <KeyMetrics>
            {property.downPayment && (
              <Metric>
                <MetricLabel>Down Payment</MetricLabel>
                <MetricValue>${parseInt(property.downPayment).toLocaleString()}</MetricValue>
              </Metric>
            )}
            {property.monthlyPayment && (
              <Metric>
                <MetricLabel>Monthly Payment</MetricLabel>
                <MetricValue>${parseInt(property.monthlyPayment).toLocaleString()}</MetricValue>
              </Metric>
            )}
          </KeyMetrics>
        )}

        <PropertyInfo>
          <Location>{property.location}</Location>
          <Features>
            {property.bedrooms && <Feature>🛏️ {property.bedrooms} Bedrooms</Feature>}
            {property.bathrooms && <Feature>🚿 {property.bathrooms} Bathrooms</Feature>}
            {property.sqft && <Feature>📐 {parseInt(property.sqft).toLocaleString()} sqft</Feature>}
            {property.units && property.units > 1 && <Feature>🏠 {property.units} Units</Feature>}
          </Features>
        </PropertyInfo>

        {/* Deal Highlights */}
        {getHighlights().length > 0 && (
          <DealHighlights>
            {getHighlights().map((highlight, index) => (
              <Highlight key={index} type={highlight.type}>
                {highlight.text}
              </Highlight>
            ))}
            <Highlight>Creative Listing</Highlight>
          </DealHighlights>
        )}

        <ViewButton to={`/property/${property.id}`}>
          View Details
        </ViewButton>
      </Content>
    </Card>
  );
};

export default PropertyCard;