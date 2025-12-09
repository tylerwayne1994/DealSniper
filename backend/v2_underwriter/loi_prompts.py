# LOI (Letter of Intent) Generation Prompts
# Dedicated prompts for generating real estate Letters of Intent

LOI_SYSTEM_PROMPT = """You are an expert commercial real estate attorney and deal maker. Your job is to generate professional, legally-sound Letters of Intent (LOIs) for real estate acquisitions.

IMPORTANT GUIDELINES:
1. Generate a COMPLETE, ready-to-send LOI document
2. Use professional but clear language - avoid excessive legalese
3. Include all standard LOI sections and protective clauses
4. Adapt the structure and terms based on the deal type (traditional, seller financing, equity partner, etc.)
5. All financial terms should match the provided deal data exactly
6. Include appropriate contingencies for commercial real estate transactions
7. The LOI should be non-binding except for exclusivity and confidentiality provisions

OUTPUT FORMAT:
- Return the LOI as clean, formatted text
- Use proper headings and numbered sections
- Include signature blocks at the end
- Do NOT include markdown code blocks - just the raw LOI text
"""

def build_loi_prompt(deal_data: dict, buyer_info: dict) -> str:
    """Build the user prompt for LOI generation based on deal data and buyer info."""
    
    # Extract deal details
    address = deal_data.get('address', 'Property Address TBD')
    units = deal_data.get('units', 0)
    purchase_price = deal_data.get('purchasePrice', 0)
    deal_structure = deal_data.get('dealStructure', 'Traditional Bank Loan')
    
    # Day one and stabilized numbers
    day_one_cf = deal_data.get('dayOneCashFlow', 0)
    stabilized_cf = deal_data.get('stabilizedCashFlow', 0)
    refi_value = deal_data.get('refiValue', 0)
    
    # Broker/Seller info
    broker_name = deal_data.get('brokerName', '')
    broker_email = deal_data.get('brokerEmail', '')
    
    # Buyer info
    buyer_name = buyer_info.get('buyerName', '[BUYER NAME]')
    buyer_company = buyer_info.get('buyerCompany', '[BUYER COMPANY]')
    buyer_email = buyer_info.get('buyerEmail', '[BUYER EMAIL]')
    buyer_phone = buyer_info.get('buyerPhone', '[BUYER PHONE]')
    
    # Custom terms from user
    earnest_money = buyer_info.get('earnestMoney', round(purchase_price * 0.01, 0))  # Default 1%
    due_diligence_days = buyer_info.get('dueDiligenceDays', 30)
    closing_days = buyer_info.get('closingDays', 45)
    additional_terms = buyer_info.get('additionalTerms', '')
    
    # Get financing terms if available
    financing_details = deal_data.get('financingDetails', {})
    loan_amount = financing_details.get('loanAmount', 0)
    down_payment = financing_details.get('downPayment', 0)
    interest_rate = financing_details.get('interestRate', 0)
    loan_term = financing_details.get('termYears', 0)
    
    # Build structure-specific terms
    structure_specific_terms = ""
    
    if 'seller' in deal_structure.lower():
        seller_carry = financing_details.get('sellerCarryAmount', 0)
        seller_rate = financing_details.get('sellerCarryRate', 6.0)
        seller_term = financing_details.get('sellerCarryTerm', 5)
        balloon_years = financing_details.get('balloonYears', 5)
        
        structure_specific_terms = f"""
SELLER FINANCING TERMS:
- Seller Carry Amount: ${seller_carry:,.0f}
- Seller Financing Interest Rate: {seller_rate}%
- Seller Note Term: {seller_term} years
- Balloon Payment Due: Year {balloon_years}
- Seller note to be secured by second position deed of trust
"""
    
    elif 'equity' in deal_structure.lower() or 'partner' in deal_structure.lower():
        equity_partner_contribution = financing_details.get('equityPartnerContribution', 0)
        equity_split = financing_details.get('equitySplit', '70/30')
        preferred_return = financing_details.get('preferredReturn', 8)
        
        structure_specific_terms = f"""
EQUITY PARTNERSHIP TERMS (for disclosure):
- Equity Partner Contribution: ${equity_partner_contribution:,.0f}
- Equity Split: {equity_split} (Sponsor/Partner)
- Preferred Return: {preferred_return}%
- Note: Full partnership agreement to be executed separately
"""
    
    elif 'subject' in deal_structure.lower():
        existing_loan_balance = financing_details.get('existingLoanBalance', 0)
        existing_rate = financing_details.get('existingRate', 0)
        
        structure_specific_terms = f"""
SUBJECT-TO FINANCING TERMS:
- Existing Loan Balance: ${existing_loan_balance:,.0f}
- Existing Interest Rate: {existing_rate}%
- Buyer to assume payments on existing financing
- Seller to remain on note (subject-to existing financing)
- Due-on-sale clause acknowledgment required
"""
    
    prompt = f"""Generate a professional Letter of Intent for the following real estate acquisition:

PROPERTY DETAILS:
- Address: {address}
- Units/Pads: {units}
- Purchase Price: ${purchase_price:,.0f}
- Deal Structure: {deal_structure}

PROJECTED PERFORMANCE:
- Day-One Monthly Cash Flow: ${day_one_cf:,.0f}
- Stabilized Monthly Cash Flow: ${stabilized_cf:,.0f}
- Projected Refi Value: ${refi_value:,.0f}

FINANCING (if applicable):
- Loan Amount: ${loan_amount:,.0f}
- Down Payment: ${down_payment:,.0f}
- Interest Rate: {interest_rate}%
- Loan Term: {loan_term} years
{structure_specific_terms}

BUYER INFORMATION:
- Buyer Name: {buyer_name}
- Company: {buyer_company}
- Email: {buyer_email}
- Phone: {buyer_phone}

KEY TERMS:
- Earnest Money Deposit: ${earnest_money:,.0f}
- Due Diligence Period: {due_diligence_days} days
- Closing Timeline: {closing_days} days from execution

BROKER/LISTING AGENT:
- Name: {broker_name if broker_name else 'TBD'}
- Email: {broker_email if broker_email else 'TBD'}

{f"ADDITIONAL TERMS REQUESTED BY BUYER: {additional_terms}" if additional_terms else ""}

Please generate a complete, professional Letter of Intent that:
1. Is addressed appropriately (to Seller/Owner via broker if applicable)
2. Clearly states this is a non-binding LOI (except exclusivity/confidentiality)
3. Includes all standard sections (Property Description, Purchase Price, Earnest Money, Due Diligence, Closing, Contingencies, etc.)
4. Incorporates the specific deal structure terms appropriately
5. Includes standard contingencies (financing, inspection, title, environmental)
6. Has an exclusivity period clause (suggest 30 days)
7. Includes confidentiality provisions
8. Has signature blocks for both parties
9. Is professional and ready to send

Generate the complete LOI document now:"""

    return prompt


