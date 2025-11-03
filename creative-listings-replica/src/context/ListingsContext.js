import React, { createContext, useContext, useState } from 'react';

const ListingsContext = createContext();

export const useListings = () => {
  const context = useContext(ListingsContext);
  if (!context) {
    throw new Error('useListings must be used within a ListingsProvider');
  }
  return context;
};

// Initial sample properties
const initialProperties = [
  {
    id: 1,
    isSample: true,
    title: "Modern Downtown Condo",
    location: "1521 2nd Ave, Seattle, WA 98101",
    price: 750000,
    type: "sale",
    category: "single-family",
    dealType: "seller-finance",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1200,
    units: 1,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400",
    coordinates: [-122.3371, 47.6089],
    // Seller finance terms
    downPayment: "75000",
    interestRate: "6.5",
    loanTerm: "30",
    monthlyPayment: "4200"
  },
  {
    id: 2,
    isSample: true,
    title: "Luxury Family Home", 
    location: "1200 112th Ave NE, Bellevue, WA 98004",
    price: 1250000,
    type: "sale",
    category: "single-family",
    dealType: "cash",
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2800,
    units: 1,
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400",
    coordinates: [-122.1951, 47.6149]
  },
  {
    id: 3,
    isSample: true,
    title: "Investment Duplex",
    location: "1400 E Pine St, Seattle, WA 98122",
    price: 950000,
    type: "sale",
    category: "multifamily",
    dealType: "hybrid",
    bedrooms: 4,
    bathrooms: 3,
    sqft: 1800,
    units: 2,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400",
    coordinates: [-122.3146, 47.6148],
    // Hybrid terms
    downPayment: "95000",
    interestRate: "5.8",
    monthlyPayment: "3800",
    existingMortgageBalance: "425000",
    monthlyMortgagePayment: "2200"
  },
  {
    id: 4,
    isSample: true,
    title: "4-Plex Apartment Building",
    location: "4500 Fremont Ave N, Seattle, WA 98103",
    price: 1850000,
    type: "sale",
    category: "multifamily", 
    dealType: "subject-to",
    bedrooms: 8,
    bathrooms: 6,
    sqft: 3200,
    units: 4,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400",
    coordinates: [-122.3489, 47.6606],
    // Subject-to terms
    existingMortgageBalance: "1200000",
    monthlyMortgagePayment: "6400"
  },
  {
    id: 5,
    isSample: true,
    title: "Waterfront Townhome",
    location: "123 Lake St S, Kirkland, WA 98033",
    price: 1400000,
    type: "sale",
    category: "single-family",
    dealType: "seller-finance",
    bedrooms: 3,
    bathrooms: 2,
    sqft: 2200,
    units: 1,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400",
    coordinates: [-122.2073, 47.6814],
    // Seller finance terms
    downPayment: "140000",
    interestRate: "7.0",
    monthlyPayment: "5200"
  },
  {
    id: 6,
    isSample: true,
    title: "Triplex Investment Property",
    location: "5400 Ballard Ave NW, Seattle, WA 98107",
    price: 1650000,
    type: "sale",
    category: "multifamily",
    dealType: "cash",
    bedrooms: 6,
    bathrooms: 4,
    sqft: 2900,
    units: 3,
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400",
    coordinates: [-122.3817, 47.6685]
  }
];

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem('equityNestListings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        properties: parsed.properties || initialProperties,
        nextId: parsed.nextId || 7
      };
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return { properties: initialProperties, nextId: 7 };
};

const saveToStorage = (properties, nextId) => {
  try {
    localStorage.setItem('equityNestListings', JSON.stringify({ properties, nextId }));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const ListingsProvider = ({ children }) => {
  const { properties: initialProps, nextId: initialNextId } = loadFromStorage();
  const [properties, setProperties] = useState(initialProps);
  const [nextId, setNextId] = useState(initialNextId);

  const convertFileToDataUrl = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        url: e.target.result
      });
      reader.readAsDataURL(file);
    });
  };

  const addListing = async (listingData) => {
    try {
      // Geocode the address to get coordinates
      const coordinates = await geocodeAddress(listingData.location);
      
      // Convert property photos to data URLs
      const propertyPhotos = await Promise.all(
        (listingData.propertyPhotos || []).map(file => convertFileToDataUrl(file))
      );
      
      // Convert financial documents to data URLs
      const financialDocuments = await Promise.all(
        (listingData.financialDocuments || []).map(file => convertFileToDataUrl(file))
      );

      const newListing = {
        ...listingData,
        id: nextId,
        coordinates: coordinates,
        propertyPhotos: propertyPhotos,
        financialDocuments: financialDocuments,
        image: propertyPhotos[0]?.url || "https://via.placeholder.com/400x200?text=Property+Image"
      };

      const updatedProperties = [...properties, newListing];
      const updatedNextId = nextId + 1;
      
      setProperties(updatedProperties);
      setNextId(updatedNextId);
      
      // Save to localStorage
      saveToStorage(updatedProperties, updatedNextId);
      
      return newListing;
    } catch (error) {
      console.error('Error adding listing:', error);
      throw error;
    }
  };

  const geocodeAddress = async (address) => {
    try {
      // Using Mapbox Geocoding API
      const MAPBOX_TOKEN = 'pk.eyJ1IjoidHlsZXJ3YXluZTEiLCJhIjoiY21oNzlqb2xwMHBybjJscHR5ZXVqcHZ2aCJ9.jHao1snG3bwXFRVWcA8tuQ';
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=US&types=address`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center;
        return [longitude, latitude];
      } else {
        // Fallback to Seattle coordinates if geocoding fails
        console.warn('Geocoding failed, using default Seattle coordinates');
        return [-122.3321, 47.6062];
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fallback to Seattle coordinates
      return [-122.3321, 47.6062];
    }
  };

  const deleteListing = (listingId) => {
    const updatedProperties = properties.filter(property => property.id !== listingId);
    setProperties(updatedProperties);
    saveToStorage(updatedProperties);
  };

  const updateListing = (listingId, updatedData) => {
    const updatedProperties = properties.map(property => 
      property.id === listingId ? { ...property, ...updatedData } : property
    );
    setProperties(updatedProperties);
    saveToStorage(updatedProperties);
  };

  const value = {
    properties,
    addListing,
    deleteListing,
    updateListing,
    totalListings: properties.length
  };

  return (
    <ListingsContext.Provider value={value}>
      {children}
    </ListingsContext.Provider>
  );
};

export default ListingsContext;