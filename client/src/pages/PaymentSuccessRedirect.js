import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ============================================================================
// Landing page after Stripe Checkout (success_url).
//
// The Supabase account is now created SERVER-SIDE:
//   - Email/password signups: /api/create-checkout-session creates the auth
//     user BEFORE redirecting to Stripe, and the checkout session carries
//     metadata.user_id. Nothing here can leave a paying customer without a
//     login — this page only signs them in (password kept in sessionStorage
//     from the signup form) and sends them to the dashboard.
//   - Google/OAuth signups: the account already existed; same as above minus
//     the sign-in.
//   - Legacy sessions (started before the server-side flow shipped, no
//     metadata.user_id): the password is sent to /api/complete-signup, which
//     find-or-creates the account and sets the password on the server. The
//     old browser-side supabase.auth.signUp is gone.
// ============================================================================

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

export default function PaymentSuccessRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Processing payment and setting up your account...');
  const [needsPassword, setNeedsPassword] = useState(null); // { sessionId, email }
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signInAndGo = async (email, rawPassword) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: rawPassword });
    sessionStorage.removeItem('pendingSignup');
    if (error) {
      console.warn('Post-checkout sign-in failed, sending to login:', error);
      setMessage('Your subscription is active. Redirecting to sign in...');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    setMessage('Subscription activated. Redirecting to your dashboard...');
    setTimeout(() => navigate('/dashboard'), 800);
  };

  const completeSignup = async (sessionId, email, rawPassword) => {
    const res = await fetch(`${API_BASE}/api/complete-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, password: rawPassword }),
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* non-JSON */ }

    if (res.status === 409 && body?.account_exists) {
      sessionStorage.removeItem('pendingSignup');
      setNeedsPassword(null);
      setMessage('Your subscription is active and this email already has an account. Please sign in.');
      setTimeout(() => navigate('/login'), 2500);
      return;
    }
    if (!res.ok) throw new Error(body?.detail || body?.message || 'Could not finish creating your account');

    await signInAndGo(body.email || email, rawPassword);
  };

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id') || params.get('session');

        if (!sessionId) {
          setMessage('Missing session ID. Please sign up again.');
          setTimeout(() => navigate('/signup'), 2000);
          return;
        }

        const res = await fetch(`${API_BASE}/api/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error('Failed to retrieve payment details');
        const { metadata } = await res.json();
        const email = (metadata?.email || '').toLowerCase();

        const storedRaw = sessionStorage.getItem('pendingSignup');
        const stored = storedRaw ? JSON.parse(storedRaw) : null;
        const storedPassword = stored?.password && stored?.email?.toLowerCase() === email ? stored.password : null;

        if (metadata?.user_id) {
          // Account already exists (created before checkout). If this browser
          // still has the signup password, sign in; otherwise an existing
          // session (Google) or the login page takes it from here.
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setMessage('Subscription activated. Redirecting to your dashboard...');
            setTimeout(() => navigate('/dashboard'), 800);
            return;
          }
          if (storedPassword && email) {
            await signInAndGo(email, storedPassword);
            return;
          }
          setMessage('Subscription activated. Please sign in to continue.');
          setTimeout(() => navigate('/login'), 1500);
          return;
        }

        // Legacy session without user_id: finish on the server.
        try { await supabase.auth.signOut(); } catch (_) { /* ignore */ }
        if (storedPassword) {
          await completeSignup(sessionId, email, storedPassword);
          return;
        }
        setNeedsPassword({ sessionId, email });
        setMessage('Payment succeeded. Choose a password to finish creating your account.');
      } catch (err) {
        console.error('Payment success handling error:', err);
        setMessage(
          'Your payment went through, but we hit a problem finishing setup. ' +
          'Please try signing in — if that fails, use "Forgot password" with the email you paid with.'
        );
        setTimeout(() => navigate('/login'), 4000);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate]);

  const handleFinalizeSignup = async (e) => {
    e.preventDefault();
    if (!needsPassword) return;
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setMessage('Passwords do not match.'); return; }

    setSubmitting(true);
    try {
      await completeSignup(needsPassword.sessionId, needsPassword.email, password);
    } catch (err) {
      console.error('Finalize signup error:', err);
      setMessage('Account setup failed: ' + (err.message || 'Unknown error'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#ffffff', borderRadius: 18, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, color: '#111827' }}>Payment successful</h2>
        <p style={{ margin: '0 0 18px', color: '#4b5563', lineHeight: 1.5 }}>{message}</p>
        {needsPassword && (
          <form onSubmit={handleFinalizeSignup}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
              <div style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc', color: '#111827' }}>{needsPassword.email}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Create password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '13px 16px', border: 'none', borderRadius: 12, background: submitting ? '#94a3b8' : '#111827', color: '#ffffff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
