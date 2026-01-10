# Rapid Fire AI Upgrade Plan

## Overview
Transform rapid fire from basic math to intelligent AI partner using Claude Haiku.

## Current Problem
- Rejects all 96 properties because no NOI data exists
- Cannot make logical assumptions
- No reasoning provided for decisions

## Solution: AI-Powered Analysis

### Cost Structure
- **150 properties = 1 token** from user balance
- **Actual LLM cost**: ~$0.08 per 150 properties (Claude Haiku)
- **Profit margin**: Excellent (1 token = $1, cost = $0.08)

### What AI Will Do
For each property with limited data (address, units, sqft, sale price, mortgage):

1. **Estimate Market Rent** using FMR data by ZIP code
2. **Calculate Realistic NOI** using market-based assumptions
3. **Analyze Financing** (mortgage vs price = equity position)
4. **Estimate Cap Rate** for that specific market
5. **Make Verdict** with confidence and reasoning
6. **Explain Decision** in plain English

### Implementation Steps

#### Backend Changes
1. Add new endpoint: `/v2/rapid-fire/ai-underwrite`
2. Use Claude Haiku-3 for analysis (cheap + fast)
3. Batch analyze properties with market context
4. Return verdict + reasoning + confidence

#### Frontend Changes
1. Check token balance before running
2. Show "This will cost 1 token" warning
3. Deduct token after results load successfully
4. Display AI reasoning in table

#### Token Deduction Flow
```
User clicks "Run Rapid Fire" 
→ Frontend checks token balance
→ If balance >= 1, proceed
→ Backend analyzes with AI
→ Results returned
→ Frontend deducts 1 token via API
→ Show results with AI reasoning
```

### Example AI Analysis

**Input:**
```
Address: 8225 e indian bend rd, scottsdale, AZ
Units: 159
Sale Amount: $9,000,000
Sqft: 175,659
Mortgage: $29,931,675
ZIP: 85250
```

**AI Output:**
```json
{
  "verdict": "DEAL",
  "confidence": "high",
  "estimatedRent": 1650,
  "estimatedNOI": 1890000,
  "estimatedCapRate": 7.8,
  "dscr": 1.42,
  "cashOnCash": 11.3,
  "reasoning": "Strong equity position with existing $30M mortgage indicating property was appraised higher. Scottsdale market supports $1,650/unit rent based on FMR data. At 7.8% cap rate with 1.42 DSCR, this deal passes all thresholds."
}
```

### Database Schema
No changes needed - reasoning stored in frontend state only.

### Testing Plan
1. Test with sample 10-property file
2. Verify token deduction
3. Check AI reasoning quality
4. Validate cost calculations

## Next Steps
1. Build backend AI analysis function
2. Add token check + deduction to frontend
3. Update UI to show AI reasoning
4. Test with real Reonomy data

