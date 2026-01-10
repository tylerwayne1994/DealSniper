import React, { useState } from 'react';
import { DollarSign, TrendingUp, Calendar, FileText } from 'lucide-react';

const ProformaTab = ({ 
  fullCalcs, 
  scenarioData
}) => {
  const [yearsToShow, setYearsToShow] = useState(5);

  // Extract growth rates from scenarioData
  const rentGrowthRate = scenarioData?.growth?.annual_rent_growth || 0.03;
  const expenseGrowthRate = scenarioData?.growth?.annual_expense_growth || 0.03;
  const vacancyRate = scenarioData?.growth?.vacancy_rate || 0.05;
  
  // Get Year 1 baseline data - try multiple paths
  // Income calculations
  const unitMix = scenarioData?.unit_mix || [];
  const calculatedRentFromUnitMix = unitMix.reduce((sum, unit) => {
    const units = unit.units || 0;
    const monthlyRent = unit.rent_current || unit.rent_market || unit.rent || 0;
    return sum + (units * monthlyRent * 12);
  }, 0);
  
  const year1Rent = fullCalcs?.year1?.grossRentalIncome || 
                    scenarioData?.pnl?.total_rental_income ||
                    scenarioData?.pnl?.rental_income ||
                    calculatedRentFromUnitMix || 0;
  
  const year1OtherIncome = fullCalcs?.year1?.otherIncome || 
                           scenarioData?.pnl?.other_income || 
                           scenarioData?.pnl?.additional_income || 0;
  
  // Operating expenses
  const year1Expenses = fullCalcs?.year1?.operatingExpenses || 
                        scenarioData?.pnl?.total_operating_expenses ||
                        scenarioData?.expenses?.total_operating_expenses || 
                        scenarioData?.pnl?.operating_expenses || 0;
  
  const year1NOI = fullCalcs?.year1?.noi || 
                   scenarioData?.pnl?.noi ||
                   scenarioData?.pnl?.noi_proforma ||
                   scenarioData?.pnl?.noi_t12 || 0;
  
  // Debt service from fullCalcs (uses the selected financing structure from calculations)
  const annualDebtService = fullCalcs?.financing?.annualDebtService || 
                           (fullCalcs?.financing?.monthlyPayment || 0) * 12 || 0;
  
  // Get purchase price
  const purchasePrice = scenarioData?.pricing_financing?.purchase_price || 
                       scenarioData?.pricing_financing?.price || 
                       fullCalcs?.acquisition?.purchasePrice || 0;
  
  // Calculate proforma for multiple years
  const generateProforma = () => {
    const years = [];
    
    for (let year = 1; year <= yearsToShow; year++) {
      const growthFactor = Math.pow(1 + rentGrowthRate, year - 1);
      const expenseGrowthFactor = Math.pow(1 + expenseGrowthRate, year - 1);
      
      const grossRent = year1Rent * growthFactor;
      const otherIncome = year1OtherIncome * growthFactor;
      const grossIncome = grossRent + otherIncome;
      const vacancy = grossIncome * vacancyRate;
      const effectiveGrossIncome = grossIncome - vacancy;
      const operatingExpenses = year1Expenses * expenseGrowthFactor;
      const noi = effectiveGrossIncome - operatingExpenses;
      const cashFlow = noi - annualDebtService;
      
      years.push({
        year,
        grossRent,
        otherIncome,
        grossIncome,
        vacancy,
        effectiveGrossIncome,
        operatingExpenses,
        noi,
        debtService: annualDebtService,
        cashFlow
      });
    }
    
    return years;
  };
  
  const proformaYears = generateProforma();
  
  // Calculate totals
  const totalCashFlow = proformaYears.reduce((sum, y) => sum + y.cashFlow, 0);
  const totalNOI = proformaYears.reduce((sum, y) => sum + y.noi, 0);
  
  // Format currency
  const fmt = (val) => {
    if (val == null || isNaN(val)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };
  
  const fmtPct = (val) => {
    if (val == null || isNaN(val)) return '0.0%';
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '32px',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#6366f1',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '14px',
        }}>
          <FileText size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
            {yearsToShow}-Year Proforma
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
            Year-over-year financial projections with {fmtPct(rentGrowthRate)} rent growth
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Years Selector */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
            Projection Period
          </label>
          <select
            value={yearsToShow}
            onChange={(e) => setYearsToShow(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              fontWeight: '500',
              color: '#111827',
              cursor: 'pointer',
              backgroundColor: 'white'
            }}
          >
            <option value={5}>5 Years</option>
            <option value={10}>10 Years</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Cash Flow
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>
              {fmt(totalCashFlow)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Annual CF
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#6366f1', marginTop: '4px' }}>
              {fmt(totalCashFlow / yearsToShow)}
            </div>
          </div>
        </div>
      </div>

      {/* Assumptions Card */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>
          Assumptions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Purchase Price</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(purchasePrice)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Year 1 NOI</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(year1NOI)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Annual Debt Service</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmt(annualDebtService)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Rent Growth</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmtPct(rentGrowthRate)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Expense Growth</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmtPct(expenseGrowthRate)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Vacancy Rate</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{fmtPct(vacancyRate)}</div>
          </div>
        </div>
      </div>

      {/* Proforma Table */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f9fafb',
                  zIndex: 1
                }}>
                  Line Item
                </th>
                {proformaYears.map((yearData) => (
                  <th key={yearData.year} style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    minWidth: '120px'
                  }}>
                    Year {yearData.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Revenue Section */}
              <ProformaRow 
                label="Gross Rental Income"
                values={proformaYears.map(y => y.grossRent)}
                fmt={fmt}
                isHeader={false}
              />
              <ProformaRow 
                label="Other Income"
                values={proformaYears.map(y => y.otherIncome)}
                fmt={fmt}
              />
              <ProformaRow 
                label="Gross Potential Income"
                values={proformaYears.map(y => y.grossIncome)}
                fmt={fmt}
                isBold
              />
              <ProformaRow 
                label="Vacancy & Credit Loss"
                values={proformaYears.map(y => -y.vacancy)}
                fmt={fmt}
                isNegative
              />
              <ProformaRow 
                label="Effective Gross Income"
                values={proformaYears.map(y => y.effectiveGrossIncome)}
                fmt={fmt}
                isBold
                bgColor="#f0f9ff"
              />
              
              {/* Expenses Section */}
              <tr style={{ height: '12px', backgroundColor: '#f9fafb' }}>
                <td colSpan={yearsToShow + 1}></td>
              </tr>
              <ProformaRow 
                label="Operating Expenses"
                values={proformaYears.map(y => -y.operatingExpenses)}
                fmt={fmt}
                isNegative
              />
              
              {/* NOI Section */}
              <ProformaRow 
                label="Net Operating Income"
                values={proformaYears.map(y => y.noi)}
                fmt={fmt}
                isBold
                bgColor="#dcfce7"
              />
              
              {/* Financing Section */}
              <tr style={{ height: '12px', backgroundColor: '#f9fafb' }}>
                <td colSpan={yearsToShow + 1}></td>
              </tr>
              <ProformaRow 
                label="Debt Service"
                values={proformaYears.map(y => -y.debtService)}
                fmt={fmt}
                isNegative
              />
              
              {/* Cash Flow Section */}
              <ProformaRow 
                label="Cash Flow After Financing"
                values={proformaYears.map(y => y.cashFlow)}
                fmt={fmt}
                isBold
                bgColor="#dbeafe"
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Growth Chart Visualization */}
      <div style={{
        marginTop: '24px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
          Cash Flow Growth
        </h3>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'flex-end', 
          height: '240px',
          padding: '20px 0',
          borderBottom: '2px solid #e5e7eb',
          position: 'relative'
        }}>
          {/* Zero line for negative values */}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '1px',
            backgroundColor: '#9ca3af',
            zIndex: 1
          }} />
          
          {proformaYears.map((yearData, idx) => {
            // Find max absolute value for scaling
            const maxAbsCF = Math.max(...proformaYears.map(y => Math.abs(y.cashFlow)));
            const isPositive = yearData.cashFlow >= 0;
            const heightPct = maxAbsCF > 0 ? (Math.abs(yearData.cashFlow) / maxAbsCF) * 85 : 5;
            
            return (
              <div key={idx} style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%'
              }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '85%'
                }}>
                  {/* Value label above bar */}
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isPositive ? '#10b981' : '#ef4444',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap'
                  }}>
                    {fmt(yearData.cashFlow)}
                  </div>
                  
                  {/* Bar */}
                  <div style={{
                    width: '80%',
                    height: `${heightPct}%`,
                    backgroundColor: isPositive ? '#10b981' : '#ef4444',
                    borderRadius: '6px 6px 0 0',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease',
                    minHeight: '8px'
                  }} />
                </div>
                
                {/* Year label */}
                <div style={{
                  marginTop: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Year {yearData.year}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Summary below chart */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-around'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>
              Year 1 Cash Flow
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: proformaYears[0]?.cashFlow >= 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>
              {fmt(proformaYears[0]?.cashFlow || 0)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>
              Year {yearsToShow} Cash Flow
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>
              {fmt(proformaYears[yearsToShow - 1]?.cashFlow || 0)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>
              Growth
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#6366f1', marginTop: '4px' }}>
              {proformaYears[0]?.cashFlow > 0 
                ? `${(((proformaYears[yearsToShow - 1]?.cashFlow || 0) / proformaYears[0]?.cashFlow - 1) * 100).toFixed(1)}%`
                : 'N/A'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for table rows
const ProformaRow = ({ label, values, fmt, isBold, bgColor, isNegative, isHeader }) => {
  return (
    <tr style={{ 
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: bgColor || 'transparent'
    }}>
      <td style={{
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: isBold ? '700' : '500',
        color: isNegative ? '#ef4444' : '#111827',
        position: 'sticky',
        left: 0,
        backgroundColor: bgColor || 'white',
        zIndex: 1
      }}>
        {label}
      </td>
      {values.map((val, idx) => (
        <td key={idx} style={{
          padding: '10px 16px',
          textAlign: 'right',
          fontSize: '13px',
          fontWeight: isBold ? '700' : '500',
          color: val < 0 ? '#ef4444' : '#111827'
        }}>
          {fmt(val)}
        </td>
      ))}
    </tr>
  );
};

export default ProformaTab;

