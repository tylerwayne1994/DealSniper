"""
Claude Chat Underwriter - Direct Claude API Chat with Streaming + Document Canvas

Features:
- SSE streaming responses from Claude
- PDF/image upload and parsing
- Real-time document preview in canvas
- Export generated documents (Excel, PDF, PPTX)
"""

import os
import io
import json
import uuid
import base64
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, AsyncGenerator
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from anthropic import Anthropic

log = logging.getLogger("claude_chat")

router = APIRouter(prefix="/api/claude-chat", tags=["Claude Chat Underwriter"])

# ============================================================================
# Configuration
# ============================================================================

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

# In-memory session storage (use Redis in production)
_sessions: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# System Prompt - CRE Underwriting Specialist
# ============================================================================

SYSTEM_PROMPT = """You are a seasoned commercial real estate investor, underwriter, and deal structurer embedded in the DealSniper platform. You have closed hundreds of multifamily and commercial deals and your investment philosophy is built around durable, Day 1 cashflow.

## YOUR CAPABILITIES

1. **Document Analysis**: You can read and analyze OMs (Offering Memorandums), rent rolls, T12s, P&Ls, leases, utility bills, inspection reports, and any uploaded deal documents.

2. **Underwriting from Scratch**: You never trust broker numbers. You build your own underwriting from the raw documents, identifying every dollar of value-add and every hidden risk.

3. **Structured Output**: When asked to generate a spreadsheet, business plan, or pitch deck, you produce clean, structured content that can be exported.

## YOUR PHILOSOPHY

- **Cashflow is king**: A deal that doesn't cashflow on Day 1 is not a deal.
- **Tenant retention > rent maximization**: A long-term tenant paying slightly below market is worth more than vacancy at market.
- **Expense optimization first**: The primary move is always shifting expenses to tenants (RUBS, insurance requirements) rather than pushing rents.
- **Small rent increases**: $30-50/month rent bumps that recapture shifted expenses create massive NOI impact without tenant turnover.
- **Survive downturns**: Stay 10-15% below market rent for occupancy stability through any cycle.

## DOCUMENT PARSING CHECKLIST

When analyzing uploaded documents, extract:
- Property basics: address, units, year built, square footage, property type
- Unit mix: bedroom/bath counts, square footage per unit type, current rents
- Financial: asking price, broker cap rate, broker NOI, gross income, expenses
- Occupancy: physical and economic vacancy from T12 if available
- Expenses: line by line — NEVER roll up. Flag who pays each utility.
- Debt: existing loan terms, rate, maturity, prepayment, assumability
- Tax: assessed value vs asking price (reassessment risk)
- Deferred maintenance and capital needs

## OUTPUT FORMAT

When generating documents:
- **Underwrite Model**: Use markdown tables for financial projections
- **Business Plan**: Use structured markdown with clear sections
- **Analysis**: Be direct, use bullet points, show your math

Always cross-check numbers. Broker NOI and your calculated NOI rarely match — use yours and explain every discrepancy.

If critical data is missing (rent roll, T12, utility breakdown), produce a partial analysis with a clear list of what's still needed. A partial analysis done right is more valuable than guesswork."""

# ============================================================================
# Pydantic Models
# ============================================================================

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    conversation_history: List[ChatMessage] = []

class UploadResponse(BaseModel):
    success: bool
    session_id: str
    file_id: str
    filename: str
    file_type: str
    preview_available: bool
    extracted_text: Optional[str] = None

# ============================================================================
# Helper Functions
# ============================================================================

