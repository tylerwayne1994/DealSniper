# Market Research Module - Perplexity API Integration
# Tier 1: Quick Market Check (sonar)
# Tier 2: Deep Market Research (sonar-deep-research)

import os
import json
import logging
import httpx
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path
from pydantic import BaseModel
from enum import Enum
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

log = logging.getLogger("market_research")

# ============================================================================
# Configuration
# ============================================================================

def get_perplexity_api_key():
    """Get API key at runtime to ensure .env is loaded"""
    return os.getenv("PERPLEXITY_API_KEY")

PERPLEXITY_BASE_URL = "https://api.perplexity.ai/chat/completions"

# Cache settings
CACHE_DAYS_QUICK = 7   # Reuse quick reports within 7 days
CACHE_DAYS_DEEP = 14   # Reuse deep reports within 14 days

# Cost estimation (per Perplexity pricing)
COST_PER_1M_INPUT_SONAR = 1.0
COST_PER_1M_OUTPUT_SONAR = 1.0
COST_PER_1M_INPUT_DEEP = 2.0
COST_PER_1M_OUTPUT_DEEP = 8.0
COST_PER_1K_SEARCH_DEEP = 5.0

# Storage directory for market research reports
MARKET_RESEARCH_DIR = Path(__file__).parent.parent / "data" / "market_research"
MARKET_RESEARCH_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# Data Models
# ============================================================================

class ResearchTier(str, Enum):
    QUICK = "quick"
    DEEP = "deep"


class KeyMetrics(BaseModel):
    population_growth_last_5y: Optional[str] = None
    population_growth_next_5y_forecast: Optional[str] = None
    job_growth_last_5y: Optional[str] = None
    rent_growth_last_5y: Optional[str] = None
    vacancy_trend: Optional[str] = None
    new_supply_pipeline_summary: Optional[str] = None
    median_income_trend: Optional[str] = None
    home_price_trend: Optional[str] = None
    crime_trend: Optional[str] = None
    population: Optional[str] = None
    population_growth_10y: Optional[str] = None
    job_growth_5y: Optional[str] = None
    top_employers: Optional[List[str]] = None
    median_income: Optional[str] = None
    rent_growth_5y: Optional[str] = None
    units_under_construction: Optional[str] = None
    regulation_summary: Optional[str] = None


class Verdict(BaseModel):
    investability: str = "Neutral"  # Strong | Neutral | Weak
    thesis: Optional[str] = None
    top_risks: List[str] = []
    recommended_hold_period_years: Optional[int] = None


class ICRecommendation(BaseModel):
    summary: Optional[str] = None
    recommended_strategy: Optional[str] = None
    recommended_hold_period_years: Optional[int] = None
    top_risks: List[str] = []
    mitigations: List[str] = []


class MarketSummary(BaseModel):
    market_name: str = ""
    time_horizon_years: int = 5
    overall_score: int = 0
    demand_score: int = 0
    supply_risk_score: int = 0
    economic_resilience_score: int = 0
    landlord_friendliness_score: int = 0
    summary_bull_case: List[str] = []
    summary_bear_case: List[str] = []
    bull_case: List[str] = []
    bear_case: List[str] = []
    key_metrics: Optional[KeyMetrics] = None
    verdict: Optional[Verdict] = None
    ic_recommendation: Optional[ICRecommendation] = None
    investability: Optional[str] = None


class MarketResearchReport(BaseModel):
    id: str
    deal_id: str
    tier: str  # "quick" | "deep"
    market_key: str
    model: str
    request_payload: Dict[str, Any] = {}
    raw_response: Optional[str] = None
    summary: Optional[MarketSummary] = None
    memo_markdown: Optional[str] = None
    score_overall: int = 0
    score_demand: int = 0
    score_supply_risk: int = 0
    score_economic_resilience: int = 0
    score_landlord_friendliness: int = 0
    run_started_at: Optional[str] = None
    run_completed_at: Optional[str] = None
    estimated_cost_usd: float = 0.0
    source_cache_key: str = ""
    created_at: str = ""
    error: Optional[str] = None


class MarketResearchRequest(BaseModel):
    tier: str = "quick"  # "quick" | "deep"
    force_refresh: bool = False


