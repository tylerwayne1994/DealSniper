import React from 'react';
import ClosingCostsSection from './ClosingCostsSection';
import FixedAnnualExpensesSection from './FixedAnnualExpensesSection';

export default function CharacteristicsTab(props) {
  const {
    scenarioData = {},
    property = {},
    fullCalcs = {},
    pricing_financing = {},
    countyTaxData = [],
    countySearch = '',
    setCountySearch,
    showCountyDropdown,
    setShowCountyDropdown,
    onEditData = () => {},
    onEditLocal,
    fmt = (v) => (v == null ? '' : v),
    pct = (v) => (v == null ? '' : v)
  } = props || {};

  const pnl = scenarioData.pnl || {};
  const expensesData = scenarioData.expenses || {};
  const unitMix = scenarioData.unit_mix || [];
  const financing = scenarioData.financing || {};

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'right',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };
  const inputStyleLeft = { ...inputStyle, textAlign: 'left' };
  const readOnlyStyle = { ...inputStyle, backgroundColor: '#f8fafc', color: '#374151', cursor: 'default' };
  const labelStyle = { fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block', fontWeight: '500' };
  const selectStyle = { ...inputStyle, textAlign: 'left', cursor: 'pointer' };

  const SectionCard = ({ title, icon, color = '#0f766e', children }) => (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
      <div style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, color: 'white', padding: '12px 16px', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && <span>{icon}</span>}
        {title}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );

  const totalUtilitiesMonthly = ((expensesData.gas || 0) + (expensesData.electrical || 0) + (expensesData.water || 0) + (expensesData.sewer || 0) + (expensesData.trash || 0)) / 12;
  const grossPotentialRent = pnl.scheduled_gross_rent_current || scenarioData.income?.gross_potential_rent || 0;
  const otherIncome = scenarioData.income?.other_income || 0;

  // Derive default vacancy, management, and CapEx rates from parsed data so sliders aren’t zero
  let vacancyFraction = 0;
  if (pnl.vacancy_rate != null) {
    vacancyFraction = pnl.vacancy_rate > 1 ? pnl.vacancy_rate / 100 : pnl.vacancy_rate;
  } else if (expensesData.vacancy_rate != null) {
    vacancyFraction = expensesData.vacancy_rate > 1 ? expensesData.vacancy_rate / 100 : (expensesData.vacancy_rate / 100);
  } else {
    vacancyFraction = 0.05;
  }
  const vacancyRatePct = expensesData.vacancy_rate != null
    ? expensesData.vacancy_rate
    : (vacancyFraction * 100);

  let managementRatePct = expensesData.management_rate;
  if (managementRatePct == null) {
    const managementAnnual = expensesData.management || 0;
    if (grossPotentialRent > 0 && managementAnnual > 0) {
      managementRatePct = (managementAnnual / grossPotentialRent) * 100;
    }
  }
  if (managementRatePct == null) {
    managementRatePct = 5;
  }

  let capexRatePct = expensesData.capex_rate;
  if (capexRatePct == null) {
    const capexMonthly = expensesData.capex || scenarioData.expenses?.capex || 0;
    const monthlyGpr = (pnl.gross_potential_rent || grossPotentialRent) / 12 || 0;
    if (monthlyGpr > 0 && capexMonthly > 0) {
      capexRatePct = (capexMonthly / monthlyGpr) * 100;
    } else if (expensesData.capex_pct != null) {
      capexRatePct = expensesData.capex_pct;
    }
  }
  if (capexRatePct == null) {
    capexRatePct = 5;
  }

  const effectiveGrossIncome = pnl.effective_gross_income_current || (grossPotentialRent - (grossPotentialRent * vacancyRatePct / 100) + otherIncome);
  const totalInitialCash = (fullCalcs.financing?.totalEquityRequired || 0) + ((pricing_financing?.price || 0) * ((scenarioData.acquisition_costs?.closing_costs_pct || 0) / 100)) + (scenarioData.acquisition_costs?.rehab_cost || 0);

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc' }}>
      <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', color: 'white' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Property Details</h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', opacity: 0.9 }}>Edit property information, financing, and expenses</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', maxWidth: '1800px' }}>
        <div>
          <SectionCard title="Property Information" icon="🏢" color="#3b82f6">
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Address</label>
              <input type="text" style={inputStyleLeft} value={property?.address || ''} onChange={(e) => onEditData && onEditData('property.address', e.target.value)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>City</label>
              <input type="text" style={inputStyleLeft} value={property?.city || ''} onChange={(e) => onEditData && onEditData('property.city', e.target.value)} />
            </div>
            <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>State</label>
                <input type="text" style={inputStyleLeft} value={property?.state || ''} onChange={(e) => onEditData && onEditData('property.state', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>ZIP Code</label>
                <input type="text" style={inputStyle} value={property?.zip || ''} onChange={(e) => onEditData && onEditData('property.zip', e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Total Units *</label>
              <input type="number" style={inputStyle} value={property?.units || ''} onChange={(e) => onEditData && onEditData('property.units', parseInt(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Year Built</label>
              <input type="number" style={inputStyle} value={property?.year_built || ''} onChange={(e) => onEditData && onEditData('property.year_built', parseInt(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Building SF</label>
              <input type="number" style={inputStyle} value={property?.rba_sqft || ''} onChange={(e) => onEditData && onEditData('property.rba_sqft', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Land Area (Acres)</label>
              <input type="number" step="0.01" style={inputStyle} value={property?.land_area_acres || ''} onChange={(e) => onEditData && onEditData('property.land_area_acres', parseFloat(e.target.value) || 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Property County" icon="📍" color="#8b5cf6">
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <label style={labelStyle}>County</label>
              <input type="text" style={inputStyleLeft} value={scenarioData.property_county?.name || countySearch} onChange={(e) => { setCountySearch && setCountySearch(e.target.value); setShowCountyDropdown && setShowCountyDropdown(true); }} onFocus={() => setShowCountyDropdown && setShowCountyDropdown(true)} placeholder="Search county..." />
              {showCountyDropdown && countySearch && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {countyTaxData && countyTaxData.filter(c => c.fullName.toLowerCase().includes(countySearch.toLowerCase())).slice(0,20).map((county, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.target.style.backgroundColor = 'white'} onClick={() => { onEditData && onEditData('property_county', { name: county.fullName, state: county.state, county: county.county, taxRate: county.taxRate }); setCountySearch && setCountySearch(''); setShowCountyDropdown && setShowCountyDropdown(false); }}>
                      <span>{county.fullName}</span>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>{county.taxRate.toFixed(4)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {scenarioData.property_county?.taxRate && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Tax Rate</label>
                  <input type="text" style={readOnlyStyle} value={`${scenarioData.property_county.taxRate.toFixed(4)}%`} readOnly />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Proforma Taxes (Annual)</label>
                  <input type="number" style={readOnlyStyle} value={Math.round((pricing_financing?.price || 0) * (scenarioData.property_county.taxRate / 100))} readOnly />
                </div>
                <div>
                  <label style={labelStyle}>Proforma Taxes (Monthly)</label>
                  <input type="number" style={readOnlyStyle} value={Math.round((pricing_financing?.price || 0) * (scenarioData.property_county.taxRate / 100) / 12)} readOnly />
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Pricing & Financing" icon="💰" color="#0d9488">
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Financing Type *</label>
              <select style={selectStyle} value={pricing_financing?.financing_type || financing.financing_type || 'traditional'} onChange={(e) => onEditData && onEditData('pricing_financing.financing_type', e.target.value)}>
                <option value="traditional">Traditional</option>
                <option value="subject_to">Subject To</option>
                <option value="seller_carry">Seller Carry</option>
                <option value="creative">Creative</option>
                <option value="hybrid">Hybrid</option>
                <option value="jv">JV</option>
                <option value="equity_partner">Equity Partner</option>
              </select>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={labelStyle}>Purchase Price *</label>
              <input type="number" style={inputStyle} value={pricing_financing?.price || ''} onChange={(e) => onEditData && onEditData('pricing_financing.price', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Down Payment %</label>
                <input type="number" style={inputStyle} value={(100 - (pricing_financing?.ltv || 75)).toFixed(1)} onChange={(e) => onEditData && onEditData('pricing_financing.ltv', 100 - (parseFloat(e.target.value) || 0))} />
              </div>
              <div>
                <label style={labelStyle}>LTV %</label>
                <input type="number" style={inputStyle} value={pricing_financing?.ltv || 75} onChange={(e) => onEditData && onEditData('pricing_financing.ltv', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Term (Years)</label>
                <input type="number" style={inputStyle} value={pricing_financing?.term_years || pricing_financing?.amortization_years || 30} onChange={(e) => onEditData && onEditData('pricing_financing.term_years', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={labelStyle}>Amortization (Years)</label>
                <input type="number" style={inputStyle} value={pricing_financing?.amortization_years || 30} onChange={(e) => onEditData && onEditData('pricing_financing.amortization_years', parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Interest Rate % *</label>
              <input type="number" step="0.1" style={inputStyle} value={pricing_financing?.interest_rate || 6} onChange={(e) => onEditData && onEditData('pricing_financing.interest_rate', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Loan Amount</label>
              <input type="number" style={readOnlyStyle} value={fullCalcs.financing?.loanAmount || ''} readOnly />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Monthly Payment</label>
              <input type="number" style={readOnlyStyle} value={fullCalcs.financing?.monthlyPayment || ''} readOnly />
            </div>
            <div>
              <label style={labelStyle}>Annual Debt Service</label>
              <input type="number" style={readOnlyStyle} value={fullCalcs.financing?.annualDebtService || ''} readOnly />
            </div>
          </SectionCard>

          <SectionCard title="Acquisition Costs" icon="📋" color="#f97316">
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Realtor Fees (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.realtor_fee_pct || ''} onChange={(e) => onEditData && onEditData('acquisition_costs.realtor_fee_pct', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Closing Costs (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.closing_costs_pct || ''} onChange={(e) => onEditData && onEditData('acquisition_costs.closing_costs_pct', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Acquisition Fee (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={scenarioData.acquisition_costs?.acquisition_fee_pct || ''} onChange={(e) => onEditData && onEditData('acquisition_costs.acquisition_fee_pct', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Rehab Cost</label>
              <input type="number" style={inputStyle} value={scenarioData.acquisition_costs?.rehab_cost || ''} onChange={(e) => onEditData && onEditData('acquisition_costs.rehab_cost', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
              <label style={{ ...labelStyle, color: '#92400e', fontWeight: '600' }}>Total Initial Cash</label>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#92400e', textAlign: 'right' }}>${totalInitialCash.toLocaleString()}</div>
            </div>
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Income" icon="💵" color="#10b981">
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Gross Potential Rent (Annual) *</label>
              <input type="number" style={inputStyle} value={grossPotentialRent || ''} onChange={(e) => onEditData && onEditData('income.gross_potential_rent', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Other Income (Annual)</label>
              <input type="number" style={inputStyle} value={otherIncome || ''} onChange={(e) => onEditData && onEditData('income.other_income', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Effective Gross Income (Annual)</label>
              <input type="number" style={readOnlyStyle} value={Math.round(effectiveGrossIncome)} readOnly />
            </div>
          </SectionCard>

          <SectionCard title="Percentage Expenses" icon="📊" color="#6366f1">
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Vacancy Rate (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={vacancyRatePct || ''} onChange={(e) => onEditData && onEditData('expenses.vacancy_rate', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Property Management (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={managementRatePct || ''} onChange={(e) => onEditData && onEditData('expenses.management_rate', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Capital Expenditures (%)</label>
              <input type="number" step="0.1" style={inputStyle} value={capexRatePct || ''} onChange={(e) => onEditData && onEditData('expenses.capex_rate', parseFloat(e.target.value) || 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Fixed Annual Expenses" icon="📝" color="#ef4444">
            <FixedAnnualExpensesSection scenarioData={scenarioData} onEditData={onEditData} labelStyle={labelStyle} inputStyle={inputStyle} />
          </SectionCard>
        </div>

        <div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '12px' }}>
            <div style={{ backgroundColor: '#374151', color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '12px', borderRadius: '8px 8px 0 0' }}>Utilities (Monthly)</div>
            <div style={{ padding: '10px' }}>
              <div style={{ marginBottom: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Gas</label>
                  <input type="number" style={inputStyle} value={Math.round((expensesData.gas || 0) / 12) || ''} onChange={(e) => onEditData && onEditData('expenses.gas', (parseFloat(e.target.value) || 0) * 12)} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', alignSelf: 'center' }}>Annual: ${(expensesData.gas || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Electrical</label>
                  <input type="number" style={inputStyle} value={Math.round((expensesData.electrical || 0) / 12) || ''} onChange={(e) => onEditData && onEditData('expenses.electrical', (parseFloat(e.target.value) || 0) * 12)} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', alignSelf: 'center' }}>Annual: ${(expensesData.electrical || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Water</label>
                  <input type="number" style={inputStyle} value={Math.round((expensesData.water || 0) / 12) || ''} onChange={(e) => onEditData && onEditData('expenses.water', (parseFloat(e.target.value) || 0) * 12)} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', alignSelf: 'center' }}>Annual: ${(expensesData.water || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Sewer</label>
                  <input type="number" style={inputStyle} value={Math.round((expensesData.sewer || 0) / 12) || ''} onChange={(e) => onEditData && onEditData('expenses.sewer', (parseFloat(e.target.value) || 0) * 12)} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', alignSelf: 'center' }}>Annual: ${(expensesData.sewer || 0).toLocaleString()}</div>
              </div>
              <div style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Trash</label>
                  <input type="number" style={inputStyle} value={Math.round((expensesData.trash || 0) / 12) || ''} onChange={(e) => onEditData && onEditData('expenses.trash', (parseFloat(e.target.value) || 0) * 12)} />
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right', alignSelf: 'center' }}>Annual: ${(expensesData.trash || 0).toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#dbeafe', borderRadius: '8px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>Total Utilities</span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>${Math.round(totalUtilitiesMonthly).toLocaleString()}/mo</span>
                </div>
              </div>
            </div>
          </div>

          <SectionCard title="Unit Mix" icon="🏠" color="#0ea5e9">
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748b', fontWeight: '600' }}>Type</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', color: '#64748b', fontWeight: '600' }}>Units</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#64748b', fontWeight: '600' }}>SF</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#64748b', fontWeight: '600' }}>Rent</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#64748b', fontWeight: '600' }}>Mkt Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {unitMix.length > 0 ? unitMix.map((unit, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: '500' }}>{unit.type || unit.unit_type || `Unit ${idx + 1}`}</td>
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>{unit.units || unit.count || 1}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px' }}>{unit.sqft || unit.unit_sf || '-'}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px' }}>${unit.rent || unit.current_rent || 0}</td>
                      <td style={{ textAlign: 'right', padding: '8px 6px', color: '#0d9488', fontWeight: '500' }}>${unit.market_rent || unit.rent || 0}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>No unit mix data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Closing Costs" icon="💼" color="#64748b">
            <ClosingCostsSection scenarioData={scenarioData} onEditData={onEditData} labelStyle={labelStyle} inputStyle={inputStyle} />
          </SectionCard>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '24px', background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)', borderRadius: '16px', color: 'white' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 Live Calculations</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>NOI</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{fmt(fullCalcs.year1?.noi)}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Cap Rate</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{pct(fullCalcs.year1?.capRate)}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Cash Flow</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: fullCalcs.year1?.cashFlow >= 0 ? '#86efac' : '#fca5a5' }}>{fmt(fullCalcs.year1?.cashFlow)}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>CoC Return</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{pct(fullCalcs.year1?.cashOnCash)}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>DSCR</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{fullCalcs.year1?.dscr?.toFixed(2) || 'N/A'}x</div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Total Expenses</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{fmt(fullCalcs.year1?.totalOperatingExpenses)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

