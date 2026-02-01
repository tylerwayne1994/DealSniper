import React, { useState, useMemo } from 'react';
import { Building } from 'lucide-react';

const DealExecutionTab = ({ scenarioData }) => {
  const [expandedStructure, setExpandedStructure] = useState(null);

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

      {/* Expanded details removed to keep only the table */}
    </div>
  );
};

export default DealExecutionTab;
