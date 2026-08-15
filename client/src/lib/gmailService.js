// Gmail connect/send service — lets a user connect their own Gmail so the
// app can send drafted emails (LOI/due-diligence findings) directly, not
// just show text to copy-paste. See backend/gmail_integration.py.
import { API_ENDPOINTS } from '../config/api';

export async function getGmailStatus(userId) {
  if (!userId) return { connected: false, email: null };
  try {
    const res = await fetch(API_ENDPOINTS.gmailStatus(userId));
    return await res.json();
  } catch {
    return { connected: false, email: null };
  }
}

export function openConnectGmailPopup(userId, onDone) {
  const width = 500, height = 620;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const authUrl = `${API_ENDPOINTS.authGoogle}?user_id=${encodeURIComponent(userId)}`;
  window.open(authUrl, 'gmail_oauth', `width=${width},height=${height},left=${left},top=${top}`);

  // accounts.google.com sets Cross-Origin-Opener-Policy: same-origin, which
  // permanently blocks the opener from reading popup.closed (the browser
  // logs a console warning on every read attempt, whether or not it's
  // wrapped in try/catch -- so don't poll it at all here). The OAuth
  // callback page instead posts a message right before it closes itself.
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(giveUpTimer);
    window.removeEventListener('message', onMessage);
    if (onDone) onDone();
  };
  const onMessage = (event) => {
    if (event.data && event.data.type === 'gmail-oauth-done') finish();
  };
  window.addEventListener('message', onMessage);

  // Fallback in case the popup is closed manually before completing the
  // flow (no postMessage will ever arrive in that case).
  const giveUpTimer = setTimeout(finish, 5 * 60 * 1000);
}

export async function disconnectGmail(userId) {
  const res = await fetch(API_ENDPOINTS.gmailDisconnect, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  return res.json();
}

export async function sendGmail(userId, to, subject, body) {
  const res = await fetch(API_ENDPOINTS.gmailSend, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, to, subject, body }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to send email');
  return json;
}

// Called from AuthCallbackPage.js right after a "Continue with Google"
// sign-in/sign-up — Supabase already did the OAuth dance (with gmail.send
// requested as an extra scope), so we just forward its provider token
// instead of making the user click "Connect Gmail" separately.
export async function storeSupabaseGoogleToken(userId, providerToken, providerRefreshToken) {
  if (!userId || !providerToken) return;
  try {
    await fetch(API_ENDPOINTS.gmailStoreSupabaseToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        access_token: providerToken,
        refresh_token: providerRefreshToken || null,
      }),
    });
  } catch (e) {
    console.warn('Failed to auto-connect Gmail from Google sign-in:', e);
  }
}
