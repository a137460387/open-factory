import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import type { Notification } from '@/lib/mock-data';

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
}

const iconMap: Record<string, { icon: React.ReactNode; color: string }> = {
  success: { icon: <CheckCircle size={18} />, color: 'text-success' },
  info: { icon: <Info size={18} />, color: 'text-info' },
  warning: { icon: <AlertTriangle size={18} />, color: 'text-warning' },
  error: { icon: <XCircle size={18} />, color: 'text-danger' },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationList({ notifications, onMarkRead }: NotificationListProps) {
  return (
    <div className="space-y-2">
      {notifications.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center text-foreground-muted text-sm">
          No notifications
        </div>
      ) : (
        notifications.map((n) => {
          const cfg = iconMap[n.type] ?? iconMap.info;
          return (
            <div
              key={n.id}
              className={`bg-surface-raised border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-colors hover:border-accent/30 ${
                n.read ? 'border-border' : 'border-accent/20'
              }`}
              onClick={() => onMarkRead?.(n.id)}
            >
              <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{n.title}</span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                </div>
                <p className="text-xs text-foreground-muted mt-0.5">{n.message}</p>
                <span className="text-[10px] text-foreground-muted mt-1 block">{timeAgo(n.time)}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
