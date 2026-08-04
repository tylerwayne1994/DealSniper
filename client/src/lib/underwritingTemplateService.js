// Underwriting Templates — lets a sponsor upload their own .xlsx model and
// use it (instead of the built-in stock template) as the base workbook for
// the Underwriting Model tab. Mirrors investorAccessService.js's auth
// pattern (X-User-ID header), except upload uses multipart/form-data.
import { supabase } from './supabase';
import { API_BASE_URL } from '../config/api';

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

const BASE = `${API_BASE_URL}/api/underwriting-template`;

/** Returns the caller's saved template metadata, or null if none saved. */
export async function getMyUnderwritingTemplate() {
  const userId = await getUserId();
  const res = await fetch(BASE, { headers: { 'X-User-ID': userId } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to load template');
  return data.template;
}

/** Uploads (or replaces) the caller's default underwriting template. */
export async function uploadMyUnderwritingTemplate(file) {
  const userId = await getUserId();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(BASE, { method: 'POST', headers: { 'X-User-ID': userId }, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to upload template');
  return data.template;
}

/** Removes the caller's saved template — reverts to the stock template. */
export async function deleteMyUnderwritingTemplate() {
  const userId = await getUserId();
  const res = await fetch(BASE, { method: 'DELETE', headers: { 'X-User-ID': userId } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to remove template');
  return data.deleted;
}
