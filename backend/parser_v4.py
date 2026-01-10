import os
import json
import base64
import hashlib
from typing import Dict, Any, Optional, List
from pathlib import Path
from mistralai import Mistral
from anthropic import Anthropic
from dotenv import load_dotenv
import fitz  # PyMuPDF

load_dotenv()

# API Configuration
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")

if not MISTRAL_API_KEY or not CLAUDE_API_KEY:
    raise ValueError("Both MISTRAL_API_KEY and either CLAUDE_API_KEY or ANTHROPIC_API_KEY must be set in .env file")

mistral_client = Mistral(api_key=MISTRAL_API_KEY)
anthropic_client = Anthropic(api_key=CLAUDE_API_KEY)
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

class RealEstateParser:
    """Parser for real estate offering memorandums and financial documents"""
    
    def __init__(self):
        self.mistral = mistral_client
        self.anthropic = anthropic_client
    
    def file_to_base64_url(self, file_path: str) -> str:
        """Convert file to base64 data URL"""
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        
        # Determine MIME type
        ext = Path(file_path).suffix.lower()
        mime_map = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.csv': 'text/csv',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        mime_type = mime_map.get(ext, 'application/octet-stream')
        
        # Create data URL
        b64 = base64.b64encode(file_bytes).decode('utf-8')
        return f"data:{mime_type};base64,{b64}"
    
    def extract_text_with_ocr(self, file_path: str) -> Dict[str, Any]:
        """Extract text from document using Mistral OCR"""
        try:
            # Convert file to data URL
            data_url = self.file_to_base64_url(file_path)
            
            # Call Mistral OCR
            response = self.mistral.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "document_url",
                    "document_url": data_url
                },
                include_image_base64=False
            )
            
            # Convert response to dict
            ocr_result = json.loads(response.model_dump_json())
            
            # Extract markdown text from pages
            markdown_text = ""
            if "pages" in ocr_result:
                for page in ocr_result["pages"]:
                    if isinstance(page, dict) and "markdown" in page:
                        markdown_text += page["markdown"] + "\n\n"
            
            return {
                "success": True,
                "text": markdown_text,
                "page_count": len(ocr_result.get("pages", [])),
                "raw_ocr": ocr_result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"OCR extraction failed: {str(e)}",
                "text": "",
                "page_count": 0
            }
    
    def extract_images_from_pdf(self, file_path: str, output_dir: str) -> List[Dict[str, Any]]:
        """
        Extract images from PDF using PyMuPDF (fitz)
        
        Args:
            file_path: Path to PDF file
            output_dir: Directory to save extracted images
            
        Returns:
            List of extracted image metadata
        """
        images = []
        
        try:
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Open PDF
            pdf_document = fitz.open(file_path)
            
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                image_list = page.get_images(full=True)
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = pdf_document.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        
                        # Skip very small images (likely logos/icons)
                        if len(image_bytes) < 10000:  # 10KB threshold
                            continue
                        
                        # Generate unique filename using hash
                        image_hash = hashlib.md5(image_bytes).hexdigest()[:8]
                        filename = f"page_{page_num + 1}_img_{img_index + 1}_{image_hash}.{image_ext}"
                        filepath = os.path.join(output_dir, filename)
                        
                        # Save image temporarily
                        with open(filepath, "wb") as img_file:
                            img_file.write(image_bytes)
                        
                        images.append({
                            "filename": filename,
                            "filepath": filepath,
                            "page_number": page_num + 1,
                            "image_index": img_index + 1,
                            "format": image_ext,
                            "size_bytes": len(image_bytes),
                            "hash": image_hash
                        })
                    except Exception as e:
                        print(f"Error extracting image {img_index + 1} from page {page_num + 1}: {str(e)}")
                        continue
            
            pdf_document.close()
            print(f"✅ Extracted {len(images)} images from PDF")
            
        except Exception as e:
            print(f"Error extracting images from PDF: {str(e)}")
        
        return images
    
    def parse_with_claude(self, text: str, mode: str = "underwriting") -> Dict[str, Any]:
        """Parse extracted text using Claude for comprehensive data extraction"""
        
        if mode == "underwriting":
            prompt = self._get_underwriting_prompt(text)
        else:  # PFA mode
            prompt = self._get_pfa_prompt(text)
        
        try:
            response = self.anthropic.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=8000,
                temperature=0,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract JSON from response
            response_text = response.content[0].text.strip()
            
            # Clean up JSON
            response_text = response_text.replace("```json", "").replace("```", "")
            
            # Find JSON object
            import re
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                json_str = match.group()
            else:
                json_str = response_text
            
            parsed_data = json.loads(json_str)
            
            # Post-process the data
            parsed_data = self._post_process_data(parsed_data)
            
            return {
                "success": True,
                "data": parsed_data,
                "mode": mode
            }
            
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON from Claude: {str(e)}",
                "raw_response": response_text[:1000] if 'response_text' in locals() else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Claude parsing failed: {str(e)}"
            }
    
    def _get_underwriting_prompt(self, text: str) -> str:
        """Get the underwriting analysis prompt"""
        return f"""You are an expert real estate underwriter. Extract ALL data from this offering memorandum.

DOCUMENT TEXT:
{text}

Extract and structure the following information. BE EXTREMELY THOROUGH:

1. PROPERTY DETAILS:
   - Full address, city, state, ZIP
   - Total units, year built, square footage
   - Property type and class
   - Amenities and features
   - Parking spaces

2. FINANCIAL METRICS (ENSURE ALL AMOUNTS ARE ANNUALIZED):
     - If you see MONTHLY rents or income, MULTIPLY BY 12
     - Gross Potential Rent (annual)
     - Other Income (annual)
     - Vacancy rate and amount
     - Effective Gross Income (annual)
     - Total Operating Expenses (annual)
     - Net Operating Income (annual)
         • If the OM shows multiple NOIs (Actual/T12, "Current", Pro Forma, Stabilized), you MUST separate them:
             - "Actual" / "T12" / "Current" NOI → store in pnl.noi AND pnl.noi_t12
             - "Pro Forma" / "Year 1" projected NOI → store in pnl.noi_proforma
             - "Stabilized" NOI after renovations/lease-up → store in pnl.noi_stabilized
         • NEVER put broker pro forma NOI into pnl.noi if an actual/T12 NOI is available.
         • If ONLY pro forma NOI is given and you truly cannot find actual/T12, put it in pnl.noi_proforma and ALSO copy to pnl.noi but mark pnl.noi as low confidence in the _confidence object explaining this.
     - Cap Rate
     - Price per unit
     - Price per square foot

3. EXPENSE BREAKDOWN (all annual):
   - Real Estate Taxes
   - Insurance
   - Utilities (break down if possible)
   - Repairs & Maintenance
   - Management Fees
   - Payroll/Salaries
   - Administrative
   - Marketing
   - All other expense categories

4. UNIT MIX (CRITICAL - Look for rent roll tables, unit breakdowns, or lease summaries):
   - SEARCH for tables showing unit types, counts, sizes, and rents
   - Look for sections labeled "Rent Roll", "Unit Mix", "Unit Summary", "Lease Schedule"
   - Look for "Current Rent", "In-Place Rent", "Contract Rent" vs "Market Rent", "Pro Forma Rent"
   - Extract CURRENT rents (what tenants are actually paying now) - this is the most important
   - Extract MARKET rents (what could be charged at full occupancy)
   - If only one rent figure is shown, assume it's current rent unless clearly labeled as market/pro forma
   - Unit types: Studio, 1BR, 1BR/1BA, 2BR, 2BR/2BA, 3BR, etc.
   - Square footage: average SF per unit type
   - Be thorough - multifamily deals ALWAYS have unit mix data somewhere
   - If you can't find detailed breakdown, estimate based on total units and average rents

5. FINANCING:
   - Purchase Price
   - Loan Amount
   - Down Payment
   - Interest Rate
   - Term
   - Amortization
   - Annual Debt Service
   - DSCR

6. BROKER/SELLER CONTACT INFORMATION (CRITICAL - Extract ALL contact details):
   - Look throughout the ENTIRE document for contact information
   - Check: cover page, back page, headers, footers, contact sections
   - Broker/Agent Name(s) - full names of all listed brokers or agents
   - Broker Company/Firm Name
   - Broker Phone Number(s) - include all phone numbers found
   - Broker Email Address(es) - include all emails found
   - Seller Name (if mentioned)
   - Seller Contact Info (if available)
   - Look for signatures, business cards, contact blocks
   - Extract ALL variations: mobile, office, direct line
   - If multiple brokers are listed, extract all of them
   - Common locations: "For more information contact...", "Exclusively listed by...", "Broker: ...", contact page
   - ALWAYS check the first page, last page, and any "Contact" or "Broker Information" sections

CRITICAL: FIELD-LEVEL CONFIDENCE TRACKING
For EACH field you extract, you must also track your confidence level. Include a "_confidence" object that maps field paths to confidence info:

Confidence levels:
- "high": Found clear, unambiguous data for this field
- "medium": Found data but there were multiple possible values or some ambiguity (include alternatives)
- "low": Had to estimate or infer this value
- "missing": Could not find this data anywhere in the document

Return a JSON object with this EXACT structure:
{{
  "property": {{
    "address": "",
    "city": "",
    "state": "",
    "zip": "",
    "units": 0,
    "year_built": 0,
    "rba_sqft": 0,
    "land_area_acres": 0,
    "property_type": "",
    "property_class": "",
    "parking_spaces": 0
  }},
  "pricing_financing": {{
    "price": 0,
    "price_per_unit": 0,
    "price_per_sf": 0,
    "loan_amount": 0,
    "down_payment": 0,
    "interest_rate": 0,
    "ltv": 0,
    "term_years": 0,
    "annual_debt_service": 0
  }},
    "pnl": {{
        "gross_potential_rent": 0,
        "other_income": 0,
        "vacancy_rate": 0,
        "vacancy_amount": 0,
        "vacancy_rate_t12": 0,
        "vacancy_rate_current": 0,
        "vacancy_rate_stabilized": 0,
        "effective_gross_income": 0,
        "operating_expenses": 0,
        "noi": 0,
        "noi_t12": 0,
        "noi_proforma": 0,
        "noi_stabilized": 0,
        "cap_rate": 0,
        "cap_rate_t12": 0,
        "cap_rate_proforma": 0,
        "cap_rate_stabilized": 0,
        "expense_ratio": 0,
        "expense_ratio_t12": 0,
        "expense_ratio_proforma": 0
    }},
  "expenses": {{
    "taxes": 0,
    "insurance": 0,
    "utilities": 0,
    "repairs_maintenance": 0,
    "management": 0,
    "payroll": 0,
    "admin": 0,
    "marketing": 0,
    "other": 0,
    "total": 0
  }},
  "unit_mix": [
    {{
      "type": "",
      "units": 0,
      "unit_sf": 0,
      "rent_current": 0,
      "rent_market": 0
    }}
  ],
  "underwriting": {{
    "dscr": 0,
    "cap_rate": 0,
    "cash_on_cash": 0,
    "irr": 0
  }},
  "broker_info": {{
    "broker_name": "",
    "broker_company": "",
    "broker_phone": "",
    "broker_email": "",
    "broker_phone_mobile": "",
    "broker_phone_office": "",
    "additional_contacts": [
      {{
        "name": "",
        "phone": "",
        "email": "",
        "title": ""
      }}
    ],
    "seller_name": "",
    "seller_contact": ""
  }},
    "_confidence": {{
        "property.address": {{"level": "high", "source": "Page 1 header"}},
        "property.units": {{"level": "high", "source": "Executive Summary"}},
        "property.year_built": {{"level": "missing", "note": "Not found in document"}},
        "pricing_financing.price": {{"level": "medium", "source": "Page 3", "alternatives": [2500000, 2750000], "note": "Found asking price and reduced price"}},
        "pnl.noi": {{"level": "medium", "source": "T12 income statement", "note": "Actual/T12 NOI"}},
        "pnl.noi_proforma": {{"level": "medium", "source": "Pro Forma page", "note": "Broker pro forma NOI"}},
        "pnl.noi_stabilized": {{"level": "low", "note": "Stabilized NOI after renovations/lease-up if explicitly provided"}},
        "unit_mix": {{"level": "high", "source": "Rent Roll on Page 5"}},
        "broker_info.broker_name": {{"level": "high", "source": "Contact page"}},
        "broker_info.broker_phone": {{"level": "high", "source": "Contact page"}},
        "broker_info.broker_email": {{"level": "high", "source": "Contact page"}}
    }},
  "data_quality": {{
    "overall_confidence": 0.85,
    "critical_missing": ["property.year_built"],
    "needs_review": ["pricing_financing.price", "pnl.noi"],
    "assumptions": ["Assumed 5% vacancy based on market standard"]
  }}
}}

CONFIDENCE OBJECT RULES:
1. Include an entry for EVERY important field (property.*, pricing_financing.price, pnl.noi, pnl.gross_potential_rent, expenses.*, unit_mix, broker_info.*)
2. For "medium" confidence, ALWAYS include "alternatives" array with other values you found
3. For "missing" fields, include "note" explaining what you looked for
4. "source" should reference where in the document you found the data
5. The "_confidence" object is REQUIRED - do not skip it
6. ALWAYS include confidence for broker contact fields

CRITICAL REMINDERS:
- Convert ALL monthly amounts to annual (multiply by 12)
- Fill in every field you can find data for
- Use 0 for numeric fields if not found
- Calculate ratios if you have the components
- Extract unit-level detail carefully
- THOROUGHLY search the ENTIRE document for broker/seller contact information
- Check first page, last page, headers, footers, and all contact sections for broker details
- ALWAYS include the _confidence object

Return ONLY the JSON object."""
    
    def _get_pfa_prompt(self, text: str) -> str:
        """Get the property financial analysis prompt"""
        return f"""You are a real estate analyst performing a Property Financial Analysis (PFA).

DOCUMENT TEXT:
{text}

Analyze this property and provide:

1. CURRENT PERFORMANCE METRICS
2. MARKET COMPARISON OPPORTUNITIES
3. VALUE-ADD OPPORTUNITIES
4. RISK FACTORS
5. RECOMMENDED IMPROVEMENTS

Focus on:
- Identifying below-market rents
- High expense ratios
- Deferred maintenance issues
- Market positioning
- NOI improvement potential
- Refinancing opportunities

Return a JSON object with:
{{
  "current_performance": {{
    "noi": 0,
    "cap_rate": 0,
    "occupancy": 0,
    "avg_rent": 0,
    "expense_ratio": 0
  }},
  "market_analysis": {{
    "market_rent": 0,
    "market_cap_rate": 0,
    "market_occupancy": 0,
    "rent_gap": 0,
    "competitive_position": ""
  }},
  "opportunities": [
    {{
      "type": "",
      "description": "",
      "estimated_impact": 0,
      "implementation_cost": 0,
      "payback_months": 0
    }}
  ],
  "risks": [
    {{
      "category": "",
      "description": "",
      "severity": "",
      "mitigation": ""
    }}
  ],
  "recommendations": {{
    "immediate_actions": [],
    "6_month_plan": [],
    "12_month_plan": [],
    "estimated_noi_increase": 0,
    "estimated_value_add": 0
  }},
  "scoring": {{
    "location_score": 0,
    "financial_score": 0,
    "condition_score": 0,
    "overall_score": 0,
    "investment_recommendation": ""
  }}
}}

Return ONLY the JSON object."""
    
    def _post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process and validate extracted data"""
        
        # Helper function for safe numeric conversion
        def to_number(val):
            if val is None or val == "":
                return None
            try:
                if isinstance(val, str):
                    val = val.replace(',', '').replace('$', '').replace('%', '')
                return float(val) if val else None
            except:
                return None
        
        # Process property data
        if "property" in data:
            for key in ["units", "year_built", "rba_sqft", "land_area_acres", "parking_spaces"]:
                if key in data["property"]:
                    data["property"][key] = to_number(data["property"][key])
        
        # Process financial data
        if "pricing_financing" in data:
            for key in data["pricing_financing"]:
                data["pricing_financing"][key] = to_number(data["pricing_financing"][key])
            
            # Calculate price per unit if missing
            if data["pricing_financing"].get("price") and data.get("property", {}).get("units"):
                if not data["pricing_financing"].get("price_per_unit"):
                    data["pricing_financing"]["price_per_unit"] = (
                        data["pricing_financing"]["price"] / data["property"]["units"]
                    )
        
        # Process P&L data
        if "pnl" in data:
            for key in data["pnl"]:
                data["pnl"][key] = to_number(data["pnl"][key])
            
            # Calculate NOI if missing
            egi = data["pnl"].get("effective_gross_income")
            expenses = data["pnl"].get("operating_expenses")
            if egi and expenses and not data["pnl"].get("noi"):
                data["pnl"]["noi"] = egi - expenses
            
            # Calculate cap rate if missing
            noi = data["pnl"].get("noi")
            price = data.get("pricing_financing", {}).get("price")
            if noi and price and not data["pnl"].get("cap_rate"):
                data["pnl"]["cap_rate"] = noi / price
            
            # Calculate expense ratio if missing
            if egi and expenses and not data["pnl"].get("expense_ratio"):
                data["pnl"]["expense_ratio"] = expenses / egi
        
        # Process expenses
        if "expenses" in data:
            total = 0
            for key in data["expenses"]:
                if key != "total":
                    val = to_number(data["expenses"][key])
                    data["expenses"][key] = val
                    if val:
                        total += val
            data["expenses"]["total"] = total
        
        # Process underwriting metrics
        if "underwriting" in data:
            # Calculate DSCR if missing
            noi = data.get("pnl", {}).get("noi")
            debt_service = data.get("pricing_financing", {}).get("annual_debt_service")
            if noi and debt_service and not data["underwriting"].get("dscr"):
                data["underwriting"]["dscr"] = noi / debt_service
        
        return data
    
    def parse_document(self, file_path: str, mode: str = "underwriting", 
                       output_file: Optional[str] = None) -> Dict[str, Any]:
        """Main entry point for document parsing"""
        
        print(f"Processing: {file_path}")
        print(f"Mode: {mode}")
        
        # Step 1: Extract text with OCR
        print("Extracting text with OCR...")
        ocr_result = self.extract_text_with_ocr(file_path)
        
        if not ocr_result["success"]:
            return ocr_result
        
        print(f"Extracted {ocr_result['page_count']} pages")
        
        # Step 2: Parse with Claude
        print("Parsing with Claude...")
        parse_result = self.parse_with_claude(ocr_result["text"], mode)
        
        if not parse_result["success"]:
            return parse_result
        
        # Step 3: Combine results
        final_result = {
            "success": True,
            "file": file_path,
            "mode": mode,
            "page_count": ocr_result["page_count"],
            "data": parse_result["data"]
        }
        
        # Save to file if requested
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(final_result, f, indent=2)
            print(f"Results saved to: {output_file}")
        
        return final_result


# CLI Interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Parse real estate documents")
    parser.add_argument("file", help="Path to PDF or image file")
    parser.add_argument("--mode", choices=["underwriting", "pfa"], default="underwriting",
                       help="Parsing mode: underwriting or PFA (Property Financial Analysis)")
    parser.add_argument("--output", "-o", help="Output JSON file path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Validate file exists
    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}")
        exit(1)
    
    # Initialize parser
    re_parser = RealEstateParser()
    
    # Parse document
    result = re_parser.parse_document(
        file_path=args.file,
        mode=args.mode,
        output_file=args.output
    )
    
    # Display results
    if result["success"]:
        print("\n✅ Parsing successful!")
        if args.verbose:
            print("\nExtracted Data:")
            print(json.dumps(result["data"], indent=2))
        else:
            # Show summary
            data = result["data"]
            print(f"\nProperty: {data.get('property', {}).get('address', 'N/A')}")
            print(f"Units: {data.get('property', {}).get('units', 'N/A')}")
            print(f"Price: ${data.get('pricing_financing', {}).get('price', 0):,.0f}")
            print(f"NOI: ${data.get('pnl', {}).get('noi', 0):,.0f}")
            print(f"Cap Rate: {(data.get('pnl', {}).get('cap_rate', 0) * 100):.2f}%")
    else:
        print(f"\n❌ Parsing failed: {result.get('error', 'Unknown error')}")