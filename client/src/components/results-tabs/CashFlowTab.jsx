import React, { useMemo } from 'react';
import * as calc from '../../utils/propertySpreadsheetCalculations';
import { mapParsedDataToSpreadsheet } from '../../utils/propertySpreadsheetMapper';

export default function CashFlowTab({ scenarioData }) {
  const data = useMemo(() => mapParsedDataToSpreadsheet(scenarioData || {}), [scenarioData]);

  const revenueProjections = useMemo(() => calc.calculateRevenueProjections(data), [data]);
  const expenseProjections = useMemo(() => calc.calculateExpenseProjections(data, revenueProjections), [data, revenueProjections]);
  const noiProjections = useMemo(() => calc.calculateNOIProjections(revenueProjections, expenseProjections, data.units), [revenueProjections, expenseProjections, data]);
  const financingMetrics = useMemo(() => calc.calculateFinancingMetrics(data, noiProjections), [data, noiProjections]);
  const cashFlowProjections = useMemo(() => calc.calculateCashFlowProjections(noiProjections, financingMetrics, data), [noiProjections, financingMetrics, data]);

  const years = Array.from({ length: 11 }, (_, i) => (i === 0 ? 'Year 0' : `Year ${i}`));

  const formatCurrency = (n) => {
    if (n == null) return '$0';
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    return `${sign}$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };
  const formatPercent = (p) => `${((p || 0) * 100).toFixed(2)}%`;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 800, color: '#111827' }}>Investment Cash Flow Details</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: 180 }}>Annual Cash Flow</th>
              {years.map((y, i) => (
                <th key={i} style={{ padding: '10px', textAlign: 'right', minWidth: 90, borderLeft: '1px solid #e5e7eb' }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Income */}
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Gross Potential Rental Income</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(rev.grossPotentialRent)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontWeight: 400, borderTop: '1px solid #f3f4f6' }}>Vacancy</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderLeft: '1px solid #e5e7eb' }}>-{formatCurrency(Math.abs(rev.vacancy)).replace('$','')}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic' }}>Vacancy Rate %</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>0%</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>{formatPercent((data.growth?.vacancyRate || 0))}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontWeight: 400 }}>Loss to Lease</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', color: '#dc2626', borderLeft: '1px solid #e5e7eb' }}>-{formatCurrency(Math.abs(rev.lossToLease)).replace('$','')}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', fontWeight: 700, borderTop: '1px solid #e5e7eb' }}>Effective Gross Rental Income</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(rev.netRentalIncome)}</td>
              ))}
            </tr>

            {/* Operating Expenses header */}
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan={12} style={{ padding: '8px', fontWeight: 700, fontSize: 12 }}>OPERATING EXPENSES</td>
            </tr>

            {/* Expense lines */}
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Property Taxes</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.realEstateTaxes || 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Insurance</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.propertyInsurance || 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Utilities</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.utilities || 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Repairs & Maintenance</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.repairsMaintenance || 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Management Fee</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.propertyManagement || 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Other</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => {
                const other = (exp.totalExpenses || 0) - (exp.realEstateTaxes || 0) - (exp.propertyInsurance || 0) - (exp.utilities || 0) - (exp.repairsMaintenance || 0) - (exp.propertyManagement || 0);
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(Math.max(0, other))}</td>
                );
              })}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', fontWeight: 700 }}>Total Operating Expenses</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {expenseProjections.map((exp, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(exp.totalOperatingExpenses)}</td>
              ))}
            </tr>

            {/* NOI */}
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12 }}>NET OPERATING INCOME (NOI)</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {noiProjections.map((noi, i) => (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(noi.noi)}</td>
              ))}
            </tr>

            {/* Debt & Cash Flow */}
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>Debt Service (Annual)</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(cf.totalDebtService).replace('$','')}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12 }}>CASH FLOW AFTER FINANCING</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>{cf.dscr != null ? `${cf.dscr.toFixed(2)}x` : '-'}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>Cash-on-Cash Return %</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>-</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid #e5e7eb' }}>{calc.formatPercent(cf.cashOnCash)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>DSCR</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>-</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid #e5e7eb' }}>{cf.dscr != null ? `${cf.dscr.toFixed(2)}x` : '-'}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
