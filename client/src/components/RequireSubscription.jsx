import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ============================================================================
// Route guard for the paid app pages (see App.js).
//
// Two checks, in order:
//   1. No auth session            -> /login
//   2. No real paid subscription  -> /auth/callback, which re-runs the same
//      Stripe Checkout gate used after Google sign-in (creates a checkout
//      session pre-filled with the user's email and forwards them to Stripe).
//
// "Real paid subscription" means profiles.stripe_customer_id is set — that
// column is only ever written by the Stripe webhook after an actual checkout
// completes (or by PaymentSuccessRedirect.js from the verified checkout
// session). Do NOT gate on subscription_status: it defaults to 'trialing' at
// the DB column level for every brand-new profiles row regardless of payment
// (see backend/migrations/add_trial_columns.sql).
//
// A transient profile-fetch failure lets the user through rather than
// bouncing a paying customer into checkout — the gate only fires on a
// definitive "this profile has no stripe_customer_id" answer.
// ============================================================================

// Once a user id has passed the paid check, skip re-fetching the profile on
// every route change for the rest of the page load.
let verifiedUserId = null;

export default function RequireSubscription({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | login | checkout

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          if (!cancelled) setStatus('login');
          return;
        }

        if (verifiedUserId === user.id) {
          if (!cancelled) setStatus('ok');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn('RequireSubscription: profile check failed, allowing through', error);
          setStatus('ok');
          return;
        }

        if (profile?.stripe_customer_id) {
          verifiedUserId = user.id;
          setStatus('ok');
        } else {
          setStatus('checkout');
        }
      } catch (e) {
        console.warn('RequireSubscription: check errored, redirecting to login', e);
        if (!cancelled) setStatus('login');
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') return null;
  if (status === 'login') return <Navigate to="/login" replace />;
  if (status === 'checkout') return <Navigate to="/auth/callback" replace />;
  return children;
}
