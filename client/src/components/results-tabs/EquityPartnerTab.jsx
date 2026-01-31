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

const EquityPartnerTab = ({ scenarioData, fullCalcs, onEditData }) => {
  const fc = fullCalcs || {};
  const fcFin = fc.financing || {};
  const fcYr1 = fc.year1 || {};
  const fcRet = fc.returns || {};

  const pf = scenarioData?.pricing_financing || {};
  const u = scenarioData?.underwriting || {};

  const initialInputs = useMemo(() => {
    const ov = scenarioData?.equityPartnerOverrides || {};
    return {
      purchasePrice: ov.purchasePrice ?? pf.price ?? pf.purchase_price ?? 0,
      closingCostsPct: ov.closingCostsPct ?? pf.closing_costs_pct ?? 2.0,
      loanAmount: ov.loanAmount ?? pf.loan_amount ?? fcFin.loanAmount ?? 0,
      lpSharePct: ov.lpSharePct ?? 90.0,
      gpSharePct: ov.gpSharePct ?? (100 - (ov.lpSharePct ?? 90.0)),
      prefReturnPct: ov.prefReturnPct ?? ((u.pref_return_pct != null) ? u.pref_return_pct : 8.0),
      preSplitLP: ov.preSplitLP ?? ((u.pre_pref_lp_split != null) ? u.pre_pref_lp_split : 70.0),
      preSplitGP: ov.preSplitGP ?? ((u.pre_pref_gp_split != null) ? u.pre_pref_gp_split : 30.0),
      postSplitLP: ov.postSplitLP ?? ((u.post_pref_lp_split != null) ? u.post_pref_lp_split : 70.0),
      gpPromote: ov.gpPromote ?? ((u.gp_promote_pct != null) ? u.gp_promote_pct : 30.0),
      exitCap: ov.exitCap ?? ((u.exit_cap_rate != null) ? u.exit_cap_rate : (fcRet.marketCapRateY1 ?? 6.0)),
      holdYears: ov.holdYears ?? ((u.holding_period != null) ? u.holding_period : (fcRet.holdingPeriod ?? 5)),
      sellCostsPct: ov.sellCostsPct ?? ((u.sales_costs_pct != null) ? u.sales_costs_pct : 2.0),
      forwardNoiExit: ov.forwardNoiExit ?? (fcRet.forwardNOIAtExit ?? fcRet.noiAtExit ?? fcYr1.noi ?? scenarioData?.pnl?.noi ?? 0),
      lpEquityOverride: ov.lpEquityOverride ?? undefined,
      gpEquityOverride: ov.gpEquityOverride ?? undefined,
      distByYear: ov.distByYear ?? [1,2,3,4,5].map(() => fcYr1.cashFlow ?? 0),
    };
  }, [pf, u, fcFin, fcYr1, fcRet, scenarioData]);

  const [inputs, setInputs] = useState(initialInputs);

  useEffect(() => {
    setInputs(initialInputs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioData, fullCalcs]);

  const computeState = useMemo(() => {
    const lpShareInput = (inputs.lpSharePct != null) ? inputs.lpSharePct : (100 - (inputs.gpSharePct || 0));
    const lpShare = Math.max(0, Math.min(1, (lpShareInput || 0) / 100));
    const gpShare = Math.max(0, Math.min(1, 1 - lpShare));
    const closingCosts = Math.round((inputs.purchasePrice || 0) * ((inputs.closingCostsPct || 0) / 100));
    const totalAcq = (inputs.purchasePrice || 0) + closingCosts;
    const totalDebt = inputs.loanAmount || 0;
    const requiredEquity = Math.max(totalAcq - totalDebt, 0);

    const lpEquity = inputs.lpEquityOverride != null ? Number(inputs.lpEquityOverride) : Math.round(requiredEquity * lpShare);
    const gpEquity = inputs.gpEquityOverride != null ? Number(inputs.gpEquityOverride) : Math.round(requiredEquity * gpShare);

    const exitNoiBase = (inputs.forwardNoiExit != null ? inputs.forwardNoiExit : (fcRet.forwardNOIAtExit ?? fcRet.noiAtExit ?? fcYr1.noi ?? scenarioData?.pnl?.noi ?? 0));
    const exitCapPct = (inputs.exitCap > 1 ? inputs.exitCap/100 : inputs.exitCap) || 0;
    const grossSale = fcRet.terminalValue ?? (exitCapPct > 0 ? Math.round(exitNoiBase / exitCapPct) : 0);
    const sellingCosts = Math.round((grossSale || 0) * ((inputs.sellCostsPct || 0) / 100));
    const loanPayoff = inputs.loanAmount || 0;
    const netSaleProceeds = Math.max((grossSale || 0) - sellingCosts - loanPayoff, 0);

    const lpPrefAnnual = Math.round(lpEquity * ((inputs.prefReturnPct > 1 ? inputs.prefReturnPct/100 : inputs.prefReturnPct)));
    const lpDist = (inputs.distByYear || []).map(y => Math.max(Math.min(y || 0, lpPrefAnnual), 0));
    const gpDist = (inputs.distByYear || []).map((y, i) => Math.max((y || 0) - (lpDist[i] || 0), 0) * (inputs.postSplitLP < 100 ? (100-inputs.postSplitLP)/100 : 0));

    const lpExitProceeds = Math.round((netSaleProceeds || 0) * ((inputs.postSplitLP || 0)/100));

    const lpTotalDists = (lpDist.reduce((s,x)=>s+(x||0),0)) + (lpExitProceeds || 0);
    const gpTotalDists = (gpDist.reduce((s,x)=>s+(x||0),0)) + ((netSaleProceeds || 0) - (lpExitProceeds || 0));

    const downPayment = Math.max((inputs.purchasePrice || 0) - (inputs.loanAmount || 0), 0);
    const downPaymentPct = (inputs.purchasePrice || 0) > 0 ? (downPayment / (inputs.purchasePrice || 1)) * 100 : 0;
    const epContribution = lpEquity;
    const epContributionPct = requiredEquity > 0 ? (lpEquity / requiredEquity) * 100 : 0;

    return {
      purchasePrice: inputs.purchasePrice,
      closingCostsPct: inputs.closingCostsPct,
      closingCosts,
      totalAcq,
      loanAmount: inputs.loanAmount,
      totalDebt,
      requiredEquity,
      lpEquity, gpEquity, lpSharePct: inputs.lpSharePct, gpSharePct: (inputs.gpSharePct != null ? inputs.gpSharePct : gpShare*100),
      prefReturnPct: inputs.prefReturnPct, preSplitLP: inputs.preSplitLP, preSplitGP: inputs.preSplitGP, postSplitLP: inputs.postSplitLP, gpPromote: inputs.gpPromote,
      exitCap: inputs.exitCap, holdYears: inputs.holdYears, grossSale, sellingCosts, loanPayoff, netSaleProceeds,
      distCashY: (inputs.distByYear?.[0]) || 0, lpPrefAnnual, lpDist, gpDist, lpExitProceeds,
      lpTotalDists, gpTotalDists,
      sellCostsPct: inputs.sellCostsPct,
      downPayment, downPaymentPct, epContribution, epContributionPct,
      forwardNoiExit: exitNoiBase,
    };
  }, [inputs, fcYr1, fcRet, scenarioData]);
  const onChangeShare = (field, value) => {
    const num = typeof value === 'string' ? Number(value) : value;
    const safe = isNaN(num) ? 0 : num;
    setInputs(prev => {
      const next = { ...prev };
      if (field === 'lpSharePct') {
        next.lpSharePct = safe; next.gpSharePct = Math.max(0, 100 - safe);
      } else if (field === 'gpSharePct') {
        next.gpSharePct = safe; next.lpSharePct = Math.max(0, 100 - safe);
      }
      if (typeof onEditData === 'function') { try { onEditData('equityPartnerOverrides', next); } catch (_) {} }
      return next;
    });
  };

  const state = computeState;

  const onChange = (field, value) => {
    const num = typeof value === 'string' ? Number(value) : value;
    setInputs(prev => {
      const next = { ...prev, [field]: isNaN(num) ? 0 : num };
      if (typeof onEditData === 'function') {
        try { onEditData('equityPartnerOverrides', next); } catch (_) {}
      }
      return next;
    });
  };
  const onChangeDist = (idx, value) => {
    const num = typeof value === 'string' ? Number(value) : value;
    setInputs(prev => {
      const nextDist = [...(prev.distByYear || [])];
      nextDist[idx] = isNaN(num) ? 0 : num;
      const next = { ...prev, distByYear: nextDist };
      if (typeof onEditData === 'function') {
        try { onEditData('equityPartnerOverrides', next); } catch (_) {}
      }
      return next;
    });
  };
  const onSave = () => {
    if (typeof onEditData === 'function') {
      onEditData('equityPartnerOverrides', inputs);
    }
  };
  const onReset = () => setInputs(initialInputs);

  const Row = ({ label, value, fmt='currency', bold=false, editable=false, onValueChange }) => (
    <tr>
      <td style={{ ...labelCell, fontWeight: bold ? '700' : '500', backgroundColor: bold ? '#f3f4f6' : 'white' }}>{label}</td>
      <td style={{ ...valueCell, fontWeight: bold ? '700' : '600', backgroundColor: bold ? '#fef3c7' : 'white' }}>
        {editable ? (
          <input
            type="number"
            value={value ?? 0}
            onChange={(e) => onValueChange?.(e.target.value)}
            step={fmt==='percent' ? '0.1' : fmt==='currency' ? '100' : '1'}
            style={{ width: 120, textAlign: 'right', padding: 4 }}
          />
        ) : (
          fmt==='currency' ? currency(value) : fmt==='percent' ? percent(value) : number(value)
        )}
      </td>
    </tr>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PieChart size={28} color="#3b82f6" />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Equity Partner Summary</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSave} style={{ padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700 }}>Save Edits</button>
          <button onClick={onReset} style={{ padding: '8px 12px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700 }}>Reset</button>
        </div>
      </div>

      {/* Top two-column sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={sectionHeader}>Investment Summary</div>
          <table style={table}><tbody>
            <Row label="Purchase Price" value={state.purchasePrice} fmt='currency' editable onValueChange={(v)=>onChange('purchasePrice', v)} />
            <Row label="Closing Costs %" value={state.closingCostsPct} fmt='percent' editable onValueChange={(v)=>onChange('closingCostsPct', v)} />
            <Row label="Loan Amount" value={state.loanAmount} fmt='currency' editable onValueChange={(v)=>onChange('loanAmount', v)} />
            <Row label="Down Payment" value={state.downPayment} fmt='currency' />
            <Row label="Down Payment %" value={state.downPaymentPct} fmt='percent' />
            <Row label="Total Acquisition Cost" value={state.totalAcq} bold />
            <Row label="(-) Total Debt" value={state.totalDebt} />
            <Row label="Required Equity" value={state.requiredEquity} bold />
            <Row label="LP Equity Investment" value={state.lpEquity} fmt='currency' editable onValueChange={(v)=>onChange('lpEquityOverride', v)} />
            <Row label="GP Equity Investment" value={state.gpEquity} fmt='currency' editable onValueChange={(v)=>onChange('gpEquityOverride', v)} />
            <Row label="LP Ownership %" value={state.lpSharePct} fmt='percent' editable onValueChange={(v)=>onChangeShare('lpSharePct', v)} />
            <Row label="GP Ownership %" value={state.gpSharePct} fmt='percent' editable onValueChange={(v)=>onChangeShare('gpSharePct', v)} />
            <Row label="Equity Partner Contribution" value={state.epContribution} fmt='currency' />
            <Row label="Equity Partner Contribution %" value={state.epContributionPct} fmt='percent' />
          </tbody></table>
        </div>
        <div>
          <div style={sectionHeader}>Waterfall Structure</div>
          <table style={table}><tbody>
            <Row label="Preferred Return (Pref)" value={state.prefReturnPct} fmt='percent' editable onValueChange={(v)=>onChange('prefReturnPct', v)} />
          </tbody></table>
          <div style={subHeader}>Pre-Pref Splits:</div>
          <table style={table}><tbody>
            <Row label="LP Share" value={state.preSplitLP} fmt='percent' editable onValueChange={(v)=>onChange('preSplitLP', v)} />
            <Row label="GP Share" value={state.preSplitGP} fmt='percent' editable onValueChange={(v)=>onChange('preSplitGP', v)} />
          </tbody></table>
          <div style={subHeader}>Post-Pref Splits:</div>
          <table style={table}><tbody>
            <Row label="LP Share" value={state.postSplitLP} fmt='percent' editable onValueChange={(v)=>onChange('postSplitLP', v)} />
            <Row label="GP Promote" value={state.gpPromote} fmt='percent' editable onValueChange={(v)=>onChange('gpPromote', v)} />
          </tbody></table>
        </div>
      </div>

      {/* Exit Strategy */}
      <div style={{ marginTop: 16 }}>
        <div style={sectionHeader}>Exit Strategy</div>
        <table style={table}><tbody>
          <Row label="Exit Cap Rate" value={state.exitCap} fmt='percent' editable onValueChange={(v)=>onChange('exitCap', v)} />
          <Row label="Forward NOI at Exit" value={state.forwardNoiExit} fmt='currency' editable onValueChange={(v)=>onChange('forwardNoiExit', v)} />
          <Row label="Hold Period" value={state.holdYears} fmt='number' editable onValueChange={(v)=>onChange('holdYears', v)} />
        </tbody></table>
        <table style={table}><tbody>
          <Row label="Gross Sale Price" value={state.grossSale} />
          <Row label="Selling Costs %" value={state.sellCostsPct} fmt='percent' editable onValueChange={(v)=>onChange('sellCostsPct', v)} />
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
              <td key={i} style={{ ...valueCell }}>
                <input
                  type="number"
                  value={inputs.distByYear?.[i] ?? 0}
                  onChange={(e)=>onChangeDist(i, e.target.value)}
                  step="100"
                  style={{ width: 120, textAlign: 'right', padding: 4 }}
                />
              </td>
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
