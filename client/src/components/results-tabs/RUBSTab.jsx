import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import * as rubsCalc from '../../utils/rubsCalculations';

const RUBSTab = ({ scenarioData, fullCalcs }) => {
  const [unitMixRows, setUnitMixRows] = useState([]);
  const [expenses, setExpenses] = useState({});
  
  const [data, setData] = useState({
    // Property Information
    propertyName: '',
    address: '',
    cityStateZip: '',
    totalUnits: 0,
    totalRentableSF: 0,
    yearBuilt: '',
    
    // Acquisition
    purchasePrice: 0,
    closingCostsPct: 2.0,
    closingCosts: 0,
    totalAcquisitionCost: 0,
    
    // Financing
    ltv: 70.0,
    loanAmount: 0,
    interestRate: 6.5,
    amortizationYears: 30,
    loanTermYears: 5,
    annualDebtService: 0,
    
    // Equity
    equityForPurchase: 0,
    equityForClosing: 0,
    renovationBudget: 0,
    totalEquityRequired: 0,
    
    // Key Metrics - Calculated
    pricePerUnit: 0,
    pricePerSF: 0,
    avgSFPerUnit: 0,
    goingInCapRate: 0,
    debtYield: 0,
    dscr: 0,

    // Revenue Assumptions
    physicalOccupancy: 95.0,
    otherIncomePerUnitMonth: 50,
    badDebtPct: 2.0,
    concessionsPerUnitYear: 0,

    // Growth Assumptions
    annualRentGrowth: 3.0,
    annualExpenseGrowth: 2.5,
    rubsRecoveryGrowth: 2.0,
    stabilizedOccupancy: 96.0,

    // Renovation Schedule
    unitsToRenovate: 120,
    renovationPeriodMonths: 24,
    unitsPerMonth: 5,
    rentPremium: 200,
    premiumStabilizationMonths: 3,

    // Exit Assumptions
    exitCapRate: 5.5,
    salesCostsPct: 2.0,
    holdingPeriodYears: 5
  });

  // Auto-fill from scenarioData
  useEffect(() => {
    console.log('RUBS Tab - scenarioData:', scenarioData);
    console.log('RUBS Tab - fullCalcs:', fullCalcs);
    
    if (scenarioData) {
      const property = scenarioData?.property || {};
      const pricing_financing = scenarioData?.pricing_financing || {};
      const financing = scenarioData?.financing || {};
      const equity = scenarioData?.equity || {};
      const underwriting = scenarioData?.underwriting || {};
      const unitMix = scenarioData?.unit_mix || [];
      const expensesData = scenarioData?.expenses || {};
      const fullCalcsData = fullCalcs?.fullAnalysis || fullCalcs || {};
      
      // Populate unit mix rows
      console.log('RUBS Tab - Raw unit_mix data:', unitMix);
      if (unitMix.length > 0) {
        const mappedUnitMix = unitMix.map(unit => ({
          unitType: unit.type || unit.unit_type || '',
          beds: unit.beds || unit.bedrooms || 0,
          baths: unit.baths || unit.bathrooms || 0,
          units: unit.units || unit.count || 0,
          sfPerUnit: unit.unit_sf || unit.sf_per_unit || unit.square_feet || 0,
          avgOcc: 2.0, // Default
          currentRent: unit.rent_current || unit.current_rent || unit.rent || 0,
          marketRent: unit.rent_market || unit.market_rent || unit.rent_current || unit.rent || 0
        }));
        console.log('RUBS Tab - Mapped unit mix:', mappedUnitMix);
        setUnitMixRows(mappedUnitMix);
      } else {
        console.error('RUBS Tab - NO UNIT MIX DATA FOUND!');
      }
      
      // Populate expenses
      console.log('RUBS Tab - Raw expenses data:', expensesData);
      if (expensesData && Object.keys(expensesData).length > 0) {
        console.log('RUBS Tab - Setting expenses:', expensesData);
        setExpenses(expensesData);
      } else {
        console.error('RUBS Tab - NO EXPENSES DATA FOUND!');
      }
      
      // Build city, state, zip from individual fields
      const city = property.city || '';
      const state = property.state || '';
      const zip = property.zip || property.zip_code || '';
      const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
      
      const newData = {
        // Property Information
        propertyName: property.name || property.property_name || '',
        address: property.address || '',
        cityStateZip: cityStateZip || property.city_state_zip || '',
        totalUnits: property.units || property.total_units || unitMix.reduce((sum, u) => sum + (u.units || 0), 0) || 0,
        totalRentableSF: property.rba_sqft || property.total_sq_ft || property.rentable_sf || property.square_feet || 0,
        yearBuilt: property.year_built || '',
        
        // Acquisition - USE CANONICAL VALUES FROM FULLCALCS
        purchasePrice: fullCalcsData.acquisition?.purchasePrice || pricing_financing?.price || pricing_financing?.purchase_price || 0,
        closingCostsPct: fullCalcsData.acquisition?.closingCostsPct || pricing_financing?.closing_costs_pct || 2.0,
        
        // Financing - USE CANONICAL VALUES FROM FULLCALCS
        ltv: pricing_financing?.ltv || fullCalcsData.financing?.ltv || financing.ltv || 75.0,
        interestRate: pricing_financing?.interest_rate || fullCalcsData.financing?.interestRate || financing.interest_rate || financing.rate || 6.5,
        amortizationYears: pricing_financing?.amortization_years || fullCalcsData.financing?.amortizationYears || financing.amortization_years || financing.amortization || 30,
        loanTermYears: pricing_financing?.term_years || financing.loan_term_years || financing.term || 5,
        
        // Equity - USE CANONICAL VALUES FROM FULLCALCS
        renovationBudget: fullCalcsData.acquisition?.capexBudget || equity.renovation_budget || pricing_financing?.capex_budget || pricing_financing?.renovation_budget || 0,
        
        // Revenue Assumptions - USE FULLCALCS WHEN AVAILABLE
        physicalOccupancy: fullCalcsData.year1?.occupancy || underwriting?.occupancy || 95.0,
        otherIncomePerUnitMonth: fullCalcsData.revenue?.otherIncomePerUnit || underwriting?.other_income_per_unit || 50,
        badDebtPct: underwriting?.bad_debt_pct || 2.0,
        concessionsPerUnitYear: underwriting?.concessions_per_unit || 0,
        
        // Growth Assumptions - USE SAME AS OTHER TABS
        annualRentGrowth: fullCalcsData.assumptions?.rentGrowth || underwriting?.rent_growth || 3.0,
        annualExpenseGrowth: fullCalcsData.assumptions?.expenseGrowth || underwriting?.expense_growth || 2.5,
        rubsRecoveryGrowth: underwriting?.rubs_growth || 2.0,
        stabilizedOccupancy: underwriting?.stabilized_occupancy || 96.0,
        
        // Renovation Schedule
        unitsToRenovate: pricing_financing.units_to_renovate || (property.units || 0),
        renovationPeriodMonths: pricing_financing.renovation_period_months || 24,
        rentPremium: pricing_financing.rent_premium || underwriting?.rent_premium || 200,
        premiumStabilizationMonths: pricing_financing.premium_stabilization_months || 3,
        
        // Exit Assumptions - USE CANONICAL EXIT DATA
        exitCapRate: fullCalcsData.exit?.capRate || underwriting?.exit_cap_rate || 5.5,
        salesCostsPct: underwriting?.sales_costs_pct || 2.0,
        holdingPeriodYears: underwriting?.holding_period || 5
      };
      
      console.log('RUBS Tab - Setting data to:', newData);
      
      setData(prev => ({
        ...prev,
        ...newData
      }));
    }
  }, [scenarioData, fullCalcs]);

  // Calculate derived values
  useEffect(() => {
    console.log('RUBS Tab - Calculating with:', {
      purchasePrice: data.purchasePrice,
      ltv: data.ltv,
      interestRate: data.interestRate,
      amortizationYears: data.amortizationYears
    });
    
    const loanAmount = rubsCalc.calculateLoanAmount(data.purchasePrice, data.ltv);
    const annualDebtService = rubsCalc.calculateAnnualDebtService(loanAmount, data.interestRate, data.amortizationYears);
    const closingCosts = rubsCalc.calculateClosingCostsDollar(data.purchasePrice, data.closingCostsPct);
    const totalAcquisitionCost = rubsCalc.calculateTotalAcquisitionCost(data.purchasePrice, closingCosts);
    const equityForPurchase = rubsCalc.calculateEquityForPurchase(data.purchasePrice, loanAmount);
    const equityForClosing = rubsCalc.calculateEquityForClosing(closingCosts);
    const totalEquityRequired = rubsCalc.calculateTotalEquityRequired(equityForPurchase, equityForClosing, data.renovationBudget);
    
    const pricePerUnit = rubsCalc.calculatePricePerUnit(data.purchasePrice, data.totalUnits);
    const pricePerSF = rubsCalc.calculatePricePerSF(data.purchasePrice, data.totalRentableSF);
    const avgSFPerUnit = rubsCalc.calculateAvgSFPerUnit(data.totalRentableSF, data.totalUnits);

    // Calculate NOI and key metrics
    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
    const totalOpex = expenses?.total || 0;
    const noi = egi - totalOpex;
    
    const goingInCapRate = data.purchasePrice > 0 ? (noi / data.purchasePrice) * 100 : 0;
    const debtYield = loanAmount > 0 ? (noi / loanAmount) * 100 : 0;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;

    // Calculate 6-year pro forma projections
    const revenueGrowth = (data.annualRevenueGrowth || 3.0) / 100;
    const expenseGrowth = (data.annualExpenseGrowth || 2.5) / 100;
    const proForma = [];
    
    for (let year = 0; year <= 5; year++) {
      const gprYear = gpr * Math.pow(1 + revenueGrowth, year);
      const vacancyLossYear = -gprYear * (1 - (data.physicalOccupancy || 95) / 100);
      const ltlYear = lossToLease * Math.pow(1 + revenueGrowth, year);
      const badDebtYear = -gprYear * ((data.physicalOccupancy || 95) / 100) * ((data.badDebtPct || 0) / 100);
      const concessionsYear = -(data.concessionsPerUnitYear || 0) * (data.totalUnits || 0) * Math.pow(1 + revenueGrowth, year);
      const otherIncomeYear = (data.otherIncomePerUnitMonth || 0) * (data.totalUnits || 0) * 12 * Math.pow(1 + revenueGrowth, year);
      const rubsIncomeYear = 0; // Placeholder - needs RUBS billback calculation
      const egiYear = gprYear + vacancyLossYear + ltlYear + badDebtYear + concessionsYear + otherIncomeYear + rubsIncomeYear;
      
      const opexYear = totalOpex * Math.pow(1 + expenseGrowth, year);
      const noiYear = egiYear - opexYear;
      const debtServiceYear = annualDebtService;
      const capexYear = 0; // Placeholder - needs renovation schedule inputs
      const cashFlowYear = noiYear - debtServiceYear - capexYear;
      
      const prevNoi = year > 0 && proForma[year-1] ? proForma[year-1].noi : noiYear;
      const noiGrowthPct = year === 0 || prevNoi === 0 ? 0 : ((noiYear / prevNoi - 1) * 100);
      
      proForma.push({
        year,
        gpr: gprYear,
        ltl: ltlYear,
        renovationPremium: 0,
        vacancyLoss: vacancyLossYear,
        badDebtConcessions: badDebtYear + concessionsYear,
        otherIncome: otherIncomeYear,
        rubsIncome: rubsIncomeYear,
        egi: egiYear,
        opex: opexYear,
        noi: noiYear,
        noiGrowth: noiGrowthPct,
        debtService: debtServiceYear,
        capex: capexYear,
        cashFlow: cashFlowYear
      });
    }

    console.log('RUBS Tab - Calculated values:', {
      loanAmount,
      annualDebtService,
      closingCosts,
      totalAcquisitionCost,
      equityForPurchase,
      totalEquityRequired,
      pricePerUnit,
      noi,
      goingInCapRate,
      debtYield,
      dscr,
      proForma
    });

    setData(prev => ({
      ...prev,
      loanAmount,
      annualDebtService,
      closingCosts,
      totalAcquisitionCost,
      equityForPurchase,
      equityForClosing,
      totalEquityRequired,
      pricePerUnit,
      pricePerSF,
      avgSFPerUnit,
      goingInCapRate,
      debtYield,
      dscr,
      proForma
    }));
  }, [data.purchasePrice, data.ltv, data.interestRate, data.amortizationYears, data.closingCostsPct, 
      data.renovationBudget, data.totalUnits, data.totalRentableSF, data.physicalOccupancy, 
      data.otherIncomePerUnitMonth, data.badDebtPct, data.concessionsPerUnitYear, 
      data.annualRevenueGrowth, data.annualExpenseGrowth,
      unitMixRows, expenses]);

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value, decimals = 1) => {
    if (!value && value !== 0) return '';
    return `${value.toFixed(decimals)}%`;
  };

  // Format number
  const formatNumber = (value, decimals = 0) => {
    if (!value && value !== 0) return '';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Styles
  const sectionHeaderStyle = {
    backgroundColor: '#1e3a8a',
    color: 'white',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '0'
  };

  const subSectionHeaderStyle = {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '0'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    marginBottom: '24px',
    border: '1px solid #e5e7eb'
  };

  const labelCellStyle = {
    padding: '4px 8px',
    fontSize: '11px',
    color: '#374151',
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    width: '50%',
    textAlign: 'left'
  };

  const inputCellStyle = {
    padding: '2px 8px',
    fontSize: '11px',
    backgroundColor: '#fef3c7',
    borderBottom: '1px solid #e5e7eb',
    width: '50%',
    textAlign: 'right'
  };

  const inputStyle = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '11px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'right',
    fontWeight: '600',
    color: '#111827'
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Data Status Banner */}
      {unitMixRows.length > 0 && (
        <div style={{ backgroundColor: '#10b981', color: 'white', padding: '12px 16px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
          ✓ RUBS Tab Populated: Unit Mix ({unitMixRows.length} types), Operating Expenses (${(expenses?.total || 0).toLocaleString()}), Revenue Calculations Active
        </div>
      )}
      {unitMixRows.length === 0 && (
        <div style={{ backgroundColor: '#ef4444', color: 'white', padding: '12px 16px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
          ⚠ No Deal Data Loaded - Upload or parse a deal to populate this tab
        </div>
      )}
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          color: '#111827',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Activity size={32} color="#0d9488" />
          MULTIFAMILY VALUE-ADD + RUBS MODEL
        </h1>
      </div>

      {/* Top Section with 4 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        
        {/* PROPERTY INFORMATION */}
        <div>
          <div style={sectionHeaderStyle}>PROPERTY INFORMATION</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Property Name</td>
                <td style={inputCellStyle}>
                  <input 
                    type="text" 
                    style={inputStyle}
                    value={data.propertyName || ''}
                    onChange={(e) => handleChange('propertyName', e.target.value)}
                    placeholder="Enter property name"
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Address</td>
                <td style={inputCellStyle}>
                  <input 
                    type="text" 
                    style={inputStyle}
                    value={data.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Enter address"
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>City, State ZIP</td>
                <td style={inputCellStyle}>
                  <input 
                    type="text" 
                    style={inputStyle}
                    value={data.cityStateZip || ''}
                    onChange={(e) => handleChange('cityStateZip', e.target.value)}
                    placeholder="Enter city, state, zip"
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Total Units</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.totalUnits || ''}
                    onChange={(e) => handleChange('totalUnits', parseFloat(e.target.value) || 0)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Total Rentable SF</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.totalRentableSF || ''}
                    onChange={(e) => handleChange('totalRentableSF', parseFloat(e.target.value) || 0)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Year Built</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.yearBuilt || ''}
                    onChange={(e) => handleChange('yearBuilt', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div style={subSectionHeaderStyle}>ACQUISITION</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Purchase Price</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.purchasePrice}
                    onChange={(e) => handleChange('purchasePrice', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Closing Costs (%)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.1"
                    style={inputStyle}
                    value={data.closingCostsPct}
                    onChange={(e) => handleChange('closingCostsPct', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Closing Costs ($)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.closingCosts}
                    onChange={(e) => handleChange('closingCosts', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ ...labelCellStyle, fontWeight: '700', backgroundColor: '#f3f4f6' }}>Total Acquisition Cost</td>
                <td style={{ ...inputCellStyle, fontWeight: '700', backgroundColor: '#fef3c7' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700' }}
                    value={data.totalAcquisitionCost}
                    onChange={(e) => handleChange('totalAcquisitionCost', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FINANCING */}
        <div>
          <div style={sectionHeaderStyle}>FINANCING</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Loan-to-Value (LTV)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.ltv}
                    onChange={(e) => handleChange('ltv', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Loan Amount</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.loanAmount}
                    onChange={(e) => handleChange('loanAmount', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Interest Rate</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.interestRate}
                    onChange={(e) => handleChange('interestRate', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Amortization (Years)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.amortizationYears}
                    onChange={(e) => handleChange('amortizationYears', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Loan Term (Years)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.loanTermYears}
                    onChange={(e) => handleChange('loanTermYears', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ ...labelCellStyle, fontWeight: '700', backgroundColor: '#f3f4f6' }}>Annual Debt Service</td>
                <td style={{ ...inputCellStyle, fontWeight: '700', backgroundColor: '#fef3c7' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700' }}
                    value={data.annualDebtService}
                    onChange={(e) => handleChange('annualDebtService', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* EQUITY */}
        <div>
          <div style={sectionHeaderStyle}>EQUITY</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Equity for Purchase</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.equityForPurchase}
                    onChange={(e) => handleChange('equityForPurchase', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Equity for Closing</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.equityForClosing}
                    onChange={(e) => handleChange('equityForClosing', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Renovation Budget</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.renovationBudget}
                    onChange={(e) => handleChange('renovationBudget', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ ...labelCellStyle, fontWeight: '700', backgroundColor: '#f3f4f6' }}>Total Equity Required</td>
                <td style={{ ...inputCellStyle, fontWeight: '700', backgroundColor: '#fef3c7' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700' }}
                    value={data.totalEquityRequired}
                    onChange={(e) => handleChange('totalEquityRequired', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* KEY METRICS */}
        <div>
          <div style={sectionHeaderStyle}>KEY METRICS</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Price / Unit</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.pricePerUnit}
                    onChange={(e) => handleChange('pricePerUnit', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Price / SF</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.pricePerSF}
                    onChange={(e) => handleChange('pricePerSF', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Avg SF / Unit</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data.avgSFPerUnit}
                    onChange={(e) => handleChange('avgSFPerUnit', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Going-In Cap Rate</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.goingInCapRate}
                    onChange={(e) => handleChange('goingInCapRate', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Debt Yield</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.debtYield}
                    onChange={(e) => handleChange('debtYield', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>DSCR (Year 1)</td>
                <td style={inputCellStyle}>
                  <input 
                    type="number" 
                    step="0.01"
                    style={inputStyle}
                    value={data.dscr}
                    onChange={(e) => handleChange('dscr', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* UNIT MIX & RENT ROLL */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#cbd5e1', 
          padding: '8px 16px', 
          fontSize: '13px', 
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '0'
        }}>
          UNIT MIX & RENT ROLL
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Unit Type</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Beds</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Baths</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}># Units</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>SF/Unit</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Total SF</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Avg Occ</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Current Rent</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Market Rent</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Rent Gap</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Loss-to-Lease</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Annual LTL</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center' }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {unitMixRows.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ padding: '20px', textAlign: 'center', color: '#ef4444', fontWeight: '700' }}>
                    NO UNIT MIX DATA - Check console for scenarioData
                  </td>
                </tr>
              ) : (
                unitMixRows.map((unit, idx) => {
                  const totalSF = unit.units * unit.sfPerUnit;
                  const rentGap = unit.marketRent - unit.currentRent;
                  const lossToLease = rentGap * unit.units;
                  const annualLTL = lossToLease * 12;
                  const totalUnits = unitMixRows.reduce((sum, u) => sum + u.units, 0);
                  const pctOfTotal = totalUnits > 0 ? (unit.units / totalUnits) * 100 : 0;
                  
                  return (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                        {unit.unitType}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {unit.beds}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {unit.baths}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {unit.units}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {unit.sfPerUnit.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {totalSF.toLocaleString()}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {unit.avgOcc.toFixed(1)}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        ${unit.currentRent.toLocaleString()}
                      </td>
                      <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        ${unit.marketRent.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        ${rentGap.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        ${lossToLease.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                        ${annualLTL.toLocaleString()}
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        {pctOfTotal.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
              {unitMixRows.length > 0 && (() => {
                const totalUnits = unitMixRows.reduce((sum, u) => sum + u.units, 0);
                const totalSF = unitMixRows.reduce((sum, u) => sum + (u.units * u.sfPerUnit), 0);
                const wtdAvgOcc = unitMixRows.reduce((sum, u) => sum + (u.avgOcc * u.units), 0) / (totalUnits || 1);
                const wtdAvgCurrentRent = unitMixRows.reduce((sum, u) => sum + (u.currentRent * u.units), 0) / (totalUnits || 1);
                const wtdAvgMarketRent = unitMixRows.reduce((sum, u) => sum + (u.marketRent * u.units), 0) / (totalUnits || 1);
                const totalRentGap = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const totalLossToLease = totalRentGap;
                const totalAnnualLTL = totalLossToLease * 12;
                
                return (
                  <tr style={{ backgroundColor: '#e0f2fe', fontWeight: '700' }}>
                    <td style={{ padding: '6px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>TOTAL / WTD AVG</td>
                    <td style={{ padding: '6px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                    <td style={{ padding: '6px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {totalUnits}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {totalSF.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {wtdAvgOcc.toFixed(1)}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      ${wtdAvgCurrentRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      ${wtdAvgMarketRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      ${(wtdAvgMarketRent - wtdAvgCurrentRent).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      ${totalLossToLease.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      ${totalAnnualLTL.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      100.0%
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* OCCUPANCY & REVENUE ASSUMPTIONS + YEAR 1 REVENUE SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* OCCUPANCY & REVENUE ASSUMPTIONS */}
        <div>
          <div style={sectionHeaderStyle}>OCCUPANCY & REVENUE ASSUMPTIONS</div>
          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelCellStyle}>Physical Occupancy</td>
                <td style={inputCellStyle}>
                  {data.physicalOccupancy.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Other Income / Unit / Month</td>
                <td style={inputCellStyle}>
                  ${data.otherIncomePerUnitMonth.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Bad Debt (% of Rent)</td>
                <td style={inputCellStyle}>
                  {data.badDebtPct.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={labelCellStyle}>Concessions / Unit / Year</td>
                <td style={inputCellStyle}>
                  ${data.concessionsPerUnitYear.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* YEAR 1 REVENUE SUMMARY */}
        <div>
          <div style={sectionHeaderStyle}>YEAR 1 REVENUE SUMMARY</div>
          <table style={tableStyle}>
            <tbody>
              {(() => {
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                
                return (
                  <>
                    <tr>
                      <td style={labelCellStyle}>Gross Potential Rent (GPR)</td>
                      <td style={inputCellStyle}>
                        ${gpr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCellStyle}>(-) Vacancy Loss</td>
                      <td style={inputCellStyle}>
                        ${vacancyLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCellStyle}>(-) Loss-to-Lease</td>
                      <td style={inputCellStyle}>
                        ${lossToLease.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCellStyle}>(-) Bad Debt</td>
                      <td style={inputCellStyle}>
                        ${badDebt.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCellStyle}>(-) Concessions</td>
                      <td style={inputCellStyle}>
                        ${concessions.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={labelCellStyle}>(+) Other Income</td>
                      <td style={inputCellStyle}>
                        ${otherIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...labelCellStyle, fontWeight: '700', backgroundColor: '#f3f4f6' }}>Effective Gross Income (EGI)</td>
                      <td style={{ ...inputCellStyle, fontWeight: '700', backgroundColor: '#fef3c7' }}>
                        ${egi.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED OPERATING EXPENSES */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#cbd5e1', 
          padding: '8px 16px', 
          fontSize: '13px', 
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '0'
        }}>
          DETAILED OPERATING EXPENSES
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Expense Category</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 1 Amount</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Per Unit</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>% of EGI</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>Growth Rate</th>
              </tr>
            </thead>
            <tbody>
              {/* TAXES & INSURANCE */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>TAXES & INSURANCE</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Real Estate Taxes</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.taxes || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.taxes || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.taxes || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Property Insurance</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.insurance || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.insurance || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.insurance || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const taxInsTotal = (expenses?.taxes || 0) + (expenses?.insurance || 0);
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (taxInsTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Taxes & Insurance</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${taxInsTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(taxInsTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* UTILITIES (OWNER PAID) */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>UTILITIES (OWNER PAID)</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Water / Sewer</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Electric (Common)</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Gas (Common)</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Trash Removal</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Pest Control</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Cable / Internet</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Amenity Services</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.utilities || 0) / 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? (((expenses?.utilities || 0) / 7) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const utilitiesTotal = expenses?.utilities || 0;
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (utilitiesTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Utilities</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${utilitiesTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(utilitiesTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* PAYROLL */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>PAYROLL</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Payroll & Benefits</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.payroll || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.payroll || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.payroll || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const payrollTotal = expenses?.payroll || 0;
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (payrollTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Payroll</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${payrollTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(payrollTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* REPAIRS & MAINTENANCE */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>REPAIRS & MAINTENANCE</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Repairs & Maintenance</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.repairs_maintenance || expenses?.repairs || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.repairs_maintenance || expenses?.repairs || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.repairs_maintenance || expenses?.repairs || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const repairsTotal = expenses?.repairs_maintenance || expenses?.repairs || 0;
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (repairsTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Repairs</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${repairsTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(repairsTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* ADMIN & MARKETING */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>ADMIN & MARKETING</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Marketing & Advertising</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.marketing || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.marketing || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.marketing || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Administrative</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.admin || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.admin || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.admin || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const adminTotal = (expenses?.admin || 0) + (expenses?.marketing || 0);
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (adminTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Admin</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${adminTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(adminTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* CONTRACT SERVICES */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>CONTRACT SERVICES & OTHER</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Other Expenses</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.other || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.other || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.other || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              {(() => {
                const contractTotal = expenses?.other || 0;
                const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                const pctOfEGI = egi > 0 ? (contractTotal / egi * 100) : 0;
                return (
                  <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal - Contract</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${contractTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      ${(contractTotal / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {pctOfEGI.toFixed(1)}%
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}></td>
                  </tr>
                );
              })()}

              {/* MANAGEMENT & RESERVES */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="5" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>MANAGEMENT & RESERVES</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Management Fee (% EGI)</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.management || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.management || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.management || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Replacement Reserves</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(expenses?.reserves || expenses?.replacement_reserves || 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${((expenses?.reserves || expenses?.replacement_reserves || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.reserves || expenses?.replacement_reserves || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  {data.annualExpenseGrowth.toFixed(1)}%
                </td>
              </tr>

              {/* TOTAL */}
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', color: 'white', borderRight: '1px solid #3b82f6' }}>TOTAL OPERATING EXPENSES</td>
                <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  ${(expenses?.total || 0).toLocaleString()}
                </td>
                <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  ${((expenses?.total || 0) / (data.totalUnits || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  {(() => {
                    const gpr = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                    const vacancyLoss = -gpr * (1 - data.physicalOccupancy / 100);
                    const totalLTL = unitMixRows.reduce((sum, u) => sum + ((u.marketRent - u.currentRent) * u.units), 0);
                    const lossToLease = -totalLTL * 12 * (data.physicalOccupancy / 100);
                    const badDebt = -gpr * (data.physicalOccupancy / 100) * (data.badDebtPct / 100);
                    const concessions = -data.concessionsPerUnitYear * data.totalUnits;
                    const otherIncome = data.otherIncomePerUnitMonth * data.totalUnits * 12;
                    const egi = gpr + vacancyLoss + lossToLease + badDebt + concessions + otherIncome;
                    return egi > 0 ? ((expenses?.total || 0) / egi * 100).toFixed(1) : '0.0';
                  })()}%
                </td>
                <td style={{ padding: '6px 8px', fontSize: '12px', color: 'white' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* RUBS (RATIO UTILITY BILLING SYSTEM) CALCULATOR */}
      <div style={{ 
        backgroundColor: '#1e3a8a', 
        padding: '10px 16px', 
        fontSize: '14px', 
        fontWeight: '700',
        color: 'white',
        marginBottom: '16px',
        marginTop: '32px'
      }}>
        RUBS (RATIO UTILITY BILLING SYSTEM) CALCULATOR
      </div>

      {/* ALLOCATION REFERENCE BY UNIT TYPE */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#3b82f6', 
          padding: '8px 16px', 
          fontSize: '12px', 
          fontWeight: '700',
          color: 'white',
          marginBottom: '0'
        }}>
          ALLOCATION REFERENCE BY UNIT TYPE
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Unit Type</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}># Units</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Total SF</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Total Beds</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Total Occ</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>Equal</th>
              </tr>
            </thead>
            <tbody>
              {unitMixRows.map((unit, idx) => {
                const totalSF = unit.units * unit.sfPerUnit;
                const totalBeds = unit.units * unit.beds;
                const totalOcc = unit.units * unit.avgOcc;
                
                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{unit.unitType}</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {unit.units}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {totalSF.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {totalBeds}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {totalOcc.toFixed(1)}
                    </td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      {unit.units}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #3b82f6' }}>TOTAL</td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  {unitMixRows.reduce((sum, u) => sum + u.units, 0)}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  {unitMixRows.reduce((sum, u) => sum + (u.units * u.sfPerUnit), 0).toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  {unitMixRows.reduce((sum, u) => sum + (u.units * u.beds), 0)}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  {unitMixRows.reduce((sum, u) => sum + (u.units * u.avgOcc), 0).toFixed(1)}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>
                  {unitMixRows.reduce((sum, u) => sum + u.units, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* RUBS CONFIGURATION */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#3b82f6', 
          padding: '8px 16px', 
          fontSize: '12px', 
          fontWeight: '700',
          color: 'white',
          marginBottom: '0'
        }}>
          RUBS CONFIGURATION
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Utility Type</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Monthly Cost</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'center', borderRight: '1px solid #3b82f6' }}>Allocation</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Recovery %</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Monthly Recovery</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Annual Recovery</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>Net Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Water / Sewer</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Occupants</option>
                    <option>Sq Ft</option>
                    <option>Equal</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Electric (Common)</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Sq Ft</option>
                    <option>Occupants</option>
                    <option>Equal</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Gas</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Sq Ft</option>
                    <option>Occupants</option>
                    <option>Equal</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Trash</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Equal</option>
                    <option>Occupants</option>
                    <option>Sq Ft</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Pest Control</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Equal</option>
                    <option>Occupants</option>
                    <option>Sq Ft</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Cable / Internet</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Equal</option>
                    <option>Occupants</option>
                    <option>Sq Ft</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Amenity Fee</td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  ${(((expenses?.utilities || 0) / 7) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <select style={{ ...inputStyle, width: '100%', textAlign: 'center' }}>
                    <option>Equal</option>
                    <option>Occupants</option>
                    <option>Sq Ft</option>
                  </select>
                </td>
                <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" step="0.1" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={inputStyle} />
                </td>
              </tr>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #3b82f6' }}>TOTAL RUBS</td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  ${((((expenses?.utilities || 0) / 7) / 12) * 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', color: 'white', borderRight: '1px solid #3b82f6' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', color: 'white', borderRight: '1px solid #3b82f6' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  $0
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>
                  $0
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>
                  ${((((expenses?.utilities || 0) / 7) / 12) * 7).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY BILLBACK PER UNIT TYPE */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#3b82f6', 
          padding: '8px 16px', 
          fontSize: '12px', 
          fontWeight: '700',
          color: 'white',
          marginBottom: '0'
        }}>
          MONTHLY BILLBACK PER UNIT TYPE
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e3a8a' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Unit Type</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Water/Sewer</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Electric</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Gas</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Trash</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Pest</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Cable</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Amenity</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {unitMixRows.map((unit, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{unit.unitType}</td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                    $0.00
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #1e3a8a' }}>AVG / UNIT</td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #1e3a8a' }}>
                  $0.00
                </td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>
                  $0.00
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Annual RUBS Income */}
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Annual RUBS Income:</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>$0</span>
          </div>
        </div>
      </div>

      {/* VALUE-ADD RENOVATION SCHEDULE */}
      <div style={{ 
        backgroundColor: '#cbd5e1', 
        padding: '10px 16px', 
        fontSize: '13px', 
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '16px',
        marginTop: '32px'
      }}>
        VALUE-ADD RENOVATION SCHEDULE
      </div>

      {/* Two-column layout for Renovation Budget and Unit Turn Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Left Column - RENOVATION BUDGET */}
        <div>
          <div style={{ 
            backgroundColor: '#3b82f6', 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '700',
            color: 'white',
            marginBottom: '0'
          }}>
            RENOVATION BUDGET
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'left', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Category</th>
                <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Per Unit</th>
                <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'right', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Units</th>
                <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* INTERIOR RENOVATIONS */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="4" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>INTERIOR RENOVATIONS</td>
              </tr>
              {[
                { name: 'Kitchen (cabinets, counters, appliances)', perUnit: 5500, units: 120, total: 660000 },
                { name: 'Bathroom (fixtures, vanity, tile)', perUnit: 2500, units: 120, total: 300000 },
                { name: 'Flooring (LVP, carpet)', perUnit: 2000, units: 120, total: 240000 },
                { name: 'Paint & Finishes', perUnit: 800, units: 120, total: 96000 },
                { name: 'Lighting & Electrical', perUnit: 600, units: 120, total: 72000 },
                { name: 'HVAC Upgrades', perUnit: 400, units: 120, total: 48000 }
              ].map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{item.name}</td>
                  <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    <input type="number" style={inputStyle} />
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                    <input type="number" style={inputStyle} />
                  </td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal Interior</td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={{ ...inputStyle, fontWeight: '700' }} />
                </td>
              </tr>

              {/* EXTERIOR & COMMON AREAS */}
              <tr style={{ backgroundColor: '#3b82f6' }}>
                <td colSpan="4" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>EXTERIOR & COMMON AREAS</td>
              </tr>
              {[
                'Exterior Paint / Siding',
                'Roofing Repairs',
                'Landscaping',
                'Parking Lot / Lighting',
                'Pool / Amenity Upgrades',
                'Clubhouse / Leasing Office'
              ].map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{item}</td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                  <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                  <td style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#dbeafe', fontStyle: 'italic' }}>
                <td style={{ padding: '4px 12px', fontSize: '11px', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Subtotal Exterior</td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}></td>
                <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input type="number" style={{ ...inputStyle, fontWeight: '700' }} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right Column - UNIT TURN SCHEDULE */}
        <div>
          <div style={{ 
            backgroundColor: '#3b82f6', 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '700',
            color: 'white',
            marginBottom: '0'
          }}>
            UNIT TURN SCHEDULE
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>Units to Renovate</td>
                  <td style={inputCellStyle}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Renovation Period (Months)</td>
                  <td style={inputCellStyle}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Units per Month</td>
                  <td style={inputCellStyle}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Rent Premium (Renovated)</td>
                  <td style={inputCellStyle}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Premium Stabilization (Months)</td>
                  <td style={inputCellStyle}>
                    <input type="number" style={inputStyle} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TURN TIMELINE (BY YEAR) */}
          <div style={{ 
            backgroundColor: '#3b82f6', 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '700',
            color: 'white',
            marginBottom: '0',
            marginTop: '16px'
          }}>
            TURN TIMELINE (BY YEAR)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e3a8a' }}>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}>Metric</th>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 1</th>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 2</th>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 3</th>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 4</th>
                  <th style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>Year 5</th>
                </tr>
              </thead>
              <tbody>
                {[
                  'Units Renovated',
                  'Cumulative Turned',
                  '% Complete',
                  'Avg Units w/ Premium',
                  'Premium Income (Annual)',
                  'CapEx Deployed'
                ].map((metric, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{metric}</td>
                    {[1, 2, 3, 4, 5].map((year) => (
                      <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                        <input type="number" step={metric === '% Complete' ? '0.1' : '1'} style={inputStyle} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5-YEAR PRO FORMA & RETURNS ANALYSIS */}
      <div style={{ 
        backgroundColor: '#cbd5e1', 
        padding: '8px 16px', 
        fontSize: '12px', 
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: '0'
      }}>
        5-YEAR PRO FORMA & RETURNS ANALYSIS
      </div>
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px', marginBottom: '16px' }}>
        <table style={{ width: '100%', maxWidth: '400px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>Contingency (10%)</td>
              <td style={{ padding: '4px 8px', fontSize: '11px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                ${Math.round((data.renovationBudget || 0) * 0.10).toLocaleString()}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#10b981' }}>
              <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: '700', color: 'white', borderRight: '1px solid #059669' }}>TOTAL</td>
              <td style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '700', color: 'white', textAlign: 'right' }}>
                ${Math.round((data.renovationBudget || 0) * 1.10).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* GROWTH ASSUMPTIONS */}
      <div style={{ 
        backgroundColor: '#10b981', 
        padding: '8px 16px', 
        fontSize: '12px', 
        fontWeight: '700',
        color: 'white',
        marginBottom: '0'
      }}>
        GROWTH ASSUMPTIONS
      </div>
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px' }}>
        <table style={{ width: '100%', maxWidth: '500px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>Annual Rent Growth</td>
              <td style={inputCellStyle}>
                <input 
                  type="number" 
                  step="0.1" 
                  style={inputStyle}
                  value={data.annualRevenueGrowth || 3.0}
                  onChange={(e) => handleChange('annualRevenueGrowth', parseFloat(e.target.value) || 0)}
                />
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>Annual Expense Growth</td>
              <td style={inputCellStyle}>
                <input 
                  type="number" 
                  step="0.1" 
                  style={inputStyle}
                  value={data.annualExpenseGrowth || 2.5}
                  onChange={(e) => handleChange('annualExpenseGrowth', parseFloat(e.target.value) || 0)}
                />
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>RUBS Recovery Growth</td>
              <td style={inputCellStyle}>
                <input 
                  type="number" 
                  step="0.1" 
                  style={inputStyle}
                  value={data.rubsRecoveryGrowth || 2.0}
                  onChange={(e) => handleChange('rubsRecoveryGrowth', parseFloat(e.target.value) || 0)}
                />
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>Stabilized Occupancy</td>
              <td style={inputCellStyle}>
                <input 
                  type="number" 
                  step="0.1" 
                  style={inputStyle}
                  value={data.stabilizedOccupancy || 96.0}
                  onChange={(e) => handleChange('stabilizedOccupancy', parseFloat(e.target.value) || 0)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PRO FORMA OPERATING STATEMENT */}
      <div style={{ 
        backgroundColor: '#1e3a8a', 
        padding: '10px 16px', 
        fontSize: '13px', 
        fontWeight: '700',
        color: 'white',
        marginTop: '32px',
        marginBottom: '0'
      }}>
        PRO FORMA OPERATING STATEMENT
      </div>
      <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e3a8a' }}>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'left', borderRight: '1px solid #3b82f6' }}></th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 0</th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 1</th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 2</th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 3</th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right', borderRight: '1px solid #3b82f6' }}>Year 4</th>
              <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>Year 5</th>
            </tr>
          </thead>
          <tbody>
            {/* REVENUE */}
            <tr style={{ backgroundColor: '#3b82f6' }}>
              <td colSpan="7" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>REVENUE</td>
            </tr>
            {[
              { label: 'Gross Potential Rent', key: 'gpr' },
              { label: '(-) Loss to Lease', key: 'ltl' },
              { label: '(-) Renovation Premium', key: 'renovationPremium' },
              { label: '(-) Vacancy Loss', key: 'vacancyLoss' },
              { label: '(-) Bad Debt & Concessions', key: 'badDebtConcessions' },
              { label: '(+) Other Income', key: 'otherIncome' },
              { label: '(+) RUBS Income', key: 'rubsIncome' }
            ].map((item, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>{item.label}</td>
                {[0, 1, 2, 3, 4, 5].map((year) => (
                  <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                    <input 
                      type="number" 
                      style={inputStyle}
                      value={data[`proFormaY${year}_${item.key}`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year][item.key]) : 0)}
                      onChange={(e) => handleChange(`proFormaY${year}_${item.key}`, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ backgroundColor: '#1e3a8a' }}>
              <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #3b82f6' }}>Effective Gross Income</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderRight: year < 5 ? '1px solid #3b82f6' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700' }}
                    value={data[`proFormaY${year}_egi`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].egi) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_egi`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* OPERATING EXPENSES */}
            <tr style={{ backgroundColor: '#3b82f6' }}>
              <td colSpan="7" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>OPERATING EXPENSES</td>
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>Total Operating Expenses</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data[`proFormaY${year}_opex`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].opex) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_opex`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* NET OPERATING INCOME (NOI) */}
            <tr style={{ backgroundColor: '#10b981' }}>
              <td style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '700', color: 'white', borderRight: '1px solid #059669' }}>NET OPERATING INCOME (NOI)</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '12px', fontWeight: '700', backgroundColor: '#d1fae5', borderRight: year < 5 ? '1px solid #059669' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700', backgroundColor: '#d1fae5' }}
                    value={data[`proFormaY${year}_noi`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].noi) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_noi`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#d1fae5' }}>
              <td style={{ padding: '4px 12px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>NOI Growth %</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', fontWeight: '700', backgroundColor: '#d1fae5', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    step="0.1"
                    style={{ ...inputStyle, backgroundColor: '#d1fae5' }}
                    value={data[`proFormaY${year}_noiGrowth`] || (data.proForma && data.proForma[year] ? data.proForma[year].noiGrowth.toFixed(1) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_noiGrowth`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>

            {/* DEBT SERVICE & CASH FLOW */}
            <tr style={{ backgroundColor: '#3b82f6' }}>
              <td colSpan="7" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white' }}>DEBT SERVICE & CASH FLOW</td>
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>(-) Debt Service</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data[`proFormaY${year}_debtService`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].debtService) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_debtService`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td style={{ padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>(-) CapEx (Renovations)</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#fef3c7', borderBottom: '1px solid #e5e7eb', borderRight: year < 5 ? '1px solid #e5e7eb' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={inputStyle}
                    value={data[`proFormaY${year}_capex`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].capex) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_capex`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#1e3a8a' }}>
              <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #3b82f6' }}>Cash Flow Before Tax</td>
              {[0, 1, 2, 3, 4, 5].map((year) => (
                <td key={year} style={{ padding: '2px 8px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dbeafe', borderRight: year < 5 ? '1px solid #3b82f6' : 'none', textAlign: 'right' }}>
                  <input 
                    type="number" 
                    style={{ ...inputStyle, fontWeight: '700', backgroundColor: '#dbeafe' }}
                    value={data[`proFormaY${year}_cashFlow`] || (data.proForma && data.proForma[year] ? Math.round(data.proForma[year].cashFlow) : 0)}
                    onChange={(e) => handleChange(`proFormaY${year}_cashFlow`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* EXIT ANALYSIS & RETURNS - Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Left Column - EXIT ANALYSIS & RETURNS */}
        <div>
          <div style={{ 
            backgroundColor: '#cbd5e1', 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '0'
          }}>
            EXIT ANALYSIS & RETURNS
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>Exit Cap Rate</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      step="0.01" 
                      style={inputStyle}
                      value={data.exitCapRate || 5.5}
                      onChange={(e) => handleChange('exitCapRate', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Sales Costs (%)</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      step="0.1" 
                      style={inputStyle}
                      value={data.salesCostsPct || 2.0}
                      onChange={(e) => handleChange('salesCostsPct', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Holding Period (Years)</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      style={inputStyle}
                      value={data.holdingPeriodYears || 5}
                      onChange={(e) => handleChange('holdingPeriodYears', parseInt(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Exit Calculations</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={labelCellStyle}>Stabilized NOI (Year 5)</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        style={inputStyle}
                        value={data.stabilizedNOI || (data.proForma && data.proForma[5] ? Math.round(data.proForma[5].noi) : 0)}
                        onChange={(e) => handleChange('stabilizedNOI', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCellStyle}>Gross Sale Price</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        style={inputStyle}
                        value={data.grossSalePrice || (() => {
                          const year5NOI = data.stabilizedNOI || (data.proForma && data.proForma[5] ? data.proForma[5].noi : 0);
                          const exitCap = (data.exitCapRate || 5.5) / 100;
                          return Math.round(year5NOI / exitCap);
                        })()}
                        onChange={(e) => handleChange('grossSalePrice', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCellStyle}>(-) Sales Costs</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        style={inputStyle}
                        value={data.salesCostsDollar || (() => {
                          const grossSale = data.grossSalePrice || 0;
                          return Math.round(grossSale * ((data.salesCostsPct || 2.0) / 100));
                        })()}
                        onChange={(e) => handleChange('salesCostsDollar', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCellStyle}>Net Sale Price</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        style={inputStyle}
                        value={data.netSalePrice || (() => {
                          const grossSale = data.grossSalePrice || 0;
                          const salesCosts = data.salesCostsDollar || 0;
                          return Math.round(grossSale - salesCosts);
                        })()}
                        onChange={(e) => handleChange('netSalePrice', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCellStyle}>Loan Balance at Exit</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        style={inputStyle}
                        value={data.loanBalanceAtExit || (() => {
                          const loanAmount = data.loanAmount || 0;
                          const monthlyRate = ((data.interestRate || 0) / 100) / 12;
                          const months = (data.amortizationYears || 30) * 12;
                          const paymentMonths = (data.holdingPeriodYears || 5) * 12;
                          if (monthlyRate === 0) return Math.round(loanAmount);
                          const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                          let balance = loanAmount;
                          for (let i = 0; i < paymentMonths; i++) {
                            const interest = balance * monthlyRate;
                            const principal = monthlyPayment - interest;
                            balance -= principal;
                          }
                          return Math.round(balance);
                        })()}
                        onChange={(e) => handleChange('loanBalanceAtExit', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#10b981' }}>
                    <td style={{ padding: '6px 8px', fontSize: '11px', fontWeight: '700', color: 'white', borderRight: '1px solid #059669' }}>Net Proceeds (After Loan)</td>
                    <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', color: 'white', textAlign: 'right' }}>
                      <input 
                        type="number" 
                        style={{ ...inputStyle, fontWeight: '700', color: 'white', backgroundColor: '#10b981' }}
                        value={data.netProceeds || (() => {
                          const netSale = data.netSalePrice || 0;
                          const loanBalance = data.loanBalanceAtExit || 0;
                          return Math.round(netSale - loanBalance);
                        })()}
                        onChange={(e) => handleChange('netProceeds', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - RETURNS SUMMARY */}
        <div>
          <div style={{ 
            backgroundColor: '#cbd5e1', 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '0'
          }}>
            RETURNS SUMMARY
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Cash-on-Cash Returns</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <tbody>
                {[1, 2, 3, 4, 5].map((year, idx) => (
                  <tr key={idx}>
                    <td style={labelCellStyle}>Year {year}</td>
                    <td style={inputCellStyle}>
                      <input 
                        type="number" 
                        step="0.1" 
                        style={inputStyle}
                        value={data[`cocYear${year}`] || (() => {
                          const cashFlow = data.proForma && data.proForma[year] ? data.proForma[year].cashFlow : 0;
                          const equity = data.totalEquityRequired || 1;
                          return ((cashFlow / equity) * 100).toFixed(1);
                        })()}
                        onChange={(e) => handleChange(`cocYear${year}`, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '12px', paddingTop: '16px', borderTop: '2px solid #e5e7eb' }}>Key Returns Metrics</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>Project IRR</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      step="0.1" 
                      style={inputStyle}
                      value={data.projectIRR || 0}
                      onChange={(e) => handleChange('projectIRR', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Equity Multiple</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      step="0.01" 
                      style={inputStyle}
                      value={data.equityMultiple || (() => {
                        const netProceeds = data.netProceeds || 0;
                        let totalCashFlows = 0;
                        for (let y = 1; y <= 5; y++) {
                          totalCashFlows += (data.proForma && data.proForma[y] ? data.proForma[y].cashFlow : 0);
                        }
                        const totalReturns = totalCashFlows + netProceeds;
                        const equity = data.totalEquityRequired || 1;
                        return (totalReturns / equity).toFixed(2);
                      })()}
                      onChange={(e) => handleChange('equityMultiple', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>Avg Cash-on-Cash</td>
                  <td style={inputCellStyle}>
                    <input 
                      type="number" 
                      step="0.1" 
                      style={inputStyle}
                      value={data.avgCashOnCash || (() => {
                        let totalCoc = 0;
                        for (let y = 1; y <= 5; y++) {
                          const coc = data[`cocYear${y}`] || 0;
                          totalCoc += parseFloat(coc);
                        }
                        return (totalCoc / 5).toFixed(1);
                      })()}
                      onChange={(e) => handleChange('avgCashOnCash', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SENSITIVITY ANALYSIS */}
      <div style={{ 
        backgroundColor: '#1e3a8a', 
        padding: '10px 16px', 
        fontSize: '13px', 
        fontWeight: '700',
        color: 'white',
        marginTop: '32px',
        marginBottom: '0'
      }}>
        SENSITIVITY ANALYSIS
      </div>

      {/* IRR SENSITIVITY */}
      <div style={{ marginBottom: '24px', marginTop: '16px' }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: '700', 
          color: '#1e293b',
          marginBottom: '8px',
          padding: '8px 12px',
          backgroundColor: '#e0e7ff'
        }}>
          IRR SENSITIVITY: EXIT CAP RATE vs RENT GROWTH
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'left', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>IRR</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Exit Cap →</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>4.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>5.0%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>5.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>6.0%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>6.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>7.0%</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Rent Growth ↓</td>
                <td colSpan="7" style={{ borderBottom: '1px solid #e5e7eb' }}></td>
              </tr>
              {[1.0, 2.0, 3.0, 4.0, 5.0].map((rentGrowthPct, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{rentGrowthPct.toFixed(1)}%</td>
                  <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}></td>
                  {[4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((exitCapPct, col) => {
                    const isHighlighted = idx === 2 && col === 2; // 3.0% rent growth and 5.5% exit cap (base case)
                    
                    // Calculate IRR for this scenario
                    const irr = (() => {
                      // Build cash flows with this rent growth rate
                      const equity = -(data.totalEquityRequired || 0);
                      const cashFlows = [equity];
                      
                      // Calculate Year 1-5 cash flows with varying rent growth
                      const baseGPR = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                      const baseOpex = expenses?.total || 0;
                      const debtService = data.annualDebtService || 0;
                      
                      for (let y = 1; y <= 5; y++) {
                        const gpr = baseGPR * Math.pow(1 + rentGrowthPct / 100, y);
                        const vacancy = -gpr * (1 - (data.physicalOccupancy || 95) / 100);
                        const egi = gpr + vacancy;
                        const opex = baseOpex * Math.pow(1 + (data.annualExpenseGrowth || 2.5) / 100, y);
                        const noi = egi - opex;
                        const cashFlow = noi - debtService;
                        cashFlows.push(cashFlow);
                      }
                      
                      // Add exit proceeds in Year 5
                      const year5GPR = baseGPR * Math.pow(1 + rentGrowthPct / 100, 5);
                      const year5Vacancy = -year5GPR * (1 - (data.physicalOccupancy || 95) / 100);
                      const year5EGI = year5GPR + year5Vacancy;
                      const year5Opex = baseOpex * Math.pow(1 + (data.annualExpenseGrowth || 2.5) / 100, 5);
                      const year5NOI = year5EGI - year5Opex;
                      
                      const grossSale = year5NOI / (exitCapPct / 100);
                      const salesCosts = grossSale * ((data.salesCostsPct || 2.0) / 100);
                      const netSale = grossSale - salesCosts;
                      
                      // Calculate loan balance
                      const loanAmount = data.loanAmount || 0;
                      const monthlyRate = ((data.interestRate || 0) / 100) / 12;
                      const months = (data.amortizationYears || 30) * 12;
                      let loanBalance = loanAmount;
                      if (monthlyRate > 0) {
                        const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                        for (let i = 0; i < 60; i++) {
                          const interest = loanBalance * monthlyRate;
                          const principal = monthlyPayment - interest;
                          loanBalance -= principal;
                        }
                      }
                      
                      const exitProceeds = netSale - loanBalance;
                      cashFlows[5] += exitProceeds;
                      
                      // Newton-Raphson method to calculate IRR
                      let guess = 0.1;
                      for (let iter = 0; iter < 20; iter++) {
                        let npv = 0;
                        let dnpv = 0;
                        for (let i = 0; i < cashFlows.length; i++) {
                          npv += cashFlows[i] / Math.pow(1 + guess, i);
                          dnpv += -i * cashFlows[i] / Math.pow(1 + guess, i + 1);
                        }
                        const newGuess = guess - npv / dnpv;
                        if (Math.abs(newGuess - guess) < 0.0001) {
                          return (newGuess * 100).toFixed(1);
                        }
                        guess = newGuess;
                      }
                      return '0.0';
                    })();
                    
                    return (
                      <td key={col} style={{ 
                        padding: '6px 8px', 
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: isHighlighted ? '#fef08a' : 'white',
                        borderRight: col < 5 ? '1px solid #e5e7eb' : 'none', 
                        borderBottom: '1px solid #e5e7eb', 
                        textAlign: 'center' 
                      }}>
                        {irr}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EQUITY MULTIPLE SENSITIVITY */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: '700', 
          color: '#1e293b',
          marginBottom: '8px',
          padding: '8px 12px',
          backgroundColor: '#e0e7ff'
        }}>
          EQUITY MULTIPLE SENSITIVITY: EXIT CAP RATE vs RENT GROWTH
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'left', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>EM</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Exit Cap →</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>4.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>5.0%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>5.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>6.0%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>6.5%</th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>7.0%</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>Rent Growth ↓</td>
                <td colSpan="7" style={{ borderBottom: '1px solid #e5e7eb' }}></td>
              </tr>
              {[1.0, 2.0, 3.0, 4.0, 5.0].map((rentGrowthPct, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{rentGrowthPct.toFixed(1)}%</td>
                  <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}></td>
                  {[4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((exitCapPct, col) => {
                    const isHighlighted = idx === 2 && col === 2; // 3.0% rent growth and 5.5% exit cap (base case)
                    
                    // Calculate Equity Multiple for this scenario
                    const em = (() => {
                      const equity = data.totalEquityRequired || 1;
                      
                      // Calculate total cash flows Years 1-5 with varying rent growth
                      const baseGPR = unitMixRows.reduce((sum, u) => sum + (u.units * u.marketRent * 12), 0);
                      const baseOpex = expenses?.total || 0;
                      const debtService = data.annualDebtService || 0;
                      let totalCashFlows = 0;
                      
                      for (let y = 1; y <= 5; y++) {
                        const gpr = baseGPR * Math.pow(1 + rentGrowthPct / 100, y);
                        const vacancy = -gpr * (1 - (data.physicalOccupancy || 95) / 100);
                        const egi = gpr + vacancy;
                        const opex = baseOpex * Math.pow(1 + (data.annualExpenseGrowth || 2.5) / 100, y);
                        const noi = egi - opex;
                        const cashFlow = noi - debtService;
                        totalCashFlows += cashFlow;
                      }
                      
                      // Calculate exit proceeds with varying rent growth and exit cap
                      const year5GPR = baseGPR * Math.pow(1 + rentGrowthPct / 100, 5);
                      const year5Vacancy = -year5GPR * (1 - (data.physicalOccupancy || 95) / 100);
                      const year5EGI = year5GPR + year5Vacancy;
                      const year5Opex = baseOpex * Math.pow(1 + (data.annualExpenseGrowth || 2.5) / 100, 5);
                      const year5NOI = year5EGI - year5Opex;
                      
                      const grossSale = year5NOI / (exitCapPct / 100);
                      const salesCosts = grossSale * ((data.salesCostsPct || 2.0) / 100);
                      const netSale = grossSale - salesCosts;
                      
                      // Calculate loan balance at exit
                      const loanAmount = data.loanAmount || 0;
                      const monthlyRate = ((data.interestRate || 0) / 100) / 12;
                      const months = (data.amortizationYears || 30) * 12;
                      let loanBalance = loanAmount;
                      if (monthlyRate > 0) {
                        const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                        for (let i = 0; i < 60; i++) {
                          const interest = loanBalance * monthlyRate;
                          const principal = monthlyPayment - interest;
                          loanBalance -= principal;
                        }
                      }
                      
                      const exitProceeds = netSale - loanBalance;
                      const totalReturns = totalCashFlows + exitProceeds;
                      
                      return (totalReturns / equity).toFixed(2);
                    })();
                    
                    return (
                      <td key={col} style={{ 
                        padding: '6px 8px', 
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: isHighlighted ? '#fef08a' : 'white',
                        borderRight: col < 5 ? '1px solid #e5e7eb' : 'none', 
                        borderBottom: '1px solid #e5e7eb', 
                        textAlign: 'center' 
                      }}>
                        {em}x
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RUBSTab;

