// Financial Data wizard tab 
// Shows extracted income summary, full expense breakdown, and NOI/cap rate metrics

import React, { useMemo, useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import ExtractedFieldsTable from '../ExtractedFieldsTable';

export default function FinancialDataWizardTab({
  verifiedData,
  confidence = {},
  onViewSource,
  onSelectValue,
  onEditValue,
  onUpdateExpenses
}) {
  const [editingExpense, setEditingExpense] = useState(null);
  const [editExpenseValue, setEditExpenseValue] = useState('');
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(true);
  
  const formatCurrency = (val) => {
    if (!val && val !== 0) return '$0';
    return `$${Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  
  const formatPercent = (val) => {
    if (val === null || val === undefined) return '0%';
    const pct = val > 1 ? val : val * 100;
    return `${pct.toFixed(2)}%`;
  };

  const totalUnits = verifiedData?.property?.units || 1;
  const expenses = verifiedData?.expenses || {};

  // Expense line items from the OM
  const expenseLineItems = [
    { key: 'taxes', label: 'Real Estate Taxes', icon: '🏛️' },
    { key: 'insurance', label: 'Insurance', icon: '🛡️' },
    { key: 'management', label: 'Property Management', icon: '👔' },
    { key: 'utilities', label: 'Utilities (Electric, Water, Sewer, Trash)', icon: '💡' },
    { key: 'repairs_maintenance', label: 'Repairs & Maintenance', icon: '🔧' },
    { key: 'payroll', label: 'Payroll / Contract Services', icon: '👷' },
    { key: 'admin', label: 'General & Administrative', icon: '📋' },
    { key: 'marketing', label: 'Marketing / Advertising', icon: '📢' },
    { key: 'other', label: 'Other / Miscellaneous', icon: '📦' }
  ];

  const expenseTotal = expenseLineItems.reduce((sum, item) => sum + (Number(expenses[item.key]) || 0), 0);
  const hasExpenseBreakdown = expenseLineItems.some(item => expenses[item.key] > 0);

  // ===== AUTO-CALC DERIVED FIELDS =====
  const gpr = Number(verifiedData?.pnl?.gross_potential_rent) || 0;
  const noiT12 = Number(verifiedData?.pnl?.noi_t12) || 0;
  const opexT12 = Number(verifiedData?.pnl?.operating_expenses_t12) || 0;
  const price = Number(verifiedData?.pricing_financing?.price) || 0;
  const pricePerUnit = Number(verifiedData?.pricing_financing?.price_per_unit) || 0;
  const capRateT12 = Number(verifiedData?.pnl?.cap_rate_t12) || 0;

  const autoCalcs = useMemo(() => {
    const calcs = [];

    // If GPR and NOI exist but OpEx is missing → OpEx = GPR - NOI
    if (gpr > 0 && noiT12 > 0 && !opexT12) {
      calcs.push({
        id: 'calc_opex',
        label: 'Operating Expenses (T12)',
        formula: 'GPR − NOI',
        value: gpr - noiT12,
        targetPath: 'pnl.operating_expenses_t12'
      });
    }

    // If GPR and OpEx exist but NOI is missing → NOI = GPR - OpEx
    if (gpr > 0 && opexT12 > 0 && !noiT12) {
      calcs.push({
        id: 'calc_noi',
        label: 'Net Operating Income (T12)',
        formula: 'GPR − OpEx',
        value: gpr - opexT12,
        targetPath: 'pnl.noi_t12'
      });
    }

    // If Purchase Price and Units exist but Price/Unit is missing
    if (price > 0 && totalUnits > 1 && !pricePerUnit) {
      calcs.push({
        id: 'calc_ppu',
        label: 'Price Per Unit',
        formula: 'Price ÷ Units',
        value: Math.round(price / totalUnits),
        targetPath: 'pricing_financing.price_per_unit'
      });
    }

    // If NOI and Price exist but Cap Rate is missing
    if (noiT12 > 0 && price > 0 && !capRateT12) {
      calcs.push({
        id: 'calc_cap',
        label: 'Cap Rate (T12)',
        formula: 'NOI ÷ Price',
        value: noiT12 / price,
        targetPath: 'pnl.cap_rate_t12'
      });
    }

    // If OpEx and NOI exist but GPR is missing → GPR = OpEx + NOI
    if (!gpr && opexT12 > 0 && noiT12 > 0) {
      calcs.push({
        id: 'calc_gpr',
        label: 'Gross Potential Rent',
        formula: 'OpEx + NOI',
        value: opexT12 + noiT12,
        targetPath: 'pnl.gross_potential_rent'
      });
    }

    return calcs;
  }, [gpr, noiT12, opexT12, price, totalUnits, pricePerUnit, capRateT12]);

  const applyAutoCalc = (calc) => {
    if (onEditValue) {
      onEditValue({ path: calc.targetPath, key: calc.targetPath, label: calc.label }, calc.value);
    }
  };

  const applyAllAutoCalcs = () => {
    autoCalcs.forEach(calc => applyAutoCalc(calc));
  };

  const startEditExpense = (key, val) => {
    setEditingExpense(key);
    setEditExpenseValue(val !== null && val !== undefined ? String(val) : '0');
  };

  const confirmEditExpense = (key) => {
    if (onUpdateExpenses) {
      const numVal = parseFloat(editExpenseValue) || 0;
      onUpdateExpenses(key, numVal);
    }
    setEditingExpense(null);
    setEditExpenseValue('');
  };

  const cancelEditExpense = () => {
    setEditingExpense(null);
    setEditExpenseValue('');
  };

  // Income summary fields
  const incomeFields = useMemo(() => [
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
    }
  ], [verifiedData]);

  // Pricing & metrics fields
  const metricsFields = useMemo(() => [
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
      key: 'pnl.operating_expenses_t12',
      path: 'pnl.operating_expenses_t12',
      label: 'Total Operating Expenses (T12)',
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

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 32,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '2px solid #e5e7eb'
  };

  const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 800,
    color: '#111827',
    margin: 0
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 32
    }}>
      {/* Header */}
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
            Review extracted income, expenses, and operating metrics from the OM
          </p>
        </div>
      </div>

      {/* ===== INCOME SUMMARY ===== */}
      <div style={sectionHeaderStyle}>
        <span style={{ fontSize: 20 }}>💰</span>
        <h3 style={sectionTitleStyle}>Income Summary</h3>
      </div>
      <ExtractedFieldsTable
        fields={incomeFields}
        confidence={confidence}
        onViewSource={onViewSource}
        onSelectValue={onSelectValue}
        onEditValue={onEditValue}
      />

      {/* ===== AUTO-CALC SUGGESTIONS ===== */}
      {autoCalcs.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: 16,
          background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
          borderRadius: 12,
          border: '1px solid #93c5fd'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🧮</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>Auto-Calculated Fields Available</span>
            </div>
            {autoCalcs.length > 1 && (
              <button
                onClick={applyAllAutoCalcs}
                style={{
                  padding: '6px 14px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Apply All
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {autoCalcs.map(calc => (
              <div key={calc.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{calc.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Formula: {calc.formula} = <strong>{calc.targetPath.includes('cap_rate') ? formatPercent(calc.value) : formatCurrency(calc.value)}</strong>
                  </div>
                </div>
                <button
                  onClick={() => applyAutoCalc(calc)}
                  style={{
                    padding: '6px 16px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== OPERATING EXPENSE BREAKDOWN ===== */}
      <div style={{ ...sectionHeaderStyle, cursor: 'pointer' }} onClick={() => setShowExpenseBreakdown(prev => !prev)}>
        <span style={{ fontSize: 20 }}>📊</span>
        <h3 style={{ ...sectionTitleStyle, flex: 1 }}>
          Operating Expense Breakdown
          {hasExpenseBreakdown && (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginLeft: 12 }}>
              Total: {formatCurrency(expenseTotal)}
            </span>
          )}
        </h3>
        {showExpenseBreakdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
      </div>

      {showExpenseBreakdown && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {/* Expense table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 80px',
            padding: '12px 16px',
            background: '#f9fafb',
            borderBottom: '2px solid #e5e7eb',
            fontSize: 11,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <div>Expense Category</div>
            <div style={{ textAlign: 'right' }}>Annual Amount</div>
            <div style={{ textAlign: 'right' }}>Per Unit</div>
            <div style={{ textAlign: 'center' }}>Edit</div>
          </div>

          {/* Expense line items */}
          {expenseLineItems.map((item, idx) => {
            const val = Number(expenses[item.key]) || 0;
            const isEditing = editingExpense === item.key;
            const perUnit = totalUnits > 0 ? Math.round(val / totalUnits) : 0;
            const pctOfTotal = expenseTotal > 0 ? ((val / expenseTotal) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={item.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 80px',
                  padding: '12px 16px',
                  borderBottom: idx < expenseLineItems.length - 1 ? '1px solid #f3f4f6' : 'none',
                  alignItems: 'center',
                  background: val > 0 ? '#fff' : '#fafafa',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={(e) => e.currentTarget.style.background = val > 0 ? '#fff' : '#fafafa'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {item.label}
                    </div>
                    {val > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {pctOfTotal}% of total
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <span style={{ color: '#6b7280', fontSize: 14 }}>$</span>
                      <input
                        type="number"
                        value={editExpenseValue}
                        onChange={(e) => setEditExpenseValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmEditExpense(item.key);
                          if (e.key === 'Escape') cancelEditExpense();
                        }}
                        autoFocus
                        style={{
                          padding: '4px 8px',
                          border: '2px solid #3b82f6',
                          borderRadius: 6,
                          fontSize: 14,
                          fontWeight: 600,
                          outline: 'none',
                          width: 100,
                          textAlign: 'right',
                          background: '#eff6ff'
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: val > 0 ? '#111827' : '#d1d5db'
                    }}>
                      {formatCurrency(val)}
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                  {val > 0 ? `$${perUnit.toLocaleString()}/unit` : '—'}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => confirmEditExpense(item.key)}
                        style={{ padding: 4, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', display: 'flex' }}
                      >
                        <Check size={14} color="#16a34a" />
                      </button>
                      <button
                        onClick={cancelEditExpense}
                        style={{ padding: 4, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'flex' }}
                      >
                        <X size={14} color="#dc2626" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditExpense(item.key, val)}
                      style={{
                        padding: 4,
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        opacity: 0.6,
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      <Pencil size={12} color="#6b7280" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 80px',
            padding: '14px 16px',
            borderTop: '2px solid #111827',
            background: '#f9fafb',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
              Total Operating Expenses
            </div>
            <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {formatCurrency(expenseTotal)}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#374151' }}>
              {totalUnits > 0 ? `$${Math.round(expenseTotal / totalUnits).toLocaleString()}/unit` : '—'}
            </div>
            <div />
          </div>
        </div>
      )}

      {!hasExpenseBreakdown && showExpenseBreakdown && (
        <div style={{
          padding: 20,
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: 14,
          background: '#f9fafb',
          borderRadius: 8,
          border: '1px dashed #d1d5db',
          marginTop: 8
        }}>
          No expense breakdown was extracted. Click the pencil icon to enter values manually.
        </div>
      )}

      {/* ===== NOI & KEY METRICS ===== */}
      <div style={sectionHeaderStyle}>
        <span style={{ fontSize: 20 }}>📈</span>
        <h3 style={sectionTitleStyle}>NOI & Key Metrics</h3>
      </div>
      <ExtractedFieldsTable
        fields={metricsFields}
        confidence={confidence}
        onViewSource={onViewSource}
        onSelectValue={onSelectValue}
        onEditValue={onEditValue}
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
        {hasExpenseBreakdown && expenseTotal > 0 && verifiedData?.pnl?.operating_expenses_t12 && 
          Math.abs(expenseTotal - verifiedData.pnl.operating_expenses_t12) > 100 && (
          <div style={{ marginTop: 8 }}>
            <strong>⚠️ Discrepancy:</strong> Expense breakdown total ({formatCurrency(expenseTotal)}) differs from 
            T12 Operating Expenses ({formatCurrency(verifiedData.pnl.operating_expenses_t12)}). 
            Please verify the line items.
          </div>
        )}
      </div>
    </div>
  );
}
