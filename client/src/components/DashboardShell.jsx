import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Layers,
  Zap,
  Presentation,
  BarChart3,
  FileSpreadsheet,
  Home,
  Shield,
  Mail,
  FileText,
  Menu,
  X,
  AlertTriangle,
  Users,
  ChevronDown,
  LogOut,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { supabase } from '../lib/supabase';

const SIDEBAR_WIDTH = 200;

const dashboardStyles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  appCard: {
    width: '100%',
    height: '100vh',
    margin: 0,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    boxShadow: 'none',
    display: 'flex',
    overflow: 'hidden',
  },
  iconSidebar: {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    boxSizing: 'border-box',
    gap: 2,
    zIndex: 10000,
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  logoBoxOuter: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 16px',
    marginBottom: 20,
  },
  logoBoxInner: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    flexShrink: 0,
  },
  sidebarItem: (active = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    margin: '0 8px',
    borderRadius: 8,
    color: active ? '#ffffff' : '#94a3b8',
    backgroundColor: active ? '#1e293b' : 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    letterSpacing: '0.01em',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
    border: 'none',
    outline: 'none',
    whiteSpace: 'nowrap',
  }),
  sidebarSection: {
    fontSize: 10,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '16px 16px 6px 24px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  topBar: {
    height: 56,
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
  },
  topBarLogo: {
    display: 'flex',
    alignItems: 'center',
  },
  topLogoMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  topRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  circleButton: (dark = false) => ({
    width: 38,
    height: 38,
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? '#000000' : '#e5e7eb',
    color: dark ? '#ffffff' : '#4b5563',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    boxShadow: dark ? '0 10px 24px rgba(15, 23, 42, 0.22)' : 'none',
  }),
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 32px 32px',
    overflow: 'auto',
  },
};

