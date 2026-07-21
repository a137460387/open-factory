import { useState } from 'react';
import { useCreator } from '@/hooks/useCreator';
import { CreatorProfile } from '@/components/CreatorProfile';
import { PluginList } from '@/components/PluginList';
import { AchievementCard } from '@/components/AchievementCard';
import { NotificationList } from '@/components/NotificationList';
import { mockAchievements, mockNotifications } from '@/lib/mock-data';
import type { Notification } from '@/lib/mock-data';

const CREATOR_ID = 'creator-001';

type Tab = 'plugins' | 'achievements' | 'notifications';

export function CreatorCenterPage() {
  const { creator, plugins, loading, error } = useCreator(CREATOR_ID);
  const [activeTab, setActiveTab] = useState<Tab>('plugins');
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted text-sm">Loading creator data...</div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger text-sm">{error ?? 'Creator not found'}</div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'plugins', label: 'Plugins' },
    { key: 'achievements', label: 'Achievements' },
    { key: 'notifications', label: 'Notifications', count: unreadCount },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Creator Center</h1>
        <p className="text-sm text-foreground-muted mt-1">Manage your profile, plugins, and achievements</p>
      </div>

      {/* Creator profile */}
      <CreatorProfile creator={creator} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white font-semibold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'plugins' && <PluginList plugins={plugins} />}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mockAchievements.map((a) => (
            <AchievementCard key={a.id} achievement={a} />
          ))}
        </div>
      )}
      {activeTab === 'notifications' && (
        <NotificationList notifications={notifications} onMarkRead={handleMarkRead} />
      )}
    </div>
  );
}
