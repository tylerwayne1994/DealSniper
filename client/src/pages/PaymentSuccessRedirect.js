import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PaymentSuccessRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Processing payment and creating your account...');

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

        const { metadata } = await res.json();
        const { email, password, first_name, last_name, phone, company, title, city, state, plan } = metadata;

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name, last_name, phone, company, title, city, state }
          }
        });

        if (signUpError) {
          setMessage('Account creation failed: ' + signUpError.message);
          setTimeout(() => navigate('/signup'), 2500);
          return;
        }

        if (authData?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: plan,
              token_balance: plan === 'pro' ? 100 : 25,
              monthly_limit: plan === 'pro' ? 100 : 25
            })
            .eq('id', authData.user.id);

          if (profileError) {
            console.warn('Profile update error:', profileError);
          }
        }

        setMessage('Account created. Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } catch (err) {
        console.error('Payment success handling error:', err);
        setMessage('An error occurred. Please try logging in or sign up again.');
        setTimeout(() => navigate('/login'), 2500);
      }
    };

    finishSignup();
  }, [location.search, navigate]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Payment successful</h2>
      <p>{message}</p>
    </div>
  );
}
