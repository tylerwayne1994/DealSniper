import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PaymentSuccessRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Processing payment and creating your account...');
  const [checkoutMeta, setCheckoutMeta] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizePlan = (rawPlan) => {
    const normalized = (rawPlan || 'standard').toLowerCase();
    if (normalized === 'base' || normalized === 'pro') return 'standard';
    return normalized;
  };

  const finishSignupWithPassword = async (metadata, stripeTrialEndsAt, rawPassword, stripeIds) => {
    const { email, first_name, last_name, phone, company, title, city, state, plan } = metadata;
    const subscriptionTier = normalizePlan(plan);

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: rawPassword,
      options: {
        data: { first_name, last_name, phone, company, title, city, state }
      }
    });

    if (signUpError) {
      throw signUpError;
    }

    if (authData?.user) {
      const monthly = 55;
      const trialDays = Number(metadata?.trial_days || 7);
      const trialEndsAt = stripeTrialEndsAt || new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: subscriptionTier,
          token_balance: monthly,
          monthly_token_limit: monthly,
          subscription_status: 'trialing',
          trial_ends_at: trialEndsAt,
          // Stamp the Stripe ids from the verified checkout session. In this
          // flow the account is created AFTER checkout completes, so the
          // checkout.session.completed webhook's find-profile-by-email
          // fallback found no row and never set these — and without
          // stripe_customer_id, the paid-access gate (RequireSubscription.jsx
          // / AuthCallbackPage.js) would treat this paying user as unpaid and
          // bounce them into a second checkout.
          ...(stripeIds?.customerId ? { stripe_customer_id: stripeIds.customerId } : {}),
          ...(stripeIds?.subscriptionId ? { stripe_subscription_id: stripeIds.subscriptionId } : {})
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.warn('Profile update error:', profileError);
      }
    }

    sessionStorage.removeItem('pendingSignup');
    setMessage('Account created. Redirecting to login...');
    try { await supabase.auth.signOut(); } catch {}
    setTimeout(() => navigate('/login'), 1500);
  };

  useEffect(() => {
    const finishSignup = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id') || params.get('session');

        if (!sessionId) {
          setMessage('Missing session ID. Please sign up again.');
          setTimeout(() => navigate('/signup'), 2000);
          return;
        }

        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';
        const res = await fetch(`${API_BASE}/api/get-checkout-session?session_id=${sessionId}`);
        if (!res.ok) throw new Error('Failed to retrieve payment metadata');

        const { metadata, trial_ends_at: stripeTrialEndsAt, customer_id: customerId, subscription_id: subscriptionId } = await res.json();
        const stripeIds = { customerId, subscriptionId };

        // If this checkout was started by an already-authenticated user (Google/OAuth
        // sign-in, which creates the Supabase account before any Stripe checkout),
        // metadata.user_id is set and the webhook has already activated that exact
        // profile — there's no password to create and no old session to clear.
        if (metadata?.user_id) {
          setMessage('Subscription activated. Redirecting to your dashboard...');
          setTimeout(() => navigate('/dashboard'), 1200);
          return;
        }

        // Ensure we aren't using any existing session (old account) for the
        // legacy email/password flow below.
        try { await supabase.auth.signOut(); } catch {}

        const storedRaw = sessionStorage.getItem('pendingSignup');
        const stored = storedRaw ? JSON.parse(storedRaw) : null;

        if (stored?.password && stored?.email?.toLowerCase() === metadata?.email?.toLowerCase()) {
          await finishSignupWithPassword(metadata, stripeTrialEndsAt, stored.password, stripeIds);
          return;
        }

        setCheckoutMeta({ metadata, stripeTrialEndsAt, stripeIds });
        setMessage('Payment succeeded. Set your password to finish creating the account.');
      } catch (err) {
        console.error('Payment success handling error:', err);
        setMessage('An error occurred. Please try logging in or sign up again.');
        setTimeout(() => navigate('/login'), 2500);
      }
    };

    finishSignup();
  }, [location.search, navigate]);


  const handleFinalizeSignup = async (e) => {
    e.preventDefault();
    if (!checkoutMeta?.metadata) return;
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await finishSignupWithPassword(checkoutMeta.metadata, checkoutMeta.stripeTrialEndsAt, password, checkoutMeta.stripeIds);
    } catch (err) {
      console.error('Finalize signup error:', err);
      setMessage('Account creation failed: ' + (err.message || 'Unknown error'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#ffffff', borderRadius: 18, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, color: '#111827' }}>Payment successful</h2>
        <p style={{ margin: '0 0 18px', color: '#4b5563', lineHeight: 1.5 }}>{message}</p>
        {checkoutMeta?.metadata && (
          <form onSubmit={handleFinalizeSignup}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
              <div style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f8fafc', color: '#111827' }}>{checkoutMeta.metadata.email}</div>
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
