import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Home, Database, Layers, MessageSquare, Bell, Users, Activity, TrendingUp, BarChart2, Share2, X, Upload, AlertCircle, Loader, Rocket, CheckCircle, FileText, File, FileSpreadsheet } from 'lucide-react';
import { DEBT_FIELDS_MENU, computeUnderwritingFromCells } from '../utils/underwritingCalculations';
import DealStructureTab from '../components/results-tabs/DealStructureTab';
import MarketResearchTab from '../components/results-tabs/MarketResearchTab';
import RentRollTab from '../components/results-tabs/RentRollTab';
import WaterfallTab from '../components/results-tabs/WaterfallTab';
import DealOrNoDealTab from '../components/results-tabs/DealOrNoDealTab';
import ExpensesTab from '../components/results-tabs/ExpensesTab';
import ValueAddTab from '../components/results-tabs/ValueAddTab';
import ExitStrategyTab from '../components/results-tabs/ExitStrategyTab';
import AmortizationTab from '../components/results-tabs/AmortizationTab';
import DealExecutionTab from '../components/results-tabs/DealExecutionTab';
import { CostSegAnalysisView } from '../components/CostSegAnalysis';
import SummaryTab from '../components/results-tabs/SummaryTab';
import PropertySpreadsheet from '../components/PropertySpreadsheet';
import { SHEET_API_BASE } from './UnderwritingAIChatAPI';
import { saveDeal, loadDeal } from '../lib/dealsService';
import { mapParsedDataToSpreadsheet } from '../utils/propertySpreadsheetMapper';
// Removed unused GoogleSheetsSpreadsheet import

const API_BASE = 'http://127.0.0.1:8010';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  },
  appCard: {
    width: '100%',
    height: '100vh',
    margin: 0,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    boxShadow: 'none',
    display: 'flex',
    overflow: 'hidden',
  },
  iconSidebar: {
    width: 56,
    backgroundColor: '#111827',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
    boxSizing: 'border-box',
    gap: 10,
  },
  logoBoxOuter: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBoxInner: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  iconButton: (active = false) => ({
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    color: active ? '#ffffff' : '#9ca3af',
    backgroundColor: active ? '#374151' : 'transparent',
    cursor: 'pointer',
  }),
  segmentsCol: {
    width: 120,
    backgroundColor: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
  },
  segmentsHeader: {
    height: 40,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6b7280',
  },
  segmentsRow: (highlight = false) => ({
    height: 30,
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 11,
    color: highlight ? '#111827' : '#6b7280',
    fontWeight: highlight ? 600 : 400,
    backgroundColor: highlight ? '#ffffff' : 'transparent',
    cursor: 'pointer',
  }),
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  topBar: {
    height: 56,
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    boxSizing: 'border-box',
  },
  topBarLogo: {
    display: 'flex',
    alignItems: 'center',
  },
  topLogoMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  topTabs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 24,
    marginLeft: 32,
    fontSize: 13,
  },
  topTab: (active = false) => ({
    paddingBottom: 10,
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    color: active ? '#2563eb' : '#6b7280',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
  }),
  topRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: (dark = false) => ({
    width: 30,
    height: 30,
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? '#000000' : '#e5e7eb',
    color: dark ? '#ffffff' : '#4b5563',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }),
  debtSelectWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 10,
    color: '#6b7280',
  },
  debtSelect: {
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  debtCell: {
    padding: '6px 10px',
    borderRight: '1px solid #e5e7eb',
    textAlign: 'left',
    fontSize: 11,
    color: '#111827',
  },
  debtFieldList: {
    marginTop: 4,
    fontSize: 10,
    color: '#4b5563',
  },
  debtFieldItem: {
    lineHeight: 1.3,
  },
  expenseSplitCell: {
    display: 'flex',
    alignItems: 'center',
  },
  expenseSplitLeft: {
    flex: 1,
    paddingRight: 4,
    boxSizing: 'border-box',
  },
  expenseSplitRight: {
    flex: 1,
    paddingLeft: 4,
    marginLeft: 4,
    boxSizing: 'border-box',
    borderLeft: '1px solid #e5e7eb',
  },
  expenseSplitHeaderText: {
    fontSize: 10,
    color: '#6b7280',
  },
  headerBar: {
    borderBottom: '1px solid #e5e7eb',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  headerButtons: {
    display: 'flex',
    gap: 8,
  },
  smallDarkButton: {
    padding: '6px 12px',
    borderRadius: 6,
    backgroundColor: '#000000',
    color: '#ffffff',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  tableWrapper: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
  },
  tableHeadRow: {
    backgroundColor: '#000000',
    color: '#ffffff',
  },
  th: {
    padding: '6px 8px',
    borderRight: '1px solid #374151',
    fontWeight: 500,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  thLeft: {
    padding: '6px 10px',
    borderRight: '1px solid #374151',
    fontWeight: 500,
    textAlign: 'left',
  },
  rowBase: {
    borderBottom: '1px solid #e5e7eb',
  },
  cellIndex: {
    padding: '6px 6px',
    borderRight: '1px solid #e5e7eb',
    textAlign: 'center',
    color: '#9ca3af',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  cellPremises: {
    padding: '6px 10px',
    borderRight: '1px solid #e5e7eb',
    color: '#111827',
  },
  cellNumber: {
    padding: '6px 10px',
    borderRight: '1px solid #e5e7eb',
    textAlign: 'right',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    color: '#111827',
  },
  cellInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    textAlign: 'right',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 11,
    color: '#111827',
  },
  greenText: {
    color: '#16a34a',
    fontWeight: 600,
  },
  aiSidebar: {
    width: 320,
    minWidth: 320,
    maxWidth: 320,
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  aiHeader: {
    padding: '10px 14px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    fontWeight: 600,
    color: '#111827',
  },
  aiBody: {
    flex: 1,
    padding: '12px 14px',
    overflowY: 'auto',
    minHeight: 0,
  },
  chatMessages: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  aiTag: {
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    padding: '8px 10px',
    fontSize: 11,
    color: '#111827',
    marginBottom: 8,
  },
  aiFooter: {
    borderTop: '1px solid #e5e7eb',
    padding: '10px 14px 12px',
    backgroundColor: '#f9fafb',
  },
  aiPrimary: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    backgroundColor: '#111827',
    color: '#ffffff',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 8,
  },
  aiRowButtons: {
    display: 'flex',
    gap: 6,
  },
  aiSecondary: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 6,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  templateToggle: {
    display: 'inline-flex',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    backgroundColor: '#f3f4f6',
    padding: 2,
    marginRight: 12,
  },
  templateButton: (active = false) => ({
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    border: 'none',
    backgroundColor: active ? '#ffffff' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    cursor: 'pointer',
  }),
  uploadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    backgroundColor: '#111827',
    color: '#f9fafb',
    border: 'none',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.2s ease-out',
  },
  modalCard: {
    width: 520,
    maxWidth: '90vw',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    animation: 'slideUp 0.3s ease-out',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6',
    background: 'linear-gradient(to bottom, #ffffff, #fafafa)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    letterSpacing: '-0.01em',
  },
  modalBody: {
    padding: '24px',
    fontSize: 13,
    color: '#6b7280',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid #f3f4f6',
    background: '#fafafa',
  },
  modalSecondary: {
    padding: '10px 18px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'all 0.15s ease',
  },
  modalPrimary: {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#ffffff',
    transition: 'all 0.15s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  uploadDropzone: (isDragging) => ({
    border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
    borderRadius: 12,
    padding: 32,
    textAlign: 'center',
    backgroundColor: isDragging ? '#eff6ff' : '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
  }),
  uploadIcon: {
    width: 48,
    height: 48,
    margin: '0 auto 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    color: '#3b82f6',
  },
  fileInfo: {
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2563eb',
    flexShrink: 0,
  },
};

