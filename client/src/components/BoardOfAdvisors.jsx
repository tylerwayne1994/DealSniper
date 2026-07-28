// AI Board of Advisors — button + slide-over panel.
// Convenes real-estate investor personas (read from backend/board_of_advisors)
// to deliberate a deal's real numbers and return a clean, structured
// recommendation. No chain-of-thought is ever rendered — only the finished
// positions/arguments the backend returns.
import React, { useState } from 'react';
import { Users, X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const LEAN_COLORS = {
  INVEST: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  PASS: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  'INVEST WITH CONDITIONS': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
};

function leanStyle(lean) {
  return LEAN_COLORS[lean] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: '#111827', textAlign: 'left',
        }}
      >
        {title}
        {open ? <ChevronUp size={15} color="#9ca3af" /> : <ChevronDown size={15} color="#9ca3af" />}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

export default function BoardOfAdvisors({ dealId, scenarioData, analysis }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [chatTarget, setChatTarget] = useState('All');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  const runBoard = async () => {
    setOpenPanel(true);
    if (result || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${dealId || 'draft'}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioData, analysis }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Board of Advisors failed to respond.');
      }
      setResult(data);
    } catch (e) {
      setError(e.message || 'Something went wrong reaching the board.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setResult(null);
    setError(null);
    setChatMessages([]);
    setChatError(null);
    runBoard();
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatSending || !result) return;
    const convenedNames = (result.convened || []).map(c => c.advisor);
    const userTurn = { role: 'user', content: message };
    const nextHistory = [...chatMessages, userTurn];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatSending(true);
    setChatError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/v2/deals/${dealId || 'draft'}/board/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioData, analysis, convened: convenedNames,
          target: chatTarget, message, history: chatMessages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'The board could not respond.');
      }
      setChatMessages(prev => [...prev, { role: 'board', replies: data.replies || [] }]);
    } catch (e) {
      setChatError(e.message || 'Something went wrong reaching the board.');
    } finally {
      setChatSending(false);
    }
  };

  return (
    <>
      <button
        onClick={runBoard}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151',
          whiteSpace: 'nowrap',
        }}
        title="Get a recommendation from an AI board of veteran real-estate investors"
      >
        <Users size={14} />
        Board of Advisors
      </button>

      {openPanel && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            onClick={() => setOpenPanel(false)}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
          />
          <div
            style={{
              position: 'relative', width: 460, maxWidth: '92vw', height: '100%',
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
                <Users size={16} color="#374151" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Board of Advisors</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {result && !loading && (
                  <button
                    onClick={refresh}
                    style={{
                      fontSize: 11, fontWeight: 600, color: '#374151', background: 'none',
                      border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                    }}
                  >
                    Re-convene
                  </button>
                )}
                <button
                  onClick={() => setOpenPanel(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                  The board is reviewing the deal's numbers…
                </div>
              )}

              {error && !loading && (
                <div style={{ padding: 16 }}>
                  <div style={{
                    padding: 12, borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                    color: '#b91c1c', fontSize: 13,
                  }}>
                    {error}
                  </div>
                  <button
                    onClick={refresh}
                    style={{
                      marginTop: 10, fontSize: 12, fontWeight: 600, color: '#374151', background: 'none',
                      border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 10px', cursor: 'pointer',
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {result && !loading && (
                <div>
                  {/* Synthesis — the headline */}
                  {result.synthesis && (
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 4,
                        fontSize: 13, fontWeight: 700,
                        backgroundColor: leanStyle(result.synthesis.recommendation).bg,
                        color: leanStyle(result.synthesis.recommendation).text,
                        border: `1px solid ${leanStyle(result.synthesis.recommendation).border}`,
                      }}>
                        {result.synthesis.recommendation}
                      </div>
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>
                        {result.synthesis.confidence} confidence
                      </span>
                      <p style={{ fontSize: 13, color: '#374151', marginTop: 10, lineHeight: 1.5 }}>
                        {result.synthesis.rationale}
                      </p>
                      {result.synthesis.conditions?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Conditions</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                            {result.synthesis.conditions.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {result.synthesis.keyRisks?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Key risks</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                            {result.synthesis.keyRisks.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Creative structuring — concrete alternative deal terms */}
                  {result.creativeStructuring?.length > 0 && (
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f0f9ff' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#075985', marginBottom: 8 }}>
                        CREATIVE STRUCTURING OPTIONS
                      </div>
                      {result.creativeStructuring.map((c, i) => (
                        <div key={i} style={{ marginBottom: i < result.creativeStructuring.length - 1 ? 12 : 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{c.idea}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{c.advisor}</div>
                          <div style={{ fontSize: 12, color: '#374151' }}>{c.mechanics}</div>
                          {c.impact && (
                            <div style={{ fontSize: 11, color: '#0369a1', marginTop: 2 }}>{c.impact}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dissent — preserved, highlighted */}
                  {result.dissent?.length > 0 && (
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', backgroundColor: '#fffbeb' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                        STRONGEST DISSENT
                      </div>
                      {result.dissent.map((d, i) => (
                        <div key={i} style={{ marginBottom: i < result.dissent.length - 1 ? 10 : 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{d.advisor}</div>
                          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{d.objection}</div>
                          {d.whyItMatters && (
                            <div style={{ fontSize: 11, color: '#78716c', marginTop: 2, fontStyle: 'italic' }}>{d.whyItMatters}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Convened */}
                  {result.convened?.length > 0 && (
                    <Section title={`Convened (${result.convened.length})`} defaultOpen={false}>
                      {result.convened.map((c, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{c.advisor}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{c.reason}</div>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Opening positions */}
                  {result.openingPositions?.length > 0 && (
                    <Section title="Opening positions">
                      {result.openingPositions.map((p, i) => {
                        const ls = leanStyle(p.lean);
                        return (
                          <div key={i} style={{
                            marginBottom: 12,
                            padding: '10px 12px',
                            borderRadius: 4,
                            border: `1px solid ${ls.border}`,
                            borderLeft: `3px solid ${ls.text}`,
                            backgroundColor: ls.bg,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{p.advisor}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                                backgroundColor: '#ffffff', color: ls.text,
                                border: `1px solid ${ls.border}`,
                              }}>
                                {p.lean}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{p.position}</div>
                            {p.metricsCited?.length > 0 && (
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                {p.metricsCited.join(' · ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Section>
                  )}

                  {/* Debate */}
                  {result.debate?.length > 0 && (
                    <Section title="Debate" defaultOpen={false}>
                      {result.debate.map((round, ri) => (
                        <div key={ri} style={{ marginBottom: 10 }}>
                          {round.exchanges?.map((ex, ei) => (
                            <div key={ei} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
                                {ex.advisor} → {ex.challengesTo}
                              </div>
                              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{ex.argument}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Pre-mortem */}
                  {result.preMortem?.failureModes?.length > 0 && (
                    <Section title={`Pre-mortem (${result.preMortem.horizonMonths || 18} months out)`} defaultOpen={false}>
                      {result.preMortem.failureModes.map((f, i) => (
                        <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < result.preMortem.failureModes.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{f.cause}</div>
                          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{f.driver}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            Likelihood: {f.likelihood} · Mitigant: {f.mitigant}
                          </div>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Meta / disclaimer */}
                  {result.meta && (
                    <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                      {result.meta.missingDealFields?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                          Missing deal fields flagged by the board: {result.meta.missingDealFields.join(', ')}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
                        {result.meta.disclaimer}
                      </div>
                    </div>
                  )}

                  {/* Chat thread */}
                  {chatMessages.length > 0 && (
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                        CHAT WITH THE BOARD
                      </div>
                      {chatMessages.map((turn, i) => (
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
                            {(turn.replies || []).map((r, ri) => (
                              <div key={ri} style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{r.advisor}</div>
                                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{r.reply}</div>
                              </div>
                            ))}
                          </div>
                        )
                      ))}
                      {chatError && (
                        <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{chatError}</div>
                      )}
                      {chatSending && (
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>The board is replying…</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat footer — ask one or all convened advisors a follow-up */}
            {result && !loading && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: 10, flexShrink: 0, backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select
                    value={chatTarget}
                    onChange={(e) => setChatTarget(e.target.value)}
                    style={{
                      fontSize: 12, padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db',
                      backgroundColor: '#ffffff', color: '#374151',
                    }}
                  >
                    <option value="All">All advisors</option>
                    {(result.convened || []).map((c) => (
                      <option key={c.advisor} value={c.advisor}>{c.advisor}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={chatTarget === 'All' ? 'Ask the whole board a question…' : `Ask ${chatTarget} a question…`}
                    style={{
                      flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 4,
                      border: '1px solid #d1d5db', color: '#111827',
                    }}
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatSending || !chatInput.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 12px', borderRadius: 4, border: '1px solid #d1d5db',
                      backgroundColor: chatSending || !chatInput.trim() ? '#f3f4f6' : '#111827',
                      color: chatSending || !chatInput.trim() ? '#9ca3af' : '#ffffff',
                      cursor: chatSending || !chatInput.trim() ? 'default' : 'pointer',
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
