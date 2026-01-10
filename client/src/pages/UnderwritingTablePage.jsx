import React, { useState, useEffect, useRef } from 'react';
import { Home, Database, Layers, MessageSquare, Bell, Users, Activity, TrendingUp, BarChart2, Share2, X, Info } from 'lucide-react';
import { DEBT_FIELDS_MENU, computeUnderwritingFromCells } from '../utils/underwritingCalculations';
import { SHEET_API_BASE } from './UnderwritingAIChatAPI';

// Pure CSS-in-JS styles (no Tailwind required)
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: 0,
    boxSizing: 'border-box',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
  }),
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0, // allow child flex to shrink to viewport
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
    backgroundColor: dark ? '#111827' : '#e5e7eb',
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
    backgroundColor: '#111827',
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
    backgroundColor: '#111827',
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
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 11,
    color: '#111827',
  },
  greenText: {
    color: '#16a34a',
    fontWeight: 600,
  },
  aiSidebar: {
    width: 280,
    borderLeft: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
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
};
// Multifamily template rows (all fields listed in the spec)
const MULTIFAMILY_ROWS = [
  { id: 1, premises: 'PROPERTY INFO', isSection: true },
  { id: 2, premises: 'Property Address' },

  { id: 3, premises: 'PURCHASE DETAILS', isSection: true },
  { id: 4, premises: 'Purchase Price' },
  { id: 5, premises: 'Down Payment (with % calculation)' },
  { id: 6, premises: 'Commissions' },
  { id: 7, premises: 'Closing Fees' },
  { id: 8, premises: 'Assignment Fee' },
  { id: 9, premises: 'Improvements' },
  { id: 10, premises: 'Cash to seller (formula)' },
  { id: 11, premises: 'Total Acquisition (formula)' },

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

  { id: 85, premises: 'SELLER FINANCE PURCHASE', isSection: true },
  { id: 86, premises: 'Purchase Price' },
  { id: 87, premises: 'Down Payment' },
  { id: 88, premises: 'Commissions' },
  { id: 89, premises: 'Closing Fees' },
  { id: 90, premises: 'Assignment Fee' },
  { id: 91, premises: 'Improvements' },
  { id: 92, premises: 'Other' },
  { id: 93, premises: 'Total Acquisition' },
  { id: 94, premises: 'Seller Carry Loan 1' },
  { id: 95, premises: 'Private Loan 2' },
  { id: 96, premises: 'Entry Fee (Cash)' },

  { id: 97, premises: 'DEBT SERVICE (Seller Finance)', isSection: true },
  { id: 98, premises: 'Seller Finance Loan 1' },
  { id: 99, premises: 'Interest rate' },
  { id: 100, premises: 'Period in years' },
  { id: 101, premises: 'Balloon in yrs' },
  { id: 102, premises: 'Start date loan takeover' },
  { id: 103, premises: 'Monthly pymt (PI)' },
  { id: 104, premises: '2nd Position Loan' },
  { id: 105, premises: 'Interest-only rate' },
  { id: 106, premises: 'Period in years (2nd)' },
  { id: 107, premises: 'Balloon in yrs (2nd)' },
  { id: 108, premises: 'Start date loan (2nd)' },
  { id: 109, premises: 'Monthly pymt (2nd)' },
  { id: 110, premises: 'Total debt service monthly' },
  { id: 111, premises: 'Total debt service annual' },

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
  traditional: { label: 'Traditional', ranges: [[85, 111]] },
  'seller-finance': { label: 'Seller Finance', ranges: [[85, 111]] },
  hybrid: { label: 'Hybrid (SubTo / Seller Finance)', ranges: [[85, 139]] },
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
  const [template, setTemplate] = useState('multifamily');
  const [debtType, setDebtType] = useState('seller-finance');
  const [percentSelections, setPercentSelections] = useState({});
  const [proformaPercentSelections, setProformaPercentSelections] = useState({});
  const [cellValues, setCellValues] = useState({});
  const [interestOnlyFlags, setInterestOnlyFlags] = useState({});
  const [computedValues, setComputedValues] = useState({});
  const [isInitializedFromScenario, setIsInitializedFromScenario] = useState(false);

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

  const spreadsheetData =
    template === 'multifamily' ? buildMultifamilyRows(debtType) : INDUSTRIAL_ROWS;

  const segments = ['NS', 'Premises', 'Receives', 'Credits', 'Reduces', 'Costs', 'Rents', 'Loans'];

  const getCellValue = (rowId, key) => cellValues[`${rowId}-${key}`] ?? '';

  const handleCellChange = (rowId, key, value) => {
    setCellValues((prev) => ({ ...prev, [`${rowId}-${key}`]: value }));
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

  // One-time initialization from scenarioData/calculations when embedded in ResultsPageV2
  useEffect(() => {
    if (!initialScenarioData || isInitializedFromScenario) return;

    const nextCellValues = {};

    try {
      const sd = initialScenarioData || {};
      const pf = sd.pricing_financing || {};
      const pnl = sd.pnl || {};
      const expenses = sd.expenses || {};
      const unitMix = sd.unit_mix || [];

      const setCell = (rowId, key, value) => {
        if (value === undefined || value === null) return;
        if (Number.isNaN(value)) return;
        nextCellValues[`${rowId}-${key}`] = value;
      };

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
      const annualSewer = expenses.sewer || 0;
      const annualWater = expenses.water || 0;
      const annualTrash = expenses.trash || 0;

      setCell(13, 'm-current', annualTaxes / 12 || 0);
      setCell(14, 'm-current', annualInsurance / 12 || 0);
      setCell(15, 'm-current', annualGas / 12 || 0);
      setCell(16, 'm-current', annualElectric / 12 || 0);
      setCell(17, 'm-current', annualSewer / 12 || 0);
      setCell(18, 'm-current', annualWater / 12 || 0);
      setCell(19, 'm-current', annualTrash / 12 || 0);

      // Vacancy as % if available
      if (typeof pnl.vacancy_rate === 'number') {
        setPercentSelections((prev) => ({ ...prev, 23: pnl.vacancy_rate }));
      }

      // Management and CapEx % if present on expenses
      if (typeof expenses.capex_rate === 'number') {
        setPercentSelections((prev) => ({ ...prev, 21: expenses.capex_rate }));
      }
      if (typeof expenses.management_rate === 'number') {
        setPercentSelections((prev) => ({ ...prev, 22: expenses.management_rate }));
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

      // UNIT MIX basic mapping for studio/1/2/3 bed counts (rows 72,75,78,81)
      if (unitMix.length > 0) {
        const typeBuckets = { Studio: 0, '1': 0, '2': 0, '3': 0 };
        unitMix.forEach((u) => {
          const label = (u.bedrooms != null ? String(u.bedrooms) : u.type || '').toLowerCase();
          const units = u.units || 0;
          if (label.includes('studio') || label === '0') typeBuckets.Studio += units;
          else if (label.includes('1') || label.includes('one')) typeBuckets['1'] += units;
          else if (label.includes('2') || label.includes('two')) typeBuckets['2'] += units;
          else if (label.includes('3') || label.includes('three')) typeBuckets['3'] += units;
        });

        if (typeBuckets.Studio) setCell(72, 'm', typeBuckets.Studio);
        if (typeBuckets['1']) setCell(75, 'm', typeBuckets['1']);
        if (typeBuckets['2']) setCell(78, 'm', typeBuckets['2']);
        if (typeBuckets['3']) setCell(81, 'm', typeBuckets['3']);
      }

      setCellValues((prev) => ({ ...nextCellValues, ...prev }));
      setIsInitializedFromScenario(true);
    } catch (e) {
      console.error('Error initializing sheet from scenario data:', e);
    }
  }, [initialScenarioData, initialCalculations, isInitializedFromScenario]);

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

  const buildSheetStructure = () => ({
    debtType,
  });

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const newMessages = [...chatMessages, { role: 'user', content: trimmed }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${SHEET_API_BASE}/v2/sheet/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_state_json: buildSheetStateJson(),
          sheet_calc_json: buildSheetCalcJson(),
          sheet_structure: buildSheetStructure(),
          messages: newMessages,
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

  return (
    <div style={styles.page}>
      <div style={styles.appCard}>
        {/* Icon sidebar */}
        <div style={styles.iconSidebar}>
          <div style={styles.logoBoxOuter}>
            <div style={styles.logoBoxInner} />
          </div>
          <div style={styles.iconButton(false)}><Home size={18} /></div>
          <div style={styles.iconButton(false)}><Database size={18} /></div>
          <div style={styles.iconButton(true)}><Layers size={18} /></div>
          <div style={styles.iconButton(false)}><MessageSquare size={18} /></div>
          <div style={styles.iconButton(false)}><Bell size={18} /></div>
          <div style={styles.iconButton(false)}><Users size={18} /></div>
          <div style={styles.iconButton(false)}><Activity size={18} /></div>
          <div style={styles.iconButton(false)}><TrendingUp size={18} /></div>
          <div style={styles.iconButton(false)}><BarChart2 size={18} /></div>
          <div style={styles.iconButton(false)}><Share2 size={18} /></div>
        </div>

        {/* Segments column */}
        <div style={styles.segmentsCol}>
          <div style={styles.segmentsHeader}>Segments</div>
          {segments.map((segment, idx) => (
            <div key={segment} style={styles.segmentsRow(idx === 1)}>
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
            <div style={styles.topTabs}>
              <div style={styles.topTab(true)}>Auto-Fill Model</div>
              <div style={styles.topTab(false)}>Saves Text Scenarios</div>
              <div style={styles.topTab(false)}>Export to EC Memos</div>
            </div>
            <div style={styles.topRight}>
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
                <button style={styles.smallDarkButton}>Choose Mess</button>
                <button style={styles.smallDarkButton} onClick={handleClearFields}>
                  Clear fields
                </button>
              </div>
            </div>
          </div>

          {/* Body: table + AI sidebar */}
          <div style={styles.body}>
            {/* Table */}
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
                    const hidePremisesForIncome = row.id >= 24 && row.id <= 27;
                    const hidePremisesForValueAdd = row.id >= 46 && row.id <= 57;

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

                    const selectedPercent = isPercentRow ? percentSelections[row.id] || '' : '';
                    const selectedProformaPercent = isPercentRow
                      ? proformaPercentSelections[row.id] || ''
                      : '';

                    return (
                      <tr key={row.id} style={{ ...styles.rowBase, backgroundColor }}>
                        <td style={styles.cellIndex}>{row.id}</td>
                        <td style={premisesStyle}>
                          {hidePremisesForIncome || hidePremisesForValueAdd ? '' : row.premises}
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
                          ) : (
                            <input
                              type="number"
                              value={getCellValue(row.id, 'm')}
                              onChange={(e) => handleCellChange(row.id, 'm', e.target.value)}
                              style={styles.cellInput}
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

            {/* AI sidebar - live chat */}
            <div style={styles.aiSidebar}>
              <div style={styles.aiHeader}>
                <span>Deal Partner Chat</span>
                <button
                  style={{ border: 'none', background: 'transparent', cursor: 'default', color: '#9ca3af' }}
                >
                  <MessageSquare size={15} />
                </button>
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
                        {msg.role === 'user' ? 'You' : 'AI Partner'}
                      </div>
                      <div>{msg.content}</div>
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
    </div>
  );
}

export default UnderwritingTablePage;
