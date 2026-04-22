import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, Zap } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';

// ============================================================================
// Default Updates
// ============================================================================
const DEFAULT_UPDATES = [
  {
    id: 'update-001',
    title: 'AI Underwriter Enhancement',
    description: 'The Claude AI Underwriter now supports streaming responses for faster analysis on complex deals.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-002',
    title: 'Email Underwriting Improvements',
    description: 'Email underwriting pipeline now extracts rehab budgets and cost segregation analysis automatically.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-003',
    title: 'Market Analysis Dashboard',
    description: 'New MSA heatmap visualization helps identify emerging market opportunities in seconds.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-004',
    title: 'System Maintenance Completed',
    description: 'Backend optimization improved calculation speeds by 40%. All underwriting operations are now faster.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    type: 'info',
    icon: 'check-check',
    read: false,
  },
  {
    id: 'update-005',
    title: 'New Export Format Available',
    description: 'You can now export analyses directly to PowerPoint presentations. Perfect for investor meetings.',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    type: 'feature',
    icon: 'zap',
    read: true,
  },
];

// ============================================================================
// Styles
// ============================================================================
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '900px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  button: (variant = 'secondary') => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: variant === 'primary' ? '#2563eb' : '#e5e7eb',
    color: variant === 'primary' ? '#ffffff' : '#374151',
  }),
  updatesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  updateCard: (read = true) => ({
    display: 'flex',
    gap: '16px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: read ? '#ffffff' : '#f0f9ff',
    boxShadow: read ? 'none' : '0 0 0 1px #0ea5e9',
    transition: 'all 0.2s',
    cursor: 'pointer',
  }),
  iconBox: (type = 'feature', read = true) => {
    let bgColor = '#fef3c7';
    let iconColor = '#f59e0b';
    if (type === 'info') {
      bgColor = '#dbeafe';
      iconColor = '#0ea5e9';
    }
    if (type === 'feature') {
      bgColor = '#dcfce7';
      iconColor = '#16a34a';
    }
    return {
      width: '44px',
      height: '44px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: bgColor,
      color: iconColor,
      flexShrink: 0,
      opacity: read ? 0.7 : 1,
    };
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  title: (read = true) => ({
    fontSize: '14px',
    fontWeight: '700',
    color: read ? '#6b7280' : '#111827',
    margin: 0,
  }),
  description: (read = true) => ({
    fontSize: '13px',
    color: read ? '#9ca3af' : '#4b5563',
    margin: 0,
    lineHeight: '1.5',
  }),
  time: (read = true) => ({
    fontSize: '11px',
    color: read ? '#d1d5db' : '#0ea5e9',
    fontWeight: read ? '400' : '600',
    marginTop: '4px',
  }),
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#6b7280',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    gap: '16px',
    color: '#9ca3af',
  },
  emptyStateIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#d1d5db',
  },
};

// ============================================================================
// Format Time Ago
// ============================================================================
function formatTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Update Card Component
// ============================================================================
function UpdateCard({ update, onMarkRead, onDelete }) {
  const [hovered, setHovered] = React.useState(false);

  const getIcon = () => {
    switch (update.type) {
      case 'feature':
        return <Zap size={20} />;
      case 'info':
        return <CheckCheck size={20} />;
      default:
        return <AlertCircle size={20} />;
    }
  };

  return (
    <div
      style={{
        ...styles.updateCard(update.read),
        ...(hovered ? { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.iconBox(update.type, update.read)}>
        {getIcon()}
      </div>
      <div style={styles.content}>
        <h3 style={styles.title(update.read)}>{update.title}</h3>
        <p style={styles.description(update.read)}>{update.description}</p>
        <div style={styles.time(update.read)}>{formatTimeAgo(update.timestamp)}</div>
      </div>
      <div style={styles.actions}>
        {!update.read && (
          <button
            onClick={() => onMarkRead(update.id)}
            style={{
              ...styles.iconButton,
              backgroundColor: hovered ? '#0ea5e9' : '#ffffff',
              color: hovered ? '#ffffff' : '#0ea5e9',
            }}
            title="Mark as read"
          >
            <Check size={16} />
          </button>
        )}
        <button
          onClick={() => onDelete(update.id)}
          style={{
            ...styles.iconButton,
            backgroundColor: hovered ? '#ef4444' : '#ffffff',
            color: hovered ? '#ffffff' : '#ef4444',
          }}
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Updates Page
// ============================================================================
function UpdatesPage() {
  const [updates, setUpdates] = React.useState([]);
  const [filter, setFilter] = React.useState('all'); // 'all', 'unread', 'read'

  // Initialize from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('dealsniper_updates');
    if (stored) {
      try {
        setUpdates(JSON.parse(stored));
      } catch {
        setUpdates(DEFAULT_UPDATES);
      }
    } else {
      setUpdates(DEFAULT_UPDATES);
      localStorage.setItem('dealsniper_updates', JSON.stringify(DEFAULT_UPDATES));
    }
  }, []);

  // Save to localStorage whenever updates change
  React.useEffect(() => {
    localStorage.setItem('dealsniper_updates', JSON.stringify(updates));
  }, [updates]);

  const handleMarkRead = (updateId) => {
    setUpdates((prev) =>
      prev.map((u) => (u.id === updateId ? { ...u, read: true } : u))
    );
  };

  const handleDelete = (updateId) => {
    setUpdates((prev) => prev.filter((u) => u.id !== updateId));
  };

  const handleMarkAllAsRead = () => {
    setUpdates((prev) => prev.map((u) => ({ ...u, read: true })));
  };

  const handleClearAll = () => {
    setUpdates([]);
  };

  // Filter updates
  const filteredUpdates =
    filter === 'unread'
      ? updates.filter((u) => !u.read)
      : filter === 'read'
      ? updates.filter((u) => u.read)
      : updates;

  const unreadCount = updates.filter((u) => !u.read).length;

  return (
    <DashboardShell activeTab="updates" title="Updates">
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Bell size={28} />
            <span>Updates</span>
            {unreadCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: '#0ea5e9',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  marginLeft: '8px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div style={styles.actionButtons}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  ...styles.button('secondary'),
                  padding: '8px 14px',
                  fontSize: '12px',
                }}
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
            {updates.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  ...styles.button('secondary'),
                  padding: '8px 14px',
                  fontSize: '12px',
                  color: '#ef4444',
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {updates.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '12px',
            }}
          >
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: filter === f ? '#e0e7ff' : 'transparent',
                  color: filter === f ? '#2563eb' : '#6b7280',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Updates list */}
        {filteredUpdates.length > 0 ? (
          <div style={styles.updatesList}>
            {filteredUpdates.map((update) => (
              <UpdateCard
                key={update.id}
                update={update}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>
              <Bell size={32} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', margin: 0 }}>
              {updates.length === 0 ? 'No updates yet' : 'All caught up!'}
            </h3>
            <p style={{ fontSize: '13px', margin: 0 }}>
              {updates.length === 0
                ? 'Check back soon for new features and improvements.'
                : 'You have read all available updates.'}
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default UpdatesPage;
