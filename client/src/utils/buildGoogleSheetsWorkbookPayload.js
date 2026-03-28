const asNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const present = (value) => value !== undefined && value !== null && value !== '';

const displayValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const pushSection = (rows, title, entries = []) => {
  rows.push([title]);
  entries.forEach(([label, value]) => {
    rows.push([label, displayValue(value)]);
  });
  rows.push([]);
};

const buildKeyValueSheet = (title, sections) => {
  const rows = [[title], []];
  sections.forEach((section) => pushSection(rows, section.title, section.entries));
  return rows;
};

const buildTableSheet = (title, columns, dataRows = [], emptyMessage = 'No data available') => {
  const rows = [[title], [], columns];
  if (!dataRows.length) {
    rows.push([emptyMessage]);
    return rows;
  }
  dataRows.forEach((row) => {
    rows.push(columns.map((column) => displayValue(row[column])));
  });
  return rows;
};

const flattenObjectToRows = (value, prefix = '', rows = []) => {
  if (Array.isArray(value)) {
    if (!value.length) {
      rows.push([prefix, 'array', '[]']);
      return rows;
    }
    value.forEach((entry, index) => {
      flattenObjectToRows(entry, `${prefix}[${index}]`, rows);
    });
    return rows;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) {
      rows.push([prefix, 'object', '{}']);
      return rows;
    }
    entries.forEach(([key, entry]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObjectToRows(entry, nextPrefix, rows);
    });
    return rows;
  }

  rows.push([prefix || '(root)', typeof value, displayValue(value)]);
  return rows;
};

const buildRawSheet = (title, value) => {
  const rows = [[title], [], ['Path', 'Type', 'Value']];
  flattenObjectToRows(value, '', rows);
  return rows;
};

const buildMessagesSheet = (messages = []) => buildTableSheet(
  'Messages',
  ['Index', 'Role', 'Content'],
  messages.map((message, index) => ({
    Index: index + 1,
    Role: message?.role || message?.sender || '',
    Content: message?.content || message?.text || '',
  })),
  'No messages available',
);

