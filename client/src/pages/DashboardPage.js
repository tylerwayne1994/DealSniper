import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  dashboardContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0
  },
  sidebarTitle: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: '48px',
    letterSpacing: '-0.02em'
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  navItem: {
    marginBottom: '8px'
  },
  navButton: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'transparent',
    color: '#a0a0a0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '700',
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  navButtonActive: {
    backgroundColor: '#2d2d2d',
    color: '#ffffff'
  },
  mainContent: {
    marginLeft: '280px',
    flex: 1,
    padding: '40px',
    width: 'calc(100% - 280px)'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '36px',
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: '8px',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '32px'
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
    fontSize: '22px',
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #e0e0e0'
  },
  subsectionTitle: {
    fontSize: '18px',
    fontWeight: '900',
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
    fontWeight: '900',
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
    assetType: 'multifamily',
    minUnits: 20,
    maxUnits: 200,
    minPrice: 500000,
    maxPrice: 5000000,
    targetMarkets: 'Texas, Florida, Arizona',
    excludedMarkets: 'California, New York',

    // Section B: Day-One Cashflow Rules
    minDayOneDSCR: 1.25,
    minDayOneMonthlyCashflow: 2000,
    maxLTV: 75,
    maxInterestRate: 7.5,

    // Section C: Value-Add & Stabilized Targets
    minRentDeltaToMarket: 150,
    minStabilizedNOIGrowth: 10,
    minPostRefiMonthlyCashflow: 5000,
    minRefiCashOut: 100000,
    minEquityMultipleAtRefi: 2.0,
    targetRefiCapRate: 6.5,
    targetRefiYear: 3,

    // Section D: Rehab Preferences
    maxRehabPerUnit: 15000,
    expectedRentBump: 200,
    allowDeferredMaintenance: true,
    requireRentBumpWithoutHeavyRehab: true,

    // Section E: Stress Test Settings
    vacancyStress: 10,
    expenseGrowthStress: 5,
    rentGrowthStress: 3,
    taxIncreaseStress: 15,

    // Section F: Creative Finance Preferences
    allowSellerFinancing: true,
    allowSellerCarryOnDownPayment: false,
    allowEquityPartnersForDownPayment: true,
    minOwnershipAfterRefi: 70,
    maxIOPeriod: 24,
    maxBalloonPeriod: 10,

    // Section G: Hard Pass Conditions
    autoFailYearBuilt: 1970,
    autoFailPricePerUnit: 100000,
    autoFailMinUnits: 20,
    autoFailMaxUnits: 200,
    autoFailExcludedMarkets: true,
    minRecoverableUtilities: 5000
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDealParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSave = () => {
    console.log('Deal Parameters saved:', dealParams);
    localStorage.setItem('dealParams', JSON.stringify(dealParams));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={styles.card}>
      {/* Section A: Basic Deal Filters */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>A. Basic Deal Filters</h2>
        
        <div style={styles.formGroup}>
          <label htmlFor="assetType" style={styles.label}>Asset Type</label>
          <select
            id="assetType"
            name="assetType"
            value={dealParams.assetType}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="multifamily">Multifamily</option>
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minUnits" style={styles.label}>Unit Range (Min)</label>
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
            <label htmlFor="maxUnits" style={styles.label}>Unit Range (Max)</label>
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
            <label htmlFor="minPrice" style={styles.label}>Price Range (Min)</label>
            <input
              type="number"
              id="minPrice"
              name="minPrice"
              value={dealParams.minPrice}
              onChange={handleChange}
              style={styles.input}
              step="10000"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxPrice" style={styles.label}>Price Range (Max)</label>
            <input
              type="number"
              id="maxPrice"
              name="maxPrice"
              value={dealParams.maxPrice}
              onChange={handleChange}
              style={styles.input}
              step="10000"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="targetMarkets" style={styles.label}>Target Markets</label>
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
          <label htmlFor="excludedMarkets" style={styles.label}>Excluded Markets</label>
          <input
            type="text"
            id="excludedMarkets"
            name="excludedMarkets"
            value={dealParams.excludedMarkets}
            onChange={handleChange}
            style={styles.input}
            placeholder="California, New York"
          />
        </div>
      </div>

      {/* Section B: Day-One Cashflow Rules */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>B. Day-One Cashflow Rules</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minDayOneDSCR" style={styles.label}>Min Day-One DSCR</label>
            <input
              type="number"
              id="minDayOneDSCR"
              name="minDayOneDSCR"
              value={dealParams.minDayOneDSCR}
              onChange={handleChange}
              style={styles.input}
              step="0.01"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minDayOneMonthlyCashflow" style={styles.label}>Min Day-One Monthly Cashflow ($)</label>
            <input
              type="number"
              id="minDayOneMonthlyCashflow"
              name="minDayOneMonthlyCashflow"
              value={dealParams.minDayOneMonthlyCashflow}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxLTV" style={styles.label}>Max LTV (%)</label>
            <input
              type="number"
              id="maxLTV"
              name="maxLTV"
              value={dealParams.maxLTV}
              onChange={handleChange}
              style={styles.input}
              step="1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxInterestRate" style={styles.label}>Max Interest Rate (%)</label>
            <input
              type="number"
              id="maxInterestRate"
              name="maxInterestRate"
              value={dealParams.maxInterestRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Section C: Value-Add & Stabilized Targets */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>C. Value-Add & Stabilized Targets</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minRentDeltaToMarket" style={styles.label}>Min Rent Delta to Market ($ per unit)</label>
            <input
              type="number"
              id="minRentDeltaToMarket"
              name="minRentDeltaToMarket"
              value={dealParams.minRentDeltaToMarket}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minStabilizedNOIGrowth" style={styles.label}>Min Stabilized NOI Growth (%)</label>
            <input
              type="number"
              id="minStabilizedNOIGrowth"
              name="minStabilizedNOIGrowth"
              value={dealParams.minStabilizedNOIGrowth}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minPostRefiMonthlyCashflow" style={styles.label}>Min Post-Refi Monthly Cashflow ($)</label>
            <input
              type="number"
              id="minPostRefiMonthlyCashflow"
              name="minPostRefiMonthlyCashflow"
              value={dealParams.minPostRefiMonthlyCashflow}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minRefiCashOut" style={styles.label}>Min Refi Cash-Out ($)</label>
            <input
              type="number"
              id="minRefiCashOut"
              name="minRefiCashOut"
              value={dealParams.minRefiCashOut}
              onChange={handleChange}
              style={styles.input}
              step="1000"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minEquityMultipleAtRefi" style={styles.label}>Min Equity Multiple at Refi</label>
            <input
              type="number"
              id="minEquityMultipleAtRefi"
              name="minEquityMultipleAtRefi"
              value={dealParams.minEquityMultipleAtRefi}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="targetRefiCapRate" style={styles.label}>Target Refi Cap Rate (%)</label>
            <input
              type="number"
              id="targetRefiCapRate"
              name="targetRefiCapRate"
              value={dealParams.targetRefiCapRate}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
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
        </div>
      </div>

      {/* Section D: Rehab Preferences */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>D. Rehab Preferences</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="maxRehabPerUnit" style={styles.label}>Max Rehab Per Unit ($)</label>
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
            <label htmlFor="expectedRentBump" style={styles.label}>Expected Rent Bump ($ per unit)</label>
            <input
              type="number"
              id="expectedRentBump"
              name="expectedRentBump"
              value={dealParams.expectedRentBump}
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
            Allow Deferred Maintenance
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="requireRentBumpWithoutHeavyRehab"
              checked={dealParams.requireRentBumpWithoutHeavyRehab}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Require Rent Bump Without Heavy Rehab
          </label>
        </div>
      </div>

      {/* Section E: Stress Test Settings */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>E. Stress Test Settings</h2>
        
        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="vacancyStress" style={styles.label}>Vacancy Stress (%)</label>
            <input
              type="number"
              id="vacancyStress"
              name="vacancyStress"
              value={dealParams.vacancyStress}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="expenseGrowthStress" style={styles.label}>Expense Growth Stress (%)</label>
            <input
              type="number"
              id="expenseGrowthStress"
              name="expenseGrowthStress"
              value={dealParams.expenseGrowthStress}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="rentGrowthStress" style={styles.label}>Rent Growth Stress (%)</label>
            <input
              type="number"
              id="rentGrowthStress"
              name="rentGrowthStress"
              value={dealParams.rentGrowthStress}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="taxIncreaseStress" style={styles.label}>Tax Increase Stress (%)</label>
            <input
              type="number"
              id="taxIncreaseStress"
              name="taxIncreaseStress"
              value={dealParams.taxIncreaseStress}
              onChange={handleChange}
              style={styles.input}
              step="0.1"
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
            Allow Seller Financing
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allowSellerCarryOnDownPayment"
              checked={dealParams.allowSellerCarryOnDownPayment}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Allow Seller Carry on Down Payment
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="allowEquityPartnersForDownPayment"
              checked={dealParams.allowEquityPartnersForDownPayment}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Allow Equity Partners for Down Payment
          </label>
        </div>

        <div style={styles.grid}>
          <div style={styles.formGroup}>
            <label htmlFor="minOwnershipAfterRefi" style={styles.label}>Min Ownership After Refi (%)</label>
            <input
              type="number"
              id="minOwnershipAfterRefi"
              name="minOwnershipAfterRefi"
              value={dealParams.minOwnershipAfterRefi}
              onChange={handleChange}
              style={styles.input}
              step="1"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxIOPeriod" style={styles.label}>Max IO Period (Months)</label>
            <input
              type="number"
              id="maxIOPeriod"
              name="maxIOPeriod"
              value={dealParams.maxIOPeriod}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="maxBalloonPeriod" style={styles.label}>Max Balloon Period (Years)</label>
            <input
              type="number"
              id="maxBalloonPeriod"
              name="maxBalloonPeriod"
              value={dealParams.maxBalloonPeriod}
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
            <label htmlFor="autoFailYearBuilt" style={styles.label}>Auto-Fail Year Built &lt; X</label>
            <input
              type="number"
              id="autoFailYearBuilt"
              name="autoFailYearBuilt"
              value={dealParams.autoFailYearBuilt}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailPricePerUnit" style={styles.label}>Auto-Fail Price Per Unit &gt; X ($)</label>
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

          <div style={styles.formGroup}>
            <label htmlFor="autoFailMinUnits" style={styles.label}>Auto-Fail Units &lt; Min</label>
            <input
              type="number"
              id="autoFailMinUnits"
              name="autoFailMinUnits"
              value={dealParams.autoFailMinUnits}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="autoFailMaxUnits" style={styles.label}>Auto-Fail Units &gt; Max</label>
            <input
              type="number"
              id="autoFailMaxUnits"
              name="autoFailMaxUnits"
              value={dealParams.autoFailMaxUnits}
              onChange={handleChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="minRecoverableUtilities" style={styles.label}>Min Recoverable Utilities ($/year)</label>
            <input
              type="number"
              id="minRecoverableUtilities"
              name="minRecoverableUtilities"
              value={dealParams.minRecoverableUtilities}
              onChange={handleChange}
              style={styles.input}
              step="100"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="autoFailExcludedMarkets"
              checked={dealParams.autoFailExcludedMarkets}
              onChange={handleChange}
              style={styles.checkbox}
            />
            Auto-Fail Excluded Markets
          </label>
        </div>
      </div>

      <button onClick={handleSave} style={styles.button}>
        Save Parameters
      </button>

      {saved && (
        <div style={styles.successMessage}>
          Parameters saved successfully!
        </div>
      )}
    </div>
  );
}

// Pipeline functionality moved to dedicated PipelinePage component

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'parameters', label: 'Parameters' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'properties', label: 'Properties' },
    { id: 'contacts', label: 'Contacts' }
  ];

  // Handle tab click - redirect to Pipeline page if Pipeline tab clicked
  const handleTabClick = (tabId) => {
    if (tabId === 'pipeline') {
      navigate('/pipeline');
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div style={styles.dashboardContainer}>
      {/* Black Sidebar */}
      <div style={styles.sidebar}>
        <h1 style={styles.sidebarTitle}>DealSniper</h1>
        <nav>
          <ul style={styles.navList}>
            {tabs.map(tab => (
              <li key={tab.id} style={styles.navItem}>
                <button
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    ...styles.navButton,
                    ...(activeTab === tab.id ? styles.navButtonActive : {})
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '#2d2d2d';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#a0a0a0';
                    }
                  }}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content Area */}
      <div style={styles.mainContent}>
        <div style={styles.container}>
          {activeTab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
          {activeTab === 'parameters' && <ParametersTab />}
          {activeTab === 'properties' && (
            <div style={styles.card}>
              <h2 style={styles.title}>Properties</h2>
              <p style={styles.subtitle}>Property management coming soon...</p>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div style={styles.card}>
              <h2 style={styles.title}>Contacts</h2>
              <p style={styles.subtitle}>Contact management coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
