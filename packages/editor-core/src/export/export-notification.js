export const DEFAULT_NOTIFICATION_SETTINGS = {
    enabledTypes: ['started', 'completed', 'failed', 'canceled'],
};
export function createExportNotification(input) {
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
export function countUnreadNotifications(notifications) {
    return notifications.filter((n) => !n.read).length;
}
export function markAllNotificationsRead(notifications) {
    return notifications.map((n) => ({ ...n, read: true }));
}
export function clearNotificationHistory(notifications) {
    return [];
}
export function filterNotificationsByEventType(notifications, enabledTypes) {
    const enabled = new Set(enabledTypes);
    return notifications.filter((n) => enabled.has(n.eventType));
}
export function groupNotificationsByTime(notifications, now = new Date()) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const groups = new Map();
    groups.set('today', []);
    groups.set('this-week', []);
    groups.set('earlier', []);
    for (const notification of notifications) {
        const time = new Date(notification.timestamp).getTime();
        if (time >= todayStart.getTime()) {
            groups.get('today').push(notification);
        }
        else if (time >= weekStart.getTime()) {
            groups.get('this-week').push(notification);
        }
        else {
            groups.get('earlier').push(notification);
        }
    }
    return groups;
}
export function groupNotificationsByProject(notifications) {
    const groups = new Map();
    for (const notification of notifications) {
        const key = notification.projectName ?? '(unknown)';
        const existing = groups.get(key) ?? [];
        existing.push(notification);
        groups.set(key, existing);
    }
    return groups;
}
export function shouldShowNotification(eventType, settings = DEFAULT_NOTIFICATION_SETTINGS) {
    return settings.enabledTypes.includes(eventType);
}
//# sourceMappingURL=export-notification.js.map