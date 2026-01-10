# OpenCorporates LLC Owner Lookup Integration

## Overview
DealSniper now automatically looks up LLC owners and officers using the OpenCorporates API when processing rapid fire underwriting for Reonomy exports. When a property owner is detected as an LLC (contains "LLC", "Inc", "Corp", etc.), the system queries OpenCorporates to find the company's officers and beneficial owners.

## Features

### Automatic LLC Detection
- Detects LLC/corporation names in the owner column
- Identifies indicators: LLC, Inc, Corp, LP, LLP, PLLC, Ltd, Trust, etc.
- Works with various formats (e.g., "ABC Properties LLC", "XYZ Corp.", "123 Holdings, Inc")

### OpenCorporates API Integration
- **Search**: Finds best matching company by name and jurisdiction
- **Details**: Retrieves company information and officer list
- **Officers**: Extracts names, positions, start/end dates, active status
- **Company Info**: Status, incorporation date, address, jurisdiction

### State-Based Jurisdiction Mapping
The system automatically maps US state abbreviations to OpenCorporates jurisdiction codes:
- AZ → us_az (Arizona)
- CA → us_ca (California)
- TX → us_tx (Texas)
- FL → us_fl (Florida)
- And all 50 US states + DC

### Token-Based Billing
- **Cost**: 1 token per 10 LLC lookups
- Tracks lookup count per rapid fire session
- Integrated with existing token management system

## API Configuration

### Environment Variable
Add your OpenCorporates API key to the backend environment:

```bash
OPENCORPORATES_API_KEY=your_api_key_here
```

