import { useState, useEffect } from 'react';

const DEFAULT_UPDATES = [
  {
    id: 'update-2026-07-01',
    title: 'Investor Deal Rooms + Shareable Access Links',
    description: 'Turn any underwrite into a live, interactive one-page Deal Room. Generate a passcode link from the Deal Room tab and send it to investors — no login required for them.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-02',
    title: 'Document Vault for Investors',
    description: 'Opt specific uploaded files into a due-diligence vault investors can see and download right inside the Deal Room.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-03',
    title: 'Closing Countdown + Sensitivity Toggle',
    description: 'Deal Rooms now show a countdown banner to your offering close date, plus Conservative/Base/Upside preset buttons on the investor calculator that re-run real return numbers.',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-04',
    title: 'AI Board of Advisors',
    description: 'Convene a panel of veteran investor personas to debate your deal\'s real numbers and give you a recommendation — plus follow-up chat with any advisor.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-05',
    title: '"Ask About This Deal" AI Chat',
    description: 'A new chat box on every deal answers questions about that deal\'s numbers and its real local market — grounded in your actual data, not guesses.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-06',
    title: 'Market Analysis Rebuilt',
    description: 'The Comps tab\'s Market Analysis view was rebuilt as clean data tables (no more map or drive-time picker) matching the rest of the app\'s design.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'feature',
    icon: 'zap',
    read: false,
  },
  {
    id: 'update-2026-07-07',
    title: 'Investor Access on the Landing Page',
    description: 'Investors can now get straight to a passcode entry screen from the landing page nav or hero — no need to send them a raw link.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'info',
    icon: 'check-check',
    read: false,
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
        const parsed = JSON.parse(stored);
        const existingIds = new Set(parsed.map((u) => u.id));
        const newOnes = DEFAULT_UPDATES.filter((u) => !existingIds.has(u.id));
        setUpdates(newOnes.length > 0 ? [...newOnes, ...parsed] : parsed);
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
