import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const HeaderWrapper = styled.header`
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6;
  text-decoration: none;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;

  @media (max-width: 768px) {
    display: ${props => props.isOpen ? 'flex' : 'none'};
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    padding: 1rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
`;

const NavLink = styled(Link)`
  color: #374151;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;

  &:hover {
    color: #3b82f6;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const CreateButton = styled(Link)`
  background: #10b981;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.2s;
  border: 2px solid #10b981;

  &:hover {
    background: #059669;
    border-color: #059669;
  }
`;

const ViewButton = styled(Link)`
  background: transparent;
  color: #3b82f6;
  padding: 0.75rem 1.5rem;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: #3b82f6;
    color: white;
  }
`;

const MobileToggle = styled.button`
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;

  @media (max-width: 768px) {
    display: block;
  }
`;

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <HeaderWrapper>
      <Nav>
        <Logo to="/">eQUITY NEST</Logo>
        <NavLinks isOpen={isMenuOpen}>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/listings">Properties</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <ButtonGroup>
            <ViewButton to="/listings">
              View Listings
            </ViewButton>
            <CreateButton to="/create-listing">
              + Create Listing
            </CreateButton>
          </ButtonGroup>
        </NavLinks>
        <MobileToggle onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </MobileToggle>
      </Nav>
    </HeaderWrapper>
  );
};

export default Header;