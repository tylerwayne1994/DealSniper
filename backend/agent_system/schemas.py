# ============================================================================
# Agent System — Pydantic Schemas
# Request/response models for the agent API endpoints.
# ============================================================================

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ---- Platform credential input ----

class PlatformCredentialIn(BaseModel):
    platform_id: str = Field(..., description="Platform identifier: crexi, zillow, propstream")
    username: str = Field("", description="Login email/username")
    password: str = Field("", description="Login password (sent to backend for encryption)")


# ---- Buy box parameters ----

class BuyBoxParams(BaseModel):
    states: List[str] = Field(default_factory=list, description="Target US state codes")
    cities: List[str] = Field(default_factory=list)
    zip_codes: List[str] = Field(default_factory=list)
    property_types: List[str] = Field(default_factory=list)
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_cap_rate: Optional[float] = None
    max_cap_rate: Optional[float] = None
    min_occupancy: Optional[float] = None
    max_occupancy: Optional[float] = None
    min_units: Optional[int] = None
    max_units: Optional[int] = None
    min_sqft: Optional[int] = None
    max_sqft: Optional[int] = None
    min_year_built: Optional[int] = None
    max_year_built: Optional[int] = None
    keywords: List[str] = Field(default_factory=list)


# ---- Agent create / update ----

class AgentCreateRequest(BaseModel):
    platforms: List[PlatformCredentialIn] = Field(default_factory=list)
    buy_box: BuyBoxParams = Field(default_factory=BuyBoxParams)
    runs_per_week: int = Field(1, ge=1, le=7)
    builder: Dict[str, Any] = Field(default_factory=dict)


class AgentUpdateRequest(BaseModel):
    platforms: Optional[List[PlatformCredentialIn]] = None
    buy_box: Optional[BuyBoxParams] = None
    runs_per_week: Optional[int] = Field(None, ge=1, le=7)
    status: Optional[str] = None  # active | paused
    builder: Optional[Dict[str, Any]] = None


# ---- Responses ----

class AgentConfigResponse(BaseModel):
    id: str
    user_id: str
    platforms: List[Dict[str, str]] = Field(default_factory=list, description="Platform IDs only (credentials hidden)")
    buy_box: Dict[str, Any] = Field(default_factory=dict)
    builder: Dict[str, Any] = Field(default_factory=dict)
    runs_per_week: int = 1
    status: str = "active"
    last_run_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AgentRunResponse(BaseModel):
    id: str
    agent_config_id: str
    status: str  # running, completed, failed
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    deals_found: int = 0
    error: Optional[str] = None
    log: Optional[Any] = None


class AgentDealResponse(BaseModel):
    id: str
    agent_run_id: Optional[str] = None
    platform: str = ""
    address: str = ""
    price: Optional[float] = None
    cap_rate: Optional[float] = None
    property_type: str = ""
    units: Optional[int] = None
    sqft: Optional[int] = None
    occupancy: Optional[float] = None
    listing_url: str = ""
    om_file_path: Optional[str] = None
    pipeline_deal_id: Optional[str] = None
    created_at: Optional[str] = None


class NotificationResponse(BaseModel):
    id: str
    message: str
    read: bool = False
    agent_run_id: Optional[str] = None
    agent_deal_id: Optional[str] = None
    created_at: Optional[str] = None


class RunTriggerResponse(BaseModel):
    run_id: str
    status: str = "running"
    message: str = "Agent run started"
