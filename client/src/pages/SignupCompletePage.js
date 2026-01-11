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
        
        const { metadata } = await res.json();
        const { email, password, first_name, last_name, phone, company, title, city, state, plan } = metadata;

        // Create Supabase account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              first_name: first_name,
              last_name: last_name,
              phone: phone,
              company: company,
              title: title,
              city: city,
              state: state
            }
          }
        });

        if (signUpError) {
          console.error('Supabase signup error:', signUpError);
          setStatus('error');
          setMessage('Failed to create account: ' + signUpError.message);
          return;
        }

        // Update profile with subscription details
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: plan,
              token_balance: plan === 'pro' ? 100 : 25,
              monthly_limit: plan === 'pro' ? 100 : 25
            })
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Profile update error:', profileError);
          }
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
