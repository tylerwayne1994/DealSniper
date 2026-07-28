import { API_BASE_URL } from '../config/api';

/**
 * Free-form Q&A chat scoped to one deal. The backend grounds every answer in
 * the deal's own real data (property/financing/strategy + the platform's
 * calculated returns) plus real local-market data (Census/FMR/migration/cap
 * rate) for the deal's address — the same pipeline used by the Market
 * Analysis tab and the Deal Room narrative. Stateless per call: pass the
 * running conversation back as `history` each turn.
 *
 * @param {Object} params
 * @param {Object} params.scenarioData
 * @param {Object} [params.calculations]
 * @param {string} params.message
 * @param {Array<{role: 'user'|'assistant', content: string}>} [params.history]
 * @returns {Promise<string>} the assistant's reply text
 */
export async function sendDealChatMessage({ scenarioData, calculations, message, history = [] }) {
  const res = await fetch(`${API_BASE_URL}/api/deal-room/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioData, calculations, message, history }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Deal chat failed (${res.status})`);
  }
  return data.reply || '';
}
