// Investor Access Links — API calls for the sponsor-side "share with an
// investor" flow, plus the public code-redeem call used by the unauthenticated
// investor gateway (no Supabase session required for that one).
import { supabase } from './supabase';
import { API_BASE_URL } from '../config/api';

async function getHeaders() {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'X-User-ID': userId,
  };
}

const BASE = `${API_BASE_URL}/api/investor-access`;

/** Sponsor-side: create a new access code for a deal. */
export async function createInvestorAccessLink(dealId, { investorName, investorEmail, expiresDays } = {}) {
  const headers = await getHeaders();
  const res = await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      deal_id: dealId,
      investor_name: investorName || null,
      investor_email: investorEmail || null,
      expires_days: expiresDays || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to create access link');
  return data.link;
}

/** Sponsor-side: list access links already created for a deal. */
export async function listInvestorAccessLinks(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to load access links');
  return data.links || [];
}

/** Sponsor-side: revoke an access link so its code stops working. */
export async function revokeInvestorAccessLink(linkId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/${linkId}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to revoke access link');
  return data;
}

/**
 * Public: redeem an access code. No Supabase session/auth header — the code
 * itself is the credential. Returns { deal, allocations, distributions, investorName }
 * or throws with a clean message if the code is invalid/revoked/expired.
 */
export async function redeemInvestorAccessCode(code) {
  const res = await fetch(`${BASE}/redeem/${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'That access code is not valid.');
  return data;
}