def get_anthropic_client():
    """Get Anthropic client, raising error if not configured."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Anthropic API not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def get_session(session_id: str) -> Dict[str, Any]:
    """Get or create a session."""
    if session_id not in _sessions:
        _sessions[session_id] = {
            "id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "files": [],  # Uploaded files with their content
            "conversation": [],
            "generated_docs": {
                "underwrite_model": None,
                "business_plan": None,
                "pitch_deck": None
            }
        }
    return _sessions[session_id]


async def stream_claude_response(
    messages: List[Dict[str, Any]],
    system: str,
    files_context: List[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """Stream response from Claude using SSE format."""
    client = get_anthropic_client()
    
    # Build the first user message with file context if files are uploaded
    if files_context and messages:
        # Prepend file context to the conversation
        file_summary = "\n\n---\n**UPLOADED DOCUMENTS:**\n"
        for f in files_context:
            file_summary += f"\n**{f['filename']}** ({f['file_type']})\n"
            if f.get('extracted_text'):
                # Truncate very long documents
                text = f['extracted_text'][:50000] if len(f.get('extracted_text', '')) > 50000 else f.get('extracted_text', '')
                file_summary += f"```\n{text}\n```\n"
        file_summary += "\n---\n"
        
        # Add to system prompt
        system = system + file_summary
    
    try:
        with client.messages.stream(
            model=ANTHROPIC_MODEL,
            max_tokens=8192,
            system=system,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                # SSE format
                yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
        
        # Signal completion
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
    except Exception as e:
        log.exception(f"[Claude Chat] Streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"


async def parse_document_with_claude(file_bytes: bytes, file_type: str, filename: str) -> Dict[str, Any]:
    """Parse uploaded document using Claude's native PDF/vision capabilities."""
    client = get_anthropic_client()
    
    # Determine media type
    if file_type == "application/pdf":
        media_type = "application/pdf"
    elif file_type in ["image/png", "image/jpeg", "image/jpg", "image/webp"]:
        media_type = file_type
    else:
        # For other file types, try to read as text
        try:
            text_content = file_bytes.decode('utf-8')
            return {"extracted_text": text_content, "parsed_data": None}
        except:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")
    
    # Encode file
    file_b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    
    # Build message content
    if media_type == "application/pdf":
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": file_b64
                }
            },
            {
                "type": "text",
                "text": """Extract ALL text and data from this document. If it's a real estate document (OM, rent roll, T12, etc.), also identify and structure the key financial data.

Return your response in this format:
1. First, provide the full extracted text content
2. If applicable, provide a JSON summary of key data points at the end

Be thorough - extract every number, every line item, every detail visible in the document."""
            }
        ]
    else:
        # Image
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": file_b64
                }
            },
            {
                "type": "text",
                "text": "Extract all text and data from this image. If it contains financial or property information, structure the key data points."
            }
        ]
    
    log.info(f"[Claude Chat] Parsing {filename} ({file_type})...")
    
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": content}]
    )
    
    extracted_text = response.content[0].text
    
    log.info(f"[Claude Chat] Parsed {filename}: {len(extracted_text)} chars extracted")
    return {"extracted_text": extracted_text, "parsed_data": None}


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/session")
async def create_session():
    """Create a new chat session."""
    session_id = str(uuid.uuid4())[:8]
    session = get_session(session_id)
    return JSONResponse(content={
        "success": True,
        "session_id": session_id,
        "created_at": session["created_at"]
    })


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    """
    Upload a document (PDF, image, or text file) to the session.
    The document will be parsed and made available for chat.
    """
    try:
        session = get_session(session_id)
        
        # Read file
        file_bytes = await file.read()
        file_type = file.content_type or "application/octet-stream"
        filename = file.filename
        
        log.info(f"[Claude Chat] Upload: {filename} ({len(file_bytes)} bytes, {file_type})")
        
        # Generate file ID
        file_id = str(uuid.uuid4())[:8]
        
        # Parse document
        parsed = await parse_document_with_claude(file_bytes, file_type, filename)
        
        # Store file info in session
        file_record = {
            "file_id": file_id,
            "filename": filename,
            "file_type": file_type,
            "size": len(file_bytes),
            "uploaded_at": datetime.utcnow().isoformat(),
            "extracted_text": parsed.get("extracted_text"),
            "parsed_data": parsed.get("parsed_data"),
            # Store base64 for PDF preview in canvas
            "base64_data": base64.standard_b64encode(file_bytes).decode("utf-8") if file_type == "application/pdf" else None
        }
        session["files"].append(file_record)
        
        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "file_id": file_id,
            "filename": filename,
            "file_type": file_type,
            "preview_available": file_type == "application/pdf",
            "extracted_text": parsed.get("extracted_text", "")[:2000] + "..." if len(parsed.get("extracted_text", "")) > 2000 else parsed.get("extracted_text", "")
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[Claude Chat] Upload error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": str(e)}
        )


