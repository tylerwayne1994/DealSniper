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
  Bell,
} from 'lucide-react';

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
    width: 56,
    backgroundColor: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
    boxSizing: 'border-box',
    gap: 10,
    zIndex: 10000,
    position: 'relative',
  },
  logoBoxOuter: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBoxInner: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  iconButton: (active = false) => ({
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    color: active ? '#ffffff' : '#9ca3af',
    backgroundColor: active ? '#374151' : 'transparent',
    cursor: 'pointer',
  }),
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

// Sidebar icon with hover label tooltip
const SidebarIcon = ({ icon: Icon, label, active = false, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={dashboardStyles.iconButton(active)}>
        <Icon size={18} />
      </div>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: 44,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#111827',
            color: '#f9fafb',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'pipeline', label: 'Pipeline', icon: Layers },
  { id: 'underwrite', label: 'Underwrite', icon: FileSpreadsheet },
  { id: 'rapid-fire', label: 'Rapid Fire', icon: Zap },
  { id: 'market', label: 'Market', icon: BarChart3 },
  { id: 'pitch-deck', label: 'Pitch Deck', icon: Presentation },
];

function DashboardShell({ activeTab, title = 'Dashboard', onTabClick, children }) {
  const navigate = useNavigate();

  const defaultHandleTabClick = (tabId) => {
    if (tabId === 'pipeline') {
      navigate('/pipeline');
    } else if (tabId === 'underwrite') {
      navigate('/underwrite');
    } else if (tabId === 'email-deals') {
      navigate('/email-deals');
    } else if (tabId === 'market') {
      navigate('/market-research');
    } else if (tabId === 'pitch-deck') {
      navigate('/pitch-deck');
    } else if (tabId === 'home') {
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
        {/* Left icon sidebar */}
        <div style={dashboardStyles.iconSidebar}>
          <div style={dashboardStyles.logoBoxOuter}>
            <div style={dashboardStyles.logoBoxInner} />
          </div>
          <SidebarIcon
            icon={Home}
            label="Home"
            active={activeTab === 'home'}
            onClick={() => handleTabClick('home')}
          />
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <SidebarIcon
                key={tab.id}
                icon={Icon}
                label={tab.label}
                active={isActive}
                onClick={() => handleTabClick(tab.id)}
              />
            );
          })}
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
              <div style={dashboardStyles.circleButton(false)}>
                <Bell size={14} />
              </div>
              <div style={dashboardStyles.circleButton(true)}>U</div>
            </div>
          </div>

          <div style={dashboardStyles.content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
