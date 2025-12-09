# V2 Underwriter - LLM Client
# Abstraction for calling OpenAI and other LLMs
import os
from typing import List, Dict
from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")

print("DEBUG OPENAI KEY PREFIX:", (OPENAI_API_KEY or "")[:10])

client = OpenAI(api_key=OPENAI_API_KEY)


def call_openai_chat(
    system_prompt: str,
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini"
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
