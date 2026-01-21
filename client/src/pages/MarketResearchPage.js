// Market Research Page - Perplexity-Powered Chat for Finding Perfect Markets
// UI matches ResultsPageV2 styling
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  TrendingUp,
  DollarSign,
  Users,
  Loader,
  Building2,
  Search,
  Target,
  BarChart3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MarketReportDisplay } from '../components/reports';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../config/api';

// Suggestion prompts
const SUGGESTIONS = [
  {
    icon: MapPin,
    color: '#10b981',
    title: "Best Markets for Cash Flow",
    desc: "Find markets with strong rent-to-price ratios",
    prompt: "I'm looking for markets with strong cash flow potential. Which cities or metro areas have the best rent-to-price ratios for multifamily investing right now? Consider population growth, job market, and landlord-friendly laws."
  },
  {
    icon: TrendingUp,
    color: '#f59e0b',
    title: "Emerging Growth Markets",
    desc: "Discover up-and-coming investment areas",
    prompt: "What are the top emerging markets for multifamily real estate investment in 2025? I want to find areas with strong appreciation potential, population growth, and economic development before they become too competitive."
  },
  {
    icon: Building2,
    color: '#3b82f6',
    title: "Compare Specific Markets",
    desc: "Analyze cities side-by-side",
    prompt: "Compare the Phoenix, Arizona and Dallas, Texas multifamily markets for investment. Consider factors like population growth, job growth, rent growth, cap rates, appreciation potential, and landlord-friendly laws."
  },
  {
    icon: DollarSign,
    color: '#ec4899',
    title: "Affordable Entry Markets",
    desc: "Find markets with lower barriers",
    prompt: "What markets offer the best opportunities for new multifamily investors with limited capital? I'm looking for areas where I can get started with smaller down payments but still have strong fundamentals."
  }
];

