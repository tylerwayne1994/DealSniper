# V2 Underwriter - LLM Client
# Abstraction for calling OpenAI and other LLMs
import os
from typing import List, Dict
from openai import OpenAI
from . import llm_usage

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")

print("DEBUG OPENAI KEY PREFIX:", (OPENAI_API_KEY or "")[:10])

client = OpenAI(api_key=OPENAI_API_KEY)


def call_openai_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini",
    user_id: str | None = None,
    action: str = "openai_chat",
    deduct_from_balance: bool = False,
) -> str:
    """Call OpenAI chat completion API
    
    Args:
        system_prompt: System message to prepend
        messages: List of {"role": "user"|"assistant", "content": "..."}
        model: OpenAI model name
        
    Returns:
        Assistant's response text
    """
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not configured")
    
    # Build full message list with system prompt first
    full_messages = [{"role": "system", "content": system_prompt}]
    full_messages.extend(messages)
    
    response = client.chat.completions.create(
        model=model,
        messages=full_messages,
        temperature=0.7,
        max_tokens=2000
    )

    # Try to extract usage information if available and log
    prompt_tokens = None
    completion_tokens = None
    total_tokens = None
    cost_usd = None
    try:
        usage = getattr(response, 'usage', None) or response.get('usage') if isinstance(response, dict) else None
        if usage:
            prompt_tokens = usage.get('prompt_tokens') if isinstance(usage, dict) else getattr(usage, 'prompt_tokens', None)
            completion_tokens = usage.get('completion_tokens') if isinstance(usage, dict) else getattr(usage, 'completion_tokens', None)
            total_tokens = usage.get('total_tokens') if isinstance(usage, dict) else getattr(usage, 'total_tokens', None)
    except Exception:
        pass

    # Estimate cost using a simple price table (USD per 1k tokens). Can be overridden by
    # setting env var LLM_PRICE_TABLE as JSON string mapping model substring -> price_per_1k.
    try:
        price_table = {
            "gpt-4o-mini": 0.003,
            "gpt-4": 0.03,
            "gpt-3.5": 0.002,
            # fallback rate
            "default": 0.01,
        }
        env_table = os.getenv("LLM_PRICE_TABLE")
        if env_table:
            try:
                import json as _json
                parsed = _json.loads(env_table)
                if isinstance(parsed, dict):
                    price_table.update(parsed)
            except Exception:
                pass

        def _get_price_per_1k(model_name: str) -> float:
            if not model_name:
                return price_table.get("default", 0.01)
            mn = model_name.lower()
            for k, v in price_table.items():
                if k != "default" and k in mn:
                    return float(v)
            return float(price_table.get("default", 0.01))

        if total_tokens:
            price_per_1k = _get_price_per_1k(model)
            cost_usd = (int(total_tokens) / 1000.0) * float(price_per_1k)
    except Exception:
        cost_usd = None

    # Log usage record (cost_usd must be calculated externally; leave None for now)
    try:
        llm_usage.log_usage(
            user_id=user_id,
            action=action,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            metadata={"messages_count": len(messages)},
            deduct_from_balance=deduct_from_balance,
        )
    except Exception:
        pass

    return response.choices[0].message.content


# Placeholder for future Claude chat support
async def call_claude_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    model: str = "claude-3-5-sonnet-20241022"
) -> str:
    """Call Anthropic Claude chat API (placeholder for future)"""
    # Can implement later if needed
    raise NotImplementedError("Claude chat not yet implemented for v2")
