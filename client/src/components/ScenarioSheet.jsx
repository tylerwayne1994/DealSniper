import React from 'react';

export default function ScenarioSheet({ scenarioData }) {
  if (!scenarioData) {
    return <div style={{ padding: 24, color: '#6b7280' }}>No data available</div>;
  }

  const property = scenarioData.property || {};
  const pricing = scenarioData.pricing_financing || {};
  const pnl = scenarioData.pnl || {};
  const expenses = scenarioData.expenses || {};
  const unitMix = scenarioData.unit_mix || [];
  const underwriting = scenarioData.underwriting || {};
  const broker = scenarioData.broker_info || {};
  const assumptions = scenarioData.assumptions || {};
  const financing = scenarioData.financing || {};

  const formatCurrency = (n) => {
    if (n == null || isNaN(n) || n === 0) return '-';
    return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (p) => {
    if (p == null || isNaN(p) || p === 0) return '-';
    const val = p > 1 ? p : p * 100;
    return `${val.toFixed(2)}%`;
  };

  const formatNumber = (n) => {
    if (n == null || isNaN(n) || n === 0) return '-';
    return Number(n).toLocaleString('en-US');
  };

  // Shared styles
  const sectionStyle = { marginBottom: 32 };
  const headerStyle = { margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
  const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' };
  const thRightStyle = { ...thStyle, textAlign: 'right' };
  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' };
  const tdRightStyle = { ...tdStyle, textAlign: 'right' };
  const altRowStyle = { background: '#fafafa' };

  const Row = ({ label, value, alt }) => (
    <tr style={alt ? altRowStyle : {}}>
      <td style={tdStyle}>{label}</td>
      <td style={tdRightStyle}>{value}</td>
    </tr>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      
      {/* Property Information */}
      <div style={sectionStyle}>
        <h3 style={headerStyle}>Property Information</h3>
        <table style={tableStyle}>
          <tbody>
            <Row label="Address" value={property.address || '-'} />
            <Row label="City, State, ZIP" value={[property.city, property.state, property.zip].filter(Boolean).join(', ') || '-'} alt />
            <Row label="Units" value={formatNumber(property.units)} />
            <Row label="Year Built" value={property.year_built || '-'} alt />
            <Row label="Building SF" value={formatNumber(property.rba_sqft)} />
            <Row label="Land Area (Acres)" value={property.land_area_acres || '-'} alt />
            <Row label="Property Type" value={property.property_type || '-'} />
            <Row label="Property Class" value={property.property_class || '-'} alt />
            <Row label="Parking Spaces" value={formatNumber(property.parking_spaces)} />
          </tbody>
        </table>
      </div>

      {/* Pricing & Financing */}
      <div style={sectionStyle}>
        <h3 style={headerStyle}>Pricing & Financing</h3>
        <table style={tableStyle}>
          <tbody>
            <Row label="Purchase Price" value={formatCurrency(pricing.price)} />
            <Row label="Price Per Unit" value={formatCurrency(pricing.price_per_unit)} alt />
            <Row label="Price Per SF" value={formatCurrency(pricing.price_per_sf)} />
            <Row label="Loan Amount" value={formatCurrency(pricing.loan_amount || financing.loan_amount)} alt />
            <Row label="Down Payment" value={formatCurrency(pricing.down_payment)} />
            <Row label="LTV" value={formatPercent(pricing.ltv || financing.ltv)} alt />
            <Row label="Interest Rate" value={formatPercent(pricing.interest_rate || financing.interest_rate)} />
            <Row label="Loan Term (Years)" value={pricing.term_years || financing.loan_term_years || '-'} alt />
            <Row label="Annual Debt Service" value={formatCurrency(pricing.annual_debt_service)} />
          </tbody>
        </table>
      </div>

      {/* Income & NOI */}
      <div style={sectionStyle}>
        <h3 style={headerStyle}>Income & NOI</h3>
        <table style={tableStyle}>
          <tbody>
            <Row label="Gross Potential Rent" value={formatCurrency(pnl.gross_potential_rent)} />
            <Row label="Other Income" value={formatCurrency(pnl.other_income)} alt />
            <Row label="Vacancy Rate" value={formatPercent(pnl.vacancy_rate)} />
            <Row label="Vacancy Amount" value={formatCurrency(pnl.vacancy_amount)} alt />
            <Row label="Effective Gross Income" value={formatCurrency(pnl.effective_gross_income)} />
            <Row label="Operating Expenses" value={formatCurrency(pnl.operating_expenses)} alt />
            <Row label="Operating Expenses (T12)" value={formatCurrency(pnl.operating_expenses_t12)} />
            <Row label="Operating Expenses (Pro Forma)" value={formatCurrency(pnl.operating_expenses_proforma)} alt />
            <Row label="NOI" value={formatCurrency(pnl.noi)} />
            <Row label="NOI (T12)" value={formatCurrency(pnl.noi_t12)} alt />
            <Row label="NOI (Pro Forma)" value={formatCurrency(pnl.noi_proforma)} />
            <Row label="NOI (Stabilized)" value={formatCurrency(pnl.noi_stabilized)} alt />
            <Row label="Cap Rate" value={formatPercent(pnl.cap_rate)} />
            <Row label="Cap Rate (T12)" value={formatPercent(pnl.cap_rate_t12)} alt />
            <Row label="Cap Rate (Pro Forma)" value={formatPercent(pnl.cap_rate_proforma)} />
            <Row label="Expense Ratio" value={formatPercent(pnl.expense_ratio)} alt />
          </tbody>
        </table>
      </div>

      {/* Operating Expenses Breakdown */}
      <div style={sectionStyle}>
        <h3 style={headerStyle}>Operating Expenses Breakdown</h3>
        <table style={tableStyle}>
          <tbody>
            <Row label="Taxes" value={formatCurrency(expenses.taxes)} />
            <Row label="Insurance" value={formatCurrency(expenses.insurance)} alt />
            <Row label="Utilities" value={formatCurrency(expenses.utilities)} />
            <Row label="Repairs & Maintenance" value={formatCurrency(expenses.repairs_maintenance)} alt />
            <Row label="Management" value={formatCurrency(expenses.management)} />
            <Row label="Payroll" value={formatCurrency(expenses.payroll)} alt />
            <Row label="Admin / G&A" value={formatCurrency(expenses.admin)} />
            <Row label="Marketing" value={formatCurrency(expenses.marketing)} alt />
            <Row label="Other" value={formatCurrency(expenses.other)} />
            <Row label="Total" value={formatCurrency(expenses.total)} alt />
          </tbody>
        </table>
      </div>

      {/* Unit Mix */}
      {unitMix.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={headerStyle}>Unit Mix</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thRightStyle}>Units</th>
                <th style={thRightStyle}>Avg SF</th>
                <th style={thRightStyle}>Current Rent</th>
                <th style={thRightStyle}>Market Rent</th>
              </tr>
            </thead>
            <tbody>
              {unitMix.map((unit, i) => (
                <tr key={i} style={i % 2 === 1 ? altRowStyle : {}}>
                  <td style={tdStyle}>{unit.type || '-'}</td>
                  <td style={tdRightStyle}>{formatNumber(unit.units)}</td>
                  <td style={tdRightStyle}>{formatNumber(unit.unit_sf)}</td>
                  <td style={tdRightStyle}>{formatCurrency(unit.rent_current)}</td>
                  <td style={tdRightStyle}>{formatCurrency(unit.rent_market)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Underwriting Metrics */}
      <div style={sectionStyle}>
        <h3 style={headerStyle}>Underwriting Metrics</h3>
        <table style={tableStyle}>
          <tbody>
            <Row label="DSCR" value={underwriting.dscr ? underwriting.dscr.toFixed(2) : '-'} />
            <Row label="Cap Rate" value={formatPercent(underwriting.cap_rate)} alt />
            <Row label="Cash-on-Cash" value={formatPercent(underwriting.cash_on_cash)} />
            <Row label="IRR" value={formatPercent(underwriting.irr)} alt />
          </tbody>
        </table>
      </div>

      {/* Assumptions */}
      {Object.keys(assumptions).length > 0 && (
        <div style={sectionStyle}>
          <h3 style={headerStyle}>Assumptions</h3>
          <table style={tableStyle}>
            <tbody>
              <Row label="Rent Growth Rate" value={formatPercent(assumptions.rent_growth_rate)} />
              <Row label="Expense Growth Rate" value={formatPercent(assumptions.expense_growth_rate)} alt />
              <Row label="Vacancy Rate" value={formatPercent(assumptions.vacancy_rate)} />
              <Row label="Management Fee" value={formatPercent(assumptions.management_fee_percent || assumptions.management_fee)} alt />
              <Row label="Exit Cap Rate" value={formatPercent(assumptions.exit_cap_rate)} />
            </tbody>
          </table>
        </div>
      )}

      {/* Broker Info */}
      {(broker.broker_name || broker.broker_company) && (
        <div style={sectionStyle}>
          <h3 style={headerStyle}>Broker Information</h3>
          <table style={tableStyle}>
            <tbody>
              <Row label="Broker Name" value={broker.broker_name || '-'} />
              <Row label="Company" value={broker.broker_company || '-'} alt />
              <Row label="Phone" value={broker.broker_phone || broker.broker_phone_office || '-'} />
              <Row label="Email" value={broker.broker_email || '-'} alt />
              <Row label="Seller" value={broker.seller_name || '-'} />
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
