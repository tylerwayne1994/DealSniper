import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { storeSupabaseGoogleToken } from '../lib/gmailService';

// ============================================================================
// OAuth callback landing page — handles both Google "Sign in" and
// "Sign up" (Supabase's OAuth flow doesn't distinguish the two; the user's
// auth.users row + profiles row already exist by the time we land here,
// created by Supabase itself + the on_auth_user_created DB trigger).
//
// Business-model note: the app's normal signup flow is "pay first" (Stripe
// checkout happens before any account exists — see SignUpPage.js). OAuth
// can't defer account creation the same way, so instead we gate access
// AFTER auth: if this user has no active/trialing subscription yet, send
// them straight into the same Stripe Checkout used by the password flow
// (pre-filled with their Google email, no re-typing anything), keyed by
// their now-known user id so the existing webhook logic
// (stripe_webhook_handler.py's metadata.user_id branch) activates the
// correct profile. Existing subscribers just go straight to the dashboard.
//
// Duplicate-subscription protection:
//  - `ranRef` makes the effect run exactly once (React 18 StrictMode mounts
//    effects twice in dev; each run used to create a checkout session).
//  - The backend now refuses to create a session for anyone with a live
//    subscription (HTTP 409 already_subscribed) — if we get that response,
//    the user has already paid, so go to the dashboard instead of checkout.
//  - HTTP 409 checkout_in_progress means a concurrent request is already
//    creating the session — wait briefly and retry once; the backend then
//    returns the SAME session instead of a second one.
// ============================================================================

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Finishing sign-in...');
  const [error, setError] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // never create two checkout sessions from one landing
    ranRef.current = true;

    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';

    const startCheckout = async (user, attempt = 0) => {
      const nameParts = (user.user_metadata?.full_name || user.user_metadata?.name || '').split(' ');
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.id,
          firstName: user.user_metadata?.given_name || nameParts[0] || '',
          lastName: user.user_metadata?.family_name || nameParts.slice(1).join(' ') || '',
          plan: 'standard',
        }),
      });

      let body = null;
      try { body = await res.json(); } catch (_) { /* non-JSON error body */ }

      if (res.status === 409 && body?.already_subscribed) {
        // Backend found a live subscription in Stripe — this is a paying
        // member, never push them into a second checkout.
        setMessage('Welcome back! Redirecting to your dashboard...');
        setTimeout(() => navigate('/dashboard'), 600);
        return;
      }
      if (res.status === 409 && body?.checkout_in_progress && attempt < 1) {
        // Another request (e.g. a second tab) is creating the session right
        // now — wait for it, then the backend hands us the same session.
        await new Promise((r) => setTimeout(r, 2500));
        return startCheckout(user, attempt + 1);
      }
      if (!res.ok) throw new Error(body?.message || 'Failed to start checkout');
      window.location.href = body.url;
    };

    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          setError('Sign-in did not complete. Please try again.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Best-effort: if this Google sign-in granted the gmail.send scope
        // (requested in LoginPage.js/SignUpPage.js), Supabase exposes the
        // real Google access/refresh token on the session — forward it so
        // Gmail is connected automatically, no separate "Connect Gmail"
        // click needed. Silently does nothing if the token/scope isn't there.
        if (session.provider_token) {
          storeSupabaseGoogleToken(user.id, session.provider_token, session.provider_refresh_token);
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, stripe_customer_id')
          .eq('id', user.id)
          .maybeSingle();

        // IMPORTANT: `subscription_status` defaults to 'trialing' at the DB
        // column level for every brand-new profiles row (see
        // backend/migrations/add_trial_columns.sql) — it is NOT proof of a
        // real Stripe trial/subscription. `stripe_customer_id` is only ever
        // set by the Stripe webhook after an actual checkout completes, so
        // it's the only reliable signal that this user has really paid.
        const hasActiveSubscription = !!profile?.stripe_customer_id;

        if (hasActiveSubscription) {
          setMessage('Welcome back! Redirecting to your dashboard...');
          setTimeout(() => navigate('/dashboard'), 600);
          return;
        }

        // No stripe_customer_id on the profile — but that is NOT proof they
        // never paid. Accounts from before PaymentSuccessRedirect stamped
        // Stripe ids (webhook's find-by-email fallback fired before the
        // profiles row existed) are real paying members with a bare profile.
        // Ask the backend to check Stripe directly (by the email on the
        // verified auth token) and stamp the profile if a live subscription
        // exists, so we never push a paying customer into a second checkout.
        try {
          const reconcileRes = await fetch(`${API_BASE}/api/reconcile-subscription`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (reconcileRes.ok) {
            const { active } = await reconcileRes.json();
            if (active) {
              setMessage('Welcome back! Redirecting to your dashboard...');
              setTimeout(() => navigate('/dashboard'), 600);
              return;
            }
          }
        } catch (reconcileErr) {
          // Reconcile is best-effort — fall through to checkout on failure.
          console.warn('Subscription reconcile check failed:', reconcileErr);
        }

        // New (or never-subscribed) user — send them to start a subscription,
        // same plan/trial as the standard signup flow. The backend re-checks
        // Stripe for a live subscription before creating anything.
        setMessage('Almost there — setting up your subscription...');
        await startCheckout(user);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Something went wrong finishing sign-in.');
        setTimeout(() => navigate('/login'), 2500);
      }
    };

    run();
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#ffffff', borderRadius: 18, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, color: '#111827' }}>DealSniper</h2>
        <p style={{ margin: 0, color: error ? '#b91c1c' : '#4b5563', lineHeight: 1.5 }}>{error || message}</p>
      </div>
    </div>
  );
}
