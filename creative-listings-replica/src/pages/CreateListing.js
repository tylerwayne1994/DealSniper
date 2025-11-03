import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useListings } from '../context/ListingsContext';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 6rem 2rem 4rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
  text-align: center;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #64748b;
  text-align: center;
  margin-bottom: 3rem;
`;

const Form = styled.form`
  background: white;
  padding: 2.5rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
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

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const FileUpload = styled.div`
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: border-color 0.2s;
  cursor: pointer;

  &:hover {
    border-color: #3b82f6;
  }

  &.dragover {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileList = styled.div`
  margin-top: 1rem;
`;

const FileItem = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 4px;
  margin-bottom: 0.5rem;
`;

const DealSpecificFields = styled.div`
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const SubmitButton = styled.button`
  background: #10b981;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;

  &:hover {
    background: #059669;
  }
`;

const CreateListing = () => {
  const { addListing } = useListings();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    price: '',
    dealType: '',
    category: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    yearBuilt: '',
    lotSize: '',
    units: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    // Deal-specific fields
    downPayment: '',
    interestRate: '',
    loanTerm: '',
    monthlyPayment: '',
    balloonPayment: '',
    existingMortgageBalance: '',
    monthlyMortgagePayment: '',
    // File uploads
    propertyPhotos: [],
    financialDocuments: []
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileUpload = (e, fieldName) => {
    const files = Array.from(e.target.files);
    setFormData({
      ...formData,
      [fieldName]: [...formData[fieldName], ...files]
    });
  };

  const removeFile = (fieldName, index) => {
    const updatedFiles = formData[fieldName].filter((_, i) => i !== index);
    setFormData({
      ...formData,
      [fieldName]: updatedFiles
    });
  };

  const renderDealSpecificFields = () => {
    if (!formData.dealType) return null;

    const isSellerFinance = formData.dealType === 'seller-finance';
    const isSubjectTo = formData.dealType === 'subject-to';
    const isHybrid = formData.dealType === 'hybrid';

    if (formData.dealType === 'cash') return null;

    return (
      <DealSpecificFields>
        <SectionTitle>
          {isHybrid ? 'Seller Finance & Subject-To Terms' : 
           isSellerFinance ? 'Seller Finance Terms' : 
           'Subject-To Terms'}
        </SectionTitle>
        
        {(isSellerFinance || isHybrid) && (
          <>
            <FormRow>
              <FormGroup>
                <Label>Down Payment ($)</Label>
                <Input
                  type="number"
                  name="downPayment"
                  placeholder="50000"
                  value={formData.downPayment}
                  onChange={handleInputChange}
                />
              </FormGroup>
              <FormGroup>
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  name="interestRate"
                  placeholder="6.5"
                  step="0.1"
                  value={formData.interestRate}
                  onChange={handleInputChange}
                />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup>
                <Label>Loan Term (years)</Label>
                <Input
                  type="number"
                  name="loanTerm"
                  placeholder="30"
                  value={formData.loanTerm}
                  onChange={handleInputChange}
                />
              </FormGroup>
              <FormGroup>
                <Label>Monthly Payment ($)</Label>
                <Input
                  type="number"
                  name="monthlyPayment"
                  placeholder="3200"
                  value={formData.monthlyPayment}
                  onChange={handleInputChange}
                />
              </FormGroup>
            </FormRow>
            <FormGroup>
              <Label>Balloon Payment ($)</Label>
              <Input
                type="number"
                name="balloonPayment"
                placeholder="150000"
                value={formData.balloonPayment}
                onChange={handleInputChange}
              />
            </FormGroup>
          </>
        )}

        {(isSubjectTo || isHybrid) && (
          <>
            <FormRow>
              <FormGroup>
                <Label>Existing Mortgage Balance ($)</Label>
                <Input
                  type="number"
                  name="existingMortgageBalance"
                  placeholder="425000"
                  value={formData.existingMortgageBalance}
                  onChange={handleInputChange}
                />
              </FormGroup>
              <FormGroup>
                <Label>Monthly Mortgage Payment ($)</Label>
                <Input
                  type="number"
                  name="monthlyMortgagePayment"
                  placeholder="2400"
                  value={formData.monthlyMortgagePayment}
                  onChange={handleInputChange}
                />
              </FormGroup>
            </FormRow>
          </>
        )}
      </DealSpecificFields>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Validate required fields
      if (!formData.title || !formData.location || !formData.price || !formData.dealType || !formData.category) {
        alert('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      // Add the listing to our context/state
      await addListing({
        ...formData,
        type: 'sale' // Default to sale for now
      });
      
      alert('Listing created successfully!');
      navigate('/listings');
    } catch (error) {
      console.error('Error creating listing:', error);
      alert('Error creating listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container>
      <Title>Create New Listing</Title>
      <Subtitle>
        List your property on eQUITY NEST and connect with qualified investors
      </Subtitle>

      <Form onSubmit={handleSubmit}>
        <Section>
          <SectionTitle>Property Details</SectionTitle>
          <FormGroup>
            <Label>Property Title *</Label>
            <Input
              type="text"
              name="title"
              placeholder="e.g. Modern Downtown Condo"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label>Deal Type *</Label>
              <Select
                name="dealType"
                value={formData.dealType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Deal Type</option>
                <option value="seller-finance">Seller Finance</option>
                <option value="hybrid">Hybrid</option>
                <option value="subject-to">Subject To</option>
                <option value="cash">Cash</option>
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>Category *</Label>
              <Select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Category</option>
                <option value="single-family">🏠 Single Family</option>
                <option value="multifamily">🏢 Multi-Family</option>
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup>
            <Label>Location *</Label>
            <Input
              type="text"
              name="location"
              placeholder="Full address including city, state, zip"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label>Price *</Label>
              <Input
                type="number"
                name="price"
                placeholder="750000"
                value={formData.price}
                onChange={handleInputChange}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Square Feet</Label>
              <Input
                type="number"
                name="sqft"
                placeholder="2400"
                value={formData.sqft}
                onChange={handleInputChange}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>Bedrooms</Label>
              <Input
                type="number"
                name="bedrooms"
                placeholder="3"
                value={formData.bedrooms}
                onChange={handleInputChange}
              />
            </FormGroup>

            <FormGroup>
              <Label>Bathrooms</Label>
              <Input
                type="number"
                name="bathrooms"
                placeholder="2"
                step="0.5"
                value={formData.bathrooms}
                onChange={handleInputChange}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>Number of Units</Label>
              <Input
                type="number"
                name="units"
                placeholder="1"
                value={formData.units}
                onChange={handleInputChange}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>Year Built</Label>
              <Input
                type="number"
                name="yearBuilt"
                placeholder="2020"
                value={formData.yearBuilt}
                onChange={handleInputChange}
              />
            </FormGroup>

            <FormGroup>
              <Label>Lot Size (sq ft)</Label>
              <Input
                type="number"
                name="lotSize"
                placeholder="8000"
                value={formData.lotSize}
                onChange={handleInputChange}
              />
            </FormGroup>
          </FormRow>

          <FormGroup>
            <Label>Description</Label>
            <TextArea
              name="description"
              placeholder="Describe the property, unique features, investment potential..."
              value={formData.description}
              onChange={handleInputChange}
            />
          </FormGroup>
        </Section>

        <Section>
          <SectionTitle>Property Photos</SectionTitle>
          <FormGroup>
            <Label>Upload Property Images</Label>
            <FileUpload onClick={() => document.getElementById('propertyPhotos').click()}>
              <div>📷 Click to upload property photos</div>
              <div style={{color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem'}}>
                Upload multiple images (JPEG, PNG, WebP)
              </div>
            </FileUpload>
            <FileInput
              id="propertyPhotos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e, 'propertyPhotos')}
            />
            {formData.propertyPhotos.length > 0 && (
              <FileList>
                {formData.propertyPhotos.map((file, index) => (
                  <FileItem key={index}>
                    <span>📸 {file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => removeFile('propertyPhotos', index)}
                      style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}
                    >
                      ✕
                    </button>
                  </FileItem>
                ))}
              </FileList>
            )}
          </FormGroup>
        </Section>

        <Section>
          <SectionTitle>Financial Documents</SectionTitle>
          <FormGroup>
            <Label>Upload Financial Documentation</Label>
            <FileUpload onClick={() => document.getElementById('financialDocs').click()}>
              <div>📊 Click to upload financial documents</div>
              <div style={{color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem'}}>
                Upload P&L statements, tax returns, financial reports, etc. (PDF, DOC, XLS)
              </div>
            </FileUpload>
            <FileInput
              id="financialDocs"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              onChange={(e) => handleFileUpload(e, 'financialDocuments')}
            />
            {formData.financialDocuments.length > 0 && (
              <FileList>
                {formData.financialDocuments.map((file, index) => (
                  <FileItem key={index}>
                    <span>📄 {file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => removeFile('financialDocuments', index)}
                      style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}
                    >
                      ✕
                    </button>
                  </FileItem>
                ))}
              </FileList>
            )}
          </FormGroup>
        </Section>

        {renderDealSpecificFields()}

        <Section>
          <SectionTitle>Contact Information</SectionTitle>
          <FormRow>
            <FormGroup>
              <Label>Your Name *</Label>
              <Input
                type="text"
                name="contactName"
                placeholder="John Doe"
                value={formData.contactName}
                onChange={handleInputChange}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Email *</Label>
              <Input
                type="email"
                name="contactEmail"
                placeholder="john@example.com"
                value={formData.contactEmail}
                onChange={handleInputChange}
                required
              />
            </FormGroup>
          </FormRow>

          <FormGroup>
            <Label>Phone Number</Label>
            <Input
              type="tel"
              name="contactPhone"
              placeholder="(555) 123-4567"
              value={formData.contactPhone}
              onChange={handleInputChange}
            />
          </FormGroup>
        </Section>

        <SubmitButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Listing...' : 'Create Listing'}
        </SubmitButton>
      </Form>
    </Container>
  );
};

export default CreateListing;