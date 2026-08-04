// Underwriting Model tab — mounts the standalone CRE Underwriting spreadsheet
// engine (public/spreadsheet/cre-underwriting.js, a dependency-free vanilla
// JS Google-Sheets-style workbook) inside the Results page, pre-populated
// with this deal's real parsed data. Includes:
//  - a chat box that turns plain-English instructions ("change the cap rate
//    to 6%") into cell edits via the backend (/v2/underwriting-model/chat-edit)
//  - the ability to upload your OWN .xlsx as your default template (saved
//    per-user), used instead of the stock template on every future deal —
//    populated via a best-effort label-scan (see heuristicPopulateFromLabels)
//    since an arbitrary uploaded workbook has no known cell layout
//  - a "Save Model to Documents" button that exports the current workbook
//    and attaches it to this deal's document list
import React, { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, Loader2, Upload, FileSpreadsheet, X } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { mapScenarioDataToInputs, heuristicPopulateFromLabels } from '../../lib/underwritingModelMapping';
import { getMyUnderwritingTemplate, uploadMyUnderwritingTemplate, deleteMyUnderwritingTemplate } from '../../lib/underwritingTemplateService';
import { upsertDealDocument } from '../../lib/dealDocumentsService';

const ENGINE_SRC = '/spreadsheet/cre-underwriting.js';
const MOUNT_ID = 'cre-underwriting-model-mount';
const AUTO_SAVE_DEBOUNCE_MS = 3000;

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
function applyCellEdits(app, edits, sheet = 'Inputs') {
  if (!app || !edits?.length) return;
  edits.forEach(({ a1, value }) => {
    const existing = app.wb.cell(sheet, a1) || {};
    app.wb.setCell(sheet, a1, { v: value, fmt: existing.fmt, style: existing.style });
  });
  app.renderGrid();
}