### Getting an API Key
1. Visit [OpenCorporates API Accounts](https://opencorporates.com/api_accounts/new)
2. Free tier: 200 requests/month, 50 requests/day
3. Open data projects are free (share-alike attribution)
4. Paid plans available for commercial use

### Rate Limits
- **Free Tier**: 200/month, 50/day
- **Open Data Plan**: 10,000/day
- **Commercial Plans**: Custom limits

## Technical Implementation

### Backend Functions

#### `lookup_llc_owners(company_name, jurisdiction_code)`
Queries OpenCorporates API for company information.

**Parameters:**
- `company_name` (str): Name of the LLC/company
- `jurisdiction_code` (str): OpenCorporates jurisdiction code (default: "us")

**Returns:**
```python
{
    "success": True,
    "company": {
        "name": "ABC Properties LLC",
        "company_number": "L12345678",
        "jurisdiction": "us_az",
        "status": "Active",
        "incorporation_date": "2020-01-15",
        "company_type": "Limited Liability Company",
        "registered_address": "123 Main St, Phoenix, AZ 85001",
        "opencorporates_url": "https://opencorporates.com/companies/us_az/L12345678"
    },
    "officers": [
        {
            "name": "John Smith",
            "position": "Manager",
            "start_date": "2020-01-15",
            "end_date": null,
            "is_active": true
        }
    ],
    "officer_count": 1
}
```

#### `detect_llc_name(owner_name)`
Detects if an owner name is likely an LLC or corporation.

**Returns:** `bool` - True if name contains LLC indicators

### Database Schema

#### `deals.llc_owners` Column
- **Type**: JSONB
- **Index**: GIN index for JSON queries
- **Stores**: Full OpenCorporates response including company info and officers

**Migration:**
```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS llc_owners JSONB;
CREATE INDEX IF NOT EXISTS idx_deals_llc_owners ON deals USING gin (llc_owners);
```

### Frontend Display

#### Rapid Fire Table
- Shows owner name in Owner column
- Displays green button with officer count when LLC data found
- Click button to view company details and officer list in alert dialog
- Format: `📋 {count}` where count is number of officers

#### Alert Dialog Shows:
- LLC name
- Status (Active/Inactive/Dissolved)
- Jurisdiction
- Incorporation date
- List of officers with positions
- OpenCorporates URL link

#### Pipeline Queue
- LLC owner data stored in `parsed_data.rapidfire.llcOwners`
- Available for analysis and reporting
- Persisted to Supabase for future reference

## Usage Flow

### Rapid Fire Processing
1. User uploads Reonomy export with "Reported Owner" column
2. Backend processes each row
3. For each property:
   - Extracts owner name
   - Checks if name contains LLC indicators
   - If LLC detected:
     - Maps state to jurisdiction code
     - Calls OpenCorporates API
     - Stores result in deal object
     - Increments lookup counter
4. Frontend displays owner with LLC button if data found
5. User clicks button to view officer details

### Token Charges
- Tracked automatically during rapid fire processing
- Cost calculated: `ceil(llc_lookups_performed / 10)` tokens
- Displayed to user before processing
- Deducted after successful completion

## Caching Strategy

### Current Implementation
- No caching implemented (every LLC lookup hits API)
- Future enhancement: Cache results by company name + jurisdiction

### Recommended Caching
```python
llc_cache = {}  # In-memory cache

def lookup_llc_owners_cached(company_name, jurisdiction):
    cache_key = f"{company_name.lower()}_{jurisdiction}"
    if cache_key in llc_cache:
        log.info(f"[LLC] Cache hit for {company_name}")
        return llc_cache[cache_key]
    
    result = lookup_llc_owners(company_name, jurisdiction)
    if result.get("success"):
        llc_cache[cache_key] = result
    return result
```

## Error Handling

### API Errors
- **503 Service Unavailable**: API key not configured
- **Timeout**: 10-second timeout, returns error
- **No Results**: Returns success=False with message
- **Rate Limit**: Returns HTTP 403 (caught as API error)

### Graceful Degradation
- If API key missing: Skips LLC lookup, logs warning
- If lookup fails: Property still processed, llcOwners=null
- If timeout occurs: Continues processing remaining properties

## Performance Considerations

### API Call Timing
- Each lookup takes ~500ms-1s (2 API calls: search + details)
- For 100 properties with 50 LLCs: ~25-50 seconds added
- Consider async/parallel processing for large batches

### Optimization Ideas
1. **Batch Processing**: Group lookups by jurisdiction
2. **Parallel Requests**: Use asyncio for concurrent API calls
3. **Caching**: Store results in Redis/database
4. **Selective Lookup**: Only lookup on user request (button click)

## Testing

### Manual Test
1. Create Reonomy CSV with "Reported Owner" column
2. Add sample LLC names:
   - "ABC Properties LLC"
   - "XYZ Holdings Inc"
   - "123 Investment Corp"
3. Upload to Rapid Fire
4. Verify:
   - Green buttons appear for LLCs
   - Click button shows officer details
   - Debug shows llc_lookups_performed count

### Test Data
```csv
Address,Reported Owner,Units,Sale Amount
123 Main St Phoenix AZ 85001,ABC Properties LLC,24,2400000
456 Oak Ave Tempe AZ 85281,John Smith,12,1200000
789 Elm Rd Scottsdale AZ 85251,XYZ Holdings Inc,36,4800000
```

Expected: 2 LLC lookups (ABC Properties LLC, XYZ Holdings Inc)

## API Documentation

### OpenCorporates API v0.4.8
- **Base URL**: https://api.opencorporates.com/v0.4
- **Auth**: API token in query params (`?api_token=xxx`)
- **Format**: JSON (default) or XML
- **Docs**: https://api.opencorporates.com/documentation/API-Reference

### Endpoints Used

#### Company Search
```
GET /companies/search?q={name}&jurisdiction_code={code}&api_token={key}
```
Returns matching companies with scores

#### Company Details
```
GET /companies/{jurisdiction}/{number}?api_token={key}
```
Returns full company info including officers

### Response Fields
- `name`: Legal company name
- `company_number`: Unique identifier
- `jurisdiction_code`: e.g., "us_az"
- `current_status`: Active/Dissolved/etc
- `incorporation_date`: YYYY-MM-DD
- `company_type`: LLC/Corporation/etc
- `officers`: Array of officer objects
- `opencorporates_url`: Direct link to company page

## Future Enhancements

### Phase 2 Features
1. **Pipeline UI**: Add LLC lookup button to pipeline queue
2. **Beneficial Owners**: Extract ultimate beneficial ownership chains
3. **Caching**: Implement Redis cache for repeated lookups
4. **Batch Mode**: Process all LLCs in one click
5. **Reports**: Generate ownership reports for due diligence
6. **Alerts**: Flag properties with concerning ownership patterns

### Advanced Features
1. **Ownership Networks**: Map relationships between companies
2. **Risk Scoring**: Analyze ownership structure complexity
3. **Historical Data**: Track officer changes over time
4. **Litigation Search**: Cross-reference with court records
5. **Compliance Check**: Verify good standing status

## Troubleshooting

### No LLC Data Appearing
1. Check `OPENCORPORATES_API_KEY` environment variable is set
2. Verify owner column has LLC indicators (LLC, Inc, Corp)
3. Check backend logs for API errors
4. Confirm rate limits not exceeded (50/day free tier)

### Incorrect Company Match
- OpenCorporates uses fuzzy search (best match by score)
- Common issue: Multiple companies with similar names
- Solution: Use more specific company names in data

### Slow Performance
- Each lookup takes ~1 second
- For 100 LLCs: ~100 seconds processing time
- Consider implementing caching or async processing

## Support

### OpenCorporates Support
- Email: api@opencorporates.com
- Forum: https://discuss.opencorporates.com/
- Status: https://status.opencorporates.com/

### DealSniper Issues
- Check backend logs: `backend/logs/`
- Enable debug mode for detailed API calls
- Review debug output in rapid fire response

## License & Attribution

### OpenCorporates Data
- **License**: Open Database License (ODbL)
- **Attribution Required**: "Data from OpenCorporates"
- **Share-Alike**: Derivative databases must use same license
- **Free for Open Data**: Commercial use requires paid plan

### DealSniper Integration
- OpenCorporates API integration code: MIT License
- Must comply with OpenCorporates terms of use
- Attribution to OpenCorporates required in UI/reports
