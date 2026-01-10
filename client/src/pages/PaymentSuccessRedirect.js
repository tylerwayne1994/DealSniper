import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function PaymentSuccessRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Read optional session id from querystring (Stripe may append `session_id`)
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id') || params.get('session');

    // Optionally we could call backend to verify the session here.
    // For now, show a confirmation and redirect to the dashboard.
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.search, navigate]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Payment successful</h2>
      <p>If you are not redirected automatically, <a href="/dashboard">click here</a>.</p>
    </div>
  );
}
