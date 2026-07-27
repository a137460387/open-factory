/**
 * 多机位音频分组管理模块
 *
 * 支持将多个机位的音频轨道进行分组管理，
 * 提供机位音频的快速跟随切换或独立混音模式。
 * 纯函数化设计。
 */
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
/**
 * 创建多机位音频组
 */
export declare function createMulticamAudioGroup(id: string, name: string, angles: Array<{
    id: string;
    mediaId: string;
    name: string;
}>, followMode?: AudioFollowMode): MulticamAudioGroup;
/**
 * 更新音频组的激活机位（用于 follow-video 模式）
 */
export declare function updateGroupActiveAngle(group: MulticamAudioGroup, activeAngleIndex: number): MulticamAudioGroup;
/**
 * 设置音频跟随模式
 */
export declare function setGroupFollowMode(group: MulticamAudioGroup, mode: AudioFollowMode): MulticamAudioGroup;
/**
 * 更新组内通道音量
 */
export declare function updateChannelVolume(group: MulticamAudioGroup, channelId: string, volume: number): MulticamAudioGroup;
/**
 * 切换通道静音状态
 */
export declare function toggleChannelMute(group: MulticamAudioGroup, channelId: string): MulticamAudioGroup;
/**
 * 切换通道独奏状态
 */
export declare function toggleChannelSolo(group: MulticamAudioGroup, channelId: string): MulticamAudioGroup;
/**
 * 更新通道声像
 */
export declare function updateChannelPan(group: MulticamAudioGroup, channelId: string, pan: number): MulticamAudioGroup;
/**
 * 设置组主音量
 */
export declare function setGroupMasterVolume(group: MulticamAudioGroup, volume: number): MulticamAudioGroup;
/**
 * 切换组静音
 */
export declare function toggleGroupMasterMute(group: MulticamAudioGroup): MulticamAudioGroup;
/**
 * 计算每个通道的有效混音参数
 *
 * 根据 followMode 决定哪些通道实际输出音频：
 * - follow-video: 仅激活机位的通道输出
 * - independent: 所有未静音通道各自独立输出
 * - mixed: 所有未静音通道混合输出
 */
export declare function calculateGroupMixParams(group: MulticamAudioGroup): GroupMixParams[];
/**
 * 检查是否有任何通道正在独奏
 */
export declare function hasAnySolo(group: MulticamAudioGroup): boolean;
/**
 * 获取当前激活通道的信息
 */
export declare function getActiveChannel(group: MulticamAudioGroup): MulticamAudioChannel | undefined;
/**
 * 批量重置所有通道到默认状态
 */
export declare function resetAllChannels(group: MulticamAudioGroup): MulticamAudioGroup;
//# sourceMappingURL=audio-grouping.d.ts.map