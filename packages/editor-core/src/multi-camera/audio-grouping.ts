/**
 * 多机位音频分组管理模块
 *
 * 支持将多个机位的音频轨道进行分组管理，
 * 提供机位音频的快速跟随切换或独立混音模式。
 * 纯函数化设计。
 */

import { round } from '../time';

// ── 类型定义 ──────────────────────────────────────────────────

/** 音频跟随模式 */
export type AudioFollowMode = 'follow-video' | 'independent' | 'mixed';

/** 机位音频通道 */
export interface MulticamAudioChannel {
  /** 通道 ID */
  id: string;
  /** 所属机位 ID */
  angleId: string;
  /** 媒体 ID */
  mediaId: string;
  /** 通道名称 */
  name: string;
  /** 音量 (0-1) */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 是否独奏 */
  solo: boolean;
  /** 声像 (-1 到 1) */
  pan: number;
}

/** 多机位音频组 */
export interface MulticamAudioGroup {
  /** 组 ID */
  id: string;
  /** 组名称 */
  name: string;
  /** 音频跟随模式 */
  followMode: AudioFollowMode;
  /** 当前激活的机位索引（follow-video 模式下使用） */
  activeAngleIndex: number;
  /** 组内通道列表 */
  channels: MulticamAudioChannel[];
  /** 组主音量 (0-1) */
  masterVolume: number;
  /** 是否静音整组 */
  masterMuted: boolean;
}

/** 音频组混音参数 */
export interface GroupMixParams {
  /** 通道 ID */
  channelId: string;
  /** 最终音量（考虑组设置后） */
  effectiveVolume: number;
  /** 是否实际输出音频 */
  audible: boolean;
  /** 声像 */
  pan: number;
}

// ── 核心函数 ──────────────────────────────────────────────────

/**
 * 创建多机位音频组
 */
export function createMulticamAudioGroup(
  id: string,
  name: string,
  angles: Array<{ id: string; mediaId: string; name: string }>,
  followMode: AudioFollowMode = 'follow-video',
): MulticamAudioGroup {
  const channels: MulticamAudioChannel[] = angles.map((angle, index) => ({
    id: `mc-audio-${angle.id}`,
    angleId: angle.id,
    mediaId: angle.mediaId,
    name: `${angle.name} Audio`,
    volume: 1,
    muted: false,
    solo: false,
    pan: 0,
  }));

  return {
    id,
    name,
    followMode,
    activeAngleIndex: 0,
    channels,
    masterVolume: 1,
    masterMuted: false,
  };
}

/**
 * 更新音频组的激活机位（用于 follow-video 模式）
 */
export function updateGroupActiveAngle(
  group: MulticamAudioGroup,
  activeAngleIndex: number,
): MulticamAudioGroup {
  if (activeAngleIndex < 0 || activeAngleIndex >= group.channels.length) {
    return group;
  }
  return { ...group, activeAngleIndex };
}

/**
 * 设置音频跟随模式
 */
export function setGroupFollowMode(
  group: MulticamAudioGroup,
  mode: AudioFollowMode,
): MulticamAudioGroup {
  return { ...group, followMode: mode };
}

/**
 * 更新组内通道音量
 */
export function updateChannelVolume(
  group: MulticamAudioGroup,
  channelId: string,
  volume: number,
): MulticamAudioGroup {
  return {
    ...group,
    channels: group.channels.map((ch) =>
      ch.id === channelId ? { ...ch, volume: Math.max(0, Math.min(1, volume)) } : ch,
    ),
  };
}

/**
 * 切换通道静音状态
 */
export function toggleChannelMute(
  group: MulticamAudioGroup,
  channelId: string,
): MulticamAudioGroup {
  return {
    ...group,
    channels: group.channels.map((ch) =>
      ch.id === channelId ? { ...ch, muted: !ch.muted } : ch,
    ),
  };
}

/**
 * 切换通道独奏状态
 */
export function toggleChannelSolo(
  group: MulticamAudioGroup,
  channelId: string,
): MulticamAudioGroup {
  return {
    ...group,
    channels: group.channels.map((ch) =>
      ch.id === channelId ? { ...ch, solo: !ch.solo } : ch,
    ),
  };
}

/**
 * 更新通道声像
 */
export function updateChannelPan(
  group: MulticamAudioGroup,
  channelId: string,
  pan: number,
): MulticamAudioGroup {
  return {
    ...group,
    channels: group.channels.map((ch) =>
      ch.id === channelId ? { ...ch, pan: Math.max(-1, Math.min(1, pan)) } : ch,
    ),
  };
}

/**
 * 设置组主音量
 */
export function setGroupMasterVolume(
  group: MulticamAudioGroup,
  volume: number,
): MulticamAudioGroup {
  return { ...group, masterVolume: Math.max(0, Math.min(1, volume)) };
}

/**
 * 切换组静音
 */
export function toggleGroupMasterMute(group: MulticamAudioGroup): MulticamAudioGroup {
  return { ...group, masterMuted: !group.masterMuted };
}

/**
 * 计算每个通道的有效混音参数
 *
 * 根据 followMode 决定哪些通道实际输出音频：
 * - follow-video: 仅激活机位的通道输出
 * - independent: 所有未静音通道各自独立输出
 * - mixed: 所有未静音通道混合输出
 */
export function calculateGroupMixParams(group: MulticamAudioGroup): GroupMixParams[] {
  const hasSolo = group.channels.some((ch) => ch.solo);

  return group.channels.map((channel, index) => {
    // 基础可听性判断
    let audible = !group.masterMuted && !channel.muted;

    // 独奏模式：只有独奏的通道可听
    if (hasSolo) {
      audible = audible && channel.solo;
    }

    // 跟随模式：只有激活机位可听
    if (group.followMode === 'follow-video' && !hasSolo) {
      audible = audible && index === group.activeAngleIndex;
    }

    const effectiveVolume = audible ? round(channel.volume * group.masterVolume) : 0;

    return {
      channelId: channel.id,
      effectiveVolume,
      audible,
      pan: channel.pan,
    };
  });
}

/**
 * 检查是否有任何通道正在独奏
 */
export function hasAnySolo(group: MulticamAudioGroup): boolean {
  return group.channels.some((ch) => ch.solo);
}

/**
 * 获取当前激活通道的信息
 */
export function getActiveChannel(group: MulticamAudioGroup): MulticamAudioChannel | undefined {
  return group.channels[group.activeAngleIndex];
}

/**
 * 批量重置所有通道到默认状态
 */
export function resetAllChannels(group: MulticamAudioGroup): MulticamAudioGroup {
  return {
    ...group,
    channels: group.channels.map((ch) => ({
      ...ch,
      volume: 1,
      muted: false,
      solo: false,
      pan: 0,
    })),
    masterVolume: 1,
    masterMuted: false,
  };
}
