import React, { useState } from 'react';
import { 
  TrendingUp, DollarSign, Home, Wrench, Sparkles, 
  Calculator, Target, ArrowRight, CheckCircle, Clock,
  Plus, Minus, AlertCircle, Info
} from 'lucide-react';

const ValueAddTab = ({ scenarioData, fullCalcs, onFieldChange }) => {
  const [selectedStrategy, setSelectedStrategy] = useState('cosmetic');
  const [increaseMode, setIncreaseMode] = useState('amount'); // 'amount' | 'percent'
  const [percentIncrease, setPercentIncrease] = useState(5); // default 5%
  
  // Handle null/undefined scenarioData
  if (!scenarioData) {
    return (
      <div style={{ padding: 24, backgroundColor: '#ffffff', minHeight: '100%' }}>
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>No scenario data available. Please load or create a deal first.</p>
        </div>
      </div>
    );
  }
  
  // Extract relevant data from scenarioData
  const property = scenarioData?.property || {};
  const unitCount = property.unit_count || 0;
  const currentRent = scenarioData?.income?.current_rent || 0;
  const purchasePrice = property.purchase_price || 0;
  const unitMix = Array.isArray(scenarioData?.unit_mix) ? scenarioData.unit_mix : [];

  const styles = {
    container: {
      padding: 24,
      backgroundColor: '#ffffff',
      minHeight: '100%',
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 24,
      fontWeight: 700,
      color: '#111827',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: '#6b7280',
    },
    strategiesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 16,
      marginBottom: 32,
    },
    strategyCard: (isSelected) => ({
      padding: 20,
      border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
      borderRadius: 12,
      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    strategyHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    strategyIcon: (isSelected) => ({
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: isSelected ? '#2563eb' : '#f3f4f6',
      color: isSelected ? '#ffffff' : '#6b7280',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    strategyTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: '#111827',
    },
    strategyDesc: {
      fontSize: 13,
      color: '#6b7280',
      lineHeight: 1.5,
    },
    detailsSection: {
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: '#111827',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    inputGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16,
      marginBottom: 24,
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: 500,
      color: '#4b5563',
    },
    input: {
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: 6,
      fontSize: 14,
      fontFamily: 'inherit',
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16,
      marginTop: 24,
    },
    metricCard: {
      padding: 16,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
    },
    metricLabel: {
      fontSize: 12,
      color: '#6b7280',
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 20,
      fontWeight: 700,
      color: '#111827',
    },
    proformaSection: {
      backgroundColor: '#f0fdf4',
      borderRadius: 12,
      padding: 24,
      border: '2px solid #86efac',
    },
    impactGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24,
      marginTop: 16,
    },
    impactCard: {
      backgroundColor: '#ffffff',
      padding: 20,
      borderRadius: 8,
    },
    impactTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: '#4b5563',
      marginBottom: 16,
    },
    impactRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6',
    },
    impactRowLabel: {
      fontSize: 13,
      color: '#6b7280',
    },
    impactRowValue: (positive = false) => ({
      fontSize: 14,
      fontWeight: 600,
      color: positive ? '#059669' : '#111827',
    }),
    timelineSection: {
      marginTop: 24,
      padding: 20,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
    },
    timelineItem: {
      display: 'flex',
      gap: 16,
      marginBottom: 16,
      paddingBottom: 16,
      borderBottom: '1px solid #f3f4f6',
    },
    timelineIcon: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: '#eff6ff',
      color: '#2563eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    timelineContent: {
      flex: 1,
    },
    timelineTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: '#111827',
      marginBottom: 4,
    },
    timelineDesc: {
      fontSize: 13,
      color: '#6b7280',
    },
  };

  const strategies = [
    {
      id: 'cosmetic',
      name: 'Cosmetic Upgrades',
      icon: Sparkles,
      description: 'Light renovations: paint, flooring, fixtures. Quick turnaround, moderate returns.',
      costPerUnit: 5000,
      rentIncrease: 100,
      timeline: 3,
    },
    {
      id: 'moderate',
      name: 'Moderate Renovation',
      icon: Wrench,
      description: 'Kitchen/bath updates, appliances, HVAC. Higher returns, 6-12 month timeline.',
      costPerUnit: 15000,
      rentIncrease: 200,
      timeline: 9,
    },
    {
      id: 'heavy',
      name: 'Heavy Renovation',
      icon: Home,
      description: 'Gut renovation, systems replacement, major structural work. Highest returns.',
      costPerUnit: 35000,
      rentIncrease: 400,
      timeline: 18,
    },
    {
      id: 'operational',
      name: 'Operational Efficiency',
      icon: TrendingUp,
      description: 'Reduce expenses, improve management, add amenities. No construction needed.',
      costPerUnit: 2000,
      rentIncrease: 50,
      timeline: 6,
    },
  ];

  const selectedStrategyData = strategies.find(s => s.id === selectedStrategy) || strategies[0];
  const avgCurrentMarketRent = unitMix.length > 0
    ? Math.round(unitMix.reduce((sum, u) => sum + (u.rent_market ?? u.rent_current ?? 0), 0) / unitMix.length)
    : 0;
  const perUnitIncrease = increaseMode === 'amount'
    ? (selectedStrategyData.rentIncrease || 0)
    : Math.round(((avgCurrentMarketRent || 0) * (percentIncrease || 0)) / 100);
  
  // Calculations
  const totalRenoCoast = selectedStrategyData.costPerUnit * unitCount;
  const monthlyRentIncrease = perUnitIncrease * unitCount;
  const annualRentIncrease = monthlyRentIncrease * 12;
  const newAnnualIncome = (currentRent * 12) + annualRentIncrease;
  const assumedCapRate = 6.5;
  const newValue = newAnnualIncome / (assumedCapRate / 100);
  const valueCreated = newValue - purchasePrice - totalRenoCoast;
  const roi = totalRenoCoast > 0 ? (valueCreated / totalRenoCoast) * 100 : 0;

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const applyIncreaseToUnitMix = () => {
    if (!onFieldChange) return;
    const inc = perUnitIncrease || 0;
    const updated = unitMix.map((u) => {
      const base = (u.rent_market ?? u.rent_current ?? 0);
      return { ...u, rent_market: Math.max(0, base + inc) };
    });
    onFieldChange('unit_mix', updated);
  };

  const applyIncreaseToCurrentRents = () => {
    if (!onFieldChange) return;
    const inc = perUnitIncrease || 0;
    const updated = unitMix.map((u) => {
      const base = (u.rent_current ?? u.rent_market ?? 0);
      return { ...u, rent_current: Math.max(0, base + inc) };
    });
    onFieldChange('unit_mix', updated);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Value-Add Strategy</h1>
        <p style={styles.subtitle}>
          Analyze renovation options and their impact on property value and cash flow
        </p>
      </div>

      {/* Strategy Selection */}
      <div style={styles.strategiesGrid}>
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            style={styles.strategyCard(selectedStrategy === strategy.id)}
            onClick={() => setSelectedStrategy(strategy.id)}
          >
            <div style={styles.strategyHeader}>
              <div style={styles.strategyIcon(selectedStrategy === strategy.id)}>
                <strategy.icon size={20} />
              </div>
              <div style={styles.strategyTitle}>{strategy.name}</div>
            </div>
            <div style={styles.strategyDesc}>{strategy.description}</div>
          </div>
        ))}
      </div>

      {/* Details Input Section */}
      <div style={styles.detailsSection}>
        <div style={styles.sectionTitle}>
          <Calculator size={18} />
          Renovation Details
        </div>
        <div style={styles.inputGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Cost per Unit</label>
            <input
              type="number"
              style={styles.input}
              value={selectedStrategyData.costPerUnit}
              readOnly
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Increase Mode</label>
            <select
              style={styles.input}
              value={increaseMode}
              onChange={(e) => setIncreaseMode(e.target.value)}
            >
              <option value="amount">Fixed Amount ($)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>
          {increaseMode === 'amount' ? (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Rent Increase per Unit/Month ($)</label>
              <input
                type="number"
                style={styles.input}
                value={selectedStrategyData.rentIncrease}
                readOnly
              />
            </div>
          ) : (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Percent Increase per Unit (%)</label>
              <input
                type="number"
                style={styles.input}
                value={percentIncrease}
                onChange={(e) => setPercentIncrease(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Timeline (Months)</label>
            <input
              type="number"
              style={styles.input}
              value={selectedStrategyData.timeline}
              readOnly
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Unit Count</label>
            <input
              type="number"
              style={styles.input}
              value={unitCount}
              readOnly
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Avg Market Rent (Current)</label>
            <input
              type="number"
              style={styles.input}
              value={avgCurrentMarketRent}
              readOnly
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={applyIncreaseToUnitMix}
            style={{
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Apply Increase To Market Rents
          </button>
          <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            Updates scenarioData.unit_mix[].rent_market by {increaseMode === 'amount' ? `+$${perUnitIncrease}` : `+${percentIncrease}%`} /unit
          </div>
          <button
            onClick={applyIncreaseToCurrentRents}
            style={{
              padding: '10px 14px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Apply Increase To Current Rents
          </button>
          <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            Updates scenarioData.unit_mix[].rent_current by {increaseMode === 'amount' ? `+$${perUnitIncrease}` : `+${percentIncrease}%`} /unit
          </div>
        </div>

        {/* Key Metrics */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Renovation Cost</div>
            <div style={styles.metricValue}>{formatCurrency(totalRenoCoast)}</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Monthly Rent Increase</div>
            <div style={styles.metricValue}>{formatCurrency(monthlyRentIncrease)}</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Annual Rent Increase</div>
            <div style={styles.metricValue}>{formatCurrency(annualRentIncrease)}</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Return on Investment</div>
            <div style={styles.metricValue}>{roi.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Proforma Impact */}
      <div style={styles.proformaSection}>
        <div style={styles.sectionTitle}>
          <Target size={18} />
          Proforma Impact
        </div>
        <div style={styles.impactGrid}>
          <div style={styles.impactCard}>
            <div style={styles.impactTitle}>Before Renovation</div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Purchase Price</span>
              <span style={styles.impactRowValue()}>{formatCurrency(purchasePrice)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Monthly Rent</span>
              <span style={styles.impactRowValue()}>{formatCurrency(currentRent)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Annual Income</span>
              <span style={styles.impactRowValue()}>{formatCurrency(currentRent * 12)}</span>
            </div>
          </div>

          <div style={styles.impactCard}>
            <div style={styles.impactTitle}>After Renovation</div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>All-In Cost</span>
              <span style={styles.impactRowValue()}>{formatCurrency(purchasePrice + totalRenoCoast)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Monthly Rent</span>
              <span style={styles.impactRowValue(true)}>{formatCurrency(currentRent + monthlyRentIncrease)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Annual Income</span>
              <span style={styles.impactRowValue(true)}>{formatCurrency(newAnnualIncome)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>New Value (@ {assumedCapRate}% cap)</span>
              <span style={styles.impactRowValue(true)}>{formatCurrency(newValue)}</span>
            </div>
            <div style={styles.impactRow}>
              <span style={styles.impactRowLabel}>Value Created</span>
              <span style={styles.impactRowValue(true)}>{formatCurrency(valueCreated)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Timeline */}
      <div style={styles.timelineSection}>
        <div style={styles.sectionTitle}>
          <Clock size={18} />
          Implementation Timeline
        </div>
        <div style={styles.timelineItem}>
          <div style={styles.timelineIcon}>
            <CheckCircle size={16} />
          </div>
          <div style={styles.timelineContent}>
            <div style={styles.timelineTitle}>Month 0-1: Planning & Permits</div>
            <div style={styles.timelineDesc}>
              Finalize scope, hire contractors, obtain necessary permits and approvals
            </div>
          </div>
        </div>
        <div style={styles.timelineItem}>
          <div style={styles.timelineIcon}>
            <Wrench size={16} />
          </div>
          <div style={styles.timelineContent}>
            <div style={styles.timelineTitle}>
              Month 2-{selectedStrategyData.timeline - 2}: Construction
            </div>
            <div style={styles.timelineDesc}>
              Execute renovation work, manage contractors, maintain quality control
            </div>
          </div>
        </div>
        <div style={styles.timelineItem}>
          <div style={styles.timelineIcon}>
            <DollarSign size={16} />
          </div>
          <div style={styles.timelineContent}>
            <div style={styles.timelineTitle}>
              Month {selectedStrategyData.timeline - 1}-{selectedStrategyData.timeline}: Lease-Up
            </div>
            <div style={styles.timelineDesc}>
              Market renovated units at new rent levels, achieve stabilized occupancy
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValueAddTab;
