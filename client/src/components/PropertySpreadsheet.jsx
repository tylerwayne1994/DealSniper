import React, { useState, useMemo, useEffect } from 'react';
import * as calc from '../utils/propertySpreadsheetCalculations';

const PropertySpreadsheet = ({ initialData }) => {
  // Spreadsheet state
  const [data, setData] = useState({
    // KEY DEAL METRICS inputs
    propertyName: '',
    units: 0,
    squareFeet: 0,
    purchasePrice: 0,
    stabilizedNOI: 0, // Year 1 NOI - calculated from revenue/expenses
    proFormaNOI: 0, // Year 2 NOI - calculated from revenue/expenses
    
    // SOURCES OF FUNDS
    sources: {
      seniorDebt: 0,
      mezDebt: 0,
      preferredEquity: 0,
      lpEquity: 0,
      gpEquity: 0,
    },
    
    // USES OF FUNDS
    uses: {
      purchasePrice: 0,
      closingCosts: 0,
      dueDiligence: 0,
      immediateCapex: 0,
      financingFees: 0,
      operatingReserves: 0,
      other: 0,
    },
    
    // PROPERTY & ACQUISITION ASSUMPTIONS
    acquisition: {
      acquisitionDate: '',
      holdPeriod: 5,
      yearBuilt: '',
      closingCosts: 0,
      dueDiligence: 0,
      capexBudgetYear1: 0,
      financingCosts: 0,
      operatingReserves: 0,
    },
    
    // GROWTH ASSUMPTIONS
    growth: {
      annualRentGrowth: 0.03, // 3%
      annualExpenseGrowth: 0.03, // 3%
      vacancyRate: 0.05, // 5%
      badDebtRate: 0.02, // 2%
      concessions: 0,
      managementFeePercent: 0.03, // 3%
      exitCapRate5Yr: 0.06, // 6%
      exitCapRate10Yr: 0.06, // 6%
    },
    
    // SALE ASSUMPTIONS
    sale: {
      sellingCostsPercent: 0.02, // 2%
      capexReservePerUnitPerYear: 300,
      renovatedUnitPremium: 0,
      classicRentAvg: 0,
      renovatedRentAvg: 0,
    },
    
    // UNIT MIX & RENT ROLL
    rentRoll: [
      // Array of units - start with 10 empty units
      ...Array(10).fill(null).map((_, i) => ({
        id: i + 1,
        unitNumber: '',
        type: '',
        sf: 0,
        status: '',
        marketRent: 0,
        inPlaceRent: 0,
        leaseStart: '',
        leaseEnd: '',
        tenantName: ''
      }))
    ],
    
    // OTHER INCOME (Annual amounts)
    otherIncome: {
      laundry: 0,
      parking: 0,
      petFees: 0,
      applicationFees: 0,
      lateFees: 0,
      storage: 0,
      other: 0,
    },
    
    // OPERATING EXPENSES (Annual amounts)
    expenses: {
      realEstateTaxes: 0,
      propertyInsurance: 0,
      waterSewer: 0,
      electric: 0,
      gas: 0,
      trashRemoval: 0,
      repairsMaintenance: 0,
      landscaping: 0,
      pestControl: 0,
      snowRemoval: 0,
      unitTurnover: 0,
      onSitePayroll: 0,
      marketing: 0,
      legalProfessional: 0,
      accounting: 0,
      administrative: 0,
      security: 0,
      cableInternet: 0,
      elevatorMaintenance: 0,
      poolMaintenance: 0,
    },
    
    // CREATIVE FINANCING STRUCTURE
    financing: {
      // Subject-To Existing Mortgage
      subjectTo: {
        balance: 0,
        interestRate: 0,
        remainingTermMonths: 0,
      },
      // Seller Financing (1st Position)
      sellerFinancing: {
        loanAmount: 0,
        interestRate: 0,
        termMonths: 0,
        amortizationMonths: 0,
        interestOnlyMonths: 0,
      },
      // Seller Carryback (2nd Position)
      sellerCarryback: {
        loanAmount: 0,
        interestRate: 0,
        termMonths: 0,
        interestOnly: false,
      },
      // DSCR Loan
      dscrLoan: {
        loanAmount: 0,
        ltv: 0,
        interestRate: 0,
        termMonths: 0,
        dscrRequirement: 1.25,
      },
    },
    
    // WATERFALL STRUCTURE
    waterfall: {
      preferredReturn: 0.08, // 8%
      lpEquitySplitPrePref: 0.90, // 90%
      gpEquitySplitPrePref: 0.10, // 10%
      lpSplitAfterPref: 0.70, // 70%
      gpPromoteAfterPref: 0.30, // 30%
    },
  });

  // Load initial data from props when provided
  useEffect(() => {
    if (initialData) {
      console.log('[PropertySpreadsheet] Loading initial data:', initialData);
      setData(prev => {
        // Deep merge nested objects properly
        const merged = { ...prev };
        
        // Top-level scalar values
        if (initialData.propertyName !== undefined) merged.propertyName = initialData.propertyName;
        if (initialData.units !== undefined) merged.units = initialData.units;
        if (initialData.squareFeet !== undefined) merged.squareFeet = initialData.squareFeet;
        if (initialData.purchasePrice !== undefined) merged.purchasePrice = initialData.purchasePrice;
        if (initialData.stabilizedNOI !== undefined) merged.stabilizedNOI = initialData.stabilizedNOI;
        if (initialData.proFormaNOI !== undefined) merged.proFormaNOI = initialData.proFormaNOI;
        
        // Nested objects - deep merge
        if (initialData.sources) merged.sources = { ...prev.sources, ...initialData.sources };
        if (initialData.uses) merged.uses = { ...prev.uses, ...initialData.uses };
        if (initialData.acquisition) merged.acquisition = { ...prev.acquisition, ...initialData.acquisition };
        if (initialData.growth) merged.growth = { ...prev.growth, ...initialData.growth };
        if (initialData.sale) merged.sale = { ...prev.sale, ...initialData.sale };
        if (initialData.rentRoll) merged.rentRoll = initialData.rentRoll;
        if (initialData.otherIncome) merged.otherIncome = { ...prev.otherIncome, ...initialData.otherIncome };
        if (initialData.expenses) merged.expenses = { ...prev.expenses, ...initialData.expenses };
        if (initialData.financing) {
          merged.financing = {
            subjectTo: { ...prev.financing.subjectTo, ...(initialData.financing.subjectTo || {}) },
            sellerFinancing: { ...prev.financing.sellerFinancing, ...(initialData.financing.sellerFinancing || {}) },
            sellerCarryback: { ...prev.financing.sellerCarryback, ...(initialData.financing.sellerCarryback || {}) },
            dscrLoan: { ...prev.financing.dscrLoan, ...(initialData.financing.dscrLoan || {}) },
          };
        }
        if (initialData.waterfall) merged.waterfall = { ...prev.waterfall, ...initialData.waterfall };
        
        console.log('[PropertySpreadsheet] Merged data:', merged);
        return merged;
      });
    }
  }, [initialData]);

  // Calculate Key Deal Metrics using useMemo for efficiency
  const keyMetrics = useMemo(() => {
    return calc.calculateKeyDealMetrics(data);
  }, [data.purchasePrice, data.units, data.squareFeet, data.stabilizedNOI, data.proFormaNOI]);

  // Calculate Sources & Uses
  const sourcesAndUses = useMemo(() => {
    return calc.calculateSourcesAndUses(data);
  }, [data.sources, data.uses]);

  // Calculate Return Summary
  const returnSummary = useMemo(() => {
    return calc.calculateReturnSummary(data);
  }, [data.sources, data.uses]); // Will add more dependencies once cash flows are implemented

  // Calculate Unit Mix Summary
  const unitMixSummary = useMemo(() => {
    return calc.calculateUnitMixSummary(data.rentRoll);
  }, [data.rentRoll]);

  // Calculate Status Summary
  const statusSummary = useMemo(() => {
    return calc.calculateStatusSummary(data.rentRoll);
  }, [data.rentRoll]);

  // Calculate Rent Roll Totals
  const rentRollTotals = useMemo(() => {
    return calc.calculateRentRollTotals(data.rentRoll);
  }, [data.rentRoll]);

  // Calculate Revenue Projections (10 years)
  const revenueProjections = useMemo(() => {
    return calc.calculateRevenueProjections(data);
  }, [data.units, data.rentRoll, data.growth]);

  // Calculate Expense Projections (10 years)
  const expenseProjections = useMemo(() => {
    return calc.calculateExpenseProjections(data, revenueProjections);
  }, [data.units, data.expenses, data.growth, data.sale, data.otherIncome, revenueProjections]);

  // Calculate NOI Projections (10 years)
  const noiProjections = useMemo(() => {
    return calc.calculateNOIProjections(revenueProjections, expenseProjections, data.units);
  }, [revenueProjections, expenseProjections, data.units]);

  // Calculate Financing Metrics
  const financingMetrics = useMemo(() => {
    return calc.calculateFinancingMetrics(data, noiProjections);
  }, [data.financing, data.purchasePrice, noiProjections]);

  // Calculate Cash Flow Projections
  const cashFlowProjections = useMemo(() => {
    return calc.calculateCashFlowProjections(noiProjections, financingMetrics, data);
  }, [noiProjections, financingMetrics, data.sources]);

  // Calculate Sale Analysis
  const saleAnalysis = useMemo(() => {
    return calc.calculateSaleAnalysis(noiProjections, data, financingMetrics);
  }, [noiProjections, data.growth, data.sale, financingMetrics]);

  // Calculate Equity Investment
  const equityInvestment = useMemo(() => {
    return calc.calculateEquityInvestment(data, financingMetrics);
  }, [data.uses, financingMetrics]);

  // Calculate IRR Cash Flows
  const irrCashFlows = useMemo(() => {
    return calc.calculateIRRCashFlows(equityInvestment, cashFlowProjections, saleAnalysis);
  }, [equityInvestment, cashFlowProjections, saleAnalysis]);

  // Calculate Waterfall Distribution
  const waterfallDistribution = useMemo(() => {
    return calc.calculateWaterfallDistribution(irrCashFlows, equityInvestment, data);
  }, [irrCashFlows, equityInvestment, data.waterfall]);

  // Calculate Sensitivity Analysis
  const sensitivityAnalysis = useMemo(() => {
    return calc.calculateSensitivityAnalysis(data, cashFlowProjections, equityInvestment, noiProjections, financingMetrics);
  }, [data.growth, data.sale, cashFlowProjections, equityInvestment, noiProjections, financingMetrics]);

  const styles = {
    container: {
      padding: '16px',
      height: '100%',
      overflow: 'auto',
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    },
    section: {
      marginBottom: '20px',
    },
    sectionHeader: {
      backgroundColor: '#34568B',
      color: '#ffffff',
      padding: '6px 12px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '11px',
      border: '1px solid #d1d5db',
    },
    tableCell: {
      border: '1px solid #d1d5db',
      padding: '6px 8px',
    },
    labelCell: {
      backgroundColor: '#f3f4f6',
      fontWeight: '500',
      textAlign: 'left',
    },
    inputCell: {
      backgroundColor: '#ffffff',
    },
    input: {
      width: '100%',
      border: 'none',
      outline: 'none',
      fontSize: '11px',
      padding: '2px 4px',
      textAlign: 'right',
    },
    currencyInputWrapper: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    },
    currencyPrefix: {
      fontSize: '11px',
      color: '#6b7280',
      marginRight: '2px',
    },
    centerText: {
      textAlign: 'center',
    },
    rightText: {
      textAlign: 'right',
    },
    threeColumnGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '16px',
      marginBottom: '20px',
    },
    fourColumnGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '16px',
      marginBottom: '20px',
    },
  };

  // Currency Input Component with $ prefix
  const CurrencyInput = ({ value, onChange, style = {} }) => (
    <div style={styles.currencyInputWrapper}>
      <span style={styles.currencyPrefix}>$</span>
      <input
        type="number"
        style={{ ...styles.input, ...style }}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Top Row: Key Metrics, Sources, Uses, Returns */}
      <div style={styles.fourColumnGrid}>
        {/* KEY DEAL METRICS */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>KEY DEAL METRICS</div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Property Name</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="text"
                    style={styles.input}
                    value={data.propertyName}
                    onChange={(e) => setData({ ...data, propertyName: e.target.value })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Total Units</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.units || ''}
                    onChange={(e) => setData({ ...data, units: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Total SF</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.squareFeet || ''}
                    onChange={(e) => setData({ ...data, squareFeet: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Purchase Price</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <CurrencyInput
                    value={data.purchasePrice}
                    onChange={(e) => setData({ ...data, purchasePrice: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Price Per Unit</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(keyMetrics.pricePerUnit)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Price Per SF</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(keyMetrics.pricePerSF)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Year 1 NOI</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(data.stabilizedNOI)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Going-In Cap Rate</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(keyMetrics.purchaseCapRate)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Stabilized Cap Rate</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(keyMetrics.proFormaCapRate)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SOURCES OF FUNDS */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>SOURCES OF FUNDS</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>Source</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>Amount</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>%</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Senior Debt</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <CurrencyInput
                    value={data.sources.seniorDebt}
                    onChange={(e) => setData({ 
                      ...data, 
                      sources: { ...data.sources, seniorDebt: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.sourcesPercentages.seniorDebt)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Mez Debt</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.sources.mezDebt || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      sources: { ...data.sources, mezDebt: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.sourcesPercentages.mezDebt)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Preferred Equity</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.sources.preferredEquity || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      sources: { ...data.sources, preferredEquity: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.sourcesPercentages.preferredEquity)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, height: '8px' }} colSpan={3}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Equity</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.sources.lpEquity || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      sources: { ...data.sources, lpEquity: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.sourcesPercentages.lpEquity)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Equity</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.sources.gpEquity || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      sources: { ...data.sources, gpEquity: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.sourcesPercentages.gpEquity)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total Sources</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {calc.formatCurrency(sourcesAndUses.totalSources)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* USES OF FUNDS */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>USES OF FUNDS</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>Use</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>Amount</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>%</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Purchase Price</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.purchasePrice || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, purchasePrice: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.purchasePrice)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Closing Costs</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.closingCosts || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, closingCosts: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.closingCosts)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Due Diligence</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.dueDiligence || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, dueDiligence: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.dueDiligence)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>CapEx Budget</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.immediateCapex || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, immediateCapex: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.immediateCapex)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Financing Costs</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.financingFees || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, financingFees: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.financingFees)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Operating Res</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.operatingReserves || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, operatingReserves: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.operatingReserves)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Other</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.uses.other || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      uses: { ...data.uses, other: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(sourcesAndUses.usesPercentages.other)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total Uses</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {calc.formatCurrency(sourcesAndUses.totalUses)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RETURN SUMMARY */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>RETURN SUMMARY</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>Metric</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>5-Year</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell }}>10-Year</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Project IRR</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.projectIRR > 0 
                    ? calc.formatPercent(returnSummary.fiveYear.projectIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.projectIRR > 0 
                    ? calc.formatPercent(returnSummary.tenYear.projectIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP IRR</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.lpIRR > 0 
                    ? calc.formatPercent(returnSummary.fiveYear.lpIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.lpIRR > 0 
                    ? calc.formatPercent(returnSummary.tenYear.lpIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP IRR</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.gpIRR > 0 
                    ? calc.formatPercent(returnSummary.fiveYear.gpIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.gpIRR > 0 
                    ? calc.formatPercent(returnSummary.tenYear.gpIRR) 
                    : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Equity Multiple</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.equityMultiple.toFixed(2)}x
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.equityMultiple.toFixed(2)}x
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Eq Multiple</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.lpEquityMultiple.toFixed(2)}x
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.lpEquityMultiple.toFixed(2)}x
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Eq Multiple</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.fiveYear.gpEquityMultiple.toFixed(2)}x
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {returnSummary.tenYear.gpEquityMultiple.toFixed(2)}x
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Avg CoC Return</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(returnSummary.fiveYear.avgCoCReturn)}
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(returnSummary.tenYear.avgCoCReturn)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PROPERTY & ACQUISITION ASSUMPTIONS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>PROPERTY & ACQUISITION ASSUMPTIONS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0' }}>
          {/* Acquisition Column */}
          <div>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Acquisition</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Acquisition Date</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="date"
                      style={styles.input}
                      value={data.acquisition.acquisitionDate}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, acquisitionDate: e.target.value }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Hold Period (Years)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.holdPeriod || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, holdPeriod: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Year Built</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.yearBuilt || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, yearBuilt: e.target.value }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Closing Costs</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.closingCosts || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, closingCosts: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Due Diligence</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.dueDiligence || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, dueDiligence: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>CapEx Budget (Year 1)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.capexBudgetYear1 || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, capexBudgetYear1: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Financing Costs</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.financingCosts || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, financingCosts: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Operating Reserves</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.acquisition.operatingReserves || ''}
                      onChange={(e) => setData({ ...data, acquisition: { ...data.acquisition, operatingReserves: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Growth Assumptions Column */}
          <div>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Growth Assumptions</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Rent Growth</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.annualRentGrowth * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, annualRentGrowth: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Expense Growth</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.annualExpenseGrowth * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, annualExpenseGrowth: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Vacancy Rate</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.vacancyRate * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, vacancyRate: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Bad Debt Rate</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.badDebtRate * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, badDebtRate: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Concessions</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.growth.concessions || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, concessions: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Management Fee %</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.managementFeePercent * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, managementFeePercent: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Exit Cap Rate (5-Yr)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.exitCapRate5Yr * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, exitCapRate5Yr: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Exit Cap Rate (10-Yr)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.growth.exitCapRate10Yr * 100 || ''}
                      onChange={(e) => setData({ ...data, growth: { ...data.growth, exitCapRate10Yr: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sale Assumptions Column */}
          <div>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Sale Assumptions</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Selling Costs %</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      step="0.001"
                      style={styles.input}
                      value={data.sale.sellingCostsPercent * 100 || ''}
                      onChange={(e) => setData({ ...data, sale: { ...data.sale, sellingCostsPercent: (parseFloat(e.target.value) || 0) / 100 }})}
                      placeholder="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>CapEx Reserve $/Unit/Yr</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.sale.capexReservePerUnitPerYear || ''}
                      onChange={(e) => setData({ ...data, sale: { ...data.sale, capexReservePerUnitPerYear: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual CapEx (Ongoing)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(data.sale.capexReservePerUnitPerYear * data.units * 12)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Renovated Unit Premium</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.sale.renovatedUnitPremium || ''}
                      onChange={(e) => setData({ ...data, sale: { ...data.sale, renovatedUnitPremium: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Classic Rent Avg</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={data.sale.classicRentAvg || ''}
                      onChange={(e) => setData({ ...data, sale: { ...data.sale, classicRentAvg: parseFloat(e.target.value) || 0 }})}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Renovated Rent Avg</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(data.sale.classicRentAvg + data.sale.renovatedUnitPremium)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* UNIT MIX & RENT ROLL */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>UNIT MIX & RENT ROLL</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Unit #</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Type</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>SF</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Status</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Market Rent</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>In-Place Rent</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Loss to Lease</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Lease Start</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Lease End</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}>Tenant Name</th>
                </tr>
              </thead>
              <tbody>
                {data.rentRoll.map((unit, i) => (
                  <tr key={unit.id}>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="text"
                        style={styles.input}
                        value={unit.unitNumber}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].unitNumber = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="text"
                        style={styles.input}
                        value={unit.type}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].type = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={unit.sf || ''}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].sf = parseFloat(e.target.value) || 0;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="text"
                        style={styles.input}
                        value={unit.status}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].status = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={unit.marketRent || ''}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].marketRent = parseFloat(e.target.value) || 0;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={unit.inPlaceRent || ''}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].inPlaceRent = parseFloat(e.target.value) || 0;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(unit.marketRent - unit.inPlaceRent)}
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="date"
                        style={styles.input}
                        value={unit.leaseStart}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].leaseStart = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="date"
                        style={styles.input}
                        value={unit.leaseEnd}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].leaseEnd = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="text"
                        style={styles.input}
                        value={unit.tenantName}
                        onChange={(e) => {
                          const newRentRoll = [...data.rentRoll];
                          newRentRoll[i].tenantName = e.target.value;
                          setData({ ...data, rentRoll: newRentRoll });
                        }}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>TOTALS</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>{rentRollTotals.totalSF}</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>{calc.formatCurrency(rentRollTotals.totalMarketRent)}</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>{calc.formatCurrency(rentRollTotals.totalInPlaceRent)}</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>{calc.formatCurrency(rentRollTotals.totalLossToLease)}</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ width: '280px' }}>
            {/* UNIT MIX SUMMARY */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ ...styles.sectionHeader, fontSize: '10px' }}>UNIT MIX SUMMARY</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Unit Type</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Count</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Avg SF</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Avg Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(unitMixSummary.byType).map(type => (
                    <tr key={type}>
                      <td style={{ ...styles.tableCell, ...styles.labelCell }}>{type}</td>
                      <td style={{ ...styles.tableCell, ...styles.inputCell }}>{unitMixSummary.byType[type].count}</td>
                      <td style={{ ...styles.tableCell, ...styles.inputCell }}>{Math.round(unitMixSummary.byType[type].avgSF)}</td>
                      <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatCurrency(unitMixSummary.byType[type].avgRent)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Total/Avg</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{unitMixSummary.totals.count}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{Math.round(unitMixSummary.totals.avgSF)}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatCurrency(unitMixSummary.totals.avgRent)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* STATUS SUMMARY */}
            <div>
              <div style={{ ...styles.sectionHeader, fontSize: '10px' }}>STATUS SUMMARY</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Status</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Count</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>% of Total</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell }}>Avg Rent</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Renovated</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{statusSummary.renovated.count}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatPercent(statusSummary.renovated.percent * 100)}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {statusSummary.renovated.count > 0 
                        ? calc.formatCurrency(statusSummary.renovated.avgRent)
                        : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Classic</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{statusSummary.classic.count}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatPercent(statusSummary.classic.percent * 100)}</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {statusSummary.classic.count > 0 
                        ? calc.formatCurrency(statusSummary.classic.avgRent)
                        : <span style={{ color: '#ef4444' }}>#DIV/0!</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* REVENUE PROJECTIONS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>REVENUE PROJECTIONS</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}>Revenue Item</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>$/Unit/Mo</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Annual</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 1</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 2</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 3</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 4</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 5</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 6</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 7</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 8</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 9</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 10</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Gross Potential Rent</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].grossPotentialRentPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].grossPotentialRent) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.grossPotentialRent)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(Less) Vacancy</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].vacancyPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].vacancy) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.vacancy)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(Less) Loss to Lease</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].lossToLeasePerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].lossToLease) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.lossToLease)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(Less) Concessions</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].concessionsPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].concessions) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.concessions)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(Less) Bad Debt</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].badDebtPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].badDebt) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.badDebt)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#e5e7eb' }}>Net Rental Income</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#e5e7eb' }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].netRentalIncomePerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#e5e7eb' }}>
                {revenueProjections[0] ? calc.formatCurrency(revenueProjections[0].netRentalIncome) : '$0'}
              </td>
              {revenueProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#e5e7eb' }}>
                  {calc.formatCurrency(proj.netRentalIncome)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, height: '8px' }} colSpan={13}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Other Income</td>
              <td style={{ ...styles.tableCell }} colSpan={12}></td>
            </tr>
            {[
              { label: 'Laundry Income', key: 'laundry' },
              { label: 'Parking Income', key: 'parking' },
              { label: 'Pet Fees', key: 'petFees' },
              { label: 'Application Fees', key: 'applicationFees' },
              { label: 'Late Fees', key: 'lateFees' },
              { label: 'Storage Income', key: 'storage' },
            ].map(({ label, key }) => (
              <tr key={key}>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>{label}</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.otherIncome[key] || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      otherIncome: { ...data.otherIncome, [key]: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatCurrency(data.otherIncome[key])}</td>
                {[...Array(10)].map((_, i) => (
                  <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(data.otherIncome[key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total Other Income</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                {calc.formatCurrency(calc.calculateTotalOtherIncome(data.otherIncome))}
              </td>
              {[...Array(10)].map((_, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {calc.formatCurrency(calc.calculateTotalOtherIncome(data.otherIncome))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* RUBS UTILITY BILLBACK */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#6B8E23' }}>RUBS UTILITY BILLBACK</div>
        <table style={styles.table}>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, width: '200px', backgroundColor: '#E8F5E9' }}>Toggle (1=Tenant, 0=Owner)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '80px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', backgroundColor: '#E8F5E9' }}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Water/Sewer Billback</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Electric Billback</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Gas Billback</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Trash Billback</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>$               -</td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>Total all RUBS Income</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>$               -</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* EFFECTIVE GROSS INCOME */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#1E40AF' }}>EFFECTIVE GROSS INCOME</div>
        <table style={styles.table}>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, width: '200px', fontWeight: '700' }}>$</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '80px', fontWeight: '700' }}>-</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>$               -</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* OPERATING EXPENSES */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#DC2626' }}>OPERATING EXPENSES</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}>Expense Item</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>$/Unit/Mo</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Annual</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 1</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 2</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 3</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 4</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 5</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 6</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 7</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 8</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 9</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '90px' }}>Year 10</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Real Estate Taxes', key: 'realEstateTaxes' },
              { label: 'Property Insurance', key: 'propertyInsurance' },
              { label: 'Water/Sewer', key: 'waterSewer' },
              { label: 'Electric (Common)', key: 'electric' },
              { label: 'Gas', key: 'gas' },
              { label: 'Trash Removal', key: 'trashRemoval' },
              { label: 'Repairs & Maintenance', key: 'repairsMaintenance' },
              { label: 'Landscaping', key: 'landscaping' },
              { label: 'Pest Control', key: 'pestControl' },
              { label: 'Snow Removal', key: 'snowRemoval' },
              { label: 'Unit Turnover', key: 'unitTurnover' },
            ].map(({ label, key }) => (
              <tr key={key}>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>{label}</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.expenses[key] || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      expenses: { ...data.expenses, [key]: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatCurrency(data.expenses[key])}</td>
                {expenseProjections.map((proj, i) => (
                  <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(proj[key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Management Fee</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].managementFee / data.units / 12) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].managementFee) : '$0'}
              </td>
              {expenseProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.managementFee)}
                </td>
              ))}
            </tr>
            {[
              { label: 'On-Site Payroll', key: 'onSitePayroll' },
              { label: 'Marketing & Advertising', key: 'marketing' },
              { label: 'Legal & Professional', key: 'legalProfessional' },
              { label: 'Accounting', key: 'accounting' },
              { label: 'Administrative', key: 'administrative' },
              { label: 'Security', key: 'security' },
              { label: 'Cable/Internet', key: 'cableInternet' },
              { label: 'Elevator Maintenance', key: 'elevatorMaintenance' },
              { label: 'Pool Maintenance', key: 'poolMaintenance' },
            ].map(({ label, key }) => (
              <tr key={key}>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>{label}</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  <input
                    type="number"
                    style={styles.input}
                    value={data.expenses[key] || ''}
                    onChange={(e) => setData({ 
                      ...data, 
                      expenses: { ...data.expenses, [key]: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>{calc.formatCurrency(data.expenses[key])}</td>
                {expenseProjections.map((proj, i) => (
                  <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(proj[key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Replacement Reserves</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].replacementReserves / data.units / 12) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].replacementReserves) : '$0'}
              </td>
              {expenseProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.replacementReserves)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#FEF3C7' }}>TOTAL OPERATING EXPENSES</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#FEF3C7' }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].totalExpensesPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#FEF3C7' }}>
                {expenseProjections[0] ? calc.formatCurrency(expenseProjections[0].totalExpenses) : '$0'}
              </td>
              {expenseProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#FEF3C7' }}>
                  {calc.formatCurrency(proj.totalExpenses)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* NET OPERATING INCOME (NOI) */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#10B981' }}>NET OPERATING INCOME (NOI)</div>
        <table style={styles.table}>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, width: '200px', fontWeight: '700' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '80px', fontWeight: '700' }}>
                {noiProjections[0] ? calc.formatCurrency(noiProjections[0].noiPerUnitPerMonth) : '$0'}
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>
                {noiProjections[0] ? calc.formatCurrency(noiProjections[0].noi) : '$0'}
              </td>
              {noiProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, width: '90px', fontWeight: '700' }}>
                  {calc.formatCurrency(proj.noi)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, height: '8px' }} colSpan={13}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Expense Ratio (% of EGI)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              {noiProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(proj.expenseRatio)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>NOI Per Unit</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              {noiProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.noiPerUnit)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* CREATIVE FINANCING STRUCTURE */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#1E3A5F' }}>CREATIVE FINANCING STRUCTURE</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* SUBJECT-TO EXISTING MORTGAGE */}
            <div>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#2563EB', fontSize: '10px', padding: '4px 8px' }}>SUBJECT-TO EXISTING MORTGAGE</div>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Current Balance</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.subjectTo.balance || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            subjectTo: { ...data.financing.subjectTo, balance: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.001"
                        value={data.financing.subjectTo.interestRate || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            subjectTo: { ...data.financing.subjectTo, interestRate: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Remaining Term (Months)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.subjectTo.remainingTermMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            subjectTo: { ...data.financing.subjectTo, remainingTermMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Monthly P&I</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.subjectTo.monthlyPI)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Debt Service</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.subjectTo.annualDS)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SELLER FINANCING (1ST POSITION) */}
            <div>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#2563EB', fontSize: '10px', padding: '4px 8px' }}>SELLER FINANCING (1ST POSITION)</div>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Loan Amount</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerFinancing.loanAmount || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerFinancing: { ...data.financing.sellerFinancing, loanAmount: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.001"
                        value={data.financing.sellerFinancing.interestRate || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerFinancing: { ...data.financing.sellerFinancing, interestRate: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Term (Months)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerFinancing.termMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerFinancing: { ...data.financing.sellerFinancing, termMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Amortization (Months)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerFinancing.amortizationMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerFinancing: { ...data.financing.sellerFinancing, amortizationMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest-Only Period (Mo)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerFinancing.interestOnlyMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerFinancing: { ...data.financing.sellerFinancing, interestOnlyMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Monthly P&I (after IO)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.sellerFinancing.monthlyPI)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Monthly IO Payment</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.sellerFinancing.monthlyIO)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Debt Service</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.sellerFinancing.annualDS)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* SELLER CARRYBACK (2ND POSITION) */}
            <div>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#3B82F6', fontSize: '10px', padding: '4px 8px' }}>SELLER CARRYBACK (2ND POSITION)</div>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Loan Amount</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerCarryback.loanAmount || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerCarryback: { ...data.financing.sellerCarryback, loanAmount: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.001"
                        value={data.financing.sellerCarryback.interestRate || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerCarryback: { ...data.financing.sellerCarryback, interestRate: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Term (Months)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.sellerCarryback.termMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerCarryback: { ...data.financing.sellerCarryback, termMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest-Only (Y/N)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="checkbox"
                        checked={data.financing.sellerCarryback.interestOnly || false}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            sellerCarryback: { ...data.financing.sellerCarryback, interestOnly: e.target.checked }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Monthly Payment</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.sellerCarryback.monthlyPayment)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Debt Service</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.sellerCarryback.annualDS)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DSCR LOAN */}
            <div>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#3B82F6', fontSize: '10px', padding: '4px 8px' }}>DSCR LOAN</div>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Loan Amount</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.dscrLoan.loanAmount || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            dscrLoan: { ...data.financing.dscrLoan, loanAmount: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>LTV %</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.01"
                        value={data.financing.dscrLoan.ltv || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            dscrLoan: { ...data.financing.dscrLoan, ltv: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Interest Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.001"
                        value={data.financing.dscrLoan.interestRate || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            dscrLoan: { ...data.financing.dscrLoan, interestRate: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Term (Months)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        value={data.financing.dscrLoan.termMonths || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            dscrLoan: { ...data.financing.dscrLoan, termMonths: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>DSCR Requirement</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      <input
                        type="number"
                        style={styles.input}
                        step="0.01"
                        value={data.financing.dscrLoan.dscrRequirement || ''}
                        onChange={(e) => setData({
                          ...data,
                          financing: {
                            ...data.financing,
                            dscrLoan: { ...data.financing.dscrLoan, dscrRequirement: parseFloat(e.target.value) || 0 }
                          }
                        })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Monthly P&I</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.dscrLoan.monthlyPI)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Debt Service</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(financingMetrics.dscrLoan.annualDS)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BLENDED FINANCING SUMMARY */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ ...styles.sectionHeader, backgroundColor: '#15803D', fontSize: '10px', padding: '4px 8px' }}>BLENDED FINANCING SUMMARY</div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px', backgroundColor: '#E8F5E9' }}>Total Debt</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                  {calc.formatCurrency(financingMetrics.blended.totalDebt)}
                </td>
                <td style={{ ...styles.tableCell, backgroundColor: '#E8F5E9', width: '400px', position: 'relative' }} rowSpan={5}>
                  <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '300px', height: '100px', border: '2px solid #3B82F6', borderRadius: '4px' }}></div>
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Total Annual Debt Service</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                  {calc.formatCurrency(financingMetrics.blended.totalAnnualDS)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Blended Interest Rate</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                  {calc.formatPercent(financingMetrics.blended.blendedRate)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>Debt Yield</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                  {calc.formatPercent(financingMetrics.blended.debtYield)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#E8F5E9' }}>LTV (% of Purchase)</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                  {calc.formatPercent(financingMetrics.blended.ltv)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CASH FLOW PROJECTIONS */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#1E3A5F' }}>CASH FLOW PROJECTIONS</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}>Cash Flow Item</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 1</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 2</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 3</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 4</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 5</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 6</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 7</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 8</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 9</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 10</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Net Operating Income</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.noi)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Subject-To Debt Service</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.subjectToDS)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Seller Financing DS</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.sellerFinancingDS)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Seller Carryback DS</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.sellerCarrybackDS)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) DSCR Loan DS</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.dscrLoanDS)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total Debt Service</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {calc.formatCurrency(proj.totalDebtService)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) CapEx/Reserves</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(proj.capexReserves)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>Before-Tax Cash Flow</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>
                  {calc.formatCurrency(proj.beforeTaxCashFlow)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, height: '8px' }} colSpan={11}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>DSCR (NOI/Debt Service)</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {proj.dscr ? proj.dscr.toFixed(2) + 'x' : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Cash-on-Cash Return</td>
              {cashFlowProjections.map((proj, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatPercent(proj.cashOnCash)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* SALE / REVERSION ANALYSIS and EQUITY INVESTMENT (Side by Side) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* SALE / REVERSION ANALYSIS */}
        <div>
          <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA' }}>SALE / REVERSION ANALYSIS</div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Exit Cap Rate Applied</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Forward NOI (Next Year)</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Gross Sale Price</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Selling Costs</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Loan Payoffs</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Net Sale Proceeds</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Sale Years Table */}
          <div style={{ marginTop: '16px' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 5</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 6</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 7</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 8</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 9</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#1E3A5F', color: 'white', width: '80px' }}>Year 10</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatPercent(saleAnalysis[`year${year}`]?.exitCapRate)}
                    </td>
                  ))}
                </tr>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(saleAnalysis[`year${year}`]?.forwardNOI)}
                    </td>
                  ))}
                </tr>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(saleAnalysis[`year${year}`]?.grossSalePrice)}
                    </td>
                  ))}
                </tr>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(saleAnalysis[`year${year}`]?.sellingCosts)}
                    </td>
                  ))}
                </tr>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(saleAnalysis[`year${year}`]?.loanPayoffs)}
                    </td>
                  ))}
                </tr>
                <tr>
                  {[5,6,7,8,9,10].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                      {calc.formatCurrency(saleAnalysis[`year${year}`]?.netSaleProceeds)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* EQUITY INVESTMENT */}
        <div>
          <div style={{ ...styles.sectionHeader, backgroundColor: '#1E3A5F' }}>EQUITY INVESTMENT</div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Total Acquisition Cost</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(equityInvestment.totalAcquisitionCost)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>(-) Total Debt</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(equityInvestment.totalDebt)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Required Equity</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {calc.formatCurrency(equityInvestment.requiredEquity)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, height: '8px' }} colSpan={2}></td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Equity (90%)</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(equityInvestment.lpEquity)}
                </td>
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Equity (10%)</td>
                <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(equityInvestment.gpEquity)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Equity Years Table */}
          <div style={{ marginTop: '16px' }}>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#REF!</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444', fontWeight: '700' }}>#REF!</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, height: '8px' }} colSpan={6}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>0.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* IRR CASH FLOWS */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#4B5320' }}>IRR CASH FLOWS</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}></th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 0</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 1</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 2</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 3</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 4</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 5</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Initial Investment</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                ({calc.formatCurrency(irrCashFlows.initialInvestment)})
              </td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Operating Cash Flow</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              {[1,2,3,4,5].map(year => (
                <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(cashFlowProjections[year - 1]?.beforeTaxCashFlow)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Sale Proceeds (5-Yr)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {calc.formatCurrency(saleAnalysis.year5?.netSaleProceeds)}
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Sale Proceeds (10-Yr)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total CF (5-Yr Exit)</td>
              {irrCashFlows.fiveYear.cashFlows.slice(0, 6).map((cf, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}>
                  {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>Total CF (10-Yr Exit)</td>
              {irrCashFlows.tenYear.cashFlows.slice(0, 6).map((cf, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>
                  {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Right side continuation */}
        <table style={{ ...styles.table, marginTop: '16px' }}>
          <thead>
            <tr>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}></th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 6</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 7</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 8</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 9</th>
              <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Year 10</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Initial Investment</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Operating Cash Flow</td>
              {[6,7,8,9,10].map(year => (
                <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                  {calc.formatCurrency(cashFlowProjections[year - 1]?.beforeTaxCashFlow)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Sale Proceeds (5-Yr)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell }}>Sale Proceeds (10-Yr)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>$0</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                {calc.formatCurrency(saleAnalysis.year10?.netSaleProceeds)}
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700' }}>Total CF (5-Yr Exit)</td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
              <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700' }}></td>
            </tr>
            <tr>
              <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>Total CF (10-Yr Exit)</td>
              {irrCashFlows.tenYear.cashFlows.slice(6, 11).map((cf, i) => (
                <td key={i} style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>
                  {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* IRR Summary */}
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#9333EA', padding: '12px', borderRadius: '4px' }}>
            <div style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>5-YEAR EXIT</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginTop: '4px' }}>
              IRR: {calc.formatPercent(irrCashFlows.fiveYear.irr)} | 
              Equity Multiple: {irrCashFlows.fiveYear.equityMultiple.toFixed(2)}x
            </div>
          </div>
          <div style={{ backgroundColor: '#10B981', padding: '12px', borderRadius: '4px' }}>
            <div style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>10-YEAR EXIT</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginTop: '4px' }}>
              IRR: {calc.formatPercent(irrCashFlows.tenYear.irr)} | 
              Equity Multiple: {irrCashFlows.tenYear.equityMultiple.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>

      {/* WATERFALL DISTRIBUTION & RETURNS */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#1E3A5F' }}>WATERFALL DISTRIBUTION & RETURNS</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginTop: '16px' }}>
          {/* WATERFALL STRUCTURE */}
          <div>
            <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>WATERFALL STRUCTURE</div>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, width: '180px' }}>Preferred Return (Pref)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={(data.waterfall?.preferredReturn * 100).toFixed(1)}
                      onChange={(e) => setData({ 
                        ...data, 
                        waterfall: { ...data.waterfall, preferredReturn: parseFloat(e.target.value) / 100 || 0 }
                      })}
                    />%
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Equity Split (Pre-Pref)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                    {calc.formatPercent(data.waterfall?.lpEquitySplitPrePref)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Equity Split (Pre-Pref)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                    {calc.formatPercent(data.waterfall?.gpEquitySplitPrePref)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Split (After Pref)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={(data.waterfall?.lpSplitAfterPref * 100).toFixed(1)}
                      onChange={(e) => setData({ 
                        ...data, 
                        waterfall: { ...data.waterfall, lpSplitAfterPref: parseFloat(e.target.value) / 100 || 0 }
                      })}
                    />%
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Promote (After Pref)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: '#E8F5E9' }}>
                    <input
                      type="number"
                      style={styles.input}
                      value={(data.waterfall?.gpPromoteAfterPref * 100).toFixed(1)}
                      onChange={(e) => setData({ 
                        ...data, 
                        waterfall: { ...data.waterfall, gpPromoteAfterPref: parseFloat(e.target.value) / 100 || 0 }
                      })}
                    />%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* WATERFALL CALCULATION - Year 0-4 */}
          <div>
            <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>WATERFALL CALCULATION</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '150px' }}>Distribution Item</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 0</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 1</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 2</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 3</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 4</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Distributable Cash (5-Yr)</td>
                  {[0,1,2,3,4].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.distributableCash)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Distributable Cash (10-Yr)</td>
                  {[0,1,2,3,4].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {calc.formatCurrency(waterfallDistribution.tenYear.years[year]?.distributableCash)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Pref Accrual</td>
                  {[0,1,2,3,4].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {year === 0 ? '' : calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.lpPrefAccrual)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Distribution</td>
                  {[0,1,2,3,4].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {year === 0 ? '' : calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.lpDistribution)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Distribution</td>
                  {[0,1,2,3,4].map(year => (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {year === 0 ? '' : calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.gpDistribution)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* WATERFALL CALCULATION - Year 5-10 continuation */}
        <div style={{ marginTop: '16px' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '150px' }}>Distribution Item</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 5</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 6</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 7</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 8</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 9</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 10</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Distributable Cash (5-Yr)</td>
                {[5,6,7,8,9,10].map(year => (
                  <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {year > 5 ? '' : calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.distributableCash)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>Distributable Cash (10-Yr)</td>
                {[5,6,7,8,9,10].map(year => (
                  <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatCurrency(waterfallDistribution.tenYear.years[year]?.distributableCash)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Pref Accrual</td>
                {[5,6,7,8,9,10].map(year => (
                  <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {year > 5 ? (year === 10 ? calc.formatCurrency(waterfallDistribution.tenYear.years[year]?.lpPrefAccrual) : '') : calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.lpPrefAccrual)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Distribution</td>
                {[5,6,7,8,9,10].map(year => (
                  <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {year <= 5 ? calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.lpDistribution) : calc.formatCurrency(waterfallDistribution.tenYear.years[year]?.lpDistribution)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Distribution</td>
                {[5,6,7,8,9,10].map(year => (
                  <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {year <= 5 ? calc.formatCurrency(waterfallDistribution.fiveYear.years[year]?.gpDistribution) : calc.formatCurrency(waterfallDistribution.tenYear.years[year]?.gpDistribution)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* RETURN METRICS */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ ...styles.sectionHeader, backgroundColor: '#15803D', fontSize: '10px', padding: '4px 8px' }}>RETURN METRICS</div>
          
          {/* Year 0-4 Metrics */}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '150px' }}></th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 0</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 1</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 2</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 3</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Year 4</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Cash Flows (5-Yr)</td>
                {[0,1,2,3,4].map(year => {
                  const cf = waterfallDistribution.fiveYear.years[year]?.lpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Cash Flows (10-Yr)</td>
                {[0,1,2,3,4].map(year => {
                  const cf = waterfallDistribution.tenYear.years[year]?.lpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Cash Flows (5-Yr)</td>
                {[0,1,2,3,4].map(year => {
                  const cf = waterfallDistribution.fiveYear.years[year]?.gpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Cash Flows (10-Yr)</td>
                {[0,1,2,3,4].map(year => {
                  const cf = waterfallDistribution.tenYear.years[year]?.gpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* Year 5-10 Metrics */}
          <table style={{ ...styles.table, marginTop: '16px' }}>
            <thead>
              <tr>
                <th style={{ ...styles.tableCell, ...styles.labelCell, width: '150px' }}></th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 5</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 6</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 7</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 8</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 9</th>
                <th style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#9333EA', color: 'white', width: '80px' }}>Year 10</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Cash Flows (5-Yr)</td>
                {[5,6,7,8,9,10].map(year => {
                  const cf = waterfallDistribution.fiveYear.years[year]?.lpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {year > 5 ? '' : (cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf))}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Cash Flows (10-Yr)</td>
                {[5,6,7,8,9,10].map(year => {
                  const cf = waterfallDistribution.tenYear.years[year]?.lpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Cash Flows (5-Yr)</td>
                {[5,6,7,8,9,10].map(year => {
                  const cf = waterfallDistribution.fiveYear.years[year]?.gpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {year > 5 ? '' : (cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf))}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Cash Flows (10-Yr)</td>
                {[5,6,7,8,9,10].map(year => {
                  const cf = waterfallDistribution.tenYear.years[year]?.gpCashFlow || 0;
                  return (
                    <td key={year} style={{ ...styles.tableCell, ...styles.inputCell }}>
                      {cf < 0 ? '(' + calc.formatCurrency(Math.abs(cf)) + ')' : calc.formatCurrency(cf)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#9333EA', padding: '12px', borderRadius: '4px' }}>
            <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>5-YEAR EXIT RETURNS</div>
            <div style={{ color: 'white', fontSize: '11px' }}>
              <div>LP IRR: {calc.formatPercent(waterfallDistribution.fiveYear.lpIRR)} | Equity Multiple: {waterfallDistribution.fiveYear.lpEquityMultiple.toFixed(2)}x</div>
              <div>GP IRR: {calc.formatPercent(waterfallDistribution.fiveYear.gpIRR)} | Equity Multiple: {waterfallDistribution.fiveYear.gpEquityMultiple.toFixed(2)}x</div>
            </div>
          </div>
          <div style={{ backgroundColor: '#10B981', padding: '12px', borderRadius: '4px' }}>
            <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>10-YEAR EXIT RETURNS</div>
            <div style={{ color: 'white', fontSize: '11px' }}>
              <div>LP IRR: {calc.formatPercent(waterfallDistribution.tenYear.lpIRR)} | Equity Multiple: {waterfallDistribution.tenYear.lpEquityMultiple.toFixed(2)}x</div>
              <div>GP IRR: {calc.formatPercent(waterfallDistribution.tenYear.gpIRR)} | Equity Multiple: {waterfallDistribution.tenYear.gpEquityMultiple.toFixed(2)}x</div>
            </div>
          </div>
        </div>
      </div>

      {/* SENSITIVITY ANALYSIS */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#DC2626' }}>SENSITIVITY ANALYSIS</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginTop: '16px' }}>
          {/* Sensitivity Matrix */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', fontStyle: 'italic', marginBottom: '8px' }}>
              Project IRR (5-Yr Exit) by Exit Cap Rate vs Rent Growth
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}>Exit Cap →</th>
                  {sensitivityAnalysis.exitCapRates.map((rate, i) => (
                    <th key={i} style={{ ...styles.tableCell, ...styles.labelCell, backgroundColor: '#DBEAFE', width: '80px' }}>
                      {calc.formatPercent(rate)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Rent Growth ↓</td>
                  {sensitivityAnalysis.exitCapRates.map((_, i) => (
                    <td key={i} style={{ ...styles.tableCell, ...styles.inputCell }}></td>
                  ))}
                </tr>
                {sensitivityAnalysis.rentGrowthRates.map((rentGrowth, rowIdx) => (
                  <tr key={rowIdx}>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>
                      {calc.formatPercent(rentGrowth)}
                    </td>
                    {sensitivityAnalysis.matrix[rowIdx].map((irr, colIdx) => {
                      // Determine cell color based on IRR value
                      let bgColor = '#ffffff';
                      if (irr < 0.10) bgColor = '#FEE2E2'; // Red for low returns
                      else if (irr >= 0.15) bgColor = '#D1FAE5'; // Green for high returns
                      
                      // Highlight base case (3% rent growth, 6% exit cap)
                      if (rentGrowth === 0.03 && sensitivityAnalysis.exitCapRates[colIdx] === 0.06) {
                        bgColor = '#D1FAE5';
                      }
                      
                      return (
                        <td key={colIdx} style={{ ...styles.tableCell, ...styles.inputCell, backgroundColor: bgColor }}>
                          {calc.formatPercent(irr)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Metrics Summary */}
          <div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.tableCell, ...styles.labelCell }}></th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>5-Year</th>
                  <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>10-Year</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Project IRR</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(irrCashFlows.fiveYear.irr)}
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(irrCashFlows.tenYear.irr)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP IRR</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(waterfallDistribution.fiveYear.lpIRR)}
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(waterfallDistribution.tenYear.lpIRR)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP IRR</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(waterfallDistribution.fiveYear.gpIRR)}
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(waterfallDistribution.tenYear.gpIRR)}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Equity Multiple</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {irrCashFlows.fiveYear.equityMultiple.toFixed(2)}x
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {irrCashFlows.tenYear.equityMultiple.toFixed(2)}x
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>LP Equity Mult</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {waterfallDistribution.fiveYear.lpEquityMultiple.toFixed(2)}x
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {waterfallDistribution.tenYear.lpEquityMultiple.toFixed(2)}x
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>GP Equity Mult</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {waterfallDistribution.fiveYear.gpEquityMultiple.toFixed(2)}x
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {waterfallDistribution.tenYear.gpEquityMultiple.toFixed(2)}x
                  </td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Avg Cash-on-C</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(
                      cashFlowProjections.slice(0, 5).reduce((sum, cf) => sum + (cf?.cashOnCash || 0), 0) / 5
                    )}
                  </td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>
                    {calc.formatPercent(
                      cashFlowProjections.reduce((sum, cf) => sum + (cf?.cashOnCash || 0), 0) / 10
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* VALUE-ADD ANALYSIS */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA' }}>VALUE-ADD ANALYSIS</div>
        <div style={{ fontSize: '10px', fontWeight: '700', fontStyle: 'italic', marginTop: '8px', marginBottom: '8px' }}>
          Impact of Rent Increases & Expense Reductions on Property Value
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          {/* SCENARIO INPUTS */}
          <div>
            <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>SCENARIO INPUTS</div>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}>Monthly Rent Increase ($/unit)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>100</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Annual Expense Reduction ($/unit)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>500</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Renovation Cost (Total)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }}>150,000</td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, height: '8px' }} colSpan={3}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Entry Cap Rate (Current)</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }} colSpan={2}></td>
                </tr>
                <tr>
                  <td style={{ ...styles.tableCell, ...styles.labelCell }}>Exit Cap Rate</td>
                  <td style={{ ...styles.tableCell, ...styles.inputCell }} colSpan={2}></td>
                </tr>
              </tbody>
            </table>

            {/* NOI IMPACT */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>NOI IMPACT</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}></th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Current</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Pro Forma</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Gross Rental Income</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Operating Expenses</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }}>#DIV/0!</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, fontWeight: '700', backgroundColor: '#E8F5E9' }}>Net Operating Income</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9', color: '#ef4444' }}>#DIV/0!</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9', color: '#ef4444' }}>#DIV/0!</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, fontWeight: '700', backgroundColor: '#E8F5E9', color: '#ef4444' }}>#DIV/0!</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* VALUATION IMPACT */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>VALUATION IMPACT</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '100px' }}></th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Current</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Pro Forma</th>
                    <th style={{ ...styles.tableCell, ...styles.labelCell, width: '80px' }}>Value Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Value @ Entry Cap Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Value @ Exit Cap Rate</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$               -</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* VALUE CREATION SUMMARY */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ ...styles.sectionHeader, backgroundColor: '#9333EA', fontSize: '10px', padding: '4px 8px' }}>VALUE CREATION SUMMARY</div>
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell, width: '200px' }}>Renovation Investment</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>150,000</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>NOI Increase (Annual)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }} colSpan={2}>#DIV/0!</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, height: '8px' }} colSpan={3}></td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Value Created @ Entry Cap</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>-</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Value Created @ Exit Cap</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>$</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }}>-</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, height: '8px' }} colSpan={3}></td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Return on Renovation (Entry Cap)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }} colSpan={2}>0.00%</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Return on Renovation (Exit Cap)</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell }} colSpan={2}>0.00%</td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.tableCell, ...styles.labelCell }}>Cash-on-Cash on Reno Spend</td>
                    <td style={{ ...styles.tableCell, ...styles.inputCell, color: '#ef4444' }} colSpan={2}>#DIV/0!</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertySpreadsheet;
