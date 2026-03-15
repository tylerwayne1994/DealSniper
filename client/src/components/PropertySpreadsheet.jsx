import React, { useState, useMemo, useEffect } from 'react';
import * as calc from '../utils/propertySpreadsheetCalculations';

const PropertySpreadsheet = ({ initialData }) => {
  const [data, setData] = useState({
    propertyName: '',
    units: 0,
    squareFeet: 0,
    purchasePrice: 0,
    stabilizedNOI: 0,
    proFormaNOI: 0,
    sources: { seniorDebt: 0, mezDebt: 0, preferredEquity: 0, lpEquity: 0, gpEquity: 0 },
    uses: { purchasePrice: 0, closingCosts: 0, dueDiligence: 0, immediateCapex: 0, financingFees: 0, operatingReserves: 0, other: 0 },
    acquisition: { acquisitionDate: '', holdPeriod: 5, yearBuilt: '', closingCosts: 0, downPaymentPercent: 0, dueDiligence: 0, capexBudgetYear1: 0, financingCosts: 0, operatingReserves: 0 },
    growth: { annualRentGrowth: 0.03, annualExpenseGrowth: 0.03, vacancyRate: 0.05, badDebtRate: 0.02, concessions: 0, managementFeePercent: 0.03, exitCapRate5Yr: 0.06, exitCapRate10Yr: 0.06 },
    sale: { sellingCostsPercent: 0.02, capexReservePerUnitPerYear: 300, renovatedUnitPremium: 0, classicRentAvg: 0, renovatedRentAvg: 0 },
    rentRoll: Array(10).fill(null).map((_, i) => ({ id: i + 1, unitNumber: '', type: '', sf: 0, status: '', marketRent: 0, inPlaceRent: 0, leaseStart: '', leaseEnd: '', tenantName: '' })),
    otherIncome: { laundry: 0, parking: 0, petFees: 0, applicationFees: 0, lateFees: 0, storage: 0, other: 0 },
    expenses: { realEstateTaxes: 0, propertyInsurance: 0, waterSewer: 0, electric: 0, gas: 0, trashRemoval: 0, repairsMaintenance: 0, landscaping: 0, pestControl: 0, snowRemoval: 0, unitTurnover: 0, onSitePayroll: 0, marketing: 0, legalProfessional: 0, accounting: 0, administrative: 0, security: 0, cableInternet: 0, elevatorMaintenance: 0, poolMaintenance: 0 },
    financing: { financingType: 'Traditional', subjectTo: { balance: 0, interestRate: 0, remainingTermMonths: 0 }, sellerFinancing: { loanAmount: 0, interestRate: 0, termMonths: 0, amortizationMonths: 0, interestOnlyMonths: 0 }, sellerCarryback: { loanAmount: 0, interestRate: 0, termMonths: 0, interestOnly: false }, dscrLoan: { loanAmount: 0, ltv: 0, interestRate: 0, termMonths: 0, amortizationMonths: 0, dscrRequirement: 1.25 }, hybrid: { bankPct: 0, bankRate: 0, sellerPct: 0, sellerRate: 0 } },
    waterfall: { preferredReturn: 0.08, lpEquitySplitPrePref: 0.90, gpEquitySplitPrePref: 0.10, lpSplitAfterPref: 0.70, gpPromoteAfterPref: 0.30 },
    equityPartner: { contributionPercent: 0.5, returnType: 'Preferred Return' },
  });

  useEffect(() => {
    if (initialData) {
      setData(prev => {
        const merged = { ...prev };
        if (initialData.propertyName !== undefined) merged.propertyName = initialData.propertyName;
        if (initialData.units !== undefined) merged.units = initialData.units;
        if (initialData.squareFeet !== undefined) merged.squareFeet = initialData.squareFeet;
        if (initialData.purchasePrice !== undefined) merged.purchasePrice = initialData.purchasePrice;
        if (initialData.stabilizedNOI !== undefined) merged.stabilizedNOI = initialData.stabilizedNOI;
        if (initialData.proFormaNOI !== undefined) merged.proFormaNOI = initialData.proFormaNOI;
        if (initialData.sources) merged.sources = { ...prev.sources, ...initialData.sources };
        if (initialData.uses) merged.uses = { ...prev.uses, ...initialData.uses };
        if (initialData.acquisition) merged.acquisition = { ...prev.acquisition, ...initialData.acquisition };
        if (initialData.growth) merged.growth = { ...prev.growth, ...initialData.growth };
        if (initialData.sale) merged.sale = { ...prev.sale, ...initialData.sale };
        if (initialData.rentRoll) merged.rentRoll = initialData.rentRoll;
        if (initialData.otherIncome) merged.otherIncome = { ...prev.otherIncome, ...initialData.otherIncome };
        if (initialData.expenses) merged.expenses = { ...prev.expenses, ...initialData.expenses };
        if (initialData.financing) {
          merged.financing = {
            subjectTo: { ...prev.financing.subjectTo, ...(initialData.financing.subjectTo || {}) },
            sellerFinancing: { ...prev.financing.sellerFinancing, ...(initialData.financing.sellerFinancing || {}) },
            sellerCarryback: { ...prev.financing.sellerCarryback, ...(initialData.financing.sellerCarryback || {}) },
            dscrLoan: { ...prev.financing.dscrLoan, ...(initialData.financing.dscrLoan || {}) },
            hybrid: { ...prev.financing.hybrid, ...(initialData.financing.hybrid || {}) },
            financingType: initialData.financing.financingType ?? prev.financing.financingType,
          };
        }
        if (initialData.waterfall) merged.waterfall = { ...prev.waterfall, ...initialData.waterfall };
        return merged;
      });
    }
  }, [initialData]);

  const revenueProjections = useMemo(() => calc.calculateRevenueProjections(data), [data]);
  const expenseProjections = useMemo(() => calc.calculateExpenseProjections(data, revenueProjections), [data, revenueProjections]);
  const noiProjections = useMemo(() => calc.calculateNOIProjections(revenueProjections, expenseProjections, data.units), [revenueProjections, expenseProjections, data]);
  const financingMetrics = useMemo(() => calc.calculateFinancingMetrics(data, noiProjections), [data, noiProjections]);
  const cashFlowProjections = useMemo(() => calc.calculateCashFlowProjections(noiProjections, financingMetrics, data), [noiProjections, financingMetrics, data]);

  return (
    <div style={{ padding: '16px', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'none' }}>v4.0-CLEAN-REBUILD-{Date.now()}</div>
      
      <div style={{ marginBottom: '32px', overflowX: 'auto' }}>
        <div style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px', color: '#0b1e5e', textTransform: 'uppercase', letterSpacing: '1px' }}>
          💰 INVESTMENT CASH FLOW DETAILS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '2px solid #273a8a' }}>
          <thead>
            <tr style={{ backgroundColor: '#0b1e5e', color: 'white' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '180px', position: 'sticky', left: 0, backgroundColor: '#0b1e5e', zIndex: 10 }}>Annual Cash Flow</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 0</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 1</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 2</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 3</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 4</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 5</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 6</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 7</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 8</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a', minWidth: '90px' }}>Year 9</th>
              <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, minWidth: '90px' }}>Year 10</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td style={{ padding: '8px', fontWeight: 600, borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 5 }}>Gross Potential Rental Income</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(rev.grossPotentialRent)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', fontWeight: 400, borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Vacancy</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  -{calc.formatCurrency(rev.vacancy).replace('$', '')}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#eef2ff' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', fontSize: '10px', fontStyle: 'italic', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#eef2ff', zIndex: 5 }}>Vacancy Rate %</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: '10px', borderRight: '1px solid #e5e7eb' }}>0%</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: '10px', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatPercent((data.growth?.vacancyRate || 0))}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', fontWeight: 400, borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Loss to Lease</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  -{calc.formatCurrency(rev.lossToLease).replace('$', '')}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#eef2ff', borderTop: '2px solid #273a8a', borderBottom: '2px solid #273a8a' }}>
              <td style={{ padding: '8px', fontWeight: 700, borderRight: '1px solid #273a8a', position: 'sticky', left: 0, backgroundColor: '#eef2ff', zIndex: 5 }}>Effective Gross Rental Income</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #273a8a' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: i < 9 ? '1px solid #273a8a' : 'none' }}>
                  {calc.formatCurrency(rev.netRentalIncome)}
                </td>
              ))}
            </tr>
            {Object.keys(data.otherIncome || {}).filter(key => data.otherIncome[key] > 0).map((incomeKey, idx) => (
              <tr key={incomeKey} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '8px', paddingLeft: '24px', textTransform: 'capitalize', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb', zIndex: 5 }}>
                  {incomeKey.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
                {revenueProjections.map((rev, i) => {
                  const otherIncomeValue = (data.otherIncome[incomeKey] || 0) * Math.pow(1 + (data.growth?.annualRentGrowth || 0.03), i);
                  return (
                    <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                      {calc.formatCurrency(otherIncomeValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr style={{ backgroundColor: '#ffe4e6', borderTop: '2px solid #dc2626', borderBottom: '2px solid #dc2626' }}>
              <td colSpan={12} style={{ padding: '8px', fontWeight: 800, fontSize: '12px' }}>OPERATING EXPENSES</td>
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Property Taxes</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(exp.realEstateTaxes || 0)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 5 }}>Insurance</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(exp.propertyInsurance || 0)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Utilities</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(exp.utilities || 0)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 5 }}>Repairs & Maintenance</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(exp.repairsMaintenance || 0)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Management Fee</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {calc.formatCurrency(exp.propertyManagement || 0)}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 5 }}>Other</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => {
                const other = (exp.totalExpenses || 0) - (exp.realEstateTaxes || 0) - (exp.propertyInsurance || 0) - (exp.utilities || 0) - (exp.repairsMaintenance || 0) - (exp.propertyManagement || 0);
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                    {calc.formatCurrency(Math.max(0, other))}
                  </td>
                );
              })}
            </tr>
            <tr style={{ backgroundColor: '#fee2e2', borderTop: '2px solid #dc2626', borderBottom: '2px solid #dc2626' }}>
              <td style={{ padding: '8px', fontWeight: 700, borderRight: '1px solid #dc2626', position: 'sticky', left: 0, backgroundColor: '#fee2e2', zIndex: 5 }}>Total Operating Expenses</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #dc2626' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderRight: i < 9 ? '1px solid #dc2626' : 'none' }}>
                  {calc.formatCurrency(exp.totalOperatingExpenses)}
                </td>
              ))}
            </tr>
            {/* Totals and summary rows */}

            <tr style={{ backgroundColor: '#dcfce7', borderTop: '3px solid #16a34a', borderBottom: '3px solid #16a34a' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: '12px', borderRight: '2px solid #16a34a', position: 'sticky', left: 0, backgroundColor: '#dcfce7', zIndex: 5 }}>NET OPERATING INCOME (NOI)</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', borderRight: '2px solid #16a34a' }}>$0</td>
              {noiProjections.map((noi, i) => (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', borderRight: i < 9 ? '2px solid #16a34a' : 'none' }}>
                  {calc.formatCurrency(noi.noi)}
                </td>
              ))}
            </tr>

            <tr style={{ backgroundColor: 'white' }}>
              <td style={{ padding: '8px', fontWeight: 600, borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>Debt Service (Annual)</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #e5e7eb' }}>$0</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderRight: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                  {cf.totalDebtService ? `-${calc.formatCurrency(cf.totalDebtService).replace('$', '')}` : calc.formatCurrency(0).replace('$', '')}
                </td>
              ))}
            </tr>

            <tr style={{ backgroundColor: '#fce4ec', borderTop: '2px solid #e53935', borderBottom: '2px solid #e53935' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: '12px', borderRight: '2px solid #e53935', position: 'sticky', left: 0, backgroundColor: '#fce4ec', zIndex: 5 }}>CASH FLOW AFTER FINANCING</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', borderRight: '2px solid #e53935' }}>$0</td>
              {cashFlowProjections.map((cf, i) => {
                const cashFlow = cf.beforeTaxCashFlow != null ? cf.beforeTaxCashFlow : (cf.noi != null && cf.totalDebtService != null ? cf.noi - cf.totalDebtService : null);
                return (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', color: cashFlow != null && cashFlow < 0 ? '#e53935' : '#1b5e20', borderRight: i < 9 ? '2px solid #e53935' : 'none' }}>
                  {cashFlow != null ? calc.formatCurrency(cashFlow) : '-'}
                </td>
                );
              })}
            </tr>

            <tr style={{ backgroundColor: '#fef9c3' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', fontSize: '10px', fontStyle: 'italic', fontWeight: 600, borderRight: '1px solid #f59e0b', position: 'sticky', left: 0, backgroundColor: '#fef9c3', zIndex: 5 }}>Cash-on-Cash Return %</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: '10px', borderRight: '1px solid #f59e0b' }}>-</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, borderRight: i < 9 ? '1px solid #f59e0b' : 'none' }}>
                  {calc.formatPercent(cf.cashOnCash)}
                </td>
              ))}
            </tr>

            <tr style={{ backgroundColor: '#fef9c3' }}>
              <td style={{ padding: '8px', paddingLeft: '24px', fontSize: '10px', fontStyle: 'italic', fontWeight: 600, borderRight: '1px solid #f59e0b', position: 'sticky', left: 0, backgroundColor: '#fef9c3', zIndex: 5 }}>DSCR</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: '10px', borderRight: '1px solid #f59e0b' }}>-</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, borderRight: i < 9 ? '1px solid #f59e0b' : 'none' }}>
                  {cf.dscr != null ? `${cf.dscr.toFixed(2)}x` : '-'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PropertySpreadsheet;
