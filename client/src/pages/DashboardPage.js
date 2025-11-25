import React, { useState } from 'react';

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '24px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '32px'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#666',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#1a1a1a',
    borderBottom: '3px solid #1a1a1a'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '32px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  },
  section: {
    marginBottom: '40px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #e0e0e0'
  },
  subsectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '16px',
    marginTop: '24px'
  },
  formGroup: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#1a1a1a',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box',
    minHeight: '100px',
    fontFamily: 'inherit'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box'
  },
  checkbox: {
    marginRight: '8px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#1a1a1a'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px'
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '24px'
  },
  successMessage: {
    padding: '12px 16px',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '4px',
    marginTop: '16px',
    fontSize: '14px'
  }
};

function ProfileTab({ profile, setProfile }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    console.log('Profile saved:', profile);
    alert('Profile saved successfully!');
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.sectionTitle}>Profile Information</h2>
      
      <div style={styles.grid}>
        <div style={styles.formGroup}>
          <label htmlFor="firstName" style={styles.label}>First Name</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={profile.firstName}
            onChange={handleChange}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="lastName" style={styles.label}>Last Name</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={profile.lastName}
            onChange={handleChange}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="phone" style={styles.label}>Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={profile.phone}
            onChange={handleChange}
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="email" style={styles.label}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={profile.email}
            onChange={handleChange}
            style={styles.input}
          />
        </div>
      </div>

      <button onClick={handleSave} style={styles.button}>
        Save Profile
      </button>
    </div>
  );
}

