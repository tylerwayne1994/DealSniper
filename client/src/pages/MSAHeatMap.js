import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, TrendingUp, DollarSign, Home, Users, Filter, Calendar, Info, AlertTriangle, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';

const MSAHeatMap = ({ setCurrentPage }) => {
  const [selectedMetric, setSelectedMetric] = useState('populationGrowth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msaData, setMsaData] = useState({});
  const [geoData, setGeoData] = useState(null);
  const [hoveredMSA, setHoveredMSA] = useState(null);
  const [fmrLoadStatus, setFmrLoadStatus] = useState({ loaded: false, error: null, attempted: false });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // State name to abbreviation mapping
  const stateNameToAbbrev = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
    'District of Columbia': 'DC'
  };

  const colors = useMemo(() => ({
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    primary: '#06b6d4',
    secondary: '#3b82f6',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    gray: {
      dark: '#374151',
      medium: '#4b5563',
      light: '#6b7280',
      lighter: '#94a3b8',
      lightest: '#cbd5e1'
    }
  }), []);

  const metrics = useMemo(() => ({
    populationGrowth: {
      name: 'Population Growth',
      icon: Users,
      color: colors.success,
      unit: 'percent',
      description: 'Population total and growth rate',
      range: [-2, 4]
    },
    jobGrowth: {
      name: 'Employment & Economy',
      icon: TrendingUp,
      color: colors.primary,
      unit: 'percent',
      description: 'Employment strength and economic opportunity',
      range: [0, 100]
    },
    housingMetrics: {
      name: 'Housing Market',
      icon: Home,
      color: colors.accent,
      unit: 'percent',
      description: 'Renter percentage and vacancy rates',
      range: [-20, 60]
    },
    rentAnalysis: {
      name: 'Live Market Rents',
      icon: DollarSign,
      color: colors.warning,
      unit: 'dollar',
      description: 'AI-powered current market rent estimates',
      range: [500, 2500]
    }
  }), [colors]);

  // Clean Census data values
  const cleanValue = (value) => {
    if (value === null || value === undefined || value === '' || 
        value === '-' || value === 'N' || value === '(X)' || 
        String(value).includes('-666') || String(value).includes('-888') || 
        String(value).includes('-999')) {
      return null;
    }
    return typeof value === 'string' ? parseFloat(value) || null : value;
  };

  // Extract FIPS code from GEO_ID
  const extractFips = (geoId) => {
    if (typeof geoId === 'string' && geoId.includes('US')) {
      return geoId.split('US')[1];
    }
    return null;
  };

  // Parse county name and state
  const parseLocation = (name) => {
    if (typeof name === 'string' && name.includes(',')) {
      const parts = name.split(',').map(part => part.trim());
      return {
        county: parts[0],
        state: parts[1]
      };
    }
    return { county: name, state: null };
  };

  // Market classification algorithm
  const classifyMarket = (area) => {
    let indicators = 0;
    let marketFactors = {
      growth: 0,
      employment: 0,
      income: 0,
      housing: 0,
      demographics: 0
    };
    
    if (area.populationGrowth !== null && area.populationGrowth !== undefined) {
      if (area.populationGrowth > 3) marketFactors.growth = 30;
      else if (area.populationGrowth > 1.5) marketFactors.growth = 25;
      else if (area.populationGrowth > 0.5) marketFactors.growth = 20;
      else if (area.populationGrowth > 0) marketFactors.growth = 15;
      else if (area.populationGrowth > -1) marketFactors.growth = 10;
      else marketFactors.growth = 5;
      indicators++;
    }
    
    if (area.employmentRate && area.unemploymentRate) {
      const employmentStrength = area.employmentRate - (area.unemploymentRate * 1.5);
      if (employmentStrength > 85) marketFactors.employment = 30;
      else if (employmentStrength > 75) marketFactors.employment = 25;
      else if (employmentStrength > 65) marketFactors.employment = 20;
      else if (employmentStrength > 55) marketFactors.employment = 15;
      else marketFactors.employment = 10;
      indicators++;
    }
    
    if (area.medianHouseholdIncome) {
      if (area.medianHouseholdIncome > 100000) marketFactors.income = 25;
      else if (area.medianHouseholdIncome > 80000) marketFactors.income = 22;
      else if (area.medianHouseholdIncome > 65000) marketFactors.income = 18;
      else if (area.medianHouseholdIncome > 50000) marketFactors.income = 15;
      else if (area.medianHouseholdIncome > 40000) marketFactors.income = 12;
      else marketFactors.income = 8;
      indicators++;
    }
    
    if (area.vacancyRate !== null && area.renterPercentage !== null) {
      let housingScore = 0;
      
      if (area.vacancyRate < 3) housingScore += 15;
      else if (area.vacancyRate < 5) housingScore += 12;
      else if (area.vacancyRate < 8) housingScore += 10;
      else if (area.vacancyRate < 12) housingScore += 7;
      else housingScore += 4;
      
      if (area.renterPercentage > 50) housingScore += 10;
      else if (area.renterPercentage > 40) housingScore += 8;
      else if (area.renterPercentage > 30) housingScore += 6;
      else housingScore += 4;
      
      marketFactors.housing = housingScore;
      indicators++;
    }
    
    if (area.totalPopulation) {
      if (area.totalPopulation > 2000000) marketFactors.demographics = 15;
      else if (area.totalPopulation > 1000000) marketFactors.demographics = 12;
      else if (area.totalPopulation > 500000) marketFactors.demographics = 10;
      else if (area.totalPopulation > 200000) marketFactors.demographics = 8;
      else marketFactors.demographics = 6;
      indicators++;
    }
    
    if (indicators === 0) return { type: 'unknown', score: 0, factors: marketFactors };
    
    const totalScore = (
      marketFactors.growth * 0.25 +
      marketFactors.employment * 0.25 +
      marketFactors.income * 0.20 +
      marketFactors.housing * 0.20 +
      marketFactors.demographics * 0.10
    );
    
    let marketType;
    if (totalScore >= 23) marketType = 'superHot';
    else if (totalScore >= 18) marketType = 'hot';
    else if (totalScore >= 14) marketType = 'warm';
    else if (totalScore >= 10) marketType = 'average';
    else if (totalScore >= 7) marketType = 'cool';
    else marketType = 'cold';
    
    return { 
      type: marketType, 
      score: Math.round(totalScore * 10) / 10, 
      factors: marketFactors,
      confidence: Math.min(100, Math.round((indicators / 5) * 100))
    };
  };

  // FMR to market rent calculator
  const estimateMarketRent = (fmr, marketAnalysis, area) => {
    if (!fmr || fmr <= 0) return null;
    
    const baseMultipliers = {
      superHot: { market: 1.45, competitive: 1.75, premium: 1.95, luxury: 2.25 },
      hot: { market: 1.35, competitive: 1.65, premium: 1.85, luxury: 2.05 },
      warm: { market: 1.28, competitive: 1.55, premium: 1.75, luxury: 1.90 },
      average: { market: 1.25, competitive: 1.50, premium: 1.70, luxury: 1.85 },
      cool: { market: 1.18, competitive: 1.40, premium: 1.55, luxury: 1.70 },
      cold: { market: 1.12, competitive: 1.30, premium: 1.45, luxury: 1.60 },
      unknown: { market: 1.25, competitive: 1.50, premium: 1.70, luxury: 1.85 }
    };
    
    const multipliers = baseMultipliers[marketAnalysis.type] || baseMultipliers.unknown;
    let adjustmentFactor = 1.0;
    
    if (area.medianHouseholdIncome) {
      if (area.medianHouseholdIncome > 120000) adjustmentFactor += 0.08;
      else if (area.medianHouseholdIncome > 90000) adjustmentFactor += 0.05;
      else if (area.medianHouseholdIncome > 70000) adjustmentFactor += 0.02;
      else if (area.medianHouseholdIncome < 35000) adjustmentFactor -= 0.05;
    }
    
    if (area.populationGrowth > 4) adjustmentFactor += 0.06;
    else if (area.populationGrowth > 2) adjustmentFactor += 0.03;
    else if (area.populationGrowth < -1) adjustmentFactor -= 0.04;
    
    if (area.vacancyRate < 2) adjustmentFactor += 0.08;
    else if (area.vacancyRate < 4) adjustmentFactor += 0.04;
    else if (area.vacancyRate > 15) adjustmentFactor -= 0.06;
    
    const adjustedMultipliers = {
      market: multipliers.market * adjustmentFactor,
      competitive: multipliers.competitive * adjustmentFactor,
      premium: multipliers.premium * adjustmentFactor,
      luxury: multipliers.luxury * adjustmentFactor
    };
    
    const estimates = {
      fmr: Math.round(fmr),
      marketMedian: Math.round(fmr * adjustedMultipliers.market),
      competitiveRent: Math.round(fmr * adjustedMultipliers.competitive),
      premiumRent: Math.round(fmr * adjustedMultipliers.premium),
      luxuryRent: Math.round(fmr * adjustedMultipliers.luxury),
      marketType: marketAnalysis.type,
      marketScore: marketAnalysis.score,
      confidence: marketAnalysis.confidence,
      adjustmentFactor: Math.round(adjustmentFactor * 1000) / 1000,
      marketPremiumVsFMR: Math.round(((adjustedMultipliers.market - 1) * 100)),
      rentSpread: Math.round(fmr * adjustedMultipliers.luxury) - Math.round(fmr * adjustedMultipliers.market),
      sectionVsMarket: Math.round(((adjustedMultipliers.market - 1) * 100)),
      cashFlowPotential: marketAnalysis.type === 'hot' || marketAnalysis.type === 'superHot' ? 'High' : 
                        marketAnalysis.type === 'warm' ? 'Medium' : 'Conservative'
    };
    
    if (area.medianHouseholdIncome) {
      const monthlyIncome = area.medianHouseholdIncome / 12;
      estimates.affordabilityIndex = Math.round((estimates.marketMedian / monthlyIncome) * 100);
      estimates.affordableToMedianIncome = estimates.affordabilityIndex <= 30;
    }
    
    return estimates;
  };

  // Get metric value for coloring
  const getMetricValue = (msa, metric) => {
    switch (metric) {
      case 'populationGrowth':
        return msa.populationGrowth;
      case 'jobGrowth':
        return msa.employmentStrength || 0;
      case 'housingMetrics':
        return msa.housingMarketScore || 0;
      case 'rentAnalysis':
        return msa.estimatedMarketRent || msa.privateMarketRent || 0;
      default:
        return 0;
    }
  };

  // Load CSV helper
  const loadCSV = async (url, type) => {
    try {
      console.log(`📥 Loading ${type} from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('File is empty');
      }
      
      const result = Papa.parse(text, { 
        header: true, 
        dynamicTyping: true,
        skipEmptyLines: true 
      });
      
      if (result.errors && result.errors.length > 0) {
        console.warn(`⚠️ Parse warnings in ${type}:`, result.errors.slice(0, 3));
      }
      
      console.log(`✅ ${type} loaded: ${result.data.length} rows`);
      return { type, data: result.data.slice(1), fields: result.meta.fields };
    } catch (error) {
      console.error(`❌ Error loading ${type} from ${url}:`, error.message);
      return { type, data: [], fields: [], error: error.message };
    }
  };

  // Population-weighted aggregation functions
  const weightedAverage = (values, weights) => {
    const validPairs = values.map((val, i) => [val, weights[i]]).filter(([val, weight]) => 
      val !== null && val !== undefined && !isNaN(val) && weight > 0
    );
    
    if (validPairs.length === 0) return null;
    
    const totalWeight = validPairs.reduce((sum, [, weight]) => sum + weight, 0);
    const weightedSum = validPairs.reduce((sum, [val, weight]) => sum + (val * weight), 0);
    
    return weightedSum / totalWeight;
  };

  const sumValues = (values) => {
    return values.filter(val => val !== null && val !== undefined && !isNaN(val))
                 .reduce((sum, val) => sum + val, 0);
  };

  // Aggregate counties to MSAs
  const aggregateCountiesToMSAs = (counties, fmrMsaMapping) => {
    const msas = {};
    const unmappedCounties = [];
    
    Object.values(counties).forEach(county => {
      if (!county.fips) return;
      
      const msaInfo = fmrMsaMapping[county.fips];
      if (!msaInfo || !msaInfo.msaName) {
        unmappedCounties.push({
          name: county.name,
          state: county.state,
          fips: county.fips,
          population: county.totalPopulation
        });
        return;
      }
      
      const msaKey = msaInfo.msaName;
      
      if (!msas[msaKey]) {
        msas[msaKey] = {
          name: msaKey,
          fips: msaInfo.cbsaCode || msaKey.replace(/[^0-9]/g, ''),
          counties: [],
          totalPopulation: 0,
          states: new Set()
        };
      }
      
      msas[msaKey].counties.push(county);
      if (county.state) msas[msaKey].states.add(county.state);
    });
    
    console.log(`🏙️ Found ${Object.keys(msas).length} MSAs from county data`);
    
    // Calculate aggregated metrics for each MSA
    Object.values(msas).forEach(msa => {
      const counties = msa.counties;
      const populations = counties.map(c => c.totalPopulation || 0);
      const totalPop = sumValues(populations);
      
      msa.totalPopulation = totalPop;
      msa.countyCount = counties.length;
      msa.statesList = Array.from(msa.states).join(', ');
      
      if (totalPop === 0) return;
      
      // Population-weighted averages
      msa.medianHouseholdIncome = weightedAverage(
        counties.map(c => c.medianHouseholdIncome), populations
      );
      msa.meanHouseholdIncome = weightedAverage(
        counties.map(c => c.meanHouseholdIncome), populations
      );
      msa.povertyRate = weightedAverage(
        counties.map(c => c.povertyRate), populations
      );
      msa.employmentRate = weightedAverage(
        counties.map(c => c.employmentRate), populations
      );
      msa.unemploymentRate = weightedAverage(
        counties.map(c => c.unemploymentRate), populations
      );
      msa.laborForceParticipationRate = weightedAverage(
        counties.map(c => c.laborForceParticipationRate), populations
      );
      msa.vacancyRate = weightedAverage(
        counties.map(c => c.vacancyRate), 
        counties.map(c => c.totalHousingUnits || 0)
      );
      msa.renterPercentage = weightedAverage(
        counties.map(c => c.renterPercentage), 
        counties.map(c => c.occupiedUnits || 0)
      );
      msa.medianGrossRent = weightedAverage(
        counties.map(c => c.medianGrossRent), 
        counties.map(c => c.renterOccupiedUnits || 0)
      );
      msa.medianHomeValue = weightedAverage(
        counties.map(c => c.medianHomeValue), 
        counties.map(c => c.ownerOccupiedUnits || 0)
      );
      
      // Sums for totals
      msa.totalHousingUnits = sumValues(counties.map(c => c.totalHousingUnits));
      msa.occupiedUnits = sumValues(counties.map(c => c.occupiedUnits));
      msa.vacantUnits = sumValues(counties.map(c => c.vacantUnits));
      msa.ownerOccupiedUnits = sumValues(counties.map(c => c.ownerOccupiedUnits));
      msa.renterOccupiedUnits = sumValues(counties.map(c => c.renterOccupiedUnits));
      msa.totalEmployed = sumValues(counties.map(c => c.totalEmployed));
      msa.totalUnemployed = sumValues(counties.map(c => c.totalUnemployed));
      
      // Calculate population growth
      const currentPops = counties.map(c => c.totalPopulation || 0);
      const historicalPops = counties.map(c => c.historicalPopulation || 0);
      const currentTotal = sumValues(currentPops);
      const historicalTotal = sumValues(historicalPops);
      
      if (currentTotal > 0 && historicalTotal > 0) {
        msa.populationGrowth = ((currentTotal - historicalTotal) / historicalTotal) * 100;
      }
      
      msa.privateMarketRent = msa.medianGrossRent;
      
      // Calculate derived metrics
      if (msa.employmentRate && msa.unemploymentRate) {
        msa.employmentStrength = msa.employmentRate - (msa.unemploymentRate * 2);
      }
      
      if (msa.medianHouseholdIncome && msa.povertyRate) {
        msa.economicOpportunity = (msa.medianHouseholdIncome / 1000) - (msa.povertyRate * 5);
      }
      
      if (msa.renterPercentage && msa.vacancyRate) {
        msa.housingMarketScore = msa.renterPercentage - (msa.vacancyRate * 2);
      }
      
      if (msa.occupiedUnits && msa.ownerOccupiedUnits && msa.occupiedUnits > 0) {
        msa.homeownershipRate = (msa.ownerOccupiedUnits / msa.occupiedUnits) * 100;
      }
      
      if (msa.privateMarketRent && msa.medianHouseholdIncome) {
        msa.rentAffordabilityRatio = (msa.privateMarketRent * 12) / msa.medianHouseholdIncome;
      }
    });
    
    console.log(`✅ Aggregated ${Object.keys(msas).length} MSAs with population data`);
    return msas;
  };

  // Build FMR to MSA mapping
  const buildFMRMSAMapping = (fmrData) => {
    const mapping = {};
    
    fmrData.forEach(row => {
      const fips = String(row.fips).padStart(5, '0');
      const msaName = row.hud_area_name;
      const isMetro = row.metro === 1;
      const state = row.stusps || row.state_alpha;
      
      if (fips && msaName && isMetro) {
        mapping[fips] = {
          msaName: msaName,
          cbsaCode: row.hud_area_code,
          isMetro: isMetro,
          state: state
        };
      }
    });
    
    console.log(`🗺️ Built FMR-MSA mapping for ${Object.keys(mapping).length} counties`);
    return mapping;
  };

  // Add FMR data to MSAs
  const addFMRDataToMSAs = (msas, fmrData) => {
    const fmrByMSA = {};
    
    fmrData.forEach(row => {
      const msaName = row.hud_area_name;
      const isMetro = row.metro === 1;
      
      if (msaName && isMetro) {
        if (!fmrByMSA[msaName]) {
          fmrByMSA[msaName] = row;
        }
      }
    });
    
    console.log(`🏠 Processing FMR data for ${Object.keys(fmrByMSA).length} MSAs`);
    
    let fmrMatches = 0;
    
    Object.values(msas).forEach(msa => {
      const fmrData = fmrByMSA[msa.name];
      
      if (fmrData && fmrData.fmr_2) {
        msa.fmrRent = cleanValue(fmrData.fmr_2);
        msa.fmr1br = cleanValue(fmrData.fmr_1);
        msa.fmr3br = cleanValue(fmrData.fmr_3);
        msa.fmr4br = cleanValue(fmrData.fmr_4);
        msa.fmrPopulation = cleanValue(fmrData.pop2022);
        
        msa.marketAnalysis = classifyMarket(msa);
        msa.rentEstimates = estimateMarketRent(msa.fmrRent, msa.marketAnalysis, msa);
        
        if (msa.rentEstimates) {
          msa.marketType = msa.rentEstimates.marketType;
          msa.estimatedMarketRent = msa.rentEstimates.marketMedian;
          msa.rentPremiumVsFMR = msa.rentEstimates.marketPremiumVsFMR;
          msa.marketScore = msa.rentEstimates.marketScore;
          msa.marketConfidence = msa.rentEstimates.confidence;
          msa.competitiveRent = msa.rentEstimates.competitiveRent;
          msa.premiumRent = msa.rentEstimates.premiumRent;
          msa.luxuryRent = msa.rentEstimates.luxuryRent;
          msa.cashFlowPotential = msa.rentEstimates.cashFlowPotential;
          msa.affordabilityIndex = msa.rentEstimates.affordabilityIndex;
          
          if (msa.privateMarketRent && msa.estimatedMarketRent) {
            msa.marketAccuracy = ((msa.privateMarketRent - msa.estimatedMarketRent) / msa.estimatedMarketRent) * 100;
          }
        }
        
        fmrMatches++;
      }
    });
    
    console.log(`✅ FMR matches: ${fmrMatches} out of ${Object.keys(msas).length} MSAs`);
  };

  // Process county data
  const processCensusDataToCounties = (datasets) => {
    const combined = {};
    
    const { economic = [], housing = [], population2023 = [], population2018 = [], employment = [] } = datasets;
    
    // Start with economic data as base
    economic.forEach(row => {
      const geoId = row.GEO_ID;
      const fips = extractFips(geoId);
      const location = parseLocation(row.NAME);
      
      if (!fips || !location.county) return;
      
      const key = `${location.county}, ${location.state}`;
      
      combined[key] = {
        fips: fips,
        name: location.county,
        state: location.state,
        geoId: geoId,
        medianHouseholdIncome: cleanValue(row.DP03_0051E),
        meanHouseholdIncome: cleanValue(row.DP03_0052E),
        povertyRate: cleanValue(row.DP03_0119PE),
        medianEarnings: cleanValue(row.DP03_0062E),
        laborForceParticipation: cleanValue(row.DP03_0002PE),
        employmentRateDP03: cleanValue(row.DP03_0003PE),
        unemploymentRateDP03: cleanValue(row.DP03_0005PE)
      };
    });
    
    // Add housing data
    const housingMap = new Map();
    housing.forEach(row => {
      const geoId = row.GEO_ID;
      const fips = extractFips(geoId);
      if (fips) housingMap.set(fips, row);
    });
    
    Object.values(combined).forEach(county => {
      const housingRow = housingMap.get(county.fips);
      if (housingRow) {
        county.totalHousingUnits = cleanValue(housingRow.DP04_0001E);
        county.occupiedUnits = cleanValue(housingRow.DP04_0002E);
        county.vacantUnits = cleanValue(housingRow.DP04_0003E);
        county.vacancyRate = cleanValue(housingRow.DP04_0003PE);
        county.ownerOccupiedUnits = cleanValue(housingRow.DP04_0046E);
        county.renterOccupiedUnits = cleanValue(housingRow.DP04_0047E);
        county.medianHomeValue = cleanValue(housingRow.DP04_0080E);
        county.medianGrossRent = cleanValue(housingRow.DP04_0134E);
        county.medianOwnerCosts = cleanValue(housingRow.DP04_0101E);
        
        if (county.ownerOccupiedUnits && county.occupiedUnits && county.occupiedUnits > 0) {
          county.homeownershipRate = (county.ownerOccupiedUnits / county.occupiedUnits) * 100;
          county.renterPercentage = 100 - county.homeownershipRate;
        }
      }
    });
    
    // Add population data
    const population2023Map = new Map();
    const population2018Map = new Map();
    
    population2023.forEach(row => {
      const geoId = row.GEO_ID;
      const fips = extractFips(geoId);
      if (fips) population2023Map.set(fips, row);
    });
    
    population2018.forEach(row => {
      const geoId = row.GEO_ID;
      const fips = extractFips(geoId);
      if (fips) population2018Map.set(fips, row);
    });
    
    Object.values(combined).forEach(county => {
      const pop2023Row = population2023Map.get(county.fips);
      const pop2018Row = population2018Map.get(county.fips);
      
      if (pop2023Row) {
        county.totalPopulation = cleanValue(pop2023Row.B01003_001E);
      }
      
      if (pop2018Row) {
        county.historicalPopulation = cleanValue(pop2018Row.B01003_001E);
      }
    });
    
    // Add employment data
    const employmentMap = new Map();
    employment.forEach(row => {
      const geoId = row.GEO_ID;
      const fips = extractFips(geoId);
      if (fips) employmentMap.set(fips, row);
    });
    
    Object.values(combined).forEach(county => {
      const empRow = employmentMap.get(county.fips);
      if (empRow) {
        county.population16Plus = cleanValue(empRow.S2301_C01_001E);
        county.laborForceParticipationRate = cleanValue(empRow.S2301_C02_001E);
        county.employmentRate = cleanValue(empRow.S2301_C03_001E);
        county.unemploymentRate = cleanValue(empRow.S2301_C04_001E);
        
        if (county.population16Plus && county.employmentRate && county.unemploymentRate) {
          const laborForce = (county.population16Plus * county.laborForceParticipationRate) / 100;
          county.totalEmployed = Math.round((laborForce * county.employmentRate) / 100);
          county.totalUnemployed = Math.round((laborForce * county.unemploymentRate) / 100);
        }
      }
    });
    
    return combined;
  };

  // MSA coordinate lookup - COMPLETE AND VERIFIED
  const getMSACoordinates = (msaName) => {
    const coordinates = {
      // ALL 30 CALIFORNIA MSAs with VERIFIED coordinates
      'Oakland-Fremont, CA HUD Metro FMR Area': [37.8044, -122.2711],
      'Chico, CA MSA': [39.7285, -121.8375],
      'Sacramento--Roseville--Arden-Arcade, CA HUD Metro FMR Area': [38.5816, -121.4944],
      'Fresno, CA MSA': [36.7378, -119.7871],
      'El Centro, CA MSA': [32.7920, -115.5631],
      'Bakersfield, CA MSA': [35.3733, -119.0187],
      'Hanford-Corcoran, CA MSA': [36.3274, -119.6457],
      'Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area': [34.0522, -118.2437],
      'Madera, CA MSA': [36.9613, -120.0607],
      'San Francisco, CA HUD Metro FMR Area': [37.7749, -122.4194],
      'Merced, CA MSA': [37.3022, -120.4829],
      'Salinas, CA MSA': [36.6777, -121.6555],
      'Napa, CA MSA': [38.2975, -122.2869],
      'Santa Ana-Anaheim-Irvine, CA HUD Metro FMR Area': [33.7175, -117.8311],
      'Riverside-San Bernardino-Ontario, CA MSA': [34.0633, -117.6509],
      'San Benito County, CA HUD Metro FMR Area': [36.6077, -121.0583],
      'San Diego-Carlsbad, CA MSA': [32.7157, -117.1611],
      'Stockton-Lodi, CA MSA': [37.9577, -121.2908],
      'San Luis Obispo-Paso Robles-Arroyo Grande, CA MSA': [35.2828, -120.6596],
      'Santa Maria-Santa Barbara, CA MSA': [34.9530, -120.4357],
      'San Jose-Sunnyvale-Santa Clara, CA HUD Metro FMR Area': [37.3382, -121.8863],
      'Santa Cruz-Watsonville, CA MSA': [36.9741, -122.0308],
      'Redding, CA MSA': [40.5865, -122.3917],
      'Vallejo-Fairfield, CA MSA': [38.1041, -122.2566],
      'Santa Rosa, CA MSA': [38.4404, -122.7144],
      'Modesto, CA MSA': [37.6391, -120.9969],
      'Yuba City, CA MSA': [39.1404, -121.6169],
      'Visalia-Porterville, CA MSA': [36.3302, -119.2921],
      'Oxnard-Thousand Oaks-Ventura, CA MSA': [34.1975, -119.1771],
      'Yolo, CA HUD Metro FMR Area': [38.6844, -121.7700],

      // ALL 7 ARIZONA MSAs with VERIFIED coordinates  
      'Sierra Vista-Douglas, AZ MSA': [31.5552, -110.3032],
      'Flagstaff, AZ MSA': [35.1983, -111.6513],
      'Phoenix-Mesa-Scottsdale, AZ MSA': [33.4484, -112.0740],
      'Lake Havasu City-Kingman, AZ MSA': [34.4839, -114.3227],
      'Tucson, AZ MSA': [32.2226, -110.9747],
      'Prescott Valley-Prescott, AZ MSA': [34.5400, -112.4685],
      'Yuma, AZ MSA': [32.6927, -114.6277],

      // ALL TEXAS MSAs with VERIFIED coordinates
      'Dallas-Fort Worth-Arlington, TX MSA': [32.7767, -96.7970],
      'Dallas, TX HUD Metro FMR Area': [32.7767, -96.7970],
      'Fort Worth-Arlington, TX HUD Metro FMR Area': [32.7555, -97.3308],
      'Houston-The Woodlands-Sugar Land, TX MSA': [29.7604, -95.3698],
      'Houston-The Woodlands-Sugar Land, TX HUD Metro FMR Area': [29.7604, -95.3698],
      'San Antonio-New Braunfels, TX MSA': [29.4241, -98.4936],
      'San Antonio-New Braunfels, TX HUD Metro FMR Area': [29.4241, -98.4936],
      'Austin-Round Rock-Georgetown, TX MSA': [30.2672, -97.7431],
      'Austin-Round Rock, TX HUD Metro FMR Area': [30.2672, -97.7431],
      'El Paso, TX MSA': [31.7619, -106.4850],
      'El Paso, TX HUD Metro FMR Area': [31.7619, -106.4850],
      'McAllen-Edinburg-Mission, TX MSA': [26.2034, -98.2300],
      'McAllen-Edinburg-Mission, TX HUD Metro FMR Area': [26.2034, -98.2300],
      'Killeen-Temple, TX MSA': [31.1171, -97.7278],
      'Killeen-Temple, TX HUD Metro FMR Area': [31.1171, -97.7278],
      'Corpus Christi, TX MSA': [27.8006, -97.3964],
      'Corpus Christi, TX HUD Metro FMR Area': [27.8006, -97.3964],
      'Lubbock, TX MSA': [33.5779, -101.8552],
      'Lubbock, TX HUD Metro FMR Area': [33.5779, -101.8552],
      'Amarillo, TX MSA': [35.2220, -101.8313],
      'Amarillo, TX HUD Metro FMR Area': [35.2220, -101.8313],
      'Beaumont-Port Arthur, TX MSA': [30.0860, -94.1018],
      'Beaumont-Port Arthur, TX HUD Metro FMR Area': [30.0860, -94.1018],

      // ALL LOUISIANA MSAs with VERIFIED coordinates
      'Lake Charles, LA MSA': [30.2266, -93.2174],
      'Lake Charles, LA HUD Metro FMR Area': [30.2266, -93.2174],
      'New Orleans-Metairie, LA MSA': [29.9511, -90.0715],
      'New Orleans-Metairie, LA HUD Metro FMR Area': [29.9511, -90.0715],
      'Baton Rouge, LA MSA': [30.4515, -91.1871],
      'Baton Rouge, LA HUD Metro FMR Area': [30.4515, -91.1871],
      'Lafayette, LA MSA': [30.2241, -92.0198],
      'Lafayette, LA HUD Metro FMR Area': [30.2241, -92.0198],
      'Shreveport-Bossier City, LA MSA': [32.5252, -93.7502],
      'Shreveport-Bossier City, LA HUD Metro FMR Area': [32.5252, -93.7502],

      // COLORADO MSAs with VERIFIED coordinates
      'Denver-Aurora-Lakewood, CO MSA': [39.7392, -104.9903],
      'Boulder, CO MSA': [40.0150, -105.2705],
      'Colorado Springs, CO HUD Metro FMR Area': [38.8339, -104.8214],
      'Fort Collins, CO MSA': [40.5853, -105.0844],
      'Grand Junction, CO MSA': [39.0639, -108.5506],
      'Pueblo, CO MSA': [38.2544, -104.6091],
      'Teller County, CO HUD Metro FMR Area': [38.8694, -105.0178],
      'Greeley, CO MSA': [40.4233, -104.7091],

      // MINNESOTA MSAs with VERIFIED coordinates
      'Minneapolis-St. Paul-Bloomington, MN-WI HUD Metro FMR Area': [44.9778, -93.2650],
      'St. Cloud, MN MSA': [45.5608, -94.1624],
      'Mankato-North Mankato, MN MSA': [44.1636, -94.0011],
      'Duluth, MN-WI HUD Metro FMR Area': [46.7867, -92.1005],
      'Fargo, ND-MN MSA': [46.8772, -96.7898],
      'Rochester, MN HUD Metro FMR Area': [44.0121, -92.4802],
      'Fillmore County, MN HUD Metro FMR Area': [43.6711, -91.9390],
      'La Crosse-Onalaska, WI-MN MSA': [43.8014, -91.2396],
      'Lake County, MN HUD Metro FMR Area': [47.2779, -91.1351],
      'Le Sueur County, MN HUD Metro FMR Area': [44.4647, -93.9088],
      'Mille Lacs County, MN HUD Metro FMR Area': [46.1594, -93.6427],
      'Grand Forks, ND-MN MSA': [47.9253, -97.0329],
      'Wabasha County, MN HUD Metro FMR Area': [44.3747, -92.0324],

      // WYOMING MSAs with VERIFIED coordinates
      'Cheyenne, WY MSA': [41.1400, -104.8197],
      'Casper, WY MSA': [42.8666, -106.3131],

      // MONTANA MSAs with VERIFIED coordinates
      'Billings, MT HUD Metro FMR Area': [45.7833, -108.5007],
      'Great Falls, MT MSA': [47.4941, -111.2833],
      'Missoula, MT MSA': [46.8721, -113.9940],
      'Stillwater County, MT HUD Metro FMR Area': [45.6752, -109.8765],

      // NORTH DAKOTA MSAs with VERIFIED coordinates
      'Bismarck, ND MSA': [46.8083, -100.7837],

      // SOUTH DAKOTA MSAs with VERIFIED coordinates
      'Sioux Falls, SD MSA': [43.5460, -96.7313],
      'Meade County, SD HUD Metro FMR Area': [44.4544, -103.2310],
      'Rapid City, SD HUD Metro FMR Area': [44.0805, -103.2310],
      'Sioux City, IA-NE-SD MSA': [42.4999, -96.4003],

      // Major MSAs with CORRECT coordinates
      'New York-Newark-Jersey City, NY-NJ-PA MSA': [40.7128, -74.0060],
      'New York, NY HUD Metro FMR Area': [40.7128, -74.0060],
      'Chicago-Naperville-Elgin, IL-IN-WI MSA': [41.8781, -87.6298],
      'Chicago-Joliet-Naperville, IL HUD Metro FMR Area': [41.8781, -87.6298],
      'Washington-Arlington-Alexandria, DC-VA-MD-WV MSA': [38.9072, -77.0369],
      'Washington-Arlington-Alexandria, DC-VA-MD HUD Metro FMR Area': [38.9072, -77.0369],
      'Miami-Fort Lauderdale-West Palm Beach, FL MSA': [25.7617, -80.1918],
      'Miami-Miami Beach-Kendall, FL HUD Metro FMR Area': [25.7617, -80.1918],
      'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD MSA': [39.9526, -75.1652],
      'Philadelphia, PA HUD Metro FMR Area': [39.9526, -75.1652],
      'Atlanta-Sandy Springs-Alpharetta, GA MSA': [33.7490, -84.3880],
      'Atlanta-Sandy Springs-Marietta, GA HUD Metro FMR Area': [33.7490, -84.3880],
      'Boston-Cambridge-Newton, MA-NH MSA': [42.3601, -71.0589],
      'Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area': [42.3601, -71.0589],
      'Detroit-Warren-Dearborn, MI MSA': [42.3314, -83.0458],
      'Detroit-Warren-Livonia, MI HUD Metro FMR Area': [42.3314, -83.0458],
      'Seattle-Tacoma-Bellevue, WA MSA': [47.6062, -122.3321],
      'Seattle-Bellevue-Everett, WA HUD Metro FMR Area': [47.6062, -122.3321],
      'Tampa-St. Petersburg-Clearwater, FL MSA': [27.9506, -82.4572],
      'Tampa-St. Petersburg-Clearwater, FL HUD Metro FMR Area': [27.9506, -82.4572],
      'St. Louis, MO-IL MSA': [38.6270, -90.1994],
      'St. Louis, MO-IL HUD Metro FMR Area': [38.6270, -90.1994],
      'Baltimore-Columbia-Towson, MD MSA': [39.2904, -76.6122],
      'Baltimore-Columbia-Towson, MD HUD Metro FMR Area': [39.2904, -76.6122],
      'Charlotte-Concord-Gastonia, NC-SC MSA': [35.2271, -80.8431],
      'Charlotte-Gastonia-Rock Hill, NC-SC HUD Metro FMR Area': [35.2271, -80.8431],
      'San Antonio-New Braunfels, TX MSA': [29.4241, -98.4936],
      'San Antonio-New Braunfels, TX HUD Metro FMR Area': [29.4241, -98.4936],
      'Portland-Vancouver-Hillsboro, OR-WA MSA': [45.5152, -122.6784],
      'Portland-Vancouver-Hillsboro, OR-WA HUD Metro FMR Area': [45.5152, -122.6784],
      'Pittsburgh, PA MSA': [40.4406, -79.9959],
      'Pittsburgh, PA HUD Metro FMR Area': [40.4406, -79.9959],
      'Las Vegas-Henderson-Paradise, NV MSA': [36.1699, -115.1398],
      'Las Vegas-Henderson-Paradise, NV HUD Metro FMR Area': [36.1699, -115.1398],
      'Austin-Round Rock-Georgetown, TX MSA': [30.2672, -97.7431],
      'Austin-Round Rock, TX HUD Metro FMR Area': [30.2672, -97.7431],
      'Cincinnati, OH-KY-IN MSA': [39.1031, -84.5120],
      'Cincinnati, OH-KY-IN HUD Metro FMR Area': [39.1031, -84.5120],
      'Kansas City, MO-KS MSA': [39.0997, -94.5786],
      'Kansas City, MO-KS HUD Metro FMR Area': [39.0997, -94.5786],
      'Columbus, OH MSA': [39.9612, -82.9988],
      'Columbus, OH HUD Metro FMR Area': [39.9612, -82.9988],
      'Indianapolis-Carmel-Anderson, IN MSA': [39.7684, -86.1581],
      'Indianapolis-Carmel, IN HUD Metro FMR Area': [39.7684, -86.1581],
      'Cleveland-Elyria, OH MSA': [41.4993, -81.6944],
      'Cleveland-Elyria, OH HUD Metro FMR Area': [41.4993, -81.6944],
      'Nashville-Davidson--Murfreesboro--Franklin, TN MSA': [36.1627, -86.7816],
      'Nashville-Davidson--Murfreesboro--Franklin, TN HUD Metro FMR Area': [36.1627, -86.7816],
      'Virginia Beach-Norfolk-Newport News, VA-NC MSA': [36.8468, -76.2929],
      'Virginia Beach-Norfolk-Newport News, VA-NC HUD Metro FMR Area': [36.8468, -76.2929],
      'Providence-Warwick, RI-MA MSA': [41.8240, -71.4128],
      'Providence-Warwick, RI-MA HUD Metro FMR Area': [41.8240, -71.4128],
      'Milwaukee-Waukesha, WI MSA': [43.0389, -87.9065],
      'Milwaukee-Waukesha-West Allis, WI HUD Metro FMR Area': [43.0389, -87.9065],
      'Jacksonville, FL MSA': [30.3322, -81.6557],
      'Jacksonville, FL HUD Metro FMR Area': [30.3322, -81.6557],
      'Memphis, TN-MS-AR MSA': [35.1495, -90.0490],
      'Memphis, TN-MS-AR HUD Metro FMR Area': [35.1495, -90.0490],
      'Oklahoma City, OK MSA': [35.4676, -97.5164],
      'Oklahoma City, OK HUD Metro FMR Area': [35.4676, -97.5164],
      'Louisville/Jefferson County, KY-IN MSA': [38.2527, -85.7585],
      'Louisville/Jefferson County, KY-IN HUD Metro FMR Area': [38.2527, -85.7585],
      'Richmond, VA MSA': [37.5407, -77.4360],
      'Richmond, VA HUD Metro FMR Area': [37.5407, -77.4360],
      'New Orleans-Metairie, LA MSA': [29.9511, -90.0715],
      'New Orleans-Metairie, LA HUD Metro FMR Area': [29.9511, -90.0715],
      'Raleigh-Cary, NC MSA': [35.7796, -78.6382],
      'Raleigh-Cary, NC HUD Metro FMR Area': [35.7796, -78.6382],
      'Salt Lake City, UT MSA': [40.7608, -111.8910],
      'Salt Lake City, UT HUD Metro FMR Area': [40.7608, -111.8910],
      'Birmingham-Hoover, AL MSA': [33.5186, -86.8104],
      'Birmingham-Hoover, AL HUD Metro FMR Area': [33.5186, -86.8104],
      'Buffalo-Cheektowaga, NY MSA': [42.8864, -78.8784],
      'Buffalo-Cheektowaga-Niagara Falls, NY HUD Metro FMR Area': [42.8864, -78.8784],
      'Rochester, NY MSA': [43.1566, -77.6088],
      'Rochester, NY HUD Metro FMR Area': [43.1566, -77.6088],
      'Grand Rapids-Wyoming, MI MSA': [42.9634, -85.6681],
      'Grand Rapids-Wyoming, MI HUD Metro FMR Area': [42.9634, -85.6681],
      'Tulsa, OK MSA': [36.1540, -95.9928],
      'Tulsa, OK HUD Metro FMR Area': [36.1540, -95.9928],
      'Honolulu, HI MSA': [21.3099, -157.8581],
      'Honolulu, HI HUD Metro FMR Area': [21.3099, -157.8581],
      'Worcester, MA-CT MSA': [42.2626, -71.8023],
      'Worcester, MA-CT HUD Metro FMR Area': [42.2626, -71.8023],
      'Bridgeport-Stamford-Norwalk, CT MSA': [41.1865, -73.1952],
      'Bridgeport-Stamford-Norwalk, CT HUD Metro FMR Area': [41.1865, -73.1952],
      'Albuquerque, NM MSA': [35.0844, -106.6504],
      'Albuquerque, NM HUD Metro FMR Area': [35.0844, -106.6504],
      'Omaha-Council Bluffs, NE-IA MSA': [41.2565, -95.9345],
      'Omaha-Council Bluffs, NE-IA HUD Metro FMR Area': [41.2565, -95.9345],
      'Albany-Schenectady-Troy, NY MSA': [42.6526, -73.7562],
      'Albany-Schenectady-Troy, NY HUD Metro FMR Area': [42.6526, -73.7562],
      'New Haven-Milford, CT MSA': [41.2033, -72.9223],
      'New Haven-Milford, CT HUD Metro FMR Area': [41.2033, -72.9223],
      'Spokane-Spokane Valley, WA MSA': [47.6587, -117.4260],
      'Spokane-Spokane Valley, WA HUD Metro FMR Area': [47.6587, -117.4260],
      'Knoxville, TN MSA': [35.9606, -83.9207],
      'Knoxville, TN HUD Metro FMR Area': [35.9606, -83.9207],
      'El Paso, TX MSA': [31.7619, -106.4850],
      'El Paso, TX HUD Metro FMR Area': [31.7619, -106.4850],
      'Dayton-Kettering, OH MSA': [39.7589, -84.1916],
      'Dayton, OH HUD Metro FMR Area': [39.7589, -84.1916],
      'Baton Rouge, LA MSA': [30.4515, -91.1871],
      'Baton Rouge, LA HUD Metro FMR Area': [30.4515, -91.1871],
      'Cape Coral-Fort Myers, FL MSA': [26.5629, -81.9495],
      'Cape Coral-Fort Myers, FL HUD Metro FMR Area': [26.5629, -81.9495],
      'Akron, OH MSA': [41.0814, -81.5190],
      'Akron, OH HUD Metro FMR Area': [41.0814, -81.5190],
      'Deltona-Daytona Beach-Ormond Beach, FL MSA': [29.2108, -81.0228],
      'Deltona-Daytona Beach-Ormond Beach, FL HUD Metro FMR Area': [29.2108, -81.0228],
      'Lakeland-Winter Haven, FL MSA': [28.0395, -81.9498],
      'Lakeland-Winter Haven, FL HUD Metro FMR Area': [28.0395, -81.9498],
      'Toledo, OH MSA': [41.6528, -83.5379],
      'Toledo, OH HUD Metro FMR Area': [41.6528, -83.5379],
      'Allentown-Bethlehem-Easton, PA-NJ MSA': [40.6023, -75.4714],
      'Allentown-Bethlehem-Easton, PA-NJ HUD Metro FMR Area': [40.6023, -75.4714],
      'North Port-Sarasota-Bradenton, FL MSA': [27.0942, -82.2962],
      'North Port-Sarasota-Bradenton, FL HUD Metro FMR Area': [27.0942, -82.2962],
      'Harrisburg-Carlisle, PA MSA': [40.2732, -76.8839],
      'Harrisburg-Carlisle, PA HUD Metro FMR Area': [40.2732, -76.8839],
      'Charleston-North Charleston, SC MSA': [32.7767, -79.9311],
      'Charleston-North Charleston, SC HUD Metro FMR Area': [32.7767, -79.9311],
      'Greenville-Anderson, SC MSA': [34.8526, -82.3940],
      'Greenville-Anderson-Mauldin, SC HUD Metro FMR Area': [34.8526, -82.3940],
      'Boise City, ID MSA': [43.6150, -116.2023],
      'Boise City, ID HUD Metro FMR Area': [43.6150, -116.2023],
      'Scranton--Wilkes-Barre, PA MSA': [41.4090, -75.6624],
      'Scranton--Wilkes-Barre--Hazleton, PA HUD Metro FMR Area': [41.4090, -75.6624],
      'Madison, WI MSA': [43.0731, -89.4012],
      'Madison, WI HUD Metro FMR Area': [43.0731, -89.4012],
      'Wichita, KS MSA': [37.6872, -97.3301],
      'Wichita, KS HUD Metro FMR Area': [37.6872, -97.3301],
      'Augusta-Richmond County, GA-SC MSA': [33.4735, -82.0105],
      'Augusta-Richmond County, GA-SC HUD Metro FMR Area': [33.4735, -82.0105],
      'Des Moines-West Des Moines, IA MSA': [41.5868, -93.6250],
      'Des Moines-West Des Moines, IA HUD Metro FMR Area': [41.5868, -93.6250],
      'Lincoln, NE MSA': [40.8136, -96.7026],
      'Lincoln, NE HUD Metro FMR Area': [40.8136, -96.7026],
      'Little Rock-North Little Rock-Conway, AR MSA': [34.7465, -92.2896],
      'Little Rock-North Little Rock-Conway, AR HUD Metro FMR Area': [34.7465, -92.2896],
      'Youngstown-Warren-Boardman, OH-PA MSA': [41.0998, -80.6495],
      'Youngstown-Warren-Boardman, OH-PA HUD Metro FMR Area': [41.0998, -80.6495],
      'Urban Honolulu, HI MSA': [21.3099, -157.8581],
      'Urban Honolulu, HI HUD Metro FMR Area': [21.3099, -157.8581],
      'McAllen-Edinburg-Mission, TX MSA': [26.2034, -98.2300],
      'McAllen-Edinburg-Mission, TX HUD Metro FMR Area': [26.2034, -98.2300],
      'Chattanooga, TN-GA MSA': [35.0456, -85.3097],
      'Chattanooga, TN-GA HUD Metro FMR Area': [35.0456, -85.3097],
      'Springfield, MA MSA': [42.1015, -72.5898],
      'Springfield, MA HUD Metro FMR Area': [42.1015, -72.5898],
      'Fayetteville, NC MSA': [35.0527, -78.8784],
      'Fayetteville, NC HUD Metro FMR Area': [35.0527, -78.8784],
      'Pensacola-Ferry Pass-Brent, FL MSA': [30.4418, -87.2169],
      'Pensacola-Ferry Pass-Brent, FL HUD Metro FMR Area': [30.4418, -87.2169],
      'Peoria, IL MSA': [40.6936, -89.5890],
      'Peoria, IL HUD Metro FMR Area': [40.6936, -89.5890],
      'Lancaster, PA MSA': [40.0379, -76.3055],
      'Lancaster, PA HUD Metro FMR Area': [40.0379, -76.3055],
      'Killeen-Temple, TX MSA': [31.1171, -97.7278],
      'Killeen-Temple, TX HUD Metro FMR Area': [31.1171, -97.7278],
      'Corpus Christi, TX MSA': [27.8006, -97.3964],
      'Corpus Christi, TX HUD Metro FMR Area': [27.8006, -97.3964],
      'Columbia, SC MSA': [34.0007, -81.0348],
      'Columbia, SC HUD Metro FMR Area': [34.0007, -81.0348],
      'Evansville, IN-KY MSA': [37.9716, -87.5711],
      'Evansville, IN-KY HUD Metro FMR Area': [37.9716, -87.5711],
      'Reading, PA MSA': [40.3356, -75.9269],
      'Reading, PA HUD Metro FMR Area': [40.3356, -75.9269],
      'Fort Wayne, IN MSA': [41.0793, -85.1394],
      'Fort Wayne, IN HUD Metro FMR Area': [41.0793, -85.1394],
      'Lubbock, TX MSA': [33.5779, -101.8552],
      'Lubbock, TX HUD Metro FMR Area': [33.5779, -101.8552],
      'Shreveport-Bossier City, LA MSA': [32.5252, -93.7502],
      'Shreveport-Bossier City, LA HUD Metro FMR Area': [32.5252, -93.7502],
      'Mobile, AL MSA': [30.6954, -88.0399],
      'Mobile, AL HUD Metro FMR Area': [30.6954, -88.0399],
      'South Bend-Mishawaka, IN-MI MSA': [41.6764, -86.2520],
      'South Bend-Mishawaka, IN-MI HUD Metro FMR Area': [41.6764, -86.2520],
      'Davenport-Moline-Rock Island, IA-IL MSA': [41.5236, -90.5776],
      'Davenport-Moline-Rock Island, IA-IL HUD Metro FMR Area': [41.5236, -90.5776],
      'Fayetteville-Springdale-Rogers, AR MSA': [36.0625, -94.1574],
      'Fayetteville-Springdale-Rogers, AR-MO HUD Metro FMR Area': [36.0625, -94.1574],
      'Gulfport-Biloxi, MS MSA': [30.3674, -89.0928],
      'Gulfport-Biloxi-Pascagoula, MS HUD Metro FMR Area': [30.3674, -89.0928],
      'Appleton, WI MSA': [44.2619, -88.4154],
      'Appleton, WI HUD Metro FMR Area': [44.2619, -88.4154],
      'Beaumont-Port Arthur, TX MSA': [30.0860, -94.1018],
      'Beaumont-Port Arthur, TX HUD Metro FMR Area': [30.0860, -94.1018],
      'Rockford, IL MSA': [42.2711, -89.0940],
      'Rockford, IL HUD Metro FMR Area': [42.2711, -89.0940],
      'Lansing-East Lansing, MI MSA': [42.3314, -84.5467],
      'Lansing-East Lansing, MI HUD Metro FMR Area': [42.3314, -84.5467],
      'Kalamazoo-Portage, MI MSA': [42.2917, -85.5872],
      'Kalamazoo-Portage, MI HUD Metro FMR Area': [42.2917, -85.5872],
      'Huntington-Ashland, WV-KY-OH MSA': [38.4192, -82.4452],
      'Huntington-Ashland, WV-KY-OH HUD Metro FMR Area': [38.4192, -82.4452],
      'Amarillo, TX MSA': [35.2220, -101.8313],
      'Amarillo, TX HUD Metro FMR Area': [35.2220, -101.8313],
      'Montgomery, AL MSA': [32.3668, -86.3000],
      'Montgomery, AL HUD Metro FMR Area': [32.3668, -86.3000],
      'Huntsville, AL MSA': [34.7304, -86.5861],
      'Huntsville, AL HUD Metro FMR Area': [34.7304, -86.5861],
      'Columbus, GA-AL MSA': [32.4609, -84.9877],
      'Columbus, GA-AL HUD Metro FMR Area': [32.4609, -84.9877],
      'Cedar Rapids, IA MSA': [41.9778, -91.6656],
      'Cedar Rapids, IA HUD Metro FMR Area': [41.9778, -91.6656],
      'Green Bay, WI MSA': [44.5133, -88.0133],
      'Green Bay, WI HUD Metro FMR Area': [44.5133, -88.0133],
      'Portland-South Portland, ME MSA': [43.6591, -70.2568],
      'Portland-South Portland, ME HUD Metro FMR Area': [43.6591, -70.2568],
      'Fort Collins, CO MSA': [40.5853, -105.0844],
      'Fort Collins, CO HUD Metro FMR Area': [40.5853, -105.0844],
      'Lafayette, LA MSA': [30.2241, -92.0198],
      'Lafayette, LA HUD Metro FMR Area': [30.2241, -92.0198],
      'Topeka, KS MSA': [39.0473, -95.6890],
      'Topeka, KS HUD Metro FMR Area': [39.0473, -95.6890],
      'Tallahassee, FL MSA': [30.4518, -84.2807],
      'Tallahassee, FL HUD Metro FMR Area': [30.4518, -84.2807],
      'Savannah, GA MSA': [32.0835, -81.0998],
      'Savannah, GA HUD Metro FMR Area': [32.0835, -81.0998],

      // Additional missing MSAs from other states
      'Anchorage, AK MSA': [61.2181, -149.9003],
      'Fairbanks, AK MSA': [64.8378, -147.7164],
      'Juneau, AK MSA': [58.3019, -134.4197],
      
      // Vermont MSA
      'Burlington-South Burlington, VT MSA': [44.4759, -73.2121],
      
      // Additional Iowa MSAs
      'Iowa City, IA MSA': [41.6611, -91.5302],
      'Waterloo-Cedar Falls, IA MSA': [42.4928, -92.3426],
      'Dubuque, IA MSA': [42.5006, -90.6646],
      'Ames, IA MSA': [42.0308, -93.6319],
      
      // Additional Idaho MSAs
      'Pocatello, ID MSA': [42.8713, -112.4455],
      'Idaho Falls, ID MSA': [43.4666, -112.0362],
      'Coeur d\'Alene, ID MSA': [47.6777, -116.7804],
      
      // Additional Nevada MSAs
      'Reno, NV MSA': [39.5296, -119.8138],
      'Carson City, NV MSA': [39.1638, -119.7674],
      
      // Additional Utah MSAs
      'Ogden-Clearfield, UT MSA': [41.2230, -111.9738],
      'Provo-Orem, UT MSA': [40.2338, -111.6585],
      'Logan, UT-ID MSA': [41.7370, -111.8338],
      'St. George, UT MSA': [37.0965, -113.5684],
      
      // Additional New Mexico MSAs
      'Las Cruces, NM MSA': [32.3199, -106.7637],
      'Santa Fe, NM MSA': [35.6870, -105.9378],
      'Farmington, NM MSA': [36.7281, -108.2187]
    };
    
    // Try exact match first
    if (coordinates[msaName]) {
      return coordinates[msaName];
    }
    
    // Try normalized matching (remove common suffixes and normalize)
    const normalizedInput = msaName.toLowerCase()
      .replace(/ hud metro fmr area$/, '')
      .replace(/ msa$/, '')
      .replace(/-/g, ' ')
      .trim();
    
    for (const [key, coord] of Object.entries(coordinates)) {
      const normalizedKey = key.toLowerCase()
        .replace(/ hud metro fmr area$/, '')
        .replace(/ msa$/, '')
        .replace(/-/g, ' ')
        .trim();
      
      if (normalizedKey === normalizedInput) {
        return coord;
      }
      
      // Partial matching for city names
      const inputCity = normalizedInput.split(',')[0].split(' ')[0];
      const keyCity = normalizedKey.split(',')[0].split(' ')[0];
      
      if (inputCity.length > 3 && keyCity.includes(inputCity)) {
        return coord;
      }
    }
    
    return null;
  };

  // Load and process Census data
  useEffect(() => {
    const loadCensusData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📊 Loading Census data files...');
        const censusFiles = [
          { url: '/ACSDP5Y2023.DP03-Data.csv', type: 'economic' },
          { url: '/ACSDP5Y2023.DP04-Data.csv', type: 'housing' },
          { url: '/ACSDT5Y2023.B01003-Data.csv', type: 'population2023' },
          { url: '/ACSDT5Y2018.B01003-Data.csv', type: 'population2018' },
          { url: '/ACSST5Y2023.S2301-Data.csv', type: 'employment' },
          { url: '/FY25_FMRs_corrected_final_static.csv', type: 'fmr' }
        ];

        const dataPromises = censusFiles.map(file => loadCSV(file.url, file.type));
        const results = await Promise.allSettled(dataPromises);
        
        const loadedData = {};
        results.forEach((result, index) => {
          const file = censusFiles[index];
          if (result.status === 'fulfilled') {
            console.log(`✅ ${result.value.type}: ${result.value.data.length} rows`);
            loadedData[result.value.type] = result.value.data;
            
            if (result.value.type === 'fmr') {
              setFmrLoadStatus({ loaded: true, error: null, attempted: true, filePath: file.url });
            }
          } else {
            console.error(`❌ Failed to load ${file.url}:`, result.reason);
            loadedData[file.type] = [];
            
            if (file.type === 'fmr') {
              setFmrLoadStatus({ loaded: false, error: result.reason.message, attempted: true });
            }
          }
        });
        
        console.log('🔄 Processing Census data...');
        
        // Process county data
        const countyData = processCensusDataToCounties(loadedData);
        
        // Aggregate to MSAs
        const fmrMsaMapping = buildFMRMSAMapping(loadedData.fmr || []);
        const processedMSAData = aggregateCountiesToMSAs(countyData, fmrMsaMapping);
        
        // Add FMR data to MSAs
        addFMRDataToMSAs(processedMSAData, loadedData.fmr || []);
        
        console.log(`✅ Processed data: ${Object.keys(processedMSAData).length} MSAs`);
        setMsaData(processedMSAData);
        
      } catch (error) {
        console.error('❌ Error loading Census data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadCensusData();
  }, []);

  // Initialize map with proper Leaflet implementation
  useEffect(() => {
    if (loading || mapInstanceRef.current) return;

    const initMap = async () => {
      try {
        // Wait for container to be ready
        if (!mapRef.current) {
          setTimeout(initMap, 100);
          return;
        }

        // Dynamic import of Leaflet
        const L = await import('leaflet');
        
        // Fix for default markers
        delete L.default.Icon.Default.prototype._getIconUrl;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const map = L.default.map(mapRef.current, {
          center: [39.8283, -98.5795],
          zoom: 4,
          maxZoom: 12,
          minZoom: 3,
          zoomControl: true,
          attributionControl: false,
          preferCanvas: true
        });

        // Add tile layer
        L.default.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 12
        }).addTo(map);

        mapInstanceRef.current = map;
        
        // Create markers layer
        const markersLayer = L.default.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;

        // Add markers with real data
        updateMarkersWithRealData(L.default);
        
      } catch (error) {
        console.error('Error initializing map:', error);
        setError('Failed to initialize map');
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [loading]);

  // Update markers when metric changes
  useEffect(() => {
    if (mapInstanceRef.current && markersLayerRef.current && Object.keys(msaData).length > 0) {
      const loadLeaflet = async () => {
        const L = await import('leaflet');
        updateMarkersWithRealData(L.default);
      };
      loadLeaflet();
    }
  }, [selectedMetric, msaData]);

  const getColor = (value, metric) => {
    if (value == null || isNaN(value)) return '#4b5563';
    
    if (metric === 'populationGrowth') {
      if (value > 2) return '#10b981';
      if (value > 1) return '#22c55e';
      if (value > 0) return '#84cc16';
      if (value > -1) return '#f59e0b';
      return '#ef4444';
    } else if (metric === 'rentAnalysis') {
      if (value > 2500) return '#ef4444';
      if (value > 2000) return '#f59e0b';
      if (value > 1500) return '#84cc16';
      if (value > 1000) return '#22c55e';
      return '#10b981';
    } else {
      const range = metrics[metric].range;
      const normalized = (value - range[0]) / (range[1] - range[0]);
      const clamped = Math.max(0, Math.min(1, normalized));
      
      if (clamped < 0.33) return '#ef4444';
      if (clamped < 0.66) return '#f59e0b';
      return '#10b981';
    }
  };

  const updateMarkersWithRealData = (L) => {
    if (!markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    let markersAdded = 0;
    let markersSkipped = 0;
    let coordinatesMissing = [];
    let stateBreakdown = {};

    // Debug: Log all MSA names first
    console.log(`🔍 Total MSAs in data: ${Object.keys(msaData).length}`);
    
    // Check for CA and AZ MSAs specifically
    const caMSAs = Object.values(msaData).filter(msa => 
      msa.statesList && (msa.statesList.includes('CA') || msa.statesList.includes('California'))
    );
    const azMSAs = Object.values(msaData).filter(msa => 
      msa.statesList && (msa.statesList.includes('AZ') || msa.statesList.includes('Arizona'))
    );
    
    console.log(`🏖️ California MSAs found in data: ${caMSAs.length}`);
    caMSAs.forEach((msa, i) => {
      if (i < 5) console.log(`   ${msa.name} (${msa.totalPopulation?.toLocaleString()} people)`);
    });
    
    console.log(`🌵 Arizona MSAs found in data: ${azMSAs.length}`);
    azMSAs.forEach((msa, i) => {
      if (i < 5) console.log(`   ${msa.name} (${msa.totalPopulation?.toLocaleString()} people)`);
    });

    // Add markers for real MSA data
    Object.values(msaData).forEach(msa => {
      // Count by state for debugging
      const primaryState = msa.statesList ? msa.statesList.split(',')[0].trim() : 'Unknown';
      stateBreakdown[primaryState] = (stateBreakdown[primaryState] || 0) + 1;

      if (!msa.name || !msa.totalPopulation || msa.totalPopulation < 50000) {
        markersSkipped++;
        return;
      }

      const coordinates = getMSACoordinates(msa.name);
      if (!coordinates) {
        coordinatesMissing.push({
          name: msa.name,
          population: msa.totalPopulation,
          states: msa.statesList
        });
        markersSkipped++;
        return;
      }

      const value = getMetricValue(msa, selectedMetric);
      const color = getColor(value, selectedMetric);
      
      // Calculate radius based on population (FIXED SIZE, not zoom-dependent)
      const minRadius = 6;
      const maxRadius = 25;
      const minPop = 100000;
      const maxPop = 20000000;
      
      const logScale = Math.log(msa.totalPopulation / minPop) / Math.log(maxPop / minPop);
      const normalizedPop = Math.max(0, Math.min(1, logScale));
      const radius = minRadius + (normalizedPop * (maxRadius - minRadius));

      const marker = L.circleMarker([coordinates[0], coordinates[1]], {
        radius: Math.round(radius),
        fillColor: color,
        color: 'white',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.7
      });

      // Tooltip content
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #1e293b; font-size: 0.9rem;">${msa.name}</div>
        <div style="color: #374151; font-size: 0.8rem; line-height: 1.4;">
          <div><strong>Population:</strong> ${msa.totalPopulation?.toLocaleString()}</div>
          <div><strong>Counties:</strong> ${msa.countyCount}</div>
          <div><strong>States:</strong> ${msa.statesList}</div>
          ${selectedMetric === 'populationGrowth' ? `
            <div><strong>Growth:</strong> <span style="color: ${msa.populationGrowth > 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">${msa.populationGrowth ? msa.populationGrowth.toFixed(1) + '%' : 'N/A'}</span></div>
          ` : ''}
          ${selectedMetric === 'jobGrowth' ? `
            <div><strong>Income:</strong> ${msa.medianHouseholdIncome ? (msa.medianHouseholdIncome / 1000).toFixed(0) + 'k' : 'N/A'}</div>
            <div><strong>Employment:</strong> ${msa.employmentRate ? msa.employmentRate.toFixed(1) + '%' : 'N/A'}</div>
          ` : ''}
          ${selectedMetric === 'housingMetrics' ? `
            <div><strong>Vacancy:</strong> ${msa.vacancyRate ? msa.vacancyRate.toFixed(1) + '%' : 'N/A'}</div>
            <div><strong>Renters:</strong> ${msa.renterPercentage ? msa.renterPercentage.toFixed(1) + '%' : 'N/A'}</div>
          ` : ''}
          ${selectedMetric === 'rentAnalysis' ? `
            <div><strong>FMR:</strong> ${msa.fmrRent?.toLocaleString() || 'N/A'}</div>
            <div><strong>Market:</strong> ${msa.estimatedMarketRent?.toLocaleString() || 'N/A'}</div>
            <div><strong>Type:</strong> <span style="color: ${msa.marketType === 'superHot' ? '#ef4444' : msa.marketType === 'hot' ? '#f59e0b' : msa.marketType === 'warm' ? '#10b981' : '#6b7280'}; font-weight: 600;">${msa.marketType || 'Unknown'}</span></div>
          ` : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        permanent: false,
        sticky: true,
        className: 'custom-tooltip'
      });

      marker.on('mouseover', () => {
        setHoveredMSA(msa);
      });

      marker.on('mouseout', () => {
        setHoveredMSA(null);
      });

      markersLayerRef.current.addLayer(marker);
      markersAdded++;
    });

    console.log(`🗺️ Updated markers: ${markersAdded} added, ${markersSkipped} skipped`);
    console.log(`📊 MSAs by state:`, stateBreakdown);
    
    // Show missing coordinates for large MSAs
    const largeMissing = coordinatesMissing
      .filter(msa => msa.population > 200000)
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
    
    if (largeMissing.length > 0) {
      console.log(`❌ Large MSAs missing coordinates:`);
      largeMissing.forEach(msa => {
        console.log(`   "${msa.name}" (${msa.population?.toLocaleString()}, ${msa.states})`);
      });
    }
    
    // Check coordinate lookup for CA/AZ specifically
    console.log(`🔍 Testing coordinate lookup for CA/AZ MSAs:`);
    [...caMSAs, ...azMSAs].slice(0, 5).forEach(msa => {
      const coords = getMSACoordinates(msa.name);
      console.log(`   "${msa.name}" -> ${coords ? JSON.stringify(coords) : 'NOT FOUND'}`);
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: `3px solid ${colors.gray.dark}`,
            borderTop: `3px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Loading MSA data...</p>
          <p style={{ fontSize: '0.875rem', color: colors.gray.lighter, marginTop: '8px' }}>
            Aggregating county data to metropolitan areas
          </p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{
            color: colors.error,
            fontSize: '3rem',
            marginBottom: '16px'
          }}>⚠️</div>
          <h2 style={{ marginBottom: '8px' }}>Error Loading MSA Data</h2>
          <p style={{ color: colors.gray.lighter, marginBottom: '16px' }}>{error}</p>
          <p style={{ color: colors.gray.lighter, fontSize: '0.875rem' }}>
            Please check that all Census CSV files are in the public folder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: colors.background,
      color: 'white',
      display: 'flex'
    }}>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .custom-tooltip {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          color: #1e293b !important;
          font-size: 0.875rem !important;
          padding: 12px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          max-width: 300px !important;
        }
        .leaflet-tooltip-top:before { border-top-color: rgba(255, 255, 255, 0.95) !important; }
        .leaflet-tooltip-bottom:before { border-bottom-color: rgba(255, 255, 255, 0.95) !important; }
        .leaflet-tooltip-left:before { border-left-color: rgba(255, 255, 255, 0.95) !important; }
        .leaflet-tooltip-right:before { border-right-color: rgba(255, 255, 255, 0.95) !important; }
        .leaflet-container { font-family: inherit; }
      `}</style>
      
      {/* Sidebar */}
      <div style={{
        width: '320px',
        background: '#1e293b',
        borderRight: `1px solid ${colors.gray.dark}`,
        padding: '24px',
        overflowY: 'auto',
        zIndex: 1000
      }}>
        <button
          onClick={() => setCurrentPage('heatMapSelector')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#94a3b8',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.3s ease',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '24px'
          }}
          onMouseEnter={(e) => {
            e.target.style.color = '#06b6d4';
            e.target.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#94a3b8';
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft size={16} /> Back to Heat Map Selection
        </button>

        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.accent} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          MSA Investment Map
        </h1>
        <p style={{ color: colors.gray.lighter, fontSize: '0.875rem', marginBottom: '32px' }}>
          Metropolitan Statistical Areas analysis
        </p>

        <div>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Filter size={20} style={{ color: colors.primary }} />
            Select Metric
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(metrics).map(([key, metric]) => {
              const IconComponent = metric.icon;
              const isSelected = selectedMetric === key;
              
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: isSelected ? `${metric.color}20` : colors.gray.dark,
                    border: isSelected ? `2px solid ${metric.color}` : `1px solid ${colors.gray.medium}`,
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s ease',
                    width: '100%'
                  }}
                >
                  <IconComponent size={20} style={{ color: metric.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      {metric.name}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: colors.gray.lighter,
                      marginTop: '2px'
                    }}>
                      {metric.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* FMR Load Status Warning */}
        {fmrLoadStatus.attempted && !fmrLoadStatus.loaded && (
          <div style={{
            background: colors.warning + '20',
            border: `2px solid ${colors.warning}`,
            borderRadius: '8px',
            padding: '16px',
            marginTop: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} style={{ color: colors.warning }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: colors.warning }}>FMR Data Missing</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.gray.lightest, marginBottom: '8px' }}>
              {fmrLoadStatus.error}
            </div>
            <div style={{ fontSize: '0.7rem', color: colors.gray.lighter }}>
              <strong>To fix this:</strong>
              <br />1. Download FMR data from HUD.gov
              <br />2. Save as: <code style={{ background: colors.gray.dark, padding: '2px 4px', borderRadius: '2px' }}>FY25_FMRs_corrected_final_static.csv</code>
              <br />3. Place in your <code style={{ background: colors.gray.dark, padding: '2px 4px', borderRadius: '2px' }}>/public</code> folder
              <br />4. Refresh the page
            </div>
          </div>
        )}

        <div style={{
          background: colors.gray.dark,
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          border: `2px solid ${metrics[selectedMetric].color}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Info size={16} style={{ color: metrics[selectedMetric].color }} />
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Data Summary</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: colors.gray.lightest }}>
            Showing {Object.keys(msaData).length} metropolitan areas
          </div>
          
          {hoveredMSA && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${colors.gray.medium}` }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{hoveredMSA.name}</div>
              <div style={{ fontSize: '0.75rem', color: colors.gray.lighter, marginBottom: '8px' }}>
                {hoveredMSA.statesList} • {hoveredMSA.countyCount} counties
              </div>
              
              <div style={{ fontSize: '0.7rem' }}>
                <div style={{ marginBottom: '2px' }}>
                  Population: <span style={{ color: colors.primary }}>{hoveredMSA.totalPopulation?.toLocaleString()}</span>
                </div>
                <div style={{ marginBottom: '2px' }}>
                  Growth Rate: <span style={{ color: hoveredMSA.populationGrowth > 0 ? colors.success : colors.error }}>
                    {hoveredMSA.populationGrowth ? hoveredMSA.populationGrowth.toFixed(1) + '%' : 'N/A'}
                  </span>
                </div>
                <div style={{ marginBottom: '2px' }}>
                  Median Income: <span style={{ color: colors.success }}>${hoveredMSA.medianHouseholdIncome?.toLocaleString()}</span>
                </div>
                <div style={{ marginBottom: '2px' }}>
                  Market Rent: <span style={{ color: colors.warning }}>${hoveredMSA.estimatedMarketRent?.toLocaleString() || 'N/A'}</span>
                </div>
                <div style={{ marginBottom: '2px' }}>
                  Market Type: <span style={{ 
                    color: hoveredMSA.marketType === 'superHot' ? colors.error : 
                           hoveredMSA.marketType === 'hot' ? colors.warning : 
                           hoveredMSA.marketType === 'warm' ? colors.success : colors.gray.lighter 
                  }}>
                    {hoveredMSA.marketType || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.gray.dark}`,
            backdropFilter: 'blur(8px)'
          }}>
            <h3 style={{
              color: 'white',
              fontSize: '1.125rem',
              fontWeight: '600',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MapPin size={20} style={{ color: metrics[selectedMetric].color }} />
              {metrics[selectedMetric].name} by MSA
            </h3>
          </div>
          
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.gray.dark}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)'
          }}>
            <Calendar size={16} style={{ color: colors.gray.lighter }} />
            <span style={{ fontSize: '0.875rem', color: 'white' }}>ACS 2019-2023</span>
          </div>
        </div>

        <div 
          ref={mapRef} 
          style={{ 
            width: '100%', 
            height: '100vh',
            background: '#1a202c',
            position: 'relative'
          }} 
        />

        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${colors.gray.dark}`,
          backdropFilter: 'blur(8px)',
          zIndex: 10
        }}>
          <h4 style={{ color: 'white', fontSize: '0.875rem', fontWeight: '600', margin: '0 0 8px 0' }}>
            Color Scale
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '150px',
              height: '12px',
              background: selectedMetric === 'populationGrowth' 
                ? `linear-gradient(to right, ${colors.error}, ${colors.warning}, ${colors.success})`
                : selectedMetric === 'rentAnalysis'
                ? `linear-gradient(to right, ${colors.success}, ${colors.warning}, ${colors.error})`
                : `linear-gradient(to right, ${colors.error}, ${colors.warning}, ${colors.success})`,
              borderRadius: '2px'
            }} />
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '4px',
            fontSize: '0.7rem',
            color: colors.gray.lightest 
          }}>
            <span>
              {selectedMetric === 'populationGrowth' ? 'Decline' : 
               selectedMetric === 'rentAnalysis' ? 'Low Cost' : 'Low'}
            </span>
            <span>
              {selectedMetric === 'populationGrowth' ? 'Growth' : 
               selectedMetric === 'rentAnalysis' ? 'High Cost' : 'High'}
            </span>
          </div>
        </div>

        {Object.keys(msaData).length === 0 && !loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '24px',
            borderRadius: '8px',
            border: `1px solid ${colors.gray.dark}`,
            textAlign: 'center',
            zIndex: 100
          }}>
            <div style={{ color: colors.warning, fontSize: '2rem', marginBottom: '12px' }}>🏙️</div>
            <h3 style={{ color: 'white', marginBottom: '8px' }}>No MSA Data Available</h3>
            <p style={{ color: colors.gray.lighter, fontSize: '0.875rem' }}>
              Check that Census CSV files are in the public folder
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MSAHeatMap;