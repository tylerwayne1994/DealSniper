// Investor Gateway — a simple, public, standalone page. An investor who was
// given an access code by a sponsor lands here, types the code in, and is
// routed straight to that one deal's pitch deck. No login, no account, no
// access to anything else in the app.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InvestorGatewayPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the access code you were given.');
      return;
    }
    setError(null);
    navigate(`/investor/view/${encodeURIComponent(trimmed.toUpperCase())}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/Gemini_Generated_Image_rn28okrn28okrn28.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        position: 'relative',
      }}
    >
      {/* Overlay for legibility */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.55)' }} />

      <div
        style={{
          position: 'relative',
          width: 380,
          maxWidth: '90vw',
          backgroundColor: '#ffffff',
          borderRadius: 10,
          padding: '36px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            DEAL<span style={{ color: '#10b981' }}>SNIPER</span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Investor Access
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Enter the access code your sponsor sent you
          </label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 7K3PQMXT"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              fontSize: 16,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              textAlign: 'center',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              marginBottom: 14,
            }}
          />
          {error && (
            <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 14 }}>{error}</div>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px 0',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View Pitch Deck
          </button>
        </form>

        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>
          Don&rsquo;t have a code? Contact the sponsor who invited you.
        </div>
      </div>
    </div>
  );
}