function ParametersTab() {
  const [dealParams, setDealParams] = useState({
    // Section A: Basic Deal Filters
    assetTypes: {
      multifamily: true,
      rvPark: true,
      mobileHomePark: false,
      selfStorage: false,
      mixedUse: false,
      other: ''
    },
    minUnits: 20,
    maxUnits: 200,
    minPurchasePrice: 500000,
    maxPurchasePrice: 5000000,
    targetMarkets: 'Texas, Florida, Arizona',
    excludeMarkets: 'California, New York',

    // Section B: Day-One Cashflow Rules
    requirePositiveCashflow: true,
    minMonthlyCashflow: 2000,
    minDayOneCapRate: 6.0,
    maxAcceptableLTV: 75,
    maxAcceptableInterestRate: 7.5,

    // Section C: Stabilized / Value-Add Targets
    holdPeriodYears: 5,
    targetRefiYear: 3,
    minStabilizedCashOnCash: 12,
    minStabilizedDSCR: 1.25,
    requireDoubleEquity: true,
    minEquityMultiple: 2.0,
    minStabilizedCapRate: 7.5,

    // Section D: Value-Add / Rehab Preferences
    valueAddStrategy: 'medium',
    maxRehabPerUnit: 15000,
    minRentBumpPerUnit: 150,
    allowDeferredMaintenance: true,
    rehabNotes: '',

    // Section E: Risk / Stress Test Settings
    defaultVacancy: 5,
    maxStressTestVacancy: 15,
    annualExpenseGrowth: 3,
    annualRentGrowth: 3,
    taxReassessmentRisk: 'medium',
    maxPropertyTaxIncrease: 20,

    // Section F: Creative Finance Preferences
    allowSellerFinancing: true,
    preferSellerCarry: false,
    allowEquityPartners: true,
    minOwnershipRetain: 70,
    willingIOPeriod: true,
    maxIOPeriodMonths: 24,
    maxBalloonTermYears: 10,

    // Section G: Hard Pass Conditions
    autoFailDayOneDSCR: 1.1,
    autoFailDayOneCapRate: 5.0,
    autoFailStabilizedDSCR: 1.15,
    autoFailMinEquityMultiple: 1.5,
    autoFailPropertyAge: 1970,
    autoFailPricePerUnit: 100000,
    otherDealKillers: ''
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('assetTypes.')) {
      const assetType = name.split('.')[1];
      setDealParams(prev => ({
        ...prev,
        assetTypes: {
          ...prev.assetTypes,
          [assetType]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setDealParams(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
      }));
    }
  };

  const handleSave = () => {
    console.log('Deal Parameters saved:', dealParams);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={styles.card}>
      {/* Section A: Basic Deal Filters */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>A. Basic Deal Filters</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Preferred Asset Types</label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="assetTypes.multifamily"
              checked={dealParams.assetTypes.multifamily}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Multifamily
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="assetTypes.rvPark"
              checked={dealParams.assetTypes.rvPark}
              onChange={handleChange}
              style={styles.checkbox}
            />
            RV Park
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="assetTypes.mobileHomePark"
              checked={dealParams.assetTypes.mobileHomePark}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Mobile Home Park
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="assetTypes.selfStorage"
              checked={dealParams.assetTypes.selfStorage}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Self Storage
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="assetTypes.mixedUse"
              checked={dealParams.assetTypes.mixedUse}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Mixed-Use
          </label>
          <div style={{ marginTop: '12px' }}>
            <label htmlFor="assetTypes.other" style={styles.label}>Other (specify)</label>
            <input
              type="text"
              name="assetTypes.other"
              value={dealParams.assetTypes.other}
              onChange={handleChange}
              style={styles.input}
              placeholder="Other asset types..."
            />
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minUnits" style={styles.label}>Min Units / Pads</label>
            <input
              type="number"
              id="minUnits"
              name="minUnits"
              value={dealParams.minUnits}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxUnits" style={styles.label}>Max Units / Pads</label>
            <input
              type="number"
              id="maxUnits"
              name="maxUnits"
              value={dealParams.maxUnits}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minPurchasePrice" style={styles.label}>Min Purchase Price ($)</label>
            <input
              type="number"
              id="minPurchasePrice"
              name="minPurchasePrice"
              value={dealParams.minPurchasePrice}
              onChange={handleChange}
              style={styles.input}
              step="10000"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxPurchasePrice" style={styles.label}>Max Purchase Price ($)</label>
            <input
              type="number"
              id="maxPurchasePrice"
              name="maxPurchasePrice"
              value={dealParams.maxPurchasePrice}
              onChange={handleChange}
              style={styles.input}
              step="10000"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="targetMarkets" style={styles.label}>Target Markets (comma-separated)</label>
          <input
            type="text"
            id="targetMarkets"
            name="targetMarkets"
            value={dealParams.targetMarkets}
            onChange={handleChange}
            style={styles.input}
            placeholder="Texas, Florida, Arizona"
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="excludeMarkets" style={styles.label}>Exclude Markets / States</label>
          <input
            type="text"
            id="excludeMarkets"
            name="excludeMarkets"
            value={dealParams.excludeMarkets}
            onChange={handleChange}
            style={styles.input}
            placeholder="California, New York"
          />
        </div>
      </div>

      {/* Section B: Day-One Cashflow Rules */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>B. Day-One Cashflow Rules</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="requirePositiveCashflow"
              checked={dealParams.requirePositiveCashflow}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Require positive cashflow day one?
          </label>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minMonthlyCashflow" style={styles.label}>Minimum Monthly Cashflow (Day One) ($)</label>
            <input
              type="number"
              id="minMonthlyCashflow"
              name="minMonthlyCashflow"
              value={dealParams.minMonthlyCashflow}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minDayOneCapRate" style={styles.label}>Minimum Day-One Cap Rate (%)</label>
            <input
              type="number"
              id="minDayOneCapRate"
              name="minDayOneCapRate"
              value={dealParams.minDayOneCapRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxAcceptableLTV" style={styles.label}>Maximum Acceptable LTV (Day One, %)</label>
            <input
              type="number"
              id="maxAcceptableLTV"
              name="maxAcceptableLTV"
              value={dealParams.maxAcceptableLTV}
              onChange={handleChange}
              style={styles.input}
              step="1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxAcceptableInterestRate" style={styles.label}>Maximum Acceptable Interest Rate (Day One, %)</label>
            <input
              type="number"
              id="maxAcceptableInterestRate"
              name="maxAcceptableInterestRate"
              value={dealParams.maxAcceptableInterestRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Section C: Stabilized / Value-Add Targets */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>C. Stabilized / Value-Add Targets</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="holdPeriodYears" style={styles.label}>Hold Period (Years)</label>
            <input
              type="number"
              id="holdPeriodYears"
              name="holdPeriodYears"
              value={dealParams.holdPeriodYears}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="targetRefiYear" style={styles.label}>Target Refi Year</label>
            <input
              type="number"
              id="targetRefiYear"
              name="targetRefiYear"
              value={dealParams.targetRefiYear}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minStabilizedCashOnCash" style={styles.label}>Minimum Stabilized Cash-on-Cash Return (%)</label>
            <input
              type="number"
              id="minStabilizedCashOnCash"
              name="minStabilizedCashOnCash"
              value={dealParams.minStabilizedCashOnCash}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minStabilizedDSCR" style={styles.label}>Minimum Stabilized DSCR</label>
            <input
              type="number"
              id="minStabilizedDSCR"
              name="minStabilizedDSCR"
              value={dealParams.minStabilizedDSCR}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minEquityMultiple" style={styles.label}>Minimum Equity Multiple at Refi</label>
            <input
              type="number"
              id="minEquityMultiple"
              name="minEquityMultiple"
              value={dealParams.minEquityMultiple}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minStabilizedCapRate" style={styles.label}>Minimum Stabilized Cap Rate (%)</label>
            <input
              type="number"
              id="minStabilizedCapRate"
              name="minStabilizedCapRate"
              value={dealParams.minStabilizedCapRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="requireDoubleEquity"
              checked={dealParams.requireDoubleEquity}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Require investor to at least double equity by refi?
          </label>
        </div>
      </div>

      {/* Section D: Value-Add / Rehab Preferences */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>D. Value-Add / Rehab Preferences</h2>
        
        <div style={styles.formGroup}>
          <label htmlFor="valueAddStrategy" style={styles.label}>Preferred Value-Add Strategy Type</label>
          <select
            id="valueAddStrategy"
            name="valueAddStrategy"
            value={dealParams.valueAddStrategy}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="light">Light rehab (cosmetics only)</option>
            <option value="medium">Medium rehab</option>
            <option value="heavy">Heavy repositioning</option>
          </select>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="maxRehabPerUnit" style={styles.label}>Max Rehab Budget per Unit ($)</label>
            <input
              type="number"
              id="maxRehabPerUnit"
              name="maxRehabPerUnit"
              value={dealParams.maxRehabPerUnit}
              onChange={handleChange}
              style={styles.input}
              step="1000"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minRentBumpPerUnit" style={styles.label}>Min Expected Rent Bump per Unit ($/month)</label>
            <input
              type="number"
              id="minRentBumpPerUnit"
              name="minRentBumpPerUnit"
              value={dealParams.minRentBumpPerUnit}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allowDeferredMaintenance"
              checked={dealParams.allowDeferredMaintenance}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Allow deals with some deferred maintenance?
          </label>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="rehabNotes" style={styles.label}>Notes / Constraints</label>
          <textarea
            id="rehabNotes"
            name="rehabNotes"
            value={dealParams.rehabNotes}
            onChange={handleChange}
            style={styles.textarea}
            placeholder="Additional rehab notes or constraints..."
          />
        </div>
      </div>

      {/* Section E: Risk / Stress Test Settings */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>E. Risk / Stress Test Settings</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="defaultVacancy" style={styles.label}>Vacancy Assumption (Default %)</label>
            <input
              type="number"
              id="defaultVacancy"
              name="defaultVacancy"
              value={dealParams.defaultVacancy}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxStressTestVacancy" style={styles.label}>Max Acceptable Stress-Test Vacancy (%)</label>
            <input
              type="number"
              id="maxStressTestVacancy"
              name="maxStressTestVacancy"
              value={dealParams.maxStressTestVacancy}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="annualExpenseGrowth" style={styles.label}>Annual Expense Growth Assumption (%)</label>
            <input
              type="number"
              id="annualExpenseGrowth"
              name="annualExpenseGrowth"
              value={dealParams.annualExpenseGrowth}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="annualRentGrowth" style={styles.label}>Annual Rent Growth Assumption (%)</label>
            <input
              type="number"
              id="annualRentGrowth"
              name="annualRentGrowth"
              value={dealParams.annualRentGrowth}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="taxReassessmentRisk" style={styles.label}>Tax Reassessment Risk Tolerance</label>
            <select
              id="taxReassessmentRisk"
              name="taxReassessmentRisk"
              value={dealParams.taxReassessmentRisk}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxPropertyTaxIncrease" style={styles.label}>Max % Increase in Property Taxes You're Comfortable Underwriting</label>
            <input
              type="number"
              id="maxPropertyTaxIncrease"
              name="maxPropertyTaxIncrease"
              value={dealParams.maxPropertyTaxIncrease}
              onChange={handleChange}
              style={styles.input}
              step="1"
            />
          </div>
        </div>
      </div>

      {/* Section F: Creative Finance Preferences */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>F. Creative Finance Preferences</h2>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allowSellerFinancing"
              checked={dealParams.allowSellerFinancing}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Allow Seller Financing?
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="preferSellerCarry"
              checked={dealParams.preferSellerCarry}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Prefer Seller to Carry Down Payment Instead of Equity Partner?
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allowEquityPartners"
              checked={dealParams.allowEquityPartners}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Allow Equity Partners to Fund Down Payment?
          </label>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="willingIOPeriod"
              checked={dealParams.willingIOPeriod}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Willing to Take Interest-Only Period?
          </label>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minOwnershipRetain" style={styles.label}>Minimum Ownership You Want to Retain After Refi (%)</label>
            <input
              type="number"
              id="minOwnershipRetain"
              name="minOwnershipRetain"
              value={dealParams.minOwnershipRetain}
              onChange={handleChange}
              style={styles.input}
              step="1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxIOPeriodMonths" style={styles.label}>Max IO Period (Months)</label>
            <input
              type="number"
              id="maxIOPeriodMonths"
              name="maxIOPeriodMonths"
              value={dealParams.maxIOPeriodMonths}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxBalloonTermYears" style={styles.label}>Max Balloon Term You're Comfortable With (Years)</label>
            <input
              type="number"
              id="maxBalloonTermYears"
              name="maxBalloonTermYears"
              value={dealParams.maxBalloonTermYears}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Section G: Hard Pass Conditions */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>G. Hard Pass Conditions (Deal Killers)</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="autoFailDayOneDSCR" style={styles.label}>Auto-fail if Day-One DSCR falls below</label>
            <input
              type="number"
              id="autoFailDayOneDSCR"
              name="autoFailDayOneDSCR"
              value={dealParams.autoFailDayOneDSCR}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailDayOneCapRate" style={styles.label}>Auto-fail if Day-One Cap Rate below (%)</label>
            <input
              type="number"
              id="autoFailDayOneCapRate"
              name="autoFailDayOneCapRate"
              value={dealParams.autoFailDayOneCapRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailStabilizedDSCR" style={styles.label}>Auto-fail if Stabilized DSCR below</label>
            <input
              type="number"
              id="autoFailStabilizedDSCR"
              name="autoFailStabilizedDSCR"
              value={dealParams.autoFailStabilizedDSCR}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailMinEquityMultiple" style={styles.label}>Auto-fail if Minimum Equity Multiple at Refi is below</label>
            <input
              type="number"
              id="autoFailMinEquityMultiple"
              name="autoFailMinEquityMultiple"
              value={dealParams.autoFailMinEquityMultiple}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailPropertyAge" style={styles.label}>Auto-fail if Property is Older Than (Year)</label>
            <input
              type="number"
              id="autoFailPropertyAge"
              name="autoFailPropertyAge"
              value={dealParams.autoFailPropertyAge}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailPricePerUnit" style={styles.label}>Auto-fail if Price per Unit exceeds ($)</label>
            <input
              type="number"
              id="autoFailPricePerUnit"
              name="autoFailPricePerUnit"
              value={dealParams.autoFailPricePerUnit}
              onChange={handleChange}
              style={styles.input}
              step="1000"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="otherDealKillers" style={styles.label}>Other deal killers</label>
          <textarea
            id="otherDealKillers"
            name="otherDealKillers"
            value={dealParams.otherDealKillers}
            onChange={handleChange}
            style={styles.textarea}
            placeholder="List any other automatic deal killers..."
          />
        </div>
      </div>

      <button onClick={handleSave} style={styles.button}>
        Save Parameters
      </button>

      {saved && (
        <div style={styles.successMessage}>
          ✓ Parameters saved successfully!
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
      </div>

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            ...styles.tab,
            ...(activeTab === 'profile' ? styles.tabActive : {})
          }}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          style={{
            ...styles.tab,
            ...(activeTab === 'parameters' ? styles.tabActive : {})
          }}
        >
          Parameters
        </button>
      </div>

      {activeTab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
      {activeTab === 'parameters' && <ParametersTab />}
    </div>
  );
}

export default DashboardPage;
