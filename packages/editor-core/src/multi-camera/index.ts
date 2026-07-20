/**
 * 多机位编辑核心模块
 *
 * 提供多机位同步、切换生成、音频分组管理等核心功能。
 * 所有函数均为纯函数，不依赖 UI 框架或副作用。
 */

// 同步状态可视化
export {
  evaluateSyncQuality,
  calculateOverallSyncQuality,
  buildAngleSyncStatuses,
  buildSyncStatusSummary,
  getSyncQualityColor,
  getSyncQualityLabel,
  formatOffsetDisplay,
  buildSyncTimelineData,
} from './sync-status';

export type {
  SyncQualityLevel,
  AngleSyncStatus,
  MulticamSyncStatusSummary,
  SyncTimelinePoint,
  SyncAlignmentPreview,
} from './sync-status';

// 切换生成器
export {
  generateSwitchSegments,
  generateRealtimeSwitch,
  validateSwitchPoints,
  findSwitchIntervalWarnings,
} from './switch-generator';

export type {
  SwitchTransitionType,
  GeneratedSegment,
  GeneratedTransition,
  SwitchGenerationResult,
  AngleDefinition,
  SwitchPointDef,
  SwitchGenerationOptions,
} from './switch-generator';

// 音频分组管理
export {
  createMulticamAudioGroup,
  updateGroupActiveAngle,
  setGroupFollowMode,
  updateChannelVolume,
  toggleChannelMute,
  toggleChannelSolo,
  updateChannelPan,
  setGroupMasterVolume,
  toggleGroupMasterMute,
  calculateGroupMixParams,
  hasAnySolo,
  getActiveChannel,
  resetAllChannels,
} from './audio-grouping';

export type { AudioFollowMode, MulticamAudioChannel, MulticamAudioGroup, GroupMixParams } from './audio-grouping';
