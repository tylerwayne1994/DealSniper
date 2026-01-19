import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { calculateAmortizationSchedule } from '../../utils/realEstateCalculations';

const ProformaTab = ({ 
  fullCalcs, 
  scenarioData,
  onFieldChange
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
  
  // Principal paydown (cumulative) line; compute via amortization schedule when possible
  const pricing = scenarioData?.pricing_financing || {};
  let loanAmount = fullCalcs?.financing?.loanAmount || pricing.loan_amount || 0;
  const purchasePriceResolved = purchasePrice || pricing.purchase_price || pricing.price || 0;
  const ltvPct = pricing.ltv || (fullCalcs?.financing?.ltv ? fullCalcs.financing.ltv * 100 : 0);
  if (!loanAmount && purchasePriceResolved > 0 && ltvPct > 0) {
    loanAmount = purchasePriceResolved * (ltvPct / 100);
  }
  const interestRate = pricing.interest_rate || fullCalcs?.financing?.interestRate || 0;
  const amortYears = pricing.amortization_years || fullCalcs?.financing?.amortizationYears || 0;
  const amortSchedule = (loanAmount > 0 && interestRate > 0 && amortYears > 0)
    ? calculateAmortizationSchedule(loanAmount, interestRate, amortYears, yearsToShow)
    : [];
  const principalCumulativeSeries = amortSchedule.length > 0
    ? amortSchedule.map(r => r.cumulativePrincipal)
    : new Array(yearsToShow).fill(0);
  
  // Calculate totals
  const totalCashFlow = proformaYears.reduce((sum, y) => sum + y.cashFlow, 0);
  // const totalNOI = proformaYears.reduce((sum, y) => sum + y.noi, 0);
  
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

  const handleChange = (path, value) => {
    if (onFieldChange) onFieldChange(path, value);
  };

  // Utilities breakdown for editable current snapshot
  const expenses = scenarioData?.expenses || {};
  const totalUtilities = expenses.utilities || 0;
  const utilityBreakdown = expenses.utility_breakdown || {};
  const hasBreakdown = Object.keys(utilityBreakdown).length > 0;
  const defaultUtilities = hasBreakdown
    ? utilityBreakdown
    : {
        water: totalUtilities / 8,
        electricity: totalUtilities / 8,
        gas: totalUtilities / 8,
        trash: totalUtilities / 8,
        sewer: totalUtilities / 8,
        internet: totalUtilities / 8,
        landscaping: totalUtilities / 8,
        pest_control: totalUtilities / 8,
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

      {/* Current Snapshot */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Current Snapshot</h3>
        <p style={{ margin: '6px 0 16px', fontSize: '12px', color: '#6b7280' }}>Editable fields auto-filled from parsed data. Mirrors Property Analysis.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Purchase Price */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Purchase Price</label>
            <input type="number" value={purchasePrice || 0} onChange={(e)=>handleChange('pricing_financing.purchase_price', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Year 1 Gross Rent */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Current Annual Rent</label>
            <input type="number" value={year1Rent || 0} onChange={(e)=>handleChange('pnl.total_rental_income', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Other Income */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Other Income (Annual)</label>
            <input type="number" value={year1OtherIncome || 0} onChange={(e)=>handleChange('pnl.other_income', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Taxes */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Property Taxes</label>
            <input type="number" value={expenses.taxes || 0} onChange={(e)=>handleChange('expenses.taxes', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Insurance */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Insurance</label>
            <input type="number" value={expenses.insurance || 0} onChange={(e)=>handleChange('expenses.insurance', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Management */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Property Management</label>
            <input type="number" value={expenses.management || 0} onChange={(e)=>handleChange('expenses.management', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Vacancy */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Vacancy (Annual $)</label>
            <input type="number" value={expenses.vacancy || 0} onChange={(e)=>handleChange('expenses.vacancy', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* CapEx */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>CapEx (Annual $)</label>
            <input type="number" value={expenses.capex || fullCalcs?.acquisition?.capexBudget || 0} onChange={(e)=>handleChange('expenses.capex', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Interest Rate */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Interest Rate (%)</label>
            <input type="number" value={interestRate || 0} onChange={(e)=>handleChange('pricing_financing.interest_rate', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          {/* Amortization Years */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Amortization (Years)</label>
            <input type="number" value={amortYears || 0} onChange={(e)=>handleChange('pricing_financing.amortization_years', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
        </div>

        {/* Utilities Breakdown */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#111827' }}>Utilities Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {Object.entries(defaultUtilities).map(([key, val]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>{key.replace('_',' ')}</label>
                <input type="number" value={val || 0} onChange={(e)=>handleChange(`expenses.utility_breakdown.${key}`, parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Computed Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Current NOI</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(year1NOI)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Current Cap Rate</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{purchasePrice > 0 ? ((year1NOI / purchasePrice) * 100).toFixed(2) + '%' : 'N/A'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Monthly Debt Service</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(annualDebtService / 12)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Annual Debt Service</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(annualDebtService)}</div>
          </div>
        </div>
      </div>

      {/* Proforma Snapshot */}
      <div style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Projected Proforma</h3>
        <p style={{ margin: '6px 0 16px', fontSize: '12px', color: '#6b7280' }}>Editable growth assumptions; values below reflect Year {yearsToShow}.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Rent Growth (Annual)</label>
            <input type="number" step="0.01" value={rentGrowthRate} onChange={(e)=>handleChange('growth.annual_rent_growth', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Expense Growth (Annual)</label>
            <input type="number" step="0.01" value={expenseGrowthRate} onChange={(e)=>handleChange('growth.annual_expense_growth', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>Vacancy Rate</label>
            <input type="number" step="0.01" value={vacancyRate} onChange={(e)=>handleChange('growth.vacancy_rate', parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontWeight:600 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Proforma Annual Rent (Year {yearsToShow})</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(proformaYears[yearsToShow-1]?.grossRent || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Proforma Other Income</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(proformaYears[yearsToShow-1]?.otherIncome || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Proforma Operating Expenses</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(proformaYears[yearsToShow-1]?.operatingExpenses || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Proforma NOI</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(proformaYears[yearsToShow-1]?.noi || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Proforma Cap Rate</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{purchasePrice > 0 ? (((proformaYears[yearsToShow-1]?.noi || 0) / purchasePrice) * 100).toFixed(2) + '%' : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Unit Mix & Rents (editable, live) */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Unit Mix & Rents</h3>
        <p style={{ margin: '6px 0 16px', fontSize: 12, color: '#6b7280' }}>Editing here updates the shared scenario data and recalculations.</p>
        {unitMix && unitMix.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Unit Type</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Units</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>SF/Unit</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Current Rent</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Market Rent</th>
                </tr>
              </thead>
              <tbody>
                {unitMix.map((u, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px', fontSize: 13 }}>{u.type || u.unit_type || ''}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <input type="number" value={u.units || 0} onChange={(e)=>handleChange(`unit_mix.${idx}.units`, parseInt(e.target.value)||0)} style={{ width: '120px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <input type="number" value={u.unit_sf || u.sf_per_unit || 0} onChange={(e)=>handleChange(`unit_mix.${idx}.unit_sf`, parseInt(e.target.value)||0)} style={{ width: '120px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <input type="number" value={u.rent_current || u.rent || 0} onChange={(e)=>handleChange(`unit_mix.${idx}.rent_current`, parseFloat(e.target.value)||0)} style={{ width: '140px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <input type="number" value={u.rent_market || u.market_rent || u.rent_current || u.rent || 0} onChange={(e)=>handleChange(`unit_mix.${idx}.rent_market`, parseFloat(e.target.value)||0)} style={{ width: '140px', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ padding: '10px', fontWeight: 700 }}>Totals</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{unitMix.reduce((s,u)=>s+(u.units||0),0)}</td>
                  <td></td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{fmt(unitMix.reduce((s,u)=>s+((u.units||0)*(u.rent_current||u.rent||0)*12),0))}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{fmt(unitMix.reduce((s,u)=>s+((u.units||0)*(u.rent_market||u.market_rent||u.rent_current||u.rent||0)*12),0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: 13 }}>No unit mix available</div>
        )}
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

      {/* Dual Line Chart: Cash Flow vs Principal Paydown */}
      <div style={{
        marginTop: '24px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>
          Trajectory: Cash Flow vs Debt Paydown
        </h3>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 24, height: 2, backgroundColor: '#10b981' }}></div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Cash Flow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 24, height: 2, backgroundColor: '#0ea5e9' }}></div>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Cumulative Principal Paid</span>
          </div>
        </div>

        {(() => {
          const width = 960; // fixed svg width
          const height = 240;
          const padding = 32;
          const seriesCF = proformaYears.map(y => y.cashFlow);
          const seriesPP = principalCumulativeSeries;
          const allVals = [...seriesCF, ...seriesPP];
          const yMin = Math.min(...allVals);
          const yMax = Math.max(...allVals);
          const yRange = yMax - yMin || 1;
          const xStep = (width - padding * 2) / (yearsToShow - 1 || 1);
          const xFor = (i) => padding + i * xStep;
          const yFor = (v) => padding + (height - padding * 2) - ((v - yMin) / yRange) * (height - padding * 2);
          const cfPoints = seriesCF.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
          const ppPoints = seriesPP.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
          const zeroY = yFor(0);
          return (
            <div>
              <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Cash flow and principal paydown chart">
                {/* zero line */}
                <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" />
                {/* cash flow line */}
                <polyline points={cfPoints} fill="none" stroke="#10b981" strokeWidth="2" />
                {/* principal paydown line */}
                <polyline points={ppPoints} fill="none" stroke="#0ea5e9" strokeWidth="2" />
              </svg>
              {/* X labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 16px' }}>
                {proformaYears.map((y) => (
                  <div key={y.year} style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Year {y.year}</div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Summary below chart */}
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>Year 1 Cash Flow</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: proformaYears[0]?.cashFlow >= 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>{fmt(proformaYears[0]?.cashFlow || 0)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>Year {yearsToShow} Cash Flow</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>{fmt(proformaYears[yearsToShow - 1]?.cashFlow || 0)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>Year 1 Principal Paid</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0ea5e9', marginTop: '4px' }}>{fmt(principalCumulativeSeries[0] || 0)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>Year {yearsToShow} Principal Paid</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0ea5e9', marginTop: '4px' }}>{fmt(principalCumulativeSeries[yearsToShow - 1] || 0)}</div>
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

