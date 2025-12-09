import React from 'react';

export default function ClosingCostsSection({ scenarioData, onEditData, labelStyle, inputStyle }) {
  const cc = scenarioData.closing_costs || {};

  const total = (
    (cc.legal_fees || 0) +
    (cc.attorney_fees || 0) +
    (cc.sec_filings || 0) +
    (cc.title_policy || 0) +
    (cc.survey || 0) +
    (cc.recording || 0) +
    (cc.transfer_taxes || 0) +
    (cc.title_processing || 0) +
    (cc.title_search || 0) +
    (cc.lender_reserves || 0) +
    (cc.tax_reserves || 0) +
    (cc.insurance_reserves || 0) +
    (cc.cost_seg || 0) +
    (cc.phase1 || 0) +
    (cc.appraisal || 0) +
    (cc.inspections || 0)
  );

  return (
    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Legal Fees</label>
        <input type="number" style={inputStyle} value={cc.legal_fees || ''} onChange={(e) => onEditData && onEditData('closing_costs.legal_fees', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Attorney Fees</label>
        <input type="number" style={inputStyle} value={cc.attorney_fees || ''} onChange={(e) => onEditData && onEditData('closing_costs.attorney_fees', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>SEC Filings</label>
        <input type="number" style={inputStyle} value={cc.sec_filings || ''} onChange={(e) => onEditData && onEditData('closing_costs.sec_filings', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Title Policy</label>
        <input type="number" style={inputStyle} value={cc.title_policy || ''} onChange={(e) => onEditData && onEditData('closing_costs.title_policy', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Survey</label>
        <input type="number" style={inputStyle} value={cc.survey || ''} onChange={(e) => onEditData && onEditData('closing_costs.survey', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Recording</label>
        <input type="number" style={inputStyle} value={cc.recording || ''} onChange={(e) => onEditData && onEditData('closing_costs.recording', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Transfer Taxes</label>
        <input type="number" style={inputStyle} value={cc.transfer_taxes || ''} onChange={(e) => onEditData && onEditData('closing_costs.transfer_taxes', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Title Processing</label>
        <input type="number" style={inputStyle} value={cc.title_processing || ''} onChange={(e) => onEditData && onEditData('closing_costs.title_processing', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Title Search</label>
        <input type="number" style={inputStyle} value={cc.title_search || ''} onChange={(e) => onEditData && onEditData('closing_costs.title_search', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>Lender Reserves</label>
        <input type="number" style={inputStyle} value={cc.lender_reserves || ''} onChange={(e) => onEditData && onEditData('closing_costs.lender_reserves', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>RE Taxes (6 mo)</label>
        <input type="number" style={inputStyle} value={cc.tax_reserves || ''} onChange={(e) => onEditData && onEditData('closing_costs.tax_reserves', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Insurance (12 mo)</label>
        <input type="number" style={inputStyle} value={cc.insurance_reserves || ''} onChange={(e) => onEditData && onEditData('closing_costs.insurance_reserves', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Cost Seg Study</label>
        <input type="number" style={inputStyle} value={cc.cost_seg || ''} onChange={(e) => onEditData && onEditData('closing_costs.cost_seg', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Phase 1 / Enviro</label>
        <input type="number" style={inputStyle} value={cc.phase1 || ''} onChange={(e) => onEditData && onEditData('closing_costs.phase1', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Appraisal</label>
        <input type="number" style={inputStyle} value={cc.appraisal || ''} onChange={(e) => onEditData && onEditData('closing_costs.appraisal', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Inspections</label>
        <input type="number" style={inputStyle} value={cc.inspections || ''} onChange={(e) => onEditData && onEditData('closing_costs.inspections', parseFloat(e.target.value) || 0)} />
      </div>
      <div style={{ padding: '14px', background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', fontSize: '13px', color: 'white' }}>Total</span>
          <span style={{ fontWeight: '700', fontSize: '18px', color: 'white' }}>${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
