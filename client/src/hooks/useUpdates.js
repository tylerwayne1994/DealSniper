import { useState, useEffect } from 'react';

const DEFAULT_UPDATES = [
  {
    id: 'update-001',
    title: 'AI Underwriter Enhancement',
    description: 'The Claude AI Underwriter now supports streaming responses for faster analysis on complex deals.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-002',
    title: 'Email Underwriting Improvements',
    description: 'Email underwriting pipeline now extracts rehab budgets and cost segregation analysis automatically.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-003',
    title: 'Market Analysis Dashboard',
    description: 'New MSA heatmap visualization helps identify emerging market opportunities in seconds.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-004',
    title: 'System Maintenance Completed',
    description: 'Backend optimization improved calculation speeds by 40%. All underwriting operations are now faster.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'info',
    icon: 'check-check',
    read: false,
  },
  {
    id: 'update-005',
    title: 'New Export Format Available',
    description: 'You can now export analyses directly to PowerPoint presentations. Perfect for investor meetings.',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: true,
  },
];

/**
 * Custom hook to manage site updates
 * Handles reading/writing updates from localStorage
 */
export const useUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
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
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever updates change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('dealsniper_updates', JSON.stringify(updates));
    }
  }, [updates, isLoaded]);

  const getUnreadCount = () => updates.filter((u) => !u.read).length;

  const markAsRead = (updateId) => {
    setUpdates((prev) =>
      prev.map((u) => (u.id === updateId ? { ...u, read: true } : u))
    );
  };

  const markAllAsRead = () => {
    setUpdates((prev) => prev.map((u) => ({ ...u, read: true })));
  };

  const deleteUpdate = (updateId) => {
    setUpdates((prev) => prev.filter((u) => u.id !== updateId));
  };

  const clearAll = () => {
    setUpdates([]);
  };

  const addUpdate = (update) => {
    const newUpdate = {
      ...update,
      id: update.id || `update-${Date.now()}`,
      timestamp: update.timestamp || new Date().toISOString(),
      type: update.type || 'info',
      read: update.read || false,
    };
    setUpdates((prev) => [newUpdate, ...prev]);
  };

  return {
    updates,
    isLoaded,
    unreadCount: getUnreadCount(),
    markAsRead,
    markAllAsRead,
    deleteUpdate,
    clearAll,
    addUpdate,
  };
};
