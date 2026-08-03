// Deal Room Layouts — sponsor-side API calls for arranging the widget-based
// sections of the investor-facing Deal Room (section order, widgets, theme).
// Mirrors investorAccessService.js's auth pattern exactly (X-User-ID header).
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

const BASE = `${API_BASE_URL}/api/deal-room-layout`;

/** Sponsor-side: load the saved layout for a deal, or a generated default
 * (not yet persisted) if the sponsor hasn't customized it yet. */
export async function getDealRoomLayout(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/${dealId}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to load deal room layout');
  return data; // { layout, is_default }
}

/** Sponsor-side: save the layout (sections + theme) for a deal. Widget
 * placements are validated server-side against the per-section whitelist. */
export async function saveDealRoomLayout(dealId, { sections, theme } = {}) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/${dealId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ sections: sections || [], theme: theme || {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to save deal room layout');
  return data.layout;
}
