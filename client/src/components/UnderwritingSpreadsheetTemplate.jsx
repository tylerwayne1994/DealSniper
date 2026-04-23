import React, { useState, useMemo } from 'react';
import { Download, Copy, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Multi-sheet underwriting spreadsheet template
 * Displays preset structure with data populated from parsed deal
 * User can edit cells, Claude auto-fills via AI
 */

const UnderwritingSpreadsheetTemplate = ({ dealData = {}, onCellChange = () => {}, isLoading = false }) => {
  const [activeSheet, setActiveSheet] = useState('Executive Summary');
  const [cellEdits, setCellEdits] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const sheets = [
    'Executive Summary',
    'Rent Roll Analysis',
    'Income Analysis',
    'Expense Analysis',
    '10-Year Pro Forma',
    'Returns & Exit Analysis'
  ];

  // Build sheets dynamically
  const sheetData = useMemo(() => ({
    'Executive Summary': generateExecutiveSummary(dealData, cellEdits),
    'Rent Roll Analysis': generateRentRollAnalysis(dealData, cellEdits),
    'Income Analysis': generateIncomeAnalysis(dealData, cellEdits),
    'Expense Analysis': generateExpenseAnalysis(dealData, cellEdits),
    '10-Year Pro Forma': generateProForma(dealData, cellEdits),
    'Returns & Exit Analysis': generateReturnsAnalysis(dealData, cellEdits),
  }), [dealData, cellEdits]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleCellEdit = (cellId, value) => {
    setCellEdits(prev => ({ ...prev, [cellId]: value }));
    onCellChange({ cellId, value, sheet: activeSheet });
  };

  const renderSheet = (sheet) => {
    const data = sheetData[sheet];
    if (!data || !data.rows) return null;

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          border: '1px solid #d1d5db',
          backgroundColor: '#ffffff'
        }}>
          <thead style={{ backgroundColor: '#1a237e', color: 'white' }}>
            <tr>
              {data.columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    borderRight: idx < data.columns.length - 1 ? '1px solid #e5e7eb' : 'none',
                    minWidth: `${data.columnWidths?.[idx] || 120}px`
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => {
              const sectionId = `${sheet}-${rowIdx}`;
              const isSection = row.isSection;
              const isExpanded = expandedSections[sectionId] !== false;

              if (isSection) {
                return (
                  <tr
                    key={rowIdx}
                    style={{
                      backgroundColor: '#f5f5f5',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSection(sectionId)}
                  >
                    <td colSpan={data.columns.length} style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {row.label}
                    </td>
                  </tr>
                );
              }

              if (!isExpanded && rowIdx > 0 && data.rows[rowIdx - 1]?.isSection) {
                return null;
              }

              const isSectionRow = rowIdx > 0 && data.rows[rowIdx - 1]?.isSection;
              if (!isSectionRow && rowIdx > 0 && !isExpanded) {
                const prevSection = data.rows.slice(0, rowIdx).reverse().find(r => r.isSection);
                const prevSectionIdx = data.rows.indexOf(prevSection);
                if (prevSectionIdx >= 0) {
                  const sectionId = `${sheet}-${prevSectionIdx}`;
                  if (!expandedSections[sectionId] && expandedSections[sectionId] !== undefined) {
                    return null;
                  }
                }
              }

              return (
                <tr
                  key={rowIdx}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  {row.cells.map((cell, cellIdx) => {
                    const cellId = `${sheet}-${rowIdx}-${cellIdx}`;
                    const isEditable = cell.editable !== false;
                    const displayValue = cellEdits[cellId] ?? cell.value ?? '';
                    const isNumber = cell.format === 'currency' || cell.format === 'percent' || cell.format === 'number';

                    return (
                      <td
                        key={cellIdx}
                        style={{
                          padding: '10px 12px',
                          textAlign: isNumber ? 'right' : 'left',
                          borderRight: cellIdx < row.cells.length - 1 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: isEditable ? '#e3f2fd' : 'transparent',
                          fontWeight: cell.bold ? 600 : 400,
                          color: cell.color || '#111827',
                          fontStyle: cell.italic ? 'italic' : 'normal'
                        }}
                      >
                        {isEditable ? (
                          <input
                            type={isNumber ? 'text' : 'text'}
                            value={displayValue}
                            onChange={(e) => handleCellEdit(cellId, e.target.value)}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              outline: 'none',
                              fontFamily: isNumber ? 'monospace' : 'inherit',
                              textAlign: isNumber ? 'right' : 'left',
                              color: 'inherit',
                              fontSize: 'inherit'
                            }}
                          />
                        ) : (
                          formatCellDisplay(displayValue, cell.format)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {/* Sheet tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        overflowX: 'auto',
        padding: '0 16px'
      }}>
        {sheets.map((sheet) => (
          <button
            key={sheet}
            onClick={() => setActiveSheet(sheet)}
            style={{
              padding: '12px 16px',
              borderBottom: activeSheet === sheet ? '3px solid #1a237e' : 'none',
              backgroundColor: activeSheet === sheet ? '#ffffff' : 'transparent',
              fontWeight: activeSheet === sheet ? 600 : 400,
              color: activeSheet === sheet ? '#1a237e' : '#6b7280',
              cursor: 'pointer',
              border: 'none',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = activeSheet === sheet ? '#ffffff' : 'transparent'}
          >
            {sheet}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          {activeSheet}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#6b7280'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            <Copy size={14} />
            Copy
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#6b7280'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Sheet content */}
      <div style={{ padding: '16px', overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
        {renderSheet(activeSheet)}
      </div>
    </div>
  );
};

// ============================================================================
// Sheet Generators
// ============================================================================

function generateExecutiveSummary(data, edits) {
  const get = (key) => edits[`Executive Summary-${key}`] ?? data[key] ?? '';
  
  return {
    columns: ['A', 'B', 'C', 'D'],
    columnWidths: [35, 20, 20, 20],
    rows: [
      {
        isSection: true,
        label: '2916 E MONROE ST - PHOENIX, AZ | EXECUTIVE SUMMARY'
      },
      {
        cells: [
          { value: 'PROPERTY OVERVIEW', bold: true, editable: false },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Address' },
          { value: get('address'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Property Type' },
          { value: get('propertyType') || 'Multifamily', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Year Built' },
          { value: get('yearBuilt'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Total Units' },
          { value: get('totalUnits'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Total SF' },
          { value: get('totalSF'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Occupancy' },
          { value: get('occupancy'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'PURCHASE ASSUMPTIONS'
      },
      {
        cells: [
          { value: 'Purchase Price' },
          { value: get('purchasePrice'), format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Closing Costs (3%)' },
          { value: get('closingCosts'), format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Total Acquisition Cost' },
          { value: get('totalAcquisition'), format: 'currency', bold: true, editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'FINANCING ASSUMPTIONS'
      },
      {
        cells: [
          { value: 'Loan Amount' },
          { value: get('loanAmount'), format: 'currency', editable: true },
          { value: '75% LTV', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Down Payment' },
          { value: get('downPayment'), format: 'currency', editable: true },
          { value: '25%', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Interest Rate' },
          { value: get('interestRate'), format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Annual Debt Service' },
          { value: get('annualDebtService'), format: 'currency', bold: true, editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'YEAR 1 PERFORMANCE'
      },
      {
        cells: [
          { value: 'Gross Potential Rent' },
          { value: get('gpr'), format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Effective Gross Income' },
          { value: get('egi'), format: 'currency', bold: true, editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Operating Expenses' },
          { value: get('opex'), format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Net Operating Income' },
          { value: get('noi'), format: 'currency', bold: true, editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'RETURNS ANALYSIS'
      },
      {
        cells: [
          { value: 'Cap Rate on Purchase' },
          { value: get('capRate'), format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Debt Service Coverage Ratio' },
          { value: get('dscr'), editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Cash on Cash Return' },
          { value: get('coc'), format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      }
    ]
  };
}

function generateRentRollAnalysis(data, edits) {
  return {
    columns: ['Unit', 'Type', 'SF', 'Current Rent', 'Current $/SF', 'Market Rent', 'Market $/SF', 'Upside'],
    columnWidths: [12, 12, 10, 15, 15, 15, 15, 15],
    rows: [
      {
        isSection: true,
        label: 'RENT ROLL ANALYSIS'
      },
      {
        cells: [
          { value: 'Unit', bold: true, editable: false },
          { value: 'Type', bold: true, editable: false },
          { value: 'SF', bold: true, editable: false },
          { value: 'Current Rent', bold: true, editable: false },
          { value: '$/SF', bold: true, editable: false },
          { value: 'Market Rent', bold: true, editable: false },
          { value: '$/SF', bold: true, editable: false },
          { value: 'Upside', bold: true, editable: false }
        ]
      },
      ...Array(10).fill(null).map((_, i) => ({
        cells: [
          { value: edits[`Rent Roll Analysis-unit-${i}`] ?? '', editable: true },
          { value: edits[`Rent Roll Analysis-type-${i}`] ?? '', editable: true },
          { value: edits[`Rent Roll Analysis-sf-${i}`] ?? '', format: 'number', editable: true },
          { value: edits[`Rent Roll Analysis-currentRent-${i}`] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: edits[`Rent Roll Analysis-marketRent-${i}`] ?? '', format: 'currency', editable: true },
          { value: '', format: 'number', editable: false },
          { value: '', format: 'currency', editable: false }
        ]
      }))
    ]
  };
}

function generateIncomeAnalysis(data, edits) {
  return {
    columns: ['', 'T-12 Actual', 'Year 1 Pro Forma', 'Stabilized', 'Notes'],
    columnWidths: [30, 18, 18, 18, 40],
    rows: [
      {
        isSection: true,
        label: 'INCOME ANALYSIS'
      },
      {
        cells: [
          { value: 'Gross Potential Rent', bold: true, editable: false },
          { value: edits['Income Analysis-gpr-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-gpr-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-gpr-stab'] ?? '', format: 'currency', editable: true },
          { value: 'Base rents at market', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Vacancy (5%)', editable: false },
          { value: edits['Income Analysis-vac-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-vac-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-vac-stab'] ?? '', format: 'currency', editable: true },
          { value: 'Market standard', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Net Rental Income', bold: true, editable: false },
          { value: edits['Income Analysis-nri-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-nri-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-nri-stab'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'OTHER INCOME'
      },
      {
        cells: [
          { value: 'Laundry Income' },
          { value: edits['Income Analysis-laundry-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-laundry-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-laundry-stab'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Effective Gross Income', bold: true, editable: false },
          { value: edits['Income Analysis-egi-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-egi-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Income Analysis-egi-stab'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false }
        ]
      }
    ]
  };
}

function generateExpenseAnalysis(data, edits) {
  return {
    columns: ['', 'T-12 Actual', '$/Unit', 'Year 1 PF', '$/Unit', 'Notes'],
    columnWidths: [30, 15, 12, 15, 12, 40],
    rows: [
      {
        isSection: true,
        label: 'OPERATING EXPENSE ANALYSIS'
      },
      {
        isSection: true,
        label: 'CONTROLLABLE EXPENSES'
      },
      {
        cells: [
          { value: 'Repairs & Maintenance' },
          { value: edits['Expense Analysis-repairs-t12'] ?? '', format: 'currency', editable: true },
          { value: edits['Expense Analysis-repairs-unit'] ?? '', format: 'currency', editable: false },
          { value: edits['Expense Analysis-repairs-pf'] ?? '', format: 'currency', editable: true },
          { value: edits['Expense Analysis-repairs-pf-unit'] ?? '', format: 'currency', editable: false },
          { value: 'Normalize to $500/unit', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'NON-CONTROLLABLE EXPENSES'
      },
      {
        cells: [
          { value: 'Property Management (6%)' },
          { value: edits['Expense Analysis-mgmt-t12'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: edits['Expense Analysis-mgmt-pf'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: 'Standard at 6% of EGI', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Insurance' },
          { value: edits['Expense Analysis-ins-t12'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: edits['Expense Analysis-ins-pf'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: '⚠️ Verify quote', color: '#dc2626', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Real Estate Taxes' },
          { value: edits['Expense Analysis-tax-t12'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: edits['Expense Analysis-tax-pf'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: '⚠️ Will reassess at sale', color: '#dc2626', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'TOTAL OPERATING EXPENSES'
      },
      {
        cells: [
          { value: 'Total w/ CapEx', bold: true, editable: false },
          { value: edits['Expense Analysis-total-t12'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: edits['Expense Analysis-total-pf'] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: 'Includes $375/unit CapEx', color: '#059669', editable: false }
        ]
      }
    ]
  };
}

function generateProForma(data, edits) {
  return {
    columns: ['', 'Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
    columnWidths: [25, 12, 12, 12, 12, 12, 12],
    rows: [
      {
        isSection: true,
        label: '10-YEAR CASH FLOW PRO FORMA'
      },
      {
        isSection: true,
        label: 'INCOME'
      },
      ...Array(5).fill(null).map((_, i) => ({
        cells: [
          { value: `Year ${i} Income` },
          { value: i === 0 ? '' : edits[`Pro Forma-income-${i}`] ?? '', format: 'currency', editable: true },
          { value: '', format: 'currency', editable: false },
          { value: '', format: 'currency', editable: false },
          { value: '', format: 'currency', editable: false },
          { value: '', format: 'currency', editable: false },
          { value: '', format: 'currency', editable: false }
        ]
      })),
      {
        isSection: true,
        label: 'EXPENSES & CASH FLOW'
      },
      ...Array(3).fill(null).map((_, i) => ({
        cells: [
          { value: `Metric ${i + 1}` },
          { value: '', editable: true },
          { value: '', editable: true },
          { value: '', editable: true },
          { value: '', editable: true },
          { value: '', editable: true },
          { value: '', editable: true }
        ]
      }))
    ]
  };
}

function generateReturnsAnalysis(data, edits) {
  return {
    columns: ['A', 'B', 'C', 'D', 'E'],
    columnWidths: [30, 18, 18, 18, 40],
    rows: [
      {
        isSection: true,
        label: 'RETURNS & EXIT ANALYSIS'
      },
      {
        isSection: true,
        label: 'INITIAL INVESTMENT'
      },
      {
        cells: [
          { value: 'Purchase Price' },
          { value: edits['Returns-purchase'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Down Payment (25%)' },
          { value: edits['Returns-downpayment'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: 'YEAR 1 RETURNS'
      },
      {
        cells: [
          { value: 'Net Operating Income' },
          { value: edits['Returns-noi'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Cap Rate' },
          { value: edits['Returns-caprate'] ?? '', format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Cash on Cash Return' },
          { value: edits['Returns-coc'] ?? '', format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        isSection: true,
        label: '5-YEAR EXIT'
      },
      {
        cells: [
          { value: 'Exit Cap Rate Assumption' },
          { value: edits['Returns-exitcap'] ?? '', format: 'percent', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Year 5 Projected Sale Price' },
          { value: edits['Returns-exitprice'] ?? '', format: 'currency', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      },
      {
        cells: [
          { value: 'Equity Multiple' },
          { value: edits['Returns-equitymult'] ?? '', editable: true },
          { value: '', editable: false },
          { value: '', editable: false },
          { value: '', editable: false }
        ]
      }
    ]
  };
}

function formatCellDisplay(value, format) {
  if (!value) return '';
  if (format === 'currency') {
    return typeof value === 'number' 
      ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : String(value).startsWith('$') ? String(value) : `$${value}`;
  }
  if (format === 'percent') {
    return typeof value === 'number' 
      ? `${(value * 100).toFixed(2)}%`
      : String(value).endsWith('%') ? String(value) : `${value}%`;
  }
  if (format === 'number') {
    return typeof value === 'number' 
      ? value.toLocaleString('en-US')
      : String(value);
  }
  return String(value);
}

export default UnderwritingSpreadsheetTemplate;
