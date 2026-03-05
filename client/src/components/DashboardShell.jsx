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
  MapPin,
  Shield,
  Mail,
  FileText,
  Bot,
} from 'lucide-react';

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
  },
  circleButton: (dark = false) => ({
    width: 30,
    height: 30,
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? '#000000' : '#e5e7eb',
    color: dark ? '#ffffff' : '#4b5563',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
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
  { id: 'agents', label: 'AI Agents', icon: Bot, section: 'deals' },
  { id: 'email-underwrite', label: 'Email Underwrite', icon: Mail, section: 'deals' },
  { id: 'templates', label: 'Templates', icon: FileText, section: 'deals' },
  { id: 'market', label: 'Market Research', icon: BarChart3, section: 'analysis' },
  { id: 'pitch-deck', label: 'Pitch Deck', icon: Presentation, section: 'analysis' },
  { id: 'contract', label: 'Contracts', icon: Shield, section: 'analysis' },
];

function DashboardShell({ activeTab, title = 'Dashboard', onTabClick, children }) {
  const navigate = useNavigate();

  const defaultHandleTabClick = (tabId) => {
    if (tabId === 'pipeline') {
      navigate('/pipeline');
    } else if (tabId === 'underwrite') {
      navigate('/underwrite');
    } else if (tabId === 'agents') {
      navigate('/agents');
    } else if (tabId === 'email-underwrite') {
      navigate('/email-underwrite');
    } else if (tabId === 'templates') {
      navigate('/templates');
    } else if (tabId === 'market') {
      navigate('/market-research');
    } else if (tabId === 'pitch-deck') {
      navigate('/pitch-deck');
    } else if (tabId === 'contract') {
      navigate('/contract');
    } else if (tabId === 'home') {
      // Home tab shows the map view
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleTabClick = (tabId) => {
    if (onTabClick) {
      onTabClick(tabId, defaultHandleTabClick);
    } else {
      defaultHandleTabClick(tabId);
    }
  };

  const initial = title && title.length > 0 ? title[0].toUpperCase() : 'D';

  return (
    <div style={dashboardStyles.page}>
      <div style={dashboardStyles.appCard}>
        {/* Left sidebar with labels */}
        <div style={dashboardStyles.iconSidebar}>
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
        </div>

        {/* Main content area */}
        <div style={dashboardStyles.main}>
          {/* Top bar */}
          <div style={dashboardStyles.topBar}>
            <div style={dashboardStyles.topBarLogo}>
              <div style={dashboardStyles.topLogoMark}>
                <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>{initial}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{title}</span>
            </div>
            <div style={dashboardStyles.topRight}>
              <div style={dashboardStyles.circleButton(true)}>{initial}</div>
            </div>
          </div>

          <div style={{
            ...dashboardStyles.content,
            ...(activeTab === 'home' ? { padding: 0, overflow: 'hidden' } : {})
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