# Template for simple/traditional deals (can be used as fallback)
TRADITIONAL_LOI_TEMPLATE = """
LETTER OF INTENT

Date: {date}

To: {seller_name}
    {property_address}
    
Via: {broker_name}
     {broker_email}

Re: Letter of Intent to Purchase - {property_address}

Dear {seller_name or "Property Owner"},

{buyer_company} ("Buyer") is pleased to submit this non-binding Letter of Intent ("LOI") 
to acquire the property located at {property_address} (the "Property") on the following terms:

1. PROPERTY: {property_address}, comprising approximately {units} units/pads.

2. PURCHASE PRICE: ${purchase_price:,.0f} (USD), payable as follows:
   - Earnest Money Deposit: ${earnest_money:,.0f}
   - Balance due at closing: ${balance:,.0f}

3. EARNEST MONEY: Within five (5) business days of execution of a Purchase and Sale Agreement, 
   Buyer shall deposit ${earnest_money:,.0f} as earnest money with a mutually agreed upon 
   title company. Said deposit shall be fully refundable during the Due Diligence Period.

4. DUE DILIGENCE: Buyer shall have {due_diligence_days} days from the execution of a 
   Purchase and Sale Agreement to conduct its due diligence, including but not limited to:
   - Physical inspection of the Property
   - Review of all leases, contracts, and financial records
   - Environmental assessment
   - Title examination
   - Financing approval

5. CLOSING: Closing shall occur within {closing_days} days of the execution of a 
   Purchase and Sale Agreement, subject to satisfactory completion of due diligence.

6. CONTINGENCIES: This transaction shall be contingent upon:
   - Buyer's satisfactory completion of due diligence
   - Buyer obtaining financing on terms acceptable to Buyer
   - Clear and marketable title
   - No material adverse changes to the Property

7. EXCLUSIVITY: Seller agrees to negotiate exclusively with Buyer for a period of 
   thirty (30) days from the date of this LOI.

8. CONFIDENTIALITY: Both parties agree to keep the terms of this LOI confidential.

9. NON-BINDING: This LOI is non-binding and is intended only to set forth the general 
   terms upon which the parties may enter into a binding Purchase and Sale Agreement. 
   The only binding provisions of this LOI are the Exclusivity and Confidentiality 
   provisions set forth above.

If the foregoing terms are acceptable, please sign below and return a copy to the undersigned.

Sincerely,

{buyer_name}
{buyer_company}
{buyer_email}
{buyer_phone}

ACCEPTED AND AGREED:

_______________________________     Date: _______________
Seller Signature

_______________________________
Print Name
"""
