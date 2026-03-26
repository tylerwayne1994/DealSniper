import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';

const normalizePlan = (rawPlan) => {
  const normalized = (rawPlan || 'standard').toLowerCase();
  if (normalized === 'base' || normalized === 'pro') return 'standard';
  return normalized;
};

const finishSignupWithPassword = async (metadata, stripeTrialEndsAt, rawPassword) => {
  const { email, first_name, last_name, phone, company, title, city, state, plan } = metadata;
  const subscriptionTier = normalizePlan(plan);

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: rawPassword,
    options: {
      data: {
        first_name,
        last_name,
        phone,
        company,
        title,
        city,
        state,
      }
    }
  });

  if (signUpError) throw signUpError;

  if (authData.user) {
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
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }
  }

  sessionStorage.removeItem('pendingSignup');
};

function SignupCompletePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Completing your account setup...');
  const [checkoutMeta, setCheckoutMeta] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const completeSignup = async () => {
      try {
        // Get session_id from URL params
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');

        if (!sessionId) {
          setStatus('error');
          setMessage('No session ID found. Please try signing up again.');
          return;
        }

        // Fetch Stripe session metadata from backend
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';
        const res = await fetch(`${API_BASE}/api/get-checkout-session?session_id=${sessionId}`);
        if (!res.ok) throw new Error('Failed to retrieve payment information');
        
        const { metadata, trial_ends_at: stripeTrialEndsAt } = await res.json();
        const storedRaw = sessionStorage.getItem('pendingSignup');
        const stored = storedRaw ? JSON.parse(storedRaw) : null;

        if (stored?.password && stored?.email?.toLowerCase() === metadata?.email?.toLowerCase()) {
          await finishSignupWithPassword(metadata, stripeTrialEndsAt, stored.password);
        } else {
          setCheckoutMeta({ metadata, stripeTrialEndsAt });
          setStatus('error');
          setMessage('Payment succeeded, but this browser no longer has your password. Enter a new password below to finish account setup.');
          return;
        }

        // Success!
        setStatus('success');
        setMessage('Account created successfully! Redirecting to login...');
        
        // Redirect to login page
        setTimeout(() => navigate('/login'), 2000);

      } catch (error) {
        console.error('Signup completion error:', error);
        setStatus('error');
        setMessage('An error occurred: ' + error.message);
      }
    };

    completeSignup();
  }, [navigate]);

  const handleRetryComplete = async () => {
    if (!checkoutMeta?.metadata) return;
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      setStatus('processing');
      setMessage('Completing your account setup...');
      await finishSignupWithPassword(checkoutMeta.metadata, checkoutMeta.stripeTrialEndsAt, password);
      setStatus('success');
      setMessage('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      console.error('Signup completion error:', error);
      setStatus('error');
      setMessage('An error occurred: ' + error.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {status === 'processing' && (
          <>
            <Loader size={64} color="#0d9488" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Setting Up Your Account
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280' }}>
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Welcome to DealSniper!
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280' }}>
              {message}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <AlertCircle size={32} color="#dc2626" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626', marginBottom: '12px' }}>
              Signup Error
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
              {message}
            </p>
            {checkoutMeta?.metadata && (
              <div style={{ textAlign: 'left', marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Create password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12 }} />
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12 }} />
                <button
                  onClick={handleRetryComplete}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: '#111827',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: 12,
                  }}
                >
                  Finish account setup
                </button>
              </div>
            )}
            <button
              onClick={() => navigate('/signup')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#0d9488',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default SignupCompletePage;
