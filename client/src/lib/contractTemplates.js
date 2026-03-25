/**
 * Contract Templates — pure client-side template substitution.
 * No LLM, no API calls, no tokens. Just fill-in-the-blanks.
 *
 * Package I  — LLC Operating Agreement + Capital Contribution Agreement
 * Package II — Preferred Return Agreement + Distribution Waterfall +
 *              Personal Guarantee + Buy-Sell Agreement + NDA + Equity Buyback
 */

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v) => {
  if (v === '' || v === null || v === undefined) return '___________';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const pct = (v) => (v === '' || v === null || v === undefined ? '___' : `${v}`);

const blank = (v) => (v ? String(v) : '_______________');

const today = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const dateVal = (v) => {
  if (!v) return '__/__/____';
  try {
    return new Date(v + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return v; }
};


// ═══════════════════════════════════════════════════════════════════════════
//  PACKAGE I  —  LLC Operating Agreement  +  Capital Contribution Agreement
// ═══════════════════════════════════════════════════════════════════════════

export function generatePackage1(f) {
  const totalCap = (Number(f.opCapital) || 0) + (Number(f.epCapital) || 0);

  return `
════════════════════════════════════════════════════════════════
                   LLC OPERATING AGREEMENT
                   ${blank(f.entityName)}
════════════════════════════════════════════════════════════════

                    OPERATING AGREEMENT
                          OF
                  ${blank(f.entityName)}
              A ${blank(f.stateOfFormation)} Limited Liability Company

Effective Date: ${dateVal(f.effectiveDate)}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                     ARTICLE I — FORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 1.1 — Formation.

The Members hereby form a Limited Liability Company ("Company") under the laws of the State of ${blank(f.stateOfFormation)}, pursuant to the ${blank(f.stateOfFormation)} Limited Liability Company Act.

Section 1.2 — Name.

The name of the Company shall be ${blank(f.entityName)} (the "Company").

Section 1.3 — Principal Office.

The principal office of the Company shall be located at ${blank(f.entityAddress)}, or at such other place as the Managing Member may designate from time to time.

Section 1.4 — Purpose.

The Company is formed for the purpose of acquiring, owning, operating, improving, financing, refinancing, and ultimately disposing of that certain real property located at ${blank(f.propertyAddress)} (the "Property"), consisting of approximately ${blank(f.units)} units, and all activities related thereto.

Section 1.5 — Term.

The Company shall continue in existence until dissolved in accordance with Article VIII of this Agreement.

Section 1.6 — Registered Agent.

The registered agent of the Company in the State of ${blank(f.stateOfFormation)} shall be ${blank(f.opFullName)} or such other person as the Managing Member may designate.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    ARTICLE II — DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

As used in this Agreement, the following terms shall have the meanings set forth below:

"Capital Account" means, with respect to each Member, the account maintained for such Member reflecting the Member's Capital Contributions, adjusted for allocations of Net Profits and Net Losses, and reduced by distributions to such Member.

"Capital Contribution" means the total amount of cash and/or property contributed to the Company by a Member.

"Distributable Cash" means the gross cash receipts of the Company from all sources, less (i) Operating Expenses, (ii) debt service payments, (iii) reasonable reserves for capital expenditures, vacancy, and contingencies as determined by the Managing Member.

"Fiscal Year" means the calendar year, or such other twelve-month period as the Managing Member may determine.

"Interest" or "Membership Interest" means a Member's entire ownership interest in the Company, including the right to share in profits, losses, and distributions.

"Majority Interest" means Members holding more than fifty percent (50%) of the total Percentage Interests.

"Member" means each person who has been admitted as a member of the Company and who has not ceased to be a member.

"Net Profits" and "Net Losses" mean the net income or net loss of the Company for any fiscal period, determined in accordance with generally accepted accounting principles consistently applied.

"Operating Expenses" means all expenses incurred in the ordinary course of the Company's business, including but not limited to property management fees, maintenance, insurance, taxes, utilities, and professional fees.

"Percentage Interest" means the percentage ownership interest of each Member as set forth in Section 3.1.

"Preferred Return" means a cumulative, non-compounding return of ${pct(f.preferredReturnPct)}% per annum on each Member's Unreturned Capital Contribution.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ARTICLE III — MEMBERS AND CAPITAL CONTRIBUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 3.1 — Members, Contributions, and Ownership.

The Members of the Company, their Capital Contributions, and their respective Percentage Interests are as follows:

┌─────────────────────────────────┬──────────────────────────────────┬─────────────────────┬──────────────┐
│ Member Name                     │ Address                          │ Capital Contribution│ Ownership %  │
├─────────────────────────────────┼──────────────────────────────────┼─────────────────────┼──────────────┤
│ ${blank(f.opFullName).padEnd(31)} │ ${blank(f.opAddress).padEnd(32)} │ ${fmt(f.opCapital).padEnd(19)} │ ${pct(f.opOwnershipPct).padEnd(10)}%  │
│ (Operating Partner)             │                                  │                     │              │
├─────────────────────────────────┼──────────────────────────────────┼─────────────────────┼──────────────┤
│ ${blank(f.epFullName).padEnd(31)} │ ${blank(f.epAddress).padEnd(32)} │ ${fmt(f.epCapital).padEnd(19)} │ ${pct(f.epOwnershipPct).padEnd(10)}%  │
│ (Equity Partner)                │                                  │                     │              │
├─────────────────────────────────┼──────────────────────────────────┼─────────────────────┼──────────────┤
│ TOTAL                           │                                  │ ${fmt(totalCap).padEnd(19)} │ 100%         │
└─────────────────────────────────┴──────────────────────────────────┴─────────────────────┴──────────────┘

Section 3.2 — Additional Capital Contributions.

No Member shall be required to make any additional Capital Contribution without the unanimous written consent of all Members. In the event the Company requires additional capital, the Managing Member shall issue a written capital call to all Members. Each Member shall have thirty (30) days to contribute their pro-rata share.

Section 3.3 — Failure to Contribute.

If a Member fails to make an additional Capital Contribution within thirty (30) days of a capital call:

  (a) The contributing Member(s) may advance the shortfall amount;
  (b) The advancing Member(s) shall receive interest at 12% per annum on the advanced amount;
  (c) The defaulting Member's Percentage Interest shall be diluted proportionally to reflect the additional contributions made by the advancing Member(s).

Section 3.4 — No Interest on Capital.

No Member shall be entitled to interest on their Capital Contribution except as otherwise provided in this Agreement.

Section 3.5 — Return of Capital.

No Member shall have the right to demand or receive the return of their Capital Contribution except upon dissolution and winding up of the Company or as otherwise provided herein.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ARTICLE IV — ALLOCATION OF PROFITS AND LOSSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 4.1 — Allocation of Net Profits and Net Losses.

Net Profits and Net Losses shall be allocated to the Members in proportion to their respective Percentage Interests, except as otherwise required by the special allocation provisions of this Article.

Section 4.2 — Special Allocations.

The following special allocations shall be made in the following order of priority:

  (a) Minimum Gain Chargeback. If there is a net decrease in Company minimum gain during any fiscal year, each Member shall be specially allocated items of income and gain for such year in accordance with Treasury Regulation Section 1.704-2(f).

  (b) Qualified Income Offset. Each Member who unexpectedly receives an adjustment, allocation, or distribution described in Treasury Regulation Section 1.704-1(b)(2)(ii)(d)(4), (5), or (6) shall be specially allocated items of income and gain in an amount and manner sufficient to eliminate any deficit balance in such Member's Capital Account as quickly as possible.

  (c) Section 704(c) Allocations. In accordance with Section 704(c) of the Internal Revenue Code, income, gain, loss, and deduction with respect to any property contributed to the Company shall be allocated among the Members so as to take account of any variation between the adjusted basis and fair market value of such property.

Section 4.3 — Tax Elections and Methods.

The Company shall make such tax elections as the Managing Member may determine, including elections under Section 754 of the Internal Revenue Code. The Company shall use the accrual method of accounting unless otherwise determined by the Managing Member.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   ARTICLE V — DISTRIBUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 5.1 — Distribution Waterfall.

Distributable Cash shall be distributed in the following order of priority:

  TIER 1 — PREFERRED RETURN:
  First, 100% to the Equity Partner (${blank(f.epFullName)}) until a cumulative preferred return equal to ${pct(f.preferredReturnPct)}% per annum on unreturned Capital Contribution has been paid in full and is current.

  TIER 2 — RETURN OF CAPITAL:
  Second, 100% to all Members pro-rata based on their Percentage Interests until each Member's Capital Contribution has been fully returned.

  TIER 3 — RESIDUAL SPLIT:
  Thereafter, all remaining Distributable Cash shall be distributed to the Members in accordance with their Percentage Interests:
    • Operating Partner (${blank(f.opFullName)}): ${pct(f.opOwnershipPct)}%
    • Equity Partner (${blank(f.epFullName)}): ${pct(f.epOwnershipPct)}%

Section 5.2 — Timing of Distributions.

Distributions shall be made on a ${blank(f.paymentSchedule).toLowerCase()} basis, or at such other times as the Managing Member determines there is sufficient Distributable Cash available.

Section 5.3 — Distributions Upon Capital Event.

Upon the sale, refinancing, or other capital event involving the Property, net proceeds shall be distributed in the same waterfall order as set forth in Section 5.1 after payment of all Company debts, liabilities, and closing costs.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    ARTICLE VI — MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 6.1 — Managing Member.

The Managing Member of the Company shall be ${blank(f.opFullName)} ("Operating Partner"). The Managing Member shall have full authority to manage the day-to-day operations of the Company and the Property.

Section 6.2 — Powers of Managing Member.

The Managing Member shall have the authority to:

  (a) Execute contracts and agreements on behalf of the Company in amounts not exceeding ${fmt(f.majorDecisionThreshold)};
  (b) Hire, supervise, and terminate property management companies;
  (c) Open and maintain bank accounts;
  (d) Procure and maintain insurance;
  (e) Authorize repairs, maintenance, and capital improvements within budgeted amounts;
  (f) Collect rents and manage tenant relations;
  (g) Prepare and file tax returns and financial reports;
  (h) Take all actions necessary for the ordinary operation of the Property.

Section 6.3 — Major Decisions.

The following decisions shall require the unanimous written consent of all Members:

  (a) Sale, exchange, or other disposition of the Property;
  (b) Refinancing of existing debt or incurrence of new debt;
  (c) Any single expenditure or contract exceeding ${fmt(f.majorDecisionThreshold)};
  (d) Additional capital calls;
  (e) Admission of new Members;
  (f) Amendment of this Operating Agreement;
  (g) Filing for bankruptcy or dissolution of the Company;
  (h) Any transaction between the Company and a Member or affiliate of a Member.

Section 6.4 — Asset Management Fee.

The Operating Partner shall receive an Asset Management Fee equal to ${pct(f.assetMgmtFeePct)}% of gross collected revenue, payable monthly. This fee is in addition to any distributions the Operating Partner is entitled to receive.

Section 6.5 — Fiduciary Duties.

The Managing Member owes fiduciary duties of care and loyalty to the Company and all Members. The Managing Member shall not engage in self-dealing or usurp Company opportunities. The Managing Member shall act in good faith and in the best interests of the Company.

Section 6.6 — Books and Records.

The Managing Member shall maintain complete and accurate books and records of the Company at the principal office. Each Member shall have the right to inspect such books and records during normal business hours upon reasonable notice.

Section 6.7 — Reports.

The Managing Member shall provide the following reports to all Members:
  (a) Monthly financial statements within 15 days of month-end;
  (b) Quarterly distribution reports;
  (c) Annual K-1 tax documents by March 15 of each year;
  (d) Annual property performance reports.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               ARTICLE VII — TRANSFER OF INTERESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 7.1 — Restrictions on Transfer.

No Member may sell, assign, transfer, pledge, or otherwise encumber or dispose of all or any portion of their Membership Interest without the prior written consent of all other Members, which consent may be withheld in any Member's sole discretion.

Section 7.2 — Right of First Offer.

If a Member (the "Offering Member") desires to sell all or any portion of their Membership Interest, the Offering Member must first offer such Interest to the remaining Members at fair market value. The remaining Members shall have ${blank(f.rofoDays)} days from receipt of written notice to accept the offer. If the remaining Members decline, the Offering Member may sell to a third party at no less than 95% of the offered price within 120 days.

Section 7.3 — Permitted Transfers.

Notwithstanding Section 7.1, a Member may transfer their Interest without consent to:
  (a) A revocable living trust established by the Member;
  (b) A wholly-owned entity of the Member;
  (c) An immediate family member of the Member;
provided that the transferee agrees in writing to be bound by the terms of this Agreement.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ARTICLE VIII — DISSOLUTION AND WINDING UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 8.1 — Events of Dissolution.

The Company shall be dissolved upon the occurrence of any of the following:

  (a) The unanimous vote of all Members to dissolve;
  (b) The sale or other disposition of all Company property;
  (c) The entry of a judicial decree of dissolution;
  (d) Any event that makes it unlawful to carry on the Company's business.

Section 8.2 — Winding Up.

Upon dissolution, the Managing Member (or a liquidating agent appointed by the Members) shall wind up the Company's affairs by:

  (a) Paying all debts and obligations of the Company;
  (b) Establishing reasonable reserves for contingent or unforeseen liabilities;
  (c) Distributing remaining assets to Members in accordance with the distribution waterfall set forth in Article V.

Section 8.3 — Final Accounting.

A final accounting of the Company's affairs shall be prepared and delivered to all Members within ninety (90) days of dissolution.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ARTICLE IX — DISABILITY, DEATH, BANKRUPTCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 9.1 — Disability.

If a Member becomes physically or mentally disabled and is unable to perform their duties for a continuous period of more than ${blank(f.disabilityDays)} days, the remaining Members shall have the option to purchase the disabled Member's Interest at fair market value, determined in accordance with Section 9.4.

Section 9.2 — Death.

Upon the death of a Member, the deceased Member's estate or heirs may retain the Membership Interest, subject to the terms of this Agreement, or the remaining Members may elect to purchase the Interest at fair market value within 90 days of receiving notice of death.

Section 9.3 — Bankruptcy.

If a Member files for bankruptcy or becomes insolvent, the remaining Members shall have an automatic option to purchase the bankrupt Member's Interest at fair market value minus 10%.

Section 9.4 — Valuation.

Fair market value for purposes of this Article shall be determined by:
  (a) First, mutual agreement of the Members; or
  (b) If agreement cannot be reached within 30 days, the average of two independent MAI appraisals, with each party selecting one appraiser.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                ARTICLE X — DISPUTE RESOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 10.1 — Mediation.

If the Members are unable to resolve any dispute arising under this Agreement within ${blank(f.deadlockDays)} days, the Members agree to engage an independent mediator to attempt to resolve the dispute.

Section 10.2 — Arbitration.

If mediation fails to resolve the dispute within 30 days, the dispute shall be submitted to binding arbitration under the rules of the American Arbitration Association. The arbitration shall take place in ${blank(f.stateOfFormation)}.

Section 10.3 — Attorneys' Fees.

The prevailing party in any dispute shall be entitled to recover its reasonable attorneys' fees and costs from the non-prevailing party.

Section 10.4 — Governing Law.

This Agreement shall be governed by and construed in accordance with the laws of the State of ${blank(f.stateOfFormation)}.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   ARTICLE XI — MISCELLANEOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Section 11.1 — Entire Agreement. This Agreement constitutes the entire agreement among the Members with respect to the subject matter hereof and supersedes all prior agreements and understandings.

Section 11.2 — Amendments. This Agreement may not be amended or modified except by a written instrument signed by all Members.

Section 11.3 — Severability. If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

Section 11.4 — Counterparts. This Agreement may be executed in counterparts, each of which shall be deemed an original.

Section 11.5 — Notices. All notices under this Agreement shall be in writing and delivered to the addresses set forth in Section 3.1, or to such other address as a Member may designate in writing.

Section 11.6 — Waiver. No waiver of any provision of this Agreement shall be effective unless in writing. The failure to enforce any provision shall not constitute a waiver of such provision.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        SIGNATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IN WITNESS WHEREOF, the Members have executed this Operating Agreement as of the date first written above.


OPERATING PARTNER:

________________________________________
Name:  ${blank(f.opFullName)}
Title: ${blank(f.opTitle)}
Date:  ${dateVal(f.effectiveDate)}


EQUITY PARTNER:

________________________________________
Name:  ${blank(f.epFullName)}
Title: ${blank(f.epTitle)}
Date:  ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
              CAPITAL CONTRIBUTION AGREEMENT
              ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


                 CAPITAL CONTRIBUTION AGREEMENT

This Capital Contribution Agreement ("Agreement") is entered into as of ${dateVal(f.effectiveDate)}, by and among ${blank(f.entityName)}, a ${blank(f.stateOfFormation)} limited liability company (the "Company"), and the following Members:

  1.  ${blank(f.opFullName)}, ${blank(f.opTitle)} ("Operating Partner")
  2.  ${blank(f.epFullName)}, ${blank(f.epTitle)} ("Equity Partner")


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        RECITALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHEREAS, the Company has been formed for the purpose of acquiring, owning, and operating the real property located at ${blank(f.propertyAddress)} (the "Property"), consisting of approximately ${blank(f.units)} units;

WHEREAS, the total purchase price for the Property is ${fmt(f.purchasePrice)};

WHEREAS, the Members have agreed to contribute capital to the Company in accordance with the Operating Agreement dated ${dateVal(f.effectiveDate)};

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, the parties agree as follows:


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              SECTION 1 — CAPITAL CONTRIBUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1  Schedule of Contributions.

Each Member shall contribute the following amounts to the Company:

┌─────────────────────────────────┬─────────────────────┬─────────────────────┬──────────────────┐
│ Member                          │ Contribution Amount │ Due Date            │ Payment Method   │
├─────────────────────────────────┼─────────────────────┼─────────────────────┼──────────────────┤
│ ${blank(f.opFullName).padEnd(31)} │ ${fmt(f.opCapital).padEnd(19)} │ ${dateVal(f.effectiveDate).padEnd(19)} │ Wire Transfer    │
│ (Operating Partner)             │                     │                     │                  │
├─────────────────────────────────┼─────────────────────┼─────────────────────┼──────────────────┤
│ ${blank(f.epFullName).padEnd(31)} │ ${fmt(f.epCapital).padEnd(19)} │ ${dateVal(f.effectiveDate).padEnd(19)} │ Wire Transfer    │
│ (Equity Partner)                │                     │                     │                  │
├─────────────────────────────────┼─────────────────────┼─────────────────────┼──────────────────┤
│ TOTAL                           │ ${fmt(totalCap).padEnd(19)} │                     │                  │
└─────────────────────────────────┴─────────────────────┴─────────────────────┴──────────────────┘

1.2  All contributions shall be made by wire transfer to the Company's designated bank account. Wire instructions shall be provided by the Managing Member.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 2 — DEFAULT ON CONTRIBUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1  If a Member fails to make their Capital Contribution within thirty (30) days of the due date:

  (a) Interest shall accrue on the unpaid amount at a rate of 12% per annum from the due date until paid in full;

  (b) The contributing Member(s) may elect to advance the defaulting Member's contribution and shall receive additional pro-rata interest on such advance;

  (c) The defaulting Member's Percentage Interest shall be diluted proportionally to reflect the additional contributions made by the non-defaulting Member(s), calculated as follows:

      Adjusted % = (Original Contribution ÷ Total Contributions Including Advance) × 100


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 SECTION 3 — REPRESENTATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each Member represents and warrants that:

  (a) They have the legal capacity and authority to enter into this Agreement and make the Capital Contribution set forth herein;

  (b) The funds contributed are from lawful sources;

  (c) They are not subject to any pending legal proceeding that would impair their ability to perform under this Agreement;

  (d) This Agreement does not conflict with any other agreement to which they are a party.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              SECTION 4 — USE OF CONTRIBUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1  Capital Contributions shall be used for the following purposes:

  (a) Acquisition of the Property at ${blank(f.propertyAddress)};
  (b) Closing costs, including legal fees, title insurance, and transfer taxes;
  (c) Initial operating reserves;
  (d) Any capital improvements or repairs required at acquisition;
  (e) Working capital for initial operations.

4.2  The Managing Member shall provide a detailed Use of Proceeds statement to all Members within 10 business days of closing.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 5 — RETURN OF CONTRIBUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1  Capital Contributions shall be returned to the Members in accordance with the distribution waterfall set forth in the Operating Agreement.

5.2  There is no guarantee of return of capital. Members acknowledge that real estate investments involve risk, including the potential loss of their entire Capital Contribution.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 SECTION 6 — MISCELLANEOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1  Governing Law. This Agreement shall be governed by the laws of the State of ${blank(f.stateOfFormation)}.

6.2  Amendments. This Agreement may not be amended except by a written instrument signed by all parties.

6.3  Counterparts. This Agreement may be executed in counterparts.

6.4  Entire Agreement. This Agreement, together with the Operating Agreement, constitutes the entire agreement of the parties with respect to Capital Contributions.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        SIGNATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IN WITNESS WHEREOF, the parties have executed this Capital Contribution Agreement as of the date first written above.


COMPANY: ${blank(f.entityName)}

By: ________________________________________
Name:  ${blank(f.opFullName)}
Title: ${blank(f.opTitle)}
Date:  ${dateVal(f.effectiveDate)}


OPERATING PARTNER:

________________________________________
Name:  ${blank(f.opFullName)}
Date:  ${dateVal(f.effectiveDate)}


EQUITY PARTNER:

________________________________________
Name:  ${blank(f.epFullName)}
Date:  ${dateVal(f.effectiveDate)}
`.trim();
}


// ═══════════════════════════════════════════════════════════════════════════
//  PACKAGE II — Preferred Return + Waterfall + Personal Guarantee +
//               Buy-Sell + NDA + Equity Buyback
// ═══════════════════════════════════════════════════════════════════════════

export function generatePackage2(f) {
  const totalCap = (Number(f.opCapital) || 0) + (Number(f.epCapital) || 0);

  return `
════════════════════════════════════════════════════════════════
                 PREFERRED RETURN AGREEMENT
                 ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


                  PREFERRED RETURN AGREEMENT

This Preferred Return Agreement ("Agreement") is entered into as of ${dateVal(f.effectiveDate)}, by and among:

  1. ${blank(f.entityName)}, a ${blank(f.stateOfFormation)} limited liability company (the "Company")
  2. ${blank(f.opFullName)}, ${blank(f.opTitle)} ("Operating Partner")
  3. ${blank(f.epFullName)}, ${blank(f.epTitle)} ("Equity Partner")


RECITALS

WHEREAS, the Company has been formed to acquire, own, and operate the property located at ${blank(f.propertyAddress)} (the "Property");

WHEREAS, the Equity Partner is contributing ${fmt(f.epCapital)} to the Company;

WHEREAS, the parties wish to formalize the terms of the preferred return to be paid to the Equity Partner;

NOW, THEREFORE, in consideration of the mutual covenants herein, the parties agree as follows:


SECTION 1 — DEFINITIONS

"Preferred Return" means a cumulative return of ${pct(f.preferredReturnPct)}% per annum on the Equity Partner's Unreturned Capital.

"Unreturned Capital" means the Equity Partner's original Capital Contribution (${fmt(f.epCapital)}) less any distributions received that constitute return of capital under the Operating Agreement.

"Accrual Date" means the date on which the Preferred Return begins to accrue, which is the date of this Agreement.

"Distribution Date" means the date on which distributions are made to the Members.

"Shortfall" means any amount of Preferred Return that has accrued but has not been paid as of any Distribution Date.


SECTION 2 — PREFERRED RETURN TERMS

2.1  Rate. The Preferred Return shall be ${pct(f.preferredReturnPct)}% per annum on the Equity Partner's Unreturned Capital.

2.2  Accrual. The Preferred Return shall accrue on a ${blank(f.accrualMethod).toLowerCase()} basis beginning on the Accrual Date. Any unpaid Preferred Return shall compound ${blank(f.accrualMethod).toLowerCase()} if not paid when due.

2.3  Payment. Distributions of the Preferred Return shall be made on a ${blank(f.paymentSchedule).toLowerCase()} basis, subject to availability of Distributable Cash.

2.4  Priority. The Preferred Return shall be senior to ALL other distributions, including distributions to the Operating Partner. No distributions shall be made to any other Member until the Preferred Return is current.

2.5  Catch-Up. After the Preferred Return is current, the Operating Partner shall receive distributions until they have received their pro-rata share based on their ${pct(f.opOwnershipPct)}% Percentage Interest.


SECTION 3 — DEFAULT AND REMEDIES

3.1  If the Preferred Return remains unpaid for two (2) consecutive quarters:

  (a) The Equity Partner may demand accelerated return of their entire Capital Contribution;

  (b) The Equity Partner may, at their sole discretion, appoint an independent property manager to replace the current property management, with costs borne by the Company;

  (c) The Equity Partner's Percentage Interest shall increase by 1% for each quarter the Preferred Return remains in default, up to a maximum additional 10%.


SECTION 4 — TERM

This Agreement shall remain in effect until the earlier of:
  (a) The sale or disposition of the Property;
  (b) The refinancing of the Property, to the extent the Equity Partner's capital is fully returned;
  (c) The full return of the Equity Partner's Capital Contribution plus all accrued Preferred Return;
  (d) The dissolution of the Company.


SECTION 5 — MISCELLANEOUS

5.1  Governing Law. This Agreement shall be governed by the laws of the State of ${blank(f.stateOfFormation)}.
5.2  Amendments. Amendments require written consent of all parties.
5.3  Entire Agreement. This Agreement supplements the Operating Agreement and constitutes the entire agreement regarding Preferred Return.


SIGNATURES

________________________________________
${blank(f.opFullName)}, ${blank(f.opTitle)}
Date: ${dateVal(f.effectiveDate)}

________________________________________
${blank(f.epFullName)}, ${blank(f.epTitle)}
Date: ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
              DISTRIBUTION WATERFALL SCHEDULE
              ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


              DISTRIBUTION WATERFALL SCHEDULE

Entity:    ${blank(f.entityName)}
Property:  ${blank(f.propertyAddress)}
Effective: ${dateVal(f.effectiveDate)}


TIER 1 — PREFERRED RETURN

100% of Distributable Cash to Equity Partner (${blank(f.epFullName)}) until the Preferred Return of ${pct(f.preferredReturnPct)}% per annum on Unreturned Capital (${fmt(f.epCapital)}) has been paid in full and is current.

  Annual Preferred Return Amount: ${fmt(Math.round((Number(f.epCapital) || 0) * (Number(f.preferredReturnPct) || 8) / 100))} per year
  ${blank(f.paymentSchedule)} Payment: ${fmt(Math.round((Number(f.epCapital) || 0) * (Number(f.preferredReturnPct) || 8) / 100 / (f.paymentSchedule === 'Monthly' ? 1 : 4) / (f.paymentSchedule === 'Monthly' ? 12 : 1)))} per ${f.paymentSchedule === 'Monthly' ? 'month' : 'quarter'}


TIER 2 — RETURN OF CAPITAL

100% of remaining Distributable Cash to all Members pro-rata based on Percentage Interests until each Member's Capital Contribution has been fully returned:

  • Operating Partner (${blank(f.opFullName)}): ${fmt(f.opCapital)}
  • Equity Partner (${blank(f.epFullName)}): ${fmt(f.epCapital)}
  • Total Capital to Return: ${fmt(totalCap)}


TIER 3 — RESIDUAL SPLIT

All remaining Distributable Cash split per Percentage Interests:

  • Operating Partner (${blank(f.opFullName)}): ${pct(f.opOwnershipPct)}%
  • Equity Partner (${blank(f.epFullName)}): ${pct(f.epOwnershipPct)}%


CAPITAL EVENT WATERFALL (Sale or Refinance)

Upon a capital event, net proceeds (after debt payoff, closing costs, and reserves) flow through the same tier structure:

  Step 1:  Pay outstanding Preferred Return balance → Equity Partner
  Step 2:  Return Capital Contributions → All Members pro-rata
  Step 3:  Remaining proceeds split → ${pct(f.opOwnershipPct)}% OP / ${pct(f.epOwnershipPct)}% EP


ACKNOWLEDGED BY:

________________________________________
${blank(f.opFullName)}, ${blank(f.opTitle)}
Date: ${dateVal(f.effectiveDate)}

________________________________________
${blank(f.epFullName)}, ${blank(f.epTitle)}
Date: ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
                    PERSONAL GUARANTEE
════════════════════════════════════════════════════════════════


                     PERSONAL GUARANTEE

This Personal Guarantee ("Guarantee") is made as of ${dateVal(f.effectiveDate)}, by:

  GUARANTOR:   ${blank(f.opFullName)}, individually ("Guarantor")
  BENEFICIARY: ${blank(f.epFullName)} ("Beneficiary")
  ENTITY:      ${blank(f.entityName)} (the "Company")


RECITALS

WHEREAS, the Company is acquiring the property located at ${blank(f.propertyAddress)};

WHEREAS, the Beneficiary is contributing ${fmt(f.epCapital)} in capital to the Company;

WHEREAS, the Guarantor, as Operating Partner of the Company, personally guarantees certain obligations to induce the Beneficiary's investment;

NOW, THEREFORE, in consideration of the Beneficiary's Capital Contribution, the Guarantor agrees as follows:


SECTION 1 — SCOPE OF GUARANTEE

1.1  The Guarantor personally guarantees:

  (a) Return of the Beneficiary's Capital Contribution (${fmt(f.epCapital)}) in the event of fraud, gross negligence, or willful misconduct by the Guarantor;

  (b) Payment of the Preferred Return (${pct(f.preferredReturnPct)}% per annum) for the first twenty-four (24) months following the Effective Date;

  (c) Any liability arising from the Guarantor's breach of fiduciary duties under the Operating Agreement.

1.2  This Guarantee does NOT cover:

  (a) Normal business losses resulting from market conditions, economic downturns, or changes in real estate values;

  (b) Force majeure events including natural disasters, pandemics, government actions, or acts of war;

  (c) Losses arising from events outside the Guarantor's reasonable control;

  (d) Losses caused by the Beneficiary's own actions or failures to act.


SECTION 2 — LIMITATION OF LIABILITY

2.1  The maximum aggregate liability of the Guarantor under this Guarantee shall be capped at the Beneficiary's total Capital Contribution of ${fmt(f.epCapital)}.

2.2  This Guarantee shall expire automatically upon the full return of the Beneficiary's Capital Contribution plus all accrued and paid Preferred Return.


SECTION 3 — ENFORCEMENT

3.1  The Beneficiary must provide thirty (30) days' written notice to the Guarantor before enforcing any claim under this Guarantee.

3.2  The Guarantor shall have a cure period of ${blank(f.curePeriodDays)} days from receipt of such notice to remedy the default.

3.3  If the Guarantor fails to cure within the cure period, the Beneficiary may pursue all available remedies at law or in equity.


SECTION 4 — MISCELLANEOUS

4.1  Governing Law. This Guarantee shall be governed by the laws of the State of ${blank(f.stateOfFormation)}.
4.2  Severability. If any provision is found unenforceable, the remaining provisions shall remain in effect.
4.3  Waiver of Jury Trial. Both parties waive the right to a jury trial in any action arising out of this Guarantee.


SIGNATURES

GUARANTOR (signing individually, NOT on behalf of the Company):

________________________________________
${blank(f.opFullName)}, Individually
Date: ${dateVal(f.effectiveDate)}


BENEFICIARY:

________________________________________
${blank(f.epFullName)}
Date: ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
                    BUY-SELL AGREEMENT
                    ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


                     BUY-SELL AGREEMENT

This Buy-Sell Agreement ("Agreement") is entered into as of ${dateVal(f.effectiveDate)}, by and among all Members of ${blank(f.entityName)}:

  1. ${blank(f.opFullName)}, ${blank(f.opTitle)} ("Operating Partner")
  2. ${blank(f.epFullName)}, ${blank(f.epTitle)} ("Equity Partner")


SECTION 1 — PURPOSE

This Agreement establishes an orderly mechanism for the transfer of Membership Interests upon the occurrence of certain triggering events, ensuring continuity of the Company and protection of all Members' interests.


SECTION 2 — TRIGGERING EVENTS

A "Triggering Event" shall include any of the following:

  (a) Voluntary desire by a Member to sell all or part of their Membership Interest;
  (b) Death of a Member;
  (c) Disability of a Member exceeding ${blank(f.disabilityDays)} consecutive days;
  (d) Bankruptcy or insolvency of a Member;
  (e) Material breach of the Operating Agreement by a Member that remains uncured after ${blank(f.curePeriodDays)} days' written notice;
  (f) Mutual agreement of all Members to dissolve the Company.


SECTION 3 — VALUATION METHOD

3.1  Fair Market Value ("FMV") of a Member's Interest shall be determined as follows:

  (a) First: Mutual agreement of the Members within 30 days of the Triggering Event;

  (b) Second: If agreement cannot be reached, the average of two independent MAI appraisals of the Property, with each party selecting one appraiser at their own cost;

  (c) Third: If the two appraisals differ by more than 10%, a third appraiser shall be selected by the first two appraisers, and the FMV shall be the average of the two closest values.

3.2  The FMV of a Member's Interest shall be calculated as:
     (Property FMV − All Debt − All Liabilities) × Member's Percentage Interest


SECTION 4 — RIGHT OF FIRST OFFER

4.1  Upon a Triggering Event, the selling or departing Member (the "Offering Member") must first offer their Interest to the remaining Members at FMV.

4.2  The remaining Members shall have ${blank(f.rofoDays)} days from receipt of written notice to accept the offer in writing.

4.3  If the remaining Members decline, the Offering Member may sell to a third party at no less than 95% of the FMV price within 120 days, subject to the transferee agreeing to be bound by the Operating Agreement and this Buy-Sell Agreement.


SECTION 5 — PAYMENT TERMS

5.1  Payment for the purchased Interest may be made:
  (a) In cash at closing; or
  (b) By installment over twelve (12) months with interest at the Preferred Return rate (${pct(f.preferredReturnPct)}%).

5.2  Closing shall occur within ${blank(f.closingDays)} days of acceptance.


SECTION 6 — DRAG-ALONG / TAG-ALONG RIGHTS

6.1  Drag-Along: If Members holding more than 75% of the total Percentage Interests wish to sell the entire Property, they may require the remaining Members to sell their Interests on the same terms and conditions.

6.2  Tag-Along: If any Member sells more than 50% of their Membership Interest, the remaining Members shall have the right to sell the same proportion of their Interests on the same terms and conditions.


SECTION 7 — INSURANCE

Members may maintain key-person life insurance policies to fund buy-sell obligations under this Agreement. The cost of such insurance shall be a Company expense.


SECTION 8 — MISCELLANEOUS

8.1  Governing Law: State of ${blank(f.stateOfFormation)}.
8.2  This Agreement is binding on the heirs, successors, and assigns of each Member.
8.3  Amendments require written consent of all Members.


SIGNATURES

________________________________________
${blank(f.opFullName)}, ${blank(f.opTitle)}
Date: ${dateVal(f.effectiveDate)}

________________________________________
${blank(f.epFullName)}, ${blank(f.epTitle)}
Date: ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
              NON-DISCLOSURE AGREEMENT (NDA)
              ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


             MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of ${dateVal(f.effectiveDate)}, by and between:

  1. ${blank(f.opFullName)} ("Party A")
  2. ${blank(f.epFullName)} ("Party B")

collectively referred to as the "Parties" and each a "Party," in connection with their membership in ${blank(f.entityName)} and the ownership and operation of the property located at ${blank(f.propertyAddress)}.


SECTION 1 — DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any and all information disclosed by one Party to the other, whether orally, in writing, or electronically, including but not limited to:

  (a) Financial statements, projections, and models;
  (b) Investor and partner information;
  (c) Tenant information, leases, and rent rolls;
  (d) Property management agreements and vendor contracts;
  (e) Purchase contracts and loan documents;
  (f) Business plans and operating strategies;
  (g) Proprietary underwriting and analysis;
  (h) Trade secrets and competitive intelligence;
  (i) Tax returns and capital account information.

EXCLUSIONS. Confidential Information does not include information that:

  (a) Is or becomes publicly available through no fault of the receiving Party;
  (b) Was known to the receiving Party prior to disclosure;
  (c) Is independently developed by the receiving Party without use of Confidential Information;
  (d) Is required to be disclosed by law, court order, or governmental authority (with prompt notice to the disclosing Party).


SECTION 2 — OBLIGATIONS

2.1  Each Party agrees to:

  (a) Not disclose Confidential Information to any third party without prior written consent;
  (b) Use Confidential Information only for purposes related to the Company's business;
  (c) Maintain at least the same degree of care as they use to protect their own confidential information, but in no event less than reasonable care;
  (d) Limit disclosure to their attorneys, accountants, and financial advisors who are bound by confidentiality obligations at least as restrictive as this Agreement.

2.2  Each Party shall promptly notify the other Party upon discovery of any unauthorized disclosure or use of Confidential Information.


SECTION 3 — TERM

3.1  This Agreement shall remain in effect for ${blank(f.ndaTermYears)} years from the Effective Date.

3.2  The confidentiality obligations shall survive the termination of the Operating Agreement and the dissolution of the Company.


SECTION 4 — REMEDIES

4.1  The Parties acknowledge that a breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, the non-breaching Party shall be entitled to seek injunctive relief without the requirement of posting a bond.

4.2  In addition to injunctive relief, the non-breaching Party shall be entitled to recover monetary damages for actual losses resulting from the breach.

4.3  Liquidated Damages: In the event of a material breach, the breaching Party shall pay $50,000 in liquidated damages per breach, which the Parties agree is a reasonable estimate of damages.


SECTION 5 — MISCELLANEOUS

5.1  Governing Law: State of ${blank(f.stateOfFormation)}.
5.2  Entire Agreement: This constitutes the entire agreement regarding confidentiality.
5.3  Severability: Invalid provisions shall not affect the remaining terms.
5.4  Counterparts: May be executed in counterparts.


SIGNATURES

________________________________________
${blank(f.opFullName)}
Date: ${dateVal(f.effectiveDate)}

________________________________________
${blank(f.epFullName)}
Date: ${dateVal(f.effectiveDate)}




════════════════════════════════════════════════════════════════
                 EQUITY BUYBACK AGREEMENT
                 ${blank(f.entityName)}
════════════════════════════════════════════════════════════════


                  EQUITY BUYBACK AGREEMENT

This Equity Buyback Agreement ("Agreement") is entered into as of ${dateVal(f.effectiveDate)}, by and among:

  1. ${blank(f.entityName)}, a ${blank(f.stateOfFormation)} limited liability company (the "Company")
  2. ${blank(f.opFullName)}, ${blank(f.opTitle)} ("Operating Partner")
  3. ${blank(f.epFullName)}, ${blank(f.epTitle)} ("Equity Partner")


SECTION 1 — PURPOSE

This Agreement grants the Operating Partner the right, but not the obligation, to purchase the Equity Partner's Membership Interest after a specified period, providing a clear exit mechanism for both parties.


SECTION 2 — BUYBACK OPTION

2.1  The Operating Partner may exercise the buyback option at any time after ${blank(f.buybackDeadlineMonths)} months from the Effective Date of this Agreement.

2.2  The Operating Partner must provide written notice to the Equity Partner at least ninety (90) days before the proposed buyback closing date.

2.3  The Equity Partner cannot unreasonably refuse the buyback if all conditions in Section 4 are met.


SECTION 3 — BUYBACK PRICE

3.1  The Buyback Price shall be the GREATER of:

  (a) The Equity Partner's Unreturned Capital Contribution
      PLUS all accrued and unpaid Preferred Return
      PLUS a premium equal to ${pct(f.buybackFailurePenaltyPct)}% of the Equity Partner's original Capital Contribution (${fmt(f.epCapital)});

  OR

  (b) The Fair Market Value of the Equity Partner's ${pct(f.epOwnershipPct)}% Membership Interest, determined in accordance with the Buy-Sell Agreement valuation method.

3.2  Buyback Price Calculation Example:

  Unreturned Capital:   ${fmt(f.epCapital)}
  Accrued Pref Return:  (as calculated at time of buyback)
  Premium (${pct(f.buybackFailurePenaltyPct)}%):           ${fmt(Math.round((Number(f.epCapital) || 0) * (Number(f.buybackFailurePenaltyPct) || 2) / 100))}
                        ─────────────────
  Minimum Buyback:      ${fmt(Math.round((Number(f.epCapital) || 0) * (1 + (Number(f.buybackFailurePenaltyPct) || 2) / 100)))} + accrued Preferred Return


SECTION 4 — CONDITIONS PRECEDENT

4.1  The following conditions must be satisfied before the Operating Partner may exercise the buyback:

  (a) All Preferred Returns are current and fully paid through the buyback closing date;
  (b) No material default exists under the Operating Agreement;
  (c) The Property's cash flow is sufficient to support remaining debt service after the buyback;
  (d) Refinance proceeds or available cash are sufficient to fund the Buyback Price.


SECTION 5 — PAYMENT TERMS

5.1  Preferred Method: Lump-sum payment at closing.

5.2  Alternative: If the Operating Partner cannot pay the full Buyback Price as a lump sum, an installment plan may be offered:
  • Term: twelve (12) months
  • Interest Rate: Preferred Return rate (${pct(f.preferredReturnPct)}%) plus 2% = ${pct(Number(f.preferredReturnPct || 8) + 2)}%
  • Monthly Payments of Principal and Interest
  • Secured by the Operating Partner's Membership Interest in the Company

5.3  The Equity Partner must consent to installment payment terms.


SECTION 6 — FAILURE TO EXERCISE

6.1  If the Operating Partner does not exercise the buyback option by the deadline of ${blank(f.buybackDeadlineMonths)} months from the Effective Date:

  (a) The Equity Partner's Preferred Return shall increase by ${pct(f.buybackFailurePenaltyPct)}% (from ${pct(f.preferredReturnPct)}% to ${pct(Number(f.preferredReturnPct || 8) + Number(f.buybackFailurePenaltyPct || 2))}%);

  (b) The Equity Partner may demand that the Property be listed for sale;

  (c) The Equity Partner's Percentage Interest shall increase by 1% per year beyond the deadline, up to a maximum additional 5%.


SECTION 7 — RIGHT OF FIRST REFUSAL

7.1  If the Equity Partner receives a bona fide offer from a third party to purchase their Membership Interest, the Equity Partner must provide written notice to the Operating Partner with the material terms of the offer.

7.2  The Operating Partner shall have thirty (30) days to match the third-party offer on the same terms and conditions.

7.3  If the Operating Partner declines to match, the Equity Partner may proceed with the third-party sale, subject to the transfer restrictions in the Operating Agreement.


SECTION 8 — MISCELLANEOUS

8.1  Governing Law: State of ${blank(f.stateOfFormation)}.
8.2  Entire Agreement: This Agreement, together with the Operating Agreement and Buy-Sell Agreement, constitutes the complete agreement regarding equity buyback.
8.3  Binding: This Agreement is binding on the successors, heirs, and assigns of all parties.
8.4  Amendments: Require written consent of all parties.


SIGNATURES

COMPANY: ${blank(f.entityName)}

By: ________________________________________
Name:  ${blank(f.opFullName)}
Title: ${blank(f.opTitle)}
Date:  ${dateVal(f.effectiveDate)}


OPERATING PARTNER:

________________________________________
${blank(f.opFullName)}, Individually
Date: ${dateVal(f.effectiveDate)}


EQUITY PARTNER:

________________________________________
${blank(f.epFullName)}
Date: ${dateVal(f.effectiveDate)}
`.trim();
}
