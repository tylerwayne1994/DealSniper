// src/MarketHeatMap.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Filter, Info, ArrowLeft, Home, MessageSquare, Send, ArrowUpDown } from 'lucide-react';
import Papa from 'papaparse';
import L from 'leaflet';

const MarketHeatMap = ({ setCurrentPage }) => {
  // -------------------- utils --------------------
  const absUrl = (p) => {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    const base = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    return `${base}${p.startsWith('/') ? p : '/' + p}`;
  };

  const cleanValue = (v) => {
    if (v === null || v === undefined || v === '' || v === '-' || v === 'N' || v === '(X)') return null;
    const s = typeof v === 'string' ? v.replace(/[^0-9.\-]/g, '') : v;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  const zeroZip = (z) => {
    if (z === null || z === undefined) return null;
    const s = String(Math.trunc(Number(z) || Number(String(z).replace(/\D/g, '')) || 0));
    return s.padStart(5, '0');
  };

  const fmt = (n) => (n === null || n === undefined) ? 'N/A' : Number(n).toLocaleString();

  const removeLayer = (map, ref) => {
    if (ref?.current && map?.hasLayer(ref.current)) map.removeLayer(ref.current);
  };

  const distance = (a, b) => {
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const hav = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const ang = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
    return ang * 3959; // miles
  };

  // -------------------- state --------------------
  const [selectedMetric, setSelectedMetric] = useState('zipDensity');
  const [densityEnabled, setDensityEnabled] = useState(localStorage.getItem('layer.populationDensity.enabled') === 'true' || false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [zipData, setZipData] = useState({});
  const [zipCentroids, setZipCentroids] = useState([]);
  const [zillowCentroids, setZillowCentroids] = useState([]); // { zip, lat, lon } with Zillow data

  // Chatbot state
  const [chatMessages, setChatMessages] = useState([
    { 
      text: 'Hey! Ask me about ZIP code data including migration. Try "highest income", "population density over 5000", "migration inflow above 5", or "show zips near Atlanta with rent above 1500"', 
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const highlightedZipsRef = useRef(new Set());

  // map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const zipPointLayerRef = useRef(null);
  const densityLayerRef = useRef(null);

  const ZCTA_POINT_ZOOM = 6;

  // -------------------- metrics --------------------
  const zipMetrics = useMemo(() => ({
    zipDensity: { name: 'Population Density (ZCTA)', icon: Users, description: 'Population per square mile', dataSource: 'ACS + Census', calculation: 'population / land_sqmi', colorScale: [
      { min: -Infinity, max: 500, color: '#fff7bc', label: '<500/sq mi' },
      { min: 500, max: 1000, color: '#fec44f', label: '500-1k' },
      { min: 1000, max: 2000, color: '#fe9929', label: '1k-2k' },
      { min: 2000, max: 5000, color: '#ec7014', label: '2k-5k' },
      { min: 5000, max: 10000, color: '#cc4c02', label: '5k-10k' },
      { min: 10000, max: Infinity, color: '#993404', label: '>10k/sq mi' }
    ]},
    zipIncome: { name: 'Household Income', icon: Users, description: 'Median household income', dataSource: 'ACS DP03', calculation: 'DP03_0062E', colorScale: [
      { min: -Infinity, max: 25000, color: '#ef4444', label: '<$25k' },
      { min: 25000, max: 50000, color: '#f87171', label: '$25k–50k' },
      { min: 50000, max: 75000, color: '#fca5a5', label: '$50k–75k' },
      { min: 75000, max: Infinity, color: '#10b981', label: '>$75k' }
    ]},
    zipEmployment: { name: 'Employment Rate', icon: Users, description: 'Percentage of population employed', dataSource: 'ACS DP03', calculation: 'Derived from DP03_0002PE', colorScale: [
      { min: -Infinity, max: 45, color: '#ef4444', label: '<45%' },
      { min: 45, max: 47.5, color: '#f87171', label: '45–47.5%' },
      { min: 47.5, max: 50, color: '#fca5a5', label: '47.5–50%' },
      { min: 50, max: Infinity, color: '#10b981', label: '>50%' }
    ]},
    medianGrossRent: { name: 'Median Gross Rent', icon: Home, description: 'Monthly rent (ACS)', dataSource: 'ACS DP04', calculation: 'DP04_0134E', colorScale: [
      { min: -Infinity, max: 1000, color: '#ef4444', label: '<$1,000' },
      { min: 1000, max: 1500, color: '#f87171', label: '$1,000–1,500' },
      { min: 1500, max: 2000, color: '#fca5a5', label: '$1,500–2,000' },
      { min: 2000, max: Infinity, color: '#10b981', label: '>$2,000' }
    ]},
    zipMigration: { name: 'Net Migration Rate', icon: ArrowUpDown, description: 'Net migration per 1,000 residents (green=inflow, red=outflow)', dataSource: 'IRS Migration Data 2021', calculation: 'Net migration per 1,000 population from IRS flows', colorScale: [
      { min: -Infinity, max: -20, color: '#7f1d1d', label: 'Heavy Outflow' },
      { min: -20, max: -10, color: '#dc2626', label: 'High Outflow' },
      { min: -10, max: -5, color: '#f59e0b', label: 'Moderate Outflow' },
      { min: -5, max: 0, color: '#fbbf24', label: 'Slight Outflow' },
      { min: 0, max: 5, color: '#84cc16', label: 'Slight Inflow' },
      { min: 5, max: 10, color: '#22c55e', label: 'Moderate Inflow' },
      { min: 10, max: 20, color: '#16a34a', label: 'High Inflow' },
      { min: 20, max: Infinity, color: '#166534', label: 'Heavy Inflow' }
    ]}
  }), []);

  // -------------------- Chatbot handlers --------------------
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { 
      text: chatInput, 
      sender: 'user',
      timestamp: new Date()
    };
    
    setChatMessages(msgs => [...msgs, userMessage]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(async () => {
      const lower = chatInput.toLowerCase();
      let response = '';
      let matchingZips = [];
      
      // Parse different query types
      const incomeMatch = lower.match(/income\s*(above|over|greater than|more than|below|under|less than)?\s*\$?(\d+)/i);
      const densityMatch = lower.match(/density\s*(above|over|greater than|more than|below|under|less than)?\s*(\d+)/i);
      const rentMatch = lower.match(/rent\s*(above|over|greater than|more than|below|under|less than)?\s*\$?(\d+)/i);
      const migrationMatch = lower.match(/migration\s*(above|over|greater than|more than|below|under|less than|inflow|outflow)?\s*([-\d]+)?/i);
      const populationMatch = lower.match(/population\s*(around|about|near|of|over|above|below|under)?\s*(\d+)/i);
      
      // Location keywords
      const locationKeywords = ['atlanta', 'georgia', 'texas', 'florida', 'california', 'new york', 'chicago', 'los angeles', 'miami'];
      let targetLocation = null;
      for (const loc of locationKeywords) {
        if (lower.includes(loc)) {
          targetLocation = loc;
          break;
        }
      }
      
      // HANDLE QUERIES
      
      // Highest income
      if ((lower.includes('highest') || lower.includes('top')) && lower.includes('income')) {
        const zipsWithIncome = Object.entries(zipData)
          .filter(([_, z]) => z.medianHouseholdIncome != null)
          .sort(([_, a], [__, b]) => b.medianHouseholdIncome - a.medianHouseholdIncome)
          .slice(0, 10);
        
        matchingZips = zipsWithIncome.map(([zip, _]) => zip);
        
        response = `💰 TOP ZIP CODES BY MEDIAN INCOME:\n\n`;
        zipsWithIncome.forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Income: $${z.medianHouseholdIncome.toLocaleString()}/year\n`;
          if (z.population) response += `   Population: ${z.population.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `🗺️ These ${matchingZips.length} ZIP codes are now highlighted on the map in BLUE.`;
      }
      
      // Migration queries
      else if (lower.includes('migration') && (lower.includes('highest') || lower.includes('top') || lower.includes('inflow'))) {
        const zipsWithMigration = Object.entries(zipData)
          .filter(([_, z]) => z.migrationRate != null && z.migrationRate > 0)
          .sort(([_, a], [__, b]) => b.migrationRate - a.migrationRate)
          .slice(0, 10);
        
        matchingZips = zipsWithMigration.map(([zip, _]) => zip);
        
        response = `📈 TOP ZIP CODES BY MIGRATION INFLOW:\n\n`;
        zipsWithMigration.forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Migration Rate: +${z.migrationRate.toFixed(1)}‰\n`;
          if (z.netMigration) response += `   Net Migration: ${z.netMigration.toLocaleString()}\n`;
          if (z.population2021) response += `   Population: ${z.population2021.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `🗺️ These ${matchingZips.length} ZIP codes are now highlighted on the map in BLUE.`;
      }
      
      // Migration threshold
      else if (migrationMatch) {
        const operator = migrationMatch[1] || 'above';
        const threshold = migrationMatch[2] ? parseFloat(migrationMatch[2]) : 5;
        
        const filtered = Object.entries(zipData).filter(([_, z]) => {
          if (z.migrationRate == null) return false;
          if (operator.includes('inflow') || operator.includes('above') || operator.includes('over') || operator.includes('greater') || operator.includes('more')) {
            return z.migrationRate > threshold;
          } else if (operator.includes('outflow')) {
            return z.migrationRate < -Math.abs(threshold);
          } else {
            return z.migrationRate < threshold;
          }
        });
        
        matchingZips = filtered.slice(0, 20).map(([zip, _]) => zip);
        
        response = `🏃‍♂️ ZIP CODES WITH MIGRATION ${operator.toUpperCase()} ${threshold}‰:\n\n`;
        filtered.slice(0, 20).forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Migration: ${z.migrationRate > 0 ? '+' : ''}${z.migrationRate.toFixed(1)}‰\n`;
          if (z.netMigration) response += `   Net: ${z.netMigration.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `\n🗺️ Found ${filtered.length} ZIPs. Showing first ${matchingZips.length} highlighted on map.`;
      }
      
      // Income threshold
      else if (incomeMatch) {
        const operator = incomeMatch[1] || 'above';
        const threshold = parseInt(incomeMatch[2]);
        
        const filtered = Object.entries(zipData).filter(([_, z]) => {
          if (!z.medianHouseholdIncome) return false;
          if (operator.includes('above') || operator.includes('over') || operator.includes('greater') || operator.includes('more')) {
            return z.medianHouseholdIncome > threshold;
          } else {
            return z.medianHouseholdIncome < threshold;
          }
        });
        
        matchingZips = filtered.slice(0, 20).map(([zip, _]) => zip);
        
        response = `📍 ZIP CODES WITH INCOME ${operator.toUpperCase()} $${threshold.toLocaleString()}:\n\n`;
        filtered.slice(0, 20).forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Income: $${z.medianHouseholdIncome.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `\n🗺️ Found ${filtered.length} total ZIPs. Showing first ${matchingZips.length} highlighted on map.`;
      }
      
      // Density threshold
      else if (densityMatch) {
        const operator = densityMatch[1] || 'over';
        const threshold = parseInt(densityMatch[2]);
        
        const filtered = Object.entries(zipData).filter(([_, z]) => {
          if (z.density_sqmi == null) return false;
          if (operator.includes('above') || operator.includes('over') || operator.includes('greater') || operator.includes('more')) {
            return z.density_sqmi > threshold;
          } else {
            return z.density_sqmi < threshold;
          }
        });
        
        matchingZips = filtered.slice(0, 20).map(([zip, _]) => zip);
        
        response = `🏙️ ZIP CODES WITH DENSITY ${operator.toUpperCase()} ${threshold.toLocaleString()}/sq mi:\n\n`;
        filtered.slice(0, 20).forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Density: ${z.density_sqmi.toFixed(1)} people/sq mi\n`;
          if (z.population) response += `   Population: ${z.population.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `\n🗺️ Found ${filtered.length} ZIPs. Showing first ${matchingZips.length} on map.`;
      }
      
      // Rent threshold
      else if (rentMatch) {
        const operator = rentMatch[1] || 'above';
        const threshold = parseInt(rentMatch[2]);
        
        const filtered = Object.entries(zipData).filter(([_, z]) => {
          if (!z.medianGrossRent) return false;
          if (operator.includes('above') || operator.includes('over') || operator.includes('greater') || operator.includes('more')) {
            return z.medianGrossRent > threshold;
          } else {
            return z.medianGrossRent < threshold;
          }
        });
        
        matchingZips = filtered.slice(0, 20).map(([zip, _]) => zip);
        
        response = `🏠 ZIP CODES WITH RENT ${operator.toUpperCase()} $${threshold.toLocaleString()}:\n\n`;
        filtered.slice(0, 20).forEach(([zip, z], i) => {
          response += `${i + 1}. ZIP ${zip}\n`;
          response += `   Rent: $${z.medianGrossRent.toLocaleString()}/month\n`;
          if (z.medianHouseholdIncome) response += `   Income: $${z.medianHouseholdIncome.toLocaleString()}\n`;
          response += `\n`;
        });
        
        response += `\n🗺️ Found ${filtered.length} ZIPs. Showing first ${matchingZips.length} on map.`;
      }
      
      // Default help
      else {
        response = `Try these example queries:\n\n`;
        response += `• "Highest income zip codes"\n`;
        response += `• "Highest migration inflow"\n`;
        response += `• "Migration above 10"\n`;
        response += `• "Migration outflow below -5"\n`;
        response += `• "Density over 5000"\n`;
        response += `• "Income above 75000"\n`;
        response += `• "Rent below 1500"`;
      }
      
      // HIGHLIGHT ON MAP
      if (matchingZips.length > 0 && mapInstanceRef.current) {
        // Clear previous highlights
        highlightedZipsRef.current.clear();
        matchingZips.forEach(zip => highlightedZipsRef.current.add(zip));
        
        // Force redraw of zip points
        await updateZipPointLayer(L, mapInstanceRef.current, selectedMetric);
        
        // Zoom to show highlighted zips if less than 10
        if (matchingZips.length < 10 && zipCentroids.length > 0) {
          const matchingCentroids = zipCentroids.filter(c => matchingZips.includes(c.zip));
          if (matchingCentroids.length > 0) {
            const bounds = L.latLngBounds(matchingCentroids.map(c => [c.lat, c.lon]));
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      }

      setIsTyping(false);
      setChatMessages(msgs => [...msgs, { 
        text: response, 
        sender: 'bot',
        timestamp: new Date()
      }]);
    }, 1000);
  };

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  // -------------------- CSV loaders --------------------
  const loadCSV = async (url) => {
    const u = absUrl(url);
    const res = await fetch(u);
    if (!res.ok) throw new Error(`${u}: ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, dynamicTyping: false, skipEmptyLines: true });
    console.log(`Loaded CSV from ${url}: ${parsed.data.length} rows`);
    return parsed?.data || [];
  };

  // -------------------- Migration data loader --------------------
  const loadMigrationData = async () => {
    try {
      const rows = await loadCSV('/migration_with_clean_zipcodes.csv');
      const migrationByZip = {};
      let processed = 0, skipped = 0;

      rows.forEach((row) => {
        const zip = zeroZip(row.ZIP);
        const netMigrationRate = cleanValue(row.n2_0_net_pc);
        
        if (!zip || !netMigrationRate) {
          skipped++;
          return;
        }

        migrationByZip[zip] = {
          zip,
          migrationRate: Math.round(netMigrationRate * 1000) / 10, // Convert to per 1000
          netMigration: cleanValue(row.n2_0_net),
          inMigration: cleanValue(row.n2_0_in),
          outMigration: cleanValue(row.n2_0_out),
          population2021: cleanValue(row.pop_2021),
          countyName: row.countyname,
          stateName: row.state_name
        };
        processed++;
      });

      console.log(`Migration data: processed=${processed}, skipped=${skipped}, zips=${Object.keys(migrationByZip).length}`);
      return migrationByZip;
    } catch (e) {
      console.error('Failed to load migration data', e);
      return {};
    }
  };

  // -------------------- ZIP data --------------------
  const buildZipData = async () => {
    const [dp03, dp04, density, migration] = await Promise.all([
      loadCSV('/ZIPACSDP5Y2023.DP03-Data.csv'),
      loadCSV('/ZIPACSDP5Y2023.DP04-Data.csv'),
      loadCSV('/zcta_density.csv'),
      loadMigrationData()
    ]);

    const zips = {};
    for (const r of dp03) {
      const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
      if (!zip) continue;
      zips[zip] = zips[zip] || { zip: zip };
      zips[zip].medianHouseholdIncome = cleanValue(r.DP03_0062E);
      zips[zip].employmentRate = cleanValue(r.DP03_0002PE); // Proxy for employment percentage
    }
    console.log('Processed DP03 for', Object.keys(zips).length, 'zips');

    for (const r of dp04) {
      const zip = zeroZip(r.NAME ? r.NAME.split(' ')[1] : r.RegionName);
      if (!zip) continue;
      const t = zips[zip] = zips[zip] || { zip: zip };
      t.medianGrossRent = cleanValue(r.DP04_0134E);
    }
    console.log('Processed DP04 for', Object.keys(zips).length, 'zips');

    // Density
    for (const r of density) {
      const zip = zeroZip(r.ZCTA);
      if (!zip) continue;
      const t = zips[zip] = zips[zip] || { zip: zip };
      t.land_sqmi = cleanValue(r.land_sqmi);
      t.population = cleanValue(r.population);
      let density_sqmi = cleanValue(r.density_sqmi);
      if (density_sqmi == null && t.land_sqmi > 0 && t.population > 0) {
        density_sqmi = t.population / t.land_sqmi;
      }
      t.density_sqmi = density_sqmi;
      if (t.density_sqmi > 300000) t.density_sqmi = null;
    }
    console.log('Processed Density for', Object.keys(zips).filter(z => zips[z].density_sqmi != null).length, 'zips');

    // Merge migration data
    let migrationMerged = 0;
    Object.entries(migration).forEach(([zip, migData]) => {
      if (zips[zip]) {
        Object.assign(zips[zip], migData);
        migrationMerged++;
      } else {
        zips[zip] = { zip, ...migData };
        migrationMerged++;
      }
    });
    console.log(`Migration data merged for ${migrationMerged} ZIPs`);

    setZipData(zips);
  };

  const loadZipCentroids = async () => {
    try {
      const rows = await loadCSV('/zcta_centroids.csv');
      const pts = rows.map(r => ({
        zip: zeroZip(r.geoid),
        lon: parseFloat(r.x),
        lat: parseFloat(r.y)
      })).filter(p => p.zip && Number.isFinite(p.lon) && Number.isFinite(p.lat));
      console.log('Loaded centroids for', pts.length, 'zips');
      // Debug: print zipData keys and a sample
      console.log('zipData keys (first 20):', Object.keys(zipData).slice(0, 20), 'total:', Object.keys(zipData).length);
      // Debug: print a sample CA ZIP in centroids and in zipData
      const caCentroidSample = pts.find(p => p.zip.startsWith('90'));
      const caZipDataSample = Object.keys(zipData).find(z => z.startsWith('90'));
      console.log('Sample CA ZIP in centroids:', caCentroidSample);
      console.log('Sample CA ZIP in zipData:', caZipDataSample);
      setZipCentroids(pts);
      const withData = pts.filter(p => zipData[p.zip]?.medianHouseholdIncome != null || zipData[p.zip]?.density_sqmi != null || zipData[p.zip]?.medianGrossRent != null || zipData[p.zip]?.employmentRate != null || zipData[p.zip]?.migrationRate != null);
      setZillowCentroids(withData);
      console.log('Data available for', withData.length, 'centroids');

      // --- Debug: log missing centroids for CA, AZ, AL, CO ---
      const stateZipPrefixes = {
        CA: ['90', '91', '92', '93', '94', '95', '96'],
        AZ: ['85', '86'],
        AL: ['35'],
        CO: ['80', '81']
      };
      Object.entries(stateZipPrefixes).forEach(([state, prefixes]) => {
        const stateCentroids = pts.filter(r => prefixes.some(pfx => r.zip.startsWith(pfx)));
        const missing = stateCentroids.filter(r => !zipData[r.zip]);
        if (missing.length > 0) {
          console.warn(`Centroids missing data for ${state}:`, missing.map(r => r.zip));
        } else {
          console.log(`All centroids have data for ${state}`);
        }
      });
      // --- End debug ---
    } catch (e) {
      console.error('Failed to load ZIP centroids', e);
      setError('Failed to load ZIP centroids');
    }
  };

  // -------------------- helper functions --------------------
  const getZipMetric = (z, key) => {
    if (!z) return null;
    switch (key) {
      case 'zipDensity': return z.density_sqmi;
      case 'zipIncome': return z.medianHouseholdIncome;
      case 'zipEmployment': return z.employmentRate;
      case 'medianGrossRent': return z.medianGrossRent;
      case 'zipMigration': return z.migrationRate;
      default: return null;
    }
  };

  const getColor = (val, metricDef) => {
    if (!metricDef) return '#e5e7eb';
    if (val === null || val === undefined || Number.isNaN(val)) return '#e5e7eb';
    for (const r of (metricDef.colorScale || [])) {
      if (val >= r.min && val < r.max) {
        return r.color;
      }
    }
    const last = (metricDef.colorScale || [])[(metricDef.colorScale || []).length - 1];
    return last ? last.color : '#e5e7eb';
  };

  const buildZipPopupHTML = (zip, z, metricKey, def, color, coords) => {
    let useZ = z;
    let note = '';
    if (useZ.medianHouseholdIncome == null && useZ.density_sqmi == null && useZ.medianGrossRent == null && useZ.employmentRate == null && useZ.migrationRate == null) {
      const nearest = findNearestZillow(coords.lat, coords.lon);
      if (nearest) {
        useZ = nearest;
        note = nearest.note;
        zip = nearest.zip;
      } else {
        note = ' (No nearby data)';
      }
    }

    const vNow = getZipMetric(useZ, metricKey);
    const display = vNow == null ? 'No data' : 
      (metricKey === 'zipDensity' ? `${vNow.toFixed(1)} people/sq mi` : 
       metricKey === 'zipEmployment' ? `${vNow.toFixed(1)}%` : 
       metricKey === 'zipMigration' ? `${vNow > 0 ? '+' : ''}${vNow.toFixed(1)}‰` :
       `$${fmt(vNow)}`);

    // Migration-specific popup content
    const migrationTable = metricKey === 'zipMigration' && useZ.migrationRate != null ? `
      <div style="margin-top:8px;font-size:.8rem;border-top:1px solid #f3f4f6;padding-top:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><span style="color:#6b7280">Net Migration:</span><br><strong>${useZ.netMigration?.toLocaleString() || 'N/A'}</strong></div>
          <div><span style="color:#6b7280">Population 2021:</span><br><strong>${useZ.population2021?.toLocaleString() || 'N/A'}</strong></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
          <div><span style="color:#6b7280">In-Migration:</span><br><strong>${useZ.inMigration?.toLocaleString() || 'N/A'}</strong></div>
          <div><span style="color:#6b7280">Out-Migration:</span><br><strong>${useZ.outMigration?.toLocaleString() || 'N/A'}</strong></div>
        </div>
        ${useZ.countyName && useZ.stateName ? `<div style="margin-top:6px"><span style="color:#6b7280">County:</span> <strong>${useZ.countyName}, ${useZ.stateName}</strong></div>` : ''}
      </div>` : '';

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:white;border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border:1px solid #e5e7eb;min-width:200px;max-width:300px;">
        <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:white;padding:12px 16px;border-radius:12px 12px 0 0;border-bottom:1px solid #e5e7eb;">
          <h3 style="margin:0;font-size:1rem;font-weight:600;line-height:1.2;">ZIP Code ${zip}${note}</h3>
        </div>
        <div style="padding:12px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <p style="margin:0;font-size:0.75rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">${def.name}</p>
              <p style="margin:4px 0 0 0;font-size:1.5rem;font-weight:700;color:#1f2937;">${display}</p>
            </div>
            <div style="width:12px;height:12px;border-radius:50%;background-color:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.1);"></div>
          </div>
          ${migrationTable}
        </div>
      </div>
    `;
  };

  const findNearestZillow = (lat, lon) => {
    if (zillowCentroids.length === 0) return null;
    let minDist = Infinity;
    let nearest = null;
    const point = { lat, lon };
    for (const c of zillowCentroids) {
      const d = distance(point, c);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }
    return nearest ? { ...zipData[nearest.zip], zip: nearest.zip, note: ` (Nearest: ${nearest.zip}, ~${Math.round(minDist)} mi)` } : null;
  };

  // -------------------- ZIP points layer --------------------
  const buildVisibleGeoJSON = (map) => {
    const bounds = map.getBounds();
    const features = zipCentroids
      .filter(p => bounds.contains([p.lat, p.lon]))
      .map(p => {
        const z = zipData[p.zip];
        if (!z) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { zip: p.zip, z }
        };
      }).filter(f => f !== null);
    return { type: 'FeatureCollection', features };
  };

  const updateZipPointLayer = (L, map, metricKey) => {
    const def = zipMetrics[metricKey] || zipMetrics.zipDensity;
    removeLayer(map, zipPointLayerRef);

    const visibleGeoJSON = buildVisibleGeoJSON(map);
    const layer = L.geoJSON(visibleGeoJSON, {
      pointToLayer: (feature, latlng) => {
        const z = feature.properties.z;
        const v = getZipMetric(z, metricKey);
        const isHighlighted = highlightedZipsRef.current.has(feature.properties.zip);
        const color = isHighlighted ? '#3b82f6' : getColor(v, def);
        return L.circleMarker(latlng, {
          radius: isHighlighted ? 8 : 4,
          weight: isHighlighted ? 2 : 0,
          color: isHighlighted ? '#1e40af' : '#ffffff',
          fillColor: color,
          fillOpacity: isHighlighted ? 1 : 0.9,
          interactive: true
        });
      },
      onEachFeature: (feature, lyr) => {
        const z = feature.properties.z;
        const v = getZipMetric(z, metricKey);
        const color = getColor(v, def);
        const html = buildZipPopupHTML(feature.properties.zip, z, metricKey, def, color, { lat: lyr.getLatLng().lat, lon: lyr.getLatLng().lon });
        lyr.bindPopup(html, { className: 'modern-popup', maxWidth: 360 });
        lyr.on('mouseover', () => lyr.setStyle({ radius: 6 }));
        lyr.on('mouseout', () => {
          const isHighlighted = highlightedZipsRef.current.has(feature.properties.zip);
          lyr.setStyle({ radius: isHighlighted ? 8 : 4 });
        });
      }
    }).addTo(map);

    zipPointLayerRef.current = layer;

    const sync = () => {
      const z = map.getZoom();
      const visible = z >= ZCTA_POINT_ZOOM;
      layer.setStyle({ opacity: visible ? 1 : 0, fillOpacity: visible ? 0.9 : 0 });
      layer.clearLayers();
      const newGeoJSON = buildVisibleGeoJSON(map);
      L.geoJSON(newGeoJSON, {
        pointToLayer: (feature, latlng) => {
          const z = feature.properties.z;
          const v = getZipMetric(z, metricKey);
          const isHighlighted = highlightedZipsRef.current.has(feature.properties.zip);
          const color = isHighlighted ? '#3b82f6' : getColor(v, def);
          return L.circleMarker(latlng, {
            radius: isHighlighted ? 8 : 4,
            weight: isHighlighted ? 2 : 0,
            color: isHighlighted ? '#1e40af' : '#ffffff',
            fillColor: color,
            fillOpacity: isHighlighted ? 1 : 0.9,
            interactive: true
          });
        },
        onEachFeature: (feature, lyr) => {
          const z = feature.properties.z;
          const v = getZipMetric(z, metricKey);
          const color = getColor(v, def);
          const html = buildZipPopupHTML(feature.properties.zip, z, metricKey, def, color, { lat: lyr.getLatLng().lat, lon: lyr.getLatLng().lon });
          lyr.bindPopup(html, { className: 'modern-popup', maxWidth: 360 });
          lyr.on('mouseover', () => lyr.setStyle({ radius: 6 }));
          lyr.on('mouseout', () => {
            const isHighlighted = highlightedZipsRef.current.has(feature.properties.zip);
            lyr.setStyle({ radius: isHighlighted ? 8 : 4 });
          });
        }
      }).addTo(layer);
    };

    map.on('moveend', sync);
    sync();
  };

  const ensureDensityLayer = (L, map) => {
    removeLayer(map, densityLayerRef);
    if (!densityEnabled) return;

    const bounds = map.getBounds();
    const features = zipCentroids
      .filter(p => bounds.contains([p.lat, p.lon]))
      .map(p => {
        const z = zipData[p.zip];
        if (!z || z.density_sqmi == null) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { zip: p.zip, density_sqmi: z.density_sqmi, population: z.population }
        };
      }).filter(f => f !== null);

    const densityLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
      pointToLayer: (feature, latlng) => {
        const v = feature.properties.density_sqmi;
        let color = '#fff7bc';
        if (v > 10000) color = '#993404';
        else if (v > 5000) color = '#cc4c02';
        else if (v > 2000) color = '#ec7014';
        else if (v > 1000) color = '#fe9929';
        else if (v > 500) color = '#fec44f';
        return L.circleMarker(latlng, {
          radius: Math.min(10, Math.sqrt(v || 1) / 2),
          fillColor: color,
          fillOpacity: 0.7,
          weight: 0.5,
          color: '#fff',
          interactive: true
        });
      },
      onEachFeature: (feature, lyr) => {
        const p = feature.properties;
        const html = `
          <div style="font-size:0.8rem">
            <strong>ZIP: ${p.zip}</strong><br>
            Population: ${fmt(p.population)}<br>
            Density: ${p.density_sqmi.toFixed(1)} people/sq mi
          </div>
        `;
        lyr.bindPopup(html, { className: 'modern-popup', maxWidth: 360 });
      }
    }).addTo(map);

    densityLayerRef.current = densityLayer;

    const sync = () => {
      densityLayer.clearLayers();
      const newFeatures = zipCentroids
        .filter(p => bounds.contains([p.lat, p.lon]))
        .map(p => {
          const z = zipData[p.zip];
          if (!z || z.density_sqmi == null) return null;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: { zip: p.zip, density_sqmi: z.density_sqmi, population: z.population }
          };
        }).filter(f => f !== null);
      L.geoJSON({ type: 'FeatureCollection', features: newFeatures }, {
        pointToLayer: (feature, latlng) => {
          const v = feature.properties.density_sqmi;
          let color = '#fff7bc';
          if (v > 10000) color = '#993404';
          else if (v > 5000) color = '#cc4c02';
          else if (v > 2000) color = '#ec7014';
          else if (v > 1000) color = '#fe9929';
          else if (v > 500) color = '#fec44f';
          return L.circleMarker(latlng, {
            radius: Math.min(10, Math.sqrt(v || 1) / 2),
            fillColor: color,
            fillOpacity: 0.7,
            weight: 0.5,
            color: '#fff',
            interactive: true
          });
        },
        onEachFeature: (feature, lyr) => {
          const p = feature.properties;
          const html = `
            <div style="font-size:0.8rem">
              <strong>ZIP: ${p.zip}</strong><br>
              Population: ${fmt(p.population)}<br>
              Density: ${p.density_sqmi.toFixed(1)} people/sq mi
            </div>
          `;
          lyr.bindPopup(html, { className: 'modern-popup', maxWidth: 360 });
        }
      }).addTo(densityLayer);
    };

    map.on('moveend', sync);
    sync();
  };

  // -------------------- boot & map init --------------------
  const boot = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([buildZipData(), loadZipCentroids()]);
      console.log('Data loading complete');
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const initMap = async () => {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
    });
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    const map = L.map(mapRef.current, { center: [39.8283, -98.5795], zoom: ZCTA_POINT_ZOOM, minZoom: 3, maxZoom: 12, attributionControl: false, preferCanvas: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 12 }).addTo(map);
    mapInstanceRef.current = map;
    await updateZipPointLayer(L, map, selectedMetric);
    ensureDensityLayer(L, map);
  };

  // -------------------- effects --------------------
  useEffect(() => { boot(); }, []);
  useEffect(() => { if (!loading && Object.keys(zipData).length > 0 && zipCentroids.length > 0) initMap(); }, [loading, zipData, zipCentroids]);
  useEffect(() => {
    localStorage.setItem('layer.populationDensity.enabled', densityEnabled);
    if (mapInstanceRef.current) {
      (async () => {
        const L = await import('leaflet');
        ensureDensityLayer(L.default, mapInstanceRef.current);
      })();
    }
  }, [densityEnabled]);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    (async () => {
      const L = await import('leaflet');
      await updateZipPointLayer(L.default, map, selectedMetric);
      ensureDensityLayer(L.default, map);
    })();
  }, [selectedMetric]);

  // Precompute zillow centroids
  useEffect(() => {
    if (zipCentroids.length > 0 && Object.keys(zipData).length > 0) {
      const withData = zipCentroids.filter(p => zipData[p.zip]?.medianHouseholdIncome != null || zipData[p.zip]?.density_sqmi != null || zipData[p.zip]?.medianGrossRent != null || zipData[p.zip]?.employmentRate != null || zipData[p.zip]?.migrationRate != null);
      setZillowCentroids(withData);
    }
  }, [zipCentroids, zipData]);

  // -------------------- UI --------------------
  const metricDefs = zipMetrics;
  const metricKey = (selectedMetric in metricDefs) ? selectedMetric : 'zipDensity';
  const currentMetric = metricDefs[metricKey] || { name: 'Metric', colorScale: [], calculation: '' };
  const hasDataCount = Object.values(zipData).filter(z => getZipMetric(z, metricKey) != null).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Loading datasets…</h2>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#ef4444 0%,#f97316 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Data load failed</div>
          <div style={{ opacity: .9 }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex' }}>
      <style>{`@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { font-family: inherit; background: white !important; }
        .modern-popup .leaflet-popup-content-wrapper { background: transparent !important; padding: 0 !important; border-radius: 12px !important; box-shadow: none !important; }
        .modern-popup .leaflet-popup-content { margin: 0 !important; padding: 0 !important; border-radius: 12px !important; }
        .modern-popup .leaflet-popup-tip { background: white !important; border: 1px solid #e5e7eb !important; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100vh', background: 'white' }} />
        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 420, background: 'rgba(255,255,255,.95)', padding: '16px 18px', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0,0,0,.1)' }}>
          <h4 style={{ margin: 0, fontSize: '.9rem', fontWeight: 700, color: '#111827' }}>{currentMetric?.name || 'Metric'} Scale</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {(currentMetric?.colorScale || []).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #f3f4f6', padding: '4px 8px', borderRadius: 6 }}>
                <div style={{ width: 16, height: 16, background: r.color, borderRadius: 3, border: '1px solid rgba(0,0,0,.1)' }} />
                <span style={{ fontSize: '.8rem', color: '#374151' }}>{r.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #f3f4f6', padding: '4px 8px', borderRadius: 6 }}>
              <div style={{ width: 16, height: 16, background: '#e5e7eb', borderRadius: 3, border: '1px solid rgba(0,0,0,.1)' }} />
              <span style={{ fontSize: '.8rem', color: '#6b7280' }}>No data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: 400, background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => { if (setCurrentPage) setCurrentPage('home'); else window.history.back(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '.85rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: '#111827' }}>
            ZIP Market Map
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '.85rem' }}>
            {currentMetric?.name || 'Metric'} • {hasDataCount.toLocaleString()} ZIPs
          </p>
          <div style={{ marginTop: 6, fontSize: '.75rem', color: '#6b7280' }}>Zoom to 6+ for points.</div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '14px 0 6px 0', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={18} style={{ color: '#3b82f6' }} />
            Analysis Metrics
          </h2>
          <p style={{ fontSize: '.8rem', color: '#6b7280', margin: 0 }}>Select a metric to visualize ZIP-level data</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(zipMetrics).map(([key, metric]) => {
                const Icon = metric.icon;
                const isSel = metricKey === key;
                return (
                  <button key={key} onClick={() => setSelectedMetric(key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: 16, background: isSel ? 'linear-gradient(135deg,#3b82f6 0%,#1e40af 100%)' : 'white', color: isSel ? 'white' : '#374151', border: isSel ? 'none' : '1px solid #e5e7eb', borderRadius: 12, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Icon size={22} style={{ color: isSel ? 'white' : '#3b82f6' }} />
                      <div style={{ fontWeight: 700 }}>{metric.name}</div>
                    </div>
                    <div style={{ fontSize: '.8rem', color: isSel ? 'rgba(255, 255, 255, 0.9)' : '#6b7280' }}>{metric.description}</div>
                    <div style={{ fontSize: '.72rem', color: isSel ? 'rgba(255, 255, 255, 0.8)' : '#9ca3af', marginTop: 6, fontStyle: 'italic' }}>{metric.dataSource}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={densityEnabled} onChange={(e) => setDensityEnabled(e.target.checked)} style={{ cursor: 'pointer' }} />
                Population Density (ZCTA)
              </label>
            </div>
          </div>

          {/* CHATBOT SECTION */}
          <div style={{
            borderTop: '2px solid #e5e7eb',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            height: '300px',
            marginTop: 'auto'
          }}>
            {/* Chatbot Header */}
            <div style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MessageSquare size={16} />
              ZIP Code Data Assistant
            </div>
            
            {/* Chat Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px',
              background: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {chatMessages.map((msg, i) => (
                <div 
                  key={i} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    lineHeight: '1.3',
                    whiteSpace: 'pre-wrap',
                    background: msg.sender === 'user' 
                      ? '#667eea'
                      : 'white',
                    color: msg.sender === 'user' ? 'white' : '#1f2937',
                    border: msg.sender === 'bot' ? '1px solid #e5e7eb' : 'none'
                  }}>
                    {msg.text}
                  </div>
                  <span style={{
                    fontSize: '0.6rem',
                    color: '#9ca3af',
                    marginTop: '2px'
                  }}>
                    {msg.timestamp.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
              {isTyping && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '6px',
                  background: 'white',
                  borderRadius: '6px',
                  width: 'fit-content',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#9ca3af',
                    animation: 'pulse 1.4s infinite'
                  }}></div>
                  <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#9ca3af',
                    animation: 'pulse 1.4s infinite',
                    animationDelay: '0.2s'
                  }}></div>
                  <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#9ca3af',
                    animation: 'pulse 1.4s infinite',
                    animationDelay: '0.4s'
                  }}></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input Area */}
            <div style={{
              padding: '10px',
              borderTop: '1px solid #e5e7eb',
              background: 'white'
            }}>
              <div style={{
                display: 'flex',
                gap: '6px'
              }}>
                <input 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleChatSend()}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    outline: 'none'
                  }}
                  placeholder="Ex: 'migration inflow above 10' or 'highest income'" 
                />
                <button 
                  onClick={handleChatSend}
                  style={{
                    padding: '6px 10px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, borderTop: '1px solid #f3f4f6', background: '#f9fafb' }}>
          <div style={{ background: 'white', padding: 14, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: '.85rem', fontWeight: 700, margin: '0 0 6px 0', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} style={{ color: '#3b82f6' }} />
              {currentMetric?.name} Details
            </h4>
            <p style={{ fontSize: '.75rem', color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
              <strong>Calculation:</strong> {currentMetric.calculation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketHeatMap;