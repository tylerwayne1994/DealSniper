import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, TrendingUp, DollarSign, Home, Users, Building2,
  Filter, Info, ArrowLeft, Activity, MessageSquare, ArrowUpDown
} from "lucide-react";
import Papa from "papaparse";

/* ===== Paths ===== */
const FMR_PATH = "/FY26_FMRs - FY26_FMRs.csv";
const MIGRATION_PATH = "/migration_with_clean_zipcodes.csv";
const PERMITS_2024_PATH = "/co2408y.txt";
const PERMITS_2025_PATH = "/co2508y.txt";

/* ===== Utils ===== */
const isNum = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const clean = (v) => {
  if (v==null||v===""||v==="-"||v==="N"||v==="(X)"||/-666|-888|-999/.test(String(v))) return null;
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? null : n;
};
const extractFips = (geoId) => (typeof geoId === "string" && geoId.includes("US") ? geoId.split("US")[1] : null);
const parseLoc = (name) => {
  if (typeof name === "string" && name.includes(",")) {
    const [a,b] = name.split(",").map(s=>s.trim());
    return {county:a, state:b};
  }
  return {county:name, state:null};
};
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

/* ===== HUD FY26: convert HUD composite to 5-digit county FIPS =====
   CSV columns (confirmed): stusps, state, hud_area_code, countyname,
   hud_area_name, fips, pop2023, fmr_0..fmr_4
   'state' = numeric state FIPS; county code = floor(fips/100000) % 1000
*/
const hudRowToCountyFIPS = (r) => {
  const s = Number(r.state);
  const f = Number(r.fips);
  if (!Number.isFinite(s) || !Number.isFinite(f)) return null;
  const county = Math.floor(f / 100000) % 1000;
  return String(s).padStart(2,"0") + String(county).padStart(3,"0");
};

/* ===== Metric definitions (incl. FMR + Migration) ===== */
const DOLLAR = [
  [-Infinity, 900, "#16a34a", "<$900"],
  [900, 1200, "#84cc16", "$900–$1.2k"],
  [1200, 1600, "#eab308", "$1.2k–$1.6k"],
  [1600, 2000, "#f59e0b", "$1.6k–$2.0k"],
  [2000, 2500, "#ea580c", "$2.0k–$2.5k"],
  [2500, Infinity, "#dc2626", ">$2.5k"],
].map(([min,max,color,label])=>({min,max,color,label}));

const MIGRATION = [
  [-Infinity, -20, "#7f1d1d", "Heavy Outflow"],
  [-20, -10, "#dc2626", "High Outflow"], 
  [-10, -5, "#f59e0b", "Moderate Outflow"],
  [-5, 0, "#fbbf24", "Slight Outflow"],
  [0, 5, "#84cc16", "Slight Inflow"],
  [5, 10, "#22c55e", "Moderate Inflow"],
  [10, 20, "#16a34a", "High Inflow"],
  [20, Infinity, "#166534", "Heavy Inflow"]
].map(([min,max,color,label])=>({min,max,color,label}));

const metricsDef = {
  populationGrowth: {
    name: "Population Growth",
    shortName: "Pop Growth",
    icon: Users,
    description: "Annual population growth rate",
    dataSource: "US Census ACS 2018–2023",
    calculation: "(2023−2018)/2018 ÷ 5",
    colorScale: [[-Infinity,0,"#dc2626","<0%"],[0,2,"#16a34a","0–2%"],[2,4,"#22c55e","2–4%"],[4,6,"#4ade80","4–6%"],[6,8,"#84cc16","6–8%"],[8,10,"#a3e635","8–10%"],[10,12,"#65a30d","10–12%"],[12,Infinity,"#365314",">12%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  appreciation: {
    name: "Price Appreciation",
    shortName: "Appreciation",
    icon: TrendingUp,
    description: "Estimated annual home price growth",
    dataSource: "Census + derived",
    calculation: "Population + Income + Vacancy + Employment",
    colorScale: [[-Infinity,0,"#dc2626","<0%"],[0,3,"#16a34a","0–3%"],[3,6,"#22c55e","3–6%"],[6,9,"#4ade80","6–9%"],[9,12,"#84cc16","9–12%"],[12,15,"#a3e635","12–15%"],[15,Infinity,"#365314",">15%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  rtpRatio: {
    name: "Rent-to-Price Ratio",
    shortName: "RTP Ratio",
    icon: DollarSign,
    description: "Annual rent as % of value",
    dataSource: "Census + estimated values",
    calculation: "(12×rent)/price × 100",
    colorScale: [[-Infinity,.5,"#dc2626","<0.5%"],[.5,.7,"#ea580c","0.5–0.7%"],[.7,.9,"#f59e0b","0.7–0.9%"],[.9,1.1,"#eab308","0.9–1.1%"],[1.1,1.3,"#84cc16","1.1–1.3%"],[1.3,Infinity,"#16a34a",">1.3%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  affordability: {
    name: "Housing Affordability",
    shortName: "Affordability",
    icon: Home,
    description: "Rent as % of income",
    dataSource: "Census DP03/DP04",
    calculation: "rent/(income/12) × 100",
    colorScale: [[-Infinity,10,"#16a34a","<10%"],[10,20,"#84cc16","10–20%"],[20,30,"#eab308","20–30%"],[30,40,"#f59e0b","30–40%"],[40,50,"#ea580c","40–50%"],[50,Infinity,"#dc2626",">50%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  unemployment: {
    name: "Unemployment Rate",
    shortName: "Unemployment",
    icon: Activity,
    description: "Current unemployment %",
    dataSource: "Census S2301",
    calculation: "direct",
    colorScale: [[-Infinity,2,"#16a34a","<2%"],[2,4,"#84cc16","2–4%"],[4,6,"#eab308","4–6%"],[6,8,"#f59e0b","6–8%"],[8,10,"#ea580c","8–10%"],[10,Infinity,"#dc2626",">10%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  housingStock: {
    name: "Housing Stock",
    shortName: "Housing Stock",
    icon: MapPin,
    description: "Vacancy rate (lower = tighter)",
    dataSource: "Census DP04",
    calculation: "direct",
    colorScale: [[-Infinity,2,"#166534","<2% (Excellent)"],[2,4,"#15803d","2–4%"],[4,6,"#16a34a","4–6%"],[6,8,"#22c55e","6–8%"],[8,12,"#fbbf24","8–12%"],[12,18,"#f59e0b","12–18%"],[18,Infinity,"#dc2626",">18%"]].map(([min,max,color,label])=>({min,max,color,label}))
  },
  migration: {
    name: "Net Migration Rate",
    shortName: "Migration",
    icon: ArrowUpDown,
    description: "Net migration per 1,000 residents (green=inflow, red=outflow)",
    dataSource: "IRS Migration Data 2021",
    calculation: "Net migration per 1,000 population from IRS county-to-county flows",
    colorScale: MIGRATION
  },
  fmr: {
    name: "HUD FMR (0–4BR)",
    shortName: "FMR",
    icon: DollarSign,
    description: "HUD Fair Market Rent — choose bedroom size",
    dataSource: "HUD FY26 FMRs (county)",
    calculation: "Direct from HUD FY26 CSV",
    colorScale: DOLLAR
  },
  multifamilyPermits: {
    name: "Multifamily Construction (5+ Units)",
    shortName: "MF Permits",
    icon: Building2,
    description: "New 5+ unit construction permits issued (Aug 2025)",
    dataSource: "Census Building Permits Survey 2025",
    calculation: "Direct from 5+ units column",
    colorScale: [
      [-Infinity, 0, "#e5e7eb", "No Activity"],
      [0, 10, "#fef3c7", "1-10 units"],
      [10, 50, "#fde047", "10-50 units"],
      [50, 100, "#facc15", "50-100 units"],
      [100, 250, "#eab308", "100-250 units"],
      [250, 500, "#ca8a04", "250-500 units"],
      [500, Infinity, "#a16207", "500+ units 🔥"]
    ].map(([min,max,color,label])=>({min,max,color,label}))
  },
  permitGrowth: {
    name: "Construction Growth (YoY)",
    shortName: "Permit Growth",
    icon: TrendingUp,
    description: "Year-over-year change in total permits (Aug 2024 → Aug 2025)",
    dataSource: "Census Building Permits (2024 vs 2025)",
    calculation: "((2025 units - 2024 units) / 2024 units) × 100",
    colorScale: [
      [-Infinity, -50, "#7f1d1d", "Heavy Decline"],
      [-50, -20, "#dc2626", "Sharp Decline"],
      [-20, -10, "#f59e0b", "Decline"],
      [-10, 0, "#fbbf24", "Slight Decline"],
      [0, 10, "#84cc16", "Slight Growth"],
      [10, 25, "#22c55e", "Moderate Growth"],
      [25, 50, "#16a34a", "Strong Growth"],
      [50, Infinity, "#166534", "Explosive 🚀"]
    ].map(([min,max,color,label])=>({min,max,color,label}))
  },
  developmentIntensity: {
    name: "Development Intensity",
    shortName: "Dev Intensity",
    icon: Activity,
    description: "Permits per 1,000 residents (higher = more active market)",
    dataSource: "Building Permits ÷ Population",
    calculation: "(total permits 2025 / population) × 1000",
    colorScale: [
      [-Infinity, 1, "#e5e7eb", "< 1‰ (Stagnant)"],
      [1, 3, "#fde047", "1-3‰"],
      [3, 5, "#facc15", "3-5‰"],
      [5, 8, "#eab308", "5-8‰"],
      [8, 12, "#84cc16", "8-12‰"],
      [12, 20, "#22c55e", "12-20‰ (Active)"],
      [20, Infinity, "#16a34a", "> 20‰ (Boom)"]
    ].map(([min,max,color,label])=>({min,max,color,label}))
  },
  multifamilyShare: {
    name: "Multifamily Market Share",
    shortName: "MF Share",
    icon: Building2,
    description: "5+ unit permits as % of total construction",
    dataSource: "Building Permits (5+ units / total)",
    calculation: "(5+ unit permits / total permits) × 100",
    colorScale: [
      [-Infinity, 5, "#e5e7eb", "< 5% (SF Dom.)"],
      [5, 15, "#fde047", "5-15%"],
      [15, 30, "#facc15", "15-30%"],
      [30, 50, "#eab308", "30-50%"],
      [50, 70, "#84cc16", "50-70%"],
      [70, Infinity, "#16a34a", "> 70% (MF Heavy)"]
    ].map(([min,max,color,label])=>({min,max,color,label}))
  }
};

/* ===== Derived metrics ===== */
const calcAppreciation = (c) => {
  let a = 3.2, conf = 0.6;
  const pg = c.populationGrowth, inc = c.medianHouseholdIncome, vac = c.vacancyRate, un = c.unemploymentRate, pop = c.totalPopulation||0;
  if (isNum(pg)) { if(pg>5){a+=7;conf+=.2}else if(pg>3){a+=5;conf+=.15}else if(pg>1.5){a+=3;conf+=.1}else if(pg>0.5){a+=1.5;conf+=.05}else if(pg<-1){a-=4;conf+=.1}else if(pg<0){a-=2;conf+=.05} }
  if (isNum(inc)) { if(inc>100000){a+=3;conf+=.1}else if(inc>75000){a+=2;conf+=.05}else if(inc>50000){a+=1}else if(inc<35000){a-=1.5} }
  if (isNum(vac)) { if(vac<2){a+=4;conf+=.15}else if(vac<4){a+=2.5;conf+=.1}else if(vac<6){a+=1;conf+=.05}else if(vac>15){a-=3;conf+=.1}else if(vac>10){a-=1.5;conf+=.05} }
  if (isNum(un))  { if(un<3){a+=2;conf+=.05}else if(un<5){a+=1}else if(un>8){a-=2;conf+=.05}else if(un>6){a-=1} }
  if (pop>500000) a+=1.5; else if (pop>100000) a+=.8; else if (pop<25000) a-=1;
  return clamp(Math.round(a*10)/10,-8,25);
};

const derive = (c) => {
  const d = { ...c };
  d.appreciation = calcAppreciation(c);
  if (isNum(c.medianGrossRent) && isNum(c.medianHouseholdIncome)) d.rtpRatio = (c.medianGrossRent*12/(c.medianHouseholdIncome*3.8))*100;
  if (isNum(c.medianHouseholdIncome) && isNum(c.medianGrossRent)) d.affordability = (c.medianGrossRent/(c.medianHouseholdIncome/12))*100;
  return d;
};

/* ===== CSV loader ===== */
const loadCSV = async (url, type) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${type} HTTP ${res.status}`);
  const txt = await res.text();
  
  // Building permit files have 2 header rows + blank line, use row 2 as headers
  const isPermitFile = type === "permits2024" || type === "permits2025";
  
  if (isPermitFile) {
    // Split into lines and use line 2 (index 1) as headers
    const lines = txt.split('\n');
    const headers = lines[1]; // "Date,State,County,Code,Code,Name,Bldgs,Units,Value..."
    const dataLines = lines.slice(3); // Skip header rows and blank line
    const permitCSV = headers + '\n' + dataLines.join('\n');
    
    const parsed = Papa.parse(permitCSV, { 
      header: true, 
      skipEmptyLines: true, 
      dynamicTyping: true
    });
    
    console.log(`[${type}] Column names:`, parsed.meta?.fields);
    console.log(`[${type}] First data row:`, parsed.data[0]);
    console.log(`[${type}] Total rows:`, parsed.data.length);
    
    return { type, data: parsed.data, fields: parsed.meta?.fields || [] };
  }
  
  // Normal CSV processing for other files
  const parsed = Papa.parse(txt, { 
    header: true, 
    skipEmptyLines: true, 
    dynamicTyping: true
  });
  
  const isCensusData = type !== "fmr26" && type !== "migration";
  const data = isCensusData ? parsed.data.slice(1) : parsed.data; // Census first row = metadata
  
  return { type, data, fields: parsed.meta?.fields || [] };
};

/* ===== Component ===== */
const CountyChoroplethMap = ({ setCurrentPage }) => {
  const [selectedMetric, setSelectedMetric] = useState("fmr");
  const [bedroom, setBedroom] = useState("2");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countyData, setCountyData] = useState({});
  const [geoJsonData, setGeoJsonData] = useState(null);

  const [chatMessages, setChatMessages] = useState([
    { text: "IRS Migration + HUD FMR + Census + **Building Permits** loaded! Ask about: growth, unemployment, affordability, RTP, vacancy, appreciation, migration, **multifamily construction**, **permit growth**, **development intensity** — e.g., 'highest multifamily permits in TX' or 'fastest permit growth < 50%'", sender: "bot", timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  const metrics = useMemo(() => metricsDef, []);

  const getVal = (c, k) => {
    if (!c) return null;
    let val = null;
    if (k==="populationGrowth") val = c.populationGrowth;
    else if (k==="appreciation") val = c.appreciation;
    else if (k==="rtpRatio") val = c.rtpRatio;
    else if (k==="affordability") val = c.affordability;
    else if (k==="unemployment") val = c.unemploymentRate;
    else if (k==="housingStock") val = c.vacancyRate;
    else if (k==="migration") val = c.migrationRate;
    else if (k==="fmr") val = c[`fmr_${bedroom}`];
    else if (k==="multifamilyPermits") val = c.multifamilyUnits2025;
    else if (k==="permitGrowth") val = c.permitGrowth;
    else if (k==="developmentIntensity") val = c.developmentIntensity;
    else if (k==="multifamilyShare") val = c.multifamilyShare;
    
    // Debug multifamily share values
    if (k === "multifamilyShare" && c.fips && Math.random() < 0.01) {
      console.log(`MF Share debug - FIPS: ${c.fips}, multifamilyShare: ${c.multifamilyShare}, multifamilyUnits2025: ${c.multifamilyUnits2025}, totalUnits2025: ${c.totalUnits2025}, val: ${val}`);
    }
    
    return val;
  };

  const colorFor = (v, k) => !isNum(v) ? "#e5e7eb" : (metrics[k].colorScale.find(r => v>=r.min && v<r.max)?.color || metrics[k].colorScale.at(-1).color);
  const fmt = (v, k) => !isNum(v) ? "No data" : 
    (k==="fmr" ? `$${Math.round(v).toLocaleString()}` : 
     k==="affordability" ? `${Math.round(v)}%` : 
     k==="housingStock" ? `${v.toFixed(1)}% vacancy` : 
     k==="migration" ? `${v > 0 ? '+' : ''}${v.toFixed(1)}‰` :
     k==="multifamilyPermits" ? `${Math.round(v).toLocaleString()} units` :
     k==="permitGrowth" ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` :
     k==="developmentIntensity" ? `${v.toFixed(1)}‰` :
     k==="multifamilyShare" ? `${v.toFixed(0)}%` :
     `${v.toFixed(1)}%`);
  const featFips = (f) => f.id || f.properties?.FIPS || f.properties?.fips;

  /* ===== Process Census ===== */
  const processCensus = (datasets) => {
    const { economic=[], housing=[], population2023=[], population2018=[], employment=[] } = datasets;
    const base = {};
    const prime = (row) => {
      const f = extractFips(row.GEO_ID);
      if (!f) return;
      const { county, state } = parseLoc(row.NAME || "");
      if (!base[f]) base[f] = { fips:f, name:county, state, fullName: county && state ? `${county}, ${state}` : `FIPS ${f}` };
    };
    [economic,housing,population2023,population2018,employment].forEach(arr=>arr.forEach(prime));

    economic.forEach(r => { const f=extractFips(r.GEO_ID); if(!f||!base[f])return; base[f].medianHouseholdIncome=clean(r.DP03_0062E); });
    const hMap = new Map(); housing.forEach(r=>{const f=extractFips(r.GEO_ID); if(f) hMap.set(f,r);});
    Object.values(base).forEach(c=>{
      const hr=hMap.get(c.fips); if(!hr) return;
      c.vacancyRate = clean(hr.DP04_0003PE);
      c.medianGrossRent = clean(hr.DP04_0134E);
    });

    const p23=new Map(), p18=new Map();
    population2023.forEach(r=>{const f=extractFips(r.GEO_ID); if(f)p23.set(f,r);});
    population2018.forEach(r=>{const f=extractFips(r.GEO_ID); if(f)p18.set(f,r);});
    Object.values(base).forEach(c=>{
      const r23=p23.get(c.fips), r18=p18.get(c.fips);
      if(r23) c.totalPopulation=clean(r23.B01003_001E);
      if(r18) c.historicalPopulation=clean(r18.B01003_001E);
      if(isNum(c.totalPopulation)&&isNum(c.historicalPopulation)&&c.historicalPopulation>0){
        c.populationGrowth=((c.totalPopulation-c.historicalPopulation)/c.historicalPopulation)/5*100;
      }
    });

    const eMap=new Map(); employment.forEach(r=>{const f=extractFips(r.GEO_ID); if(f)eMap.set(f,r);});
    Object.values(base).forEach(c=>{const er=eMap.get(c.fips); if(er) c.unemploymentRate=clean(er.S2301_C04_001E);});

    const out={}; Object.entries(base).forEach(([f,c])=>out[f]=derive(c));
    return out;
  };

  /* ===== Process Migration Data (IRS) ===== */
  const processMigration = (rows) => {
    const migrationData = {};
    let processed = 0, skipped = 0;

    rows.forEach((row, i) => {
      // Convert countyfips to 5-digit FIPS string
      let fips5 = String(row.countyfips).padStart(5, "0");
      const netMigrationRate = clean(row.n2_0_net_pc); // Net migration per capita
      
      if (!fips5 || fips5 === "00000" || !isNum(netMigrationRate)) {
        skipped++;
        if (skipped < 5) console.log("Skipping row:", { countyfips: row.countyfips, netRate: netMigrationRate });
        return;
      }

      migrationData[fips5] = {
        fips: fips5,
        migrationRate: Math.round(netMigrationRate * 1000) / 10, // Convert to per 1000 and round to 1 decimal
        countyName: row.countyname || `FIPS ${fips5}`,
        stateName: row.state_name || row.state,
        population2021: clean(row.pop_2021),
        netMigration: clean(row.n2_0_net), // Absolute net migration
        inMigration: clean(row.n2_0_in),
        outMigration: clean(row.n2_0_out)
      };
      processed++;
      
      // Log first few successful processing for debugging
      if (processed <= 3) {
        console.log(`Migration row ${processed}:`, {
          original_fips: row.countyfips,
          padded_fips: fips5,
          county: row.countyname,
          state: row.state_name,
          rate: netMigrationRate,
          converted_rate: Math.round(netMigrationRate * 1000) / 10
        });
      }
    });

    console.log(`[IRS Migration] processed=${processed}, skipped=${skipped}, counties=${Object.keys(migrationData).length}`);
    
    // Log FIPS distribution to debug mapping issues
    const fipsSample = Object.keys(migrationData).slice(0, 10);
    console.log("Sample FIPS codes from migration data:", fipsSample);
    
    const sample = Object.values(migrationData).find(c => isNum(c.migrationRate));
    if (sample) {
      console.log("Sample migration data:", { 
        fips: sample.fips, 
        county: sample.countyName,
        state: sample.stateName,
        rate: sample.migrationRate,
        netMig: sample.netMigration 
      });
    }

    return migrationData;
  };

  /* ===== Process Building Permits ===== */
  const processPermits = (rows2024, rows2025) => {
    const permitData = {};
    let processed = 0, skipped = 0;

    // Process 2024 data
    rows2024.forEach((row, idx) => {
      // Column names from row 2: Date, State, County, Code, Code, Name, Bldgs, Units, Value...
      // PapaParse will rename duplicates: State, County, Code, Code.1, Name, etc.
      const stateFips = row.State;
      const countyFips = row.County;
      
      if (!stateFips || !countyFips) {
        if (idx < 3) {
          console.log(`Skipping 2024 row ${idx}:`, {
            stateFips, 
            countyFips,
            availableKeys: Object.keys(row),
            sample: row
          });
        }
        skipped++;
        return;
      }

      const fips5 = String(stateFips).padStart(2, "0") + String(countyFips).padStart(3, "0");

      if (fips5 === "00000" || fips5.length !== 5) {
        skipped++;
        return;
      }

      // The column pattern: Bldgs, Units, Value repeats for each unit type
      // After Date,State,County,Code,Code_1,Name comes:
      // Bldgs, Units, Value (1-unit)
      // Bldgs_1, Units_1, Value_1 (2-units)
      // Bldgs_2, Units_2, Value_2 (3-4 units)
      // Bldgs_3, Units_3, Value_3 (5+ units)
      const oneUnit = clean(row.Units);
      const twoUnits = clean(row.Units_1);
      const threeUnits = clean(row.Units_2);
      const fiveUnits = clean(row.Units_3);

      permitData[fips5] = {
        fips: fips5,
        countyName: row.Name,
        
        // 2024 totals
        totalUnits2024: (oneUnit || 0) + (twoUnits || 0) + (threeUnits || 0) + (fiveUnits || 0),
        
        // Multifamily (5+ units)
        multifamilyUnits2024: fiveUnits || 0,
        multifamilyBuildings2024: clean(row.Bldgs_3) || 0,
        multifamilyValue2024: clean(row.Value_3) || 0,
        
        // Single-family
        singleFamilyUnits2024: oneUnit || 0
      };
      
      // Log first successful parse
      if (processed === 0) {
        console.log("First 2024 permit row parsed:", {
          fips: fips5,
          county: permitData[fips5].countyName,
          total: permitData[fips5].totalUnits2024,
          mf: permitData[fips5].multifamilyUnits2024
        });
      }
      processed++;
    });

    console.log(`[Permits 2024] processed=${processed}, skipped=${skipped}`);
    processed = 0;
    skipped = 0;

    // Process 2025 data
    rows2025.forEach((row, idx) => {
      const stateFips = row.State;
      const countyFips = row.County;
      
      if (!stateFips || !countyFips) {
        if (idx < 3) console.log(`Skipping 2025 row ${idx} - missing FIPS:`, row);
        skipped++;
        return;
      }

      const fips5 = String(stateFips).padStart(2, "0") + String(countyFips).padStart(3, "0");

      if (fips5 === "00000" || fips5.length !== 5) {
        skipped++;
        return;
      }

      if (!permitData[fips5]) {
        permitData[fips5] = {
          fips: fips5,
          countyName: row.Name
        };
      }

      // Get unit counts using the same column pattern
      const oneUnit = clean(row.Units);
      const twoUnits = clean(row.Units_1);
      const threeUnits = clean(row.Units_2);
      const fiveUnits = clean(row.Units_3);

      // 2025 totals
      permitData[fips5].totalUnits2025 = (oneUnit || 0) + (twoUnits || 0) + (threeUnits || 0) + (fiveUnits || 0);
      
      // Multifamily (5+ units)
      permitData[fips5].multifamilyUnits2025 = fiveUnits || 0;
      permitData[fips5].multifamilyBuildings2025 = clean(row.Bldgs_3) || 0;
      permitData[fips5].multifamilyValue2025 = clean(row.Value_3) || 0;
      
      // Single-family
      permitData[fips5].singleFamilyUnits2025 = oneUnit || 0;

      // Log first successful parse
      if (processed === 0) {
        console.log("First 2025 permit row parsed:", {
          fips: fips5,
          county: permitData[fips5].countyName,
          total: permitData[fips5].totalUnits2025,
          mf: permitData[fips5].multifamilyUnits2025
        });
      }
      processed++;
    });

    console.log(`[Permits 2025] processed=${processed}, skipped=${skipped}`);

    // Calculate derived metrics
    let withGrowth = 0, withShare = 0;
    Object.values(permitData).forEach(c => {
      // Permit growth (YoY)
      if (c.totalUnits2024 && c.totalUnits2024 > 0 && c.totalUnits2025 != null) {
        c.permitGrowth = ((c.totalUnits2025 - c.totalUnits2024) / c.totalUnits2024) * 100;
        withGrowth++;
      }
      
      // Multifamily growth
      if (c.multifamilyUnits2024 && c.multifamilyUnits2024 > 0 && c.multifamilyUnits2025 != null) {
        c.multifamilyGrowth = ((c.multifamilyUnits2025 - c.multifamilyUnits2024) / c.multifamilyUnits2024) * 100;
      }
      
      // Multifamily market share (check >= 0 since 0 is valid)
      if (c.totalUnits2025 > 0 && c.multifamilyUnits2025 != null && c.multifamilyUnits2025 >= 0) {
        c.multifamilyShare = (c.multifamilyUnits2025 / c.totalUnits2025) * 100;
        withShare++;
      }
    });

    console.log(`[Permits Metrics] counties=${Object.keys(permitData).length}, withGrowth=${withGrowth}, withShare=${withShare}`);
    
    // Log sample with market share data
    const sampleWithShare = Object.values(permitData).find(c => c.multifamilyShare && c.multifamilyShare > 0);
    if (sampleWithShare) {
      console.log("Sample county WITH market share:", {
        fips: sampleWithShare.fips,
        county: sampleWithShare.countyName,
        mf2025: sampleWithShare.multifamilyUnits2025,
        total2025: sampleWithShare.totalUnits2025,
        mfShare: sampleWithShare.multifamilyShare?.toFixed(1) + '%'
      });
    }
    
    // Log sample with zero market share
    const sampleZeroShare = Object.values(permitData).find(c => c.totalUnits2025 > 0 && c.multifamilyUnits2025 === 0);
    if (sampleZeroShare) {
      console.log("Sample county with ZERO market share (all single-family):", {
        fips: sampleZeroShare.fips,
        county: sampleZeroShare.countyName,
        mf2025: sampleZeroShare.multifamilyUnits2025,
        total2025: sampleZeroShare.totalUnits2025,
        mfShare: sampleZeroShare.multifamilyShare
      });
    }
    
    // Log sample with data
    const sample = Object.values(permitData).find(c => c.multifamilyUnits2025 && c.multifamilyUnits2025 > 10);
    if (sample) {
      console.log("Sample permit data with MF units:", {
        fips: sample.fips,
        county: sample.countyName,
        mf2024: sample.multifamilyUnits2024,
        mf2025: sample.multifamilyUnits2025,
        total2025: sample.totalUnits2025,
        growth: sample.permitGrowth?.toFixed(1),
        mfShare: sample.multifamilyShare?.toFixed(1)
      });
    } else {
      console.warn("No permit data found with multifamily units > 10");
      // Log first 3 records to debug
      Object.values(permitData).slice(0, 3).forEach(c => {
        console.log("Sample data:", c);
      });
    }

    return permitData;
  };

  /* ===== Merge FY26 FMR ===== */
  const mergeFMR = (counties, rows) => {
    let merged=0, created=0, bad=0;
    rows.forEach((r,i)=>{
      const fips5 = hudRowToCountyFIPS(r);
      if(!fips5){bad++; if(bad<5) console.warn("Bad FY26 row",i,r); return;}
      if(!counties[fips5]){
        counties[fips5] = {
          fips: fips5,
          name: r.countyname || `FIPS ${fips5}`,
          state: r.stusps || undefined,
          fullName: r.countyname && r.stusps ? `${r.countyname}, ${r.stusps}` : `FIPS ${fips5}`
        };
        created++;
      }
      counties[fips5].fmr_0 = clean(r.fmr_0);
      counties[fips5].fmr_1 = clean(r.fmr_1);
      counties[fips5].fmr_2 = clean(r.fmr_2);
      counties[fips5].fmr_3 = clean(r.fmr_3);
      counties[fips5].fmr_4 = clean(r.fmr_4);
      if (r.hud_area_name) counties[fips5].hudAreaName = r.hud_area_name;
      if (isNum(r.pop2023)) counties[fips5].hudPop2023 = r.pop2023;
      merged++;
    });
    console.log(`[FY26 FMR] merged=${merged}, created=${created}, bad_rows=${bad}`);
    return counties;
  };

  /* ===== Merge Migration Data ===== */
  const mergeMigration = (counties, migrationData) => {
    let merged = 0, created = 0;
    Object.values(migrationData).forEach(migData => {
      if (!counties[migData.fips]) {
        counties[migData.fips] = {
          fips: migData.fips,
          fullName: migData.countyName && migData.stateName ? `${migData.countyName}, ${migData.stateName}` : `FIPS ${migData.fips}`
        };
        created++;
      }
      counties[migData.fips].migrationRate = migData.migrationRate;
      counties[migData.fips].netMigration = migData.netMigration;
      counties[migData.fips].inMigration = migData.inMigration;
      counties[migData.fips].outMigration = migData.outMigration;
      counties[migData.fips].population2021 = migData.population2021;
      // Update name if we have better data
      if (migData.countyName && migData.stateName) {
        counties[migData.fips].fullName = `${migData.countyName}, ${migData.stateName}`;
      }
      merged++;
    });
    console.log(`[Migration] merged=${merged}, created=${created}`);
    return counties;
  };

  /* ===== Merge Building Permits ===== */
  const mergePermits = (counties, permitData) => {
    let merged = 0, created = 0;
    Object.values(permitData).forEach(permData => {
      if (!counties[permData.fips]) {
        counties[permData.fips] = {
          fips: permData.fips,
          fullName: permData.countyName ? `${permData.countyName}` : `FIPS ${permData.fips}`
        };
        created++;
      }
      
      // Merge all permit fields
      counties[permData.fips].totalUnits2024 = permData.totalUnits2024;
      counties[permData.fips].totalUnits2025 = permData.totalUnits2025;
      counties[permData.fips].multifamilyUnits2024 = permData.multifamilyUnits2024;
      counties[permData.fips].multifamilyUnits2025 = permData.multifamilyUnits2025;
      counties[permData.fips].multifamilyBuildings2024 = permData.multifamilyBuildings2024;
      counties[permData.fips].multifamilyBuildings2025 = permData.multifamilyBuildings2025;
      counties[permData.fips].multifamilyValue2024 = permData.multifamilyValue2024;
      counties[permData.fips].multifamilyValue2025 = permData.multifamilyValue2025;
      counties[permData.fips].singleFamilyUnits2024 = permData.singleFamilyUnits2024;
      counties[permData.fips].singleFamilyUnits2025 = permData.singleFamilyUnits2025;
      counties[permData.fips].permitGrowth = permData.permitGrowth;
      counties[permData.fips].multifamilyGrowth = permData.multifamilyGrowth;
      counties[permData.fips].multifamilyShare = permData.multifamilyShare;
      
      // Calculate development intensity (per 1000 residents)
      if (counties[permData.fips].totalPopulation && counties[permData.fips].totalPopulation > 0 && permData.totalUnits2025) {
        counties[permData.fips].developmentIntensity = (permData.totalUnits2025 / counties[permData.fips].totalPopulation) * 1000;
      }
      
      merged++;
    });
    console.log(`[Building Permits] merged=${merged}, created=${created}`);
    return counties;
  };

  /* ===== Load all ===== */
  const loadAll = async () => {
    try {
      setLoading(true); setError(null);

      const censusFiles = [
        ["/ACSDP5Y2023.DP03-Data.csv","economic"],
        ["/ACSDP5Y2023.DP04-Data.csv","housing"],
        ["/ACSDT5Y2023.B01003-Data.csv","population2023"],
        ["/ACSDT5Y2018.B01003-Data.csv","population2018"],
        ["/ACSST5Y2023.S2301-Data.csv","employment"]
      ];
      const res = await Promise.all(censusFiles.map(([u,t])=>loadCSV(u,t)));
      const loaded={}; res.forEach(({type,data})=>loaded[type]=data||[]);
      let counties = processCensus(loaded);

      const { data: fmrRows } = await loadCSV(FMR_PATH,"fmr26");
      if (!fmrRows?.length) throw new Error("FY26 FMR CSV empty");
      counties = mergeFMR(counties, fmrRows);

      const { data: migrationRows } = await loadCSV(MIGRATION_PATH, "migration");
      if (!migrationRows?.length) throw new Error("Migration CSV empty");
      const migrationData = processMigration(migrationRows);
      counties = mergeMigration(counties, migrationData);

      // Load building permits
      try {
        const { data: permits2024 } = await loadCSV(PERMITS_2024_PATH, "permits2024");
        const { data: permits2025 } = await loadCSV(PERMITS_2025_PATH, "permits2025");
        
        if (permits2024?.length && permits2025?.length) {
          const permitData = processPermits(permits2024, permits2025);
          counties = mergePermits(counties, permitData);
        } else {
          console.warn("Building permit data missing - continuing without it");
        }
      } catch (permitError) {
        console.warn("Failed to load building permits:", permitError);
      }

      const gj = await (await fetch("https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json")).json();
      setGeoJsonData(gj);

      // Ensure skeleton for every boundary
      const all = { ...counties };
      let boundaryCount = 0;
      let matchCount = 0;
      gj.features.forEach(ft => {
        const id = featFips(ft);
        boundaryCount++;
        if (all[id]) {
          matchCount++;
        } else {
          all[id] = { fips:id, fullName:`FIPS ${id}` };
        }
        // Log first few boundary FIPS for debugging
        if (boundaryCount <= 5) {
          console.log(`Boundary ${boundaryCount}: FIPS=${id}, has_migration_data=${!!counties[id]}`);
        }
      });
      
      console.log(`[Boundary matching] total_boundaries=${boundaryCount}, migration_matches=${matchCount}`);
      
      // Log migration FIPS vs boundary FIPS samples for comparison
      const migrationFips = Object.keys(counties).slice(0, 5);
      const boundaryFips = gj.features.slice(0, 5).map(f => featFips(f));
      console.log("Sample migration FIPS:", migrationFips);
      console.log("Sample boundary FIPS:", boundaryFips);

      setCountyData(all);
    } catch (e) {
      console.error("Load error:", e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  /* ===== Map ===== */
  const initMap = async () => {
    if (!mapRef.current || !geoJsonData) return;
    if (mapInstanceRef.current) mapInstanceRef.current.remove();
    mapRef.current.innerHTML=""; mapRef.current._leaflet_id=null;

    const L = await import("leaflet");
    delete L.default.Icon.Default.prototype._getIconUrl;
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const map = L.default.map(mapRef.current,{center:[39.8283,-98.5795],zoom:4,maxZoom:12,minZoom:3,zoomControl:true,attributionControl:false});
    L.default.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"© OpenStreetMap contributors",maxZoom:12}).addTo(map);
    mapInstanceRef.current = map;

    const render = () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      const layer = L.default.geoJSON(geoJsonData,{
        style:(f)=>{
          const c = countyData[featFips(f)];
          const v = getVal(c, selectedMetric);
          return { fillColor: colorFor(v, selectedMetric), weight:.6, opacity:1, color:"white", fillOpacity:.85 };
        },
        onEachFeature:(f,ly)=>{
          const c = countyData[featFips(f)] || { fips: featFips(f) };
          const v = getVal(c, selectedMetric);
          const titleBR = bedroom==="0"?"Studio/0BR":`${bedroom}BR`;
          const fmrTable = `
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-top:8px">
              <thead>
                <tr>
                  <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:4px 0">BR</th>
                  <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:4px 0">HUD FMR</th>
                </tr>
              </thead>
              <tbody>
                ${["0","1","2","3","4"].map(b=>{
                  const val=c[`fmr_${b}`];
                  return `<tr>
                    <td style="padding:4px 0">${b==="0"?"Studio/0BR":`${b}BR`}</td>
                    <td style="padding:4px 0;text-align:right">${isNum(val)?`$${Math.round(val).toLocaleString()}`:"—"}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>`;
          
          const migrationTable = `
            <div style="margin-top:8px;font-size:.8rem">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div><span style="color:#6b7280">Migration Rate:</span><br><strong>${isNum(c.migrationRate) ? (c.migrationRate > 0 ? '+' : '') + c.migrationRate.toFixed(1) + '‰' : 'N/A'}</strong></div>
                <div><span style="color:#6b7280">Net Migration:</span><br><strong>${c.netMigration?.toLocaleString() || 'N/A'}</strong></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
                <div><span style="color:#6b7280">In-Migration:</span><br><strong>${c.inMigration?.toLocaleString() || 'N/A'}</strong></div>
                <div><span style="color:#6b7280">Out-Migration:</span><br><strong>${c.outMigration?.toLocaleString() || 'N/A'}</strong></div>
              </div>
              <div style="margin-top:6px"><span style="color:#6b7280">Population (2021):</span> <strong>${c.population2021?.toLocaleString() || 'N/A'}</strong></div>
            </div>`;
          
          const permitTable = `
            <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-top:8px">
              <thead>
                <tr>
                  <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:4px 0">Unit Type</th>
                  <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:4px 0">Aug 2024</th>
                  <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:4px 0">Aug 2025</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:4px 0">1-unit (SF)</td>
                  <td style="padding:4px 0;text-align:right">${isNum(c.singleFamilyUnits2024) ? c.singleFamilyUnits2024.toLocaleString() : '—'}</td>
                  <td style="padding:4px 0;text-align:right">${isNum(c.singleFamilyUnits2025) ? c.singleFamilyUnits2025.toLocaleString() : '—'}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0">5+ units (MF)</td>
                  <td style="padding:4px 0;text-align:right">${isNum(c.multifamilyUnits2024) ? c.multifamilyUnits2024.toLocaleString() : '—'}</td>
                  <td style="padding:4px 0;text-align:right;font-weight:bold">${isNum(c.multifamilyUnits2025) ? c.multifamilyUnits2025.toLocaleString() : '—'}</td>
                </tr>
                <tr style="border-top:1px solid #e5e7eb;font-weight:600">
                  <td style="padding:4px 0">Total Units</td>
                  <td style="padding:4px 0;text-align:right">${isNum(c.totalUnits2024) ? c.totalUnits2024.toLocaleString() : '—'}</td>
                  <td style="padding:4px 0;text-align:right">${isNum(c.totalUnits2025) ? c.totalUnits2025.toLocaleString() : '—'}</td>
                </tr>
              </tbody>
            </table>
            <div style="margin-top:8px;font-size:.75rem;color:#6b7280">
              <div><strong>YoY Growth:</strong> ${isNum(c.permitGrowth) ? (c.permitGrowth > 0 ? '+' : '') + c.permitGrowth.toFixed(1) + '%' : 'N/A'}</div>
              <div><strong>MF Market Share:</strong> ${isNum(c.multifamilyShare) ? c.multifamilyShare.toFixed(1) + '%' : 'N/A'}</div>
              ${c.developmentIntensity ? `<div><strong>Dev Intensity:</strong> ${c.developmentIntensity.toFixed(1)}‰</div>` : ''}
            </div>`;

          const popup = `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);min-width:280px;max-width:340px">
              <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:14px 18px;border-radius:12px 12px 0 0">
                <div style="font-weight:700">${c.fullName || `FIPS ${c.fips}`}</div>
                <div style="opacity:.9;font-size:.8rem">FIPS: ${c.fips} • Pop: ${c.totalPopulation?.toLocaleString()||"N/A"}</div>
              </div>
              <div style="padding:14px 18px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-size:.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">${metrics[selectedMetric].name}</div>
                  <div style="font-size:1.35rem;font-weight:700;color:#1f2937">${fmt(v,selectedMetric)} ${selectedMetric==="fmr"?`(${titleBR})`:""}</div>
                </div>
                <div style="width:12px;height:12px;border-radius:50%;background:${colorFor(v,selectedMetric)};border:2px solid #fff"></div>
              </div>
              <div style="padding:14px 18px">
                ${selectedMetric==="fmr" ? fmrTable : 
                  selectedMetric==="migration" ? migrationTable :
                  selectedMetric==="multifamilyPermits" || selectedMetric==="permitGrowth" || selectedMetric==="developmentIntensity" || selectedMetric==="multifamilyShare" ? permitTable : `
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:.8rem">
                    <div><div style="color:#6b7280">Median Income</div><div style="font-weight:600">${c.medianHouseholdIncome?.toLocaleString()||"N/A"}</div></div>
                    <div><div style="color:#6b7280">Unemployment</div><div style="font-weight:600">${isNum(c.unemploymentRate)?c.unemploymentRate.toFixed(1)+"%":"N/A"}</div></div>
                    <div><div style="color:#6b7280">Median Rent</div><div style="font-weight:600">${c.medianGrossRent?.toLocaleString()||"N/A"}</div></div>
                    <div><div style="color:#6b7280">Pop Growth</div><div style="font-weight:600">${isNum(c.populationGrowth)?c.populationGrowth.toFixed(1)+"%":"N/A"}</div></div>
                  </div>`}
              </div>
            </div>`;
          ly.bindPopup(popup,{maxWidth:360,className:"modern-popup",closeButton:true,offset:[0,-10]});
          ly.on("mouseover", function(){ this.setStyle({weight:2,fillOpacity:.95}); });
          ly.on("mouseout",  function(){ this.setStyle({weight:.6,fillOpacity:.85}); });
        }
      }).addTo(map);
      layerRef.current = layer;
    };
    render();
  };

  /* ===== Effects ===== */
  useEffect(()=>{ loadAll(); },[]);
  useEffect(()=>{ if(!loading && geoJsonData && Object.keys(countyData).length) initMap(); },[loading,geoJsonData,countyData]);
  useEffect(()=>{ if(!mapInstanceRef.current) return; initMap(); },[selectedMetric,bedroom]);
  useEffect(()=>()=>{ if(mapInstanceRef.current) mapInstanceRef.current.remove(); },[]);

  /* ===== Chat: supports ALL metrics (FMR + Census + Migration) ===== */
  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    const inText = chatInput;
    setChatMessages(m=>[...m,{text:inText,sender:"user",timestamp:new Date()}]);
    setChatInput(""); setIsTyping(true);

    setTimeout(()=>{
      const q=inText.toLowerCase();
      const money = q.match(/\$?(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?/);
      let thr=null; if(money){thr=parseFloat(money[1].replace(/,/g,"")); if(/k\b/.test(money[0])) thr*=1000;}
      const wantsLow=/\b(low|cheap|affordable|below|under|less than)\b/.test(q);
      const wantsHigh=/\b(high|top|best|above|over|greater|at least|expensive)\b/.test(q);
      const isFMR=/\bfmr\b|fair market|hud/.test(q);
      const isMigration=/\bmigrat|moving|inflow|outflow|people mov/.test(q);
      const br = /\bstudio|eff/.test(q) ? "0" : /\b0br\b/.test(q) ? "0" : /\b1br\b/.test(q) ? "1" : /\b2br\b/.test(q) ? "2" : /\b3br\b/.test(q) ? "3" : /\b4br\b/.test(q) ? "4" : bedroom;

      const rows = Object.values(countyData);
      const stateTokens = { al:"AL", ak:"AK", az:"AZ", ar:"AR", ca:"CA", co:"CO", ct:"CT", de:"DE", fl:"FL", ga:"GA", hi:"HI", id:"ID", il:"IL", in:"IN", ia:"IA", ks:"KS", ky:"KY", la:"LA", me:"ME", md:"MD", ma:"MA", mi:"MI", mn:"MN", ms:"MS", mo:"MO", mt:"MT", ne:"NE", nv:"NV", nh:"NH", nj:"NJ", nm:"NM", ny:"NY", nc:"NC", nd:"ND", oh:"OH", ok:"OK", or:"OR", pa:"PA", ri:"RI", sc:"SC", sd:"SD", tn:"TN", tx:"TX", ut:"UT", vt:"VT", va:"VA", wa:"WA", wv:"WV", wi:"WI", wy:"WY", dc:"DC" };
      let state=null; Object.keys(stateTokens).forEach(k=>{ if(new RegExp(`\\b${k}\\b`,"i").test(q)) state=stateTokens[k]; });

      const metricKeywords = [
        ["populationGrowth", /\bgrowth|growing|population\b/],
        ["unemployment", /\bunemploy|jobless|job rate|job\b/],
        ["affordability", /\bafford|cost of living|% of income\b/],
        ["rtpRatio", /\brtp|rent-?to-?price|yield\b/],
        ["housingStock", /\bvacancy|inventory|stock\b/],
        ["appreciation", /\bappreciation|price growth|value growth|invest\b/],
        ["migration", /\bmigrat|moving|inflow|outflow|people mov\b/],
        ["multifamilyPermits", /\bmultifamily permit|mf permit|5\+ unit|apartment construction|multi-unit\b/],
        ["permitGrowth", /\bpermit growth|construction growth|building growth|yoy permit\b/],
        ["developmentIntensity", /\bdevelopment intensity|permit.*per capita|construction.*per capita|building boom\b/],
        ["multifamilyShare", /\bmultifamily share|mf share|apartment share|multi-unit.*percent\b/],
      ];
      let which = isFMR ? "fmr" : isMigration ? "migration" : null;
      if (!which) {
        for (const [key,re] of metricKeywords) { if (re.test(q)) { which=key; break; } }
      }
      if (!which) which = "fmr"; // default helpful behavior

      const filterByState = (arr) => state ? arr.filter(c => (c.state?.toUpperCase()?.includes(state))) : arr;

      let list = [];
      if (which === "fmr") {
        const key = `fmr_${br}`;
        const t = thr ?? (wantsLow ? 1200 : wantsHigh ? 2000 : null);
        let cand = filterByState(rows).filter(c=>isNum(c[key]));
        if (t!=null) cand = cand.filter(c => wantsLow ? c[key] < t : c[key] > t);
        list = cand.sort((a,b)=> wantsLow ? a[key]-b[key] : b[key]-a[key]).slice(0,15);
        const titleBR = br==="0"?"Studio/0BR":`${br}BR`;
        const lines = list.map((c,i)=>`${i+1}. ${c.fullName||`FIPS ${c.fips}`} • ${titleBR}: $${Math.round(c[key]).toLocaleString()}/mo`).join("\n");
        setChatMessages(m=>[...m,{text:`HUD ${titleBR} FMR ${state?`in ${state}`:""}:\n\n${lines}`,sender:"bot",timestamp:new Date()}]);
      } else {
        const valueOf = (c)=>getVal(c, which);
        let cand = filterByState(rows).filter(c=>isNum(valueOf(c)));
        if (thr!=null) {
          // allow e.g., "unemployment under 3", "growth over 2", "migration above 5"
          cand = cand.filter(c => wantsLow ? valueOf(c) < thr : valueOf(c) > thr);
        }
        cand = cand.sort((a,b)=> wantsLow ? valueOf(a)-valueOf(b) : valueOf(b)-valueOf(a)).slice(0,15);
        const lines = cand.map((c,i)=>`${i+1}. ${c.fullName||`FIPS ${c.fips}`} • ${fmt(valueOf(c),which)}`).join("\n");
        setChatMessages(m=>[...m,{text:`${metrics[which].name} ${state?`in ${state}`:""}:\n\n${lines}`,sender:"bot",timestamp:new Date()}]);
      }
      setIsTyping(false);
    }, 500);
  };

  const currentMetric = metrics[selectedMetric];
  const countiesWithData = Object.values(countyData).filter(c => isNum(getVal(c, selectedMetric))).length;

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff"}}>
      <div>Loading Census + HUD FY26 FMR + Migration data…</div>
    </div>
  );
  if (error) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff"}}>
      <div><div style={{fontSize:40}}>⚠️</div><div>{error}</div></div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",background:"white"}}>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container{background:white!important}
        .modern-popup .leaflet-popup-content-wrapper{background:transparent!important;padding:0!important;border-radius:12px!important;box-shadow:none!important}
        .modern-popup .leaflet-popup-content{margin:0!important;padding:0!important}
        .modern-popup .leaflet-popup-tip{background:white!important;border:1px solid #e5e7eb!important}
        .modern-popup .leaflet-popup-close-button{color:white!important}
      `}</style>

      {/* MAP */}
      <div style={{flex:1,position:"relative"}}>
        <div ref={mapRef} style={{width:"100%",height:"100vh"}} />
        {/* Legend + bedroom picker */}
        <div style={{position:"absolute",bottom:20,left:20,right:420,background:"rgba(255,255,255,.95)",padding:"16px 20px",border:"1px solid #e5e7eb",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h4 style={{margin:0,fontSize:".95rem"}}>{currentMetric.name} • {countiesWithData.toLocaleString()} counties</h4>
            {selectedMetric==="fmr" &&
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:".8rem"}}>Bedroom:</span>
                <select value={bedroom} onChange={(e)=>setBedroom(e.target.value)} style={{border:"1px solid #d1d5db",borderRadius:6,padding:"4px 8px"}}>
                  <option value="0">Studio/0BR</option>
                  <option value="1">1BR</option>
                  <option value="2">2BR</option>
                  <option value="3">3BR</option>
                  <option value="4">4BR</option>
                </select>
              </div>}
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:".8rem"}}>
            {currentMetric.colorScale.map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#f9fafb",border:"1px solid #f3f4f6",borderRadius:6}}>
                <div style={{width:16,height:16,background:r.color,borderRadius:3,border:"1px solid rgba(0,0,0,.1)"}} />
                <span>{r.label}</span>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",background:"#f9fafb",border:"1px solid #f3f4f6",borderRadius:6}}>
              <div style={{width:16,height:16,background:"#e5e7eb",borderRadius:3,border:"1px solid rgba(0,0,0,.1)"}} />
              <span style={{color:"#6b7280"}}>No data</span>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div style={{width:400,display:"flex",flexDirection:"column",borderLeft:"1px solid #e5e7eb",background:"white"}}>
        <div style={{padding:20,borderBottom:"1px solid #f3f4f6",background:"linear-gradient(135deg,#f8fafc,#f1f5f9)"}}>
          <button onClick={()=>{if(setCurrentPage) setCurrentPage("home"); else window.history.back();}}
            style={{display:"flex",alignItems:"center",gap:8,background:"white",border:"1px solid #e5e7eb",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>
            <ArrowLeft size={16}/> Back
          </button>
          <h1 style={{margin:"10px 0 0 0",fontSize:"1.35rem",fontWeight:700}}>Market Finder Map</h1>
          <p style={{margin:"6px 0 0 0",color:"#6b7280",fontSize:".85rem"}}>Metric: {currentMetric.name}</p>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {Object.entries(metrics).map(([key,m])=>{
            const Icon=m.icon, sel=selectedMetric===key;
            return (
              <button key={key} onClick={()=>setSelectedMetric(key)}
                style={{textAlign:"left",display:"flex",flexDirection:"column",gap:6,padding:14,borderRadius:12,
                        background:sel?"linear-gradient(135deg,#3b82f6,#1e40af)":"white",
                        color:sel?"white":"#374151",border:sel?"none":"2px solid #f3f4f6",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><Icon size={22} style={{color:sel?"white":"#3b82f6"}}/><div style={{fontWeight:700}}>{m.name}</div></div>
                <div style={{fontSize:".8rem",opacity:sel?.9:.75}}>{m.description}</div>
                <div style={{fontSize:".72rem",opacity:.7,fontStyle:"italic"}}>{m.dataSource}</div>
              </button>
            );
          })}
        </div>

        {/* CHAT */}
        <div style={{borderTop:"2px solid #e5e7eb",display:"flex",flexDirection:"column",height:330}}>
          <div style={{padding:"10px 14px",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
            <MessageSquare size={18}/> AI Market Assistant — ask about FMR, growth, unemployment, affordability, RTP, vacancy, appreciation, migration.
          </div>
          <div style={{flex:1,overflowY:"auto",padding:12,background:"#f9fafb",display:"flex",flexDirection:"column",gap:8}}>
            {chatMessages.map((m,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.sender==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:8,whiteSpace:"pre-wrap",fontSize:".8rem",
                             background:m.sender==="user"?"#667eea":"white",color:m.sender==="user"?"#fff":"#1f2937",border:m.sender==="bot"?"1px solid #e5e7eb":"none"}}>
                  {m.text}
                </div>
                <span style={{fontSize:".65rem",color:"#9ca3af"}}>{m.timestamp.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>
              </div>
            ))}
            {isTyping && <div style={{padding:8,background:"white",border:"1px solid #e5e7eb",borderRadius:8,width:"fit-content"}}>…</div>}
          </div>
          <div style={{padding:12,borderTop:"1px solid #e5e7eb",background:"white"}}>
            <div style={{display:"flex",gap:8}}>
              <input value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&handleChatSend()}
                placeholder={`Try: 'highest multifamily permits in TX' or 'fastest permit growth in FL' or 'top development intensity'`} style={{flex:1,padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:6}}/>
              <button onClick={handleChatSend} style={{padding:"8px 12px",background:"#667eea",color:"#fff",border:"none",borderRadius:6,fontWeight:700,cursor:"pointer"}}>Send</button>
            </div>
          </div>
        </div>

        {/* DETAILS */}
        <div style={{padding:18,borderTop:"1px solid #f3f4f6",background:"#f9fafb"}}>
          <div style={{background:"white",padding:14,borderRadius:8,border:"1px solid #e5e7eb"}}>
            <h4 style={{margin:0,marginBottom:6,display:"flex",alignItems:"center",gap:6,fontSize:".9rem"}}><Info size={14} style={{color:"#3b82f6"}}/>{currentMetric.name}</h4>
            <div style={{fontSize:".8rem",color:"#6b7280"}}><strong>Calculation:</strong> {currentMetric.calculation}</div>
            <div style={{fontSize:".8rem",color:"#6b7280"}}><strong>Data:</strong> {currentMetric.dataSource}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountyChoroplethMap;