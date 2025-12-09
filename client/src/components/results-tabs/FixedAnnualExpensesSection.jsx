import React from 'react';

export default function FixedAnnualExpensesSection({ scenarioData, onEditData, labelStyle, inputStyle }) {
  const expensesData = scenarioData.expenses || {};

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Real Estate Taxes</label>
        <input type="number" style={inputStyle} value={expensesData.taxes || ''} onChange={(e) => onEditData && onEditData('expenses.taxes', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Insurance</label>
        <input type="number" style={inputStyle} value={expensesData.insurance || ''} onChange={(e) => onEditData && onEditData('expenses.insurance', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Repairs & Maintenance</label>
        <input type="number" style={inputStyle} value={expensesData.repairs || ''} onChange={(e) => onEditData && onEditData('expenses.repairs', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Management Fees</label>
        <input type="number" style={inputStyle} value={expensesData.management || ''} onChange={(e) => onEditData && onEditData('expenses.management', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Payroll</label>
        <input type="number" style={inputStyle} value={expensesData.payroll || ''} onChange={(e) => onEditData && onEditData('expenses.payroll', parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label style={labelStyle}>Other Expenses</label>
        <input type="number" style={inputStyle} value={expensesData.other || ''} onChange={(e) => onEditData && onEditData('expenses.other', parseFloat(e.target.value) || 0)} />
      </div>
    </div>
  );
}
