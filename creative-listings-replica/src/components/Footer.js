import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const FooterWrapper = styled.footer`
  background: #1e293b;
  color: white;
  padding: 3rem 0 1rem;
  margin-top: 4rem;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
`;

const FooterSection = styled.div`
  h3 {
    color: #3b82f6;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }
`;

const FooterLink = styled(Link)`
  color: #cbd5e1;
  text-decoration: none;
  display: block;
  margin-bottom: 0.5rem;
  transition: color 0.2s;

  &:hover {
    color: #3b82f6;
  }
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #334155;
  color: #94a3b8;
`;

const Footer = () => {
  return (
    <FooterWrapper>
      <FooterContent>
        <FooterSection>
          <h3>eQUITY NEST</h3>
          <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
            Your trusted partner in finding the perfect property. 
            We connect buyers and sellers with exceptional real estate opportunities.
          </p>
        </FooterSection>
        
        <FooterSection>
          <h3>Quick Links</h3>
          <FooterLink to="/">Home</FooterLink>
          <FooterLink to="/listings">Properties</FooterLink>
          <FooterLink to="/about">About Us</FooterLink>
          <FooterLink to="/contact">Contact</FooterLink>
        </FooterSection>
        
        <FooterSection>
          <h3>Services</h3>
          <FooterLink to="/listings?type=buy">Buy Property</FooterLink>
          <FooterLink to="/listings?type=sell">Sell Property</FooterLink>
          <FooterLink to="/create-listing">List Property</FooterLink>
          <FooterLink to="/contact">Investment Consulting</FooterLink>
        </FooterSection>
        
        <FooterSection>
          <h3>Contact Info</h3>
          <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
            📧 info@creativelistings.com
          </p>
          <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
            📞 (555) 123-4567
          </p>
          <p style={{ color: '#cbd5e1' }}>
            📍 123 Real Estate Blvd, City, State 12345
          </p>
        </FooterSection>
      </FooterContent>
      
      <Copyright>
        <p>&copy; 2025 eQUITY NEST. All rights reserved.</p>
      </Copyright>
    </FooterWrapper>
  );
};

export default Footer;