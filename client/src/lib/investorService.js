// Investor Portal Service - API calls for LP dashboard
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

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

const BASE = `${API_BASE_URL}/api/investors`;

// ── Investors ──
export async function listInvestors() {
  const headers = await getHeaders();
  const res = await fetch(BASE, { headers });
  if (!res.ok) throw new Error('Failed to load investors');
  return (await res.json()).investors;
}

export async function createInvestor(data) {
  const headers = await getHeaders();
  const res = await fetch(BASE, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create investor');
  return (await res.json()).investor;
}

export async function updateInvestor(investorId, data) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/${investorId}`, { method: 'PUT', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update investor');
  return (await res.json()).investor;
}

export async function deleteInvestor(investorId) {
  const headers = await getHeaders();
  await fetch(`${BASE}/${investorId}`, { method: 'DELETE', headers });
}

// ── Deal Allocations ──
export async function listAllocations(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/allocations`, { headers });
  if (!res.ok) throw new Error('Failed to load allocations');
  return (await res.json()).allocations;
}

export async function createAllocation(dealId, data) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/allocations`, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create allocation');
  return (await res.json()).allocation;
}

export async function updateAllocation(dealId, allocationId, data) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/allocations/${allocationId}`, { method: 'PUT', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update allocation');
  return (await res.json()).allocation;
}

export async function deleteAllocation(dealId, allocationId) {
  const headers = await getHeaders();
  await fetch(`${BASE}/deals/${dealId}/allocations/${allocationId}`, { method: 'DELETE', headers });
}

// ── Distributions ──
export async function listDistributions(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/distributions`, { headers });
  if (!res.ok) throw new Error('Failed to load distributions');
  return (await res.json()).distributions;
}

export async function createDistribution(dealId, data) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/distributions`, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create distribution');
  return (await res.json()).distribution;
}

export async function deleteDistribution(distId) {
  const headers = await getHeaders();
  await fetch(`${BASE}/distributions/${distId}`, { method: 'DELETE', headers });
}

// ── Documents (K-1, reports) ──
export async function listDocuments(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/documents`, { headers });
  if (!res.ok) throw new Error('Failed to load documents');
  return (await res.json()).documents;
}

export async function uploadDocument(dealId, file, dealInvestorId, documentType = 'k1', taxYear = null, quarter = null) {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('deal_investor_id', dealInvestorId);
  formData.append('document_type', documentType);
  if (taxYear) formData.append('tax_year', taxYear);
  if (quarter) formData.append('quarter', quarter);

  const res = await fetch(`${BASE}/deals/${dealId}/documents`, {
    method: 'POST',
    headers: { 'X-User-ID': userId },
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return (await res.json()).document;
}

export async function deleteDocument(docId) {
  const headers = await getHeaders();
  await fetch(`${BASE}/documents/${docId}`, { method: 'DELETE', headers });
}

// ── Quarterly Updates ──
export async function listUpdates(dealId) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/updates`, { headers });
  if (!res.ok) throw new Error('Failed to load updates');
  return (await res.json()).updates;
}

export async function createUpdate(dealId, data) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/deals/${dealId}/updates`, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create update');
  return (await res.json()).update;
}

export async function deleteUpdate(updateId) {
  const headers = await getHeaders();
  await fetch(`${BASE}/updates/${updateId}`, { method: 'DELETE', headers });
}

// ── Dashboard Summary ──
export async function getDashboardSummary() {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}/dashboard`, { headers });
  if (!res.ok) throw new Error('Failed to load dashboard');
  return await res.json();
}
