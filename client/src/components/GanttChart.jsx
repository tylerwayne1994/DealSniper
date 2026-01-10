import React, { useState, useMemo } from 'react';
import { ChevronUp, FileText, DollarSign, TrendingDown, Users, Building, ArrowDown } from 'lucide-react';

const DealExecutionTab = ({ scenarioData }) => {
  const [expandedStructure, setExpandedStructure] = useState('Traditional (Bank/Agency)');

  // Helper to calculate monthly payment
  const calcMonthlyPayment = (principal, annualRate, amortMonths) => {
    if (principal <= 0 || amortMonths <= 0) return 0;
    const r = annualRate / 100 / 12;
    if (r === 0) return principal / amortMonths;
    return principal * (r * Math.pow(1 + r, amortMonths)) / (Math.pow(1 + r, amortMonths) - 1);
  };

  // Calculate all financing structures
  const structures = useMemo(() => {
    if (!scenarioData) return [];

    // Use same data source as DealStructureTab
    const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
    const noi = (scenarioData?.pnl?.noi_t12 ?? scenarioData?.pnl?.noi) || 0;
    const closingCosts = purchasePrice * 0.03;

    if (purchasePrice === 0) return [];

    const calculateStructure = (loanAmount, interestRate, term = 30, cashDown = null, equityData = null) => {
      const cashRequired = cashDown !== null ? cashDown : (purchasePrice - loanAmount + closingCosts);
      const monthlyPayment = calcMonthlyPayment(loanAmount, interestRate, term * 12);
      const annualDebtService = monthlyPayment * 12;
      const annualCashflow = noi - annualDebtService;
      const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
      const cashOnCash = cashRequired > 0 ? (annualCashflow / cashRequired) : 0;
      return { 
        loanAmount, 
        cashRequired, 
        monthlyPayment, 
        annualCashflow, 
        dscr, 
        cashOnCash, 
        interestRate,
        equityData
      };
    };

    return [
      {
        name: 'Traditional (Bank/Agency)',
        ...calculateStructure(purchasePrice * 0.75, 6.5),
        docs: ['Personal Financial Statement', 'Tax Returns (2 years)', 'Operating Statements', 'Rent Roll', 'Title Insurance', 'Appraisal', 'Environmental Phase I', 'Property Condition Report'],
        debtStructure: ['Senior Loan: 75% LTV @ 6.5%', '30-year amortization', 'Recourse or Non-Recourse', 'Typical 5-10 year term'],
        cashflowSteps: ['Gross Rental Income', '- Operating Expenses', '- Property Management', '= Net Operating Income (NOI)', '- Debt Service', '= Cash Flow to Equity'],
        orgChart: { 
          type: 'traditional',
          levels: [
            { 
              title: 'Property LLC', 
              amount: purchasePrice,
              items: ['100% GP Ownership'],
              color: '#6366f1'
            },
            { 
              title: 'Senior Lender', 
              amount: purchasePrice * 0.75,
              items: ['75% LTV @ 6.5%', 'First Position', '30-year amort'],
              color: '#10b981'
            }
          ]
        }
      },
      {
        name: 'Seller Finance',
        ...calculateStructure(purchasePrice * 0.85, 7.5, 20),
        docs: ['Purchase Agreement', 'Promissory Note', 'Deed of Trust', 'Personal Guarantee', 'Insurance Certificates', 'Title Search'],
        debtStructure: ['Seller Note: 85% LTV @ 7.5%', 'Interest-only or amortizing', 'Flexible terms negotiable', '3-7 year balloon'],
        cashflowSteps: ['Gross Rental Income', '- Operating Expenses', '= NOI', '- Seller Note Payment', '= Cash Flow to Buyer'],
        orgChart: { 
          type: 'seller',
          levels: [
            { 
              title: 'Buyer (Property Owner)', 
              amount: purchasePrice * 0.15,
              items: ['15% Down Payment', 'Controls Property'],
              color: '#6366f1'
            },
            { 
              title: 'Seller (Lender)', 
              amount: purchasePrice * 0.85,
              items: ['85% Carryback @ 7.5%', 'First Position Lien', '20-year term'],
              color: '#f59e0b'
            }
          ]
        }
      },
      {
        name: 'Subject To',
        ...calculateStructure(purchasePrice * 0.60, 5.5, 25, purchasePrice * 0.10),
        docs: ['Authorization to Release Loan Info', 'Existing Loan Documents', 'Loan Assumption Package', 'Due-on-Sale Review', 'Insurance Assignment', 'Servicing Transfer'],
        debtStructure: ['Existing Loan: 60% LTV @ 5.5%', 'Take over existing payments', 'Loan stays in seller name', 'No formal assumption'],
        cashflowSteps: ['Gross Rental Income', '- Operating Expenses', '= NOI', '- Existing Loan Payment', '= Cash Flow (Higher ROI)'],
        orgChart: { 
          type: 'subto',
          levels: [
            { 
              title: 'Buyer (Beneficial Owner)', 
              amount: purchasePrice * 0.10,
              items: ['10% Cash to Seller', 'Controls Property'],
              color: '#6366f1'
            },
            { 
              title: 'Existing Loan Balance', 
              amount: purchasePrice * 0.60,
              items: ['60% @ 5.5%', 'Remains in Seller Name', 'Buyer Makes Payments'],
              color: '#f59e0b'
            },
            { 
              title: 'Original Seller', 
              amount: purchasePrice * 0.30,
              items: ['30% Equity Pickup', 'Off Title', 'Still on Loan'],
              color: '#94a3b8'
            }
          ]
        }
      },
      {
        name: 'Hybrid (SubTo + Seller Carry)',
        ...(() => {
          const subtoLoan = purchasePrice * 0.55;
          const sellerCarry = purchasePrice * 0.25;
          const cashDown = purchasePrice * 0.20;
          const subtoMonthly = calcMonthlyPayment(subtoLoan, 4.5, 300);
          const sellerMonthly = sellerCarry * 0.05 / 12;
          const totalMonthly = subtoMonthly + sellerMonthly;
          const annualDebtService = totalMonthly * 12;
          const annualCashflow = noi - annualDebtService;
          const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
          const cashOnCash = cashDown > 0 ? annualCashflow / cashDown : 0;
          return { 
            loanAmount: subtoLoan + sellerCarry, 
            cashRequired: cashDown, 
            monthlyPayment: totalMonthly, 
            annualCashflow, 
            dscr, 
            cashOnCash, 
            interestRate: 4.75,
            equityData: { subtoLoan, sellerCarry }
          };
        })(),
        docs: ['Existing Loan Docs', 'Seller Carryback Note (2nd)', '2nd Deed of Trust', 'Intercreditor Agreement', 'Authorization Forms', 'Insurance Certificates'],
        debtStructure: ['1st: Existing SubTo Loan 55%', '2nd: Seller Carryback 25%', 'Blended rate 4.75%', 'Layered debt structure'],
        cashflowSteps: ['Gross Rental Income', '- Operating Expenses', '= NOI', '- 1st Position (SubTo)', '- 2nd Position (Seller)', '= Cash Flow'],
        orgChart: { 
          type: 'hybrid',
          levels: [
            { 
              title: 'Buyer/Operator', 
              amount: purchasePrice * 0.20,
              items: ['20% Cash Down', 'Active Manager'],
              color: '#6366f1'
            },
            { 
              title: '1st Position: Existing Lender', 
              amount: purchasePrice * 0.55,
              items: ['55% SubTo @ 4.5%', 'Senior Position', '~25 years remaining'],
              color: '#f59e0b'
            },
            { 
              title: '2nd Position: Seller Note', 
              amount: purchasePrice * 0.25,
              items: ['25% Carryback @ 5.0%', 'Junior Position', 'Interest-Only'],
              color: '#ec4899'
            }
          ]
        }
      },
      {
        name: 'Equity Partner',
        ...(() => {
          const seniorDebt = purchasePrice * 0.75;
          const totalEquity = purchasePrice * 0.25;
          const gpContrib = totalEquity * 0.10;
          const lpContrib = totalEquity * 0.90;
          const monthlyPayment = calcMonthlyPayment(seniorDebt, 6.5, 360);
          const annualDebtService = monthlyPayment * 12;
          const annualCashflow = noi - annualDebtService;
          const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
          const cashOnCash = totalEquity > 0 ? annualCashflow / totalEquity : 0;
          return { 
            loanAmount: seniorDebt, 
            cashRequired: gpContrib, 
            monthlyPayment, 
            annualCashflow, 
            dscr, 
            cashOnCash, 
            interestRate: 6.5, 
            equityData: { gpContrib, lpContrib, totalEquity }
          };
        })(),
        docs: ['Operating Agreement', 'PPM (Private Placement)', 'Subscription Agreement', 'Bank Loan Docs', 'Capital Call Schedule', 'Distribution Waterfall Terms'],
        debtStructure: ['Senior Debt: 75% LTV @ 6.5%', 'GP contributes 10% of equity', 'LP contributes 90% of equity', 'Promote structure on returns'],
        cashflowSteps: ['NOI', '- Debt Service', '= Cash Available', '→ Return of Capital', '→ 8% Pref to LPs', '→ GP Catch-up', '→ Remaining Split 80/20'],
        orgChart: { 
          type: 'equity',
          levels: [
            { 
              title: 'Property LLC', 
              amount: purchasePrice,
              items: ['Operating Entity', 'SPV Structure'],
              color: '#6366f1'
            },
            { 
              title: 'GP (Sponsor)', 
              amount: purchasePrice * 0.25 * 0.10,
              items: ['10% Equity Investment', 'Active Management', '20% Promote After Pref'],
              color: '#8b5cf6'
            },
            { 
              title: 'LP (Limited Partners)', 
              amount: purchasePrice * 0.25 * 0.90,
              items: ['90% Equity Investment', 'Passive Investors', '8% Preferred Return'],
              color: '#ec4899'
            },
            { 
              title: 'Senior Lender', 
              amount: purchasePrice * 0.75,
              items: ['75% LTV @ 6.5%', 'First Position', '30-year amort'],
              color: '#10b981'
            }
          ]
        }
      },
      {
        name: 'Seller Carry (Bank + Seller 2nd)',
        ...(() => {
          const bankLoan = purchasePrice * 0.75;
          const sellerNote = purchasePrice * 0.10;
          const cashDown = purchasePrice * 0.15 + closingCosts;
          const bankMonthly = calcMonthlyPayment(bankLoan, 6.5, 360);
          const sellerMonthly = sellerNote * 0.08 / 12;
          const totalMonthly = bankMonthly + sellerMonthly;
          const annualDebtService = totalMonthly * 12;
          const annualCashflow = noi - annualDebtService;
          const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
          const cashOnCash = cashDown > 0 ? annualCashflow / cashDown : 0;
          return { 
            loanAmount: bankLoan + sellerNote, 
            cashRequired: cashDown, 
            monthlyPayment: totalMonthly, 
            annualCashflow, 
            dscr, 
            cashOnCash, 
            interestRate: 6.8,
            equityData: { bankLoan, sellerNote }
          };
        })(),
        docs: ['Bank Loan Package', 'Seller 2nd Position Note', 'Intercreditor Agreement', 'Subordination Agreement', 'Both Deeds of Trust', 'Title with Both Liens'],
        debtStructure: ['1st: Bank 75% @ 6.5%', '2nd: Seller 10% @ 8.0%', 'Total 85% LTV blended', 'Seller subordinates to bank'],
        cashflowSteps: ['Gross Rental Income', '- Operating Expenses', '= NOI', '- Bank Payment (1st)', '- Seller Payment (2nd)', '= Cash Flow'],
        orgChart: { 
          type: 'sellercarry',
          levels: [
            { 
              title: 'Buyer (Property Owner)', 
              amount: purchasePrice * 0.15 + closingCosts,
              items: ['15% Down + Closing', 'Full Control'],
              color: '#6366f1'
            },
            { 
              title: '1st Position: Bank Loan', 
              amount: purchasePrice * 0.75,
              items: ['75% LTV @ 6.5%', 'Senior Position', '30-year amort'],
              color: '#10b981'
            },
            { 
              title: '2nd Position: Seller Note', 
              amount: purchasePrice * 0.10,
              items: ['10% @ 8.0%', 'Subordinated to Bank', 'Interest-Only 5 years'],
              color: '#f59e0b'
            }
          ]
        }
      },
      {
        name: 'Lease Option',
        ...(() => {
          const optionFee = purchasePrice * 0.03; // 3% non-refundable option fee
          const monthlyRent = noi / 12; // Monthly rent equals NOI
          const rentCredit = monthlyRent * 0.20; // 20% of rent as purchase credit
          const annualCashflow = 0; // No cash flow during lease period
          const dscr = 0;
          const cashOnCash = 0;
          return { 
            loanAmount: 0, 
            cashRequired: optionFee, 
            monthlyPayment: monthlyRent, 
            annualCashflow, 
            dscr, 
            cashOnCash, 
            interestRate: 0,
            equityData: { optionFee, monthlyRent, rentCredit, exercisePrice: purchasePrice }
          };
        })(),
        docs: ['Lease Agreement', 'Option Agreement', 'Memorandum of Option (recorded)', 'Right of First Refusal', 'Assignment Clause', 'Sublease Rights'],
        debtStructure: ['No debt during lease', 'Option fee paid upfront', 'Rent credits accumulate', 'Finance at exercise'],
        cashflowSteps: ['Tenant Income (if subleasing)', '- Rent to Owner', '- Operating Expenses', '= Cash Flow to Tenant/Buyer', 'Rent credits build equity'],
        orgChart: { 
          type: 'leaseoption',
          levels: [
            { 
              title: 'Owner/Seller', 
              amount: purchasePrice,
              items: ['Still Owns Property', 'Receives Rent', 'No Sale Yet'],
              color: '#6366f1'
            },
            { 
              title: 'Tenant/Buyer (You)', 
              amount: purchasePrice * 0.03,
              items: ['Option Fee', 'Control Property', 'Accumulate Credits'],
              color: '#8b5cf6'
            },
            { 
              title: 'Option Exercise', 
              amount: purchasePrice,
              items: ['Strike Price', 'Credits Applied', 'Finance or Cash'],
              color: '#10b981'
            }
          ]
        }
      }
    ];
  }, [scenarioData]);

  if (!scenarioData) {
    return <div style={{ padding: '24px' }}>No deal data available</div>;
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const renderOrgChart = (orgChart, structure) => {
    const purchasePrice = scenarioData?.pricing_financing?.price || scenarioData?.pricing_financing?.purchase_price || 0;
    const noi = (scenarioData?.pnl?.noi_t12 ?? scenarioData?.pnl?.noi) || 0;
    const monthlyNOI = noi / 12;
    const monthlyDebtService = structure.monthlyPayment;
    const monthlyCashAvailable = monthlyNOI - monthlyDebtService;
    
    // EQUITY PARTNER - Full GP/LP Breakdown
    if (orgChart.type === 'equity' && structure.equityData) {
      const { gpContrib, lpContrib, totalEquity } = structure.equityData;
      const [llc, gp, lp, lender] = orgChart.levels;
      
      return (
        <div style={{ display: 'grid', gap: '32px' }}>
          {/* Org Chart Flowchart with SVG Lines */}
          <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', border: '2px solid #e5e7eb', position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <div style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', fontSize: '18px', fontWeight: '700', borderRadius: '8px' }}>
                {structure.name}
              </div>
            </div>
            
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
              {/* Line from Property LLC to GP/LP split point */}
              <line x1="50%" y1="200" x2="50%" y2="280" stroke="#9ca3af" strokeWidth="2" />
              
              {/* Line from GP down */}
              <line x1="30%" y1="390" x2="30%" y2="450" stroke="#9ca3af" strokeWidth="2" />
              
              {/* Line from LP down */}
              <line x1="70%" y1="390" x2="70%" y2="450" stroke="#9ca3af" strokeWidth="2" />
              
              {/* Horizontal line connecting GP and LP to center */}
              <line x1="30%" y1="450" x2="70%" y2="450" stroke="#9ca3af" strokeWidth="2" />
              
              {/* Center vertical line down from GP/LP merger */}
              <line x1="50%" y1="450" x2="50%" y2="510" stroke="#9ca3af" strokeWidth="2" />
              
              {/* Line from Total Equity to Senior Lender */}
              <line x1="50%" y1="580" x2="50%" y2="640" stroke="#9ca3af" strokeWidth="2" />
            </svg>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Top: Property LLC */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '80px' }}>
                <div style={{ display: 'inline-block', padding: '16px 32px', backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', textAlign: 'center', minWidth: '240px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROPERTY LLC</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#111827' }}>{formatCurrency(purchasePrice)}</div>
                </div>
              </div>
              
              {/* Middle row: GP and LP Equity */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '25%', marginBottom: '60px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '14px 24px', backgroundColor: '#f3e8ff', border: '2px solid #8b5cf6', borderRadius: '8px', textAlign: 'center', minWidth: '180px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b21a8', marginBottom: '4px', textTransform: 'uppercase' }}>GP (Sponsor)</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(gpContrib)}</div>
                    <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600', marginTop: '4px' }}>{((gpContrib / totalEquity) * 100).toFixed(0)}% Equity</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '14px 24px', backgroundColor: '#fce7f3', border: '2px solid #ec4899', borderRadius: '8px', textAlign: 'center', minWidth: '180px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#9f1239', marginBottom: '4px', textTransform: 'uppercase' }}>LP (Investor)</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(lpContrib)}</div>
                    <div style={{ fontSize: '10px', color: '#be185d', fontWeight: '600', marginTop: '4px' }}>{((lpContrib / totalEquity) * 100).toFixed(0)}% Equity</div>
                  </div>
                </div>
              </div>
              
              {/* Center: Total Equity */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '60px' }}>
                <div style={{ padding: '14px 32px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', textAlign: 'center', minWidth: '240px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL EQUITY</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(totalEquity)}</div>
                  <div style={{ fontSize: '10px', color: '#d97706', fontWeight: '600', marginTop: '4px' }}>25% of Deal</div>
                </div>
              </div>
              
              {/* Bottom: Senior Lender */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '16px 32px', backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px', textAlign: 'center', minWidth: '240px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SENIOR LENDER</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#111827' }}>{formatCurrency(structure.loanAmount)}</div>
                  <div style={{ fontSize: '10px', color: '#059669', fontWeight: '600', marginTop: '4px' }}>75% LTV @ 6.5%</div>
                </div>
              </div>
            </div>
            
            {/* Deal closing details */}
            <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>DEED OF TRUST</div>
                <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>Recorded</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>TITLE</div>
                <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>LLC Ownership</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>OPERATING AGREEMENT</div>
                <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>GP/LP Structure</div>
              </div>
            </div>
          </div>

          {/* Detailed Financial Breakdown */}
          {(() => {
            const monthlyNOI = noi / 12;
            const monthlyDebtService = structure.monthlyPayment;
            const monthlyCashAvailable = monthlyNOI - monthlyDebtService;
            
            const gpPercent = (gpContrib / totalEquity) * 100;
            const lpPercent = (lpContrib / totalEquity) * 100;
            
            const lpPrefReturnAnnual = lpContrib * 0.08;
            const lpPrefReturnMonthly = lpPrefReturnAnnual / 12;
            
            const monthlyAfterPref = monthlyCashAvailable - lpPrefReturnMonthly;
            const gpCatchup = monthlyAfterPref > 0 ? Math.min(monthlyAfterPref * 0.20, lpPrefReturnMonthly * 0.25) : 0;
            const remainingAfterCatchup = monthlyAfterPref - gpCatchup;
            const gpPromote = remainingAfterCatchup > 0 ? remainingAfterCatchup * 0.20 : 0;
            const lpRemaining = remainingAfterCatchup > 0 ? remainingAfterCatchup * 0.80 : 0;
            
            const totalGPMonthly = gpCatchup + gpPromote;
            const totalLPMonthly = lpPrefReturnMonthly + lpRemaining;
            
            const yearlyNOIGrowth = 0.03;
            const year5NOI = noi * Math.pow(1 + yearlyNOIGrowth, 5);
            const exitCapRate = 0.055;
            const year5Value = year5NOI / exitCapRate;
            const appreciationGain = year5Value - purchasePrice;
            
            const newLoanAmount = year5Value * 0.75;
            const currentLoanBalance = structure.loanAmount * 0.92;
            const cashOutRefi = newLoanAmount - currentLoanBalance;
            
            const lpReturnOfCapital = lpContrib;
            const gpReturnOfCapital = gpContrib;
            const totalReturnOfCapital = lpReturnOfCapital + gpReturnOfCapital;
            const remainingAfterCapitalReturn = cashOutRefi - totalReturnOfCapital;
            
            const lpRefinanceProceeds = lpReturnOfCapital + (remainingAfterCapitalReturn > 0 ? remainingAfterCapitalReturn * 0.80 : 0);
            const gpRefinanceProceeds = gpReturnOfCapital + (remainingAfterCapitalReturn > 0 ? remainingAfterCapitalReturn * 0.20 : 0);

            return (
              <>
                {/* Monthly Cashflow Distribution */}
                <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
                  <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>Monthly Cashflow Distribution</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '2px solid #e5e7eb' }}>
                      <span style={{ fontWeight: '600', color: '#374151' }}>Gross Monthly NOI</span>
                      <span style={{ fontWeight: '700', fontSize: '18px', color: '#111827' }}>{formatCurrency(monthlyNOI)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>- Debt Service (Bank Loan)</span>
                      <span style={{ fontWeight: '700', fontSize: '18px', color: '#b45309' }}>({formatCurrency(monthlyDebtService)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px', backgroundColor: '#dbeafe', borderRadius: '8px', border: '3px solid #3b82f6' }}>
                      <span style={{ fontWeight: '700', color: '#1e40af' }}>= Cash Available for Distribution</span>
                      <span style={{ fontWeight: '800', fontSize: '20px', color: '#1e40af' }}>{formatCurrency(monthlyCashAvailable)}</span>
                    </div>
                    
                    <div style={{ marginTop: '12px', padding: '4px 0', borderTop: '2px dashed #d1d5db' }} />
                    
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', marginTop: '8px' }}>WATERFALL DISTRIBUTION:</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fce7f3', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
                      <span style={{ fontWeight: '600', color: '#831843' }}>1. LP Preferred Return (8% annually)</span>
                      <span style={{ fontWeight: '700', fontSize: '17px', color: '#be185d' }}>{formatCurrency(lpPrefReturnMonthly)}</span>
                    </div>
                    
                    {monthlyAfterPref > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#f3e8ff', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                          <span style={{ fontWeight: '600', color: '#581c87' }}>2. GP Catch-Up (to achieve 80/20)</span>
                          <span style={{ fontWeight: '700', fontSize: '17px', color: '#7c3aed' }}>{formatCurrency(gpCatchup)}</span>
                        </div>
                        
                        {remainingAfterCatchup > 0 && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#f3e8ff', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                              <span style={{ fontWeight: '600', color: '#581c87' }}>3. GP Promote (20% of remaining)</span>
                              <span style={{ fontWeight: '700', fontSize: '17px', color: '#7c3aed' }}>{formatCurrency(gpPromote)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fce7f3', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
                              <span style={{ fontWeight: '600', color: '#831843' }}>4. LP Remaining (80% of remaining)</span>
                              <span style={{ fontWeight: '700', fontSize: '17px', color: '#be185d' }}>{formatCurrency(lpRemaining)}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    
                    <div style={{ marginTop: '16px', padding: '4px 0', borderTop: '3px solid #111827' }} />
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                      <div style={{ padding: '20px', backgroundColor: '#f3e8ff', borderRadius: '10px', border: '3px solid #8b5cf6' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>GP (Sponsor) Monthly</div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#7c3aed' }}>{formatCurrency(totalGPMonthly)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>In Your Pocket</div>
                      </div>
                      <div style={{ padding: '20px', backgroundColor: '#fce7f3', borderRadius: '10px', border: '3px solid #ec4899' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>LP Monthly Total</div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#be185d' }}>{formatCurrency(totalLPMonthly)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Passive Return</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5-Year Refinance */}
                <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', border: '2px solid #10b981' }}>
                  <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>5-Year Refinance Scenario</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#10b981', backgroundColor: '#d1fae5', padding: '4px 10px', borderRadius: '12px' }}>Exit Strategy</span>
                  </h5>
                  
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div style={{ padding: '18px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '2px solid #10b981' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>Year 5 Value</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginBottom: '4px' }}>{formatCurrency(year5Value)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>3% NOI growth</div>
                      </div>
                      <div style={{ padding: '18px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '2px solid #10b981' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>Appreciation</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginBottom: '4px' }}>{formatCurrency(appreciationGain)}</div>
                        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>+{((appreciationGain / purchasePrice) * 100).toFixed(1)}%</div>
                      </div>
                      <div style={{ padding: '18px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '2px solid #3b82f6' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>New Loan (75%)</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginBottom: '4px' }}>{formatCurrency(newLoanAmount)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>Refinance</div>
                      </div>
                      <div style={{ padding: '18px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '2px solid #f59e0b' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>Payoff</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', marginBottom: '4px' }}>{formatCurrency(currentLoanBalance)}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>Loan balance</div>
                      </div>
                    </div>
                    
                    <div style={{ padding: '24px', backgroundColor: '#ecfdf5', borderRadius: '10px', border: '3px solid #10b981' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', fontWeight: '700' }}>CASH OUT:</div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: '#059669', marginBottom: '8px' }}>{formatCurrency(cashOutRefi)}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Available for distribution</div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ padding: '24px', backgroundColor: '#f3e8ff', borderRadius: '12px', border: '3px solid #8b5cf6' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px', fontWeight: '700' }}>GP Total Payout</div>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#7c3aed', marginBottom: '12px' }}>{formatCurrency(gpRefinanceProceeds)}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Breakdown:</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Return of Capital:</span>
                          <span style={{ fontWeight: '600', color: '#374151' }}>{formatCurrency(gpReturnOfCapital)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#6b7280' }}>Profits (20%):</span>
                          <span style={{ fontWeight: '700', color: '#7c3aed' }}>{formatCurrency(gpRefinanceProceeds - gpReturnOfCapital)}</span>
                        </div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #8b5cf620', fontSize: '13px', fontWeight: '700', color: '#7c3aed' }}>
                          ROI: {gpReturnOfCapital > 0 ? ((gpRefinanceProceeds / gpReturnOfCapital - 1) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                      
                      <div style={{ padding: '24px', backgroundColor: '#fce7f3', borderRadius: '12px', border: '3px solid #ec4899' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px', fontWeight: '700' }}>LP Total Payout</div>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#be185d', marginBottom: '12px' }}>{formatCurrency(lpRefinanceProceeds)}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Breakdown:</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#6b7280' }}>Return of Capital:</span>
                          <span style={{ fontWeight: '600', color: '#374151' }}>{formatCurrency(lpReturnOfCapital)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#6b7280' }}>Profits (80%):</span>
                          <span style={{ fontWeight: '700', color: '#be185d' }}>{formatCurrency(lpRefinanceProceeds - lpReturnOfCapital)}</span>
                        </div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #ec489920', fontSize: '13px', fontWeight: '700', color: '#be185d' }}>
                          ROI: {lpReturnOfCapital > 0 ? ((lpRefinanceProceeds / lpReturnOfCapital - 1) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      );
    }
    
    // TRADITIONAL BANK/AGENCY - Baseline Deal
    if (orgChart.type === 'traditional') {
      return (
        <div style={{ display: 'grid', gap: '28px' }}>
          {/* Concept Box */}
          <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '10px', border: '2px solid #3b82f6' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: '#1e40af' }}>📋 CONCEPT</h5>
            <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
              Clean institutional purchase. Heavy equity requirement (~25%), strong credit needed, weak cash-on-cash return. Best for stabilized assets with strong financials.
            </p>
          </div>

          {/* Transaction Flow */}
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ display: 'inline-block', padding: '10px 28px', backgroundColor: '#3b82f6', color: 'white', fontSize: '16px', fontWeight: '700', borderRadius: '8px' }}>
                TRANSACTION 1 – Purchase
              </div>
            </div>
            
            <svg style={{ width: '100%', height: '400px' }}>
              {/* Bank to Escrow */}
              <line x1="25%" y1="100" x2="50%" y2="200" stroke="#10b981" strokeWidth="2.5" />
              {/* Buyer to Escrow */}
              <line x1="75%" y1="100" x2="50%" y2="200" stroke="#3b82f6" strokeWidth="2.5" />
              {/* Escrow to Seller */}
              <line x1="50%" y1="240" x2="50%" y2="320" stroke="#f59e0b" strokeWidth="2.5" />
            </svg>
            
            <div style={{ position: 'relative', marginTop: '-380px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '80px' }}>
                <div style={{ padding: '14px 20px', backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', marginBottom: '4px' }}>BANK LENDER</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(structure.loanAmount)}</div>
                  <div style={{ fontSize: '10px', color: '#059669', marginTop: '4px' }}>70-75% LTV</div>
                </div>
                <div style={{ padding: '14px 20px', backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', marginBottom: '4px' }}>BUYER (YOU)</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(structure.cashRequired)}</div>
                  <div style={{ fontSize: '10px', color: '#2563eb', marginTop: '4px' }}>Down Payment</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '80px' }}>
                <div style={{ padding: '16px 28px', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', textAlign: 'center', minWidth: '260px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '6px' }}>ESCROW / COE 1</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(purchasePrice)}</div>
                  <div style={{ fontSize: '10px', color: '#d97706', marginTop: '4px' }}>Closing Agent</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '16px 28px', backgroundColor: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', textAlign: 'center', minWidth: '260px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>SELLER</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(purchasePrice)}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Net Proceeds</div>
                </div>
              </div>
            </div>
          </div>

          {/* Capital Stack */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <h5 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>💰 CAPITAL STACK</h5>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#d1fae5', borderRadius: '8px', border: '2px solid #10b981' }}>
                <span style={{ fontWeight: '600', color: '#065f46' }}>Bank Debt (Senior)</span>
                <span style={{ fontWeight: '700', color: '#111827' }}>~75% ({formatCurrency(structure.loanAmount)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#dbeafe', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                <span style={{ fontWeight: '600', color: '#1e40af' }}>Buyer Equity</span>
                <span style={{ fontWeight: '700', color: '#111827' }}>~25% ({formatCurrency(structure.cashRequired)})</span>
              </div>
            </div>
          </div>

          {/* Monthly Operations */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <h5 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>📅 MONTHLY OPERATIONS</h5>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>1</div>
                <div style={{ flex: 1, padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  Tenants pay rent → <span style={{ color: '#10b981' }}>Gross Income</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>2</div>
                <div style={{ flex: 1, padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  You pay operating expenses → <span style={{ color: '#f59e0b' }}>OpEx, Prop Mgmt</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>3</div>
                <div style={{ flex: 1, padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  You pay bank → <span style={{ color: '#ef4444' }}>{formatCurrency(monthlyDebtService)}/mo</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', backgroundColor: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>✓</div>
                <div style={{ flex: 1, padding: '12px 14px', backgroundColor: '#d1fae5', borderRadius: '6px', border: '2px solid #10b981', fontSize: '14px', fontWeight: '700', color: '#065f46' }}>
                  You keep cashflow → <span style={{ color: '#111827' }}>{formatCurrency(monthlyCashAvailable)}/mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // SELLER FINANCE - True Carry
    if (orgChart.type === 'seller') {
      return (
        <div style={{ display: 'grid', gap: '28px' }}>
          <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '10px', border: '2px solid #f59e0b' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: '#92400e' }}>📋 CONCEPT</h5>
            <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
              Seller IS the bank. No institutional debt. Flexible terms, lower down payment. Works when seller wants passive income + tax deferral (installment sale). Negotiate everything.
            </p>
          </div>

          {/* Transaction */}
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ display: 'inline-block', padding: '10px 28px', backgroundColor: '#f59e0b', color: 'white', fontSize: '16px', fontWeight: '700', borderRadius: '8px' }}>
                TRANSACTION – Seller Carry
              </div>
            </div>
            
            <div style={{ display: 'grid', gap: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ padding: '14px 20px', backgroundColor: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>SELLER (Now Lender)</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(structure.loanAmount)}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Carryback Note</div>
                </div>
                <div style={{ padding: '14px 20px', backgroundColor: '#dbeafe', border: '2px solid #3b82f6', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', marginBottom: '4px' }}>BUYER (You)</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>{formatCurrency(structure.cashRequired)}</div>
                  <div style={{ fontSize: '10px', color: '#2563eb', marginTop: '4px' }}>Down Payment</div>
                </div>
              </div>
              
              <div style={{ padding: '20px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '2px solid #f59e0b' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>SELLER GETS</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>Grant Deed Out</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Off title</div>
                  </div>
                  <div style={{ fontSize: '24px', color: '#d97706' }}>⇄</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '600', marginBottom: '4px' }}>YOU GET</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>Title + Control</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Promissory Note</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lien Position */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <h5 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>🔒 LIEN POSITION</h5>
            <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>1st Position: Seller Note</div>
              <div style={{ fontSize: '13px', color: '#374151' }}>Seller records Deed of Trust in 1st position. Monthly P&I payments directly to seller. Typically 5-7 year balloon.</div>
            </div>
          </div>

          {/* Monthly Ops */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
            <h5 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#111827' }}>📅 MONTHLY OPERATIONS</h5>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <span style={{ fontWeight: '600', color: '#374151' }}>Gross Income (NOI)</span>
                <span style={{ fontWeight: '700', color: '#111827' }}>{formatCurrency(monthlyNOI)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '2px solid #f59e0b' }}>
                <span style={{ fontWeight: '600', color: '#92400e' }}>→ Seller Note Payment</span>
                <span style={{ fontWeight: '700', color: '#ef4444' }}>({formatCurrency(monthlyDebtService)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#d1fae5', borderRadius: '6px', border: '2px solid #10b981' }}>
                <span style={{ fontWeight: '700', color: '#065f46' }}>= You Keep</span>
                <span style={{ fontWeight: '900', fontSize: '18px', color: '#111827' }}>{formatCurrency(monthlyCashAvailable)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // For other structures - show basic flowchart + monthly ops
    return (
      <div style={{ display: 'grid', gap: '32px' }}>
        {/* Org Chart Flowchart */}
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#3b82f6', color: 'white', fontSize: '18px', fontWeight: '700', borderRadius: '8px' }}>
              {structure.name}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {orgChart.levels.map((level, idx) => (
              <React.Fragment key={idx}>
                <div style={{ 
                  padding: '16px 28px', 
                  background: `${level.color}15`,
                  border: `2px solid ${level.color}`, 
                  borderRadius: '8px', 
                  textAlign: 'center',
                  minWidth: '280px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: level.color, marginBottom: '6px', textTransform: 'uppercase' }}>
                    {level.title}
                  </div>
                  {level.amount && (
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827', marginBottom: '8px' }}>
                      {formatCurrency(level.amount)}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {level.items.map((item, itemIdx) => (
                      <div key={itemIdx} style={{ 
                        padding: '5px 10px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px', 
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#374151',
                        border: `1px solid ${level.color}40`
                      }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                
                {idx < orgChart.levels.length - 1 && (
                  <div style={{ width: '2px', height: '40px', backgroundColor: '#9ca3af' }} />
                )}
              </React.Fragment>
            ))}
          </div>
          
          {/* Deal closing details */}
          <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>DEED OF TRUST</div>
              <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>Recorded</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>TITLE</div>
              <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>Your Name</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>ESCROW</div>
              <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>{formatCurrency(structure.cashRequired)}</div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
          <h5 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#111827' }}>Monthly Cash Flow Analysis</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '18px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Monthly NOI</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(monthlyNOI)}</div>
            </div>
            <div style={{ padding: '18px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Debt Service</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(monthlyDebtService)}</div>
            </div>
            <div style={{ padding: '18px', backgroundColor: '#d1fae5', borderRadius: '8px', border: '2px solid #10b981' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Your Monthly Cash</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#10b981' }}>{formatCurrency(monthlyCashAvailable)}</div>
            </div>
            <div style={{ padding: '18px', backgroundColor: '#f3e8ff', borderRadius: '8px', border: '2px solid #8b5cf6' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Annual Cash</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{formatCurrency(monthlyCashAvailable * 12)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building size={28} color="#6366f1" />
          All Structures Comparison
        </h2>
      </div>

      {/* Comparison Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '14px', textAlign: 'left', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Structure</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Loan Amount</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Cash Required</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Monthly Payment</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Annual Cashflow</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>DSCR</th>
              <th style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: '#111827', fontSize: '15px' }}>Cash on Cash</th>
            </tr>
          </thead>
          <tbody>
            {structures.map((structure, index) => (
              <tr 
                key={structure.name}
                onClick={() => setExpandedStructure(expandedStructure === structure.name ? null : structure.name)}
                style={{ 
                  borderBottom: '1px solid #e5e7eb', 
                  cursor: 'pointer',
                  backgroundColor: expandedStructure === structure.name ? '#eff6ff' : index === 0 ? '#f0f9ff' : 'white',
                  transition: 'background-color 0.2s'
                }}
              >
                <td style={{ padding: '14px', fontWeight: expandedStructure === structure.name ? '700' : '600', color: '#111827', fontSize: '14px' }}>
                  {structure.name}
                  {index === 0 && <span style={{ marginLeft: '10px', fontSize: '11px', color: '#6366f1', fontWeight: '700', backgroundColor: '#dbeafe', padding: '3px 8px', borderRadius: '4px' }}>★ YOUR CHOICE</span>}
                </td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>{formatCurrency(structure.loanAmount)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>{formatCurrency(structure.cashRequired)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>{formatCurrency(structure.monthlyPayment)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: structure.annualCashflow > 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(structure.annualCashflow)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: structure.dscr >= 1.25 ? '#10b981' : structure.dscr >= 1.0 ? '#f59e0b' : '#ef4444' }}>{structure.dscr.toFixed(2)}x</td>
                <td style={{ padding: '14px', textAlign: 'right', fontWeight: '700', color: structure.cashOnCash > 0 ? '#10b981' : '#ef4444' }}>{formatPercent(structure.cashOnCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded Structure Details */}
      {expandedStructure && structures.find(s => s.name === expandedStructure) && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '24px', border: '2px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', paddingBottom: '20px', borderBottom: '3px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#111827' }}>{expandedStructure} - Detailed Breakdown</h3>
            <button 
              onClick={() => setExpandedStructure(null)}
              style={{ padding: '10px 20px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '14px', boxShadow: '0 2px 4px rgba(99,102,241,0.3)' }}
            >
              <ChevronUp size={18} />
              Collapse
            </button>
          </div>

          {(() => {
            const structure = structures.find(s => s.name === expandedStructure);
            return (
              <div style={{ display: 'grid', gap: '32px' }}>
                {/* Capital Structure Org Chart */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Users size={22} color="#6366f1" />
                    Deal Breakdown & Cash Flow Analysis
                  </h4>
                  {renderOrgChart(structure.orgChart, structure)}
                </div>

                {/* Required Documents */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={22} color="#6366f1" />
                    Required Documents
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {structure.docs.map((doc, idx) => (
                      <div key={idx} style={{ padding: '14px 16px', backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#6366f1', borderRadius: '50%', flexShrink: 0 }} />
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Debt Structure */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingDown size={22} color="#6366f1" />
                    Debt Structure & Terms
                  </h4>
                  <div style={{ padding: '20px', backgroundColor: '#eff6ff', borderLeft: '6px solid #6366f1', borderRadius: '8px' }}>
                    {structure.debtStructure.map((term, idx) => (
                      <div key={idx} style={{ fontSize: '15px', color: '#1e40af', marginBottom: idx < structure.debtStructure.length - 1 ? '12px' : '0', fontWeight: '600' }}>
                        • {term}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cashflow Waterfall */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <DollarSign size={22} color="#10b981" />
                    Cash Flow Distribution Waterfall
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {structure.cashflowSteps.map((step, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '14px 20px', 
                          backgroundColor: step.includes('=') ? '#d1fae5' : '#f9fafb', 
                          border: step.includes('=') ? '3px solid #10b981' : '2px solid #e5e7eb',
                          borderRadius: '8px', 
                          fontSize: '15px',
                          fontWeight: step.includes('=') ? '700' : '600',
                          color: step.includes('=') ? '#065f46' : '#374151',
                          marginLeft: step.startsWith('-') || step.startsWith('→') ? '32px' : '0'
                        }}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default DealExecutionTab;
