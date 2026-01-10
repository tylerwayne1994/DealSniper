# V2 Underwriter - Data Models
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
import uuid


class DealV2(BaseModel):
    """V2 Deal model with chat support"""
    id: str
    created_at: str
    updated_at: str
    original_filename: str
    parser_strategy: str = "claude_ocr"
    
    # Quick summary fields
    summary_address: Optional[str] = None
    summary_units: Optional[int] = None
    summary_price: Optional[float] = None
    summary_noi: Optional[float] = None
    summary_cap_rate: Optional[float] = None
    
    # Full parsed JSON from RealEstateParser
    parsed_json: Dict[str, Any]

    # Optional scenario JSON reflecting user-edited wizard values
    # If present, this should be used for AI underwriting instead of
    # the original parsed_json so analysis matches what the user sees
    # in the DealSniper wizard/results.
    scenario_json: Optional[Dict[str, Any]] = None
    
    # Optional chat history
    chat_history: list = []
    
    @staticmethod
    def create_new(parsed_json: Dict[str, Any], original_filename: str) -> "DealV2":
        """Factory method to create a new deal"""
        now = datetime.utcnow().isoformat()
        
        # Extract summary fields from parsed JSON
        prop = parsed_json.get("property", {})
        pricing = parsed_json.get("pricing_financing", {})
        pnl = parsed_json.get("pnl", {})
        
        address = prop.get("address", "")
        if prop.get("city"):
            address += f", {prop.get('city')}"
        if prop.get("state"):
            address += f", {prop.get('state')}"
        
        return DealV2(
            id=str(uuid.uuid4()),
            created_at=now,
            updated_at=now,
            original_filename=original_filename,
            summary_address=address or None,
            summary_units=prop.get("units"),
            summary_price=pricing.get("price"),
            summary_noi=pnl.get("noi"),
            summary_cap_rate=pnl.get("cap_rate"),
            parsed_json=parsed_json,
            scenario_json=None,
            chat_history=[]
        )


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    """Request body for chat endpoint"""
    messages: list[ChatMessage]
    llm: str = "openai"
    model: str = "gpt-4o-mini"
    buy_box: dict = None
    calc_json: dict = None
    wizard_structure: dict = None


class ChatResponse(BaseModel):
    """Response from chat endpoint"""
    deal_id: str
    assistant_message: ChatMessage
