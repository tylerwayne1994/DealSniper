# Email Deals Module - Gmail OAuth & Deal Extraction
# Backend for auto-screening broker emails

import os
import re
import base64
import json
import imaplib
import email as email_mod
from email.header import decode_header as _decode_header_raw
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Google OAuth libraries
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

# Supabase
from supabase import create_client, Client
import logging

load_dotenv(override=True)

log = logging.getLogger("email_deals")

# ============================================================================
# Configuration
# ============================================================================

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8010/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ylvnrtbkpsnpgskbkbyy.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for backend operations

# Gmail API scopes
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Email query for broker deal emails
BROKER_EMAIL_QUERY = """
(from:@crexi.com OR from:@loopnet.com OR from:@marcusmillichap.com 
OR from:@cbre.com OR from:@colliers.com OR from:@cushwake.com 
OR from:@ngkf.com OR from:@jll.com OR from:@berkadia.com
OR from:@eastdilsecured.com OR from:@hfrealtyinc.com
OR subject:"new listing" OR subject:"price reduced" OR subject:"just listed"
OR subject:"investment opportunity" OR subject:"multifamily" OR subject:"apartment")
newer_than:7d
"""

# URL patterns for deal sites
DEAL_URL_PATTERNS = {
    'crexi': r'https?://(?:www\.)?crexi\.com/[^\s"<>]+',
    'loopnet': r'https?://(?:www\.)?loopnet\.com/[^\s"<>]+',
    'cbre': r'https?://(?:www\.)?cbre\.com/[^\s"<>]+',
    'marcus_millichap': r'https?://(?:www\.)?marcusmillichap\.com/[^\s"<>]+',
    'colliers': r'https?://(?:www\.)?colliers\.com/[^\s"<>]+',
}

router = APIRouter(prefix="/api/email-deals", tags=["Email Deals"])
auth_router = APIRouter(tags=["Google OAuth"])

# ============================================================================
# Supabase Client
# ============================================================================

def get_supabase() -> Client:
    """Get Supabase client with service role key for backend operations."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================================
# Helper Functions
# ============================================================================

def get_current_user_id(request: Request) -> str:
    """
    Get current user ID from request.
    Requires explicit X-User-ID header or user_id cookie.
    """
    user_id = request.headers.get("X-User-ID") or request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user ID. Provide 'X-User-ID' header.")
    return user_id

def normalize_url(url: str) -> str:
    """Remove tracking parameters and normalize URL."""
    parsed = urlparse(url)
    # Remove common tracking parameters
    if parsed.query:
        params = parse_qs(parsed.query, keep_blank_values=True)
        # Keep only essential params, remove tracking
        tracking_params = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                         'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid'}
        filtered = {k: v for k, v in params.items() if k.lower() not in tracking_params}
        new_query = urlencode(filtered, doseq=True)
        url = urlunparse(parsed._replace(query=new_query))
    return url.rstrip('/')

def decode_email_body(payload: dict) -> str:
    """Decode email body from Gmail API payload."""
    body_text = ""
    
    if 'body' in payload and payload['body'].get('data'):
        body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='ignore')
    
    if 'parts' in payload:
        for part in payload['parts']:
            mime_type = part.get('mimeType', '')
            if mime_type == 'text/html' or mime_type == 'text/plain':
                if part.get('body', {}).get('data'):
                    decoded = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                    body_text += decoded
            elif 'parts' in part:
                # Recursively handle nested parts
                body_text += decode_email_body(part)
    
    return body_text

def extract_deal_urls(text: str) -> List[Dict[str, str]]:
    """Extract deal URLs from email text."""
    urls = []
    seen = set()
    
    for source, pattern in DEAL_URL_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        for url in matches:
            normalized = normalize_url(url)
            if normalized not in seen:
                seen.add(normalized)
                urls.append({'url': normalized, 'source': source})
    
    # Also look for generic property listing URLs
    generic_pattern = r'https?://[^\s"<>]+(?:listing|property|details)[^\s"<>]*'
    generic_matches = re.findall(generic_pattern, text, re.IGNORECASE)
    for url in generic_matches:
        normalized = normalize_url(url)
        if normalized not in seen:
            seen.add(normalized)
            urls.append({'url': normalized, 'source': 'other'})
    
    return urls

# ============================================================================
# Gmail Token Management
# ============================================================================

def get_gmail_credentials(user_id: str) -> Optional[Credentials]:
    """Load Gmail credentials for a user from Supabase."""
    supabase = get_supabase()
    
    result = supabase.table('email_integrations').select('*').eq('user_id', user_id).eq('provider', 'gmail').single().execute()
    
    if not result.data:
        return None
    
    integration = result.data
    
    if integration['status'] != 'active':
        return None
    
    creds = Credentials(
        token=integration['access_token'],
        refresh_token=integration['refresh_token'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GMAIL_SCOPES
    )
    
    # Check if token needs refresh
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Update tokens in database
            supabase.table('email_integrations').update({
                'access_token': creds.token,
                'expires_at': creds.expiry.isoformat() if creds.expiry else None,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('user_id', user_id).eq('provider', 'gmail').execute()
        except Exception as e:
            # Mark integration as error
            supabase.table('email_integrations').update({
                'status': 'error',
                'updated_at': datetime.utcnow().isoformat()
            }).eq('user_id', user_id).eq('provider', 'gmail').execute()
            return None
    
    return creds

def save_gmail_credentials(user_id: str, creds: Credentials):
    """Save Gmail credentials for a user to Supabase."""
    supabase = get_supabase()
    
    data = {
        'user_id': user_id,
        'provider': 'gmail',
        'access_token': creds.token,
        'refresh_token': creds.refresh_token,
        'expires_at': creds.expiry.isoformat() if creds.expiry else None,
        'status': 'active',
        'updated_at': datetime.utcnow().isoformat()
    }
    
    # Upsert (insert or update)
    supabase.table('email_integrations').upsert(data, on_conflict='user_id,provider').execute()

# ============================================================================
# OAuth Routes
# ============================================================================

@auth_router.get("/auth/google")
async def google_auth_start(request: Request, user_id: Optional[str] = Query(None)):
    """Start Google OAuth flow."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    
    # Get user ID
    uid = user_id or get_current_user_id(request)
    
    # Create OAuth flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    # Generate authorization URL with state containing user_id
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=uid  # Encode user_id in state
    )
    
    return RedirectResponse(url=authorization_url)

