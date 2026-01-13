import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Users, 
  Save,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Layers,
  Inbox,
  Zap,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Presentation,
  BarChart3,
  FileSpreadsheet,
  LogOut
} from 'lucide-react';
import { loadProfile, saveProfile } from '../lib/dealsService';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../config/api';
import RapidFirePage from './RapidFirePage';
import DashboardShell from '../components/DashboardShell';
import HomeMapView from '../components/HomeMapView';

// ============================================================================
// Token Package Card Component
// ============================================================================

function TokenPackageCard({ name, tokens, price, description, packageId, profileEmail, profileId }) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.createTokenCheckout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: packageId,
          email: profileEmail,
          profile_id: profileId
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '2px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Sandbox Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        alignSelf: 'flex-start'
      }}>
        <img 
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5z'/%3E%3Cpath d='M2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E"
          alt="Sandbox"
          style={{ width: '16px', height: '16px' }}
        />
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>Sandbox</span>
      </div>

      {/* Package Name */}
      <div>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
          {name}
        </h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          {description}
        </p>
      </div>

      {/* Price */}
      <div style={{ 
        fontSize: '48px', 
        fontWeight: '800', 
        color: '#111827',
        lineHeight: '1'
      }}>
        {price}
      </div>

      {/* Pay Button */}
      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: loading ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          textTransform: 'uppercase'
        }}
        onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#1d4ed8')}
        onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#2563eb')}
      >
        {loading ? 'Processing...' : 'Pay'}
      </button>
    </div>
  );
}

// ============================================================================
// Change Password Component
// ============================================================================

