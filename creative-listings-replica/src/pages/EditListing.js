import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: #f8fafc;
  min-height: 100vh;
  padding-top: 6rem;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
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

const Form = styled.form`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const FormSection = styled.div`
  margin-bottom: 2rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.columns || '1fr'};
  gap: 1rem;
  margin-bottom: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Textarea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  
  &.primary {
    background: #3b82f6;
    color: white;
    
    &:hover {
      background: #2563eb;
    }
  }
  
  &.secondary {
    background: #6b7280;
    color: white;
    
    &:hover {
      background: #4b5563;
    }
  }
`;

const ErrorMessage = styled.div`
  background: #fee2e2;
  color: #dc2626;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
`;

const EditListing = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { properties, updateListing } = useListings();
  
  const [listing, setListing] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    price: '',
    type: 'sale',
    category: 'single-family',
    dealType: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    units: '',
    yearBuilt: '',
    parking: '',
    description: '',
    downPayment: '',
    interestRate: '',
    loanTerm: '',
    monthlyPayment: '',
    balloonPayment: '',
    existingMortgageBalance: '',
    monthlyMortgagePayment: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const foundListing = properties.find(p => p.id === parseInt(id));
    if (foundListing) {
      setListing(foundListing);
      setFormData({
        title: foundListing.title || '',
        location: foundListing.location || '',
        price: foundListing.price || '',
        type: foundListing.type || 'sale',
        category: foundListing.category || 'single-family',
        dealType: foundListing.dealType || '',
        bedrooms: foundListing.bedrooms || '',
        bathrooms: foundListing.bathrooms || '',
        sqft: foundListing.sqft || '',
        units: foundListing.units || '',
        yearBuilt: foundListing.yearBuilt || '',
        parking: foundListing.parking || '',
        description: foundListing.description || '',
        downPayment: foundListing.downPayment || '',
        interestRate: foundListing.interestRate || '',
        loanTerm: foundListing.loanTerm || '',
        monthlyPayment: foundListing.monthlyPayment || '',
        balloonPayment: foundListing.balloonPayment || '',
        existingMortgageBalance: foundListing.existingMortgageBalance || '',
        monthlyMortgagePayment: foundListing.monthlyMortgagePayment || ''
      });
    } else {
      setError('Listing not found');
    }
  }, [id, properties]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const updatedListing = {
        ...listing,
        ...formData,
        price: parseFloat(formData.price),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
        sqft: formData.sqft ? parseInt(formData.sqft) : null,
        units: formData.units ? parseInt(formData.units) : 1,
        yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null
      };

      await updateListing(listing.id, updatedListing);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to update listing. Please try again.');
      console.error('Update error:', err);
    }
  };

  const renderDealSpecificFields = () => {
    if (!formData.dealType) return null;

    return (
      <FormSection>
        <SectionTitle>
          {formData.dealType === 'hybrid' ? 'Deal Terms (Seller Finance & Subject-To)' : 
           formData.dealType === 'seller-finance' ? 'Seller Finance Terms' : 
           'Subject-To Terms'}
        </SectionTitle>
        
        {(formData.dealType === 'seller-finance' || formData.dealType === 'hybrid') && (
          <>
            <FormRow columns="1fr 1fr">
              <FormGroup>
                <Label>Down Payment ($)</Label>
                <Input
                  type="number"
                  name="downPayment"
                  value={formData.downPayment}
                  onChange={handleInputChange}
                  placeholder="75000"
                />
              </FormGroup>
              <FormGroup>
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleInputChange}
                  placeholder="6.5"
                />
              </FormGroup>
            </FormRow>
            <FormRow columns="1fr 1fr 1fr">
              <FormGroup>
                <Label>Loan Term (years)</Label>
                <Input
                  type="number"
                  name="loanTerm"
                  value={formData.loanTerm}
                  onChange={handleInputChange}
                  placeholder="30"
                />
              </FormGroup>
              <FormGroup>
                <Label>Monthly Payment ($)</Label>
                <Input
                  type="number"
                  name="monthlyPayment"
                  value={formData.monthlyPayment}
                  onChange={handleInputChange}
                  placeholder="3500"
                />
              </FormGroup>
              <FormGroup>
                <Label>Balloon Payment ($)</Label>
                <Input
                  type="number"
                  name="balloonPayment"
                  value={formData.balloonPayment}
                  onChange={handleInputChange}
                  placeholder="Optional"
                />
              </FormGroup>
            </FormRow>
          </>
        )}

        {(formData.dealType === 'subject-to' || formData.dealType === 'hybrid') && (
          <FormRow columns="1fr 1fr">
            <FormGroup>
              <Label>Existing Mortgage Balance ($)</Label>
              <Input
                type="number"
                name="existingMortgageBalance"
                value={formData.existingMortgageBalance}
                onChange={handleInputChange}
                placeholder="450000"
              />
            </FormGroup>
            <FormGroup>
              <Label>Monthly Mortgage Payment ($)</Label>
              <Input
                type="number"
                name="monthlyMortgagePayment"
                value={formData.monthlyMortgagePayment}
                onChange={handleInputChange}
                placeholder="2800"
              />
            </FormGroup>
          </FormRow>
        )}
      </FormSection>
    );
  };

  if (error && !listing) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
        <Button className="secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  if (!listing) {
    return <Container>Loading...</Container>;
  }

  return (
    <Container>
      <Header>
        <Title>Edit Listing</Title>
        <Subtitle>Update your property information</Subtitle>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Form onSubmit={handleSubmit}>
        <FormSection>
          <SectionTitle>Basic Information</SectionTitle>
          <FormGroup>
            <Label>Property Title *</Label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter property title"
              required
            />
          </FormGroup>
          
          <FormGroup>
            <Label>Address/Location *</Label>
            <Input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Enter full address"
              required
            />
          </FormGroup>

          <FormRow columns="1fr 1fr 1fr">
            <FormGroup>
              <Label>Price ($) *</Label>
              <Input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="750000"
                required
              />
            </FormGroup>
            <FormGroup>
              <Label>Listing Type *</Label>
              <Select name="type" value={formData.type} onChange={handleInputChange}>
                <option value="sale">Investment Property</option>
              </Select>
            </FormGroup>
            <FormGroup>
              <Label>Property Category *</Label>
              <Select name="category" value={formData.category} onChange={handleInputChange}>
                <option value="single-family">Single Family</option>
                <option value="multifamily">Multi-Family</option>
              </Select>
            </FormGroup>
          </FormRow>
        </FormSection>

        <FormSection>
          <SectionTitle>Property Details</SectionTitle>
          <FormRow columns="1fr 1fr 1fr 1fr">
            <FormGroup>
              <Label>Bedrooms</Label>
              <Input
                type="number"
                name="bedrooms"
                value={formData.bedrooms}
                onChange={handleInputChange}
                placeholder="3"
              />
            </FormGroup>
            <FormGroup>
              <Label>Bathrooms</Label>
              <Input
                type="number"
                step="0.5"
                name="bathrooms"
                value={formData.bathrooms}
                onChange={handleInputChange}
                placeholder="2.5"
              />
            </FormGroup>
            <FormGroup>
              <Label>Square Feet</Label>
              <Input
                type="number"
                name="sqft"
                value={formData.sqft}
                onChange={handleInputChange}
                placeholder="2500"
              />
            </FormGroup>
            <FormGroup>
              <Label>Units</Label>
              <Input
                type="number"
                name="units"
                value={formData.units}
                onChange={handleInputChange}
                placeholder="1"
              />
            </FormGroup>
          </FormRow>
          
          <FormRow columns="1fr 1fr">
            <FormGroup>
              <Label>Year Built</Label>
              <Input
                type="number"
                name="yearBuilt"
                value={formData.yearBuilt}
                onChange={handleInputChange}
                placeholder="2020"
              />
            </FormGroup>
            <FormGroup>
              <Label>Parking Spaces</Label>
              <Input
                type="number"
                name="parking"
                value={formData.parking}
                onChange={handleInputChange}
                placeholder="2"
              />
            </FormGroup>
          </FormRow>
        </FormSection>

        <FormSection>
          <SectionTitle>Deal Type</SectionTitle>
          <FormGroup>
            <Label>Deal Structure</Label>
            <Select name="dealType" value={formData.dealType} onChange={handleInputChange}>
              <option value="">Select Deal Type</option>
              <option value="cash">Cash Purchase</option>
              <option value="seller-finance">Seller Finance</option>
              <option value="subject-to">Subject-To</option>
              <option value="hybrid">Hybrid (Seller Finance + Subject-To)</option>
            </Select>
          </FormGroup>
        </FormSection>

        {renderDealSpecificFields()}

        <FormSection>
          <SectionTitle>Description</SectionTitle>
          <FormGroup>
            <Label>Property Description</Label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the property, its features, and any important details..."
            />
          </FormGroup>
        </FormSection>

        <ButtonGroup>
          <Button type="button" className="secondary" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button type="submit" className="primary">
            Update Listing
          </Button>
        </ButtonGroup>
      </Form>
    </Container>
  );
};

export default EditListing;