@auth_router.get("/auth/google/callback")
async def google_auth_callback(code: str, state: str = None, error: str = None):
    """Handle Google OAuth callback."""
    if error:
        return HTMLResponse(f"""
            <html>
            <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9fafb;">
                <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #ef4444;">Connection Failed</h2>
                    <p style="color: #6b7280;">Error: {error}</p>
                    <button onclick="window.close()" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer;">Close Window</button>
                </div>
            </body>
            </html>
        """)
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    user_id = state or "dev_user_1"
    
    try:
        # Exchange the authorization code for tokens manually to avoid
        # scope-change errors when Google returns extra scopes from the account.
        import google.auth.transport.requests as g_requests
        from google.oauth2 import id_token
        import requests as http_requests

        token_response = http_requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_response.json()

        if "error" in token_data:
            raise Exception(f"Token exchange failed: {token_data.get('error_description', token_data['error'])}")

        creds = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=GMAIL_SCOPES,
        )
        # Set expiry if provided
        if "expires_in" in token_data:
            from datetime import timezone
            creds.expiry = datetime.now(timezone.utc) + timedelta(seconds=int(token_data["expires_in"]))
        
        # Save credentials to Supabase
        save_gmail_credentials(user_id, creds)
        
        # Return success page
        return HTMLResponse(f"""
            <html>
            <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9fafb;">
                <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                    </div>
                    <h2 style="color: #111827; margin-bottom: 8px;">Gmail Connected!</h2>
                    <p style="color: #6b7280;">You can now close this window and return to DealSniper.</p>
                    <button onclick="window.close()" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Close Window</button>
                </div>
            </body>
            </html>
        """)
        
    except Exception as e:
        return HTMLResponse(f"""
            <html>
            <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9fafb;">
                <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #ef4444;">Connection Failed</h2>
                    <p style="color: #6b7280;">Error: {str(e)}</p>
                    <button onclick="window.close()" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer;">Close Window</button>
                </div>
            </body>
            </html>
        """)

# ============================================================================
# API Endpoints
# ============================================================================

class StatusResponse(BaseModel):
    connected: bool
    provider: str = "gmail"
    status: Optional[str] = None
    last_sync_at: Optional[str] = None
    raw_emails_count: int = 0
    screened_deals_count: int = 0
    email_address: Optional[str] = None

@router.get("/status", response_model=StatusResponse)
async def get_email_status(request: Request):
    """Get Gmail connection status for current user."""
    user_id = get_current_user_id(request)
    supabase = get_supabase()
    
    # Check integration status
    result = supabase.table('email_integrations').select('*').eq('user_id', user_id).eq('provider', 'gmail').single().execute()
    
    if not result.data:
        return StatusResponse(connected=False)
    
    integration = result.data
    
    # Get counts
    emails_result = supabase.table('raw_emails').select('id', count='exact').eq('user_id', user_id).execute()
    deals_result = supabase.table('screened_deals').select('id', count='exact').eq('user_id', user_id).execute()
    
    return StatusResponse(
        connected=integration['status'] == 'active',
        status=integration['status'],
        last_sync_at=integration.get('last_sync_at'),
        raw_emails_count=emails_result.count or 0,
        screened_deals_count=deals_result.count or 0,
        email_address=integration.get('email') or integration.get('email_address')
    )

class SyncResponse(BaseModel):
    success: bool
    synced: int = 0
    already_known: int = 0
    links_extracted: int = 0
    deals_screened: int = 0
    message: str = ""