// Sidebar item with icon + label
const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{
        ...dashboardStyles.sidebarItem(active),
        ...(hovered && !active ? { backgroundColor: '#1e293b', color: '#e2e8f0' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
};

const tabs = [
  { id: 'home', label: 'Home', icon: Home, section: 'main' },
  { id: 'profile', label: 'Profile', icon: User, section: 'main' },
  { id: 'pipeline', label: 'Pipeline', icon: Layers, section: 'deals' },
  { id: 'underwrite', label: 'Underwrite', icon: FileSpreadsheet, section: 'deals' },
  { id: 'rapid-fire', label: 'Rapid Fire', icon: Zap, section: 'deals' },
  { id: 'email-underwrite', label: 'Email Underwrite', icon: Mail, section: 'deals' },
  { id: 'red-flag-scanner', label: 'Red Flag Scanner', icon: AlertTriangle, section: 'deals' },
  { id: 'templates', label: 'Templates', icon: FileText, section: 'deals' },
  { id: 'market', label: 'Market Research', icon: BarChart3, section: 'analysis' },
  { id: 'pitch-deck', label: 'Pitch Deck', icon: Presentation, section: 'analysis' },
  { id: 'contract', label: 'Contracts', icon: Shield, section: 'analysis' },
  { id: 'investor-portal', label: 'Investor Portal', icon: Users, section: 'analysis' },
];

function DashboardShell({ activeTab, title = 'Dashboard', onTabClick, children }) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [accountUser, setAccountUser] = React.useState(null);
  const accountMenuRef = React.useRef(null);

  const defaultHandleTabClick = (tabId) => {
    if (tabId === 'pipeline') {
      navigate('/pipeline');
    } else if (tabId === 'underwrite') {
      navigate('/underwrite');
    } else if (tabId === 'email-underwrite') {
      navigate('/email-underwrite');
    } else if (tabId === 'red-flag-scanner') {
      navigate('/red-flag-scanner');
    } else if (tabId === 'templates') {
      navigate('/templates');
    } else if (tabId === 'market') {
      navigate('/market-research');
    } else if (tabId === 'pitch-deck') {
      navigate('/pitch-deck');
    } else if (tabId === 'contract') {
      navigate('/contract');
    } else if (tabId === 'investor-portal') {
      navigate('/investor-portal');
    } else if (tabId === 'home') {
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleTabClick = (tabId) => {
    // Close mobile drawer on navigation
    if (isMobile) setDrawerOpen(false);
    if (onTabClick) {
      onTabClick(tabId, defaultHandleTabClick);
    } else {
      defaultHandleTabClick(tabId);
    }
  };

  const initial = title && title.length > 0 ? title[0].toUpperCase() : 'D';

  React.useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setAccountUser(data?.user || null);
      } catch {
        if (mounted) setAccountUser(null);
      }
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAccountUser(session?.user || null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rawName =
    accountUser?.user_metadata?.full_name ||
    [accountUser?.user_metadata?.first_name, accountUser?.user_metadata?.last_name].filter(Boolean).join(' ') ||
    accountUser?.email?.split('@')[0] ||
    'Account';
  const displayName = rawName || 'Account';
  const displayEmail = accountUser?.email || 'Signed in';
  const userInitial = (displayName[0] || displayEmail[0] || 'D').toUpperCase();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAccountMenuOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // ── Sidebar content (shared between desktop fixed + mobile drawer) ──
  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={dashboardStyles.logoBoxOuter}>
        <div style={dashboardStyles.logoBoxInner} />
        <span style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>DealSniper</span>
      </div>

      {/* Main section */}
      {tabs.filter(t => t.section === 'main').map((tab) => (
        <SidebarItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}

      {/* Deals section */}
      <div style={dashboardStyles.sidebarSection}>Deals</div>
      {tabs.filter(t => t.section === 'deals').map((tab) => (
        <SidebarItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}

      {/* Analysis section */}
      <div style={dashboardStyles.sidebarSection}>Analysis</div>
      {tabs.filter(t => t.section === 'analysis').map((tab) => (
        <SidebarItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}

      {/* Contact section */}
      <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Questions or Concerns?
        </div>
        <a
          href="mailto:terrainvestai@gmail.com"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12, textDecoration: 'none', marginBottom: 6 }}
        >
          <Mail size={14} />
          terrainvestai@gmail.com
        </a>
        <a
          href="tel:7605241227"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12, textDecoration: 'none' }}
        >
          <Phone size={14} />
          (760) 524-1227
        </a>
      </div>
    </>
  );

  return (
    <div style={dashboardStyles.page}>
      <div style={dashboardStyles.appCard}>

        {/* ─── Desktop / Tablet sidebar (hidden on mobile) ─── */}
        {!isMobile && (
          <div style={dashboardStyles.iconSidebar}>
            {sidebarContent}
          </div>
        )}

        {/* ─── Mobile drawer overlay ─── */}
        {isMobile && drawerOpen && (
          <div className="mobile-sidebar-backdrop" onClick={() => setDrawerOpen(false)}>
            <div
              className="mobile-sidebar-drawer"
              onClick={(e) => e.stopPropagation()}
              style={{
                ...dashboardStyles.iconSidebar,
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: 260,
                minWidth: 260,
                zIndex: 10001,
                boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
              }}
            >
              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 8px' }}>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Main content area */}
        <div style={dashboardStyles.main}>
          {/* Top bar */}
          <div style={{
            ...dashboardStyles.topBar,
            padding: isMobile ? '0 12px' : '0 24px',
          }}>
            {/* Hamburger on mobile */}
            {isMobile && (
              <button
                onClick={() => setDrawerOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#374151',
                  marginRight: 10,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Menu size={22} />
              </button>
            )}
            <div style={dashboardStyles.topBarLogo}>
              <div style={dashboardStyles.topLogoMark}>
                <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>{initial}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{title}</span>
            </div>
            <div style={dashboardStyles.topRight} ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 6px 4px 4px',
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <div style={dashboardStyles.circleButton(true)}>{userInitial}</div>
                {!isMobile && <ChevronDown size={16} color="#475569" />}
              </button>
              {accountMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: isMobile ? 230 : 260,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  boxShadow: '0 24px 50px rgba(15, 23, 42, 0.18)',
                  padding: 10,
                  zIndex: 1000,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                    marginBottom: 8,
                  }}>
                    <div style={{ ...dashboardStyles.circleButton(true), width: 42, height: 42, flexShrink: 0 }}>{userInitial}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                      <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayEmail}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '12px 14px',
                      background: '#111827',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{
            ...dashboardStyles.content,
            ...(activeTab === 'home' ? { padding: 0, overflow: 'hidden' } : {}),
            ...(isMobile && activeTab !== 'home' ? { padding: '16px 12px 16px' } : {}),
            ...(isTablet && activeTab !== 'home' ? { padding: '20px 20px 24px' } : {}),
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
