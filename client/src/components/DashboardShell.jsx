import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Layers,
  Presentation,
  FileSpreadsheet,
  Home,
  Mail,
  FileText,
  Menu,
  X,
  Users,
  ChevronDown,
  LogOut,
  Phone,
  Bell,
  Sparkles,
  NotebookPen,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUpdates } from '../hooks/useUpdates';
import { supabase } from '../lib/supabase';

// Bump this whenever there's a new round of updates worth a one-time welcome
// popup — each unique value shows the modal again exactly once per browser.
const WELCOME_UPDATE_VERSION = 'update-2026-07';
const WELCOME_SEEN_KEY = `dealsniper_seen_${WELCOME_UPDATE_VERSION}`;

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
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
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
    gap: 6,
    padding: '0 16px',
    marginBottom: 20,
  },
  sidebarItem: (active = false) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '9px 16px',
    margin: '0 8px',
    borderRadius: 8,
    color: active ? '#ffffff' : '#4b5563',
    background: active ? 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)' : 'transparent',
    boxShadow: active ? '0 1px 2px 0 rgba(0,0,0,0.06)' : 'none',
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
    color: '#9ca3af',
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
    backgroundColor: dark ? '#d1fae5' : '#e5e7eb',
    color: dark ? '#059669' : '#4b5563',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    boxShadow: 'none',
  }),
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 32px 32px',
    overflow: 'auto',
  },
};

// Sidebar item with icon + label + optional badge
const SidebarItem = ({ icon: Icon, label, active = false, onClick, badge = null }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{
        ...dashboardStyles.sidebarItem(active),
        ...(hovered && !active ? { backgroundColor: '#f3f4f6', color: '#111827' } : {}),
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      <span>{label}</span>
      {badge !== null && badge > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: '700',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </div>
      )}
    </div>
  );
};

const tabs = [
  { id: 'home', label: 'Home', icon: Home, section: 'main' },
  { id: 'profile', label: 'Profile', icon: User, section: 'main' },
  { id: 'updates', label: 'Updates', icon: Bell, section: 'main' },
  { id: 'pipeline', label: 'Pipeline', icon: Layers, section: 'deals' },
  { id: 'underwrite', label: 'Underwrite', icon: FileSpreadsheet, section: 'deals' },
  { id: 'napkin', label: 'Back of the Napkin', icon: NotebookPen, section: 'deals' },
  { id: 'templates', label: 'Templates', icon: FileText, section: 'deals' },
  { id: 'pitch-deck', label: 'Pitch Deck', icon: Presentation, section: 'analysis' },
  { id: 'investor-portal', label: 'Investor Portal', icon: Users, section: 'analysis' },
];

function DashboardShell({ activeTab, title = 'Dashboard', onTabClick, children }) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useIsMobile();
  const { unreadCount } = useUpdates();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [accountUser, setAccountUser] = React.useState(null);
  const accountMenuRef = React.useRef(null);
  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_SEEN_KEY)) setShowWelcomeModal(true);
    } catch {
      // localStorage unavailable — just skip the popup, not worth failing over
    }
  }, []);

  const dismissWelcomeModal = () => {
    try { localStorage.setItem(WELCOME_SEEN_KEY, 'true'); } catch { /* ignore */ }
    setShowWelcomeModal(false);
  };

  const defaultHandleTabClick = (tabId) => {
    if (tabId === 'pipeline') {
      navigate('/pipeline');
    } else if (tabId === 'underwrite') {
      navigate('/underwrite');
    } else if (tabId === 'napkin') {
      navigate('/napkin');
    } else if (tabId === 'agent-builder') {
      navigate('/agent-builder');
    } else if (tabId === 'email-underwrite') {
      navigate('/email-underwrite');
    } else if (tabId === 'templates') {
      navigate('/templates');
    } else if (tabId === 'market') {
      navigate('/market-research');
    } else if (tabId === 'pitch-deck') {
      navigate('/pipeline');
    } else if (tabId === 'contract') {
      navigate('/contract');
    } else if (tabId === 'investor-portal') {
      navigate('/investor-portal');
    } else if (tabId === 'updates') {
      navigate('/updates');
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
        <span style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Deal
          <span style={{ border: '2px solid #10b981', color: '#059669', borderRadius: 6, padding: '0 5px', fontSize: 13, marginLeft: 2 }}>
            Sniper
          </span>
        </span>
      </div>

      {/* Main section */}
      {tabs.filter(t => t.section === 'main').map((tab) => (
        <SidebarItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
          badge={tab.id === 'updates' ? unreadCount : null}
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
      <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Questions or Concerns?
        </div>
        <a
          href="mailto:terrainvestai@gmail.com"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 12, textDecoration: 'none', marginBottom: 6 }}
        >
          <Mail size={14} />
          terrainvestai@gmail.com
        </a>
        <a
          href="tel:7605241227"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 12, textDecoration: 'none' }}
        >
          <Phone size={14} />
          (760) 524-1227
        </a>
      </div>
    </>
  );

  return (
    <div style={dashboardStyles.page}>
      {showWelcomeModal && (
        <div
          onClick={dismissWelcomeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 20000, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: 16, maxWidth: 420, width: '90%',
              padding: '32px 28px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <Sparkles size={26} color="#ffffff" />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#111827' }}>
              Welcome to the new and improved DealSniper
            </h2>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
              We shipped a big round of updates — investor deal rooms, a rebuilt market analysis
              view, an AI deal chat, and more. More features to come.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={dismissWelcomeModal}
                style={{
                  padding: '10px 22px', borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#ffffff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Got it
              </button>
              <button
                onClick={() => { dismissWelcomeModal(); navigate('/updates'); }}
                style={{
                  padding: '10px 22px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
                  color: '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                See what&rsquo;s new
              </button>
            </div>
          </div>
        </div>
      )}
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
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#6b7280',
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
                      background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
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
