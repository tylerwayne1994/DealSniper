import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 6rem 2rem 2rem;
`;

const PageHeader = styled.div`
  text-align: center;
  margin-bottom: 4rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
`;

const ContactGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin-bottom: 4rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ContactInfo = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  h2 {
    color: #1e293b;
    margin-bottom: 2rem;
    font-size: 1.5rem;
  }
`;

const ContactItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;

  .icon {
    background: #3b82f6;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
  }

  .details {
    h3 {
      color: #1e293b;
      margin-bottom: 0.25rem;
      font-size: 1rem;
    }

    p {
      color: #64748b;
      margin: 0;
    }
  }
`;

const ContactForm = styled.form`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  h2 {
    color: #1e293b;
    margin-bottom: 2rem;
    font-size: 1.5rem;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #374151;
    font-weight: 500;
  }

  input, textarea, select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #3b82f6;
    }
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }
`;

const SubmitButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;

  &:hover {
    background: #2563eb;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  background: #10b981;
  color: white;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 2rem;
  font-weight: 500;
`;

const MapSection = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;

  h2 {
    color: #1e293b;
    margin-bottom: 1rem;
  }

  .map-placeholder {
    background: #f3f4f6;
    height: 300px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 1.1rem;
    margin-top: 1rem;
  }
`;

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    setFormData({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: ''
    });

    // Hide success message after 5 seconds
    setTimeout(() => setIsSubmitted(false), 5000);
  };

  return (
    <Container>
      <PageHeader>
        <Title>Contact Us</Title>
        <Subtitle>
          Get in touch with our team of real estate professionals. We're here to help 
          you with all your property needs.
        </Subtitle>
      </PageHeader>

      <ContactGrid>
        <ContactInfo>
          <h2>Get in Touch</h2>
          
          <ContactItem>
            <div className="icon">📧</div>
            <div className="details">
              <h3>Email</h3>
              <p>info@creativelistings.com</p>
            </div>
          </ContactItem>

          <ContactItem>
            <div className="icon">📞</div>
            <div className="details">
              <h3>Phone</h3>
              <p>(555) 123-4567</p>
            </div>
          </ContactItem>

          <ContactItem>
            <div className="icon">📱</div>
            <div className="details">
              <h3>Mobile</h3>
              <p>(555) 987-6543</p>
            </div>
          </ContactItem>

          <ContactItem>
            <div className="icon">📍</div>
            <div className="details">
              <h3>Address</h3>
              <p>123 Real Estate Blvd<br />Seattle, WA 98101</p>
            </div>
          </ContactItem>

          <ContactItem>
            <div className="icon">🕒</div>
            <div className="details">
              <h3>Business Hours</h3>
              <p>Mon-Fri: 9:00 AM - 6:00 PM<br />Sat-Sun: 10:00 AM - 4:00 PM</p>
            </div>
          </ContactItem>
        </ContactInfo>

        <ContactForm onSubmit={handleSubmit}>
          <h2>Send us a Message</h2>
          
          {isSubmitted && (
            <SuccessMessage>
              Thank you for your message! We'll get back to you within 24 hours.
            </SuccessMessage>
          )}

          <FormGroup>
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </FormGroup>

          <FormGroup>
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </FormGroup>

          <FormGroup>
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup>
            <label htmlFor="subject">Subject</label>
            <select
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
            >
              <option value="">Select a subject</option>
              <option value="buying">I'm interested in buying</option>
              <option value="selling">I want to sell my property</option>
              <option value="investing">Investment opportunities</option>
              <option value="general">General inquiry</option>
              <option value="other">Other</option>
            </select>
          </FormGroup>

          <FormGroup>
            <label htmlFor="message">Message *</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="Tell us how we can help you..."
              required
            />
          </FormGroup>

          <SubmitButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </SubmitButton>
        </ContactForm>
      </ContactGrid>

      <MapSection>
        <h2>Visit Our Office</h2>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          Located in the heart of Seattle, our office is easily accessible and we welcome walk-ins 
          during business hours.
        </p>
        <div className="map-placeholder">
          🗺️ Interactive Map Coming Soon
        </div>
      </MapSection>
    </Container>
  );
};

export default Contact;