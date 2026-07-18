/**
 * 多设备同步面板组件
 * 提供设备管理、同步状态、冲突解决等功能的UI界面
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Battery,
  Signal,
  MoreVertical,
  Settings,
  Trash2,
  Cloud,
  CloudOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MultiDeviceSyncManager,
  createSyncManager,
  createLocalDevice,
  type Device,
  type DeviceType,
  type DeviceStatus,
  type DeviceSyncStatus,
  type DeviceSyncConflict,
  type OfflineQueueItem,
  type SyncStats,
  type DeviceSyncConfig,
} from '@open-factory/editor-core/sync/multi-device-sync';

// ==================== 类型定义 ====================

interface MultiDeviceSyncPanelProps {
  syncManager?: MultiDeviceSyncManager;
  onSyncStatusChange?: (status: DeviceSyncStatus) => void;
  onConflictResolved?: (conflict: DeviceSyncConflict) => void;
}

// ==================== 设备配置 ====================

const DEVICE_ICONS: Record<DeviceType, React.ReactNode> = {
  desktop: <Monitor className="w-5 h-5" />,
  laptop: <Laptop className="w-5 h-5" />,
  tablet: <Tablet className="w-5 h-5" />,
  mobile: <Smartphone className="w-5 h-5" />,
  unknown: <Monitor className="w-5 h-5" />,
};

const STATUS_CONFIG: Record<DeviceStatus, { icon: React.ReactNode; color: string; label: string }> = {
  online: {
    icon: <Wifi className="w-4 h-4" />,
    color: 'text-green-500',
    label: '在线',
  },
  offline: {
    icon: <WifiOff className="w-4 h-4" />,
    color: 'text-gray-500',
    label: '离线',
  },
  syncing: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-blue-500',
    label: '同步中',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-500',
    label: '错误',
  },
};

const SYNC_STATUS_CONFIG: Record<DeviceSyncStatus, { icon: React.ReactNode; color: string; label: string }> = {
  idle: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-500',
    label: '空闲',
  },
  syncing: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-blue-500',
    label: '同步中',
  },
  paused: {
    icon: <Pause className="w-4 h-4" />,
    color: 'text-yellow-500',
    label: '已暂停',
  },
  error: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-500',
    label: '错误',
  },
  conflict: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-orange-500',
    label: '有冲突',
  },
};

// ==================== 子组件 ====================

/**
 * 设备列表项
 */
