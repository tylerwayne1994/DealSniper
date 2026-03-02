import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DollarSign, Calculator,
  Wallet, Plus, X, Trash2,
  BarChart3, ArrowRight, Edit3
} from 'lucide-react';

const calcMonthlyPayment = (principal, annualRate, amortMonths) => {
  if (principal <= 0 || amortMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / amortMonths;
  return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
};
const fmt = (v) => { if (v == null || isNaN(v)) return '$0'; return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); };
const pct = (v) => { if (v == null || isNaN(v)) return '0%'; return `${v.toFixed(2)}%`; };

const buildStructureFromLoans = (loans, pp, noi) => {
  if (!loans?.length || pp <= 0) return null;
  const en = loans.filter(l => l.enabled !== false);
  const debt = en.filter(l => l.type !== 'Equity Partner');
  const eq = en.filter(l => l.type === 'Equity Partner');
  const ld = debt.map(l => {
    const amt = (l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc') ? pp*(Number(l.ltv)||0)/100 : Number(l.loanDollar)||0;
    const r=(Number(l.rate)||0)/100/12, n=(Number(l.amort)||30)*12;
    let mp=0; if(amt>0&&r>0&&n>0) mp=amt*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    return {...l, loanAmt:amt, monthlyPmt:mp, fees:amt*(Number(l.fees)||0)/100, annualDS:mp*12};
  });
  const ed = eq.map(l => {
    const pe=Number(l.loanDollar)||0, pr=(Number(l.rate)||8)/100, ap=pe*pr;
    const bYrs=Number(l.balloonYrs)||5, bAmt=l.doubleInvestment?pe*2:pe;
    return {...l, partnerEquity:pe, annualPref:ap, monthlyPref:ap/12, balloonYrs:bYrs, balloonAmt:bAmt};
  });
  const tla=ld.reduce((s,l)=>s+l.loanAmt,0), tmd=ld.reduce((s,l)=>s+l.monthlyPmt,0);
  const tf=ld.reduce((s,l)=>s+l.fees,0), te=ed.reduce((s,l)=>s+l.partnerEquity,0);
  const tap=ed.reduce((s,l)=>s+l.annualPref,0);
  const ads=tmd*12, tmp=tmd+(tap/12), tapm=tmp*12;
  const dp=Math.max(0,pp-tla-te), coop=dp+tf, cf=noi-tapm;
  const dscr=ads>0?noi/ads:0, coc=coop>0?(cf/coop)*100:0;
  const ltv=pp>0?(tla/pp*100):0, ltc=(pp+tf)>0?(tla/(pp+tf)*100):0;
  const blendedRate=tla>0?ld.reduce((s,l)=>s+(l.loanAmt/tla)*Number(l.rate||0),0):0;
  return {loanDetails:ld,equityDetails:ed,totalLoanAmt:tla,totalMonthlyDebt:tmd,totalFees:tf,totalEquity:te,totalAnnualPref:tap,annualDebtService:ads,totalMonthlyPmt:tmp,totalAnnualPmt:tapm,downPayment:dp,cashOutOfPocket:coop,cashflow:cf,dscr,cashOnCash:coc,ltv,ltc,blendedRate,totalAcquisitionCost:pp+tf};
};

const generateAlts = (pp, noi) => {
  const mk = (n,ltv,r,am,cl,d) => {
    const lo=pp*ltv/100,dn=pp-lo,mo=calcMonthlyPayment(lo,r,am*12),an=mo*12,cf=noi-an,co=dn+pp*cl/100;
    return {name:n,totalLoanAmt:lo,downPayment:dn,cashOutOfPocket:co,totalMonthlyPmt:mo,annualDebtService:an,cashflow:cf,dscr:an>0?noi/an:0,cashOnCash:co>0?(cf/co)*100:0,ltv,desc:d};
  };
  const a = {};
  a['alt-traditional']=mk('Traditional (75%)',75,6.5,30,3,'75% LTV, 6.5%, 30yr');
  a['alt-aggressive']=mk('Aggressive (80%)',80,6.75,30,3,'80% LTV, 6.75%, 30yr');
  a['alt-conservative']=mk('Conservative (65%)',65,6.0,30,2,'65% LTV, 6.0%, 30yr');
  const sl=pp*0.85,sd=pp-sl,sm=calcMonthlyPayment(sl,5.5,240),sa=sm*12,sc=noi-sa,so=sd+pp*0.02;
  a['alt-seller']=({name:'Seller Finance (85%)',totalLoanAmt:sl,downPayment:sd,cashOutOfPocket:so,totalMonthlyPmt:sm,annualDebtService:sa,cashflow:sc,dscr:sa>0?noi/sa:0,cashOnCash:so>0?(sc/so)*100:0,ltv:85,desc:'85% LTV, 5.5%, 20yr'});
  return a;
};

const B='#e5e7eb',AC='#4f46e5',LB='#6b7280',VL='#111827';
const IS={width:'100%',padding:'8px 10px',border:`1px solid ${B}`,borderRadius:6,fontSize:13,background:'#fff',fontFamily:'inherit',outline:'none',color:VL};
const SC={backgroundColor:'#fff',borderRadius:16,padding:'24px 28px',marginBottom:24,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',border:`1px solid ${B}`};
const loanColor=t=>({'Senior Loan':'#3b82f6','Mezzanine Loan':'#f97316','Seller Financing':'#a855f7','Second Debt':'#06b6d4','Equity Partner':'#22c55e'}[t]||'#6b7280');
const loanIcon=t=>({'Senior Loan':'🏦','Mezzanine Loan':'🏛️','Seller Financing':'🤝','Second Debt':'📄','Equity Partner':'👥'}[t]||'💰');

const Field=React.memo(({label,value,onChange,suffix,prefix,step,min})=>(
  <div style={{marginBottom:12}}>
    <label style={{display:'block',fontSize:11,fontWeight:600,color:LB,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</label>
    <div style={{position:'relative',display:'flex',alignItems:'center'}}>
      {prefix&&<span style={{position:'absolute',left:10,fontSize:13,color:LB,pointerEvents:'none'}}>{prefix}</span>}
      <input type="number" step={step||'any'} min={min??0} value={value} onChange={e=>onChange(Number(e.target.value))}
        style={{...IS,paddingLeft:prefix?24:10,paddingRight:suffix?30:10}}/>
      {suffix&&<span style={{position:'absolute',right:10,fontSize:12,color:LB,pointerEvents:'none'}}>{suffix}</span>}
    </div>
  </div>
));

export default function DealStructureTab({scenarioData,calculations,fullCalcs,marketCapRate,onFieldChange,onRecommendationChange,onSelectedStructureMetricsChange}){
  const pp=scenarioData?.pricing_financing?.price||scenarioData?.pricing_financing?.purchase_price||0;
  const noi=fullCalcs?.year1?.noi||scenarioData?.pnl?.noi_t12||scenarioData?.pnl?.noi||0;
  const financing=useMemo(()=>scenarioData?.financing||{},[scenarioData?.financing]);
  const proformaNOI=fullCalcs?.stabilized?.noi||scenarioData?.proforma?.projected_noi||noi*1.15;
  const goingInCap=pp>0&&noi>0?(noi/pp)*100:5.5;

  // ═══ EDITABLE LOANS — synced with ExpenseV2Tab ═══
  const [loans,setLoans]=useState(()=>{
    const s=financing.loans||[];
    if(s.length>0) return s.map(l=>({...l}));
    return [{id:'senior',type:'Senior Loan',enabled:true,loanAmtMode:'ltv',ltv:Number(financing.ltv)||70,loanDollar:0,rate:Number(financing.interest_rate)||5.96,term:Number(financing.loan_term_years)||10,amort:Number(financing.amortization_years)||30,io:Number(financing.io_years)||0,fees:Number(financing.loan_fees_percent)||1.5}];
  });

  // On mount: if we created default loans (financing.loans was empty),
  // immediately sync to parent so the calculation engine sees debt service
  useEffect(()=>{
    if(loans.length>0 && !(financing.loans?.length>0)){
      saveToParent(loans);
    }
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevRef=useRef(null);
  useEffect(()=>{
    const inc=financing.loans;
    if(!inc||!inc.length) return;
    const js=JSON.stringify(inc);
    if(prevRef.current===js) return;
    prevRef.current=js;
    if(JSON.stringify(loans)!==js) setLoans(inc.map(l=>({...l})));
  },[financing.loans]); // eslint-disable-line

  const saveToParent=useCallback((ul)=>{
    if(!onFieldChange) return;
    onFieldChange('financing.loans',ul);
    const en=ul.filter(l=>l.enabled!==false);
    let tla=0,tmp=0,tf=0,teq=0;
    en.filter(l=>l.type!=='Equity Partner').forEach(l=>{
      const a=(l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc')?pp*(Number(l.ltv)||0)/100:Number(l.loanDollar)||0;
      const r=(Number(l.rate)||0)/100/12,n=(Number(l.amort)||30)*12;
      let p=0;if(a>0&&r>0&&n>0)p=a*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      tla+=a;tmp+=p;tf+=a*(Number(l.fees)||0)/100;
    });
    en.filter(l=>l.type==='Equity Partner').forEach(l=>{
      const e=Number(l.loanDollar)||0;teq+=e;tmp+=e*(Number(l.rate)||8)/100/12;
    });
    onFieldChange('financing.total_loan_amount',tla);
    onFieldChange('financing.annual_debt_service',tmp*12);
    onFieldChange('financing.down_payment',Math.max(0,pp-tla-teq));
    onFieldChange('financing.total_acquisition_cost',pp+tf);
    onFieldChange('financing.ltc_ratio',(pp+tf)>0?(tla/(pp+tf)*100):0);
    const sr=ul.find(l=>l.type==='Senior Loan');
    if(sr){onFieldChange('financing.ltv',sr.ltv||0);onFieldChange('financing.interest_rate',sr.rate||0);onFieldChange('financing.loan_term_years',sr.term||0);onFieldChange('financing.amortization_years',sr.amort||0);onFieldChange('financing.io_years',sr.io||0);onFieldChange('financing.loan_fees_percent',sr.fees||0);}
  },[onFieldChange,pp]);

  const saveTimerRef=useRef(null);
  const updateLoanField=useCallback((id,f,v)=>{
    setLoans(p=>{
      const u=p.map(l=>l.id===id?{...l,[f]:v}:l);
      if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current=setTimeout(()=>saveToParent(u),500);
      return u;
    });
  },[saveToParent]);
  const updateLoanFields=useCallback((id,updates)=>{
    setLoans(p=>{
      const u=p.map(l=>l.id===id?{...l,...updates}:l);
      if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current=setTimeout(()=>saveToParent(u),500);
      return u;
    });
  },[saveToParent]);

  const addLoan=useCallback((type)=>{
    const defs={'Mezzanine Loan':{loanAmtMode:'dollar',ltv:0,loanDollar:0,rate:9.5,term:5,amort:25,io:1,fees:1.5},'Seller Financing':{loanAmtMode:'dollar',ltv:0,loanDollar:0,rate:8.5,term:15,amort:15,io:0,fees:0,startMonth:24,paymentFree:0},'Second Debt':{loanAmtMode:'dollar',ltv:0,loanDollar:0,rate:7.0,term:10,amort:25,io:0,fees:0},'Equity Partner':{loanAmtMode:'dollar',ltv:0,loanDollar:0,rate:8,term:5,amort:0,io:0,fees:0,balloonYrs:5,doubleInvestment:false,equityBasis:'down_payment'}};
    const nl={id:`${type.replace(/\s/g,'_').toLowerCase()}_${Date.now()}`,type,enabled:true,...defs[type]};
    setLoans(p=>{const u=[...p,nl];setTimeout(()=>saveToParent(u),0);return u;});
    setShowAddMenu(false);setShowSellerModal(false);
  },[saveToParent]);

  const removeLoan=useCallback((id)=>{
    setLoans(p=>{const u=p.filter(l=>l.id!==id);setTimeout(()=>saveToParent(u),0);return u;});
  },[saveToParent]);

  const structure=useMemo(()=>buildStructureFromLoans(loans,pp,noi),[loans,pp,noi]);
  const alts=useMemo(()=>pp>0&&noi>0?generateAlts(pp,noi):{},[pp,noi]);

  const [showAddMenu,setShowAddMenu]=useState(false);
  const [showSellerModal,setShowSellerModal]=useState(false);
  const [sellerEditId,setSellerEditId]=useState(null);
  const [analysisView,setAnalysisView]=useState('scenario');

  // Exit Details
  const [exit,setExit]=useState(()=>{
    const s=scenarioData?.exit_details||{};
    return {holdYrs:s.holdYrs??5,closingPct:s.closingPct??2,brokerPct:s.brokerPct??2,strategy:s.strategy??'cap_rate',capAdj:s.capAdj??0,growthPct:s.growthPct??3};
  });
  const setExitF=useCallback((f,v)=>{setExit(p=>{const u={...p,[f]:v};if(onFieldChange)onFieldChange('exit_details',u);return u;});},[onFieldChange]);
  const baseMktCap=marketCapRate?.market_cap_rate||goingInCap;
  const exitCap=baseMktCap+(Number(exit.capAdj)||0);
  const exitVal=exit.strategy==='cap_rate'?(exitCap>0?proformaNOI/(exitCap/100):0):(pp*Math.pow(1+(Number(exit.growthPct)||3)/100,Number(exit.holdYrs)||5));
  const exitCosts=exitVal*(Number(exit.closingPct)||0)/100+exitVal*(Number(exit.brokerPct)||0)/100;
  const netProceeds=exitVal-exitCosts-(structure?.totalLoanAmt||0);

  /* Investment criteria moved to Templates page */

  useEffect(()=>{
    if(!structure)return;
    if(onSelectedStructureMetricsChange)onSelectedStructureMetricsChange({name:'Your Financing',key:'user-structure',annualCashFlow:structure.cashflow,cashOnCash:structure.cashOnCash,dscr:structure.dscr,capRate:goingInCap});
  },[structure,goingInCap,onSelectedStructureMetricsChange]);

  const dscrC=v=>v>=1.25?'#10b981':v>=1.0?'#f59e0b':'#ef4444';
  const cfC=v=>v>=0?'#10b981':'#ef4444';
  const cocC=v=>v>=8?'#10b981':'#374151';

  const getLoanAmt=l=>l.type==='Equity Partner'?Number(l.loanDollar)||0:(l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc')?pp*(Number(l.ltv)||0)/100:Number(l.loanDollar)||0;
  const getLoanMo=l=>{
    if(l.type==='Equity Partner')return(Number(l.loanDollar)||0)*(Number(l.rate)||8)/100/12;
    const a=getLoanAmt(l),r=(Number(l.rate)||0)/100/12,n=(Number(l.amort)||30)*12;
    if(a<=0||r<=0||n<=0)return 0;
    return a*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  };

  // Seller modal
  const [sfF,setSfF]=useState({loanDollar:0,rate:8.5,amort:15,term:15,io:0,fees:0,startMonth:24,paymentFree:0,earlyPenalty:0});
  const openSfModal=(existing=null)=>{
    if(existing){
      setSellerEditId(existing.id);
      setSfF({loanDollar:existing.loanDollar||0,rate:existing.rate||8.5,amort:existing.amort||15,term:existing.term||15,io:existing.io||0,fees:existing.fees||0,startMonth:existing.startMonth||24,paymentFree:existing.paymentFree||0,earlyPenalty:existing.earlyPaymentPenalty||0});
    } else {
      setSellerEditId(null);
      setSfF({loanDollar:0,rate:8.5,amort:15,term:15,io:0,fees:0,startMonth:24,paymentFree:0,earlyPenalty:0});
    }
    setShowSellerModal(true);
  };
  const saveSf=()=>{
    if(sellerEditId){
      setLoans(p=>{const u=p.map(l=>l.id===sellerEditId?{...l,loanAmtMode:'dollar',...sfF,earlyPaymentPenalty:sfF.earlyPenalty}:l);setTimeout(()=>saveToParent(u),0);return u;});
    } else {
      const nl={id:`seller_financing_${Date.now()}`,type:'Seller Financing',enabled:true,loanAmtMode:'dollar',ltv:0,...sfF,earlyPaymentPenalty:sfF.earlyPenalty};
      setLoans(p=>{const u=[...p,nl];setTimeout(()=>saveToParent(u),0);return u;});
    }
    setShowSellerModal(false);
  };

  const existingTypes=loans.map(l=>l.type);
  const addableTypes=[
    {type:'Mezzanine Loan',icon:'🏛️',desc:'Secondary mezzanine debt'},
    {type:'Seller Financing',icon:'🤝',desc:'Seller-carried note'},
    {type:'Second Debt',icon:'📄',desc:'Junior debt position'},
    {type:'Equity Partner',icon:'👥',desc:'JV equity partner'},
  ].filter(t=>!existingTypes.includes(t.type));

  const renderCard=(loan,isMain)=>{
    const amt=getLoanAmt(loan),mo=getLoanMo(loan),color=loanColor(loan.type);
    const isEq=loan.type==='Equity Partner',isSf=loan.type==='Seller Financing';
    return (
      <div key={loan.id} style={{backgroundColor:'#fff',borderRadius:14,border:`2px solid ${color}30`,padding:'20px 22px',flex:isMain?'1 1 55%':'1 1 40%',minWidth:300,position:'relative'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
          <span style={{fontSize:20}}>{loanIcon(loan.type)}</span>
          <span style={{fontSize:15,fontWeight:700,color:VL}}>{loan.type}</span>
          {loan.type!=='Senior Loan'&&<button onClick={()=>removeLoan(loan.id)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',padding:4,color:'#9ca3af'}} title="Remove"><Trash2 size={16}/></button>}
          {isSf&&<button onClick={()=>openSfModal(loan)} style={{marginLeft:loan.type==='Senior Loan'?'auto':0,background:'none',border:'none',cursor:'pointer',padding:4,color:AC,fontSize:12,fontWeight:600}}><Edit3 size={14} style={{marginRight:4,verticalAlign:'middle'}}/>Edit</button>}
        </div>

        {!isEq&&(
          <div style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <label style={{fontSize:11,fontWeight:600,color:LB,textTransform:'uppercase',letterSpacing:'0.04em'}}>Loan Amount</label>
              <select value={loan.loanAmtMode||'ltv'} onChange={e=>updateLoanField(loan.id,'loanAmtMode',e.target.value)}
                style={{fontSize:11,border:`1px solid ${B}`,borderRadius:4,padding:'2px 6px',cursor:'pointer',color:AC,fontWeight:600,background:`${AC}08`}}>
                <option value="ltv">% Purchase Price</option>
                <option value="dollar">Amount in $</option>
                <option value="ltc">% LTC</option>
              </select>
            </div>
            {(loan.loanAmtMode==='ltv'||loan.loanAmtMode==='ltc')?(
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{flex:1,position:'relative'}}>
                  <input type="number" step="1" min="0" max="100" value={loan.ltv||0} onChange={e=>updateLoanField(loan.id,'ltv',Number(e.target.value))}
                    style={{...IS,paddingRight:24}}/>
                  <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:LB}}>%</span>
                </div>
                <span style={{fontSize:12,color:LB}}>=</span>
                <div style={{flex:1.5,padding:'8px 10px',backgroundColor:'#f9fafb',borderRadius:6,border:`1px solid ${B}`,fontSize:13,fontWeight:600,color:VL}}>{fmt(amt)}</div>
              </div>
            ):(
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,color:LB}}>$</span>
                <input type="number" step="1000" min="0" value={loan.loanDollar||0} onChange={e=>updateLoanField(loan.id,'loanDollar',Number(e.target.value))}
                  style={{...IS,paddingLeft:24}}/>
              </div>
            )}
          </div>
        )}

        {isEq&&(
          <>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:LB,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Investment Basis</label>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{
                  const others=loans.filter(l=>l.id!==loan.id&&l.type!=='Equity Partner'&&l.enabled!==false);
                  const tl=others.reduce((s,l)=>{const a=(l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc')?pp*(Number(l.ltv)||0)/100:Number(l.loanDollar)||0;return s+a;},0);
                  updateLoanFields(loan.id,{loanDollar:Math.max(0,Math.round(pp-tl)),equityBasis:'down_payment'});
                }}
                  style={{flex:1,padding:'8px 12px',borderRadius:8,border:`2px solid ${(loan.equityBasis||'down_payment')==='down_payment'?AC:B}`,backgroundColor:(loan.equityBasis||'down_payment')==='down_payment'?`${AC}10`:'white',color:(loan.equityBasis||'down_payment')==='down_payment'?AC:LB,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  💰 Down Payment Only
                </button>
                <button onClick={()=>{
                  const others=loans.filter(l=>l.id!==loan.id&&l.type!=='Equity Partner'&&l.enabled!==false);
                  const tl=others.reduce((s,l)=>{const a=(l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc')?pp*(Number(l.ltv)||0)/100:Number(l.loanDollar)||0;return s+a;},0);
                  const tf=others.reduce((s,l)=>{const a=(l.loanAmtMode==='ltv'||l.loanAmtMode==='ltc')?pp*(Number(l.ltv)||0)/100:Number(l.loanDollar)||0;return s+a*(Number(l.fees)||0)/100;},0);
                  updateLoanFields(loan.id,{loanDollar:Math.max(0,Math.round(pp-tl+tf)),equityBasis:'down_plus_closing'});
                }}
                  style={{flex:1,padding:'8px 12px',borderRadius:8,border:`2px solid ${loan.equityBasis==='down_plus_closing'?'#f97316':B}`,backgroundColor:loan.equityBasis==='down_plus_closing'?'#f9731610':'white',color:loan.equityBasis==='down_plus_closing'?'#f97316':LB,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  📋 Down + Closing Costs
                </button>
              </div>
            </div>
            <Field label="Partner Equity" prefix="$" value={loan.loanDollar||0} onChange={v=>updateLoanField(loan.id,'loanDollar',v)} step={1000}/>
          </>
        )}

        <Field label={isEq?'Preferred Return':'Interest Rate'} suffix="%" value={loan.rate||0} onChange={v=>updateLoanField(loan.id,'rate',v)} step={0.05}/>

        {!isEq&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Amortization (yrs)" value={loan.amort||0} onChange={v=>updateLoanField(loan.id,'amort',v)} step={1}/>
            <Field label="Loan Term (yrs)" value={loan.term||0} onChange={v=>updateLoanField(loan.id,'term',v)} step={1}/>
          </div>
        )}
        {!isEq&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Interest Only (yrs)" value={loan.io||0} onChange={v=>updateLoanField(loan.id,'io',v)} step={1}/>
            <Field label="Loan Fees" suffix="%" value={loan.fees||0} onChange={v=>updateLoanField(loan.id,'fees',v)} step={0.1}/>
          </div>
        )}
        {isSf&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Start Month" value={loan.startMonth||0} onChange={v=>updateLoanField(loan.id,'startMonth',v)} step={1}/>
            <Field label="Payment-Free (mo)" value={loan.paymentFree||0} onChange={v=>updateLoanField(loan.id,'paymentFree',v)} step={1}/>
          </div>
        )}

        {isEq&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Field label="Balloon Term (years)" value={loan.balloonYrs||5} onChange={v=>updateLoanField(loan.id,'balloonYrs',v)} step={1} min={1}/>
              <Field label="Partnership Term (years)" value={loan.term||5} onChange={v=>updateLoanField(loan.id,'term',v)} step={1} min={1}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:LB,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Exit Payout to Partner</label>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>updateLoanField(loan.id,'doubleInvestment',false)}
                  style={{flex:1,padding:'8px 12px',borderRadius:8,border:`2px solid ${!loan.doubleInvestment?'#22c55e':B}`,backgroundColor:!loan.doubleInvestment?'#22c55e10':'white',color:!loan.doubleInvestment?'#22c55e':LB,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  1× Return of Capital
                </button>
                <button onClick={()=>updateLoanField(loan.id,'doubleInvestment',true)}
                  style={{flex:1,padding:'8px 12px',borderRadius:8,border:`2px solid ${loan.doubleInvestment?'#f97316':B}`,backgroundColor:loan.doubleInvestment?'#f9731610':'white',color:loan.doubleInvestment?'#f97316':LB,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  2× Double Investment
                </button>
              </div>
            </div>
          </>
        )}

        <div style={{marginTop:16,padding:'12px 14px',backgroundColor:`${color}10`,borderRadius:10,border:`1px solid ${color}30`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,fontWeight:600,color:LB,textTransform:'uppercase'}}>{isEq?'Monthly Pref Payment':'Monthly Payment'}</span>
            <span style={{fontSize:18,fontWeight:800,color}}>{fmt(mo)}</span>
          </div>
          {!isEq&&amt>0&&<div style={{fontSize:11,color:LB,marginTop:4,textAlign:'right'}}>Annual: {fmt(mo*12)} · Fees: {fmt(amt*(Number(loan.fees)||0)/100)}</div>}
          {isEq&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${color}30`}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:LB,marginBottom:2}}>
                <span>Annual Preferred Return</span><span style={{fontWeight:600,color:VL}}>{fmt(mo*12)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:LB,marginBottom:2}}>
                <span>Balloon Payout (Yr {loan.balloonYrs||5})</span><span style={{fontWeight:600,color:loan.doubleInvestment?'#f97316':'#22c55e'}}>{fmt(loan.doubleInvestment?(loan.loanDollar||0)*2:(loan.loanDollar||0))}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:4,paddingTop:4,borderTop:`1px dashed ${color}30`}}>
                <span style={{fontWeight:700,color:VL}}>Total Partner Cost</span><span style={{fontWeight:700,color}}>{fmt((mo*12*(loan.balloonYrs||5))+(loan.doubleInvestment?(loan.loanDollar||0)*2:(loan.loanDollar||0)))}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════ RENDER ═══════════
  return (
    <div style={{padding:0,backgroundColor:'#f9fafb',minHeight:'100%'}}>
      <div style={{maxWidth:1400,margin:'0 auto'}}>

        {/* HEADER */}
        <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
          <div style={{width:36,height:36,borderRadius:'50%',backgroundColor:AC,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,marginRight:12}}><DollarSign size={20}/></div>
          <div>
            <h2 style={{margin:0,fontSize:22,fontWeight:800,color:VL}}>Deal Structure</h2>
            <p style={{margin:0,fontSize:13,color:LB}}>Configure financing and capital stack</p>
          </div>
        </div>

        {/* ═══ 1. FINANCING ═══ */}
        <div style={SC}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
            <Wallet size={20} color={AC}/>
            <h3 style={{margin:0,fontSize:16,fontWeight:700,color:VL,textTransform:'uppercase',letterSpacing:'0.04em'}}>Financing</h3>
            <div style={{marginLeft:'auto',position:'relative'}}>
              {addableTypes.length>0&&(
                <button onClick={()=>setShowAddMenu(!showAddMenu)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',backgroundColor:`${AC}10`,color:AC,border:`1px solid ${AC}40`,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <Plus size={16}/> Add Debt Position
                </button>
              )}
              {showAddMenu&&(
                <div style={{position:'absolute',right:0,top:'100%',marginTop:4,backgroundColor:'white',borderRadius:10,boxShadow:'0 10px 25px rgba(0,0,0,0.15)',border:`1px solid ${B}`,zIndex:50,minWidth:220,overflow:'hidden'}}>
                  {addableTypes.map(t=>(
                    <button key={t.type} onClick={()=>t.type==='Seller Financing'?openSfModal():addLoan(t.type)}
                      style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'12px 16px',border:'none',background:'white',cursor:'pointer',fontSize:13,textAlign:'left',color:VL}}
                      onMouseEnter={e=>e.currentTarget.style.backgroundColor='#f9fafb'} onMouseLeave={e=>e.currentTarget.style.backgroundColor='white'}>
                      <span style={{fontSize:18}}>{t.icon}</span>
                      <div><div style={{fontWeight:600}}>{t.type}</div><div style={{fontSize:11,color:LB}}>{t.desc}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Loan Cards */}
          <div style={{display:'flex',flexWrap:'wrap',gap:20,marginBottom:24}}>
            {loans.filter(l=>l.enabled!==false).map((l,i)=>renderCard(l,l.type==='Senior Loan'))}
            {!existingTypes.includes('Second Debt')&&(
              <div onClick={()=>addLoan('Second Debt')} style={{flex:'1 1 40%',minWidth:280,minHeight:280,borderRadius:14,border:`2px dashed ${B}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',backgroundColor:'#fafafa',transition:'all 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=AC;e.currentTarget.style.backgroundColor=`${AC}05`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=B;e.currentTarget.style.backgroundColor='#fafafa';}}>
                <div style={{width:48,height:48,borderRadius:'50%',backgroundColor:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}><Plus size={24} color={LB}/></div>
                <div style={{fontSize:15,fontWeight:700,color:VL,marginBottom:4}}>Add Second Debt</div>
                <div style={{fontSize:12,color:LB}}>Click to add a junior debt position</div>
              </div>
            )}
          </div>

          {!existingTypes.includes('Seller Financing')&&(
            <button onClick={()=>openSfModal()} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',backgroundColor:'#a855f710',color:'#a855f7',border:'1px dashed #a855f7',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20}}>
              <Plus size={16}/> Add Seller Financing
            </button>
          )}

          {/* Financing Summary */}
          {structure&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
              <div style={{padding:'16px 14px',borderRadius:12,backgroundColor:'#f9fafb',border:`1px solid ${B}`}}>
                <div style={{fontSize:11,fontWeight:700,color:LB,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Total Acquisition Cost</div>
                <div style={{fontSize:22,fontWeight:800,color:VL}}>{fmt(structure.totalAcquisitionCost)}</div>
                <div style={{fontSize:11,color:LB,marginTop:6,lineHeight:1.8}}>Purchase: {fmt(pp)}<br/>Loan Fees: {fmt(structure.totalFees)}</div>
              </div>
              <div style={{padding:'16px 14px',borderRadius:12,backgroundColor:'#eff6ff',border:'1px solid #bfdbfe'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#1d4ed8',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Total Loan Amount</div>
                <div style={{fontSize:22,fontWeight:800,color:'#1d4ed8'}}>{fmt(structure.totalLoanAmt)}</div>
                <div style={{fontSize:11,color:'#3b82f6',marginTop:6}}>LTV: {pct(structure.ltv)}</div>
              </div>
              <div style={{padding:'16px 14px',borderRadius:12,backgroundColor:'#fef3c7',border:'1px solid #fcd34d'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Down Payment</div>
                <div style={{fontSize:22,fontWeight:800,color:'#92400e'}}>{fmt(structure.downPayment)}</div>
                <div style={{fontSize:11,color:'#b45309',marginTop:6}}>{pp>0?`${(structure.downPayment/pp*100).toFixed(1)}% of purchase`:'-'}</div>
              </div>
              <div style={{padding:'16px 14px',borderRadius:12,backgroundColor:'#ecfdf5',border:'1px solid #6ee7b7'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#047857',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Loan-to-Cost (LTC)</div>
                <div style={{fontSize:22,fontWeight:800,color:'#047857'}}>{pct(structure.ltc)}</div>
                <div style={{fontSize:11,color:'#059669',marginTop:6}}>Debt / Acquisition Cost</div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ EXIT DETAILS — REMOVED FROM HERE, WILL BE REUSED IN DEDICATED TAB ═══
         * Contents that were here:
         * - Holding Period (years): exit.holdYrs
         * - Closing Costs %: exit.closingPct
         * - Broker Commissions %: exit.brokerPct
         * - Exit Strategy toggle: 'cap_rate' vs 'value_growth'
         * - Cap Rate Method: baseMktCap, marketCapRate breakdown (base_rate, size_adjustment, year_built_adjustment, asset_class, confidence), capAdj, exitCap
         * - Value Growth Method: exit.growthPct, projected exitVal from pp
         * - Summary cards: Exit Value (exitVal), Closing+Broker (exitCosts), Loan Payoff (structure.totalLoanAmt), Net Sale Proceeds (netProceeds)
         * - State setter: setExitF(field, value)
         * - Computed values: exitCap, exitVal, exitCosts, netProceeds
         */}

        {/* ═══ 4. CAPITAL STACK & DEBT SERVICE ═══ */}
        {structure&&(
          <div style={SC}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
              <BarChart3 size={20} color={AC}/>
              <h3 style={{margin:0,fontSize:16,fontWeight:700,color:VL,textTransform:'uppercase',letterSpacing:'0.04em'}}>Capital Stack & Debt Service</h3>
            </div>

            <div style={{marginBottom:20}}>
              <div style={{display:'flex',height:44,borderRadius:8,overflow:'hidden',border:`1px solid ${B}`}}>
                {structure.loanDetails.map((l,i)=>{const w=pp>0?(l.loanAmt/pp*100):0;return w>0?<div key={i} style={{width:`${w}%`,backgroundColor:loanColor(l.type),display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:11,fontWeight:700,minWidth:w>5?40:0}} title={`${l.type}: ${fmt(l.loanAmt)}`}>{w>8&&`${w.toFixed(0)}%`}</div>:null;})}
                {structure.equityDetails.map((l,i)=>{const w=pp>0?(l.partnerEquity/pp*100):0;return w>0?<div key={`e${i}`} style={{width:`${w}%`,backgroundColor:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:11,fontWeight:700}} title={`Equity: ${fmt(l.partnerEquity)}`}>{w>8&&`${w.toFixed(0)}%`}</div>:null;})}
                {structure.downPayment>0&&<div style={{width:`${(structure.downPayment/pp*100)}%`,backgroundColor:'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:11,fontWeight:700}} title={`Your Equity: ${fmt(structure.downPayment)}`}>{(structure.downPayment/pp*100)>8&&`${(structure.downPayment/pp*100).toFixed(0)}%`}</div>}
              </div>
              <div style={{display:'flex',gap:14,marginTop:8,flexWrap:'wrap'}}>
                {structure.loanDetails.map((l,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><div style={{width:12,height:12,borderRadius:2,backgroundColor:loanColor(l.type)}}/><span style={{color:LB}}>{l.type}</span><span style={{fontWeight:600,color:VL}}>{fmt(l.loanAmt)}</span></div>)}
                {structure.equityDetails.map((l,i)=><div key={`e${i}`} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><div style={{width:12,height:12,borderRadius:2,backgroundColor:'#22c55e'}}/><span style={{color:LB}}>Equity Partner</span><span style={{fontWeight:600,color:VL}}>{fmt(l.partnerEquity)}</span></div>)}
                {structure.downPayment>0&&<div style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}><div style={{width:12,height:12,borderRadius:2,backgroundColor:'#94a3b8'}}/><span style={{color:LB}}>Your Equity</span><span style={{fontWeight:600,color:VL}}>{fmt(structure.downPayment)}</span></div>}
              </div>
            </div>

            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{backgroundColor:'#f9fafb'}}>
                  {['Position','Loan Amount','Rate','Term','Monthly','Annual'].map((h,i)=><th key={i} style={{padding:'10px 12px',textAlign:i===0?'left':'right',fontWeight:700,color:'#374151',borderBottom:`2px solid ${B}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {structure.loanDetails.map((l,i)=>(
                    <tr key={i} style={{borderLeft:`3px solid ${loanColor(l.type)}`}}>
                      <td style={{padding:'10px 12px',borderBottom:`1px solid ${B}`}}><span style={{marginRight:6}}>{loanIcon(l.type)}</span><span style={{fontWeight:600,color:VL}}>{l.type}</span></td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:VL}}>{fmt(l.loanAmt)}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,color:LB}}>{pct(Number(l.rate))}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,color:LB}}>{l.amort||'-'}yr</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:VL}}>{fmt(l.monthlyPmt)}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:VL}}>{fmt(l.annualDS)}</td>
                    </tr>
                  ))}
                  {structure.equityDetails.map((l,i)=>(
                    <tr key={`e${i}`} style={{borderLeft:'3px solid #22c55e'}}>
                      <td style={{padding:'10px 12px',borderBottom:`1px solid ${B}`}}><span style={{marginRight:6}}>👥</span><span style={{fontWeight:600,color:VL}}>Equity Partner</span>{l.doubleInvestment&&<span style={{marginLeft:6,fontSize:9,padding:'2px 5px',backgroundColor:'#f9731620',color:'#f97316',borderRadius:4,fontWeight:700}}>2×</span>}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:'#22c55e'}}>{fmt(l.partnerEquity)}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,color:LB}}>{pct(Number(l.rate))} pref</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,color:LB}}>{l.balloonYrs||'-'}yr balloon</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:'#f97316'}}>{fmt(l.monthlyPref)}</td>
                      <td style={{padding:'10px 12px',textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:'#f97316'}}>{fmt(l.annualPref)}</td>
                    </tr>
                  ))}
                  <tr style={{backgroundColor:'#1e2a4a'}}>
                    <td style={{padding:12,fontWeight:800,color:'white',fontSize:13}}>Total</td>
                    <td style={{padding:12,textAlign:'right',fontWeight:800,color:'white',fontSize:13}}>{fmt(structure.totalLoanAmt+structure.totalEquity)}</td>
                    <td style={{padding:12}}></td><td style={{padding:12}}></td>
                    <td style={{padding:12,textAlign:'right',fontWeight:800,color:'#60a5fa',fontSize:13}}>{fmt(structure.totalMonthlyPmt)}</td>
                    <td style={{padding:12,textAlign:'right',fontWeight:800,color:'#60a5fa',fontSize:13}}>{fmt(structure.totalAnnualPmt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginTop:20}}>
              <div style={{padding:14,borderRadius:12,backgroundColor:'white',border:`1px solid ${B}`,textAlign:'center'}}><div style={{fontSize:11,color:LB,marginBottom:4}}>Annual Cashflow</div><div style={{fontSize:20,fontWeight:800,color:cfC(structure.cashflow)}}>{fmt(structure.cashflow)}</div><div style={{fontSize:11,color:LB,marginTop:2}}>{fmt(structure.cashflow/12)}/mo</div></div>
              <div style={{padding:14,borderRadius:12,backgroundColor:'white',border:`1px solid ${B}`,textAlign:'center'}}><div style={{fontSize:11,color:LB,marginBottom:4}}>DSCR</div><div style={{fontSize:20,fontWeight:800,color:dscrC(structure.dscr)}}>{structure.dscr.toFixed(2)}x</div><div style={{fontSize:11,color:LB,marginTop:2}}>{structure.dscr>=1.25?'✓ Strong':structure.dscr>=1.0?'⚠ Tight':'✗ Negative'}</div></div>
              <div style={{padding:14,borderRadius:12,backgroundColor:'white',border:`1px solid ${B}`,textAlign:'center'}}><div style={{fontSize:11,color:LB,marginBottom:4}}>Cash on Cash</div><div style={{fontSize:20,fontWeight:800,color:cocC(structure.cashOnCash)}}>{pct(structure.cashOnCash)}</div></div>
              <div style={{padding:14,borderRadius:12,backgroundColor:'white',border:`1px solid ${B}`,textAlign:'center'}}><div style={{fontSize:11,color:LB,marginBottom:4}}>LTC Ratio</div><div style={{fontSize:20,fontWeight:800,color:VL}}>{pct(structure.ltc)}</div></div>
              <div style={{padding:14,borderRadius:12,backgroundColor:'white',border:`1px solid ${B}`,textAlign:'center'}}><div style={{fontSize:11,color:LB,marginBottom:4}}>Blended Rate</div><div style={{fontSize:20,fontWeight:800,color:AC}}>{pct(structure.blendedRate)}</div><div style={{fontSize:11,color:LB,marginTop:2}}>{structure.loanDetails.length} position{structure.loanDetails.length!==1?'s':''}</div></div>
            </div>
          </div>
        )}



        {/* ═══ 6. SCENARIO COMPARISON / DSCR SENSITIVITY TOGGLE ═══ */}
        {structure&&pp>0&&noi>0&&(
          <div style={SC}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Calculator size={20} color="#374151"/>
                <h3 style={{margin:0,fontSize:16,fontWeight:700,color:VL,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                  {analysisView==='scenario'?'Scenario Comparison':'DSCR Sensitivity'}
                </h3>
              </div>
              <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:`1px solid ${B}`,width:'fit-content'}}>
                <button onClick={()=>setAnalysisView('scenario')}
                  style={{padding:'8px 18px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,backgroundColor:analysisView==='scenario'?AC:'white',color:analysisView==='scenario'?'white':LB,transition:'all 0.15s'}}>
                  📊 Scenarios
                </button>
                <button onClick={()=>setAnalysisView('dscr')}
                  style={{padding:'8px 18px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,backgroundColor:analysisView==='dscr'?AC:'white',color:analysisView==='dscr'?'white':LB,transition:'all 0.15s'}}>
                  📈 DSCR Matrix
                </button>
              </div>
            </div>

            {analysisView==='scenario'&&Object.keys(alts).length>0&&(
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead><tr style={{backgroundColor:'#f9fafb'}}>{['Structure','Loan Amt','Cash Req','Monthly','Annual CF','DSCR','CoC'].map((h,i)=><th key={i} style={{padding:12,textAlign:i===0?'left':'right',fontWeight:700,color:'#374151',borderBottom:`2px solid ${B}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    <tr style={{backgroundColor:'#eff6ff',borderLeft:`4px solid ${AC}`}}>
                      <td style={{padding:12,borderBottom:`1px solid ${B}`}}><div style={{fontWeight:700,color:VL}}>Your Structure</div><span style={{fontSize:10,color:AC,fontWeight:700}}>★ CURRENT</span></td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600}}>{fmt(structure.totalLoanAmt)}</td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600}}>{fmt(structure.cashOutOfPocket)}</td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600}}>{fmt(structure.totalMonthlyPmt)}</td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:700,color:cfC(structure.cashflow)}}>{fmt(structure.cashflow)}</td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:dscrC(structure.dscr)}}>{structure.dscr.toFixed(2)}x</td>
                      <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:cocC(structure.cashOnCash)}}>{pct(structure.cashOnCash)}</td>
                    </tr>
                    {Object.entries(alts).map(([k,s])=>(
                      <tr key={k}>
                        <td style={{padding:12,borderBottom:`1px solid ${B}`}}><div style={{fontWeight:600,color:VL}}>{s.name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{s.desc}</div></td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:500}}>{fmt(s.totalLoanAmt)}</td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:500}}>{fmt(s.cashOutOfPocket)}</td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:500}}>{fmt(s.totalMonthlyPmt)}</td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:700,color:cfC(s.cashflow)}}>{fmt(s.cashflow)}</td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:dscrC(s.dscr)}}>{s.dscr.toFixed(2)}x</td>
                        <td style={{padding:12,textAlign:'right',borderBottom:`1px solid ${B}`,fontWeight:600,color:cocC(s.cashOnCash)}}>{pct(s.cashOnCash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analysisView==='dscr'&&(()=>{
              const br=Number(structure.loanDetails?.[0]?.rate||6.5);
              const rates=[br-1,br-0.5,br,br+0.5,br+1];
              const ltvs=[60,65,70,75,80,85];
              return (
                <>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,textAlign:'center'}}>
                      <thead><tr style={{backgroundColor:'#f9fafb'}}><th style={{padding:10,borderBottom:`2px solid ${B}`,fontWeight:700,color:'#374151'}}>LTV ↓ / Rate →</th>
                        {rates.map((r,i)=><th key={i} style={{padding:10,borderBottom:`2px solid ${B}`,fontWeight:700,color:Math.abs(r-br)<0.01?AC:'#374151',backgroundColor:Math.abs(r-br)<0.01?'#eff6ff':'#f9fafb'}}>{r.toFixed(2)}%{Math.abs(r-br)<0.01?' ★':''}</th>)}
                      </tr></thead>
                      <tbody>{ltvs.map(ltv=>(
                        <tr key={ltv}><td style={{padding:10,borderBottom:`1px solid ${B}`,fontWeight:700,color:'#374151',backgroundColor:'#f9fafb'}}>{ltv}%</td>
                          {rates.map((r,ri)=>{const lo=pp*ltv/100,mo=calcMonthlyPayment(lo,r,360),an=mo*12,d=an>0?noi/an:0,uc=Math.abs(r-br)<0.01&&Math.abs(ltv-structure.ltv)<1;
                            return <td key={ri} style={{padding:10,borderBottom:`1px solid ${B}`,fontWeight:uc?800:600,color:dscrC(d),backgroundColor:uc?'#eff6ff':'white',border:uc?`2px solid ${AC}`:undefined}}>{d.toFixed(2)}x</td>;
                          })}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div style={{marginTop:12,padding:'10px 14px',backgroundColor:'#eff6ff',borderRadius:8,border:'1px dashed #3b82f6'}}>
                    <div style={{fontSize:11,color:'#1e3a8a'}}><strong>★</strong> = Your position. <span style={{color:'#10b981',fontWeight:700}}>Green</span> ≥ 1.25x. <span style={{color:'#f59e0b',fontWeight:700}}>Yellow</span> 1.0–1.25x. <span style={{color:'#ef4444',fontWeight:700}}>Red</span> &lt; 1.0x.</div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ═══ SELLER FINANCING MODAL ═══ */}
        {showSellerModal&&(
          <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={e=>{if(e.target===e.currentTarget)setShowSellerModal(false);}}>
            <div style={{backgroundColor:'white',borderRadius:16,padding:28,width:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 25px 50px rgba(0,0,0,0.25)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:24}}>🤝</span><h3 style={{margin:0,fontSize:18,fontWeight:700}}>{sellerEditId?'Edit':'Add'} Seller Financing</h3></div>
                <button onClick={()=>setShowSellerModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:LB}}><X size={20}/></button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div style={{gridColumn:'span 2'}}><Field label="Financing Amount" prefix="$" value={sfF.loanDollar} onChange={v=>setSfF(p=>({...p,loanDollar:v}))} step={1000}/></div>
                <Field label="Interest Rate" suffix="%" value={sfF.rate} onChange={v=>setSfF(p=>({...p,rate:v}))} step={0.05}/>
                <Field label="Start Month" value={sfF.startMonth} onChange={v=>setSfF(p=>({...p,startMonth:v}))} step={1}/>
                <Field label="Amortization (yrs)" value={sfF.amort} onChange={v=>setSfF(p=>({...p,amort:v}))} step={1}/>
                <Field label="Loan Term (yrs)" value={sfF.term} onChange={v=>setSfF(p=>({...p,term:v}))} step={1}/>
                <Field label="Payment-Free (months)" value={sfF.paymentFree} onChange={v=>setSfF(p=>({...p,paymentFree:v}))} step={1}/>
                <Field label="Interest Only (yrs)" value={sfF.io} onChange={v=>setSfF(p=>({...p,io:v}))} step={1}/>
                <Field label="Loan Fees" suffix="%" value={sfF.fees} onChange={v=>setSfF(p=>({...p,fees:v}))} step={0.1}/>
                <Field label="Early Payment Penalty" suffix="%" value={sfF.earlyPenalty} onChange={v=>setSfF(p=>({...p,earlyPenalty:v}))} step={0.5}/>
              </div>
              <div style={{marginTop:20,padding:'14px 16px',backgroundColor:'#a855f710',borderRadius:10,border:'1px solid #a855f730'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:600,color:LB}}>Monthly Payment</span>
                  <span style={{fontSize:20,fontWeight:800,color:'#a855f7'}}>{fmt((()=>{const a=Number(sfF.loanDollar)||0,r=(Number(sfF.rate)||0)/100/12,n=(Number(sfF.amort)||15)*12;if(a<=0||r<=0||n<=0)return 0;return a*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);})())}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:12,marginTop:24}}>
                <button onClick={()=>setShowSellerModal(false)} style={{flex:1,padding:'12px 16px',backgroundColor:'#f3f4f6',color:VL,border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                <button onClick={saveSf} style={{flex:1,padding:'12px 16px',backgroundColor:'#a855f7',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>{sellerEditId?'Save Changes':'Add Seller Financing'}</button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    </div>
  );
}
