import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ============================================================================
// Login Page - Sign in to existing account
// ============================================================================

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email || !formData.password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      setSuccess('Login successful! Redirecting...');
      
      // Store session info
      if (data.session) {
        localStorage.setItem('supabase_session', JSON.stringify(data.session));
      }

      setTimeout(() => navigate('/dashboard'), 1000);

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Styles matching ResultsPage UI
  const inputStyle = {
    width: '100%',
    padding: '14px 14px 14px 46px',
    fontSize: '15px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: '1px solid #334155',
    borderRadius: '10px',
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#94a3b8',
    fontSize: '14px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const iconStyle = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#64748b'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#0f172a'
    }}>
      {/* Left side - Form */}
      <div style={{ 
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            {/* Logo text - no emoji */}
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '900', 
              color: '#f1f5f9', 
              marginBottom: '16px',
              letterSpacing: '-1px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              DEAL<span style={{ color: '#10b981' }}>SNIPER</span>
            </h1>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#f1f5f9', marginBottom: '8px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              Welcome back
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              Sign in to continue to Deal Sniper
            </p>
          </div>

          {error && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              borderRadius: '10px', 
              padding: '14px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertCircle size={20} color="#ef4444" />
              <span style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '10px', 
              padding: '14px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle size={20} color="#10b981" />
              <span style={{ color: '#6ee7b7', fontSize: '14px' }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <label style={labelStyle}>Email</label>
              <Mail size={20} style={iconStyle} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={inputStyle}
                placeholder="you@example.com"
                required
              />
            </div>

            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <label style={labelStyle}>Password</label>
              <Lock size={20} style={iconStyle} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', 
                  right: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  marginTop: '14px'
                }}
              >
                {showPassword ? <EyeOff size={20} color="#64748b" /> : <Eye size={20} color="#64748b" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: loading ? '#475569' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#10b981', fontWeight: '600', textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Image with NO full overlay */}
      <div style={{ 
        flex: '0 0 50%',
        backgroundImage: 'url(/Gemini_Generated_Image_fw8pkofw8pkofw8p.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        {/* Text overlay at bottom only - no full cover */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.7) 50%, transparent 100%)',
          padding: '60px 48px 48px',
          color: 'white'
        }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            Analyze Deals Faster
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.85, maxWidth: '400px', lineHeight: '1.6', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            AI-powered underwriting, market research, and deal execution in one platform
          </p>
          <div style={{ 
            marginTop: '24px', 
            display: 'flex', 
            gap: '24px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>10x</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Faster Analysis</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>500+</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Deals Analyzed</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>$2B+</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Deal Volume</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
