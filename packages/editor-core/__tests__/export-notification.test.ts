import { describe, expect, it } from 'vitest';
import {
  createExportNotification,
  countUnreadNotifications,
  markAllNotificationsRead,
  clearNotificationHistory,
  filterNotificationsByEventType,
  groupNotificationsByTime,
  groupNotificationsByProject,
  shouldShowNotification,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../src/export/export-notification';

describe('export notification center', () => {
  it('creates notification with unread state', () => {
    const n = createExportNotification({ eventType: 'completed', taskName: '导出视频' });
    expect(n.read).toBe(false);
    expect(n.eventType).toBe('completed');
    expect(n.taskName).toBe('导出视频');
    expect(n.id).toBeTruthy();
  });

  it('counts unread notifications', () => {
    const notifications = [
      { ...createExportNotification({ eventType: 'completed', taskName: 'a' }), read: false },
      { ...createExportNotification({ eventType: 'failed', taskName: 'b' }), read: true },
      { ...createExportNotification({ eventType: 'started', taskName: 'c' }), read: false },
    ];
    expect(countUnreadNotifications(notifications)).toBe(2);
  });

  it('marks all notifications as read', () => {
    const notifications = [
      { ...createExportNotification({ eventType: 'completed', taskName: 'a' }), read: false },
      { ...createExportNotification({ eventType: 'failed', taskName: 'b' }), read: false },
    ];
    const result = markAllNotificationsRead(notifications);
    expect(countUnreadNotifications(result)).toBe(0);
  });

  it('clears notification history', () => {
    const notifications = [
      createExportNotification({ eventType: 'completed', taskName: 'a' }),
    ];
    expect(clearNotificationHistory(notifications)).toEqual([]);
  });

  it('filters notifications by enabled event types', () => {
    const notifications = [
      { ...createExportNotification({ eventType: 'started', taskName: 'a' }), id: '1' },
      { ...createExportNotification({ eventType: 'completed', taskName: 'b' }), id: '2' },
      { ...createExportNotification({ eventType: 'failed', taskName: 'c' }), id: '3' },
    ];
    const filtered = filterNotificationsByEventType(notifications, ['completed', 'failed']);
    expect(filtered.length).toBe(2);
    expect(filtered.every((n) => n.eventType === 'completed' || n.eventType === 'failed')).toBe(true);
  });

  it('groups notifications by time period', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const notifications = [
      { ...createExportNotification({ eventType: 'completed', taskName: 'a' }), timestamp: '2026-06-20T10:00:00Z' },
      { ...createExportNotification({ eventType: 'failed', taskName: 'b' }), timestamp: '2026-06-17T10:00:00Z' },
      { ...createExportNotification({ eventType: 'started', taskName: 'c' }), timestamp: '2026-06-01T10:00:00Z' },
    ];
    const groups = groupNotificationsByTime(notifications, now);
    expect(groups.get('today')!.length).toBe(1);
    expect(groups.get('this-week')!.length).toBe(1);
    expect(groups.get('earlier')!.length).toBe(1);
  });

  it('groups notifications by project', () => {
    const notifications = [
      { ...createExportNotification({ eventType: 'completed', taskName: 'a', projectName: '项目A' }), id: '1' },
      { ...createExportNotification({ eventType: 'failed', taskName: 'b', projectName: '项目B' }), id: '2' },
      { ...createExportNotification({ eventType: 'started', taskName: 'c', projectName: '项目A' }), id: '3' },
    ];
    const groups = groupNotificationsByProject(notifications);
    expect(groups.get('项目A')!.length).toBe(2);
    expect(groups.get('项目B')!.length).toBe(1);
  });

  it('checks shouldShowNotification for enabled types', () => {
    expect(shouldShowNotification('completed', DEFAULT_NOTIFICATION_SETTINGS)).toBe(true);
    expect(shouldShowNotification('failed', DEFAULT_NOTIFICATION_SETTINGS)).toBe(true);
    expect(shouldShowNotification('canceled', { enabledTypes: ['completed'] })).toBe(false);
  });

  it('clearing badge returns zero unread', () => {
    const notifications = [
      createExportNotification({ eventType: 'completed', taskName: 'a' }),
      createExportNotification({ eventType: 'failed', taskName: 'b' }),
    ];
    expect(countUnreadNotifications(notifications)).toBe(2);
    const cleared = clearNotificationHistory(notifications);
    expect(countUnreadNotifications(cleared)).toBe(0);
  });
});