@router.get("/file/{session_id}/{file_id}")
async def get_file(session_id: str, file_id: str):
    """Get file data for preview in canvas."""
    session = get_session(session_id)
    
    for f in session["files"]:
        if f["file_id"] == file_id:
            return JSONResponse(content={
                "success": True,
                "file_id": file_id,
                "filename": f["filename"],
                "file_type": f["file_type"],
                "base64_data": f.get("base64_data"),
                "extracted_text": f.get("extracted_text")
            })
    
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/session/{session_id}/files")
async def list_session_files(session_id: str):
    """List all files uploaded to a session."""
    session = get_session(session_id)
    
    files = [{
        "file_id": f["file_id"],
        "filename": f["filename"],
        "file_type": f["file_type"],
        "size": f["size"],
        "uploaded_at": f["uploaded_at"],
        "preview_available": f.get("base64_data") is not None
    } for f in session["files"]]
    
    return JSONResponse(content={"success": True, "files": files})


@router.post("/chat/stream")
async def chat_stream(request: Request):
    """
    Stream chat response from Claude.
    Uses Server-Sent Events (SSE) for real-time streaming.
    """
    try:
        data = await request.json()
        session_id = data.get("session_id")
        message = data.get("message", "")
        conversation_history = data.get("conversation_history", [])
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        if not message:
            raise HTTPException(status_code=400, detail="message required")
        
        session = get_session(session_id)
        
        # Build messages for Claude
        messages = []
        for msg in conversation_history[-20:]:  # Last 20 messages for context
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Get file context from session
        files_context = session.get("files", [])
        
        log.info(f"[Claude Chat] Streaming response for session {session_id}, {len(files_context)} files in context")
        
        return StreamingResponse(
            stream_claude_response(messages, SYSTEM_PROMPT, files_context),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[Claude Chat] Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat_non_streaming(request: Request):
    """
    Non-streaming chat endpoint (fallback for environments that don't support SSE).
    """
    try:
        data = await request.json()
        session_id = data.get("session_id")
        message = data.get("message", "")
        conversation_history = data.get("conversation_history", [])
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        if not message:
            raise HTTPException(status_code=400, detail="message required")
        
        session = get_session(session_id)
        client = get_anthropic_client()
        
        # Build messages for Claude
        messages = []
        for msg in conversation_history[-20:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Build system with file context
        system = SYSTEM_PROMPT
        files_context = session.get("files", [])
        if files_context:
            file_summary = "\n\n---\n**UPLOADED DOCUMENTS:**\n"
            for f in files_context:
                file_summary += f"\n**{f['filename']}** ({f['file_type']})\n"
                if f.get('extracted_text'):
                    text = f['extracted_text'][:50000] if len(f.get('extracted_text', '')) > 50000 else f.get('extracted_text', '')
                    file_summary += f"```\n{text}\n```\n"
            file_summary += "\n---\n"
            system = system + file_summary
        
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=8192,
            system=system,
            messages=messages
        )
        
        assistant_message = response.content[0].text
        
        return JSONResponse(content={
            "success": True,
            "response": assistant_message
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[Claude Chat] Non-streaming chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}/file/{file_id}")
async def delete_file(session_id: str, file_id: str):
    """Remove a file from a session."""
    session = get_session(session_id)
    
    session["files"] = [f for f in session["files"] if f["file_id"] != file_id]
    
    return JSONResponse(content={"success": True})


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its data."""
    if session_id in _sessions:
        del _sessions[session_id]
    
    return JSONResponse(content={"success": True})
