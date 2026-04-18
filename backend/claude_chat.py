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
# System Prompt - CRE Underwriting Specialist with Artifacts
# ============================================================================

SYSTEM_PROMPT = """You are a seasoned commercial real estate investor, underwriter, and deal structurer embedded in the DealSniper platform. You have closed hundreds of multifamily and commercial deals and your investment philosophy is built around durable, Day 1 cashflow.

## YOUR CAPABILITIES

1. **Document Analysis**: You can read and analyze OMs (Offering Memorandums), rent rolls, T12s, P&Ls, leases, utility bills, inspection reports, and any uploaded deal documents.

2. **Underwriting from Scratch**: You never trust broker numbers. You build your own underwriting from the raw documents, identifying every dollar of value-add and every hidden risk.

3. **Artifact Generation**: You can create spreadsheets and documents that appear live in the canvas. Users can see what you're building and ask for changes before downloading.

## ARTIFACTS - CRITICAL INSTRUCTIONS

When asked to create a spreadsheet, business plan, or any downloadable document, you MUST output an artifact block. Artifacts appear in the canvas panel where users can preview and download them.

IMPORTANT: When a user says "underwrite the deal" or "underwrite this", they are asking you to ANALYZE the deal - review the documents, identify risks, run numbers in your head, and discuss your findings in chat. Do NOT automatically generate a spreadsheet artifact unless the user EXPLICITLY asks for a spreadsheet, model, pro forma, or Excel file. Underwriting analysis should be conversational first.

### SPREADSHEET ARTIFACT FORMAT

When creating spreadsheets (underwrite models, pro formas, sensitivity tables), use this exact format:

```artifact:spreadsheet:Title Here
{
  "sheets": [
    {
      "name": "Sheet Name",
      "columns": ["A", "B", "C", "D", "E"],
      "data": [
        ["Header 1", "Header 2", "Header 3", "Header 4", "Header 5"],
        ["Row Label", 100000, 50000, "=B2+C2", "=D2*0.1"],
        ["Another Row", 200000, 75000, "=B3+C3", "=D3*0.1"]
      ],
      "columnWidths": {"A": 25, "B": 15, "C": 15, "D": 15, "E": 15},
      "formatting": {
        "A1:E1": {"bold": true, "background": "#f0f0f0"},
        "B2:E10": {"numberFormat": "$#,##0"},
        "E2:E10": {"numberFormat": "0.00%"}
      }
    }
  ]
}
```

SPREADSHEET RULES:
- Use Excel-style formulas (=SUM, =B2*C2, etc.) - they will work in the exported file
- Include multiple sheets for complex models (Summary, Assumptions, Cash Flow, Sensitivity, etc.)
- Always include proper number formatting for currency and percentages
- Make headers bold with background color
- Use realistic CRE underwriting structure

### DOCUMENT ARTIFACT FORMAT

When creating business plans, executive summaries, or any text document, use this format:

```artifact:document:Title Here
# Document Title

## Section 1
Content here with **bold** and *italic* formatting.

### Subsection
- Bullet points
- More points

## Section 2
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

## Section 3
More content...
```

DOCUMENT RULES:
- Use standard Markdown formatting
- Include clear section headers
- Use tables for financial summaries
- Be thorough but concise

### WHEN TO CREATE ARTIFACTS

CREATE a spreadsheet artifact ONLY when user EXPLICITLY asks for:
- "Build me an underwrite model"
- "Create a pro forma"
- "Make a spreadsheet"
- "Generate a sensitivity analysis"
- "Build a cash flow model"
- "Export to Excel"

DO NOT create a spreadsheet artifact when user says:
- "Underwrite the deal" (this means ANALYZE, not build a spreadsheet)
- "Underwrite this" (analyze and discuss)
- "What do you think of this deal" (analysis only)
- "Review the numbers" (discuss in chat)

CREATE a document artifact when user asks for:
- "Write a business plan"
- "Create an executive summary"
- "Generate an investment memo"
- "Write up the deal"

DO NOT create artifacts for:
- General analysis or discussion
- Answering questions
- Explaining concepts
- Partial work that needs more input first

## YOUR PHILOSOPHY

- **Cashflow is king**: A deal that doesn't cashflow on Day 1 is not a deal.
- **Tenant retention > rent maximization**: A long-term tenant paying slightly below market is worth more than vacancy at market.
- **Expense optimization first**: The primary move is always shifting expenses to tenants (RUBS, insurance requirements) rather than pushing rents.
- **Small rent increases**: $30-50/month rent bumps that recapture shifted expenses create massive NOI impact without tenant turnover.
- **Survive downturns**: Stay 10-15% below market rent for occupancy stability through any cycle.

## UNDERWRITING STANDARDS

When building underwrite models, always include:

**INCOME SECTION:**
- Gross Potential Rent (current in-place, NOT pro forma)
- Vacancy Loss (use T12 actual, minimum 5%)
- Other Income (laundry, parking, fees - only documented)
- Effective Gross Income

**EXPENSE SECTION (line by line, never rolled up):**
- Property Taxes (current AND reassessed at purchase price)
- Insurance
- Property Management (8-10% if self-managed)
- Repairs & Maintenance
- CapEx Reserve ($250-500/unit/year)
- Utilities (broken out: water, sewer, trash, gas, electric)
- All other documented expenses

**RETURNS SECTION:**
- NOI (your calculation, not broker's)
- Cap Rate
- Debt Service (at proposed financing terms)
- DSCR (minimum 1.20)
- Cash-on-Cash Return
- Price per Unit / Price per SF

**VALUE-ADD SECTION:**
- RUBS recovery potential
- Rent recapture from expense shifting
- Expense normalization opportunities
- Rehab premium (if applicable)

Always show your math. Always explain discrepancies with broker numbers."""

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


