import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ============================================================================
// /set-password — landing page for the Supabase recovery link.
//
// The backend sends this link (supabase.auth.reset_password_for_email with
// redirect_to=/set-password) whenever it had to create an account for a
// paying Stripe customer on its own — e.g. someone who paid but never
// finished the old browser-side signup page — and for "Forgot password".
// supabase-js exchanges the token in the URL for a session automatically
// (detectSessionInUrl); we wait for that session, then set the password.
// ============================================================================

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('Verifying your link...');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let done = false;
    const gotSession = (session) => {
      if (done || !session?.user) return;
      done = true;
      setEmail(session.user.email || '');
      setReady(true);
      setMessage('Choose a password for your DealSniper account.');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') gotSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => gotSession(session));

    const timer = setTimeout(() => {
      if (!done) {
        setMessage('');
        setError('This link is invalid or has expired. Request a new one from the sign-in page.');
      }
    }, 8000);

    return () => { subscription?.unsubscribe(); clearTimeout(timer); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setMessage('Password saved. Taking you to your dashboard...');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      console.error('Set password error:', err);
      setError(err.message || 'Could not save password');
      setSaving(false);
    }
  };

  const input = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, boxSizing: 'border-box' };
  const label = { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#ffffff', borderRadius: 18, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, color: '#111827' }}>Set your password</h2>
        {message && <p style={{ margin: '0 0 18px', color: '#4b5563', lineHeight: 1.5 }}>{message}</p>}
        {error && <p style={{ margin: '0 0 18px', color: '#dc2626', lineHeight: 1.5 }}>{error}</p>}
        {ready && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Email</label>
              <div style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc', color: '#111827' }}>{email}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} autoFocus />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} />
            </div>
            <button type="submit" disabled={saving} style={{ width: '100%', padding: '13px 16px', border: 'none', borderRadius: 12, background: saving ? '#94a3b8' : '#111827', color: '#ffffff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save password'}
            </button>
          </form>
        )}
        {!ready && error && (
          <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '13px 16px', border: 'none', borderRadius: 12, background: '#111827', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
            Go to sign in
          </button>
        )}
      </div>
    </div>
  );
}
