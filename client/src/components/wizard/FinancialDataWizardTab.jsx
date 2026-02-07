// NEW Cactus-style wizard tab for financial data
// Shows extracted financial fields with confidence scores

import React, { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import ExtractedFieldsTable from '../components/ExtractedFieldsTable';

export default function FinancialDataWizardTab({
  verifiedData,
  confidence = {},
  onFieldChange,
  onViewSource,
  onResolveConflict
}) {
  
  const formatCurrency = (val) => {
    if (!val) return '$0';
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  
  const formatPercent = (val) => {
    if (!val) return '0%';
    return `${(val * 100).toFixed(2)}%`;
  };

  // Define financial fields
  const financialFields = useMemo(() => [
    {
      key: 'pricing_financing.price',
      path: 'pricing_financing.price',
      label: 'Purchase Price',
      value: verifiedData?.pricing_financing?.price,
      required: true,
      formatter: formatCurrency
    },
    {
      key: 'pricing_financing.price_per_unit',
      path: 'pricing_financing.price_per_unit',
      label: 'Price Per Unit',
      value: verifiedData?.pricing_financing?.price_per_unit,
      formatter: formatCurrency
    },
    {
      key: 'pnl.gross_potential_rent',
      path: 'pnl.gross_potential_rent',
      label: 'Gross Potential Rent (Annual)',
      value: verifiedData?.pnl?.gross_potential_rent,
      required: true,
      formatter: formatCurrency
    },
    {
      key: 'pnl.other_income',
      path: 'pnl.other_income',
      label: 'Other Income (Annual)',
      value: verifiedData?.pnl?.other_income,
      formatter: formatCurrency
    },
    {
      key: 'pnl.vacancy_rate',
      path: 'pnl.vacancy_rate',
      label: 'Vacancy Rate',
      value: verifiedData?.pnl?.vacancy_rate,
      formatter: formatPercent
    },
    {
      key: 'pnl.effective_gross_income',
      path: 'pnl.effective_gross_income',
      label: 'Effective Gross Income',
      value: verifiedData?.pnl?.effective_gross_income,
      formatter: formatCurrency
    },
    {
      key: 'pnl.operating_expenses_t12',
      path: 'pnl.operating_expenses_t12',
      label: 'Operating Expenses (T12)',
      value: verifiedData?.pnl?.operating_expenses_t12,
      required: true,
      formatter: formatCurrency
    },
    {
      key: 'pnl.noi_t12',
      path: 'pnl.noi_t12',
      label: 'Net Operating Income (T12)',
      value: verifiedData?.pnl?.noi_t12,
      required: true,
      formatter: formatCurrency
    },
    {
      key: 'pnl.noi_proforma',
      path: 'pnl.noi_proforma',
      label: 'Net Operating Income (Pro Forma)',
      value: verifiedData?.pnl?.noi_proforma,
      formatter: formatCurrency
    },
    {
      key: 'pnl.cap_rate_t12',
      path: 'pnl.cap_rate_t12',
      label: 'Cap Rate (T12)',
      value: verifiedData?.pnl?.cap_rate_t12,
      formatter: formatPercent
    },
    {
      key: 'pnl.cap_rate_proforma',
      path: 'pnl.cap_rate_proforma',
      label: 'Cap Rate (Pro Forma)',
      value: verifiedData?.pnl?.cap_rate_proforma,
      formatter: formatPercent
    },
    {
      key: 'pnl.expense_ratio_t12',
      path: 'pnl.expense_ratio_t12',
      label: 'Expense Ratio (T12)',
      value: verifiedData?.pnl?.expense_ratio_t12,
      formatter: formatPercent
    }
  ], [verifiedData]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 32
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <DollarSign size={24} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
            Financial Data
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
            Review extracted financial metrics and income/expense data
          </p>
        </div>
      </div>

      <ExtractedFieldsTable
        fields={financialFields}
        confidence={confidence}
        onViewSource={onViewSource}
        onFieldChange={onFieldChange}
        onResolveConflict={onResolveConflict}
      />

      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#fef3c7',
        borderRadius: 8,
        border: '1px solid #fcd34d',
        fontSize: 13,
        color: '#92400e'
      }}>
        <strong>Note:</strong> T12 metrics represent actual trailing 12-month performance. 
        Pro Forma metrics are broker projections and should be verified carefully.
      </div>
    </div>
  );
}