class MarketResearchStatus(BaseModel):
    deal_id: str
    market_key: str
    quick_report_exists: bool = False
    quick_report_timestamp: Optional[str] = None
    quick_report_score: Optional[int] = None
    deep_report_exists: bool = False
    deep_report_timestamp: Optional[str] = None
    deep_report_score: Optional[int] = None
    deep_report_cost: Optional[float] = None
    quick_refresh_recommended: bool = False
    deep_refresh_recommended: bool = False


# ============================================================================
# Storage Functions
# ============================================================================

def _generate_market_key(city: str, state: str, zip_code: str, property_type: str = "multifamily") -> str:
    """Generate a unique market key for caching"""
    return f"{property_type.lower()}|{city.lower()},{state.upper()}|{zip_code}"


def _generate_report_id(deal_id: str, tier: str, timestamp: str) -> str:
    """Generate unique report ID"""
    hash_input = f"{deal_id}:{tier}:{timestamp}"
    return hashlib.sha256(hash_input.encode()).hexdigest()[:16]


def _get_report_path(report_id: str) -> Path:
    return MARKET_RESEARCH_DIR / f"{report_id}.json"


def save_report(report: MarketResearchReport) -> None:
    """Save a market research report to disk"""
    path = _get_report_path(report.id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(report.model_dump(), f, indent=2, ensure_ascii=False, default=str)
    log.info(f"[MarketResearch] Saved report {report.id} for deal {report.deal_id}")


def load_report(report_id: str) -> Optional[MarketResearchReport]:
    """Load a market research report by ID"""
    path = _get_report_path(report_id)
    if not path.exists():
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return MarketResearchReport(**data)
    except Exception as e:
        log.error(f"[MarketResearch] Error loading report {report_id}: {e}")
        return None


def find_reports_for_deal(deal_id: str) -> List[MarketResearchReport]:
    """Find all reports for a specific deal"""
    reports = []
    for path in MARKET_RESEARCH_DIR.glob("*.json"):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get("deal_id") == deal_id:
                reports.append(MarketResearchReport(**data))
        except Exception as e:
            log.debug(f"[MarketResearch] Error reading {path}: {e}")
    return sorted(reports, key=lambda r: r.created_at or "", reverse=True)


def find_cached_report(market_key: str, tier: str, max_age_days: int) -> Optional[MarketResearchReport]:
    """Find a cached report for the same market within the cache window"""
    cutoff = datetime.utcnow() - timedelta(days=max_age_days)
    
    for path in MARKET_RESEARCH_DIR.glob("*.json"):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if data.get("market_key") == market_key and data.get("tier") == tier:
                created_at = data.get("created_at", "")
                if created_at:
                    try:
                        created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        if created_dt.replace(tzinfo=None) > cutoff:
                            log.info(f"[MarketResearch] Found cached {tier} report for {market_key}")
                            return MarketResearchReport(**data)
                    except:
                        pass
        except Exception as e:
            log.debug(f"[MarketResearch] Error checking cache {path}: {e}")
    
    return None


# ============================================================================
# Prompt Templates
# ============================================================================

def _build_quick_check_prompt(context: Dict[str, Any]) -> str:
    """Build the Tier 1 Quick Market Check prompt"""
    return f"""You are a multifamily investment analyst helping an investor decide if {context.get('city', 'this market')} is a good place to buy apartments.

Property Details:
- Location: {context.get('address', 'N/A')}, {context.get('city', 'N/A')}, {context.get('state', 'N/A')} {context.get('zip', 'N/A')}
- Property Type: {context.get('property_type', 'Multifamily')}
- Units: {context.get('units', 'N/A')} | Built: {context.get('year_built', 'N/A')}

Your job is to give me STRAIGHT ANSWERS about this market:

**CRITICAL QUESTION: Should I invest here or not?**

Tell me:
1. **THE VERDICT** - Is this market STRONG BUY, MAYBE, or AVOID? Why in 2-3 sentences.

2. **WHAT'S DRIVING THIS MARKET?**
   - Why are people moving here? (specific jobs, companies, lifestyle factors)
   - What's the job market like? Who's hiring? What industries?
   - Is population growing or declining? Give me numbers.

3. **RENT GROWTH & OCCUPANCY**
   - What's rent growth been? What's expected next 3-5 years? Be specific.
   - Are apartments full or empty? Vacancy rate trends?
   - Compare to state/national averages - is this market outperforming?

4. **SUPPLY RISK** (This is CRITICAL)
   - How many new apartments are being built? Is there oversupply?
   - Will new supply kill rent growth? Red flag if units under construction > 10% of existing inventory.
   - Are developers flooding this market or avoiding it?

5. **THE MONEY QUESTION**
   - Can people afford rent here? Median income vs rent costs?
   - Are wages growing fast enough to support rent increases?
   - Buy vs rent economics - is it cheaper to own or rent?

6. **RED FLAGS**
   - Landlord laws: Any rent control? Eviction restrictions? Tenant protection laws?
   - Crime trends: Getting better or worse?
   - Economic risk: Is this a one-company town? Economic diversity?
   - Any major disasters/risks: hurricanes, floods, climate issues?

7. **COMPETITIVE POSITIONING**
   - How does this compare to nearby markets?
   - Better opportunity elsewhere in the region?

8. **HOLD STRATEGY**
   - Best strategy: Buy and hold 10+ years? Flip in 3-5 years? Value-add and refinance?
   - What's the exit strategy?

**REFERENCE DATA TO USE:**
- Freddie Mac 2025 Top Markets: Oklahoma City (4.7% rent growth), New Orleans (4.4%), Chicago (3.4%), Baltimore (3.2%), SF (3.2%)
- Freddie Mac 2025 Bottom Markets (AVOID): Austin (0.5% growth, 10.4% vacancy), Nashville (1.0%, 8.7%), San Antonio (1.3%, 9.0%)
- Cushman & Wakefield Q3 2025: Check this market's net absorption, vacancy, rent levels, deliveries, and construction pipeline

Return a JSON object with this structure:
{{
  "verdict": "Strong Buy" or "Maybe" or "Avoid",
  "verdict_reason": "2-3 sentence explanation why",
  "confidence": "High" or "Medium" or "Low",
  "market_drivers": "What's making people move here - be specific about companies, jobs, lifestyle",
  "job_market": "Who's hiring, what industries, specific employers if possible",
  "population_trend": "Growing X% - give actual numbers",
  "rent_growth_historic": "X% last 5 years",
  "rent_growth_forecast": "X% expected next 3-5 years - cite source if from Freddie Mac",
  "vacancy_rate": "Current X%, trending up/down",
  "vs_competition": "How this compares to state/national average",
  "supply_pipeline": "X units under construction, X% of inventory - RED FLAG if over 10%",
  "supply_risk_level": "Low" or "Medium" or "High",
  "affordability": "Median income $X, rent burden X%, vs national average",
  "wage_growth": "Growing X% annually",
  "landlord_friendliness": "Investor-friendly" or "Neutral" or "Tenant-heavy regulations",
  "regulation_details": "Specific rent control/eviction laws if any",
  "crime_trend": "Getting better/worse/stable",
  "economic_diversity": "Diversified" or "Concentrated" - list top employers",
  "major_risks": ["Risk 1", "Risk 2", "Risk 3"],
  "competitive_markets": "Compare to nearby markets - are they better?",
  "recommended_strategy": "Buy-hold long-term, value-add flip, etc",
  "hold_period": "X years recommended",
  "bull_case": ["Reason 1", "Reason 2", "Reason 3"],
  "bear_case": ["Risk 1", "Risk 2", "Risk 3"],
  "bottom_line": "One sentence: Invest or not?"
}}

Make it CONVERSATIONAL and ACTIONABLE. No generic bs - give me real insights I can use to make a decision. Return ONLY the JSON."""


def _build_deep_research_prompt(context: Dict[str, Any]) -> str:
    """Build the Tier 2 Deep Market Research prompt"""
    hold_period = context.get('hold_period', 5)
    
    return f"""You are a VP of acquisitions at a $2B multifamily investment firm writing an investment committee memo for {context.get('city', 'this market')}.

Property Context:
- Location: {context.get('address', 'N/A')}, {context.get('city', 'N/A')}, {context.get('state', 'N/A')} {context.get('zip', 'N/A')}
- Property Type: {context.get('property_type', 'Multifamily')} 
- Units: {context.get('units', 'N/A')} | Built: {context.get('year_built', 'N/A')}
- Target Hold: {hold_period} years

**YOUR MISSION:** Write a comprehensive, data-backed market analysis that answers ONE question: **Should we deploy capital in this market?**

This needs to be DETAILED, SPECIFIC, and ACTIONABLE. No generic bullshit. Give me the real story.

## INVESTMENT COMMITTEE MEMO STRUCTURE:

### EXECUTIVE SUMMARY (3-4 paragraphs)
- **Investment Recommendation:** STRONG BUY / PROCEED WITH CAUTION / AVOID - be direct
- **Market Thesis:** Why this market works (or doesn't) for multifamily - specific drivers
- **Key Risks:** Top 3 risks that could kill this investment
- **Expected Returns Profile:** What kind of returns can we expect? Based on what assumptions?

### SECTION 1: MARKET FUNDAMENTALS - THE REAL STORY

**Demographics & Population**
- Current population: X (up/down X% over last 5-10 years)
- WHY are people moving here? Be specific: "Tesla opened factory adding 15,000 jobs" not "job growth"
- Age demographics: Are we getting young professionals or retirees? What does this mean for apartment demand?
- Household formation trends: More renters or buyers?

**Economic Engine**
- Top 10 employers with employee counts - who's driving this economy?
- Industry mix: Diversified or concentrated? (Red flag if one industry > 30% of jobs)
- Recent major announcements: New HQs, factories, expansions? Give dates and numbers.
- Wage growth: Median income $X, growing X% annually - can they afford rent increases?
- Recession resilience: What happens when economy tanks? (Healthcare/govt = stable, tech/tourism = risky)

### SECTION 2: MULTIFAMILY MARKET DYNAMICS - THE NUMBERS THAT MATTER

**Rent Growth & Occupancy (CRITICAL)**
- Historic rent growth: Last 3 years, last 5 years - give actual % numbers
- Current vacancy: X% (is this tight or loose? Compare to healthy 5% baseline)
- **CITE FREDDIE MAC 2025 if this market is in their data:** "Freddie Mac projects X% rent growth in 2025"
- Occupancy trends: Getting tighter or looser? 
- Concessions: Are landlords giving free months? (Bad sign)
- Absorption: How fast do new units lease up? Days on market?

**Supply Pipeline Analysis (MAKE OR BREAK)**
- **Current inventory:** X total units in this market
- **Under construction:** X units (this is X% of inventory - RED FLAG IF > 10%)
- **Recently delivered:** X units in last 12 months
- **Cushman & Wakefield Q3 2025 data:** Use their delivery and construction numbers if available
- **Supply risk assessment:** 
  * Low Risk: < 5% new supply vs inventory, strong absorption
  * Medium Risk: 5-10% new supply, moderate absorption  
  * **HIGH RISK:** > 10% new supply, weak absorption, concessions appearing
- Historical supply cycles: Has this market overbuilt before? When? What happened?

**Rent-to-Income Ratios**
- Median rent: $X/month
- Median household income: $X/year  
- Rent burden: X% of income (healthy is 25-30%, anything > 35% is overheated)
- Rent vs buy economics: Cost to rent vs cost to own (mortgage+taxes) - which makes more sense?

### SECTION 3: COMPETITIVE POSITIONING

**How Does This Market Stack Up?**
- Compare to 2-3 similar markets in the region
- **If in Freddie Mac Bottom 10 (Austin, Nashville, Raleigh, etc):** Flag this explicitly as oversupplied
- **If in Freddie Mac Top 10:** Highlight as favorable market
- Rent growth vs peer markets
- Cap rates: Are we paying more or less than comparable markets?

**Submarket Analysis**
- Best neighborhoods/submarkets for multifamily in this city
- Where is institutional capital flowing? 
- Any submarkets to avoid?

### SECTION 4: RISK FACTORS - WHAT COULD GO WRONG

**Regulatory & Landlord Environment** (SUPER IMPORTANT)
- Rent control: Any existing or proposed? (Automatic "proceed with caution")
- Eviction laws: How long does eviction take? How expensive?
- Tenant protections: Right-to-counsel, just cause eviction, etc.
- Property taxes: Are they stable or spiking? Any reassessment risk?
- Overall environment: Investor-friendly, neutral, or hostile?

**Crime & Safety**
- Crime rates: Trending up or down? Cite FBI data or local stats
- Neighborhood safety: Is this an A, B, C, or D neighborhood?
- Impact on investment: Will crime limit rent growth or hurt exit cap rate?

**Economic Concentration Risk**
- If > 30% of jobs in one industry: FLAG THIS
- What happens if biggest employer leaves or cuts?
- Recent layoff announcements?

**Climate & Disaster Risk**
- Hurricanes, floods, wildfires, earthquakes - what's the risk?
- Insurance costs trending up?
- Climate migration: Are people leaving due to climate?

**Overbuilding Risk**
- If supply > 10% of inventory: **RED FLAG - HIGH RISK**
- Historical overbuild cycles
- Developer activity: Slowing down or ramping up?

### SECTION 5: INVESTMENT STRATEGY & RETURNS

**Recommended Strategy**
- Core hold: Buy Class A, hold 10+ years, enjoy stable cash flow
- Value-add: Buy Class B, renovate, push rents, refinance in 3-5 years
- Opportunistic: Buy distressed, heavy lift, flip in 3-5 years
- **Given supply/demand dynamics, what strategy makes most sense?**

**Return Expectations**
- Rent growth assumption: X% annually (based on what data?)
- Expense growth: X% (usually 3-4%)
- Exit cap rate: X% (based on current Y% + market trends)
- Expected IRR: X-Y% range
- Cash-on-cash: X% stabilized

**Hold Period**
- Recommended: X years
- Rationale: Why this timeframe?
- Exit timing: When's the best time to sell?

### SECTION 6: FINAL VERDICT

**Investment Committee Recommendation**
- ✅ **STRONG BUY:** Deploy capital, great fundamentals, low risk
- ⚠️ **PROCEED WITH CAUTION:** Good market but significant risks to monitor
- ❌ **AVOID:** Fundamentals don't support investment at current pricing

**Key Risks to Monitor:**
1. [Specific risk with impact and probability]
2. [Specific risk with impact and probability]  
3. [Specific risk with impact and probability]

**Risk Mitigations:**
1. [How to reduce risk 1]
2. [How to reduce risk 2]
3. [How to reduce risk 3]

**Bottom Line:** 
One paragraph summarizing whether we should invest, why, and what returns to expect.

---

**CRITICAL REQUIREMENTS:**
- Cite sources: Freddie Mac 2025, Cushman Q3 2025, Census data, CoStar, Axiometrics, local news
- Use SPECIFIC numbers, not ranges: "3.2% rent growth" not "moderate growth"
- Be HONEST about risks - IC wants truth, not sales pitch
- Compare to benchmarks: National average rent growth is ~3%, vacancy ~5%
- **Flag Freddie Mac Bottom 10 markets explicitly if this is one**
- **Highlight Top 10 markets explicitly if this is one**

Return a JSON object:
{{
  "executive_summary": {{
    "recommendation": "Strong Buy" or "Proceed With Caution" or "Avoid",
    "confidence": "High" or "Medium" or "Low",
    "investment_thesis": "3-4 sentence summary of why invest or not",
    "key_risks": ["Risk 1", "Risk 2", "Risk 3"],
    "expected_irr_range": "X-Y%",
    "expected_coc_stabilized": "X%"
  }},
  "market_fundamentals": {{
    "population": "X with Y% growth over last 5 years",
    "why_people_move_here": "Specific reasons with companies/numbers",
    "top_employers": ["Company (X employees)", "Company 2 (Y employees)", "..."],
    "industry_concentration": "Diversified" or "Concentrated in [industry]",
    "median_income": "$X, growing Y% annually",
    "recession_resilience": "High/Medium/Low with explanation"
  }},
  "multifamily_dynamics": {{
    "rent_growth_3yr": "X%",
    "rent_growth_5yr": "X%",
    "freddie_mac_2025_forecast": "X% or 'Not in dataset'",
    "current_vacancy": "X%",
    "vacancy_trend": "Tightening/Loosening/Stable",
    "concessions_active": "Yes/No",
    "absorption_speed": "Fast/Moderate/Slow",
    "total_inventory": "X units",
    "under_construction": "X units (Y% of inventory)",
    "supply_risk": "Low/Medium/High",
    "supply_risk_explanation": "Why this risk level",
    "median_rent": "$X/month",
    "rent_burden": "X% of median income",
    "rent_vs_buy": "Rent cheaper" or "Buy cheaper"
  }},
  "competitive_position": {{
    "peer_markets": ["Market 1", "Market 2"],
    "freddie_ranking": "Top 10" or "Bottom 10" or "Not ranked",
    "relative_rent_growth": "Above/Below peer average",
    "best_submarkets": ["Submarket 1", "Submarket 2"]
  }},
  "risk_factors": {{
    "regulatory": {{
      "rent_control": "Yes/No/Proposed",
      "eviction_difficulty": "Easy/Moderate/Difficult",
      "landlord_friendliness": "High/Medium/Low",
      "specific_concerns": ["Concern 1", "Concern 2"]
    }},
    "crime_trend": "Improving/Stable/Worsening",
    "economic_concentration": "Low/Medium/High risk",
    "climate_risk": "Low/Medium/High with specifics",
    "overbuild_risk": "Low/Medium/High"
  }},
  "investment_strategy": {{
    "recommended_strategy": "Core hold" or "Value-add" or "Opportunistic",
    "strategy_rationale": "Why this strategy fits",
    "hold_period_years": X,
    "exit_timing": "When to sell and why"
  }},
  "final_verdict": {{
    "ic_recommendation": "Strong Buy" or "Proceed With Caution" or "Avoid",
    "top_risks_to_monitor": ["Risk 1", "Risk 2", "Risk 3"],
    "risk_mitigations": ["Mitigation 1", "Mitigation 2", "Mitigation 3"],
    "bottom_line": "One sentence final verdict"
  }},
  "full_memo_markdown": "The complete IC memo in markdown format with all sections, data, and citations"
}}

Return ONLY this JSON. Make the full_memo_markdown section COMPREHENSIVE - this is what the IC will read."""


# ============================================================================
# Perplexity API Client
# ============================================================================

def _estimate_cost(prompt_tokens: int, completion_tokens: int, model: str) -> float:
    """Estimate cost based on token counts"""
    if "deep" in model.lower():
        input_cost = (prompt_tokens / 1_000_000) * COST_PER_1M_INPUT_DEEP
        output_cost = (completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT_DEEP
        # Assume ~5 search queries for deep research
        search_cost = (5 / 1000) * COST_PER_1K_SEARCH_DEEP
        return input_cost + output_cost + search_cost
    else:
        input_cost = (prompt_tokens / 1_000_000) * COST_PER_1M_INPUT_SONAR
        output_cost = (completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT_SONAR
        return input_cost + output_cost


async def call_perplexity(prompt: str, model: str = "sonar") -> Dict[str, Any]:
    """Call Perplexity API with the given prompt and model"""
    api_key = get_perplexity_api_key()
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY not set in environment")
    
    log.info(f"[MarketResearch] API Key found: {api_key[:10]}...")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 8000 if "deep" in model.lower() else 4000
    }
    
    log.info(f"[MarketResearch] Calling Perplexity with model: {model}")
    
    # Deep research can take up to 5 minutes
    timeout = 300.0 if "deep" in model.lower() else 120.0
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            PERPLEXITY_BASE_URL,
            headers=headers,
            json=payload
        )
        
        log.info(f"[MarketResearch] Perplexity response status: {response.status_code}")
        
        if response.status_code != 200:
            error_text = response.text
            log.error(f"[MarketResearch] Perplexity API error: {response.status_code} - {error_text}")
            raise Exception(f"Perplexity API error: {response.status_code} - {error_text}")
        
        result = response.json()
        log.info(f"[MarketResearch] Got response with {len(result.get('choices', []))} choices")
        
        # Extract token usage for cost estimation
        usage = result.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", len(prompt) // 4)
        completion_tokens = usage.get("completion_tokens", 1000)
        
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        log.info(f"[MarketResearch] Response content length: {len(content)}")
        
        return {
            "content": content,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "model": model
        }


def _parse_json_response(content: str) -> Dict[str, Any]:
    """Parse JSON from Perplexity response, handling markdown code blocks"""
    # Remove markdown code blocks if present
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        # Remove first line (```json) and last line (```)
        content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    
    # Try to find JSON object
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to extract JSON from the content
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Could not parse JSON from response")


# ============================================================================
# Main Research Functions
# ============================================================================

async def run_quick_market_check(deal_id: str, context: Dict[str, Any], force_refresh: bool = False) -> MarketResearchReport:
    """
    Run Tier 1 Quick Market Check using Perplexity Sonar.
    Returns structured market summary with scores and bullets.
    """
    market_key = _generate_market_key(
        context.get("city", ""),
        context.get("state", ""),
        context.get("zip", ""),
        context.get("property_type", "multifamily")
    )
    
    # Check cache first
    if not force_refresh:
        cached = find_cached_report(market_key, "quick", CACHE_DAYS_QUICK)
        if cached:
            log.info(f"[MarketResearch] Using cached quick report for {market_key}")
            return cached
    
    # Generate report
    now = datetime.utcnow().isoformat()
    report_id = _generate_report_id(deal_id, "quick", now)
    
    report = MarketResearchReport(
        id=report_id,
        deal_id=deal_id,
        tier="quick",
        market_key=market_key,
        model="sonar",
        request_payload=context,
        run_started_at=now,
        source_cache_key=market_key,
        created_at=now
    )
    
    try:
        prompt = _build_quick_check_prompt(context)
        result = await call_perplexity(prompt, model="sonar")
        
        report.raw_response = result["content"]
        report.estimated_cost_usd = _estimate_cost(
            result["prompt_tokens"],
            result["completion_tokens"],
            "sonar"
        )
        
        # Parse the response
        parsed = _parse_json_response(result["content"])
        
        # Build summary
        summary = MarketSummary(
            market_name=parsed.get("market_name", f"{context.get('city', '')}, {context.get('state', '')}"),
            time_horizon_years=parsed.get("time_horizon_years", 5),
            overall_score=parsed.get("overall_score", 0),
            demand_score=parsed.get("demand_score", 0),
            supply_risk_score=parsed.get("supply_risk_score", 0),
            economic_resilience_score=parsed.get("economic_resilience_score", 0),
            landlord_friendliness_score=parsed.get("landlord_friendliness_score", 0),
            summary_bull_case=parsed.get("summary_bull_case", []),
            summary_bear_case=parsed.get("summary_bear_case", []),
            key_metrics=KeyMetrics(**parsed.get("key_metrics", {})) if parsed.get("key_metrics") else None,
            verdict=Verdict(**parsed.get("verdict", {})) if parsed.get("verdict") else None
        )
        
        report.summary = summary
        report.score_overall = summary.overall_score
        report.score_demand = summary.demand_score
        report.score_supply_risk = summary.supply_risk_score
        report.score_economic_resilience = summary.economic_resilience_score
        report.score_landlord_friendliness = summary.landlord_friendliness_score
        report.run_completed_at = datetime.utcnow().isoformat()
        
        log.info(f"[MarketResearch] Quick check complete for {market_key}, score: {summary.overall_score}")
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        log.error(f"[MarketResearch] Quick check failed: {error_msg}")
        report.error = str(e)
        report.run_completed_at = datetime.utcnow().isoformat()
    
    # Save report
    save_report(report)
    return report


async def run_deep_market_report(deal_id: str, context: Dict[str, Any], force_refresh: bool = False) -> MarketResearchReport:
    """
    Run Tier 2 Deep Market Research using Perplexity Sonar Deep Research.
    Returns structured summary + full IC memo markdown.
    """
    market_key = _generate_market_key(
        context.get("city", ""),
        context.get("state", ""),
        context.get("zip", ""),
        context.get("property_type", "multifamily")
    )
    
    # Check cache first
    if not force_refresh:
        cached = find_cached_report(market_key, "deep", CACHE_DAYS_DEEP)
        if cached:
            log.info(f"[MarketResearch] Using cached deep report for {market_key}")
            return cached
    
    # Generate report
    now = datetime.utcnow().isoformat()
    report_id = _generate_report_id(deal_id, "deep", now)
    
    report = MarketResearchReport(
        id=report_id,
        deal_id=deal_id,
        tier="deep",
        market_key=market_key,
        model="sonar-deep-research",
        request_payload=context,
        run_started_at=now,
        source_cache_key=market_key,
        created_at=now
    )
    
    try:
        prompt = _build_deep_research_prompt(context)
        result = await call_perplexity(prompt, model="sonar-deep-research")
        
        report.raw_response = result["content"]
        report.estimated_cost_usd = _estimate_cost(
            result["prompt_tokens"],
            result["completion_tokens"],
            "sonar-deep-research"
        )
        
        # Parse the response
        parsed = _parse_json_response(result["content"])
        
        # Extract summary and memo
        summary_data = parsed.get("summary", parsed)  # Fallback to root if no nested summary
        memo_markdown = parsed.get("memo_markdown", "")
        
        # Build summary
        summary = MarketSummary(
            market_name=summary_data.get("market_name", f"{context.get('city', '')}, {context.get('state', '')}"),
            overall_score=summary_data.get("overall_score", 0),
            demand_score=summary_data.get("demand_score", 0),
            supply_risk_score=summary_data.get("supply_risk_score", 0),
            economic_resilience_score=summary_data.get("economic_resilience_score", 0),
            landlord_friendliness_score=summary_data.get("landlord_friendliness_score", 0),
            investability=summary_data.get("investability", "Neutral"),
            bull_case=summary_data.get("bull_case", []),
            bear_case=summary_data.get("bear_case", []),
            key_metrics=KeyMetrics(**summary_data.get("key_metrics", {})) if summary_data.get("key_metrics") else None,
            ic_recommendation=ICRecommendation(**summary_data.get("ic_recommendation", {})) if summary_data.get("ic_recommendation") else None
        )
        
        report.summary = summary
        report.memo_markdown = memo_markdown
        report.score_overall = summary.overall_score
        report.score_demand = summary.demand_score
        report.score_supply_risk = summary.supply_risk_score
        report.score_economic_resilience = summary.economic_resilience_score
        report.score_landlord_friendliness = summary.landlord_friendliness_score
        report.run_completed_at = datetime.utcnow().isoformat()
        
        log.info(f"[MarketResearch] Deep research complete for {market_key}, score: {summary.overall_score}, cost: ${report.estimated_cost_usd:.2f}")
        
    except Exception as e:
        log.error(f"[MarketResearch] Deep research failed: {e}")
        report.error = str(e)
        report.run_completed_at = datetime.utcnow().isoformat()
    
    # Save report
    save_report(report)
    return report


def get_market_research_status(deal_id: str, context: Dict[str, Any]) -> MarketResearchStatus:
    """Get the current status of market research for a deal"""
    market_key = _generate_market_key(
        context.get("city", ""),
        context.get("state", ""),
        context.get("zip", ""),
        context.get("property_type", "multifamily")
    )
    
    reports = find_reports_for_deal(deal_id)
    
    # Find latest quick and deep reports
    quick_report = None
    deep_report = None
    
    for r in reports:
        if r.tier == "quick" and not quick_report:
            quick_report = r
        elif r.tier == "deep" and not deep_report:
            deep_report = r
    
    # Check if refresh is recommended
    now = datetime.utcnow()
    quick_refresh = True
    deep_refresh = True
    
    if quick_report and quick_report.created_at:
        try:
            created = datetime.fromisoformat(quick_report.created_at.replace('Z', '+00:00')).replace(tzinfo=None)
            quick_refresh = (now - created).days > CACHE_DAYS_QUICK
        except:
            pass
    
    if deep_report and deep_report.created_at:
        try:
            created = datetime.fromisoformat(deep_report.created_at.replace('Z', '+00:00')).replace(tzinfo=None)
            deep_refresh = (now - created).days > CACHE_DAYS_DEEP
        except:
            pass
    
    return MarketResearchStatus(
        deal_id=deal_id,
        market_key=market_key,
        quick_report_exists=quick_report is not None and quick_report.error is None,
        quick_report_timestamp=quick_report.created_at if quick_report else None,
        quick_report_score=quick_report.score_overall if quick_report else None,
        deep_report_exists=deep_report is not None and deep_report.error is None,
        deep_report_timestamp=deep_report.created_at if deep_report else None,
        deep_report_score=deep_report.score_overall if deep_report else None,
        deep_report_cost=deep_report.estimated_cost_usd if deep_report else None,
        quick_refresh_recommended=quick_refresh,
        deep_refresh_recommended=deep_refresh
    )


def extract_market_context_from_deal(deal_json: Dict[str, Any]) -> Dict[str, Any]:
    """Extract market research context from deal parsed JSON"""
    prop = deal_json.get("property", {})
    pricing = deal_json.get("pricing_financing", {})
    underwriting = deal_json.get("underwriting", {})
    
    return {
        "address": prop.get("address", ""),
        "city": prop.get("city", ""),
        "state": prop.get("state", ""),
        "zip": prop.get("zip", ""),
        "country": "USA",
        "property_type": prop.get("property_type", "Multifamily"),
        "units": prop.get("units", 0),
        "year_built": prop.get("year_built", 0),
        "hold_period": underwriting.get("holding_period", 5),
        "purchase_price": pricing.get("price", 0)
    }
