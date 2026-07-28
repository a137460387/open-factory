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
export declare const DEFAULT_NOTIFICATION_SETTINGS: ExportNotificationSettings;
export declare function createExportNotification(input: {
    eventType: ExportNotificationEventType;
    taskName: string;
    projectName?: string;
    taskId?: string;
    outputPath?: string;
    error?: string;
}): ExportNotification;
export declare function countUnreadNotifications(notifications: ExportNotification[]): number;
export declare function markAllNotificationsRead(notifications: ExportNotification[]): ExportNotification[];
export declare function clearNotificationHistory(notifications: ExportNotification[]): ExportNotification[];
export declare function filterNotificationsByEventType(notifications: ExportNotification[], enabledTypes: ExportNotificationEventType[]): ExportNotification[];
export declare function groupNotificationsByTime(notifications: ExportNotification[], now?: Date): Map<ExportNotificationTimeGroup, ExportNotification[]>;
export declare function groupNotificationsByProject(notifications: ExportNotification[]): Map<string, ExportNotification[]>;
export declare function shouldShowNotification(eventType: ExportNotificationEventType, settings?: ExportNotificationSettings): boolean;
//# sourceMappingURL=export-notification.d.ts.map