export default function UnderwritingModelTab({ scenarioData, deal, dealId }) {
  const mountRef = useRef(null);
  const appRef = useRef(null);
  const templateInputRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const autoSavingRef = useRef(false);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [template, setTemplate] = useState(null); // { file_name, public_url, uploaded_at } | null
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // '' | 'saving' | 'saved'
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLog, setChatLog] = useState([]); // [{role, text}]

  /** Exports the live workbook and saves it as this deal's one always-current
   * "Underwriting Model" document (upsert — overwrites the same file/row
   * rather than piling up timestamped copies). Used by both the manual
   * "Save Model to Documents" button and the auto-save-on-edit below, so by
   * the time this deal is pushed to pipeline, the latest edits are already
   * saved regardless of which tab the user happens to be on at that moment. */
  const saveModelToDocuments = async (silent) => {
    if (!appRef.current || !dealId) return;
    try {
      const blob = await appRef.current.exportXlsxBlob();
      await upsertDealDocument(dealId, blob, {
        fileName: 'Underwriting_Model.xlsx',
        stableKey: 'underwriting_model.xlsx',
        category: 'underwriting_model',
      });
      if (!silent) setSaveMsg('Saved to this deal\u2019s documents.');
    } catch (err) {
      if (!silent) setSaveMsg(`Failed to save: ${err.message}`);
      throw err;
    }
  };

  /** Wraps app.renderGrid (called after every real edit: typing, paste, fill,
   * undo/redo, row/col insert-delete — see cre-underwriting.js's own
   * call sites) so any change to the model schedules a debounced auto-save,
   * without needing a live component elsewhere in the app to be watching. */
  const wireAutoSave = (app) => {
    const original = app.renderGrid.bind(app);
    app.renderGrid = (...args) => {
      original(...args);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        if (autoSavingRef.current || appRef.current !== app) return;
        autoSavingRef.current = true;
        setAutoSaveStatus('saving');
        try {
          await saveModelToDocuments(true);
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus(''), 2500);
        } catch (e) {
          console.warn('Underwriting model auto-save failed:', e);
          setAutoSaveStatus('');
        } finally {
          autoSavingRef.current = false;
        }
      }, AUTO_SAVE_DEBOUNCE_MS);
    };
  };

  /** Loads the engine, then either the sponsor's saved custom template
   * (best-effort label-scan population) or the stock template (exact
   * cell-address mapping from Phase 1). */
  const mountAndPopulate = async () => {
    await loadEngineScript();
    if (!window.CREUnderwriting) return;
    const mount = document.getElementById(MOUNT_ID);
    if (mount) mount.innerHTML = '';
    const app = window.CREUnderwriting.init({ mountId: MOUNT_ID });
    appRef.current = app;

    let myTemplate = null;
    try { myTemplate = await getMyUnderwritingTemplate(); } catch { /* not logged in / no template — fall back silently */ }

    if (myTemplate?.public_url) {
      try {
        const res = await fetch(myTemplate.public_url);
        const blob = await res.blob();
        const file = new File([blob], myTemplate.file_name, { type: blob.type });
        await app.upload(file);
        const matched = heuristicPopulateFromLabels(app, scenarioData, deal);
        setTemplate(myTemplate);
        setTemplateMsg(matched > 0
          ? `Filled ${matched} field${matched === 1 ? '' : 's'} from your template's labels.`
          : "Loaded your template — couldn't confidently match any labels to this deal's data, fill in manually.");
        wireAutoSave(app);
        return;
      } catch (e) {
        console.warn('Failed to load custom template, falling back to stock template:', e);
      }
    }

    const edits = mapScenarioDataToInputs(scenarioData, deal);
    applyCellEdits(app, edits.map((c) => ({ a1: c.a1, value: c.value })));
    wireAutoSave(app);
  };

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    mountAndPopulate()
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((e) => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => {
      cancelled = true;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const handleReset = () => {
    setTemplateMsg('');
    mountAndPopulate().catch((e) => setError(e.message));
  };

  const handleUploadTemplateClick = () => templateInputRef.current?.click();

  const handleTemplateFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTemplateBusy(true);
    setTemplateMsg('');
    try {
      const saved = await uploadMyUnderwritingTemplate(file);
      setTemplate(saved);
      await mountAndPopulate();
    } catch (err) {
      setTemplateMsg(`Failed to save template: ${err.message}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleUseStandardTemplate = async () => {
    setTemplateBusy(true);
    setTemplateMsg('');
    try {
      await deleteMyUnderwritingTemplate();
      setTemplate(null);
      await mountAndPopulate();
    } catch (err) {
      setTemplateMsg(`Failed to remove template: ${err.message}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleSaveToDocuments = async () => {
    if (!appRef.current || !dealId) return;
    setSaveBusy(true);
    setSaveMsg('');
    try {
      await saveModelToDocuments(false);
    } finally {
      setSaveBusy(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
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
            {template
              ? <>Using your template <strong>{template.file_name}</strong> — fields matched by label.</>
              : 'A full spreadsheet model of this deal, pre-filled from the parsed data.'}
            {' '}Edit cells directly, or tell Max below.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input ref={templateInputRef} type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }} onChange={handleTemplateFileChange} />
          {template ? (
            <button onClick={handleUseStandardTemplate} disabled={templateBusy} style={btnStyle()}>
              <X size={13} /> Use Standard Template
            </button>
          ) : (
            <button onClick={handleUploadTemplateClick} disabled={templateBusy} style={btnStyle()}>
              <Upload size={13} /> Upload Your Template
            </button>
          )}
          <button onClick={handleSaveToDocuments} disabled={saveBusy || status !== 'ready'} style={btnStyle()}>
            {saveBusy ? <Loader2 size={13} /> : <FileSpreadsheet size={13} />} Save Model to Documents
          </button>
          <button onClick={handleReset} title="Re-apply this deal's parsed data (discards manual edits)" style={btnStyle()}>
            <RotateCcw size={13} /> Reset to Deal Data
          </button>
        </div>
      </div>

      {(templateMsg || saveMsg || autoSaveStatus) && (
        <div style={{ fontSize: 12, color: '#374151' }}>
          {templateMsg || saveMsg || (autoSaveStatus === 'saving' ? 'Auto-saving model…' : 'Auto-saved to documents.')}
        </div>
      )}

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

function btnStyle() {
  return {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
    padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
    color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
