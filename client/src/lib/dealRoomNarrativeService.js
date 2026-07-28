import { API_BASE_URL } from '../config/api';

/**
 * Calls the backend to generate the Deal Room's grounded investment
 * narrative (Why This Market / Why This Asset / Upside Plays / Operational
 * Plan). The backend pulls real local-market data (population, employment,
 * migration, FMR, cap rate) for the deal's address and combines it with the
 * deal's own parsed/calculated data — nothing is invented, and any data
 * category that isn't available is simply omitted by the model.
 *
 * @param {Object} params
 * @param {Object} params.scenarioData
 * @param {Object} [params.calculations]
 * @returns {Promise<Object>} narrative object (may have some keys missing)
 */
export async function fetchDealRoomNarrative({ scenarioData, calculations }) {
  const res = await fetch(`${API_BASE_URL}/api/deal-room/narrative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioData, calculations }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Narrative generation failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Narrative generation failed');
  return data.narrative || {};
}