export function buildGoogleSheetsWorkbookPayload({
  scenarioData,
  calculations,
  underwritingResult,
  rentcastData,
  marketData,
  documentAnalysis,
  costsegData,
  sensitivity,
  countyTaxEntry,
  selectedStructureMetrics,
  recommendedStructure,
  messages,
  dealId,
  baseTabName,
}) {
  const fullCalcs = calculations?.fullAnalysis || calculations || {};
  const property = scenarioData?.property || {};
  const pricing = scenarioData?.pricing_financing || {};
  const financing = scenarioData?.financing || {};
  const pnl = scenarioData?.pnl || {};
  const expenses = scenarioData?.expenses || {};
  const valueAdd = scenarioData?.value_add || {};
  const exitDetails = scenarioData?.exit_details || {};
  const unitMix = scenarioData?.unit_mix || [];
  const rentRoll = scenarioData?.rent_roll || [];
  const purchasePrice = pricing?.price || pricing?.purchase_price || 0;
  const annualDebtService = fullCalcs?.financing?.annualDebtService || pricing?.annual_debt_service || 0;
  const year1NOI = fullCalcs?.year1?.noi || pnl?.noi_t12 || pnl?.noi || 0;
  const capRate = fullCalcs?.year1?.capRate || (purchasePrice > 0 ? (year1NOI / purchasePrice) * 100 : 0);
  const exportBaseName = baseTabName || 'Results';
  const workbookTitle = property?.address || property?.property_name || `Deal ${dealId || ''}`.trim() || 'DealSniper Results';

  const summarySheet = buildKeyValueSheet('Summary', [
    {
      title: 'Export Metadata',
      entries: [
        ['Workbook Title', workbookTitle],
        ['Deal ID', dealId || ''],
        ['Exported At', new Date().toISOString()],
        ['Tab Prefix', exportBaseName],
      ],
    },
    {
      title: 'Property',
      entries: [
        ['Property Name', property?.property_name || property?.name || property?.address || ''],
        ['Address', property?.address || ''],
        ['City', property?.city || ''],
        ['State', property?.state || ''],
        ['Zip', property?.zip || ''],
        ['Units', property?.units || property?.total_units || ''],
        ['Year Built', property?.year_built || ''],
      ],
    },
    {
      title: 'Key Metrics',
      entries: [
        ['Purchase Price', purchasePrice],
        ['Year 1 NOI', year1NOI],
        ['Cap Rate %', capRate],
        ['Annual Debt Service', annualDebtService],
        ['DSCR', fullCalcs?.year1?.dscr || ''],
        ['Cash on Cash %', fullCalcs?.year1?.cashOnCash || ''],
        ['Levered IRR %', fullCalcs?.returns?.leveredIRR || ''],
        ['Equity Multiple', fullCalcs?.returns?.equityMultiple || ''],
      ],
    },
  ]);

  const documentsSheet = buildKeyValueSheet('Documents', [
    {
      title: 'Underwriting Result',
      entries: Object.entries(underwritingResult || {}).slice(0, 50),
    },
    {
      title: 'Document Analysis Snapshot',
      entries: Object.entries(documentAnalysis || {}).slice(0, 50),
    },
  ]);

  const overviewSheet = buildKeyValueSheet('Overview', [
    {
      title: 'Current Metrics',
      entries: [
        ['Current NOI', fullCalcs?.current?.noi],
        ['Current Cash Flow', fullCalcs?.current?.cashFlow],
        ['Current Debt Service', fullCalcs?.current?.debtService],
        ['Stabilized NOI', fullCalcs?.stabilized?.noi],
        ['Stabilized Value', fullCalcs?.stabilized?.value],
      ],
    },
    {
      title: 'Year 1',
      entries: [
        ['Effective Gross Income', fullCalcs?.year1?.effectiveGrossIncome],
        ['Operating Expenses', fullCalcs?.year1?.operatingExpenses],
        ['NOI', fullCalcs?.year1?.noi],
        ['Debt Service', fullCalcs?.year1?.debtService],
        ['Cash Flow After Financing', fullCalcs?.year1?.cashFlowAfterFinancing || fullCalcs?.year1?.cashFlow],
      ],
    },
    {
      title: 'Returns',
      entries: Object.entries(fullCalcs?.returns || {}).slice(0, 30),
    },
  ]);

  const scenarioSheet = buildKeyValueSheet('Scenario Sheet', [
    { title: 'Property', entries: Object.entries(property) },
    { title: 'Pricing & Financing', entries: Object.entries(pricing) },
    { title: 'Financing', entries: Object.entries(financing).filter(([key]) => key !== 'loans') },
    { title: 'P&L', entries: Object.entries(pnl) },
    { title: 'Expenses', entries: Object.entries(expenses).filter(([key]) => key !== 'utility_breakdown') },
    { title: 'Underwriting', entries: Object.entries(scenarioData?.underwriting || {}) },
    { title: 'Exit Details', entries: Object.entries(exitDetails) },
  ]);

  const dealStructureRows = (financing?.loans || []).map((loan, index) => ({
    Index: index + 1,
    Type: loan?.type || '',
    Enabled: loan?.enabled !== false ? 'TRUE' : 'FALSE',
    Mode: loan?.loanAmtMode || '',
    LTV: loan?.ltv || '',
    LoanAmount: loan?.loanDollar || '',
    Rate: loan?.rate || '',
    Term: loan?.term || '',
    Amort: loan?.amort || '',
    IO: loan?.io || '',
    Fees: loan?.fees || '',
  }));

  const dealStructureSheet = [
    ...buildKeyValueSheet('Deal Structure', [
      {
        title: 'Summary',
        entries: [
          ['Loan Amount', fullCalcs?.financing?.loanAmount],
          ['Annual Debt Service', fullCalcs?.financing?.annualDebtService],
          ['Total Equity Required', fullCalcs?.financing?.totalEquityRequired],
          ['Selected Structure Name', selectedStructureMetrics?.name],
          ['Selected Structure Cash Flow', selectedStructureMetrics?.annualCashFlow],
          ['Selected Structure DSCR', selectedStructureMetrics?.dscr],
          ['Recommended Structure', recommendedStructure?.name || ''],
        ],
      },
    ]),
    ['Loans'],
    ['Index', 'Type', 'Enabled', 'Mode', 'LTV', 'LoanAmount', 'Rate', 'Term', 'Amort', 'IO', 'Fees'],
    ...(dealStructureRows.length
      ? dealStructureRows.map((row) => ['Index', 'Type', 'Enabled', 'Mode', 'LTV', 'LoanAmount', 'Rate', 'Term', 'Amort', 'IO', 'Fees'].map((key) => displayValue(row[key])))
      : [['No loan stack available']]),
  ];

  const expenseEntries = Object.entries(expenses).filter(([key, value]) => key !== 'utility_breakdown' && present(value));
  const utilityEntries = Object.entries(expenses?.utility_breakdown || {}).filter(([, value]) => present(value));
  const expensesSheet = buildKeyValueSheet('Expenses', [
    { title: 'Expense Lines', entries: expenseEntries },
    { title: 'Utility Breakdown', entries: utilityEntries },
  ]);

  const unitMixRows = unitMix.map((unit, index) => ({
    Index: index + 1,
    UnitType: unit?.type || unit?.unit_type || unit?.bed_bath || '',
    Units: unit?.units || 0,
    SF: unit?.unit_sf || unit?.sqft || unit?.avg_sqft || '',
    CurrentRent: unit?.rent_current || 0,
    MarketRent: unit?.rent_market || unit?.market_rent || unit?.rent_current || 0,
    MonthlyUpside: ((unit?.rent_market || unit?.market_rent || unit?.rent_current || 0) - (unit?.rent_current || 0)) * (unit?.units || 0),
  }));

  const valueAddSheet = [
    ...buildKeyValueSheet('Value-Add', [
      { title: 'Value Add Inputs', entries: Object.entries(valueAdd) },
      {
        title: 'Value Add Outputs',
        entries: [
          ['Applied Rent Upside', valueAdd?.apply_rent_upside],
          ['Applied RUBS', valueAdd?.apply_rubs],
          ['Applied Other Income', valueAdd?.apply_other_income],
          ['Applied Expense Savings', valueAdd?.apply_expense_savings],
        ],
      },
    ]),
    ['Unit Mix Rent Upside'],
    ['Index', 'UnitType', 'Units', 'SF', 'CurrentRent', 'MarketRent', 'MonthlyUpside'],
    ...(unitMixRows.length
      ? unitMixRows.map((row) => ['Index', 'UnitType', 'Units', 'SF', 'CurrentRent', 'MarketRent', 'MonthlyUpside'].map((key) => displayValue(row[key])))
      : [['No unit mix available']]),
  ];

  const projections = fullCalcs?.projections || [];
  const exitStrategySheet = [
    ...buildKeyValueSheet('Exit Strategy', [
      { title: 'Exit Assumptions', entries: Object.entries(exitDetails) },
      { title: 'Return Metrics', entries: Object.entries(fullCalcs?.returns || {}).slice(0, 40) },
    ]),
    ['Projected Cash Flows'],
    ['Year', 'NOI', 'DebtService', 'CashFlowAfterFinancing', 'SaleProceeds'],
    ...(projections.length
      ? projections.map((projection) => ([
          displayValue(projection?.year),
          displayValue(projection?.noi),
          displayValue(projection?.debtService),
          displayValue(projection?.cashFlowAfterFinancing),
          displayValue(projection?.saleProceeds),
        ]))
      : [['No projections available']]),
  ];

  const amortizationSchedule = fullCalcs?.amortizationSchedule || [];
  const amortizationSheet = buildTableSheet(
    'Amortization',
    ['Year', 'BeginningBalance', 'Principal', 'Interest', 'EndingBalance'],
    amortizationSchedule.map((item) => ({
      Year: item?.year,
      BeginningBalance: item?.beginningBalance,
      Principal: item?.principal,
      Interest: item?.interest,
      EndingBalance: item?.endingBalance,
    })),
    'No amortization schedule available',
  );

  const rentRollRows = (rentRoll.length ? rentRoll : unitMix).map((row, index) => ({
    Index: index + 1,
    Unit: row?.unit || row?.unit_number || row?.type || row?.unit_type || '',
    Tenant: row?.tenant || row?.tenant_name || '',
    LeaseStart: row?.lease_start || '',
    LeaseEnd: row?.lease_end || '',
    CurrentRent: row?.rent || row?.rent_current || 0,
    MarketRent: row?.rent_market || row?.market_rent || '',
    Status: row?.status || '',
  }));
  const rentRollSheet = [
    ...buildTableSheet(
      'Rent Roll',
      ['Index', 'Unit', 'Tenant', 'LeaseStart', 'LeaseEnd', 'CurrentRent', 'MarketRent', 'Status'],
      rentRollRows,
      'No rent roll or unit mix available',
    ),
    [],
    ['RentCast Snapshot'],
    ['Field', 'Value'],
    ...Object.entries(rentcastData || {}).slice(0, 50).map(([key, value]) => [key, displayValue(value)]),
  ];

  const costSegSheet = buildKeyValueSheet('Cost Seg', [
    {
      title: 'Cost Seg Summary',
      entries: costsegData ? Object.entries(costsegData).slice(0, 50) : [['Status', 'No cached cost seg analysis found for this deal']],
    },
  ]);

  const waterfall = fullCalcs?.multiTierWaterfall || scenarioData?.waterfall || {};
  const waterfallSheet = buildKeyValueSheet('Waterfall', [
    { title: 'Waterfall Inputs', entries: Object.entries(scenarioData?.waterfall || {}) },
    { title: 'Waterfall Outputs', entries: Object.entries(waterfall).filter(([, value]) => typeof value !== 'object') },
  ]);

  const sensitivitySections = Object.entries(sensitivity || fullCalcs?.sensitivity || {}).map(([name, values]) => ({
    title: name,
    entries: Array.isArray(values)
      ? values.slice(0, 100).map((entry, index) => [
          `${name}[${index}]`,
          typeof entry === 'object' ? JSON.stringify(entry) : entry,
        ])
      : Object.entries(values || {}),
  }));
  const sensitivitySheet = buildKeyValueSheet('Stress Test', sensitivitySections.length ? sensitivitySections : [{ title: 'Stress Test', entries: [['Status', 'No sensitivity data available']] }]);

  const marketDataSheet = buildKeyValueSheet('Market Data', [
    { title: 'Market Data', entries: Object.entries(marketData || {}) },
    { title: 'County Tax Selection', entries: Object.entries(countyTaxEntry || {}) },
  ]);

  const sheets = [
    { title: 'Summary', rows: summarySheet },
    { title: 'Documents', rows: documentsSheet },
    { title: 'Scenario Sheet', rows: scenarioSheet },
    { title: 'Overview', rows: overviewSheet },
    { title: 'Deal Structure', rows: dealStructureSheet },
    { title: 'Expenses', rows: expensesSheet },
    { title: 'Value-Add', rows: valueAddSheet },
    { title: 'Exit Strategy', rows: exitStrategySheet },
    { title: 'Amortization', rows: amortizationSheet },
    { title: 'Rent Roll', rows: rentRollSheet },
    { title: 'Cost Seg', rows: costSegSheet },
    { title: 'Waterfall', rows: waterfallSheet },
    { title: 'Stress Test', rows: sensitivitySheet },
    { title: 'Market Data', rows: marketDataSheet },
    { title: 'Messages', rows: buildMessagesSheet(messages) },
  ];

  const rawObjects = {
    ScenarioData: scenarioData,
    FullCalcs: fullCalcs,
    UnderwritingResult: underwritingResult,
    MarketData: marketData,
    DocumentAnalysis: documentAnalysis,
    RentcastData: rentcastData,
    CostSegData: costsegData,
    Sensitivity: sensitivity,
    CountyTaxEntry: countyTaxEntry,
    SelectedStructureMetrics: selectedStructureMetrics,
    RecommendedStructure: recommendedStructure,
    Messages: messages,
  };

  return {
    workbookTitle,
    baseTabName: exportBaseName,
    sheets,
    rawSheets: Object.entries(rawObjects).map(([title, value]) => ({
      title: `Raw ${title}`,
      rows: buildRawSheet(`Raw ${title}`, value || {}),
    })),
  };
}
