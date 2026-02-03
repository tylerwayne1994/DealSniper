import React, { useMemo } from 'react';
const currency0 = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n) => `${(Number(n || 0)).toFixed(2)}%`;

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 800, color: '#0f172a',
      background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '10px 12px',
      textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: 8, margin: '8px 0'
    }}>{children}</div>
  );
}

function Table({ columns, rows, footer }) {
  return (
    <div style={{ marginBottom: 14, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: 'white', border: '1px solid #e5e7eb' }}>
        <thead>
          <tr style={{ background: '#111827', color: 'white' }}>
            {columns.map((c, i) => (
              <th key={i} style={{ padding: '8px', borderRight: '1px solid #374151', textAlign: c.align || 'left', whiteSpace: 'nowrap' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} style={{ background: idx % 2 ? '#f9fafb' : 'white' }}>
              {columns.map((c, i) => (
                <td key={i} style={{ padding: '8px', borderRight: '1px solid #e5e7eb', textAlign: c.align || 'left' }}>{r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            {footer.map((r, idx) => (
              <tr key={idx} style={{ background: '#e0f2fe', borderTop: '2px solid #0ea5e9' }}>
                {columns.map((c, i) => (
                  <td key={i} style={{ padding: '8px', borderRight: '1px solid #0ea5e9', fontWeight: 700, textAlign: c.align || 'left' }}>{r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function ScenarioSheet({ scenarioData, calculations }) {
  const sd = scenarioData || {};
  const pnl = sd.pnl || {};
  const unitMix = useMemo(() => Array.isArray(sd.unit_mix) ? sd.unit_mix : [], [sd.unit_mix]);
  const expenses = sd.expenses || {};
  const full = (calculations && (calculations.fullAnalysis || calculations)) || {};

  const totalUnits = sd.property?.units || unitMix.reduce((s,u)=> s + (u.units||0), 0) || 0;

  const unitMixRows = useMemo(() => {
    const rows = unitMix.map((u) => {
      const type = u.type || `${u.bedrooms || ''}${u.bathrooms ? 'x' + u.bathrooms : ''}`;
      const uPct = totalUnits ? ((u.units || 0) / totalUnits) * 100 : 0;
      const sf = u.unit_sf || 0;
      const current = u.rent_current || 0;
      const market = u.rent_market || current || 0;
      const currentPSF = sf ? current / sf : 0;
      const marketPSF = sf ? market / sf : 0;
      return {
        total: u.units || 0,
        unitMix: type || '-',
        pct: pct(uPct),
        sf,
        currentAvgRent: currency0(current),
        currentAvgRentPSF: `$${currentPSF.toFixed(2)}`,
        marketAvgRent: currency0(market),
        marketRentPSF: `$${marketPSF.toFixed(2)}`,
        currentMaxRent: currency0(current),
        totalCurrentMonthlyRent: currency0((u.units||0) * current),
        marketMonthlyRent: currency0((u.units||0) * market),
      };
    });

    const totals = unitMix.reduce((acc,u)=>{
      const sf = u.unit_sf || 0;
      acc.units += (u.units||0);
      acc.sf += (u.units||0) * sf;
      acc.current += (u.units||0) * (u.rent_current||0);
      acc.market += (u.units||0) * (u.rent_market||u.rent_current||0);
      return acc;
    }, { units:0, sf:0, current:0, market:0 });

    const avgRow = {
      total: totalUnits,
      unitMix: 'Averages',
      pct: '-',
      sf: totals.units ? Math.round(totals.sf / totals.units) : 0,
      currentAvgRent: totals.units ? currency0(totals.current / totals.units) : currency0(0),
      currentAvgRentPSF: totals.sf ? `$${(totals.current / totals.sf).toFixed(2)}` : '$0.00',
      marketAvgRent: totals.units ? currency0(totals.market / totals.units) : currency0(0),
      marketRentPSF: totals.sf ? `$${(totals.market / totals.sf).toFixed(2)}` : '$0.00',
      currentMaxRent: '-',
      totalCurrentMonthlyRent: currency0(totals.current),
      marketMonthlyRent: currency0(totals.market),
    };

    const totalRow = {
      total: totals.units,
      unitMix: 'Totals',
      pct: '-',
      sf: totals.sf,
      currentAvgRent: currency0(totals.current),
      currentAvgRentPSF: '-',
      marketAvgRent: currency0(totals.market),
      marketRentPSF: '-',
      currentMaxRent: '-',
      totalCurrentMonthlyRent: currency0(totals.current),
      marketMonthlyRent: currency0(totals.market)
    };

    return { rows, footer: [avgRow, totalRow] };
  }, [unitMix, totalUnits]);

  const headerColumnsUM = [
    { key: 'total', label: 'Total Units', align: 'center' },
    { key: 'unitMix', label: 'Unit Mix' },
    { key: 'pct', label: 'Unit Mix %', align: 'center' },
    { key: 'sf', label: 'Unit SF', align: 'right' },
    { key: 'currentAvgRent', label: 'Current Avg. Rent', align: 'right' },
    { key: 'currentAvgRentPSF', label: 'Current Avg. Rent PSF', align: 'right' },
    { key: 'marketAvgRent', label: 'Market Avg. Rent', align: 'right' },
    { key: 'marketRentPSF', label: 'Market Rent PSF', align: 'right' },
    { key: 'currentMaxRent', label: 'Current Max Rent', align: 'right' },
    { key: 'totalCurrentMonthlyRent', label: 'Total Current Monthly Rent', align: 'right' },
    { key: 'marketMonthlyRent', label: 'Market Monthly Rent', align: 'right' },
  ];

  // Annual Operating Summary (compact version based on available data)
  const aosRows = [
    {
      name: 'Gross Potential Rent',
      proforma: currency0(pnl.gross_potential_rent || full.year1?.potentialGrossIncome || 0),
      t12: currency0(pnl.gross_potential_rent || 0),
      y1: currency0(full.year1?.potentialGrossIncome || 0),
      y2: currency0(pnl.potential_gross_income || 0),
    },
    {
      name: 'Less Vacancy',
      proforma: pct((sd.pnl?.vacancy_rate_proforma ?? sd.pnl?.vacancy_rate_stabilized ?? sd.pnl?.vacancy_rate_current ?? 0) * 100),
      t12: pct((sd.pnl?.vacancy_rate_t12 || 0) * 100),
      y1: currency0(full.year1?.vacancyLoss || 0),
      y2: pct((sd.pnl?.vacancy_rate_stabilized || 0) * 100)
    },
    {
      name: 'Gross Operating Income',
      proforma: currency0(pnl.effective_gross_income || full.year1?.effectiveGrossIncome || 0),
      t12: currency0(pnl.effective_gross_income || 0),
      y1: currency0(full.year1?.effectiveGrossIncome || 0),
      y2: currency0(full.year1?.effectiveGrossIncome || 0),
    },
    {
      name: 'Expenses',
      proforma: currency0(pnl.operating_expenses || expenses.total || 0),
      t12: currency0(pnl.operating_expenses || expenses.total || 0),
      y1: currency0(full.year1?.totalOperatingExpenses || pnl.operating_expenses || 0),
      y2: currency0(pnl.operating_expenses || 0),
    },
    {
      name: 'Net Operating Income',
      proforma: currency0(pnl.noi_proforma || pnl.noi || full.year1?.noi || 0),
      t12: currency0(pnl.noi_t12 || pnl.noi || 0),
      y1: currency0(full.year1?.noi || pnl.noi || 0),
      y2: currency0(pnl.noi_stabilized || full.year1?.noi || 0),
    }
  ];

  const aosColumns = [
    { key: 'name', label: 'Annual Operating Summary' },
    { key: 'proforma', label: 'Pro Forma Estimates', align: 'right' },
    { key: 't12', label: 'T-12', align: 'right' },
    { key: 'y1', label: 'Year 1 Adjusted', align: 'right' },
    { key: 'y2', label: 'Year 2 Stabilized', align: 'right' }
  ];

  // Expense detail (Pro Forma Annual Operating Summary style)
  const utilTotal = expenses.utilities || 0;
  const utilBD = expenses.utility_breakdown || {};
  const splitOr = (k, fallbackCount) => {
    if (typeof utilBD[k] === 'number') return utilBD[k];
    // evenly split by fallback count if no breakdown
    return fallbackCount > 0 ? utilTotal / fallbackCount : 0;
  };
  const fallbackCount = 8; // water, electricity, gas, trash, sewer, internet, landscaping, pest_control

  const expRows = [
    { name: 'Real Estate Taxes', val: currency0(expenses.taxes || 0), pctSGI: pct(((expenses.taxes||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.taxes||0)/totalUnits : 0) },
    { name: 'Property Management Fee', val: currency0(expenses.management || 0), pctSGI: pct(((expenses.management||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.management||0)/totalUnits : 0) },
    { name: 'Insurance', val: currency0(expenses.insurance || 0), pctSGI: pct(((expenses.insurance||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.insurance||0)/totalUnits : 0) },
    { name: 'General & Administrative', val: currency0(expenses.admin || 0), pctSGI: pct(((expenses.admin||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.admin||0)/totalUnits : 0) },
    { name: 'Landscaping/Grounds', val: currency0(splitOr('landscaping', fallbackCount)), pctSGI: pct(((splitOr('landscaping', fallbackCount)||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (splitOr('landscaping', fallbackCount)||0)/totalUnits : 0) },
    { name: 'Turnover', val: currency0(0), pctSGI: pct(0), perUnit: currency0(0) },
    { name: 'Repairs & Maintenance', val: currency0(expenses.repairs_maintenance || 0), pctSGI: pct(((expenses.repairs_maintenance||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.repairs_maintenance||0)/totalUnits : 0) },
    { name: 'Electricity', val: currency0(splitOr('electricity', fallbackCount)), pctSGI: pct(((splitOr('electricity', fallbackCount)||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (splitOr('electricity', fallbackCount)||0)/totalUnits : 0) },
    { name: 'Water/Sewer', val: currency0((splitOr('water', fallbackCount) || 0) + (splitOr('sewer', fallbackCount) || 0)), pctSGI: pct((((splitOr('water', fallbackCount)||0)+(splitOr('sewer', fallbackCount)||0)) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (((splitOr('water', fallbackCount)||0)+(splitOr('sewer', fallbackCount)||0))/totalUnits) : 0) },
    { name: 'Trash Removal', val: currency0(splitOr('trash', fallbackCount)), pctSGI: pct(((splitOr('trash', fallbackCount)||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (splitOr('trash', fallbackCount)||0)/totalUnits : 0) },
    { name: 'Marketing/Advertising', val: currency0(expenses.marketing || 0), pctSGI: pct(((expenses.marketing||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.marketing||0)/totalUnits : 0) },
    { name: 'Reserves', val: currency0(expenses.other || 0), pctSGI: pct(((expenses.other||0) / (pnl.gross_potential_rent||1)) * 100), perUnit: currency0(totalUnits ? (expenses.other||0)/totalUnits : 0) }
  ];

  const expColumns = [
    { key: 'name', label: 'Pro Forma Annual Operating Summary' },
    { key: 'pctSGI', label: '% of Current SGI', align: 'right' },
    { key: 'val', label: 'Pro Forma Estimates', align: 'right' },
    { key: 'perUnit', label: 'Per Unit', align: 'right' },
  ];

  const totalExpenses = (expenses.total != null) ? expenses.total : expRows.reduce((s,r)=>{
    const parsed = Number(String(r.val).replace(/[^0-9.-]/g, '')) || 0;
    return s + parsed;
  }, 0);

  // Full parsed expenses table (lists every numeric key from parsed scenarioData.expenses)
  const toTitle = (k) => k
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^\s|\s$/g, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const allExpenseRows = Object.entries(expenses || {})
    .filter(([k,v]) => typeof v === 'number' && k !== 'total')
    .map(([k,v]) => ({
      name: toTitle(k),
      pctSGI: pct(((v || 0) / (pnl.gross_potential_rent || 1)) * 100),
      val: currency0(v || 0),
      perUnit: currency0(totalUnits ? (v || 0) / totalUnits : 0)
    }))
    .sort((a,b) => a.name.localeCompare(b.name));

  const allExpColumns = [
    { key: 'name', label: 'Parsed Expenses (All Keys)' },
    { key: 'pctSGI', label: '% of Current SGI', align: 'right' },
    { key: 'val', label: 'Amount', align: 'right' },
    { key: 'perUnit', label: 'Per Unit', align: 'right' },
  ];

  // Generic parsed tables for other sections (PNL, Pricing/Financing, Underwriting)
  const makeParsedRows = (obj) => Object.entries(obj || {})
    .filter(([_, v]) => typeof v === 'number')
    .map(([k, v]) => {
      const isPercent = /rate|percent|pct/i.test(k);
      return {
        name: toTitle(k),
        value: isPercent ? pct(v * (String(v) < 1 ? 100 : 1)) : currency0(v)
      };
    })
    .sort((a,b) => a.name.localeCompare(b.name));

  const parsedSimpleColumns = [
    { key: 'name', label: 'Parsed Field' },
    { key: 'value', label: 'Value', align: 'right' }
  ];

  return (
    <div style={{ padding: '16px' }}>
      <SectionTitle>Unit Mix & Scheduled Income</SectionTitle>
      <Table columns={headerColumnsUM} rows={unitMixRows.rows} footer={unitMixRows.footer} />

      <SectionTitle>Annual Operating Summary</SectionTitle>
      <Table columns={aosColumns} rows={aosRows} />

      <SectionTitle>Pro Forma Annual Operating Summary</SectionTitle>
      <Table columns={expColumns} rows={expRows} footer={[{ name: 'Total Expenses', pctSGI: pct(((totalExpenses||0) / (pnl.gross_potential_rent||1)) * 100), val: currency0(totalExpenses), perUnit: currency0(totalUnits ? totalExpenses/totalUnits : 0) }]} />

      {allExpenseRows.length > 0 && (
        <>
          <SectionTitle>All Parsed Expenses</SectionTitle>
          <Table columns={allExpColumns} rows={allExpenseRows} />
        </>
      )}

      {/* Additional parsed data tables for completeness */}
      {Object.keys(pnl || {}).length > 0 && (
        <>
          <SectionTitle>Parsed PNL (All Numeric Fields)</SectionTitle>
          <Table columns={parsedSimpleColumns} rows={makeParsedRows(pnl)} />
        </>
      )}

      {Object.keys(sd.pricing_financing || {}).length > 0 && (
        <>
          <SectionTitle>Pricing & Financing (Parsed)</SectionTitle>
          <Table columns={parsedSimpleColumns} rows={makeParsedRows(sd.pricing_financing)} />
        </>
      )}

      {Object.keys(sd.underwriting || {}).length > 0 && (
        <>
          <SectionTitle>Underwriting Assumptions (Parsed)</SectionTitle>
          <Table columns={parsedSimpleColumns} rows={makeParsedRows(sd.underwriting)} />
        </>
      )}
    </div>
  );
}