// Convert backend JSON data to report format for visualizations
const convertBackendDataToReportFormat = (backendData, responseText) => {
  const markets = backendData.markets || [];
  
  if (markets.length === 0) return null;

  // Calculate center for map
  const avgLat = markets.reduce((sum, m) => sum + (m.lat || 0), 0) / markets.length;
  const avgLng = markets.reduce((sum, m) => sum + (m.lng || 0), 0) / markets.length;

  // Extract title from first line of response
  const lines = responseText.split('\n').filter(l => l.trim());
  const title = lines.find(l => l.includes('Top') || l.includes('Market') || l.includes('Recommended'))?.replace(/^#+\s*/, '').replace(/\*\*/g, '') || "Top Recommended Markets";
  
  // Extract summary (first paragraph before numbered list)
  const paragraphs = responseText.split('\n\n').filter(p => p.trim() && !p.match(/^\s*\d+\./));
  const summary = paragraphs[0]?.substring(0, 500) || "Market analysis and recommendations based on current data.";

  // Build chart data
  const chartData = [];
  
  if (markets.some(m => m.occupancy != null)) {
    chartData.push({
      type: 'bar',
      title: 'Occupancy Rate Comparison',
      dataKey: 'occupancy',
      format: 'percent',
      color: '#10b981',
      data: markets.filter(m => m.occupancy != null).map(m => ({ 
        market: m.name, 
        occupancy: m.occupancy 
      }))
    });
  }
  
  if (markets.some(m => m.rentGrowth != null)) {
    chartData.push({
      type: 'bar',
      title: 'Rent Growth Projection',
      dataKey: 'rentGrowth',
      format: 'percent',
      color: '#f59e0b',
      data: markets.filter(m => m.rentGrowth != null).map(m => ({ 
        market: m.name, 
        rentGrowth: m.rentGrowth 
      }))
    });
  }

  // Build table columns and data
  const columns = [{ key: 'market', label: 'Market', type: 'text', align: 'left' }];
  if (markets.some(m => m.medianPrice)) columns.push({ key: 'medianPrice', label: 'Median Price', type: 'currency', align: 'right' });
  if (markets.some(m => m.occupancy != null)) columns.push({ key: 'occupancy', label: 'Occupancy', type: 'percent', align: 'right' });
  if (markets.some(m => m.capRate != null)) columns.push({ key: 'capRate', label: 'Cap Rate', type: 'percent', align: 'right' });
  if (markets.some(m => m.rentGrowth != null)) columns.push({ key: 'rentGrowth', label: 'Rent Growth', type: 'percent', align: 'right' });
  if (markets.some(m => m.vacancy != null)) columns.push({ key: 'vacancy', label: 'Vacancy', type: 'percent', align: 'right' });
  if (markets.some(m => m.jobGrowth != null)) columns.push({ key: 'jobGrowth', label: 'Job Growth', type: 'percent', align: 'right' });

  const tableData = markets.map(m => ({
    market: `${m.name}, ${m.state}`,
    medianPrice: m.medianPrice,
    occupancy: m.occupancy,
    capRate: m.capRate,
    rentGrowth: m.rentGrowth,
    vacancy: m.vacancy,
    jobGrowth: m.jobGrowth
  }));

  return {
    title,
    region: "Multi-Market Analysis",
    summary,
    mapData: {
      markets: markets.map(m => ({
        name: `${m.name}, ${m.state}`,
        lat: m.lat,
        lng: m.lng,
        rent: m.medianPrice,
        occupancy: m.occupancy,
        capRate: m.capRate,
        rentGrowth: m.rentGrowth,
        vacancy: m.vacancy,
        jobGrowth: m.jobGrowth
      })),
      center: [avgLat, avgLng],
      zoom: markets.length > 3 ? 4 : 6
    },
    chartData,
    tableData: {
      title: 'Market Comparison',
      columns,
      data: tableData
    }
  };
};

// Helper to extract market data from AI response and create structured report
const parseMarketDataFromResponse = (aiResponse, query) => {
  console.log('🔍 Parsing AI response for market data...');
  
  // City coordinates lookup
  const cityCoords = {
    'tampa': [27.9506, -82.4572], 'atlanta': [33.7490, -84.3880], 'las vegas': [36.1699, -115.1398],
    'phoenix': [33.4484, -112.0740], 'dallas': [32.7767, -96.7970], 'houston': [29.7604, -95.3698],
    'austin': [30.2672, -97.7431], 'charlotte': [35.2271, -80.8431], 'raleigh': [35.7796, -78.6382],
    'nashville': [36.1627, -86.7816], 'denver': [39.7392, -104.9903], 'seattle': [47.6062, -122.3321],
    'portland': [45.5152, -122.6784], 'miami': [25.7617, -80.1918], 'orlando': [28.5383, -81.3792],
    'jacksonville': [30.3322, -81.6557], 'san antonio': [29.4241, -98.4936], 'indianapolis': [39.7684, -86.1581],
    'columbus': [39.9612, -82.9988], 'san diego': [32.7157, -117.1611], 'san jose': [37.3382, -121.8863],
    'los angeles': [34.0522, -118.2437], 'san francisco': [37.7749, -122.4194], 'boston': [42.3601, -71.0589],
    'chicago': [41.8781, -87.6298], 'new york': [40.7128, -74.0060], 'philadelphia': [39.9526, -75.1652],
    'baltimore': [39.2904, -76.6122], 'washington': [38.9072, -77.0369], 'memphis': [35.1495, -90.0490],
    'oklahoma city': [35.4676, -97.5164], 'kansas city': [39.0997, -94.5786], 'cincinnati': [39.1031, -84.5120],
    'cleveland': [41.4993, -81.6944], 'pittsburgh': [40.4406, -79.9959], 'detroit': [42.3314, -83.0458],
    'milwaukee': [43.0389, -87.9065], 'minneapolis': [44.9778, -93.2650], 'salt lake city': [40.7608, -111.8910],
    'albuquerque': [35.0844, -106.6504], 'tucson': [32.2226, -110.9747], 'sacramento': [38.5816, -121.4944]
  };

  // More flexible regex to catch various city/state formats
  const marketMatches = [
    ...aiResponse.matchAll(/(?:^|\n)\s*\d+\.\s*\*\*([^*]+)\*\*/gm),
    ...aiResponse.matchAll(/(?:^|\n)\s*\d+\.\s*([A-Z][a-z\s-]+(?:-[A-Z][a-z]+)?\s+County)/gm),
    ...aiResponse.matchAll(/(?:^|\n)\s*\d+\.\s*([A-Z][a-z\s]+),\s*([A-Z]{2})\s*\([^)]+\)/gm)
  ];
  
  console.log(`Found ${marketMatches.length} market matches`);
  
  if (marketMatches.length < 2) {
    console.log('Not enough markets found, skipping visualization');
    return null;
  }

  const markets = [];
  const tableData = [];
  
  marketMatches.forEach((match, idx) => {
    let cityName, state = 'NC', displayName;
    
    // Handle bold format: **Raleigh-Wake County**
    if (match[1] && !match[2]) {
      const text = match[1].trim();
      // Extract city from "City-County County" or "City County"
      const cityMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (cityMatch) {
        cityName = cityMatch[1].trim();
        displayName = text;
      } else {
        return;
      }
    } 
    // Handle format: City, STATE (County)
    else if (match[2] && match[3]) {
      cityName = match[2].trim();
      state = match[3];
      displayName = cityName;
    } else {
      return;
    }
    
    const cityLower = cityName.toLowerCase();
    const coords = cityCoords[cityLower] || cityCoords[cityLower.split(' ')[0]] || [39.8283, -98.5795];
    
    // Extract data for this market
    const cityIndex = aiResponse.indexOf(match[0]);
    const nextCity = marketMatches[idx + 1];
    const sectionEnd = nextCity ? aiResponse.indexOf(nextCity[0]) : aiResponse.length;
    const section = aiResponse.substring(cityIndex, Math.min(sectionEnd, cityIndex + 3000));
    
    console.log(`📄 Section for ${displayName}:`, section.substring(0, 500));
    
    // Much more aggressive metric extraction with multiple patterns
    const priceMatch = section.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:K|k)?)/i);
    const occupancyMatch = section.match(/(\d{1,3}(?:\.\d+)?)\s*%/i);
    const capRateMatch = section.match(/(\d+(?:\.\d+)?)\s*%\s*cap/i);
    const rentGrowthMatch = section.match(/(\d+(?:\.\d+)?)\s*%.*?rent.*?growth/i) || 
                           section.match(/rent.*?growth.*?(\d+(?:\.\d+)?)\s*%/i);
    const jobGrowthMatch = section.match(/(\d+(?:\.\d+)?)\s*%.*?job.*?growth/i);
    
    console.log('Extracted:', {
      price: priceMatch?.[1],
      occupancy: occupancyMatch?.[1],
      capRate: capRateMatch?.[1],
      rentGrowth: rentGrowthMatch?.[1],
      jobGrowth: jobGrowthMatch?.[1]
    });
    
    const marketData = {
      name: `${displayName}, ${state}`,
      lat: coords[0],
      lng: coords[1],
      price: priceMatch ? parseInt(priceMatch[1].replace(/[K,k]/g, '')) * (priceMatch[1].match(/[Kk]/) ? 1000 : 1) : null,
      occupancy: occupancyMatch ? parseFloat(occupancyMatch[1]) : null,
      capRate: capRateMatch ? parseFloat(capRateMatch[1]) : null,
      rentGrowth: rentGrowthMatch ? parseFloat(rentGrowthMatch[1]) : null,
      jobGrowth: jobGrowthMatch ? parseFloat(jobGrowthMatch[1]) : null
    };
    
    console.log(`Market ${idx + 1}:`, marketData);
    
    markets.push(marketData);
    tableData.push({
      market: marketData.name,
      price: marketData.price,
      occupancy: marketData.occupancy,
      capRate: marketData.capRate,
      rentGrowth: marketData.rentGrowth,
      jobGrowth: marketData.jobGrowth
    });
  });

  if (markets.length < 2) {
    console.log('Not enough valid markets after parsing');
    return null;
  }

  console.log(`✅ Successfully parsed ${markets.length} markets, creating visualizations...`);

  const avgLat = markets.reduce((sum, m) => sum + m.lat, 0) / markets.length;
  const avgLng = markets.reduce((sum, m) => sum + m.lng, 0) / markets.length;

  const lines = aiResponse.split('\n').filter(l => l.trim());
  const title = lines.find(l => l.includes('Top') || l.includes('Market') || l.includes('Recommended'))?.replace(/^#+\s*/, '').replace(/\*\*/g, '') || "Top Recommended Markets";
  
  const paragraphs = aiResponse.split('\n\n').filter(p => p.trim() && !p.match(/^\s*\d+\./));
  const summary = paragraphs[0]?.substring(0, 500) || "Market analysis and recommendations based on current data.";

  const chartData = [];
  
  if (markets.some(m => m.occupancy)) {
    chartData.push({
      type: 'bar',
      title: 'Occupancy Rate Comparison',
      dataKey: 'occupancy',
      format: 'percent',
      color: '#10b981',
      data: markets.filter(m => m.occupancy).map(m => ({ market: m.name.split(',')[0], occupancy: m.occupancy }))
    });
  }
  
  if (markets.some(m => m.capRate)) {
    chartData.push({
      type: 'bar',
      title: 'Cap Rate Comparison',
      dataKey: 'capRate',
      format: 'percent',
      color: '#f59e0b',
      data: markets.filter(m => m.capRate).map(m => ({ market: m.name.split(',')[0], capRate: m.capRate }))
    });
  }

  const columns = [{ key: 'market', label: 'Market', type: 'text', align: 'left' }];
  if (markets.some(m => m.price)) columns.push({ key: 'price', label: 'Median Price', type: 'currency', align: 'right' });
  if (markets.some(m => m.occupancy)) columns.push({ key: 'occupancy', label: 'Occupancy', type: 'percent', align: 'right' });
  if (markets.some(m => m.capRate)) columns.push({ key: 'capRate', label: 'Cap Rate', type: 'percent', align: 'right' });
  if (markets.some(m => m.rentGrowth)) columns.push({ key: 'rentGrowth', label: 'Rent Growth', type: 'percent', align: 'right' });
  if (markets.some(m => m.jobGrowth)) columns.push({ key: 'jobGrowth', label: 'Job Growth', type: 'percent', align: 'right' });

  return {
    title,
    region: "Multi-Market Analysis",
    summary,
    mapData: {
      markets,
      center: [avgLat, avgLng],
      zoom: markets.length > 3 ? 4 : 6
    },
    chartData,
    tableData: {
      title: 'Market Comparison',
      columns,
      data: tableData
    }
  };
};

function MarketResearchPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion.prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) headers['X-Profile-ID'] = userId;

      const response = await fetch(API_ENDPOINTS.marketResearchChat, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (response.status === 401) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Please log in to use Market Research. Go to the login page, sign in, then try again.'
        }]);
        return;
      }

      if (response.status === 402) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'You are out of tokens for this feature. Please purchase more tokens to continue.'
        }]);
        return;
      }

      const data = await response.json();

      if (data.success) {
        const message = { 
          role: 'assistant', 
          content: data.response,
          citations: data.citations
        };
        
        // Use structured market data from backend if available
        if (data.marketData && data.marketData.markets && data.marketData.markets.length > 0) {
          console.log('✅ Received structured market data from backend:', data.marketData);
          message.reportData = convertBackendDataToReportFormat(data.marketData, data.response);
        }
        
        setMessages(prev => [...prev, message]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I apologize, but I encountered an error: ${data.error || 'Unknown error'}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but there was a connection error. Please verify you are logged in and try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={20} color="#6366f1" />
                Market Finder AI
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                Discover the best markets for your investment strategy
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                New Search
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex',
          gap: '4px',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <button
            style={{
              padding: '12px 16px',
              backgroundColor: 'white',
              color: '#111827',
              border: 'none',
              borderBottom: '2px solid #6366f1',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Search size={16} />
            Find Markets
          </button>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: 'none',
              borderBottom: '2px solid transparent',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart3 size={16} />
            Pipeline
          </button>
        </div>

        {/* Content Area */}
        <div style={{ 
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f9fafb',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Welcome Section - Only show when no messages */}
          {messages.length === 0 && (
            <div style={{ padding: '40px 24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Sparkles size={32} color="#6366f1" />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                  Find Your Perfect Market
                </h1>
                <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                  Ask me anything about real estate markets. I'll research current data and trends to help you find the best investment opportunities.
                </p>
              </div>

              {/* Suggestion Cards */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '16px',
                marginBottom: '32px'
              }}>
                {SUGGESTIONS.map((suggestion, idx) => {
                  const Icon = suggestion.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: '20px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: `${suggestion.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px'
                      }}>
                        <Icon size={20} color={suggestion.color} />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>
                        {suggestion.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                        {suggestion.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              {messages.map((message, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    marginBottom: '24px',
                    display: 'flex',
                    gap: '12px'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: message.role === 'user' ? '#3b82f6' : '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {message.role === 'user' ? (
                      <Users size={18} color="#fff" />
                    ) : (
                      <Sparkles size={18} color="#fff" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div style={{
                    flex: 1,
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: message.role === 'user' ? '#eff6ff' : 'white',
                    border: message.role === 'user' ? '1px solid #bfdbfe' : '1px solid #e5e7eb'
                  }}>
                    {message.role === 'user' ? (
                      <div style={{ color: '#1e40af', fontSize: '15px', lineHeight: '1.6' }}>
                        {message.content}
                      </div>
                    ) : (
                      <div style={{ color: '#374151', fontSize: '15px', lineHeight: '1.7' }}>
                        {message.reportData ? (
                          // Show rich market report with visualizations
                          <MarketReportDisplay reportData={message.reportData} />
                        ) : (
                          // Show markdown for regular responses
                          <ReactMarkdown
                            components={{
                              h1: ({children}) => <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '12px' }}>{children}</h1>,
                              h2: ({children}) => <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>{children}</h2>,
                              h3: ({children}) => <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginTop: '16px', marginBottom: '8px' }}>{children}</h3>,
                              p: ({children}) => <p style={{ marginBottom: '12px' }}>{children}</p>,
                              ul: ({children}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ul>,
                              ol: ({children}) => <ol style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ol>,
                              li: ({children}) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                              strong: ({children}) => <strong style={{ color: '#111827', fontWeight: '600' }}>{children}</strong>
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={18} color="#fff" />
                  </div>
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#6b7280'
                  }}>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Researching markets...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - Fixed at bottom */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any market, state, or investment strategy..."
                rows={1}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '15px',
                  color: '#111827',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: '1.5',
                  minHeight: '24px',
                  maxHeight: '120px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: isLoading || !input.trim() ? '#e5e7eb' : '#6366f1',
                  color: 'white',
                  border: 'none',
                  cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                {isLoading ? (
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: '10px', 
              fontSize: '12px', 
              color: '#9ca3af' 
            }}>
              Powered by Perplexity AI • Data may not reflect current market conditions
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MarketResearchPage;
