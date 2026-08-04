require("../cre-underwriting.js");
const U = globalThis.CREUnderwriting;
let fails=0;
const check=(n,ok,d)=>{console.log((ok?"PASS":"FAIL")+" | "+n+(d!==undefined?" | "+d:""));if(!ok)fails++;};
const near=(a,b,t)=>Math.abs(a-b)<=t;

// --- scratch workbook for function tests ---
const wb = new U.Workbook();
wb.addSheet("S");
const put=(a,x)=>wb.setCell("S",a, typeof x==="string"&&x[0]==="=" ? {f:x.slice(1)} : {v:x});
// lookup table A1:C4
put("A1","apt");put("B1",100);put("C1",1);
put("A2","ind");put("B2",200);put("C2",2);
put("A3","off");put("B3",300);put("C3",3);
put("A4","ret");put("B4",400);put("C4",4);
put("E1","=VLOOKUP(\"off\",A1:C4,2,FALSE)");
put("E2","=SUMIF(B1:B4,\">150\")");
put("E3","=COUNTIF(A1:A4,\"<>apt\")");
put("E4","=MATCH(\"ind\",A1:A4,0)");
put("E5","=INDEX(A1:C4,2,3)");
put("E6","=SUMIFS(B1:B4,C1:C4,\">1\",C1:C4,\"<4\")");
put("E7","=SUMPRODUCT(B1:B4,C1:C4)");
put("E8","=ROUNDUP(1.234,1)");
put("E9","=AVERAGEIF(C1:C4,\">2\",B1:B4)");
put("E10","=CONCATENATE(\"a\",\"b\",1)");
put("E11","=HLOOKUP(100,B1:C2,2,FALSE)");
put("E12","=MEDIAN(B1:B4)");
// XIRR: -1000 today, +1100 one year later => 10%
put("G1",-1000);put("G2",1100);
put("H1","=DATE(2025,1,1)");put("H2","=DATE(2026,1,1)");
put("E13","=XIRR(G1:G2,H1:H2)");
put("E14","=XNPV(0.1,G1:G2,H1:H2)");
const ev = new U.Evaluator(wb);
const V=a=>ev.value("S",a);
check("VLOOKUP exact", V("E1")===300, V("E1"));
check("SUMIF >150", V("E2")===900, V("E2"));
check("COUNTIF <>", V("E3")===3, V("E3"));
check("MATCH exact", V("E4")===2, V("E4"));
check("INDEX 2D (2,3)", V("E5")===2, V("E5"));
check("SUMIFS two crits", V("E6")===500, V("E6"));
check("SUMPRODUCT", V("E7")===100+400+900+1600, V("E7"));
check("ROUNDUP", V("E8")===1.3, V("E8"));
check("AVERAGEIF", V("E9")===350, V("E9"));
check("CONCATENATE", V("E10")==="ab1", V("E10"));
check("HLOOKUP", V("E11")===200, V("E11"));
check("MEDIAN", V("E12")===250, V("E12"));
check("XIRR = 10%", near(V("E13"),0.10,1e-4), (V("E13")*100).toFixed(3)+"%");
check("XNPV ~ 0 at 10%", near(V("E14"),0,0.01), V("E14"));

// --- formula rewriting ---
check("offset keeps $anchors", U.offsetFormula("SUM($A$1:B2)+Inputs!C3",2,1)==="SUM($A$1:C4)+Inputs!D5", U.offsetFormula("SUM($A$1:B2)+Inputs!C3",2,1));
check("offset negative -> #REF!", U.offsetFormula("A1",-1,0)==="#REF!", U.offsetFormula("A1",-1,0));
check("offset skips strings", U.offsetFormula('IF(A1="B2",C3,0)',1,0)==='IF(A2="B2",C4,0)', U.offsetFormula('IF(A1="B2",C3,0)',1,0));
check("shift row insert", U.shiftFormula("SUM(B2:B10)","S","S","row",4,1)==="SUM(B2:B11)", U.shiftFormula("SUM(B2:B10)","S","S","row",4,1));
check("shift only target sheet", U.shiftFormula("Other!B5+B5","S","S","row",0,1)==="Other!B5+B6");
check("delete hits ref -> #REF!", U.shiftFormula("B5*2","S","S","row",4,-1)==="#REF!*2", U.shiftFormula("B5*2","S","S","row",4,-1));
check("quoted sheet handled", U.shiftFormula("'Pro Forma'!B23+B1","X","Pro Forma","row",10,2)==="'Pro Forma'!B25+B1");
check("function names untouched", U.offsetFormula("LOG10(A1)+SUM(B2)",1,1)==="LOG10(B2)+SUM(C3)", U.offsetFormula("LOG10(A1)+SUM(B2)",1,1));

// --- structural op end-to-end: insert a row mid-Inputs, model must not break ---
const wb2 = U.buildTemplate();
const ev2 = new U.Evaluator(wb2);
const base = ev2.value("Cash Flows","B7");
U.shiftStructure(wb2, "Inputs", "row", 20, 3);   // insert 3 rows above expense block
const ev3 = new U.Evaluator(wb2);
check("NOI survives Inputs insert", near(ev3.value("Pro Forma","B23"),776000,0.5), ev3.value("Pro Forma","B23"));
check("IRR identical after insert", near(ev3.value("Cash Flows","B7"),base,1e-12), (ev3.value("Cash Flows","B7")*100).toFixed(2)+"%");
// purchase price moved from B9 to B9 (row 8 idx < 20 unchanged) — verify a moved input: vacancy was B17 (row idx16<20 unchanged); mgmt fee B32 -> B35
check("Moved input readable", ev3.value("Inputs","B35")===0.04, ev3.value("Inputs","B35"));
// delete the 3 rows again — model returns to baseline addresses
U.shiftStructure(wb2, "Inputs", "row", 20, -3);
const ev4 = new U.Evaluator(wb2);
check("NOI after delete restore", near(ev4.value("Pro Forma","B23"),776000,0.5), ev4.value("Pro Forma","B23"));
check("IRR after delete restore", near(ev4.value("Cash Flows","B7"),base,1e-12));

// column insert on Pro Forma sheet shifts year columns without breaking cross-refs
const wb3 = U.buildTemplate();
U.shiftStructure(wb3, "Pro Forma", "col", 1, 1); // blank column before Year 1
const ev5 = new U.Evaluator(wb3);
check("NOI after col insert (now C23)", near(ev5.value("Pro Forma","C23"),776000,0.5), ev5.value("Pro Forma","C23"));
check("Debt DSCR follows moved NOI", near(ev5.value("Debt","B16"),776000/525000,1e-6), ev5.value("Debt","B16"));
console.log(fails===0?"\nFEATURE TESTS PASSED":"\n"+fails+" FAILED");
process.exit(fails?1:0);
