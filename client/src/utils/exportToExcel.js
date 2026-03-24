import * as XLSX from 'xlsx';

/**
 * Export deal analysis data to a multi-sheet .xlsx workbook.
 * Uses SheetJS (already installed) for client-side generation.
 */
export function exportToExcel(scenarioData, calculations) {
  const fullCalcs = calculations?.fullAnalysis || calculations || {};
  const property = scenarioData?.property || {};
  const pf = scenarioData?.pricing_financing || {};
  const pnl = scenarioData?.pnl || {};
  const expenses = scenarioData?.expenses || {};
  const financing = scenarioData?.financing || {};
  const unitMix = scenarioData?.unit_mix || [];
  const valueAdd = scenarioData?.value_add || {};
  const broker = scenarioData?.broker || property?.listing_broker || {};

  const fmt = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : (v || 0));
  const pct = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);

  // ── Helper: build sheet from rows (array of arrays) ──
  const buildSheet = (rows) => XLSX.utils.aoa_to_sheet(rows);

  const wb = XLSX.utils.book_new();

  // ═══════════════════════════════════════════
  // 1. SUMMARY
  // ═══════════════════════════════════════════
  const purchasePrice = pf.price || pf.purchase_price || 0;
  const totalUnits = property.total_units || property.units || 0;
  const loanAmount = fullCalcs?.financing?.loanAmount || pf.loan_amount || 0;
  const totalEquity = fullCalcs?.financing?.totalEquityRequired || (purchasePrice - loanAmount);
  const ltv = fullCalcs?.financing?.ltv || (purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0);
  const noiYear1 = fullCalcs?.year1?.noi || pnl.noi_t12 || pnl.noi || 0;
  const capRate = fullCalcs?.year1?.capRate || (purchasePrice > 0 && noiYear1 > 0 ? (noiYear1 / purchasePrice) * 100 : 0);
  const cashOnCash = fullCalcs?.year1?.cashOnCash || 0;
  const dscr = fullCalcs?.year1?.dscr || 0;
  const annualDebtService = fullCalcs?.financing?.annualDebtService || pf.annual_debt_service || 0;
  const annualCashFlow = fullCalcs?.year1?.cashFlowAfterFinancing || fullCalcs?.year1?.cashFlow || (noiYear1 - annualDebtService);
  const leveredIRR = fullCalcs?.returns?.leveredIRR || 0;
  const terminalValue = fullCalcs?.returns?.terminalValue || 0;
  const closingCosts = fullCalcs?.acquisition?.closingCosts || (purchasePrice * 0.02);
  const capexBudget = pf.capex_budget || pf.capital_improvements || 0;
  const totalProjectCost = fullCalcs?.acquisition?.totalAcquisitionCosts || (purchasePrice + closingCosts + capexBudget);
  const pricePerUnit = totalUnits > 0 ? purchasePrice / totalUnits : 0;

  const summaryRows = [
    ['DEAL ANALYSIS SUMMARY'],
    [],
    ['Property Information'],
    ['Property Name', property.property_name || property.address || ''],
    ['Address', property.address || ''],
    ['City', property.city || ''],
    ['State', property.state || ''],
    ['Zip', property.zip || ''],
    ['Property Type', property.property_type || 'Multifamily'],
    ['Year Built', property.year_built || ''],
    ['Total Units', totalUnits],
    ['Total SF', property.total_sq_ft || property.rba_sqft || ''],
    [],
    ['Acquisition'],
    ['Purchase Price', fmt(purchasePrice)],
    ['Price Per Unit', fmt(pricePerUnit)],
    ['Closing Costs', fmt(closingCosts)],
    ['CapEx / Rehab Budget', fmt(capexBudget)],
    ['Total Project Cost', fmt(totalProjectCost)],
    [],
    ['Financing'],
    ['Loan Amount', fmt(loanAmount)],
    ['LTV', pct(ltv) + '%'],
    ['Total Equity Required', fmt(totalEquity)],
    ['Interest Rate', pct(fullCalcs?.financing?.interestRate || pf.interest_rate || 0) + '%'],
    ['Amortization (Years)', fullCalcs?.financing?.amortizationYears || pf.amortization_years || ''],
    ['Annual Debt Service', fmt(annualDebtService)],
    [],
    ['Key Metrics'],
    ['NOI (Year 1)', fmt(noiYear1)],
    ['Cap Rate', pct(capRate) + '%'],
    ['Cash-on-Cash Return', pct(cashOnCash) + '%'],
    ['DSCR', pct(dscr)],
    ['Annual Cash Flow', fmt(annualCashFlow)],
    ['Levered IRR', pct(leveredIRR) + '%'],
    ['Terminal / Stabilized Value', fmt(terminalValue)],
    [],
    ['Broker'],
    ['Name', broker.name || broker.broker_name || ''],
    ['Phone', broker.phone || broker.broker_phone || ''],
    ['Email', broker.email || broker.broker_email || ''],
  ];

  const summarySheet = buildSheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // ═══════════════════════════════════════════
  // 2. INCOME & EXPENSES
  // ═══════════════════════════════════════════
  const grossPotentialRent = pnl.gross_potential_rent || pnl.scheduled_gross_rent_current || 0;
  const egi = pnl.effective_gross_income || 0;
  const vacancyAmount = pnl.vacancy_amount || 0;
  const otherIncome = pnl.other_income || 0;
  const totalNOI = pnl.noi || pnl.noi_t12 || 0;

  const incExpRows = [
    ['INCOME & EXPENSES'],
    [],
    ['INCOME', 'Annual', 'Monthly'],
    ['Gross Potential Rent', fmt(grossPotentialRent), fmt(grossPotentialRent / 12)],
    ['Other Income', fmt(otherIncome), fmt(otherIncome / 12)],
    ['Vacancy Loss', fmt(-Math.abs(vacancyAmount)), fmt(-Math.abs(vacancyAmount) / 12)],
    ['Effective Gross Income', fmt(egi || (grossPotentialRent + otherIncome - Math.abs(vacancyAmount))), fmt((egi || (grossPotentialRent + otherIncome - Math.abs(vacancyAmount))) / 12)],
    [],
    ['OPERATING EXPENSES', 'Annual', 'Monthly'],
    ['Real Estate Taxes', fmt(expenses.taxes || 0), fmt((expenses.taxes || 0) / 12)],
    ['Insurance', fmt(expenses.insurance || 0), fmt((expenses.insurance || 0) / 12)],
    ['Management', fmt(expenses.management || 0), fmt((expenses.management || 0) / 12)],
    ['Repairs & Maintenance', fmt(expenses.repairs_maintenance || expenses.repairs || 0), fmt((expenses.repairs_maintenance || expenses.repairs || 0) / 12)],
    ['Payroll', fmt(expenses.payroll || 0), fmt((expenses.payroll || 0) / 12)],
    ['Gas', fmt(expenses.gas || 0), fmt((expenses.gas || 0) / 12)],
    ['Electric', fmt(expenses.electrical || expenses.electric || 0), fmt((expenses.electrical || expenses.electric || 0) / 12)],
    ['Water / Sewer', fmt((expenses.water || 0) + (expenses.sewer || 0)), fmt(((expenses.water || 0) + (expenses.sewer || 0)) / 12)],
    ['Trash', fmt(expenses.trash || 0), fmt((expenses.trash || 0) / 12)],
    ['Marketing', fmt(expenses.marketing || 0), fmt((expenses.marketing || 0) / 12)],
    ['Legal & Accounting', fmt((expenses.legal || 0) + (expenses.accounting || 0)), fmt(((expenses.legal || 0) + (expenses.accounting || 0)) / 12)],
    ['Landscaping', fmt(expenses.landscaping || 0), fmt((expenses.landscaping || 0) / 12)],
    ['Pest Control', fmt(expenses.pest_control || expenses.pest || 0), fmt((expenses.pest_control || expenses.pest || 0) / 12)],
    ['Snow Removal', fmt(expenses.snow_removal || expenses.snow || 0), fmt((expenses.snow_removal || expenses.snow || 0) / 12)],
    ['Turnover', fmt(expenses.turnover || 0), fmt((expenses.turnover || 0) / 12)],
    ['Admin / Other', fmt((expenses.admin || 0) + (expenses.other || 0)), fmt(((expenses.admin || 0) + (expenses.other || 0)) / 12)],
  ];

  // Total expenses
  const totalExpenses = (expenses.taxes || 0) + (expenses.insurance || 0) + (expenses.management || 0)
    + (expenses.repairs_maintenance || expenses.repairs || 0) + (expenses.payroll || 0)
    + (expenses.gas || 0) + (expenses.electrical || expenses.electric || 0)
    + (expenses.water || 0) + (expenses.sewer || 0) + (expenses.trash || 0)
    + (expenses.marketing || 0) + (expenses.legal || 0) + (expenses.accounting || 0)
    + (expenses.landscaping || 0) + (expenses.pest_control || expenses.pest || 0)
    + (expenses.snow_removal || expenses.snow || 0) + (expenses.turnover || 0)
    + (expenses.admin || 0) + (expenses.other || 0);

  incExpRows.push(
    [],
    ['Total Operating Expenses', fmt(totalExpenses), fmt(totalExpenses / 12)],
    [],
    ['NET OPERATING INCOME', fmt(totalNOI || (egi - totalExpenses)), fmt((totalNOI || (egi - totalExpenses)) / 12)],
  );

  const incExpSheet = buildSheet(incExpRows);
  incExpSheet['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, incExpSheet, 'Income & Expenses');

  // ═══════════════════════════════════════════
  // 3. UNIT MIX
  // ═══════════════════════════════════════════
  if (unitMix.length > 0) {
    const unitMixRows = [
      ['UNIT MIX'],
      [],
      ['Unit Type', 'Units', 'Avg SF', 'Current Rent', 'Market Rent', 'Monthly Income', 'Annual Income'],
    ];
    let totalCurrentMonthly = 0;
    let totalMarketMonthly = 0;

    unitMix.forEach(u => {
      const units = u.units || 0;
      const currentRent = u.rent_current || u.avg_rent || 0;
      const marketRent = u.rent_market || u.market_rent || currentRent;
      const monthlyIncome = units * currentRent;
      totalCurrentMonthly += monthlyIncome;
      totalMarketMonthly += units * marketRent;

      unitMixRows.push([
        u.type || u.unit_type || u.bed_bath || '',
        units,
        u.sqft || u.avg_sqft || '',
        fmt(currentRent),
        fmt(marketRent),
        fmt(monthlyIncome),
        fmt(monthlyIncome * 12),
      ]);
    });

    unitMixRows.push(
      [],
      ['Totals', unitMix.reduce((s, u) => s + (u.units || 0), 0), '', '', '',
        fmt(totalCurrentMonthly), fmt(totalCurrentMonthly * 12)],
      ['Market Rent Totals', '', '', '', '', fmt(totalMarketMonthly), fmt(totalMarketMonthly * 12)],
      ['Annual Rent Upside', '', '', '', '', fmt(totalMarketMonthly - totalCurrentMonthly), fmt((totalMarketMonthly - totalCurrentMonthly) * 12)],
    );

    const unitMixSheet = buildSheet(unitMixRows);
    unitMixSheet['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, unitMixSheet, 'Unit Mix');
  }

  // ═══════════════════════════════════════════
  // 4. FINANCING
  // ═══════════════════════════════════════════
  const loans = financing.loans || [];
  const financingRows = [
    ['FINANCING DETAILS'],
    [],
    ['Purchase Price', fmt(purchasePrice)],
    ['Loan Amount', fmt(loanAmount)],
    ['LTV', pct(ltv) + '%'],
    ['Interest Rate', pct(fullCalcs?.financing?.interestRate || pf.interest_rate || 0) + '%'],
    ['Amortization', (fullCalcs?.financing?.amortizationYears || pf.amortization_years || '') + ' years'],
    ['IO Period', (pf.io_period || pf.interest_only_years || 0) + ' years'],
    ['Annual Debt Service', fmt(annualDebtService)],
    ['Monthly Debt Service', fmt(annualDebtService / 12)],
    [],
    ['Total Equity Required', fmt(totalEquity)],
    ['Closing Costs', fmt(closingCosts)],
    ['CapEx Budget', fmt(capexBudget)],
  ];

  if (loans.length > 0) {
    financingRows.push([], ['LOAN STACK']);
    financingRows.push(['Loan', 'Type', 'Amount', 'Rate', 'Term', 'IO Period']);
    loans.forEach((loan, i) => {
      financingRows.push([
        `Loan ${i + 1}`,
        loan.type || loan.loan_type || '',
        fmt(loan.amount || loan.loan_amount || 0),
        (loan.rate || loan.interest_rate || 0) + '%',
        (loan.term || loan.amortization_years || '') + ' yrs',
        (loan.io_period || loan.io_years || 0) + ' yrs',
      ]);
    });
  }

  const financingSheet = buildSheet(financingRows);
  financingSheet['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, financingSheet, 'Financing');

  // ═══════════════════════════════════════════
  // 5. PROJECTIONS (Multi-Year Cash Flow)
  // ═══════════════════════════════════════════
  const projections = fullCalcs?.projections || [];
  if (projections.length > 0) {
    const projRows = [
      ['MULTI-YEAR PROJECTIONS'],
      [],
      ['', ...projections.map(p => `Year ${p.year}`)],
      ['Potential Gross Income', ...projections.map(p => fmt(p.potentialGrossIncome))],
      ['Vacancy Loss', ...projections.map(p => fmt(-Math.abs(p.vacancyLoss || 0)))],
      ['Other Income', ...projections.map(p => fmt(p.otherIncome))],
      ['Effective Gross Income', ...projections.map(p => fmt(p.effectiveGrossIncome))],
      [],
      ['Operating Expenses', ...projections.map(p => fmt(p.operatingExpenses))],
      ['Taxes', ...projections.map(p => fmt(p.taxes))],
      [],
      ['NOI', ...projections.map(p => fmt(p.noi))],
      ['CapEx', ...projections.map(p => fmt(p.totalCapEx))],
      ['Cash Flow from Ops', ...projections.map(p => fmt(p.cashFlowFromOps))],
      [],
      ['Debt Service', ...projections.map(p => fmt(p.debtService))],
      ['Cash Flow After Financing', ...projections.map(p => fmt(p.cashFlowAfterFinancing))],
      [],
      ['DSCR', ...projections.map(p => pct(p.dscr))],
      ['Cash-on-Cash', ...projections.map(p => pct(p.cashOnCash) + '%')],
      ['Cap Rate', ...projections.map(p => pct(p.capRate) + '%')],
      [],
      ['Gross Sales Price', ...projections.map(p => fmt(p.grossSalesPrice))],
      ['Selling Costs', ...projections.map(p => fmt(p.sellingCosts))],
      ['Net Sales Proceeds', ...projections.map(p => fmt(p.netSalesProceeds))],
      ['Loan Payoff', ...projections.map(p => fmt(p.loanPayoff))],
      ['Reversion Cash Flow', ...projections.map(p => fmt(p.reversionCashFlow))],
    ];

    const projSheet = buildSheet(projRows);
    const projCols = [{ wch: 28 }];
    projections.forEach(() => projCols.push({ wch: 16 }));
    projSheet['!cols'] = projCols;
    XLSX.utils.book_append_sheet(wb, projSheet, 'Projections');
  }

  // ═══════════════════════════════════════════
  // 6. VALUE ADD (if present)
  // ═══════════════════════════════════════════
  if (valueAdd && (valueAdd.annual_rent_upside || valueAdd.annual_rubs_recovery || valueAdd.annual_other_income || valueAdd.annual_expense_savings)) {
    const vaRows = [
      ['VALUE-ADD ANALYSIS'],
      [],
      ['Category', 'Annual Amount'],
      ['Rent Upside', fmt(valueAdd.annual_rent_upside || 0)],
      ['RUBS Recovery', fmt(valueAdd.annual_rubs_recovery || 0)],
      ['Other Income', fmt(valueAdd.annual_other_income || 0)],
      ['Expense Savings', fmt(valueAdd.annual_expense_savings || 0)],
      [],
      ['Total Value-Add NOI Increase', fmt(
        (valueAdd.annual_rent_upside || 0) +
        (valueAdd.annual_rubs_recovery || 0) +
        (valueAdd.annual_other_income || 0) +
        (valueAdd.annual_expense_savings || 0)
      )],
    ];

    const vaSheet = buildSheet(vaRows);
    vaSheet['!cols'] = [{ wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, vaSheet, 'Value Add');
  }

  // ═══════════════════════════════════════════
  // 7. RETURNS
  // ═══════════════════════════════════════════
  const returnsRows = [
    ['RETURNS ANALYSIS'],
    [],
    ['Levered IRR', pct(leveredIRR) + '%'],
    ['Unlevered IRR', pct(fullCalcs?.returns?.unleveredIRR || 0) + '%'],
    ['Equity Multiple', pct(fullCalcs?.returns?.equityMultiple || 0) + 'x'],
    ['Average Cash-on-Cash', pct(fullCalcs?.returns?.avgCashOnCash || cashOnCash) + '%'],
    [],
    ['Year 1 NOI', fmt(noiYear1)],
    ['Year 1 Cash Flow', fmt(annualCashFlow)],
    ['Year 1 Cap Rate', pct(capRate) + '%'],
    ['Year 1 DSCR', pct(dscr)],
    [],
    ['Stabilized NOI', fmt(fullCalcs?.stabilized?.noi || 0)],
    ['Stabilized Cash Flow', fmt(fullCalcs?.stabilized?.cashflow || 0)],
    ['Stabilized Value', fmt(fullCalcs?.stabilized?.value || 0)],
    [],
    ['Terminal Value', fmt(terminalValue)],
    ['Reversion Cash Flow', fmt(fullCalcs?.exit?.reversionCashFlow || 0)],
  ];

  const returnsSheet = buildSheet(returnsRows);
  returnsSheet['!cols'] = [{ wch: 26 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, returnsSheet, 'Returns');

  // ── Generate filename and download ──
  const propertyName = property.property_name || property.address || 'Deal_Analysis';
  const safeName = propertyName.replace(/[^a-z0-9]/gi, '_').substring(0, 60);
  XLSX.writeFile(wb, `${safeName}_Analysis.xlsx`);
}
