import React, { useEffect, useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';

const currency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
const percent = (v, d=2) => `${((v || 0)).toFixed(d)}%`;
const number = (v, d=0) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const sectionHeader = {
  backgroundColor: '#1f2937',
  color: 'white',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: '700',
  textTransform: 'uppercase'
};
const subHeader = {
  backgroundColor: '#6d28d9',
  color: 'white',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: '700',
  textTransform: 'uppercase'
};
const table = {
  width: '100%',
  borderCollapse: 'collapse',
  border: '1px solid #e5e7eb',
  backgroundColor: 'white'
};
const labelCell = {
  padding: '6px 8px',
  fontSize: '12px',
  color: '#374151',
  borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #e5e7eb',
};
const valueCell = {
  padding: '6px 8px',
  fontSize: '12px',
  textAlign: 'right',
  borderBottom: '1px solid #e5e7eb'
};

const EquityPartnerTab = ({ scenarioData, fullCalcs }) => {
  const [state, setState] = useState({});

  useEffect(() => {
    const pf = scenarioData?.pricing_financing || {};
    const prop = scenarioData?.property || {};
    const u = scenarioData?.underwriting || {};
    const fc = fullCalcs || {};
    const fcFin = fc.financing || {};
    const fcYr1 = fc.year1 || {};
    const fcRet = fc.returns || {};

    const purchasePrice = pf.price ?? pf.purchase_price ?? 0;
    const closingCostsPct = pf.closing_costs_pct ?? 2.0;
    const closingCosts = Math.round(purchasePrice * (closingCostsPct / 100));
    const loanAmount = pf.loan_amount ?? fcFin.loanAmount ?? 0;
    const totalAcq = purchasePrice + closingCosts;
    const totalDebt = loanAmount;
    const requiredEquity = Math.max(totalAcq - totalDebt, 0);

    const lpShare = 0.9; // default ownership split
    const gpShare = 0.1;
    const prefReturnPct = (u.pref_return_pct != null) ? u.pref_return_pct : 8.0;
    const preSplitLP = (u.pre_pref_lp_split != null) ? u.pre_pref_lp_split : 70.0;
    const preSplitGP = (u.pre_pref_gp_split != null) ? u.pre_pref_gp_split : 30.0;
    const postSplitLP = (u.post_pref_lp_split != null) ? u.post_pref_lp_split : 70.0;
    const gpPromote = (u.gp_promote_pct != null) ? u.gp_promote_pct : 30.0;

    const exitCap = (u.exit_cap_rate != null) ? u.exit_cap_rate : (fcRet.marketCapRateY1 ?? 6.0);
    const holdYears = (u.holding_period != null) ? u.holding_period : (fcRet.holdingPeriod ?? 5);
    const exitNoi = fcRet.terminalValue && exitCap ? null : (fcYr1.noi ?? scenarioData?.pnl?.noi ?? 0);
    const grossSale = fcRet.terminalValue ?? (exitNoi && exitCap ? Math.round((exitNoi) / (exitCap > 1 ? exitCap/100 : exitCap)) : 0);
    const sellCostsPct = (u.sales_costs_pct != null) ? u.sales_costs_pct : 2.0;
    const sellingCosts = Math.round(grossSale * (sellCostsPct / 100));
    const loanPayoff = loanAmount; // approximation
    const netSaleProceeds = Math.max(grossSale - sellingCosts - loanPayoff, 0);

    const lpEquity = Math.round(requiredEquity * lpShare);
    const gpEquity = Math.round(requiredEquity * gpShare);

    const distCashY = fcYr1.cashFlow ?? 0;
    const dist = [1,2,3,4,5].map(() => distCashY);

    const lpPrefAnnual = Math.round(lpEquity * ((prefReturnPct > 1 ? prefReturnPct/100 : prefReturnPct)));
    const lpDist = dist.map(y => Math.max(Math.min(y, lpPrefAnnual), 0));
    const gpDist = dist.map((y, i) => Math.max(y - lpDist[i], 0) * (postSplitLP < 100 ? (100-postSplitLP)/100 : 0));

    const lpExitProceeds = Math.round(netSaleProceeds * (postSplitLP/100));

    const lpTotalDists = lpDist.reduce((s,x)=>s+x,0) + lpExitProceeds;
    const gpTotalDists = gpDist.reduce((s,x)=>s+x,0) + (netSaleProceeds - lpExitProceeds);

    setState({
      purchasePrice, closingCostsPct, closingCosts, totalAcq,
      loanAmount, totalDebt, requiredEquity,
      lpEquity, gpEquity, lpSharePct: lpShare*100, gpSharePct: gpShare*100,
      prefReturnPct, preSplitLP, preSplitGP, postSplitLP, gpPromote,
      exitCap, holdYears, grossSale, sellingCosts, loanPayoff, netSaleProceeds,
      distCashY, lpPrefAnnual, lpDist, gpDist, lpExitProceeds,
      lpTotalDists, gpTotalDists,
    });
  }, [scenarioData, fullCalcs]);

  const Row = ({ label, value, fmt='currency', bold=false }) => (
    <tr>
      <td style={{ ...labelCell, fontWeight: bold ? '700' : '500', backgroundColor: bold ? '#f3f4f6' : 'white' }}>{label}</td>
      <td style={{ ...valueCell, fontWeight: bold ? '700' : '600', backgroundColor: bold ? '#fef3c7' : 'white' }}>
        {fmt==='currency' ? currency(value) : fmt==='percent' ? percent(value) : number(value)}
      </td>
    </tr>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PieChart size={28} color="#3b82f6" />
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Equity Partner Summary</h1>
      </div>

      {/* Top two-column sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={sectionHeader}>Investment Summary</div>
          <table style={table}><tbody>
            <Row label="Total Acquisition Cost" value={state.totalAcq} bold />
            <Row label="(-) Total Debt" value={state.totalDebt} />
            <Row label="Required Equity" value={state.requiredEquity} bold />
            <Row label="LP Equity Investment" value={state.lpEquity} />
            <Row label="GP Equity Investment" value={state.gpEquity} />
            <Row label="LP Ownership %" value={state.lpSharePct} fmt='percent' />
            <Row label="GP Ownership %" value={state.gpSharePct} fmt='percent' />
          </tbody></table>
        </div>
        <div>
          <div style={sectionHeader}>Waterfall Structure</div>
          <table style={table}><tbody>
            <Row label="Preferred Return (Pref)" value={state.prefReturnPct} fmt='percent' />
          </tbody></table>
          <div style={subHeader}>Pre-Pref Splits:</div>
          <table style={table}><tbody>
            <Row label="LP Share" value={state.preSplitLP} fmt='percent' />
            <Row label="GP Share" value={state.preSplitGP} fmt='percent' />
          </tbody></table>
          <div style={subHeader}>Post-Pref Splits:</div>
          <table style={table}><tbody>
            <Row label="LP Share" value={state.postSplitLP} fmt='percent' />
            <Row label="GP Promote" value={state.gpPromote} fmt='percent' />
          </tbody></table>
        </div>
      </div>

      {/* Exit Strategy */}
      <div style={{ marginTop: 16 }}>
        <div style={sectionHeader}>Exit Strategy</div>
        <table style={table}><tbody>
          <Row label="Exit Cap Rate" value={state.exitCap} fmt='percent' />
          <Row label="Forward NOI at Exit" value={state.grossSale && state.exitCap ? Math.round(state.grossSale * (state.exitCap > 1 ? state.exitCap/100 : state.exitCap)) : 0} />
          <Row label="Hold Period" value={state.holdYears} fmt='number' />
        </tbody></table>
        <table style={table}><tbody>
          <Row label="Gross Sale Price" value={state.grossSale} />
          <Row label="(-) Selling Costs" value={state.sellingCosts} />
          <Row label="(-) Loan Payoffs" value={state.loanPayoff} />
          <Row label="Net Sale Proceeds" value={state.netSaleProceeds} bold />
        </tbody></table>
      </div>

      {/* Annual Distribution Waterfall */}
      <div style={{ marginTop: 16 }}>
        <div style={sectionHeader}>Annual Distribution Waterfall</div>
        <table style={table}><thead>
          <tr>
            <th style={{ ...labelCell, width: '35%' }}>Distributable Cash</th>
            {[1,2,3,4,5,'Exit'].map((y,i)=> (
              <th key={i} style={{ ...valueCell, textAlign: 'center' }}>{typeof y==='string'?y:`Year ${y}`}</th>
            ))}
          </tr>
        </thead><tbody>
          <tr>
            <td style={labelCell}>Amount</td>
            {[1,2,3,4,5].map((_,i)=> (
              <td key={i} style={{ ...valueCell }}>{currency(state.lpDist?.[i] + state.gpDist?.[i] || state.distCashY || 0)}</td>
            ))}
            <td style={{ ...valueCell }}>{currency(state.netSaleProceeds || 0)}</td>
          </tr>
          <tr>
            <td style={labelCell}>LP Preferred Return</td>
            {[1,2,3,4,5].map((_,i)=> (
              <td key={i} style={{ ...valueCell }}>{currency(state.lpPrefAnnual || 0)}</td>
            ))}
            <td style={{ ...valueCell }}>-</td>
          </tr>
          <tr>
            <td style={labelCell}>LP Distribution</td>
            {[1,2,3,4,5].map((_,i)=> (
              <td key={i} style={{ ...valueCell }}>{currency(state.lpDist?.[i] || 0)}</td>
            ))}
            <td style={{ ...valueCell }}>{currency(state.lpExitProceeds || 0)}</td>
          </tr>
          <tr>
            <td style={labelCell}>GP Distribution</td>
            {[1,2,3,4,5].map((_,i)=> (
              <td key={i} style={{ ...valueCell }}>{currency(state.gpDist?.[i] || 0)}</td>
            ))}
            <td style={{ ...valueCell }}>{currency((state.netSaleProceeds || 0) - (state.lpExitProceeds || 0))}</td>
          </tr>
        </tbody></table>
      </div>

      {/* Return Metrics + LP Cash Flow Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <div style={sectionHeader}>Return Metrics</div>
          <table style={table}><thead>
            <tr>
              <th style={{ ...labelCell }}>Metric</th>
              <th style={{ ...valueCell }}>LP</th>
              <th style={{ ...valueCell }}>GP</th>
              <th style={{ ...valueCell }}>Total</th>
            </tr>
          </thead><tbody>
            <tr>
              <td style={labelCell}>Initial Investment</td>
              <td style={valueCell}>{currency(state.lpEquity)}</td>
              <td style={valueCell}>{currency(state.gpEquity)}</td>
              <td style={valueCell}>{currency(state.requiredEquity)}</td>
            </tr>
            <tr>
              <td style={labelCell}>Total Distributions</td>
              <td style={valueCell}>{currency(state.lpTotalDists)}</td>
              <td style={valueCell}>{currency(state.gpTotalDists)}</td>
              <td style={valueCell}>{currency((state.lpTotalDists || 0) + (state.gpTotalDists || 0))}</td>
            </tr>
            <tr>
              <td style={labelCell}>Net Profit</td>
              <td style={valueCell}>{currency((state.lpTotalDists || 0) - (state.lpEquity || 0))}</td>
              <td style={valueCell}>{currency((state.gpTotalDists || 0) - (state.gpEquity || 0))}</td>
              <td style={valueCell}>{currency(((state.lpTotalDists || 0) + (state.gpTotalDists || 0)) - (state.requiredEquity || 0))}</td>
            </tr>
            <tr>
              <td style={labelCell}>Multiple on Invested Capital</td>
              <td style={valueCell}>{number(((state.lpTotalDists || 0) / (state.lpEquity || 1)), 2)}</td>
              <td style={valueCell}>{number(((state.gpTotalDists || 0) / (state.gpEquity || 1)), 2)}</td>
              <td style={valueCell}>{number((((state.lpTotalDists || 0) + (state.gpTotalDists || 0)) / (state.requiredEquity || 1)), 2)}</td>
            </tr>
            <tr>
              <td style={labelCell}>Cash-on-Cash (Year 1)</td>
              <td style={valueCell}>{percent(((state.lpDist?.[0] || 0) / (state.lpEquity || 1)) * 100, 1)}</td>
              <td style={valueCell}>{percent(((state.gpDist?.[0] || 0) / (state.gpEquity || 1)) * 100, 1)}</td>
              <td style={valueCell}>{percent((((state.lpDist?.[0] || 0) + (state.gpDist?.[0] || 0)) / (state.requiredEquity || 1)) * 100, 1)}</td>
            </tr>
          </tbody></table>
        </div>
        <div>
          <div style={sectionHeader}>LP Cash Flow Summary</div>
          <table style={table}><tbody>
            <Row label="Initial Investment" value={state.lpEquity} />
            {[1,2,3,4,5].map((y,i)=> (
              <Row key={i} label={`Year ${y} Distribution`} value={state.lpDist?.[i] || 0} />
            ))}
            <Row label="Exit Proceeds (LP Share)" value={state.lpExitProceeds || 0} />
            <Row label="Net Cash Position" value={(state.lpTotalDists || 0) - (state.lpEquity || 0)} bold />
          </tbody></table>
        </div>
      </div>
    </div>
  );
};

export default EquityPartnerTab;
