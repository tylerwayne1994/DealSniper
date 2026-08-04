// Underwriting Model tab — mounts the standalone CRE Underwriting spreadsheet
// engine (public/spreadsheet/cre-underwriting.js, a dependency-free vanilla
// JS Google-Sheets-style workbook) inside the Results page, pre-populated
// with this deal's real parsed data. Includes a chat box that turns plain-
// English instructions ("change the cap rate to 6%") into cell edits via
// the backend (/v2/underwriting-model/chat-edit), applied through the same
// Workbook.setCell()/renderGrid() path a manual edit would use.
import React, { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { mapScenarioDataToInputs } from '../../lib/underwritingModelMapping';

const ENGINE_SRC = '/spreadsheet/cre-underwriting.js';
const MOUNT_ID = 'cre-underwriting-model-mount';

function loadEngineScript() {
  if (window.CREUnderwriting) return Promise.resolve();
  if (window.__creUnderwritingLoading) return window.__creUnderwritingLoading;
  window.__creUnderwritingLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ENGINE_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the underwriting spreadsheet engine'));
    document.body.appendChild(script);
  });
  return window.__creUnderwritingLoading;
}

/** Applies {a1, value}-shaped cell edits directly via the Workbook API
 * (same mechanism the UI itself uses on a manual edit), preserving each
 * cell's existing number format/style, then repaints the grid. */
function applyCellEdits(app, edits) {
  if (!app || !edits?.length) return;
  edits.forEach(({ a1, value }) => {
    const existing = app.wb.cell('Inputs', a1) || {};
    app.wb.setCell('Inputs', a1, { v: value, fmt: existing.fmt, style: existing.style });
  });
  app.renderGrid();
}

export default function UnderwritingModelTab({ scenarioData, deal, dealId }) {
  const mountRef = useRef(null);
  const appRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLog, setChatLog] = useState([]); // [{role, text}]

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadEngineScript()
      .then(() => {
        if (cancelled || !window.CREUnderwriting) return;
        const app = window.CREUnderwriting.init({ mountId: MOUNT_ID });
        appRef.current = app;
        const edits = mapScenarioDataToInputs(scenarioData, deal);
        applyCellEdits(app, edits.map((c) => ({ a1: c.a1, value: c.value })));
        setStatus('ready');
      })
      .catch((e) => {
        if (!cancelled) { setError(e.message); setStatus('error'); }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const handleReset = () => {
    if (!appRef.current || !window.CREUnderwriting) return;
    // Re-mount fresh (clears any manual edits) then re-apply the deal's real data.
    const mount = document.getElementById(MOUNT_ID);
    if (mount) mount.innerHTML = '';
    const app = window.CREUnderwriting.init({ mountId: MOUNT_ID });
    appRef.current = app;
    const edits = mapScenarioDataToInputs(scenarioData, deal);
    applyCellEdits(app, edits.map((c) => ({ a1: c.a1, value: c.value })));
  };

  const handleChatSend = async () => {
    const message = chatInput.trim();
    if (!message || chatBusy || !appRef.current) return;
    setChatBusy(true);
    setChatLog((log) => [...log, { role: 'user', text: message }]);
    setChatInput('');
    try {
      const res = await fetch(`${API_BASE_URL}/v2/underwriting-model/chat-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to process instruction');
      if (data.edits?.length) {
        applyCellEdits(appRef.current, data.edits.map((e) => ({ a1: e.cell, value: e.value })));
      }
      setChatLog((log) => [...log, { role: 'assistant', text: data.reply || (data.edits?.length ? 'Updated.' : "Didn't find a matching field to change.") }]);
    } catch (e) {
      setChatLog((log) => [...log, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Underwriting Model</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            A full spreadsheet model of this deal, pre-filled from the parsed data. Edit cells directly, or tell Max below.
          </div>
        </div>
        <button
          onClick={handleReset}
          title="Re-apply this deal's parsed data (discards manual edits)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
            color: '#374151', cursor: 'pointer',
          }}
        >
          <RotateCcw size={13} /> Reset to Deal Data
        </button>
      </div>

      {status === 'error' && (
        <div style={{ padding: 16, fontSize: 13, color: '#b91c1c', background: '#fef2f2', borderRadius: 8 }}>
          Failed to load the underwriting model: {error}
        </div>
      )}
      {status === 'loading' && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading model…</div>
      )}

      <div
        id={MOUNT_ID}
        ref={mountRef}
        style={{ flex: 1, minHeight: 480, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', display: status === 'ready' ? 'block' : 'none' }}
      />

      {status === 'ready' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafbfc' }}>
          {chatLog.length > 0 && (
            <div style={{ maxHeight: 140, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chatLog.map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: m.role === 'user' ? '#111827' : '#059669' }}>
                  <strong>{m.role === 'user' ? 'You: ' : 'Max: '}</strong>{m.text}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, padding: 10 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder='e.g. "change the exit cap rate to 6%" or "set vacancy to 7%"'
              style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#111827' }}
            />
            <button
              onClick={handleChatSend}
              disabled={chatBusy || !chatInput.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: 'none', background: '#059669', color: '#fff',
                cursor: chatBusy ? 'default' : 'pointer', opacity: chatBusy || !chatInput.trim() ? 0.6 : 1,
              }}
            >
              {chatBusy ? <Loader2 size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