# ============================================================================
# Artifact Execution - Generate Downloadable Files
# ============================================================================

def generate_spreadsheet_from_artifact(artifact_data: Dict[str, Any], title: str) -> bytes:
    """
    Generate an Excel file from artifact JSON data.
    Claude provides the structure, we just convert to xlsx.
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    
    wb = Workbook()
    # Remove default sheet
    wb.remove(wb.active)
    
    sheets = artifact_data.get("sheets", [])
    if not sheets:
        raise HTTPException(status_code=400, detail="No sheets in artifact data")
    
    for sheet_data in sheets:
        sheet_name = sheet_data.get("name", "Sheet")[:31]  # Excel limit
        ws = wb.create_sheet(title=sheet_name)
        
        # Write data
        data = sheet_data.get("data", [])
        for row_idx, row in enumerate(data, start=1):
            for col_idx, cell_value in enumerate(row, start=1):
                cell = ws.cell(row=row_idx, column=col_idx)
                
                # Handle formulas
                if isinstance(cell_value, str) and cell_value.startswith("="):
                    cell.value = cell_value
                else:
                    cell.value = cell_value
        
        # Apply column widths
        col_widths = sheet_data.get("columnWidths", {})
        for col_letter, width in col_widths.items():
            ws.column_dimensions[col_letter].width = width
        
        # Apply formatting
        formatting = sheet_data.get("formatting", {})
        for cell_range, fmt in formatting.items():
            try:
                for row in ws[cell_range]:
                    for cell in (row if hasattr(row, '__iter__') else [row]):
                        if fmt.get("bold"):
                            cell.font = Font(bold=True)
                        if fmt.get("background"):
                            cell.fill = PatternFill(start_color=fmt["background"].replace("#", ""), 
                                                   end_color=fmt["background"].replace("#", ""), 
                                                   fill_type="solid")
                        if fmt.get("numberFormat"):
                            cell.number_format = fmt["numberFormat"]
            except Exception as e:
                log.warning(f"[Artifact] Failed to apply formatting {cell_range}: {e}")
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


def generate_document_from_artifact(markdown_content: str, title: str) -> bytes:
    """
    Generate a PDF from markdown content.
    Uses markdown2 + weasyprint if available, otherwise returns HTML.
    """
    try:
        import markdown2
        html_content = markdown2.markdown(
            markdown_content, 
            extras=["tables", "fenced-code-blocks", "header-ids"]
        )
    except ImportError:
        # Fallback: basic markdown conversion
        html_content = f"<pre>{markdown_content}</pre>"
    
    # Wrap in styled HTML
    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        h1 {{ color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }}
        h2 {{ color: #2563eb; margin-top: 30px; }}
        h3 {{ color: #444; }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 10px 12px;
            text-align: left;
        }}
        th {{
            background: #f5f5f5;
            font-weight: 600;
        }}
        tr:nth-child(even) {{ background: #fafafa; }}
        code {{
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
        }}
        pre {{
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
        }}
        ul, ol {{ padding-left: 24px; }}
        li {{ margin-bottom: 8px; }}
        blockquote {{
            border-left: 4px solid #2563eb;
            padding-left: 16px;
            margin-left: 0;
            color: #666;
            font-style: italic;
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>"""
    
    # Try to generate PDF with weasyprint
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=full_html).write_pdf()
        return pdf_bytes
    except ImportError:
        log.warning("[Artifact] weasyprint not available, returning HTML instead")
        return full_html.encode('utf-8')
    except Exception as e:
        log.warning(f"[Artifact] PDF generation failed: {e}, returning HTML")
        return full_html.encode('utf-8')


@router.post("/artifact/execute")
async def execute_artifact(request: Request):
    """
    Execute an artifact to generate a downloadable file.
    
    Body:
    {
        "type": "spreadsheet" | "document",
        "title": "File Title",
        "data": { ... } | "markdown content"
    }
    """
    try:
        body = await request.json()
        artifact_type = body.get("type")
        title = body.get("title", "Untitled")
        data = body.get("data")
        
        if not artifact_type or not data:
            raise HTTPException(status_code=400, detail="type and data required")
        
        if artifact_type == "spreadsheet":
            # Parse JSON if string
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError as e:
                    raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
            
            file_bytes = generate_spreadsheet_from_artifact(data, title)
            filename = f"{title.replace(' ', '_')}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
        elif artifact_type == "document":
            # data is markdown string
            if not isinstance(data, str):
                raise HTTPException(status_code=400, detail="Document data must be markdown string")
            
            file_bytes = generate_document_from_artifact(data, title)
            
            # Check if PDF or HTML was generated
            if file_bytes[:4] == b'%PDF':
                filename = f"{title.replace(' ', '_')}.pdf"
                media_type = "application/pdf"
            else:
                filename = f"{title.replace(' ', '_')}.html"
                media_type = "text/html"
        else:
            raise HTTPException(status_code=400, detail=f"Unknown artifact type: {artifact_type}")
        
        # Return as base64 for frontend to handle download
        file_b64 = base64.standard_b64encode(file_bytes).decode('utf-8')
        
        return JSONResponse(content={
            "success": True,
            "filename": filename,
            "media_type": media_type,
            "data": file_b64
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.exception(f"[Artifact] Execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
