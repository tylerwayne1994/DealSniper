import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useNavigate, Link } from 'react-router-dom';
import { User, Building2, Mail, Lock, Phone, MapPin, Briefcase, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ============================================================================
// Sign Up Page - Create account with profile fields
// ============================================================================

function SignUpPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    title: '',
    city: '',
    state: ''
  });
  const [plan, setPlan] = useState('base');

  // Stripe publishable key (test)
  const STRIPE_PUBLISHABLE_KEY = 'pk_test_51Sf9IJRRD0SJQZk3CyZb1eweP0dpjdba4gQpIk0PxQRlFn4Zn4qarExANcYwdxI1MwMRXuM8LapyQCASNy4KypWJ00RxuONolG';
  const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // 2. Call backend to create Stripe Checkout session (send plan name)
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8010';
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          plan: plan // 'pro' or 'base'
        })
      });
      if (!res.ok) throw new Error('Failed to create Stripe Checkout session');
      const { url } = await res.json();

      // 3. Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Stripe Checkout error:', err);
      setError(err.message || 'Failed to start payment');
      setLoading(false);
    }
  };

  // Styles matching ResultsPage UI
  const inputStyle = {
    width: '100%',
    padding: '12px 14px 12px 42px',
    fontSize: '14px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: '1px solid #334155',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: '#94a3b8',
    fontSize: '13px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const iconStyle = {
    position: 'absolute',
    left: '14px',
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
      {/* Left side - Image with NO overlay */}
      <div style={{ 
        flex: '0 0 45%',
        backgroundImage: 'url(/Gemini_Generated_Image_rn28okrn28okrn28.png)',
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
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            Deal Sniper
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.85, maxWidth: '400px', lineHeight: '1.5' }}>
            The fastest way to analyze and close commercial real estate deals
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div style={{ 
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              Create your account
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#10b981', fontWeight: '600', textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} color="#ef4444" />
              <span style={{ color: '#fca5a5', fontSize: '14px' }}>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle size={18} color="#10b981" />
              <span style={{ color: '#6ee7b7', fontSize: '14px' }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Subscription Plan Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Choose your plan *</label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: plan === 'base' ? '#10b98122' : '#1e293b', border: plan === 'base' ? '2px solid #10b981' : '1px solid #334155', borderRadius: 8, padding: '10px 18px', fontWeight: 600 }}>
                  <input type="radio" name="plan" value="base" checked={plan === 'base'} onChange={() => setPlan('base')} style={{ accentColor: '#10b981' }} />
                  Base ($39.99/mo, 10 tokens)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: plan === 'pro' ? '#10b98122' : '#1e293b', border: plan === 'pro' ? '2px solid #10b981' : '1px solid #334155', borderRadius: 8, padding: '10px 18px', fontWeight: 600 }}>
                  <input type="radio" name="plan" value="pro" checked={plan === 'pro'} onChange={() => setPlan('pro')} style={{ accentColor: '#10b981' }} />
                  Pro ($49.99/mo, 35 tokens, discounted token purchases)
                </label>
              </div>
            </div>
            {/* Email & Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Email *</label>
                <Mail size={18} style={iconStyle} />
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Password *</label>
                <Lock size={18} style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Min 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '12px' }}
                >
                  {showPassword ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Confirm Password *</label>
                <Lock size={18} style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderBottom: '1px solid #334155', margin: '24px 0' }} />

            {/* Personal Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>First Name *</label>
                <User size={18} style={iconStyle} />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="John"
                  required
                />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Last Name *</label>
                <User size={18} style={iconStyle} />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Phone</label>
                <Phone size={18} style={iconStyle} />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Company</label>
                <Building2 size={18} style={iconStyle} />
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Acme Investments"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Title</label>
                <Briefcase size={18} style={iconStyle} />
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Managing Partner"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>City</label>
                  <MapPin size={18} style={iconStyle} />
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    style={inputStyle}
                    placeholder="Austin"
                  />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    style={{ ...inputStyle, paddingLeft: '14px' }}
                    placeholder="TX"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: loading ? '#475569' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '700',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '24px',
                transition: 'background-color 0.2s',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