@router.get("/sync", response_model=SyncResponse)
async def sync_email_deals(request: Request):
    """Sync deal emails from Gmail.
    
    The connected Gmail account is a shared inbound inbox
    (e.g. dealsniperinbound@gmail.com).  Multiple users send OMs there.
    We match each sender to a registered user in the ``profiles`` table
    and create the underwrite job under *that* user's account.
    """
    admin_user_id = get_current_user_id(request)
    
    # Get Gmail credentials (stored under the admin who connected)
    creds = get_gmail_credentials(admin_user_id)
    if not creds:
        raise HTTPException(status_code=401, detail="Gmail not connected. Please connect your Gmail account first.")
    
    try:
        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)
        
        # Fetch ALL recent emails with attachments from the inbound inbox
        results = service.users().messages().list(
            userId='me',
            q='newer_than:7d',
            maxResults=50
        ).execute()
        
        messages = results.get('messages', [])
        
        supabase = get_supabase()
        synced = 0
        already_known = 0
        
        for msg_stub in messages:
            msg_id = msg_stub['id']
            
            # Check if we already have this message (keyed by admin who owns the inbox)
            existing = supabase.table('raw_emails').select('id').eq('user_id', admin_user_id).eq('provider_message_id', msg_id).execute()
            
            if existing.data:
                already_known += 1
                continue
            
            # Fetch full message
            msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
            
            # Extract headers
            headers = {h['name'].lower(): h['value'] for h in msg.get('payload', {}).get('headers', [])}
            
            # Parse received timestamp
            internal_date = msg.get('internalDate')
            received_at = datetime.fromtimestamp(int(internal_date) / 1000).isoformat() if internal_date else None
            
            from_address_raw = headers.get('from', '')

            # ----- Match sender to a registered user -----
            # Extract bare email from "Display Name <email>" format
            email_match = re.search(r'<([^>]+)>', from_address_raw)
            sender_email = (email_match.group(1) if email_match else from_address_raw).strip().lower()

            # Look up sender in profiles table
            matched_user_id = None
            try:
                profile_result = supabase.table('profiles').select('id').eq('email', sender_email).execute()
                if profile_result.data and len(profile_result.data) > 0:
                    matched_user_id = profile_result.data[0]['id']
            except Exception as lookup_err:
                log.warning(f"[EmailDeals] Profile lookup failed for {sender_email}: {lookup_err}")

            # If no profile match, fall back to admin (so emails still get stored)
            owner_user_id = matched_user_id or admin_user_id
            
            # Store raw email
            email_data = {
                'user_id': admin_user_id,   # raw email stored under inbox owner
                'provider_message_id': msg_id,
                'thread_id': msg.get('threadId'),
                'from_address': from_address_raw,
                'subject': headers.get('subject', ''),
                'snippet': msg.get('snippet', ''),
                'received_at': received_at,
                'raw_payload': msg.get('payload'),
                'processed': False
            }

            insert_result = supabase.table('raw_emails').insert(email_data).execute()
            raw_email_row = (insert_result.data or [{}])[0]
            raw_email_id = raw_email_row.get('id')

            # Create email_underwrite_jobs entry under the MATCHED user's account
            try:
                job_record = {
                    'user_id': owner_user_id,
                    'raw_email_id': raw_email_id,
                    'from_address': from_address_raw,
                    'to_address': None,
                    'subject': email_data['subject'],
                    'thread_id': email_data['thread_id'],
                    'provider_message_id': email_data['provider_message_id'],
                    'attachments': [],
                    'status': 'pending'
                }
                supabase.table('email_underwrite_jobs').insert(job_record).execute()
            except Exception as job_err:
                log.warning("[EmailDeals] Failed to create email_underwrite_job for msg %s: %s", msg_id, job_err)

            synced += 1
        
        # Update last sync time
        supabase.table('email_integrations').update({
            'last_sync_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }).eq('user_id', admin_user_id).eq('provider', 'gmail').execute()
        
        # Process unprocessed emails and extract links
        links_extracted = await process_unprocessed_emails(user_id)
        
        # Run napkin underwriting on new links
        deals_screened = await run_napkin_underwriting(user_id)
        
        return SyncResponse(
            success=True,
            synced=synced,
            already_known=already_known,
            links_extracted=links_extracted,
            deals_screened=deals_screened,
            message=f"Synced {synced} new emails, extracted {links_extracted} deal links, screened {deals_screened} deals."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing emails: {str(e)}")

async def process_unprocessed_emails(user_id: str) -> int:
    """Process unprocessed emails and extract deal links."""
    supabase = get_supabase()
    
    # Get unprocessed emails
    result = supabase.table('raw_emails').select('*').eq('user_id', user_id).eq('processed', False).execute()
    
    if not result.data:
        return 0
    
    links_extracted = 0
    
    for email in result.data:
        # Decode email body
        payload = email.get('raw_payload', {})
        body_text = decode_email_body(payload)
        
        # Also search in snippet
        body_text += " " + (email.get('snippet') or '')
        
        # Extract deal URLs
        urls = extract_deal_urls(body_text)
        
        for url_info in urls:
            # Check if URL already exists for this user
            existing = supabase.table('deal_links').select('id').eq('user_id', user_id).eq('url', url_info['url']).execute()
            
            if not existing.data:
                link_data = {
                    'user_id': user_id,
                    'email_id': email['id'],
                    'source': url_info['source'],
                    'url': url_info['url'],
                    'status': 'new'
                }
                supabase.table('deal_links').insert(link_data).execute()
                links_extracted += 1
        
        # Mark email as processed
        supabase.table('raw_emails').update({
            'processed': True,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', email['id']).execute()
    
    return links_extracted

# ============================================================================
# Napkin Underwriting
# ============================================================================

def get_user_buy_box(user_id: str) -> dict:
    """Get user's buy box settings or return defaults."""
    try:
        supabase = get_supabase()
        result = supabase.table('user_buy_box').select('*').eq('user_id', user_id).single().execute()
        if result.data:
            return result.data
    except Exception as e:
        # In local/dev without Supabase, fall back to defaults instead of 500.
        log.warning(f"[EmailDeals] get_user_buy_box falling back to defaults: {e}")

    # Default buy box settings (used when Supabase is missing or has no row)
    return {
        'min_cap_rate': 0.05,      # 5%
        'max_cap_rate': 0.12,      # 12%
        'min_dscr': 1.15,
        'min_cash_on_cash': 0.06,  # 6%
        'max_expense_ratio': 0.50, # 50%
        'min_units': 10,
        'max_units': 500,
        'min_price': 500000,
        'max_price': 50000000,
        'max_price_per_unit': 250000,
        'max_vacancy': 0.15,       # 15%
        'min_year_built': 1960,
        'assumed_ltv': 0.75,
        'assumed_interest_rate': 0.07,
        'assumed_amortization': 30
    }

def napkin_underwrite(listing_info: dict, buy_box: dict) -> dict:
    """
    Perform napkin underwriting on a listing.
    Returns computed metrics and pass/fail status.
    """
    # Extract listing data (with defaults for missing data)
    price = listing_info.get('price', 0)
    units = listing_info.get('units', 0)
    estimated_rent = listing_info.get('estimated_rent', 0)  # per unit/month
    
    # If we don't have price, can't underwrite
    if not price or price <= 0:
        return {
            'score': 'fail',
            'screening_notes': 'Missing price data - cannot underwrite',
            'estimated_cap_rate': None,
            'estimated_dscr': None,
            'estimated_cash_on_cash': None,
            'estimated_price_per_unit': None
        }
    
    # Calculate metrics
    price_per_unit = price / units if units > 0 else None
    
    # Estimate income (if we have rent data)
    if estimated_rent and units:
        gross_income = estimated_rent * units * 12
    else:
        # Rough estimate: assume $1000/unit/month for napkin
        gross_income = units * 1000 * 12 if units else price * 0.12  # 12% GRM assumption
    
    # Estimate expenses (35-45% of gross for multifamily)
    estimated_expenses = gross_income * 0.40
    estimated_noi = gross_income - estimated_expenses
    
    # Cap rate
    cap_rate = estimated_noi / price if price > 0 else 0
    
    # Debt service calculation (napkin)
    ltv = buy_box.get('assumed_ltv', 0.75)
    rate = buy_box.get('assumed_interest_rate', 0.07)
    amort = buy_box.get('assumed_amortization', 30)
    
    loan_amount = price * ltv
    down_payment = price - loan_amount
    
    # Monthly payment calculation (PMT formula)
    monthly_rate = rate / 12
    num_payments = amort * 12
    if monthly_rate > 0:
        monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
    else:
        monthly_payment = loan_amount / num_payments
    
    annual_debt_service = monthly_payment * 12
    
    # DSCR
    dscr = estimated_noi / annual_debt_service if annual_debt_service > 0 else 0
    
    # Cash flow and cash-on-cash
    annual_cash_flow = estimated_noi - annual_debt_service
    cash_on_cash = annual_cash_flow / down_payment if down_payment > 0 else 0
    
    # Determine pass/fail based on buy box
    passes = True
    notes = []
    
    # Check against buy box thresholds
    min_cap = buy_box.get('min_cap_rate', 0)
    if min_cap and cap_rate < min_cap:
        passes = False
        notes.append(f"Cap rate {cap_rate*100:.1f}% below min {min_cap*100:.1f}%")
    
    min_dscr = buy_box.get('min_dscr', 0)
    if min_dscr and dscr < min_dscr:
        passes = False
        notes.append(f"DSCR {dscr:.2f}x below min {min_dscr:.2f}x")
    
    min_coc = buy_box.get('min_cash_on_cash', 0)
    if min_coc and cash_on_cash < min_coc:
        passes = False
        notes.append(f"Cash-on-cash {cash_on_cash*100:.1f}% below min {min_coc*100:.1f}%")
    
    # Check expense ratio
    expense_ratio = estimated_expenses / gross_income if gross_income > 0 else 0
    max_expense = buy_box.get('max_expense_ratio', 0)
    if max_expense and expense_ratio > max_expense:
        passes = False
        notes.append(f"Expense ratio {expense_ratio*100:.1f}% above max {max_expense*100:.1f}%")
    
    max_ppu = buy_box.get('max_price_per_unit')
    if max_ppu and price_per_unit and price_per_unit > max_ppu:
        passes = False
        notes.append(f"Price/unit ${price_per_unit:,.0f} above max ${max_ppu:,.0f}")
    
    min_units = buy_box.get('min_units')
    max_units = buy_box.get('max_units')
    if min_units and units and units < min_units:
        passes = False
        notes.append(f"Units {units} below min {min_units}")
    if max_units and units and units > max_units:
        passes = False
        notes.append(f"Units {units} above max {max_units}")
    
    # Determine score
    if passes:
        score = 'pass'
    elif len(notes) <= 2:
        score = 'maybe'  # Close but not quite
    else:
        score = 'fail'
    
    return {
        'score': score,
        'screening_notes': '; '.join(notes) if notes else 'Passes all buy box criteria',
        'estimated_cap_rate': round(cap_rate, 4) if cap_rate else None,
        'estimated_dscr': round(dscr, 2) if dscr else None,
        'estimated_cash_on_cash': round(cash_on_cash, 4) if cash_on_cash else None,
        'estimated_price_per_unit': round(price_per_unit, 0) if price_per_unit else None,
        'estimated_income': round(gross_income, 0),
        'estimated_expenses': round(estimated_expenses, 0),
        'estimated_noi': round(estimated_noi, 0)
    }

async def run_napkin_underwriting(user_id: str) -> int:
    """Run napkin underwriting on new deal links."""
    supabase = get_supabase()
    
    # Get user's buy box
    buy_box = get_user_buy_box(user_id)
    
    # Get new deal links that haven't been screened
    result = supabase.table('deal_links').select('*').eq('user_id', user_id).eq('status', 'new').execute()
    
    if not result.data:
        return 0
    
    screened = 0
    
    for link in result.data:
        # For now, we'll create placeholder listings
        # In production, you'd scrape the URL for actual data
        listing_info = {
            'price': None,  # Would be scraped
            'units': None,
            'estimated_rent': None,
            'url': link['url'],
            'source': link['source']
        }
        
        # Since we don't have real scraping yet, mark as needing full underwriting
        # and create a placeholder screened deal
        screened_data = {
            'user_id': user_id,
            'deal_link_id': link['id'],
            'property_name': f"Listing from {link['source'].replace('_', ' ').title()}",
            'score': 'maybe',  # Default to maybe since we need real data
            'screening_notes': 'Awaiting OM upload for full underwriting - listing data not yet scraped'
        }
        
        # Check if already screened
        existing = supabase.table('screened_deals').select('id').eq('deal_link_id', link['id']).execute()
        
        if not existing.data:
            supabase.table('screened_deals').insert(screened_data).execute()
            screened += 1
        
        # Update link status
        supabase.table('deal_links').update({
            'status': 'parsed',
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', link['id']).execute()
    
    return screened

class DealListItem(BaseModel):
    id: str
    source: str
    url: str
    email_subject: Optional[str] = None
    email_from: Optional[str] = None
    property_name: Optional[str] = None
    property_address: Optional[str] = None
    price: Optional[float] = None
    units: Optional[int] = None
    estimated_cap_rate: Optional[float] = None
    estimated_dscr: Optional[float] = None
    estimated_cash_on_cash: Optional[float] = None
    estimated_price_per_unit: Optional[float] = None
    score: Optional[str] = None
    screening_notes: Optional[str] = None
    received_at: Optional[str] = None
    created_at: str

class DealListResponse(BaseModel):
    deals: List[DealListItem]
    total: int

@router.get("/list", response_model=DealListResponse)
async def list_screened_deals(
    request: Request,
    score_filter: Optional[str] = Query(None, description="Filter by score: pass, maybe, fail"),
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """Get list of screened deals for current user."""
    user_id = get_current_user_id(request)
    supabase = get_supabase()
    
    # Build query with joins
    query = supabase.table('screened_deals').select(
        '*, deal_links!inner(url, source, email_id, raw_emails(subject, from_address, received_at))'
    ).eq('user_id', user_id)
    
    if score_filter:
        query = query.eq('score', score_filter)
    
    # Get total count
    count_result = supabase.table('screened_deals').select('id', count='exact').eq('user_id', user_id)
    if score_filter:
        count_result = count_result.eq('score', score_filter)
    count_result = count_result.execute()
    
    # Get paginated results
    result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    
    deals = []
    for item in result.data or []:
        deal_link = item.get('deal_links', {})
        raw_email = deal_link.get('raw_emails', {}) if deal_link else {}
        
        deals.append(DealListItem(
            id=item['id'],
            source=deal_link.get('source', 'unknown'),
            url=deal_link.get('url', ''),
            email_subject=raw_email.get('subject') if raw_email else None,
            email_from=raw_email.get('from_address') if raw_email else None,
            property_name=item.get('property_name'),
            property_address=item.get('property_address'),
            price=item.get('price'),
            units=item.get('units'),
            estimated_cap_rate=item.get('estimated_cap_rate'),
            estimated_dscr=item.get('estimated_dscr'),
            estimated_cash_on_cash=item.get('estimated_cash_on_cash'),
            estimated_price_per_unit=item.get('estimated_price_per_unit'),
            score=item.get('score'),
            screening_notes=item.get('screening_notes'),
            received_at=raw_email.get('received_at') if raw_email else None,
            created_at=item['created_at']
        ))
    
    return DealListResponse(
        deals=deals,
        total=count_result.count or 0
    )

# ============================================================================
# Buy Box Endpoints
# ============================================================================

class BuyBoxSettings(BaseModel):
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    max_price_per_unit: Optional[float] = None
    min_units: Optional[int] = None
    max_units: Optional[int] = None
    min_cap_rate: Optional[float] = None
    max_cap_rate: Optional[float] = None
    min_dscr: Optional[float] = None
    min_cash_on_cash: Optional[float] = None
    max_expense_ratio: Optional[float] = None
    max_vacancy: Optional[float] = None
    min_year_built: Optional[int] = None
    target_markets: Optional[List[str]] = []
    assumed_ltv: Optional[float] = 0.75
    assumed_interest_rate: Optional[float] = 0.07
    assumed_amortization: Optional[int] = 30

@router.get("/buy-box", response_model=BuyBoxSettings)
async def get_buy_box(request: Request):
    """Get user's buy box settings."""
    user_id = get_current_user_id(request)
    buy_box = get_user_buy_box(user_id)
    return BuyBoxSettings(**buy_box)

@router.post("/buy-box", response_model=BuyBoxSettings)
async def save_buy_box(request: Request, settings: BuyBoxSettings):
    """Save user's buy box settings."""
    user_id = get_current_user_id(request)
    try:
        supabase = get_supabase()
        data = {
            'user_id': user_id,
            **settings.dict(exclude_none=True),
            'updated_at': datetime.utcnow().isoformat()
        }
        # Upsert
        supabase.table('user_buy_box').upsert(data, on_conflict='user_id').execute()
    except Exception as e:
        # In local/dev without Supabase, just log and return settings so UI keeps working.
        log.warning(f"[EmailDeals] save_buy_box could not persist to Supabase, returning settings only: {e}")

    return settings

@router.delete("/disconnect")
async def disconnect_gmail(request: Request):
    """Disconnect Gmail integration."""
    user_id = get_current_user_id(request)
    supabase = get_supabase()
    
    # Update status to revoked
    supabase.table('email_integrations').update({
        'status': 'revoked',
        'access_token': None,
        'refresh_token': None,
        'updated_at': datetime.utcnow().isoformat()
    }).eq('user_id', user_id).eq('provider', 'gmail').execute()
    
    return {"success": True, "message": "Gmail disconnected"}


# ============================================================================
# System-level Inbound Inbox via IMAP + App Password
# ============================================================================

INBOUND_EMAIL = os.getenv("INBOUND_GMAIL_ADDRESS", "dealsniperinbound@gmail.com")
INBOUND_APP_PASSWORD = os.getenv("INBOUND_GMAIL_APP_PASSWORD", "")


def get_imap_connection():
    """Connect to the inbound Gmail inbox via IMAP + App Password.

    Requires env vars INBOUND_GMAIL_ADDRESS and INBOUND_GMAIL_APP_PASSWORD.
    Returns an authenticated IMAP4_SSL connection or None.
    """
    addr = os.getenv("INBOUND_GMAIL_ADDRESS")
    pwd = os.getenv("INBOUND_GMAIL_APP_PASSWORD")
    if not addr or not pwd:
        print(f"[IMAP] ❌ Connection failed — INBOUND_GMAIL_ADDRESS={'SET' if addr else 'MISSING'}, INBOUND_GMAIL_APP_PASSWORD={'SET' if pwd else 'MISSING'}")
        return None
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(addr, pwd)
        print(f"[IMAP] ✅ Connected as {addr}")
        return mail
    except Exception as e:
        log.error("[EmailDeals] IMAP login failed: %s", e)
        print(f"[IMAP] ❌ Login failed for {addr}: {e}")
        return None


def _safe_decode_header(raw):
    """Decode an RFC-2047 encoded email header value."""
    if not raw:
        return ""
    parts = _decode_header_raw(raw)
    decoded = []
    for data, charset in parts:
        if isinstance(data, bytes):
            decoded.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(data)
    return " ".join(decoded)


@router.get("/sync-inbound")
async def sync_inbound_inbox():
    """Sync the shared inbound inbox via IMAP + App Password.

    No OAuth needed. Uses INBOUND_GMAIL_ADDRESS and INBOUND_GMAIL_APP_PASSWORD
    env vars. Matches each sender to a user profile and creates underwrite jobs.
    """
    mail = get_imap_connection()
    if not mail:
        raise HTTPException(
            status_code=500,
            detail="Inbound inbox not configured. Set INBOUND_GMAIL_ADDRESS and INBOUND_GMAIL_APP_PASSWORD env vars on Render.",
        )

    try:
        # Search multiple folders: INBOX and Spam
        folders_to_check = ["INBOX", "[Gmail]/Spam"]
        since_date = (datetime.utcnow() - timedelta(days=7)).strftime("%d-%b-%Y")

        all_uid_folder_pairs = []  # list of (uid_bytes, folder_name)

        for folder in folders_to_check:
            try:
                st, _ = mail.select(folder)
                if st != "OK":
                    print(f"[DEBUG] Could not select folder {folder!r}, skipping")
                    continue
                status, data = mail.uid("search", None, f"(SINCE {since_date})")
                if status == "OK" and data[0]:
                    folder_uids = data[0].split()
                    print(f"[DEBUG] Folder {folder!r}: found {len(folder_uids)} emails")
                    for uid_bytes in folder_uids:
                        all_uid_folder_pairs.append((uid_bytes, folder))
                else:
                    print(f"[DEBUG] Folder {folder!r}: 0 emails")
            except Exception as folder_err:
                print(f"[DEBUG] Error checking folder {folder!r}: {folder_err}")

        supabase = get_supabase()
        synced = 0
        already_known = 0
        skipped_no_user = 0
        debug_log = []  # collect debug info to return in response

        for uid_bytes, folder in all_uid_folder_pairs:
            uid_str = uid_bytes.decode()
            # Use folder:uid as dedup key so INBOX uid=1 and Spam uid=1 don't collide
            dedup_key = f"{folder}:{uid_str}"

            # Deduplicate by provider_message_id
            existing = supabase.table("raw_emails").select("id").eq("provider_message_id", dedup_key).execute()
            if existing.data:
                already_known += 1
                continue

            # Select the correct folder before fetching
            mail.select(folder)

            # Fetch headers only (lightweight)
            st, msg_data = mail.uid("fetch", uid_bytes, "(RFC822.HEADER)")
            if st != "OK" or not msg_data or not msg_data[0]:
                continue

            header_bytes = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
            msg = email_mod.message_from_bytes(header_bytes)

            from_raw = _safe_decode_header(msg.get("From", ""))
            subject = _safe_decode_header(msg.get("Subject", ""))
            date_str = msg.get("Date", "")
            message_id_header = msg.get("Message-ID", "")

            # Parse date
            received_at = None
            try:
                received_at = parsedate_to_datetime(date_str).isoformat()
            except Exception:
                pass

            # Match sender to profile (try email column, case-insensitive)
            email_match = re.search(r"<([^>]+)>", from_raw)
            sender_email = (email_match.group(1) if email_match else from_raw).strip().lower()

            # ── DEBUG LOGGING ──
            print(f"\n{'='*60}")
            print(f"[DEBUG] Processing email UID: {uid_str} (folder: {folder})")
            print(f"[DEBUG] Raw From header : {from_raw!r}")
            print(f"[DEBUG] Extracted sender : {sender_email!r}")
            print(f"[DEBUG] Sender email len : {len(sender_email)}")
            print(f"[DEBUG] Sender email bytes: {sender_email.encode()!r}")
            log.info("[EmailDeals][DEBUG] UID=%s folder=%s from_raw=%r sender_email=%r", uid_str, folder, from_raw, sender_email)
            email_debug = {"uid": uid_str, "folder": folder, "from_raw": from_raw, "sender_email": sender_email}

            matched_user_id = None
            try:
                # Primary: match against profiles.email
                profile_result = supabase.table("profiles").select("id, email").ilike("email", sender_email).execute()
                print(f"[DEBUG] ilike query email={sender_email!r}  result_count={len(profile_result.data or [])}")
                print(f"[DEBUG] ilike result data : {profile_result.data}")
                email_debug["ilike_results"] = profile_result.data
                if profile_result.data and len(profile_result.data) > 0:
                    matched_user_id = profile_result.data[0]["id"]
                    print(f"[DEBUG] ✅ MATCHED via ilike -> user_id={matched_user_id}")
                    email_debug["match"] = "ilike"
                else:
                    # Secondary: check email_aliases array column
                    print(f"[DEBUG] No primary email match, checking email_aliases...")
                    try:
                        alias_result = supabase.table("profiles").select("id, email, email_aliases").contains("email_aliases", [sender_email]).execute()
                        print(f"[DEBUG] email_aliases query result_count={len(alias_result.data or [])}")
                        print(f"[DEBUG] email_aliases result data: {alias_result.data}")
                        email_debug["alias_results"] = alias_result.data
                        if alias_result.data and len(alias_result.data) > 0:
                            matched_user_id = alias_result.data[0]["id"]
                            print(f"[DEBUG] ✅ MATCHED via email_aliases -> user_id={matched_user_id}")
                            email_debug["match"] = "alias"
                    except Exception as alias_err:
                        print(f"[DEBUG] email_aliases lookup error (column may not exist yet): {alias_err}")
                        email_debug["alias_error"] = str(alias_err)

                if not matched_user_id:
                    # Fallback: broad scan of all profiles
                    log.info("[EmailDeals] No profile match for %s, trying broader lookup", sender_email)
                    broad = supabase.table("profiles").select("id, email, email_aliases").execute()
                    print(f"[DEBUG] Broad lookup: {len(broad.data or [])} profiles found")
                    all_profile_emails = []
                    for row in (broad.data or []):
                        row_email = row.get("email", "")
                        row_email_norm = row_email.strip().lower() if row_email else ""
                        row_aliases = row.get("email_aliases") or []
                        row_aliases_norm = [a.strip().lower() for a in row_aliases if a]
                        all_profile_emails.append({"id": row.get("id", "")[:8], "email": row_email, "normalized": row_email_norm, "aliases": row_aliases_norm})
                        print(f"[DEBUG]   Profile id={row.get('id')[:8]}...  email={row_email!r}  aliases={row_aliases_norm}  match_email={row_email_norm == sender_email}  match_alias={sender_email in row_aliases_norm}")
                        if row_email and row_email_norm == sender_email:
                            matched_user_id = row["id"]
                            print(f"[DEBUG] ✅ MATCHED via broad email lookup -> user_id={matched_user_id}")
                            email_debug["match"] = "broad"
                            break
                        if sender_email in row_aliases_norm:
                            matched_user_id = row["id"]
                            print(f"[DEBUG] ✅ MATCHED via broad alias lookup -> user_id={matched_user_id}")
                            email_debug["match"] = "broad_alias"
                            break
                    email_debug["all_profiles"] = all_profile_emails
                    if not matched_user_id:
                        print(f"[DEBUG] ❌ NO MATCH found in any profile for sender={sender_email!r}")
                        email_debug["match"] = "NONE"
            except Exception as e:
                log.warning("[EmailDeals] Profile lookup failed for %s: %s", sender_email, e)
                print(f"[DEBUG] ❌ EXCEPTION during lookup: {e}")
                email_debug["error"] = str(e)

            debug_log.append(email_debug)

            if not matched_user_id:
                # No registered user matches this sender — skip
                skipped_no_user += 1
                log.info("[EmailDeals] Skipping email from %s — no matching profile", sender_email)
                print(f"[DEBUG] SKIPPED — sender_email={sender_email!r} not found in profiles")
                print(f"{'='*60}\n")
                continue
            print(f"{'='*60}\n")

            # Store raw email
            email_data = {
                "user_id": matched_user_id,
                "provider_message_id": dedup_key,
                "thread_id": message_id_header,
                "from_address": from_raw,
                "subject": subject,
                "snippet": "",
                "received_at": received_at,
                "raw_payload": {},
                "processed": False,
            }

            insert_result = supabase.table("raw_emails").insert(email_data).execute()
            raw_email_row = (insert_result.data or [{}])[0]
            raw_email_id = raw_email_row.get("id")

            # Create underwrite job under matched user
            try:
                job_record = {
                    "user_id": matched_user_id,
                    "raw_email_id": raw_email_id,
                    "from_address": from_raw,
                    "to_address": None,
                    "subject": subject,
                    "thread_id": message_id_header,
                    "provider_message_id": dedup_key,
                    "attachments": [],
                    "status": "pending",
                }
                supabase.table("email_underwrite_jobs").insert(job_record).execute()
            except Exception as job_err:
                log.warning("[EmailDeals] Failed to create job for uid %s: %s", uid_str, job_err)

            synced += 1

        mail.logout()

        total_scanned = len(all_uid_folder_pairs)
        log.info("[EmailDeals] sync-inbound: scanned=%d synced=%d already_known=%d skipped_no_user=%d",
                 total_scanned, synced, already_known, skipped_no_user)

        print(f"\n{'#'*60}")
        print(f"[DEBUG] SYNC SUMMARY: scanned={total_scanned} synced={synced} already_known={already_known} skipped_no_user={skipped_no_user}")
        print(f"{'#'*60}\n")

        return {
            "success": True,
            "total_scanned": total_scanned,
            "synced": synced,
            "already_known": already_known,
            "skipped_no_user": skipped_no_user,
            "debug_log": debug_log,
            "message": f"Scanned {total_scanned} emails: {synced} new, {already_known} already known, {skipped_no_user} unmatched sender.",
        }

    except Exception as e:
        try:
            mail.logout()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error syncing inbound inbox: {str(e)}")