function ChangePasswordCard({ cardStyle, inputStyle, labelStyle }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
    setMessage({ type: '', text: '' });
  };

  const handleUpdatePassword = async () => {
    setMessage({ type: '', text: '' });

    if (!passwords.newPassword || !passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in both fields' });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Password update error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '10px', 
          backgroundColor: '#fef3c7', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginRight: '12px'
        }}>
          <Lock size={20} color="#d97706" />
        </div>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
          Change Password
        </h3>
      </div>

      {message.text && (
        <div style={{ 
          backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4', 
          border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}`, 
          borderRadius: '8px', 
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {message.type === 'error' ? (
            <AlertCircle size={18} color="#ef4444" />
          ) : (
            <CheckCircle size={18} color="#10b981" />
          )}
          <span style={{ color: message.type === 'error' ? '#dc2626' : '#166534', fontSize: '14px' }}>
            {message.text}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>New Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="newPassword"
            value={passwords.newPassword}
            onChange={handleChange}
            style={inputStyle}
            placeholder="Min 6 characters"
          />
        </div>
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Confirm New Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={passwords.confirmPassword}
            onChange={handleChange}
            style={inputStyle}
            placeholder="Confirm password"
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
        <button
          onClick={handleUpdatePassword}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: loading ? '#9ca3af' : '#d97706',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <Lock size={16} />
          {loading ? 'Updating...' : 'Update Password'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            style={{ cursor: 'pointer' }}
          />
          Show passwords
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard Page - Clean UI matching app style
// ============================================================================

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  
  // Token state
  const [tokenBalance, setTokenBalance] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  
  // Profile state
  const [profile, setProfile] = useState({
    id: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    title: '',
    city: '',
    state: ''
  });

  // Require an auth session; otherwise redirect to login
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          navigate('/login');
          return;
        }
      } catch (e) {
        navigate('/login');
      }
    };
    checkSession();
  }, [navigate]);

  // Check for payment success/cancel in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success');
    const tokensPurchased = params.get('tokens');
    const paymentCanceled = params.get('payment_canceled');
    
    console.log('Payment check:', { paymentSuccess, tokensPurchased, profileId: profile.id });
    
    if (paymentSuccess === 'true' && tokensPurchased) {
      if (!profile.id) {
        console.log('Profile ID not loaded yet, waiting...');
        return;
      }
      
      // Manually credit tokens (workaround for local webhook testing)
      const creditTokens = async () => {
        try {
          console.log('Crediting tokens:', { profile_id: profile.id, tokens: parseInt(tokensPurchased) });
          
          const response = await fetch(API_ENDPOINTS.creditTokens, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile_id: profile.id,
              tokens: parseInt(tokensPurchased)
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Credit tokens response:', data);
          
          if (data.success) {
            // Update token balance in state immediately
            setTokenBalance(prev => ({
              ...prev,
              token_balance: data.new_balance
            }));
            
            setPaymentMessage(`✅ Payment successful! ${tokensPurchased} tokens have been added to your account. New balance: ${data.new_balance}`);
            
            // Remove query params from URL
            window.history.replaceState({}, '', '/dashboard');
            
            // Clear the message after a few seconds
            setTimeout(() => {
              setPaymentMessage('');
            }, 5000);
          } else {
            setPaymentMessage(`⚠️ Payment successful but failed to credit tokens automatically. Please refresh the page.`);
            window.history.replaceState({}, '', '/dashboard');
          }
        } catch (error) {
          console.error('Error crediting tokens:', error);
          setPaymentMessage(`⚠️ Payment successful but failed to credit tokens automatically. Error: ${error.message}. Please contact support.`);
          window.history.replaceState({}, '', '/dashboard');
        }
      };
      
      creditTokens();
    } else if (paymentCanceled === 'true') {
      setPaymentMessage('❌ Payment was canceled.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [profile.id]);

  // Load profile from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await loadProfile();
        if (data) {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Load token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        // Prefer auth user id via imported supabase; fallback to loaded profile id
        let profileId = profile.id;
        try {
          const userRes = await supabase.auth.getUser();
          const userData = userRes?.data;
          if (userData && userData.user && userData.user.id) {
            profileId = userData.user.id;
          }
        } catch {}
        if (!profileId) return; // wait until we have an id
        
        const response = await fetch(API_ENDPOINTS.tokensBalance, {
          headers: {
            'X-Profile-ID': profileId
          }
        });
        const data = await response.json();
        if (data && !data.detail) {
          setTokenBalance(data);
        } else {
          console.warn('Token balance error:', data);
        }
      } catch (error) {
        console.error('Error loading token balance:', error);
      } finally {
        setTokenLoading(false);
      }
    };
    fetchTokenBalance();
  }, [profile.id]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await saveProfile(profile);
      setSaveMessage('Profile saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage('Error saving profile');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Shared styles
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#f9fafb',
    color: '#111827',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#374151',
    fontSize: '13px'
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  };

  // Render Profile Tab
  const renderProfileTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Payment Success/Cancel Message */}
      {paymentMessage && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: paymentMessage.includes('✅') ? '#f0fdf4' : '#fef2f2',
          borderRadius: '8px',
          border: `2px solid ${paymentMessage.includes('✅') ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: '600',
          color: paymentMessage.includes('✅') ? '#166534' : '#dc2626'
        }}>
          {paymentMessage}
        </div>
      )}

      {/* Primary CTA: Upload Deal (routes to V2 Underwriter) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 20px', 
        backgroundColor: '#f9fafb', 
        borderRadius: '12px', 
        border: '1px solid #e5e7eb'
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            Upload a new deal to underwrite
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Send a new OM or custom deal straight into the V2 underwriter.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/underwrite')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '999px',
            backgroundColor: '#000000',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)'
          }}
        >
          <Layers size={16} />
          Upload Deal
        </button>
      </div>

      {/* Token Balance Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#fef3c7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <Zap size={20} color="#d97706" />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
            AI Token Balance
          </h3>
        </div>

        {tokenLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            <div style={{ fontSize: '14px' }}>Loading your subscription...</div>
          </div>
        ) : tokenBalance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Section: Plan Badge & Token Count */}
            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '20px'
            }}>
              {/* Plan Badge */}
              <div style={{ 
                padding: '12px 24px',
                background: (() => {
                  const tier = (tokenBalance.subscription_tier || 'base').toLowerCase();
                  if (tier === 'pro') return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                  return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                })(),
                color: 'white',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'inline-block'
              }}>
                {tokenBalance.subscription_tier === 'pro' ? '⚡ PRO' : '🔥 BASE'} MEMBER
              </div>

              {/* Token Counter */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '56px', 
                  fontWeight: '800', 
                  color: '#111827',
                  lineHeight: '1',
                  marginBottom: '8px'
                }}>
                  {tokenBalance.token_balance !== undefined ? tokenBalance.token_balance : '—'}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  tokens remaining
                </div>
              </div>
            </div>

            {/* Token Stats Cards */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px'
            }}>
              {/* Monthly Limit */}
              <div style={{ 
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                  MONTHLY LIMIT
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
                  {tokenBalance.monthly_limit || 25}
                </div>
              </div>

              {/* Reset Date */}
              <div style={{ 
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                  RESETS ON
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginTop: '4px' }}>
                  {tokenBalance.tokens_reset_at ? new Date(tokenBalance.tokens_reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                </div>
              </div>
            </div>

            {/* Token Usage Info */}
            <div style={{ 
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              borderRadius: '12px',
              border: '2px solid #e0e7ff'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#4338ca', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎯 Token Usage
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                <div style={{ color: '#374151' }}>
                  <span style={{ fontWeight: '600' }}>LOI Generation:</span>
                  <span style={{ color: '#6366f1', fontWeight: '700', marginLeft: '6px' }}>1 token</span>
                </div>
                <div style={{ color: '#374151' }}>
                  <span style={{ fontWeight: '600' }}>Market Research:</span>
                  <span style={{ color: '#6366f1', fontWeight: '700', marginLeft: '6px' }}>1 token</span>
                </div>
                <div style={{ color: '#374151' }}>
                  <span style={{ fontWeight: '600' }}>OM Parsing:</span>
                  <span style={{ color: '#10b981', fontWeight: '700', marginLeft: '6px' }}>FREE</span>
                </div>
                <div style={{ color: '#374151' }}>
                  <span style={{ fontWeight: '600' }}>Value-Add Chat:</span>
                  <span style={{ color: '#10b981', fontWeight: '700', marginLeft: '6px' }}>FREE</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
            Unable to load token balance
          </div>
        )}
      </div>

                   
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>
              Cancel Subscription
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
              To cancel your subscription, send an email to:
            </p>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '2px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <span style={{ 
              fontSize: '16px', 
              fontWeight: '700',
              color: '#dc2626',
              fontFamily: 'monospace',
              userSelect: 'all'
            }}>
              terrainvestai@gmail.com
            </span>
            <button
              onClick={(e) => {
                navigator.clipboard.writeText('terrainvestai@gmail.com');
                const btn = e.currentTarget;
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                btn.style.backgroundColor = '#10b981';
                btn.style.color = 'white';
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.style.backgroundColor = '#dc2626';
                  btn.style.color = 'white';
                }, 2000);
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Copy Email
            </button>
          </div>
        </div>

      {/* Personal Information Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#ccfbf1', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <User size={20} color="#0d9488" />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
            Personal Information
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input
              type="text"
              name="firstName"
              value={profile.firstName}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="John"
            />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input
              type="text"
              name="lastName"
              value={profile.lastName}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Doe"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={profile.phone}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="john@example.com"
            />
          </div>
        </div>
      </div>

      {/* Professional Information Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#ddd6fe', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <Briefcase size={20} color="#7c3aed" />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
            Professional Information
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Company</label>
            <input
              type="text"
              name="company"
              value={profile.company}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Acme Investments"
            />
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              name="title"
              value={profile.title}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Managing Partner"
            />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input
              type="text"
              name="city"
              value={profile.city}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Austin"
            />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input
              type="text"
              name="state"
              value={profile.state}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="TX"
            />
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <ChangePasswordCard cardStyle={cardStyle} inputStyle={inputStyle} labelStyle={labelStyle} />

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        disabled={saving}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '14px 28px',
          backgroundColor: saving ? '#6b7280' : '#0d9488',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: saving ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start'
        }}
      >
        <Save size={18} />
        {saving ? 'Saving...' : 'Save Profile'}
      </button>

      {/* Sign Out Button */}
      <button
        onClick={async () => {
          try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate('/');
          } catch (error) {
            console.error('Sign out error:', error);
            alert('Failed to sign out. Please try again.');
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '14px 28px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          alignSelf: 'flex-start'
        }}
      >
        <LogOut size={18} />
        Sign Out
      </button>

      {/* Token Packages for Purchase */}
      {profile.email && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0d9488', marginBottom: 12 }}>
            Buy More Tokens
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <TokenPackageCard
              name="$25- 14 token pack"
              tokens={14}
              price="$25"
              description="14 tokens used for the AI enhanced tabs"
              packageId="14_tokens"
              profileEmail={profile.email}
              profileId={profile.id}
            />
            <TokenPackageCard
              name="$50- 30 Tokens"
              tokens={30}
              price="$50"
              description="30 Tokens used for AI enhanced tabs"
              packageId="30_tokens"
              profileEmail={profile.email}
              profileId={profile.id}
            />
            <TokenPackageCard
              name="$100- 70 Tokens"
              tokens={70}
              price="$100"
              description="70 Tokens for All enhanced tabs"
              packageId="70_tokens"
              profileEmail={profile.email}
              profileId={profile.id}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Render Properties Tab (placeholder)
  const renderPropertiesTab = () => (
    <div style={cardStyle}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          backgroundColor: '#f0fdfa', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <Building2 size={40} color="#0d9488" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Properties Coming Soon
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px' }}>
          Track and manage your portfolio properties.
        </p>
      </div>
    </div>
  );

  // Render Pitch Deck Tab
  const renderPitchDeckTab = () => (
    <div style={cardStyle}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          backgroundColor: '#dbeafe', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <Presentation size={40} color="#2563eb" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          Pitch Deck Generator
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px' }}>
          Generate investor pitch decks for your deals.
        </p>
      </div>
    </div>
  );

  return (
    <DashboardShell
      activeTab={activeTab}
      title="Dashboard"
      onTabClick={(tabId, defaultNavigate) => {
        if (tabId === 'profile' || tabId === 'rapid-fire' || tabId === 'pitch-deck' || tabId === 'home') {
          setActiveTab(tabId);
        } else {
          defaultNavigate(tabId);
        }
      }}
    >
      {/* Save Success Message */}
      {saveMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px',
          backgroundColor: '#10b981',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          zIndex: 1000
        }}>
          <CheckCircle size={20} />
          {saveMessage}
        </div>
      )}

      {activeTab === 'home' && <HomeMapView />}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'rapid-fire' && (
        <RapidFirePage />
      )}
      {activeTab === 'pitch-deck' && renderPitchDeckTab()}
    </DashboardShell>
  );
}

export default DashboardPage;
