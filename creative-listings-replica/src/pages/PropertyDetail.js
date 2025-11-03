import React from 'react';
import { useParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 6rem 2rem 2rem;
  background: #f8fafc;
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const LeftColumn = styled.div`
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ImageGallery = styled.div`
  height: 400px;
  position: relative;
  overflow: hidden;
`;

const MainImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PropertyContent = styled.div`
  padding: 2rem;
`;

const PropertyHeader = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const Address = styled.p`
  color: #64748b;
  font-size: 1.125rem;
  margin-bottom: 1rem;
`;

const PropertyDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const DetailItem = styled.div`
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const DetailIcon = styled.div`
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
`;

const DetailValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.25rem;
`;

const DetailLabel = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const PriceCard = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
`;

const PriceHeader = styled.div`
  text-align: center;
  margin-bottom: 1.5rem;
`;

const MainPrice = styled.div`
  font-size: 2.5rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const StatusBadge = styled.div`
  background: #dcfce7;
  color: #166534;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
`;

const DealMetrics = styled.div`
  margin-bottom: 1.5rem;
`;

const MetricItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
  
  &:last-child {
    border-bottom: none;
  }
`;

const MetricLabel = styled.span`
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
`;

const MetricValue = styled.span`
  color: #1e293b;
  font-weight: 700;
`;

const InfoCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
`;

const InfoTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
`;

const ContactInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const Avatar = styled.div`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.125rem;
`;

const ContactDetails = styled.div`
  flex: 1;
`;

const ContactName = styled.div`
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.25rem;
`;

const ContactRole = styled.div`
  font-size: 0.875rem;
  color: #64748b;
`;

const ContactMethod = styled.div`
  font-size: 0.875rem;
  color: #374151;
  margin-bottom: 0.25rem;
`;

const AboutSection = styled.div`
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
`;

const DescriptionText = styled.div`
  color: #374151;
  line-height: 1.7;
  margin-bottom: 2rem;
  
  p {
    margin-bottom: 1rem;
  }
`;

const PropertyDetail = () => {
  const { id } = useParams();
  const { properties } = useListings();
  
  // Debug logging
  console.log('URL ID:', id, 'Type:', typeof id);
  console.log('All properties:', properties.map(p => ({ id: p.id, type: typeof p.id, title: p.title })));
  
  // Try both string and number comparison
  const property = properties.find(p => p.id === parseInt(id) || p.id === id || String(p.id) === String(id));

  if (!property) {
    return (
      <Container>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1>Property Not Found</h1>
          <p>The property you're looking for doesn't exist.</p>
          <Link to="/listings" className="btn btn-primary" style={{ marginTop: '2rem' }}>
            Back to Listings
          </Link>
        </div>
      </Container>
    );
  }

  const getHighlights = () => {
    const highlights = [];
    if (property.dealType === 'seller-finance') {
      highlights.push('motivated seller');
      highlights.push('off market');
      highlights.push('low entry fee');
    }
    if (property.interestRate && parseFloat(property.interestRate) < 7) {
      highlights.push('super low interest rate');
    }
    return highlights;
  };

  return (
    <Container>
      <Link to="/listings" style={{ 
        color: '#3b82f6', 
        textDecoration: 'none', 
        marginBottom: '2rem', 
        display: 'inline-block',
        fontWeight: '500'
      }}>
        ← Back to Listings
      </Link>

      <MainLayout>
        <LeftColumn>
          <ImageGallery>
            <MainImage 
              src={property.propertyPhotos?.[0]?.url || property.image || 'https://via.placeholder.com/800x400?text=Property+Image'}
              alt={property.title}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x400?text=Property+Image';
              }}
            />
          </ImageGallery>
          
          <PropertyContent>
            <PropertyHeader>
              <Title>{property.title}</Title>
              <Address>{property.location}</Address>
            </PropertyHeader>

            <PropertyDetails>
              {property.bedrooms && (
                <DetailItem>
                  <DetailIcon>🛏️</DetailIcon>
                  <DetailValue>{property.bedrooms}</DetailValue>
                  <DetailLabel>Bedrooms</DetailLabel>
                </DetailItem>
              )}
              {property.bathrooms && (
                <DetailItem>
                  <DetailIcon>🚿</DetailIcon>
                  <DetailValue>{property.bathrooms}</DetailValue>
                  <DetailLabel>Bathrooms</DetailLabel>
                </DetailItem>
              )}
              {property.sqft && (
                <DetailItem>
                  <DetailIcon>📐</DetailIcon>
                  <DetailValue>{parseInt(property.sqft).toLocaleString()}</DetailValue>
                  <DetailLabel>sqft</DetailLabel>
                </DetailItem>
              )}
              {property.yearBuilt && (
                <DetailItem>
                  <DetailIcon>🏗️</DetailIcon>
                  <DetailValue>{property.yearBuilt}</DetailValue>
                  <DetailLabel>Year Built</DetailLabel>
                </DetailItem>
              )}
            </PropertyDetails>

            <AboutSection>
              <SectionTitle>About this Listing</SectionTitle>
              <DescriptionText>
                <p>{property.description || 'Scottsdale prime location fix and flip investment opportunity. It comes with approved plans to do a 372 square feet of addition to enlarge the master bed and bath and add master walk-in closet. It will become 3 bedroom, 3 bath with large laundry room. Large open floorplan with modern kitchen and wet bar.'}</p>
              </DescriptionText>

              {getHighlights().length > 0 && (
                <div style={{marginBottom: '1.5rem'}}>
                  {getHighlights().map((highlight, index) => (
                    <span key={index} style={{
                      background: '#dcfce7', 
                      color: '#166534',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      marginRight: '0.5rem',
                      marginBottom: '0.5rem',
                      display: 'inline-block'
                    }}>
                      {highlight}
                    </span>
                  ))}
                  <span style={{
                    background: '#f3f4f6', 
                    color: '#374151',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    Creative Listing
                  </span>
                </div>
              )}
            </AboutSection>

            {(property.propertyPhotos?.length > 0 || property.financialDocuments?.length > 0) && (
              <div style={{marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb'}}>
                {property.propertyPhotos?.length > 0 && (
                  <div style={{marginBottom: '2rem'}}>
                    <SectionTitle>Property Photos</SectionTitle>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '1rem'
                    }}>
                      {property.propertyPhotos.map((photo, index) => (
                        <div key={index} onClick={() => window.open(photo.url, '_blank')} style={{
                          aspectRatio: '4/3',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                        }}>
                          <img src={photo.url} alt={`Property photo ${index + 1}`} style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.financialDocuments?.length > 0 && (
                  <div>
                    <SectionTitle>Financial Documents</SectionTitle>
                    <div style={{display: 'grid', gap: '0.75rem'}}>
                      {property.financialDocuments.map((doc, index) => (
                        <a 
                          key={index} 
                          href={doc.url} 
                          download={doc.name}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '1rem',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: '#374151',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{fontSize: '1.5rem'}}>📄</div>
                          <div style={{flex: 1}}>
                            <div style={{fontWeight: '500', marginBottom: '0.25rem'}}>{doc.name}</div>
                            <div style={{fontSize: '0.875rem', color: '#64748b'}}>
                              {doc.size ? `${(doc.size / 1024 / 1024).toFixed(2)} MB` : 'Document'}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </PropertyContent>
        </LeftColumn>

        <RightColumn>
          <PriceCard>
            <PriceHeader>
              <MainPrice>${property.price.toLocaleString()}</MainPrice>
              <StatusBadge>Active</StatusBadge>
            </PriceHeader>

            {property.dealType !== 'cash' && (property.downPayment || property.monthlyPayment) && (
              <DealMetrics>
                {property.downPayment && (
                  <MetricItem>
                    <MetricLabel>Earnest Money Deposit (EMD):</MetricLabel>
                    <MetricValue>${parseInt(property.downPayment).toLocaleString()}</MetricValue>
                  </MetricItem>
                )}
                {property.monthlyPayment && (
                  <MetricItem>
                    <MetricLabel>Monthly Payment:</MetricLabel>
                    <MetricValue>${parseInt(property.monthlyPayment).toLocaleString()}</MetricValue>
                  </MetricItem>
                )}
                {property.interestRate && (
                  <MetricItem>
                    <MetricLabel>Interest Rate:</MetricLabel>
                    <MetricValue>{property.interestRate}%</MetricValue>
                  </MetricItem>
                )}
              </DealMetrics>
            )}
          </PriceCard>

          <InfoCard>
            <InfoTitle>Listing Information</InfoTitle>
            <ContactInfo>
              <Avatar>SS</Avatar>
              <ContactDetails>
                <ContactName>Sina Sabeti</ContactName>
                <ContactRole>Listed by</ContactRole>
              </ContactDetails>
            </ContactInfo>
            <ContactMethod>📧 sina@hkazi.com</ContactMethod>
            <ContactMethod>📞 (480) 648-7442</ContactMethod>
            <div style={{marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9'}}>
              <div style={{fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem'}}>Listed on</div>
              <div style={{fontWeight: '600'}}>October 26, 2025</div>
              <div style={{fontSize: '0.75rem', color: '#64748b'}}>(55 minutes ago)</div>
            </div>
          </InfoCard>
        </RightColumn>
      </MainLayout>
    </Container>
  );
};

export default PropertyDetail;
