import { API_BASE_URL } from '../config/api';

/**
 * Back of the Napkin — standalone chat-based quick underwrite driven
 * entirely by the CRE Agent Skills library the backend reads from disk
 * (backend/cre-agent-skills-main/skills). Fully separate from the
 * platform's real v2 underwriting engine and deal storage — nothing here
 * is persisted, and no deal record is created or touched.
 */

/**
 * Upload a deal document (PDF/XLSX/CSV/TXT) and get back its raw extracted
 * text, to be included as context on the next chat message.
 * @param {File} file
 * @returns {Promise<{ filename: string, text: string }>}
 */
export async function uploadNapkinDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/napkin/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Upload failed (${res.status})`);
  }
  return { filename: data.filename, text: data.text };
}

/**
 * Send a chat message grounded in the CRE Agent Skills library and (if
 * present) the uploaded deal document's extracted text.
 * @param {Object} params
 * @param {string} [params.documentText]
 * @param {string} params.message
 * @param {Array<{role: 'user'|'assistant', content: string}>} [params.history]
 * @returns {Promise<string>} the assistant's reply text
 */
export async function sendNapkinChatMessage({ documentText, message, history = [] }) {
  const res = await fetch(`${API_BASE_URL}/api/napkin/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentText, message, history }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Napkin chat failed (${res.status})`);
  }
  return data.reply || '';
}

/**
 * The primary Back of the Napkin flow: turn an uploaded deal document's
 * extracted text straight into a full structured underwrite report (OM
 * issues, market outlook, strategy/play, recommended purchase price,
 * investor payback feasibility) — no chat round-trip required.
 * @param {string} documentText
 * @returns {Promise<Object>} the structured report object
 */
export async function generateNapkinReport(documentText) {
  const res = await fetch(`${API_BASE_URL}/api/napkin/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Napkin report failed (${res.status})`);
  }
  return data.report;
}