// Sidebar icon with hover label
const SidebarIcon = ({ icon: Icon, label, active = false, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={styles.iconButton(active)}>
        <Icon size={18} />
      </div>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: 44,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#111827',
            color: '#f9fafb',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

// Removed TopTabButton component; top tabs were redundant with left menu
// Multifamily template rows (all fields listed in the spec)
const MULTIFAMILY_ROWS = [
  { id: 1, premises: 'PROPERTY INFO', isSection: true },
  { id: 2, premises: 'Property Address' },

  { id: 3, premises: 'PURCHASE DETAILS', isSection: true },
  { id: 4, premises: 'Purchase Price' },
  { id: 5, premises: 'Down Payment (with % calculation)' },
  { id: 6, premises: 'Commissions (%)' },
  { id: 7, premises: 'Closing Fees (%)' },
  { id: 8, premises: 'Assignment Fee (%)' },
  { id: 9, premises: 'Improvements' },
  { id: 10, premises: 'Cash to seller' },
  { id: 11, premises: 'Total Acquisition' },

  // Taxes and insurance moved directly under Purchase Details
  // Operating expenses (including moved taxes/insurance)
  { id: 12, premises: 'EXPENSES', isSection: true },
  { id: 13, premises: 'Taxes (monthly)' },
  { id: 14, premises: 'Insurance (monthly)' },
  { id: 15, premises: 'Gas' },
  { id: 16, premises: 'Electric' },
  { id: 17, premises: 'Sewer' },
  { id: 18, premises: 'Water' },
  { id: 19, premises: 'Trash' },
  { id: 20, premises: 'Lawn care / snow removal' },
  { id: 21, premises: 'Cap ex (%)' },
  { id: 22, premises: 'Property management (%)' },
  { id: 23, premises: 'Vacancy (%)' },

  { id: 24, premises: 'Total Gross Rental Income' },
  { id: 25, premises: 'Other' },
  { id: 26, premises: 'Total income (monthly)' },
  { id: 27, premises: 'Total income (annually)' },

  { id: 31, premises: 'VALUE ANALYSIS', isSection: true },
  { id: 32, premises: 'Purchase Cap Rate' },
  { id: 33, premises: 'Market Cap Rate' },
  { id: 34, premises: 'AS-IS Value' },
  { id: 35, premises: 'ARV Value' },

  { id: 36, premises: 'CASHFLOW ANALYSIS', isSection: true },
  { id: 37, premises: 'Net Operating Income (monthly)' },
  { id: 38, premises: 'Net Operating Income (annually)' },
  { id: 39, premises: 'Debt Service (monthly)' },
  { id: 40, premises: 'Debt Service (annually)' },
  { id: 41, premises: 'Net Income (formula)' },

  { id: 42, premises: 'INVESTMENT ANALYSIS', isSection: true },
  { id: 43, premises: 'CASH-ON-CASH ROI' },
  // Land value and Depreciation write-off removed

  { id: 46, premises: 'VALUE ADD ANALYSIS', isSection: true },
  { id: 47, premises: 'Raised Rent ($/Unit)' },
  { id: 48, premises: 'Cap Rate (%)' },
  { id: 49, premises: 'Unit Count' },
  { id: 50, premises: 'Rehab Cost/(Unit $)' },
  { id: 51, premises: 'Value Add/(Unit $) (formula)' },
  { id: 52, premises: 'Total Value Add ($) (formula)' },
  { id: 53, premises: 'Total Rehab Cost ($) (formula)' },
  { id: 54, premises: 'Equity Created ($) (formula)' },
  { id: 55, premises: 'ROI on Rehab (%) (formula)' },
  { id: 56, premises: '$1 spent earned (formula)' },
  { id: 57, premises: 'New Price/Unit (formula)' },

  { id: 58, premises: 'RENT ANALYSIS', isSection: true },
  { id: 59, premises: 'Gross Rent' },
  { id: 60, premises: 'Management Fee (%)' },
  { id: 61, premises: 'Management Fee (amount)' },
  { id: 62, premises: 'Maintenance Fee (%)' },
  { id: 63, premises: 'Maintenance Fee (amount)' },
  { id: 64, premises: 'Insurance (amount + %)' },
  { id: 65, premises: 'Property Taxes (amount + %)' },
  { id: 66, premises: 'Vacancy Reserve (amount + %)' },
  { id: 67, premises: 'Utilities (amount + %)' },
  { id: 68, premises: 'Maintenance (amount + %)' },
  { id: 69, premises: 'Monthly NOI (formula)' },
  { id: 70, premises: 'Yearly NOI (formula)' },

  { id: 71, premises: 'UNIT MIX', isSection: true },
  { id: 72, premises: 'Studio (Units)' },
  { id: 73, premises: 'Studio (Rent)' },
  { id: 74, premises: 'Studio (Total formula)' },
  { id: 75, premises: '1 bdrm (Units)' },
  { id: 76, premises: '1 bdrm (Rent)' },
  { id: 77, premises: '1 bdrm (Total formula)' },
  { id: 78, premises: '2 bdrm (Units)' },
  { id: 79, premises: '2 bdrm (Rent)' },
  { id: 80, premises: '2 bdrm (Total formula)' },
  { id: 81, premises: '3 bdrm (Units)' },
  { id: 82, premises: '3 bdrm (Rent)' },
  { id: 83, premises: '3 bdrm (Total formula)' },
  { id: 84, premises: 'UNIT MIX TOTAL (sum formula)' },
  { id: 112, premises: 'SUBJECT-TO PURCHASE', isSection: true },
  { id: 113, premises: 'SubTo Loan Balance' },
  { id: 114, premises: 'Reinstatement/legal' },
  { id: 115, premises: 'Commissions' },
  { id: 116, premises: 'Closing Fees' },
  { id: 117, premises: 'Assignment fee' },
  { id: 118, premises: 'Cash to seller' },
  { id: 119, premises: 'Improvements' },
  { id: 120, premises: 'Other' },
  { id: 121, premises: 'Total Acquisition' },
  { id: 122, premises: 'Seller Carry/Private Loan' },
  { id: 123, premises: 'Entry Fee (Cash)' },

  { id: 124, premises: 'DEBT SERVICE (Subject-To)', isSection: true },
  { id: 125, premises: 'SubTo Loan Balance' },
  { id: 126, premises: 'Interest rate' },
  { id: 127, premises: 'Period in years' },
  { id: 128, premises: 'Period in years remaining' },
  { id: 129, premises: 'Balloon in yrs' },
  { id: 130, premises: 'Start date loan takeover' },
  { id: 131, premises: 'Monthly pymt (PI)' },
  { id: 132, premises: '2nd Position Loan' },
  { id: 133, premises: 'Interest-only rate' },
  { id: 134, premises: 'Period in years (2nd)' },
  { id: 135, premises: 'Balloon in yrs (2nd)' },
  { id: 136, premises: 'Start date loan (2nd)' },
  { id: 137, premises: 'Monthly pymt (2nd)' },
  { id: 138, premises: 'Total debt service monthly' },
  { id: 139, premises: 'Total debt service annual' },

  { id: 140, premises: 'SELLER CARRY', isSection: true },
  { id: 141, premises: 'Seller Carry Loan 1' },
  { id: 142, premises: 'Private Loan 2' },
  { id: 143, premises: 'Entry Fee (Cash)' },
];

// Placeholder industrial template (can be filled out later)
const INDUSTRIAL_ROWS = [
  { id: 1, premises: 'INDUSTRIAL TEMPLATE (coming soon)', isSection: true },
];

// Debt type ranges within MULTIFAMILY_ROWS
const DEBT_TYPE_CONFIG = {
  traditional: { label: 'Traditional', ranges: [] },
  'seller-finance': { label: 'Seller Finance', ranges: [] },
  hybrid: { label: 'Hybrid (SubTo / Seller Finance)', ranges: [[112, 139]] },
  'subject-to': { label: 'Subject-To', ranges: [[112, 139]] },
  'seller-carry': { label: 'Seller Carry', ranges: [[140, 143]] },
  'equity-partner': { label: 'Equity Partner', ranges: [[140, 143]] }, // placeholder: shares seller-carry block
};

// Unit type rows used for rent breakdown in Passport column
const UNIT_TYPE_ROWS = {
  17: 'Studio',
  18: '1 bed',
  19: '2 bed',
  20: '3 bed',
};

// Income labels shown in Passport column starting at row 22
const PASSPORT_INCOME_ROWS = {
  22: 'Total Gross Rental Income',
  23: 'Other',
  24: 'Total income (monthly)',
  25: 'Total income (annually)',
};

// VALUE ADD ANALYSIS labels shown in Passport column starting at row 31
const PASSPORT_VALUE_ADD_ROWS = {
  31: 'VALUE ADD ANALYSIS',
  32: 'Raised Rent ($/Unit)',
  33: 'Cap Rate (%)',
  34: 'Unit Count',
  35: 'Rehab Cost/(Unit $)',
  36: 'Value Add/(Unit $)',
  37: 'Total Value Add ($)',
  38: 'Total Rehab Cost ($)',
  39: 'Equity Created ($)',
  40: 'ROI on Rehab (%)',
  41: '$1 spent earned',
  42: 'New Price/Unit',
  43: 'value add noi',
};

function buildMultifamilyRows(debtType) {
  const baseRows = MULTIFAMILY_ROWS.filter((row) => row.id < 85);
  const config = DEBT_TYPE_CONFIG[debtType] || DEBT_TYPE_CONFIG['seller-finance'];

  const debtRows = MULTIFAMILY_ROWS.filter((row) =>
    config.ranges.some(([start, end]) => row.id >= start && row.id <= end)
  );

  return [...baseRows, ...debtRows];
}

function UnderwritingTablePage({ initialScenarioData, initialCalculations }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  const [template, setTemplate] = useState('multifamily');
  const [debtType, setDebtType] = useState('seller-finance');
  const [activeSegment, setActiveSegment] = useState('Property');
  const [percentSelections, setPercentSelections] = useState({});
  const [proformaPercentSelections, setProformaPercentSelections] = useState({});
  const [cellValues, setCellValues] = useState({});
  const [interestOnlyFlags, setInterestOnlyFlags] = useState({});
  const [computedValues, setComputedValues] = useState({});
  const [isInitializedFromScenario, setIsInitializedFromScenario] = useState(false);
  const [uploadedScenarioData, setUploadedScenarioData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  // Deal + RentCast state (mirrors UnderwriteV2/ResultsPageV2 behavior)
  const [dealId, setDealId] = useState(null);
  // Removed unused RentCast loading state
  // Removed unused rentcast data state

  // Upload / parse state (OM or spreadsheet)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Push to Pipeline state
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  
  // Spreadsheet zoom state
  // Removed unused spreadsheet zoom state

  // Chat state for the AI sidebar
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content:
        'Ask me anything about this deal or tell me to run a stress test (e.g., "What happens if vacancy goes to 12%?" or "Increase interest rate by 1% and tell me if the deal still works.")',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  const spreadsheetRef = useRef(null);

  // Load deal from pipeline if viewDeal URL param exists
  useEffect(() => {
    const viewDealId = searchParams.get('viewDeal');
    if (viewDealId) {
      const loadDealFromPipeline = async () => {
        try {
          console.log('[VIEW DEAL] Loading deal from pipeline:', viewDealId);
          const dealData = await loadDeal(viewDealId);
          
          if (dealData) {
            console.log('[VIEW DEAL] Loaded deal data:', dealData);
            setDealId(viewDealId);
            setUploadedScenarioData(dealData.scenarioData || dealData.parsedData);
          } else {
            console.error('[VIEW DEAL] Deal not found in pipeline');
            alert('Deal not found. It may have been deleted.');
            navigate('/pipeline');
          }
        } catch (error) {
          console.error('[VIEW DEAL] Error loading deal:', error);
          alert('Error loading deal: ' + error.message);
          navigate('/pipeline');
        }
      };
      
      loadDealFromPipeline();
    }
  }, [searchParams, navigate]);
  
  // Handle location state from pipeline navigation
  useEffect(() => {
    if (location.state?.scenarioData) {
      console.log('[LOCATION STATE] Loading deal from state');
      setDealId(location.state.dealId);
      setUploadedScenarioData(location.state.scenarioData);
    }
  }, [location.state]);

  const spreadsheetData =
    template === 'multifamily' ? buildMultifamilyRows(debtType) : INDUSTRIAL_ROWS;

  const segments = [
    'Summary',
    'Deal Structure',
    'Deal Execution',
    'Property',
    'Expenses',
    'Value-Add Strategy',
    'Exit Strategy',
    'Amortization',
    'Rent Roll',
    'Syndication',
    'Cost Segregation',
    'Market Data',
    'Deal or No Deal',
  ];

  // Handle Max AI commands for spreadsheet
  const handleSpreadsheetCommand = async (message) => {
    // Try direct command parse first; if recognized, enqueue to backend relay for Luckysheet
    const direct = parseDirectCellEdit(message);
    if (direct) {
      const sid = getMaxSessionId();
      await enqueueMaxCommands(sid, [direct]);
      return { success: true, operations: [direct] };
    }

    // Fallback to AI command generator (used by x-data spreadsheet flows)
    try {
      const sheetState = spreadsheetRef.current?.getData?.() || null;
      const response = await fetch(`${API_BASE}/api/spreadsheet/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          propertyData: uploadedScenarioData || initialScenarioData,
          sheetState
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.detail || result?.error || `Spreadsheet command failed (${response.status})`);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Spreadsheet command failed');
      }

      if (result.success && result.operations) {
        // If Luckysheet is active, prefer backend relay; otherwise apply to x-data spreadsheet
        const sid = getMaxSessionId();
        console.log('[SPREADSHEET CMD] AI generated operations:', result.operations);
        const maxOps = normalizeOpsToMax(result.operations);
        console.log('[SPREADSHEET CMD] Normalized to Max commands:', maxOps);
        if (maxOps.length === 0) {
          console.warn('[SPREADSHEET CMD] No commands to enqueue after normalization!');
        }
        await enqueueMaxCommands(sid, maxOps);
        console.log('[SPREADSHEET CMD] Command handling complete');
        return result;
      } else {
        throw new Error(result?.error || 'No operations returned');
      }
    } catch (error) {
      console.error('Error sending spreadsheet command:', error);
      throw error;
    }
  };

  // Removed unused spreadsheet change handler

  const isSpreadsheetInstruction = (text) => {
    const t = (text || '').trim().toLowerCase();
    if (!t) return false;

    // Purely numeric / trivial messages should never trigger sheet edits.
    if (/^\d+(\.\d+)?$/.test(t)) return false;

    // Explicit prefixes always route to spreadsheet
    if (t.startsWith('/sheet') || t.startsWith('/spreadsheet') || t.startsWith('/edit')) return true;

    // Comprehensive action verbs - any modification/creation/manipulation intent
    const actions = [
      // Creation/Addition
      'build', 'create', 'generate', 'make', 'add', 'insert', 'populate', 'fill',
      // Modification
      'set', 'update', 'change', 'modify', 'write', 'edit', 'put', 'type', 'enter', 'input', 
      'place', 'drop', 'paste', 'assign', 'apply',
      // Deletion/Clearing
      'clear', 'delete', 'remove', 'erase', 'wipe', 'reset',
      // Formatting
      'format', 'style', 'color', 'bold', 'merge', 'align', 'highlight',
      // Calculation/Analysis
      'calculate', 'compute', 'sum', 'total', 'average', 'formula',
      'stress test', 'run stress', 'analyze', 'model',
      // Numerical changes
      'increase', 'decrease', 'grow', 'reduce', 'adjust', 'multiply', 'divide',
      'raise', 'lower', 'bump', 'scale'
    ];

    // Domain keywords - anything spreadsheet/data related
    const domains = [
      // Spreadsheet terms
      'sheet', 'spreadsheet', 'cell', 'cells', 'row', 'rows', 'column', 'columns', 'col', 'cols',
      'table', 'tab', 'formula', 'formulas', 'value', 'values', 'number', 'numbers', 'data',
      'field', 'fields', 'range', 'grid',
      // Real estate/underwriting specific
      'underwriting', 'model', 'rent roll', 'unit mix', 'revenue', 'revenues', 'income',
      'expenses', 'expense', 'operating', 'capex', 'cap ex',
      'noi', 'dscr', 'irr', 'coc', 'cash on cash', 'equity multiple', 'waterfall', 'sensitivity',
      'financing', 'loan', 'debt', 'equity', 'returns',
      'vacancy', 'occupancy', 'interest rate', 'rent growth', 'expense growth', 'cap rate',
      'price', 'purchase price', 'sale price', 'units', 'sqft', 'square feet',
      'assumption', 'assumptions', 'projection', 'projections', 'scenario', 'scenarios'
    ];

    const hasAction = actions.some((k) => t.includes(k));
    const hasDomain = domains.some((k) => t.includes(k));
    
    // Cell reference detection (A1, B2, AA10, etc. or ranges like A1:B5)
    const hasA1Ref = /\b([a-z]{1,2}\d{1,5})(?=[\s,.;!?]|$)/i.test(t) || 
                     /\b([a-z]{1,2}\d{1,5}:[a-z]{1,2}\d{1,5})\b/i.test(t);
    
    // Preposition + cell patterns: "in E10", "to E10", "into cell B5", "at A1"
    const hasCellPreposition = /\b(in|to|into|at|on)\s+(cell\s+)?[a-z]{1,2}\d{1,5}\b/i.test(t);
    
    // Value assignment patterns: "X = Y", "set X to Y", "make X equal Y"
    const hasAssignment = /\b(=|equals?|equal to)\b/i.test(t) && (hasA1Ref || hasDomain);
    
    // Questions usually shouldn't edit, unless they explicitly mention editing
    if (t.endsWith('?')) {
      const explicitEditQuestion = /\b(can you|could you|will you|please)\s+(set|change|update|edit|put|enter|add|create|build|make)\b/i.test(t);
      return explicitEditQuestion || (hasAction && hasDomain && hasA1Ref);
    }

    // Imperative/command patterns (no subject, starts with verb)
    const startsWithAction = actions.some(action => {
      const words = t.split(/\s+/);
      return words[0] === action || (words.length > 1 && words[0] + ' ' + words[1] === action);
    });

    // Strong signals: action + (domain OR cell ref OR preposition pattern OR assignment)
    if (hasAction && (hasDomain || hasA1Ref || hasCellPreposition || hasAssignment)) {
      return true;
    }

    // Fallback: imperative command with cell reference
    if (startsWithAction && (hasA1Ref || hasCellPreposition)) {
      return true;
    }

    return false;
  };

  // --- Helpers for Max relay ---
  const getMaxSessionId = () => {
    try {
      return localStorage.getItem('maxSessionId') || '';
    } catch (_) {
      return '';
    }
  };

  const enqueueMaxCommands = async (sessionId, commands) => {
    if (!sessionId) throw new Error('Missing maxSessionId');
    console.log('[ENQUEUE] Enqueuing commands:', commands.length, 'commands for session:', sessionId);
    console.log('[ENQUEUE] Commands:', JSON.stringify(commands, null, 2));
    const res = await fetch('/api/spreadsheet/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, commands })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[ENQUEUE] Failed to enqueue:', err);
      throw new Error(err?.detail || `Enqueue failed (${res.status})`);
    }
    console.log('[ENQUEUE] Successfully enqueued commands');
  };

  const parseDirectCellEdit = (msg) => {
    // Examples: "write hello in E10", "set E10 to 123", "update cell B2 = world"
    const t = (msg || '').trim();
    const m1 = t.match(/write\s+(.+?)\s+in\s+([A-Za-z]+\d+)/i);
    const m2 = t.match(/set\s+([A-Za-z]+\d+)\s+(?:to\s+|=)\s*(.+)/i);
    const m = m1 || m2;
    if (!m) return null;
    const value = m1 ? m1[1] : m2[2];
    const a1 = m1 ? m1[2] : m2[1];
    return { type: 'set_value', a1, value };
  };

  const normalizeOpsToMax = (ops) => {
    // Convert generic operations into Max commands; supports set_value, set_formula, set_key_value, set_key_formula
    const cmds = [];
    (ops || []).forEach((op) => {
      console.log('[NORMALIZE DEBUG] Operation type:', op.type, 'Full op:', op);
      if (op.type === 'setCells' && Array.isArray(op.data?.cells)) {
        op.data.cells.forEach((cell) => {
          if (cell?.a1) cmds.push({ type: 'set_value', a1: cell.a1, value: cell.value });
        });
      } else if (op.type === 'setFormula' && Array.isArray(op.data?.cells)) {
        op.data.cells.forEach((cell) => {
          if (cell?.a1) cmds.push({ type: 'set_formula', a1: cell.a1, formula: cell.formula });
        });
      } else if (op.type === 'set_value' || op.type === 'set_formula' || op.type === 'set_key_value' || op.type === 'set_key_formula') {
        // Direct pass-through for Max-compatible commands
        cmds.push(op);
      } else {
        console.warn('[NORMALIZE DEBUG] Unknown operation type, skipping:', op.type);
      }
    });
    console.log('[NORMALIZE DEBUG] Normalized commands:', cmds);
    return cmds;
  };

  const getCellValue = (rowId, key) => cellValues[`${rowId}-${key}`] ?? '';

  const handleCellChange = (rowId, key, value) => {
    setCellValues((prev) => ({ ...prev, [`${rowId}-${key}`]: value }));
  };

  const handleScenarioFieldChange = (path, value) => {
    setUploadedScenarioData((prev) => {
      const base = prev || initialScenarioData || {};
      const updated = JSON.parse(JSON.stringify(base));
      const parts = path.split('.');
      let cursor = updated;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (cursor[key] == null || typeof cursor[key] !== 'object') {
          cursor[key] = {};
        }
        cursor = cursor[key];
      }
      cursor[parts[parts.length - 1]] = value;
      return updated;
    });
  };

  const toggleInterestOnly = (debtKey, index) => {
    const flagKey = `${debtKey}-${index}`;
    setInterestOnlyFlags((prev) => ({ ...prev, [flagKey]: !prev[flagKey] }));
  };

  const handleClearFields = () => {
    setCellValues({});
    setPercentSelections({});
    setProformaPercentSelections({});
    setInterestOnlyFlags({});
    setIsInitializedFromScenario(false);
  };

  // Removed LuckyExcel functions - no longer needed

  // Removed template loading - no longer needed

  // One-time initialization from scenarioData/calculations when embedded in ResultsPageV2
  useEffect(() => {
    const sd = uploadedScenarioData || initialScenarioData;
    if (!sd || isInitializedFromScenario) return;

    const nextCellValues = {};

    try {
      const property = sd.property || {};
      const pf = sd.pricing_financing || {};
      const pnl = sd.pnl || {};
      const expenses = sd.expenses || {};
      const unitMix = sd.unit_mix || [];

      const setCell = (rowId, key, value) => {
        if (value === undefined || value === null) return;
        if (Number.isNaN(value)) return;
        nextCellValues[`${rowId}-${key}`] = value;
      };

      // Property address (row 2) – combine address, city, state, zip into one line
      if (property && (property.address || property.city || property.state || property.zip)) {
        const parts = [];
        if (property.address) parts.push(property.address);
        const cityStateZip = [property.city, property.state, property.zip].filter(Boolean).join(', ');
        if (cityStateZip) parts.push(cityStateZip);
        const fullAddress = parts.join(' | ');
        if (fullAddress) {
          setCell(2, 'm', fullAddress);
        }
      }

      // Purchase details (rows 4-9)
      setCell(4, 'm', pf.price || pf.purchase_price || 0);
      if (pf.down_payment) setCell(5, 'm', pf.down_payment);
      if (pf.commissions) setCell(6, 'm', pf.commissions);
      if (pf.closing_costs) setCell(7, 'm', pf.closing_costs);
      if (pf.assignment_fee) setCell(8, 'm', pf.assignment_fee);
      if (pf.improvements) setCell(9, 'm', pf.improvements);

      // Income (treat pnl.gross_potential_rent as annual)
      const annualGpr = pnl.gross_potential_rent || pnl.potential_gross_income || 0;
      const otherAnnual = pnl.other_income || 0;
      const monthlyGpr = annualGpr / 12;
      const monthlyOther = otherAnnual / 12;
      const totalMonthlyIncome = monthlyGpr + monthlyOther;
      const totalAnnualIncome = annualGpr + otherAnnual;

      setCell(24, 'm', monthlyGpr || 0);
      setCell(25, 'm', monthlyOther || 0);
      setCell(26, 'm', totalMonthlyIncome || 0);
      setCell(27, 'm', totalAnnualIncome || 0);

      // Basic expenses mapping (monthly approximations)
      const annualTaxes = expenses.taxes || 0;
      const annualInsurance = expenses.insurance || 0;
      const annualGas = expenses.gas || 0;
      const annualElectric = expenses.electrical || expenses.electric || 0;
      // Removed unused annualSewer
      const annualWater = expenses.water || 0;
      const annualTrash = expenses.trash || 0;
      const annualUtilities = expenses.utilities || 0;
      const annualRepairs = expenses.repairs_maintenance || 0;

      // Map what we have into the closest rows in the model
      setCell(13, 'm-current', annualTaxes / 12 || 0); // Taxes (monthly)
      setCell(14, 'm-current', annualInsurance / 12 || 0); // Insurance (monthly)

      // If the parser only gives a single utilities bucket, map it
      // into Gas first, then leave Electric/Water/Trash available
      // for more detailed mappings in the future.
      const utilitiesPerMonth = annualUtilities / 12 || 0;
      if (utilitiesPerMonth) {
        setCell(15, 'm-current', utilitiesPerMonth);
      } else {
        setCell(15, 'm-current', annualGas / 12 || 0);
        setCell(16, 'm-current', annualElectric / 12 || 0);
        setCell(18, 'm-current', annualWater / 12 || 0);
        setCell(19, 'm-current', annualTrash / 12 || 0);
      }

      // Use repairs/maintenance as the closest match for lawn care/snow
      if (annualRepairs) {
        setCell(20, 'm-current', annualRepairs / 12 || 0);
      }

      // Vacancy as % – support decimal (0.05), percent (5), or basis points (500)
      if (typeof pnl.vacancy_rate === 'number' && !Number.isNaN(pnl.vacancy_rate)) {
        let vr = pnl.vacancy_rate;
        if (vr <= 1) vr = vr * 100; // decimal
        else if (vr > 100) vr = vr / 100; // basis points
        setPercentSelections((prev) => ({ ...prev, 23: vr }));
      }

      const effectiveGrossIncome =
        pnl.effective_gross_income || pnl.potential_gross_income || annualGpr + otherAnnual || 0;

      // Management and CapEx % – derive from dollars if rates missing
      let capexRate = typeof expenses.capex_rate === 'number' ? expenses.capex_rate : null;
      let managementRate = typeof expenses.management_rate === 'number' ? expenses.management_rate : null;

      if (managementRate == null && expenses.management && effectiveGrossIncome) {
        managementRate = (expenses.management / effectiveGrossIncome) * 100;
      }
      if (capexRate == null && expenses.repairs_maintenance && effectiveGrossIncome) {
        capexRate = (expenses.repairs_maintenance / effectiveGrossIncome) * 100;
      }

      if (typeof capexRate === 'number' && !Number.isNaN(capexRate)) {
        setPercentSelections((prev) => ({ ...prev, 21: capexRate }));
      }
      if (typeof managementRate === 'number' && !Number.isNaN(managementRate)) {
        setPercentSelections((prev) => ({ ...prev, 22: managementRate }));
      }

      // VALUE ADD inputs (47-50) from acquisition_costs / underwriting if available
      const acquisition = sd.acquisition_costs || {};
      const valueAdd = sd.value_add || {};
      if (typeof valueAdd.rent_increase_per_unit === 'number') {
        setCell(47, 'm', valueAdd.rent_increase_per_unit);
      }
      if (typeof valueAdd.target_cap_rate === 'number') {
        setCell(48, 'm', valueAdd.target_cap_rate);
      }
      if (typeof valueAdd.unit_count === 'number') {
        setCell(49, 'm', valueAdd.unit_count);
      } else if (typeof sd.property?.units === 'number') {
        setCell(49, 'm', sd.property.units);
      }
      if (typeof acquisition.rehab_cost_per_unit === 'number') {
        setCell(50, 'm', acquisition.rehab_cost_per_unit);
      } else if (typeof acquisition.rehab_cost === 'number' && sd.property?.units) {
        setCell(50, 'm', acquisition.rehab_cost / sd.property.units);
      }

      // UNIT MIX mapping for studio/1/2/3 bed counts and rents
      // - Units still flow into the UNIT MIX block (rows 72/75/78/81)
      // - Current & Market rents now also populate the top grid in columns D/E (rows 17-20)
      if (unitMix.length > 0) {
        const typeBuckets = {
          Studio: { units: 0, currentSum: 0, currentCount: 0, marketSum: 0, marketCount: 0 },
          '1': { units: 0, currentSum: 0, currentCount: 0, marketSum: 0, marketCount: 0 },
          '2': { units: 0, currentSum: 0, currentCount: 0, marketSum: 0, marketCount: 0 },
          '3': { units: 0, currentSum: 0, currentCount: 0, marketSum: 0, marketCount: 0 },
        };

        unitMix.forEach((u) => {
          const label = (u.bedrooms != null ? String(u.bedrooms) : u.type || '').toLowerCase();
          const units = Number(u.units) || 0;

          // Treat *_current as "Current" and *_market as "Market"; fall back to
          // generic rent fields if only one side is present.
          const currentRentRaw =
            u.rent_current ??
            u.current_rent ??
            u.rent ??
            u.monthly_rent ??
            null;
          const marketRentRaw =
            u.rent_market ??
            u.market_rent ??
            null;

          const addToBucket = (key) => {
            const bucket = typeBuckets[key];
            bucket.units += units;

            if (currentRentRaw != null && !Number.isNaN(currentRentRaw)) {
              bucket.currentSum += currentRentRaw;
              bucket.currentCount += 1;
            }
            if (marketRentRaw != null && !Number.isNaN(marketRentRaw) && marketRentRaw !== 0) {
              bucket.marketSum += marketRentRaw;
              bucket.marketCount += 1;
            }
          };

          if (label.includes('studio') || label === '0') addToBucket('Studio');
          else if (label.includes('1') || label.includes('one')) addToBucket('1');
          else if (label.includes('2') || label.includes('two')) addToBucket('2');
          else if (label.includes('3') || label.includes('three')) addToBucket('3');
        });

        const avg = (sum, count) => {
          if (!count) return null;
          return sum / count;
        };

        const studioBucket = typeBuckets.Studio;
        const oneBucket = typeBuckets['1'];
        const twoBucket = typeBuckets['2'];
        const threeBucket = typeBuckets['3'];

        // Units into UNIT MIX summary block (rows 72/75/78/81)
        if (studioBucket.units) setCell(72, 'm', studioBucket.units);
        if (oneBucket.units) setCell(75, 'm', oneBucket.units);
        if (twoBucket.units) setCell(78, 'm', twoBucket.units);
        if (threeBucket.units) setCell(81, 'm', threeBucket.units);

        // Average current and market rents per type
        const studioCurrent = avg(studioBucket.currentSum, studioBucket.currentCount);
        const oneCurrent = avg(oneBucket.currentSum, oneBucket.currentCount);
        const twoCurrent = avg(twoBucket.currentSum, twoBucket.currentCount);
        const threeCurrent = avg(threeBucket.currentSum, threeBucket.currentCount);

        const studioMarket = avg(studioBucket.marketSum, studioBucket.marketCount);
        const oneMarket = avg(oneBucket.marketSum, oneBucket.marketCount);
        const twoMarket = avg(twoBucket.marketSum, twoBucket.marketCount);
        const threeMarket = avg(threeBucket.marketSum, threeBucket.marketCount);

        // Keep UNIT MIX rent rows (73/76/79/82) populated for summary
        if (studioCurrent != null) setCell(73, 'm', studioCurrent);
        if (oneCurrent != null) setCell(76, 'm', oneCurrent);
        if (twoCurrent != null) setCell(79, 'm', twoCurrent);
        if (threeCurrent != null) setCell(82, 'm', threeCurrent);

        // Also populate the top grid: rows 17-20, columns D (Current) and E (Market)
        if (studioCurrent != null) setCell(17, 'breeders', studioCurrent);
        if (oneCurrent != null) setCell(18, 'breeders', oneCurrent);
        if (twoCurrent != null) setCell(19, 'breeders', twoCurrent);
        if (threeCurrent != null) setCell(20, 'breeders', threeCurrent);

        if (studioMarket != null) setCell(17, 'headcom', studioMarket);
        if (oneMarket != null) setCell(18, 'headcom', oneMarket);
        if (twoMarket != null) setCell(19, 'headcom', twoMarket);
        if (threeMarket != null) setCell(20, 'headcom', threeMarket);
      }

      setCellValues((prev) => ({ ...nextCellValues, ...prev }));
      setIsInitializedFromScenario(true);
    } catch (e) {
      console.error('Error initializing sheet from scenario data:', e);
    }
  }, [initialScenarioData, initialCalculations, uploadedScenarioData, isInitializedFromScenario]);

  useEffect(() => {
    const outputs = computeUnderwritingFromCells({
      cellValues,
      percentSelections,
      proformaPercentSelections,
      debtType,
      interestOnlyFlags,
    });
    setComputedValues(outputs);
  }, [cellValues, percentSelections, proformaPercentSelections, debtType, interestOnlyFlags]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const buildSheetStateJson = () => ({
    cellValues,
    percentSelections,
    proformaPercentSelections,
    interestOnlyFlags,
  });

  const buildSheetCalcJson = () => ({
    computedValues,
    debtType,
  });

  const fullCalcs = initialCalculations?.fullAnalysis || initialCalculations || null;

  const activeScenario = uploadedScenarioData || initialScenarioData || null;
  
  const property = activeScenario?.property || {};

  const buildSheetStructure = () => ({
    debtType,
  });

  // Transform parsed API data into scenarioData shape (mirrors key parts of UnderwriteV2 handleCompleteWizard)
  const transformParsedToScenario = (parsed) => {
    const transformedData = JSON.parse(JSON.stringify(parsed || {}));

    if (transformedData.pricing_financing) {
      transformedData.pricing_financing.purchase_price =
        transformedData.pricing_financing.price || transformedData.pricing_financing.purchase_price;
      transformedData.pricing_financing.down_payment_pct =
        transformedData.pricing_financing.down_payment_pct ||
        (transformedData.pricing_financing.down_payment && transformedData.pricing_financing.price
          ? (transformedData.pricing_financing.down_payment / transformedData.pricing_financing.price) * 100
          : 40);

      if (!transformedData.pricing_financing.loan_amount && transformedData.pricing_financing.price) {
        const price = transformedData.pricing_financing.price;
        const downPct = transformedData.pricing_financing.down_payment_pct || 0;
        const ltv = transformedData.pricing_financing.ltv || 0;
        if (downPct > 0) {
          transformedData.pricing_financing.loan_amount = price * (1 - downPct / 100);
        } else if (ltv > 0) {
          transformedData.pricing_financing.loan_amount = price * (ltv / 100);
        }
      }
    }

    if (!transformedData.financing) {
      transformedData.financing = {};
    }

    const pf = transformedData.pricing_financing || {};
    transformedData.financing.ltv = transformedData.financing.ltv || pf.ltv || 75;
    transformedData.financing.interest_rate =
      transformedData.financing.interest_rate || (pf.interest_rate ? pf.interest_rate * 100 : 0) || 6.0;
    transformedData.financing.loan_term_years =
      transformedData.financing.loan_term_years || pf.term_years || 10;
    transformedData.financing.amortization_years =
      transformedData.financing.amortization_years || pf.amortization_years || 30;
    transformedData.financing.io_years = transformedData.financing.io_years || 0;
    transformedData.financing.loan_fees_percent = transformedData.financing.loan_fees_percent || 1.5;

    if (pf.interest_rate && pf.interest_rate > 0) {
      // pricing_financing already stores decimal
    } else if (transformedData.financing.interest_rate > 0) {
      transformedData.pricing_financing = transformedData.pricing_financing || {};
      transformedData.pricing_financing.interest_rate = transformedData.financing.interest_rate / 100;
    }

    if (transformedData.pnl) {
      transformedData.pnl.noi_t12 = transformedData.pnl.noi_t12 || transformedData.pnl.noi || 0;
      transformedData.pnl.noi_proforma = transformedData.pnl.noi_proforma || 0;

      transformedData.pnl.operating_expenses_t12 =
        transformedData.pnl.operating_expenses_t12 || transformedData.pnl.operating_expenses || 0;
      transformedData.pnl.operating_expenses_proforma = transformedData.pnl.operating_expenses_proforma || 0;

      transformedData.pnl.noi = transformedData.pnl.noi_t12;
      transformedData.pnl.operating_expenses = transformedData.pnl.operating_expenses_t12;

      transformedData.pnl.potential_gross_income =
        transformedData.pnl.gross_potential_rent || transformedData.pnl.potential_gross_income || 0;

      // Normalize vacancy_rate to a percentage: support decimal (0.05), percent (5),
      // or basis points (500) coming from the parser.
      let rawVacancy = transformedData.pnl.vacancy_rate;
      if (typeof rawVacancy !== 'number' || Number.isNaN(rawVacancy)) {
        rawVacancy = 5; // default 5%
      }
      let vacancyPct = rawVacancy;
      if (vacancyPct <= 1) vacancyPct *= 100; // decimal → percent
      else if (vacancyPct > 100) vacancyPct /= 100; // basis points → percent
      transformedData.pnl.vacancy_rate = vacancyPct;
    }

    return transformedData;
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    // If on Property tab, route to spreadsheet AI
    if (activeSegment === 'Property') {
      const newMessages = [...chatMessages, { role: 'user', content: trimmed }];
      setChatMessages(newMessages);
      setChatInput('');
      setChatLoading(true);

      try {
        if (isSpreadsheetInstruction(trimmed)) {
          const result = await handleSpreadsheetCommand(trimmed);
          const opsCount = Array.isArray(result?.operations) ? result.operations.length : 0;
          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `✓ Updated spreadsheet (${opsCount} ops).`
            }
          ]);
        } else {
          // Normal partner chat (Max-only, do NOT touch the sheet)
          const response = await fetch(`http://localhost:8010/api/max/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sheet_state_json: buildSheetStateJson(),
              sheet_calc_json: buildSheetCalcJson(),
              sheet_structure: buildSheetStructure(),
              messages: newMessages,
              active_tab: activeSegment,
              scenario_data: activeScenario,
              full_calculations: fullCalcs,
              property_data: property,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Chat failed with status ${response.status}`);
          }

          const data = await response.json();
          const assistantMessage = data.message || { role: 'assistant', content: 'No response from AI.' };
          setChatMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        const errorMessage = {
          role: 'assistant',
          content: 'Failed to execute spreadsheet command: ' + (err?.message || 'unknown error')
        };
        setChatMessages((prev) => [...prev, errorMessage]);
      } finally {
        setChatLoading(false);
      }
      return;
    }

    // Regular chat for other tabs
    const newMessages = [...chatMessages, { role: 'user', content: trimmed }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`http://localhost:8010/api/max/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_state_json: buildSheetStateJson(),
          sheet_calc_json: buildSheetCalcJson(),
          sheet_structure: buildSheetStructure(),
          messages: newMessages,
          active_tab: activeSegment,
          scenario_data: activeScenario,
          full_calculations: fullCalcs,
          property_data: property,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Chat failed with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.message || { role: 'assistant', content: 'No response from AI.' };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content:
          'Sorry, I was unable to process that request. Please try again in a moment. (' +
          (err?.message || 'unknown error') +
          ')',
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // Push to Pipeline Handler
  const handlePushToPipeline = async () => {
    setIsPushing(true);
    
    try {
      const address = property?.address || activeScenario?.property?.address || 'Unknown Address';
      const units = property?.units || property?.total_units || activeScenario?.property?.units || 0;
      const purchasePrice = activeScenario?.pricing_financing?.purchase_price || activeScenario?.pricing_financing?.price || 0;
      const dealStructure = activeScenario?.deal_structure?.recommended || 'Traditional';
      const broker = activeScenario?.broker || {};
      
      await saveDeal({
        dealId: dealId || `deal-${Date.now()}`,
        address,
        units,
        purchasePrice,
        dealStructure,
        parsedData: activeScenario,
        scenarioData: {
          ...activeScenario,
          calculations: fullCalcs
        },
        marketCapRate: null,
        images: activeScenario?.images || [],
        brokerName: broker.name || '',
        brokerPhone: broker.phone || '',
        brokerEmail: broker.email || '',
        notes: ''
      });
      
      // Notify pipeline and map to reload
      window.dispatchEvent(new Event('pipelineDealsUpdated'));
      
      setPushSuccess(true);
      setTimeout(() => setPushSuccess(false), 3000);
    } catch (error) {
      console.error('Error pushing to pipeline:', error);
      alert('Failed to push deal to pipeline: ' + error.message);
    } finally {
      setIsPushing(false);
    }
  };

  // Upload handlers (OM / spreadsheet parsing)
  const handleUploadFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      setUploadFile(files[0]);
      setUploadError('');
    }
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return File;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet;
    if (['pdf'].includes(ext)) return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleParseUpload = async () => {
    if (!uploadFile || isUploading) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`${API_BASE}/v2/deals/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.status}`);
      }

      const data = await response.json();

      // Capture deal id for downstream APIs like RentCast
      if (data.deal_id) {
        setDealId(data.deal_id);
      } else {
        setDealId(null);
      }

      // Deep copy parsed payload and ensure financing defaults (mirrors UnderwriteV2 upload)
      const parsedCopy = JSON.parse(JSON.stringify(data.parsed || {}));
      if (!parsedCopy.financing) {
        parsedCopy.financing = {};
      }
      parsedCopy.financing = {
        ltv: parsedCopy.financing.ltv || 75,
        interest_rate: parsedCopy.financing.interest_rate || 6.0,
        loan_term_years: parsedCopy.financing.loan_term_years || 10,
        amortization_years: parsedCopy.financing.amortization_years || 30,
        io_years: parsedCopy.financing.io_years || 0,
        loan_fees_percent: parsedCopy.financing.loan_fees_percent || 1.5,
        ...parsedCopy.financing,
      };

      const scenario = transformParsedToScenario(parsedCopy);

      // Clear existing sheet and reinitialize from new scenario
      setCellValues({});
      setPercentSelections({});
      setProformaPercentSelections({});
      setInterestOnlyFlags({});
      setIsInitializedFromScenario(false);
      setUploadedScenarioData(scenario);

      // Removed RentCast reset (state removed)

      setShowUploadModal(false);
      setUploadFile(null);

      // AUTO-SEND TO MAX AI: Automatically analyze the deal
      console.log('[AUTO-SEND] Sending parsed data to Max AI for analysis...');
      const aiPrompt = `Underwrite this deal for me and look to see if this is a good deal or not. Analyze the property metrics, financials, NOI projections, cash flow, returns, and provide your professional opinion on whether this is an attractive investment opportunity.`;
      
      const newMessages = [
        ...chatMessages,
        { role: 'user', content: aiPrompt }
      ];
      setChatMessages(newMessages);
      setChatLoading(true);

      try {
        const aiResponse = await fetch(`http://localhost:8010/api/max/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_state_json: buildSheetStateJson(),
            sheet_calc_json: buildSheetCalcJson(),
            sheet_structure: buildSheetStructure(),
            messages: newMessages,
            active_tab: 'Property',
            scenario_data: scenario,
            full_calculations: fullCalcs,
            property_data: parsedCopy,
            parsed_deal_data: data.parsed, // Send full parsed data
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const assistantMessage = aiData.message || { role: 'assistant', content: 'Analysis complete.' };
          setChatMessages((prev) => [...prev, assistantMessage]);
          console.log('[AUTO-SEND] Max AI analysis received:', assistantMessage);
        } else {
          console.error('[AUTO-SEND] Max AI request failed:', aiResponse.status);
        }
      } catch (aiErr) {
        console.error('[AUTO-SEND] Failed to send to Max AI:', aiErr);
        // Don't fail the upload if AI fails
      } finally {
        setChatLoading(false);
      }

    } catch (err) {
      console.error('Upload/parse error:', err);
      setUploadError(err.message || 'Failed to upload and parse document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
      <div style={styles.page}>
      <div style={styles.appCard}>
        {/* Icon sidebar */}
        <div style={styles.iconSidebar}>
          <div style={styles.logoBoxOuter}>
            <div style={styles.logoBoxInner} />
          </div>
          <SidebarIcon
            icon={Home}
            label="Dashboard"
            active={false}
            onClick={() => navigate('/dashboard')}
          />
          <SidebarIcon icon={Database} label="Data" />
          <SidebarIcon icon={Layers} label="Underwrite" active />
          <SidebarIcon icon={MessageSquare} label="Chat" />
          <SidebarIcon icon={Bell} label="Alerts" />
          <SidebarIcon icon={Users} label="Team" />
          <SidebarIcon icon={Activity} label="Performance" />
          <SidebarIcon icon={TrendingUp} label="Markets" />
          <SidebarIcon icon={BarChart2} label="Analytics" />
          <SidebarIcon icon={Share2} label="Share" />
        </div>

        {/* Segments column */}
        <div style={styles.segmentsCol}>
          <div style={styles.segmentsHeader}>Segments</div>
          {segments.map((segment) => (
            <div
              key={segment}
              style={styles.segmentsRow(segment === activeSegment)}
              onClick={() => {
                setActiveSegment(segment);
                if (segment === 'Property') {
                  navigate('/underwrite-table');
                }
              }}
            >
              {segment}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={styles.main}>
          {/* Top bar */}
          <div style={styles.topBar}>
            <div style={styles.topBarLogo}>
              <div style={styles.topLogoMark}>
                <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>U</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Underwriting.ai</span>
            </div>
            {/* Removed duplicate top tabs (left menu already provides navigation) */}
            <div style={styles.topRight}>
              {/* Push to Pipeline Button */}
              <button
                onClick={handlePushToPipeline}
                disabled={isPushing || !activeScenario}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: pushSuccess ? '#10b981' : isPushing ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: isPushing || !activeScenario ? 'not-allowed' : 'pointer',
                  marginRight: '12px',
                  transition: 'all 0.2s',
                  opacity: !activeScenario ? 0.5 : 1
                }}
              >
                {pushSuccess ? (
                  <>
                    <CheckCircle size={14} />
                    Added!
                  </>
                ) : isPushing ? (
                  'Pushing...'
                ) : (
                  <>
                    <Rocket size={14} />
                    Push to Pipeline
                  </>
                )}
              </button>
              <div style={styles.circleButton(false)}>
                <Bell size={14} />
              </div>
              <div style={styles.circleButton(true)}>U</div>
            </div>
          </div>

          {/* Property header */}
          <div style={styles.headerBar}>
            <div>
              <div style={styles.headerTitle}>Underwriting.ai</div>
              <div style={styles.headerSubtitle}>Araprop: O'Rivers Str w Business lot, Q5 2025</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={styles.templateToggle}>
                <button
                  type="button"
                  style={styles.templateButton(template === 'multifamily')}
                  onClick={() => setTemplate('multifamily')}
                >
                  Multifamily
                </button>
                <button
                  type="button"
                  style={styles.templateButton(template === 'industrial')}
                  onClick={() => setTemplate('industrial')}
                >
                  Industrial
                </button>
              </div>
              <div style={styles.debtSelectWrapper}>
                <span>Debt structure</span>
                <select
                  value={debtType}
                  onChange={(e) => setDebtType(e.target.value)}
                  style={styles.debtSelect}
                >
                  <option value="traditional">Traditional</option>
                  <option value="seller-finance">Seller finance</option>
                  <option value="hybrid">Hybrid (SubTo / Seller)</option>
                  <option value="subject-to">Subject-To</option>
                  <option value="seller-carry">Seller carry</option>
                  <option value="equity-partner">Equity partner</option>
                </select>
              </div>
              <div style={styles.headerButtons}>
                <button style={styles.smallDarkButton}>Auto-Fill Model</button>
                <button style={styles.smallDarkButton} onClick={handleClearFields}>
                  Clear fields
                </button>
              </div>
            </div>
          </div>

          {/* Body: table + AI sidebar */}
          <div style={styles.body}>
            {activeSegment === 'Summary' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <SummaryTab
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                  property={activeScenario?.property || {}}
                  marketCapRate={null}
                />
              </div>
            ) : activeSegment === 'Deal Structure' ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DealStructureTab
                  scenarioData={activeScenario}
                  calculations={null}
                  fullCalcs={null}
                  marketCapRate={null}
                />
              </div>
            ) : activeSegment === 'Expenses' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                {typeof ExpensesTab === 'function' ? (
                  <ExpensesTab
                    scenarioData={activeScenario}
                    fullCalcs={fullCalcs}
                    onFieldChange={handleScenarioFieldChange}
                  />
                ) : (
                  <div style={{ padding: 24 }}>
                    <h3 style={{ margin: 0 }}>
                      Expenses view is unavailable. Please refresh and try again.
                    </h3>
                  </div>
                )}
              </div>
            ) : activeSegment === 'Value-Add Strategy' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <ValueAddTab
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                  onFieldChange={handleScenarioFieldChange}
                />
              </div>
            ) : activeSegment === 'Exit Strategy' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <ExitStrategyTab
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                />
              </div>
            ) : activeSegment === 'Amortization' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <AmortizationTab
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                />
              </div>
            ) : activeSegment === 'Deal Execution' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <DealExecutionTab
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                  recommendedStructure={null}
                  selectedStructureMetrics={null}
                />
              </div>
            ) : activeSegment === 'Cost Segregation' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <CostSegAnalysisView
                  dealId={dealId}
                  scenarioData={activeScenario}
                  fullCalcs={fullCalcs}
                />
              </div>
            ) : activeSegment === 'Market Data' ? (
              (() => {
                const property = activeScenario?.property || {};
                const marketZip = property.zip || property.zip_code || '';
                const marketCity = property.city || '';
                const marketState = property.state || '';
                const marketCounty = property.county || '';
                const dealAddress = property.address || '';
                const propertyName = property.property_name || '';

                return (
                  <div style={{ flex: 1, overflow: 'auto', padding: '0 0 0 0' }}>
                    <MarketResearchTab
                      initialZip={marketZip}
                      initialCity={marketCity}
                      initialState={marketState}
                      initialCounty={marketCounty}
                      dealAddress={dealAddress}
                      propertyName={propertyName}
                    />
                  </div>
                );
              })()
            ) : activeSegment === 'Rent Roll' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <RentRollTab
                  scenarioData={activeScenario}
                  dealId={dealId}
                  onUnitMixChange={(updatedUnitMix) => {
                    setUploadedScenarioData((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        unit_mix: updatedUnitMix,
                      };
                    });
                  }}
                />
              </div>
              ) : activeSegment === 'Syndication' ? (
                <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                  <WaterfallTab scenarioData={activeScenario} />
                </div>
              ) : activeSegment === 'Deal or No Deal' ? (
                <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                  <DealOrNoDealTab
                    scenarioData={activeScenario}
                    calculations={initialCalculations || null}
                    dealId={dealId}
                    marketCapRate={null}
                    marketCapRateLoading={false}
                    onPushToPipeline={null}
                    underwritingResult={null}
                    recommendedStructure={null}
                  />
                </div>
            ) : activeSegment === 'Property' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                <PropertySpreadsheet 
                  initialData={uploadedScenarioData ? mapParsedDataToSpreadsheet(uploadedScenarioData) : null}
                />
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeadRow}>
                        <th style={{ ...styles.th, width: 40 }}>#</th>
                        <th style={{ ...styles.thLeft, width: 220 }}>A</th>
                        <th style={{ ...styles.th, width: 150 }}>B</th>
                        <th style={{ ...styles.th, width: 130 }}>C</th>
                        <th style={{ ...styles.th, width: 130 }}>D</th>
                        <th style={{ ...styles.th, width: 130 }}>E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spreadsheetData.map((row, index) => {
                    const isAlt = index % 2 === 1;
                    const backgroundColor = row.isSection
                      ? '#f3f4f6'
                      : row.highlight
                      ? '#f0fdf4'
                      : isAlt
                      ? '#f9fafb'
                      : '#ffffff';

                    const incomeLabel = PASSPORT_INCOME_ROWS[row.id] || null;
                    const valueAddLabel = PASSPORT_VALUE_ADD_ROWS[row.id] || null;

                    const premisesStyle = {
                      ...styles.cellPremises,
                      ...(row.isSection
                        ? {
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            fontSize: 10,
                            color: '#4b5563',
                          }
                        : {}),
                    };

                    const isDebtMenuRow = row.id === 1;
                    const isRentHeaderRow = row.id === 16;
                    const unitTypeLabel = UNIT_TYPE_ROWS[row.id];
                    const isAcquisitionPercentRow = row.id === 6 || row.id === 7 || row.id === 8;
                    const isPercentRow = row.id === 21 || row.id === 22 || row.id === 23;
                    const isExpenseSplitRow = row.id >= 12 && row.id <= 23;
                    const isValueOutputRow =
                      (row.id >= 32 && row.id <= 41) ||
                      row.id === 43 ||
                      (row.id >= 51 && row.id <= 57);
                    const isExpenseHeaderRow = row.id === 12;
                    const isValueAnalysisHeaderRow = row.id === 31;
                    const isNoiRow = row.id === 37 || row.id === 38;
                    const isCapRateRow = row.id === 32 || row.id === 33;
                    const isCocRow = row.id === 43;
                    const isValueAddPercentRow = row.id === 55;
                    const isValueAddGreenRow = row.id >= 51 && row.id <= 57;
                    const isGreenOutputRow = isNoiRow || isCapRateRow || isCocRow || isValueAddGreenRow;

                    const debtFields = DEBT_FIELDS_MENU[debtType] || [];
                    const debtFieldIndex = row.id - 2; // rows 2+ show fields
                    const hasDebtField =
                      !isDebtMenuRow &&
                      !isRentHeaderRow &&
                      !unitTypeLabel &&
                      !isPercentRow &&
                      debtFieldIndex >= 0 &&
                      debtFieldIndex < debtFields.length;

                    const selectedPercent = isPercentRow || isAcquisitionPercentRow
                      ? percentSelections[row.id] || ''
                      : '';
                    const selectedProformaPercent = isPercentRow
                      ? proformaPercentSelections[row.id] || ''
                      : '';

                    // Pre-calc acquisition amounts used for rows 6-11
                    let acquisitionCalc = null;
                    if (row.id >= 6 && row.id <= 11) {
                      const purchasePriceRaw = getCellValue(4, 'm');
                      const downPaymentRaw = getCellValue(5, 'm');
                      const improvementsRaw = getCellValue(9, 'm');

                      const purchasePrice = parseFloat(purchasePriceRaw || '0') || 0;
                      const downPayment = parseFloat(downPaymentRaw || '0') || 0;
                      const improvements = parseFloat(improvementsRaw || '0') || 0;

                      const commissionPct = parseFloat(percentSelections[6] || '0') || 0;
                      const closingPct = parseFloat(percentSelections[7] || '0') || 0;
                      const assignmentPct = parseFloat(percentSelections[8] || '0') || 0;

                      const commissions = purchasePrice * (commissionPct / 100);
                      const closingFees = purchasePrice * (closingPct / 100);
                      const assignmentFee = purchasePrice * (assignmentPct / 100);

                      const cashToSeller = purchasePrice && downPayment ? purchasePrice - downPayment : 0;
                      const totalAcquisition =
                        downPayment + commissions + closingFees + assignmentFee + improvements;

                      acquisitionCalc = {
                        commissions,
                        closingFees,
                        assignmentFee,
                        cashToSeller,
                        totalAcquisition,
                      };
                    }

                    return (
                      <tr key={row.id} style={{ ...styles.rowBase, backgroundColor }}>
                        <td style={styles.cellIndex}>{row.id}</td>
                        <td style={premisesStyle}>
                          {row.premises}
                        </td>
                        <td
                          style={
                            isExpenseSplitRow || isPercentRow || isValueAnalysisHeaderRow
                              ? styles.debtCell
                              : styles.cellNumber
                          }
                        >
                          {isExpenseHeaderRow || isValueAnalysisHeaderRow ? (
                            <div style={styles.expenseSplitCell}>
                              <div style={styles.expenseSplitLeft}>
                                <span style={styles.expenseSplitHeaderText}>Current</span>
                              </div>
                              <div style={styles.expenseSplitRight}>
                                <span style={styles.expenseSplitHeaderText}>Proforma</span>
                              </div>
                            </div>
                          ) : isValueOutputRow ? (
                            <div style={styles.expenseSplitCell}>
                              <div style={styles.expenseSplitLeft}>
                                {(() => {
                                  const rawValue = computedValues[`${row.id}-current`];
                                  const value = Number.isFinite(rawValue) ? rawValue : 0;
                                  const displayValue =
                                    isCapRateRow || isCocRow || isValueAddPercentRow
                                      ? value * 100
                                      : value;
                                  if (!displayValue) return null;
                                  return (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontFamily: styles.cellNumber.fontFamily,
                                        textAlign: 'right',
                                        display: 'block',
                                        color: isGreenOutputRow
                                          ? styles.greenText.color
                                          : styles.cellNumber.color,
                                        fontWeight: isGreenOutputRow ? 600 : 400,
                                      }}
                                    >
                                      {displayValue.toLocaleString(undefined, {
                                        maximumFractionDigits:
                                          isCapRateRow || isCocRow || isValueAddPercentRow ? 2 : 0,
                                      })}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div style={styles.expenseSplitRight}>
                                {(() => {
                                  const rawValue = computedValues[`${row.id}-proforma`];
                                  const value = Number.isFinite(rawValue) ? rawValue : 0;
                                  const displayValue =
                                    isCapRateRow || isCocRow || isValueAddPercentRow
                                      ? value * 100
                                      : value;
                                  if (!displayValue) return null;
                                  return (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontFamily: styles.cellNumber.fontFamily,
                                        textAlign: 'right',
                                        display: 'block',
                                        color: isGreenOutputRow
                                          ? styles.greenText.color
                                          : styles.cellNumber.color,
                                        fontWeight: isGreenOutputRow ? 600 : 400,
                                      }}
                                    >
                                      {displayValue.toLocaleString(undefined, {
                                        maximumFractionDigits:
                                          isCapRateRow || isCocRow || isValueAddPercentRow ? 2 : 0,
                                      })}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : isAcquisitionPercentRow ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <select
                                value={selectedPercent}
                                onChange={(e) =>
                                  setPercentSelections((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.value,
                                  }))
                                }
                                style={{
                                  fontSize: 11,
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  backgroundColor: '#ffffff',
                                  color: '#111827',
                                  fontFamily:
                                    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                }}
                              >
                                <option value="">%</option>
                                {Array.from({ length: 21 }, (_, i) => i).map((value) => (
                                  <option key={value} value={value}>
                                    {value}%
                                  </option>
                                ))}
                              </select>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: '#111827',
                                  fontFamily:
                                    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                }}
                              >
                                {(() => {
                                  if (!acquisitionCalc) return '';
                                  const amt =
                                    row.id === 6
                                      ? acquisitionCalc.commissions
                                      : row.id === 7
                                      ? acquisitionCalc.closingFees
                                      : acquisitionCalc.assignmentFee;
                                  if (!amt) return '';
                                  return amt.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  });
                                })()}
                              </span>
                            </div>
                          ) : isPercentRow ? (
                            <div style={styles.expenseSplitCell}>
                              <div style={styles.expenseSplitLeft}>
                                <select
                                  value={selectedPercent}
                                  onChange={(e) =>
                                    setPercentSelections((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#ffffff',
                                    color: '#111827',
                                  }}
                                >
                                  <option value="">%</option>
                                  {Array.from({ length: 16 }, (_, i) => i).map((value) => (
                                    <option key={value} value={value}>
                                      {value}%
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div style={styles.expenseSplitRight}>
                                <select
                                  value={selectedProformaPercent}
                                  onChange={(e) =>
                                    setProformaPercentSelections((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#ffffff',
                                    color: '#111827',
                                  }}
                                >
                                  <option value="">%</option>
                                  {Array.from({ length: 16 }, (_, i) => i).map((value) => (
                                    <option key={value} value={value}>
                                      {value}%
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : isExpenseSplitRow ? (
                            <div style={styles.expenseSplitCell}>
                              <div style={styles.expenseSplitLeft}>
                                <input
                                  type="number"
                                  value={getCellValue(row.id, 'm-current')}
                                  onChange={(e) => handleCellChange(row.id, 'm-current', e.target.value)}
                                  style={styles.cellInput}
                                />
                              </div>
                              <div style={styles.expenseSplitRight}>
                                <input
                                  type="number"
                                  value={getCellValue(row.id, 'm-proforma')}
                                  onChange={(e) => handleCellChange(row.id, 'm-proforma', e.target.value)}
                                  style={styles.cellInput}
                                />
                              </div>
                            </div>
                          ) : row.id === 10 || row.id === 11 ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily:
                                  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                color: '#111827',
                              }}
                            >
                              {(() => {
                                if (!acquisitionCalc) return '';
                                const amt =
                                  row.id === 10
                                    ? acquisitionCalc.cashToSeller
                                    : acquisitionCalc.totalAcquisition;
                                if (!amt) return '';
                                return amt.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                });
                              })()}
                            </span>
                          ) : (
                            <input
                              type={row.id === 2 ? 'text' : 'number'}
                              value={getCellValue(row.id, 'm')}
                              onChange={(e) => handleCellChange(row.id, 'm', e.target.value)}
                              style={{
                                ...styles.cellInput,
                                ...(row.id === 2 ? { textAlign: 'left' } : null),
                              }}
                            />
                          )}
                        </td>
                        <td
                          style={
                            isDebtMenuRow ||
                            hasDebtField ||
                            isRentHeaderRow ||
                            unitTypeLabel ||
                            incomeLabel ||
                            valueAddLabel
                              ? styles.debtCell
                              : styles.cellNumber
                          }
                        >
                          {isDebtMenuRow ? (
                            <div>
                              <span style={{ fontSize: 10, color: '#6b7280', marginRight: 6 }}>
                                Debt service type
                              </span>
                              <select
                                value={debtType}
                                onChange={(e) => setDebtType(e.target.value)}
                                style={{
                                  fontSize: 11,
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  backgroundColor: '#ffffff',
                                  color: '#111827',
                                }}
                              >
                                <option value="traditional">Traditional</option>
                                <option value="seller-finance">Seller finance</option>
                                <option value="hybrid">Hybrid (SubTo / Seller)</option>
                                <option value="subject-to">Subject-To</option>
                                <option value="seller-carry">Seller carry</option>
                                <option value="equity-partner">Equity partner</option>
                              </select>
                            </div>
                          ) : isRentHeaderRow ? (
                            'Units'
                          ) : unitTypeLabel ? (
                            <div>
                              <span style={{ marginRight: 6 }}>{unitTypeLabel}</span>
                              <select
                                defaultValue=""
                                style={{
                                  fontSize: 11,
                                  padding: '3px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #d1d5db',
                                  backgroundColor: '#ffffff',
                                  color: '#111827',
                                }}
                              >
                                <option value="" disabled>
                                  Units
                                </option>
                                {Array.from({ length: 50 }, (_, i) => i + 1).map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : incomeLabel ? (
                            incomeLabel
                          ) : valueAddLabel ? (
                            valueAddLabel
                          ) : hasDebtField ? (
                            (() => {
                              const label = debtFields[debtFieldIndex];
                              const lower = label.toLowerCase();
                              const showCheckbox =
                                lower.includes('interest rate') || lower.includes('interest-only');
                              const flagKey = `${debtType}-${debtFieldIndex}`;
                              const checked = !!interestOnlyFlags[flagKey];

                              return (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>{label}</span>
                                  {showCheckbox && (
                                    <label style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: '#6b7280' }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleInterestOnly(debtType, debtFieldIndex)}
                                        style={{ marginRight: 4 }}
                                      />
                                      Interest only
                                    </label>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            row.col3 || ''
                          )}
                        </td>
                        <td
                          style={
                            isRentHeaderRow
                              ? { ...styles.cellPremises, textAlign: 'center' }
                              : styles.cellNumber
                          }
                        >
                          {isRentHeaderRow ? (
                            'Current'
                          ) : hasDebtField ? (
                            (() => {
                              const label = debtFields[debtFieldIndex] || '';
                              const lower = label.toLowerCase();
                              const isInterestField =
                                lower.includes('interest rate') ||
                                lower.includes('interest-only');
                              const isDownPaymentField = lower.includes('down payment');
                              const isPercentField = isInterestField || isDownPaymentField;

                              if (isPercentField) {
                                const max = isDownPaymentField ? 75 : 15;
                                return (
                                  <select
                                    value={getCellValue(row.id, 'breedersPct')}
                                    onChange={(e) => handleCellChange(row.id, 'breedersPct', e.target.value)}
                                    style={{
                                      fontSize: 11,
                                      padding: '3px 6px',
                                      borderRadius: 4,
                                      border: '1px solid #d1d5db',
                                      backgroundColor: '#ffffff',
                                      color: '#111827',
                                    }}
                                  >
                                    <option value="">%</option>
                                    {Array.from({ length: max + 1 }, (_, i) => i).map((value) => (
                                      <option key={value} value={value}>
                                        {value}%
                                      </option>
                                    ))}
                                  </select>
                                );
                              }

                              return (
                                <input
                                  type="number"
                                  value={getCellValue(row.id, 'breeders')}
                                  onChange={(e) => handleCellChange(row.id, 'breeders', e.target.value)}
                                  style={styles.cellInput}
                                />
                              );
                            })()
                          ) : (
                            <input
                              type="number"
                              value={getCellValue(row.id, 'breeders')}
                              onChange={(e) => handleCellChange(row.id, 'breeders', e.target.value)}
                              style={styles.cellInput}
                            />
                          )}
                        </td>
                        <td
                          style={
                            isRentHeaderRow
                              ? { ...styles.cellPremises, textAlign: 'center' }
                              : styles.cellNumber
                          }
                        >
                          {isRentHeaderRow ? (
                            'Market'
                          ) : (
                            <input
                              type="number"
                              value={getCellValue(row.id, 'headcom')}
                              onChange={(e) => handleCellChange(row.id, 'headcom', e.target.value)}
                              style={styles.cellInput}
                            />
                          )}
                        </td>
                      </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            )}

            {/* AI sidebar - live chat (shown on all tabs) */}
            <div style={styles.aiSidebar}>
                  <div style={styles.aiHeader}>
                    <span>Max</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        style={styles.uploadButton}
                        onClick={() => {
                          setShowUploadModal(true);
                          setUploadError('');
                        }}
                      >
                        <Upload size={14} />
                        Upload Deal
                      </button>
                      <button
                        type="button"
                        style={{ border: 'none', background: 'transparent', cursor: 'default', color: '#9ca3af' }}
                      >
                        <MessageSquare size={15} />
                      </button>
                    </div>
                  </div>

                  <div style={styles.aiBody} ref={chatMessagesRef}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: '#111827' }}>
                      Ask about this underwriting or request a stress test.
                    </div>
                    <div style={styles.chatMessages}>
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            marginBottom: 8,
                            padding: '6px 8px',
                            borderRadius: 6,
                            backgroundColor: msg.role === 'user' ? '#e5f0ff' : '#f9fafb',
                            color: '#111827',
                            fontSize: 11,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 2,
                              color: msg.role === 'user' ? '#1d4ed8' : '#6b7280',
                            }}
                          >
                            {msg.role === 'user' ? 'You' : 'Max'}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={styles.aiFooter}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder={
                          chatLoading
                            ? 'Thinking...'
                            : 'Ask about DSCR, NOI, or say "run a stress test"'
                        }
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendChat();
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 8px',
                          fontSize: 11,
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          outline: 'none',
                        }}
                      />
                      <button
                        style={styles.aiPrimary}
                        onClick={handleSendChat}
                        disabled={chatLoading}
                      >
                        {chatLoading ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
          </div>
        </div>
      </div>

      {/* Upload / Parse Modal */}
      {showUploadModal && (
        <div style={styles.modalBackdrop} onClick={() => !isUploading && setShowUploadModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Upload size={20} style={{ color: '#3b82f6' }} />
                <span style={styles.modalTitle}>Upload Deal Document</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isUploading) return;
                  setShowUploadModal(false);
                  setUploadError('');
                  setUploadFile(null);
                  setIsDragging(false);
                }}
                style={{ 
                  border: 'none', 
                  background: 'transparent', 
                  cursor: isUploading ? 'not-allowed' : 'pointer', 
                  color: '#9ca3af',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => !isUploading && (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ marginBottom: 20, color: '#6b7280', lineHeight: 1.6 }}>
                Upload an <strong>Offering Memorandum (OM)</strong>, <strong>T12 Statement</strong>, <strong>Rent Roll</strong>, or <strong>P&L</strong>. 
                Our AI parser will extract all property data and auto-fill the underwriting model.
              </p>

              {!uploadFile ? (
                <div
                  style={styles.uploadDropzone(isDragging)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload-input').click()}
                >
                  <div style={styles.uploadIcon}>
                    <Upload size={24} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                    {isDragging ? 'Drop file here' : 'Drag & drop your file here'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                    or click to browse
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    Supports: PDF, Excel (.xlsx, .xls), CSV
                  </div>
                  <input
                    id="file-upload-input"
                    type="file"
                    onChange={handleUploadFileChange}
                    accept=".pdf,.xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={styles.fileInfo}>
                  <div style={styles.fileIcon}>
                    {React.createElement(getFileIcon(uploadFile.name), { size: 20 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {uploadFile.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      {formatFileSize(uploadFile.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      setUploadError('');
                    }}
                    disabled={isUploading}
                    style={{
                      border: 'none',
                      background: '#fef2f2',
                      color: '#dc2626',
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontSize: 11,
                      fontWeight: 500,
                      transition: 'all 0.15s ease',
                      opacity: isUploading ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => !isUploading && (e.currentTarget.style.background = '#fee2e2')}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                  >
                    Remove
                  </button>
                </div>
              )}

              {uploadError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 12,
                    color: '#dc2626',
                    lineHeight: 1.5,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadFile && !uploadError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 12,
                    color: '#15803d',
                    lineHeight: 1.5,
                  }}
                >
                  <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    File ready! Click <strong>Parse & Auto-Fill</strong> to extract data and populate the Property tab. 
                    Max AI will automatically analyze the deal.
                  </span>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={{
                  ...styles.modalSecondary,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  opacity: isUploading ? 0.5 : 1,
                }}
                onClick={() => {
                  if (isUploading) return;
                  setShowUploadModal(false);
                  setUploadError('');
                  setUploadFile(null);
                  setIsDragging(false);
                }}
                disabled={isUploading}
                onMouseEnter={(e) => !isUploading && (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...styles.modalPrimary,
                  opacity: !uploadFile || isUploading ? 0.5 : 1,
                  cursor: !uploadFile || isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onClick={handleParseUpload}
                disabled={!uploadFile || isUploading}
                onMouseEnter={(e) => uploadFile && !isUploading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {isUploading ? (
                  <>
                    <Loader size={14} className="spin" /> Parsing & Auto-Filling...
                  </>
                ) : (
                  <>
                    <Rocket size={14} /> Parse & Auto-Fill
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug panel similar to ResultsPageV2 */}
      <div
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          zIndex: 9999,
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setShowDebug((prev) => !prev)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12,
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
          }}
        >
          {showDebug ? 'Hide Debug' : 'Show Parsed Data'}
        </button>
        {showDebug && (
          <div
            style={{
              marginTop: 8,
              backgroundColor: '#1f2937',
              color: '#10b981',
              padding: 12,
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(
              {
                scenario: activeScenario,
                unit_mix: activeScenario?.unit_mix,
                pnl: activeScenario?.pnl,
              },
              null,
              2,
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default UnderwritingTablePage;
