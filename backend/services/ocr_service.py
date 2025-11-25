import os
import base64
import httpx
from typing import List, Dict
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class OCRService:
    """Service for OCR extraction using Mistral Pixtral"""
    
    def __init__(self):
        self.mistral_api_url = "https://api.mistral.ai/v1/chat/completions"
        # Load API keys in __init__ to ensure dotenv is loaded first
        self.mistral_api_key = os.getenv("MISTRAL_API_KEY")
        self.llama_parse_api_key = os.getenv("LLAMA_PARSE_API_KEY")
        
        print(f"🔑 OCRService initialized")
        print(f"   Mistral API Key: {'✅ Loaded' if self.mistral_api_key else '❌ Missing'}")
        print(f"   LlamaParse API Key: {'✅ Loaded' if self.llama_parse_api_key else '❌ Missing'}")
    
    async def extract_text_from_images(self, image_data_list: List[str]) -> List[Dict]:
        """
        Extract text from PDF page images using Mistral Pixtral OCR
        
        Args:
            image_data_list: List of base64-encoded images
            
        Returns:
            List of extracted text data per page
        """
        print(f"\n{'='*60}")
        print(f"🔍 STARTING OCR EXTRACTION")
        print(f"{'='*60}")
        print(f"📄 Processing {len(image_data_list)} pages")
        
        if not self.mistral_api_key:
            print("❌ ERROR: MISTRAL_API_KEY not found in environment!")
            return [{
                "page_number": i + 1,
                "error": "MISTRAL_API_KEY not configured",
                "success": False
            } for i in range(len(image_data_list))]
        
        print(f"🔑 Using Mistral API Key: {self.mistral_api_key[:20]}...{self.mistral_api_key[-10:]}")
        
        results = []
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            for idx, image_data in enumerate(image_data_list):
                print(f"\n📄 Processing Page {idx + 1}/{len(image_data_list)}...")
                try:
                    # Aggressive extraction prompt for real estate documents
                    prompt = """YOU ARE A PROFESSIONAL REAL ESTATE ANALYST. Extract EVERY SINGLE piece of data from this document. DO NOT miss anything.

EXTRACT ALL OF THE FOLLOWING (even if not explicitly labeled):

PROPERTY DETAILS:
- Property name, address, city, state, zip code
- Property type (multifamily, RV park, etc.)
- Total units/pads, year built, square footage, lot size, parking spaces

UNIT MIX & RENT ROLL (CRITICAL - Extract every unit):
- Unit types (1BR, 2BR, 3BR, studio, etc.) 
- Number of each unit type
- Current rent for each unit type
- Market rent / proforma rent for each unit type
- Rent per square foot
- Unit square footages
- Individual unit details if available

FINANCIAL DATA (Extract ALL numbers):
- Asking price, offer price, price per unit, price per SF
- Gross scheduled income, gross potential rent
- Vacancy loss amount and percentage
- Effective gross income
- Other income (laundry, parking, storage, pet fees, utilities reimbursement)
- Total income

OPERATING EXPENSES (Extract EVERY expense line item):
- Property taxes (annual and monthly)
- Insurance (annual and monthly)  
- Water, sewer, trash
- Electricity, gas, other utilities
- Repairs & maintenance
- Management fees ($ and %)
- Administrative, legal, accounting
- Marketing & advertising
- Landscaping, snow removal
- Pest control
- HOA fees
- Payroll
- Supplies
- Capital expenditures / reserves
- Any other expense categories
- Total operating expenses

NET OPERATING INCOME:
- NOI (calculated or stated)
- Cash flow
- Debt service
- Cash on cash return
- Cap rate
- GRM (Gross Rent Multiplier)

OCCUPANCY:
- Current occupancy rate
- Economic occupancy
- Physical occupancy
- Average occupancy over time

FINANCING INFO:
- Loan amount, interest rate, loan term
- Down payment
- Debt service coverage ratio (DSCR)
- Any seller financing details

OTHER DETAILS:
- Tenant information
- Lease terms
- Amenities
- Recent renovations or capital improvements
- T-12 income/expense data if present
- Rent comparables
- Any notes or special conditions

EXTRACT EVERY NUMBER, PERCENTAGE, DOLLAR AMOUNT, AND TABLE. Return in a clear structured format with labels. If you see a table, extract every row and column."""

                    print(f"   📤 Sending request to Mistral API...")
                    # Call Mistral Pixtral for OCR
                    response = await client.post(
                        self.mistral_api_url,
                        headers={
                            "Authorization": f"Bearer {self.mistral_api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": "pixtral-12b-2409",
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": prompt
                                        },
                                        {
                                            "type": "image_url",
                                            "image_url": f"data:image/jpeg;base64,{image_data}"
                                        }
                                    ]
                                }
                            ],
                            "max_tokens": 4096
                        }
                    )
                    
                    print(f"   📥 Response status: {response.status_code}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        extracted_text = data["choices"][0]["message"]["content"]
                        print(f"   ✅ SUCCESS! Extracted {len(extracted_text)} characters")
                        print(f"\n   📝 EXTRACTED TEXT PREVIEW (first 500 chars):")
                        print(f"   {'-'*56}")
                        print(f"   {extracted_text[:500]}...")
                        print(f"   {'-'*56}")
                        
                        results.append({
                            "page_number": idx + 1,
                            "extracted_text": extracted_text,
                            "success": True
                        })
                    else:
                        error_msg = f"OCR failed with status {response.status_code}"
                        print(f"   ❌ ERROR: {error_msg}")
                        print(f"   Response body: {response.text}")
                        if response.status_code == 401:
                            print(f"   🔑 API Key used: {self.mistral_api_key}")
                            print(f"   ⚠️  401 Unauthorized - Check if API key is valid!")
                        results.append({
                            "page_number": idx + 1,
                            "error": error_msg,
                            "response_body": response.text,
                            "success": False
                        })
                        
                except Exception as e:
                    print(f"   ❌ EXCEPTION: {str(e)}")
                    results.append({
                        "page_number": idx + 1,
                        "error": str(e),
                        "success": False
                    })
        
        print(f"\n{'='*60}")
        print(f"✅ OCR EXTRACTION COMPLETE")
        print(f"{'='*60}")
        print(f"📊 Results: {sum(1 for r in results if r.get('success'))} successful, {sum(1 for r in results if not r.get('success'))} failed")
        print(f"\n")
        
        return results
    
    async def parse_extracted_data(self, extracted_texts: List[Dict]) -> Dict:
        """
        Parse the extracted text to structure it for underwriting
        TODO: Add LlamaParse or Claude for intelligent parsing
        
        Args:
            extracted_texts: List of extracted text data from OCR
            
        Returns:
            Structured data ready for underwriting
        """
        print(f"\n{'='*60}")
        print(f"🧠 STARTING DATA PARSING")
        print(f"{'='*60}")
        
        # Combine all extracted text
        combined_text = "\n\n---PAGE BREAK---\n\n".join([
            item.get("extracted_text", "") for item in extracted_texts if item.get("success") and item.get("extracted_text")
        ])
        
        print(f"📊 Total extracted text length: {len(combined_text)} characters")
        print(f"\n📝 COMBINED TEXT PREVIEW (first 1000 chars):")
        print(f"{'-'*60}")
        print(combined_text[:1000] if combined_text else "(No text extracted)")
        print(f"{'-'*60}\n")
        
        # Extract fields
        extracted_fields = self._extract_underwriting_fields(combined_text)
        
        # Basic structure for now - will enhance with LLM parsing
        structured_data = {
            "raw_text": combined_text,
            "extracted_fields": extracted_fields,
            "page_count": len(extracted_texts),
            "success": True
        }
        
        print(f"\n✅ PARSING COMPLETE")
        print(f"{'='*60}\n")
        
        return structured_data
    
    def _extract_underwriting_fields(self, text: str) -> Dict:
        """
        Extract common underwriting fields from parsed text
        This uses basic pattern matching - will be enhanced with LLM
        """
        print(f"🔍 Extracting underwriting fields...")
        
        import re
        
        fields = {
            "property_info": {},
            "financials": {},
            "unit_mix": [],
            "rent_roll": {},
            "expenses": {},
            "income": {},
            "needs_review": True
        }
        
        # Simple pattern matching for common fields
        text_lower = text.lower()
        
        # Extract asking price
        price_patterns = [
            r'asking price[:\s*]+\$?([\d,]+)',
            r'list price[:\s*]+\$?([\d,]+)',
            r'price[:\s*]+\$?([\d,]+)',
            r'\*\*asking price:\*\*\s*\$?([\d,]+)',
            r'\$([\d,]+)\s*(?:million|m)?\s*(?:asking|list)',
        ]
        for pattern in price_patterns:
            match = re.search(pattern, text_lower)
            if match:
                price_str = match.group(1).replace(',', '')
                fields["financials"]["asking_price"] = price_str
                print(f"   💰 Found asking price: ${price_str}")
                break
        
        # Extract gross income
        income_patterns = [
            r'gross income[:\s*]+\$?([\d,]+)',
            r'total income[:\s*]+\$?([\d,]+)',
            r'gross rent[:\s*]+\$?([\d,]+)',
            r'\*\*gross income:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in income_patterns:
            match = re.search(pattern, text_lower)
            if match:
                income_str = match.group(1).replace(',', '')
                fields["financials"]["gross_income"] = income_str
                print(f"   💵 Found gross income: ${income_str}")
                break
        
        # Extract units
        units_patterns = [
            r'units[:\s*]+(\d+)',
            r'(\d+)\s*units',
            r'(\d+)\s*-\s*unit',
            r'\*\*units:\*\*\s*(\d+)',
            r'unit count[:\s]+(\d+)',
        ]
        for pattern in units_patterns:
            match = re.search(pattern, text_lower)
            if match:
                units = match.group(1)
                fields["property_info"]["units"] = units
                print(f"   🏢 Found units: {units}")
                break
        
        # Extract NOI
        noi_patterns = [
            r'noi[:\s*\(net operating income\)]*[:\s*]+\$?([\d,]+)',
            r'net operating income[:\s*]+\$?([\d,]+)',
            r'\*\*noi[^:]*:\*\*\s*\$?([\d,]+)',
            r'noi[:\s]+\$([\d,]+)',
        ]
        for pattern in noi_patterns:
            match = re.search(pattern, text_lower)
            if match:
                noi_str = match.group(1).replace(',', '')
                fields["financials"]["noi"] = noi_str
                print(f"   📈 Found NOI: ${noi_str}")
                break
        
        # Extract cap rate
        cap_patterns = [
            r'cap rate[:\s*]+(\d+\.?\d*)%?',
            r'capitalization rate[:\s*]+(\d+\.?\d*)%?',
            r'\*\*cap rate:\*\*\s*(\d+\.?\d*)%?',
        ]
        for pattern in cap_patterns:
            match = re.search(pattern, text_lower)
            if match:
                cap_rate = match.group(1)
                fields["financials"]["cap_rate"] = cap_rate
                print(f"   📊 Found cap rate: {cap_rate}%")
                break
        
        # Extract property taxes
        tax_patterns = [
            r'taxes[:\s*]+\$?([\d,]+)',
            r'property tax[es]*[:\s*]+\$?([\d,]+)',
            r'\*\*taxes:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in tax_patterns:
            match = re.search(pattern, text_lower)
            if match:
                tax_str = match.group(1).replace(',', '')
                fields["expenses"]["taxes"] = tax_str
                print(f"   🏛️ Found taxes: ${tax_str}")
                break
        
        # Extract insurance
        insurance_patterns = [
            r'insurance[:\s*]+\$?([\d,]+)',
            r'\*\*insurance:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in insurance_patterns:
            match = re.search(pattern, text_lower)
            if match:
                insurance_str = match.group(1).replace(',', '')
                fields["expenses"]["insurance"] = insurance_str
                print(f"   🛡️ Found insurance: ${insurance_str}")
                break
        
        # Extract utilities
        utilities_patterns = [
            r'utilities[:\s*]+\$?([\d,]+)',
            r'\*\*utilities:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in utilities_patterns:
            match = re.search(pattern, text_lower)
            if match:
                utilities_str = match.group(1).replace(',', '')
                fields["expenses"]["utilities"] = utilities_str
                print(f"   💡 Found utilities: ${utilities_str}")
                break
        
        # Extract management fees
        mgmt_patterns = [
            r'management\s+fees?[:\s*]+\$?([\d,]+)',
            r'\*\*management fees:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in mgmt_patterns:
            match = re.search(pattern, text_lower)
            if match:
                mgmt_str = match.group(1).replace(',', '')
                fields["expenses"]["management_fees"] = mgmt_str
                print(f"   👔 Found management fees: ${mgmt_str}")
                break
        
        # Extract maintenance
        maintenance_patterns = [
            r'maintenance[:\s*]+\$?([\d,]+)',
            r'\*\*maintenance:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in maintenance_patterns:
            match = re.search(pattern, text_lower)
            if match:
                maint_str = match.group(1).replace(',', '')
                fields["expenses"]["maintenance"] = maint_str
                print(f"   🔧 Found maintenance: ${maint_str}")
                break
        
        # Extract address
        address_patterns = [
            r'address[:\s*]+([^\n]+)',
            r'\*\*address:\*\*\s*([^\n]+)',
        ]
        for pattern in address_patterns:
            match = re.search(pattern, text_lower)
            if match:
                address = match.group(1).strip()
                fields["property_info"]["address"] = address
                print(f"   🏠 Found address: {address}")
                break
        
        # Extract city
        city_patterns = [
            r'city[:\s*]+([^\n]+)',
            r'\*\*city:\*\*\s*([^\n]+)',
        ]
        for pattern in city_patterns:
            match = re.search(pattern, text_lower)
            if match:
                city = match.group(1).strip()
                fields["property_info"]["city"] = city
                print(f"   🌆 Found city: {city}")
                break
        
        # Extract state  
        state_patterns = [
            r'state[:\s*]+([A-Z]{2})',
            r'\*\*state:\*\*\s*([A-Z]{2})',
        ]
        for pattern in state_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                state = match.group(1).upper()
                fields["property_info"]["state"] = state
                print(f"   📍 Found state: {state}")
                break
        
        # Extract year built
        year_patterns = [
            r'year built[:\s*]+(\d{4})',
            r'\*\*year built:\*\*\s*(\d{4})',
        ]
        for pattern in year_patterns:
            match = re.search(pattern, text_lower)
            if match:
                year = match.group(1)
                fields["property_info"]["year_built"] = year
                print(f"   📅 Found year built: {year}")
                break
        
        # Extract square footage
        sqft_patterns = [
            r'square footage[:\s*]+(\d+,?\d*)',
            r'(\d+,?\d*)\s*sq\.?\s*ft',
            r'\*\*square footage:\*\*\s*(\d+,?\d*)',
        ]
        for pattern in sqft_patterns:
            match = re.search(pattern, text_lower)
            if match:
                sqft = match.group(1).replace(',', '')
                fields["property_info"]["sqft"] = sqft
                print(f"   📐 Found square footage: {sqft}")
                break
        
        # Extract occupancy rate
        occupancy_patterns = [
            r'occupancy[\s*rate]*[:\s*]+(\d+)%',
            r'(\d+)%\s*occupancy',
            r'\*\*occupancy rates?:\*\*\s*(\d+)%',
        ]
        for pattern in occupancy_patterns:
            match = re.search(pattern, text_lower)
            if match:
                occupancy = match.group(1)
                fields["financials"]["occupancy_rate"] = occupancy
                print(f"   🏘️ Found occupancy rate: {occupancy}%")
                break
        
        # Extract vacancy rate
        vacancy_patterns = [
            r'vacancy[\s*rate]*[:\s*]+(\d+\.?\d*)%',
            r'(\d+\.?\d*)%\s*vacancy',
        ]
        for pattern in vacancy_patterns:
            match = re.search(pattern, text_lower)
            if match:
                vacancy = match.group(1)
                fields["financials"]["vacancy_rate"] = vacancy
                print(f"   🚪 Found vacancy rate: {vacancy}%")
                break
        
        # Extract other income
        other_income_patterns = [
            r'other income[:\s*]+\$?([\d,]+)',
            r'\*\*other income:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in other_income_patterns:
            match = re.search(pattern, text_lower)
            if match:
                other_income = match.group(1).replace(',', '')
                fields["income"]["other_income"] = other_income
                print(f"   💰 Found other income: ${other_income}")
                break
        
        # Extract laundry income
        laundry_patterns = [
            r'laundry[\s*income]*[:\s*]+\$?([\d,]+)',
        ]
        for pattern in laundry_patterns:
            match = re.search(pattern, text_lower)
            if match:
                laundry = match.group(1).replace(',', '')
                fields["income"]["laundry"] = laundry
                print(f"   🧺 Found laundry income: ${laundry}")
                break
        
        # Extract parking income
        parking_patterns = [
            r'parking[\s*income]*[:\s*]+\$?([\d,]+)',
        ]
        for pattern in parking_patterns:
            match = re.search(pattern, text_lower)
            if match:
                parking = match.group(1).replace(',', '')
                fields["income"]["parking"] = parking
                print(f"   🅿️ Found parking income: ${parking}")
                break
        
        # Extract effective gross income
        egi_patterns = [
            r'effective gross income[:\s*]+\$?([\d,]+)',
            r'egi[:\s*]+\$?([\d,]+)',
        ]
        for pattern in egi_patterns:
            match = re.search(pattern, text_lower)
            if match:
                egi = match.group(1).replace(',', '')
                fields["financials"]["effective_gross_income"] = egi
                print(f"   💵 Found effective gross income: ${egi}")
                break
        
        # Extract total expenses
        total_exp_patterns = [
            r'total[\s*operating]*\s*expenses[:\s*]+\$?([\d,]+)',
            r'\*\*total[\s*operating]*\s*expenses:\*\*\s*\$?([\d,]+)',
        ]
        for pattern in total_exp_patterns:
            match = re.search(pattern, text_lower)
            if match:
                total_exp = match.group(1).replace(',', '')
                fields["expenses"]["total_expenses"] = total_exp
                print(f"   💸 Found total expenses: ${total_exp}")
                break
        
        # Extract unit mix data
        print(f"\n   🏠 Extracting unit mix...")
        unit_types_map = {
            'studio': 'Studio',
            'stu': 'Studio',
            '1br': '1BR',
            '1 br': '1BR',
            'one bedroom': '1BR',
            '1 bedroom': '1BR',
            '2br': '2BR',
            '2 br': '2BR',
            'two bedroom': '2BR',
            '2 bedroom': '2BR',
            '3br': '3BR',
            '3 br': '3BR',
            'three bedroom': '3BR',
            '3 bedroom': '3BR',
            '4br': '4BR',
            '4 br': '4BR',
            'four bedroom': '4BR',
            '4 bedroom': '4BR',
        }
        
        for unit_key, unit_display in unit_types_map.items():
            # Look for patterns like:
            # "1BR: 10 units @ $1,500" 
            # "2BR | 15 units | Current: $1,800 | Market: $2,000"
            # "3BR - 8 @ $2,200 (proforma $2,500)"
            
            # Pattern 1: Basic count and rent
            pattern1 = rf'{unit_key}[:\s*-|]+(\d+)?[\s*units]*[\s*@]*[\s*\$]?([\d,]+)?'
            matches = re.finditer(pattern1, text_lower)
            
            for match in matches:
                count = match.group(1) if match.group(1) else None
                current_rent = match.group(2).replace(',', '') if match.group(2) else None
                
                # Try to find market/proforma rent nearby
                market_rent = None
                match_pos = match.end()
                nearby_text = text_lower[match_pos:match_pos+200]  # Look ahead 200 chars
                
                # Look for market/proforma rent patterns
                market_patterns = [
                    r'market[:\s*]+\$?([\d,]+)',
                    r'proforma[:\s*]+\$?([\d,]+)',
                    r'target[:\s*]+\$?([\d,]+)',
                    r'projected[:\s*]+\$?([\d,]+)',
                    r'\([\s*]*\$?([\d,]+)[\s*]*\)',  # Rent in parentheses
                ]
                
                for mkt_pattern in market_patterns:
                    mkt_match = re.search(mkt_pattern, nearby_text)
                    if mkt_match:
                        market_rent = mkt_match.group(1).replace(',', '')
                        break
                
                unit_data = {
                    "unit_type": unit_display,
                    "count": count,
                    "current_rent": current_rent,
                    "market_rent": market_rent
                }
                
                if unit_data["count"] or unit_data["current_rent"]:
                    # Check if this unit type already exists
                    existing = next((u for u in fields["unit_mix"] if u["unit_type"] == unit_display), None)
                    if existing:
                        # Update existing entry with more complete data
                        if not existing.get("count") and count:
                            existing["count"] = count
                        if not existing.get("current_rent") and current_rent:
                            existing["current_rent"] = current_rent
                        if not existing.get("market_rent") and market_rent:
                            existing["market_rent"] = market_rent
                    else:
                        fields["unit_mix"].append(unit_data)
                    
                    print(f"      • Found {unit_display}: {count or '?'} units @ ${current_rent or '?'} current" + 
                          (f", ${market_rent} market" if market_rent else ""))
        
        # Look for general rent per unit patterns not tied to specific unit types
        rent_patterns = re.finditer(r'\$([\d,]+)\s*per\s*(unit|month)', text_lower)
        for match in rent_patterns:
            rent = match.group(1).replace(',', '')
            print(f"      • Found rent: ${rent} per {match.group(2)}")
        
        print(f"\n   ✅ Field extraction complete")
        print(f"   📋 Found {sum(len(v) for v in fields.values() if isinstance(v, dict))} fields")
        
        return fields


# Singleton instance
ocr_service = OCRService()
