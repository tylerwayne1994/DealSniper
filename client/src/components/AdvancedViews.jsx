// Detailed Views for Advanced Features
import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

const COLORS = {
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  primary: '#3b82f6',
  gray: '#6b7280'
};

// Metric Card Component
export const MetricCard = ({ label, value, subtext, icon: Icon, color = COLORS.primary, trend }) => (
  <div style={{
    padding: '20px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{label}</div>
      {Icon && <Icon size={20} color={color} />}
    </div>
    <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{value}</div>
    {subtext && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{subtext}</div>}
    {trend && (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', fontSize: '12px' }}>
        {trend > 0 ? <TrendingUp size={14} color={COLORS.success} /> : <TrendingDown size={14} color={COLORS.danger} />}
        <span style={{ marginLeft: '4px', color: trend > 0 ? COLORS.success : COLORS.danger, fontWeight: '600' }}>
          {Math.abs(trend).toFixed(1)}%
        </span>
      </div>
    )}
  </div>
);

// Rent Roll Analysis View
export const RentRollView = ({ analysis }) => {
  if (!analysis) {
    return (
      <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <p>No rent roll data available</p>
      </div>
    );
  }

  const { summary, units, expirations } = analysis;

  return (
    <div style={{ padding: '24px' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <MetricCard 
          label="Total Units" 
          value={summary.totalUnits} 
          subtext={`${summary.totalSF.toLocaleString()} SF`}
          icon={CheckCircle}
          color={COLORS.primary}
        />
        <MetricCard 
          label="Occupancy" 
          value={`${((summary.occupiedUnits / summary.totalUnits) * 100).toFixed(1)}%`}
          subtext={`${summary.occupiedUnits} of ${summary.totalUnits} units`}
          icon={CheckCircle}
          color={COLORS.success}
        />
        <MetricCard 
          label="Avg Market Rent" 
          value={`$${summary.avgMarketRentPSF.toFixed(2)}/SF`}
          subtext="Annual basis"
          icon={TrendingUp}
          color={COLORS.success}
        />
        <MetricCard 
          label="Loss to Lease" 
          value={`$${summary.lossToLease.toLocaleString()}`}
          subtext={`${summary.lossToLeasePct.toFixed(1)}% potential upside`}
          icon={AlertCircle}
          color={COLORS.warning}
        />
      </div>

      {/* Unit Details Table */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Unit-Level Analysis</h3>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Unit</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Tenant</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>SF</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Current $/SF</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Monthly Rent</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Market $/SF</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Loss to Lease</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Lease Exp</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Est. TI</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Est. LC</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>{unit.unitNumber || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{unit.tenant || 'Vacant'}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{(unit.sf || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(unit.currentRentPSF || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${((unit.currentRentPSF || 0) * (unit.sf || 0)).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.success }}>${(unit.marketRentPSF || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: (unit.lossToLease || 0) > 0 ? COLORS.warning : COLORS.gray }}>
                    ${(unit.lossToLease || 0).toLocaleString()} ({(unit.lossToLeasePct || 0).toFixed(1)}%)
                  </td>
                  <td style={{ padding: '12px' }}>{unit.leaseEndDate || 'N/A'}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(unit.estimatedTI || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(unit.estimatedLC || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lease Expirations */}
      {Object.keys(expirations).length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Lease Expiration Schedule</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {Object.values(expirations).map((exp, idx) => (
              <div key={idx} style={{ 
                padding: '16px', 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{exp.year || 'N/A'}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  {exp.units || 0} units • {(exp.sf || 0).toLocaleString()} SF
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: COLORS.primary }}>
                  ${(exp.annualRent || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Annual Rent at Risk</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Management Fees View
export const ManagementFeesView = ({ fees }) => {
  if (!fees) return null;

  const totalFees = fees.acquisition.fee + 
    fees.assetManagement.reduce((sum, f) => sum + f.fee, 0) + 
    fees.disposition.fee;

  return (
    <div style={{ padding: '24px' }}>
      {/* Summary */}
      <div style={{ marginBottom: '30px' }}>
        <MetricCard 
          label="Total Management Fees" 
          value={`$${totalFees.toLocaleString()}`}
          subtext="Acquisition + Asset Mgmt + Disposition"
          icon={TrendingUp}
          color={COLORS.primary}
        />
      </div>

      {/* Fee Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Acquisition Fee */}
        <div style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Acquisition Fee</h4>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.primary, marginBottom: '8px' }}>
            ${fees.acquisition.fee.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            {fees.acquisition.rate}% of {fees.acquisition.basis}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>One-time fee at closing</div>
        </div>

        {/* Asset Management Fees */}
        <div style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Asset Management Fees</h4>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.success, marginBottom: '8px' }}>
            ${fees.assetManagement.reduce((sum, f) => sum + f.fee, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Total over holding period</div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            {fees.assetManagement.length} years × Avg ${(fees.assetManagement.reduce((sum, f) => sum + f.fee, 0) / fees.assetManagement.length).toLocaleString()}/yr
          </div>
        </div>

        {/* Disposition Fee */}
        <div style={{ padding: '20px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Disposition Fee</h4>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.warning, marginBottom: '8px' }}>
            ${(fees.disposition?.fee || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            {fees.disposition?.rate || 0}% of {fees.disposition?.basis || 'sale price'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>Due at property sale</div>
        </div>
      </div>

      {/* Annual Breakdown */}
      <div style={{ marginTop: '30px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Annual Asset Management Fees</h4>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Year</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Basis (EGI)</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Fee Amount</th>
              </tr>
            </thead>
            <tbody>
              {fees.assetManagement.map((yearFee, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>Year {yearFee.year || idx + 1}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(yearFee.basis || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.success }}>
                    ${(yearFee.fee || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Multi-Tier Waterfall View
export const WaterfallView = ({ waterfall }) => {
  if (!waterfall) return null;

  const totalDistribution = (waterfall.lp?.total || 0) + (waterfall.gp?.total || 0);
  const lpPercent = totalDistribution > 0 ? ((waterfall.lp?.total || 0) / totalDistribution) * 100 : 0;
  const gpPercent = totalDistribution > 0 ? ((waterfall.gp?.total || 0) / totalDistribution) * 100 : 0;

  return (
    <div style={{ padding: '24px' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <MetricCard 
          label="Total Distribution" 
          value={`$${totalDistribution.toLocaleString()}`}
          subtext="LP + GP combined"
          icon={TrendingUp}
          color={COLORS.primary}
        />
        <MetricCard 
          label="LP Distribution" 
          value={`$${(waterfall.lp?.total || 0).toLocaleString()}`}
          subtext={`${lpPercent.toFixed(1)}% of total`}
          icon={CheckCircle}
          color={COLORS.success}
        />
        <MetricCard 
          label="GP Distribution" 
          value={`$${(waterfall.gp?.total || 0).toLocaleString()}`}
          subtext={`${gpPercent.toFixed(1)}% of total`}
          icon={CheckCircle}
          color={COLORS.warning}
        />
      </div>

      {/* Tier Breakdown */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Waterfall Tiers</h3>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Tier</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Total Amount</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>LP Amount</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>GP Amount</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>LP %</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>GP %</th>
              </tr>
            </thead>
            <tbody>
              {(waterfall.tiers || []).map((tier, idx) => {
                const lpPct = (tier.amount || 0) > 0 ? ((tier.lpAmount || 0) / tier.amount) * 100 : 0;
                const gpPct = (tier.amount || 0) > 0 ? ((tier.gpAmount || 0) / tier.amount) * 100 : 0;
                
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '12px', fontWeight: '600' }}>{tier.tier || idx + 1}</td>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                      {(tier.type || '').replace(/([A-Z])/g, ' $1').trim()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                      ${(tier.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: COLORS.success }}>
                      ${(tier.lpAmount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: COLORS.warning }}>
                      ${(tier.gpAmount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{lpPct.toFixed(1)}%</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{gpPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LP Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ padding: '20px', backgroundColor: 'white', border: '2px solid ' + COLORS.success, borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>LP Breakdown</h4>
          {Object.entries(waterfall.lp?.byTier || {}).map(([tierType, amount], idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '8px 0', 
              borderBottom: idx < Object.entries(waterfall.lp?.byTier || {}).length - 1 ? '1px solid #e5e7eb' : 'none'
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                {tierType.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.success }}>
                ${(amount || 0).toLocaleString()}
              </span>
            </div>
          ))}
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Total LP</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: COLORS.success }}>
              ${(waterfall.lp?.total || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: 'white', border: '2px solid ' + COLORS.warning, borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>GP Breakdown</h4>
          {Object.entries(waterfall.gp?.byTier || {}).map(([tierType, amount], idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '8px 0', 
              borderBottom: idx < Object.entries(waterfall.gp?.byTier || {}).length - 1 ? '1px solid #e5e7eb' : 'none'
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                {tierType.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.warning }}>
                ${(amount || 0).toLocaleString()}
              </span>
            </div>
          ))}
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>Total GP</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: COLORS.warning }}>
              ${(waterfall.gp?.total || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tax Analysis View
export const TaxAnalysisView = ({ taxAnalysis }) => {
  if (!taxAnalysis) return null;

  return (
    <div style={{ padding: '24px' }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <MetricCard 
          label="After-Tax IRR" 
          value={`${(taxAnalysis.afterTaxIRR || 0).toFixed(2)}%`}
          subtext="Including all tax impacts"
          icon={TrendingUp}
          color={COLORS.success}
        />
        <MetricCard 
          label="After-Tax Multiple" 
          value={`${(taxAnalysis.afterTaxEquityMultiple || 0).toFixed(2)}x`}
          subtext="Return on equity"
          icon={CheckCircle}
          color={COLORS.primary}
        />
        <MetricCard 
          label="Annual Depreciation" 
          value={`$${(taxAnalysis.annualDepreciation || 0).toLocaleString()}`}
          subtext={`${taxAnalysis.depreciationPeriod || 27.5} year schedule`}
          icon={TrendingDown}
          color={COLORS.warning}
        />
        <MetricCard 
          label="Building Value" 
          value={`$${(taxAnalysis.buildingValue || 0).toLocaleString()}`}
          subtext={`Land: $${(taxAnalysis.landValue || 0).toLocaleString()}`}
          icon={CheckCircle}
          color={COLORS.gray}
        />
      </div>

      {/* Exit Tax Summary */}
      {taxAnalysis.exitTaxes && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Exit Tax Analysis</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Sales Price</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                ${(taxAnalysis.exitTaxes.salesPrice || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Adjusted Basis</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                ${(taxAnalysis.exitTaxes.adjustedBasis || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Capital Gain</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: COLORS.success }}>
                ${(taxAnalysis.exitTaxes.capitalGain || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Total Tax on Sale</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: COLORS.danger }}>
                ${(taxAnalysis.exitTaxes.totalTaxOnSale || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>After-Tax Proceeds</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: COLORS.primary }}>
                ${(taxAnalysis.exitTaxes.afterTaxProceeds || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Year-by-Year Breakdown */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Annual Tax Impact</h4>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Year</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Pre-Tax CF</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Depreciation</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Taxable Income</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Tax Liability</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>After-Tax CF</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Cum. Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {taxAnalysis.byYear.map((year, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>Year {year.year || idx + 1}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(year.preTaxCashFlow || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: COLORS.success }}>-${(year.depreciation || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>${(year.taxableIncome || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: COLORS.danger }}>-${(year.taxLiability || 0).toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: COLORS.primary }}>
                    ${(year.afterTaxCashFlow || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: COLORS.gray }}>
                    ${(year.cumulativeDepreciation || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const viewComponents = {
  MetricCard,
  RentRollView,
  ManagementFeesView,
  WaterfallView,
  TaxAnalysisView
};

export default viewComponents;
