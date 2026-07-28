// Deal Chat — button + slide-over panel for free-form Q&A about one deal.
// Grounded in the deal's own real data (property/financing/strategy + the
// platform's calculated returns) plus real local-market data (Census/FMR/
// migration/cap rate) for the deal's address, via the same backend pipeline
// as the Deal Room narrative and Market Analysis tab. Nothing is invented —
// the model is instructed to say so if a data point isn't available.
import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { sendDealChatMessage } from '../lib/dealChatService';

export default function DealChat({ scenarioData, calculations }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending, open]);

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const reply = await sendDealChatMessage({ scenarioData, calculations, message, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message || 'Something went wrong asking about this deal.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151',
          whiteSpace: 'nowrap',
        }}
        title="Ask questions about this deal and its local market"
      >
        <MessageCircle size={14} />
        Ask About This Deal
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
          />
          <div
            style={{
              position: 'relative', width: 420, maxWidth: '92vw', height: '100%',
              backgroundColor: '#ffffff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={16} color="#374151" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Ask About This Deal</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {messages.length === 0 && !sending && (
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  Ask anything about this deal's numbers, strategy, or the local market —
                  e.g. "What's the DSCR here?" or "How does rent compare to the market?"
                  Answers are grounded in this deal's real data and real local-market data
                  for its address (Census, FMR, migration, cap rate).
                </div>
              )}
              {messages.map((turn, i) => (
                turn.role === 'user' ? (
                  <div key={i} style={{ marginBottom: 10, textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '85%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 4, backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe', fontSize: 12, color: '#1e3a8a',
                    }}>
                      {turn.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '92%',
                      padding: '8px 10px', borderRadius: 4, backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {turn.content}
                    </div>
                  </div>
                )
              ))}
              {sending && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Thinking…</div>
              )}
              {error && (
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{error}</div>
              )}
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: 10, flexShrink: 0, backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about this deal or its market…"
                  style={{
                    flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 4,
                    border: '1px solid #d1d5db', color: '#111827',
                  }}
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 12px', borderRadius: 4, border: '1px solid #d1d5db',
                    backgroundColor: sending || !input.trim() ? '#f3f4f6' : '#111827',
                    color: sending || !input.trim() ? '#9ca3af' : '#ffffff',
                    cursor: sending || !input.trim() ? 'default' : 'pointer',
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
