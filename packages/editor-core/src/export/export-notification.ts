export type ExportNotificationEventType = 'started' | 'completed' | 'failed' | 'canceled';
export type ExportNotificationTimeGroup = 'today' | 'this-week' | 'earlier';

export interface ExportNotification {
  id: string;
  eventType: ExportNotificationEventType;
  taskName: string;
  projectName?: string;
  timestamp: string;
  read: boolean;
  taskId?: string;
  outputPath?: string;
  error?: string;
}

export interface ExportNotificationSettings {
  enabledTypes: ExportNotificationEventType[];
}

export const DEFAULT_NOTIFICATION_SETTINGS: ExportNotificationSettings = {
  enabledTypes: ['started', 'completed', 'failed', 'canceled'],
};

export function createExportNotification(input: {
  eventType: ExportNotificationEventType;
  taskName: string;
  projectName?: string;
  taskId?: string;
  outputPath?: string;
  error?: string;
}): ExportNotification {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType: input.eventType,
    taskName: input.taskName,
    projectName: input.projectName,
    timestamp: new Date().toISOString(),
    read: false,
    taskId: input.taskId,
    outputPath: input.outputPath,
    error: input.error,
  };
}

export function countUnreadNotifications(notifications: ExportNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function markAllNotificationsRead(notifications: ExportNotification[]): ExportNotification[] {
  return notifications.map((n) => ({ ...n, read: true }));
}

export function clearNotificationHistory(notifications: ExportNotification[]): ExportNotification[] {
  return [];
}

export function filterNotificationsByEventType(
  notifications: ExportNotification[],
  enabledTypes: ExportNotificationEventType[],
): ExportNotification[] {
  const enabled = new Set(enabledTypes);
  return notifications.filter((n) => enabled.has(n.eventType));
}

export function groupNotificationsByTime(
  notifications: ExportNotification[],
  now: Date = new Date(),
): Map<ExportNotificationTimeGroup, ExportNotification[]> {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups = new Map<ExportNotificationTimeGroup, ExportNotification[]>();
  groups.set('today', []);
  groups.set('this-week', []);
  groups.set('earlier', []);

  for (const notification of notifications) {
    const time = new Date(notification.timestamp).getTime();
    if (time >= todayStart.getTime()) {
      groups.get('today')!.push(notification);
    } else if (time >= weekStart.getTime()) {
      groups.get('this-week')!.push(notification);
    } else {
      groups.get('earlier')!.push(notification);
    }
  }

  return groups;
}

export function groupNotificationsByProject(notifications: ExportNotification[]): Map<string, ExportNotification[]> {
  const groups = new Map<string, ExportNotification[]>();
  for (const notification of notifications) {
    const key = notification.projectName ?? '(unknown)';
    const existing = groups.get(key) ?? [];
    existing.push(notification);
    groups.set(key, existing);
  }
  return groups;
}

export function shouldShowNotification(
  eventType: ExportNotificationEventType,
  settings: ExportNotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
): boolean {
  return settings.enabledTypes.includes(eventType);
}
