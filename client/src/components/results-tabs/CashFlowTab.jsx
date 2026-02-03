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
  const otherIncomeAnnual = useMemo(() => calc.calculateTotalOtherIncome(data.otherIncome), [data]);
  const saleAnalysis = useMemo(() => calc.calculateSaleAnalysis(noiProjections, data, financingMetrics), [noiProjections, data, financingMetrics]);
  const equityInvestment = useMemo(() => calc.calculateEquityInvestment(data, financingMetrics), [data, financingMetrics]);
  const irrCashFlows = useMemo(() => calc.calculateIRRCashFlows(equityInvestment, cashFlowProjections, saleAnalysis), [equityInvestment, cashFlowProjections, saleAnalysis]);
  const debtSchedule = useMemo(() => calc.calculateDebtAmortizationSchedule(data.financing || {}), [data]);

  const years = Array.from({ length: 11 }, (_, i) => (i === 0 ? 'Year 0' : `Year ${i}`));

  const formatCurrency = (n) => {
    if (n == null) return '$0';
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    return `${sign}$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };
  const formatPercent = (p) => `${((p || 0) * 100).toFixed(2)}%`;
  const formatMultiple = (m) => `${(m || 0).toFixed(2)}x`;

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
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic' }}>GPRI / Sqft (monthly)</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>0</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, borderLeft: '1px solid #e5e7eb' }}>{
                  (() => {
                    const sf = data.squareFeet || 0;
                    const perSF = sf ? (rev.grossPotentialRent / sf / 12) : 0;
                    return `$${perSF.toFixed(2)}`;
                  })()
                }</td>
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
              <td style={{ padding: '8px', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Total Supplementary Income</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(0)}</td>
              {revenueProjections.map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(otherIncomeAnnual)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic' }}>% of Total Potential Income</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>0%</td>
              {revenueProjections.map((rev, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, borderLeft: '1px solid #e5e7eb' }}>{formatPercent(calc.safeDivide(otherIncomeAnnual, rev.grossPotentialRent))}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', fontWeight: 700 }}>Effective Gross Income</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {noiProjections.map((n, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontWeight: 700, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(n.effectiveGrossIncome)}</td>
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
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic' }}>Yield on Cost</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>0%</td>
              {noiProjections.map((n, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, borderLeft: '1px solid #e5e7eb' }}>{formatPercent(calc.safeDivide(n.noi, equityInvestment.totalAcquisitionCost))}</td>
              ))}
            </tr>

            {/* Debt & Cash Flow */}
            {/* Financing detail rows to mirror Cactus */}
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px' }}>Total Amortization payments</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>$0</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(y.principalScheduled)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px' }}>Total Interest payments</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>$0</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(y.interest)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px' }}>Total Principal payments</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>$0</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(y.principalScheduled + y.principalExtra)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px' }}>Total Additional Repayments</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>$0</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(y.principalExtra)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px' }}>Total Repayments made with Exit</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>$0</td>
              {debtSchedule.years.map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(i === debtSchedule.years.length - 1 ? debtSchedule.repayWithExit[i] : 0)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px' }}>Total Loans End Balance</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(debtSchedule.years[0]?.endBalance || 0)}</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(y.endBalance)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12 }}>FINANCING CASH FLOW</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12 }}>{formatCurrency(debtSchedule.totalDebtDraw)}</td>
              {debtSchedule.years.map((y, i) => (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(-(y.interest + y.principalScheduled + y.principalExtra))}</td>
              ))}
            </tr>
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
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(cf.beforeTaxCashFlow)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Contributions</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(-equityInvestment.requiredEquity)}</td>
              {cashFlowProjections.map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12 }}>NET CASH FLOW AFTER CONTRIBUTIONS</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12, borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(cf.beforeTaxCashFlow)}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>% of Effective Gross Income</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>0%</td>
              {noiProjections.map((n, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid #e5e7eb' }}>{formatPercent(calc.safeDivide(cashFlowProjections[i]?.beforeTaxCashFlow || 0, n.effectiveGrossIncome))}</td>
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
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>Cash-on-Cash - levered (Incl. capital events)</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>-</td>
              {years.slice(1).map((_, i) => {
                const yr = i + 1;
                let value = cashFlowProjections[i]?.cashOnCash || 0;
                if (yr === 5) {
                  const sale = saleAnalysis.year5?.netSaleProceeds || 0;
                  const totalEquity = equityInvestment.requiredEquity || 1;
                  value = (cashFlowProjections[i]?.beforeTaxCashFlow + sale) / totalEquity;
                } else if (yr === 10) {
                  const sale = saleAnalysis.year10?.netSaleProceeds || 0;
                  const totalEquity = equityInvestment.requiredEquity || 1;
                  value = (cashFlowProjections[i]?.beforeTaxCashFlow + sale) / totalEquity;
                }
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid #e5e7eb' }}>{calc.formatPercent(value)}</td>
                );
              })}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24, fontSize: 10, fontStyle: 'italic', fontWeight: 600 }}>DSCR</td>
              <td style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>-</td>
              {cashFlowProjections.map((cf, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', fontSize: 10, fontWeight: 600, borderLeft: '1px solid #e5e7eb' }}>{cf.dscr != null ? `${cf.dscr.toFixed(2)}x` : '-'}</td>
              ))}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Estimate property Value</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>$0</td>
              {years.slice(1).map((_, i) => {
                const yr = i + 1;
                let v = 0;
                if (yr === 5) v = saleAnalysis.year5?.grossSalePrice || 0;
                if (yr === 10) v = saleAnalysis.year10?.grossSalePrice || 0;
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(v)}</td>
                );
              })}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Debt balance</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(financingMetrics.blended.totalDebt)}</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatCurrency(financingMetrics.blended.totalDebt)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan={12} style={{ padding: '8px', fontWeight: 700, fontSize: 12 }}>Capital Structure</td>
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>LTV</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatPercent(financingMetrics.blended.ltv)}</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatPercent(financingMetrics.blended.ltv)}</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Equity</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatPercent(calc.safeDivide(equityInvestment.requiredEquity, equityInvestment.totalAcquisitionCost))}</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatPercent(calc.safeDivide(equityInvestment.requiredEquity, equityInvestment.totalAcquisitionCost))}</td>
              ))}
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td colSpan={12} style={{ padding: '8px', fontWeight: 700, fontSize: 12 }}>Return Metrics</td>
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Equity Multiple (EM)</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>0.00x</td>
              {years.slice(1).map((_, i) => {
                const yr = i + 1;
                let m = 0;
                if (yr === 5) m = irrCashFlows.fiveYear.equityMultiple || 0;
                if (yr === 10) m = irrCashFlows.tenYear.equityMultiple || 0;
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatMultiple(m)}</td>
                );
              })}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>IRR - Levered</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>0%</td>
              {years.slice(1).map((_, i) => {
                const yr = i + 1;
                let irr = 0;
                if (yr === 5) irr = (irrCashFlows.fiveYear.irr || 0) / 100;
                if (yr === 10) irr = (irrCashFlows.tenYear.irr || 0) / 100;
                return (
                  <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>{formatPercent(irr)}</td>
                );
              })}
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Cash-on-Cash - Unlevered (w/o Exit)</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>-</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>-</td>
              ))}
            </tr>
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '8px', paddingLeft: 24 }}>Cash-on-Cash - Unlevered (Incl. Exit)</td>
              <td style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>-</td>
              {years.slice(1).map((_, i) => (
                <td key={i} style={{ padding: '8px', textAlign: 'right', borderLeft: '1px solid #e5e7eb' }}>-</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
