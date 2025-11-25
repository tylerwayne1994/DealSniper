import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    padding: '0',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  innerContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '60px 40px'
  },
  header: {
    marginBottom: '48px',
    textAlign: 'center'
  },
  title: {
    fontSize: '56px',
    fontWeight: '800',
    color: '#000000',
    marginBottom: '12px',
    letterSpacing: '-2px'
  },
  subtitle: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '0',
    lineHeight: '1.6',
    fontWeight: '400'
  },
  progressBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '56px',
    overflowX: 'auto',
    backgroundColor: 'transparent',
    padding: '0'
  },
  progressStep: {
    flex: '1',
    minWidth: '110px',
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fontSize: '14px',
    fontWeight: '700',
    color: '#999',
    border: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    position: 'relative'
  },
  progressStepActive: {
    backgroundColor: '#000000',
    color: '#ffffff',
    transform: 'scale(1.05)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    zIndex: 10
  },
  progressStepCompleted: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  },
  card: {
    backgroundColor: '#ffffff',
    border: 'none',
    borderRadius: '24px',
    padding: '48px',
    marginBottom: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#000000',
    marginBottom: '32px',
    paddingBottom: '0',
    borderBottom: 'none',
    letterSpacing: '-0.5px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '24px'
  },
  formGroup: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    color: '#000000',
    marginBottom: '10px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e8e8e8',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#000000',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    fontWeight: '500'
  },
  inputFocus: {
    outline: 'none',
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    boxShadow: '0 0 0 4px rgba(0, 0, 0, 0.05)'
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e8e8e8',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#000000',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    cursor: 'pointer',
    fontWeight: '500'
  },
  checkbox: {
    marginRight: '10px',
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    color: '#1a1a1a',
    cursor: 'pointer',
    fontWeight: '500',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    border: '2px solid #e0e0e0',
    transition: 'all 0.2s'
  },
  buttonGroup: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'space-between',
    marginTop: '40px',
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  },
  button: {
    padding: '16px 40px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'inherit',
    letterSpacing: '0.3px'
  },
  buttonPrimary: {
    backgroundColor: '#000000',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
  },
  buttonPrimaryHover: {
    backgroundColor: '#1a1a1a',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
    color: '#000000',
    border: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  helperText: {
    fontSize: '12px',
    color: '#888',
    marginTop: '6px',
    fontStyle: 'italic'
  },
  autoFilledBadge: {
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    padding: '4px 10px',
    borderRadius: '6px',
    marginLeft: '10px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  unitCard: {
    backgroundColor: '#fafafa',
    border: '2px solid #e8e8e8',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    transition: 'all 0.3s',
    position: 'relative'
  },
  unitCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #e8e8e8'
  },
  removeButton: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.3px'
  },
  addButton: {
    backgroundColor: '#000000',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 28px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    letterSpacing: '0.3px'
  },
  summaryBox: {
    marginTop: '32px',
    padding: '32px',
    backgroundColor: '#000000',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: '800',
    marginBottom: '24px',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '24px'
  },
  summaryItem: {
    borderLeft: '4px solid #10b981',
    paddingLeft: '16px'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '8px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-1px'
  },
  emptyState: {
    padding: '80px 40px',
    textAlign: 'center',
    backgroundColor: '#fafafa',
    borderRadius: '20px',
    border: '3px dashed #d0d0d0'
  },
  emptyStateText: {
    color: '#666',
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '24px'
  }
};

function DealWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const ocrData = location.state?.ocrData || {};

  const [currentStep, setCurrentStep] = useState(0);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());
  const [formData, setFormData] = useState({
    // Property Info
    property_name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    property_type: 'multifamily',
    year_built: '',
    total_units: '',
    total_pads: '',
    lot_size_acres: '',
    building_sqft: '',
    
    // Unit Mix
    unit_mix: [], // Array of {unit_type, count, current_rent, market_rent}
    
    // Purchase & Financing
    asking_price: '',
    offer_price: '',
    down_payment_percent: '25',
    seller_financing_offered: false,
    seller_finance_amount: '',
    seller_finance_rate: '',
    seller_finance_term_years: '',
    seller_finance_amortization_years: '',
    seller_balloon_years: '',
    loan_assumption_available: false,
    assumption_loan_balance: '',
    assumption_interest_rate: '',
    assumption_term_remaining_years: '',
    bank_financing_amount: '',
    bank_interest_rate: '',
    bank_term_years: '',
    bank_amortization_years: '',
    
    // Closing Costs
    realtor_commission_percent: '',
    realtor_commission_amount: '',
    closing_costs: '',
    title_insurance: '',
    inspection_costs: '',
    appraisal_fee: '',
    other_closing_costs: '',
    
    // Income
    gross_monthly_income: '',
    gross_annual_income: '',
    other_income_monthly: '',
    other_income_description: '',
    laundry_income_monthly: '',
    parking_income_monthly: '',
    storage_income_monthly: '',
    pet_fees_monthly: '',
    
    // Occupancy & Vacancy
    current_occupancy_percent: '',
    vacancy_rate_percent: '5',
    economic_vacancy_percent: '',
    
    // Operating Expenses (Monthly)
    property_taxes_monthly: '',
    insurance_monthly: '',
    utilities_paid_by: 'tenant',
    water_sewer_monthly: '',
    electricity_monthly: '',
    gas_monthly: '',
    trash_monthly: '',
    lawn_care_monthly: '',
    snow_removal_monthly: '',
    pest_control_monthly: '',
    hoa_fees_monthly: '',
    
    // Management & Maintenance
    management_fee_percent: '10',
    management_fee_monthly: '',
    advertising_marketing_monthly: '',
    repairs_maintenance_monthly: '',
    capital_expenditures_monthly: '',
    capex_percent_of_income: '5',
    
    // Additional Expenses
    accounting_legal_monthly: '',
    licenses_permits_monthly: '',
    other_expenses_monthly: '',
    other_expenses_description: '',
    
    // Agent Info
    agent_name: '',
    agent_phone: '',
    agent_email: '',
    agent_brokerage: ''
  });

  // Auto-fill form data on mount
  useEffect(() => {
    console.log('\n' + '='.repeat(60));
    console.log('🧙 WIZARD PAGE LOADED');
    console.log('='.repeat(60));
    console.log('📊 OCR Data received:', JSON.stringify(ocrData, null, 2));
    console.log('='.repeat(60) + '\n');

    const extractedFields = ocrData?.parsed_data?.extracted_fields || {};
    const propertyInfo = extractedFields.property_info || {};
    const financials = extractedFields.financials || {};
    
    console.log('🔧 Auto-filling form with extracted data...');
    console.log('   Property Info:', propertyInfo);
    console.log('   Financials:', financials);
    
    const filledFields = new Set();
    const updates = {};
    
    // Auto-fill from extracted data
    if (financials.asking_price) {
      updates.asking_price = financials.asking_price;
      filledFields.add('asking_price');
      console.log('   ✅ Auto-filled: asking_price = $' + financials.asking_price);
    }
    
    if (financials.gross_income) {
      updates.gross_annual_income = financials.gross_income;
      filledFields.add('gross_annual_income');
      console.log('   ✅ Auto-filled: gross_annual_income = $' + financials.gross_income);
    }
    
    if (financials.noi) {
      updates.noi = financials.noi;
      console.log('   ✅ Auto-filled: noi = $' + financials.noi);
    }
    
    if (financials.cap_rate) {
      updates.cap_rate = financials.cap_rate;
      console.log('   ✅ Auto-filled: cap_rate = ' + financials.cap_rate + '%');
    }
    
    if (propertyInfo.units) {
      updates.total_units = propertyInfo.units;
      filledFields.add('total_units');
      console.log('   ✅ Auto-filled: total_units = ' + propertyInfo.units);
    }
    
    // Auto-fill unit mix data
    if (extractedFields.unit_mix && Array.isArray(extractedFields.unit_mix) && extractedFields.unit_mix.length > 0) {
      updates.unit_mix = extractedFields.unit_mix.map(unit => ({
        unit_type: unit.unit_type || '',
        count: unit.count || '',
        current_rent: unit.current_rent || '',
        market_rent: unit.market_rent || ''
      }));
      filledFields.add('unit_mix');
      console.log('   ✅ Auto-filled: unit_mix = ' + extractedFields.unit_mix.length + ' unit types');
      extractedFields.unit_mix.forEach(unit => {
        console.log('      - ' + unit.unit_type + ': ' + unit.count + ' units @ $' + unit.current_rent);
      });
    }
    
    console.log(`   📊 Auto-filled ${filledFields.size} fields from OCR data\n`);
    
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
    setAutoFilledFields(filledFields);
  }, []); // Empty dependency array - run once on mount

  const steps = [
    { id: 'property', label: 'Property Info' },
    { id: 'unit_mix', label: 'Unit Mix' },
    { id: 'financing', label: 'Purchase & Financing' },
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'management', label: 'Management' },
    { id: 'agent', label: 'Agent Info' },
    { id: 'review', label: 'Review' }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    console.log('Submitting deal:', formData);
    // TODO: Send to backend to create deal
    alert('Deal submitted! Will integrate with backend next.');
  };

  const handleAddUnit = () => {
    setFormData(prev => ({
      ...prev,
      unit_mix: [...prev.unit_mix, { unit_type: '', count: '', current_rent: '', market_rent: '' }]
    }));
  };

  const handleRemoveUnit = (index) => {
    setFormData(prev => ({
      ...prev,
      unit_mix: prev.unit_mix.filter((_, i) => i !== index)
    }));
  };

  const handleUnitChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      unit_mix: prev.unit_mix.map((unit, i) => 
        i === index ? { ...unit, [field]: value } : unit
      )
    }));
  };

  const renderPropertyInfo = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Property Information</h2>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Property Name *
          </label>
          <input
            type="text"
            style={styles.input}
            value={formData.property_name}
            onChange={(e) => handleChange('property_name', e.target.value)}
            placeholder="Green Valley Apartments"
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Property Type</label>
          <select
            style={styles.select}
            value={formData.property_type}
            onChange={(e) => handleChange('property_type', e.target.value)}
          >
            <option value="multifamily">Multifamily</option>
            <option value="rv_park">RV Park</option>
            <option value="mobile_home_park">Mobile Home Park</option>
            <option value="mixed_use">Mixed Use</option>
          </select>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Address</label>
        <input
          type="text"
          style={styles.input}
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="123 Main Street"
        />
      </div>

      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>City</label>
          <input
            type="text"
            style={styles.input}
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>State</label>
          <input
            type="text"
            style={styles.input}
            value={formData.state}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder="TX"
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>ZIP Code</label>
          <input
            type="text"
            style={styles.input}
            value={formData.zip}
            onChange={(e) => handleChange('zip', e.target.value)}
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Year Built</label>
          <input
            type="number"
            style={styles.input}
            value={formData.year_built}
            onChange={(e) => handleChange('year_built', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Total Units
            {autoFilledFields.has('total_units') && <span style={styles.autoFilledBadge}>Auto-filled</span>}
          </label>
          <input
            type="number"
            style={styles.input}
            value={formData.total_units}
            onChange={(e) => handleChange('total_units', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Building Sq Ft</label>
          <input
            type="number"
            style={styles.input}
            value={formData.building_sqft}
            onChange={(e) => handleChange('building_sqft', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderUnitMix = () => (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={styles.sectionTitle}>
            Unit Mix & Rent Roll
            {autoFilledFields.has('unit_mix') && <span style={styles.autoFilledBadge}>Auto-filled</span>}
          </h2>
          <p style={{ color: '#666', fontSize: '15px', margin: 0 }}>
            Define your property's unit composition and rental income structure
          </p>
        </div>
        <button
          onClick={handleAddUnit}
          style={styles.addButton}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
        >
          + Add Unit Type
        </button>
      </div>

      {formData.unit_mix.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
          <p style={styles.emptyStateText}>
            No unit types defined yet
          </p>
          <button
            onClick={handleAddUnit}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            Add Your First Unit Type
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {formData.unit_mix.map((unit, index) => (
            <div key={index} style={styles.unitCard}>
              <div style={styles.unitCardHeader}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px' }}>
                  Unit Type #{index + 1}
                </h3>
                <button
                  onClick={() => handleRemoveUnit(index)}
                  style={styles.removeButton}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                >
                  ✕ Remove
                </button>
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Unit Type</label>
                  <select
                    style={styles.select}
                    value={unit.unit_type}
                    onChange={(e) => handleUnitChange(index, 'unit_type', e.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="Studio">Studio</option>
                    <option value="1BR">1 Bedroom</option>
                    <option value="2BR">2 Bedroom</option>
                    <option value="3BR">3 Bedroom</option>
                    <option value="4BR">4 Bedroom</option>
                    <option value="5BR+">5+ Bedroom</option>
                    <option value="RV Space">RV Space</option>
                    <option value="Mobile Home">Mobile Home</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Units</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={unit.count}
                    onChange={(e) => handleUnitChange(index, 'count', e.target.value)}
                    placeholder="10"
                    min="0"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Rent</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '14px', fontSize: '15px', fontWeight: '700', color: '#666' }}>$</span>
                    <input
                      type="number"
                      style={{ ...styles.input, paddingLeft: '32px' }}
                      value={unit.current_rent}
                      onChange={(e) => handleUnitChange(index, 'current_rent', e.target.value)}
                      placeholder="1200"
                      min="0"
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Market Rent</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '14px', fontSize: '15px', fontWeight: '700', color: '#10b981' }}>$</span>
                    <input
                      type="number"
                      style={{ ...styles.input, paddingLeft: '32px', borderColor: '#10b981' }}
                      value={unit.market_rent}
                      onChange={(e) => handleUnitChange(index, 'market_rent', e.target.value)}
                      placeholder="1350"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formData.unit_mix.length > 0 && (
        <div style={styles.summaryBox}>
          <h4 style={styles.summaryTitle}>Portfolio Summary</h4>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}>
              <p style={styles.summaryLabel}>Total Units</p>
              <p style={styles.summaryValue}>
                {formData.unit_mix.reduce((sum, unit) => sum + (parseInt(unit.count) || 0), 0)}
              </p>
            </div>
            <div style={styles.summaryItem}>
              <p style={styles.summaryLabel}>Current Monthly</p>
              <p style={styles.summaryValue}>
                ${formData.unit_mix.reduce((sum, unit) => {
                  const count = parseInt(unit.count) || 0;
                  const rent = parseInt(unit.current_rent) || 0;
                  return sum + (count * rent);
                }, 0).toLocaleString()}
              </p>
            </div>
            <div style={{ ...styles.summaryItem, borderLeftColor: '#10b981' }}>
              <p style={styles.summaryLabel}>Proforma Monthly</p>
              <p style={{ ...styles.summaryValue, color: '#10b981' }}>
                ${formData.unit_mix.reduce((sum, unit) => {
                  const count = parseInt(unit.count) || 0;
                  const rent = parseInt(unit.market_rent || unit.current_rent) || 0;
                  return sum + (count * rent);
                }, 0).toLocaleString()}
              </p>
            </div>
            <div style={{ ...styles.summaryItem, borderLeftColor: '#fbbf24' }}>
              <p style={styles.summaryLabel}>Monthly Upside</p>
              <p style={{ ...styles.summaryValue, color: '#fbbf24', fontSize: '28px' }}>
                +${formData.unit_mix.reduce((sum, unit) => {
                  const count = parseInt(unit.count) || 0;
                  const current = parseInt(unit.current_rent) || 0;
                  const market = parseInt(unit.market_rent) || current;
                  return sum + (count * (market - current));
                }, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFinancing = () => (
    <>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Purchase Price</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Asking Price *
              {autoFilledFields.has('asking_price') && <span style={styles.autoFilledBadge}>Auto-filled</span>}
            </label>
            <input
              type="number"
              style={styles.input}
              value={formData.asking_price}
              onChange={(e) => handleChange('asking_price', e.target.value)}
              placeholder="5000000"
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Your Offer Price</label>
            <input
              type="number"
              style={styles.input}
              value={formData.offer_price}
              onChange={(e) => handleChange('offer_price', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Down Payment %</label>
            <input
              type="number"
              style={styles.input}
              value={formData.down_payment_percent}
              onChange={(e) => handleChange('down_payment_percent', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Seller Financing</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={formData.seller_financing_offered}
              onChange={(e) => handleChange('seller_financing_offered', e.target.checked)}
            />
            Seller Financing Offered
          </label>
        </div>

        {formData.seller_financing_offered && (
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Seller Finance Amount</label>
              <input
                type="number"
                style={styles.input}
                value={formData.seller_finance_amount}
                onChange={(e) => handleChange('seller_finance_amount', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Interest Rate %</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={formData.seller_finance_rate}
                onChange={(e) => handleChange('seller_finance_rate', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Term (Years)</label>
              <input
                type="number"
                style={styles.input}
                value={formData.seller_finance_term_years}
                onChange={(e) => handleChange('seller_finance_term_years', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Amortization (Years)</label>
              <input
                type="number"
                style={styles.input}
                value={formData.seller_finance_amortization_years}
                onChange={(e) => handleChange('seller_finance_amortization_years', e.target.value)}
              />
              <div style={styles.helperText}>Leave blank for interest-only</div>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Balloon Payment (Years)</label>
              <input
                type="number"
                style={styles.input}
                value={formData.seller_balloon_years}
                onChange={(e) => handleChange('seller_balloon_years', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Loan Assumption</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={formData.loan_assumption_available}
              onChange={(e) => handleChange('loan_assumption_available', e.target.checked)}
            />
            Loan Assumption Available
          </label>
        </div>

        {formData.loan_assumption_available && (
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Loan Balance</label>
              <input
                type="number"
                style={styles.input}
                value={formData.assumption_loan_balance}
                onChange={(e) => handleChange('assumption_loan_balance', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Interest Rate %</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={formData.assumption_interest_rate}
                onChange={(e) => handleChange('assumption_interest_rate', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Term Remaining (Years)</label>
              <input
                type="number"
                style={styles.input}
                value={formData.assumption_term_remaining_years}
                onChange={(e) => handleChange('assumption_term_remaining_years', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Bank Financing</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Loan Amount</label>
            <input
              type="number"
              style={styles.input}
              value={formData.bank_financing_amount}
              onChange={(e) => handleChange('bank_financing_amount', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Interest Rate %</label>
            <input
              type="number"
              step="0.1"
              style={styles.input}
              value={formData.bank_interest_rate}
              onChange={(e) => handleChange('bank_interest_rate', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Term (Years)</label>
            <input
              type="number"
              style={styles.input}
              value={formData.bank_term_years}
              onChange={(e) => handleChange('bank_term_years', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Amortization (Years)</label>
            <input
              type="number"
              style={styles.input}
              value={formData.bank_amortization_years}
              onChange={(e) => handleChange('bank_amortization_years', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Closing Costs</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Realtor Commission %</label>
            <input
              type="number"
              step="0.1"
              style={styles.input}
              value={formData.realtor_commission_percent}
              onChange={(e) => handleChange('realtor_commission_percent', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Realtor Commission $</label>
            <input
              type="number"
              style={styles.input}
              value={formData.realtor_commission_amount}
              onChange={(e) => handleChange('realtor_commission_amount', e.target.value)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Title Insurance</label>
            <input
              type="number"
              style={styles.input}
              value={formData.title_insurance}
              onChange={(e) => handleChange('title_insurance', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Inspection Costs</label>
            <input
              type="number"
              style={styles.input}
              value={formData.inspection_costs}
              onChange={(e) => handleChange('inspection_costs', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Appraisal Fee</label>
            <input
              type="number"
              style={styles.input}
              value={formData.appraisal_fee}
              onChange={(e) => handleChange('appraisal_fee', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Other Closing Costs</label>
            <input
              type="number"
              style={styles.input}
              value={formData.other_closing_costs}
              onChange={(e) => handleChange('other_closing_costs', e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  );

  const renderIncome = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Income & Occupancy</h2>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Gross Monthly Rent Income
            {autoFilledFields.has('gross_monthly_income') && <span style={styles.autoFilledBadge}>Auto-filled</span>}
          </label>
          <input
            type="number"
            style={styles.input}
            value={formData.gross_monthly_income}
            onChange={(e) => handleChange('gross_monthly_income', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Gross Annual Income
            {autoFilledFields.has('gross_annual_income') && <span style={styles.autoFilledBadge}>Auto-filled</span>}
          </label>
          <input
            type="number"
            style={styles.input}
            value={formData.gross_annual_income}
            onChange={(e) => handleChange('gross_annual_income', e.target.value)}
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Current Occupancy %</label>
          <input
            type="number"
            step="0.1"
            style={styles.input}
            value={formData.current_occupancy_percent}
            onChange={(e) => handleChange('current_occupancy_percent', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Vacancy Rate %</label>
          <input
            type="number"
            step="0.1"
            style={styles.input}
            value={formData.vacancy_rate_percent}
            onChange={(e) => handleChange('vacancy_rate_percent', e.target.value)}
          />
          <div style={styles.helperText}>Typical: 5-10%</div>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Economic Vacancy %</label>
          <input
            type="number"
            step="0.1"
            style={styles.input}
            value={formData.economic_vacancy_percent}
            onChange={(e) => handleChange('economic_vacancy_percent', e.target.value)}
          />
          <div style={styles.helperText}>Includes concessions</div>
        </div>
      </div>

      <h3 style={{...styles.sectionTitle, fontSize: '18px', marginTop: '32px'}}>Other Income</h3>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Laundry Income / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.laundry_income_monthly}
            onChange={(e) => handleChange('laundry_income_monthly', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Parking Income / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.parking_income_monthly}
            onChange={(e) => handleChange('parking_income_monthly', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Storage Income / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.storage_income_monthly}
            onChange={(e) => handleChange('storage_income_monthly', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Pet Fees / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.pet_fees_monthly}
            onChange={(e) => handleChange('pet_fees_monthly', e.target.value)}
          />
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Other Monthly Income</label>
        <input
          type="number"
          style={styles.input}
          value={formData.other_income_monthly}
          onChange={(e) => handleChange('other_income_monthly', e.target.value)}
        />
      </div>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>Other Income Description</label>
        <input
          type="text"
          style={styles.input}
          value={formData.other_income_description}
          onChange={(e) => handleChange('other_income_description', e.target.value)}
          placeholder="Vending machines, late fees, etc."
        />
      </div>
    </div>
  );

  const renderExpenses = () => (
    <>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Fixed Expenses (Monthly)</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Property Taxes / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.property_taxes_monthly}
              onChange={(e) => handleChange('property_taxes_monthly', e.target.value)}
            />
            <div style={styles.helperText}>Annual taxes ÷ 12</div>
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Insurance / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.insurance_monthly}
              onChange={(e) => handleChange('insurance_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>HOA Fees / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.hoa_fees_monthly}
              onChange={(e) => handleChange('hoa_fees_monthly', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Utilities</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Utilities Paid By</label>
          <select
            style={styles.select}
            value={formData.utilities_paid_by}
            onChange={(e) => handleChange('utilities_paid_by', e.target.value)}
          >
            <option value="tenant">Tenant Pays All</option>
            <option value="owner">Owner Pays All</option>
            <option value="split">Split (Enter amounts below)</option>
          </select>
        </div>

        {formData.utilities_paid_by !== 'tenant' && (
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Water & Sewer / Month</label>
              <input
                type="number"
                style={styles.input}
                value={formData.water_sewer_monthly}
                onChange={(e) => handleChange('water_sewer_monthly', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Electricity / Month</label>
              <input
                type="number"
                style={styles.input}
                value={formData.electricity_monthly}
                onChange={(e) => handleChange('electricity_monthly', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Gas / Month</label>
              <input
                type="number"
                style={styles.input}
                value={formData.gas_monthly}
                onChange={(e) => handleChange('gas_monthly', e.target.value)}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Trash / Month</label>
              <input
                type="number"
                style={styles.input}
                value={formData.trash_monthly}
                onChange={(e) => handleChange('trash_monthly', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Maintenance & Services (Monthly)</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Lawn Care / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.lawn_care_monthly}
              onChange={(e) => handleChange('lawn_care_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Snow Removal / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.snow_removal_monthly}
              onChange={(e) => handleChange('snow_removal_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Pest Control / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.pest_control_monthly}
              onChange={(e) => handleChange('pest_control_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Repairs & Maintenance / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.repairs_maintenance_monthly}
              onChange={(e) => handleChange('repairs_maintenance_monthly', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Other Expenses</h2>
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Accounting & Legal / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.accounting_legal_monthly}
              onChange={(e) => handleChange('accounting_legal_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Licenses & Permits / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.licenses_permits_monthly}
              onChange={(e) => handleChange('licenses_permits_monthly', e.target.value)}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Other Expenses / Month</label>
            <input
              type="number"
              style={styles.input}
              value={formData.other_expenses_monthly}
              onChange={(e) => handleChange('other_expenses_monthly', e.target.value)}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Other Expenses Description</label>
          <input
            type="text"
            style={styles.input}
            value={formData.other_expenses_description}
            onChange={(e) => handleChange('other_expenses_description', e.target.value)}
            placeholder="Describe other expenses"
          />
        </div>
      </div>
    </>
  );

  const renderManagement = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Property Management & CapEx</h2>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Management Fee %</label>
          <input
            type="number"
            step="0.1"
            style={styles.input}
            value={formData.management_fee_percent}
            onChange={(e) => handleChange('management_fee_percent', e.target.value)}
          />
          <div style={styles.helperText}>% of gross income (typical: 8-12%)</div>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Management Fee $ / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.management_fee_monthly}
            onChange={(e) => handleChange('management_fee_monthly', e.target.value)}
          />
          <div style={styles.helperText}>Or enter fixed amount</div>
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Advertising & Marketing / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.advertising_marketing_monthly}
            onChange={(e) => handleChange('advertising_marketing_monthly', e.target.value)}
          />
        </div>
      </div>

      <h3 style={{...styles.sectionTitle, fontSize: '18px', marginTop: '32px'}}>Capital Expenditures (CapEx)</h3>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>CapEx Reserve % of Income</label>
          <input
            type="number"
            step="0.1"
            style={styles.input}
            value={formData.capex_percent_of_income}
            onChange={(e) => handleChange('capex_percent_of_income', e.target.value)}
          />
          <div style={styles.helperText}>Typical: 5-10%</div>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>CapEx Reserve $ / Month</label>
          <input
            type="number"
            style={styles.input}
            value={formData.capital_expenditures_monthly}
            onChange={(e) => handleChange('capital_expenditures_monthly', e.target.value)}
          />
          <div style={styles.helperText}>Or enter fixed amount</div>
        </div>
      </div>
    </div>
  );

  const renderAgent = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Listing Agent Information</h2>
      
      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Agent Name</label>
          <input
            type="text"
            style={styles.input}
            value={formData.agent_name}
            onChange={(e) => handleChange('agent_name', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Brokerage</label>
          <input
            type="text"
            style={styles.input}
            value={formData.agent_brokerage}
            onChange={(e) => handleChange('agent_brokerage', e.target.value)}
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Phone</label>
          <input
            type="tel"
            style={styles.input}
            value={formData.agent_phone}
            onChange={(e) => handleChange('agent_phone', e.target.value)}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            style={styles.input}
            value={formData.agent_email}
            onChange={(e) => handleChange('agent_email', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Review & Submit</h2>
      <p style={{color: '#666', fontSize: '14px', marginBottom: '24px'}}>
        Review your deal information and submit to start analysis.
      </p>
      
      <div style={{backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '6px'}}>
        <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px'}}>Property</h3>
        <p style={{fontSize: '14px', color: '#666', marginBottom: '4px'}}>{formData.property_name || 'Not entered'}</p>
        <p style={{fontSize: '14px', color: '#666', marginBottom: '16px'}}>{formData.city}, {formData.state}</p>
        
        <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px'}}>Purchase Price</h3>
        <p style={{fontSize: '14px', color: '#666', marginBottom: '16px'}}>
          ${parseFloat(formData.asking_price || 0).toLocaleString()}
        </p>
        
        <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px'}}>Income</h3>
        <p style={{fontSize: '14px', color: '#666', marginBottom: '16px'}}>
          ${parseFloat(formData.gross_monthly_income || 0).toLocaleString()} / month
        </p>
        
        <p style={{fontSize: '12px', color: '#888', marginTop: '24px'}}>
          Click "Submit Deal" to save and begin underwriting analysis.
        </p>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderPropertyInfo();
      case 1: return renderUnitMix();
      case 2: return renderFinancing();
      case 3: return renderIncome();
      case 4: return renderExpenses();
      case 5: return renderManagement();
      case 6: return renderAgent();
      case 7: return renderReview();
      default: return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        <div style={styles.header}>
          <h1 style={styles.title}>Deal Wizard</h1>
          <p style={styles.subtitle}>
            Complete your property information and financial analysis
          </p>
        </div>

        <div style={styles.progressBar}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              style={{
                ...styles.progressStep,
                ...(index === currentStep ? styles.progressStepActive : {}),
                ...(index < currentStep ? styles.progressStepCompleted : {})
              }}
              onClick={() => setCurrentStep(index)}
            >
              {step.label}
            </div>
          ))}
        </div>

        {renderCurrentStep()}

        <div style={styles.buttonGroup}>
          <button
            style={{...styles.button, ...styles.buttonSecondary}}
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button
              style={{...styles.button, ...styles.buttonPrimary}}
            onClick={handleNext}
          >
            Next →
          </button>
        ) : (
          <button
            style={{...styles.button, ...styles.buttonPrimary}}
            onClick={handleSubmit}
          >
            Submit Deal
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export default DealWizardPage;
