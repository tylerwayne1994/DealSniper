// Polls backend for queued spreadsheet commands and applies them via MaxSpreadsheetAgent

const MaxAgentListener = (() => {
  let intervalId = null;
  let sessionId = null;
  let apiBase = '/api';
  const fallbacks = ['http://localhost:8010/api', 'http://127.0.0.1:8010/api'];

  const genId = () => {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return 'sess_' + Math.random().toString(36).slice(2) + Date.now();
    }
  };

  const getSessionId = () => {
    if (sessionId) return sessionId;
    try {
      const existing = localStorage.getItem('maxSessionId');
      if (existing) {
        sessionId = existing;
        return sessionId;
      }
      sessionId = genId();
      localStorage.setItem('maxSessionId', sessionId);
      return sessionId;
    } catch (_) {
      sessionId = genId();
      return sessionId;
    }
  };

  const setApiBase = (base) => {
    if (typeof base === 'string' && base.trim()) apiBase = base.trim();
  };

  const pollOnce = async () => {
    const sid = getSessionId();
    const basesToTry = [apiBase, ...fallbacks];
    for (let i = 0; i < basesToTry.length; i++) {
      const base = basesToTry[i];
      try {
        const url = `${base}/spreadsheet/commands?sessionId=${encodeURIComponent(sid)}`;
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        if (!res.ok) {
          if (res.status === 404 && i === 0) {
            console.info('[LISTENER] /api 404, trying backend fallback');
            continue;
          }
          console.warn('[LISTENER] Poll failed with status:', res.status);
          return; // other errors: bail out this tick
        }
        const data = await res.json();
        const cmds = Array.isArray(data?.commands) ? data.commands : [];
        if (cmds.length > 0) {
          console.log('[LISTENER] Received', cmds.length, 'commands:', cmds);
          if (window.MaxSpreadsheetAgent) {
            console.log('[LISTENER] Applying commands via MaxSpreadsheetAgent...');
            const result = await window.MaxSpreadsheetAgent.applyCommands(cmds);
            console.log('[LISTENER] Commands applied, result:', result);
          } else {
            console.error('[LISTENER] MaxSpreadsheetAgent not available!');
          }
        }
        return; // success, stop trying fallbacks for this tick
      } catch (e) {
        if (i === basesToTry.length - 1) {
          console.warn('[LISTENER] Poll error', e);
        }
        // try next base
      }
    }
  };

  const start = (opts = {}) => {
    if (intervalId) return;
    if (opts.apiBase) setApiBase(opts.apiBase);
    intervalId = setInterval(pollOnce, opts.intervalMs || 1500);
    // run an immediate poll
    pollOnce();
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { start, stop, getSessionId, setApiBase };
})();

export default MaxAgentListener;
