// "Share with Investor" — lets the sponsor generate a code that routes an
// investor straight to this deal's read-only pitch deck (via /investor).
// Lives inside DealRoomPage's Deal Room tab, next to the other actions.
import React, { useEffect, useState, useCallback } from 'react';
import { Link2, Copy, Check, X, Trash2 } from 'lucide-react';
import {
  createInvestorAccessLink,
  listInvestorAccessLinks,
  revokeInvestorAccessLink,
} from '../../lib/investorAccessService';

export default function ShareWithInvestorPanel({ dealId }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [investorName, setInvestorName] = useState('');
  const [investorEmail, setInvestorEmail] = useState('');
  const [expiresDays, setExpiresDays] = useState('');

  const refresh = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const data = await listInvestorAccessLinks(dealId);
      setLinks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createInvestorAccessLink(dealId, {
        investorName: investorName.trim() || undefined,
        investorEmail: investorEmail.trim() || undefined,
        expiresDays: expiresDays ? Number(expiresDays) : undefined,
      });
      setInvestorName('');
      setInvestorEmail('');
      setExpiresDays('');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId) => {
    try {
      await revokeInvestorAccessLink(linkId);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const linkUrl = (code) => `${window.location.origin}/investor/view/${code}`;

  const handleCopy = async (link) => {
    try {
      await navigator.clipboard.writeText(linkUrl(link.access_code));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts; fail silently.
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151',
          whiteSpace: 'nowrap',
        }}
        title="Give an investor a link to this deal's read-only pitch deck"
      >
        <Link2 size={14} />
        Share with Investor
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 50,
            width: 340, backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Share with Investor</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={16} />
            </button>
          </div>

          <input
            value={investorName}
            onChange={(e) => setInvestorName(e.target.value)}
            placeholder="Investor name (optional)"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 5, marginBottom: 6 }}
          />
          <input
            value={investorEmail}
            onChange={(e) => setInvestorEmail(e.target.value)}
            placeholder="Investor email (optional)"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 5, marginBottom: 6 }}
          />
          <select
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 5, marginBottom: 10, color: '#374151' }}
          >
            <option value="">Never expires</option>
            <option value="7">Expires in 7 days</option>
            <option value="30">Expires in 30 days</option>
            <option value="90">Expires in 90 days</option>
          </select>

          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              width: '100%', padding: '8px 0', backgroundColor: '#10b981', color: '#fff',
              border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700,
              cursor: creating ? 'default' : 'pointer', marginBottom: 12,
            }}
          >
            {creating ? 'Generating…' : 'Generate Link'}
          </button>

          {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}

          {loading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading links…</div>
          ) : links.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>No links created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {links.map((link) => (
                <div key={link.id} style={{
                  border: '1px solid #e5e7eb', borderRadius: 6, padding: 8,
                  opacity: link.revoked ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#111827' }}>{link.access_code}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleCopy(link)} title="Copy link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === link.id ? '#10b981' : '#6b7280' }}>
                        {copiedId === link.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      {!link.revoked && (
                        <button onClick={() => handleRevoke(link.id)} title="Revoke" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {link.investor_name || 'No name'} · {link.view_count || 0} view{link.view_count === 1 ? '' : 's'}
                    {link.revoked ? ' · revoked' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
