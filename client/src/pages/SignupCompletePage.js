import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Loader } from 'lucide-react';

function SignupCompletePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Completing your account setup...');

  useEffect(() => {
    const completeSignup = async () => {
      try {
        // Check if user is already logged in from signup
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setStatus('error');
          setMessage('No active session found. Please log in.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Get plan from URL params (Stripe will pass it back)
        const params = new URLSearchParams(window.location.search);
        const plan = params.get('plan') || 'base';

        // Update subscription tier in Supabase
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: plan,
            token_balance: plan === 'pro' ? 100 : 25,
            monthly_limit: plan === 'pro' ? 100 : 25
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          setStatus('error');
          setMessage('Failed to update subscription: ' + profileError.message);
          return;
        }

        // Success!
        setStatus('success');
        setMessage('Account created successfully! Redirecting to dashboard...');
        
        // Redirect to dashboard
        setTimeout(() => navigate('/dashboard'), 2000);

      } catch (error) {
        console.error('Signup completion error:', error);
        setStatus('error');
        setMessage('An error occurred: ' + error.message);
      }
    };

    completeSignup();
  }, [navigate]);

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
              <span style={{ fontSize: '32px', color: '#dc2626' }}>✕</span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626', marginBottom: '12px' }}>
              Signup Error
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
              {message}
            </p>
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
