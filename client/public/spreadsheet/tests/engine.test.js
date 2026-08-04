require("../cre-underwriting.js");
const U = globalThis.CREUnderwriting;
const wb = U.buildTemplate();
const ev = new U.Evaluator(wb);
const V = (s,a)=>ev.value(s,a);
const near=(a,b,t)=>Math.abs(a-b)<=t;
let fails=0;
const check=(n,ok,d)=>{console.log((ok?"PASS":"FAIL")+" | "+n+(d!==undefined?" | "+d:""));if(!ok)fails++;};
const num=v=>typeof v==="number"?v:NaN;

// Parser sanity
check("parser: nested fn", JSON.stringify(U.parseFormula("SUM(A1:B2,MAX(1,2))")).length>0);
check("parser: sheet ref", U.parseFormula("'Pro Forma'!B23*2").k==="bin");

// Hand-checked model values (same assumptions as v1 → same answers)
check("PF GPR Y1 = 1.5M", near(num(V("Pro Forma","B3")),1500000,0.01), num(V("Pro Forma","B3")));
check("PF EGI Y1 = 1,462,500", near(num(V("Pro Forma","B8")),1462500,0.01), num(V("Pro Forma","B8")));
check("PF NOI Y1 = 776,000", near(num(V("Pro Forma","B23")),776000,0.5), num(V("Pro Forma","B23")));
check("Loan @LTV = 8.4M", near(num(V("Debt","B3")),8400000,1), num(V("Debt","B3")));
check("Loan @DY = 8.6222M", near(num(V("Debt","B5")),776000/0.09,1), num(V("Debt","B5")));
check("Loan = min3 = 8.4M", near(num(V("Debt","B6")),8400000,1), num(V("Debt","B6")));
// IO year 1: DS = balance*rate = 525,000; ending balance unchanged
check("Y1 IO debt service 525k", near(num(V("Debt","B14")),525000,1), num(V("Debt","B14")));
check("Y1 IO end balance = loan", near(num(V("Debt","B12")),8400000,1), num(V("Debt","B12")));
check("DSCR Y1 = 776/525", near(num(V("Debt","B16")),776000/525000,1e-6), num(V("Debt","B16")).toFixed(3));
// Y2 amortizes
check("Y2 balance < loan", num(V("Debt","C12")) < 8400000, num(V("Debt","C12")).toFixed(0));
// Equity = uses - loan; loan fee 1% of 8.4M
check("Equity = 4,424,000", near(num(V("Summary","B11")),4424000,1), num(V("Summary","B11")));
// Exit: forward NOI year 6 = NOI_y6; check INDEX pulls col G (year 6)
check("Forward NOI = PF year6", near(num(V("Summary","B28")),num(V("Pro Forma","G23")),0.01));
check("Gross sale = fwdNOI/6%", near(num(V("Summary","B30")),num(V("Summary","B28"))/0.06,1));
// IRRs — compare vs v1 engine results (levered 14.04%, unlevered 9.42%) tolerance for
// slightly different closed-form annual amortization vs monthly loop: allow 25bps
const lev = num(V("Cash Flows","B7")), unlev = num(V("Cash Flows","B8"));
check("Levered IRR ≈ 14.0%", near(lev,0.1404,0.0035), (lev*100).toFixed(2)+"%");
check("Unlevered IRR ≈ 9.4%", near(unlev,0.0942,0.0035), (unlev*100).toFixed(2)+"%");
check("Equity multiple ≈ 1.85x", near(num(V("Cash Flows","B9")),1.848,0.01), num(V("Cash Flows","B9")).toFixed(3));
// Waterfall conservation each year: LP+GP = distributable
let conserve=true;
const wcols=["B","C","D","E","F"];
for(const c of wcols){
  const dist=num(V("Waterfall",c+"3")), lp=num(V("Waterfall",c+"12")), gp=num(V("Waterfall",c+"13"));
  if(!near(lp+gp,dist,0.01)){conserve=false;console.log("  ",c,lp+gp,dist);}
}
check("Waterfall conserves cash", conserve);
// Pref math year1: accrual = 4,424,000*8% = 353,920
check("Pref accrual Y1", near(num(V("Waterfall","B6")),4424000*0.08,1), num(V("Waterfall","B6")));
// GP promote: GP multiple > LP multiple
const lpM=num(V("Cash Flows","B13")), gpM=num(V("Cash Flows","B15"));
check("GP promoted above LP", gpM>lpM, "LP "+lpM.toFixed(2)+"x vs GP "+gpM.toFixed(2)+"x");
// LP+GP flows sum to levered flows years 1..5
let flowsOk=true;
const cfc=["C","D","E","F","G"];
for(const c of cfc){
  const tot=num(V("Cash Flows",c+"17"))+num(V("Cash Flows",c+"18"));
  const levcf=num(V("Cash Flows",c+"3"));
  if(!near(tot,levcf,0.01)){flowsOk=false;console.log("  ",c,tot,levcf);}
}
check("LP+GP = levered CF", flowsOk);
// Sensitivity: center cell == base levered IRR; higher cap col -> lower IRR
const center=num(V("Sensitivity","F7"));
check("Sens center = base IRR", near(center,lev,1e-9), (center*100).toFixed(2)+"%");
const left=num(V("Sensitivity","D7")), right=num(V("Sensitivity","H7"));
check("IRR falls as exit cap rises", left>center && center>right, (left*100).toFixed(1)+" > "+(center*100).toFixed(1)+" > "+(right*100).toFixed(1));
// Change hold to 10 (max) and to 1: no crash, blanks handled by IRR
wb.setCell("Inputs","B52",{v:10,fmt:"int",style:"input"}); ev.reset();
check("Hold=10 IRR finite", isFinite(num(V("Cash Flows","B7"))), (num(V("Cash Flows","B7"))*100).toFixed(2)+"%");
wb.setCell("Inputs","B52",{v:1,fmt:"int",style:"input"}); ev.reset();
check("Hold=1 IRR finite", isFinite(num(V("Cash Flows","B7"))), (num(V("Cash Flows","B7"))*100).toFixed(2)+"%");
// SF basis switch
wb.setCell("Inputs","B52",{v:5,fmt:"int",style:"input"});
wb.setCell("Inputs","B6",{v:"SF",style:"input"}); ev.reset();
check("SF basis GPR = 90000*22", near(num(V("Pro Forma","B3")),1980000,0.01), num(V("Pro Forma","B3")));
// Manual loan override
wb.setCell("Inputs","B6",{v:"UNIT",style:"input"});
wb.setCell("Inputs","B42",{v:5000000,fmt:"cur",style:"input"}); ev.reset();
check("Manual loan honored", near(num(V("Debt","B6")),5000000,0.01), num(V("Debt","B6")));
console.log(fails===0?"\nALL TESTS PASSED":"\n"+fails+" FAILED");
process.exit(fails?1:0);