const DeviceListItem: React.FC<{
  device: Device;
  isLocal: boolean;
  onRemove?: (deviceId: string) => void;
}> = ({ device, isLocal, onRemove }) => {
  const [showMenu, setShowMenu] = useState(false);
  const statusConfig = STATUS_CONFIG[device.status];

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        {/* 设备图标 */}
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {DEVICE_ICONS[device.type]}
          </div>
          <div className={cn(
            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900',
            device.status === 'online' ? 'bg-green-500' :
            device.status === 'syncing' ? 'bg-blue-500' :
            device.status === 'error' ? 'bg-red-500' : 'bg-gray-400',
          )} />
        </div>

        {/* 设备信息 */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {device.name}
            </span>
            {isLocal && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                当前设备
              </span>
            )}
            <span className={cn('flex items-center gap-1 text-xs', statusConfig.color)}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {device.platform} {device.osVersion} · v{device.appVersion}
          </div>
        </div>
      </div>

      {/* 设备元数据 */}
      <div className="flex items-center gap-4">
        {device.metadata.batteryLevel !== undefined && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Battery className="w-4 h-4" />
            {device.metadata.batteryLevel}%
          </div>
        )}

        {device.metadata.networkType && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Signal className="w-4 h-4" />
            {device.metadata.networkType}
          </div>
        )}

        <div className="text-xs text-gray-400">
          {device.lastSeenAt && (
            <span title={new Date(device.lastSeenAt).toLocaleString('zh-CN')}>
              {getRelativeTime(device.lastSeenAt)}
            </span>
          )}
        </div>

        {/* 操作菜单 */}
        {!isLocal && onRemove && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onRemove(device.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    移除设备
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 冲突列表项
 */
const ConflictListItem: React.FC<{
  conflict: DeviceSyncConflict;
  onResolve: (conflictId: string, strategy: 'local-wins' | 'remote-wins' | 'newest-wins') => void;
}> = ({ conflict, onResolve }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {conflict.entityType}: {conflict.entityId}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {conflict.type === 'concurrent-edit' ? '并发编辑冲突' :
               conflict.type === 'version-mismatch' ? '版本不匹配' :
               conflict.type === 'structural-change' ? '结构变更冲突' : '数据损坏'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {new Date(conflict.detectedAt).toLocaleTimeString('zh-CN')}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-3 border-t border-orange-200 dark:border-orange-800">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">本地版本</div>
              <div className="text-sm font-mono">
                {JSON.stringify(conflict.localOperation.newValue).slice(0, 50)}
              </div>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1">远程版本</div>
              <div className="text-sm font-mono">
                {JSON.stringify(conflict.remoteOperation.newValue).slice(0, 50)}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onResolve(conflict.id, 'local-wins')}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              使用本地
            </button>
            <button
              onClick={() => onResolve(conflict.id, 'remote-wins')}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              使用远程
            </button>
            <button
              onClick={() => onResolve(conflict.id, 'newest-wins')}
              className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              使用最新
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 离线队列列表项
 */
const OfflineQueueListItem: React.FC<{ item: OfflineQueueItem }> = ({ item }) => {
  const statusConfig = {
    pending: { color: 'text-yellow-500', label: '等待中' },
    retrying: { color: 'text-orange-500', label: '重试中' },
    failed: { color: 'text-red-500', label: '失败' },
    completed: { color: 'text-green-500', label: '完成' },
  };

  const config = statusConfig[item.status];

  return (
    <div className="flex items-center justify-between p-2 text-sm">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', config.color.replace('text-', 'bg-'))} />
        <span className="text-gray-700 dark:text-gray-300">
          {item.operation.entityType}: {item.operation.entityId}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs', config.color)}>
          {config.label}
        </span>
        {item.retryCount > 0 && (
          <span className="text-xs text-gray-500">
            重试 {item.retryCount}/{item.maxRetries}
          </span>
        )}
      </div>
    </div>
  );
};

// ==================== 工具函数 ====================

/**
 * 获取相对时间
 */
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== 主组件 ====================

/**
 * 多设备同步面板
 */
export const MultiDeviceSyncPanel: React.FC<MultiDeviceSyncPanelProps> = ({
  syncManager: externalManager,
  onSyncStatusChange,
  onConflictResolved,
}) => {
  const { t } = useTranslation();

  // 状态管理
  const [manager] = useState(() => {
    if (externalManager) return externalManager;
    const localDevice = createLocalDevice(
      navigator.userAgent.includes('Windows') ? 'Windows PC' :
      navigator.userAgent.includes('Mac') ? 'Mac' :
      navigator.userAgent.includes('Linux') ? 'Linux PC' : '未知设备',
      'desktop',
      navigator.platform,
      navigator.userAgent,
      '1.0.0',
    );
    return createSyncManager(localDevice);
  });

  const [syncState, setSyncState] = useState(manager.getState());
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(manager.getConfig());

  // 定期更新状态
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncState(manager.getState());
    }, 1000);

    return () => clearInterval(interval);
  }, [manager]);

  // 监听事件
  useEffect(() => {
    const unsubscribers = [
      manager.on('sync.completed', () => {
        setSyncState(manager.getState());
        onSyncStatusChange?.(manager.getState().syncStatus);
      }),
      manager.on('conflict.detected', () => {
        setSyncState(manager.getState());
      }),
      manager.on('conflict.resolved', (conflict) => {
        setSyncState(manager.getState());
        onConflictResolved?.(conflict as DeviceSyncConflict);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [manager, onSyncStatusChange, onConflictResolved]);

  // 计算统计信息
  const stats = useMemo(() => manager.getStats(), [manager, syncState]);

  // 处理同步控制
  const handleToggleSync = useCallback(() => {
    if (syncState.syncStatus === 'paused') {
      manager.resumeSync();
    } else {
      manager.pauseSync();
    }
    setSyncState(manager.getState());
  }, [manager, syncState.syncStatus]);

  // 处理手动同步
  const handleManualSync = useCallback(async () => {
    await manager.triggerSync();
    setSyncState(manager.getState());
  }, [manager]);

  // 处理冲突解决
  const handleResolveConflict = useCallback(
    (conflictId: string, strategy: 'local-wins' | 'remote-wins' | 'newest-wins') => {
      manager.resolveConflictManually(conflictId, strategy, 'current-user');
      setSyncState(manager.getState());
    },
    [manager],
  );

  // 处理设备移除
  const handleRemoveDevice = useCallback(
    (deviceId: string) => {
      manager.removeDevice(deviceId);
      setSyncState(manager.getState());
    },
    [manager],
  );

  // 处理配置更新
  const handleConfigUpdate = useCallback(
    (updates: Partial<DeviceSyncConfig>) => {
      manager.updateConfig(updates);
      setConfig(manager.getConfig());
    },
    [manager],
  );

  // 状态配置
  const syncStatusConfig = SYNC_STATUS_CONFIG[syncState.syncStatus];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              多设备同步
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              管理设备连接和数据同步
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showSettings
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400',
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {syncStatusConfig.icon}
              <span className={cn('text-sm font-medium', syncStatusConfig.color)}>
                {syncStatusConfig.label}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">同步状态</div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {syncState.remoteDevices.length + 1}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">连接设备</div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                v{syncState.currentVersion}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">当前版本</div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {syncState.lastSyncAt ? getRelativeTime(syncState.lastSyncAt) : '从未'}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">最后同步</div>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleToggleSync}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
              syncState.syncStatus === 'paused'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-yellow-500 text-white hover:bg-yellow-600',
            )}
          >
            {syncState.syncStatus === 'paused' ? (
              <>
                <Play className="w-4 h-4" />
                恢复同步
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                暂停同步
              </>
            )}
          </button>

          <button
            onClick={handleManualSync}
            disabled={syncState.syncStatus === 'syncing'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('w-4 h-4', syncState.syncStatus === 'syncing' && 'animate-spin')} />
            立即同步
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 设置面板 */}
        {showSettings && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              同步设置
            </h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">自动同步</div>
                  <div className="text-xs text-gray-500">自动同步本地更改</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoSync}
                  onChange={(e) => handleConfigUpdate({ autoSync: e.target.checked })}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">仅WiFi同步</div>
                  <div className="text-xs text-gray-500">仅在WiFi连接时同步</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.syncOnWifiOnly}
                  onChange={(e) => handleConfigUpdate({ syncOnWifiOnly: e.target.checked })}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">压缩数据</div>
                  <div className="text-xs text-gray-500">压缩同步数据以节省带宽</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.compressionEnabled}
                  onChange={(e) => handleConfigUpdate({ compressionEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
              </label>

              <div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  冲突解决策略
                </div>
                <select
                  value={config.conflictResolution}
                  onChange={(e) => handleConfigUpdate({ conflictResolution: e.target.value as DeviceSyncConfig['conflictResolution'] })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="local-wins">本地优先</option>
                  <option value="remote-wins">远程优先</option>
                  <option value="newest-wins">最新优先</option>
                  <option value="manual">手动解决</option>
                </select>
              </div>

              <div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  同步间隔（秒）
                </div>
                <input
                  type="number"
                  value={config.syncIntervalMs / 1000}
                  onChange={(e) => handleConfigUpdate({ syncIntervalMs: Number(e.target.value) * 1000 })}
                  min={5}
                  max={300}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* 设备列表 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            连接的设备
          </h3>

          <div className="space-y-1">
            <DeviceListItem
              device={syncState.localDevice}
              isLocal={true}
            />

            {syncState.remoteDevices.map((device) => (
              <DeviceListItem
                key={device.id}
                device={device}
                isLocal={false}
                onRemove={handleRemoveDevice}
              />
            ))}
          </div>

          {syncState.remoteDevices.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              暂无其他设备连接
            </div>
          )}
        </div>

        {/* 冲突列表 */}
        {syncState.conflicts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              同步冲突
              <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 rounded-full text-xs">
                {syncState.conflicts.length}
              </span>
            </h3>

            <div className="space-y-2">
              {syncState.conflicts.map((conflict) => (
                <ConflictListItem
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={handleResolveConflict}
                />
              ))}
            </div>
          </div>
        )}

        {/* 离线队列 */}
        {syncState.offlineQueue.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              离线队列
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400 rounded-full text-xs">
                {syncState.offlineQueue.length}
              </span>
            </h3>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {syncState.offlineQueue.slice(0, 10).map((item) => (
                <OfflineQueueListItem key={item.id} item={item} />
              ))}

              {syncState.offlineQueue.length > 10 && (
                <div className="p-2 text-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-800">
                  还有 {syncState.offlineQueue.length - 10} 项...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 统计信息 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            同步统计
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.totalOperations}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">总操作数</div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.totalConflicts}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">冲突次数</div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.offlineQueueSize}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">队列大小</div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.remoteDevices}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">远程设备</div>
            </div>
          </div>
        </div>

        {/* 存储信息 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            存储信息
          </h3>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">已使用</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatBytes(syncState.localDevice.metadata.storageUsed)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    (syncState.localDevice.metadata.storageUsed / syncState.localDevice.metadata.storageLimit) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">总计</span>
              <span className="text-xs text-gray-500">
                {formatBytes(syncState.localDevice.metadata.storageLimit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiDeviceSyncPanel;
