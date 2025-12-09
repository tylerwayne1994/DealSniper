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
    return f"""You are an institutional multifamily market analyst. Given the following context, provide a concise, structured assessment of this market for multifamily investment over the next 5–10 years.

Context:
- Property: {context.get('address', 'N/A')}, {context.get('city', 'N/A')}, {context.get('state', 'N/A')} {context.get('zip', 'N/A')}, {context.get('country', 'USA')}
- Property type: {context.get('property_type', 'Multifamily')}
- Units: {context.get('units', 'N/A')}, Year built: {context.get('year_built', 'N/A')}

Focus specifically on:
1. Population growth trends
2. Job and wage growth
3. Rent growth and occupancy
4. Supply pipeline and new construction
5. Economic diversity and key employers
6. Crime and safety trends
7. Landlord-friendliness/regulatory climate (rent control, eviction restrictions)

Output a single JSON object with this exact structure:
{{
  "market_name": "",
  "time_horizon_years": 5,
  "overall_score": 0,
  "demand_score": 0,
  "supply_risk_score": 0,
  "economic_resilience_score": 0,
  "landlord_friendliness_score": 0,
  "summary_bull_case": [],
  "summary_bear_case": [],
  "key_metrics": {{
    "population_growth_last_5y": "",
    "population_growth_next_5y_forecast": "",
    "job_growth_last_5y": "",
    "rent_growth_last_5y": "",
    "vacancy_trend": "",
    "new_supply_pipeline_summary": "",
    "median_income_trend": "",
    "home_price_trend": "",
    "crime_trend": ""
  }},
  "verdict": {{
    "investability": "Strong",
    "thesis": "",
    "top_risks": [],
    "recommended_hold_period_years": 0
  }}
}}

Use plain numbers or short phrases for metrics (no long paragraphs), and keep arrays as short bullet-point strings. Scores should be 0-100 where higher is better (except supply_risk where higher means MORE risk). Return ONLY the JSON."""


def _build_deep_research_prompt(context: Dict[str, Any]) -> str:
    """Build the Tier 2 Deep Market Research prompt"""
    hold_period = context.get('hold_period', 5)
    
    return f"""You are a senior market research VP at a billion-dollar multifamily investment firm. Produce a deep, source-backed market analysis for the following location and property type, suitable for an investment committee memo.

Context:
- Property: {context.get('address', 'N/A')}, {context.get('city', 'N/A')}, {context.get('state', 'N/A')} {context.get('zip', 'N/A')}, {context.get('country', 'USA')}
- Property type: {context.get('property_type', 'Multifamily')} (assume institutional-quality multifamily unless otherwise stated)
- Target hold period: {hold_period} years

Your analysis must cover:

1. **Demographics & Population**
   - Population level and 5–10 year growth trends (historical + forecast)
   - Age distribution, household formation

2. **Employment & Economy**
   - Job growth trends
   - Major employers and industry mix
   - Economic diversification vs concentration risk

3. **Income, Affordability & Housing**
   - Median household income trend
   - Rent levels vs income (rent-to-income ratios)
   - Home price trends and rent vs buy economics

4. **Multifamily Fundamentals**
   - Rent growth and occupancy trends
   - New supply pipeline (deliveries, units under construction)
   - Absorption, concessions, lease-up risk

5. **Risk Factors**
   - Crime trends and neighborhood risk
   - Regulatory/landlord-friendliness (rent control, eviction rules, tenant protections)
   - Weather/climate risks, environmental risks if material

6. **Comparable / Peer Market Positioning**
   - How this market compares to other nearby or tier-similar markets

7. **Forward-Looking Thesis**
   - 5–10 year outlook for multifamily investments
   - Bull case, base case, bear case

Use recent, high-quality, citable sources and provide references.

Output needs two layers:

1. A structured JSON summary:
{{
  "market_name": "",
  "overall_score": 0,
  "demand_score": 0,
  "supply_risk_score": 0,
  "economic_resilience_score": 0,
  "landlord_friendliness_score": 0,
  "investability": "Strong",
  "bull_case": [],
  "bear_case": [],
  "key_metrics": {{
    "population": "",
    "population_growth_10y": "",
    "job_growth_5y": "",
    "top_employers": [],
    "median_income": "",
    "rent_growth_5y": "",
    "vacancy_trend": "",
    "units_under_construction": "",
    "crime_trend": "",
    "regulation_summary": ""
  }},
  "ic_recommendation": {{
    "summary": "",
    "recommended_strategy": "",
    "recommended_hold_period_years": 0,
    "top_risks": [],
    "mitigations": []
  }}
}}

2. A human-readable, multi-section narrative memo (Markdown) that elaborates on all of the above with citations.

Return a single JSON object:
{{
  "summary": {{ ...the summary JSON above... }},
  "memo_markdown": "...."
}}

Return ONLY this JSON object."""


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
