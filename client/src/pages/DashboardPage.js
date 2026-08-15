import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Save,
  CheckCircle,
  Briefcase,
  Layers,
  Zap,
  Lock,
  AlertCircle,
  Presentation,
  FileSpreadsheet,
  Mail
} from 'lucide-react';
import { loadProfile, saveProfile } from '../lib/dealsService';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../config/api';
import { useIsMobile } from '../hooks/useIsMobile';
import DashboardShell from '../components/DashboardShell';
import DashboardMapTab from '../components/dashboard-tabs/MapTab';
import { getGmailStatus, openConnectGmailPopup, disconnectGmail } from '../lib/gmailService';

// ============================================================================
// Token Package Card Component
// ============================================================================

function TokenPackageCard({ name, tokens, price, description, packageId, profileEmail, profileId, compact = false }) {
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

  // Compact mode - just a small "Buy" button
  if (compact) {
    return (
      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          padding: '4px 10px',
          backgroundColor: loading ? '#9ca3af' : '#0d9488',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        {loading ? '...' : `Buy ${tokens} - ${price}`}
      </button>
    );
  }

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
          backgroundColor: loading ? '#9ca3af' : '#059669',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          textTransform: 'uppercase'
        }}
        onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#047857')}
        onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#059669')}
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
  const { isMobile: isMobilePw } = useIsMobile();
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

      <div style={{ display: 'grid', gridTemplateColumns: isMobilePw ? '1fr' : '1fr 1fr', gap: isMobilePw ? '12px' : '20px' }}>
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
  const { isMobile } = useIsMobile();
  const [activeTab, setActiveTab] = useState('home');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  
  // Token state
  const [tokenBalance, setTokenBalance] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Gmail connection state (lets Due Diligence draft emails actually send)
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: null });
  const [gmailConnecting, setGmailConnecting] = useState(false);

  // Cancellation feedback state
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelComments, setCancelComments] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelFeedbackSaved, setCancelFeedbackSaved] = useState(false);
  
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
    state: '',
    brandLogoUrl: '',
    brandPrimaryColor: '#2563eb',
    brandSecondaryColor: '#1A1A1A',
    brandAccentColor: '#0052FF',
    brandCompanyName: '',
    brandLetterheadText: '',
    googleSheetId: '',
    googleSheetTab: 'Model'
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
            
            setPaymentMessage(`Payment successful. ${tokensPurchased} tokens have been added to your account. New balance: ${data.new_balance}`);
            
            // Remove query params from URL
            window.history.replaceState({}, '', '/dashboard');
            
            // Clear the message after a few seconds
            setTimeout(() => {
              setPaymentMessage('');
            }, 5000);
          } else {
            setPaymentMessage('Payment succeeded but tokens were not credited automatically yet. Please refresh the page.');
            window.history.replaceState({}, '', '/dashboard');
          }
        } catch (error) {
          console.error('Error crediting tokens:', error);
          setPaymentMessage(`Payment succeeded but tokens were not credited automatically. Error: ${error.message}. Please contact support.`);
          window.history.replaceState({}, '', '/dashboard');
        }
      };
      
      creditTokens();
    } else if (paymentCanceled === 'true') {
      setPaymentMessage('Payment was canceled.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [profile.id]);

  // Gmail connection status (for the Connect Gmail card + Due Diligence send)
  useEffect(() => {
    const loadGmailStatus = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return;
        const status = await getGmailStatus(user.id);
        setGmailStatus(status);
      } catch (err) {
        console.error('Failed to load Gmail status:', err);
      }
    };

    if (!profile.id) return;
    loadGmailStatus();
  }, [profile.id]);

  const handleConnectGmail = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw new Error('Not signed in');

      const userId = user.id;
      setGmailConnecting(true);
      openConnectGmailPopup(userId, async () => {
        const status = await getGmailStatus(userId);
        setGmailStatus(status);
        setGmailConnecting(false);
      });
    } catch (err) {
      console.error('Failed to start Gmail connect:', err);
      setGmailConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!profile.id) return;
    await disconnectGmail(profile.id);
    setGmailStatus({ connected: false, email: null });
  };

  // Load profile from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await loadProfile();
        if (data) {
          // Guard against unpaid access: /auth/callback (Google/OAuth sign-in)
          // is supposed to gate brand-new accounts into Stripe checkout before
          // they ever reach here, but a user can still land on /dashboard
          // directly (e.g. cancelling out of Stripe and typing the URL) —
          // re-run the same real-payment check here so that path isn't a
          // free-access loophole. stripeCustomerId is only ever set by the
          // Stripe webhook after an actual subscription checkout completes.
          if (!data.stripeCustomerId) {
            navigate('/auth/callback');
            return;
          }
          setProfile(data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    fetchProfile();
  }, [navigate]);

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

  // Reasons shown depend on whether the account is still in its free trial
  // or is an active paid subscription — captured for churn analysis before
  // the user completes the (still email-based) cancellation itself.
  const isTrialingAccount = tokenBalance?.subscription_status === 'trialing';
  const CANCEL_REASON_OPTIONS = isTrialingAccount ? [
    { value: 'too_early', label: "Wasn't ready to commit yet" },
    { value: 'trial_too_short', label: "Didn't get to fully try it before deciding" },
    { value: 'too_expensive', label: 'Price is too high' },
    { value: 'missing_feature', label: "Missing a feature I need" },
    { value: 'found_alternative', label: 'Found a tool that fits better' },
    { value: 'not_ready_business', label: "Not actively underwriting deals right now" },
    { value: 'other', label: 'Other' },
  ] : [
    { value: 'too_expensive', label: 'Too expensive' },
    { value: 'not_using_enough', label: "Not using it enough to justify the cost" },
    { value: 'missing_feature', label: 'Missing a feature I need' },
    { value: 'found_alternative', label: 'Switched to another tool' },
    { value: 'technical_issues', label: 'Ran into technical issues/bugs' },
    { value: 'other', label: 'Other' },
  ];

  const handleSubmitCancelFeedback = async () => {
    if (!cancelReason) return;
    setCancelSubmitting(true);
    try {
      await fetch(API_ENDPOINTS.cancellationFeedback, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Profile-ID': profile.id || '' },
        body: JSON.stringify({
          reason: cancelReason,
          comments: cancelComments,
          email: profile.email,
          subscription_status: tokenBalance?.subscription_status,
          subscription_tier: tokenBalance?.subscription_tier,
        }),
      });
    } catch (error) {
      console.error('Failed to save cancellation feedback:', error);
    } finally {
      setCancelSubmitting(false);
      setCancelFeedbackSaved(true);
    }
  };

  // Shared styles
  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontSize: '14px',
    border: '1px solid #dbe3ee',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    color: '#111827',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '700',
    color: '#475569',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '22px',
    padding: isMobile ? '20px' : '28px',
    boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
    border: '1px solid #e2e8f0'
  };

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.company || 'Your account';
  const profileInitial = (profile.firstName?.[0] || profile.email?.[0] || 'D').toUpperCase();
  const profileMeta = [profile.title, profile.company].filter(Boolean).join(' · ') || 'Update your account settings and export preferences';
  const completionFields = [profile.firstName, profile.lastName, profile.email, profile.company, profile.title, profile.city, profile.state].filter(Boolean).length;
  const completionPct = Math.round((completionFields / 7) * 100);

  // Render Profile Tab
  const renderProfileTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Payment Success/Cancel Message */}
      {paymentMessage && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: paymentMessage.toLowerCase().includes('successful') ? '#f0fdf4' : '#fef2f2',
          borderRadius: '8px',
          border: `2px solid ${paymentMessage.toLowerCase().includes('successful') ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: '600',
          color: paymentMessage.toLowerCase().includes('successful') ? '#166534' : '#dc2626'
        }}>
          {paymentMessage}
        </div>
      )}

      <div style={{
        background: 'linear-gradient(135deg, #f0fdf9 0%, #ecfeff 55%, #f0fdf4 100%)',
        border: '1px solid #d1fae5',
        borderRadius: '28px',
        padding: isMobile ? '20px' : '28px',
        boxShadow: '0 18px 40px rgba(5,150,105,0.10)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(280px, 0.9fr)',
          gap: isMobile ? '18px' : '24px',
          alignItems: 'stretch'
        }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #34d399 0%, #22d3ee 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: '0 14px 28px rgba(5,150,105,0.25)'
            }}>
              {profileInitial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Account Settings
              </div>
              <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                {fullName}
              </div>
              <div style={{ fontSize: 14, color: '#475569', marginTop: 8 }}>{profile.email || 'No email on file'}</div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>{profileMeta}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {[profile.city && profile.state ? `${profile.city}, ${profile.state}` : null, profile.googleSheetId ? 'Sheets connected' : 'Sheets not connected', tokenBalance?.subscription_status || 'Active account'].filter(Boolean).map((badge, idx) => (
                  <span key={idx} style={{ padding: '8px 12px', borderRadius: 999, background: '#ffffff', border: '1px solid #dbe3ee', fontSize: 12, fontWeight: 700, color: '#334155' }}>{badge}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid #d1fae5',
            borderRadius: 22,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 14
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Profile Completion</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#111827' }}>{completionPct}%</div>
            </div>
            <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${completionPct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Branding</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 4 }}>{profile.brandCompanyName || profile.company || 'Not set'}</div>
              </div>
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tokens</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{tokenBalance?.token_balance ?? '—'}</span>
                  {profile.email && (
                    <TokenPackageCard
                      name="65 Tokens"
                      tokens={65}
                      price="$30"
                      description="65 tokens for AI enhanced tabs"
                      packageId="65_tokens"
                      profileEmail={profile.email}
                      profileId={profile.id}
                      compact={true}
                    />
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px 18px',
                backgroundColor: saving ? '#94a3b8' : '#111827',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Connect Gmail — lets Due Diligence draft emails actually send from the user's own inbox */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '18px 20px' : '18px 22px',
        backgroundColor: 'white',
        borderRadius: '18px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            backgroundColor: gmailStatus.connected ? '#d1fae5' : '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={20} color={gmailStatus.connected ? '#059669' : '#6b7280'} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              {gmailStatus.connected ? 'Gmail connected' : 'Connect your Gmail'}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {gmailStatus.connected
                ? `Emails drafted in Due Diligence will send from ${gmailStatus.email}`
                : 'Let drafted emails (Due Diligence findings, LOI cover notes) send straight from your inbox instead of just copy/paste.'}
            </div>
          </div>
        </div>
        {gmailStatus.connected ? (
          <button
            onClick={handleDisconnectGmail}
            style={{
              padding: '10px 18px', fontSize: '13px', fontWeight: '600',
              backgroundColor: 'transparent', color: '#dc2626', border: '1px solid #fecaca',
              borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnectGmail}
            disabled={gmailConnecting}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', fontSize: '13px', fontWeight: '700',
              background: gmailConnecting ? '#9ca3af' : 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
              color: 'white', border: 'none', borderRadius: '10px',
              cursor: gmailConnecting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Mail size={15} />
            {gmailConnecting ? 'Connecting…' : 'Connect Gmail'}
          </button>
        )}
      </div>

      {/* Primary CTA: Upload Deal (routes to V2 Underwriter) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: isMobile ? '18px 20px' : '18px 22px', 
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)', 
        borderRadius: '18px', 
        border: '1px solid #fed7aa'
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '8px', 
            backgroundColor: '#fef3c7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '10px'
          }}>
            <Zap size={16} color="#d97706" />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>
            AI Tokens
          </h3>
        </div>

        {tokenLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
            <div style={{ fontSize: '14px' }}>Loading your subscription...</div>
          </div>
        ) : tokenBalance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Balance row: count, monthly limit, reset date all in one line */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: isMobile ? '8px' : '10px',
              padding: '14px 16px',
              backgroundColor: '#f9fafb',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
            }}>
              <span style={{ fontSize: '32px', fontWeight: '800', color: '#111827', lineHeight: 1 }}>
                {tokenBalance.token_balance !== undefined ? tokenBalance.token_balance : '—'}
              </span>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                of {tokenBalance.monthly_limit || 55} tokens left
              </span>
              <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: 'auto' }}>
                Resets {tokenBalance.tokens_reset_at ? new Date(tokenBalance.tokens_reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
              </span>
            </div>

            {/* Token Usage Info — only the operations that actually cost tokens */}
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>LOI Generation:</span> 1 token
              <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
              <span style={{ fontWeight: '600', color: '#374151' }}>Contract Generation:</span> 1 token
              <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
              <span style={{ fontWeight: '600', color: '#374151' }}>Pitch Deck:</span> 2 tokens
              <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
              <span style={{ fontWeight: '600', color: '#374151' }}>Document Analysis:</span> 2 tokens
              <div style={{ marginTop: '4px' }}>
                Everything else — Market Reports, Deal Structure, Rapid Fire, Max AI, OM Parsing — is free.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
            Unable to load token balance
          </div>
        )}
      </div>

      {/* Trial Countdown Card */}
      {tokenBalance?.subscription_status === 'trialing' && tokenBalance?.trial_ends_at && (() => {
        const trialEnd = new Date(tokenBalance.trial_ends_at);
        const now = new Date();
        const msLeft = trialEnd - now;
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        const hoursLeft = Math.max(0, Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        const isUrgent = daysLeft <= 2;
        const isExpired = msLeft <= 0;

        return (
          <div style={{
            ...cardStyle,
            background: isExpired ? 'linear-gradient(135deg, #fef2f2, #fee2e2)'
              : isUrgent ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
              : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            border: isExpired ? '2px solid #fca5a5'
              : isUrgent ? '2px solid #fcd34d'
              : '2px solid #6ee7b7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                backgroundColor: isExpired ? '#fecaca' : isUrgent ? '#fde68a' : '#a7f3d0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px'
              }}>
                {isExpired ? <AlertCircle size={20} color="#dc2626" /> : <CheckCircle size={20} color={isUrgent ? '#d97706' : '#059669'} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: isExpired ? '#dc2626' : '#111827' }}>
                  {isExpired ? 'Trial Expired' : 'Free Trial Active'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {isExpired
                    ? 'Your free trial has ended. Your subscription will now begin.'
                    : `Your card won't be charged until the trial ends`}
                </p>
              </div>
            </div>

            {!isExpired && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <div style={{
                  textAlign: 'center', padding: '16px 24px',
                  backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '12px',
                  minWidth: '80px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: isUrgent ? '#d97706' : '#059669', lineHeight: 1 }}>
                    {daysLeft}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginTop: '4px' }}>
                    {daysLeft === 1 ? 'DAY' : 'DAYS'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', padding: '16px 24px',
                  backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '12px',
                  minWidth: '80px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: isUrgent ? '#d97706' : '#059669', lineHeight: 1 }}>
                    {hoursLeft}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginTop: '4px' }}>
                    HOURS
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
              Trial {isExpired ? 'ended' : 'ends'}: {trialEnd.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        );
      })()}

                   
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>
              Cancel Subscription
            </h3>

            {!showCancelFlow && (
              <>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                  {isTrialingAccount
                    ? "Thinking about cancelling your free trial? We'd love a quick reason why before you go."
                    : 'Sorry to see you go. Before you cancel, mind telling us why?'}
                </p>
                <button
                  onClick={() => setShowCancelFlow(true)}
                  style={{
                    padding: '10px 20px', fontSize: '14px', fontWeight: '600',
                    backgroundColor: '#dc2626', color: 'white', border: 'none',
                    borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Cancel Subscription
                </button>
              </>
            )}

            {showCancelFlow && !cancelFeedbackSaved && (
              <div>
                <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  What's the main reason you're cancelling?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {CANCEL_REASON_OPTIONS.map((opt) => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#374151',
                      padding: '10px 12px', borderRadius: '8px', border: '1.5px solid',
                      borderColor: cancelReason === opt.value ? '#dc2626' : '#e5e7eb',
                      backgroundColor: cancelReason === opt.value ? '#fef2f2' : 'white', cursor: 'pointer',
                    }}>
                      <input
                        type="radio" name="cancelReason" value={opt.value}
                        checked={cancelReason === opt.value}
                        onChange={() => setCancelReason(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={cancelComments}
                  onChange={(e) => setCancelComments(e.target.value)}
                  placeholder="Anything else you want us to know? (optional)"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px',
                    border: '1.5px solid #e5e7eb', marginBottom: '14px', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleSubmitCancelFeedback}
                    disabled={!cancelReason || cancelSubmitting}
                    style={{
                      padding: '10px 20px', fontSize: '14px', fontWeight: '600',
                      backgroundColor: !cancelReason || cancelSubmitting ? '#fca5a5' : '#dc2626',
                      color: 'white', border: 'none', borderRadius: '6px',
                      cursor: !cancelReason || cancelSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {cancelSubmitting ? 'Submitting…' : 'Submit & Continue to Cancel'}
                  </button>
                  <button
                    onClick={() => { setShowCancelFlow(false); setCancelReason(''); setCancelComments(''); }}
                    style={{
                      padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                      backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Never mind, keep my subscription
                  </button>
                </div>
              </div>
            )}

            {cancelFeedbackSaved && (
              <>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                  Thanks for the feedback. To finish cancelling your subscription, send an email to:
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
              </>
            )}
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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '20px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '20px' }}>
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

      {/* Google Sheets Export Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#dcfce7', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginRight: '12px' 
          }}>
            <FileSpreadsheet size={20} color="#059669" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Google Sheets Export</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Connect your personal underwriting spreadsheet</p>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Google Sheet URL or ID *</label>
          <input
            style={inputStyle}
            name="googleSheetId"
            value={profile.googleSheetId}
            onChange={handleProfileChange}
            placeholder="Paste your Google Sheet URL or spreadsheet ID"
          />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Paste the full URL (e.g. https://docs.google.com/spreadsheets/d/abc123/edit) or just the ID. Make sure the sheet is shared with the service account.
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Sheet Tab Name</label>
          <input
            style={inputStyle}
            name="googleSheetTab"
            value={profile.googleSheetTab}
            onChange={handleProfileChange}
            placeholder="Model"
          />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            The tab/sheet name within your spreadsheet where data should be written (default: "Model")
          </p>
        </div>
      </div>

      {/* White-Label Branding Card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#ede9fe', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <Presentation size={20} color="#7c3aed" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              White-Label Branding
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Brand your pitch decks, LOIs, contracts, and PDF reports
            </p>
          </div>
        </div>

        {/* Logo Upload */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Company Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {profile.brandLogoUrl ? (
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '8px', border: '1px solid #e5e7eb',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#f9fafb'
              }}>
                <img src={profile.brandLogoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '8px', border: '2px dashed #d1d5db',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#f9fafb', color: '#9ca3af', fontSize: '12px', textAlign: 'center'
              }}>
                No logo
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#374151',
                cursor: uploadingLogo ? 'not-allowed' : 'pointer'
              }}>
                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  disabled={uploadingLogo}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      alert('Logo must be under 2MB');
                      return;
                    }
                    setUploadingLogo(true);
                    try {
                      const ext = file.name.split('.').pop().toLowerCase();
                      const path = `brand-logos/${profile.id}/${Date.now()}.${ext}`;
                      const { error: uploadError } = await supabase.storage.from('deal-images').upload(path, file, {
                        contentType: file.type, upsert: true
                      });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage.from('deal-images').getPublicUrl(path);
                      setProfile(prev => ({ ...prev, brandLogoUrl: urlData.publicUrl }));
                    } catch (err) {
                      console.error('Logo upload error:', err);
                      alert('Failed to upload logo: ' + err.message);
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                />
              </label>
              {profile.brandLogoUrl && (
                <button
                  type="button"
                  onClick={() => setProfile(prev => ({ ...prev, brandLogoUrl: '' }))}
                  style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  Remove logo
                </button>
              )}
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>PNG, JPG, or SVG — max 2MB</span>
            </div>
          </div>
        </div>

        {/* Brand Company Name & Letterhead */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '20px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>Brand Name (on documents)</label>
            <input
              type="text"
              name="brandCompanyName"
              value={profile.brandCompanyName}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Acme Capital Group"
            />
          </div>
          <div>
            <label style={labelStyle}>Letterhead Tagline</label>
            <input
              type="text"
              name="brandLetterheadText"
              value={profile.brandLetterheadText}
              onChange={handleProfileChange}
              style={inputStyle}
              placeholder="Institutional-Quality Real Estate Investments"
            />
          </div>
        </div>

        {/* Brand Colors */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...labelStyle, marginBottom: '12px' }}>Brand Colors</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {[
              { key: 'brandPrimaryColor', label: 'Primary' },
              { key: 'brandSecondaryColor', label: 'Secondary' },
              { key: 'brandAccentColor', label: 'Accent' }
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={profile[key]}
                  onChange={(e) => setProfile(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ width: '36px', height: '36px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{profile[key]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div style={{ 
          marginTop: '16px', padding: '20px', borderRadius: '8px', 
          border: '1px solid #e5e7eb', backgroundColor: '#fafafa'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preview — Document Header
          </div>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', 
            paddingBottom: '12px', borderBottom: `3px solid ${profile.brandAccentColor}`
          }}>
            {profile.brandLogoUrl && (
              <img src={profile.brandLogoUrl} alt="" style={{ height: '36px', objectFit: 'contain' }} />
            )}
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: profile.brandSecondaryColor }}>
                {profile.brandCompanyName || profile.company || 'Your Company'}
              </div>
              {profile.brandLetterheadText && (
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{profile.brandLetterheadText}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <div style={{ width: '60px', height: '8px', borderRadius: '4px', backgroundColor: profile.brandPrimaryColor }} />
            <div style={{ width: '40px', height: '8px', borderRadius: '4px', backgroundColor: profile.brandAccentColor }} />
            <div style={{ width: '80px', height: '8px', borderRadius: '4px', backgroundColor: profile.brandSecondaryColor, opacity: 0.3 }} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardShell
      activeTab={activeTab}
      title={activeTab === 'profile' ? 'Profile' : 'Dashboard'}
      onTabClick={(tabId, defaultNavigate) => {
        if (tabId === 'profile' || tabId === 'home' || tabId === 'map') {
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

      {activeTab === 'home' && <DashboardMapTab />}
      {activeTab === 'profile' && renderProfileTab()}
    </DashboardShell>
  );
}

export default DashboardPage;
