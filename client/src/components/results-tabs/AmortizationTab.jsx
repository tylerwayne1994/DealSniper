import React from 'react';

export default function AmortizationTab({ scenarioData, fullCalcs }) {
  // Handle null/undefined scenarioData
  if (!scenarioData) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No scenario data available. Please load or create a deal first.</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract pricing and financing data
  const pricing_financing = scenarioData?.pricing_financing || {};
  const property = scenarioData?.property || {};
  
  // Calculate loan amount from price and down payment if not available
  const amortPrice = pricing_financing?.price || pricing_financing?.purchase_price || property?.purchase_price || 0;
  const amortDownPct = pricing_financing?.down_payment_pct || 0;
  const amortLtv = pricing_financing?.ltv || 0;
  let loanAmount = fullCalcs?.financing?.loanAmount || scenarioData.pricing_financing?.loan_amount || 0;
  if (!loanAmount && amortPrice > 0) {
    if (amortDownPct > 0) {
      loanAmount = amortPrice * (1 - amortDownPct / 100);
    } else if (amortLtv > 0) {
      loanAmount = amortPrice * (amortLtv / 100);
    }
  }
  
  // Get interest rate - check multiple sources
  let interestRate = pricing_financing?.interest_rate || 0;
  if (!interestRate || interestRate === 0) {
    const financeRate = scenarioData.financing?.interest_rate || 0;
    if (financeRate > 0) {
      interestRate = financeRate > 1 ? financeRate / 100 : financeRate;
    }
  }
  if (!interestRate || interestRate === 0) {
    interestRate = 0.06; // Default 6%
  }
  
  // Get loan term
  const loanTerm = pricing_financing?.term_years || pricing_financing?.amortization_years || scenarioData.financing?.loan_term_years || 30;
  const amortizationYears = pricing_financing?.amortization_years || scenarioData.financing?.amortization_years || loanTerm;
  
  // Calculate monthly and annual debt service
  let monthlyDebtService = pricing_financing?.monthly_payment || fullCalcs?.financing?.monthlyPayment || 0;
  let amortAnnualDebtService = pricing_financing?.annual_debt_service || fullCalcs?.financing?.annualDebtService || 0;
  
  if ((!monthlyDebtService || monthlyDebtService === 0) && loanAmount > 0 && interestRate > 0 && amortizationYears > 0) {
    const monthlyRate = interestRate / 12;
    const numPayments = amortizationYears * 12;
    monthlyDebtService = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
    amortAnnualDebtService = monthlyDebtService * 12;
  }
  
  // Loan constant and spread vs cap rate
  const loanConstant = (loanAmount > 0 && amortAnnualDebtService > 0) ? (amortAnnualDebtService / loanAmount) : null;
  const capRate = fullCalcs?.year1?.capRate || 0;
  const capRateDecimal = capRate != null ? (capRate > 1 ? capRate / 100 : capRate) : null;
  const spreadCapMinusConstant = (capRateDecimal != null && loanConstant != null) ? (capRateDecimal - loanConstant) : null;
  const leverageStatus = spreadCapMinusConstant != null ? (spreadCapMinusConstant >= 0 ? 'Positive Leverage' : 'Negative Leverage') : '—';

  // Generate amortization schedule
  let amortSchedule = fullCalcs?.amortizationSchedule || [];
  if (amortSchedule.length === 0 && loanAmount > 0 && interestRate > 0 && amortizationYears > 0) {
    const monthlyRate = interestRate / 12;
    const numPayments = amortizationYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -numPayments)));
    
    let balance = loanAmount;
    let cumulativePrincipal = 0;
    
    for (let year = 1; year <= Math.min(amortizationYears, loanTerm); year++) {
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      
      for (let month = 1; month <= 12; month++) {
        if (balance <= 0) break;
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
        yearlyPrincipal += principalPayment;
        yearlyInterest += interestPayment;
        balance -= principalPayment;
      }
      
      cumulativePrincipal += yearlyPrincipal;
      
      amortSchedule.push({
        year,
        payment: Math.round(yearlyPrincipal + yearlyInterest),
        principal: Math.round(yearlyPrincipal),
        interest: Math.round(yearlyInterest),
        balance: Math.round(Math.max(0, balance)),
        cumulativePrincipal: Math.round(cumulativePrincipal)
      });
    }
  }

  const cardStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '16px 18px',
    boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
  };

  const labelStyle = {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '6px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '999px', 
            backgroundColor: '#e5e7eb', 
            color: '#111827', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 700, 
            fontSize: '14px',
            marginRight: '12px'
          }}>9</div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Loan Amortization Schedule
          </h2>
        </div>

        {/* Loan Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={cardStyle}>
            <div style={labelStyle}>Loan Amount</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              ${loanAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </div>
          </div>
          
          <div style={cardStyle}>
            <div style={labelStyle}>Interest Rate</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              {(interestRate * 100).toFixed(2)}%
            </div>
          </div>
          
          <div style={cardStyle}>
            <div style={labelStyle}>Loan Term</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              {loanTerm} Years
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Monthly Debt Service</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              ${monthlyDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Annual Debt Service</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              ${amortAnnualDebtService.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Cap Rate</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              {capRateDecimal != null ? (capRateDecimal * 100).toFixed(2) + '%' : '—'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Loan Constant</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
              {loanConstant != null ? (loanConstant * 100).toFixed(2) + '%' : '—'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>Spread (Cap - Constant)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: spreadCapMinusConstant != null ? (spreadCapMinusConstant >= 0 ? '#16a34a' : '#dc2626') : '#111827' }}>
              {spreadCapMinusConstant != null ? (spreadCapMinusConstant * 100).toFixed(2) + '%' : '—'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {leverageStatus}
            </div>
          </div>
        </div>

        {/* Leverage Explanation */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px 18px', marginBottom: '24px', boxShadow: '0 10px 30px rgba(15,23,42,0.04)' }}>
          <div style={{ fontSize: '13px', color: '#374151' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Cap rate vs loan constant</div>
            <div style={{ marginBottom: 6 }}>
              Cap rate {capRateDecimal != null ? ((capRateDecimal * 100).toFixed(2) + '%') : ''} vs loan constant {loanConstant != null ? ((loanConstant * 100).toFixed(2) + '%') : ''} → {leverageStatus}.
            </div>
            <div style={{ color: '#111827' }}>
              Cap rate greater than loan constant means positive leverage. The property yield exceeds the cost of debt, so borrowing helps cash flow.
            </div>
            <div style={{ marginTop: 4, color: '#111827' }}>
              Cap rate less than loan constant means negative leverage. The debt costs more than the property yields, hurting cash flow.
            </div>
          </div>
        </div>
      
        {amortSchedule && amortSchedule.length > 0 ? (
          <div style={{ 
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            boxShadow: '0 10px 30px rgba(15,23,42,0.04)'
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e7eb', 
              backgroundColor: '#f9fafb'
            }}>
              <h4 style={{ 
                margin: 0, 
                fontSize: '13px', 
                fontWeight: 700, 
                color: '#111827', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em' 
              }}>Year-by-Year Breakdown</h4>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Year</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Total Payment</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Principal</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Interest</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Remaining Balance</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #d1d5db' }}>Cumulative Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {amortSchedule.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s', backgroundColor: 'white' }} 
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} 
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>Year {row.year}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151' }}>${row.payment.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#10b981' }}>${row.principal.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>${row.interest.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#111827' }}>${row.balance.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>${row.cumulativePrincipal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No amortization schedule available (interest-only loan or no loan)</p>
          </div>
        )}
      </div>
    </div>
  );
}
