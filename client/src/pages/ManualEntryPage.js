import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight, DollarSign, Building, Calculator } from 'lucide-react';

const ManualEntryPage = () => {
  const navigate = useNavigate();

  // Deal Info State
  const [dealName, setDealName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [units, setUnits] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [inPlaceNOI, setInPlaceNOI] = useState('');
  const [marketCapRate, setMarketCapRate] = useState('');

  // Rent Roll State
  const [rentRoll, setRentRoll] = useState([
    { type: 'Type 1', units: '', currentRent: '', marketRent: '', currentRentTotal: '', marketRentTotal: '', upside: '', notes: '' },
    { type: 'Type 2', units: '', currentRent: '', marketRent: '', currentRentTotal: '', marketRentTotal: '', upside: '', notes: '' }
  ]);

  // Income & Assumptions State
  const [otherIncome, setOtherIncome] = useState('');
  const [vacancyRate, setVacancyRate] = useState('5.0');
  const [concessions, setConcessions] = useState('0.0');
  const [badDebt, setBadDebt] = useState('0.0');

  // Operating Expenses State
  const [taxes, setTaxes] = useState('');
  const [insurance, setInsurance] = useState('');
  const [repairs, setRepairs] = useState('');
  const [utilities, setUtilities] = useState('');
  const [gas, setGas] = useState('');
  const [electrical, setElectrical] = useState('');
  const [payroll, setPayroll] = useState('');
  const [contractServices, setContractServices] = useState('');
  const [adminMarketing, setAdminMarketing] = useState('');
  const [managementFee, setManagementFee] = useState('');
  const [other, setOther] = useState('');

  // Financing State
  const [debtStructure, setDebtStructure] = useState('traditional');
  const [ltv, setLtv] = useState('75.0');
  const [interestRate, setInterestRate] = useState('6.50');
  const [amortization, setAmortization] = useState('30');
  const [term, setTerm] = useState('10');
  const [ioMonths, setIoMonths] = useState('0');

  // Seller Finance Fields
  const [sellerLtv, setSellerLtv] = useState('80.0');
  const [sellerRate, setSellerRate] = useState('6.0');
  const [sellerTerm, setSellerTerm] = useState('5');
  const [sellerAmortization, setSellerAmortization] = useState('20');

  // Subject To Fields
  const [existingLoanBalance, setExistingLoanBalance] = useState('');
  const [existingRate, setExistingRate] = useState('');
  const [remainingPayments, setRemainingPayments] = useState('');
  const [subjectToDownPayment, setSubjectToDownPayment] = useState('');

  // Equity Partner Fields
  const [partnerDownPaymentPct, setPartnerDownPaymentPct] = useState('100');
  const [partnerClosingCostsPct, setPartnerClosingCostsPct] = useState('100');
  const [yourEquityPct, setYourEquityPct] = useState('5');

  // Seller Carry Fields
  const [sellerCarryPct, setSellerCarryPct] = useState('15');
  const [sellerCarryRate, setSellerCarryRate] = useState('5.0');
  const [sellerCarryTermMonths, setSellerCarryTermMonths] = useState('60');
  const [sellerCarryIO, setSellerCarryIO] = useState(true);

  const addRentRow = () => {
    setRentRoll([...rentRoll, { type: '', units: '', currentRent: '', marketRent: '', currentRentTotal: '', marketRentTotal: '', upside: '', notes: '' }]);
  };

  const updateRentRow = (index, field, value) => {
    const updated = [...rentRoll];
    updated[index][field] = value;
    setRentRoll(updated);
  };

  const handleSubmit = () => {
    // Build the data structure to match your backend parser format
    const manualData = {
      property: {
        address: propertyAddress,
        city: city,
        state: state,
        units: parseInt(units) || 0
      },
      pricing_financing: {
        price: parseFloat(purchasePrice) || 0
      },
      pnl: {
        gross_potential_rent: rentRoll.reduce((sum, row) => sum + (parseFloat(row.currentRentTotal) || 0), 0) * 12,
        other_income: parseFloat(otherIncome) || 0,
        vacancy_rate: parseFloat(vacancyRate) / 100,
        noi: parseFloat(inPlaceNOI) || 0,
        operating_expenses: parseFloat(taxes) + parseFloat(insurance) + parseFloat(repairs) + parseFloat(utilities)
      },
      expenses: {
        taxes: parseFloat(taxes) || 0,
        insurance: parseFloat(insurance) || 0,
        repairs_maintenance: parseFloat(repairs) || 0,
        utilities: parseFloat(utilities) || 0,
        gas: parseFloat(gas) || 0,
        electric: parseFloat(electrical) || 0,
        payroll: parseFloat(payroll) || 0,
        contract_services: parseFloat(contractServices) || 0,
        marketing: parseFloat(adminMarketing) || 0,
        management: parseFloat(managementFee) || 0,
        other: parseFloat(other) || 0
      },
      unit_mix: rentRoll.map(row => ({
        type: row.type,
        units: parseInt(row.units) || 0,
        rent_current: parseFloat(row.currentRent) || 0,
        rent_market: parseFloat(row.marketRent) || 0
      })),
      deal_setup: {
        deal_name: dealName,
        property_address: propertyAddress,
        debt_structure: debtStructure
      },
      financing: buildFinancingObject()
    };

    // Navigate to results with manual data
    navigate('/underwrite/analysis', { state: { manualData } });
  };

  const buildFinancingObject = () => {
    const base = {
      ltv: parseFloat(ltv),
      interest_rate: parseFloat(interestRate) / 100,
      loan_term_years: parseInt(term),
      amortization_years: parseInt(amortization),
      io_years: parseInt(ioMonths) / 12,
      debt_structure: debtStructure
    };

    if (debtStructure === 'seller-finance') {
      return {
        ...base,
        ltv: parseFloat(sellerLtv),
        interest_rate: parseFloat(sellerRate) / 100,
        loan_term_years: parseInt(sellerTerm),
        amortization_years: parseInt(sellerAmortization)
      };
    }

    if (debtStructure === 'subject-to') {
      return {
        ...base,
        original_loan_amount: parseFloat(existingLoanBalance) || 0,
        interest_rate: parseFloat(existingRate) / 100,
        remaining_payments: parseInt(remainingPayments) || 0
      };
    }

    if (debtStructure === 'equity-partner') {
      return {
        ...base,
        partner_down_payment_pct: parseFloat(partnerDownPaymentPct),
        partner_closing_costs_pct: parseFloat(partnerClosingCostsPct),
        your_equity_pct: parseFloat(yourEquityPct)
      };
    }

    if (debtStructure === 'seller-carry') {
      return {
        ...base,
        seller_carry_pct: parseFloat(sellerCarryPct),
        seller_carry_rate: parseFloat(sellerCarryRate) / 100,
        seller_carry_term_months: parseInt(sellerCarryTermMonths),
        seller_carry_io: sellerCarryIO
      };
    }

    return base;
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#ffffff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '40px 20px'
    },
    container: {
      maxWidth: 1400,
      margin: '0 auto'
    },
    header: {
      marginBottom: 32
    },
    title: {
      fontSize: 36,
      fontWeight: 900,
      color: '#111827',
      marginBottom: 8,
      letterSpacing: '-1px'
    },
    subtitle: {
      fontSize: 16,
      color: '#6b7280'
    },
    section: {
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 32,
      marginBottom: 24
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: '#111827',
      marginBottom: 20,
      paddingBottom: 12,
      borderBottom: '2px solid #e5e7eb',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 600,
      color: '#6b7280',
      marginBottom: 6
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      fontSize: 14,
      background: '#ffffff',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      color: '#111827',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: '10px 14px',
      fontSize: 14,
      background: '#ffffff',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      color: '#111827',
      outline: 'none',
      cursor: 'pointer',
      boxSizing: 'border-box'
    },
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '14px 28px',
      background: '#10b981',
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'background 0.2s',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
    },
    backButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 20px',
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: 16
    },
    th: {
      background: '#f9fafb',
      color: '#6b7280',
      padding: '12px',
      textAlign: 'left',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '2px solid #e5e7eb'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #e5e7eb'
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button 
            onClick={() => navigate('/underwrite')}
            style={styles.backButton}
          >
            <Home size={16} /> Back to Upload
          </button>
        </div>

        <div style={styles.header}>
          <h1 style={styles.title}>Manual Deal Entry</h1>
          <p style={styles.subtitle}>Enter deal information manually when no OM is available</p>
        </div>

        {/* DEAL INFO Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>DEAL INFO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={styles.label}>Deal Name</label>
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                style={styles.input}
                placeholder="Property Name"
              />
            </div>
            <div>
              <label style={styles.label}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={styles.input}
                maxLength={2}
              />
            </div>
            <div>
              <label style={styles.label}>Units (Total)</label>
              <input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Property Address</label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={styles.label}>Purchase Price</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                style={styles.input}
                placeholder="0"
              />
            </div>
            <div>
              <label style={styles.label}>In-Place NOI (Annual)</label>
              <input
                type="number"
                value={inPlaceNOI}
                onChange={(e) => setInPlaceNOI(e.target.value)}
                style={styles.input}
                placeholder="0"
              />
            </div>
            <div>
              <label style={styles.label}>Market Cap Rate</label>
              <input
                type="text"
                value={marketCapRate}
                onChange={(e) => setMarketCapRate(e.target.value)}
                style={styles.input}
                placeholder="5.5%"
              />
            </div>
          </div>
        </div>

        {/* RENT ROLL Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>RENT ROLL / UNIT MIX (MONTHLY)</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Unit Type</th>
                <th style={styles.th}>Units</th>
                <th style={styles.th}>Current Rent/Unit</th>
                <th style={styles.th}>Market Rent/Unit</th>
                <th style={styles.th}>Current Rent</th>
                <th style={styles.th}>Market Rent</th>
                <th style={styles.th}>Upside/mo</th>
                <th style={styles.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rentRoll.map((row, index) => (
                <tr key={index}>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={row.type}
                      onChange={(e) => updateRentRow(index, 'type', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.units}
                      onChange={(e) => updateRentRow(index, 'units', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.currentRent}
                      onChange={(e) => updateRentRow(index, 'currentRent', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.marketRent}
                      onChange={(e) => updateRentRow(index, 'marketRent', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.currentRentTotal}
                      onChange={(e) => updateRentRow(index, 'currentRentTotal', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.marketRentTotal}
                      onChange={(e) => updateRentRow(index, 'marketRentTotal', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      value={row.upside}
                      onChange={(e) => updateRentRow(index, 'upside', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRentRow(index, 'notes', e.target.value)}
                      style={{ ...styles.input, padding: '8px 12px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addRentRow}
            style={{ ...styles.button, marginTop: 16, background: '#334155', boxShadow: 'none' }}
          >
            + Add Row
          </button>
        </div>

        {/* OTHER INCOME & ASSUMPTIONS Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>OTHER INCOME & ASSUMPTIONS (ANNUAL unless noted)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={styles.label}>Other Income ($/unit/mo)</label>
              <input
                type="number"
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Vacancy Rate</label>
              <input
                type="text"
                value={vacancyRate}
                onChange={(e) => setVacancyRate(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Concessions (% of GPR)</label>
              <input
                type="text"
                value={concessions}
                onChange={(e) => setConcessions(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Bad Debt (% of GPR)</label>
              <input
                type="text"
                value={badDebt}
                onChange={(e) => setBadDebt(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* OPERATING EXPENSES Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>OPERATING EXPENSES (ANNUAL)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={styles.label}>Taxes</label>
              <input
                type="number"
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Insurance</label>
              <input
                type="number"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Repairs & Maintenance</label>
              <input
                type="number"
                value={repairs}
                onChange={(e) => setRepairs(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Utilities - Water/Sewer/Trash</label>
              <input
                type="number"
                value={utilities}
                onChange={(e) => setUtilities(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Utilities - Gas/Electric</label>
              <input
                type="number"
                value={gas}
                onChange={(e) => setGas(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Payroll (if any)</label>
              <input
                type="number"
                value={payroll}
                onChange={(e) => setPayroll(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Contract Services</label>
              <input
                type="number"
                value={contractServices}
                onChange={(e) => setContractServices(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Admin/Marketing</label>
              <input
                type="number"
                value={adminMarketing}
                onChange={(e) => setAdminMarketing(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Management Fee</label>
              <input
                type="number"
                value={managementFee}
                onChange={(e) => setManagementFee(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Other</label>
              <input
                type="number"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* FINANCING Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>FINANCING (PRIMARY DEBT)</div>
          
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Debt Structure</label>
            <select
              value={debtStructure}
              onChange={(e) => setDebtStructure(e.target.value)}
              style={styles.select}
            >
              <option value="traditional">Traditional (Freddie/Fannie, Bank Loan)</option>
              <option value="seller-finance">Seller Finance</option>
              <option value="subject-to">Subject To</option>
              <option value="hybrid">Hybrid (Subject To + Traditional/Seller Finance)</option>
              <option value="equity-partner">Equity Partner</option>
              <option value="seller-carry">Seller Carry</option>
            </select>
          </div>

          {/* Traditional / Seller Carry / Equity Partner / Hybrid */}
          {(debtStructure === 'traditional' || debtStructure === 'seller-carry' || debtStructure === 'equity-partner' || debtStructure === 'hybrid') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={styles.label}>Loan-to-Value (LTV)</label>
                <input
                  type="text"
                  value={ltv}
                  onChange={(e) => setLtv(e.target.value)}
                  style={styles.input}
                  placeholder="75.0%"
                />
              </div>
              <div>
                <label style={styles.label}>Interest Rate</label>
                <input
                  type="text"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  style={styles.input}
                  placeholder="6.50%"
                />
              </div>
              <div>
                <label style={styles.label}>Amortization (Years)</label>
                <input
                  type="number"
                  value={amortization}
                  onChange={(e) => setAmortization(e.target.value)}
                  style={styles.input}
                  placeholder="30"
                />
              </div>
              <div>
                <label style={styles.label}>Term (Years)</label>
                <input
                  type="number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  style={styles.input}
                  placeholder="10"
                />
              </div>
              <div>
                <label style={styles.label}>Interest-Only Period (Months)</label>
                <input
                  type="number"
                  value={ioMonths}
                  onChange={(e) => setIoMonths(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Seller Finance */}
          {debtStructure === 'seller-finance' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={styles.label}>Seller LTV</label>
                <input
                  type="text"
                  value={sellerLtv}
                  onChange={(e) => setSellerLtv(e.target.value)}
                  style={styles.input}
                  placeholder="80.0%"
                />
              </div>
              <div>
                <label style={styles.label}>Seller Interest Rate</label>
                <input
                  type="text"
                  value={sellerRate}
                  onChange={(e) => setSellerRate(e.target.value)}
                  style={styles.input}
                  placeholder="6.0%"
                />
              </div>
              <div>
                <label style={styles.label}>Seller Term (Years)</label>
                <input
                  type="number"
                  value={sellerTerm}
                  onChange={(e) => setSellerTerm(e.target.value)}
                  style={styles.input}
                  placeholder="5"
                />
              </div>
              <div>
                <label style={styles.label}>Seller Amortization (Years)</label>
                <input
                  type="number"
                  value={sellerAmortization}
                  onChange={(e) => setSellerAmortization(e.target.value)}
                  style={styles.input}
                  placeholder="20"
                />
              </div>
            </div>
          )}

          {/* Subject To */}
          {(debtStructure === 'subject-to' || debtStructure === 'hybrid') && (
            <div style={{ marginTop: 20, padding: 20, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Subject To Existing Loan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={styles.label}>Existing Loan Balance</label>
                  <input
                    type="number"
                    value={existingLoanBalance}
                    onChange={(e) => setExistingLoanBalance(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.label}>Existing Interest Rate</label>
                  <input
                    type="text"
                    value={existingRate}
                    onChange={(e) => setExistingRate(e.target.value)}
                    style={styles.input}
                    placeholder="4.5%"
                  />
                </div>
                <div>
                  <label style={styles.label}>Remaining Payments</label>
                  <input
                    type="number"
                    value={remainingPayments}
                    onChange={(e) => setRemainingPayments(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.label}>Down Payment Amount</label>
                  <input
                    type="number"
                    value={subjectToDownPayment}
                    onChange={(e) => setSubjectToDownPayment(e.target.value)}
                    style={styles.input}
                    placeholder="$0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Equity Partner */}
          {debtStructure === 'equity-partner' && (
            <div style={{ marginTop: 20, padding: 20, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Equity Partner Structure</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={styles.label}>Partner Covers Down Payment (%)</label>
                  <input
                    type="text"
                    value={partnerDownPaymentPct}
                    onChange={(e) => setPartnerDownPaymentPct(e.target.value)}
                    style={styles.input}
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label style={styles.label}>Partner Covers Closing Costs (%)</label>
                  <input
                    type="text"
                    value={partnerClosingCostsPct}
                    onChange={(e) => setPartnerClosingCostsPct(e.target.value)}
                    style={styles.input}
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label style={styles.label}>Your Equity Contribution (%)</label>
                  <input
                    type="text"
                    value={yourEquityPct}
                    onChange={(e) => setYourEquityPct(e.target.value)}
                    style={styles.input}
                    placeholder="5%"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Seller Carry */}
          {debtStructure === 'seller-carry' && (
            <div style={{ marginTop: 20, padding: 20, background: '#f9fafb', borderRadius: 12, border: '1px solid #334155' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Seller Carry (2nd Position)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={styles.label}>Seller Carry % of Price</label>
                  <input
                    type="text"
                    value={sellerCarryPct}
                    onChange={(e) => setSellerCarryPct(e.target.value)}
                    style={styles.input}
                    placeholder="15%"
                  />
                </div>
                <div>
                  <label style={styles.label}>Seller Carry Rate</label>
                  <input
                    type="text"
                    value={sellerCarryRate}
                    onChange={(e) => setSellerCarryRate(e.target.value)}
                    style={styles.input}
                    placeholder="5.0%"
                  />
                </div>
                <div>
                  <label style={styles.label}>Seller Carry Term (Months)</label>
                  <input
                    type="number"
                    value={sellerCarryTermMonths}
                    onChange={(e) => setSellerCarryTermMonths(e.target.value)}
                    style={styles.input}
                    placeholder="60"
                  />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={sellerCarryIO}
                    onChange={(e) => setSellerCarryIO(e.target.checked)}
                  />
                  Interest-Only Seller Carry
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <button
            onClick={() => navigate('/upload')}
            style={styles.backButton}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={styles.button}
          >
            <Calculator size={18} />
            Analyze Deal
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualEntryPage;
